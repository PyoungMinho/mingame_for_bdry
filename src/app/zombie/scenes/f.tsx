/**
 * 씬 그룹 F — shelter · checkpoint · campfire · horde.
 * 무드: 달빛+촛불(shelter) / 탐조등 백청+경고 빨강(checkpoint) / 모닥불 주황(campfire) / 병든 녹색+핏빛 역광(horde).
 * 림라이트는 같은 실루엣을 광원 쪽으로 1~2px 밀어 광원색으로 먼저 그리고, 그 위에 검정 실루엣을 덮어 만든다.
 */
import type { ComponentType, ReactNode } from 'react';
import type { SceneId } from '@/lib/zombie/types';
import { Car, Dog, Fire, Glow, Haze, PAL, Person, SceneSvg, Skyline, Sky, Smoke, Vignette, Zombie, rng } from './primitives';

type Draw = (fill: string, dx: number, dy: number) => ReactNode;

/** 림라이트 — offs 방향으로 밀린 광원색 사본 위에 본체를 덮는다 */
function Rim({ draw, rim, ink, offs, opacity = 0.9 }: { draw: Draw; rim: string; ink: string; offs: [number, number][]; opacity?: number }) {
  return (
    <g>
      <g opacity={opacity}>
        {offs.map(([dx, dy], i) => (
          <g key={i}>{draw(rim, dx, dy)}</g>
        ))}
      </g>
      {draw(ink, 0, 0)}
    </g>
  );
}

// ─────────────────────────────── shelter ───────────────────────────────

