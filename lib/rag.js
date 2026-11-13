const path = require('node:path');
const { Worker } = require('node:worker_threads');
const db = require('./database');
const ai = require('./ai-client');
const books = require('./books');
const { ApiError } = require('./api');

const CHUNK_WORDS = 220;
const CHUNK_OVERLAP = 40;
const EMBED_BATCH = 100;
const MIN_TEXT_CHARS = 2000;

function cleanPage(text) {
  return String(text || '')
    .replace(/­/g, '')
    .replace(/(\p{L})-\s*\n\s*(\p{Ll})/gu, '$1$2')
    .replace(/[ \t\f\v ]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

// Potong teks per kata dengan overlap; setiap potongan menyimpan rentang halaman PDF asal.
function chunkPages(pages, { size = CHUNK_WORDS, overlap = CHUNK_OVERLAP } = {}) {
  const words = [];
  pages.forEach((text, index) => {
    for (const word of cleanPage(text).split(/\s+/)) if (word) words.push({ word, page: index + 1 });
  });
  const chunks = [];
  const step = Math.max(1, size - overlap);
  for (let start = 0; start < words.length; start += step) {
    const slice = words.slice(start, start + size);
    if (slice.length < 25 && chunks.length) break;
    const content = slice.map((item) => item.word).join(' ');
    if (content.replace(/[^\p{L}]/gu, '').length < 80) continue;
    chunks.push({ index: chunks.length, pageStart: slice[0].page, pageEnd: slice.at(-1).page, content });
    if (start + size >= words.length) break;
  }
  return chunks;
}

// Dijalankan di worker thread (file .mjs dimuat saat runtime, tidak di-bundle Next.js).
function extractPages(file, onProgress = () => {}) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(process.cwd(), 'lib', 'pdf-extract-worker.mjs'), { workerData: { file }, resourceLimits: { maxOldGenerationSizeMb: 2048 } });
    let settled = false;
    const finish = (callback, value) => { if (!settled) { settled = true; callback(value); worker.terminate().catch(() => {}); } };
    worker.on('message', (message) => {
      if (message.type === 'progress') onProgress(message.done, message.total);
      else if (message.type === 'done') finish(resolve, { totalPages: message.totalPages, pages: message.pages });
      else if (message.type === 'error') finish(reject, new ApiError(422, `PDF tidak dapat dibaca: ${message.message}`));
    });
    worker.on('error', (error) => finish(reject, error));
    worker.on('exit', (code) => finish(reject, new Error(`Worker PDF berhenti (kode ${code}).`)));
  });
}

// Batch dibatasi jumlah item dan estimasi token agar satu permintaan muat dalam kuota per menit.
function embeddingBatches(inputs) {
  const budget = Math.floor(ai.embeddingTokensPerMinute() * 0.4);
  const batches = [];
  let current = [];
  let tokens = 0;
  for (const input of inputs) {
    const cost = ai.estimateTokens(input);
    if (current.length && (current.length >= EMBED_BATCH || tokens + cost > budget)) { batches.push(current); current = []; tokens = 0; }
    current.push(input); tokens += cost;
  }
  if (current.length) batches.push(current);
  return batches;
}

async function setStatus(id, fields) {
  const keys = Object.keys(fields);
  // index_started_at berfungsi sebagai heartbeat selama proses berjalan.
  const heartbeat = fields.index_status === undefined ? ', index_started_at = now()' : '';
  await db.getPool().query(`UPDATE books SET ${keys.map((key, index) => `${key} = $${index + 2}`).join(', ')}${heartbeat} WHERE id = $1`, [id, ...keys.map((key) => fields[key])]);
}

const running = new Map();

