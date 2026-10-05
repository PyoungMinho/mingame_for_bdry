import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';
import { HOOKS, OG_HEIGHT, OG_WIDTH, ogCard, parseOgQueryString, type OgCard } from '@/lib/witness/share';

export const runtime = 'edge';

/**
 * 디자인 §9-2 OG 이미지(Edge, 1200×630) — gung `og/result` 선례.
 * - 쿼리 없음/검증 실패/여분 키 → 기본 커버를 200 으로(404 금지 — 카톡 카드가 깨지지 않게).
 *   같은 출처의 정적 /witness/og.jpg 바이트를 그대로 돌려주고, 그게 실패하면 ImageResponse 커버.
 * - 유효 쿼리(g,s,e,r,k,v — 전부 정수·열거형) → 결과 카드. 문구는 전부 ogCard()가 등급·숫자·열거형에서 파생한다.
 *   자유 텍스트를 받지 않고, 범인·증거 이름·트릭 어휘가 들어올 자리가 없다.
 * - 색은 witness.css 토큰의 리터럴 값(satori 는 CSS 변수를 못 읽는다). 한글은 Black Han Sans 서브셋(text=) 1회 fetch,
 *   실패 시 기본 폰트. 폰트 성공 → 결과 카드 장기 캐시 / 실패 → no-store(깨진 □ 이미지를 CDN 에 박지 않는다).
 */

const BG1 = '#060913';
const BG2 = '#0B1020';
const INK = '#EAF1FF';
const BODY = '#BDC9E3';
const MUTED = '#8392B5';
const CYAN = '#3DE0F7';
const AMBER = '#FFB84A';
const GOLD = '#FFD76A';
const PINK = '#FF4D94';
const GRADE_COLOR = { S: GOLD, A: CYAN, B: AMBER, C: MUTED } as const;
const SITE = 'project-orsrw.vercel.app/witness';
const KICKER = '스마트홈 살인사건';
const WORDMARK_A = '목격자는 ';
const WORDMARK_B = 'AI';
const FONT = 'Black Han Sans';

const COVER_TEXT = '행동 13번 22:50 01:00';
const COVER_JPG_PATH = '/witness/og.jpg';

async function loadFont(text: string): Promise<ArrayBuffer | null> {
  try {
    const cssUrl = `https://fonts.googleapis.com/css2?family=Black+Han+Sans&text=${encodeURIComponent(text)}`;
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

function subset(...parts: string[]): string {
  return Array.from(new Set(`${KICKER}${WORDMARK_A}${WORDMARK_B}SABC0123456789/:· ${parts.join('')}`)).join('');
}

/** 40여 개 창 불빛이 있는 스카이라인(y 430~630). 난수 대신 고정 배열 — 같은 쿼리는 같은 그림 */
const BUILDINGS: { x: number; w: number; h: number }[] = [
  { x: 0, w: 90, h: 120 }, { x: 80, w: 70, h: 170 }, { x: 150, w: 110, h: 100 }, { x: 250, w: 60, h: 190 }, { x: 310, w: 100, h: 130 },
  { x: 400, w: 80, h: 160 }, { x: 480, w: 120, h: 90 }, { x: 600, w: 70, h: 180 }, { x: 670, w: 100, h: 110 }, { x: 770, w: 90, h: 150 },
  { x: 860, w: 110, h: 100 }, { x: 970, w: 70, h: 175 }, { x: 1040, w: 90, h: 125 }, { x: 1130, w: 70, h: 150 },
];
const WINDOW_COLORS = [CYAN, AMBER, PINK];

function Skyline() {
  const dots: { x: number; y: number; c: string }[] = [];
  BUILDINGS.forEach((b, i) => {
    for (let k = 0; k < 3; k += 1) {
      const dx = 12 + ((k * 23 + i * 7) % Math.max(14, b.w - 24));
      const dy = 14 + ((k * 31 + i * 11) % Math.max(14, b.h - 28));
      dots.push({ x: b.x + dx, y: OG_HEIGHT - b.h + dy, c: WINDOW_COLORS[(i + k) % 3] });
    }
  });
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: OG_WIDTH, height: OG_HEIGHT, display: 'flex' }}>
      {BUILDINGS.map((b, i) => (
        <div key={`b${i}`} style={{ position: 'absolute', left: b.x, top: OG_HEIGHT - b.h, width: b.w, height: b.h, background: i % 2 ? '#0D1426' : '#0A1022', display: 'flex' }} />
      ))}
      {dots.map((d, i) => (
        <div key={`d${i}`} style={{ position: 'absolute', left: d.x, top: d.y, width: 6, height: 6, borderRadius: 3, background: d.c, opacity: 0.5, display: 'flex' }} />
      ))}
    </div>
  );
}

