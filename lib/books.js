const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const db = require('./database');
const { ApiError } = require('./api');

// API katalog SIBI (buku.kemendikdasmen.go.id). Situs resminya kini memakai host cloudapp;
// host lama tetap dipakai sebagai cadangan.
const catalogBases = () => (process.env.SIBI_API_BASE || 'https://api.buku.cloudapp.web.id,https://api.buku.kemendikdasmen.go.id')
  .split(',').map((value) => value.trim().replace(/\/+$/, '')).filter(Boolean);
const CATALOG_ENDPOINTS = [
  { path: '/api/catalogue/getPenggerakTextBooks', curriculum: 'merdeka' },
  { path: '/api/catalogue/getTextBooks', curriculum: 'k13' },
];
const FILE_HOSTS = ['static-sc.cloudapp.web.id', 'files.cloudapp.web.id'];
const LEGACY_FILE_HOSTS = ['static.buku.kemdikbud.go.id', 'static.buku.kemendikdasmen.go.id'];
const MAX_PDF_BYTES = 250 * 1024 * 1024;
const SYNC_INTERVAL_MS = 10 * 60 * 1000;
const STALE_INDEX_MINUTES = 3;

const cacheDir = () => path.resolve(process.env.BOOKS_CACHE_DIR || path.join(process.cwd(), '.local', 'books'));

const SUBJECTS = [
  [/matematika/, 'Matematika'],
  [/\btematik\b|\btema \d/, 'Tematik'],
  [/agama[ _-]?islam|^islam/, 'Pendidikan Agama Islam'],
  [/agama[ _-]?kristen|^kristen/, 'Pendidikan Agama Kristen'],
  [/agama[ _-]?katolik|^katolik/, 'Pendidikan Agama Katolik'],
  [/agama[ _-]?hindu|^hindu/, 'Pendidikan Agama Hindu'],
  [/agama[ _-]?buddha|^buddha/, 'Pendidikan Agama Buddha'],
  [/khonghucu/, 'Pendidikan Agama Khonghucu'],
  [/kepercayaan/, 'Pendidikan Kepercayaan'],
  [/pancasila|ppkn/, 'Pendidikan Pancasila'],
  [/bahasa[ _-]?indonesia/, 'Bahasa Indonesia'],
  [/bahasa[ _-]?inggris|english/, 'Bahasa Inggris'],
  [/ipas|ilmu pengetahuan alam dan sosial/, 'IPAS'],
  [/pjok|jasmani/, 'PJOK'],
  [/seni[ _-]?musik/, 'Seni Musik'],
  [/seni[ _-]?rupa/, 'Seni Rupa'],
  [/seni[ _-]?tari/, 'Seni Tari'],
  [/seni[ _-]?teater/, 'Seni Teater'],
  [/koding|kecerdasan artifisial/, 'Koding dan Kecerdasan Artifisial'],
];

function subjectLabel(raw, title) {
  for (const value of [raw, title]) {
    const text = String(value || '').toLowerCase();
    if (!text.trim()) continue;
    const match = SUBJECTS.find(([pattern]) => pattern.test(text));
    if (match) return match[1];
  }
  return String(raw || '').replace(/[_-]+/g, ' ').trim().replace(/\b\w/g, (letter) => letter.toUpperCase()) || 'Lainnya';
}

function fileUrl(raw) {
  let url;
  try { url = new URL(String(raw || '').trim()); } catch { return null; }
  if (LEGACY_FILE_HOSTS.includes(url.hostname)) url.hostname = FILE_HOSTS[0];
  if (url.protocol !== 'https:' || !FILE_HOSTS.includes(url.hostname) || !/\.pdf$/i.test(url.pathname)) return null;
  return url.toString();
}

function imageUrl(raw) {
  let url;
  try { url = new URL(String(raw || '').trim()); } catch { return ''; }
  if (LEGACY_FILE_HOSTS.includes(url.hostname)) url.hostname = FILE_HOSTS[0];
  return url.protocol === 'https:' && FILE_HOSTS.includes(url.hostname) ? url.toString() : '';
}

