/**
 * L0 거실 — 현장. 통유리(멀리언 5) 너머 비 내리는 한강, 회색 소파 · 대리석 사이드테이블,
 * 바닥의 분필 선 + 덮은 흰 천(낮은 둔덕, 형체 없음), 멈춘 원반 청소기(옆면 먼지통), 왼쪽 벽 유리 진열장,
 * 오른쪽 벽 선반 위 또박이. 노란 통제선 대신 한결의 접이식 안내 삼각대.
 *
 * 핫스팟(사건 데이터와 같은 값): h1 분필 선 (50,62) · h2 진열장 (18,40) · h3 또박이 (82,38)
 *  · h4 청소기 (40,75) · h5 먼지통 (48,82, 해금 전에도 그림에는 있음)
 */
import { C, useSvgIds } from '../palette';
import { SpeakerBody, SpeakerDefs } from '../speaker';
import {
  CityNight,
  CoveLed,
  FloorPlanks,
  Glow,
  HubTablet,
  LedDot,
  RainOnGlass,
  SceneDefs,
  SceneSvg,
  SkyGradient,
  Vignette,
} from './parts';
import type { SceneArtDef, SceneArtProps } from './types';

// 원근: 소실점 (750, 300), 뒷벽 (330~1170, 40~560)
const VX = 750;
const VY = 300;
const K = 260 / 420;
const wallY = (x: number, v: number) => {
  const hh = K * Math.abs(x - VX);
  return VY - hh + 2 * v * hh;
};

