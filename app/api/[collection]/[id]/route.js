import store from '../../../../lib/store';
import api from '../../../../lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const PUT = api.handleApi(async (request, { params }) => {
  const { collection, id } = await params;
  api.requireCollection(collection);
  const body = await api.readObject(request, 'Payload tidak valid.');
  const item = store.update(collection, id, body);
  if (!item) throw new api.ApiError(404, 'Data tidak ditemukan.');
  return Response.json(item);
});

export const DELETE = api.handleApi(async (_request, { params }) => {
  const { collection, id } = await params;
  api.requireCollection(collection);
  if (!store.remove(collection, id)) throw new api.ApiError(404, 'Data tidak ditemukan.');
  return new Response(null, { status: 204 });
});
