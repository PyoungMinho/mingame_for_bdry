import type { NextRequest } from 'next/server';
import { createRoomFlow } from '@/lib/monthly-close/server/pipeline';
import { depsOrDown, guard, identityOf, readJson, respond } from '../_util';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export function POST(req: NextRequest) {
  return guard('rooms', async () => {
    const d = await depsOrDown();
    if ('down' in d) return d.down;
    return respond(await createRoomFlow(d.deps, identityOf(req), await readJson(req)));
  });
}
