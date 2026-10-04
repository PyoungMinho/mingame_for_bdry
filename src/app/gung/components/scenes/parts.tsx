/**
 * 현장 그림(원고 10-2) 공용 부품 — 밤의 궁궐 톤(먹·단청·한지·촛불)의 실루엣·문양 수준 SVG.
 *
 *  - 순수 장식이다(aria-hidden). 의미는 SceneView 의 핫스팟 이름표·관찰 카드가 전한다.
 *  - 모든 장소 그림은 viewBox 0 0 1600 1000(16:10) 한 장. 핫스팟 자리는 각 그림 파일의 anchors(%)와 맞춘다.
 *  - 그림 금지(원고 10-1): 시신·피, 동선 화살표·시각, 관찰 줄에 없는 단서(외매듭·티끌·개미·명주실·약봉지 글씨·
 *    장부 글자·편지·쪽지 내용). 사람은 얼굴 없는 실루엣.
 *  - 엔진·사건 데이터 import 없음(역할 무관).
 */
import { useId, type ReactNode } from 'react';

/** 그림 팔레트 — gung.css 토큰을 어둡게 누른 그림 전용 색(텍스트에 쓰지 않는다) */
export const C = {
  night0: '#05050A',
  night1: '#0B0A11',
  night2: '#13111B',
  night3: '#1B1825',
  wall: '#1A1620',
  wall2: '#231D26',
  wood0: '#170F0B',
  wood1: '#26190F',
  wood2: '#3A2717',
  wood3: '#55391F',
  woodHi: '#7A5532',
  floor: '#3B2A16',
  floorHi: '#5A4224',
  paper: '#EFE6CE',
  paperDim: '#B9AC8C',
  candle: '#F2A33B',
  candleHi: '#FFD98E',
  red: '#8E2A23',
  redDim: '#5A1D18',
  green: '#2F5A3E',
  greenDim: '#1C3426',
  blue: '#2E5C82',
  blueDim: '#1B3550',
  gold: '#C79A3E',
  goldHi: '#E8C779',
  goldDim: '#6E5323',
  porcelain: '#E6E1D3',
  porcelainShade: '#9F9A8C',
  stone: '#4A4A52',
  stoneDim: '#2C2C33',
  silver: '#C9CDD6',
  silh: '#040406',
  rim: '#F2A33B',
} as const;

/**
 * SVG 안 id(그라데이션·클립) — 화면에 그림이 두 장 떠도 겹치지 않게.
 * scope 를 주면 그 값으로 고정(렌더마다 같은 DOM — 역할 무관 DOM 비교 테스트용), 없으면 useId.
 */
export function useSvgIds(prefix: string, scope?: string) {
  const raw = useId();
  const p = `${prefix}-${(scope ? `s${scope}` : raw).replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return {
    id: (n: string) => `${p}-${n}`,
    url: (n: string) => `url(#${p}-${n})`,
  };
}
export type SvgIds = ReturnType<typeof useSvgIds>;

/** 그림 한 장의 틀 — 장식(aria-hidden), 16:10 */
export function SceneSvg({ children, label }: { children: ReactNode; label: string }) {
  return (
    <svg
      className="gu-scene-art"
      viewBox="0 0 1600 1000"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
      data-art={label}
      xmlns="http://www.w3.org/2000/svg"
    >
      {children}
    </svg>
  );
}

