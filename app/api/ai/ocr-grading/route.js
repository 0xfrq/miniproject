import ocr from '../../../../lib/ocr-grading';
import api from '../../../../lib/api';
import auth from '../../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// OCR lembar jawaban satu siswa dengan Gemini Vision. Foto tidak disimpan di server.
export const POST = api.handleApi(async (request) => {
  const user = await auth.requireUser(request);
  const body = await api.readObject(request, 'Data foto lembar jawaban tidak valid.');
  try { return Response.json(await ocr.readAnswerSheet(body, user)); }
  catch (error) {
    if (error.code && String(error.code).startsWith('AI_')) return Response.json({ error: error.message }, { status: error.status || 502 });
    throw error;
  }
});
