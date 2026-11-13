import assistant from '../../../../lib/assistant';
import api from '../../../../lib/api';
import auth from '../../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = api.handleApi(async (request) => {
  const user = await auth.requireUser(request);
  const body = await api.readObject(request, 'Pertanyaan tidak valid.');
  try { return Response.json(await assistant.ask(body, user)); }
  catch (error) {
    if (error.code && String(error.code).startsWith('AI_')) return Response.json({ error: error.message }, { status: error.status || 502 });
    throw error;
  }
});
