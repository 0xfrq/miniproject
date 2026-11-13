require('@next/env').loadEnvConfig(process.cwd());
const { getPool } = require('../lib/database');
const { migrate } = require('../lib/migrations');

(async () => {
  const pool = getPool();
  try { await migrate(pool); console.log('Migrasi PostgreSQL selesai.'); }
  finally { await pool.end(); }
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