function Shelter() {
  const wins = [70, 210, 350, 490, 630];
  const moon = '#A6C6EE';
  const warm = PAL.lamp[4];
  const lanterns: [number, number, number][] = [
    [214, 352, 92],
    [596, 386, 80],
    [446, 306, 46],
  ];
  const r = rng(41);
  const notes = Array.from({ length: 14 }, (_, i) => ({
    x: 566 + (i % 7) * 18 + r() * 4,
    y: 172 + Math.floor(i / 7) * 24 + r() * 5,
    rot: (r() - 0.5) * 16,
    c: r() < 0.4 ? '#D8C98A' : '#C9CFD6',
  }));
  return (
    <SceneSvg>
      <Sky id="zs-shelter-wall" stops={[[0, '#030507'], [0.3, '#0A1017'], [0.6, '#0C121A']]} />
      <defs>
        <linearGradient id="zs-shelter-shaft" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={moon} stopOpacity={0.2} />
          <stop offset="1" stopColor={moon} stopOpacity={0} />
        </linearGradient>
        <radialGradient id="zs-shelter-candle">
          <stop offset="0" stopColor={PAL.lamp[4]} stopOpacity={0.55} />
          <stop offset="1" stopColor={PAL.lamp[3]} stopOpacity={0} />
        </radialGradient>
      </defs>
      {/* 높은 창 — 달빛 */}
      {wins.map((x) => (
        <g key={x}>
          <rect x={x} y={30} width={96} height={64} fill="#1E2C3C" />
          <rect x={x + 4} y={34} width={88} height={56} fill={moon} opacity={0.42} />
          <path d={`M${x + 32} 30 V94 M${x + 64} 30 V94 M${x} 62 H${x + 96}`} stroke="#070B10" strokeWidth={4} />
          {(x === 70 || x === 630) && <path d={`M${x - 4} 40 L${x + 100} 84 M${x - 4} 84 L${x + 100} 40 M${x - 4} 58 H${x + 100}`} stroke="#05070A" strokeWidth={11} />}
        </g>
      ))}
      <Glow id="zs-shelter-moon" cx={420} cy={60} r={220} color={moon} opacity={0.08} />
      {/* 벽 하단 판넬 + 현수막 */}
      <rect x={0} y={214} width={800} height={60} fill="#070A0F" />
      <path d="M0 214 H800" stroke="#243142" strokeWidth={2} />
      <rect x={64} y={120} width={220} height={30} fill="#1A2330" />
      <text x={174} y={141} textAnchor="middle" fontSize={17} fontWeight={800} fill="#8FA3B8" opacity={0.75}>
        ○○초등학교 대피소
      </text>
      {/* 비상구 */}
      <rect x={24} y={170} width={30} height={104} fill="#05080B" />
      <rect x={24} y={156} width={30} height={11} fill={PAL.exit} opacity={0.8} />
      <text x={39} y={165} textAnchor="middle" fontSize={8} fontWeight={800} fill="#04210F">비상구</text>
      <Glow id="zs-shelter-exit" cx={39} cy={162} r={34} color={PAL.exit} opacity={0.22} />
      {/* 농구 골대 */}
      <g stroke="#06090D" fill="none">
        <path d="M372 0 L384 112 M428 0 L416 112" strokeWidth={4} />
        <rect x={354} y={112} width={92} height={60} fill="#101822" strokeWidth={4} />
        <rect x={384} y={136} width={32} height={26} stroke="#3A4B5E" strokeWidth={2} />
        <ellipse cx={400} cy={176} rx={17} ry={4} stroke="#1F160D" strokeWidth={3} />
        <path d="M384 177 L390 198 L400 196 L410 198 L416 177 M392 178 L400 196 L408 178" stroke="#4E5D6C" strokeWidth={1} opacity={0.7} />
      </g>
      {/* 게시판 + 쪽지 */}
      <rect x={556} y={152} width={138} height={60} fill="#241C14" stroke="#05080B" strokeWidth={3} />
      <text x={625} y={166} textAnchor="middle" fontSize={10} fontWeight={800} fill="#E6D8B0" opacity={0.7}>사람 찾습니다</text>
      {notes.map((n, i) => (
        <rect key={i} x={n.x} y={n.y} width={13} height={16} fill={n.c} opacity={0.55} transform={`rotate(${n.rot.toFixed(1)} ${n.x + 6} ${n.y + 8})`} />
      ))}
      {/* 바닥 — 광택 마룻바닥 + 코트 라인 */}
      <path d="M0 274 H800 V450 H0 Z" fill="#07090D" />
      <path d="M340 274 L310 318 H490 L460 274 M0 300 C200 292 600 292 800 300" stroke="#3B4A5C" strokeWidth={2} fill="none" opacity={0.5} />
      {/* 달빛 기둥 + 바닥 반사 */}
      <g className="zs-drift">
        {wins.slice(1, 4).map((x) => (
          <polygon key={x} points={`${x + 4},94 ${x + 92},94 ${x + 214},420 ${x + 118},420`} fill="url(#zs-shelter-shaft)" />
        ))}
      </g>
      {wins.slice(1, 4).map((x) => (
        <ellipse key={x} cx={x + 150} cy={372} rx={56} ry={12} fill={moon} opacity={0.05} />
      ))}
      {/* 매트·담요 */}
      <g fill="#10151D">
        <path d="M120 372 L150 330 L300 330 L290 372 Z" />
        <path d="M500 402 L520 360 L690 360 L700 402 Z" />
        <path d="M380 318 L392 296 L500 296 L506 318 Z" />
        <path d="M640 318 L650 298 L760 298 L770 318 Z" />
      </g>
      <g fill="#0A0E14">
        <ellipse cx={690} cy={312} rx={40} ry={10} />
        <ellipse cx={650} cy={392} rx={36} ry={11} />
        <ellipse cx={272} cy={362} rx={24} ry={8} />
      </g>
      {/* 랜턴 광원 */}
      <g className="zs-glow">
        {lanterns.map(([x, y, rr], i) => (
          <Glow key={i} id={`zs-shelter-lan${i}`} cx={x} cy={y - 8} r={rr} color={PAL.lamp[3]} opacity={0.55} />
        ))}
      </g>
      {lanterns.map(([x, y], i) => (
        <g key={i}>
          <rect x={x - 4} y={y - 14} width={8} height={12} rx={2} fill={warm} />
          <rect x={x - 5} y={y - 3} width={10} height={3} fill="#2A1A0A" />
        </g>
      ))}
      {/* 인물 — 랜턴 쪽 림라이트 */}
      <Rim rim={PAL.lamp[3]} ink="#05070A" offs={[[1.6, -0.8]]} draw={(f, dx, dy) => <Person x={170 + dx} y={368 + dy} s={0.86} pose="sit" fill={f} />} />
      <Rim rim={PAL.lamp[3]} ink="#05070A" offs={[[-1.6, -0.8]]} draw={(f, dx, dy) => <Person x={262 + dx} y={366 + dy} s={0.8} pose="sit" flip fill={f} pack={false} />} />
      <Rim rim={PAL.lamp[3]} ink="#05070A" offs={[[-1.6, -0.8]]} draw={(f, dx, dy) => <Person x={234 + dx} y={346 + dy} s={0.5} pose="sit" flip fill={f} pack={false} />} />
      <Rim rim={PAL.lamp[3]} ink="#05070A" offs={[[1.6, -0.8]]} draw={(f, dx, dy) => <Person x={548 + dx} y={400 + dy} s={0.92} pose="sit" fill={f} />} />
      <Person x={424} y={308} s={0.42} pose="sit" fill="#070A0E" />
      <Person x={474} y={310} s={0.42} pose="sit" flip fill="#070A0E" pack={false} />
      <Person x={330} y={296} s={0.5} pose="walk" fill="#0A0F15" />
      <Person x={704} y={300} s={0.44} pose="stand" flip fill="#0A0F15" />
      <Haze id="zs-shelter-haze" y={250} h={110} color={moon} opacity={0.07} />
      {/* 촛불 점점이 */}
      <g className="zs-flicker">
        {[[112, 410], [360, 380], [724, 350], [470, 424]].map(([x, y]) => (
          <g key={x}>
            <circle cx={x} cy={y} r={22} fill="url(#zs-shelter-candle)" />
            <rect x={x - 1.5} y={y - 2} width={3} height={7} fill="#E8E0CC" />
            <ellipse cx={x} cy={y - 5} rx={1.8} ry={3} fill={warm} />
          </g>
        ))}
      </g>
      {/* 전경 — 담요 덮고 누운 사람 */}
      <path d="M0 450 L0 420 C60 404 150 408 220 426 C250 434 262 444 264 450 Z" fill="#040608" />
      <path d="M800 450 L800 424 C740 414 690 420 650 440 L640 450 Z" fill="#040608" />
      <Vignette id="zs-shelter-vig" strength={0.8} />
    </SceneSvg>
  );
}

