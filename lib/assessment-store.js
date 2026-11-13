const { randomUUID } = require('node:crypto');
const db = require('./database');
const { ApiError } = require('./api');
const rules = require('./assessments');

function scope(user) {
  if (!user?.id || !['admin', 'guru'].includes(user.role)) throw new ApiError(401, 'Silakan masuk terlebih dahulu.');
  return user.role === 'admin' ? null : user.id;
}
function clean(input) {
  const { id, ownerId, owner_id, password, passwordHash, password_hash, questions, questionCount, createdAt, updatedAt, expectedUpdatedAt, _key, ...fields } = input;
  return fields;
}
async function children(client, id) {
  return (await client.query("SELECT payload FROM questions WHERE assessment_id=$1 ORDER BY payload->'number', position, id", [id])).rows.map((row) => row.payload);
}
async function lock(client, id, user) {
  return (await client.query('SELECT payload, owner_id FROM assessments WHERE id=$1 AND ($2::uuid IS NULL OR owner_id=$2) FOR UPDATE', [id, scope(user)])).rows[0];
}
async function get(id, user) {
  // One statement gives the parent and its questions a consistent SQL snapshot.
  const result = await db.getPool().query(`SELECT a.payload, COALESCE((SELECT jsonb_agg(q.payload ORDER BY q.payload->'number', q.position, q.id) FROM questions q WHERE q.assessment_id=a.id), '[]'::jsonb) AS questions
    FROM assessments a WHERE a.id=$1 AND ($2::uuid IS NULL OR a.owner_id=$2)`, [id, scope(user)]);
  const row = result.rows[0];
  return row ? { ...row.payload, questionCount: row.questions.length, questions: row.questions } : null;
}
async function writeBundle(client, row, metadata, rawQuestions, existing) {
  const normalized = rules.normalizeAssessment(metadata, rawQuestions);
  const previousTime = Date.parse(row.payload.updatedAt);
  const now = new Date(Math.max(Date.now(), Number.isFinite(previousTime) ? previousTime + 1 : 0)).toISOString();
  const assessment = { ...row.payload, ...clean(metadata), ...normalized.assessment, id: row.payload.id, createdAt: row.payload.createdAt || now, updatedAt: now };
  const previous = new Map(existing.map((item) => [item.id, item]));
  const seen = new Set();
  const saved = [];
  for (let index = 0; index < rawQuestions.length; index += 1) {
    const raw = rawQuestions[index];
    if (raw.id !== undefined && (!previous.has(raw.id) || seen.has(raw.id))) throw new ApiError(400, 'ID soal tidak sesuai dengan ulangan ini atau digunakan dua kali.');
    const id = raw.id || `question-${randomUUID()}`;
    seen.add(id);
    const item = { ...previous.get(id), ...clean(raw), ...normalized.questions[index], id, assessmentId: assessment.id, createdAt: previous.get(id)?.createdAt || now, updatedAt: now };
    if (previous.has(id)) {
      await client.query('UPDATE questions SET payload=$2, updated_at=now() WHERE id=$1 AND assessment_id=$3', [id, item, assessment.id]);
    } else {
      await client.query('INSERT INTO questions(id,owner_id,assessment_id,payload) VALUES($1,$2,$3,$4)', [id, row.owner_id, assessment.id, item]);
    }
    saved.push(item);
  }
  await client.query('DELETE FROM questions WHERE assessment_id=$1 AND NOT(id=ANY($2::text[]))', [assessment.id, saved.map((item) => item.id)]);
  await client.query('UPDATE assessments SET payload=$2,updated_at=now() WHERE id=$1', [assessment.id, assessment]);
  return { ...assessment, questions: saved };
}
async function create(input, questions, user) {
  scope(user);
  rules.normalizeAssessment(input, questions);
  return db.transaction(async (client) => {
    const now = new Date().toISOString();
    const assessment = { ...clean(input), id: `assessment-${randomUUID()}`, createdAt: now, updatedAt: now };
    await client.query('INSERT INTO assessments(id,owner_id,payload) VALUES($1,$2,$3)', [assessment.id, user.id, assessment]);
    // Client-generated IDs from generators are not database identities.
    return writeBundle(client, { payload: assessment, owner_id: user.id }, input, questions.map(({ id, ...item }) => item), []);
  });
}
async function update(id, input, user) {
  return db.transaction(async (client) => {
    const row = await lock(client, id, user);
    if (!row) return null;
    if (input.expectedUpdatedAt !== undefined && input.expectedUpdatedAt !== row.payload.updatedAt) throw new ApiError(409, 'Ulangan telah berubah. Muat ulang halaman sebelum mengedit kembali.');
    const existing = await children(client, id);
    return writeBundle(client, row, { ...row.payload, ...clean(input) }, input.questions === undefined ? existing : input.questions, existing);
  });
}
async function remove(id, user) {
  return db.transaction(async (client) => {
    const row = await lock(client, id, user);
    if (!row) return false;
    if ((await client.query('SELECT 1 FROM grading WHERE assessment_id=$1 LIMIT 1', [id])).rowCount) throw new ApiError(409, 'Ulangan memiliki hasil penilaian dan tidak dapat dihapus. Hasil penilaian tetap disimpan.');
    await client.query('DELETE FROM assessments WHERE id=$1', [id]);
    return true;
  });
}

