import { readFile } from 'node:fs/promises';
import path from 'node:path';
import auth from '../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const user = await auth.userFromToken(auth.cookieToken(request.headers.get('cookie') || ''));
  if (!user) return Response.redirect(new URL('/login?next=%2Fai-learning-generator.html', request.url), 307);
  const html = await readFile(path.join(process.cwd(), 'templates', 'ai-learning-generator.html'), 'utf8');
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store' } });
}
