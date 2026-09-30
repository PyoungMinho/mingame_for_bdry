/**
 * 씬 그룹 C — 고등학교 야자 · 수능날 교문 · 2012 캠퍼스 봄 · 군대 생활관 밤.
 * 톤: "추억 앨범" 실루엣 듀오톤. 2010년대 = 차가운 형광·스마트폰 빛, 따뜻한 응원 불빛이 대비.
 * 림라이트는 같은 프리미티브를 밝은 색으로 살짝 어긋나게 한 번 더 깔아 만든다(Rim*).
 */
import type { ComponentProps, ComponentType } from 'react';
import { Glow, Haze, Lamp, PAL, Person, SceneSvg, Skyline, Sky, Vignette, rng } from './primitives';

const UP = '#FF5A4E';

type PersonProps = ComponentProps<typeof Person>;

/** 림라이트 인물 — 밝은 복제본을 (dx, dy) 만큼 어긋나게 깔고 위에 실루엣 */
function RimPerson({ rim, dx = 0, dy = -1.6, ...p }: PersonProps & { rim: string; dx?: number; dy?: number }) {
  return (
    <>
      <Person {...p} x={p.x + dx} y={p.y + dy} fill={rim} />
      <Person {...p} />
    </>
  );
}

/** 책상 + 책탑. (x, top) 은 상판 왼쪽 위, floor 는 다리 끝 */
function Desk({ x, top, w, floor, fill, books, seed }: { x: number; top: number; w: number; floor: number; fill: string; books: number; seed: number }) {
  const r = rng(seed);
  const bookCols = ['#3C4E5A', '#2E3B44', '#51606A', '#26323A', '#6A5A48'];
  let yy = top;
  const stack = Array.from({ length: books }, (_, i) => {
    const h = 6 + r() * 7;
    const bw = w * (0.42 + r() * 0.16);
    yy -= h;
    return <rect key={i} x={x + w * 0.5 + (r() - 0.5) * 6} y={yy} width={bw} height={h - 0.8} fill={bookCols[i % bookCols.length]} />;
  });
  return (
    <g>
      {stack}
      <rect x={x} y={top} width={w} height={6} fill={fill} />
      <rect x={x + 4} y={top + 6} width={4} height={floor - top - 6} fill={fill} />
      <rect x={x + w - 8} y={top + 6} width={4} height={floor - top - 6} fill={fill} />
      <rect x={x + 6} y={top + 6} width={w - 12} height={(floor - top) * 0.3} fill={fill} opacity={0.8} />
    </g>
  );
}