// Keep direct question API writes consistent with the assessment editor.
async function mutateQuestion(action, id, input, user) {
  const owner = scope(user);
  if (input.correct === undefined && input.answer !== undefined) input = { ...input, correct: input.answer };
  return db.transaction(async (client) => {
    let current;
    if (action !== 'create') {
      current = (await client.query('SELECT payload,assessment_id FROM questions WHERE id=$1 AND ($2::uuid IS NULL OR owner_id=$2)', [id, owner])).rows[0];
      if (!current) return action === 'delete' ? false : null;
      if (input.assessmentId !== undefined && (input.assessmentId || null) !== current.assessment_id) throw new ApiError(400, 'ID ulangan pada soal tidak dapat diganti. Tambahkan soal melalui editor ulangan tujuan.');
    }
    const parentId = current?.assessment_id || input.assessmentId || null;
    if (!parentId) {
      if (action === 'delete') return (await client.query('DELETE FROM questions WHERE id=$1 AND ($2::uuid IS NULL OR owner_id=$2)', [id, owner])).rowCount > 0;
      if (current) current = (await client.query('SELECT payload FROM questions WHERE id=$1 AND ($2::uuid IS NULL OR owner_id=$2) FOR UPDATE', [id, owner])).rows[0];
      if (action === 'update' && !current) return null;
      const raw = { ...current?.payload, ...input };
      const now = new Date().toISOString();
      const item = { ...clean(raw), ...rules.normalizeQuestion(raw, Math.max(0, (Number(raw.number) || 1) - 1), false), id: id || `question-${randomUUID()}`, assessmentId: null, createdAt: current?.payload.createdAt || now, updatedAt: now };
      if (action === 'create') await client.query('INSERT INTO questions(id,owner_id,payload) VALUES($1,$2,$3)', [item.id, user.id, item]);
      else await client.query('UPDATE questions SET payload=$2,updated_at=now() WHERE id=$1', [id, item]);
      return item;
    }
    const row = await lock(client, parentId, user);
    if (!row) throw new ApiError(404, 'Ulangan tidak ditemukan.');
    const existing = await children(client, parentId);
    if (action !== 'create' && !existing.some((item) => item.id === id)) return action === 'delete' ? false : null;
    const prospective = action === 'create' ? [...existing, clean(input)] : action === 'delete' ? existing.filter((item) => item.id !== id) : existing.map((item) => item.id === id ? { ...item, ...clean(input), id } : item);
    const saved = await writeBundle(client, row, row.payload, prospective, existing);
    return action === 'delete' ? true : action === 'create' ? saved.questions.at(-1) : saved.questions.find((item) => item.id === id);
  });
}
module.exports = { get, create, update, remove, mutateQuestion };
