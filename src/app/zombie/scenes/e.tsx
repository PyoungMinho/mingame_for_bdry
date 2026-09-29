/**
 * 씬 그룹 E — mart · hospital · bike_street · raiders.
 * 무드: 마트=거친 백색 형광 / 병원=초록 비상등+청백 격리실 / 자전거=새벽 청색+속도감 / 약탈자=드럼통 주황+칠흑.
 * 초점 인물은 "림 사본"(광원 쪽으로 1~2px 밀린 밝은 복제) 위에 본체를 얹어 윤곽광을 만든다.
 */
import type { ComponentType, ReactNode } from 'react';
import type { SceneId } from '@/lib/zombie/types';
import { ApartmentBlock, Car, Fire, Glow, Haze, Lamp, PAL, Person, SceneSvg, Skyline, Sky, Smoke, Vignette, Zombie, rng } from './primitives';

type Pt = [number, number];
/** 1점 투시 — 월드 (X, Y, z) → 화면. z=1 이 화면 평면, 소실점 (vx, vy) */
const persp = (vx: number, vy: number) => (X: number, Y: number, z: number): Pt => [vx + (X - vx) / z, vy + (Y - vy) / z];
const pts = (a: Pt[]) => a.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

// ─────────────────────────────── mart ───────────────────────────────

const GOODS = ['#B8463A', '#D9A93C', '#3F74A8', '#4E9A62', '#C9CFC4', '#8A4F8C', '#D87A36'];

function MartShelf({ side, seed }: { side: 1 | -1; seed: number }) {
  const P = persp(400, 205);
  const X = side < 0 ? 110 : 690;
  const r = rng(seed);
  const levels = [40, 130, 220, 310, 400];
  const goods: ReactNode[] = [];
  levels.slice(1).forEach((yb, li) => {
    let z = 0.7;
    while (z < 4.4) {
      const dz = 0.14 + r() * 0.16;
      const gap = r() < 0.34; // 약탈로 빈 칸
      if (!gap) {
        const h = 34 + r() * 40;
        const c = GOODS[Math.floor(r() * GOODS.length)];
        goods.push(<polygon key={`${li}-${z.toFixed(2)}`} points={pts([P(X, yb - h, z), P(X, yb - h, z + dz), P(X, yb - 4, z + dz), P(X, yb - 4, z)])} fill={c} opacity={0.16 + r() * 0.22} />);
      }
      z += dz + 0.02;
    }
  });
  return (
    <g>
      <polygon points={pts([P(X, 40, 0.6), P(X, 40, 4.5), P(X, 470, 4.5), P(X, 470, 0.6)])} fill="#0B100F" />
      {goods}
      {levels.map((y) => (
        <polygon key={y} points={pts([P(X, y - 3, 0.6), P(X, y - 3, 4.5), P(X, y + 5, 4.5), P(X, y + 5, 0.6)])} fill="#A9C0B9" opacity={0.5} />
      ))}
      <polygon points={pts([P(X, 20, 0.6), P(X, 20, 4.5), P(X, 40, 4.5), P(X, 40, 0.6)])} fill={PAL.ink} />
    </g>
  );
}

