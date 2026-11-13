import books from '../../../../lib/books';
import api from '../../../../lib/api';
import auth from '../../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Memperbarui katalog dari SIBI. Dibatasi sekali per 10 menit kecuali admin memaksa.
export const POST = api.handleApi(async (request) => {
  const user = await auth.requireUser(request);
  const body = await api.readObject(request, 'Permintaan tidak valid.');
  return Response.json(await books.syncCatalog({ force: user.role === 'admin' && body.force === true }));
});
