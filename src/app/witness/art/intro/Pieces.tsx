/**
 * 사건 소개 · 프로필 보조 그림(4:3, 800×600).
 *  StairArt     컷2 — 계단참 어둠 + 나(탐정 실루엣, 뒷모습). 비상구 표지 등 실존 표식은 그리지 않는다.
 *  AdFrameArt   컷4 — TV 광고 화면 틀 + 피해자 실루엣(얼굴 없음) + 네온 문구(광고 유행어, 공개 정보)
 *  VictimFrame  피해자 프로필 — 액자 속 실루엣 + 모서리 검은 리본(정사각)
 * 시신·사망 묘사 없음.
 */
import { C, useSvgIds } from '../palette';
import { SpeakerBody, SpeakerDefs } from '../speaker';
import { Glow, SceneDefs } from '../scenes/parts';

type ArtProps = { idScope?: string; className?: string; fit?: 'slice' | 'meet' };
const cls = (c?: string) => (c ? `wt-art-scene ${c}` : 'wt-art-scene');

export function StairArt({ idScope, className, fit = 'slice' }: ArtProps) {
  const ids = useSvgIds('stair', idScope);
  const steps = Array.from({ length: 9 }, (_, i) => i);
  return (
    <svg className={cls(className)} viewBox="0 0 800 600" preserveAspectRatio={`xMidYMid ${fit}`} aria-hidden="true" focusable="false" data-art="stair" xmlns="http://www.w3.org/2000/svg">
      <SceneDefs ids={ids} />
      <rect width={800} height={600} fill="#0B0F1C" />
      <path d="M0 0H800V600H0Z" fill="#11172A" />
      {/* 위층에서 새는 빛 */}
      <Glow ids={ids} tone="amber" cx={560} cy={40} rx={260} ry={120} o={0.45} />
      <path d="M470 0H660L620 120H500Z" fill="#FFD08A" opacity={0.08} />
      {/* 계단 — 오른쪽 위로 오름 */}
      {steps.map((i) => {
        const x = 260 + i * 52;
        const y = 560 - i * 52;
        return (
          <g key={i}>
            <path d={`M${x} ${y}h${560 - i * 52}v52H${x}z`} fill={i % 2 ? '#1A2138' : '#1D2540'} />
            <path d={`M${x} ${y}h${560 - i * 52}`} stroke="#3A4466" strokeWidth={3} />
          </g>
        );
      })}
      {/* 난간 */}
      <path d="M232 560L700 92" stroke="#5A6488" strokeWidth={6} strokeLinecap="round" />
      {steps.map((i) => (
        <path key={i} d={`M${262 + i * 52} ${532 - i * 52}v-56`} stroke="#3A4466" strokeWidth={4} />
      ))}
      <path d="M232 560L700 92" stroke={C.cyan} strokeWidth={2} opacity={0.3} transform="translate(0 -3)" />
      {/* 벽등 */}
      <rect x={110} y={150} width={40} height={18} rx={4} fill="#DCE6F5" />
      <Glow ids={ids} tone="white" cx={130} cy={170} rx={120} ry={90} o={0.25} />
      {/* 나 — 트렌치코트 뒷모습(작게) */}
      <g transform="translate(250 330)">
        <ellipse cx={40} cy={232} rx={70} ry={10} fill="#000" opacity={0.5} />
        <path d="M40 0c22 0 34 18 33 40c-1 18 -8 30 -15 38l3 18c26 4 44 16 50 34c8 26 10 60 12 100h-166c2 -40 4 -74 12 -100c6 -18 24 -30 50 -34l3 -18c-7 -8 -14 -20 -15 -38c-1 -22 11 -40 33 -40z" fill="#0A0D16" />
        <path d="M73 40c-1 18 -8 30 -15 38l3 18c26 4 44 16 50 34c8 26 10 60 12 100" stroke={C.cyan} strokeWidth={3} fill="none" opacity={0.5} />
        <path d="M14 84l26 30l26 -30" stroke="#2A2F40" strokeWidth={6} fill="none" />
      </g>
      <rect width={800} height={600} fill={ids.url('vig')} />
    </svg>
  );
}

