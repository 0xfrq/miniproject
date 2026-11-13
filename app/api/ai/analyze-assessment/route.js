import ai from '../../../../lib/ai-client';
import api from '../../../../lib/api';
import auth from '../../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = api.handleApi(async (request) => {
  await auth.requireUser(request);
  const body = await api.readObject(request, 'Data penilaian tidak valid.');
  if (!Array.isArray(body.results)) throw new api.ApiError(400, 'Data penilaian tidak valid.');
  try {
    const text = await ai.askModel([
      { role: 'system', content: 'Kamu adalah pendamping guru SD. Analisis hasil penilaian dalam Bahasa Indonesia dengan singkat: pola capaian, konsep yang perlu diperkuat, dan saran tindak lanjut. Jangan membuat klaim di luar data.' },
      { role: 'user', content: JSON.stringify({ hasil: body.results }) },
    ], { temperature: 0.3, maxTokens: 1200 });
    return Response.json({ analysis: text });
  } catch (error) { return Response.json({ error: error.message }, { status: error.status || 502 }); }
});
