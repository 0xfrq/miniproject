import ai from '../../../lib/ai-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json({ ok: true, service: 'sdn-bangah-platform', ai: ai.status() });
}
