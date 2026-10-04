/**
 * 판정 컷인 사선 스트립 — 네온 사선(−8°) + 밝은 윤곽 + 속도선 + 자체 문구(역전재판 고유 문구·말풍선 미사용, UI 스펙 1-3).
 *  press   「다시 말해 봐!」 시안 — 추궁(첫 추궁에만)
 *  present 「증거 나간다!」 앰버 — 제시
 *  star    「앞뒤가 안 맞아!」 골드 — ★ 결정적 돌파
 *  minor   「앞뒤가 안 맞아!」 시안 — ◆ 일반 돌파
 *
 * 모션은 art.css: play 면 .is-play → wt-art-cutin(스윕 인 → 유지 → 아웃). 줄이기면 제자리 페이드(wt-art-cutin-fade).
 * 길이는 CSS 변수 --wt-art-cutin-ms(기본 650ms, ★ 스트립은 600ms 권장)로 VerdictFx 가 맞춘다.
 * 장식(aria-hidden) — 판정 결과 문장은 화면의 role="alert" 가 읽는다.
 */
import { C, rng, r1, useSvgIds } from '../palette';

export type CutInKind = 'press' | 'present' | 'star' | 'minor';

/** 기본 문구 — 사건 데이터 CaseFile.cutIns 와 같은 값(데이터 값을 text 로 넘기면 그쪽이 이긴다) */
export const CUTIN_TEXT: Record<CutInKind, string> = {
  press: '다시 말해 봐!',
  present: '증거 나간다!',
  star: '앞뒤가 안 맞아!',
  minor: '앞뒤가 안 맞아!',
};
const TONE: Record<CutInKind, string> = { press: C.cyan, present: C.amber, star: C.gold, minor: C.cyan };

export function CutInStrip({
  kind,
  text,
  play = false,
  idScope,
  className,
}: {
  kind: CutInKind;
  text?: string;
  /** true 면 스윕 애니메이션 1회 */
  play?: boolean;
  idScope?: string;
  className?: string;
}) {
  const ids = useSvgIds(`cut-${kind}`, idScope);
  const c = TONE[kind];
  const rnd = rng(kind.length * 31 + 7);
  let speed = '';
  for (let i = 0; i < 14; i++) {
    const y = 84 + rnd() * 92;
    const x = -80 + rnd() * 1200;
    speed += `M${r1(x)} ${r1(y)}h${r1(60 + rnd() * 220)}`;
  }
  const t = text ?? CUTIN_TEXT[kind];
  const big = kind === 'star';
  const cls = ['wt-art-fx', 'wt-art-cutin', play ? 'is-play' : '', className ?? ''].filter(Boolean).join(' ');
  return (
    <svg className={cls} viewBox="0 -50 1200 360" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false" data-kind={kind} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={ids.id('strip')} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor={c} stopOpacity="0.96" />
          <stop offset="0.62" stopColor={c} stopOpacity="0.82" />
          <stop offset="1" stopColor={c} stopOpacity="0" />
        </linearGradient>
        <linearGradient id={ids.id('shade')} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.28" />
          <stop offset="0.45" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.25" />
        </linearGradient>
      </defs>
      <g transform="rotate(-8 600 130)">
        <rect x={-120} y={64} width={1440} height={132} fill={C.ink} opacity={0.55} />
        <rect x={-120} y={72} width={1440} height={116} fill={ids.url('strip')} />
        <rect x={-120} y={72} width={1440} height={116} fill={ids.url('shade')} />
        <path d={speed} stroke="#FFFFFF" strokeWidth={3} opacity={0.35} strokeLinecap="round" />
        <path d="M-120 72H1320M-120 188H1320" stroke="#FFFFFF" strokeWidth={3} opacity={0.9} />
        <path d="M-120 64H1100M-120 196H1000" stroke={c} strokeWidth={2} opacity={0.6} />
        {big && (
          <g fill="#FFFFFF">
            <path d="M120 130l9 -26l9 26l26 9l-26 9l-9 26l-9 -26l-26 -9z" opacity={0.95} />
            <path d="M1074 130l7 -20l7 20l20 7l-20 7l-7 20l-7 -20l-20 -7z" opacity={0.8} />
          </g>
        )}
        <g
          style={{ fontFamily: "var(--wt-font-display, 'Black Han Sans'), 'Pretendard Variable', sans-serif" }}
          fontSize={big ? 92 : 84}
          textAnchor="middle"
          letterSpacing="2"
        >
          <text x={600} y={big ? 162 : 160} fill="none" stroke={c} strokeWidth={22} strokeOpacity={0.35} strokeLinejoin="round">
            {t}
          </text>
          <text x={600} y={big ? 162 : 160} fill="#FFFFFF" stroke={C.ink} strokeWidth={7} strokeLinejoin="round" paintOrder="stroke">
            {t}
          </text>
        </g>
      </g>
    </svg>
  );
}
