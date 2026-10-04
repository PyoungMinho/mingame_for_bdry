/**
 * 장소 그림 공용 부품 — 「물비늘타워 41층, 비 오는 밤」 플랫 벡터.
 *
 *  - 모든 장소는 viewBox 0 0 1500 1000(3:2) 한 장. 핫스팟 좌표(%)는 사건 데이터와 같고, 그 중심에 물건을 그린다.
 *  - 순수 장식(aria-hidden). 의미는 핫스팟 레일·대사창이 전한다.
 *  - 그림 금지(UI 스펙 7-1): 시신·혈흔·상처, 읽히는 글자(줄무늬로만), 실존 로고(가상 「도진」 마크만).
 *  - 스마트홈 모티프는 모든 방에서 같은 모양: 벽걸이 허브 태블릿 · 천장 코브 LED · 기기 상태 LED 점.
 *  - filter 미사용(방사형 그라디언트로 빛 처리). 비 루프는 art.css 의 .wt-art-rain(줄이기·숨김에서 정지).
 */
import type { ReactNode } from 'react';
import { C, rng, r1, type SvgIds } from '../palette';

export const W = 1500;
export const H = 1000;

/** 그림 한 장의 틀 */
export function SceneSvg({
  children,
  art,
  className,
  fit = 'slice',
}: {
  children: ReactNode;
  art: string;
  className?: string;
  /** 컨테이너가 정확히 3:2면 어느 쪽이든 같다. 기본 slice(여백 없음) */
  fit?: 'slice' | 'meet';
}) {
  return (
    <svg
      className={className ? `wt-art-scene ${className}` : 'wt-art-scene'}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio={`xMidYMid ${fit}`}
      aria-hidden="true"
      focusable="false"
      data-art={art}
      xmlns="http://www.w3.org/2000/svg"
    >
      {children}
    </svg>
  );
}

/** 빛 그라디언트 묶음 — glow-{amber|cyan|violet|white|green|pink|red} · vig(비네트) · cove */
export function SceneDefs({ ids, children }: { ids: SvgIds; children?: ReactNode }) {
  const glow = (n: string, c: string) => (
    <radialGradient id={ids.id(`glow-${n}`)} cx="50%" cy="50%" r="50%">
      <stop offset="0" stopColor={c} stopOpacity="0.9" />
      <stop offset="0.35" stopColor={c} stopOpacity="0.35" />
      <stop offset="1" stopColor={c} stopOpacity="0" />
    </radialGradient>
  );
  return (
    <defs>
      {glow('amber', C.amber)}
      {glow('cyan', C.cyan)}
      {glow('violet', C.violet)}
      {glow('white', '#EAF4FF')}
      {glow('green', C.green)}
      {glow('pink', C.pink)}
      {glow('red', C.red)}
      <radialGradient id={ids.id('vig')} cx="50%" cy="46%" r="72%">
        <stop offset="0.55" stopColor={C.ink} stopOpacity="0" />
        <stop offset="1" stopColor={C.ink} stopOpacity="0.82" />
      </radialGradient>
      <linearGradient id={ids.id('cove')} x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor={C.cyan} />
        <stop offset="0.55" stopColor="#6E8BFF" />
        <stop offset="1" stopColor={C.violet} />
      </linearGradient>
      <linearGradient id={ids.id('coveFall')} x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#5FA8FF" stopOpacity="0.30" />
        <stop offset="1" stopColor="#5FA8FF" stopOpacity="0" />
      </linearGradient>
      <linearGradient id={ids.id('sheen')} x1="0" x2="1" y1="0" y2="1">
        <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.10" />
        <stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0" />
        <stop offset="1" stopColor="#FFFFFF" stopOpacity="0.05" />
      </linearGradient>
      {children}
    </defs>
  );
}

/** 빛 웅덩이(방사형) */
export function Glow({
  ids,
  tone,
  cx,
  cy,
  rx,
  ry,
  o = 0.5,
}: {
  ids: SvgIds;
  tone: 'amber' | 'cyan' | 'violet' | 'white' | 'green' | 'pink' | 'red';
  cx: number;
  cy: number;
  rx: number;
  ry?: number;
  o?: number;
}) {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry ?? rx} fill={ids.url(`glow-${tone}`)} opacity={o} />;
}

/** 가장자리 어둠 */
export function Vignette({ ids }: { ids: SvgIds }) {
  return <rect width={W} height={H} fill={ids.url('vig')} />;
}

/** 천장 코브 LED 스트립(시안 ↔ 보라, 어둡게) */
export function CoveLed({ ids, x, y, w }: { ids: SvgIds; x: number; y: number; w: number }) {
  return (
    <g>
      <rect x={x} y={y + 6} width={w} height={90} fill={ids.url('coveFall')} />
      <rect x={x} y={y} width={w} height={6} rx={3} fill={ids.url('cove')} opacity={0.75} />
    </g>
  );
}