// ─────────────────────────────── school_night ───────────────────────────────
function SchoolNight() {
  return (
    <SceneSvg>
      <Sky id="rs-school_night-wall" stops={[[0, '#34505E'], [0.4, '#1C2E38'], [1, '#0A1216']]} />
      <defs>
        <linearGradient id="rs-school_night-cone" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#E4F4FF" stopOpacity={0.28} />
          <stop offset="1" stopColor="#E4F4FF" stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d="M110 29 H260 L330 420 H20 Z M330 29 H480 L560 420 H250 Z M550 29 H700 L790 420 H470 Z" fill="url(#rs-school_night-cone)" />
      <rect x={0} y={330} width={800} height={120} fill="#0E1519" />
      <path d="M0 330 H800" stroke="#4A6572" strokeOpacity={0.4} />

      {/* 창밖 — 캄캄한 운동장 */}
      <rect x={28} y={72} width={286} height={150} fill="#04080D" />
      <path d="M28 176 C90 160 150 170 210 158 C250 150 290 162 314 156 V190 H28 Z" fill="#0A121A" />
      <rect x={28} y={190} width={286} height={32} fill="#0C1418" />
      <g fill="none" stroke="#1C2A30" strokeWidth={3}>
        <path d="M70 206 V184 H122 V206" />
      </g>
      <g className="zs-glow">
        <Glow id="rs-school_night-far" cx={250} cy={176} r={34} color="#FFC870" opacity={0.6} />
      </g>
      <path d="M40 80 L90 210 M180 80 L226 210" stroke="#CFE8FF" strokeOpacity={0.06} strokeWidth={10} />
      <g fill="#34474F">
        <rect x={22} y={66} width={298} height={8} />
        <rect x={22} y={220} width={298} height={10} />
        <rect x={22} y={66} width={8} height={160} />
        <rect x={312} y={66} width={8} height={160} />
        <rect x={167} y={66} width={6} height={160} />
      </g>

      {/* 시계 22:00 */}
      <circle cx={372} cy={96} r={19} fill="#DCE6EA" opacity={0.85} />
      <path d="M372 96 V82 M372 96 L362 90" stroke="#1A262C" strokeWidth={2.4} strokeLinecap="round" />

      {/* 칠판 — 수능 D-day */}
      <rect x={424} y={64} width={356} height={148} fill="#3A3024" />
      <rect x={432} y={70} width={340} height={134} fill="#17302A" />
      <text x={452} y={122} fontSize={38} fontWeight={800} fill="#EDEFE6" opacity={0.92}>
        수능 D-100
      </text>
      <text x={454} y={156} fontSize={16} fontWeight={700} fill="#EDEFE6" opacity={0.6}>
        야간자율학습 · 정숙
      </text>
      <text x={700} y={188} fontSize={13} fontWeight={700} fill="#F2D27A" opacity={0.7}>
        주번 ☆
      </text>

      {/* 형광등 */}
      <Glow id="rs-school_night-tube" cx={400} cy={30} r={420} color="#D6ECFF" opacity={0.32} />
      <rect x={110} y={22} width={150} height={7} rx={3} fill="#F2FAFF" />
      <g className="zs-flicker">
        <rect x={330} y={22} width={150} height={7} rx={3} fill="#F2FAFF" />
      </g>
      <rect x={550} y={22} width={150} height={7} rx={3} fill="#F2FAFF" />

      {/* 뒷줄 — 공부하는 아이들 (작고 흐리게) */}
      <Haze id="rs-school_night-haze1" y={230} h={110} color="#9FC6DA" opacity={0.12} />
      <RimPerson x={70} y={326} s={0.82} pose="sit" fill="#16232A" rim="#8FB6CC" dy={-1} pack={false} />
      <Desk x={84} top={292} w={58} floor={326} fill="#1A272E" books={4} seed={3} />
      <g transform="rotate(34 330 318)">
        <Person x={330} y={326} s={0.82} pose="sit" fill="#16232A" pack={false} />
      </g>
      <Desk x={344} top={292} w={58} floor={326} fill="#1A272E" books={6} seed={5} />
      <RimPerson x={560} y={326} s={0.82} pose="sit" fill="#16232A" rim="#8FB6CC" dy={-1} pack={false} />
      <Desk x={574} top={292} w={58} floor={326} fill="#1A272E" books={3} seed={9} />

      {/* 앞줄 — 책탑 뒤에서 공부하는 나 · 엎드려 자는 짝 */}
      <Haze id="rs-school_night-haze2" y={320} h={120} color="#9FC6DA" opacity={0.1} />
      {/* 내 책상 스탠드 — 차가운 교실 속 유일한 따뜻한 빛 */}
      <Glow id="rs-school_night-desk" cx={210} cy={372} r={120} color="#FFD08A" opacity={0.55} />
      <RimPerson x={118} y={452} s={1.8} pose="sit" fill="#05080A" rim="#FFD8A0" dx={2.2} dy={-2} pack={false} />
      <Desk x={146} top={378} w={184} floor={452} fill="#0B1114" books={11} seed={12} />
      <path d="M160 378 L166 346 L186 336" stroke="#0B1114" strokeWidth={3} fill="none" strokeLinecap="round" />
      <path d="M180 330 L198 334 L194 344 L178 340 Z" fill="#1A2226" />
      <path d="M178 342 L196 346 L232 378 L150 378 Z" fill="#FFE2A8" opacity={0.18} />
      {/* 펼친 문제집 + 형광펜 */}
      <path d="M176 378 L208 370 L240 378 Z" fill="#FFF4DC" opacity={0.95} />
      <rect x={214} y={367} width={20} height={4} rx={2} fill="#F6E75A" transform="rotate(-12 224 369)" />
      {/* 엎드려 자는 짝 */}
      <g transform="rotate(56 480 426)">
        <Person x={482} y={440} s={1.55} pose="sit" fill="#8FB6CC" pack={false} />
        <Person x={480} y={442} s={1.55} pose="sit" fill="#070B0D" pack={false} />
      </g>
      <Desk x={500} top={384} w={170} floor={452} fill="#0B1114" books={7} seed={21} />

      <Vignette id="rs-school_night-vig" strength={0.7} />
    </SceneSvg>
  );
}