function Speaker() {
  return (
    <div style={{ position: 'absolute', left: 1030, top: 470, width: 100, height: 140, display: 'flex' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: 100, height: 140, borderRadius: 50, background: '#121A2E', border: '2px solid rgba(160,196,255,0.2)', display: 'flex' }} />
      <div style={{ position: 'absolute', left: 6, top: 86, width: 88, height: 10, borderRadius: 5, background: CYAN, opacity: 0.9, display: 'flex' }} />
    </div>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        position: 'relative',
        backgroundImage: `linear-gradient(180deg, ${BG1} 0%, ${BG2} 100%)`,
        fontFamily: 'sans-serif',
      }}
    >
      <Skyline />
      {children}
    </div>
  );
}

function Header({ font }: { font: string }) {
  return (
    <>
      <div
        style={{
          position: 'absolute', left: 64, top: 52, height: 44, padding: '0 22px', display: 'flex', alignItems: 'center',
          border: `1px solid ${CYAN}`, borderRadius: 22, fontSize: 26, color: CYAN, fontFamily: font,
        }}
      >
        {KICKER}
      </div>
      <div style={{ position: 'absolute', left: 64, top: 108, display: 'flex', fontSize: 112, color: INK, fontFamily: font }}>
        <span>{WORDMARK_A}</span>
        <span style={{ color: CYAN, marginLeft: 30, textShadow: `0 0 28px rgba(61,224,247,0.55)` }}>{WORDMARK_B}</span>
      </div>
    </>
  );
}