/** 기기 상태 LED 점(작은 광원) */
export function LedDot({ ids, x, y, tone = 'cyan', r = 5, blink }: { ids: SvgIds; x: number; y: number; tone?: 'cyan' | 'amber' | 'green' | 'red' | 'violet'; r?: number; blink?: boolean }) {
  const c = { cyan: C.cyan, amber: C.amber, green: C.green, red: C.red, violet: C.violet }[tone];
  return (
    <g className={blink ? 'wt-art-blink' : undefined}>
      <circle cx={x} cy={y} r={r * 4} fill={ids.url(`glow-${tone}`)} opacity={0.55} />
      <circle cx={x} cy={y} r={r} fill={c} />
    </g>
  );
}

/** 가상 「도진」 마크 — 원 + 점(실존 로고 아님) */
export function DojinMark({ x, y, s = 10, c = C.steel2 }: { x: number; y: number; s?: number; c?: string }) {
  return (
    <g opacity={0.8}>
      <circle cx={x} cy={y} r={s} fill="none" stroke={c} strokeWidth={s * 0.22} />
      <circle cx={x + s * 0.32} cy={y - s * 0.1} r={s * 0.28} fill={c} />
    </g>
  );
}

/** 벽걸이 홈 허브 태블릿 — 모든 방 공통 모양 */
export function HubTablet({ ids, x, y, w, h, lit = true }: { ids: SvgIds; x: number; y: number; w: number; h: number; lit?: boolean }) {
  const pad = Math.max(8, w * 0.06);
  const sx = x + pad;
  const sy = y + pad;
  const sw = w - pad * 2;
  const sh = h - pad * 2;
  const tw = (sw - 30) / 3;
  const th = (sh - 40) / 2;
  return (
    <g>
      {lit && <Glow ids={ids} tone="cyan" cx={x + w / 2} cy={y + h / 2} rx={w * 1.1} ry={h * 1.1} o={0.35} />}
      <rect x={x} y={y} width={w} height={h} rx={w * 0.07} fill={C.graphite0} />
      <rect x={x + 2} y={y + 2} width={w - 4} height={h - 4} rx={w * 0.06} fill="none" stroke={C.graphite3} strokeWidth={2} opacity={0.6} />
      <rect x={sx} y={sy} width={sw} height={sh} rx={6} fill={lit ? '#0C2234' : '#0A1222'} />
      {lit && (
        <g>
          <rect x={sx + 10} y={sy + 8} width={sw * 0.38} height={7} rx={3.5} fill={C.cyan} opacity={0.75} />
          {[0, 1, 2].map((i) =>
            [0, 1].map((j) => (
              <rect
                key={`${i}${j}`}
                x={sx + 8 + i * (tw + 7)}
                y={sy + 24 + j * (th + 8)}
                width={tw}
                height={th}
                rx={5}
                fill={i === 1 && j === 0 ? C.cyan : '#17405A'}
                opacity={i === 1 && j === 0 ? 0.55 : 0.9}
              />
            )),
          )}
          <rect x={sx} y={sy} width={sw} height={sh} rx={6} fill={ids.url('sheen')} />
        </g>
      )}
      <circle cx={x + w / 2} cy={y + h - pad / 2} r={2.2} fill={C.cyan} opacity={0.8} />
    </g>
  );
}

/** 글자처럼 보이는 줄무늬(읽히는 글자 금지) */
export function Bars({
  x,
  y,
  w,
  rows,
  gap = 12,
  th = 5,
  c = '#9AA6C0',
  o = 0.8,
  seed = 1,
}: {
  x: number;
  y: number;
  w: number;
  rows: number;
  gap?: number;
  th?: number;
  c?: string;
  o?: number;
  seed?: number;
}) {
  const rnd = rng(seed);
  let d = '';
  for (let i = 0; i < rows; i++) {
    let cx = x;
    const yy = y + i * gap;
    const end = x + w * (i === rows - 1 ? 0.45 + rnd() * 0.3 : 0.82 + rnd() * 0.18);
    while (cx < end - 6) {
      const seg = Math.min(end - cx, 10 + rnd() * w * 0.28);
      d += `M${r1(cx)} ${r1(yy)}h${r1(seg)}`;
      cx += seg + th + 2;
    }
  }
  return <path d={d} stroke={c} strokeWidth={th} strokeLinecap="round" opacity={o} fill="none" />;
}

/**
 * 창에 내리는 비 — 200px 타일을 세로로 이어 붙이고 타일 높이만큼 흘러내린다(.wt-art-rain).
 * clip 은 창 사각형. 줄이기·숨김 탭에서는 art.css 가 정지시킨다(정적 질감).
 */