function Mart() {
  const P = persp(400, 205);
  const tubes = [1.35, 1.9, 2.6, 3.4, 4.2];
  const off = [1, 3];
  return (
    <SceneSvg>
      <rect width={800} height={450} fill="#070A0A" />
      {/* 통로 끝 — 교차 통로의 밝은 형광 */}
      <Sky id="zs-mart-end" x={330} y={130} w={140} h={138} stops={[[0, '#3C4845'], [0.5, '#C9D8D2'], [1, '#6F7E79']]} />
      <Glow id="zs-mart-endglow" cx={400} cy={210} r={230} color="#DDEEE7" opacity={0.45} />
      {/* 바닥 — 광택 반사 */}
      <polygon points={pts([P(110, 470, 0.6), P(110, 470, 4.5), P(690, 470, 4.5), P(690, 470, 0.6)])} fill="#141A18" />
      <polygon points={pts([P(330, 470, 0.9), P(330, 470, 4.5), P(470, 470, 4.5), P(470, 470, 0.9)])} fill="#AFC2BB" opacity={0.1} />
      {/* 천장 + 형광등 */}
      <polygon points={pts([P(110, 40, 0.6), P(110, -90, 0.6), P(690, -90, 0.6), P(690, 40, 0.6), P(690, 40, 4.5), P(690, -90, 4.5), P(110, -90, 4.5), P(110, 40, 4.5)])} fill="#0C1110" />
      {tubes.map((z, i) => {
        const [x0, y0] = P(250, -60, z);
        const [x1] = P(550, -60, z);
        const t = 7 / z;
        const lit = !off.includes(i);
        const cone = <polygon points={pts([[x0, y0], [x1, y0], P(600, 470, z + 0.15), P(200, 470, z + 0.15)])} fill="#E6F4EE" opacity={0.06} />;
        const bar = <rect x={x0} y={y0} width={x1 - x0} height={t} rx={t / 2} fill={lit ? '#F2FBF7' : '#2A3431'} />;
        return i === 2 ? (
          <g key={z} className="zs-flicker">{cone}{bar}</g>
        ) : (
          <g key={z}>{lit && cone}{bar}</g>
        );
      })}
      <Haze id="zs-mart-haze1" y={170} h={110} color="#CFE2DB" opacity={0.28} />
      {/* 통로 끝 좀비 — 밝은 배경에 검은 실루엣 */}
      <g className="zs-sway">
        <Zombie x={446} y={268} s={0.7} pose="shamble" flip fill="#0A0F0E" />
      </g>
      <Zombie x={416} y={266} s={0.62} pose="reach" flip fill="#18211F" />
      <MartShelf side={-1} seed={21} />
      <MartShelf side={1} seed={34} />
      {/* 매달린 통로 표지 */}
      {(() => {
        const [ax, ay] = P(320, -60, 2.25);
        const [bx, by] = P(480, -10, 2.25);
        return (
          <g>
            <path d={`M${ax + 8} ${ay - 60} V${ay} M${bx - 8} ${ay - 60} V${ay}`} stroke="#1A2220" strokeWidth={1.5} />
            <rect x={ax} y={ay} width={bx - ax} height={by - ay} rx={3} fill="#0E1513" stroke="#6E8A82" strokeWidth={1} />
            <circle cx={ax + 14} cy={(ay + by) / 2} r={9} fill="#D9A93C" />
            <text x={ax + 14} y={(ay + by) / 2 + 4.5} textAnchor="middle" fontSize={13} fontWeight={800} fill="#0E1513">7</text>
            <text x={ax + 28} y={(ay + by) / 2 + 5} fontSize={14} fontWeight={800} fill="#DCE9E4">생수·라면</text>
          </g>
        );
      })()}
      {/* 쏟아진 물건 조각 */}
      {Array.from({ length: 26 }, (_, i) => {
        const r = rng(80 + i);
        const z = 1.15 + r() * 1.6;
        const [x, y] = P(250 + r() * 300, 470, z);
        return <rect key={i} x={x} y={y - 6 / z} width={(10 + r() * 16) / z} height={(6 + r() * 6) / z} fill={GOODS[i % GOODS.length]} opacity={0.55} transform={`rotate(${(r() - 0.5) * 50} ${x} ${y})`} />;
      })}
      {/* 생수 한 팩을 두고 다투는 두 사람 — 림: 통로 끝 광원 방향 */}
      <Person x={303} y={353} s={1.6} pose="walk" fill="#9DB3AC" />
      <Person x={301} y={354} s={1.6} pose="walk" fill={PAL.ink} />
      <Person x={373} y={347} s={1.5} pose="stand" flip fill="#9DB3AC" />
      <Person x={375} y={348} s={1.5} pose="stand" flip fill={PAL.ink} />
      <rect x={318} y={272} width={42} height={27} rx={3} fill="#0C1413" stroke="#7FA0C4" strokeWidth={1.4} />
      <text x={339} y={290} textAnchor="middle" fontSize={11} fontWeight={800} fill="#9FC0E0">생수</text>
      {/* 전경 — 넘어진 카트 */}
      <g stroke="#0A0E0D" strokeWidth={3.5} fill="none" strokeLinejoin="round">
        <path d="M560 432 L600 368 L700 360 L712 420 Z" fill="rgba(4,6,5,0.55)" />
        <path d="M575 408 L706 392 M588 388 L702 376 M596 432 L620 366 M628 428 L648 364 M662 424 L676 362 M690 422 L700 361" strokeWidth={2} />
        <path d="M700 360 L740 336 L752 340" strokeWidth={4.5} />
        <circle cx={566} cy={438} r={7} fill="#0A0E0D" />
        <circle cx={716} cy={428} r={7} fill="#0A0E0D" />
      </g>
      <path d="M560 432 L600 368 L700 360" stroke="#9FB5AE" strokeWidth={1} fill="none" opacity={0.35} />
      <Vignette id="zs-mart-vig" strength={0.8} />
    </SceneSvg>
  );
}

