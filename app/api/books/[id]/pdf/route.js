import fs from 'node:fs';
import { Readable } from 'node:stream';
import books from '../../../../../lib/books';
import api from '../../../../../lib/api';
import auth from '../../../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function fileName(title) {
  return `${String(title).replace(/[^\p{L}\p{N} ._-]+/gu, '').replace(/\s+/g, ' ').trim().slice(0, 150) || 'buku'}.pdf`;
}

// PDF diunduh sekali dari SIBI lalu dilayani dari cache lokal.
export const GET = api.handleApi(async (request, { params }) => {
  await auth.requireUser(request);
  const { id } = await params;
  const book = await books.get(id);
  if (!book) throw new api.ApiError(404, 'Buku tidak ditemukan.');
  const { file, size } = await books.ensurePdf(book);
  const download = new URL(request.url).searchParams.get('download') === '1';
  const name = fileName(book.title);
  return new Response(Readable.toWeb(fs.createReadStream(file)), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Length': String(size),
      'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${name.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '')}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      'X-Content-Type-Options': 'nosniff',
    },
  });
});
