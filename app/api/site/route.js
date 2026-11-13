import store from '../../../lib/store';
import api from '../../../lib/api';
import auth from '../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = api.handleApi(async () => Response.json(await store.getSite()));

export const PUT = api.handleApi(async (request) => {
  const user = await auth.requireUser(request, ['admin']);
  const body = await api.readObject(request, 'Data profil tidak valid.');
  return Response.json(await store.updateSite(body, user));
});
