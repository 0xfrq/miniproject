import api from '../../../../lib/api';
import auth from '../../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = api.handleApi(async (request) => {
  await auth.logout(request);
  return Response.json({ ok: true }, { headers: { 'Set-Cookie': auth.sessionCookie('', request, true), 'Cache-Control': 'no-store' } });
});
