const fs = require('node:fs/promises');
const path = require('node:path');
const { randomBytes, randomUUID, createHash } = require('node:crypto');
const { loadEnvConfig } = require('@next/env');
loadEnvConfig(process.cwd());
const { Client } = require('pg');
const db = require('../lib/database');
const { migrate, legacySnapshot, importLegacy } = require('../lib/migrations');
const { hashPassword } = require('../lib/passwords');
const { emailAddress } = require('../lib/users');
const envFile = path.join(process.cwd(), '.env.local');
const provisioningFile = path.join(process.cwd(), '.local/setup/provisioning.json');

async function saveSetting(key, value) {
  let text = '';
  try { text = await fs.readFile(envFile, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const lines = text.split(/\r?\n/).filter((line) => !new RegExp(`^\\s*${key}\\s*=`).test(line));
  if (value !== undefined) lines.push(`${key}=${JSON.stringify(value)}`);
  await fs.writeFile(envFile, lines.filter((line, index, array) => line || index < array.length - 1).join('\n') + '\n', { mode: 0o600 });
}

async function provision() {
  let pending = null;
  try { pending = JSON.parse(await fs.readFile(provisioningFile, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (process.env.DATABASE_URL && !pending) return;
  if (!process.env.POSTGRES_ADMIN_PASSWORD) throw new Error('Isi POSTGRES_ADMIN_PASSWORD di .env.local dengan kata sandi instalasi PostgreSQL, lalu jalankan kembali npm run db:setup.');
  const port = Number(process.env.POSTGRES_ADMIN_PORT) || 5432;
  const admin = new Client({ host: '127.0.0.1', port, user: process.env.POSTGRES_ADMIN_USER || 'postgres', database: 'postgres', password: process.env.POSTGRES_ADMIN_PASSWORD, connectionTimeoutMillis: 5000 });
  await admin.connect();
  try {
    const role = 'sdn_bangah_app';
    const database = 'sdn_bangah';
    const existingRole = await admin.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [role]);
    const existingDatabase = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [database]);
    if (!pending && (existingRole.rows.length || existingDatabase.rows.length)) throw new Error('Role atau database sdn_bangah sudah ada. Isi DATABASE_URL dengan koneksi yang sesuai agar tidak menimpa konfigurasi lama.');
    const password = pending ? new URL(process.env.DATABASE_URL).password : randomBytes(32).toString('base64url');
    const url = pending ? process.env.DATABASE_URL : `postgresql://${role}:${password}@127.0.0.1:${port}/${database}`;
    const hash = createHash('sha256').update(url).digest('hex');
    if (pending && pending.hash !== hash) throw new Error('Konfigurasi koneksi berubah saat setup belum selesai. Periksa .local/setup/provisioning.json.');
    // Persist the generated application credentials before provisioning, so they are not lost on interruption.
    await saveSetting('DATABASE_URL', url);
    await fs.mkdir(path.dirname(provisioningFile), { recursive: true });
    await fs.writeFile(provisioningFile, JSON.stringify({ hash }), { mode: 0o600 });
    if (!existingRole.rows.length) {
      const roleSql = await admin.query("SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', $1::text, $2::text) AS sql", [role, password]);
      await admin.query(roleSql.rows[0].sql);
    }
    if (!existingDatabase.rows.length) await admin.query(`CREATE DATABASE ${database} OWNER ${role}`);
    await admin.query(`REVOKE ALL ON DATABASE ${database} FROM PUBLIC`);
    process.env.DATABASE_URL = url;
    console.log('Database lokal sdn_bangah dan role aplikasi dibuat.');
  } finally { await admin.end(); }
}

async function initialAdmin(pool) {
  const existing = await pool.query("SELECT id, email FROM users WHERE role = 'admin' ORDER BY created_at LIMIT 1");
  if (existing.rows.length) return existing.rows[0];
  const email = emailAddress(process.env.ADMIN_EMAIL || 'admin@sdnbangah.local');
  let password = process.env.ADMIN_PASSWORD;
  const credentialFile = '.local/setup/admin-credentials.txt';
  if (!password) {
    try {
      const previous = await fs.readFile(credentialFile, 'utf8');
      if (previous.split('\n')[0] !== `Email: ${email}`) throw new Error('File kredensial admin awal sudah ada dengan email berbeda. Periksa .local/setup/admin-credentials.txt.');
      password = previous.match(/^Password: (.+)$/m)?.[1];
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  password ||= randomBytes(18).toString('base64url');
  const hash = await hashPassword(password);
  const id = randomUUID();
  await fs.mkdir('.local/setup', { recursive: true });
  await fs.writeFile(credentialFile, `Email: ${email}\nPassword: ${password}\nLogin role: Admin\n`, { mode: 0o600 });
  await pool.query("INSERT INTO users(id, email, name, role, password_hash) VALUES($1, $2, $3, 'admin', $4)", [id, email, process.env.ADMIN_NAME || 'Administrator', hash]);
  console.log('Akun admin awal dibuat. Kredensial tersimpan di .local/setup/admin-credentials.txt.');
  return { id, email };
}

async function main() {
  await provision();
  const url = new URL(process.env.DATABASE_URL);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('Setup ini ditujukan untuk PostgreSQL lokal. Periksa DATABASE_URL.');
  const pool = db.getPool();
  await migrate(pool);
  const admin = await initialAdmin(pool);
  const snapshot = await legacySnapshot();
  const result = await importLegacy(pool, admin.id, snapshot);
  if (result.skipped) console.log('Import sudah pernah dilakukan; data SQL tidak ditimpa.');
  else console.log('Record JSON diimpor:', JSON.stringify(result.counts), '| duplikat identik:', result.duplicates);
  await saveSetting('POSTGRES_ADMIN_PASSWORD', undefined);
  await fs.rm(provisioningFile, { force: true });
  console.log(`PostgreSQL siap. Login sebagai Admin: ${admin.email}`);
  await pool.end();
}

main().catch(async (error) => {
  console.error(`Setup database gagal: ${error.message}`);
  if (globalThis.__sdnDatabase) await globalThis.__sdnDatabase.pool.end().catch(() => {});
  process.exitCode = 1;
});
