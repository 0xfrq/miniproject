import ai from '../../../../lib/ai-client';
import api from '../../../../lib/api';
import auth from '../../../../lib/auth';
import rag from '../../../../lib/rag';
import assistant from '../../../../lib/assistant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = api.handleApi(async (request) => {
  await auth.requireUser(request);
  const body = await api.readObject(request, 'Konfigurasi materi tidak valid.');
  const { subject, grade, topic, objective, duration, depth, format, reference } = body;
  if (!topic || !objective) throw new api.ApiError(400, 'Topik dan tujuan pembelajaran wajib diisi.');
  const bookIds = assistant.validBookIds(body.bookIds);
  if (bookIds.length) await rag.requireReadyBooks(bookIds);
  try {
    const sources = bookIds.length ? await rag.retrieve(`${topic}. ${objective}`, { bookIds, limit: 10 }) : [];
    const grounding = bookIds.length
      ? ` Gunakan KUTIPAN BUKU sebagai dasar utama isi materi dan cantumkan nomor sumber seperti [1] di akhir kalimat yang memakainya. Jangan mengarang isi buku; bila kutipan tidak cukup, lengkapi dengan pengetahuan umum yang akurat tanpa nomor sumber.`
      : '';
    const text = await ai.askModel([
      { role: 'system', content: `Kamu adalah asisten guru SD berbahasa Indonesia. Buat draf materi yang akurat, sesuai usia, praktis, dan selalu perlu ditinjau guru.${grounding} Balas HANYA JSON valid tanpa markdown dengan bentuk {"sections":[{"id":"pendahuluan","title":"Pendahuluan","body":"..."},{"id":"inti","title":"Materi Inti","body":"..."},{"id":"aktivitas","title":"Aktivitas Pembelajaran","body":"..."},{"id":"rangkuman","title":"Rangkuman","body":"..."},{"id":"latihan","title":"Latihan","body":"..."}]}.` },
      { role: 'user', content: JSON.stringify({ tugas: 'Buat materi pembelajaran', mataPelajaran: subject, kelas: grade, topik: topic, tujuan: objective, durasi: duration, kedalaman: depth, format: format || 'Materi + Aktivitas', referensi: reference || null })
        + (bookIds.length ? `\n\nKUTIPAN BUKU:\n${rag.contextBlock(sources)}` : '') },
    ], { temperature: 0.45, maxTokens: 6000, timeoutMs: 120_000 });
    const data = ai.parseJson(text);
    if (!Array.isArray(data.sections)) throw new Error('sections tidak ditemukan');
    return Response.json({ title: `${subject} · ${topic}`, sections: data.sections, sources: rag.sourceSummary(sources) });
  } catch (error) { return Response.json({ error: error.message }, { status: error.status || 502 }); }
});
