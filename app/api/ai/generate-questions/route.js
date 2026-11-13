import ai from '../../../../lib/ai-client';
import api from '../../../../lib/api';
import auth from '../../../../lib/auth';
import rag from '../../../../lib/rag';
import assistant from '../../../../lib/assistant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = api.handleApi(async (request) => {
  await auth.requireUser(request);
  const body = await api.readObject(request, 'Konfigurasi soal tidak valid.');
  const { subject, grade, topic, objective, total, duration, multiple, short, essay, difficulty, distribution } = body;
  if (!topic || !objective) throw new api.ApiError(400, 'Topik dan tujuan pembelajaran wajib diisi.');
  const bookIds = assistant.validBookIds(body.bookIds);
  if (bookIds.length) await rag.requireReadyBooks(bookIds);
  try {
    const sources = bookIds.length ? await rag.retrieve(`${topic}. ${objective}`, { bookIds, limit: 12 }) : [];
    const grounding = bookIds.length
      ? ' Soal, kunci, dan pembahasan HARUS sesuai isi KUTIPAN BUKU. Isi "source" dengan nomor kutipan yang dipakai (contoh "[2]"), kosongkan bila tidak memakai kutipan.'
      : '';
    const text = await ai.askModel([
      { role: 'system', content: `Kamu adalah asisten guru SD berbahasa Indonesia. Buat soal ujian yang jelas, sesuai usia, dan tidak ambigu untuk ditinjau guru.${grounding} Untuk Isian Singkat dan Essay, isi "correct" dengan jawaban acuan dan "explanation" dengan pembahasan serta rubrik penskoran 0–10. Balas HANYA JSON valid tanpa markdown dengan bentuk {"questions":[{"type":"Pilihan Ganda","text":"...","options":["...","...","...","..."],"correct":"A","difficulty":"Mudah","objective":"...","explanation":"...","source":"[1]","quality":"ok"}]}. correct harus huruf A-D untuk pilihan ganda; gunakan Isian Singkat atau Essay sesuai komposisi. Jangan menulis huruf A./B. di dalam teks pilihan.` },
      { role: 'user', content: JSON.stringify({ tugas: 'Buat paket soal ujian lengkap dengan kunci jawaban', mataPelajaran: subject, kelas: grade, topik: topic, tujuan: objective, jumlah: total, durasi: duration, komposisi: { pilihanGanda: multiple, isianSingkat: short, essay }, kesulitan: difficulty, distribusi: distribution })
        + (bookIds.length ? `\n\nKUTIPAN BUKU:\n${rag.contextBlock(sources)}` : '') },
    ], { temperature: 0.5, maxTokens: 12000, timeoutMs: 150_000 });
    const data = ai.parseJson(text);
    if (!Array.isArray(data.questions)) throw new Error('questions tidak ditemukan');
    return Response.json({ questions: data.questions.map((question, index) => ({ ...question, id: `q-ai-${Date.now()}-${index}`, options: Array.isArray(question.options) ? question.options : [], quality: question.quality || 'ok' })), sources: rag.sourceSummary(sources) });
  } catch (error) { return Response.json({ error: error.message }, { status: error.status || 502 }); }
});
