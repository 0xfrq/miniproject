import ai from '../../../../lib/ai-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json(ai.status());
}