// Hanya buku teks PDF jenjang SD kelas 1–6.
function normalizeCatalogEntry(entry, curriculum) {
  const grade = Number.parseInt(entry?.class, 10);
  if (!entry?.id || !Number.isInteger(grade) || grade < 1 || grade > 6) return null;
  if (entry.level && !/^SD/i.test(entry.level)) return null;
  if (entry.type && entry.type !== 'pdf') return null;
  const source = fileUrl(entry.attachment);
  if (!source) return null;
  const title = String(entry.title || '').replace(/\s+/g, ' ').trim();
  if (!title) return null;
  const guru = /guru/i.test(entry.book_type || '') || /^(panduan|buku) guru/i.test(title) || /\bBG\b/.test(entry.attachment || '');
  return {
    id: String(entry.id), slug: String(entry.slug || ''), title, grade, curriculum,
    bookType: guru ? 'guru' : 'siswa', subject: subjectLabel(entry.subject, title), sourceUrl: source,
    coverUrl: imageUrl(entry.image), isbn: String(entry.isbn || '').trim(), writer: String(entry.writer || '').replace(/\s+/g, ' ').trim(),
    publisher: String(entry.publisher || '').trim(), edition: String(entry.edition || entry.curriculum || '').trim(),
    metadata: { curriculumYear: entry.curriculum || null, publishedYear: entry.published_year || null, sibiSlug: entry.slug || null },
  };
}

async function fetchJson(url, timeoutMs = 60_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally { clearTimeout(timer); }
}

async function fetchCatalog() {
  const books = new Map();
  for (const endpoint of CATALOG_ENDPOINTS) {
    let data = null;
    let lastError;
    for (const base of catalogBases()) {
      try { data = await fetchJson(`${base}${endpoint.path}?limit=5000&offset=0`); if (Array.isArray(data?.results)) break; }
      catch (error) { lastError = error; data = null; }
    }
    if (!Array.isArray(data?.results)) throw new ApiError(502, `Katalog SIBI tidak dapat diambil${lastError ? `: ${lastError.message}` : ''}.`);
    for (const entry of data.results) {
      const book = normalizeCatalogEntry(entry, endpoint.curriculum);
      if (book) books.set(book.id, book);
    }
  }
  return [...books.values()];
}

let syncing = null;
async function syncCatalog({ force = false } = {}) {
  if (syncing) return syncing;
  syncing = (async () => {
    const pool = db.getPool();
    if (!force) {
      const last = (await pool.query('SELECT max(synced_at) AS last FROM books')).rows[0].last;
      if (last && Date.now() - new Date(last).getTime() < SYNC_INTERVAL_MS) return { skipped: true };
    }
    const books = await fetchCatalog();
    if (!books.length) throw new ApiError(502, 'Katalog SIBI kosong. Coba lagi nanti.');
    await db.transaction(async (client) => {
      for (const book of books) {
        await client.query(`INSERT INTO books(id, slug, title, grade, curriculum, book_type, subject, source_url, cover_url, isbn, writer, publisher, edition, metadata, synced_at)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14, now())
          ON CONFLICT(id) DO UPDATE SET slug=EXCLUDED.slug, title=EXCLUDED.title, grade=EXCLUDED.grade, curriculum=EXCLUDED.curriculum,
            book_type=EXCLUDED.book_type, subject=EXCLUDED.subject, source_url=EXCLUDED.source_url, cover_url=EXCLUDED.cover_url, isbn=EXCLUDED.isbn,
            writer=EXCLUDED.writer, publisher=EXCLUDED.publisher, edition=EXCLUDED.edition, metadata=EXCLUDED.metadata, synced_at=now()`,
        [book.id, book.slug, book.title, book.grade, book.curriculum, book.bookType, book.subject, book.sourceUrl, book.coverUrl, book.isbn, book.writer, book.publisher, book.edition, book.metadata]);
      }
    });
    const counts = {};
    for (const book of books) counts[`kelas${book.grade}`] = (counts[`kelas${book.grade}`] || 0) + 1;
    return { skipped: false, total: books.length, merdeka: books.filter((book) => book.curriculum === 'merdeka').length, k13: books.filter((book) => book.curriculum === 'k13').length, perGrade: counts };
  })();
  try { return await syncing; } finally { syncing = null; }
}