export function AdFrameArt({ idScope, className, fit = 'slice' }: ArtProps) {
  const ids = useSvgIds('adframe', idScope);
  return (
    <svg className={cls(className)} viewBox="0 0 800 600" preserveAspectRatio={`xMidYMid ${fit}`} aria-hidden="true" focusable="false" data-art="ad-frame" xmlns="http://www.w3.org/2000/svg">
      <SceneDefs ids={ids}>
        <SpeakerDefs ids={ids} />
        <linearGradient id={ids.id('scr')} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#1B2B55" />
          <stop offset="1" stopColor="#2A1E4A" />
        </linearGradient>
      </SceneDefs>
      <rect width={800} height={600} fill="#070A14" />
      <Glow ids={ids} tone="cyan" cx={400} cy={290} rx={420} ry={260} o={0.25} />
      {/* TV 틀 */}
      <rect x={70} y={60} width={660} height={420} rx={22} fill="#0C0F18" />
      <rect x={90} y={80} width={620} height={380} rx={8} fill={ids.url('scr')} />
      <path d="M380 480h40l20 50h-80z" fill="#0C0F18" />
      <rect x={300} y={528} width={200} height={10} rx={5} fill="#0C0F18" />
      {/* 광고 장면: 거실 조명 + 피해자 실루엣(정장, 얼굴 없음) + 스피커 */}
      <Glow ids={ids} tone="amber" cx={300} cy={200} rx={220} ry={160} o={0.35} />
      <g transform="translate(250 150)">
        <path d="M50 0c26 0 42 22 40 50c-2 22 -12 36 -22 44l4 16c34 6 60 22 70 46c8 22 10 70 12 150h-208c2 -80 4 -128 12 -150c10 -24 36 -40 70 -46l4 -16c-10 -8 -20 -22 -22 -44c-2 -28 14 -50 40 -50z" fill="#0E1222" />
        <path d="M90 50c-2 22 -12 36 -22 44l4 16c34 6 60 22 70 46" stroke={C.amber} strokeWidth={3} fill="none" opacity={0.5} />
        <path d="M30 112l20 40l20 -40" stroke="#2A3050" strokeWidth={6} fill="none" />
        {/* 손을 들어 스피커를 가리키는 팔 */}
        <path d="M128 168c30 6 60 -6 84 -30" stroke="#0E1222" strokeWidth={26} strokeLinecap="round" fill="none" />
      </g>
      <SpeakerBody ids={ids} x={520} y={270} s={0.45} />
      <path d="M380 404H660" stroke="#3A2B22" strokeWidth={10} />
      {/* 네온 문구(광고 유행어) */}
      <g style={{ fontFamily: "var(--wt-font-display, 'Black Han Sans'), sans-serif" }} textAnchor="middle">
        <text x={400} y={440} fontSize={30} fill="none" stroke={C.pink} strokeWidth={10} strokeOpacity={0.35}>
          또박아, 불 꺼. 오늘은 여기까지.
        </text>
        <text x={400} y={440} fontSize={30} fill="#FFE3F0" stroke={C.pink} strokeWidth={2}>
          또박아, 불 꺼. 오늘은 여기까지.
        </text>
      </g>
      <path d="M90 80h620v380H90z" fill="none" stroke="#FFFFFF" strokeOpacity={0.06} strokeWidth={2} />
      <path d="M90 80l240 0l-120 380h-120z" fill="#FFFFFF" opacity={0.03} />
      <circle cx={700} cy={470} r={3} fill={C.red} />
      <rect width={800} height={600} fill={ids.url('vig')} />
    </svg>
  );
}

/** 피해자 프로필 액자 — 정사각, 실루엣 + 모서리 검은 리본 */
export function VictimFrame({ className, decorative = true }: { className?: string; decorative?: boolean }) {
  const a11y = decorative ? { 'aria-hidden': true as const } : { role: 'img', 'aria-label': '백도진' };
  return (
    <svg className={className ? `wt-art-portrait ${className}` : 'wt-art-portrait'} viewBox="0 0 300 300" focusable="false" xmlns="http://www.w3.org/2000/svg" {...a11y}>
      <rect x={10} y={10} width={280} height={280} rx={6} fill="#3A2B22" />
      <rect x={26} y={26} width={248} height={248} rx={2} fill="#2A3048" />
      <rect x={26} y={26} width={248} height={248} rx={2} fill="#FFFFFF" opacity={0.04} />
      <path d="M150 74c30 0 46 24 44 54c-2 22 -12 36 -22 44l4 14c36 6 62 24 72 50l4 38H48l4 -38c10 -26 36 -44 72 -50l4 -14c-10 -8 -20 -22 -22 -44c-2 -30 14 -54 44 -54z" fill="#151A2C" />
      <path d="M128 186l22 34l22 -34" stroke="#2A3050" strokeWidth={6} fill="none" />
      <path d="M210 10H290V90Z" fill="#0A0A0E" />
      <path d="M232 10l58 58" stroke="#2A2A33" strokeWidth={6} />
      <path d="M10 10h280v280H10z" fill="none" stroke="#5A4434" strokeWidth={3} />
    </svg>
  );
}
