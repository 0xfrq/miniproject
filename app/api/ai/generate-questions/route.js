import ai from '../../../../lib/ai-client';
import api from '../../../../lib/api';
import auth from '../../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = api.handleApi(async (request) => {
  await auth.requireUser(request);
  const body = await api.readObject(request, 'Konfigurasi soal tidak valid.');
  const { subject, grade, topic, objective, total, duration, multiple, short, essay, difficulty, distribution } = body;
  if (!topic || !objective) throw new api.ApiError(400, 'Topik dan tujuan pembelajaran wajib diisi.');
  try {
    const text = await ai.askModel([
      { role: 'system', content: 'Kamu adalah asisten guru SD berbahasa Indonesia. Buat soal yang jelas dan sesuai usia untuk ditinjau guru. Balas HANYA JSON valid tanpa markdown dengan bentuk {"questions":[{"type":"Pilihan Ganda","text":"...","options":["...","...","...","..."],"correct":"A","difficulty":"Mudah","objective":"...","explanation":"...","quality":"ok"}]}. correct harus huruf A-D untuk pilihan ganda; gunakan Isian Singkat atau Essay sesuai komposisi.' },
      { role: 'user', content: JSON.stringify({ tugas: 'Buat paket soal', mataPelajaran: subject, kelas: grade, topik: topic, tujuan: objective, jumlah: total, durasi: duration, komposisi: { pilihanGanda: multiple, isianSingkat: short, essay }, kesulitan: difficulty, distribusi: distribution }) },
    ], { temperature: 0.5, maxTokens: 8000 });
    const data = ai.parseJson(text);
    if (!Array.isArray(data.questions)) throw new Error('questions tidak ditemukan');
    return Response.json({ questions: data.questions.map((question, index) => ({ ...question, id: `q-ai-${Date.now()}-${index}`, options: Array.isArray(question.options) ? question.options : [], quality: question.quality || 'ok' })) });
  } catch (error) { return Response.json({ error: error.message }, { status: error.status || 502 }); }
});
