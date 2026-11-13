require('@next/env').loadEnvConfig(process.cwd());

async function main() {
  if (process.env.VERCEL) throw new Error('Run cloud bootstrap locally, outside the Vercel build.');
  if (!process.env.MIGRATION_DATABASE_URL) throw new Error('Set MIGRATION_DATABASE_URL to the direct or session-pooler connection.');
  if (new URL(process.env.MIGRATION_DATABASE_URL).port === '6543') throw new Error('Use the direct or session pooler connection (port 5432) for migrations.');
  process.env.DATABASE_URL = process.env.MIGRATION_DATABASE_URL;
  process.env.DATABASE_POOL_MODE = 'session';
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--content' || !['seed', 'legacy', 'none'].includes(args[1]))) {
    throw new Error('Usage: npm run db:bootstrap -- --content seed|legacy|none');
  }
  const { getPool } = require('../lib/database');
  const { bootstrap } = require('../lib/cloud-bootstrap');
  const pool = getPool();
  try {
    const result = await bootstrap(pool, { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD,
      name: process.env.ADMIN_NAME || 'Administrator', content: args[1] || 'seed' });
    console.log(result.created ? 'Initial admin created.' : 'Existing admin kept; password unchanged.');
    if (result.imported) console.log(result.imported.skipped ? 'Content already initialized; existing records kept.' : 'Initial content imported.');
    console.log('Cloud database ready. Admin credentials were not written to disk.');
  } finally { await pool.end(); }
}

main().catch((error) => {
  // Avoid exposing connection URLs or passwords through driver error messages.
  console.error('Cloud bootstrap failed:', error.code || error.message);
  process.exitCode = 1;
});