// ─────────────────────────────── checkpoint ───────────────────────────────

/** 헬멧 + 소총을 든 군인 — Person 위에 장비만 덧그린다 */
function Soldier({ x, y, s = 1, flip, fill = PAL.ink }: { x: number; y: number; s?: number; flip?: boolean; fill?: string }) {
  return (
    <g>
      <Person x={x} y={y} s={s} flip={flip} pose="stand" pack={false} fill={fill} />
      <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`} fill={fill} stroke={fill} strokeLinecap="round">
        <path d="M-8.5 -92 C-9 -105 12 -106 12 -92 Z" strokeWidth={1} />
        <ellipse cx={1.8} cy={-92} rx={11} ry={2.6} />
        <path d="M-6 -50 L26 -84" strokeWidth={4} />
        <path d="M-8 -48 L-2 -44 L2 -52 Z M10 -66 L14 -58 L18 -62" strokeWidth={3} />
      </g>
    </g>
  );
}

/** 탐조등 빔 — 세로 대칭 원뿔을 lean 만큼 기울인다(스윕은 안쪽 g 에) */
function Beam({ id, x, y, lean, len = 460, spread = 58, sweep }: { id: string; x: number; y: number; lean: number; len?: number; spread?: number; sweep?: boolean }) {
  return (
    <g transform={`rotate(${lean} ${x} ${y})`}>
      <defs>
        <linearGradient id={id} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#E4F1FF" stopOpacity={0.5} />
          <stop offset="0.5" stopColor="#B9D6F2" stopOpacity={0.16} />
          <stop offset="1" stopColor="#B9D6F2" stopOpacity={0} />
        </linearGradient>
      </defs>
      <g className={sweep ? 'zs-sweep' : undefined}>
        <polygon points={`${x},${y} ${x - spread},${y - len} ${x + spread},${y - len}`} fill={`url(#${id})`} />
        <polygon points={`${x},${y} ${x - spread * 0.3},${y - len} ${x + spread * 0.3},${y - len}`} fill={`url(#${id})`} />
      </g>
    </g>
  );
}

function Checkpoint() {
  const ice = '#CFE4FA';
  const wire = Array.from({ length: 34 }, (_, i) => 40 + i * 14);
  return (
    <SceneSvg>
      <Sky id="zs-checkpoint-sky" stops={[[0, '#020407'], [0.35, '#07111A'], [0.56, '#142A38']]} />
      {/* 강 건너 강남 + 한강 교량 */}
      <Skyline base={252} minH={10} maxH={52} seed={23} fill="#10212C" win={PAL.screen} litRatio={0.03} />
      <path d="M0 238 H800 V246 H0 Z" fill="#0C1A23" />
      <path d="M40 238 Q120 214 200 238 Q280 214 360 238 Q440 214 520 238 Q600 214 680 238 Q760 214 840 238" stroke="#0C1A23" strokeWidth={3} fill="none" />
      <rect x={0} y={252} width={800} height={40} fill="#060D13" />
      <g className="zs-shimmer">
        <path d="M250 262 H340 M290 272 H420 M430 266 H520 M360 282 H470" stroke={ice} strokeWidth={1.5} opacity={0.35} />
      </g>
      <Haze id="zs-checkpoint-haze1" y={200} h={90} color="#6F98BA" opacity={0.34} />
      {/* 탐조등 빔 — 교차 */}
      <Beam id="zs-checkpoint-beamA" x={176} y={196} lean={50} sweep />
      <Beam id="zs-checkpoint-beamB" x={566} y={300} lean={-38} len={520} />
      
      {/* 지면 — 강변 도로 */}
      <path d="M0 292 H800 V450 H0 Z" fill="#070C10" />
      <path d="M0 292 H800" stroke="#2C4556" strokeWidth={1.5} opacity={0.7} />
      <defs>
        <radialGradient id="zs-checkpoint-pool">
          <stop offset="0" stopColor={ice} stopOpacity={0.5} />
          <stop offset="0.5" stopColor="#7FA6C8" stopOpacity={0.18} />
          <stop offset="1" stopColor="#7FA6C8" stopOpacity={0} />
        </radialGradient>
      </defs>
      <Haze id="zs-checkpoint-haze3" y={286} h={110} color="#7FA6C8" opacity={0.3} />
      <ellipse cx={380} cy={372} rx={260} ry={46} fill="url(#zs-checkpoint-pool)" />
      <Beam id="zs-checkpoint-beamC" x={176} y={196} lean={128} len={250} spread={46} />
      {/* 감시탑 */}
      <g stroke="#05090C" strokeWidth={4} fill="none">
        <path d="M150 394 L162 214 M206 394 L194 214 M156 320 L200 270 M200 320 L156 270 M152 360 L204 330" />
      </g>
      <rect x={146} y={200} width={64} height={18} fill="#05090C" />
      <path d="M140 200 L178 184 L216 200 Z" fill="#05090C" />
      <circle cx={176} cy={196} r={6} fill="#F4FAFF" />
      <Glow id="zs-checkpoint-lampA" cx={176} cy={196} r={46} color={ice} opacity={0.7} />
      {/* 군 트럭 (왼쪽을 향함) */}
      <g fill="#060A0E">
        <path d="M586 380 V318 C586 300 600 294 640 294 H716 C730 294 736 300 736 312 V380 Z" />
        <path d="M530 380 V338 L542 314 H584 V380 Z" />
        <circle cx={558} cy={382} r={17} />
        <circle cx={660} cy={382} r={17} />
        <circle cx={700} cy={382} r={17} />
      </g>
      <path d="M538 336 L546 320 H578 V336 Z" fill="#1B3342" />
      <path d="M600 304 H724" stroke="#2E4B5E" strokeWidth={1.5} />
      <text x={662} y={350} textAnchor="middle" fontSize={15} fontWeight={800} fill="#2E4B5E">육군</text>
      <rect x={558} y={302} width={16} height={10} fill="#060A0E" />
      <circle cx={566} cy={300} r={5} fill="#F4FAFF" />
      <Glow id="zs-checkpoint-lampB" cx={566} cy={300} r={40} color={ice} opacity={0.7} />
      {/* 병사들 — 빔 역광 림라이트 */}
      <Rim rim={ice} ink="#04070A" offs={[[0, -1.2]]} draw={(f, dx, dy) => <Soldier x={300 + dx} y={392 + dy} s={0.82} fill={f} />} />
      <Rim rim={ice} ink="#04070A" offs={[[0, -1.2]]} draw={(f, dx, dy) => <Soldier x={470 + dx} y={394 + dy} s={0.86} flip fill={f} />} />
      <Rim rim={ice} ink="#04070A" offs={[[0, -1.2]]} draw={(f, dx, dy) => <Soldier x={520 + dx} y={384 + dy} s={0.7} flip fill={f} />} />
      {/* 바리케이드 + 철조망 */}
      <g fill="#0A1117">
        {[40, 132, 224, 316, 408].map((x) => (
          <path key={x} d={`M${x} 412 L${x + 8} 378 H${x + 80} L${x + 88} 412 Z`} />
        ))}
      </g>
      <g fill="#8C1F1F" opacity={0.55}>
        {[40, 132, 224, 316, 408].map((x) => (
          <path key={x} d={`M${x + 10} 388 H${x + 30} L${x + 26} 402 H${x + 6} Z M${x + 50} 388 H${x + 70} L${x + 74} 402 H${x + 54} Z`} />
        ))}
      </g>
      <g fill="none" stroke="#0B141B" strokeWidth={1.6}>
        {wire.map((x) => (
          <ellipse key={x} cx={x} cy={x % 28 === 12 ? 370 : 373} rx={9} ry={9} />
        ))}
      </g>
      {/* 경고등 */}
      <g className="zs-blink">
        {[84, 268, 452].map((x) => (
          <g key={x}>
            <circle cx={x} cy={374} r={18} fill="#FF2A2A" opacity={0.25} />
            <circle cx={x} cy={376} r={4.5} fill="#FF4A3A" />
          </g>
        ))}
      </g>
      {/* 경고 표지판 */}
      <rect x={356} y={370} width={5} height={14} fill="#05080B" />
      <rect x={418} y={370} width={5} height={14} fill="#05080B" />
      <rect x={334} y={330} width={112} height={42} fill="#B3261E" stroke="#05080B" strokeWidth={3} />
      <text x={390} y={348} textAnchor="middle" fontSize={15} fontWeight={800} fill="#FFF3E6">통제구역</text>
      <text x={390} y={365} textAnchor="middle" fontSize={10} fontWeight={700} fill="#FFD9CF">검문소 · 정지</text>
      <Haze id="zs-checkpoint-haze2" y={380} h={70} color="#2B4A60" opacity={0.25} />
      <path d="M0 450 V430 C120 420 260 424 360 440 L380 450 Z" fill="#020407" />
      <Vignette id="zs-checkpoint-vig" strength={0.82} />
    </SceneSvg>
  );
}

// ─────────────────────────────── campfire ───────────────────────────────

function Campfire() {
  const hot = PAL.fire[4];
  const rimC = PAL.fire[3];
  const r = rng(77);
  const sparks = Array.from({ length: 16 }, () => ({ x: 392 + (r() - 0.5) * 60, y: 250 + r() * 90, rr: 0.8 + r() * 1.4 }));
  const holes = Array.from({ length: 9 }, (_, i) => ({ x: 96 + (i % 3) * 30, y: 190 + Math.floor(i / 3) * 34 }));
  return (
    <SceneSvg>
      <Sky id="zs-campfire-sky" stops={[[0, '#060405'], [0.45, '#140908'], [0.72, '#2E1209']]} />
      {/* 먼 폐허 — 희미하게 */}
      <Skyline base={300} minH={30} maxH={110} seed={5} fill="#1C0C08" />
      <Glow id="zs-campfire-ambient" cx={400} cy={350} r={330} color={PAL.fire[2]} opacity={0.32} className="zs-glow" />
      {/* 무너진 건물 — 불빛에 아랫부분만 붉게 */}
      <defs>
        <linearGradient id="zs-campfire-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#020101" />
          <stop offset="0.6" stopColor="#0A0403" />
          <stop offset="1" stopColor="#2A0F07" />
        </linearGradient>
      </defs>
      <path d="M40 350 V170 L70 152 L96 176 L118 140 L150 168 L176 150 L196 184 L214 176 V350 Z" fill="url(#zs-campfire-wall)" />
      {holes.map((h, i) => (
        <rect key={i} x={h.x} y={h.y} width={16} height={20} fill="#030202" />
      ))}
      <path d="M118 140 L114 118 M150 168 L156 144 M176 150 L172 128 M70 152 L64 134" stroke="#020101" strokeWidth={3} />
      <path d="M560 350 V206 L600 190 L612 214 L650 186 L668 222 L700 204 L732 232 V350 Z" fill="url(#zs-campfire-wall)" />
      <path d="M612 214 L618 190 M650 186 L646 164 M700 204 L708 184" stroke="#020101" strokeWidth={3} />
      <g transform="rotate(-9 640 290)">
        <rect x={596} y={276} width={96} height={26} fill="#1A0B06" />
        <text x={644} y={295} textAnchor="middle" fontSize={16} fontWeight={800} fill="#6E3418" opacity={0.85}>편의점</text>
      </g>
      {/* 어둠 속 — 불빛 끝에 서 있는 것 */}
      <Zombie x={712} y={352} s={0.52} pose="shamble" flip fill="#0A0504" />
      <path d="M740 262 L743 262 M748 262 L751 262" stroke="#8E2A12" strokeWidth={1.4} opacity={0.6} />
      {/* 지면 + 불빛 웅덩이 */}
      <path d="M0 340 C200 330 600 330 800 340 V450 H0 Z" fill="#080404" />
      <defs>
        <radialGradient id="zs-campfire-pool">
          <stop offset="0" stopColor={PAL.fire[3]} stopOpacity={0.55} />
          <stop offset="0.5" stopColor={PAL.fire[2]} stopOpacity={0.2} />
          <stop offset="1" stopColor={PAL.fire[1]} stopOpacity={0} />
        </radialGradient>
      </defs>
      <ellipse cx={400} cy={384} rx={300} ry={62} fill="url(#zs-campfire-pool)" />
      {/* 길게 드리운 그림자 */}
      <g fill="#050202" opacity={0.85}>
        <path d="M300 390 L120 420 L128 432 L310 396 Z" />
        <path d="M502 390 L700 424 L690 436 L494 396 Z" />
      </g>
      {/* 뒤쪽 생존자 — 불을 마주 보아 앞면이 붉게 */}
      <Rim rim="#0A0403" ink="#5A240E" offs={[[2, 0]]} opacity={1} draw={(f, dx, dy) => <Person x={462 + dx} y={354 + dy} s={0.8} pose="stand" flip fill={f} pack={false} />} />
      {/* 모닥불 */}
      <Smoke x={396} y={300} s={0.6} color="#1A0C08" opacity={0.5} lean={1} />
      <g fill="#140807">
        {[-40, -26, -10, 8, 24, 38].map((dx) => (
          <ellipse key={dx} cx={400 + dx} cy={384 + Math.abs(dx) * 0.05} rx={9} ry={5} />
        ))}
      </g>
      <path d="M368 382 L430 370 M372 370 L432 384" stroke="#2A0E06" strokeWidth={7} strokeLinecap="round" />
      <Fire id="zs-campfire-fire" x={400} y={378} s={1.25} />
      <circle cx={400} cy={364} r={14} fill={hot} opacity={0.35} />
      <g className="zs-rise">
        {sparks.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={p.rr} fill={hot} opacity={0.8} />
        ))}
      </g>
      {/* 둘러앉은 생존자 + 콩이 — 불 쪽 윤곽이 빛난다 */}
      <Rim rim={rimC} ink="#050202" offs={[[2, -0.8]]} draw={(f, dx, dy) => <Person x={296 + dx} y={396 + dy} s={1.08} pose="sit" fill={f} />} />
      <Rim rim={rimC} ink="#050202" offs={[[1.6, -0.6]]} draw={(f, dx, dy) => <Dog x={236 + dx} y={398 + dy} s={1.25} pose="sit" fill={f} />} />
      <Rim rim={rimC} ink="#050202" offs={[[-2, -0.8]]} draw={(f, dx, dy) => <Person x={508 + dx} y={396 + dy} s={1.08} pose="sit" flip fill={f} pack={false} />} />
      <Rim rim={rimC} ink="#050202" offs={[[-2, -0.8]]} draw={(f, dx, dy) => <Person x={570 + dx} y={388 + dy} s={0.9} pose="sit" flip fill={f} />} />
      {/* 전경 잔해 */}
      <g fill="#020101">
        <path d="M0 450 V404 L30 396 L52 410 L90 402 L130 420 L170 424 L190 450 Z" />
        <path d="M800 450 V398 L770 392 L742 410 L700 414 L668 432 L650 450 Z" />
      </g>
      <path d="M40 404 L24 356 M60 408 L70 366 M760 396 L776 350" stroke="#020101" strokeWidth={3} />
      <Vignette id="zs-campfire-vig" strength={0.9} />
    </SceneSvg>
  );
}