// ─────────────────────────────── suneung_gate ───────────────────────────────
function SuneungGate() {
  return (
    <SceneSvg>
      <Sky id="rs-suneung_gate-sky" stops={[[0, '#0A1224'], [0.4, '#1E2F50'], [0.6, '#56688E'], [0.73, '#C9A89A'], [1, '#2A2F3C']]} />
      <Skyline base={330} minH={20} maxH={70} seed={31} fill="#223149" win="#CFE4FF" litRatio={0.03} />
      <Haze id="rs-suneung_gate-haze" y={260} h={100} color="#C9D6EA" opacity={0.3} />

      {/* 학교 건물 */}
      <rect x={430} y={228} width={380} height={130} fill="#141E30" />
      {Array.from({ length: 3 }, (_, f) =>
        Array.from({ length: 8 }, (_, c) => (
          <rect key={`${f}-${c}`} x={446 + c * 44} y={242 + f * 34} width={28} height={16} fill={(f * 8 + c) % 5 === 1 ? '#FFE6B0' : '#1E2A40'} opacity={0.85} />
        )),
      )}
      <rect x={0} y={356} width={800} height={94} fill="#0B0F17" />
      <path d="M0 356 H800" stroke="#6C7A96" strokeOpacity={0.35} />

      {/* 교문 기둥 + 입실 안내판 */}
      <g fill="#0F1522">
        <rect x={500} y={222} width={34} height={150} />
        <rect x={494} y={214} width={46} height={12} />
        <rect x={734} y={222} width={34} height={150} />
        <rect x={728} y={214} width={46} height={12} />
      </g>
      <rect x={506} y={250} width={22} height={84} fill="#E8E4D6" opacity={0.85} />
      <text x={517} y={268} textAnchor="middle" fontSize={12} fontWeight={800} fill="#1C2433">
        <tspan x={517} dy={0}>시</tspan>
        <tspan x={517} dy={15}>험</tspan>
        <tspan x={517} dy={15}>장</tspan>
      </text>
      <g>
        <rect x={660} y={318} width={62} height={40} fill="#EDEADF" opacity={0.9} />
        <path d="M664 358 L656 374 M718 358 L726 374" stroke="#0F1522" strokeWidth={3} />
        <text x={691} y={334} textAnchor="middle" fontSize={10} fontWeight={800} fill="#B8322A">
          입실 완료
        </text>
        <text x={691} y={350} textAnchor="middle" fontSize={12} fontWeight={800} fill="#1C2433">
          08:10
        </text>
      </g>

      {/* 가로등 */}
      <Lamp x={380} y={370} h={180} lit color="#FFD89A" fill="#0A0E16" />
      <Glow id="rs-suneung_gate-lamp" cx={403} cy={196} r={60} color="#FFD89A" opacity={0.6} />

      {/* 응원하는 후배들 — 따뜻한 불빛 */}
      <g className="zs-glow">
        <Glow id="rs-suneung_gate-cheer" cx={170} cy={320} r={220} color="#FFA64A" opacity={0.55} />
      </g>
      <Person x={60} y={392} s={0.95} pose="cheer" fill="#150E0A" pack={false} />
      <Person x={250} y={394} s={0.95} pose="cheer" fill="#150E0A" pack={false} />
      <path d="M52 300 V392 M270 300 V392" stroke="#2A1C12" strokeWidth={3} />
      <rect x={40} y={246} width={246} height={46} fill="#F4E4C0" />
      <rect x={40} y={246} width={246} height={46} fill="#FFB864" opacity={0.18} />
      <text x={163} y={278} textAnchor="middle" fontSize={24} fontWeight={800} fill="#B8322A">
        선배님 수능대박!!
      </text>
      <Person x={110} y={400} s={1} pose="stand" fill="#0D0907" pack={false} />
      <Person x={160} y={398} s={0.98} pose="cheer" fill="#0D0907" pack={false} />
      <Person x={205} y={402} s={1.02} pose="stand" fill="#0D0907" pack={false} flip />
      {/* 보온병 테이블 */}
      <rect x={290} y={372} width={60} height={6} fill="#0D0907" />
      <rect x={300} y={356} width={10} height={16} rx={2} fill="#C8452E" />
      <rect x={316} y={362} width={8} height={10} fill="#E8D8B0" opacity={0.8} />

      {/* 수험생 — 교문으로 들어간다 */}
      <RimPerson x={590} y={446} s={1.6} pose="walk" fill="#05070B" rim="#8CA6CC" dx={1} dy={-1.4} />
      <g className="zs-drift">
        <ellipse cx={630} cy={296} rx={9} ry={5} fill="#F0F6FF" opacity={0.4} />
        <ellipse cx={648} cy={284} rx={13} ry={7} fill="#E6EEF8" opacity={0.16} />
        <ellipse cx={186} cy={296} rx={8} ry={4} fill="#FFE6C8" opacity={0.2} />
      </g>

      <Vignette id="rs-suneung_gate-vig" strength={0.7} />
    </SceneSvg>
  );
}

