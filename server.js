const express = require('express');
const path = require('node:path');
const next = require('next');
const store = require('./lib/store');
const ai = require('./lib/ai-client');

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || 'localhost';
const port = Number(process.env.PORT) || 3000;
const nextApp = next({ dev, hostname, port });
const handle = nextApp.getRequestHandler();
const app = express();

store.ensureStore();
app.use(express.json({ limit: '20mb' }));

function sendError(res, status, message) {
  return res.status(status).json({ error: message });
}

function validateObject(body) {
  return body && typeof body === 'object' && !Array.isArray(body);
}

// The original AI generator is a standalone browser workflow. Keep it available
// without exposing the .env file or making the API key visible in the browser.
app.get('/ai-learning-generator.html', (_req, res) => res.sendFile(path.join(process.cwd(), 'ai-learning-generator.html')));
app.get('/ai-learning-generator.css', (_req, res) => res.sendFile(path.join(process.cwd(), 'ai-learning-generator.css')));
app.get('/ai-learning-generator.js', (_req, res) => res.sendFile(path.join(process.cwd(), 'ai-learning-generator.js')));

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'sdn-bangah-platform', ai: ai.status() }));
app.get('/api/ai/status', (_req, res) => res.json(ai.status()));

app.post('/api/ai/search-reference', async (req, res) => {
  if (!validateObject(req.body)) return sendError(res, 400, 'Query referensi tidak valid.');
  const { title = '', isbn = '' } = req.body;
  if (!title && !isbn) return sendError(res, 400, 'Nama buku atau ISBN wajib diisi.');
  try {
    const text = await ai.askModel([
      { role: 'system', content: 'Kamu membantu guru SD mencari referensi buku. Berikan maksimal 5 kandidat yang masuk akal berdasarkan query. Jangan mengaku telah membuka Google atau menemukan PDF jika tidak ada akses browsing. Balas HANYA JSON valid dengan bentuk {"results":[{"title":"...","author":"...","type":"Kandidat referensi","match":"...","source":"Saran AI · verifikasi manual"}]}.' },
      { role: 'user', content: JSON.stringify({ namaBukuAtauMateri: title, isbn }) },
    ], { temperature: 0.25, maxTokens: 1800 });
    const data = ai.parseJson(text);
    if (!Array.isArray(data.results)) throw new Error('results tidak ditemukan');
    return res.json({ results: data.results.slice(0, 5).map((item, index) => ({ ...item, id: `book-ai-${Date.now()}-${index}`, type: item.type || 'Kandidat referensi', source: item.source || 'Saran AI · verifikasi manual' })) });
  } catch (error) { return sendError(res, error.status || 502, error.message); }
});

app.post('/api/ai/generate-material', async (req, res) => {
  if (!validateObject(req.body)) return sendError(res, 400, 'Konfigurasi materi tidak valid.');
  const { subject, grade, topic, objective, duration, depth, format, reference } = req.body;
  if (!topic || !objective) return sendError(res, 400, 'Topik dan tujuan pembelajaran wajib diisi.');
  try {
    const text = await ai.askModel([
      { role: 'system', content: 'Kamu adalah asisten guru SD berbahasa Indonesia. Buat draf materi yang akurat, sesuai usia, praktis, dan selalu perlu ditinjau guru. Balas HANYA JSON valid tanpa markdown dengan bentuk {"sections":[{"id":"pendahuluan","title":"Pendahuluan","body":"..."},{"id":"inti","title":"Materi Inti","body":"..."},{"id":"aktivitas","title":"Aktivitas Pembelajaran","body":"..."},{"id":"rangkuman","title":"Rangkuman","body":"..."},{"id":"latihan","title":"Latihan","body":"..."}]}.' },
      { role: 'user', content: JSON.stringify({ tugas: 'Buat materi pembelajaran', mataPelajaran: subject, kelas: grade, topik: topic, tujuan: objective, durasi: duration, kedalaman: depth, format: format || 'Materi + Aktivitas', referensi: reference || null }) },
    ], { temperature: 0.45, maxTokens: 6000, timeoutMs: 90_000 });
    const data = ai.parseJson(text);
    if (!Array.isArray(data.sections)) throw new Error('sections tidak ditemukan');
    return res.json({ title: `${subject} · ${topic}`, sections: data.sections });
  } catch (error) { return sendError(res, error.status || 502, error.message); }
});

