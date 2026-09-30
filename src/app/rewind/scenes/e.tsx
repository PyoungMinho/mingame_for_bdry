/**
 * 씬 그룹 E — 2010~2020년대 어른의 시간. office_job · covid_street · apt_night · ai_boom
 * 톤: 2010년대 차가운 형광·모니터 빛 → 2020년대 회청·네온 청록/보라. 실루엣 레이어 + 1~2 광원.
 */
import type { ComponentType, ReactNode } from 'react';
import { ApartmentBlock, Glow, Haze, Lamp, PAL, Person, SceneSvg, Skyline, Sky, Tree, Vignette, rng } from './primitives';

/** Person(stand) 얼굴 위 마스크 — Person 과 같은 x·y·s·flip 으로 겹친다 */
function Mask({ x, y, s = 1, flip }: { x: number; y: number; s?: number; flip?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
      <path d="M-5 -93 L1 -88" stroke="#C9DCE2" strokeOpacity={0.5} strokeWidth={0.9} />
      <rect x={0.5} y={-89.5} width={9.5} height={7} rx={2.6} fill="#D6E6EA" opacity={0.88} />
    </g>
  );
}

// ─────────────────────────── office_job — 밤 11시 사무실 ───────────────────────────
function OfficeJob() {
  const mull = [30, 178, 326, 474, 622, 770];
  return (
    <SceneSvg>
      <Sky id="rs-office_job-wall" stops={[[0, '#070B12'], [0.6, '#0E1622'], [1, '#080C12']]} />
      {/* 창밖 도시 야경 */}
      <Sky id="rs-office_job-sky" x={30} y={34} w={740} h={206} stops={[[0, '#081226'], [0.7, '#1A2E4C'], [1, '#2E4468']]} />
      <Skyline x0={30} x1={770} base={240} minH={40} maxH={120} seed={21} fill="#101C30" win="#BFD8FF" litRatio={0.16} />
      <Skyline x0={30} x1={770} base={240} minH={14} maxH={60} seed={5} fill="#0A1322" win="#FFE2A8" litRatio={0.1} />
      <g fill="#05080D">
        {mull.map((x) => (
          <rect key={x} x={x - 5} y={30} width={10} height={214} />
        ))}
        <rect x={25} y={26} width={750} height={10} />
        <rect x={25} y={238} width={750} height={8} />
      </g>
      <rect x={0} y={246} width={800} height={204} fill="#070A10" />
      {/* 천장 형광등 — 하나만 켜져 있다 */}
      <g fill="#1A2330">
        <rect x={90} y={8} width={120} height={6} />
        <rect x={620} y={8} width={120} height={6} />
      </g>
      <g className="zs-flicker">
        <rect x={390} y={8} width={130} height={6} fill="#EAF4FF" />
        <polygon points="390,14 520,14 640,330 280,330" fill="#CFE4FF" opacity={0.05} />
      </g>
      {/* 뒷줄 파티션 — 모두 퇴근 */}
      <rect x={0} y={262} width={800} height={46} fill="#0C121B" />
      <path d="M0 262 H800" stroke="#6F8CB0" strokeOpacity={0.25} strokeWidth={1.5} />
      <g fill="#05080D">
        {[60, 170, 280, 620, 720].map((x) => (
          <rect key={x} x={x} y={238} width={44} height={26} rx={2} />
        ))}
      </g>
      <Haze id="rs-office_job-haze" y={220} h={110} color="#6C8EC0" opacity={0.12} />

      {/* 모니터 광원 */}
      <Glow id="rs-office_job-mon" cx={560} cy={270} r={290} color="#9FC8FF" opacity={0.6} className="zs-glow" />
      {/* 의자 + 야근하는 나 */}
      <rect x={366} y={250} width={20} height={96} rx={8} fill="#04060A" />
      <Person x={404} y={372} s={1.75} pose="sit" pack={false} fill="#03050A" />
      <path d="M414 247 C424 254 425 270 416 279" stroke="#CFE4FF" strokeOpacity={0.6} strokeWidth={2} fill="none" />
      <path d="M418 290 L440 330" stroke="#CFE4FF" strokeOpacity={0.3} strokeWidth={1.5} />
      <rect x={440} y={338} width={60} height={6} rx={1.5} fill="#8FB4E8" opacity={0.35} />
      {/* 모니터 — 화면이 보이게 비스듬히 */}
      <g>
        <rect x={546} y={316} width={12} height={30} fill="#05080D" />
        <rect x={520} y={342} width={64} height={6} fill="#05080D" />
        <rect x={488} y={210} width={150} height={110} rx={5} fill="#0A0F18" />
        <rect x={495} y={217} width={136} height={96} fill="#DDEBFF" />
        <rect x={495} y={217} width={136} height={12} fill="#3C6FB8" />
        <path
          d="M495 243 H631 M495 257 H631 M495 271 H631 M495 285 H631 M495 299 H631 M522 229 V313 M556 229 V313 M592 229 V313"
          stroke="#7A93B8"
          strokeOpacity={0.5}
          strokeWidth={0.8}
        />
        <rect x={522} y={271} width={34} height={14} fill="#FFE27A" opacity={0.8} />
        <rect x={622} y={220} width={20} height={18} fill="#FFD84A" opacity={0.9} transform="rotate(8 632 229)" />
      </g>
      <rect x={656} y={326} width={16} height={20} rx={2} fill="#05080D" />
      {/* 앞줄 파티션(다리를 가린다) + 빈 자리 */}
      <rect x={0} y={346} width={800} height={104} fill="#04070B" />
      <path d="M0 346 H800" stroke="#9FC8FF" strokeOpacity={0.4} strokeWidth={2} />
      <g fill="#020407">
        <rect x={60} y={300} width={80} height={48} rx={3} />
        <rect x={170} y={312} width={60} height={36} rx={3} />
        <rect x={0} y={200} width={28} height={250} />
        <rect x={766} y={210} width={34} height={240} />
      </g>
      <path d="M28 200 V450 M766 210 V450" stroke="#9FC8FF" strokeOpacity={0.12} strokeWidth={1.5} />
      <path d="M0 404 H800" stroke="#1A2536" strokeWidth={2} />
      <Glow id="rs-office_job-spill" cx={560} cy={350} r={170} color="#9FC8FF" opacity={0.14} />
      {/* 벽 시계 — 기둥 위 */}
      <g>
        <rect x={130} y={56} width={76} height={28} rx={3} fill="#05080D" />
        <text x={168} y={76} textAnchor="middle" fontSize={17} fontWeight={800} fill="#FF5A4E">
          23:48
        </text>
      </g>
      <Vignette id="rs-office_job-vig" strength={0.78} />
    </SceneSvg>
  );
}

