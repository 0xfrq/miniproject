const { randomUUID } = require('node:crypto');
const db = require('./database');
const { ApiError } = require('./api');
const { validatePublicRecord, validateSiteMeta } = require('./public-content');
const { normalizeMaterial } = require('./materials');
const assessmentStore = require('./assessment-store');
const gradingStore = require('./grading-store');
const gradingRules = require('./grading');
const publicCollections = new Set(['values', 'activities', 'posts', 'agenda']);
const privateCollections = new Set(['materials', 'assessments', 'questions', 'grading']);

function checkCollection(collection) {
  if (!publicCollections.has(collection) && !privateCollections.has(collection)) throw new ApiError(404, 'Data tidak ditemukan.');
}

function ownerScope(user) {
  if (!user || !user.id || !['admin', 'guru'].includes(user.role)) throw new ApiError(401, 'Silakan masuk terlebih dahulu.');
  return user.role === 'admin' ? null : user.id;
}

function cleanInput(input) {
  const { ownerId, owner_id, password, passwordHash, password_hash, ...rest } = input;
  return rest;
}

async function list(collection, user, connection = db.getPool()) {
  checkCollection(collection);
  const result = publicCollections.has(collection)
    ? await connection.query('SELECT payload FROM public_records WHERE collection = $1 ORDER BY position DESC, id', [collection])
    : await connection.query(`SELECT payload FROM ${collection} WHERE ($1::uuid IS NULL OR owner_id = $1) ORDER BY position DESC, id`, [ownerScope(user)]);
  return result.rows.map((row) => row.payload);
}

async function get(collection, id, user) {
  checkCollection(collection);
  if (collection === 'assessments') return assessmentStore.get(id, user);
  const result = publicCollections.has(collection)
    ? await db.getPool().query('SELECT payload FROM public_records WHERE collection = $1 AND id = $2', [collection, id])
    : await db.getPool().query(`SELECT payload FROM ${collection} WHERE id = $1 AND ($2::uuid IS NULL OR owner_id = $2)`, [id, ownerScope(user)]);
  return result.rows[0]?.payload || null;
}

async function parentOwner(client, assessmentId, user, currentOwner = user.id) {
  if (assessmentId === null || assessmentId === undefined || assessmentId === '') return currentOwner;
  if (typeof assessmentId !== 'string') throw new ApiError(400, 'ID ulangan tidak valid.');
  const parent = await client.query('SELECT owner_id FROM assessments WHERE id = $1 FOR KEY SHARE', [assessmentId]);
  if (!parent.rows[0] || (user.role !== 'admin' && parent.rows[0].owner_id !== user.id)) throw new ApiError(404, 'Ulangan tidak ditemukan.');
  return parent.rows[0].owner_id;
}

async function createWithClient(collection, input, user, client) {
  checkCollection(collection);
  const now = new Date().toISOString();
  const id = `${collection.slice(0, -1)}-${randomUUID()}`;
  const item = { createdAt: now, updatedAt: now, ...cleanInput(input), id };
  if (publicCollections.has(collection)) {
    if (user?.role !== 'admin') throw new ApiError(403, 'Hanya admin yang dapat mengubah konten sekolah.');
    validatePublicRecord(collection, item);
    await client.query('INSERT INTO public_records(collection, id, payload) VALUES($1, $2, $3)', [collection, id, item]);
  } else {
    ownerScope(user);
    if (collection === 'materials') Object.assign(item, normalizeMaterial(item), { createdAt: now, updatedAt: now });
    if (collection === 'questions' || collection === 'grading') {
      const assessmentId = item.assessmentId || null;
      const owner = await parentOwner(client, assessmentId, user);
      await client.query(`INSERT INTO ${collection}(id, owner_id, assessment_id, payload) VALUES($1, $2, $3, $4)`, [id, owner, assessmentId, item]);
    } else {
      await client.query(`INSERT INTO ${collection}(id, owner_id, payload) VALUES($1, $2, $3)`, [id, user.id, item]);
    }
  }
  return item;
}

async function create(collection, input, user) {
  if (collection === 'assessments') return assessmentStore.create(input, input.questions === undefined ? [] : input.questions, user);
  if (collection === 'questions') return assessmentStore.mutateQuestion('create', null, input, user);
  if (collection === 'grading') return gradingStore.create(input, user);
  return db.transaction((client) => createWithClient(collection, input, user, client));
}

async function createAssessment(input, questions, user) {
  return assessmentStore.create(input, questions, user);
}

