require('@next/env').loadEnvConfig(process.cwd());
const { getPool } = require('../lib/database');
const { migrate } = require('../lib/migrations');
const books = require('../lib/books');

(async () => {
  const pool = getPool();
  try {
    await migrate(pool);
    const result = await books.syncCatalog({ force: true });
    console.log(`Katalog SIBI tersinkron: ${result.total} buku SD (Merdeka ${result.merdeka}, K13 ${result.k13}).`, JSON.stringify(result.perGrade));
  } finally { await pool.end(); }
})().catch((error) => { console.error(`Sinkronisasi katalog gagal: ${error.message}`); process.exitCode = 1; });