// ─────────────────────────────── horde ───────────────────────────────

type Row = { n: number; y: number; jy: number; s: number; js: number; fill: string; x0: number; x1: number; seed: number };

/** 한 줄의 좀비 무리 — 결정론적 배치 */
function HordeRow({ n, y, jy, s, js, fill, x0, x1, seed }: Row) {
  const r = rng(seed);
  const poses = ['shamble', 'reach', 'lurch'] as const;
  return (
    <g>
      {Array.from({ length: n }, (_, i) => {
        const x = x0 + ((x1 - x0) * (i + 0.2 + r() * 0.6)) / n;
        const flip = x > 400 ? r() < 0.8 : r() < 0.2;
        return (
          <Zombie key={i} x={x} y={y + (r() - 0.5) * jy} s={s + (r() - 0.5) * js} pose={poses[Math.floor(r() * 3)]} flip={flip} fill={fill} className={i % 3 === 0 ? 'zs-sway' : undefined} />
        );
      })}
    </g>
  );
}

function Horde() {
  const vx = 400;
  const vy = 236;
  const green = PAL.sick[4];
  const red = '#C22A1E';
  const rays = [-150, -95, -52, -18, 18, 52, 95, 150];
  return (
    <SceneSvg>
      <Sky id="zs-horde-sky" stops={[[0, '#1E0404'], [0.22, '#2A0906'], [0.4, '#1A1F0A'], [0.5, '#2C3D18'], [0.56, '#6E8A2E']]} />
      <Glow id="zs-horde-red1" cx={110} cy={250} r={230} color={red} opacity={0.5} />
      <Glow id="zs-horde-red2" cx={700} cy={240} r={220} color={red} opacity={0.42} />
      <Glow id="zs-horde-sun" cx={vx} cy={vy} r={260} color={green} opacity={0.75} className="zs-glow" />
      {/* 역광 빛줄기 */}
      <g fill={green}>
        {rays.map((d, i) => (
          <polygon key={d} points={`${vx},${vy} ${vx + d * 3.4 - 10 - (i % 3) * 14},0 ${vx + d * 3.4 + 10 + (i % 2) * 18},0`} opacity={0.03 + (i % 3) * 0.015} />
        ))}
      </g>
      <Skyline base={250} minH={16} maxH={60} seed={31} fill="#33461A" />
      <Smoke x={610} y={244} s={1.3} color="#1A2410" opacity={0.7} />
      {/* 거리 양옆 건물 — 소실점으로 수렴 */}
      <path d="M0 0 H70 L300 196 V256 L0 330 Z" fill="#0A0E06" />
      <path d="M800 0 H730 L500 196 V256 L800 330 Z" fill="#0A0E06" />
      <path d={[20, 90, 160, 230, 300].map((y) => `M0 ${y} L300 ${vy + (y - vy) / 4} M800 ${y} L500 ${vy + (y - vy) / 4}`).join(' ')} stroke="#1B2410" strokeWidth={1.5} />
      <Glow id="zs-horde-red3" cx={40} cy={300} r={240} color={red} opacity={0.26} />
      <Glow id="zs-horde-red4" cx={770} cy={290} r={220} color={red} opacity={0.2} />
      <g transform="translate(116 120)">
        <rect x={0} y={0} width={30} height={78} fill="#1A0605" />
        <text x={15} y={30} textAnchor="middle" fontSize={22} fontWeight={800} fill={red} opacity={0.9}>약</text>
        <path d="M9 50 H21 M15 44 V56" stroke={red} strokeWidth={4} opacity={0.9} />
      </g>
      <g transform="translate(620 150)">
        <rect x={0} y={0} width={70} height={26} fill="#0E1508" />
        <text x={35} y={19} textAnchor="middle" fontSize={16} fontWeight={800} fill="#7E9A3A" opacity={0.8}>응급실</text>
      </g>
      {/* 도로 + 젖은 노면 반사 */}
      <path d="M0 330 L300 256 H500 L800 330 V450 H0 Z" fill="#0B1007" />
      <polygon points={`${vx - 14},256 ${vx + 14},256 ${vx + 90},450 ${vx - 90},450`} fill={green} opacity={0.12} />
      {/* 무리 — 뒤로 갈수록 밝고 작게 */}
      <HordeRow n={26} y={262} jy={8} s={0.24} js={0.06} fill="#3A4E1C" x0={250} x1={560} seed={3} />
      <Haze id="zs-horde-haze1" y={236} h={50} color={green} opacity={0.4} className="zs-drift" />
      <HordeRow n={16} y={292} jy={14} s={0.42} js={0.08} fill="#1C260F" x0={170} x1={640} seed={8} />
      <Haze id="zs-horde-haze2" y={262} h={60} color="#5D7A28" opacity={0.28} />
      <HordeRow n={9} y={346} jy={16} s={0.8} js={0.12} fill="#0C1108" x0={90} x1={720} seed={12} />
      <Car x={610} y={372} s={1.1} fill="#070A05" flip />
      {/* 앞줄 — 크고 가깝게, 녹색·붉은 림 */}
      <Rim rim={green} ink={PAL.ink} offs={[[1.5, -1.2]]} draw={(f, dx, dy) => <Zombie x={400 + dx} y={430 + dy} s={1.45} pose="reach" flip fill={f} className="zs-sway" />} />
      <Rim rim={red} ink={PAL.ink} offs={[[1.8, -1.4]]} draw={(f, dx, dy) => <Zombie x={128 + dx} y={478 + dy} s={2.1} pose="lurch" fill={f} />} />
      <Rim rim={green} ink={PAL.ink} offs={[[-1.8, -1.4]]} draw={(f, dx, dy) => <Zombie x={676 + dx} y={482 + dy} s={2.2} pose="shamble" flip fill={f} />} />
      <Vignette id="zs-horde-vig" strength={0.85} />
    </SceneSvg>
  );
}

export const sceneGroupF: Partial<Record<SceneId, ComponentType>> = {
  shelter: Shelter,
  checkpoint: Checkpoint,
  campfire: Campfire,
  horde: Horde,
};