async function update(collection, id, input, user) {
  checkCollection(collection);
  if (collection === 'assessments') return assessmentStore.update(id, input, user);
  if (collection === 'questions') return assessmentStore.mutateQuestion('update', id, input, user);
  if (collection === 'grading') return gradingStore.update(id, input, user);
  return db.transaction(async (client) => {
    let row;
    if (publicCollections.has(collection)) {
      if (user?.role !== 'admin') throw new ApiError(403, 'Hanya admin yang dapat mengubah konten sekolah.');
      row = (await client.query('SELECT payload FROM public_records WHERE collection = $1 AND id = $2 FOR UPDATE', [collection, id])).rows[0];
    } else {
      row = (await client.query(`SELECT payload, owner_id FROM ${collection} WHERE id = $1 AND ($2::uuid IS NULL OR owner_id = $2) FOR UPDATE`, [id, ownerScope(user)])).rows[0];
    }
    if (!row) return null;
    const { createdAt, ...changes } = cleanInput(input);
    const item = { ...row.payload, ...changes, id, updatedAt: new Date().toISOString() };
    if (collection === 'materials') Object.assign(item, normalizeMaterial(item));
    if (publicCollections.has(collection)) {
      validatePublicRecord(collection, item);
      await client.query('UPDATE public_records SET payload = $3 WHERE collection = $1 AND id = $2', [collection, id, item]);
    } else if (collection === 'questions' || collection === 'grading') {
      const assessmentId = item.assessmentId || null;
      const owner = await parentOwner(client, assessmentId, user, row.owner_id);
      await client.query(`UPDATE ${collection} SET payload = $2, assessment_id = $3, owner_id = $4, updated_at = now() WHERE id = $1`, [id, item, assessmentId, owner]);
    } else {
      await client.query(`UPDATE ${collection} SET payload = $2, updated_at = now() WHERE id = $1`, [id, item]);
    }
    return item;
  });
}

async function remove(collection, id, user) {
  checkCollection(collection);
  if (collection === 'assessments') return assessmentStore.remove(id, user);
  if (collection === 'questions') return assessmentStore.mutateQuestion('delete', id, {}, user);
  let result;
  if (publicCollections.has(collection)) {
    if (user?.role !== 'admin') throw new ApiError(403, 'Hanya admin yang dapat mengubah konten sekolah.');
    result = await db.getPool().query('DELETE FROM public_records WHERE collection = $1 AND id = $2', [collection, id]);
  } else {
    result = await db.getPool().query(`DELETE FROM ${collection} WHERE id = $1 AND ($2::uuid IS NULL OR owner_id = $2)`, [id, ownerScope(user)]);
  }
  return result.rowCount > 0;
}

async function getSiteMeta(connection = db.getPool()) {
  const result = await connection.query('SELECT meta FROM site_settings WHERE id = 1');
  return result.rows[0]?.meta || {};
}

async function assessmentGrades(id, user) {
  const result = await db.getPool().query(`SELECT a.payload, COALESCE((SELECT jsonb_agg(g.payload ORDER BY CASE WHEN g.payload->>'studentNumber' ~ '^[0-9]{1,6}$' THEN (g.payload->>'studentNumber')::int END NULLS LAST, lower(g.payload->>'studentName'),g.position,g.id)
    FROM grading g WHERE g.assessment_id=a.id AND ($2::uuid IS NULL OR g.owner_id=$2)), '[]'::jsonb) AS results
    FROM assessments a WHERE a.id=$1 AND ($2::uuid IS NULL OR a.owner_id=$2)`, [id, ownerScope(user)]);
  const row = result.rows[0];
  return row ? { assessment: row.payload, results: row.results } : null;
}

async function getSite(connection = db.getPool()) {
  const meta = await getSiteMeta(connection);
  const values = await list('values', null, connection);
  const activities = await list('activities', null, connection);
  const posts = await list('posts', null, connection);
  const agenda = await list('agenda', null, connection);
  return { meta, values, activities, posts, agenda };
}

async function updateSite(input, user) {
  if (user?.role !== 'admin') throw new ApiError(403, 'Hanya admin yang dapat mengubah profil sekolah.');
  if (input.meta !== undefined && (!input.meta || typeof input.meta !== 'object' || Array.isArray(input.meta))) throw new ApiError(400, 'Data profil tidak valid.');
  if (input.meta) validateSiteMeta(input.meta);
  if (input.values !== undefined && (!Array.isArray(input.values) || input.values.some((value) => !value || typeof value !== 'object' || Array.isArray(value)))) throw new ApiError(400, 'Nilai sekolah tidak valid.');
  return db.transaction(async (client) => {
    await client.query("INSERT INTO site_settings(id, meta) VALUES(1, $1) ON CONFLICT(id) DO UPDATE SET meta = site_settings.meta || EXCLUDED.meta", [input.meta || {}]);
    if (input.values) {
      await client.query("DELETE FROM public_records WHERE collection = 'values'");
      for (let index = 0; index < input.values.length; index += 1) {
        const value = { ...input.values[index], id: input.values[index].id || `value-${randomUUID()}` };
        await client.query("INSERT INTO public_records(collection, id, payload, position) VALUES('values', $1, $2, $3)", [value.id, value, -index]);
      }
    }
    return getSite(client);
  });
}

async function dashboard(user) {
  ownerScope(user);
  const [materials, assessments, questions, grading, activities, posts, agenda] = await Promise.all(
    ['materials', 'assessments', 'questions', 'grading', 'activities', 'posts', 'agenda'].map((collection) => list(collection, user))
  );
  return {
    counts: { materials: materials.length, assessments: assessments.length, activities: activities.length, posts: posts.length, agenda: agenda.length, graded: grading.length },
    recentMaterials: materials.slice(0, 4), recentAssessments: assessments.slice(0, 4), recentQuestions: questions.slice(0, 5), recentResults: grading.slice(0, 5),
    gradingSummary: gradingRules.summary(grading),
  };
}

module.exports = { list, get, create, createAssessment, update, remove, getSiteMeta, getSite, updateSite, assessmentGrades, dashboard, publicCollections };
