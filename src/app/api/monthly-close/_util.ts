// 월마감 API 공통: 신원 읽기 · JSON 본문 읽기 · 응답 만들기. 로직은 server/pipeline.ts에만 있다.
import { NextResponse } from 'next/server';
import { identityFromHeaders, type Identity } from '@/lib/monthly-close/server/auth';
import { defaultDeps, serviceDown, type Out, type PipelineDeps } from '@/lib/monthly-close/server/pipeline';

export const BODY_MAX_BYTES = 16 * 1024;

export function identityOf(req: Request): Identity | null {
  return identityFromHeaders(req.headers);
}

/** 본문이 너무 크거나 JSON이 아니면 undefined(→ INVALID body). 빈 본문은 {} */
export async function readJson(req: Request): Promise<unknown> {
  const len = Number(req.headers.get('content-length') ?? '0');
  if (Number.isFinite(len) && len > BODY_MAX_BYTES) return undefined;
  try {
    const text = await req.text();
    if (text.length > BODY_MAX_BYTES) return undefined;
    return text ? JSON.parse(text) : {};
  } catch {
    return undefined;
  }
}

const BASE_HEADERS = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } as const;

export function respond<T>(out: Out<T>): NextResponse {
  return NextResponse.json(out.body, {
    status: out.status,
    headers: { ...BASE_HEADERS, ...(out.retryAfterSec ? { 'Retry-After': String(out.retryAfterSec) } : {}) },
  });
}

export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204, headers: BASE_HEADERS });
}

export function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: BASE_HEADERS });
}

/**
 * [D3] 라우트 최외곽 보호막. 예상 못 한 예외(버그·클라이언트 생성 실패 등)도 프로토콜 모양(JSON, serverNow,
 * SERVICE_DOWN)으로 답하고, 로그에는 라우트 이름과 예외 종류(name)만 남긴다. 메시지·스택·원인(cause)은
 * 상태나 DB 행 일부를 담을 수 있으므로 응답·로그 어디에도 싣지 않는다(방향서 §8-2 #16).
 */
export async function guard(route: string, run: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await run();
  } catch (e) {
    const name = e instanceof Error ? e.name : typeof e;
    console.error(`[monthly-close] ${route} unhandled ${name}`);
    return respond(serviceDown(Date.now()));
  }
}

/** 저장소가 없으면(Vercel에서 키 없음) 503 SERVICE_DOWN 응답을 대신 돌려준다 */
export async function depsOrDown(): Promise<{ deps: PipelineDeps } | { down: NextResponse }> {
  const deps = await defaultDeps();
  if (!deps) return { down: respond(serviceDown(Date.now())) };
  return { deps };
}
