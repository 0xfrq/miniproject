import ai from '../../../../lib/ai-client';
import api from '../../../../lib/api';
import auth from '../../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = api.handleApi(async (request) => {
  await auth.requireUser(request);
  const body = await api.readObject(request, 'Query referensi tidak valid.');
  const { title = '', isbn = '' } = body;
  if (!title && !isbn) throw new api.ApiError(400, 'Nama buku atau ISBN wajib diisi.');
  try {
    const text = await ai.askModel([
      { role: 'system', content: 'Kamu membantu guru SD mencari referensi buku. Berikan maksimal 5 kandidat yang masuk akal berdasarkan query. Jangan mengaku telah membuka Google atau menemukan PDF jika tidak ada akses browsing. Balas HANYA JSON valid dengan bentuk {"results":[{"title":"...","author":"...","type":"Kandidat referensi","match":"...","source":"Saran AI · verifikasi manual"}]}.' },
      { role: 'user', content: JSON.stringify({ namaBukuAtauMateri: title, isbn }) },
    ], { temperature: 0.25, maxTokens: 1800 });
    const data = ai.parseJson(text);
    if (!Array.isArray(data.results)) throw new Error('results tidak ditemukan');
    return Response.json({ results: data.results.slice(0, 5).map((item, index) => ({ ...item, id: `book-ai-${Date.now()}-${index}`, type: item.type || 'Kandidat referensi', source: item.source || 'Saran AI · verifikasi manual' })) });
  } catch (error) { return Response.json({ error: error.message }, { status: error.status || 502 }); }
});
