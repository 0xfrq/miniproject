import api from '../../../../../lib/api';
import auth from '../../../../../lib/auth';
import users from '../../../../../lib/users';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const PUT = api.handleApi(async (request, { params }) => {
  await auth.requireUser(request, ['admin']);
  const { id } = await params;
  return Response.json(await users.updateTeacher(id, await api.readObject(request, 'Data akun tidak valid.')));
});
