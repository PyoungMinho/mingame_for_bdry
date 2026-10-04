/**
 * L4 옥상 정원. 폭풍 하늘(바이올렛, 번개 없음 — 광과민 고려, 정적 구름 가장자리만), 멀리 불 꺼진 강변도로의 앰버 경고등 점,
 * 캐노피 아래 벤치(한쪽만 마른 하이라이트), 젖은 화분들, 거실 위 유리 천창(블라인드 줄무늬) + 그 옆 바닥의 흰 이어폰 한 짝(글자 없음),
 * 계단 쪽 번호키 문(배경 흐림).
 *
 * 핫스팟: h1 천창 (50,55) · h2 캐노피 벤치 (20,40) · h3 한강 전망 난간 (80,20)
 */
import { C, rng, r1, useSvgIds } from '../palette';
import { Glow, LedDot, RainOnGlass, SceneDefs, SceneSvg, Vignette } from './parts';
import type { SceneArtDef, SceneArtProps } from './types';

const VX = 750;
const VY = 150;
const px = (xb: number, y: number) => VX + (xb - VX) * ((y - VY) / (1000 - VY));

export function RoofArt({ idScope, rain = true, className, fit }: SceneArtProps) {
  const ids = useSvgIds('roof', idScope);
  const rnd = rng(77);
  // 데크 판자
  let deck = '';
  for (let i = -10; i <= 22; i++) {
    const xb = i * 80;
    deck += `M${r1(px(xb, 300))} 300L${xb} 1000`;
  }
  // 젖은 반사 줄
  let wet = '';
  for (let i = 0; i < 26; i++) {
    const xb = rnd() * 1700 - 100;
    const y = 330 + rnd() * 640;
    wet += `M${r1(px(xb, y))} ${r1(y)}l0 ${r1(10 + rnd() * 40)}`;
  }
  // 경고등 점(강변도로, 불 꺼진 길)
  const warn = Array.from({ length: 11 }, (_, i) => [40 + i * 140 + rnd() * 40, 186 + rnd() * 6] as const);
  return (
    <SceneSvg art="roof" className={className} fit={fit}>
      <SceneDefs ids={ids}>
        <linearGradient id={ids.id('sky')} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#0A0F24" />
          <stop offset="1" stopColor="#1B1636" />
        </linearGradient>
        <linearGradient id={ids.id('deck')} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#1A1622" />
          <stop offset="1" stopColor="#2E2630" />
        </linearGradient>
        <linearGradient id={ids.id('glass')} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#9FC8FF" stopOpacity="0.30" />
          <stop offset="1" stopColor="#9FC8FF" stopOpacity="0.10" />
        </linearGradient>
      </SceneDefs>

      {/* 하늘 · 구름(정적) */}
      <rect width={1500} height={1000} fill={ids.url('sky')} />
      <g>
        <path d="M-40 120q80 -70 190 -40q60 -60 160 -20q90 -40 150 20q70 -10 90 50H-40z" fill="#231C42" />
        <path d="M-40 120q80 -70 190 -40q60 -60 160 -20q90 -40 150 20" stroke="#4A3E7A" strokeWidth={4} fill="none" opacity={0.7} />
        <path d="M620 100q100 -80 230 -30q80 -50 190 0q120 -40 200 30q90 -20 300 30V150H620z" fill="#201A3E" />
        <path d="M620 100q100 -80 230 -30q80 -50 190 0q120 -40 200 30q90 -20 300 30" stroke="#5A4C8E" strokeWidth={4} fill="none" opacity={0.6} />
        <Glow ids={ids} tone="violet" cx={980} cy={40} rx={420} ry={90} o={0.25} />
      </g>
      {/* 먼 강 건너 · 불 꺼진 강변도로 */}
      <path d="M0 176V156h40v-14h60v20h80v-30h50v26h120v-12h70v18h90v-24h60v20h140v-16h80v22h110v-28h60v24h120v-10h90v20h100v-18h60v26h70V176z" fill="#141230" />
      <rect y={176} width={1500} height={20} fill="#0C0E22" />
      <path d="M0 186H1500" stroke="#2A2840" strokeWidth={3} />
      {warn.map(([x, y], i) => (
        <LedDot key={i} ids={ids} x={r1(x)} y={r1(y)} tone="amber" r={2.6} />
      ))}
      <rect y={196} width={1500} height={104} fill="#0B1024" />
      <path d="M60 230h40M300 250h60M640 222h30M900 262h50M1210 240h40M1380 270h30" stroke={C.amber} strokeWidth={2} opacity={0.3} strokeLinecap="round" />

      {/* 데크 */}
      <path d="M0 300H1500V1000H0Z" fill={ids.url('deck')} />
      <path d={deck} stroke="#120E18" strokeWidth={3} fill="none" />
      <path d={wet} stroke="#8FA8FF" strokeWidth={2} opacity={0.22} strokeLinecap="round" />

      {/* h3 한강 전망 난간 (80,20) — 유리 패널 + 상단 레일 */}
      <g>
        <rect y={210} width={1500} height={92} fill="#9FC8FF" opacity={0.07} />
        {Array.from({ length: 11 }, (_, i) => (
          <rect key={i} x={i * 150 - 4} y={204} width={8} height={98} fill="#3A3E58" />
        ))}
        <rect y={198} width={1500} height={10} rx={5} fill="#7E86A8" />
        <rect y={198} width={1500} height={3} fill="#C9D0EA" opacity={0.6} />
        <path d="M1120 214l40 80M1260 214l40 80" stroke="#FFFFFF" strokeWidth={3} opacity={0.08} />
        <rect y={298} width={1500} height={8} fill="#141022" />
      </g>

      {/* 계단 쪽 번호키 문(배경 흐림 — 낮은 대비) */}
      <g opacity={0.7}>
        <rect x={-10} y={60} width={160} height={250} fill="#1C1A30" />
        <rect x={20} y={120} width={96} height={182} fill="#2A2744" />
        <rect x={96} y={190} width={12} height={20} rx={3} fill="#5A5878" />
        <circle cx={102} cy={180} r={3} fill={C.cyan} opacity={0.8} />
        <rect x={-10} y={52} width={170} height={12} fill="#2C2944" />
      </g>

      {/* h2 캐노피 + 벤치 (20,40) */}
      <g>
        <path d="M150 140H500L520 172H130Z" fill="#3A3048" />
        <path d="M130 172H520" stroke="#6A5E86" strokeWidth={4} />
        <path d="M150 140H500" stroke="#8A7EAE" strokeWidth={2} opacity={0.6} />
        {[160, 480].map((x) => (
          <rect key={x} x={x} y={172} width={12} height={330} fill="#2A2238" />
        ))}
        <Glow ids={ids} tone="amber" cx={315} cy={190} rx={150} ry={50} o={0.35} />
        <rect x={290} y={176} width={50} height={6} rx={3} fill="#FFE2A8" />
        {/* 벤치 — 등받이 · 좌판 · 다리 */}
        <rect x={190} y={330} width={260} height={56} rx={6} fill="#4A3828" />
        <path d="M190 344h260M190 362h260" stroke="#2E2218" strokeWidth={3} />
        <path d="M176 392H464L476 420H164Z" fill="#5A4430" />
        <path d="M176 392H464" stroke="#2E2218" strokeWidth={2} />
        {/* 한쪽만 마른 하이라이트(왼쪽 좌판) */}
        <path d="M184 396H300L304 416H176Z" fill="#8A6A48" />
        <path d="M184 396H300" stroke="#C9A06E" strokeWidth={3} />
        <path d="M330 404l20 4M380 400l14 6M420 410l18 2" stroke="#9FB8FF" strokeWidth={2} opacity={0.5} strokeLinecap="round" />
        <rect x={180} y={420} width={10} height={64} fill="#24180E" />
        <rect x={452} y={420} width={10} height={64} fill="#24180E" />
        <ellipse cx={320} cy={488} rx={170} ry={12} fill="#000" opacity={0.35} />
      </g>

      {/* 젖은 화분 — 왼쪽 앞 · 오른쪽 */}
      {[
        [130, 720, 1],
        [1360, 640, 0.9],
        [1160, 520, 0.65],
      ].map(([x, y, s], i) => (
        <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
          <ellipse cx={0} cy={190} rx={120} ry={18} fill="#000" opacity={0.4} />
          <path d="M-96 40H96L80 190H-80Z" fill="#3E3A4C" />
          <path d="M-96 40H96" stroke="#6A6688" strokeWidth={6} />
          <path d="M60 52L48 186" stroke="#9FB8FF" strokeWidth={3} opacity={0.35} />
          <path d="M-10 44c-40 -60 -90 -90 -140 -100c40 40 70 70 120 104zM6 44c10 -80 50 -130 110 -160c-20 70 -50 120 -96 162zM-2 44c-6 -70 4 -140 30 -190c14 60 12 130 -18 192z" fill={C.plant1} />
          <path d="M-4 44c-30 -40 -50 -90 -50 -140c30 30 50 80 62 138z" fill={C.plant2} />
          <path d="M-60 -20l4 8M40 -60l4 8M80 -30l3 7" stroke="#CFE6FF" strokeWidth={3} strokeLinecap="round" opacity={0.6} />
        </g>
      ))}

      {/* h1 유리 천창 (50,55) — 블라인드가 내려져 안은 안 보임 */}
      <g>
        <ellipse cx={750} cy={648} rx={250} ry={18} fill="#000" opacity={0.45} />
        <path d="M590 470H910L960 640H540Z" fill="#2A2638" />
        <path d="M604 482H896L940 628H560Z" fill="#141826" />
        {/* 블라인드 줄무늬 */}
        <path
          d={Array.from({ length: 12 }, (_, k) => {
            const y = 488 + k * 12;
            const t = (y - 482) / 146;
            const xl = 604 - 44 * t;
            const xr = 896 + 44 * t;
            return `M${r1(xl + 4)} ${y}H${r1(xr - 4)}`;
          }).join('')}
          stroke="#3E4560"
          strokeWidth={5}
        />
        <path d="M604 482H896L940 628H560Z" fill={ids.url('glass')} />
        <path d="M750 482V628M582 555H918" stroke="#2A2638" strokeWidth={8} />
        <path d="M620 492l40 120M800 492l24 120" stroke="#FFFFFF" strokeWidth={4} opacity={0.12} />
        <path d="M590 470H910" stroke="#8A86A8" strokeWidth={3} />
        <path d="M540 640H960" stroke="#0E0C16" strokeWidth={6} />
        {/* 빗방울 맺힘 */}
        <path d="M640 520a3 4 0 1 0 0.1 0M710 590a3 4 0 1 0 0.1 0M860 540a3 4 0 1 0 0.1 0M900 600a3 4 0 1 0 0.1 0M680 560a2 3 0 1 0 0.1 0" stroke="#CFE6FF" strokeWidth={2} fill="none" opacity={0.6} />
        {/* 흰 이어폰 한 짝(케이스 글자 없음) */}
        <g transform="translate(976 664) rotate(-24)">
          <ellipse cx={0} cy={6} rx={18} ry={5} fill="#000" opacity={0.4} />
          <ellipse cx={0} cy={0} rx={12} ry={9} fill="#F4F6FA" />
          <rect x={6} y={-3} width={22} height={7} rx={3.5} fill="#E2E6EE" />
          <ellipse cx={-3} cy={-3} rx={4} ry={2.5} fill="#FFFFFF" />
        </g>
      </g>

      {/* 데크 볼라드 조명(장식) */}
      {[
        [560, 400, 0.7],
        [1010, 430, 0.75],
        [660, 900, 1.1],
      ].map(([x, y, k], i) => (
        <g key={i}>
          <Glow ids={ids} tone="amber" cx={x} cy={y + 28 * k} rx={150 * k} ry={40 * k} o={0.4} />
          <rect x={x - 9 * k} y={y - 36 * k} width={18 * k} height={64 * k} rx={4 * k} fill="#2A2436" />
          <rect x={x - 9 * k} y={y - 30 * k} width={18 * k} height={10 * k} fill="#FFD08A" />
        </g>
      ))}
      {/* 웅덩이 */}
      <ellipse cx={420} cy={860} rx={150} ry={22} fill="#2A2E52" opacity={0.6} />
      <path d="M330 856h60M440 866h80" stroke={C.amber} strokeWidth={3} opacity={0.35} strokeLinecap="round" />
      <ellipse cx={1050} cy={930} rx={120} ry={16} fill="#2A2E52" opacity={0.5} />

      {/* 비 — 장면 전체 */}
      <RainOnGlass ids={ids} name="all" x={0} y={0} w={1500} h={1000} n={60} seed={19} o={0.4} slant={-0.12} rain={rain} drops={false} />
      <Vignette ids={ids} />
    </SceneSvg>
  );
}

export const sceneRoof: SceneArtDef = {
  key: 'roof',
  name: '옥상 정원',
  Art: RoofArt,
  anchors: { 'L4.h1': [50, 55], 'L4.h2': [20, 40], 'L4.h3': [80, 20] },
  tone: '#1B1636',
};