function publicBook(row) {
  if (!row) return null;
  const stale = row.index_status === 'indexing' && row.index_started_at && Date.now() - new Date(row.index_started_at).getTime() > STALE_INDEX_MINUTES * 60_000;
  return {
    id: row.id, title: row.title, grade: row.grade, gradeLabel: `Kelas ${row.grade}`, curriculum: row.curriculum,
    curriculumLabel: row.curriculum === 'merdeka' ? 'Kurikulum Merdeka' : 'Kurikulum 2013', bookType: row.book_type,
    bookTypeLabel: row.book_type === 'guru' ? 'Buku Guru' : 'Buku Siswa', subject: row.subject, coverUrl: row.cover_url,
    sourceUrl: row.source_url, isbn: row.isbn, writer: row.writer, publisher: row.publisher, edition: row.edition,
    pdfUrl: `/api/books/${encodeURIComponent(row.id)}/pdf`, sibiUrl: row.slug ? `https://buku.kemendikdasmen.go.id/katalog/${encodeURIComponent(row.slug)}` : '',
    index: { status: stale ? 'failed' : row.index_status, progress: row.index_progress, error: stale ? 'Proses indexing terhenti. Coba lagi.' : row.index_error, pages: row.page_count, chunks: row.chunk_count, indexedAt: row.indexed_at },
  };
}

function cleanText(value, limit) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') throw new ApiError(400, 'Parameter pencarian tidak valid.');
  return value.trim().slice(0, limit);
}

async function search(params = {}) {
  const pool = db.getPool();
  if (!Number((await pool.query('SELECT count(*) FROM books')).rows[0].count)) {
    try { await syncCatalog({ force: true }); } catch (error) { if (error.status) throw error; throw new ApiError(502, 'Katalog SIBI belum dapat diambil.'); }
  }
  const q = cleanText(params.q, 200);
  const words = q.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 8);
  const grade = Number.parseInt(params.grade, 10);
  const curriculum = ['merdeka', 'k13'].includes(params.curriculum) ? params.curriculum : null;
  const bookType = ['siswa', 'guru'].includes(params.type) ? params.type : null;
  const subject = cleanText(params.subject, 100) || null;
  const indexed = params.indexed === 'true' || params.indexed === true;
  const limit = Math.min(100, Math.max(1, Number.parseInt(params.limit, 10) || 30));
  const offset = Math.max(0, Number.parseInt(params.offset, 10) || 0);
  const where = ['1=1'];
  const values = [];
  for (const word of words) {
    values.push(`%${word.replace(/[\\%_]/g, (match) => `\\${match}`)}%`);
    where.push(`lower(title || ' ' || subject || ' ' || isbn || ' ' || writer) LIKE $${values.length}`);
  }
  if (Number.isInteger(grade) && grade >= 1 && grade <= 6) { values.push(grade); where.push(`grade = $${values.length}`); }
  if (curriculum) { values.push(curriculum); where.push(`curriculum = $${values.length}`); }
  if (bookType) { values.push(bookType); where.push(`book_type = $${values.length}`); }
  if (subject) { values.push(subject); where.push(`subject = $${values.length}`); }
  if (indexed) where.push("index_status = 'ready'");
  const filter = where.join(' AND ');
  const total = Number((await pool.query(`SELECT count(*) FROM books WHERE ${filter}`, values)).rows[0].count);
  const rows = (await pool.query(`SELECT * FROM books WHERE ${filter}
    ORDER BY (index_status = 'ready') DESC, grade, curriculum = 'k13', subject, title LIMIT ${limit} OFFSET ${offset}`, values)).rows;
  const subjects = (await pool.query('SELECT subject, count(*)::int AS count FROM books GROUP BY subject ORDER BY subject')).rows;
  const sync = (await pool.query('SELECT max(synced_at) AS last, count(*)::int AS total, count(*) FILTER (WHERE index_status = \'ready\')::int AS ready FROM books')).rows[0];
  return { items: rows.map(publicBook), total, limit, offset, subjects, catalog: { total: sync.total, ready: sync.ready, syncedAt: sync.last } };
}