function Stamp({ text, color, font, size = 300, textSize = 190 }: { text: string | string[]; color: string; font: string; size?: number; textSize?: number }) {
  const lines = Array.isArray(text) ? text : [text];
  return (
    <div
      style={{
        position: 'absolute', left: 960 - size / 2, top: 260 - size / 2, width: size, height: size, borderRadius: size / 2,
        border: `10px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'rotate(-8deg)',
      }}
    >
      <div style={{ position: 'absolute', left: 14, top: 14, right: 14, bottom: 14, borderRadius: size / 2, border: `2px solid ${color}`, opacity: 0.7, display: 'flex' }} />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: lines.length > 1 ? 10 : 0 }}>
        {lines.map((t, i) => (
          <div key={`${t}${i}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            {i > 0 && <div style={{ width: 4, height: 28, background: color, opacity: 0.8, display: 'flex' }} />}
            <span style={{ fontSize: textSize, color, fontFamily: font, textShadow: `0 0 24px ${color}66` }}>{t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Url() {
  return <div style={{ position: 'absolute', left: 64, top: 586, fontSize: 22, color: MUTED, display: 'flex' }}>{SITE}</div>;
}

function ResultCard({ c, font }: { c: OgCard; font: string }) {
  const color = GRADE_COLOR[c.grade];
  return (
    <Frame>
      <Header font={font} />
      <Stamp text={c.grade} color={color} font={font} />
      {c.badge && (
        <div
          style={{
            position: 'absolute', left: 960 - 120, top: 418, width: 240, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: `1px solid ${CYAN}`, borderRadius: 20, color: CYAN, fontSize: 22, fontFamily: font,
          }}
        >
          {c.badge}
        </div>
      )}
      <div style={{ position: 'absolute', left: 64, top: 258, display: 'flex', fontSize: 44, color: GOLD, fontFamily: font }}>{c.title}</div>
      <div style={{ position: 'absolute', left: 64, top: 322, display: 'flex', fontSize: 28, color: BODY, fontFamily: font }}>{c.line}</div>
      <div style={{ position: 'absolute', left: 64, top: 396, display: 'flex', gap: 16 }}>
        {c.chips.map((t) => (
          <div
            key={t}
            style={{
              height: 56, padding: '0 22px', display: 'flex', alignItems: 'center', fontSize: 28, color: INK, fontFamily: font,
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(160,196,255,0.2)', borderRadius: 14,
            }}
          >
            {t}
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', left: 64, top: 492, display: 'flex', fontSize: 30, color: BODY, fontFamily: font }}>{c.hook}</div>
      <Url />
      <Speaker />
    </Frame>
  );
}

function CoverCard({ font }: { font: string }) {
  return (
    <Frame>
      <Header font={font} />
      <Stamp text={['22:50', '01:00']} color={AMBER} font={font} textSize={64} />
      <div style={{ position: 'absolute', left: 64, top: 264, display: 'flex', fontSize: 120, color: GOLD, fontFamily: font }}>행동 13번</div>
      <div style={{ position: 'absolute', left: 64, top: 430, display: 'flex', fontSize: 34, color: BODY, fontFamily: font }}>{HOOKS[0]}</div>
      <Url />
      <Speaker />
    </Frame>
  );
}

async function renderImage(node: (font: string) => React.ReactElement, text: string): Promise<{ res: ImageResponse; fontOk: boolean }> {
  const data = await loadFont(text);
  const res = new ImageResponse(node(data ? FONT : 'sans-serif'), {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts: data ? [{ name: FONT, data, style: 'normal', weight: 400 }] : undefined,
  });
  return { res, fontOk: Boolean(data) };
}

/** 같은 출처 정적 커버(/witness/og.jpg)의 바이트. JPEG 이 아니거나 느리면 null → ImageResponse 커버 */
async function staticCover(origin: string): Promise<Response | null> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 4000);
  try {
    // Next 14 는 fetch 결과를 Data Cache 에 배포를 넘어 붙잡아 둔다 — 커버를 갈아도 옛 바이트가 나오지 않게 no-store
    const r = await fetch(`${origin}${COVER_JPG_PATH}`, { signal: ctl.signal, cache: 'no-store' });
    if (!r.ok) return null;
    const buf = await r.arrayBuffer();
    const b = new Uint8Array(buf);
    if (b.length < 1024 || b[0] !== 0xff || b[1] !== 0xd8) return null;
    return new Response(buf, {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        // 갱신 가능한 정적 파일의 사본 — 짧게만 캐시(카톡 쪽 갱신은 메타의 ?v= 로)
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const parsed = parseOgQueryString(url.search.replace(/^\?/, ''));

  if (parsed) {
    const card = ogCard(parsed);
    const { res, fontOk } = await renderImage((f) => <ResultCard c={card} font={f} />, subset(card.title, card.line, card.chips.join(''), card.badge ?? '', card.hook));
    // 결과 카드는 (g,s,e,r,k,v) 만의 순수 함수 — 폰트가 정상일 때만 장기 캐시
    res.headers.set('Cache-Control', fontOk ? 'public, max-age=31536000, immutable' : 'no-store');
    return res;
  }

  const cover = await staticCover(url.origin);
  if (cover) return cover;

  const { res, fontOk } = await renderImage((f) => <CoverCard font={f} />, subset(COVER_TEXT, HOOKS[0]));
  // 폴백 커버는 임시 대체본 — 폰트가 정상이어도 짧게만(정적 파일이 살아나면 바로 바뀌게)
  res.headers.set('Cache-Control', fontOk ? 'public, max-age=600' : 'no-store');
  return res;
}