/** 공용 그라데이션 묶음 — 촛불 빛·가장자리 어둠(비네트)·먹 하늘 */
export function CommonDefs({ ids }: { ids: SvgIds }) {
  return (
    <>
      <radialGradient id={ids.id('glow')} cx="50%" cy="50%" r="50%">
        <stop offset="0" stopColor={C.candleHi} stopOpacity="0.55" />
        <stop offset="0.25" stopColor={C.candle} stopOpacity="0.28" />
        <stop offset="0.6" stopColor={C.candle} stopOpacity="0.08" />
        <stop offset="1" stopColor={C.candle} stopOpacity="0" />
      </radialGradient>
      <radialGradient id={ids.id('glowSoft')} cx="50%" cy="50%" r="50%">
        <stop offset="0" stopColor={C.candle} stopOpacity="0.22" />
        <stop offset="0.7" stopColor={C.candle} stopOpacity="0.05" />
        <stop offset="1" stopColor={C.candle} stopOpacity="0" />
      </radialGradient>
      <radialGradient id={ids.id('cold')} cx="50%" cy="50%" r="50%">
        <stop offset="0" stopColor="#5C7FA8" stopOpacity="0.18" />
        <stop offset="1" stopColor="#5C7FA8" stopOpacity="0" />
      </radialGradient>
      <radialGradient id={ids.id('vignette')} cx="50%" cy="48%" r="72%">
        <stop offset="0.55" stopColor="#000" stopOpacity="0" />
        <stop offset="1" stopColor="#000" stopOpacity="0.72" />
      </radialGradient>
      <linearGradient id={ids.id('paperLit')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={C.candleHi} stopOpacity="0.5" />
        <stop offset="1" stopColor={C.candle} stopOpacity="0.28" />
      </linearGradient>
      <linearGradient id={ids.id('paperDark')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#3D4A66" stopOpacity="0.55" />
        <stop offset="1" stopColor="#202838" stopOpacity="0.55" />
      </linearGradient>
      <linearGradient id={ids.id('floorFade')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#000" stopOpacity="0.45" />
        <stop offset="0.35" stopColor="#000" stopOpacity="0" />
      </linearGradient>
    </>
  );
}

/** 마지막에 덮는 가장자리 어둠 */
export function Vignette({ ids }: { ids: SvgIds }) {
  return <rect x="0" y="0" width="1600" height="1000" fill={ids.url('vignette')} pointerEvents="none" />;
}

/** 촛불·등잔 빛 웅덩이 */
export function Glow({ ids, cx, cy, r, soft, cold }: { ids: SvgIds; cx: number; cy: number; r: number; soft?: boolean; cold?: boolean }) {
  return <circle cx={cx} cy={cy} r={r} fill={ids.url(cold ? 'cold' : soft ? 'glowSoft' : 'glow')} />;
}

/** 창호(살창) — 한지 바른 격자 창. lit = 안쪽 불빛이 번진 창 */
export function Lattice({
  ids,
  x,
  y,
  w,
  h,
  cols = 4,
  rows = 5,
  lit = false,
  frame = C.wood2,
}: {
  ids: SvgIds;
  x: number;
  y: number;
  w: number;
  h: number;
  cols?: number;
  rows?: number;
  lit?: boolean;
  frame?: string;
}) {
  const vs = Array.from({ length: cols - 1 }, (_, i) => x + ((i + 1) * w) / cols);
  const hs = Array.from({ length: rows - 1 }, (_, i) => y + ((i + 1) * h) / rows);
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={ids.url(lit ? 'paperLit' : 'paperDark')} />
      {vs.map((vx) => (
        <line key={`v${vx}`} x1={vx} y1={y} x2={vx} y2={y + h} stroke={frame} strokeWidth="5" />
      ))}
      {hs.map((hy) => (
        <line key={`h${hy}`} x1={x} y1={hy} x2={x + w} y2={hy} stroke={frame} strokeWidth="5" />
      ))}
      <rect x={x} y={y} width={w} height={h} fill="none" stroke={frame} strokeWidth="12" />
    </g>
  );
}

/** 단청 띠 — 보·창방에 두르는 녹청 바탕 + 붉은·금 문양 반복 */
export function DancheongBand({ x, y, w, h, step = 120 }: { x: number; y: number; w: number; h: number; step?: number }) {
  const n = Math.ceil(w / step);
  const mid = y + h / 2;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={C.greenDim} />
      <rect x={x} y={y} width={w} height={h * 0.16} fill={C.redDim} />
      <rect x={x} y={y + h * 0.84} width={w} height={h * 0.16} fill={C.redDim} />
      {Array.from({ length: n }, (_, i) => {
        const cx = x + step / 2 + i * step;
        const r = h * 0.3;
        return (
          <g key={i}>
            <path d={`M ${cx - r * 1.6} ${mid} L ${cx} ${mid - r} L ${cx + r * 1.6} ${mid} L ${cx} ${mid + r} Z`} fill={C.blueDim} />
            <circle cx={cx} cy={mid} r={r * 0.55} fill={C.redDim} />
            <circle cx={cx} cy={mid} r={r * 0.22} fill={C.goldDim} />
            <line x1={cx + step / 2} y1={y + h * 0.2} x2={cx + step / 2} y2={y + h * 0.8} stroke={C.goldDim} strokeWidth="3" opacity="0.7" />
          </g>
        );
      })}
    </g>
  );
}

/** 기둥 — 나무 결 하이라이트 한 줄 */
export function Pillar({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={C.wood1} />
      <rect x={x + w * 0.18} y={y} width={w * 0.12} height={h} fill={C.wood3} opacity="0.55" />
      <rect x={x + w * 0.78} y={y} width={w * 0.22} height={h} fill={C.wood0} opacity="0.7" />
    </g>
  );
}

/** 마루 널 — 가로 널판 줄 + 원근 이음매 */
export function MaruFloor({ x, y, w, h, color = C.floor, boards = 7 }: { x: number; y: number; w: number; h: number; color?: string; boards?: number }) {
  const lines = Array.from({ length: boards }, (_, i) => y + (h * Math.pow((i + 1) / (boards + 1), 1.35)));
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={color} />
      {lines.map((ly, i) => (
        <line key={i} x1={x} y1={ly} x2={x + w} y2={ly} stroke={C.wood0} strokeWidth={2 + i * 0.6} opacity="0.55" />
      ))}
      {Array.from({ length: 6 }, (_, i) => {
        const fx = x + (w * (i + 0.5)) / 6;
        return <line key={`s${i}`} x1={fx} y1={y} x2={x + w / 2 + (fx - (x + w / 2)) * 1.9} y2={y + h} stroke={C.wood0} strokeWidth="2" opacity="0.28" />;
      })}
    </g>
  );
}

