// Contoh: npm run books:index -- 3710 3711     |     npm run books:index -- --grade 4 --curriculum merdeka --type guru
require('@next/env').loadEnvConfig(process.cwd());
const { getPool } = require('../lib/database');
const rag = require('../lib/rag');
const books = require('../lib/books');

function option(name) { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; }

(async () => {
  const pool = getPool();
  try {
    let ids = process.argv.slice(2).filter((arg, index, list) => !arg.startsWith('--') && !list[index - 1]?.startsWith('--'));
    if (!ids.length) {
      const result = await books.search({ grade: option('grade'), curriculum: option('curriculum'), type: option('type'), subject: option('subject'), q: option('q'), limit: 100 });
      ids = result.items.filter((book) => book.index.status !== 'ready').map((book) => book.id);
    }
    if (!ids.length) { console.log('Tidak ada buku yang perlu diindeks.'); return; }
    for (const id of ids) {
      const book = await rag.startIndex(id);
      process.stdout.write(`- ${book.title} … `);
      await rag.waitForIndex(id, 30 * 60_000);
      const done = await books.get(id);
      console.log(done.index.status === 'ready' ? `siap (${done.index.pages} halaman, ${done.index.chunks} potongan)` : `gagal: ${done.index.error}`);
    }
  } finally { await pool.end(); }
})().catch((error) => { console.error(`Indexing gagal: ${error.message}`); process.exitCode = 1; });
