/**
 * 초상 공용 부품 — 플랫 벡터, 외곽선 없음, 면 2톤(기본 + 그림자) + 하이라이트 1 (UI 스펙 6-1).
 *
 *  - viewBox 0 0 600 800 상반신. 머리 중심 (300, 268), 눈 라인 y≈258, 눈 x 262 / 338.
 *  - 조명은 모두 같다: 왼쪽 따뜻한 키라이트(그림자는 오른쪽), 오른쪽 시안 림라이트(실루엣을 6px 옮겨 깐 띠).
 *  - 화자 색은 역광 타원에만 쓴다. 용의자 4명은 같은 채도·같은 구도(메타 추리 방지).
 *  - 표정 그룹은 전부 SVG 안에 상주하고 display 만 바꾼다(재마운트 없음).
 *  - 엔진 import 없음(Face 타입만).
 */
import type { ReactNode } from 'react';
import type { Face } from '@/lib/witness/types';
import { BLUSH, FEAT, RIM, SWEAT, type SvgIds } from '../palette';

/** 그림 표정 — 엔진 Face + 비웃음(오답 리액션·최종 판정 틀린 칸) */
export type ArtFace = Face | 'smirk';

/** 화면이 쓰는 초상 props(모든 인물 공통) */
export interface PortraitProps {
  /** 기본 'normal'. 'smirk' 은 비웃음 오버레이(평소 포즈) */
  face?: ArtFace;
  /** face 가 normal/angry 일 때 비웃음을 덧씌움(오답 리액션) */
  smirk?: boolean;
  /** 'full' = 상반신 600×800, 'head' = 원형 아바타용 머리 크롭(150 100 300 300) */
  crop?: 'full' | 'head';
  /** 화자 색 역광 타원(무대가 따로 그리면 false) */
  backlight?: boolean;
  /** 호흡 루프(장식, 줄이기에서 정지) */
  idle?: boolean;
  /** 대체 텍스트. 없으면 인물 이름. decorative 면 aria-hidden */
  title?: string;
  decorative?: boolean;
  idScope?: string;
  className?: string;
}

/** 표정 → 포즈·이목구비·효과 */
export interface Look {
  pose: 'normal' | 'sweat' | 'break';
  feat: 'normal' | 'sweat' | 'shock' | 'angry' | 'break' | 'smirk';
  spark: boolean;
  vein: boolean;
}
export function lookOf(face: ArtFace = 'normal', smirk = false): Look {
  switch (face) {
    case 'sweat':
      return { pose: 'sweat', feat: 'sweat', spark: false, vein: false };
    case 'shock':
      return { pose: 'sweat', feat: 'shock', spark: true, vein: false };
    case 'angry':
      return smirk ? { pose: 'normal', feat: 'smirk', spark: false, vein: true } : { pose: 'normal', feat: 'angry', spark: false, vein: true };
    case 'break':
      return { pose: 'break', feat: 'break', spark: false, vein: false };
    case 'smirk':
      return { pose: 'normal', feat: 'smirk', spark: false, vein: false };
    default:
      return { pose: 'normal', feat: smirk ? 'smirk' : 'normal', spark: false, vein: false };
  }
}
/** 상주 그룹의 display 값 */
export const show = (on: boolean) => (on ? 'inline' : 'none');

