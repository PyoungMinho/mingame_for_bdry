/**
 * 씬 그룹 D — 2010년대 중후반 (원룸 코인, 인간 vs AI 대국, 한강 밤, 코인 광풍 지하철).
 * 톤: 2010년대 = 차가운 형광·스마트폰 빛, 원룸 코인 = 네온 청록. 시장 색은 한국식(상승 빨강 ▲, 하락 파랑 ▼).
 * oneroom_coin · alphago · hangang_night · coin_frenzy
 */
import type { ComponentType, ReactNode } from 'react';
import { Glow, Haze, Lamp, Person, SceneSvg, Skyline, Sky, Vignette, rng } from './primitives';

const UP = '#FF5A4E';
const DOWN = '#4E8CFF';

// ───────────── 로컬 도형 ─────────────

/** 추상 캔들 차트(결정론적). (x, y) = 왼쪽 아래. trend>0 이면 우상향 */
function Candles({ x, y, w, h, n, seed, trend = 0.1 }: { x: number; y: number; w: number; h: number; n: number; seed: number; trend?: number }) {
  const r = rng(seed);
  const cw = w / n;
  const out: ReactNode[] = [];
  let p = 0.18;
  for (let i = 0; i < n; i++) {
    const o = p;
    const c = Math.min(0.9, Math.max(0.06, p + (r() - 0.5 + trend) * 0.17));
    const hi = Math.min(1, Math.max(o, c) + r() * 0.07);
    const lo = Math.max(0, Math.min(o, c) - r() * 0.07);
    const col = c >= o ? UP : DOWN;
    const cx = x + cw * (i + 0.5);
    out.push(
      <g key={i} fill={col}>
        <rect x={cx - 0.7} y={y - hi * h} width={1.4} height={(hi - lo) * h} />
        <rect x={cx - cw * 0.32} y={y - Math.max(o, c) * h} width={cw * 0.64} height={Math.max(2, Math.abs(c - o) * h)} />
      </g>,
    );
    p = c;
  }
  return <g>{out}</g>;
}

// ───────────── oneroom_coin ─────────────