// ─────────────────────────── covid_street — 2020 약국 앞 줄 ───────────────────────────
function CovidStreet() {
  // [x, 발 y, 크기, 밝기] — 약국 문 앞이 가깝고 왼쪽으로 멀어진다
  const queue: [number, number, number, number][] = [
    [150, 342, 0.7, 0.55],
    [232, 348, 0.8, 0.68],
    [328, 356, 0.92, 0.8],
    [436, 364, 1.06, 0.92],
    [536, 374, 1.22, 1],
  ];
  return (
    <SceneSvg>
      <Sky id="rs-covid_street-sky" stops={[[0, '#070A12'], [0.4, '#141C2C'], [0.6, '#2A3550'], [1, '#0A0E14']]} />
      <Skyline base={220} minH={40} maxH={110} seed={33} fill="#101624" win="#9FE8FF" litRatio={0.06} />
      <Haze id="rs-covid_street-haze" y={150} h={90} color="#3E5A78" opacity={0.45} />
      {/* 윗층 — 창 몇 개만 켜진 상가 건물 */}
      <rect x={0} y={34} width={800} height={100} fill="#090C12" />
      <rect x={0} y={34} width={800} height={3} fill="#B07CFF" opacity={0.35} />
      {[60, 170, 280, 390, 500, 610, 720].map((x, i) => (
        <rect key={x} x={x} y={56} width={64} height={44} fill={i === 1 || i === 5 ? '#FFD89A' : i === 3 ? '#9FE8FF' : '#12161E'} opacity={i === 1 || i === 3 || i === 5 ? 0.3 : 1} />
      ))}
      {/* 건물 1층 상가 — 셔터 내린 가게들 */}
      <rect x={0} y={130} width={800} height={200} fill="#0B0F15" />
      <path d="M0 130 H800" stroke="#3E4C5C" strokeOpacity={0.5} />
      <g fill="#070A0E">
        {[40, 150, 260, 370, 480, 590, 700].map((x) => (
          <rect key={x} x={x} y={146} width={70} height={36} />
        ))}
      </g>
      <rect x={250} y={146} width={90} height={36} fill="#141A22" />
      <text x={295} y={170} textAnchor="middle" fontSize={15} fontWeight={800} fill="#46546A">
        수학학원
      </text>
      <g>
        <rect x={20} y={200} width={170} height={130} fill="#121820" />
        <path d="M20 212 H190 M20 224 H190 M20 236 H190 M20 248 H190 M20 260 H190 M20 272 H190 M20 284 H190 M20 296 H190 M20 308 H190 M20 320 H190" stroke="#0E1317" strokeWidth={2} />
        <rect x={64} y={208} width={60} height={30} fill="#B8C4CC" opacity={0.4} />
        <text x={94} y={227} textAnchor="middle" fontSize={11} fontWeight={800} fill="#2A2F33">
          임시휴업
        </text>
        <rect x={210} y={200} width={160} height={130} fill="#10151C" />
        <path d="M210 214 H370 M210 228 H370 M210 242 H370 M210 256 H370 M210 270 H370 M210 284 H370 M210 298 H370 M210 312 H370" stroke="#0E1317" strokeWidth={2} />
      </g>
      {/* 약국 — 유일하게 불 켜진 가게 */}
      <Glow id="rs-covid_street-glow" cx={660} cy={270} r={300} color="#3DFFC0" opacity={0.42} className="zs-glow" />
      <rect x={560} y={196} width={220} height={134} fill="#C8FFE8" opacity={0.82} />
      <path d="M560 196 H780 V330 H560 Z M670 196 V330" stroke="#0C1A14" strokeWidth={6} fill="none" />
      <rect x={560} y={150} width={220} height={40} fill="#0C1A14" />
      <text x={690} y={180} textAnchor="middle" fontSize={26} fontWeight={800} fill="#6CFFB0">
        약국
      </text>
      <g fill="#27D17A">
        <rect x={588} y={156} width={10} height={28} />
        <rect x={579} y={165} width={28} height={10} />
      </g>
      <rect x={582} y={226} width={70} height={40} fill="#F4F6EE" opacity={0.85} />
      <text x={617} y={243} textAnchor="middle" fontSize={10} fontWeight={800} fill="#1F3A2A">
        공적마스크
      </text>
      <text x={617} y={258} textAnchor="middle" fontSize={9} fontWeight={700} fill="#B8322A">
        5부제 판매
      </text>

      {/* 인도 + 거리두기 바닥 표시 */}
      <rect x={0} y={330} width={800} height={50} fill="#121820" />
      <polygon points="560,330 780,330 800,380 300,380" fill="#3DFFC0" opacity={0.16} />
      <path d="M0 330 H800" stroke="#3DFFC0" strokeOpacity={0.25} strokeWidth={2} />
      <g fill="#E8C44A" opacity={0.7}>
        {queue.map(([x, y, s]) => (
          <rect key={x} x={x - 13 * s} y={y - 2} width={28 * s} height={4 * s} rx={1} />
        ))}
      </g>
      {/* 줄 선 사람들 — 뒤로 갈수록 작고 흐리다(원근은 약하게) */}
      {queue.map(([x, y, s, o], i) => (
        <g key={x} opacity={o}>
          <Person x={x + 2} y={y - 1.5} s={s} pose="stand" pack={i % 2 === 1} fill="#7FFFD8" />
          <Person x={x} y={y} s={s} pose="stand" pack={i % 2 === 1} fill={PAL.ink} />
          <Mask x={x} y={y} s={s} />
        </g>
      ))}
      <path d="M340 250 H424" stroke="#E8C44A" strokeOpacity={0.7} strokeWidth={1.4} />
      <path d="M340 246 V254 M424 246 V254" stroke="#E8C44A" strokeOpacity={0.7} strokeWidth={1.4} />
      <text x={382} y={244} textAnchor="middle" fontSize={13} fontWeight={800} fill="#E8C44A" opacity={0.9}>
        2m
      </text>
      {/* 텅 빈 차도 */}
      <rect x={0} y={380} width={800} height={70} fill="#06080C" />
      <path d="M0 380 H800" stroke="#243040" strokeWidth={3} />
      <path d="M40 420 H120 M200 420 H280 M360 420 H440 M520 420 H600 M680 420 H760" stroke="#5A6268" strokeOpacity={0.5} strokeWidth={3} />
      <Lamp x={190} y={384} h={210} fill="#04060A" />
      <Tree x={4} y={386} s={1.5} fill="#04060A" />
      <Vignette id="rs-covid_street-vig" strength={0.7} />
    </SceneSvg>
  );
}

