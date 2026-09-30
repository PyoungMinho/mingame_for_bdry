/**
 * 씬 그룹 F — 인생 2회차 후반부(성공·가족·세무조사·병실). "추억 앨범" 실루엣 듀오톤.
 * penthouse(2020s 금빛+남색) · family_table(호박) · tax_office(회색+스탠드 노랑) · hospital_room(청록+창가 호박)
 */
import type { ComponentType } from 'react';
import { ApartmentBlock, Glow, Haze, Kid, PAL, Person, SceneSvg, Skyline, Sky, Vignette } from './primitives';

const UP = '#FF5A4E';

/** 한강뷰 펜트하우스 밤 — 혼자 창가에 선 사람 */
function Penthouse() {
  const lights = Array.from({ length: 44 }, (_, i) => 52 + i * 16);
  const refl = [120, 190, 262, 330, 410, 470, 540, 610, 690];
  return (
    <SceneSvg>
      <Sky id="rs-penthouse-wall" stops={[[0, '#05070F'], [1, '#0B1022']]} />
      {/* 통유리 너머 밤하늘 */}
      <Sky id="rs-penthouse-sky" x={40} y={30} w={720} h={200} stops={[[0, '#060A1E'], [0.6, '#1A2150'], [0.9, '#4A3A62'], [1, '#8A5E58']]} />
      <Glow id="rs-penthouse-city" cx={420} cy={228} r={300} color="#FFB45A" opacity={0.28} />
      <Skyline x0={40} x1={760} base={226} minH={12} maxH={62} seed={31} fill="#12173A" win="#FFC878" litRatio={0.1} tower={640} />
      {/* 한강 */}
      <Sky id="rs-penthouse-river" x={40} y={226} w={720} h={104} stops={[[0, '#1A1E44'], [0.4, '#0C1030'], [1, '#050716']]} />
      <g className="zs-shimmer">
        {refl.map((x, i) => (
          <rect key={x} x={x} y={250 + (i % 3) * 6} width={3 + (i % 2) * 2} height={46 + (i % 4) * 10} fill={i % 3 === 0 ? '#5EE6E0' : '#FFC878'} opacity={0.45} />
        ))}
        {lights.filter((_, i) => i % 2 === 0).map((x, i) => (
          <rect key={`r${x}`} x={x - 3} y={272 + (i % 3) * 9} width={7} height={2} fill={i % 4 === 0 ? '#6FF0E8' : '#FFD58A'} opacity={0.4} />
        ))}
      </g>
      {/* 다리 — 교각 아치 + 조명 줄 */}
      <g>
        <rect x={40} y={240} width={720} height={5} fill="#070918" />
        <path d={Array.from({ length: 12 }, (_, i) => `M${40 + i * 60} 262 Q${70 + i * 60} 238 ${100 + i * 60} 262`).join(' ')} stroke="#070918" strokeWidth={3} fill="none" />
        {Array.from({ length: 13 }, (_, i) => (
          <rect key={i} x={38 + i * 60} y={243} width={5} height={22} fill="#070918" />
        ))}
        {lights.map((x, i) => (
          <circle key={x} cx={x} cy={239} r={1.8} fill={i % 4 === 0 ? '#6FF0E8' : '#FFD58A'} />
        ))}
      </g>
      <Haze id="rs-penthouse-mist" y={196} h={70} color="#8A6A8A" opacity={0.25} />
      {/* 창틀 */}
      <g fill={PAL.ink}>
        <rect x={34} y={24} width={732} height={8} />
        {[34, 214, 394, 574, 754].map((x) => (
          <rect key={x} x={x} y={24} width={12} height={310} />
        ))}
      </g>
      {/* 바닥 — 창 반사 */}
      <Sky id="rs-penthouse-floor" y={330} h={120} stops={[[0, '#141A34'], [0.35, '#0A0E1E'], [1, '#040610']]} />
      <ellipse cx={200} cy={390} rx={130} ry={10} fill="#FFB45A" opacity={0.1} />
      <path d="M40 336 H760" stroke="#FFC878" strokeOpacity={0.12} strokeWidth={2} />
      {/* 금빛 펜던트 조명 */}
      <Glow id="rs-penthouse-pend" cx={150} cy={110} r={250} color="#FFB45A" opacity={0.55} className="zs-glow" />
      <path d="M150 0 V88" stroke="#1A1408" strokeWidth={2} />
      <path d="M126 104 L174 104 L162 86 L138 86 Z" fill="#C8903A" />
      <ellipse cx={150} cy={105} rx={24} ry={3} fill="#FFE2A8" />
      {/* 낮은 소파(뒷모습) + 협탁 */}
      <g fill="#07080F">
        <rect x={70} y={318} width={250} height={62} rx={16} />
        <rect x={60} y={300} width={34} height={80} rx={14} />
        <rect x={296} y={300} width={34} height={80} rx={14} />
      </g>
      <path d="M86 318 H304" stroke="#FFB45A" strokeOpacity={0.4} strokeWidth={2} />
      {/* 화분 */}
      <g fill="#05060C">
        <path d="M688 400 L720 400 L714 360 L694 360 Z" />
        <ellipse cx={690} cy={318} rx={26} ry={12} transform="rotate(-30 690 318)" />
        <ellipse cx={722} cy={300} rx={24} ry={11} transform="rotate(35 722 300)" />
        <ellipse cx={700} cy={280} rx={20} ry={10} transform="rotate(-70 700 280)" />
      </g>
      {/* 창가에 선 사람 — 금빛 림라이트 */}
      <Glow id="rs-penthouse-rim" cx={492} cy={260} r={120} color="#FFC878" opacity={0.3} />
      <Person x={488} y={372} s={2} pose="stand" pack={false} fill="#03040A" />
      <path d="M502 200 C510 214 514 250 514 292" stroke="#FFC878" strokeOpacity={0.22} strokeWidth={2} fill="none" />
      <ellipse cx={494} cy={374} rx={46} ry={5} fill="#000" opacity={0.6} />
      <Vignette id="rs-penthouse-vig" strength={0.8} />
    </SceneSvg>
  );
}

