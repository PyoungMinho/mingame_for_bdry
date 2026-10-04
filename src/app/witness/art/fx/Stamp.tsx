/**
 * 판정 도장 · 등급 도장 — 홀로그램 스탬프(UI 스펙 1-3 · 5-13 · 디자인 §4-2 · §5-15).
 *  VerdictStamp kind
 *    star    「결정적」  골드 이중 링 + 별, −8°, 홀로그램 결 1회 + 파문 링 1회(★ 전용)
 *    minor   「모순 해소」 시안 마름모(작은 도장)
 *    cleared 「다 털었다」 그린 이중 윤곽, −6°
 *  GradeStamp grade
 *    S 골드 이중 링 + 톱니 · A 시안 이중 링 · B 앰버 단일 링 · C 슬레이트 점선 링 (−8°)
 * 모션: play → .is-play(wt-art-stamp: scale 1.7 → 1). 줄이기면 즉시 최종 모양.
 * 색만으로 구분하지 않는다 — 글자(결정적·모순 해소·다 털었다·S/A/B/C)가 항상 함께 있다.
 */
import { C, useSvgIds } from '../palette';

const FONT = { fontFamily: "var(--wt-font-display, 'Black Han Sans'), 'Pretendard Variable', sans-serif" } as const;

export type StampKind = 'star' | 'minor' | 'cleared';
export const STAMP_TEXT: Record<StampKind, string> = { star: '결정적', minor: '모순 해소', cleared: '다 털었다' };

function starPath(cx: number, cy: number, R: number, r: number) {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r : R;
    d += `${i ? 'L' : 'M'}${(cx + Math.cos(a) * rr).toFixed(1)} ${(cy + Math.sin(a) * rr).toFixed(1)}`;
  }
  return `${d}Z`;
}

export function VerdictStamp({
  kind,
  text,
  play = false,
  idScope,
  className,
}: {
  kind: StampKind;
  text?: string;
  play?: boolean;
  idScope?: string;
  className?: string;
}) {
  const ids = useSvgIds(`stamp-${kind}`, idScope);
  const t = text ?? STAMP_TEXT[kind];
  const cls = ['wt-art-fx', 'wt-art-stamp', play ? 'is-play' : '', className ?? ''].filter(Boolean).join(' ');
  if (kind === 'minor') {
    return (
      <svg className={cls} viewBox="0 0 300 300" aria-hidden="true" focusable="false" data-kind={kind} xmlns="http://www.w3.org/2000/svg">
        <g transform="rotate(-8 150 150)">
          <path d="M150 34L266 150L150 266L34 150Z" fill={C.ink} fillOpacity={0.55} stroke={C.cyan} strokeWidth={8} strokeLinejoin="round" />
          <path d="M150 56L244 150L150 244L56 150Z" fill="none" stroke={C.cyan} strokeWidth={3} opacity={0.8} />
          <path d="M150 84l14 14l-14 14l-14 -14z" fill={C.cyan} />
          <text x={150} y={176} textAnchor="middle" fontSize={44} fill={C.cyan} style={FONT}>
            {t}
          </text>
          <circle className="wt-art-ripple" cx={150} cy={150} r={118} fill="none" stroke={C.cyan} strokeWidth={4} />
        </g>
      </svg>
    );
  }
  if (kind === 'cleared') {
    return (
      <svg className={cls} viewBox="0 0 360 200" aria-hidden="true" focusable="false" data-kind={kind} xmlns="http://www.w3.org/2000/svg">
        <g transform="rotate(-6 180 100)">
          <rect x={14} y={24} width={332} height={152} rx={20} fill={C.ink} fillOpacity={0.5} stroke={C.green} strokeWidth={8} />
          <rect x={30} y={40} width={300} height={120} rx={12} fill="none" stroke={C.green} strokeWidth={3} />
          <text x={180} y={122} textAnchor="middle" fontSize={64} fill={C.green} style={FONT}>
            {t}
          </text>
        </g>
      </svg>
    );
  }
  // star — 골드 홀로그램
  return (
    <svg className={cls} viewBox="0 0 300 300" aria-hidden="true" focusable="false" data-kind={kind} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={ids.id('holo')} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#FFE9A8" />
          <stop offset="0.35" stopColor={C.gold} />
          <stop offset="0.55" stopColor="#FFF6D6" />
          <stop offset="0.7" stopColor="#F2C14E" />
          <stop offset="1" stopColor="#FFD9F0" />
        </linearGradient>
        <linearGradient id={ids.id('sweep')} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.75" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
        <clipPath id={ids.id('clip')}>
          <circle cx={150} cy={150} r={132} />
        </clipPath>
      </defs>
      <g transform="rotate(-8 150 150)">
        <circle cx={150} cy={150} r={130} fill={C.ink} fillOpacity={0.55} />
        <circle cx={150} cy={150} r={128} fill="none" stroke={ids.url('holo')} strokeWidth={10} />
        <circle cx={150} cy={150} r={108} fill="none" stroke={ids.url('holo')} strokeWidth={3} />
        <path d={starPath(150, 82, 22, 9)} fill={ids.url('holo')} />
        <path d="M60 196h180" stroke={ids.url('holo')} strokeWidth={3} opacity={0.7} />
        <text x={150} y={176} textAnchor="middle" fontSize={68} fill={ids.url('holo')} style={FONT}>
          {t}
        </text>
        <g clipPath={ids.url('clip')}>
          <rect className="wt-art-holo" x={60} y={0} width={70} height={300} fill={ids.url('sweep')} transform="skewX(-18)" opacity={0.8} />
        </g>
        <circle className="wt-art-ripple" cx={150} cy={150} r={130} fill="none" stroke={C.gold} strokeWidth={5} />
      </g>
    </svg>
  );
}