// ─────────────────────────── apt_night — 2021 영끌 신축 입주 ───────────────────────────
function AptNight() {
  const towers: [number, number, number, number][] = [
    [40, 70, 300, 11],
    [150, 78, 340, 12],
    [520, 76, 330, 13],
    [630, 70, 290, 14],
  ];
  return (
    <SceneSvg>
      <Sky id="rs-apt_night-sky" stops={[[0, '#0B0A22'], [0.5, '#221A48'], [0.8, '#43306A'], [1, '#1A1430']]} />
      <Skyline base={330} minH={30} maxH={90} seed={42} fill="#1E1840" win="#FFD48A" litRatio={0.05} />
      <Haze id="rs-apt_night-haze" y={250} h={100} color="#8A6AC0" opacity={0.3} />
      {/* 신축 타워형 동 + 옥상 크라운 조명 */}
      {towers.map(([x, w, h, seed]) => (
        <g key={x}>
          <ApartmentBlock x={x} y={360} w={w} h={h} floors={28} cols={4} fill="#120F26" line="rgba(170,150,255,0.07)" win="#FFCB7A" litRatio={0.34} seed={seed} flickerSome={false} />
          <rect x={x} y={360 - h - 22} width={w} height={6} fill="#B99CFF" opacity={0.55} />
        </g>
      ))}
      <g className="zs-glow">
        <rect x={150} y={360 - 340 - 22} width={78} height={6} fill="#D8C4FF" />
      </g>
      {/* 중앙 동 — 이사 들어가는 창 */}
      <ApartmentBlock x={300} y={370} w={170} h={250} floors={20} cols={7} number="101" fill="#17132E" line="rgba(170,150,255,0.08)" win="#FFCB7A" litRatio={0.18} seed={9} numberColor="rgba(220,200,255,0.22)" flickerSome={false} />
      <rect x={386} y={180} width={20} height={9} fill="#FFE2A8" />
      <Glow id="rs-apt_night-win" cx={396} cy={184} r={46} color="#FFD48A" opacity={0.7} />
      {/* 사다리차 */}
      <path d="M508 352 L398 190" stroke="#0A0816" strokeWidth={7} />
      <path d="M500 352 L394 196 M514 348 L404 190" stroke="#0A0816" strokeWidth={1.5} />
      <rect x={390} y={186} width={22} height={10} fill="#0A0816" />
      <g fill="#07060F">
        <rect x={470} y={332} width={120} height={36} rx={3} />
        <path d="M590 344 H620 L636 358 V368 H590 Z" />
        <circle cx={496} cy={370} r={9} />
        <circle cx={610} cy={370} r={9} />
      </g>
      <rect x={612} y={348} width={14} height={8} fill="#FFE8A8" opacity={0.5} />
      {/* 현수막 */}
      <rect x={310} y={334} width={150} height={20} fill="#E9DDC2" opacity={0.88} />
      <text x={385} y={348} textAnchor="middle" fontSize={11} fontWeight={800} fill="#4A2A5A">
        입주를 환영합니다
      </text>
      {/* 바닥 + 놀이터 */}
      <rect x={0} y={392} width={800} height={58} fill="#07060F" />
      <path d="M0 392 H800" stroke="#B99CFF" strokeOpacity={0.25} strokeWidth={1.5} />
      <Lamp x={690} y={400} h={130} lit color="#FFE2A8" fill="#05040A" />
      <g fill="#05040A">
        <path d="M40 400 L60 330 L66 330 L46 400 Z M100 400 L80 330 L74 330 L94 400 Z" />
        <rect x={56} y={326} width={30} height={6} />
        <path d="M70 332 V372" stroke="#05040A" strokeWidth={1.5} />
        <rect x={64} y={370} width={14} height={4} />
        <path d="M120 400 V340 H150 V400 M150 346 L200 398 L206 398 L156 346 Z" />
        <path d="M118 340 L135 318 L152 340 Z" />
      </g>
      {/* 올려다보는 나 — 대출 30년 */}
      <Glow id="rs-apt_night-rim" cx={740} cy={330} r={80} color="#FFD48A" opacity={0.28} />
      <Person x={742} y={402} s={1.25} pose="stand" pack={false} flip fill="#030208" />
      <Tree x={255} y={400} s={1.05} fill="#05040A" />
      <Vignette id="rs-apt_night-vig" strength={0.72} />
    </SceneSvg>
  );
}

