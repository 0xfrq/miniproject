const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { schemaName } = require('./database');
const { seed } = require('./legacy-data');
const { isDeepStrictEqual } = require('node:util');

async function migrate(pool) {
  const schema = schemaName();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`sdn-bangah-migrations:${schema}`]);
    await client.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
    await client.query(`SET LOCAL search_path TO "${schema}"`);
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY, sha256 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
    const directory = path.join(process.cwd(), 'db', 'migrations');
    for (const name of (await fs.readdir(directory)).filter((item) => item.endsWith('.sql')).sort()) {
      const sql = (await fs.readFile(path.join(directory, name), 'utf8')).replace(/\r\n/g, '\n');
      const hash = createHash('sha256').update(sql).digest('hex');
      const existing = await client.query('SELECT sha256 FROM schema_migrations WHERE name = $1', [name]);
      if (existing.rows.length) {
        if (existing.rows[0].sha256 !== hash) throw new Error(`Migrasi ${name} sudah dijalankan dengan isi yang berbeda.`);
        continue;
      }
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations(name, sha256) VALUES($1, $2)', [name, hash]);
    }
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

async function legacySnapshot(file = path.join(process.cwd(), 'data', 'db.json')) {
  let text;
  try { text = await fs.readFile(file, 'utf8'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; text = JSON.stringify(seed); }
  const source = JSON.parse(text.replace(/^\uFEFF/, ''));
  const collections = ['values', 'activities', 'posts', 'agenda', 'materials', 'assessments', 'questions', 'grading'];
  const data = { meta: source.meta || {} };
  let duplicates = 0;
  for (const name of collections) {
    if (!Array.isArray(source[name])) throw new Error(`Collection ${name} tidak valid pada JSON asal.`);
    const seen = new Map();
    data[name] = [];
    for (const item of source[name]) {
      if (!item || typeof item.id !== 'string' || !item.id) throw new Error(`Record ${name} tidak memiliki ID yang valid.`);
      if (seen.has(item.id)) {
        // Equal IDs refer to one record; differing copies require manual resolution.
        if (!isDeepStrictEqual(seen.get(item.id), item)) throw new Error(`ID ${name}/${item.id} memiliki isi yang berbeda.`);
        duplicates += 1;
        continue;
      }
      seen.set(item.id, item);
      data[name].push(item);
    }
  }
  const assessments = new Set(data.assessments.map((item) => item.id));
  for (const name of ['questions', 'grading']) {
    for (const item of data[name]) if (item.assessmentId && !assessments.has(item.assessmentId)) throw new Error(`Ulangan ${item.assessmentId} untuk ${name}/${item.id} tidak ditemukan.`);
  }
  return { data, duplicates, hash: createHash('sha256').update(text).digest('hex') };
}

async function importLegacy(pool, ownerId, snapshot) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`sdn-bangah-legacy:${schemaName()}`]);
    const imported = await client.query("SELECT counts FROM legacy_imports WHERE name = 'data/db.json'");
    if (imported.rows.length) { await client.query('COMMIT'); return { skipped: true, counts: imported.rows[0].counts }; }
    const populated = await client.query(`SELECT (SELECT count(*) FROM site_settings) + (SELECT count(*) FROM public_records) +
      (SELECT count(*) FROM materials) + (SELECT count(*) FROM assessments) + (SELECT count(*) FROM questions) + (SELECT count(*) FROM grading) AS count`);
    if (Number(populated.rows[0].count)) throw new Error('Database sudah berisi konten tanpa tanda import. Import dihentikan agar data tidak tertimpa.');
    await client.query('INSERT INTO site_settings(id, meta) VALUES(1, $1)', [snapshot.data.meta]);
    const counts = {};
    for (const name of ['values', 'activities', 'posts', 'agenda']) {
      counts[name] = snapshot.data[name].length;
      for (let index = 0; index < snapshot.data[name].length; index += 1) {
        const item = snapshot.data[name][index];
        await client.query('INSERT INTO public_records(collection, id, payload, position) VALUES($1, $2, $3, $4)', [name, item.id, item, -index]);
      }
    }
    for (const name of ['materials', 'assessments', 'questions', 'grading']) {
      counts[name] = snapshot.data[name].length;
      for (let index = 0; index < snapshot.data[name].length; index += 1) {
        const item = snapshot.data[name][index];
        if (name === 'questions' || name === 'grading') {
          await client.query(`INSERT INTO ${name}(id, owner_id, assessment_id, payload, position) VALUES($1, $2, $3, $4, $5)`, [item.id, ownerId, item.assessmentId || null, item, -index]);
        } else {
          await client.query(`INSERT INTO ${name}(id, owner_id, payload, position) VALUES($1, $2, $3, $4)`, [item.id, ownerId, item, -index]);
        }
      }
    }
    await client.query("INSERT INTO legacy_imports(name, sha256, counts) VALUES('data/db.json', $1, $2)", [snapshot.hash, counts]);
    await client.query('COMMIT');
    return { skipped: false, counts, duplicates: snapshot.duplicates };
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

module.exports = { migrate, legacySnapshot, importLegacy };
