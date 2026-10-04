/**
 * L1 주방. 따뜻한 LED 앰비언트, 아일랜드 식탁의 디저트 접시들(초콜릿 글자는 줄무늬), 벽걸이 홈 허브 태블릿(시안),
 * 양문 냉장고(작은 패널 화면 그린 + 컬러 자석), 구석 분리수거함(맨 밑 종이 상자 모서리만).
 *
 * 핫스팟: h1 태블릿 (70,30) · h2 분리수거함 (85,78) · h3 냉장고 자석 (20,45) · h4 디저트 접시 (45,65)
 */
import { C, useSvgIds } from '../palette';
import { Bars, CoveLed, Glow, HubTablet, LedDot, RainOnGlass, SceneDefs, SceneSvg, SkyGradient, Vignette, CityNight } from './parts';
import type { SceneArtDef, SceneArtProps } from './types';

const VX = 750;
const VY = 330;
const fx = (xb: number, y: number) => VX + (xb - VX) * ((y - VY) / (1000 - VY));

export function KitchenArt({ idScope, rain = true, className, fit }: SceneArtProps) {
  const ids = useSvgIds('kitchen', idScope);
  // 바닥 타일 줄
  let tiles = '';
  for (let i = -6; i <= 12; i++) {
    const xb = i * 180;
    tiles += `M${Math.round(fx(xb, 700))} 700L${xb} 1000`;
  }
  [728, 768, 826, 906].forEach((y) => (tiles += `M0 ${y}H1500`));
  const plates: [number, number, number][] = [
    [585, 628, 44],
    [672, 618, 40],
    [760, 630, 46],
    [640, 656, 42],
    [726, 660, 38],
  ];
  return (
    <SceneSvg art="kitchen" className={className} fit={fit}>
      <SceneDefs ids={ids}>
        <SkyGradient ids={ids} top="#0A1224" bottom="#1E2C4E" />
        <linearGradient id={ids.id('wall')} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#1A1B2A" />
          <stop offset="1" stopColor="#2B2733" />
        </linearGradient>
        <linearGradient id={ids.id('splash')} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#FFE9C7" stopOpacity="0.38" />
          <stop offset="0.5" stopColor="#FFE9C7" stopOpacity="0.12" />
          <stop offset="1" stopColor="#FFE9C7" stopOpacity="0.03" />
        </linearGradient>
        <linearGradient id={ids.id('steel')} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#6B7488" />
          <stop offset="0.45" stopColor="#4C5468" />
          <stop offset="1" stopColor="#323848" />
        </linearGradient>
        <linearGradient id={ids.id('floor')} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#2A2526" />
          <stop offset="1" stopColor="#3E3532" />
        </linearGradient>
        <linearGradient id={ids.id('isle')} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#3B2B22" />
          <stop offset="1" stopColor="#24190F" />
        </linearGradient>
      </SceneDefs>

      {/* ② 벽 · 바닥 */}
      <rect width={1500} height={1000} fill={C.wall0} />
      <rect y={30} width={1500} height={680} fill={ids.url('wall')} />
      <rect width={1500} height={34} fill="#0A0C16" />
      <CoveLed ids={ids} x={0} y={30} w={1500} />
      <path d="M0 700H1500V1000H0Z" fill={ids.url('floor')} />
      <path d={tiles} stroke="#1E1A1B" strokeWidth={2.5} fill="none" opacity={0.9} />

      {/* ① 창(오른쪽) */}
      <CityNight ids={ids} x={1190} y={80} w={260} h={360} seed={21} river={0.72} bridge={false} />
      <RainOnGlass ids={ids} name="win" x={1190} y={80} w={260} h={360} n={16} seed={8} rain={rain} />
      <g fill="#14131E">
        <rect x={1180} y={70} width={280} height={12} />
        <rect x={1180} y={438} width={280} height={16} />
        <rect x={1180} y={70} width={12} height={384} />
        <rect x={1448} y={70} width={12} height={384} />
        <rect x={1314} y={70} width={8} height={384} />
      </g>

      {/* 위 수납장 */}
      <g>
        <rect x={500} y={60} width={660} height={170} rx={4} fill="#2C2630" />
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <rect x={508 + i * 163} y={68} width={155} height={154} rx={3} fill="#383140" />
            <rect x={508 + i * 163 + (i % 2 ? 12 : 131)} y={190} width={12} height={4} rx={2} fill="#B9A88A" />
          </g>
        ))}
        <rect x={500} y={226} width={660} height={8} fill="#FFE9C7" opacity={0.9} />
      </g>
      {/* 백스플래시 · 조리대 */}
      <rect x={500} y={234} width={680} height={316} fill="#3A3138" />
      <path
        d={Array.from({ length: 10 }, (_, k) => `M500 ${234 + k * 32}H1180`).join('') + Array.from({ length: 12 }, (_, k) => `M${500 + k * 60} 234V550`).join('')}
        stroke="#2A2329"
        strokeWidth={2}
      />
      <rect x={500} y={234} width={680} height={316} fill={ids.url('splash')} />
      <rect x={480} y={546} width={980} height={18} fill="#CFC6BA" />
      <rect x={480} y={564} width={980} height={140} fill="#2A2228" />
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x={490 + i * 194} y={574} width={186} height={124} rx={3} fill="#342B32" />
      ))}

      {/* 조리대 위 장식: 커피머신 · 주전자 · 허브 화분 */}
      <g>
        <rect x={560} y={440} width={80} height={106} rx={8} fill="#22202A" />
        <rect x={572} y={452} width={56} height={22} rx={4} fill="#0C1A26" />
        <circle cx={612} cy={463} r={4} fill={C.amber} />
        <rect x={584} y={500} width={32} height={30} rx={3} fill="#3C3846" />
        <path d="M700 546c-4 -46 8 -64 36 -64s40 18 36 64z" fill="#B8BFCC" />
        <path d="M772 498q26 0 22 26" stroke="#B8BFCC" strokeWidth={8} fill="none" />
        <rect x={726} y={474} width={20} height={10} rx={4} fill="#8890A0" />
        <rect x={830} y={514} width={46} height={32} rx={4} fill="#C99A6E" />
        <path d="M842 514c-10 -30 -2 -48 10 -60c4 22 6 40 -2 60zM858 514c6 -26 20 -40 34 -46c-8 20 -16 36 -26 46z" fill={C.plant2} />
      </g>

      {/* h1 홈 허브 태블릿 (70,30) */}
      <HubTablet ids={ids} x={968} y={244} w={168} h={116} />

      {/* h3 양문 냉장고 (20,45) */}
      <g>
        <ellipse cx={300} cy={806} rx={200} ry={14} fill="#000" opacity={0.4} />
        <rect x={120} y={96} width={360} height={708} rx={10} fill={ids.url('steel')} />
        <rect x={128} y={104} width={168} height={692} rx={6} fill="#5B6478" />
        <rect x={304} y={104} width={168} height={692} rx={6} fill="#495266" />
        <rect x={128} y={104} width={168} height={692} rx={6} fill="#FFFFFF" opacity={0.04} />
        {/* 손잡이 */}
        <rect x={278} y={300} width={8} height={240} rx={4} fill="#9AA3B6" />
        <rect x={314} y={300} width={8} height={240} rx={4} fill="#7E879A" />
        {/* 패널 화면(그린) */}
        <Glow ids={ids} tone="green" cx={212} cy={226} rx={90} ry={60} o={0.35} />
        <rect x={168} y={194} width={88} height={62} rx={6} fill="#0B2A1F" />
        <rect x={178} y={204} width={36} height={6} rx={3} fill={C.green} />
        <rect x={178} y={218} width={58} height={4} rx={2} fill={C.green} opacity={0.6} />
        <rect x={178} y={228} width={46} height={4} rx={2} fill={C.green} opacity={0.6} />
        <circle cx={240} cy={244} r={4} fill={C.green} />
        {/* 자석 + 통지서(글자 대신 줄무늬) */}
        <g>
          <rect x={250} y={410} width={92} height={118} rx={2} fill="#EDE8DE" transform="rotate(-3 296 469)" />
          <g transform="rotate(-3 296 469)">
            <Bars x={260} y={430} w={70} rows={6} gap={13} th={4} c="#8E8A82" seed={31} />
          </g>
          <rect x={288} y={398} width={22} height={18} rx={4} fill={C.pink} />
          <rect x={196} y={392} width={34} height={22} rx={5} fill={C.amber} />
          <rect x={206} y={470} width={26} height={26} rx={13} fill={C.cyan} />
          <rect x={352} y={430} width={30} height={20} rx={4} fill={C.green} />
          <rect x={366} y={488} width={24} height={30} rx={4} fill="#A98BFF" />
          <rect x={176} y={530} width={40} height={14} rx={4} fill="#FF8F6B" />
          <path d="M196 392l4 -4h26l4 4" fill="none" stroke="#FFFFFF" strokeOpacity={0.4} strokeWidth={2} />
        </g>
        {/* 림 */}
        <path d="M480 106V794" stroke={C.cyan} strokeWidth={3} opacity={0.35} />
        <LedDot ids={ids} x={450} y={130} tone="green" r={3} />
      </g>

      {/* 펜던트 조명 3 */}
      {[540, 690, 840].map((x) => (
        <g key={x}>
          <path d={`M${x} 34V250`} stroke="#0E0F18" strokeWidth={2} />
          <path d={`M${x - 30} 290q30 -50 60 0z`} fill="#C9A06B" />
          <path d={`M${x - 30} 290h60`} stroke="#FFE9C7" strokeWidth={4} />
          <Glow ids={ids} tone="amber" cx={x} cy={300} rx={130} ry={90} o={0.5} />
        </g>
      ))}
      <Glow ids={ids} tone="amber" cx={690} cy={630} rx={420} ry={110} o={0.45} />
      <Glow ids={ids} tone="amber" cx={820} cy={400} rx={560} ry={260} o={0.18} />

      {/* 아일랜드 식탁 */}
      <g>
        <ellipse cx={690} cy={884} rx={360} ry={22} fill="#000" opacity={0.45} />
        <path d="M392 598H988L1012 664H368Z" fill="#E3DCD0" />
        <path d="M392 598H988" stroke="#FFFFFF" strokeWidth={2} opacity={0.6} />
        <path d="M368 664H1012V680H368Z" fill="#B9B0A2" />
        <path d="M376 680H1004V872H376Z" fill={ids.url('isle')} />
        {[0, 1, 2, 3].map((i) => (
          <path key={i} d={`M${376 + i * 157} 684V870`} stroke="#1A120C" strokeWidth={3} />
        ))}
        <path d="M376 690H1004" stroke="#FFE9C7" strokeWidth={2} opacity={0.3} />
        {/* h4 디저트 접시 (45,65) */}
        {plates.map(([x, y, r], i) => (
          <g key={i}>
            <ellipse cx={x} cy={y + 4} rx={r} ry={r * 0.32} fill="#000" opacity={0.2} />
            <ellipse cx={x} cy={y} rx={r} ry={r * 0.32} fill="#F7F3EC" />
            <ellipse cx={x} cy={y - 1} rx={r * 0.7} ry={r * 0.22} fill="#E7E0D4" />
            <rect x={x - r * 0.42} y={y - r * 0.28} width={r * 0.84} height={r * 0.3} rx={4} fill="#4A2A1A" />
            <rect x={x - r * 0.42} y={y - r * 0.28} width={r * 0.84} height={4} rx={2} fill="#6B3F27" />
            <path d={`M${x - r * 0.3} ${y - r * 0.14}h${r * 0.16}m${r * 0.06} 0h${r * 0.2}m${r * 0.06} 0h${r * 0.12}`} stroke="#E9C9A0" strokeWidth={2.4} strokeLinecap="round" />
          </g>
        ))}
        {/* 작은 케이크 돔(장식) */}
        <ellipse cx={872} cy={622} rx={40} ry={11} fill="#D8D2C8" />
        <path d="M838 620q34 -64 68 0z" fill="#CFE6FF" opacity={0.28} />
        <path d="M846 620v-14q26 -10 52 0v14z" fill="#F0D9B8" />
        <path d="M846 606q26 -10 52 0" stroke="#E36C8C" strokeWidth={4} fill="none" />
        <path d="M852 588q20 -26 40 0" stroke="#FFFFFF" strokeWidth={2.5} opacity={0.45} fill="none" />
      </g>
      {/* 바 스툴 2(장식) */}
      {[470, 910].map((x) => (
        <g key={x}>
          <ellipse cx={x} cy={772} rx={58} ry={14} fill="#1E1A1F" />
          <rect x={x - 5} y={776} width={10} height={170} fill="#15131A" />
          <ellipse cx={x} cy={950} rx={44} ry={9} fill="#0F0D12" />
          <path d={`M${x - 56} 770q56 -14 112 0`} stroke="#FFE9C7" strokeWidth={2} opacity={0.35} fill="none" />
        </g>
      ))}

      {/* h2 분리수거함 (85,78) */}
      <g>
        <ellipse cx={1290} cy={890} rx={170} ry={14} fill="#000" opacity={0.45} />
        {[
          [1140, '#3E5E8A', '#2F4A6E'],
          [1236, '#3F7A62', '#2E5C49'],
          [1332, '#6A6E7C', '#50535F'],
        ].map(([x, a, b]) => (
          <g key={x as number}>
            <rect x={x as number} y={700} width={90} height={186} rx={8} fill={b as string} />
            <rect x={(x as number) + 4} y={704} width={36} height={178} rx={6} fill={a as string} opacity={0.7} />
          </g>
        ))}
        {/* 가운데 통: 뚜껑 열림 + 종이류 + 맨 밑 상자 모서리 */}
        <path d="M1232 700l96 -20l4 14l-96 20z" fill="#4E8A70" />
        <path d="M1244 702l18 -26l24 10l16 -18l22 26z" fill="#D9CFBE" />
        <path d="M1258 688l30 -6v14l-30 6z" fill="#BFB4A0" />
        <rect x={1244} y={820} width={74} height={56} rx={4} fill="#1F3B30" opacity={0.6} />
        <path d="M1250 846l40 -12l22 8l-40 14z" fill="#B8874E" />
        <path d="M1250 846v18l22 6v-16z" fill="#8E6438" />
        <path d="M1272 854l40 -14v18l-40 16z" fill="#A17444" />
        {/* 재활용 표식 대신 단순 도형 */}
        <circle cx={1185} cy={760} r={12} fill="none" stroke="#9FC0E8" strokeWidth={3} opacity={0.6} />
        <path d="M1272 752l9 -14l9 14z" fill="none" stroke="#A8E0C4" strokeWidth={3} opacity={0.6} />
        <rect x={1366} y={748} width={22} height={22} rx={3} fill="none" stroke="#C4C8D4" strokeWidth={3} opacity={0.6} />
      </g>

      <LedDot ids={ids} x={1150} y={232} tone="cyan" r={3} />
      <Vignette ids={ids} />
    </SceneSvg>
  );
}

export const sceneKitchen: SceneArtDef = {
  key: 'kitchen',
  name: '주방',
  Art: KitchenArt,
  anchors: { 'L1.h1': [70, 30], 'L1.h2': [85, 78], 'L1.h3': [20, 45], 'L1.h4': [45, 65] },
  tone: '#3A3138',
};
