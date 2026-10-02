/**
 * @QA실행자 — /gung/og/result Edge 라우트(OG-01~04, BUG-13·14). next/og 의 ImageResponse 는 가짜로 바꿔
 * "무엇을 그리라고 넘겼는지"(엘리먼트 트리·폰트·헤더)만 본다. 실제 PNG 렌더·CDN 동작은 배포 후 L 레벨(설계서 §7 G8).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const captured: { element: unknown; options: { fonts?: unknown[]; width?: number; height?: number } }[] = [];
vi.mock('next/og', () => ({
  ImageResponse: class {
    headers = new Headers();
    constructor(element: unknown, options: { fonts?: unknown[] }) {
      captured.push({ element, options });
    }
  },
}));

const { GET } = await import('./route');

const fontFetches: string[] = [];
function mockFonts(ok: boolean) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      fontFetches.push(String(url));
      if (!ok) throw new Error('network down');
      if (String(url).startsWith('https://fonts.googleapis.com/')) {
        return new Response("@font-face { src: url(https://fonts.gstatic.com/x.ttf) format('truetype'); }", { status: 200 });
      }
      return new Response(new Uint8Array([0, 1, 0, 0]), { status: 200 });
    }),
  );
}

const req = (q: string) => ({ url: `https://project-orsrw.vercel.app/gung/og/result${q}` }) as unknown as NextRequest;
const tree = (i = captured.length - 1) => JSON.stringify(captured[i].element);

beforeEach(() => {
  captured.length = 0;
  fontFetches.length = 0;
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('OG 결과 이미지 라우트', () => {
  it('OG-01 정상 파라미터 → 1200×630, 판결 문구·통계, 폰트 서브셋에 쓰는 글자 전부', async () => {
    mockFonts(true);
    const res = await GET(req('?o=c&n=5&h=3&j=4&m=52&r=0&d=20261002'));
    expect(captured[0].options).toMatchObject({ width: 1200, height: 630 });
    expect(captured[0].options.fonts).toHaveLength(1);
    const t = tree();
    expect(t).toContain('끈질긴 추궁 끝에 범인을 잡았다');
    expect(t).toContain('2026.10.02');
    expect(t).toContain('3/4');
    expect(t).toContain('52분');
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable');
  });

  it('OG-04 [BUG-13] 폰트를 못 받으면(□ 이미지) 캐시하지 않는다 — no-store', async () => {
    mockFonts(false);
    const res = await GET(req('?o=e&n=6&h=0&j=5&m=40&r=1&d=20261002'));
    expect(captured[0].options.fonts).toBeUndefined();
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('OG-03 자유 텍스트 차단: 덧붙인 title·t·script 파라미터는 그림·폰트 요청 어디에도 반영되지 않는다(없이 요청한 것과 같다)', async () => {
    mockFonts(true);
    await GET(req('?o=c&n=5&h=3&j=4&m=52&r=0&d=20261002'));
    const base = tree(0);
    const baseFetch = fontFetches[0];
    await GET(req('?o=c&n=5&h=3&j=4&m=52&r=0&d=20261002&title=%EC%9A%95%EC%84%A4&t=%3Cscript%3Ealert(1)%3C/script%3E&headline=hacked'));
    expect(tree(1)).toBe(base);
    expect(fontFetches[2]).toBe(baseFetch);
    expect(tree(1)).not.toMatch(/욕설|script|hacked/);
  });

  it('OG-02 경계·오류 파라미터는 전부 일반 커버(200, 404 금지) · OG-06 [BUG-14] 커버 인장은 "궁"', async () => {
    mockFonts(true);
    const bad = ['?o=x&n=5&h=1&j=4&m=10&r=0&d=20261002', '?o=c&n=3&h=1&j=2&m=10&r=0&d=20261002', '?o=c&n=7&h=1&j=4&m=10&r=0&d=20261002', '?o=c&n=5&h=1&j=5&m=10&r=0&d=20261002', '?o=c&n=5&h=5&j=4&m=10&r=0&d=20261002', '?o=c&n=5&h=1&j=4&m=0&r=0&d=20261002', '?o=c&n=5&h=1&j=4&m=301&r=0&d=20261002', '?o=c&n=5&h=1&j=4&m=10&r=2&d=20261002', '?o=c&n=5&h=1&j=4&m=10&r=0&d=20261332', '?o=c&n=5&h=1&j=4&m=10&r=0&d=20230101', '?o=c&n=5&h=1&j=4&m=10&r=0&d=21010101', '?o=c&n=5&h=1&j=4&m=10&r=0&d=20260229', '', '?n=05&o=c&h=1&j=4&m=10&r=0&d=20261002', '?o=c&n=5&h=1&j=4&m=1000&r=0&d=20261002'];
    for (const q of bad) {
      captured.length = 0;
      const res = await GET(req(q));
      expect(res, q).toBeTruthy();
      const t = tree();
      expect(t, q).toContain('범인은 이 자리에 있다');
      expect(t, q).toContain('"text":"궁"');
      expect(t, q).not.toContain('"text":"검거"');
    }
    // 윤년 2028-02-29 는 정상
    captured.length = 0;
    await GET(req('?o=c&n=5&h=1&j=4&m=10&r=0&d=20280229'));
    expect(tree()).not.toContain('범인은 이 자리에 있다');
  });

  it('스포일러: 어떤 결과 이미지에도 역할명·방 코드 자리가 없다(파라미터 7개뿐)', async () => {
    mockFonts(true);
    await GET(req('?o=e&n=4&h=0&j=3&m=33&r=1&d=20261002'));
    const t = tree();
    for (const w of ['숙의', '연씨', '중전', '내관', '어의', '조상궁', '세자빈', 'code']) expect(t).not.toContain(w);
  });
});
