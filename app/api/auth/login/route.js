import api from '../../../../lib/api';
import auth from '../../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = api.handleApi(async (request) => {
  const body = await api.readObject(request, 'Data login tidak valid.');
  const { token, user } = await auth.login(body, request);
  return Response.json({ user, redirectTo: user.role === 'admin' ? '/admin' : '/guru' }, {
    headers: { 'Set-Cookie': auth.sessionCookie(token, request), 'Cache-Control': 'no-store' },
  });
});