/** 명절 가족 식탁 — 따뜻한 호박색, 행복한 엔딩 */
function FamilyTable() {
  const songpyeon = ['#F2EAD8', '#A8C878', '#E8A6B4', '#F2EAD8', '#A8C878'];
  return (
    <SceneSvg>
      <Sky id="rs-family_table-wall" stops={[[0, '#1E1008'], [0.55, '#452812'], [1, '#2C190A']]} />
      <rect x={0} y={352} width={800} height={98} fill="#5A3C18" />
      <Sky id="rs-family_table-floor" y={352} h={98} stops={[[0, 'rgba(255,190,110,0.22)'], [1, 'rgba(10,6,2,0.85)']]} />
      {/* 창밖 저녁 */}
      <Sky id="rs-family_table-dusk" x={50} y={70} w={180} h={170} stops={[[0, '#2A2448'], [0.55, '#8A4A56'], [1, '#E88A4A']]} />
      <ApartmentBlock x={60} y={240} w={70} h={96} floors={10} cols={4} fill="#1A1220" seed={12} litRatio={0.3} win="#FFD48A" />
      <ApartmentBlock x={146} y={240} w={80} h={76} floors={8} cols={4} fill="#160F1C" seed={5} litRatio={0.28} win="#FFD48A" />
      <g fill="#241408">
        <rect x={42} y={62} width={196} height={10} />
        <rect x={42} y={236} width={196} height={12} />
        <rect x={42} y={62} width={10} height={186} />
        <rect x={228} y={62} width={10} height={186} />
        <rect x={136} y={62} width={6} height={186} />
      </g>
      {/* 벽 달력 — 추석 */}
      <rect x={632} y={70} width={70} height={86} fill="#E9DDC2" opacity={0.85} />
      <rect x={632} y={70} width={70} height={20} fill="#B8322A" opacity={0.85} />
      <text x={667} y={85} textAnchor="middle" fontSize={12} fontWeight={800} fill="#fff">9월</text>
      <text x={667} y={124} textAnchor="middle" fontSize={24} fontWeight={800} fill="#B8322A">추석</text>
      <circle cx={667} cy={140} r={6} fill="none" stroke="#B8322A" strokeWidth={2} />
      {/* 펜던트 등 */}
      <Glow id="rs-family_table-lamp" cx={400} cy={200} r={330} color="#FFB060" opacity={0.6} className="zs-glow" />
      <path d="M400 0 V128" stroke="#1A0E06" strokeWidth={2} />
      <path d="M360 158 L440 158 L420 126 L380 126 Z" fill="#8A5A24" />
      <ellipse cx={400} cy={159} rx={40} ry={5} fill="#FFE0A0" />
      {/* 상 뒤로 둘러앉은 가족 */}
      <Person x={296} y={350} s={1.55} pose="sit" pack={false} fill="#120904" />
      <Person x={504} y={350} s={1.55} pose="sit" pack={false} fill="#120904" flip />
      <Kid x={400} y={348} s={1.75} pose="cheer" pack={false} fill="#0E0703" className="zs-bob" />
      {/* 양 끝 — 할아버지(왼쪽), 할머니(오른쪽) */}
      <Person x={150} y={402} s={1.45} pose="sit" pack={false} fill="#0B0603" />
      <path d="M112 402 V300 q0 -10 10 -10 q8 0 8 8" stroke="#0B0603" strokeWidth={4} fill="none" strokeLinecap="round" />
      <Person x={650} y={402} s={1.45} pose="sit" pack={false} fill="#0B0603" flip />
      <circle cx={661} cy={305} r={6} fill="#0B0603" />
      {/* 상 */}
      <path d="M210 318 L590 318 L626 344 L174 344 Z" fill="#6A3E16" />
      <rect x={174} y={344} width={452} height={12} fill="#2A1606" />
      <rect x={196} y={356} width={12} height={40} fill="#1E1004" />
      <rect x={592} y={356} width={12} height={40} fill="#1E1004" />
      {/* 전 · 송편 · 과일 · 식혜 */}
      <ellipse cx={270} cy={328} rx={40} ry={9} fill="#EADBB8" />
      {[250, 270, 290].map((x) => (
        <ellipse key={x} cx={x} cy={325} rx={11} ry={5} fill="#E0A83C" />
      ))}
      <ellipse cx={360} cy={330} rx={38} ry={9} fill="#EADBB8" />
      {songpyeon.map((c, i) => (
        <path key={i} d={`M${334 + i * 11} 328 a6 5 0 0 1 12 0 Z`} fill={c} />
      ))}
      <ellipse cx={450} cy={330} rx={36} ry={9} fill="#EADBB8" />
      <circle cx={438} cy={320} r={9} fill="#C8382A" />
      <circle cx={456} cy={318} r={9} fill="#D8B45A" />
      <circle cx={447} cy={308} r={8} fill="#C8382A" />
      <ellipse cx={530} cy={330} rx={30} ry={8} fill="#EADBB8" />
      <path d="M516 320 L544 320 L540 330 L520 330 Z" fill="#F0E2C0" />
      <ellipse cx={530} cy={320} rx={14} ry={3} fill="#D8C090" />
      <g className="zs-rise" opacity={0.3}>
        <path d="M262 312 q-6 -10 0 -20 q6 -10 0 -20 M282 312 q-6 -10 0 -20 q6 -10 0 -20" stroke="#FFE8C0" strokeWidth={2} fill="none" />
      </g>
      <Haze id="rs-family_table-haze" y={250} h={160} color="#FFB060" opacity={0.1} />
      <Vignette id="rs-family_table-vig" strength={0.7} />
    </SceneSvg>
  );
}

