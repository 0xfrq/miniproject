import store from '../../../lib/store';
import api from '../../../lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = api.handleApi(() => Response.json(store.dashboard()));
