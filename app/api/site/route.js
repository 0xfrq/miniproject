import store from '../../../lib/store';
import api from '../../../lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = api.handleApi(() => Response.json(store.getSite()));

export const PUT = api.handleApi(async (request) => {
  const body = await api.readObject(request, 'Data profil tidak valid.');
  return Response.json(store.updateSite(body));
});
