import books from '../../../lib/books';
import api from '../../../lib/api';
import auth from '../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Pencarian katalog buku teks SD (SIBI Kemendikdasmen).
export const GET = api.handleApi(async (request) => {
  await auth.requireUser(request);
  const params = Object.fromEntries(new URL(request.url).searchParams);
  return Response.json(await books.search(params));
});