async function runIndex(book) {
  try {
    await setStatus(book.id, { index_progress: 5 });
    const { file } = await books.ensurePdf(book);
    await setStatus(book.id, { index_progress: 15 });
    const { totalPages, pages } = await extractPages(file, (done, total) => { setStatus(book.id, { index_progress: 15 + Math.round((done / total) * 9) }).catch(() => {}); });
    const characters = pages.reduce((sum, page) => sum + page.length, 0);
    if (characters < MIN_TEXT_CHARS) throw new ApiError(422, 'PDF ini berupa gambar hasil scan sehingga teksnya tidak dapat dibaca untuk AI.');
    const chunks = chunkPages(pages);
    if (!chunks.length) throw new ApiError(422, 'Tidak ada teks yang dapat diindeks dari PDF ini.');
    await setStatus(book.id, { index_progress: 25, page_count: totalPages });
    const inputs = chunks.map((chunk) => `${book.title} (hal. ${chunk.pageStart})\n${chunk.content}`);
    const vectors = [];
    for (const batch of embeddingBatches(inputs)) {
      let attempt = 0;
      while (true) {
        try {
          vectors.push(...await ai.embed(batch));
          break;
        } catch (error) {
          attempt += 1;
          const retryable = ['AI_RATE_LIMIT', 'AI_TIMEOUT', 'AI_NETWORK_ERROR', 'AI_PROVIDER_ERROR'].includes(error.code);
          if (!retryable || attempt > (error.code === 'AI_RATE_LIMIT' ? 8 : 3)) {
            if (error.code === 'AI_RATE_LIMIT') throw new ApiError(429, 'Kuota embedding gratis Gemini sedang habis. Coba "Siapkan untuk AI" lagi beberapa saat lagi (atau besok bila kuota harian habis).');
            throw error;
          }
          await new Promise((resolve) => setTimeout(resolve, error.code === 'AI_RATE_LIMIT' ? error.retryAfterMs || 60_000 : attempt * 3_000));
        }
      }
      await setStatus(book.id, { index_progress: Math.min(95, 25 + Math.round((vectors.length / chunks.length) * 70)) });
    }
    await db.transaction(async (client) => {
      await client.query('DELETE FROM book_chunks WHERE book_id = $1', [book.id]);
      for (let start = 0; start < chunks.length; start += 100) {
        const batch = chunks.slice(start, start + 100);
        const values = [];
        const rows = batch.map((chunk, offset) => {
          values.push(book.id, chunk.index, chunk.pageStart, chunk.pageEnd, chunk.content, vectors[start + offset]);
          const base = offset * 6;
          return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}::real[])`;
        });
        await client.query(`INSERT INTO book_chunks(book_id, chunk_index, page_start, page_end, content, embedding) VALUES ${rows.join(', ')}`, values);
      }
      await client.query(`UPDATE books SET index_status = 'ready', index_progress = 100, index_error = '', indexed_at = now(), chunk_count = $2, page_count = $3 WHERE id = $1`, [book.id, chunks.length, totalPages]);
    });
  } catch (error) {
    const message = error.status && error.message ? error.message : `Indexing gagal: ${error.message || 'kesalahan tidak dikenal'}`;
    await setStatus(book.id, { index_status: 'failed', index_error: message.slice(0, 500), index_progress: 0 }).catch(() => {});
    console.error(`Indexing buku ${book.id} gagal:`, error.code || error.message);
  }
}

// Memulai indexing di latar belakang. Status dipantau melalui GET /api/books/:id.
async function startIndex(id) {
  const book = await books.get(id);
  if (!book) throw new ApiError(404, 'Buku tidak ditemukan.');
  if (book.index.status === 'ready') return book;
  if (running.has(id)) return book;
  const claimed = await db.getPool().query(`UPDATE books SET index_status = 'indexing', index_progress = 1, index_error = '', index_started_at = now()
    WHERE id = $1 AND (index_status <> 'indexing' OR index_started_at < now() - ($2 || ' minutes')::interval) RETURNING id`, [id, String(books.STALE_INDEX_MINUTES)]);
  if (!claimed.rowCount && book.index.status === 'indexing') return book;
  const task = runIndex(book).finally(() => running.delete(id));
  running.set(id, task);
  return books.get(id);
}

async function waitForIndex(id, timeoutMs) {
  const task = running.get(id);
  if (!task) return;
  let timer;
  await Promise.race([task, new Promise((resolve) => { timer = setTimeout(resolve, timeoutMs); })]);
  clearTimeout(timer);
}

// Retrieval hybrid: kemiripan embedding + full-text search bahasa Indonesia, digabung dengan RRF.
async function retrieve(query, { bookIds = [], limit = 8 } = {}) {
  const text = String(query || '').trim().slice(0, 4000);
  const ids = [...new Set((Array.isArray(bookIds) ? bookIds : []).filter((id) => typeof id === 'string'))].slice(0, 10);
  if (!text || !ids.length) return [];
  const pool = db.getPool();
  const ready = (await pool.query("SELECT id FROM books WHERE id = ANY($1::text[]) AND index_status = 'ready'", [ids])).rows.map((row) => row.id);
  if (!ready.length) return [];
  const lists = [];
  try {
    const [vector] = await ai.embed([text]);
    lists.push((await pool.query(`SELECT book_id, chunk_index FROM book_chunks WHERE book_id = ANY($1::text[])
      ORDER BY vector_dot(embedding, $2::real[]) DESC LIMIT 16`, [ready, vector])).rows);
  } catch (error) {
    if (error.code === 'AI_NOT_CONFIGURED') throw error;
    console.error('Embedding query gagal, memakai pencarian kata kunci saja:', error.code || error.message);
  }
  lists.push((await pool.query(`WITH q AS (
      SELECT to_tsquery('indonesian', NULLIF(array_to_string(ARRAY(SELECT lexeme FROM unnest(tsvector_to_array(to_tsvector('indonesian', $2))) AS lexeme WHERE lexeme ~ '^[[:alnum:]]+$'), ' | '), '')) AS query)
    SELECT book_id, chunk_index FROM book_chunks, q WHERE book_id = ANY($1::text[]) AND q.query IS NOT NULL AND tsv @@ q.query
    ORDER BY ts_rank_cd(tsv, q.query) DESC LIMIT 16`, [ready, text])).rows);
  const scores = new Map();
  for (const rows of lists) rows.forEach((row, rank) => {
    const key = `${row.book_id}\u0000${row.chunk_index}`;
    scores.set(key, (scores.get(key) || 0) + 1 / (60 + rank));
  });
  const top = [...scores.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([key]) => key.split('\u0000'));
  if (!top.length) return [];
  const rows = (await pool.query(`SELECT c.book_id, c.chunk_index, c.page_start, c.page_end, c.content, b.title, b.grade, b.curriculum, b.book_type, b.subject
    FROM book_chunks c JOIN books b ON b.id = c.book_id
    WHERE (c.book_id, c.chunk_index) IN (SELECT * FROM unnest($1::text[], $2::int[]))`, [top.map(([id]) => id), top.map(([, index]) => Number(index))])).rows;
  return top.map(([id, index]) => rows.find((row) => row.book_id === id && row.chunk_index === Number(index))).filter(Boolean).map((row, position) => ({
    n: position + 1, bookId: row.book_id, title: row.title, grade: row.grade, subject: row.subject,
    curriculum: row.curriculum === 'merdeka' ? 'Kurikulum Merdeka' : 'Kurikulum 2013', bookType: row.book_type === 'guru' ? 'Buku Guru' : 'Buku Siswa',
    pageStart: row.page_start, pageEnd: row.page_end, content: row.content,
    url: `/api/books/${encodeURIComponent(row.book_id)}/pdf#page=${row.page_start}`,
  }));
}

function pagesLabel(source) { return source.pageStart === source.pageEnd ? `hal. ${source.pageStart}` : `hal. ${source.pageStart}–${source.pageEnd}`; }

function contextBlock(sources) {
  if (!sources.length) return 'Tidak ada kutipan buku yang relevan ditemukan.';
  return sources.map((source) => `[${source.n}] ${source.title} — Kelas ${source.grade}, ${source.bookType}, ${source.curriculum}, ${pagesLabel(source)} PDF\n${source.content}`).join('\n\n');
}

// Ringkasan sumber untuk disimpan/ditampilkan tanpa seluruh teks potongan.
function sourceSummary(sources) {
  return sources.map(({ content, ...source }) => ({ ...source, excerpt: content.slice(0, 280) }));
}

// Pastikan buku yang dipilih sudah terindeks sebelum dipakai untuk generate.
async function requireReadyBooks(bookIds) {
  const selected = await books.getMany(bookIds);
  const pending = selected.filter((book) => book.index.status !== 'ready');
  if (pending.length) throw new ApiError(409, `Buku berikut belum siap dipakai AI: ${pending.map((book) => book.title).join('; ')}. Klik "Siapkan untuk AI" dan tunggu hingga selesai.`);
  return selected;
}

module.exports = { embeddingBatches, chunkPages, cleanPage, extractPages, startIndex, waitForIndex, retrieve, contextBlock, sourceSummary, pagesLabel, requireReadyBooks };
