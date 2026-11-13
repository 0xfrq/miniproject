import rag from '../../../../../lib/rag';
import api from '../../../../../lib/api';
import auth from '../../../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Mengunduh PDF, mengekstrak teks, dan membuat embedding di latar belakang.
export const POST = api.handleApi(async (request, { params }) => {
  await auth.requireUser(request);
  const { id } = await params;
  const book = await rag.startIndex(id);
  return Response.json(book, { status: book.index.status === 'ready' ? 200 : 202 });
});
