/**
 * 좀비 터지면 — 씬 아트 공용 프리미티브.
 *
 * 스타일: "시네마틱 실루엣 듀오톤". 강한 단일 광원 + 대기 그라디언트 배경 위에
 * 거의 검정인 실루엣 레이어 3~4겹(뒤로 갈수록 밝고 흐리게). 디테일은 광원과 윤곽에서 나온다.
 *
 * 좌표계: viewBox 0 0 800 450. 인물/좀비/개는 발바닥(지면)이 (x, y) 이고 s=1 일 때 키 ≈100(개 ≈34).
 * 애니메이션 클래스(zs-*)는 transform 속성이 없는 <g> 에만 붙인다 — CSS transform 이 속성을 덮어쓰기 때문.
 */
import type { ReactNode } from 'react';

export const W = 800;
export const H = 450;

export const PAL = {
  ink: '#040605',
  ink2: '#0A0E0C',
  ink3: '#121916',
  ink4: '#1C2521',
  ink5: '#28332E',
  fire: ['#1F0704', '#5E160B', '#B03418', '#E8742A', '#FFC870'],
  night: ['#05090B', '#0B1618', '#15292B', '#2A4A4A', '#5E8583'],
  sick: ['#070B05', '#141D0F', '#2C3D18', '#5D7A28', '#A6C84A'],
  dawn: ['#0A0E16', '#1A2230', '#3E4D63', '#8292A6', '#E6C49A'],
  lamp: ['#100904', '#261708', '#6E4418', '#D08A35', '#FFD89A'],
  alert: '#FFB020',
  blood: '#5E0B10',
  exit: '#27D17A',
  screen: '#9FD4FF',
} as const;