// ─────────────────────────────── campus ───────────────────────────────

/** 과잠 — Person walk 몸통 위에 덧입힌다(몸판 색 + 크림 가죽 소매 + 등판 글자) */
function Gwajam({ x, y, s, body, label }: { x: number; y: number; s: number; body: string; label: string }) {
  const st = { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 6 } as const;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-5 -75 L-11 -59 L-13 -45" {...st} stroke="#E4D6BC" />
      <path d="M-7.5 -78 C-1 -81.5 7 -81.5 10.5 -78 L8.5 -46 L-6.5 -46 Z" fill={body} />
      <rect x={-6.5} y={-48} width={15} height={3} fill="#E4D6BC" />
      <text x={1.5} y={-60} textAnchor="middle" fontSize={7} fontWeight={800} fill="#F2E8D2">
        {label}
      </text>
      <path d="M8 -75 L13 -59 L18 -46" {...st} stroke="#E4D6BC" />
    </g>
  );
}

function Cherry({ x, y, s, seed }: { x: number; y: number; s: number; seed: number }) {
  const r = rng(seed);
  const blobs = Array.from({ length: 9 }, (_, i) => ({ cx: (r() - 0.5) * 150, cy: -90 - r() * 70, rr: 26 + r() * 22, c: i % 3 === 0 ? '#F8C9D4' : i % 3 === 1 ? '#E89AB0' : '#C9728E' }));
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-5 0 L-3 -80 L-30 -118 M-3 -80 L24 -122 M-1 -60 L4 -60 L6 0 Z" stroke="#2A1E22" strokeWidth={7} fill="#2A1E22" strokeLinecap="round" />
      {blobs.map((b, i) => (
        <circle key={i} cx={b.cx} cy={b.cy} r={b.rr} fill={b.c} opacity={0.88} />
      ))}
    </g>
  );
}

