const { randomUUID } = require('node:crypto');
const db = require('./database');
const ai = require('./ai-client');
const rag = require('./rag');
const books = require('./books');
const { ApiError } = require('./api');

const HISTORY_TURNS = 8;

const SYSTEM_PROMPT = `Kamu adalah "Asisten Guru SDN Bangah", pendamping guru SD di Indonesia.
Tugasmu membantu guru: menjelaskan konsep, menyusun materi ajar, modul ajar/RPP, aktivitas kelas, soal beserta kunci jawaban, rubrik, serta strategi mengajar dan diferensiasi.
Aturan:
- Jawab dalam Bahasa Indonesia yang jelas, praktis, dan sesuai usia siswa SD.
- Jika ada KUTIPAN BUKU, jadikan itu dasar utama jawaban dan cantumkan nomor sumber seperti [1] atau [2][3] tepat setelah kalimat yang memakainya.
- Jangan mengarang isi buku, nomor halaman, atau sumber. Jika kutipan tidak memuat jawabannya, katakan terus terang bahwa buku yang dipilih tidak membahasnya, lalu beri saran umum yang ditandai sebagai pengetahuan umum.
- Gunakan format Markdown sederhana (judul, daftar bernomor, tabel bila perlu).
- Ingatkan guru untuk meninjau hasil sebelum dipakai di kelas bila jawabannya berupa materi atau soal.`;

function scope(user) {
  if (!user?.id) throw new ApiError(401, 'Silakan masuk terlebih dahulu.');
  return user.id;
}

function conversationRow(row) {
  return { id: row.id, title: row.title, bookIds: row.book_ids, createdAt: row.created_at, updatedAt: row.updated_at };
}

async function list(user) {
  const rows = (await db.getPool().query('SELECT * FROM ai_conversations WHERE owner_id = $1 ORDER BY updated_at DESC LIMIT 50', [scope(user)])).rows;
  return rows.map(conversationRow);
}

async function get(id, user) {
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const row = (await db.getPool().query('SELECT * FROM ai_conversations WHERE id = $1 AND owner_id = $2', [id, scope(user)])).rows[0];
  if (!row) return null;
  const messages = (await db.getPool().query('SELECT id, role, content, sources, created_at FROM ai_messages WHERE conversation_id = $1 ORDER BY id', [id])).rows;
  return { ...conversationRow(row), books: await books.getMany(row.book_ids), messages: messages.map((message) => ({ id: String(message.id), role: message.role, content: message.content, sources: message.sources, createdAt: message.created_at })) };
}

async function remove(id, user) {
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) return false;
  return (await db.getPool().query('DELETE FROM ai_conversations WHERE id = $1 AND owner_id = $2', [id, scope(user)])).rowCount > 0;
}

function validBookIds(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 10 || value.some((id) => typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,40}$/.test(id))) throw new ApiError(400, 'Daftar buku tidak valid (maksimal 10 buku).');
  return [...new Set(value)];
}

async function ask(input, user) {
  const owner = scope(user);
  const message = typeof input.message === 'string' ? input.message.trim() : '';
  if (!message) throw new ApiError(400, 'Pertanyaan wajib diisi.');
  if (message.length > 6000) throw new ApiError(400, 'Pertanyaan maksimal 6.000 karakter.');
  const bookIds = validBookIds(input.bookIds);
  let conversation = null;
  if (input.conversationId) {
    conversation = (await db.getPool().query('SELECT * FROM ai_conversations WHERE id = $1 AND owner_id = $2', [String(input.conversationId), owner])).rows[0];
    if (!conversation) throw new ApiError(404, 'Percakapan tidak ditemukan.');
  }
  const history = conversation ? (await db.getPool().query(`SELECT role, content FROM (SELECT id, role, content FROM ai_messages WHERE conversation_id = $1 ORDER BY id DESC LIMIT $2) recent ORDER BY id`, [conversation.id, HISTORY_TURNS * 2])).rows : [];
  const selected = await books.getMany(bookIds);
  const notReady = selected.filter((book) => book.index.status !== 'ready');
  // Pertanyaan lanjutan pendek dikaitkan dengan pertanyaan sebelumnya agar retrieval tetap relevan.
  const lastQuestion = [...history].reverse().find((item) => item.role === 'user')?.content || '';
  const retrievalQuery = message.length < 60 && lastQuestion ? `${lastQuestion}\n${message}` : message;
  const sources = await rag.retrieve(retrievalQuery, { bookIds, limit: 8 });
  const bookNote = selected.length
    ? `Buku dipilih guru: ${selected.map((book) => `${book.title} (${book.gradeLabel}, ${book.bookTypeLabel})`).join('; ')}.${notReady.length ? ` Belum terindeks: ${notReady.map((book) => book.title).join('; ')}.` : ''}`
    : 'Guru belum memilih buku referensi; jawab dari pengetahuan umum dan sarankan memilih buku dari katalog SIBI untuk jawaban berbasis buku.';
  const answer = await ai.askModel([
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.map((item) => ({ role: item.role, content: item.content })),
    { role: 'user', content: `${bookNote}\n\nKUTIPAN BUKU:\n${rag.contextBlock(sources)}\n\nPERTANYAAN GURU:\n${message}` },
  ], { temperature: 0.35, maxTokens: 6000, timeoutMs: 120_000 });
  const cited = new Set([...answer.matchAll(/\[(\d{1,2})\]/g)].map((match) => Number(match[1])));
  const storedSources = rag.sourceSummary(sources).map((source) => ({ ...source, cited: cited.has(source.n) }));
  return db.transaction(async (client) => {
    if (!conversation) {
      const id = randomUUID();
      const title = message.replace(/\s+/g, ' ').slice(0, 80);
      conversation = (await client.query('INSERT INTO ai_conversations(id, owner_id, title, book_ids) VALUES($1, $2, $3, $4) RETURNING *', [id, owner, title, bookIds])).rows[0];
    } else {
      conversation = (await client.query('UPDATE ai_conversations SET book_ids = $2, updated_at = now() WHERE id = $1 RETURNING *', [conversation.id, bookIds])).rows[0];
    }
    await client.query("INSERT INTO ai_messages(conversation_id, role, content) VALUES($1, 'user', $2)", [conversation.id, message]);
    const saved = (await client.query("INSERT INTO ai_messages(conversation_id, role, content, sources) VALUES($1, 'assistant', $2, $3) RETURNING id, created_at", [conversation.id, answer, JSON.stringify(storedSources)])).rows[0];
    return { conversation: conversationRow(conversation), message: { id: String(saved.id), role: 'assistant', content: answer, sources: storedSources, createdAt: saved.created_at } };
  });
}

module.exports = { list, get, remove, ask, validBookIds };