/** 세무조사 — 서류 박스 더미, 스탠드 하나, 조사관 둘 vs 앉은 사람 */
function TaxOffice() {
  const lapel = (x: number, y: number, s: number) => (
    <g>
      <path d={`M${x - 5 * s} ${y - 78 * s} L${x} ${y - 62 * s} L${x + 5 * s} ${y - 78 * s} Z`} fill="#B8BEC4" opacity={0.7} />
      <path d={`M${x - 1.2 * s} ${y - 76 * s} L${x + 1.2 * s} ${y - 76 * s} L${x} ${y - 64 * s} Z`} fill="#050608" />
    </g>
  );
  const box = (x: number, y: number, w: number, h: number, label?: string) => (
    <g key={`${x}-${y}`}>
      <rect x={x} y={y} width={w} height={h} fill="#2E2418" />
      <rect x={x} y={y} width={w} height={6} fill="#4A3A26" />
      {label && (
        <>
          <rect x={x + w / 2 - 26} y={y + h / 2 - 9} width={52} height={20} fill="#D8D2C0" opacity={0.7} />
          <text x={x + w / 2} y={y + h / 2 + 6} textAnchor="middle" fontSize={13} fontWeight={800} fill="#222">{label}</text>
        </>
      )}
    </g>
  );
  return (
    <SceneSvg>
      <Sky id="rs-tax_office-wall" stops={[[0, '#06080B'], [0.6, '#12161B'], [1, '#0A0C0F']]} />
      <rect x={0} y={372} width={800} height={78} fill="#07080A" />
      {/* 블라인드 창 — 차가운 밤 가로등 빛 */}
      <Glow id="rs-tax_office-cold" cx={560} cy={120} r={170} color="#7A9CC0" opacity={0.25} />
      <rect x={460} y={50} width={200} height={140} fill="#6A88A8" opacity={0.55} />
      {Array.from({ length: 12 }, (_, i) => (
        <rect key={i} x={460} y={54 + i * 11.5} width={200} height={5} fill="#12161A" />
      ))}
      <rect x={454} y={44} width={212} height={152} fill="none" stroke="#0A0C0E" strokeWidth={8} />
      {/* 화이트보드 — 추징 ▲ */}
      <rect x={226} y={60} width={190} height={110} fill="#9A9486" opacity={0.42} />
      <text x={242} y={88} fontSize={17} fontWeight={800} fill="#1A1C1E">추징세액</text>
      <text x={400} y={88} textAnchor="end" fontSize={17} fontWeight={800} fill={UP}>▲</text>
      <path d="M244 156 L280 146 L310 134 L346 116 L396 98" stroke={UP} strokeWidth={3} fill="none" />
      {/* 서류 박스 산 */}
      {box(16, 300, 120, 76, '영수증')}
      {box(28, 226, 104, 74, '2019')}
      {box(44, 158, 84, 68)}
      {/* 스탠드 광원 */}
      <Glow id="rs-tax_office-lamp" cx={436} cy={290} r={250} color="#FFC870" opacity={0.7} className="zs-glow" />
      <polygon points="452,244 360,312 520,312" fill="#FFE2A0" opacity={0.22} />
      {/* 책상 */}
      <rect x={290} y={312} width={390} height={10} fill="#3A4048" />
      <rect x={302} y={322} width={366} height={58} fill="#16191D" />
      {/* 파일 더미 */}
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <rect key={i} x={310 + (i % 2) * 4} y={302 - i * 9} width={70} height={8} fill={i % 2 ? '#C8C0A8' : '#E6DEC6'} />
      ))}
      {[0, 1, 2, 3].map((i) => (
        <rect key={`b${i}`} x={384 + (i % 2) * 3} y={302 - i * 9} width={50} height={8} fill={i % 2 ? '#8A9AA8' : '#D8D0B8'} />
      ))}
      <path d="M420 312 L428 312 L438 262 L460 236" stroke="#0A0B0C" strokeWidth={5} fill="none" strokeLinecap="round" />
      <path d="M446 226 L476 242 L466 256 L438 242 Z" fill="#2A2E32" />
      <ellipse cx={424} cy={312} rx={16} ry={3.5} fill="#0A0B0C" />
      {/* 조사관 둘 */}
      <g opacity={0.55}><Person x={558} y={391} s={1.9} pose="stand" pack={false} fill="#FFC870" flip /></g>
      <Person x={560} y={392} s={1.9} pose="stand" pack={false} fill="#050608" flip />
      {lapel(558.5, 392, 1.9)}
      <g opacity={0.55}><Person x={658} y={385} s={1.8} pose="stand" pack={false} fill="#B89060" flip /></g>
      <Person x={660} y={386} s={1.8} pose="stand" pack={false} fill="#08090B" flip />
      {lapel(658.5, 386, 1.8)}
      <rect x={624} y={296} width={20} height={28} fill="#C8C0A8" transform="rotate(-10 634 310)" />
      {box(478, 272, 58, 40, '장부')}
      {/* 맞은편 의자에 앉은 사람 + 식은땀 */}
      <rect x={180} y={300} width={10} height={96} rx={3} fill="#060708" />
      <rect x={184} y={380} width={50} height={8} fill="#060708" />
      <g opacity={0.55}><Person x={206} y={383} s={1.65} pose="sit" pack={false} fill="#FFC870" /></g>
      <Person x={204} y={384} s={1.65} pose="sit" pack={false} fill="#040506" />
      <path d="M226 256 q5 8 0 12 q-5 -4 0 -12 Z" fill="#9FD4FF" opacity={0.9} />
      <Haze id="rs-tax_office-haze" y={260} h={150} color="#FFC870" opacity={0.1} />
      <Vignette id="rs-tax_office-vig" strength={0.85} />
    </SceneSvg>
  );
}