function Campus() {
  const r = rng(77);
  const petals = Array.from({ length: 34 }, (_, i) => (
    <ellipse key={i} cx={r() * 800} cy={r() * 420} rx={3.2} ry={2} fill={i % 2 ? '#FFD6E0' : '#F4A8BC'} transform={`rotate(${Math.floor(r() * 180)})`} style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />
  ));
  return (
    <SceneSvg>
      <Sky id="rs-campus-sky" stops={[[0, '#E9B7C2'], [0.45, '#F6D8C4'], [0.75, '#F3E6C8'], [1, '#C8D6A0']]} />
      <Glow id="rs-campus-sun" cx={560} cy={120} r={260} color="#FFF4D6" opacity={0.9} />

      {/* 오래된 석조 건물 + 시계탑 */}
      <g fill="#5A4E58">
        <rect x={400} y={196} width={400} height={150} />
        <rect x={540} y={116} width={70} height={90} />
        <path d="M534 118 L575 60 L616 118 Z" />
        <path d="M400 196 L420 180 H780 L800 196 Z" />
      </g>
      <circle cx={575} cy={146} r={14} fill="#EDE2CC" opacity={0.75} />
      {Array.from({ length: 7 }, (_, c) => (
        <path key={c} d={`M${420 + c * 54} 300 V252 a12 12 0 0 1 24 0 V300 Z`} fill="#3E3440" />
      ))}
      <rect x={430} y={214} width={290} height={24} fill="#F8F2E6" />
      <text x={575} y={232} textAnchor="middle" fontSize={15} fontWeight={800} fill="#8A2238">
        환영! 12학번 새내기
      </text>

      <Haze id="rs-campus-haze" y={240} h={120} color="#FFF0DC" opacity={0.55} />

      {/* 잔디 + 벚꽃길 */}
      <rect x={0} y={340} width={800} height={110} fill="#5E7A3E" />
      <path d="M300 340 H470 L640 450 H80 Z" fill="#C9B89A" />
      <path d="M300 340 H470 L640 450 H80 Z" fill="#6E5A48" opacity={0.25} />
      <Cherry x={80} y={372} s={1.35} seed={3} />
      <Cherry x={300} y={346} s={0.8} seed={6} />
      <Cherry x={760} y={380} s={1.4} seed={9} />

      {/* 중경 — 새내기들 */}
      <Person x={392} y={352} s={0.62} pose="walk" fill="#2E2630" pack={false} />
      <Person x={412} y={354} s={0.6} pose="stand" fill="#2E2630" flip />
      <Person x={470} y={372} s={0.78} pose="stand" fill="#241C24" pack={false} />
      <rect x={476} y={309} width={5} height={8} fill="#DDF2FF" />

      {/* 전경 — 과잠 입은 동기 셋 */}
      <RimPerson x={210} y={446} s={1.5} pose="walk" fill="#1A1418" rim="#FFE4C4" dx={2} dy={-1.5} pack={false} />
      <Gwajam x={210} y={446} s={1.5} body="#23305E" label="경영" />
      <RimPerson x={290} y={440} s={1.42} pose="walk" fill="#1A1418" rim="#FFE4C4" dx={2} dy={-1.5} pack={false} />
      <Gwajam x={290} y={440} s={1.42} body="#6A1F2E" label="국문" />
      <RimPerson x={372} y={448} s={1.56} pose="walk" fill="#1A1418" rim="#FFE4C4" dx={2} dy={-1.5} pack={false} />
      <Gwajam x={372} y={448} s={1.56} body="#2F4A2A" label="공대" />

      <g className="zs-drift">{petals}</g>
      <Vignette id="rs-campus-vig" strength={0.45} />
    </SceneSvg>
  );
}