// ─────────────────────────── ai_boom — 2023 데이터센터 ───────────────────────────
const VX = 400;
const VY = 206;
function rackFaces(side: 1 | -1, seed: number) {
  const r = rng(seed);
  const zs = [1, 1.28, 1.64, 2.1, 2.7, 3.5, 4.6, 6.2];
  const top = (t: number) => VY - 196 * t;
  const bot = (t: number) => VY + 196 * t;
  const faces: ReactNode[] = [];
  const leds: ReactNode[] = [];
  const blink: ReactNode[] = [];
  for (let i = 0; i < zs.length - 1; i++) {
    const t0 = 1 / zs[i];
    const t1 = 1 / zs[i + 1] + 0.004;
    const x0 = VX - side * 380 * t0;
    const x1 = VX - side * 380 * t1;
    faces.push(
      <polygon key={i} points={`${x0},${top(t0)} ${x1},${top(t1)} ${x1},${bot(t1)} ${x0},${bot(t0)}`} fill={i % 2 ? '#060A12' : '#08101A'} stroke="#000" strokeWidth={1.4} />,
    );
    const rows = 14;
    for (let k = 1; k < rows; k++) {
      const f = k / rows;
      for (let c = 0; c < 5; c++) {
        if (r() > 0.55) continue;
        const u = 0.12 + c * 0.16 + r() * 0.05;
        const t = t0 + (t1 - t0) * u;
        const x = VX - side * 380 * t;
        const y = top(t) + (bot(t) - top(t)) * f;
        const size = Math.max(1.2, 4.6 * t);
        const col = r() < 0.6 ? '#3DFFC0' : r() < 0.6 ? '#4E8CFF' : '#B07CFF';
        const el = <rect key={`${i}-${k}-${c}`} x={x - size / 2} y={y} width={size * 1.6} height={size * 0.6} fill={col} opacity={0.55 + r() * 0.45} />;
        (r() < 0.08 ? blink : leds).push(el);
      }
    }
  }
  return { faces, leds, blink };
}