/** 병실 — 침대의 부모님, 링거, 창가 저녁빛, 보호자 의자 */
function HospitalRoom() {
  return (
    <SceneSvg>
      <Sky id="rs-hospital_room-wall" stops={[[0, '#10282A'], [0.6, '#2A5452'], [1, '#1A3838']]} />
      <rect x={0} y={362} width={800} height={88} fill="#0E1C1D" />
      {/* 창 — 저녁 */}
      <Sky id="rs-hospital_room-dusk" x={520} y={60} w={240} h={220} stops={[[0, '#3A4868'], [0.5, '#A8705A'], [1, '#F2A45A']]} />
      <Glow id="rs-hospital_room-sun" cx={640} cy={262} r={200} color="#FFB870" opacity={0.6} />
      <Skyline x0={520} x1={760} base={280} minH={16} maxH={70} seed={17} fill="#3A2A2E" />
      <g fill="#0A1415">
        <rect x={512} y={52} width={256} height={10} />
        <rect x={512} y={276} width={256} height={12} />
        <rect x={512} y={52} width={10} height={236} />
        <rect x={758} y={52} width={10} height={236} />
        <rect x={636} y={52} width={6} height={236} />
      </g>
      <g fill="#0A1415">
        <path d="M698 276 L712 276 L710 256 L700 256 Z" />
        <path d="M705 256 L698 236 M705 256 L706 230 M705 256 L714 238" stroke="#0A1415" strokeWidth={2} />
        <circle cx={698} cy={234} r={4} />
        <circle cx={706} cy={228} r={4} />
        <circle cx={715} cy={236} r={4} />
      </g>
      <path d="M740 52 L790 52 L800 360 L746 360 C752 280 738 180 740 52 Z" fill="#1A2E2E" />
      {/* 바닥에 드리운 창빛 */}
      <polygon points="520,362 760,362 700,450 380,450" fill="#FFB870" opacity={0.12} />
      <Glow id="rs-hospital_room-warm" cx={420} cy={300} r={320} color="#FFB870" opacity={0.18} />
      {/* 모니터 */}
      <rect x={118} y={120} width={92} height={62} rx={6} fill="#081012" />
      <g className="zs-glow">
        <rect x={124} y={126} width={80} height={50} fill="#082220" />
        <path d="M128 156 H146 L152 140 L158 168 L164 150 H200" stroke={PAL.exit} strokeWidth={2} fill="none" />
      </g>
      {/* 링거대 */}
      <rect x={106} y={100} width={4} height={264} fill="#081012" />
      <path d="M92 100 H124" stroke="#081012" strokeWidth={4} />
      <rect x={92} y={104} width={24} height={40} rx={6} fill="#CFE8E4" opacity={0.75} />
      <rect x={95} y={120} width={18} height={21} rx={4} fill="#9FD4CC" opacity={0.8} />
      <g className="zs-blink">
        <circle cx={104} cy={156} r={2.2} fill="#CFE8E4" />
      </g>
      <path d="M104 146 V170 C104 220 170 230 232 262" stroke="#9FC8C4" strokeOpacity={0.5} strokeWidth={1.6} fill="none" />
      <path d="M86 364 L128 364 M107 364 V352" stroke="#081012" strokeWidth={5} />
      {/* 침대 */}
      <rect x={176} y={214} width={12} height={150} rx={4} fill="#081012" />
      <rect x={186} y={292} width={300} height={22} fill="#C8D8D4" opacity={0.35} />
      <path d="M200 292 C204 272 220 262 262 264 L276 292 Z" fill="#DCE8E4" opacity={0.55} />
      <g transform="translate(404 290) rotate(-90)">
        <Person x={0} y={0} s={1.5} pose="stand" pack={false} fill="#0A1415" />
      </g>
      {/* 이불 — 가슴 아래를 덮는다 */}
      <path d="M284 278 C320 262 420 262 470 272 C486 276 490 290 488 314 L280 314 C276 300 278 286 284 278 Z" fill="#4E7070" />
      <path d="M284 278 C320 262 420 262 470 272" stroke="#FFC890" strokeOpacity={0.55} strokeWidth={2.5} fill="none" />
      <rect x={186} y={314} width={306} height={20} fill="#0A1415" />
      <rect x={478} y={250} width={12} height={114} rx={4} fill="#081012" />
      <circle cx={210} cy={356} r={7} fill="#081012" />
      <circle cx={462} cy={356} r={7} fill="#081012" />
      {/* 보호자 의자 — 창빛을 등진 실루엣 */}
      <Glow id="rs-hospital_room-rim" cx={600} cy={290} r={110} color="#FFB870" opacity={0.35} />
      <rect x={590} y={284} width={11} height={110} rx={3} fill="#050A0B" />
      <rect x={546} y={376} width={52} height={9} fill="#050A0B" />
      <Person x={578} y={382} s={1.75} pose="sit" pack={false} fill="#040809" flip />
      <path d="M590 280 C594 300 594 330 590 360" stroke="#FFC890" strokeOpacity={0.4} strokeWidth={2} fill="none" />
      <Haze id="rs-hospital_room-haze" y={240} h={160} color="#9FD4CC" opacity={0.07} />
      <Vignette id="rs-hospital_room-vig" strength={0.78} />
    </SceneSvg>
  );
}

export const sceneGroupF: Record<string, ComponentType> = {
  penthouse: Penthouse,
  family_table: FamilyTable,
  tax_office: TaxOffice,
  hospital_room: HospitalRoom,
};
