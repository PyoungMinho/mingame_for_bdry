/**
 * 씬 그룹 C — elevator · parking_garage · rooftop · evac_bus.
 * 씬마다 색 무드를 다르게: 빨간 비상등 / 나트륨 주황 + 헤드라이트 백색 / 청록 밤 + 불타는 지평선 / 버스 실내 어둠 + 붉은 줄무늬.
 */
import type { ComponentType } from 'react';
import type { SceneId } from '@/lib/zombie/types';
import { ApartmentBlock, Car, Fire, Glow, Haze, PAL, Person, SceneSvg, Skyline, Sky, Smoke, Vignette, Zombie } from './primitives';

// ─────────────────────────── 로컬 헬퍼 ───────────────────────────

type Pt = [number, number];

/** 1점 투시: (X, Y) 는 Z=1 일 때의 화면 오프셋 */
function projector(vx: number, vy: number) {
  return (X: number, Y: number, Z: number): Pt => [vx + X / Z, vy + Y / Z];
}

function pts(...ps: Pt[]) {
  return ps.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' ');
}

/** 문틈으로 나온 팔 — 부분 묘사(전신 아님) */
function Arm({ x, y, len, rot, s = 1, fill }: { x: number; y: number; len: number; rot: number; s?: number; fill: string }) {
  const st = { fill: 'none', stroke: fill, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
      <path d={`M0 0 Q${len * 0.5} ${-4} ${len} 0`} {...st} strokeWidth={10} />
      <ellipse cx={len + 6} cy={0} rx={8} ry={6.5} fill={fill} />
      <path
        d={`M${len + 11} -5 l9 -7 M${len + 13} -2 l12 -4 M${len + 13} 2 l12 2 M${len + 11} 5 l9 6 M${len + 3} -6 l4 -9`}
        {...st}
        strokeWidth={2.8}
      />
    </g>
  );
}

// ─────────────────────────── elevator ───────────────────────────

