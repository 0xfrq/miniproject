import store from '../../../lib/store';
import api from '../../../lib/api';
import auth from '../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = api.handleApi(async (request) => Response.json(await store.dashboard(await auth.requireUser(request))));
