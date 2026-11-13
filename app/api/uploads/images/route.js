import api from '../../../../lib/api';
import auth from '../../../../lib/auth';
import storage from '../../../../lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = api.handleApi(async (request) => {
  const user = await auth.requireUser(request, ['admin']);
  const body = await api.readObject(request, 'Data gambar tidak valid.');
  return Response.json(await storage.signedImageUpload(user, body));
});