function Elevator() {
  const red = '#FF2A1E';
  const dark = '#0B0203';
  return (
    <SceneSvg>
      <Sky id="zs-elevator-wall" stops={[[0, '#120203'], [0.35, '#3E0709'], [0.7, '#2A0506'], [1, '#0E0202']]} />
      {/* 광원 1: 빨간 비상등(좌상단) */}
      <Glow id="zs-elevator-redglow" cx={170} cy={60} r={420} color={red} opacity={0.5} className="zs-glow" />
      {/* 천장·옆벽·바닥 — 가벼운 원근 */}
      <polygon points="0,0 800,0 690,46 110,46" fill="#0A0102" />
      <polygon points="0,0 110,46 110,404 0,450" fill="#1A0304" />
      <polygon points="800,0 690,46 690,404 800,450" fill="#140203" />
      <defs>
        <linearGradient id="zs-elevator-floor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3A0608" />
          <stop offset="1" stopColor="#070102" />
        </linearGradient>
        <linearGradient id="zs-elevator-door" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#3A0A0B" />
          <stop offset="0.35" stopColor="#7A1A16" />
          <stop offset="0.55" stopColor="#4A0E0D" />
          <stop offset="1" stopColor="#2A0607" />
        </linearGradient>
      </defs>
      <polygon points="0,450 110,404 690,404 800,450" fill="url(#zs-elevator-floor)" />
      {/* 벽 패널 줄눈 */}
      <path d="M200 46 V404 M600 46 V404 M110 225 H290 M510 225 H690" stroke="#000" strokeWidth={2} opacity={0.35} />

      {/* 비상등 기구 + 빛 원뿔 */}
      <polygon points="150,58 190,58 330,404 20,404" fill={red} opacity={0.08} />
      <rect x={146} y={48} width={48} height={12} rx={3} fill="#220304" />
      <g className="zs-blink">
        <rect x={152} y={56} width={36} height={8} rx={4} fill="#FF5A40" />
      </g>

      {/* 엘리베이터 프레임 */}
      <rect x={292} y={122} width={216} height={282} fill="#170304" />
      <rect x={292} y={122} width={216} height={282} fill="none" stroke="#6A1612" strokeWidth={2} opacity={0.7} />
      {/* 문틈 안 — 칠흑 + 희미한 형광 */}
      <rect x={374} y={132} width={52} height={272} fill="#140405" />
      <g className="zs-flicker">
        <rect x={378} y={132} width={44} height={5} fill="#F0E0C8" opacity={0.5} />
        <polygon points="378,137 422,137 440,404 360,404" fill="#F0D8C0" opacity={0.07} />
      </g>
      {/* 문짝(반쯤 열림) */}
      <rect x={302} y={132} width={72} height={272} fill="url(#zs-elevator-door)" />
      <rect x={426} y={132} width={72} height={272} fill="url(#zs-elevator-door)" />
      <path d="M374 132 V404 M426 132 V404" stroke="#FF7A5A" strokeWidth={1.6} opacity={0.6} />
      {/* 유리문 손자국(아주 작게) */}
      <path d="M334 296 q4 -9 9 -2 q2 8 -4 12 q-6 1 -5 -10 Z M342 304 l3 12" fill={PAL.blood} stroke={PAL.blood} strokeWidth={2} opacity={0.8} />

      {/* 문틈 속 머리들 — 붉은 윤곽만 */}
      <ellipse cx={398} cy={166} rx={12} ry={14} fill={dark} stroke="#FF6A4A" strokeWidth={1.2} strokeOpacity={0.55} />
      <path d="M386 186 Q398 178 412 186 L414 204 H384 Z" fill={dark} />
      <ellipse cx={409} cy={226} rx={10} ry={12} fill={dark} stroke="#FF6A4A" strokeWidth={1} strokeOpacity={0.4} />
      {/* 문틈에서 튀어나온 팔들 */}
      <Arm x={392} y={182} len={70} rot={-165} s={1.25} fill={dark} />
      <Arm x={406} y={210} len={84} rot={-10} s={1.2} fill={dark} />
      <Arm x={390} y={248} len={62} rot={174} s={1.3} fill={dark} />
      <Arm x={410} y={282} len={72} rot={20} s={1.2} fill={dark} />
      <Arm x={394} y={318} len={52} rot={196} s={1.15} fill={dark} />
      <Arm x={406} y={352} len={44} rot={6} s={1.1} fill={dark} />
      {/* 문 가장자리를 움켜쥔 손가락 */}
      <path d="M374 146 h-10 M374 153 h-12 M374 160 h-9 M426 382 h10 M426 389 h12 M426 396 h9" stroke={dark} strokeWidth={3.6} strokeLinecap="round" />

      {/* 광원 2: 층수 표시등(앰버) */}
      <Glow id="zs-elevator-amber" cx={400} cy={96} r={90} color={PAL.alert} opacity={0.45} />
      <rect x={346} y={80} width={108} height={32} rx={3} fill="#0C0203" stroke="#3A0A06" strokeWidth={2} />
      <polygon points="360,90 376,90 368,102" fill={PAL.alert} />
      <text x={426} y={104} textAnchor="middle" fontSize={24} fontWeight={800} fill={PAL.alert}>
        12
      </text>
      <text x={400} y={70} textAnchor="middle" fontSize={11} fontWeight={700} fill="#FFB08A" opacity={0.55}>
        승강기
      </text>
      {/* 호출 버튼 */}
      <rect x={530} y={236} width={20} height={46} rx={4} fill="#150304" stroke="#5A120E" />
      <circle cx={540} cy={250} r={5} fill={PAL.alert} className="zs-glow" />
      <circle cx={540} cy={268} r={5} fill="#3A0A08" />
      {/* 안내판 */}
      <rect x={586} y={150} width={78} height={44} rx={3} fill="#1E0405" stroke="#6A1612" />
      <text x={625} y={168} textAnchor="middle" fontSize={11} fontWeight={800} fill="#FF9A7A" opacity={0.8}>
        화재 시
      </text>
      <text x={625} y={184} textAnchor="middle" fontSize={11} fontWeight={800} fill="#FF9A7A" opacity={0.8}>
        사용금지
      </text>

      {/* 바닥 반사 */}
      <rect x={302} y={406} width={196} height={30} fill="#7A1A16" opacity={0.18} />
      <rect x={352} y={408} width={96} height={4} fill={PAL.alert} opacity={0.12} />
      <Haze id="zs-elevator-haze" y={330} h={100} color="#5A0A0A" opacity={0.35} />

      {/* 전경: 오버숄더 생존자 — 붉은 림라이트 */}
      <Person x={153} y={452} s={2.6} pose="stand" prop="bat" fill="#8A1410" />
      <Person x={150} y={452} s={2.6} pose="stand" prop="bat" fill={PAL.ink} />
      <Vignette id="zs-elevator-vig" strength={0.85} />
    </SceneSvg>
  );
}

// ─────────────────────────── parking_garage ───────────────────────────