/** 등잔(등잔대 + 불꽃) — 빛 웅덩이는 Glow 로 따로 */
export function OilLamp({ x, y, h = 300, scale = 1 }: { x: number; y: number; h?: number; scale?: number }) {
  // (x, y) = 받침 바닥 가운데. 불꽃은 y - h
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <ellipse cx="0" cy="0" rx="46" ry="12" fill={C.wood0} />
      <path d="M -40 -4 Q 0 -26 40 -4 Z" fill={C.wood2} />
      <rect x="-5" y={-h + 30} width="10" height={h - 34} fill={C.wood2} />
      <rect x="-2" y={-h + 30} width="3" height={h - 34} fill={C.woodHi} opacity="0.6" />
      <ellipse cx="0" cy={-h + 30} rx="34" ry="9" fill={C.wood1} />
      <path d={`M -26 ${-h + 26} Q 0 ${-h + 44} 26 ${-h + 26} Z`} fill={C.porcelainShade} opacity="0.85" />
      <path d={`M 0 ${-h - 22} C 9 ${-h - 6} 10 ${-h + 8} 0 ${-h + 22} C -10 ${-h + 8} -9 ${-h - 6} 0 ${-h - 22} Z`} fill={C.candle} />
      <path d={`M 0 ${-h - 8} C 4 ${-h} 4 ${-h + 8} 0 ${-h + 16} C -4 ${-h + 8} -4 ${-h} 0 ${-h - 8} Z`} fill={C.candleHi} />
    </g>
  );
}

/** 촛대(초 한 자루) */
export function CandleStand({ x, y, h = 260 }: { x: number; y: number; h?: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx="0" cy="0" rx="40" ry="10" fill={C.goldDim} />
      <rect x="-4" y={-h + 60} width="8" height={h - 60} fill={C.goldDim} />
      <ellipse cx="0" cy={-h + 60} rx="26" ry="7" fill={C.gold} opacity="0.8" />
      <rect x="-9" y={-h + 2} width="18" height="58" rx="3" fill={C.paper} opacity="0.9" />
      <path d={`M 0 ${-h - 34} C 8 ${-h - 18} 8 ${-h - 6} 0 ${-h + 2} C -8 ${-h - 6} -8 ${-h - 18} 0 ${-h - 34} Z`} fill={C.candle} />
      <path d={`M 0 ${-h - 20} C 3 ${-h - 12} 3 ${-h - 6} 0 ${-h} C -3 ${-h - 6} -3 ${-h - 12} 0 ${-h - 20} Z`} fill={C.candleHi} />
    </g>
  );
}

// ─────────────── 얼굴 없는 실루엣(원고 10-1) ───────────────
// 모든 실루엣은 발밑 가운데가 (0, 0), 위로 음수. 크기는 scale 로.

const RIM = { stroke: C.rim, strokeOpacity: 0.28, strokeWidth: 3 } as const;

