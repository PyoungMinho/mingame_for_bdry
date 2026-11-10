import type { NextRequest } from 'next/server';
import { feedbackFlow } from '@/lib/monthly-close/server/pipeline';
import { depsOrDown, guard, identityOf, noContent, readJson, respond } from '../_util';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export function POST(req: NextRequest) {
  return guard('feedback', async () => {
    const d = await depsOrDown();
    if ('down' in d) return d.down;
    const out = await feedbackFlow(d.deps, identityOf(req), await readJson(req));
    return out.status === 200 ? noContent() : respond(out);
  });
}