export type Grade = 'S' | 'A' | 'B' | 'C';

/** 엔딩 등급 도장 — label 은 칭호(선택, 도장 아래 줄) */
export function GradeStamp({
  grade,
  label,
  play = false,
  idScope,
  className,
}: {
  grade: Grade;
  label?: string;
  play?: boolean;
  idScope?: string;
  className?: string;
}) {
  const ids = useSvgIds(`grade-${grade}`, idScope);
  const c = grade === 'S' ? C.gold : grade === 'A' ? C.cyan : grade === 'B' ? C.amber : '#8392B5';
  const cls = ['wt-art-fx', 'wt-art-stamp', play ? 'is-play' : '', className ?? ''].filter(Boolean).join(' ');
  // S 톱니 링
  let teeth = '';
  if (grade === 'S') {
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      const a2 = ((i + 0.5) / 36) * Math.PI * 2;
      teeth += `${i ? 'L' : 'M'}${(150 + Math.cos(a) * 140).toFixed(1)} ${(150 + Math.sin(a) * 140).toFixed(1)}L${(150 + Math.cos(a2) * 128).toFixed(1)} ${(150 + Math.sin(a2) * 128).toFixed(1)}`;
    }
    teeth += 'Z';
  }
  return (
    <svg className={cls} viewBox={label ? '0 0 300 360' : '0 0 300 300'} aria-hidden="true" focusable="false" data-grade={grade} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id={ids.id('fill')} cx="50%" cy="40%" r="60%">
          <stop offset="0" stopColor={c} stopOpacity="0.2" />
          <stop offset="1" stopColor={c} stopOpacity="0.04" />
        </radialGradient>
      </defs>
      <g transform="rotate(-8 150 150)">
        {grade === 'S' && <path d={teeth} fill={c} opacity={0.9} />}
        <circle cx={150} cy={150} r={grade === 'S' ? 124 : 130} fill={C.ink} />
        <circle cx={150} cy={150} r={grade === 'S' ? 124 : 130} fill={ids.url('fill')} stroke={c} strokeWidth={grade === 'C' ? 6 : 9} strokeDasharray={grade === 'C' ? '14 10' : undefined} />
        {(grade === 'S' || grade === 'A') && <circle cx={150} cy={150} r={104} fill="none" stroke={c} strokeWidth={3} />}
        <text x={150} y={204} textAnchor="middle" fontSize={156} fill={c} style={FONT}>
          {grade}
        </text>
        <circle className="wt-art-ripple" cx={150} cy={150} r={132} fill="none" stroke={c} strokeWidth={4} />
      </g>
      {label && (
        <text x={150} y={344} textAnchor="middle" fontSize={Math.min(34, Math.floor(290 / Math.max(1, label.length)))} fontWeight={800} fill={c} style={{ fontFamily: "var(--wt-font-body, 'Pretendard Variable'), sans-serif" }}>
          {label}
        </text>
      )}
    </svg>
  );
}