/** 서 있는 궁녀 — 치마 종 모양 + 저고리 + 쪽머리 */
export function LadyStanding({ x, y, s = 1, flip = false, tilt = 0, fill = C.silh }: { x: number; y: number; s?: number; flip?: boolean; tilt?: number; fill?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`} fill={fill} {...RIM}>
      <path d="M -36 -200 C -62 -128 -92 -46 -98 0 L 98 0 C 92 -46 62 -128 36 -200 Z" />
      <path d="M -44 -196 C -50 -240 -40 -270 -24 -284 L 24 -284 C 40 -270 50 -240 44 -196 Z" />
      <path d="M -44 -250 C -62 -220 -58 -190 -26 -176 L 26 -176 C 58 -190 62 -220 44 -250 Z" />
      <g transform={`rotate(${tilt} 0 -300)`}>
        <rect x="-9" y="-298" width="18" height="18" />
        <ellipse cx="0" cy="-318" rx="23" ry="26" />
        <ellipse cx="-20" cy="-326" rx="13" ry="11" />
      </g>
    </g>
  );
}

/** 엎드린 궁녀(대청 끝 번 나인) — 무릎 꿇고 이마를 바닥에 댄 절. 치마가 뒤로 퍼지고 소매가 앞으로 뻗는다 */
export function LadyProstrate({ x, y, s = 1, flip = false, fill = '#0A090E' }: { x: number; y: number; s?: number; flip?: boolean; fill?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`} fill={fill} stroke={C.rim} strokeOpacity={0.4} strokeWidth={3} strokeLinejoin="round">
      <path d="M -150 0 C -158 -34 -128 -64 -82 -72 C -44 -78 -12 -74 12 -66 L 24 0 Z" />
      <path d="M -36 -62 C -14 -104 42 -112 78 -90 C 100 -76 112 -54 116 -32 L 64 -16 L 6 -36 Z" />
      <path d="M 44 -42 C 78 -32 112 -22 158 -14 C 166 -12 168 -2 160 0 L 36 0 Z" />
      <ellipse cx="124" cy="-30" rx="21" ry="19" />
      <ellipse cx="106" cy="-50" rx="13" ry="11" />
    </g>
  );
}

/** 웅크려 앉은 의녀 — 고개 숙임 */
export function LadyCrouch({ x, y, s = 1, flip = false, fill = C.silh }: { x: number; y: number; s?: number; flip?: boolean; fill?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`} fill={fill} {...RIM}>
      <path d="M -96 0 C -100 -52 -76 -92 -40 -104 L 40 -104 C 76 -92 100 -52 96 0 Z" />
      <path d="M -40 -100 C -44 -140 -30 -170 -6 -178 C 22 -184 42 -164 46 -132 L 40 -100 Z" />
      <ellipse cx="30" cy="-176" rx="22" ry="24" transform="rotate(28 30 -176)" />
      <ellipse cx="14" cy="-196" rx="12" ry="10" />
    </g>
  );
}

/** 서 있는 내관(갓 없는 사모 실루엣) — 등롱을 든 손 */
export function GuardWithLantern({ ids, x, y, s = 1 }: { ids: SvgIds; x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <circle cx="58" cy="-150" r="90" fill={ids.url('glow')} />
      <g fill={C.silh} {...RIM}>
        <path d="M -30 0 L -38 -150 C -40 -190 -30 -214 -18 -222 L 18 -222 C 30 -214 40 -190 38 -150 L 30 0 Z" />
        <path d="M 22 -200 C 40 -190 52 -176 58 -160 L 50 -154 C 44 -168 34 -178 20 -184 Z" />
        <ellipse cx="0" cy="-244" rx="19" ry="22" />
        <path d="M -24 -258 L 24 -258 L 20 -282 L -20 -282 Z" />
        <rect x="-32" y="-262" width="64" height="7" rx="3" />
        <line x1="58" y1="-160" x2="58" y2="-138" stroke={C.silh} strokeWidth="4" />
      </g>
      <rect x="44" y="-138" width="28" height="36" rx="8" fill={C.candle} opacity="0.95" />
      <rect x="44" y="-138" width="28" height="36" rx="8" fill="none" stroke={C.wood1} strokeWidth="3" />
    </g>
  );
}

/** 버티고 앉은 사내(장 별감) — 양반다리, 팔꿈치를 벌림, 패랭이 실루엣 */
export function ManSitting({ x, y, s = 1, flip = false, fill = C.silh }: { x: number; y: number; s?: number; flip?: boolean; fill?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`} fill={fill} {...RIM}>
      <path d="M -122 0 C -126 -30 -90 -54 -40 -58 L 40 -58 C 90 -54 126 -30 122 0 Z" />
      <path d="M -54 -54 L -64 -196 C -60 -214 -40 -224 -20 -228 L 20 -228 C 40 -224 60 -214 64 -196 L 54 -54 Z" />
      <path d="M -60 -180 L -112 -110 L -88 -58 L -66 -66 L -80 -108 L -50 -150 Z" />
      <path d="M 60 -180 L 112 -110 L 88 -58 L 66 -66 L 80 -108 L 50 -150 Z" />
      <rect x="-12" y="-244" width="24" height="20" />
      <ellipse cx="0" cy="-266" rx="26" ry="28" />
      <path d="M -66 -284 Q 0 -300 66 -284 L 60 -278 Q 0 -290 -60 -278 Z" />
      <path d="M -30 -286 C -28 -318 28 -318 30 -286 Z" />
    </g>
  );
}