export function LivingArt({ idScope, rain = true, className, fit }: SceneArtProps) {
  const ids = useSvgIds('living', idScope);
  // 진열장(왼쪽 벽) 네 귀
  const cab = (x: number, v: number) => `${x} ${Math.round(wallY(x, v))}`;
  const shelfV = [0.42, 0.58, 0.74];
  return (
    <SceneSvg art="living" className={className} fit={fit}>
      <SceneDefs ids={ids}>
        <SkyGradient ids={ids} top="#08101F" bottom="#1B2E52" />
        <SpeakerDefs ids={ids} />
        <linearGradient id={ids.id('floor')} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#1A1312" />
          <stop offset="0.5" stopColor="#2A1D17" />
          <stop offset="1" stopColor="#3A281C" />
        </linearGradient>
        <linearGradient id={ids.id('lwall')} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#0A1020" />
          <stop offset="1" stopColor={C.wall1} />
        </linearGradient>
        <linearGradient id={ids.id('rwall')} x1="1" x2="0" y1="0" y2="0">
          <stop offset="0" stopColor="#0A1020" />
          <stop offset="1" stopColor={C.wall1} />
        </linearGradient>
        <linearGradient id={ids.id('winRefl')} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#6FA8FF" stopOpacity="0.13" />
          <stop offset="1" stopColor="#6FA8FF" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={ids.id('marble')} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#D2D7E2" />
          <stop offset="1" stopColor="#8E95A6" />
        </linearGradient>
      </SceneDefs>

      {/* ① 뒷벽 = 통유리 */}
      <rect width={1500} height={1000} fill={C.wall0} />
      <CityNight ids={ids} x={330} y={40} w={840} h={500} seed={11} river={0.66} />
      <RainOnGlass ids={ids} name="win" x={330} y={40} w={840} h={500} n={34} seed={5} rain={rain} />
      {/* 멀리언 5 + 틀 */}
      <g fill="#0B1122">
        {[1, 2, 3, 4, 5].map((i) => (
          <rect key={i} x={330 + i * 140 - 5} y={40} width={10} height={500} />
        ))}
        <rect x={322} y={36} width={856} height={12} />
        <rect x={322} y={528} width={856} height={32} />
      </g>
      <g stroke={C.cyan} strokeOpacity={0.18} strokeWidth={2}>
        {[1, 2, 3, 4, 5].map((i) => (
          <line key={i} x1={330 + i * 140 + 5} y1={48} x2={330 + i * 140 + 5} y2={528} />
        ))}
      </g>
      <rect x={330} y={48} width={840} height={480} fill={ids.url('sheen')} />

      {/* ② 옆벽 · 천장 · 바닥 */}
      <path d={`M0 0H330V560L0 ${Math.round(wallY(0, 1))}Z`} fill={ids.url('lwall')} />
      <path d={`M1500 0H1170V560L1500 ${Math.round(wallY(1500, 1))}Z`} fill={ids.url('rwall')} />
      <path d={`M0 0H1500V0L1170 40H330Z`} fill="#070B16" />
      <path d={`M0 ${Math.round(wallY(0, 1))}L330 560H1170L1500 ${Math.round(wallY(1500, 1))}V1000H0Z`} fill={ids.url('floor')} />
      <FloorPlanks y0={560} vx={VX} vy={VY} n={18} c="#100A08" o={0.7} hi="#6B4A33" seed={4} />
      {/* 창이 바닥에 비친 차가운 빛 */}
      <path d="M340 562H1160L1300 1000H200Z" fill={ids.url('winRefl')} />
      {/* 걸레받이 */}
      <path d={`M0 ${Math.round(wallY(0, 1)) - 14}L330 552V560L0 ${Math.round(wallY(0, 1))}Z`} fill="#070B16" />
      <path d={`M1500 ${Math.round(wallY(1500, 1)) - 14}L1170 552V560L1500 ${Math.round(wallY(1500, 1))}Z`} fill="#070B16" />
      {/* 천장 코브 LED */}
      <CoveLed ids={ids} x={330} y={34} w={840} />
      <path d="M0 26L330 34" stroke={ids.url('cove')} strokeWidth={4} opacity={0.5} />
      <path d="M1170 34L1500 26" stroke={ids.url('cove')} strokeWidth={4} opacity={0.5} />

      {/* ③ 왼쪽 벽 유리 진열장 (h2 18,40) */}
      <g>
        <path d={`M${cab(130, 0.22)}L${cab(322, 0.22)}L${cab(322, 0.93)}L${cab(130, 0.93)}Z`} fill="#0A0F1E" />
        <path d={`M${cab(140, 0.25)}L${cab(314, 0.25)}L${cab(314, 0.9)}L${cab(140, 0.9)}Z`} fill="#121B33" />
        <Glow ids={ids} tone="amber" cx={232} cy={250} rx={90} ry={60} o={0.35} />
        {shelfV.map((v) => (
          <path key={v} d={`M${cab(140, v)}L${cab(314, v)}`} stroke="#9FB6D9" strokeWidth={4} opacity={0.5} />
        ))}
        {/* 상패들 — 칸마다 2~3개 */}
        <g fill="#6E7A96">
          <rect x={168} y={Math.round(wallY(168, 0.42)) - 40} width={26} height={40} rx={3} />
          <rect x={210} y={Math.round(wallY(210, 0.42)) - 52} width={30} height={52} rx={3} fill="#8A7A5A" />
          <rect x={258} y={Math.round(wallY(258, 0.42)) - 36} width={34} height={36} rx={3} />
          <rect x={174} y={Math.round(wallY(174, 0.58)) - 46} width={36} height={46} rx={3} fill="#8A7A5A" />
          <path d={`M232 ${Math.round(wallY(232, 0.58))}h30l-6 -50h-18z`} />
        </g>
        {/* 맨 앞 크리스탈 트로피 — 별 반짝 1 */}
        <g>
          <path d={`M248 ${Math.round(wallY(270, 0.74))}h44l-8 -14h-28z`} fill="#5D6A88" />
          <path d={`M258 ${Math.round(wallY(270, 0.74)) - 14}l12 -66l12 66z`} fill="#BFE8FF" opacity={0.85} />
          <path d={`M270 ${Math.round(wallY(270, 0.74)) - 80}l12 66h-12z`} fill="#7FB8E0" opacity={0.7} />
          <path d={`M286 ${Math.round(wallY(270, 0.74)) - 24}l4 -4l3 3z`} fill="#0A0F1E" opacity={0.7} />
          <path className="wt-art-twinkle" d="M268 352l4 12l12 4l-12 4l-4 12l-4 -12l-12 -4l12 -4z" fill="#FFFFFF" />
        </g>
        <g fill="#7C8AA8">
          <rect x={168} y={Math.round(wallY(168, 0.74)) - 30} width={44} height={30} rx={3} />
        </g>
        {/* 유리 문 · 반사 */}
        <path d={`M${cab(140, 0.25)}L${cab(314, 0.25)}L${cab(314, 0.9)}L${cab(140, 0.9)}Z`} fill={C.glass} opacity={0.07} />
        <path d={`M${cab(160, 0.27)}L${cab(186, 0.27)}L${cab(150, 0.88)}L${cab(140, 0.88)}Z`} fill="#FFFFFF" opacity={0.07} />
        <path d={`M${cab(227, 0.25)}L${cab(227, 0.9)}`} stroke="#9FB6D9" strokeWidth={3} opacity={0.35} />
        <LedDot ids={ids} x={305} y={Math.round(wallY(305, 0.235))} tone="amber" r={3} />
      </g>

      {/* 오른쪽 벽 허브 태블릿 */}
      <g transform="translate(1390 250) skewY(-6) scale(0.72 1)">
        <HubTablet ids={ids} x={0} y={0} w={120} h={86} />
      </g>

      {/* 스탠드 조명(장식) — 사이드테이블 뒤, 현장을 따뜻하게 비춤 */}
      <Glow ids={ids} tone="amber" cx={950} cy={360} rx={240} ry={210} o={0.5} />
      <Glow ids={ids} tone="amber" cx={850} cy={650} rx={260} ry={70} o={0.32} />
      <g>
        <rect x={947} y={330} width={6} height={262} fill="#2A2420" />
        <ellipse cx={950} cy={594} rx={28} ry={6} fill="#1A1412" />
        <path d="M917 332h66l-12 -48h-42z" fill="#F2D6A8" />
        <path d="M917 332h66l-4 -10h-58z" fill="#FFE9C2" />
      </g>
      {/* 소파 */}
      <g>
        <ellipse cx={555} cy={640} rx={200} ry={14} fill="#000" opacity={0.35} />
        <rect x={392} y={468} width={326} height={96} rx={22} fill={C.sofa1} />
        <rect x={392} y={468} width={326} height={14} rx={7} fill={C.sofa2} opacity={0.8} />
        <rect x={704} y={472} width={14} height={92} rx={7} fill={C.sofa0} opacity={0.6} />
        <path d="M408 548H702L714 590H396Z" fill={C.sofa2} />
        <path d="M555 548V590" stroke={C.sofa0} strokeWidth={3} />
        <rect x={396} y={588} width={318} height={42} rx={8} fill={C.sofa0} />
        <rect x={366} y={498} width={50} height={136} rx={18} fill={C.sofa1} />
        <rect x={694} y={498} width={50} height={136} rx={18} fill={C.sofa0} />
        <rect x={366} y={498} width={50} height={12} rx={6} fill={C.sofa2} />
        <path d="M424 520q34 -14 66 2l-4 36q-30 -8 -62 0z" fill="#6B7590" />
        <rect x={404} y={628} width={10} height={14} fill="#15100E" />
        <rect x={696} y={628} width={10} height={14} fill="#15100E" />
      </g>

      {/* 대리석 사이드테이블 (h1 50,62 — 모서리) */}
      <g>
        <ellipse cx={800} cy={658} rx={86} ry={10} fill="#000" opacity={0.4} />
        <path d="M736 570H856L868 592H724Z" fill="#E4E8F0" />
        <path d="M724 592H868V654H724Z" fill={ids.url('marble')} />
        <path d="M868 592L856 570V632L868 654Z" fill={C.marbleShade} opacity={0.5} />
        <path d="M736 600q30 18 22 36q-4 10 14 18M790 596q-10 22 16 30q22 8 18 26" stroke="#9AA2B4" strokeWidth={1.6} fill="none" opacity={0.7} />
        <path d="M724 592H868" stroke="#FFFFFF" strokeWidth={2} opacity={0.7} />
        <path d="M724 592V654" stroke="#FFFFFF" strokeWidth={2} opacity={0.55} />
        {/* 작은 화병(장식) */}
        <path d="M818 572q-8 -18 2 -30h12q10 12 2 30z" fill="#41506E" />
      </g>

      {/* 분필 선 + 덮은 천 (h1) */}
      <g>
        <path
          d="M612 706c-6 -26 18 -44 46 -52c18 -6 30 -22 54 -20c22 2 30 14 52 12c30 -2 58 -6 92 4c40 12 66 34 62 58c-2 14 -18 20 -40 22"
          fill="none"
          stroke={C.chalk}
          strokeOpacity={0.72}
          strokeWidth={4.5}
          strokeLinecap="round"
          strokeDasharray="38 7 22 5 60 6"
        />
        <path d="M614 712c-4 -24 22 -40 48 -50M900 666c34 10 58 28 54 50" fill="none" stroke={C.chalk} strokeOpacity={0.35} strokeWidth={2} />
        <ellipse cx={782} cy={716} rx={150} ry={12} fill="#000" opacity={0.35} />
        <path d="M640 716c8 -30 46 -50 96 -54c46 -4 92 -2 132 10c30 9 52 24 58 44z" fill={C.cloth} />
        <path d="M640 716c40 -6 140 -8 286 0c-4 -10 -10 -18 -18 -24c-60 6 -170 8 -250 6c-8 6 -14 12 -18 18z" fill={C.clothShade} opacity={0.75} />
        <path d="M712 668c18 12 30 30 34 44M812 664c4 16 2 34 -6 50" stroke={C.clothShade} strokeWidth={3} fill="none" strokeLinecap="round" />
        <path d="M672 690c30 -20 80 -26 120 -24" stroke="#FFFFFF" strokeWidth={3} opacity={0.6} fill="none" strokeLinecap="round" />
      </g>

      {/* 접이식 안내 삼각대(통제선 대신) */}
      <g>
        <path d="M980 716l26 -62l26 62z" fill={C.amber} />
        <path d="M993 702l13 -32l13 32z" fill="#1A1206" opacity={0.85} />
        <path d="M1006 688v8" stroke={C.amber} strokeWidth={4} strokeLinecap="round" />
        <path d="M976 718h60" stroke="#3A2A10" strokeWidth={5} strokeLinecap="round" />
      </g>

      {/* 원반 청소기 (h4 40,75) + 옆면 먼지통 (h5 48,82) */}
      <g>
        <ellipse cx={624} cy={830} rx={150} ry={20} fill="#000" opacity={0.45} />
        <path d="M494 760v34a128 42 0 0 0 256 0v-34z" fill="#1B2034" />
        <path d="M494 794a128 42 0 0 0 256 0" stroke={C.cyan} strokeOpacity={0.2} strokeWidth={2} fill="none" />
        <ellipse cx={622} cy={760} rx={128} ry={42} fill="#E3E7EF" />
        <ellipse cx={622} cy={756} rx={120} ry={37} fill="#F2F4F8" />
        <ellipse cx={600} cy={752} rx={40} ry={14} fill="#CDD3DE" />
        <ellipse cx={600} cy={749} rx={30} ry={10} fill="#DDE2EA" />
        <circle cx={600} cy={749} r={4} fill={C.amber} />
        <circle cx={600} cy={749} r={16} fill={ids.url('glow-amber')} opacity={0.7} />
        <path d="M540 726a128 42 0 0 1 150 -6" stroke="#FFFFFF" strokeWidth={4} fill="none" opacity={0.8} />
        {/* 범퍼 */}
        <path d="M512 788a128 42 0 0 0 220 0" stroke="#3A4258" strokeWidth={6} fill="none" />
        {/* 먼지통 카세트 — 옆면에 끼워진 뚜껑 달린 통 */}
        <path d="M694 796l46 -10v30l-46 10z" fill="#3A4560" />
        <path d="M698 800l38 -8v22l-38 8z" fill="#9FC2D8" opacity={0.55} />
        <path d="M694 796l46 -10l4 -6l-46 10z" fill="#5A6684" />
        <rect x={712} y={798} width={12} height={4} rx={2} fill="#1B2034" transform="rotate(-12 718 800)" />
        <path d="M704 816l6 -2M716 812l8 -2" stroke="#EAF4FF" strokeWidth={2} opacity={0.6} strokeLinecap="round" />
      </g>

      {/* 오른쪽 벽 선반 + 또박이 (h3 82,38) */}
      <g>
        <path d="M1150 452L1340 474L1300 494L1112 466Z" fill="#3A2B22" />
        <path d="M1112 466L1300 494V506L1112 478Z" fill="#241A15" />
        <path d="M1300 494L1340 474V486L1300 506Z" fill="#1A1310" />
        <SpeakerBody ids={ids} x={1228} y={340} s={0.42} />
      </g>

      {/* ⑤ 전경 — 화분(왼쪽 아래) · 팔걸이 의자 실루엣(오른쪽 아래) */}
      <g>
        <path d="M70 990l-10 -112h120l-10 112z" fill="#1F1A22" />
        <path d="M60 878h120v12H60z" fill="#2C2530" />
        <g fill={C.plant1}>
          <path d="M118 880c-40 -60 -70 -120 -60 -210c30 50 56 120 64 208z" />
          <path d="M124 880c10 -90 46 -150 100 -190c-14 70 -50 140 -94 192z" fill={C.plant2} />
          <path d="M112 882c-50 -30 -96 -40 -130 -30c40 -40 100 -30 136 26z" fill={C.plant0} />
          <path d="M126 880c20 -50 22 -110 6 -170c32 44 40 110 0 172z" />
        </g>
      </g>
      {/* 전경 라운지 의자(뒷모습 실루엣) */}
      <g>
        <path d="M1286 1000V872q0 -64 66 -70h104q50 4 50 62V1000z" fill="#0B101D" />
        <path d="M1296 864q8 -56 62 -62h96" stroke={C.cyan} strokeWidth={4} opacity={0.35} fill="none" strokeLinecap="round" />
        <path d="M1228 1000v-82q0 -26 26 -28h40q20 2 20 26V1000z" fill="#111829" />
        <path d="M1236 906q4 -14 18 -16h40" stroke="#4A5880" strokeWidth={3} opacity={0.6} fill="none" strokeLinecap="round" />
        <path d="M1330 880h120" stroke="#1C2438" strokeWidth={3} />
      </g>

      {/* ④ 빛 */}
      <Glow ids={ids} tone="cyan" cx={750} cy={300} rx={520} ry={260} o={0.12} />
      <Glow ids={ids} tone="violet" cx={1100} cy={60} rx={380} ry={90} o={0.25} />
      <LedDot ids={ids} x={1172} y={600} tone="cyan" r={3} />
      {/* ⑥ 비네트 */}
      <Vignette ids={ids} />
    </SceneSvg>
  );
}

export const sceneLiving: SceneArtDef = {
  key: 'living',
  name: '거실 — 현장',
  Art: LivingArt,
  anchors: { 'L0.h1': [50, 62], 'L0.h2': [18, 40], 'L0.h3': [82, 38], 'L0.h4': [40, 75], 'L0.h5': [48, 82] },
  tone: '#1B2E52',
};
