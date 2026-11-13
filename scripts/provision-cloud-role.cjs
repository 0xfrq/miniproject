require('@next/env').loadEnvConfig(process.cwd());

async function main() {
  if (process.env.VERCEL || !process.env.MIGRATION_DATABASE_URL) throw new Error('Run locally with MIGRATION_DATABASE_URL configured.');
  if (new URL(process.env.MIGRATION_DATABASE_URL).port === '6543') throw new Error('Use a direct or session-pooler migration connection.');
  process.env.DATABASE_URL = process.env.MIGRATION_DATABASE_URL;
  process.env.DATABASE_POOL_MODE = 'session';
  const pool = require('../lib/database').getPool();
  try {
    const { created } = await require('../lib/runtime-role').provisionRuntimeRole(pool, process.env.APP_DATABASE_ROLE, process.env.APP_DATABASE_PASSWORD);
    console.log(created ? 'Restricted runtime role created and granted application access.' : 'Runtime grants updated; existing password kept.');
  } finally { await pool.end(); }
}

main().catch((error) => { console.error('Runtime role setup failed:', error.code || error.message); process.exitCode = 1; });
