import store from '../../../lib/store';
import api from '../../../lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = api.handleApi(async (_request, { params }) => {
  const { collection } = await params;
  return Response.json(store.list(api.requireCollection(collection)));
});

export const POST = api.handleApi(async (request, { params }) => {
  const { collection } = await params;
  api.requireCollection(collection);
  const body = await api.readObject(request, 'Payload tidak valid.');
  return Response.json(store.create(collection, body), { status: 201 });
});