app.post('/api/ai/generate-questions', async (req, res) => {
  if (!validateObject(req.body)) return sendError(res, 400, 'Konfigurasi soal tidak valid.');
  const { subject, grade, topic, objective, total, duration, multiple, short, essay, difficulty, distribution } = req.body;
  if (!topic || !objective) return sendError(res, 400, 'Topik dan tujuan pembelajaran wajib diisi.');
  try {
    const text = await ai.askModel([
      { role: 'system', content: 'Kamu adalah asisten guru SD berbahasa Indonesia. Buat soal yang jelas dan sesuai usia untuk ditinjau guru. Balas HANYA JSON valid tanpa markdown dengan bentuk {"questions":[{"type":"Pilihan Ganda","text":"...","options":["...","...","...","..."],"correct":"A","difficulty":"Mudah","objective":"...","explanation":"...","quality":"ok"}]}. correct harus huruf A-D untuk pilihan ganda; gunakan Isian Singkat atau Essay sesuai komposisi.' },
      { role: 'user', content: JSON.stringify({ tugas: 'Buat paket soal', mataPelajaran: subject, kelas: grade, topik: topic, tujuan: objective, jumlah: total, durasi: duration, komposisi: { pilihanGanda: multiple, isianSingkat: short, essay }, kesulitan: difficulty, distribusi: distribution }) },
    ], { temperature: 0.5, maxTokens: 8000 });
    const data = ai.parseJson(text);
    if (!Array.isArray(data.questions)) throw new Error('questions tidak ditemukan');
    return res.json({ questions: data.questions.map((question, index) => ({ ...question, id: `q-ai-${Date.now()}-${index}`, options: Array.isArray(question.options) ? question.options : [], quality: question.quality || 'ok' })) });
  } catch (error) { return sendError(res, error.status || 502, error.message); }
});

app.post('/api/ai/analyze-assessment', async (req, res) => {
  if (!validateObject(req.body) || !Array.isArray(req.body.results)) return sendError(res, 400, 'Data penilaian tidak valid.');
  try {
    const text = await ai.askModel([
      { role: 'system', content: 'Kamu adalah pendamping guru SD. Analisis hasil penilaian dalam Bahasa Indonesia dengan singkat: pola capaian, konsep yang perlu diperkuat, dan saran tindak lanjut. Jangan membuat klaim di luar data.' },
      { role: 'user', content: JSON.stringify({ hasil: req.body.results }) },
    ], { temperature: 0.3, maxTokens: 1200 });
    return res.json({ analysis: text });
  } catch (error) { return sendError(res, error.status || 502, error.message); }
});
app.get('/api/site', (_req, res) => res.json(store.getSite()));
app.put('/api/site', (req, res) => {
  if (!validateObject(req.body)) return sendError(res, 400, 'Data profil tidak valid.');
  return res.json(store.updateSite(req.body));
});
app.get('/api/dashboard', (_req, res) => res.json(store.dashboard()));

const collections = ['activities', 'posts', 'agenda', 'materials', 'assessments', 'questions', 'grading'];
for (const collection of collections) {
  app.get(`/api/${collection}`, (_req, res) => res.json(store.list(collection)));
  app.post(`/api/${collection}`, (req, res) => {
    if (!validateObject(req.body)) return sendError(res, 400, 'Payload tidak valid.');
    return res.status(201).json(store.create(collection, req.body));
  });
  app.put(`/api/${collection}/:id`, (req, res) => {
    if (!validateObject(req.body)) return sendError(res, 400, 'Payload tidak valid.');
    const item = store.update(collection, req.params.id, req.body);
    return item ? res.json(item) : sendError(res, 404, 'Data tidak ditemukan.');
  });
  app.delete(`/api/${collection}/:id`, (req, res) => {
    const removed = store.remove(collection, req.params.id);
    return removed ? res.status(204).end() : sendError(res, 404, 'Data tidak ditemukan.');
  });
}

nextApp.prepare().then(() => {
  app.all('*', (req, res) => handle(req, res));
  app.listen(port, hostname, () => {
    console.log(`SDN Bangah platform running at http://${hostname}:${port}`);
  });
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