export function RainOnGlass({
  ids,
  name,
  x,
  y,
  w,
  h,
  n = 26,
  seed = 7,
  o = 0.55,
  slant = -0.18,
  rain = true,
  drops = true,
}: {
  ids: SvgIds;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  n?: number;
  seed?: number;
  o?: number;
  slant?: number;
  rain?: boolean;
  /** 유리에 맺힌 물방울(실외 전체 비에서는 끈다) */
  drops?: boolean;
}) {
  const rnd = rng(seed);
  const T = 200;
  let d = '';
  for (let i = 0; i < n; i++) {
    const sx = rnd() * (w + 60);
    const sy = rnd() * T;
    const len = 18 + rnd() * 34;
    d += `M${r1(sx)} ${r1(sy)}l${r1(slant * len)} ${r1(len)}`;
  }
  const rows = Math.ceil(h / T) + 1;
  const dr = rng(seed + 99);
  let dd = '';
  const nd = drops ? Math.round((w * h) / 9000) : 0;
  for (let i = 0; i < nd; i++) {
    const dx = x + dr() * w;
    const dy = y + dr() * h;
    const rr = 1.6 + dr() * 3.2;
    dd += `M${r1(dx - rr)} ${r1(dy)}a${r1(rr)} ${r1(rr * 1.25)} 0 1 0 ${r1(rr * 2)} 0a${r1(rr)} ${r1(rr * 1.25)} 0 1 0 ${r1(-rr * 2)} 0`;
  }
  return (
    <g>
      <defs>
        <clipPath id={ids.id(`clip-${name}`)}>
          <rect x={x} y={y} width={w} height={h} />
        </clipPath>
        <path id={ids.id(`rain-${name}`)} d={d} />
      </defs>
      <g clipPath={ids.url(`clip-${name}`)}>
        <g className={rain ? 'wt-art-rain' : undefined} stroke="#CFE6FF" strokeWidth={1.6} strokeLinecap="round" opacity={o}>
          {Array.from({ length: rows + 1 }, (_, k) => (
            <use key={k} href={ids.href(`rain-${name}`)} x={x - 30} y={y + (k - 1) * T} />
          ))}
        </g>
        {dd && <path d={dd} fill="#DDF1FF" opacity={0.22} />}
      </g>
    </g>
  );
}

/**
 * 비 내리는 한강 야경 — 스카이라인 실루엣 · 불 켜진 창 · 다리 불빛 · 강물 반사 점선 · 번진 보케.
 * (x, y, w, h) 안을 채운다. 하늘은 위가 어둡다.
 */
export function CityNight({
  ids,
  x,
  y,
  w,
  h,
  seed = 3,
  river = 0.62,
  bridge = true,
  dim = false,
}: {
  ids: SvgIds;
  x: number;
  y: number;
  w: number;
  h: number;
  seed?: number;
  /** 강 수면 높이(0~1) */
  river?: number;
  bridge?: boolean;
  /** 불 꺼진 강변(옥상) */
  dim?: boolean;
}) {
  const rnd = rng(seed);
  const ry = y + h * river;
  // 스카이라인 — 먼 줄 / 가까운 줄
  let far = `M${x} ${ry}`;
  let near = `M${x} ${ry}`;
  let wins = '';
  for (let cx = x; cx < x + w; ) {
    const bw = 26 + rnd() * 52;
    const bh = h * (0.12 + rnd() * 0.28);
    far += `V${r1(ry - bh)}H${r1(cx + bw)}`;
    cx += bw;
  }
  far += `V${ry}Z`;
  for (let cx = x; cx < x + w; ) {
    const bw = 40 + rnd() * 70;
    const bh = h * (0.06 + rnd() * 0.2);
    near += `V${r1(ry - bh)}H${r1(cx + bw)}`;
    if (!dim) {
      for (let k = 0; k < 4; k++) {
        if (rnd() < 0.55) wins += `M${r1(cx + 6 + rnd() * (bw - 14))} ${r1(ry - bh + 8 + rnd() * (bh - 14))}h4v3h-4z`;
      }
    }
    cx += bw;
  }
  near += `V${ry}Z`;
  const bokeh: { cx: number; cy: number; r: number; t: 'cyan' | 'amber' | 'pink' }[] = [];
  const nb = dim ? 5 : 14;
  for (let i = 0; i < nb; i++) {
    const t = (['cyan', 'amber', 'pink', 'amber'] as const)[Math.floor(rnd() * 4)];
    bokeh.push({ cx: x + rnd() * w, cy: y + h * (0.35 + rnd() * 0.5), r: 14 + rnd() * 30, t });
  }
  let refl = '';
  for (let i = 0; i < (dim ? 10 : 34); i++) {
    const rx = x + rnd() * w;
    const yy = ry + 10 + rnd() * (y + h - ry - 14);
    refl += `M${r1(rx)} ${r1(yy)}h${r1(8 + rnd() * 26)}`;
  }
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={ids.url('sky')} />
      <path d={far} fill="#16244A" opacity={0.95} />
      <path d={near} fill="#0E1934" />
      {!dim && <path d={wins} fill={C.amber} opacity={0.75} />}
      <rect x={x} y={ry} width={w} height={y + h - ry} fill="#0A1530" />
      {bridge && (
        <g>
          <path d={`M${x} ${ry - 6}Q${x + w / 2} ${ry - h * 0.16} ${x + w} ${ry - 6}`} fill="none" stroke="#2A3C66" strokeWidth={5} />
          <path d={`M${x} ${ry - 2}H${x + w}`} stroke="#22335C" strokeWidth={6} />
          {Array.from({ length: 13 }, (_, i) => {
            const t = (i + 0.5) / 13;
            const bx = x + w * t;
            const by = ry - 2 - 4 * h * 0.16 * t * (1 - t) - 2;
            return <circle key={i} cx={r1(bx)} cy={r1(by)} r={3} fill={dim ? '#5D6C8C' : i % 2 ? C.amber : '#FFE7B0'} />;
          })}
        </g>
      )}
      <path d={refl} stroke={dim ? '#3A4A6E' : C.amber} strokeWidth={3} strokeLinecap="round" opacity={dim ? 0.5 : 0.5} />
      {bokeh.map((b, i) => (
        <circle key={i} cx={r1(b.cx)} cy={r1(b.cy)} r={r1(b.r)} fill={ids.url(`glow-${b.t}`)} opacity={dim ? 0.18 : 0.42} />
      ))}
    </g>
  );
}