function ParkingGarage() {
  const P = projector(420, 206);
  const sodium = '#FF9A3C';
  const white = '#F2F4FF';
  const tubes: { X: number; Z: number; on: boolean; flick?: boolean }[] = [];
  [0.95, 1.5, 2.2, 3.1, 4.3].forEach((Z, i) => {
    tubes.push({ X: -250, Z, on: i !== 1, flick: i === 3 });
    tubes.push({ X: 250, Z, on: i !== 2 && i !== 3, flick: i === 0 });
  });
  const tube = (t: (typeof tubes)[number], k: number) => (
    <polygon key={k} points={pts(P(t.X - 16, -168, t.Z), P(t.X + 16, -168, t.Z), P(t.X + 16, -168, t.Z + 0.45), P(t.X - 16, -168, t.Z + 0.45))} fill={t.on ? '#FFD39A' : '#2A1A10'} />
  );
  const pool = (t: (typeof tubes)[number], k: number) => {
    const [cx, cy] = P(t.X, 186, t.Z + 0.25);
    return <ellipse key={k} cx={cx} cy={cy} rx={170 / t.Z} ry={40 / t.Z} fill="url(#zs-parking_garage-pool)" />;
  };
  const pillars = [
    { X: -380, Z: 1.25 },
    { X: -380, Z: 2.4 },
    { X: -380, Z: 3.8 },
    { X: 380, Z: 1.6 },
    { X: 380, Z: 2.9 },
  ];
  return (
    <SceneSvg>
      <Sky id="zs-parking_garage-bg" stops={[[0, '#0A0503'], [0.44, '#2A1407'], [0.5, '#3A1C0A'], [1, '#080402']]} />
      <defs>
        <radialGradient id="zs-parking_garage-pool">
          <stop offset="0" stopColor={sodium} stopOpacity={0.35} />
          <stop offset="1" stopColor={sodium} stopOpacity={0} />
        </radialGradient>
        <linearGradient id="zs-parking_garage-beam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={white} stopOpacity={0.55} />
          <stop offset="1" stopColor={white} stopOpacity={0.04} />
        </linearGradient>
      </defs>
      {/* 천장 / 바닥 / 뒷벽 */}
      <polygon points={pts(P(-900, -170, 0.7), P(900, -170, 0.7), P(900, -170, 6), P(-900, -170, 6))} fill="#140A05" />
      <polygon points={pts(P(-900, 190, 0.7), P(900, 190, 0.7), P(900, 190, 6), P(-900, 190, 6))} fill="#1C0F07" />
      <polygon points={pts(P(-900, -170, 6), P(900, -170, 6), P(900, 190, 6), P(-900, 190, 6))} fill="#2E1809" />
      {/* 바닥 주차선 */}
      <path d={[1.2, 1.9, 2.7, 3.6, 4.8].map((Z) => `M${pts(P(-620, 190, Z))} L${pts(P(-160, 190, Z))} M${pts(P(160, 190, Z))} L${pts(P(620, 190, Z))}`).join(' ').replace(/,/g, ' ')} stroke="#C9A060" strokeWidth={1.5} opacity={0.25} />
      <path d={`M${pts(P(-8, 190, 0.8))} L${pts(P(-8, 190, 6))}`.replace(/,/g, ' ')} stroke="#E0B030" strokeWidth={2} opacity={0.2} strokeDasharray="14 12" />
      {/* 천장 보 */}
      {[1.2, 2, 3, 4.4].map((Z) => {
        const [x0, y0] = P(-900, -170, Z);
        const [x1, y1] = P(900, -128, Z);
        return <rect key={Z} x={x0} y={y0} width={x1 - x0} height={y1 - y0} fill="#0B0603" />;
      })}
      {/* 형광등(나트륨) + 바닥의 빛 웅덩이 */}
      {tubes.filter((t) => t.on && !t.flick).map(pool)}
      {tubes.filter((t) => !t.flick).map(tube)}
      <g className="zs-flicker">
        {tubes.filter((t) => t.flick).map((t, k) => pool(t, k + 50))}
        {tubes.filter((t) => t.flick).map((t, k) => tube(t, k + 60))}
      </g>
      <Haze id="zs-parking_garage-haze1" y={150} h={110} color={sodium} opacity={0.14} />

      {/* 광원 2: 막다른 곳의 차 한 대 — 헤드라이트가 정면을 향한다 */}
      {(() => {
        const [cx, fy] = P(30, 190, 4.6);
        const s = 1 / 4.6;
        const bw = 200 * s;
        const ly = fy - 72 * s;
        return (
          <g>
            <polygon points={`${cx - bw * 0.7},${ly} ${cx - 40},450 ${cx - 250},450`} fill="url(#zs-parking_garage-beam)" />
            <polygon points={`${cx + bw * 0.7},${ly} ${cx + 250},450 ${cx + 40},450`} fill="url(#zs-parking_garage-beam)" />
            <Glow id="zs-parking_garage-hl" cx={cx} cy={ly} r={95} color={white} opacity={0.65} />
            <path d={`M${cx - bw} ${fy} V${fy - 70 * s} Q${cx - bw} ${fy - 100 * s} ${cx - bw * 0.7} ${fy - 150 * s} H${cx + bw * 0.7} Q${cx + bw} ${fy - 100 * s} ${cx + bw} ${fy - 70 * s} V${fy} Z`} fill="#0A0604" />
            <path d={`M${cx - bw * 0.66} ${fy - 146 * s} H${cx + bw * 0.66}`} stroke={white} strokeWidth={1} opacity={0.5} />
            <ellipse cx={cx} cy={ly} rx={150} ry={1.6} fill={white} opacity={0.45} />
            <ellipse cx={cx - bw * 0.7} cy={ly} rx={7} ry={4} fill="#FFFFFF" />
            <ellipse cx={cx + bw * 0.7} cy={ly} rx={7} ry={4} fill="#FFFFFF" />
          </g>
        );
      })()}
      {/* 역광 속 좀비 + 카메라 쪽으로 늘어진 그림자 */}
      <polygon points={pts(P(46, 190, 3), P(74, 190, 3), P(150, 190, 0.8), P(-20, 190, 0.8))} fill="#050302" opacity={0.55} />
      <Zombie x={P(215, 190, 4.1)[0]} y={P(215, 190, 4.1)[1]} s={0.6} pose="shamble" flip fill="#0A0503" />
      <Zombie x={P(60, 190, 3)[0]} y={P(60, 190, 3)[1]} s={0.85} pose="reach" flip fill="#050302" className="zs-sway" />

      {/* 기둥 — B2 */}
      {[...pillars].sort((a, b) => b.Z - a.Z).map(({ X, Z }) => {
        const [x0, y0] = P(X - 30, -170, Z);
        const [x1, y1] = P(X + 30, 190, Z);
        const w = x1 - x0;
        const lit = X < 0 ? x1 - 3 : x0;
        return (
          <g key={`${X}-${Z}`}>
            <rect x={x0} y={y0} width={w} height={y1 - y0} fill="#241206" />
            <rect x={lit} y={y0} width={3} height={y1 - y0} fill={sodium} opacity={0.5} />
            <rect x={x0} y={y1 - 34 / Z} width={w} height={20 / Z} fill="#C8962A" opacity={0.55} />
            <text x={x0 + w / 2} y={P(0, -60, Z)[1]} textAnchor="middle" fontSize={56 / Z} fontWeight={800} fill="#E6B24A" opacity={0.85}>
              B2
            </text>
          </g>
        );
      })}
      {/* 주차된 차들(옆모습) */}
      <Car x={P(160, 190, 2.1)[0]} y={P(160, 190, 2.1)[1]} s={6.4 / 2.1} fill="#090503" />
      <Car x={P(-160, 190, 2.4)[0]} y={P(-160, 190, 2.4)[1]} s={6.4 / 2.4} flip fill="#0A0503" />
      {/* 차 사이에 웅크린 생존자 — 헤드라이트 쪽을 엿본다 */}
      <Person x={P(-192, 190, 1.75)[0]} y={P(-192, 190, 1.75)[1]} s={1.35} pose="crouch" fill="#FFB068" />
      <Person x={P(-197, 190, 1.75)[0]} y={P(-197, 190, 1.75)[1]} s={1.35} pose="crouch" fill={PAL.ink} />
      <Car x={P(-150, 190, 1.35)[0]} y={P(-150, 190, 1.35)[1]} s={6.4 / 1.35} flip fill="#060302" />
      <Haze id="zs-parking_garage-haze2" y={330} h={120} color="#3A1C0A" opacity={0.35} />
      <Vignette id="zs-parking_garage-vig" strength={0.8} />
    </SceneSvg>
  );
}