/** 초상 틀 */
export function PortraitSvg({
  name,
  face,
  crop = 'full',
  idle = true,
  title,
  decorative,
  className,
  children,
  headBox = '150 100 300 300',
}: {
  name: string;
  face: ArtFace;
  crop?: 'full' | 'head';
  /** crop='head' 일 때 viewBox(인물마다 머리 위치가 다르면 바꾼다) */
  headBox?: string;
  idle?: boolean;
  title?: string;
  decorative?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const vb = crop === 'head' ? headBox : '0 0 600 800';
  const a11y = decorative ? { 'aria-hidden': true as const } : { role: 'img', 'aria-label': title ?? name };
  return (
    <svg
      className={className ? `wt-art-portrait ${className}` : 'wt-art-portrait'}
      viewBox={vb}
      preserveAspectRatio="xMidYMid meet"
      focusable="false"
      data-face={face}
      data-idle={idle ? 'on' : 'off'}
      data-crop={crop}
      xmlns="http://www.w3.org/2000/svg"
      {...a11y}
    >
      {children}
    </svg>
  );
}

/** 역광 타원(화자 색 18%) + 키라이트 웜 그라디언트 정의 */
export function PortraitDefs({ ids, spk }: { ids: SvgIds; spk: string }) {
  return (
    <defs>
      <radialGradient id={ids.id('back')} cx="50%" cy="45%" r="50%">
        <stop offset="0" stopColor={spk} stopOpacity="0.30" />
        <stop offset="0.55" stopColor={spk} stopOpacity="0.12" />
        <stop offset="1" stopColor={spk} stopOpacity="0" />
      </radialGradient>
      <linearGradient id={ids.id('key')} x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="#FFB84A" stopOpacity="0.16" />
        <stop offset="0.45" stopColor="#FFB84A" stopOpacity="0" />
      </linearGradient>
    </defs>
  );
}
export function Backlight({ ids, on }: { ids: SvgIds; on: boolean }) {
  if (!on) return null;
  return <ellipse cx={300} cy={420} rx={300} ry={400} fill={ids.url('back')} />;
}

/** 림라이트 — 실루엣 경로들을 오른쪽으로 6px 옮겨 시안으로 깐다(본체가 위를 덮어 오른쪽 가장자리만 남음) */
export function Rim({ paths, dx = 6 }: { paths: string[]; dx?: number }) {
  return (
    <g fill={RIM} opacity={0.55} transform={`translate(${dx} 0)`}>
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </g>
  );
}

/* ───────────── 이목구비 ───────────── */
const EL = 262;
const ER = 338;
const EY = 258;

type EyeKind = 'dot' | 'arc' | 'closed' | 'half' | 'side' | 'wide' | 'flat' | 'tear' | 'big' | 'shake';
/** 눈 한 쌍. dy 로 위아래, gap 으로 간격 조절 */
export function Eyes({ kind, dy = 0, gap = 0, c = FEAT, sparkle }: { kind: EyeKind; dy?: number; gap?: number; c?: string; sparkle?: boolean }) {
  const xs = [EL - gap, ER + gap];
  const y = EY + dy;
  return (
    <g className={kind === 'shake' ? 'wt-art-eyeshake' : undefined}>
      {xs.map((x, i) => {
        switch (kind) {
          case 'arc':
            return <path key={i} d={`M${x - 14} ${y + 4}q14 -16 28 0`} stroke={c} strokeWidth={5} fill="none" strokeLinecap="round" />;
          case 'closed':
            return <path key={i} d={`M${x - 14} ${y}q14 9 28 0`} stroke={c} strokeWidth={5} fill="none" strokeLinecap="round" />;
          case 'flat':
            return <path key={i} d={`M${x - 15} ${y}h30`} stroke={c} strokeWidth={5} strokeLinecap="round" />;
          case 'half':
            return (
              <g key={i}>
                <path d={`M${x - 14} ${y - 2}h28`} stroke={c} strokeWidth={5} strokeLinecap="round" />
                <path d={`M${x - 9} ${y - 1}a9 7 0 0 0 18 0z`} fill={c} />
              </g>
            );
          case 'side':
            return (
              <g key={i}>
                <ellipse cx={x} cy={y} rx={10} ry={12} fill="#FFFFFF" />
                <ellipse cx={x + 5} cy={y + 1} rx={6} ry={8} fill={c} />
              </g>
            );
          case 'wide':
            return (
              <g key={i}>
                <ellipse cx={x} cy={y - 2} rx={15} ry={17} fill="#FFFFFF" />
                <circle cx={x} cy={y - 1} r={4.5} fill={c} />
                <path d={`M${x - 15} ${y - 22}q15 -8 30 0`} stroke={c} strokeWidth={4} fill="none" strokeLinecap="round" />
              </g>
            );
          case 'tear':
            return (
              <g key={i}>
                <path d={`M${x - 14} ${y - 4}q14 10 28 0`} stroke={c} strokeWidth={5} fill="none" strokeLinecap="round" />
                <path d={`M${x + (i ? -6 : 6)} ${y + 4}v16`} stroke={SWEAT} strokeWidth={5} strokeLinecap="round" />
              </g>
            );
          case 'big':
          case 'shake':
            return (
              <g key={i}>
                <ellipse cx={x} cy={y} rx={10} ry={14} fill={c} />
                <circle cx={x - 3} cy={y - 5} r={4} fill="#FFFFFF" />
                {sparkle && <circle cx={x + 4} cy={y + 4} r={2} fill="#FFFFFF" />}
              </g>
            );
          default:
            return <ellipse key={i} cx={x} cy={y} rx={7} ry={9} fill={c} />;
        }
      })}
    </g>
  );
}

type BrowKind = 'flat' | 'worry' | 'angry' | 'raise' | 'soft' | 'oneup';
/** 눈썹 한 쌍 */
export function Brows({ kind, dy = 0, c = FEAT, w = 6, gap = 0 }: { kind: BrowKind; dy?: number; c?: string; w?: number; gap?: number }) {
  const y = EY - 32 + dy;
  const l = EL - gap;
  const r = ER + gap;
  let d = '';
  switch (kind) {
    case 'worry':
      d = `M${l - 18} ${y + 2}L${l + 14} ${y - 8}M${r + 18} ${y + 2}L${r - 14} ${y - 8}`;
      break;
    case 'angry':
      d = `M${l - 18} ${y - 8}L${l + 16} ${y + 6}M${r + 18} ${y - 8}L${r - 16} ${y + 6}`;
      break;
    case 'raise':
      d = `M${l - 18} ${y - 4}q16 -14 32 -4M${r - 14} ${y - 8}q16 -10 32 4`;
      break;
    case 'soft':
      d = `M${l - 16} ${y}q16 -8 30 -2M${r - 14} ${y - 2}q14 -6 30 2`;
      break;
    case 'oneup':
      d = `M${l - 18} ${y}h32M${r - 14} ${y - 6}q16 -12 32 0`;
      break;
    default:
      d = `M${l - 18} ${y}h32M${r - 14} ${y}h32`;
  }
  return <path d={d} stroke={c} strokeWidth={w} fill="none" strokeLinecap="round" />;
}

type MouthKind = 'smile' | 'grin' | 'smirk' | 'line' | 'wave' | 'o' | 'down' | 'tremble' | 'polite' | 'open';
/** 입. (300, 320) 중심 */
export function Mouth({ kind, dy = 0, dx = 0, c = FEAT }: { kind: MouthKind; dy?: number; dx?: number; c?: string }) {
  const x = 300 + dx;
  const y = 320 + dy;
  switch (kind) {
    case 'smile':
      return <path d={`M${x - 18} ${y - 2}q18 14 36 0`} stroke={c} strokeWidth={5} fill="none" strokeLinecap="round" />;
    case 'polite':
      return <path d={`M${x - 14} ${y}q14 8 28 0`} stroke={c} strokeWidth={4.5} fill="none" strokeLinecap="round" />;
    case 'grin':
      return (
        <g>
          <path d={`M${x - 26} ${y - 6}q26 34 52 0z`} fill="#7A2E2E" />
          <path d={`M${x - 22} ${y - 4}h44l-4 6h-36z`} fill="#FFFFFF" />
        </g>
      );
    case 'smirk':
      return <path d={`M${x - 16} ${y + 2}q14 4 24 -2q6 -4 10 -10`} stroke={c} strokeWidth={5} fill="none" strokeLinecap="round" />;
    case 'line':
      return <path d={`M${x - 16} ${y}h32`} stroke={c} strokeWidth={5} strokeLinecap="round" />;
    case 'wave':
      return <path d={`M${x - 20} ${y}q5 -6 10 0t10 0t10 0t10 0`} stroke={c} strokeWidth={4.5} fill="none" strokeLinecap="round" />;
    case 'o':
      return <ellipse cx={x} cy={y + 2} rx={9} ry={12} fill="#6E2A2A" />;
    case 'open':
      return <path d={`M${x - 14} ${y - 4}q14 22 28 0z`} fill="#6E2A2A" />;
    case 'down':
      return <path d={`M${x - 16} ${y + 4}q16 -10 32 0`} stroke={c} strokeWidth={5} fill="none" strokeLinecap="round" />;
    case 'tremble':
      return <path d={`M${x - 14} ${y}q10 6 20 2l4 -4l3 3l4 -5`} stroke={c} strokeWidth={4.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />;
    default:
      return null;
  }
}

/** 땀방울(하이라이트 포함) */
export function Sweat({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M0 -18q-12 16 -12 24a12 12 0 0 0 24 0q0 -8 -12 -24z" fill={SWEAT} />
      <path d="M-5 4a5 7 0 0 0 4 8" stroke="#FFFFFF" strokeWidth={2.5} fill="none" strokeLinecap="round" />
    </g>
  );
}

/** 볼 홍조 */
export function Blush({ o = 0.35, dy = 0, r = 16 }: { o?: number; dy?: number; r?: number }) {
  return (
    <g fill={BLUSH} opacity={o}>
      <ellipse cx={248} cy={292 + dy} rx={r} ry={r * 0.6} />
      <ellipse cx={352} cy={292 + dy} rx={r} ry={r * 0.6} />
    </g>
  );
}

/** shock 스파크 3줄(머리 오른쪽 위) */
export function Sparks({ on, x = 404, y = 176 }: { on: boolean; x?: number; y?: number }) {
  return (
    <g display={show(on)} className="wt-art-spark" stroke="#FFFFFF" strokeWidth={6} strokeLinecap="round">
      <path d={`M${x} ${y}l26 -22`} />
      <path d={`M${x + 12} ${y + 22}l34 -4`} />
      <path d={`M${x - 14} ${y - 12}l6 -32`} />
    </g>
  );
}

/** angry 이마 핏줄 3줄(장르 기호, 핏자국 아님) */
export function Vein({ on, x = 352, y = 206 }: { on: boolean; x?: number; y?: number }) {
  return (
    <g display={show(on)} stroke="#E0464C" strokeWidth={5} strokeLinecap="round" fill="none">
      <path d={`M${x - 10} ${y - 4}q6 6 0 12`} />
      <path d={`M${x + 10} ${y - 4}q-6 6 0 12`} />
      <path d={`M${x - 6} ${y - 12}q6 4 12 0`} />
      <path d={`M${x - 6} ${y + 12}q6 -4 12 0`} />
    </g>
  );
}

/** 표준 얼굴 그림자(오른쪽) — 머리 경로와 같은 모양을 오른쪽 절반만 */
export function FaceShade({ d, c }: { d: string; c: string }) {
  return <path d={d} fill={c} />;
}
