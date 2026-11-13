require('@next/env').loadEnvConfig(process.cwd());
if (process.env.MIGRATION_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.MIGRATION_DATABASE_URL;
  process.env.DATABASE_POOL_MODE = 'session';
}
const { getPool } = require('../lib/database');
const { migrate } = require('../lib/migrations');

(async () => {
  const pool = getPool();
  try { await migrate(pool); console.log('Migrasi PostgreSQL selesai.'); }
  finally { await pool.end(); }
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