// ─────────────────────────── rooftop ───────────────────────────

function Rooftop() {
  const orange = '#FF8A3A';
  return (
    <SceneSvg>
      <Sky id="zs-rooftop-sky" stops={[[0, '#03090B'], [0.3, '#0A2226'], [0.52, '#1A4446'], [0.62, '#5A3A26'], [0.7, '#C0501E']]} />
      {/* 광원: 지평선의 불타는 도시 */}
      <Glow id="zs-rooftop-burn" cx={470} cy={300} r={360} color={orange} opacity={0.55} className="zs-glow" />
      <Smoke x={250} y={290} s={2.2} color="#0C1414" opacity={0.7} lean={1} />
      <Smoke x={620} y={292} s={1.6} color="#0C1414" opacity={0.65} lean={-1} />
      <Skyline base={312} minH={10} maxH={46} seed={21} fill="#3A2016" win={PAL.fire[4]} litRatio={0.06} tower={470} />
      <Fire id="zs-rooftop-f1" x={330} y={312} s={0.5} />
      <Fire id="zs-rooftop-f2" x={590} y={312} s={0.42} />
      <Haze id="zs-rooftop-haze1" y={262} h={80} color="#D0602A" opacity={0.4} className="zs-drift" />
      {/* 중경 아파트 동들 */}
      <ApartmentBlock x={40} y={352} w={150} h={96} floors={10} cols={6} fill="#10181A" line="rgba(120,200,200,0.06)" seed={31} litRatio={0.05} number="105" numberColor="rgba(160,220,220,0.14)" />
      <ApartmentBlock x={620} y={352} w={160} h={84} floors={9} cols={6} fill="#0E1517" line="rgba(120,200,200,0.06)" seed={33} litRatio={0.04} />

      {/* 헬기 — 점멸등 + 탐조등 */}
      <g className="zs-glow">
        <polygon points="600,102 612,102 700,300 560,300" fill="#DDF4F4" opacity={0.09} />
      </g>
      <g fill="#050A0B">
        <path d="M586 92 C586 82 598 78 610 80 L622 84 C628 88 628 96 620 100 L596 100 C590 100 586 97 586 92 Z" />
        <path d="M620 88 L664 86 L666 82 L670 82 L668 94 L664 91 L620 94 Z" />
        <path d="M592 104 H622 M598 100 V104 M616 100 V104" stroke="#050A0B" strokeWidth={2} />
        <rect x={604} y={74} width={3} height={7} />
      </g>
      <g className="zs-spin">
        <rect x={572} y={72} width={70} height={2.4} fill="#0A1415" opacity={0.85} />
      </g>
      <g className="zs-blink">
        <circle cx={668} cy={83} r={3} fill="#FF3A2A" />
        <circle cx={668} cy={83} r={9} fill="#FF3A2A" opacity={0.25} />
      </g>
      <circle cx={588} cy={96} r={2.4} fill="#EFFFFF" />

      {/* 옥상 바닥 + 난간 벽 */}
      <rect x={0} y={352} width={800} height={98} fill="#070C0D" />
      <path d="M0 352 H800" stroke={orange} strokeWidth={1.5} opacity={0.45} />
      <rect x={0} y={338} width={800} height={16} fill="#0A1113" />
      <path d="M0 338 H800" stroke={orange} strokeWidth={1.2} opacity={0.35} />
      <g stroke="#060A0B" strokeWidth={4}>
        <path d="M0 300 H800" />
        {Array.from({ length: 21 }, (_, i) => (
          <path key={i} d={`M${10 + i * 40} 300 V338`} strokeWidth={3} />
        ))}
      </g>
      <path d="M0 299 H800" stroke={orange} strokeWidth={1} opacity={0.3} />

      {/* 물탱크 */}
      <g fill="#050909">
        <path d="M572 352 L580 300 H586 L580 352 Z M700 352 L694 300 H700 L706 352 Z M630 352 L632 300 H638 L636 352 Z" />
        <rect x={566} y={286} width={146} height={16} />
        <path d="M574 286 V206 C574 190 704 190 704 206 V286 Z" />
        <path d="M574 222 H704 M574 254 H704" stroke="#0E1718" strokeWidth={2} />
        <path d="M704 206 V286" stroke={orange} strokeWidth={2} opacity={0.35} />
        <path d="M720 286 V180 M720 196 H708 M720 226 H708 M720 256 H708" stroke="#050909" strokeWidth={3} fill="none" />
      </g>
      <text x={639} y={246} textAnchor="middle" fontSize={16} fontWeight={800} fill="#6FA0A0" opacity={0.28}>
        저수조
      </text>
      {/* 계단실(옥상 출입문) */}
      <rect x={24} y={250} width={118} height={102} fill="#060B0C" />
      <rect x={60} y={286} width={36} height={66} fill="#0C1A1A" />
      <rect x={66} y={266} width={24} height={10} fill={PAL.exit} opacity={0.75} />
      <Glow id="zs-rooftop-exit" cx={78} cy={271} r={40} color={PAL.exit} opacity={0.3} />

      {/* 인물: 난간에 기대 도시를 바라본다 — 주황 림라이트 */}
      <Person x={338} y={392} s={1.45} pose="stand" fill="#C8581E" />
      <Person x={336} y={392} s={1.45} pose="stand" fill={PAL.ink} />
      <path d="M330 392 C380 396 420 400 470 404" stroke={PAL.ink} strokeWidth={10} opacity={0.35} fill="none" />
      <Haze id="zs-rooftop-haze2" y={380} h={80} color="#0E2A2E" opacity={0.5} />
      {/* 전경: 안테나·배관 */}
      <g fill={PAL.ink} stroke={PAL.ink}>
        <path d="M770 450 V300 M770 318 L748 300 M770 318 L792 300 M770 346 L752 334 M770 346 L788 334" strokeWidth={3} fill="none" />
        <rect x={0} y={420} width={800} height={30} stroke="none" />
        <rect x={120} y={388} width={70} height={36} rx={3} stroke="none" />
        <path d="M130 396 H180 M130 404 H180 M130 412 H180" stroke="#101818" strokeWidth={1.5} fill="none" />
      </g>
      <Vignette id="zs-rooftop-vig" strength={0.8} />
    </SceneSvg>
  );
}

