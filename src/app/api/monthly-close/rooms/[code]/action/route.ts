import type { NextRequest } from 'next/server';
import { actionFlow } from '@/lib/monthly-close/server/pipeline';
import { depsOrDown, guard, identityOf, readJson, respond } from '../../../_util';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export function POST(req: NextRequest, { params }: { params: { code: string } }) {
  return guard('action', async () => {
    const d = await depsOrDown();
    if ('down' in d) return d.down;
    return respond(await actionFlow(d.deps, params.code, identityOf(req), await readJson(req)));
  });
}
