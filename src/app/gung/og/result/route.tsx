import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';
import { formatYmd, OG_HEIGHT, OG_WIDTH, parseOgResultParams, verdictHeadline } from '@/lib/gung';

export const runtime = 'edge';

/**
 * §9 결과 이미지(Edge) — dongne/office-archetype 선례(ImageResponse route handler). 1200×630 고정.
 * 쿼리(§9-1)는 전부 숫자/열거형 — 자유 텍스트를 받지 않는다(임의 문구 이미지 생성 악용 차단).
 * 검증 실패 → 일반 커버를 렌더(200) — 404로 카톡 카드가 깨지지 않게 한다.
 * 색은 리터럴 하드코딩(satori는 CSS 변수를 못 읽는다) — §4-1/§9-2 값 그대로.
 */

const BG = '#0A0A0E';
const INK = '#F6F0E2';
const MUTED = '#9A907F';
const GOLD = '#E3B655';
const RED = '#B23A2C';
const SITE = 'project-orsrw.vercel.app/gung';
const TITLE = '세자 독살 사건';

/**
 * Google Fonts CSS2 API에서 이 이미지에 실제로 쓰는 글자만 서브셋으로 받아 TTF 바이트를 반환한다.
 * 어떤 단계든 실패하면 null — 호출부는 `fonts` 옵션 없이 기본 폰트로 렌더한다(이미지 생성은 절대 실패시키지 않음).
 */
async function loadSongMyung(text: string): Promise<ArrayBuffer | null> {
  try {
    const cssUrl = `https://fonts.googleapis.com/css2?family=Song+Myung&text=${encodeURIComponent(text)}`;
    const cssRes = await fetch(cssUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' } });
    if (!cssRes.ok) return null;
    const css = await cssRes.text();
    const match = css.match(/src: url\(([^)]+)\) format\('(?:truetype|opentype)'\)/);
    const fontUrl = match?.[1];
    if (!fontUrl) return null;
    const fontRes = await fetch(fontUrl);
    if (!fontRes.ok) return null;
    return await fontRes.arrayBuffer();
  } catch {
    return null;
  }
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        position: 'relative',
        background: BG,
        fontFamily: 'sans-serif',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 24,
          border: '1px solid rgba(227,182,85,0.35)',
          display: 'flex',
        }}
      />
      {children}
    </div>
  );
}

function Seal({ text, broken }: { text: string; broken: boolean }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: 780,
        top: 150,
        width: 300,
        height: 300,
        borderRadius: '50%',
        border: `10px ${broken ? 'dashed' : 'solid'} ${broken ? 'rgba(246,240,226,0.6)' : RED}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transform: 'rotate(-8deg)',
      }}
    >
      <span style={{ fontSize: 100, color: broken ? 'rgba(246,240,226,0.6)' : RED, fontWeight: 700 }}>{text}</span>
    </div>
  );
}

async function render(opts: {
  eyebrow: string;
  headline: string;
  caught: boolean;
  /** 인장 글자 — 기본 검거/도주. 일반 커버는 '궁'(§9-4, QA BUG-14) */
  seal?: string;
  stats?: { n: number; h: number; j: number; m: number; r: 0 | 1 };
  cta: string;
}): Promise<{ res: ImageResponse; fontOk: boolean }> {
  // 이미지에 들어가는 **모든** 글자(통계 라벨·단위 포함) — 빠진 글자는 satori 기본 폰트(라틴 전용)로 떨어져 □ 로 깨진다
  const statText = opts.stats ? `인원적중소요${opts.stats.n}인${opts.stats.h}/${opts.stats.j}${opts.stats.m}분재지목 끝에` : '';
  const subsetText = Array.from(new Set(`${TITLE}${opts.headline}${opts.eyebrow}${opts.cta}검거도주궁${statText}0123456789/·→`)).join('');
  const fontData = await loadSongMyung(subsetText);

  const res = new ImageResponse(
    (
      <Frame>
        <div style={{ position: 'absolute', left: 64, top: 72, fontSize: 22, color: MUTED, display: 'flex' }}>{opts.eyebrow}</div>
        <div style={{ position: 'absolute', left: 64, top: 112, fontSize: 72, color: INK, display: 'flex', fontFamily: fontData ? 'Song Myung' : 'sans-serif' }}>
          {TITLE}
        </div>
        <div
          style={{
            position: 'absolute',
            left: 64,
            top: 236,
            width: 620,
            fontSize: 40,
            color: GOLD,
            display: 'flex',
            fontFamily: fontData ? 'Song Myung' : 'sans-serif',
          }}
        >
          {opts.headline}
        </div>
        <Seal text={opts.seal ?? (opts.caught ? '검거' : '도주')} broken={!opts.caught} />
        {opts.stats && (
          <div style={{ position: 'absolute', left: 72, top: 380, display: 'flex', gap: 48 }}>
            <Stat label="인원" value={`${opts.stats.n}인`} />
            <Stat label="적중" value={`${opts.stats.h}/${opts.stats.j}`} />
            <Stat label="소요" value={`${opts.stats.m}분`} />
            {opts.stats.r === 1 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: 22,
                  color: '#EF7B6B',
                  background: '#262030',
                  borderRadius: 9999,
                  padding: '8px 20px',
                }}
              >
                재지목 끝에
              </div>
            )}
          </div>
        )}
        <div style={{ position: 'absolute', left: 72, top: 520, fontSize: 28, color: INK, display: 'flex' }}>{opts.cta}</div>
        <div style={{ position: 'absolute', left: 72, top: 568, fontSize: 20, color: MUTED, display: 'flex' }}>{SITE}</div>
      </Frame>
    ),
    {
      width: OG_WIDTH,
      height: OG_HEIGHT,
      fonts: fontData ? [{ name: 'Song Myung', data: fontData, style: 'normal' }] : undefined,
    },
  );
  return { res, fontOk: Boolean(fontData) };
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 22, color: MUTED }}>{label}</span>
      <span style={{ fontSize: 48, color: INK, fontWeight: 700 }}>{value}</span>
    </div>
  );
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const parsed = parseOgResultParams(searchParams);

  const { res, fontOk } = parsed
    ? await render({
        eyebrow: `사건 기록 · ${formatYmd(parsed.d)}`,
        headline: verdictHeadline({ caught: parsed.o === 'c', hits: parsed.h, judges: parsed.j, revoted: parsed.r === 1 }),
        caught: parsed.o === 'c',
        stats: { n: parsed.n, h: parsed.h, j: parsed.j, m: parsed.m, r: parsed.r },
        cta: '범인은 누구였을까? 직접 확인하시오 →',
      })
    : await render({
        eyebrow: '술자리 추리 게임',
        headline: '범인은 이 자리에 있다',
        caught: true,
        seal: '궁',
        cta: '4~6인 · 폰 하나씩 · 약 50분 →',
      });

  // QA BUG-13: 폰트를 못 받으면 한글이 □ 로 깨진 이미지다 — 이걸 1년 immutable 로 박으면 CDN·카톡 스크레이퍼가
  // 같은 파라미터(같은 날 같은 결과의 다른 모임 포함)에 계속 깨진 그림을 준다. 실패본은 캐시하지 않는다.
  res.headers.set('Cache-Control', fontOk ? 'public, max-age=31536000, immutable' : 'no-store');
  return res;
}