/** 하늘 그라디언트(CityNight 가 ids.url('sky') 로 참조) */
export function SkyGradient({ ids, top = C.night0, bottom = C.night2 }: { ids: SvgIds; top?: string; bottom?: string }) {
  return (
    <linearGradient id={ids.id('sky')} x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stopColor={top} />
      <stop offset="1" stopColor={bottom} />
    </linearGradient>
  );
}

/** 원근 바닥 판자(소실점 vx, vy 로 모이는 판자 줄 + 엇갈린 짧은 이음매) */
export function FloorPlanks({
  y0,
  vx = 750,
  vy = 260,
  n = 16,
  c = C.walnut0,
  o = 0.6,
  seed = 2,
  hi,
}: {
  y0: number;
  vx?: number;
  vy?: number;
  n?: number;
  c?: string;
  o?: number;
  seed?: number;
  /** 판자 결 하이라이트 색(없으면 생략) */
  hi?: string;
}) {
  const rnd = rng(seed);
  const t0 = (y0 - vy) / (H - vy);
  const xs: number[] = [];
  for (let i = -n; i <= n * 2; i++) xs.push((i / n) * W);
  let d = '';
  let j = '';
  let g = '';
  const at = (xb: number, y: number) => vx + (xb - vx) * ((y - vy) / (H - vy));
  for (let i = 0; i < xs.length; i++) {
    const xb = xs[i];
    const xt = vx + (xb - vx) * t0;
    if (Math.max(xt, xb) < -60 || Math.min(xt, xb) > W + 60) continue;
    d += `M${r1(xt)} ${y0}L${r1(xb)} ${H}`;
    if (i + 1 < xs.length) {
      // 이 판자 줄 안의 이음매 2~3개(위로 갈수록 촘촘)
      const k = 2 + Math.floor(rnd() * 2);
      for (let m = 0; m < k; m++) {
        const y = y0 + (H - y0) * Math.pow((m + rnd() * 0.8 + 0.2) / (k + 0.2), 1.5);
        j += `M${r1(at(xb, y))} ${r1(y)}L${r1(at(xs[i + 1], y))} ${r1(y)}`;
      }
      if (hi && rnd() < 0.45) {
        const ya = y0 + (H - y0) * rnd() * 0.7;
        const yb = Math.min(H, ya + 40 + rnd() * 120);
        const f = 0.3 + rnd() * 0.4;
        const xa = xb + (xs[i + 1] - xb) * f;
        g += `M${r1(at(xa, ya))} ${r1(ya)}L${r1(at(xa, yb))} ${r1(yb)}`;
      }
    }
  }
  return (
    <g stroke={c} opacity={o} fill="none">
      {g && <path d={g} stroke={hi} strokeWidth={2} opacity={0.35} />}
      <path d={d} strokeWidth={2} />
      <path d={j} strokeWidth={2} opacity={0.8} />
    </g>
  );
}