// ─────────────────────────────── hospital ───────────────────────────────

function Hospital() {
  return (
    <SceneSvg>
      <Sky id="zs-hospital-wall" stops={[[0, '#030806'], [0.5, '#081510'], [0.77, '#0B1C15'], [0.771, '#07100C'], [1, '#030604']]} />
      {/* 왼쪽 복도 입구 + 비상구 */}
      <rect x={46} y={120} width={130} height={226} fill="#010302" />
      <polygon points="46,346 176,346 128,236 94,236" fill="#0C2519" opacity={0.8} />
      <rect x={96} y={178} width={30} height={58} fill="#0E3A25" />
      <rect x={104} y={186} width={14} height={8} fill={PAL.exit} opacity={0.7} />
      <Glow id="zs-hospital-exitglow" cx={112} cy={88} r={170} color={PAL.exit} opacity={0.42} className="zs-glow" />
      <polygon points="70,104 154,104 230,346 -10,346" fill={PAL.exit} opacity={0.07} />
      <g className="zs-glow">
        <rect x={66} y={70} width={92} height={34} rx={3} fill={PAL.exit} />
        <circle cx={82} cy={80} r={3} fill="#E9FFF2" />
        <path d="M81 84 L78 93 L73 97 M79 88 L85 92 L88 97 M80 86 L86 84" stroke="#E9FFF2" strokeWidth={2.6} fill="none" strokeLinecap="round" />
        <text x={124} y={93} textAnchor="middle" fontSize={15} fontWeight={800} fill="#EAFFF3">비상구</text>
      </g>
      <text x={112} y={140} textAnchor="middle" fontSize={10} fontWeight={700} fill="#4B8E6C" opacity={0.8}>← 응급실</text>

      {/* 격리실 유리창 — 안쪽은 차가운 청백 */}
      <Sky id="zs-hospital-room" x={262} y={96} w={496} h={226} stops={[[0, '#6D8DA6'], [0.45, '#D6E6F1'], [1, '#5D7A91']]} />
      <Glow id="zs-hospital-roomlight" cx={420} cy={120} r={180} color="#F2FAFF" opacity={0.55} className="zs-flicker" />
      {/* 방 안 — 침대 · 링거대 (유리 너머라 밝고 흐리게) */}
      <g fill="#6F889C">
        <rect x={300} y={250} width={160} height={16} rx={4} />
        <rect x={296} y={218} width={12} height={62} rx={3} />
        <rect x={312} y={238} width={42} height={14} rx={6} />
        <path d="M312 266 V300 M450 266 V300" stroke="#6F889C" strokeWidth={4} />
        <path d="M478 150 V300 M468 300 H490 M470 158 H486" stroke="#6F889C" strokeWidth={2.5} />
        <rect x={472} y={160} width={10} height={16} rx={3} />
      </g>
      {/* 반쯤 걷힌 커튼 + 그 뒤의 그림자 */}
      <rect x={512} y={104} width={238} height={210} fill="#AFC4D3" />
      {Array.from({ length: 11 }, (_, i) => (
        <rect key={i} x={516 + i * 21.5} y={104} width={9} height={210} fill="#7E97AA" opacity={0.45} />
      ))}
      <g className="zs-sway">
        <Zombie x={640} y={318} s={2.05} pose="reach" flip fill="#2A3F52" />
      </g>
      <rect x={508} y={100} width={246} height={4} fill="#3A4F60" />
      {/* 유리 반사 + 손자국 */}
      <polygon points="300,96 350,96 280,322 262,322 262,210" fill="#FFFFFF" opacity={0.08} />
      <polygon points="600,96 616,96 540,322 524,322" fill="#FFFFFF" opacity={0.06} />
      <g fill={PAL.blood} opacity={0.7}>
        <ellipse cx={492} cy={226} rx={6} ry={7.5} />
        <path d="M486 220 l-2 -11 M490 219 l0 -13 M494 219 l2 -12 M497 222 l4 -9" stroke={PAL.blood} strokeWidth={2.4} strokeLinecap="round" />
      </g>
      {/* 창틀 */}
      <g fill={PAL.ink}>
        <rect x={254} y={88} width={512} height={8} />
        <rect x={254} y={322} width={512} height={10} />
        <rect x={254} y={88} width={8} height={244} />
        <rect x={758} y={88} width={8} height={244} />
        <rect x={505} y={88} width={7} height={244} />
      </g>
      <path d="M262 96 H758" stroke="#AFCBDD" strokeWidth={1} opacity={0.35} />
      <rect x={290} y={58} width={180} height={22} rx={2} fill="#1A0C0C" />
      <text x={380} y={74} textAnchor="middle" fontSize={13} fontWeight={800} fill="#E0564E">음압격리병실 · 출입금지</text>

      {/* 바닥 반사 */}
      <rect x={262} y={346} width={496} height={104} fill="#9EC0D8" opacity={0.08} />
      <rect x={60} y={346} width={110} height={104} fill={PAL.exit} opacity={0.07} />
      <Haze id="zs-hospital-haze" y={300} h={80} color="#3E6A5A" opacity={0.25} />

      {/* 전경 — 빈 이동침대 · 휠체어 */}
      <g fill={PAL.ink}>
        <rect x={150} y={352} width={210} height={14} rx={4} />
        <rect x={154} y={336} width={60} height={18} rx={8} />
        <path d="M170 366 V418 M340 366 V418 M170 400 H340" stroke={PAL.ink} strokeWidth={5} />
        <path d="M150 352 V326 M360 352 V330" stroke={PAL.ink} strokeWidth={4} />
        <circle cx={170} cy={424} r={7} />
        <circle cx={340} cy={424} r={7} />
      </g>
      <path d="M154 336 H214 M218 352 H360" stroke="#5FD49A" strokeWidth={1.2} opacity={0.5} />
      <g stroke={PAL.ink} fill="none" strokeWidth={5} strokeLinecap="round">
        <circle cx={660} cy={400} r={34} />
        <path d="M632 364 L632 314 M632 364 H690 L702 396 M690 364 L700 344 H716" />
        <path d="M626 318 H640" strokeWidth={6} />
      </g>
      <circle cx={660} cy={400} r={34} stroke="#AFCBDD" strokeWidth={1} fill="none" opacity={0.3} />
      <circle cx={712} cy={428} r={6} fill={PAL.ink} />
      <Vignette id="zs-hospital-vig" strength={0.85} />
    </SceneSvg>
  );
}

