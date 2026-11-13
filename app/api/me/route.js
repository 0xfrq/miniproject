import api from '../../../lib/api';
import auth from '../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = api.handleApi(async (request) => Response.json({ user: await auth.requireUser(request) }, { headers: { 'Cache-Control': 'no-store' } }));
