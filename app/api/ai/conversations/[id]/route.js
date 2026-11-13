import assistant from '../../../../../lib/assistant';
import api from '../../../../../lib/api';
import auth from '../../../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = api.handleApi(async (request, { params }) => {
  const user = await auth.requireUser(request);
  const { id } = await params;
  const conversation = await assistant.get(id, user);
  if (!conversation) throw new api.ApiError(404, 'Percakapan tidak ditemukan.');
  return Response.json(conversation);
});

export const DELETE = api.handleApi(async (request, { params }) => {
  const user = await auth.requireUser(request);
  const { id } = await params;
  if (!await assistant.remove(id, user)) throw new api.ApiError(404, 'Percakapan tidak ditemukan.');
  return new Response(null, { status: 204 });
});