// ─────────────────────────────── bike_street ───────────────────────────────

/** 따릉이 — 스텝스루 프레임 + 앞 바구니. (x, y) 는 뒷바퀴 접지점 */
function Ddareungi({ x, y, fill, rim }: { x: number; y: number; fill: string; rim: string }) {
  const R = 25;
  return (
    <g transform={`translate(${x} ${y})`}>
      {[0, 74].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy={-R} r={R} stroke={fill} strokeWidth={4.5} fill="none" />
          <path d={`M${cx - R + 5} ${-R} H${cx + R - 5}`} stroke={fill} strokeWidth={0.8} opacity={0.5} />
          <path d={`M${cx - 4} ${-R * 2 - 3} A${R + 3} ${R + 3} 0 0 1 ${cx + R + 3} ${-R}`} stroke={rim} strokeWidth={3} fill="none" />
        </g>
      ))}
      <path d="M0 -25 L22 -58 M0 -25 L34 -24 L62 -62 M34 -24 C40 -40 50 -56 62 -62 M62 -62 L74 -25 M62 -62 L60 -74 M52 -76 H68" stroke={fill} strokeWidth={4.5} fill="none" strokeLinecap="round" />
      <path d="M14 -60 H30" stroke={fill} strokeWidth={6} strokeLinecap="round" />
      <path d="M34 -24 C40 -40 50 -56 62 -62" stroke="#3DBE6E" strokeWidth={1.6} fill="none" opacity={0.8} />
      <path d="M66 -72 H92 L88 -54 H70 Z" fill={fill} />
      <path d="M68 -66 H90 M70 -60 H88" stroke={rim} strokeWidth={0.8} opacity={0.6} />
      <path d="M66 -72 H92" stroke={rim} strokeWidth={1.5} />
    </g>
  );
}