// ─────────────────────────── evac_bus ───────────────────────────

function EvacBus() {
  const P = projector(400, 196);
  const WX = 190; // 버스 옆벽
  const glass = '#0A0D12';
  const streaks: [number, number, number, string, number][] = [
    // [Y, Z시작, Z끝, 색, 굵기] — 옆벽 평면 위에서 소실점으로 흐르는 불빛
    [-40, 0.45, 1.3, '#FF3B1E', 7],
    [-8, 0.8, 2.4, '#FF8A2A', 4],
    [26, 0.5, 1.05, '#FFC870', 3],
    [58, 0.62, 1.9, '#FF3B1E', 5],
    [-22, 1.5, 3.6, '#E8742A', 3],
    [80, 1.2, 3.1, '#FF5A24', 4],
    [8, 2.2, 4.3, '#FFB060', 2],
    [-52, 2.0, 4.0, '#FF3B1E', 2],
  ];
  const wall = (side: 1 | -1) => {
    const X = side * WX;
    const seg = (y: number, a: number, b: number) => `M${pts(P(X, y, a))} L${pts(P(X, y, b))}`.replace(/,/g, ' ');
    return (
      <g key={side}>
        <polygon points={pts(P(X, -64, 0.4), P(X, -64, 4.6), P(X, 104, 4.6), P(X, 104, 0.4))} fill={glass} />
        <g filter="url(#zs-evac_bus-blur)" opacity={side < 0 ? 1 : 0.8}>
          {streaks.map(([y, a, b, c, w], i) => (
            <path key={i} d={seg(y * (side < 0 ? 1 : 0.85), a + (side > 0 ? 0.15 : 0), b)} stroke={c} strokeWidth={w} strokeLinecap="round" opacity={0.9} />
          ))}
        </g>
        {/* 창틀 기둥 */}
        {[0.4, 0.95, 1.5, 2.2, 3, 3.9].map((Z) => (
          <polygon key={Z} points={pts(P(X, -72, Z), P(X, -72, Z + 0.08), P(X, 112, Z + 0.08), P(X, 112, Z))} fill="#020304" />
        ))}
        <path d={seg(-64, 0.4, 4.6)} stroke="#020304" strokeWidth={5} />
      </g>
    );
  };
  const seat = (side: 1 | -1, Z: number, head: boolean, k: string) => {
    const [xa, y0] = P(side * 58, 74, Z);
    const [xb, y1] = P(side * (WX - 6), 232, Z);
    const l = Math.min(xa, xb);
    const w = Math.abs(xb - xa);
    const hx = l + w * (side > 0 ? 0.32 : 0.68);
    const rim = side < 0 ? '#FF6A3A' : '#E0502A';
    const hi = side < 0 ? l + w - 10 / Z : l + 10 / Z; // 통로 쪽 손잡이 시작점
    return (
      <g key={k}>
        {head && (
          <g>
            <path d={`M${hx - 40 / Z} ${y0 + 2} Q${hx} ${y0 - 34 / Z} ${hx + 40 / Z} ${y0 + 2} Z`} fill="#050507" />
            <ellipse cx={hx} cy={y0 - 44 / Z} rx={17 / Z} ry={21 / Z} fill="#050507" stroke={rim} strokeWidth={0.9} strokeOpacity={0.5} />
          </g>
        )}
        {/* 좌석 등받이 — 위가 둥근 등판 + 통로 쪽 손잡이 */}
        <path d={`M${hi} ${y0 + 2} v${-13 / Z} h${-side * 30 / Z} v${13 / Z}`} stroke="#141216" strokeWidth={Math.max(2, 5 / Z)} fill="none" strokeLinejoin="round" />
        <path d={`M${hi} ${y0 - 11 / Z} h${-side * 30 / Z}`} stroke={rim} strokeWidth={1.2} opacity={0.6} />
        <path d={`M${l} ${y1} V${y0 + 22 / Z} Q${l} ${y0} ${l + 22 / Z} ${y0 - 2 / Z} Q${l + w / 2} ${y0 - 8 / Z} ${l + w - 22 / Z} ${y0 - 2 / Z} Q${l + w} ${y0} ${l + w} ${y0 + 22 / Z} V${y1} Z`} fill="#0E0C0F" />
        <path d={`M${l + 14 / Z} ${y0 + 3 / Z} Q${l + w / 2} ${y0 - 6 / Z} ${l + w - 14 / Z} ${y0 + 3 / Z}`} stroke={rim} strokeWidth={1.6} fill="none" opacity={0.7} />
        <path d={`M${l + w * 0.12} ${y0 + (y1 - y0) * 0.42} H${l + w * 0.88}`} stroke="#1A1619" strokeWidth={Math.max(1, 3 / Z)} />
        <path d={`M${side < 0 ? l + 1 : l + w - 1} ${y0 + 14 / Z} V${y1}`} stroke={rim} strokeWidth={1.2} opacity={0.4} />
      </g>
    );
  };
  const [cx, cy] = P(6, 232, 1.4);
  const cs = 2.45 / 1.4;
  return (
    <SceneSvg>
      <Sky id="zs-evac_bus-bg" stops={[[0, '#030405'], [0.45, '#0A0C10'], [1, '#050506']]} />
      <defs>
        <filter id="zs-evac_bus-blur" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
        <linearGradient id="zs-evac_bus-aisle" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FF7A2A" stopOpacity={0.35} />
          <stop offset="1" stopColor="#FF7A2A" stopOpacity={0} />
        </linearGradient>
      </defs>
      {/* 천장·바닥 */}
      <polygon points={pts(P(-WX, -150, 0.4), P(WX, -150, 0.4), P(WX, -150, 4.6), P(-WX, -150, 4.6))} fill="#08090C" />
      <polygon points={pts(P(-WX, 232, 0.5), P(WX, 232, 0.5), P(WX, 232, 4.6), P(-WX, 232, 4.6))} fill="#0D0B0C" />
      <polygon points={pts(P(-50, 232, 4.6), P(50, 232, 4.6), P(90, 232, 0.7), P(-90, 232, 0.7))} fill="url(#zs-evac_bus-aisle)" />
      {/* 광원 1: 앞 유리 너머 불타는 도로 */}
      <polygon points={pts(P(-WX, -70, 4.6), P(WX, -70, 4.6), P(WX, 110, 4.6), P(-WX, 110, 4.6))} fill="#5A200C" />
      <Glow id="zs-evac_bus-front" cx={400} cy={206} r={150} color="#FF7A2A" opacity={0.75} className="zs-glow" />
      <path d={`M${pts(P(-WX, 60, 4.6))} L${pts(P(-60, 20, 4.6))} L${pts(P(-20, 30, 4.6))} L${pts(P(40, 10, 4.6))} L${pts(P(WX, 50, 4.6))} V${P(0, 110, 4.6)[1]} H${P(-WX, 0, 4.6)[0]} Z`.replace(/(\d),(\d)/g, '$1 $2')} fill="#1A0804" />
      {/* 광원 2: 창밖을 스치는 불빛 */}
      {wall(-1)}
      {wall(1)}
      {/* 천장 손잡이 봉 + 손잡이 */}
      {[-70, 70].map((X) => (
        <g key={X}>
          <line x1={P(X, -96, 0.5)[0]} y1={P(X, -96, 0.5)[1]} x2={P(X, -96, 4.4)[0]} y2={P(X, -96, 4.4)[1]} stroke="#16181C" strokeWidth={3} />
          {[0.8, 1.2, 1.7, 2.3, 3, 3.8].map((Z) => {
            const [hx, hy] = P(X, -96, Z);
            return <path key={Z} d={`M${hx} ${hy} v${30 / Z} m${-7 / Z} 0 l${7 / Z} ${15 / Z} l${7 / Z} ${-15 / Z} Z`} stroke="#16181C" strokeWidth={Math.max(1.2, 3 / Z)} fill="none" />;
          })}
        </g>
      ))}
      {/* 좌석 줄(뒤→앞) + 앉은 승객의 뒷머리 */}
      {[3.3, 2.6, 2.0].flatMap((Z, i) => [seat(-1, Z, i !== 1, `l${Z}`), seat(1, Z, i !== 2, `r${Z}`)])}
      {/* 서 있는 승객들 — 앞 유리 역광 */}
      <Person x={P(24, 232, 2.35)[0]} y={P(24, 232, 2.35)[1]} s={2.45 / 2.35} pose="stand" fill="#040405" />
      <Person x={P(-14, 232, 2.9)[0]} y={P(-14, 232, 2.9)[1]} s={2.45 / 2.9} pose="stand" flip fill="#040405" pack={false} />
      {seat(-1, 1.5, true, 'l1.5')}
      {seat(1, 1.5, false, 'r1.5')}
      {/* 세로 봉 */}
      {[-56, 56].map((X) => (
        <g key={X}>
          <line x1={P(X, -150, 1.7)[0]} y1={P(X, -150, 1.7)[1]} x2={P(X, 232, 1.7)[0]} y2={P(X, 232, 1.7)[1]} stroke="#2A2410" strokeWidth={4} />
          <line x1={P(X, -150, 1.7)[0] - 1.5 * Math.sign(X)} y1={P(X, -150, 1.7)[1]} x2={P(X, 232, 1.7)[0] - 1.5 * Math.sign(X)} y2={P(X, 232, 1.7)[1]} stroke="#FF8A3A" strokeWidth={1} opacity={0.5} />
        </g>
      ))}
      {/* 통로에 웅크려 기침하는 사람 + 입김 */}
      <Person x={cx + 2} y={cy} s={cs} pose="crouch" flip fill="#A0341A" pack={false} />
      <Person x={cx} y={cy} s={cs} pose="crouch" flip fill="#030304" pack={false} />
      <g className="zs-rise">
        <ellipse cx={cx - 34 * cs} cy={cy - 74 * cs} rx={5 * cs} ry={3.5 * cs} fill="#E8D8C8" opacity={0.32} />
        <ellipse cx={cx - 44 * cs} cy={cy - 79 * cs} rx={7 * cs} ry={4.5 * cs} fill="#E8D8C8" opacity={0.2} />
        <ellipse cx={cx - 56 * cs} cy={cy - 86 * cs} rx={9 * cs} ry={6 * cs} fill="#E8D8C8" opacity={0.1} />
      </g>
      <path d={`M${cx - 10 * cs} ${cy - 62 * cs} L${cx - 22 * cs} ${cy - 70 * cs}`} stroke="#030304" strokeWidth={6 * cs} strokeLinecap="round" />
      {/* 전경 좌석(가장 가까운 줄) */}
      {seat(-1, 0.85, false, 'nl')}
      {seat(1, 0.85, false, 'nr')}
      <rect x={P(-110, -128, 4.5)[0]} y={P(0, -138, 4.5)[1]} width={220 / 4.5} height={12} fill="#120604" />
      <text x={400} y={P(0, -129, 4.5)[1]} textAnchor="middle" fontSize={10} fontWeight={800} fill={PAL.alert} opacity={0.9}>
        대피 · 한강대교
      </text>
      <Haze id="zs-evac_bus-haze" y={140} h={120} color="#FF6A2A" opacity={0.08} className="zs-drift" />
      <Vignette id="zs-evac_bus-vig" strength={0.8} />
    </SceneSvg>
  );
}

export const sceneGroupC: Partial<Record<SceneId, ComponentType>> = {
  elevator: Elevator,
  parking_garage: ParkingGarage,
  rooftop: Rooftop,
  evac_bus: EvacBus,
};
