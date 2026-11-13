import store from '../../../../lib/store';
import api from '../../../../lib/api';
import auth from '../../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = api.handleApi(async (request, { params }) => {
  const { collection, id } = await params;
  api.requireCollection(collection);
  const user = store.publicCollections.has(collection) ? null : await auth.requireUser(request);
  const item = await store.get(collection, id, user);
  if (!item) throw new api.ApiError(404, 'Data tidak ditemukan.');
  return Response.json(item);
});

export const PUT = api.handleApi(async (request, { params }) => {
  const { collection, id } = await params;
  api.requireCollection(collection);
  const user = await auth.requireUser(request, store.publicCollections.has(collection) ? ['admin'] : ['admin', 'guru']);
  const body = await api.readObject(request, 'Payload tidak valid.');
  const item = await store.update(collection, id, body, user);
  if (!item) throw new api.ApiError(404, 'Data tidak ditemukan.');
  return Response.json(item);
});

export const DELETE = api.handleApi(async (request, { params }) => {
  const { collection, id } = await params;
  api.requireCollection(collection);
  const user = await auth.requireUser(request, store.publicCollections.has(collection) ? ['admin'] : ['admin', 'guru']);
  if (!await store.remove(collection, id, user)) throw new api.ApiError(404, 'Data tidak ditemukan.');
  return new Response(null, { status: 204 });
});
