import books from '../../../../lib/books';
import api from '../../../../lib/api';
import auth from '../../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = api.handleApi(async (request, { params }) => {
  await auth.requireUser(request);
  const { id } = await params;
  const book = await books.get(id);
  if (!book) throw new api.ApiError(404, 'Buku tidak ditemukan.');
  return Response.json(book);
});