/** 먼 기와지붕(처마 곡선) 실루엣 — 담 너머·문 너머 배경 */
export function RoofSilhouette({ x, y, w, h, fill = C.night0 }: { x: number; y: number; w: number; h: number; fill?: string }) {
  // (x, y) = 지붕 왼쪽 처마 끝 아래, w = 처마 폭, h = 지붕 높이
  const lift = h * 0.22;
  return (
    <g fill={fill}>
      <path
        d={`M ${x} ${y - lift} Q ${x + w * 0.12} ${y} ${x + w * 0.22} ${y - h * 0.08} L ${x + w * 0.78} ${y - h * 0.08} Q ${x + w * 0.88} ${y} ${x + w} ${y - lift}
            L ${x + w * 0.86} ${y - h * 0.62} L ${x + w * 0.62} ${y - h} L ${x + w * 0.38} ${y - h} L ${x + w * 0.14} ${y - h * 0.62} Z`}
      />
      <rect x={x + w * 0.2} y={y - h * 0.1} width={w * 0.6} height={h * 0.5} />
    </g>
  );
}

/** 별 — 정해진 시드로 흩뿌린다(렌더마다 같다) */
export function Stars({ x, y, w, h, n = 40, seed = 7, opacity = 0.8 }: { x: number; y: number; w: number; h: number; n?: number; seed?: number; opacity?: number }) {
  let s = seed;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  const pts = Array.from({ length: n }, () => ({ cx: x + rnd() * w, cy: y + rnd() * h, r: 0.8 + rnd() * 2.2, o: 0.3 + rnd() * 0.7 }));
  return (
    <g fill="#DCE6FF" opacity={opacity}>
      {pts.map((p, i) => (
        <circle key={i} cx={p.cx.toFixed(1)} cy={p.cy.toFixed(1)} r={p.r.toFixed(2)} opacity={p.o.toFixed(2)} />
      ))}
    </g>
  );
}

/** 자개(나전) 반짝임 — 검은 옻칠 위 작은 무지갯빛 조각 */
export function NacreDots({ x, y, w, h, n = 22, seed = 3 }: { x: number; y: number; w: number; h: number; n?: number; seed?: number }) {
  let s = seed;
  const rnd = () => {
    s = (s * 48271) % 2147483647;
    return s / 2147483647;
  };
  const tones = ['#A9C7D8', '#D9C2D6', '#BFD9C4', '#E6E0C8'];
  return (
    <g>
      {Array.from({ length: n }, (_, i) => {
        const cx = x + rnd() * w;
        const cy = y + rnd() * h;
        const r = 3 + rnd() * 7;
        return (
          <path
            key={i}
            d={`M ${(cx - r).toFixed(1)} ${cy.toFixed(1)} Q ${cx.toFixed(1)} ${(cy - r).toFixed(1)} ${(cx + r).toFixed(1)} ${cy.toFixed(1)} Q ${cx.toFixed(1)} ${(cy + r * 0.6).toFixed(1)} ${(cx - r).toFixed(1)} ${cy.toFixed(1)} Z`}
            fill={tones[i % tones.length]}
            opacity={(0.35 + rnd() * 0.4).toFixed(2)}
          />
        );
      })}
    </g>
  );
}