/** 은행나무 가로수 — 좁고 긴 불규칙 원뿔 */
function Ginkgo({ x, y, s, fill }: { x: number; y: number; s: number; fill: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill={fill}>
      <path d="M-2.5 0 L-1.5 -30 L1.5 -30 L2.5 0 Z" />
      <path d="M0 -118 C6 -108 10 -98 9 -90 C16 -84 18 -72 14 -64 C22 -58 24 -44 18 -36 C12 -28 -12 -28 -18 -36 C-24 -44 -20 -58 -14 -62 C-18 -72 -14 -84 -8 -88 C-10 -98 -6 -110 0 -118 Z" />
    </g>
  );
}

function BikeStreet() {
  const lines = rng(55);
  return (
    <SceneSvg>
      <Sky id="zs-bike_street-sky" stops={[[0, '#070D19'], [0.3, '#15253E'], [0.52, '#3E5B7E'], [0.64, '#8FA7C0'], [0.68, '#E3C6A2']]} />
      <circle cx={170} cy={78} r={15} fill="#DCE6F2" opacity={0.75} />
      <circle cx={177} cy={73} r={14} fill="#0E1A2E" />
      <Glow id="zs-bike_street-sun" cx={520} cy={304} r={300} color="#F4D2A6" opacity={0.7} />
      <g fill="#C9A98E" opacity={0.35}>
        <ellipse cx={560} cy={210} rx={200} ry={5} />
        <ellipse cx={690} cy={236} rx={150} ry={4} />
        <ellipse cx={260} cy={188} rx={170} ry={4} />
        <ellipse cx={130} cy={226} rx={120} ry={3} />
      </g>
      <Skyline base={300} minH={16} maxH={70} seed={31} fill="#4D6584" win="#FFE3B0" litRatio={0.015} />
      <ApartmentBlock x={70} y={300} w={130} h={150} floors={15} cols={6} number="201" fill="#34496A" line="rgba(200,220,240,0.08)" numberColor="rgba(200,220,240,0.35)" litRatio={0.04} seed={12} flickerSome={false} />
      <ApartmentBlock x={214} y={300} w={96} h={118} floors={12} cols={5} fill="#3B5373" line="rgba(200,220,240,0.08)" litRatio={0.03} seed={13} flickerSome={false} />
      <ApartmentBlock x={600} y={300} w={130} h={140} floors={14} cols={6} number="305" fill="#3A5071" line="rgba(200,220,240,0.08)" numberColor="rgba(200,220,240,0.35)" litRatio={0.04} seed={14} flickerSome={false} />
      <Haze id="zs-bike_street-haze1" y={236} h={96} color="#B8C8D8" opacity={0.55} />
      {/* 보도 은행나무 가로수 · 가로등 — 거의 검정 레이어 */}
      <rect x={0} y={300} width={800} height={150} fill="#16233A" />
      {[30, 128, 226, 324, 422, 520, 618, 716].map((tx, i) => (
        <Ginkgo key={tx} x={tx + (i % 2) * 10} y={314} s={[1.05, 1.25, 1.12][i % 3]} fill="#0D1628" />
      ))}
      <Lamp x={176} y={314} h={132} lit color="#FFD9A0" fill="#0D1628" />
      <Lamp x={666} y={314} h={132} fill="#0D1628" />
      <g>
        <rect x={505} y={250} width={3} height={62} fill="#1C2C45" />
        <circle cx={506.5} cy={246} r={13} fill="#2C5FA8" stroke="#DCE6F2" strokeWidth={2} />
        <path d="M499 250 a3.5 3.5 0 1 0 0.1 0 M514 250 a3.5 3.5 0 1 0 0.1 0 M499 250 L505 242 L514 250 M505 242 H511" stroke="#FFFFFF" strokeWidth={1.4} fill="none" />
      </g>
      <path d="M0 312 H800" stroke="#7F98B6" strokeWidth={1.5} opacity={0.5} />
      <Haze id="zs-bike_street-haze2" y={292} h={60} color="#5E7A9C" opacity={0.45} />
      {/* 쫓아오는 좀비들 — 멀리, 흐리게 */}
      <Zombie x={60} y={352} s={0.62} pose="lurch" fill="#2B3E58" />
      <Zombie x={104} y={350} s={0.58} pose="reach" fill="#2B3E58" />
      <g className="zs-sway">
        <Zombie x={150} y={356} s={0.72} pose="lurch" fill="#22344C" />
      </g>
      <Zombie x={24} y={348} s={0.5} pose="shamble" fill="#34496A" />
      <Zombie x={200} y={346} s={0.5} pose="reach" fill="#3A5070" />
      <Zombie x={236} y={343} s={0.42} pose="lurch" fill="#43597A" />
      {/* 도로 */}
      <path d="M0 372 H800" stroke="#3A5272" strokeWidth={1} opacity={0.6} />
      <Glow id="zs-bike_street-sheen" cx={520} cy={352} r={180} color="#F0C8A0" opacity={0.22} />
      <ellipse cx={520} cy={384} rx={220} ry={6} fill="#F0CFA8" opacity={0.12} />
      <path d="M-20 404 H130 M200 404 H420 M500 404 H640 M700 404 H820" stroke="#8FA6C2" strokeWidth={3} opacity={0.35} />
      <text x={560} y={430} textAnchor="middle" fontSize={15} fontWeight={800} fill="#6F88A8" opacity={0.45}>자전거전용</text>
      {/* 속도선 */}
      <g className="zs-drift">
        {Array.from({ length: 22 }, (_, i) => {
          const y = 250 + lines() * 150;
          const x = lines() * 700 - 60;
          return <path key={i} d={`M${x.toFixed(0)} ${y.toFixed(0)} h${(60 + lines() * 180).toFixed(0)}`} stroke="#CFE0F0" strokeWidth={1 + lines()} opacity={0.12 + lines() * 0.22} />;
        })}
      </g>
      {/* 따릉이 라이더 — 림: 오른쪽 새벽빛 */}
      {[0, 1].map((k) => (
        <path key={k} d={`M${360 - k * 10} ${330 + k * 18} h-${150 - k * 30}`} stroke="#E6D4BA" strokeWidth={2} opacity={0.35} />
      ))}
      <Ddareungi x={360} y={400} fill={PAL.ink} rim="#E7C9A0" />
      <path d="M394 376 L404 360 M394 376 L386 390" stroke={PAL.ink} strokeWidth={3.5} strokeLinecap="round" />
      <g transform="rotate(11 384 339)">
        <Person x={386} y={351} s={1.28} pose="sit" fill="#EBCB9E" />
        <Person x={384} y={352} s={1.28} pose="sit" fill={PAL.ink} />
      </g>
      <path d="M408 354 L402 364" stroke={PAL.ink} strokeWidth={8} strokeLinecap="round" />
      {/* 전경 — 볼라드 흐릿하게 */}
      <rect x={18} y={380} width={20} height={70} rx={8} fill={PAL.ink} />
      <rect x={772} y={372} width={22} height={78} rx={8} fill={PAL.ink} />
      <rect x={0} y={440} width={800} height={10} fill={PAL.ink} />
      <Vignette id="zs-bike_street-vig" strength={0.72} />
    </SceneSvg>
  );
}