/** 결정론적 난수 (mulberry32) — 창문 점등 패턴 등이 렌더마다 바뀌지 않게 */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 모든 씬의 루트 */
export function SceneSvg({ children }: { children: ReactNode }) {
  return (
    <svg
      className="zs-svg"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

type Stops = [number, string][];

/** 세로 그라디언트 면(하늘·벽·바닥) */
export function Sky({
  id,
  stops,
  x = 0,
  y = 0,
  w = W,
  h = H,
}: {
  id: string;
  stops: Stops;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
}) {
  return (
    <>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          {stops.map(([o, c], i) => (
            <stop key={i} offset={o} stopColor={c} />
          ))}
        </linearGradient>
      </defs>
      <rect x={x} y={y} width={w} height={h} fill={`url(#${id})`} />
    </>
  );
}

/** 광원 — 가운데서 투명으로 번지는 원 */
export function Glow({
  id,
  cx,
  cy,
  r,
  color,
  opacity = 1,
  className,
}: {
  id: string;
  cx: number;
  cy: number;
  r: number;
  color: string;
  opacity?: number;
  className?: string;
}) {
  return (
    <g className={className}>
      <defs>
        <radialGradient id={id}>
          <stop offset="0" stopColor={color} stopOpacity={opacity} />
          <stop offset="0.45" stopColor={color} stopOpacity={opacity * 0.35} />
          <stop offset="1" stopColor={color} stopOpacity={0} />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={r} fill={`url(#${id})`} />
    </g>
  );
}

/** 가로 안개/연무 띠 — 레이어 사이에 깔아 깊이를 만든다 */
export function Haze({
  id,
  y,
  h,
  color,
  opacity = 0.6,
  className,
}: {
  id: string;
  y: number;
  h: number;
  color: string;
  opacity?: number;
  className?: string;
}) {
  return (
    <g className={className}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity={0} />
          <stop offset="0.55" stopColor={color} stopOpacity={opacity} />
          <stop offset="1" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <rect x={-20} y={y} width={W + 40} height={h} fill={`url(#${id})`} />
    </g>
  );
}

/** 가장자리 어둡게 */
export function Vignette({ id, strength = 0.85 }: { id: string; strength?: number }) {
  return (
    <>
      <defs>
        <radialGradient id={id} cx="0.5" cy="0.5" r="0.75">
          <stop offset="0.55" stopColor="#000" stopOpacity={0} />
          <stop offset="1" stopColor="#000" stopOpacity={strength} />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#${id})`} />
    </>
  );
}

// ─────────────────────────────── 인물 ───────────────────────────────

type FigureBase = { x: number; y: number; s?: number; flip?: boolean; fill?: string; className?: string };

const limb = { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

function Placed({ x, y, s = 1, flip, className, children }: FigureBase & { children: ReactNode }) {
  // 위치 transform 은 바깥 g, 애니메이션 클래스는 안쪽 g (transform 충돌 방지)
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
      <g className={className}>{children}</g>
    </g>
  );
}

export type ZombiePose = 'shamble' | 'reach' | 'lurch';

/** 좀비 실루엣. 기본 오른쪽을 향한다(flip 으로 반전). */
export function Zombie({ pose = 'shamble', fill = PAL.ink, ...p }: FigureBase & { pose?: ZombiePose }) {
  const st = { ...limb, stroke: fill };
  return (
    <Placed {...p}>
      {pose === 'shamble' && (
        <g fill={fill}>
          <path d="M-3 -44 L-7 -22 L-11 -2" {...st} strokeWidth={9} />
          <path d="M5 -44 L10 -23 L8 -2" {...st} strokeWidth={9} />
          <ellipse cx={-9} cy={-2} rx={6} ry={2.8} />
          <ellipse cx={11} cy={-2} rx={6} ry={2.8} />
          <path d="M-4 -71 L-7 -53 L-4 -37" {...st} strokeWidth={6} />
          <path d="M-7 -77 C1 -81 11 -78 14 -71 L10 -44 C4 -40 -4 -40 -9 -44 C-11 -56 -11 -68 -7 -77 Z" />
          <path d="M-10 -46 L-8 -37 L-5 -43 L-2 -36 L1 -42 L4 -35 L7 -42 L11 -38 L10 -46 Z" />
          <path d="M11 -70 L24 -61 L37 -63" {...st} strokeWidth={6} />
          <path d="M37 -63 L42 -66 M37 -63 L42 -62 M37 -63 L41 -59" {...st} strokeWidth={2} />
          <path d="M5 -77 L10 -83" {...st} strokeWidth={6} />
          <ellipse cx={12} cy={-88} rx={8} ry={9.5} transform="rotate(28 12 -88)" />
          <path d="M6 -95 L4 -99 M10 -97 L10 -101 M14 -96 L17 -99" {...st} strokeWidth={1.6} />
        </g>
      )}
      {pose === 'reach' && (
        <g fill={fill}>
          <path d="M-3 -44 L-5 -22 L-9 -2" {...st} strokeWidth={9} />
          <path d="M5 -44 L8 -22 L10 -2" {...st} strokeWidth={9} />
          <ellipse cx={-7} cy={-2} rx={6} ry={2.8} />
          <ellipse cx={13} cy={-2} rx={6} ry={2.8} />
          <path d="M-8 -78 C0 -82 10 -80 12 -73 L9 -44 C3 -40 -4 -40 -9 -44 C-11 -57 -11 -69 -8 -78 Z" />
          <path d="M-10 -46 L-7 -38 L-4 -44 L0 -37 L3 -43 L7 -37 L10 -45 Z" />
          <path d="M6 -68 L21 -63 L35 -64" {...st} strokeWidth={6} />
          <path d="M10 -72 L25 -70 L39 -72" {...st} strokeWidth={6} />
          <path d="M39 -72 L44 -75 M39 -72 L45 -71 M35 -64 L40 -66 M35 -64 L40 -61" {...st} strokeWidth={2} />
          <path d="M2 -78 L5 -84" {...st} strokeWidth={6} />
          <ellipse cx={7} cy={-90} rx={8} ry={9.5} transform="rotate(14 7 -90)" />
          <path d="M1 -97 L-1 -101 M6 -99 L7 -103 M11 -98 L13 -101" {...st} strokeWidth={1.6} />
        </g>
      )}
      {pose === 'lurch' && (
        <g fill={fill}>
          <path d="M-2 -44 L-10 -24 L-21 -4" {...st} strokeWidth={9} />
          <path d="M6 -44 L9 -22 L12 -2" {...st} strokeWidth={9} />
          <ellipse cx={-23} cy={-3} rx={6} ry={2.6} transform="rotate(-12 -23 -3)" />
          <ellipse cx={15} cy={-2} rx={6} ry={2.8} />
          <path d="M-2 -70 L-10 -56 L-12 -42" {...st} strokeWidth={6} />
          <path d="M-4 -76 C4 -80 14 -76 17 -69 L10 -44 C4 -40 -3 -40 -8 -44 C-9 -56 -8 -67 -4 -76 Z" />
          <path d="M-9 -46 L-6 -37 L-3 -43 L1 -36 L4 -42 L8 -35 L11 -45 Z" />
          <path d="M14 -69 L20 -50 L22 -34" {...st} strokeWidth={6} />
          <path d="M12 -75 L17 -79" {...st} strokeWidth={6} />
          <ellipse cx={20} cy={-81} rx={8} ry={9.5} transform="rotate(42 20 -81)" />
          <path d="M18 -91 L18 -95 M23 -89 L26 -92" {...st} strokeWidth={1.6} />
        </g>
      )}
    </Placed>
  );
}

export type PersonPose = 'stand' | 'walk' | 'run' | 'crouch' | 'sit';

/** 생존자 실루엣. 배낭을 멘 채 오른쪽을 향한다. */
export function Person({
  pose = 'stand',
  fill = PAL.ink,
  prop = 'none',
  pack = true,
  ...p
}: FigureBase & { pose?: PersonPose; prop?: 'none' | 'bat' | 'light'; pack?: boolean }) {
  const st = { ...limb, stroke: fill };
  const head = (cx: number, cy: number) => (
    <>
      <ellipse cx={cx} cy={cy} rx={7.5} ry={9} />
      <path d={`M${cx - 7} ${cy - 2} C${cx - 7} ${cy - 11} ${cx + 6} ${cy - 13} ${cx + 8} ${cy - 3}`} {...st} strokeWidth={2.5} />
    </>
  );
  return (
    <Placed {...p}>
      <g fill={fill}>
        {pose === 'stand' && (
          <>
            <path d="M-3 -44 L-4 -22 L-5 -2" {...st} strokeWidth={9} />
            <path d="M4 -44 L5 -22 L6 -2" {...st} strokeWidth={9} />
            <ellipse cx={-3} cy={-2} rx={5.5} ry={2.6} />
            <ellipse cx={9} cy={-2} rx={5.5} ry={2.6} />
            {pack && <rect x={-16} y={-77} width={10} height={25} rx={3} />}
            <path d="M-8 -78 C-2 -81 6 -81 9 -78 L8 -44 L-7 -44 Z" />
            <path d="M-6 -75 L-8 -58 L-7 -43" {...st} strokeWidth={6} />
            <path d="M7 -75 L10 -58 L11 -42" {...st} strokeWidth={6} />
            <path d="M1 -80 L1.5 -84" {...st} strokeWidth={6} />
            {head(1.5, -91)}
            {prop === 'bat' && <path d="M11 -42 L25 -73" {...st} strokeWidth={4.5} />}
          </>
        )}
        {pose === 'walk' && (
          <>
            <path d="M-2 -44 L-8 -23 L-14 -3" {...st} strokeWidth={9} />
            <path d="M4 -44 L9 -23 L13 -2" {...st} strokeWidth={9} />
            <ellipse cx={-12} cy={-2} rx={5.5} ry={2.6} />
            <ellipse cx={16} cy={-2} rx={5.5} ry={2.6} />
            {pack && <rect x={-16} y={-77} width={10} height={25} rx={3} />}
            <path d="M-7 -78 C-1 -81 7 -81 10 -78 L8 -44 L-6 -44 Z" />
            <path d="M-5 -75 L-11 -59 L-13 -45" {...st} strokeWidth={6} />
            <path d="M8 -75 L13 -59 L18 -46" {...st} strokeWidth={6} />
            <path d="M2 -80 L3 -84" {...st} strokeWidth={6} />
            {head(3, -91)}
            {prop === 'bat' && <path d="M18 -46 L36 -66" {...st} strokeWidth={4.5} />}
          </>
        )}
        {pose === 'run' && (
          <>
            <path d="M-2 -44 L-13 -30 L-24 -20" {...st} strokeWidth={9} />
            <path d="M4 -44 L16 -30 L13 -4" {...st} strokeWidth={9} />
            <ellipse cx={-27} cy={-19} rx={5.5} ry={2.6} transform="rotate(-30 -27 -19)" />
            <ellipse cx={16} cy={-3} rx={5.5} ry={2.6} />
            <g transform="rotate(14 0 -44)">
              {pack && <rect x={-16} y={-77} width={10} height={25} rx={3} />}
              <path d="M-7 -78 C-1 -81 7 -81 10 -78 L8 -44 L-6 -44 Z" />
              <path d="M-5 -74 L-15 -62 L-22 -67" {...st} strokeWidth={6} />
              <path d="M8 -74 L17 -63 L25 -70" {...st} strokeWidth={6} />
              <path d="M2 -80 L3 -84" {...st} strokeWidth={6} />
              {head(3, -91)}
              {prop === 'bat' && <path d="M25 -70 L30 -100" {...st} strokeWidth={4.5} />}
            </g>
          </>
        )}
        {pose === 'crouch' && (
          <>
            <path d="M-2 -32 L-5 -5 L-17 -3" {...st} strokeWidth={9} />
            <path d="M4 -32 L15 -22 L13 -3" {...st} strokeWidth={9} />
            <ellipse cx={-19} cy={-2.6} rx={5} ry={2.4} />
            <ellipse cx={16} cy={-2} rx={5.5} ry={2.6} />
            <g transform="rotate(20 0 -32)">
              {pack && <rect x={-16} y={-65} width={10} height={24} rx={3} />}
              <path d="M-8 -66 C-2 -69 6 -69 9 -66 L8 -32 L-7 -32 Z" />
              <path d="M7 -63 L14 -48 L22 -40" {...st} strokeWidth={6} />
              <path d="M1 -68 L1.5 -72" {...st} strokeWidth={6} />
              {head(2, -79)}
              {prop === 'light' && <rect x={20} y={-44} width={9} height={4} rx={1.5} />}
            </g>
          </>
        )}
        {pose === 'sit' && (
          <>
            <path d="M-4 -10 L12 -9 L20 -2" {...st} strokeWidth={9} />
            <path d="M2 -10 L16 -14 L24 -3" {...st} strokeWidth={8} />
            <path d="M-9 -50 C-3 -53 5 -53 8 -50 L6 -10 L-9 -10 Z" />
            <path d="M6 -47 L13 -30 L20 -22" {...st} strokeWidth={6} />
            <path d="M-7 -47 L-4 -30 L4 -22" {...st} strokeWidth={6} />
            <path d="M0 -52 L0.5 -56" {...st} strokeWidth={6} />
            {head(1, -63)}
          </>
        )}
      </g>
    </Placed>
  );
}

/** 콩이 — 곱슬 털 믹스견, 한쪽 귀가 접혀 있다. s=1 일 때 키 ≈34 (사람의 1/3). */
export function Dog({ pose = 'sit', fill = PAL.ink, ...p }: FigureBase & { pose?: 'sit' | 'stand' }) {
  const st = { ...limb, stroke: fill };
  // 머리(두개골 + 둥근 주둥이 + 코) · 선 귀(끝이 둥근) · 앞으로 접힌 귀
  const head = (dx: number) => (
    <>
      <circle cx={9 + dx} cy={-31} r={6.6} />
      <path d={`M${13 + dx} -34 C${18 + dx} -34 ${21 + dx} -31.5 ${20.6 + dx} -28.6 C${20.2 + dx} -26 ${16 + dx} -25.4 ${12.5 + dx} -26 Z`} />
      <circle cx={20.4 + dx} cy={-30.2} r={1.6} />
      <path d={`M${4.2 + dx} -34.5 C${2 + dx} -40 ${3.8 + dx} -44.5 ${6.6 + dx} -42.6 C${8.4 + dx} -41 ${8.4 + dx} -37.6 ${7.8 + dx} -35.4 Z`} />
      <path d={`M${8.4 + dx} -36.6 C${12.4 + dx} -38.6 ${14.6 + dx} -34.6 ${13 + dx} -30.6 C${11.4 + dx} -31.2 ${9.8 + dx} -33.4 ${8.4 + dx} -36.6 Z`} />
      <circle cx={6 + dx} cy={-37} r={2} />
    </>
  );
  return (
    <Placed {...p}>
      <g fill={fill}>
        {pose === 'sit' ? (
          <>
            <path d="M-15 -4 C-20 -6 -22 -12 -18.5 -15.5" {...st} strokeWidth={3.4} />
            <path d="M-15 0 C-18 -8 -15 -17 -8 -19 C-4 -21 0 -24 3 -26.5 L9.5 -25.5 C11.5 -19 12 -10 10.8 -5 L11.2 0 L5.2 0 L4.8 -7 C3.2 -9.2 0 -8.4 -1 -5 L0 0 Z" />
            <circle cx={11} cy={-20} r={2.2} />
            <circle cx={11.6} cy={-14.5} r={1.9} />
            {head(0)}
          </>
        ) : (
          <>
            <path d="M-14 -20 C-19 -23 -20 -29 -16.5 -31" {...st} strokeWidth={3.4} />
            <ellipse cx={-2} cy={-17} rx={13.5} ry={7} />
            <path d="M-12 -13 L-13.5 -1 M-7.5 -12 L-6.5 -1 M5 -12 L4.5 -1 M9 -13 L10.5 -1" {...st} strokeWidth={3.6} />
            <path d="M6 -20 L10 -27" {...st} strokeWidth={6.5} />
            <circle cx={10.6} cy={-19} r={2.2} />
            {head(4)}
          </>
        )}
      </g>
    </Placed>
  );
}

// ─────────────────────────────── 건물·도시 ───────────────────────────────

/**
 * 한국식 판상형 아파트 동. (x, y) 는 왼쪽 아래 모서리.
 * 창 전체를 그리지 않고 층 난간 줄 + 켜진 창만 그려 노드 수를 줄인다.
 */
export function ApartmentBlock({
  x,
  y,
  w,
  h,
  floors = 15,
  cols = 8,
  number,
  fill = PAL.ink3,
  line = 'rgba(255,255,255,0.05)',
  win = PAL.lamp[4],
  litRatio = 0.12,
  seed = 1,
  numberColor = 'rgba(255,255,255,0.14)',
  flickerSome = true,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  floors?: number;
  cols?: number;
  number?: string;
  fill?: string;
  line?: string;
  win?: string;
  litRatio?: number;
  seed?: number;
  numberColor?: string;
  flickerSome?: boolean;
}) {
  const r = rng(seed);
  const top = y - h;
  const fh = h / (floors + 0.6);
  const cw = w / cols;
  let rails = '';
  for (let f = 1; f <= floors; f++) {
    const yy = top + fh * 0.6 + fh * f;
    rails += `M${x + 3} ${yy.toFixed(1)} H${(x + w - 3).toFixed(1)} `;
  }
  const lit: ReactNode[] = [];
  const flick: ReactNode[] = [];
  for (let f = 0; f < floors; f++) {
    for (let c = 0; c < cols; c++) {
      const roll = r();
      if (roll >= litRatio) continue;
      const rect = (
        <rect
          key={`${f}-${c}`}
          x={x + c * cw + cw * 0.18}
          y={top + fh * 0.6 + fh * f + fh * 0.22}
          width={cw * 0.64}
          height={fh * 0.5}
          fill={win}
          opacity={0.55 + r() * 0.4}
        />
      );
      (flickerSome && roll < litRatio * 0.15 ? flick : lit).push(rect);
    }
  }
  return (
    <g>
      <rect x={x} y={top} width={w} height={h} fill={fill} />
      <rect x={x + w * 0.38} y={top - fh * 0.9} width={w * 0.24} height={fh * 0.9} fill={fill} />
      <path d={rails} stroke={line} strokeWidth={1} />
      {lit}
      {flick.length > 0 && <g className="zs-flicker">{flick}</g>}
      {number && (
        <text
          x={x + w - 8}
          y={top + fh * 2.4}
          textAnchor="end"
          fontSize={Math.max(12, fh * 1.6)}
          fontWeight={800}
          fill={numberColor}
          style={{ fontFamily: 'inherit', letterSpacing: '-0.02em' }}
        >
          {number}
        </text>
      )}
    </g>
  );
}

/** 원경 스카이라인 — 결정론적 건물 줄 */
export function Skyline({
  x0 = 0,
  x1 = W,
  base,
  minH,
  maxH,
  seed = 7,
  fill = PAL.ink4,
  win,
  litRatio = 0.05,
  tower,
}: {
  x0?: number;
  x1?: number;
  base: number;
  minH: number;
  maxH: number;
  seed?: number;
  fill?: string;
  win?: string;
  litRatio?: number;
  /** 남산타워 실루엣을 넣을 x 좌표 */
  tower?: number;
}) {
  const r = rng(seed);
  const parts: string[] = [];
  const dots: ReactNode[] = [];
  let x = x0;
  while (x < x1) {
    const bw = 18 + r() * 44;
    const bh = minH + r() * (maxH - minH);
    parts.push(`M${x.toFixed(1)} ${base} V${(base - bh).toFixed(1)} H${(x + bw).toFixed(1)} V${base} Z`);
    if (r() < 0.2) parts.push(`M${(x + bw / 2 - 1).toFixed(1)} ${(base - bh).toFixed(1)} v-${(6 + r() * 10).toFixed(1)} h2 V${(base - bh).toFixed(1)} Z`);
    if (win) {
      for (let yy = base - bh + 5; yy < base - 4; yy += 7) {
        for (let xx = x + 3; xx < x + bw - 3; xx += 6) {
          if (r() < litRatio) dots.push(<rect key={`${xx}-${yy}`} x={xx} y={yy} width={2.4} height={3} fill={win} opacity={0.75} />);
        }
      }
    }
    x += bw + r() * 3;
  }
  if (tower !== undefined) {
    const t = tower;
    parts.push(
      `M${t - 18} ${base} L${t - 6} ${base - 70} H${t + 6} L${t + 18} ${base} Z ` +
        `M${t - 3} ${base - 70} V${base - 118} H${t + 3} V${base - 70} Z ` +
        `M${t - 9} ${base - 104} H${t + 9} V${base - 96} H${t - 9} Z M${t - 0.8} ${base - 118} V${base - 138} H${t + 0.8} V${base - 118} Z`,
    );
  }
  return (
    <g>
      <path d={parts.join(' ')} fill={fill} />
      {dots}
    </g>
  );
}

/** 피어오르는 연기 기둥 (zs-rise 로 천천히 흐른다) */
export function Smoke({
  x,
  y,
  s = 1,
  color = PAL.ink2,
  opacity = 0.85,
  lean = 1,
  animate = true,
}: {
  x: number;
  y: number;
  s?: number;
  color?: string;
  opacity?: number;
  /** 바람 방향: 1 = 오른쪽, -1 = 왼쪽 */
  lean?: number;
  animate?: boolean;
}) {
  const puffs = Array.from({ length: 7 }, (_, i) => ({
    cx: x + (Math.sin(i * 1.7) * 5 + i * i * 1.6 * lean) * s,
    cy: y - i * 26 * s,
    rx: (12 + i * 8) * s,
    ry: (9 + i * 5.5) * s,
    o: opacity * (1 - i * 0.1),
  }));
  return (
    <g className={animate ? 'zs-rise' : undefined}>
      {puffs.map((p, i) => (
        <ellipse key={i} cx={p.cx} cy={p.cy} rx={p.rx} ry={p.ry} fill={color} opacity={p.o} />
      ))}
    </g>
  );
}

/** 불길 — 광원 포함. id 는 씬 안에서 유일해야 한다. */
export function Fire({ id, x, y, s = 1 }: { id: string; x: number; y: number; s?: number }) {
  return (
    <g>
      <Glow id={`${id}-glow`} cx={x} cy={y - 14 * s} r={70 * s} color={PAL.fire[3]} opacity={0.7} className="zs-glow" />
      <g className="zs-flicker">
        <defs>
          <linearGradient id={`${id}-flame`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor={PAL.fire[4]} />
            <stop offset="0.5" stopColor={PAL.fire[3]} />
            <stop offset="1" stopColor={PAL.fire[2]} stopOpacity={0.2} />
          </linearGradient>
        </defs>
        <path
          transform={`translate(${x} ${y}) scale(${s})`}
          d="M-22 0 C-24 -14 -14 -20 -12 -34 C-6 -24 -4 -28 -2 -44 C4 -30 10 -30 9 -20 C14 -26 16 -32 15 -38 C24 -24 26 -12 22 0 Z"
          fill={`url(#${id}-flame)`}
        />
      </g>
    </g>
  );
}

/** 승용차 실루엣. (x, y) 는 왼쪽 바퀴 아래 지면. 길이 ≈94·s */
export function Car({
  x,
  y,
  s = 1,
  flip,
  fill = PAL.ink2,
  taxi,
  lights,
}: {
  x: number;
  y: number;
  s?: number;
  flip?: boolean;
  fill?: string;
  taxi?: boolean;
  /** 헤드라이트 색 */
  lights?: string;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
      <path
        d="M0 -4 L0 -13 C0 -17 4 -19 10 -20 L25 -21 L35 -31 C37 -33 41 -34 45 -34 L64 -34 C68 -34 71 -32 73 -30 L82 -21 L88 -20 C92 -19 94 -16 94 -13 L94 -4 Z"
        fill={fill}
      />
      <circle cx={20} cy={-5} r={8} fill={fill} />
      <circle cx={74} cy={-5} r={8} fill={fill} />
      {taxi && <rect x={46} y={-40} width={14} height={6} rx={1.5} fill={PAL.alert} opacity={0.7} />}
      {lights && <ellipse cx={92} cy={-14} rx={3} ry={2} fill={lights} />}
    </g>
  );
}

/** 가로등 */
export function Lamp({ x, y, h = 150, lit, color = PAL.lamp[4], fill = PAL.ink2 }: { x: number; y: number; h?: number; lit?: boolean; color?: string; fill?: string }) {
  return (
    <g>
      {lit && <polygon points={`${x + 22},${y - h + 6} ${x - 12},${y} ${x + 70},${y}`} fill={color} opacity={0.08} />}
      <rect x={x - 2} y={y - h} width={4} height={h} fill={fill} />
      <path d={`M${x} ${y - h} q14 -8 26 2`} stroke={fill} strokeWidth={4} fill="none" />
      <rect x={x + 16} y={y - h + 1} width={14} height={5} rx={2} fill={lit ? color : fill} />
    </g>
  );
}

/** 가로수 */
export function Tree({ x, y, s = 1, fill = PAL.ink2 }: { x: number; y: number; s?: number; fill?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill={fill}>
      <path d="M-3 0 L-2 -40 L2 -40 L3 0 Z" />
      <circle cx={0} cy={-58} r={20} />
      <circle cx={-15} cy={-48} r={14} />
      <circle cx={15} cy={-47} r={15} />
      <circle cx={-6} cy={-74} r={13} />
      <circle cx={9} cy={-71} r={12} />
    </g>
  );
}