function AiBoom() {
  const L = rackFaces(1, 3);
  const R = rackFaces(-1, 11);
  return (
    <SceneSvg>
      <rect width={800} height={450} fill="#03040A" />
      {/* 통로 끝 광원 */}
      <Glow id="rs-ai_boom-end" cx={VX} cy={VY} r={260} color="#35E6D0" opacity={0.5} className="zs-glow" />
      <rect x={VX - 20} y={VY - 34} width={40} height={72} fill="#9FFFF0" opacity={0.75} />
      {/* 바닥 반사 */}
      <polygon points={`0,450 800,450 ${VX + 20},${VY + 38} ${VX - 20},${VY + 38}`} fill="#0A1420" />
      <polygon points={`330,450 470,450 ${VX + 6},${VY + 38} ${VX - 6},${VY + 38}`} fill="#35E6D0" opacity={0.12} />
      <path d={`M140 450 L${VX - 12} ${VY + 38} M660 450 L${VX + 12} ${VY + 38}`} stroke="#B07CFF" strokeOpacity={0.3} strokeWidth={1.5} />
      {/* 천장 케이블 트레이 */}
      <path d={`M120 0 L${VX - 8} ${VY - 36} M680 0 L${VX + 8} ${VY - 36} M300 0 L${VX - 3} ${VY - 36} M500 0 L${VX + 3} ${VY - 36}`} stroke="#B07CFF" strokeOpacity={0.35} strokeWidth={2} />
      {/* 서버랙 */}
      {L.faces}
      {R.faces}
      {L.leds}
      {R.leds}
      <g className="zs-blink">
        {L.blink}
        {R.blink}
      </g>
      <path d={`M20 10 L${VX - 20} ${VY - 34} M780 10 L${VX + 20} ${VY - 34}`} stroke="#35E6D0" strokeOpacity={0.5} strokeWidth={1.5} />
      <Haze id="rs-ai_boom-haze" y={150} h={140} color="#6A4ACF" opacity={0.18} />
      {/* 통로 한가운데 선 사람 — 역광 */}
      <Glow id="rs-ai_boom-rim" cx={VX} cy={300} r={90} color="#35E6D0" opacity={0.3} />
      <Person x={VX - 2} y={392} s={1.5} pose="stand" pack={false} fill="#010204" />
      <ellipse cx={VX + 2} cy={394} rx={34} ry={4} fill="#35E6D0" opacity={0.18} />
      <Vignette id="rs-ai_boom-vig" strength={0.8} />
    </SceneSvg>
  );
}

export const sceneGroupE: Record<string, ComponentType> = {
  office_job: OfficeJob,
  covid_street: CovidStreet,
  apt_night: AptNight,
  ai_boom: AiBoom,
};