async function get(id) {
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,40}$/.test(id)) return null;
  return publicBook((await db.getPool().query('SELECT * FROM books WHERE id = $1', [id])).rows[0]);
}

async function getMany(ids) {
  const list = [...new Set((Array.isArray(ids) ? ids : []).filter((id) => typeof id === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(id)))].slice(0, 10);
  if (!list.length) return [];
  const rows = (await db.getPool().query('SELECT * FROM books WHERE id = ANY($1::text[])', [list])).rows;
  return list.map((id) => publicBook(rows.find((row) => row.id === id))).filter(Boolean);
}

// PDF disimpan di cache lokal (.local/books) agar unduhan berikutnya dan indexing tidak mengunduh ulang.
const downloads = new Map();
async function ensurePdf(book) {
  const target = path.join(cacheDir(), `${book.id}.pdf`);
  try { const stat = await fsp.stat(target); if (stat.size > 0) return { file: target, size: stat.size }; } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (downloads.has(book.id)) return downloads.get(book.id);
  const task = (async () => {
    const source = fileUrl(book.sourceUrl);
    if (!source) throw new ApiError(400, 'Alamat PDF buku tidak valid.');
    await fsp.mkdir(cacheDir(), { recursive: true });
    const temp = `${target}.${randomUUID()}.part`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10 * 60_000);
    try {
      const response = await fetch(source, { signal: controller.signal, redirect: 'follow' });
      if (!response.ok || !response.body) throw new ApiError(502, `PDF tidak dapat diunduh dari SIBI (HTTP ${response.status}).`);
      if (Number(response.headers.get('content-length')) > MAX_PDF_BYTES) throw new ApiError(413, 'Ukuran PDF melebihi batas 250 MB.');
      let size = 0;
      const limited = Readable.fromWeb(response.body);
      limited.on('data', (chunk) => { size += chunk.length; if (size > MAX_PDF_BYTES) limited.destroy(new ApiError(413, 'Ukuran PDF melebihi batas 250 MB.')); });
      await pipeline(limited, fs.createWriteStream(temp));
      const head = Buffer.alloc(5);
      const handle = await fsp.open(temp, 'r');
      try { await handle.read(head, 0, 5, 0); } finally { await handle.close(); }
      if (head.toString('latin1') !== '%PDF-') throw new ApiError(502, 'Berkas dari SIBI bukan PDF yang valid.');
      await fsp.rename(temp, target);
      await db.getPool().query('UPDATE books SET file_size = $2 WHERE id = $1', [book.id, size]);
      return { file: target, size };
    } catch (error) {
      await fsp.rm(temp, { force: true });
      if (error.status) throw error;
      if (error.name === 'AbortError') throw new ApiError(504, 'Unduhan PDF terlalu lama. Coba lagi.');
      throw new ApiError(502, `PDF tidak dapat diunduh dari SIBI: ${error.message}`);
    } finally { clearTimeout(timer); }
  })();
  downloads.set(book.id, task);
  try { return await task; } finally { downloads.delete(book.id); }
}

module.exports = { syncCatalog, search, get, getMany, ensurePdf, publicBook, normalizeCatalogEntry, subjectLabel, fileUrl, cacheDir, STALE_INDEX_MINUTES };