// ─────────────────────────────── raiders ───────────────────────────────

function Raider({ x, y, s, flip, pose, pipe }: { x: number; y: number; s: number; flip?: boolean; pose: 'stand' | 'walk'; pipe?: boolean }) {
  const d = flip ? -2 : 2; // 림은 불(가운데) 쪽으로
  const hand = pose === 'stand' ? [11, -42] : [18, -46];
  const tip = pose === 'stand' ? [30, -84] : [40, -80];
  const sx = (v: number) => x + (flip ? -v : v) * s;
  return (
    <g>
      <Person x={x + d} y={y - 1} s={s} flip={flip} pose={pose} prop={pipe ? 'none' : 'bat'} fill={PAL.fire[3]} />
      <Person x={x} y={y} s={s} flip={flip} pose={pose} prop={pipe ? 'none' : 'bat'} fill={PAL.ink} />
      {pipe && <path d={`M${sx(hand[0])} ${y + hand[1] * s} L${sx(tip[0])} ${y + tip[1] * s}`} stroke="#6E625A" strokeWidth={3.2} strokeLinecap="round" />}
    </g>
  );
}

function Raiders() {
  const sp = rng(9);
  return (
    <SceneSvg>
      <rect width={800} height={450} fill="#030202" />
      <Glow id="zs-raiders-bigglow" cx={400} cy={320} r={360} color={PAL.fire[2]} opacity={0.5} />
      <Smoke x={420} y={250} s={2} color="#0A0504" opacity={0.5} lean={1} animate={false} />
      {/* 폐차 바리케이드 — 바닥층 + 비스듬히 얹은 차 */}
      <g>
        <Car x={-30} y={343.5} s={1.7} fill="#6A2410" />
        <Car x={-30} y={346} s={1.7} fill="#1A0906" />
        <Car x={150} y={343.5} s={1.6} fill="#6A2410" flip />
        <Car x={150} y={346} s={1.6} fill="#1C0A06" flip />
        <Car x={470} y={343.5} s={1.6} fill="#6A2410" />
        <Car x={470} y={346} s={1.6} fill="#1C0A06" />
        <Car x={640} y={343.5} s={1.75} fill="#6A2410" flip />
        <Car x={640} y={346} s={1.75} fill="#1A0906" flip />
        <g transform="rotate(-12 90 290)"><Car x={30} y={297.5} s={1.45} fill="#6A2410" /></g>
        <g transform="rotate(-12 90 290)"><Car x={30} y={300} s={1.45} fill="#140704" /></g>
        <g transform="rotate(10 700 290)"><Car x={640} y={295.5} s={1.5} fill="#6A2410" flip /></g>
        <g transform="rotate(10 700 290)"><Car x={640} y={298} s={1.5} fill="#140704" flip /></g>
        <path d="M296 346 L312 300 H352 L360 346 Z M436 346 L444 296 H484 L494 346 Z" fill="#160805" />
        <path d="M312 300 H352 M444 296 H484" stroke="#A04A1C" strokeWidth={1.5} />
        {[250, 560].map((tx) => (
          <ellipse key={tx} cx={tx} cy={318} rx={20} ry={18} fill="#0A0403" stroke="#4A1D0C" strokeWidth={6} />
        ))}
        <path d="M0 250 L120 236 L260 262 L400 250 L560 262 L700 232 L800 244" stroke="#5A2A14" strokeWidth={1.4} fill="none" strokeDasharray="2 6" />
        <path d="M20 296 L150 280 M650 284 L780 300" stroke="#9A3E18" strokeWidth={1.5} opacity={0.6} />
      </g>
      <text x={40} y={330} fontSize={22} fontWeight={800} fill="#D0521F" opacity={0.8} transform="rotate(-5 40 330)">우리 구역</text>
      <text x={648} y={330} fontSize={14} fontWeight={800} fill="#C24A20" opacity={0.7} transform="rotate(4 648 330)">외부인 출입금지</text>
      <Haze id="zs-raiders-haze" y={290} h={70} color={PAL.fire[1]} opacity={0.45} />
      {/* 바닥 — 불빛 웅덩이 */}
      <rect x={0} y={340} width={800} height={110} fill="#0A0403" />
      <defs>
        <radialGradient id="zs-raiders-pool">
          <stop offset="0" stopColor={PAL.fire[3]} stopOpacity={0.5} />
          <stop offset="0.5" stopColor={PAL.fire[2]} stopOpacity={0.22} />
          <stop offset="1" stopColor={PAL.fire[1]} stopOpacity={0} />
        </radialGradient>
      </defs>
      <ellipse cx={400} cy={402} rx={380} ry={60} fill="url(#zs-raiders-pool)" />
      {/* 긴 그림자 — 불에서 멀어지는 방향 */}
      <g fill="#020101" opacity={0.85}>
        <polygon points="190,410 222,410 60,440 10,436" />
        <polygon points="262,406 290,406 180,430 140,428" />
        <polygon points="580,410 610,410 800,440 760,446" />
        <polygon points="512,404 536,404 650,428 616,430" />
      </g>
      {/* 뒤쪽 한 명 — 불빛 역광 */}
      <Person x={470} y={372} s={1.05} pose="stand" flip fill="#0B0403" pack={false} />
      {/* 드럼통 + 불 */}
      <g>
        <rect x={370} y={336} width={60} height={70} rx={4} fill="#140705" />
        <path d="M370 350 H430 M370 376 H430 M370 394 H430" stroke="#5A220E" strokeWidth={2} />
        <path d="M372 338 V404" stroke={PAL.fire[3]} strokeWidth={2} opacity={0.7} />
        <ellipse cx={400} cy={337} rx={30} ry={5} fill={PAL.fire[4]} opacity={0.8} />
      </g>
      <Fire id="zs-raiders-fire" x={402} y={338} s={1.25} />
      <g className="zs-rise">
        {Array.from({ length: 16 }, (_, i) => (
          <circle key={i} cx={380 + sp() * 60 + (i % 3) * 6} cy={300 - sp() * 150} r={0.8 + sp() * 1.4} fill={PAL.fire[4]} opacity={0.4 + sp() * 0.5} />
        ))}
      </g>
      {/* 무장한 약탈자들 */}
      <Raider x={206} y={410} s={1.55} pose="stand" />
      <Raider x={278} y={404} s={1.35} pose="walk" pipe />
      <Raider x={522} y={404} s={1.4} pose="stand" flip pipe />
      <Raider x={596} y={412} s={1.6} pose="walk" flip />
      {/* 전경 잔해 */}
      <path d="M0 450 L0 418 L60 424 L110 440 L150 450 Z M800 450 L800 414 L740 426 L690 450 Z" fill={PAL.ink} />
      <Vignette id="zs-raiders-vig" strength={0.9} />
    </SceneSvg>
  );
}

export const sceneGroupE: Partial<Record<SceneId, ComponentType>> = {
  mart: Mart,
  hospital: Hospital,
  bike_street: BikeStreet,
  raiders: Raiders,
};
