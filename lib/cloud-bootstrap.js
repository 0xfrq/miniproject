const { randomUUID, createHash } = require('node:crypto');
const { hashPassword } = require('./passwords');
const { emailAddress } = require('./users');
const { migrate, legacySnapshot, importLegacy } = require('./migrations');
const { seed } = require('./legacy-data');

async function bootstrap(pool, { email, password, name = 'Administrator', content = 'seed' } = {}) {
  if (!['seed', 'legacy', 'none'].includes(content)) throw new Error('Content harus seed, legacy, atau none.');
  // Validate the complete source before changing the target database.
  let snapshot;
  if (content === 'legacy') snapshot = await legacySnapshot();
  if (content === 'seed') {
    const data = { ...seed, materials: [], assessments: [], questions: [], grading: [] };
    snapshot = { data, duplicates: 0, hash: createHash('sha256').update(JSON.stringify(data)).digest('hex') };
  }
  await migrate(pool);
  const client = await pool.connect();
  let admin;
  let created = false;
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['sdn-bangah-cloud-admin']);
    admin = (await client.query("SELECT id, email FROM users WHERE role = 'admin' ORDER BY created_at LIMIT 1")).rows[0];
    if (!admin) {
      const normalizedEmail = emailAddress(email);
      const hash = await hashPassword(password);
      if (typeof name !== 'string' || !name.trim() || name.length > 120) throw new Error('ADMIN_NAME tidak valid.');
      admin = { id: randomUUID(), email: normalizedEmail };
      await client.query("INSERT INTO users(id, email, name, role, password_hash) VALUES($1, $2, $3, 'admin', $4)", [admin.id, admin.email, name.trim(), hash]);
      created = true;
    }
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
  const imported = snapshot ? await importLegacy(pool, admin.id, snapshot) : null;
  return { admin, created, imported };
}

module.exports = { bootstrap };
