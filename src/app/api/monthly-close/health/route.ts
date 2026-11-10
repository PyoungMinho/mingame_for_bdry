import { healthFlow, defaultDeps } from '@/lib/monthly-close/server/pipeline';
import { json } from '../_util';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  // 저장소 조립(createClient)이 던져도 비밀 없는 down으로 답한다
  const deps = await defaultDeps().catch(() => null);
  return json(await healthFlow(deps));
}
