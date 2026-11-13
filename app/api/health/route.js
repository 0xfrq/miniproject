import ai from '../../../lib/ai-client';
import db from '../../../lib/database';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await db.getPool().query('SELECT 1 FROM users LIMIT 1');
    return Response.json({ ok: true, service: 'sdn-bangah-platform', database: 'postgresql', ai: ai.status() });
  } catch {
    return Response.json({ ok: false, service: 'sdn-bangah-platform', database: 'unavailable', ai: ai.status() }, { status: 503 });
  }
}