/** 원룸 새벽 3시. 모니터 캔들 차트의 청록 빛이 얼굴 윤곽을 그린다. */
function OneroomCoin() {
  const id = 'rs-oneroom_coin';
  const teal = '#3FF2DF';
  return (
    <SceneSvg>
      <Sky id={`${id}-wall`} stops={[[0, '#03080B'], [0.55, '#0A1C22'], [1, '#040A0D']]} />

      {/* 창밖 — 네온 도시 */}
      <defs>
        <clipPath id={`${id}-clip`}>
          <rect x={40} y={50} width={200} height={200} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id}-clip)`}>
        <Sky id={`${id}-night`} x={40} y={50} w={200} h={200} stops={[[0, '#0A0826'], [0.6, '#231A52'], [1, '#43286A']]} />
        <Glow id={`${id}-city`} cx={140} cy={255} r={160} color="#B45CFF" opacity={0.5} />
        <Skyline x0={30} x1={250} base={250} minH={70} maxH={165} seed={11} fill="#15113A" win={teal} litRatio={0.16} />
        <Skyline x0={30} x1={250} base={250} minH={20} maxH={80} seed={5} fill="#08061C" win="#FF7AD9" litRatio={0.1} />
      </g>
      <g fill="#020506">
        <rect x={32} y={42} width={216} height={9} />
        <rect x={32} y={249} width={216} height={11} />
        <rect x={32} y={42} width={9} height={218} />
        <rect x={239} y={42} width={9} height={218} />
        <rect x={137} y={42} width={6} height={218} />
      </g>
      <path d="M32 249 H248" stroke={teal} strokeOpacity={0.35} strokeWidth={1.5} />

      {/* 모니터 광원 */}
      <Glow id={`${id}-mglow`} cx={590} cy={200} r={320} color={teal} opacity={0.34} className="zs-glow" />
      <Glow id={`${id}-face`} cx={322} cy={212} r={70} color={teal} opacity={0.3} />

      {/* 의자 + 사람 */}
      <g fill="#030708">
        <rect x={250} y={240} width={16} height={122} rx={5} />
        <rect x={252} y={346} width={82} height={12} rx={4} />
        <rect x={290} y={358} width={7} height={62} />
        <path d="M258 424 L330 424" stroke="#030708" strokeWidth={6} strokeLinecap="round" />
      </g>
      <Person x={300} y={348} s={2.2} pose="sit" fill="#020405" pack={false} />
      <path d="M311 192 A16.5 19.8 0 0 1 313 226" fill="none" stroke={teal} strokeWidth={2.6} strokeOpacity={0.85} strokeLinecap="round" />
      <path d="M314 243 L329 280 L344 298" fill="none" stroke={teal} strokeWidth={1.8} strokeOpacity={0.5} strokeLinecap="round" />

      {/* 책상 */}
      <rect x={336} y={300} width={470} height={11} fill="#071215" />
      <path d="M336 300 H800" stroke={teal} strokeOpacity={0.45} strokeWidth={1.4} />
      <rect x={372} y={311} width={434} height={139} fill="#030809" />
      <Sky id={`${id}-desk`} x={372} y={311} w={434} h={60} stops={[[0, 'rgba(63,242,223,0.16)'], [1, 'rgba(63,242,223,0)']]} />

      {/* 모니터 — 캔들 차트 */}
      <rect x={580} y={278} width={22} height={22} fill="#05090B" />
      <rect x={552} y={296} width={78} height={5} rx={2} fill="#05090B" />
      <rect x={448} y={104} width={286} height={180} rx={6} fill="#04080A" />
      <rect x={457} y={113} width={268} height={162} fill="#051418" />
      <path d="M465 150 H717 M465 190 H717 M465 230 H717" stroke={teal} strokeOpacity={0.12} strokeWidth={1} />
      <Candles x={466} y={262} w={250} h={118} n={22} seed={7} trend={0.12} />
      <text x={465} y={131} fontSize={12} fontWeight={800} fill="#E6FFFB">
        코인 원화마켓
      </text>
      <text x={716} y={131} textAnchor="end" fontSize={12} fontWeight={800} fill={UP}>
        ▲ 18.4%
      </text>
      <text x={716} y={270} textAnchor="end" fontSize={9} fontWeight={700} fill={teal} opacity={0.7}>
        AM 03:12
      </text>

      {/* 모니터 베젤 포스트잇 */}
      <g transform="rotate(-6 470 100)">
        <rect x={452} y={88} width={40} height={34} fill="#E6DC78" opacity={0.9} />
        <text x={472} y={110} textAnchor="middle" fontSize={12} fontWeight={800} fill="#2A2A10">
          존버
        </text>
      </g>

      {/* 노트북 (오른쪽, 잘림) */}
      <path d="M742 214 L812 214 L812 294 L742 294 Z" fill="#04090B" />
      <rect x={748} y={220} width={60} height={68} fill="#0A2A2E" />
      <path d="M752 272 L766 262 L778 266 L792 244 L806 238" fill="none" stroke={UP} strokeWidth={2} />
      <path d="M734 300 L812 300 L812 296 L742 294 Z" fill="#0A1A1D" />

      {/* 컵라면 + 김 */}
      <path d="M396 272 H432 L428 300 H400 Z" fill="#0B2226" />
      <rect x={393} y={268} width={42} height={6} rx={2} fill="#123A3E" />
      <path d="M398 266 L440 250 M402 267 L442 256" stroke="#081618" strokeWidth={2.4} strokeLinecap="round" />
      <g className="zs-rise">
        <path d="M406 262 C400 250 412 242 406 228 M418 260 C412 246 424 238 418 222" fill="none" stroke="#BFFFF7" strokeOpacity={0.22} strokeWidth={2.5} strokeLinecap="round" />
      </g>

      {/* 침대 모서리 — 전경 */}
      <path d="M-10 400 C40 388 150 386 214 396 L222 460 H-10 Z" fill="#010304" />
      <path d="M-10 400 C40 388 150 386 214 396" fill="none" stroke={teal} strokeOpacity={0.18} strokeWidth={1.5} />

      <Haze id={`${id}-haze`} y={250} h={140} color={teal} opacity={0.06} />
      <Vignette id={`${id}-vig`} strength={0.8} />
    </SceneSvg>
  );
}

// ───────────── alphago ─────────────

/** 2016년 3월 카페 오후. 벽걸이 TV 속 바둑판을 모두가 올려다본다. */
function Alphago() {
  const id = 'rs-alphago';
  const r = rng(16);
  // 바둑판 9줄 격자 + 결정론적 돌 배치
  const gx = 563;
  const gy = 78;
  const step = 12.5;
  const grid = Array.from({ length: 9 }, (_, i) => `M${gx} ${gy + i * step} H${gx + 8 * step} M${gx + i * step} ${gy} V${gy + 8 * step}`).join(' ');
  const used = new Set<string>();
  const stones: ReactNode[] = [];
  for (let k = 0; k < 26; k++) {
    const i = Math.floor(r() * 9);
    const j = Math.floor(r() * 9);
    if (used.has(`${i}-${j}`)) continue;
    used.add(`${i}-${j}`);
    stones.push(<circle key={k} cx={gx + i * step} cy={gy + j * step} r={5.4} fill={k % 2 ? '#F4F1E8' : '#111'} stroke="#000" strokeOpacity={0.35} strokeWidth={0.6} />);
  }
  return (
    <SceneSvg>
      <Sky id={`${id}-wall`} stops={[[0, '#1A0F08'], [0.5, '#3A2414'], [1, '#26170C']]} />

      {/* 오후 창 */}
      <Glow id={`${id}-sun`} cx={120} cy={170} r={300} color="#FFB45E" opacity={0.55} />
      <Sky id={`${id}-win`} x={24} y={40} w={196} h={270} stops={[[0, '#FFE8B8'], [0.7, '#F6B870'], [1, '#D8883E']]} />
      <g fill="#C27A38" opacity={0.55}>
        <circle cx={70} cy={230} r={34} />
        <circle cx={110} cy={250} r={28} />
        <circle cx={180} cy={240} r={36} />
      </g>
      <g fill="#1E120A">
        <rect x={16} y={32} width={212} height={10} />
        <rect x={16} y={308} width={212} height={12} />
        <rect x={16} y={32} width={9} height={288} />
        <rect x={219} y={32} width={9} height={288} />
        <rect x={119} y={32} width={6} height={288} />
        <rect x={16} y={170} width={212} height={5} />
      </g>
      <polygon points="40,60 220,60 520,450 180,450" fill="#FFC47A" opacity={0.09} />

      {/* 메뉴 칠판 */}
      <rect x={282} y={76} width={128} height={78} rx={3} fill="#15100B" />
      <text x={346} y={98} textAnchor="middle" fontSize={12} fontWeight={800} fill="#E9DCC2" opacity={0.85}>
        오늘의 커피
      </text>
      <text x={294} y={120} fontSize={10} fontWeight={700} fill="#E9DCC2" opacity={0.6}>
        아메리카노 4.1
      </text>
      <text x={294} y={138} fontSize={10} fontWeight={700} fill="#E9DCC2" opacity={0.6}>
        카페라떼 4.6
      </text>

      {/* 바닥 */}
      <rect x={0} y={362} width={800} height={88} fill="#23160C" />
      <path d="M0 362 H800" stroke="#FFC47A" strokeOpacity={0.15} strokeWidth={1.5} />

      {/* TV — 백색 광원 */}
      <Glow id={`${id}-tv`} cx={606} cy={140} r={250} color="#E8F2FF" opacity={0.45} className="zs-glow" />
      <rect x={594} y={216} width={24} height={20} fill="#0D0906" />
      <rect x={470} y={58} width={272} height={160} rx={4} fill="#0A0806" />
      <rect x={478} y={66} width={256} height={144} fill="#1B2733" />
      <rect x={556} y={71} width={114} height={114} fill="#DDB66C" />
      <path d={grid} stroke="#3A2A12" strokeWidth={0.9} />
      {stones}
      <circle cx={gx + 5 * step} cy={gy + 3 * step} r={5.4} fill="#F4F1E8" />
      <circle cx={gx + 5 * step} cy={gy + 3 * step} r={9} fill="none" stroke={UP} strokeWidth={2} className="zs-blink" />
      <text x={516} y={96} textAnchor="middle" fontSize={15} fontWeight={800} fill="#fff">
        제4국
      </text>
      <circle cx={494} cy={120} r={6} fill="#111" stroke="#fff" strokeOpacity={0.4} />
      <text x={505} y={124} fontSize={10} fontWeight={700} fill="#DDE6F0">
        인간
      </text>
      <circle cx={494} cy={142} r={6} fill="#F4F1E8" />
      <text x={505} y={146} fontSize={10} fontWeight={700} fill="#DDE6F0">
        AI
      </text>
      <text x={702} y={92} textAnchor="middle" fontSize={10} fontWeight={800} fill={UP}>
        ● LIVE
      </text>
      <rect x={478} y={188} width={256} height={22} fill="#7E1612" />
      <text x={606} y={204} textAnchor="middle" fontSize={12} fontWeight={800} fill="#fff">
        인간 vs 인공지능 — 세기의 대국
      </text>

      {/* 올려다보는 사람들 */}
      <Person x={318} y={372} s={1.55} pose="stand" fill="#1A0F08" pack={false} />
      <Person x={384} y={374} s={1.75} pose="stand" fill="#140B06" pack />
      <Person x={446} y={372} s={1.6} pose="stand" fill="#170D07" pack={false} />
      <Person x={500} y={376} s={1.45} pose="walk" fill="#1C110A" pack={false} />

      {/* 전경 — 창가 테이블과 커피 */}
      <Person x={70} y={446} s={2.5} pose="sit" fill="#070403" pack={false} />
      <rect x={120} y={372} width={200} height={12} rx={4} fill="#0B0704" />
      <rect x={210} y={384} width={12} height={70} fill="#0B0704" />
      <g fill="#0B0704">
        <path d="M168 346 H194 L190 372 H172 Z" />
        <path d="M194 352 C204 352 204 366 192 366" fill="none" stroke="#0B0704" strokeWidth={3.4} />
        <path d="M244 352 H266 L263 372 H247 Z" />
      </g>
      <path d="M168 346 H194" stroke="#FFC47A" strokeOpacity={0.5} strokeWidth={1.5} />
      <g className="zs-rise">
        <path d="M176 340 C170 328 184 322 178 308 M186 340 C182 330 194 322 188 312" fill="none" stroke="#FFE2B0" strokeOpacity={0.25} strokeWidth={2.2} strokeLinecap="round" />
      </g>

      <Haze id={`${id}-haze`} y={250} h={160} color="#FFB45E" opacity={0.1} />
      <Vignette id={`${id}-vig`} strength={0.72} />
    </SceneSvg>
  );
}

// ───────────── hangang_night ─────────────

/** 한강 둔치 여름밤. 불 켜진 다리 아치, 강물의 빛기둥, 돗자리 위 치킨과 맥주. */
function HangangNight() {
  const id = 'rs-hangang_night';
  const gold = '#FFD98A';
  const piers = [-40, 130, 300, 470, 640, 810];
  const arches = piers.slice(0, -1).map((p, i) => `M${p} 226 Q${p + 85} ${162} ${piers[i + 1]} 226`).join(' ');
  const r = rng(33);
  const refl: ReactNode[] = [];
  const cols = [...piers.slice(0, -1).map((p) => p + 85), 60, 210, 380, 560, 720];
  cols.forEach((cx, i) => {
    const warm = i < 5;
    for (let k = 0; k < 7; k++) {
      const w = (warm ? 26 : 14) * (1 - k * 0.1) * (0.6 + r() * 0.5);
      refl.push(<rect key={`${i}-${k}`} x={cx - w / 2 + (r() - 0.5) * 8} y={246 + k * 13} width={w} height={2.2} fill={warm ? gold : '#8FB4FF'} opacity={(warm ? 0.7 : 0.45) * (1 - k * 0.11)} />);
    }
  });
  return (
    <SceneSvg>
      <Sky id={`${id}-sky`} h={250} stops={[[0, '#02040F'], [0.55, '#0A1438'], [1, '#243070']]} />
      <Glow id={`${id}-city`} cx={420} cy={250} r={380} color="#4A5CC0" opacity={0.35} />
      <Glow id={`${id}-moonglow`} cx={170} cy={78} r={90} color="#DDE6FF" opacity={0.35} />
      <circle cx={170} cy={78} r={17} fill="#F2F0E2" />
      <g fill="#DDE6FF">
        {[[60, 40], [300, 30], [420, 70], [520, 24], [700, 50], [760, 110], [250, 110]].map(([x, y]) => (
          <circle key={x} cx={x} cy={y} r={1.2} opacity={0.6} />
        ))}
      </g>
      <Skyline base={242} minH={20} maxH={95} seed={21} fill="#0A1030" win="#FFD48A" litRatio={0.1} tower={640} />
      <circle cx={640} cy={105} r={2.4} fill={UP} className="zs-blink" />

      {/* 강물 */}
      <Sky id={`${id}-river`} y={238} h={120} stops={[[0, '#16235A'], [0.4, '#0A123A'], [1, '#02040E']]} />

      {/* 다리 — 교각 + 조명 아치 */}
      <defs>
        <filter id={`${id}-blur`} x="-10%" y="-50%" width="120%" height="200%">
          <feGaussianBlur stdDeviation={5} />
        </filter>
      </defs>
      <g fill="#060A1E">
        {piers.map((p) => (
          <rect key={p} x={p - 7} y={226} width={14} height={22} />
        ))}
        <rect x={-20} y={222} width={840} height={8} />
      </g>
      <g className="zs-glow">
        <path d={arches} fill="none" stroke={gold} strokeWidth={10} opacity={0.55} filter={`url(#${id}-blur)`} />
      </g>
      <path d={arches} fill="none" stroke="#FFF1C8" strokeWidth={2.4} />
      <path d="M-20 222 H820" stroke={gold} strokeWidth={1.4} strokeDasharray="2 9" />
      <g className="zs-shimmer">
        {refl}
        <rect x={158} y={250} width={24} height={2.4} fill="#F2F0E2" opacity={0.5} />
        <rect x={162} y={264} width={16} height={2.2} fill="#F2F0E2" opacity={0.35} />
      </g>

      {/* 둔치 */}
      <Haze id={`${id}-mist`} y={300} h={70} color="#2A3C8A" opacity={0.35} />
      <path d="M0 352 C200 344 600 344 800 352 V450 H0 Z" fill="#03050C" />
      <path d="M0 352 C200 344 600 344 800 352" fill="none" stroke="#8FB4FF" strokeOpacity={0.25} strokeWidth={1.5} />
      <Lamp x={70} y={356} h={112} color="#FFE6B0" fill="#04060F" />
      <Lamp x={742} y={356} h={104} color="#FFE6B0" fill="#04060F" />
      <Glow id={`${id}-l1`} cx={93} cy={248} r={26} color="#FFE6B0" opacity={0.8} />
      <Glow id={`${id}-l2`} cx={765} cy={256} r={24} color="#FFE6B0" opacity={0.8} />

      {/* 돗자리 + 랜턴 빛 */}
      <Glow id={`${id}-lantern`} cx={420} cy={392} r={170} color="#FFC870" opacity={0.5} />
      <polygon points="240,388 590,388 640,446 196,446" fill="#23386A" />
      <path d="M298 388 L268 446 M356 388 L342 446 M414 388 L416 446 M472 388 L490 446 M530 388 L564 446 M232 404 H604 M222 420 H618" stroke="#0E1A3A" strokeWidth={3} />
      <rect x={410} y={376} width={16} height={20} rx={3} fill="#FFF3D0" />
      <rect x={412} y={372} width={12} height={5} rx={2} fill="#2A2A2A" />

      {/* 치킨 박스 + 맥주캔 */}
      <path d="M440 404 H500 L496 426 H444 Z" fill="#B87A36" />
      <path d="M440 404 L450 384 H510 L500 404 Z" fill="#8A5626" />
      <g fill="#E0A04E">
        <ellipse cx={456} cy={402} rx={9} ry={5} />
        <ellipse cx={472} cy={400} rx={10} ry={6} />
        <ellipse cx={489} cy={402} rx={8} ry={5} />
      </g>
      <g fill="#9FB8D8">
        <rect x={372} y={402} width={9} height={16} rx={2} />
        <rect x={386} y={406} width={9} height={16} rx={2} />
        <rect x={522} y={406} width={9} height={16} rx={2} />
      </g>

      {/* 사람들 */}
      <Person x={290} y={430} s={1.6} pose="sit" fill="#03050C" pack={false} />
      <Person x={560} y={432} s={1.65} pose="sit" fill="#03050C" pack={false} flip />
      <Person x={360} y={392} s={1.25} pose="sit" fill="#070A18" pack={false} />
      <path d="M303 339 A12 14.4 0 0 1 305 362" fill="none" stroke="#FFC870" strokeWidth={2} strokeOpacity={0.7} strokeLinecap="round" />
      <path d="M547 342 A12 14.4 0 0 0 545 365" fill="none" stroke="#FFC870" strokeWidth={2} strokeOpacity={0.7} strokeLinecap="round" />

      {/* 전경 풀 */}
      <path d="M0 450 L0 424 L12 440 L18 418 L28 442 L40 426 L48 450 Z M760 450 L768 428 L776 444 L786 420 L792 440 L800 430 V450 Z" fill="#010208" />
      <Vignette id={`${id}-vig`} strength={0.75} />
    </SceneSvg>
  );
}

