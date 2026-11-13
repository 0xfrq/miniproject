import api from '../../../../lib/api';
import auth from '../../../../lib/auth';
import users from '../../../../lib/users';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = api.handleApi(async (request) => {
  await auth.requireUser(request, ['admin']);
  return Response.json(await users.listTeachers(), { headers: { 'Cache-Control': 'no-store' } });
});

export const POST = api.handleApi(async (request) => {
  await auth.requireUser(request, ['admin']);
  return Response.json(await users.createTeacher(await api.readObject(request, 'Data akun tidak valid.')), { status: 201 });
});
