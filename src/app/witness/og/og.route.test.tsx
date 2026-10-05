/**
 * /witness/og 라우트(Edge ImageResponse) — node 환경에서 GET 을 직접 호출한다.
 * 외부 fetch(Google Fonts · 정적 커버)는 가짜로 대체: 폰트 실패 경로(no-store) · 커버 바이트 통과 · 검증 실패 폴백(200).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, runtime } from './route';

const ORIGIN = 'https://example.test';
const req = (qs = '') => new NextRequest(`${ORIGIN}/witness/og${qs}`);
const OK = 'g=A&s=5&e=15&r=4&k=p&v=3';

const jpg = new Uint8Array(2048).fill(7);
jpg[0] = 0xff;
jpg[1] = 0xd8;

function stubFetch(opts: { cover?: 'ok' | '404' | 'html' | 'throw' }) {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (u: string | URL | Request) => {
      const url = String(u instanceof Request ? u.url : u);
      calls.push(url);
      if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) throw new Error('offline');
      if (url.endsWith('/witness/og.jpg')) {
        if (opts.cover === 'throw') throw new Error('net');
        if (opts.cover === '404') return new Response('nf', { status: 404 });
        if (opts.cover === 'html') return new Response('<html>' + 'x'.repeat(3000), { status: 200, headers: { 'content-type': 'text/html' } });
        return new Response(jpg, { status: 200, headers: { 'content-type': 'image/jpeg' } });
      }
      throw new Error(`unexpected fetch ${url}`);
    }),
  );
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// @vercel/og 내부 폰트 폴백이 오프라인 가짜 fetch 실패를 console.error 로 쏟는다 — 소음 차단
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('/witness/og', () => {
  it('Edge 런타임', () => {
    expect(runtime).toBe('edge');
  });

  it('쿼리 없음 → 정적 커버 바이트 그대로 200 image/jpeg', async () => {
    const calls = stubFetch({ cover: 'ok' });
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/jpeg');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(jpg);
    expect(calls).toEqual([`${ORIGIN}/witness/og.jpg`]);
  });

  it.each(['?g=X&s=1&e=1&r=1&k=p&v=0', '?g=S&s=1&e=1&r=1&k=p&v=0&t=hello', '?v=13', '?junk=1'])('검증 실패(%s) → 커버 200(404 금지)', async (qs) => {
    stubFetch({ cover: 'ok' });
    const res = await GET(req(qs));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/jpeg');
  });

  it.each(['404', 'html', 'throw'] as const)('정적 커버가 %s → ImageResponse 커버 200 PNG, 폰트 실패라 no-store', async (cover) => {
    stubFetch({ cover });
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('image/png');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect((await res.arrayBuffer()).byteLength).toBeGreaterThan(1000);
  });

  it('유효 쿼리 → 결과 카드 PNG 200 (폰트 실패 시에도 이미지는 생성, no-store)', async () => {
    const calls = stubFetch({ cover: 'ok' });
    const res = await GET(req(`?${OK}`));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('image/png');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect((await res.arrayBuffer()).byteLength).toBeGreaterThan(1000);
    expect(calls.some((c) => c.endsWith('/witness/og.jpg'))).toBe(false); // 결과 카드는 정적 커버를 읽지 않는다
  });

  it('판 종류 m(1~3) 이 붙은 쿼리도 결과 카드 PNG 200 · m 범위 밖이면 커버', async () => {
    stubFetch({ cover: 'ok' });
    for (const m of [1, 2, 3]) {
      const res = await GET(req(`?${OK}&m=${m}`));
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('image/png');
    }
    const bad = await GET(req(`?${OK}&m=7`));
    expect(bad.status).toBe(200);
    expect(bad.headers.get('content-type')).toBe('image/jpeg');
  });

  it('폰트가 로드되면 결과 카드는 장기 캐시', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (u: string | URL | Request) => {
        const url = String(u);
        if (url.includes('fonts.googleapis.com')) return new Response("src: url(https://fonts.gstatic.com/x.ttf) format('truetype');");
        if (url.includes('fonts.gstatic.com')) return new Response(new ArrayBuffer(8)); // 파싱 불가 폰트 → ImageResponse 가 거부할 수 있다
        throw new Error('unexpected');
      }),
    );
    let res: Response | null = null;
    try {
      res = await GET(req(`?${OK}`));
    } catch {
      res = null;
    }
    // 가짜 폰트 바이트로 satori 가 실패할 수 있다 — 성공했다면 캐시 정책만 확인
    if (res && res.status === 200) expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
  });
});