// ───────────── coin_frenzy ─────────────

/** 2018년 1월 출근길 지하철. 형광등 아래 모두가 폰 속 빨간 차트를 본다. */
function CoinFrenzy() {
  const id = 'rs-coin_frenzy';
  const ink = '#030605';
  // 폰 위치 [x, y, 크기]
  const standers: [number, number, number, boolean][] = [
    [120, 460, 2.55, false],
    [300, 452, 2.7, true],
    [500, 462, 2.6, false],
    [680, 455, 2.65, true],
  ];
  const sitters: [number, number][] = [[70, 332], [210, 332], [400, 332], [590, 332], [760, 332]];
  const phones: [number, number, number][] = [
    ...standers.map(([x, y, s, f]): [number, number, number] => [x + (f ? -15 : 15) * s, y - 62 * s, s]),
    ...sitters.map(([x, y]): [number, number, number] => [x + 18 * 1.25, y - 32 * 1.25, 1.25]),
  ];
  return (
    <SceneSvg>
      <Sky id={`${id}-wall`} stops={[[0, '#DDF3EA'], [0.1, '#8FB3A8'], [0.45, '#4A6660'], [1, '#1A2825']]} />

      {/* 천장 형광등 */}
      <rect x={0} y={0} width={800} height={14} fill="#E9F7F1" />
      <g className="zs-flicker">
        <rect x={40} y={16} width={330} height={7} rx={3} fill="#FFFFFF" />
      </g>
      <rect x={430} y={16} width={330} height={7} rx={3} fill="#FFFFFF" />

      {/* 광고판 + 행선 LED */}
      <g>
        <rect x={30} y={36} width={220} height={52} fill="#F5E9E4" />
        <text x={44} y={60} fontSize={15} fontWeight={800} fill="#2A0E0C">
          지금 사도 안 늦었다?
        </text>
        <text x={44} y={80} fontSize={11} fontWeight={700} fill="#7A2A22">
          거래 수수료 0% 이벤트
        </text>
        <path d="M200 80 L212 70 L222 74 L240 48" fill="none" stroke={UP} strokeWidth={3} />
        <rect x={290} y={40} width={220} height={40} rx={3} fill="#070404" />
        <text x={400} y={66} textAnchor="middle" fontSize={14} fontWeight={800} fill="#FF9A2E">
          이번 역은 여의도
        </text>
        <rect x={550} y={36} width={220} height={52} fill="#241012" />
        <text x={566} y={70} fontSize={24} fontWeight={800} fill={UP}>
          가즈아 ▲▲
        </text>
      </g>

      {/* 창 — 터널 속도선 */}
      <rect x={0} y={100} width={800} height={126} fill="#040807" />
      <g className="zs-drift">
        <path d="M-20 130 H260 M340 150 H700 M60 176 H420 M500 196 H840 M-20 210 H180" stroke="#9FD8C8" strokeOpacity={0.18} strokeWidth={2} />
      </g>
      <g fill="#5E7C74">
        {[0, 196, 396, 596, 792].map((x) => (
          <rect key={x} x={x - 6} y={100} width={14} height={126} />
        ))}
        <rect x={0} y={96} width={800} height={6} />
        <rect x={0} y={224} width={800} height={6} />
      </g>

      {/* 좌석 + 앉은 승객 */}
      <rect x={0} y={260} width={800} height={42} rx={6} fill="#1C3A36" />
      <rect x={0} y={300} width={800} height={34} fill="#12302C" />
      <rect x={0} y={334} width={800} height={80} fill="#0E1715" />
      {sitters.map(([x, y], i) => (
        <Person key={i} x={x} y={y} s={1.25} pose="sit" fill="#16211E" pack={false} />
      ))}
      <rect x={0} y={400} width={800} height={50} fill="#0B1211" />

      {/* 손잡이 봉 */}
      <rect x={0} y={112} width={800} height={4} fill="#9DB5AE" />
      {[60, 200, 250, 420, 460, 620, 740].map((x) => (
        <g key={x} fill="none" stroke="#1E2A27" strokeWidth={3}>
          <path d={`M${x} 116 V150`} />
          <circle cx={x} cy={158} r={8} />
        </g>
      ))}

      {/* 서 있는 승객 — 폰을 든 실루엣 */}
      {standers.map(([x, y, s, f], i) => (
        <g key={i}>
          <Person x={x} y={y} s={s} pose="stand" fill={ink} pack={i % 2 === 0} flip={f} />
          <path
            d={`M${x + (f ? -10 : 10) * s} ${y - 58 * s} L${x + (f ? -15 : 15) * s} ${y - 62 * s}`}
            stroke={ink}
            strokeWidth={5.5 * s}
            strokeLinecap="round"
          />
        </g>
      ))}
      <path d={`M${300 - 7 * 2.7} ${452 - 75 * 2.7} L${300 - 12 * 2.7} 180 L${300 - 14 * 2.7} 160`} fill="none" stroke={ink} strokeWidth={15} strokeLinecap="round" />

      {/* 폰 화면 + 빨간 차트 빛 */}
      <defs>
        <radialGradient id={`${id}-phone`}>
          <stop offset="0" stopColor="#FF4A3E" stopOpacity={0.6} />
          <stop offset="0.45" stopColor="#FF4A3E" stopOpacity={0.2} />
          <stop offset="1" stopColor="#FF4A3E" stopOpacity={0} />
        </radialGradient>
      </defs>
      <g className="zs-glow">
        {phones.map(([x, y, s], i) => (
          <circle key={i} cx={x} cy={y} r={26 * s} fill={`url(#${id}-phone)`} />
        ))}
      </g>
      {phones.map(([x, y, s], i) => (
        <g key={i}>
          <rect x={x - 3 * s} y={y - 5 * s} width={6 * s} height={10 * s} rx={1.2} fill="#FFD6CF" />
          <path d={`M${x - 2 * s} ${y + 3 * s} L${x} ${y} L${x + 2 * s} ${y - 3 * s}`} fill="none" stroke={UP} strokeWidth={0.9 * s} />
        </g>
      ))}

      <Haze id={`${id}-haze`} y={220} h={140} color="#BFE8DA" opacity={0.1} />
      <Vignette id={`${id}-vig`} strength={0.7} />
    </SceneSvg>
  );
}

export const sceneGroupD: Record<string, ComponentType> = {
  oneroom_coin: OneroomCoin,
  alphago: Alphago,
  hangang_night: HangangNight,
  coin_frenzy: CoinFrenzy,
};