// ─────────────────────────────── barracks ───────────────────────────────
function Barracks() {
  const r = rng(41);
  const snow = Array.from({ length: 26 }, (_, i) => <circle key={i} cx={46 + r() * 190} cy={80 + r() * 140} r={1 + r() * 1.6} fill="#EAF2FF" opacity={0.7} />);
  return (
    <SceneSvg>
      <Sky id="rs-barracks-wall" stops={[[0, '#07090A'], [0.55, '#141A14'], [1, '#0A0D0A']]} />

      {/* 창밖 눈 */}
      <rect x={40} y={74} width={200} height={150} fill="#0E1826" />
      <rect x={40} y={196} width={200} height={28} fill="#AFC0D2" opacity={0.35} />
      <g className="zs-drift">{snow}</g>
      <g fill="#2C3322">
        <rect x={34} y={68} width={212} height={8} />
        <rect x={34} y={222} width={212} height={10} />
        <rect x={34} y={68} width={8} height={160} />
        <rect x={238} y={68} width={8} height={160} />
        <rect x={137} y={68} width={6} height={160} />
      </g>

      {/* 관물대 줄 */}
      <rect x={272} y={96} width={528} height={150} fill="#2A3120" />
      {Array.from({ length: 7 }, (_, c) => (
        <g key={c}>
          <rect x={282 + c * 74} y={106} width={64} height={60} fill="#161B10" />
          <rect x={282 + c * 74} y={174} width={64} height={62} fill="#161B10" />
          <rect x={288 + c * 74} y={146} width={52} height={18} fill="#4A5236" />
          <rect x={288 + c * 74} y={214} width={40} height={20} fill="#3C4430" />
          <rect x={300 + c * 74} y={166} width={28} height={6} fill="#D8DCC8" opacity={0.55} />
          <path d={`M${292 + c * 74} 96 a22 18 0 0 1 44 0 Z`} fill="#3A4428" />
        </g>
      ))}
      <rect x={272} y={96} width={528} height={150} fill="#050806" opacity={0.35} />
      <rect x={60} y={20} width={160} height={30} fill="#1A1F12" />
      <text x={140} y={41} textAnchor="middle" fontSize={16} fontWeight={800} fill="#C9C29A" opacity={0.75}>
        제3생활관
      </text>

      {/* 침상 + 모포 */}
      <rect x={0} y={300} width={800} height={150} fill="#1C1810" />
      <rect x={0} y={300} width={800} height={8} fill="#3A3020" />
      {Array.from({ length: 9 }, (_, i) => (
        <path key={i} d={`M0 ${322 + i * 14} H800`} stroke="#000" strokeOpacity={0.18} />
      ))}
      <g fill="#2E3622">
        <rect x={40} y={276} width={62} height={26} />
        <rect x={40} y={264} width={56} height={12} fill="#3A4428" />
        <rect x={700} y={272} width={62} height={30} />
      </g>
      <defs>
        <linearGradient id="rs-barracks-cone" gradientUnits="userSpaceOnUse" x1={700} y1={130} x2={260} y2={450}>
          <stop offset="0" stopColor="#A8D4FF" stopOpacity={0.42} />
          <stop offset="1" stopColor="#A8D4FF" stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <path d="M618 128 L778 128 L640 450 L20 450 Z" fill="url(#rs-barracks-cone)" />

      {/* 천장 TV — 유일한 광원 */}
      <Glow id="rs-barracks-tvglow" cx={696} cy={80} r={300} color="#8FC4FF" opacity={0.6} className="zs-glow" />
      <path d="M700 0 V26" stroke="#0A0C08" strokeWidth={6} />
      <rect x={612} y={24} width={170} height={106} rx={6} fill="#0A0C08" />
      <rect x={620} y={32} width={154} height={88} fill="#0F2640" />
      <g className="zs-flicker">
        <rect x={620} y={32} width={154} height={16} fill="#1F4A7E" />
        <text x={626} y={44} fontSize={10} fontWeight={800} fill="#fff">
          9시 뉴스
        </text>
        <circle cx={690} cy={70} r={9} fill="#2A5A8A" />
        <path d="M672 100 C674 84 706 84 708 100 Z" fill="#2A5A8A" />
        <rect x={620} y={104} width={154} height={16} fill="#061426" />
        <text x={626} y={116} fontSize={9.5} fontWeight={700} fill={UP}>
          코스피 ▲ 1.8%
        </text>
      </g>

      {/* TV 보는 동기들 */}
      <Haze id="rs-barracks-haze" y={250} h={140} color="#8FC4FF" opacity={0.1} />
      <RimPerson x={230} y={372} s={1.3} pose="sit" fill="#0C100A" rim="#7AA8D4" dx={2} dy={-1.6} pack={false} />
      <RimPerson x={345} y={376} s={1.35} pose="sit" fill="#0C100A" rim="#7AA8D4" dx={2} dy={-1.6} pack={false} />
      <RimPerson x={460} y={372} s={1.3} pose="sit" fill="#0C100A" rim="#7AA8D4" dx={2} dy={-1.6} pack={false} />
      <RimPerson x={130} y={446} s={1.9} pose="sit" fill={PAL.ink} rim="#B8DCFF" dx={2.6} dy={-2.2} pack={false} />
      <RimPerson x={290} y={450} s={1.95} pose="sit" fill={PAL.ink} rim="#B8DCFF" dx={2.6} dy={-2.2} pack={false} />
      <RimPerson x={450} y={448} s={1.9} pose="sit" fill={PAL.ink} rim="#B8DCFF" dx={2.6} dy={-2.2} pack={false} />

      <Vignette id="rs-barracks-vig" strength={0.75} />
    </SceneSvg>
  );
}

export const sceneGroupC: Record<string, ComponentType> = {
  school_night: SchoolNight,
  suneung_gate: SuneungGate,
  campus: Campus,
  barracks: Barracks,
};
