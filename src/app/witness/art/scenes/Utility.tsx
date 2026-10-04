/**
 * L3 다용도실. 차가운 형광등(민트 화이트), 세탁기·건조기(왼쪽 아래), 벽의 통신 단자함(공유기 LED 그린·앰버 점멸),
 * 월패드(시안 화면), 차단기 함(스위치 전부 위), 서비스 엘리베이터로 통하는 쪽문(문 앞 바닥에 물방울 하나).
 *
 * 핫스팟: h1 단자함 (25,30) · h2 월패드 (60,35) · h3 차단기 (40,25) · h4 쪽문 (85,60)
 */
import { C, useSvgIds } from '../palette';
import { Glow, LedDot, SceneDefs, SceneSvg, Vignette } from './parts';
import type { SceneArtDef, SceneArtProps } from './types';

export function UtilityArt({ idScope, className, fit }: SceneArtProps) {
  const ids = useSvgIds('utility', idScope);
  // 바닥 타일
  let tiles = '';
  for (let i = -8; i <= 16; i++) {
    const xb = i * 150;
    tiles += `M${Math.round(750 + (xb - 750) * 0.35)} 760L${xb} 1000`;
  }
  [786, 830, 900].forEach((y) => (tiles += `M0 ${y}H1500`));
  // 벽 타일 줄
  let wt = '';
  for (let y = 120; y < 760; y += 64) wt += `M0 ${y}H1500`;
  return (
    <SceneSvg art="utility" className={className} fit={fit}>
      <SceneDefs ids={ids}>
        <linearGradient id={ids.id('wall')} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#273D47" />
          <stop offset="1" stopColor="#172630" />
        </linearGradient>
        <linearGradient id={ids.id('floor')} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#24323A" />
          <stop offset="1" stopColor="#33454E" />
        </linearGradient>
        <linearGradient id={ids.id('tube')} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#DFF7F3" stopOpacity="0.30" />
          <stop offset="0.6" stopColor="#DFF7F3" stopOpacity="0.06" />
          <stop offset="1" stopColor="#DFF7F3" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={ids.id('metal')} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#B7C4CC" />
          <stop offset="1" stopColor="#8796A2" />
        </linearGradient>
        <linearGradient id={ids.id('door')} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#5D6E7A" />
          <stop offset="1" stopColor="#43525E" />
        </linearGradient>
      </SceneDefs>

      {/* 벽 · 천장 · 바닥 */}
      <rect width={1500} height={1000} fill={ids.url('wall')} />
      <path d={wt} stroke="#18262E" strokeWidth={2} opacity={0.6} />
      <rect width={1500} height={56} fill="#0E171D" />
      <path d="M0 760H1500V1000H0Z" fill={ids.url('floor')} />
      <path d={tiles} stroke="#18232A" strokeWidth={2.5} fill="none" />
      <path d="M0 756H1500" stroke="#121C22" strokeWidth={10} />
      {/* 천장 배관 */}
      <path d="M0 76H1500" stroke="#41535E" strokeWidth={14} />
      <path d="M0 98H1500" stroke="#34444E" strokeWidth={8} />
      {[220, 700, 1180].map((x) => (
        <rect key={x} x={x} y={66} width={18} height={40} rx={3} fill="#2A3740" />
      ))}
      {/* 형광등 */}
      <rect x={420} y={110} width={620} height={18} rx={9} fill="#F4FFFC" />
      <path d="M424 128H1036L1240 760H220Z" fill={ids.url('tube')} opacity={0.55} />
      <Glow ids={ids} tone="white" cx={730} cy={140} rx={520} ry={150} o={0.5} />

      {/* h3 차단기 함 (40,25) — 문 열림, 스위치 전부 위(ON) */}
      <g>
        <rect x={534} y={150} width={132} height={196} rx={6} fill="#8A97A2" />
        <rect x={544} y={160} width={112} height={176} rx={4} fill="#3A4852" />
        <path d="M666 150l40 16v196l-40 -16z" fill="#A9B5BE" />
        {[0, 1, 2, 3].map((r) => (
          <g key={r}>
            {[0, 1, 2, 3, 4].map((c) => (
              <g key={c}>
                <rect x={554 + c * 20} y={176 + r * 40} width={14} height={28} rx={2} fill="#D7DEE3" />
                <rect x={556 + c * 20} y={178 + r * 40} width={10} height={11} rx={2} fill={C.green} opacity={0.85} />
              </g>
            ))}
          </g>
        ))}
        <LedDot ids={ids} x={646} y={170} tone="green" r={3} />
      </g>

      {/* h1 통신 단자함 (25,30) — 공유기 LED 그린·앰버 점멸 */}
      <g>
        <rect x={290} y={196} width={170} height={210} rx={6} fill="#C6D0D6" />
        <rect x={300} y={206} width={150} height={190} rx={4} fill="#26323A" />
        <path d="M290 196l-40 16v178l40 16z" fill="#AEB9C0" />
        <rect x={318} y={232} width={114} height={34} rx={6} fill="#E9EEF1" />
        <LedDot ids={ids} x={336} y={249} tone="green" r={3.5} blink />
        <LedDot ids={ids} x={354} y={249} tone="green" r={3.5} />
        <LedDot ids={ids} x={372} y={249} tone="amber" r={3.5} blink />
        <LedDot ids={ids} x={390} y={249} tone="green" r={3.5} />
        <rect x={318} y={286} width={114} height={22} rx={4} fill="#3E4C56" />
        {[0, 1, 2, 3, 4, 5].map((k) => (
          <rect key={k} x={326 + k * 17} y={292} width={10} height={10} rx={1.5} fill="#16202A" />
        ))}
        <path d="M331 302c-6 40 -20 60 -10 94M348 302c0 40 12 56 2 94M365 302c4 30 24 50 30 94M382 302c10 20 34 40 40 94" stroke="#5BA8E8" strokeWidth={4} fill="none" opacity={0.85} />
        <path d="M399 302c6 26 22 46 24 94" stroke="#E8C05B" strokeWidth={4} fill="none" />
        <rect x={318} y={330} width={114} height={8} rx={2} fill="#3E4C56" />
      </g>

      {/* h2 월패드 (60,35) */}
      <g>
        <Glow ids={ids} tone="cyan" cx={900} cy={350} rx={160} ry={110} o={0.4} />
        <rect x={812} y={284} width={176} height={132} rx={12} fill="#E8EDF0" />
        <rect x={826} y={298} width={148} height={96} rx={6} fill="#082230" />
        <rect x={836} y={308} width={52} height={6} rx={3} fill={C.cyan} />
        {[0, 1, 2].map((i) => (
          <g key={i}>
            <rect x={836 + i * 46} y={324} width={40} height={30} rx={4} fill="#11415A" />
            <path d={`M${848 + i * 46} 350v-16h16v16`} stroke={C.cyan} strokeWidth={2.5} fill="none" opacity={0.85} />
          </g>
        ))}
        <path d="M836 366h120M836 378h86" stroke={C.cyan} strokeWidth={4} strokeLinecap="round" opacity={0.45} />
        <circle cx={900} cy={406} r={4} fill="#9AA6B0" />
      </g>

      {/* 세탁기 · 건조기 (장식) */}
      {[70, 286].map((x, i) => (
        <g key={x}>
          <rect x={x} y={548} width={200} height={334} rx={12} fill="#CFD8DD" />
          <rect x={x} y={548} width={200} height={60} rx={12} fill="#B9C4CA" />
          <rect x={x + 14} y={566} width={70} height={22} rx={5} fill="#0C1E28" />
          <rect x={x + 22} y={573} width={30} height={7} rx={3} fill={i ? C.amber : C.cyan} opacity={0.85} />
          <circle cx={x + 160} cy={577} r={13} fill="#B6C2C8" />
          <circle cx={x + 100} cy={730} r={74} fill="#9FAEB6" />
          <circle cx={x + 100} cy={730} r={60} fill="#22323C" />
          <circle cx={x + 100} cy={730} r={60} fill="#9FD6FF" opacity={0.12} />
          <path d={`M${x + 64} ${704}a46 46 0 0 1 40 -20`} stroke="#FFFFFF" strokeWidth={5} opacity={0.4} fill="none" strokeLinecap="round" />
          <path d={`M${x + 200} 560v320`} stroke={C.cyan} strokeWidth={3} opacity={0.25} />
        </g>
      ))}
      {/* 세탁기 위 수건 더미 · 세제 병(라벨 없음) */}
      <g>
        <path d="M92 548v-46q0 -12 12 -12h18v-10h16v10h8q12 0 12 12v46z" fill="#5FB3D9" />
        <path d="M176 548v-58q0 -8 8 -8h40q8 0 8 8v58z" fill="#F2F4F6" />
        <rect x={190} y={474} width={20} height={10} rx={3} fill="#E85A8A" />
        <rect x={310} y={518} width={150} height={30} rx={8} fill="#A9C7D8" />
        <rect x={318} y={490} width={136} height={30} rx={8} fill="#E8D7C0" />
        <rect x={326} y={464} width={120} height={28} rx={8} fill="#B8E0C8" />
      </g>
      {/* 빨래 바구니 */}
      <g>
        <path d="M520 900l-16 -120h170l-16 120z" fill="#6E7E8A" />
        <path d="M504 780h170" stroke="#8C9CA8" strokeWidth={8} strokeLinecap="round" />
        <path d="M530 800h120M532 830h116M536 860h108" stroke="#56646E" strokeWidth={4} />
        <path d="M516 782q30 -40 70 -24q30 -26 74 8" fill="#B8C7D8" />
      </g>

      {/* h4 쪽문 (85,60) — 서비스 엘리베이터 쪽, 문 앞 바닥 물방울 */}
      <g>
        <rect x={1132} y={236} width={290} height={530} fill="#18232A" />
        <rect x={1146} y={250} width={262} height={510} fill={ids.url('door')} />
        <rect x={1176} y={290} width={202} height={190} rx={4} fill="#3F4E58" />
        <rect x={1176} y={520} width={202} height={200} rx={4} fill="#3F4E58" />
        <rect x={1176} y={290} width={202} height={190} rx={4} fill="#FFFFFF" opacity={0.04} />
        <rect x={1360} y={500} width={30} height={10} rx={5} fill="#C8D2D8" />
        <rect x={1368} y={490} width={14} height={30} rx={4} fill="#9AA6AE" />
        {/* 번호키 */}
        <rect x={1356} y={410} width={36} height={56} rx={6} fill="#1B252C" />
        <circle cx={1374} cy={426} r={3} fill={C.cyan} />
        <path d="M1364 440h4m6 0h4m6 0h4M1364 450h4m6 0h4m6 0h4" stroke="#6E7E88" strokeWidth={3} strokeLinecap="round" />
        <path d="M1422 236V766" stroke={C.cyan} strokeWidth={3} opacity={0.25} />
        <path d="M1132 766H1422" stroke="#0E161B" strokeWidth={8} />
        {/* 물방울 */}
        <ellipse cx={1290} cy={872} rx={22} ry={7} fill="#9FE3FF" opacity={0.35} />
        <path d="M1290 840q-12 18 -12 26a12 12 0 0 0 24 0q0 -8 -12 -26z" fill="#BFF0FF" opacity={0.9} />
        <path d="M1286 860a4 6 0 0 0 0 10" stroke="#FFFFFF" strokeWidth={2.5} fill="none" opacity={0.8} />
      </g>

      {/* 대걸레 · 양동이(장식) */}
      <g>
        <path d="M1040 300L1076 880" stroke="#8D7A62" strokeWidth={8} strokeLinecap="round" />
        <path d="M1050 870q24 -10 52 4l10 30h-70z" fill="#D9D3C4" />
        <path d="M960 900l-12 -96h120l-12 96z" fill="#3E8FB0" />
        <path d="M948 804h120" stroke="#5FB3D9" strokeWidth={8} strokeLinecap="round" />
      </g>

      <Glow ids={ids} tone="cyan" cx={750} cy={500} rx={700} ry={300} o={0.08} />
      <Vignette ids={ids} />
    </SceneSvg>
  );
}

export const sceneUtility: SceneArtDef = {
  key: 'utility',
  name: '다용도실',
  Art: UtilityArt,
  anchors: { 'L3.h1': [25, 30], 'L3.h2': [60, 35], 'L3.h3': [40, 25], 'L3.h4': [85, 60] },
  tone: '#2E4650',
};
