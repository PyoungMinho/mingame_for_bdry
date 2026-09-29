/**
 * 씬 그룹 D — 거리·편의점·지하철. 시네마틱 실루엣 듀오톤.
 * street_chaos(회주황 해질녘+네온) · convenience_store(남색 밤 속 백색 박스)
 * subway_platform(청록 형광+초록 노선띠) · subway_tunnel(검정 속 손전등 원뿔)
 */
import type { ComponentType } from 'react';
import type { SceneId } from '@/lib/zombie/types';
import { Car, Glow, Haze, Lamp, PAL, Person, SceneSvg, Skyline, Sky, Smoke, Vignette, Zombie } from './primitives';
import type { ZombiePose } from './primitives';

// ─────────────── 로컬 헬퍼 ───────────────

type Frame = { l: number; r: number; t: number; b: number };
const lerp = (a: number, b: number, f: number) => a + (b - a) * f;

/** 1점 투시 상자: 가까운 틀 N 과 먼 틀 F 사이를 f(0=앞,1=끝)로 보간. 단면은 닮은꼴이라 정확하다. */
function box(N: Frame, F: Frame, k: number) {
  const f = (d: number) => 1 - 1 / (1 + d * k);
  const x = (u: number, ff: number) => lerp(N.l, F.l, ff) + u * (lerp(N.r, F.r, ff) - lerp(N.l, F.l, ff));
  const y = (v: number, ff: number) => lerp(N.t, F.t, ff) + v * (lerp(N.b, F.b, ff) - lerp(N.t, F.t, ff));
  const sc = (ff: number) => (lerp(N.r, F.r, ff) - lerp(N.l, F.l, ff)) / (N.r - N.l);
  const quad = (u0: number, v0: number, u1: number, v1: number, f0: number, f1: number) =>
    [x(u0, f0), y(v0, f0), x(u1, f1), y(v1, f1)];
  return { f, x, y, sc, quad };
}

/** 세로 간판 — 글자를 한 자씩 세로로 쌓는다 */
function VSign({ x, y, w, text, color, fs, filter }: { x: number; y: number; w: number; text: string; color: string; fs: number; filter: string }) {
  const chars = Array.from(text);
  const h = chars.length * fs * 1.12 + fs * 0.7;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={3} fill="#0B0706" stroke={color} strokeWidth={2} strokeOpacity={0.85} />
      <g filter={filter} fill={color}>
        {chars.map((c, i) => (
          <text key={i} x={x + w / 2} y={y + fs * 0.35 + (i + 1) * fs * 1.12 - fs * 0.18} fontSize={fs} fontWeight={800} textAnchor="middle">
            {c}
          </text>
        ))}
      </g>
    </g>
  );
}

// ─────────────── street_chaos ───────────────

function StreetChaos() {
  const neon = 'url(#zs-street_chaos-neon)';
  const horde: [number, number, number, ZombiePose, boolean][] = [
    [392, 282, 0.4, 'shamble', false], [420, 288, 0.5, 'reach', false], [452, 280, 0.36, 'lurch', true],
    [474, 294, 0.6, 'shamble', true], [500, 283, 0.42, 'reach', true], [526, 290, 0.52, 'shamble', false],
    [548, 281, 0.38, 'lurch', true], [440, 300, 0.68, 'reach', false], [570, 287, 0.46, 'shamble', true],
    [512, 302, 0.72, 'lurch', false],
  ];
  return (
    <SceneSvg>
      <defs>
        <filter id="zs-street_chaos-neon" x="-50%" y="-20%" width="200%" height="140%">
          <feGaussianBlur stdDeviation="3.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="zs-street_chaos-facL" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#080605" />
          <stop offset="0.7" stopColor="#23160F" />
          <stop offset="1" stopColor="#6A4430" />
        </linearGradient>
        <linearGradient id="zs-street_chaos-facR" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0" stopColor="#080605" />
          <stop offset="0.7" stopColor="#23160F" />
          <stop offset="1" stopColor="#6A4430" />
        </linearGradient>
        <linearGradient id="zs-street_chaos-road" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7A4A30" />
          <stop offset="0.35" stopColor="#2E1D15" />
          <stop offset="1" stopColor="#0C0807" />
        </linearGradient>
      </defs>
      <Sky id="zs-street_chaos-sky" stops={[[0, '#141110'], [0.3, '#3A2B24'], [0.5, '#7C4E34'], [0.58, '#C0703E'], [0.64, '#D98A4E']]} />
      <Glow id="zs-street_chaos-sun" cx={470} cy={236} r={240} color="#FFA062" opacity={0.62} />
      <circle cx={470} cy={236} r={24} fill="#FFD7A6" opacity={0.55} />
      <Skyline base={258} minH={18} maxH={84} seed={23} fill="#7E5039" />
      <Smoke x={300} y={254} s={1.8} color="#2B1D17" opacity={0.78} />
      <Smoke x={640} y={256} s={1.35} color="#2B1D17" opacity={0.7} lean={-1} />
      <Haze id="zs-street_chaos-haze1" y={196} h={96} color="#CF8A55" opacity={0.55} className="zs-drift" />

      {/* 도로 — 해를 받은 젖은 아스팔트 반사 */}
      <polygon points="330,258 610,258 800,330 800,450 0,450 0,330" fill="url(#zs-street_chaos-road)" />
      <polygon points="455,262 485,262 540,450 400,450" fill="#FFB072" opacity={0.1} />
      <polygon points="468,260 470,260 446,450 438,450" fill="#E0A845" opacity={0.38} />
      <polygon points="473,260 475,260 462,450 454,450" fill="#E0A845" opacity={0.38} />
      <path d="M410 262 L150 450 M536 262 L800 440" stroke="#F3D2B0" strokeWidth={2.5} strokeDasharray="16 20" opacity={0.28} />

      {/* 무리 지어 걷는 좀비들 — 해를 등진 실루엣 */}
      {horde.map(([x, y, s, pose, flip], i) => (
        <Zombie key={i} x={x} y={y} s={s} pose={pose} flip={flip} fill="#170E0B" className={i % 3 === 0 ? 'zs-sway' : undefined} />
      ))}
      <Haze id="zs-street_chaos-haze2" y={262} h={46} color="#B46A40" opacity={0.3} />

      {/* 양옆 상가 파사드(투시) */}
      <polygon points="0,0 340,200 340,262 0,356" fill="url(#zs-street_chaos-facL)" />
      <polygon points="800,0 600,200 600,262 800,356" fill="url(#zs-street_chaos-facR)" />
      <path d="M0 90 L340 214 M0 180 L340 229 M0 268 L340 244 M800 90 L600 214 M800 180 L600 229 M800 268 L600 244" stroke="#FFB787" strokeWidth={1} opacity={0.1} />
      <polygon points="250,236 330,250 330,262 250,280" fill="#E8964E" opacity={0.35} />
      <polygon points="615,250 690,236 690,280 615,262" fill="#E8964E" opacity={0.25} />

      {/* 세로 간판 네온 */}
      <VSign x={36} y={40} w={46} text="노래방" color="#FF4F9A" fs={32} filter={neon} />
      <g className="zs-flicker">
        <VSign x={176} y={118} w={30} text="치킨" color="#FFC247" fs={21} filter={neon} />
      </g>
      <VSign x={278} y={172} w={18} text="약" color="#3FE08A" fs={13} filter={neon} />
      <VSign x={718} y={46} w={46} text="사우나" color="#4FE0FF" fs={32} filter={neon} />
      <VSign x={620} y={124} w={30} text="호프" color="#FF5A4A" fs={21} filter={neon} />

      {/* 버려진 차: 오른쪽 승용차, 왼쪽 택시(지붕 표시등) */}
      <Smoke x={650} y={280} s={0.55} color="#1A110D" opacity={0.8} />
      <Car x={728} y={308} s={1.45} flip fill="#120B09" />
      <Car x={130} y={326} s={2.1} fill="#0D0807" />
      <rect x={130 + 46 * 2.1} y={326 - 40 * 2.1} width={14 * 2.1} height={6 * 2.1} rx={3} fill={PAL.alert} opacity={0.9} />
      <text x={130 + 53 * 2.1} y={326 - 35.4 * 2.1} fontSize={9} fontWeight={800} textAnchor="middle" fill="#3A2400">택시</text>
      <Person x={104} y={328} s={0.86} pose="crouch" fill="#0A0605" />

      {/* 쓰러진 가로등 — 도로를 가로질러 */}
      <g transform="translate(700 436) rotate(-77) scale(1.7)">
        <Lamp x={0} y={0} h={210} fill={PAL.ink} />
      </g>
      <path d="M0 440 L800 440 L800 450 L0 450 Z" fill={PAL.ink} />
      <Vignette id="zs-street_chaos-vig" strength={0.8} />
    </SceneSvg>
  );
}

// ─────────────── convenience_store ───────────────

function Handprint({ x, y, r = 0 }: { x: number; y: number; r?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r})`} fill={PAL.blood} opacity={0.85}>
      <ellipse cx={0} cy={0} rx={6} ry={7} />
      <path d="M-5 -5 L-8 -15 M-2 -6 L-3 -18 M2 -6 L3 -18 M5 -5 L7 -15 M6 1 L12 -4" stroke={PAL.blood} strokeWidth={2.6} strokeLinecap="round" />
      <path d="M-2 7 L-3 14 M3 7 L3 12" stroke={PAL.blood} strokeWidth={1.2} strokeLinecap="round" />
    </g>
  );
}

function ConvenienceStore() {
  const shelfX = [318, 392, 466];
  const dots = ['#7FA7D6', '#E8B25A', '#D6716A', '#8BC7A0'];
  const rimZ: [number, number, number, ZombiePose][] = [[92, 392, 0.95, 'reach'], [168, 378, 0.82, 'shamble'], [40, 372, 0.72, 'lurch']];
  return (
    <SceneSvg>
      <Sky id="zs-convenience_store-sky" stops={[[0, '#02040A'], [0.5, '#081226'], [0.72, '#0B1A33'], [1, '#040913']]} />
      <Skyline base={250} minH={40} maxH={150} seed={42} fill="#0B152B" win="#3D5A86" litRatio={0.03} />
      <Haze id="zs-convenience_store-haze" y={200} h={80} color="#1C3560" opacity={0.45} className="zs-drift" />

      {/* 상가 건물 몸체 */}
      <rect x={250} y={24} width={520} height={320} fill="#070C18" />
      <path d="M250 64 H770 M250 104 H770" stroke="rgba(160,190,255,0.06)" />
      <text x={740} y={90} fontSize={20} fontWeight={800} textAnchor="end" fill="rgba(160,190,255,0.16)">2F 수학학원</text>

      {/* 빛 번짐 */}
      <g className="zs-glow">
        <Glow id="zs-convenience_store-halo" cx={500} cy={250} r={470} color="#8FB8F0" opacity={0.6} />
      </g>

      {/* 유리 박스 내부 */}
      <defs>
        <linearGradient id="zs-convenience_store-in" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F4FAFF" />
          <stop offset="0.6" stopColor="#D7E8F8" />
          <stop offset="1" stopColor="#B5CCE2" />
        </linearGradient>
      </defs>
      <rect x={296} y={150} width={408} height={188} fill="url(#zs-convenience_store-in)" />
      <g className="zs-flicker">
        <rect x={310} y={158} width={110} height={4} rx={2} fill="#FFFFFF" />
      </g>
      <rect x={440} y={158} width={110} height={4} rx={2} fill="#FFFFFF" />
      <rect x={570} y={158} width={110} height={4} rx={2} fill="#FFFFFF" />
      {shelfX.map((sx, i) => (
        <g key={sx}>
          <rect x={sx} y={206} width={56} height={132} fill="#6F88A6" />
          {[222, 250, 278, 306].map((yy, j) => (
            <g key={yy}>
              <rect x={sx} y={yy + 14} width={56} height={3} fill="#4B6180" />
              {[0, 1, 2, 3, 4].map((k) => (
                <rect key={k} x={sx + 4 + k * 10.5} y={yy + 3} width={7} height={11} rx={1} fill={dots[(i + j + k) % 4]} opacity={0.75} />
              ))}
            </g>
          ))}
        </g>
      ))}
      {/* 계산대 + 알바 */}
      <Person x={634} y={322} s={1.02} pose="stand" pack={false} fill="#1A2638" />
      <rect x={578} y={262} width={112} height={76} fill="#3A4E68" />
      <rect x={578} y={258} width={112} height={6} fill="#8FA6C2" />
      <rect x={596} y={244} width={20} height={14} fill="#26344A" />
      <rect x={600} y={247} width={12} height={8} fill={PAL.screen} opacity={0.8} />

      {/* 샷시·문·손자국 */}
      <g fill="#060A14">
        {[292, 372, 452, 532, 700].map((mx) => (
          <rect key={mx} x={mx} y={150} width={8} height={188} />
        ))}
        <rect x={292} y={146} width={416} height={8} />
        <rect x={292} y={334} width={416} height={8} />
      </g>
      <rect x={442} y={236} width={3} height={36} rx={1.5} fill="#8DA4BE" />
      <rect x={462} y={236} width={3} height={36} rx={1.5} fill="#8DA4BE" />
      <Handprint x={410} y={250} r={-12} />
      <Handprint x={426} y={282} r={8} />
      <Handprint x={500} y={268} r={-4} />
      <path d="M404 262 L402 290 M428 293 L427 312" stroke={PAL.blood} strokeWidth={1.4} opacity={0.6} />

      {/* 간판 띠 */}
      <rect x={288} y={112} width={424} height={34} fill="#0E1A30" />
      <rect x={288} y={140} width={424} height={4} fill="#3FA8FF" opacity={0.8} />
      <text x={330} y={138} fontSize={26} fontWeight={800} fill="#EAF4FF">편의점</text>
      <text x={690} y={137} fontSize={22} fontWeight={800} textAnchor="end" fill="#6FC3FF">24시</text>

      {/* 인도 파라솔 테이블 */}
      <g fill="#050912">
        <path d="M188 266 L276 266 L262 254 L202 254 Z" />
        <rect x={230} y={266} width={3} height={70} />
        <rect x={206} y={312} width={52} height={5} />
        <path d="M212 317 L208 342 M252 317 L256 342" stroke="#050912" strokeWidth={3} />
      </g>

      {/* 도로 + 젖은 바닥 반사 */}
      <rect x={0} y={342} width={800} height={108} fill="#050A15" opacity={0.7} />
      <rect x={0} y={342} width={800} height={3} fill="#7FA6D6" opacity={0.35} />
      <polygon points="296,344 704,344 900,450 100,450" fill="#D8ECFF" opacity={0.13} />
      <defs>
        <linearGradient id="zs-convenience_store-refl" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#DDEEFF" stopOpacity={0.34} />
          <stop offset="1" stopColor="#DDEEFF" stopOpacity={0} />
        </linearGradient>
      </defs>
      <g className="zs-shimmer" fill="url(#zs-convenience_store-refl)">
        <rect x={300} y={346} width={72} height={96} />
        <rect x={380} y={346} width={72} height={80} />
        <rect x={460} y={346} width={72} height={90} />
        <rect x={540} y={346} width={160} height={70} />
      </g>

      {/* 어둠에서 다가오는 좀비 — 가게 쪽 림라이트 */}
      {rimZ.map(([x, y, s, pose], i) => (
        <g key={i} className={i === 0 ? 'zs-sway' : undefined}>
          <Zombie x={x + 1.6} y={y - 0.6} s={s} pose={pose} fill="#6E96C8" />
          <Zombie x={x} y={y} s={s} pose={pose} fill={PAL.ink} />
        </g>
      ))}
      <Vignette id="zs-convenience_store-vig" strength={0.88} />
    </SceneSvg>
  );
}

// ─────────────── subway_platform ───────────────

function SubwayPlatform() {
  const B = box({ l: -120, r: 920, t: -40, b: 470 }, { l: 250, r: 330, t: 170, b: 210 }, 0.32);
  const pts = (a: number[]) => a.map((n) => n.toFixed(1)).join(' ');
  /** 벽면(u 고정) 조각 */
  const wall = (u: number, v0: number, v1: number, f0: number, f1: number) =>
    pts([B.x(u, f0), B.y(v0, f0), B.x(u, f1), B.y(v0, f1), B.x(u, f1), B.y(v1, f1), B.x(u, f0), B.y(v1, f0)]);
  /** 수평면(v 고정) 조각 */
  const flat = (v: number, u0: number, u1: number, f0: number, f1: number) =>
    pts([B.x(u0, f0), B.y(v, f0), B.x(u1, f0), B.y(v, f0), B.x(u1, f1), B.y(v, f1), B.x(u0, f1), B.y(v, f1)]);
  const depths = Array.from({ length: 13 }, (_, i) => B.f(i * 1.2));
  const lamps = [0.3, 1.8, 3.3, 4.8, 6.3];
  const zf = B.f(6.8);
  const zs = (0.55 * (B.y(1, zf) - B.y(0, zf))) / 100;
  return (
    <SceneSvg>
      <rect width={800} height={450} fill="#061213" />
      <defs>
        <linearGradient id="zs-subway_platform-floor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0E2A2A" />
          <stop offset="0.25" stopColor="#3F7C77" />
          <stop offset="1" stopColor="#10292A" />
        </linearGradient>
      </defs>
      <polygon points={flat(0, 0, 1, 0, 1)} fill="#0C2224" />
      <polygon points={flat(1, 0, 1, 0, 1)} fill="url(#zs-subway_platform-floor)" />
      {/* 형광등 바닥 반사 */}
      {lamps.map((d) => (
        <polygon key={d} points={flat(1, 0.27, 0.37, B.f(d + 0.1), B.f(d + 0.6))} fill="#CFFFF6" opacity={0.07} />
      ))}
      <polygon points={flat(1, 0.05, 0.09, 0, 1)} fill="#D8B23C" opacity={0.75} />
      {/* 오른쪽 타일 벽 + 초록 노선띠 */}
      <polygon points={wall(1, 0, 0.46, 0, 1)} fill="#1E4644" />
      <polygon points={wall(1, 0.46, 0.52, 0, 1)} fill="#2DB34A" />
      <polygon points={wall(1, 0.52, 1, 0, 1)} fill="#15302F" />
      {/* 먼 끝 — 꺼진 구간의 어둠 + 마지막 불빛 */}
      <polygon points={flat(0, 0, 1, B.f(7.5), 1)} fill="#040C0D" />
      <polygon points={wall(1, 0, 1, B.f(7.5), 1)} fill="#081515" />
      <rect x={250} y={170} width={80} height={40} fill="#010303" />
      <Glow id="zs-subway_platform-end" cx={292} cy={194} r={80} color="#7FE3D6" opacity={0.5} />
      {/* 왼쪽 스크린도어 — 너머는 선로의 어둠 */}
      <polygon points={wall(0, 0.2, 1, 0, 1)} fill="#020606" />
      {depths.slice(0, -1).map((f0, i) => {
        const f1 = depths[i + 1], fm = (f0 + f1) / 2;
        return (
          <g key={i}>
            <polygon points={wall(0, 0.32, 0.97, f0 + 0.003, f1 - 0.003)} fill="#6FC4BA" opacity={0.09} />
            <polygon points={wall(0, 0.33, 0.6, f0 + 0.01, fm - 0.01)} fill="#BFF4EC" opacity={0.06} />
            <path d={`M${B.x(0, f0)} ${B.y(0.3, f0)} V${B.y(1, f0)}`} stroke="#9FE0D6" strokeWidth={Math.max(1, 8 * B.sc(f0))} opacity={0.6} />
            <path d={`M${B.x(0, fm)} ${B.y(0.32, fm)} V${B.y(0.97, fm)}`} stroke="#9FE0D6" strokeWidth={Math.max(0.6, 2 * B.sc(fm))} opacity={0.35} />
          </g>
        );
      })}
      <polygon points={wall(0, 0.2, 0.3, 0, 1)} fill="#0E2426" />
      <polygon points={wall(0, 0.255, 0.29, 0, 1)} fill="#2DB34A" />
      {/* 형광등 줄 (먼 쪽은 꺼짐) */}
      <g fill="#E4FFFA">
        {lamps.map((d) => (
          <polygon key={d} points={flat(0.03, 0.3, 0.34, B.f(d), B.f(d + 0.7))} />
        ))}
      </g>
      <g className="zs-flicker" fill="#E4FFFA">
        {lamps.slice(0, 4).map((d) => (
          <polygon key={d} points={flat(0.03, 0.66, 0.7, B.f(d), B.f(d + 0.7))} />
        ))}
      </g>
      <Haze id="zs-subway_platform-haze" y={140} h={110} color="#4FA89E" opacity={0.3} />
      {/* 기둥 */}
      {[1.2, 3.6, 6.2].map((d) => {
        const f0 = B.f(d), w = 60 * B.sc(f0), x0 = B.x(0.6, f0), yt = B.y(0, f0), hh = B.y(1, f0) - yt;
        return (
          <g key={d}>
            <rect x={x0} y={yt} width={w} height={hh} fill="#081415" />
            <rect x={x0} y={yt} width={Math.max(1, w * 0.08)} height={hh} fill="#8FE0D4" opacity={0.5} />
            <rect x={x0} y={B.y(0.5, f0)} width={w} height={w * 0.2} fill="#2DB34A" opacity={0.85} />
          </g>
        );
      })}
      {/* 어둠에서 걸어 나오는 좀비 */}
      <Zombie x={B.x(0.34, zf)} y={B.y(1, zf)} s={zs} pose="shamble" fill="#010404" className="zs-sway" />
      <Zombie x={B.x(0.2, B.f(9))} y={B.y(1, B.f(9))} s={zs * 0.72} pose="lurch" fill="#020606" />
      {/* 버려진 짐 */}
      <g fill="#061011">
        <rect x={352} y={352} width={52} height={70} rx={6} />
        <path d="M366 352 V340 H390 V352" stroke="#061011" strokeWidth={4} fill="none" />
        <circle cx={360} cy={424} r={4} />
        <circle cx={396} cy={424} r={4} />
        <path d="M414 426 L420 398 C430 392 470 392 480 398 L486 426 Z" />
        <path d="M432 396 C434 380 466 380 468 396" stroke="#061011" strokeWidth={4} fill="none" />
        <path d="M530 430 L556 420 L566 428 L540 438 Z" />
      </g>
      <rect x={353} y={352} width={3} height={70} fill="#8FE0D4" opacity={0.45} />
      <path d="M420 398 C430 392 470 392 480 398" stroke="#8FE0D4" strokeWidth={1.5} fill="none" opacity={0.45} />
      <path d="M236 412 L262 404 L270 416 L244 422 Z" fill="#9BC7C0" opacity={0.5} />
      {/* 천장 전광판 */}
      <path d="M470 18 V38 M618 18 V38" stroke="#050C0D" strokeWidth={4} />
      <rect x={440} y={38} width={208} height={54} rx={4} fill="#030808" stroke="#2DB34A" strokeWidth={3} />
      <circle cx={466} cy={65} r={15} fill="#2DB34A" />
      <text x={466} y={72} fontSize={20} fontWeight={800} textAnchor="middle" fill="#fff">2</text>
      <text x={490} y={60} fontSize={14} fontWeight={700} fill="#CFE" opacity={0.85}>성수 방면</text>
      <g className="zs-blink">
        <text x={490} y={82} fontSize={15} fontWeight={800} fill={PAL.alert}>열차 운행 중단</text>
      </g>
      <rect x={346} y={184} width={26} height={11} fill={PAL.exit} />
      <text x={359} y={192.5} fontSize={7.5} fontWeight={800} textAnchor="middle" fill="#032">비상구</text>
      <Vignette id="zs-subway_platform-vig" strength={0.82} />
    </SceneSvg>
  );
}

// ─────────────── subway_tunnel ───────────────

function SubwayTunnel() {
  const B = box({ l: -120, r: 1060, t: -80, b: 470 }, { l: 458, r: 482, t: 188, b: 210 }, 0.35);
  const arch = (f: number) => {
    const xl = B.x(0.06, f), xr = B.x(0.94, f), yb = B.y(1, f), ys = B.y(0.42, f), yt = B.y(0.04, f);
    return `M${xl} ${yb} L${xl} ${ys} A${(xr - xl) / 2} ${ys - yt} 0 0 1 ${xr} ${ys} L${xr} ${yb}`;
  };
  const ds = Array.from({ length: 11 }, (_, i) => B.f(i * 1.3));
  const rails = [0.42, 0.58];
  const cable = (v: number, sag: number) =>
    ds.slice(0, -1).map((f0, i) => {
      const f1 = ds[i + 1];
      return `M${B.x(0.93, f0)} ${B.y(v, f0)} Q${B.x(0.93, (f0 + f1) / 2)} ${B.y(v, (f0 + f1) / 2) + sag * B.sc(f0)} ${B.x(0.93, f1)} ${B.y(v, f1)}`;
    }).join(' ');
  const scene = (lit: boolean) => (
    <g>
      <polygon points={`${B.x(0.3, 0)},470 ${B.x(0.7, 0)},470 ${B.x(0.7, 1)},${B.y(1, 1)} ${B.x(0.3, 1)},${B.y(1, 1)}`} fill={lit ? '#2A2C2A' : '#070808'} />
      {ds.map((f, i) => (
        <path key={i} d={arch(f)} fill="none" stroke={lit ? '#5A605D' : '#090A0A'} strokeWidth={Math.max(1, 14 * B.sc(f))} />
      ))}
      {Array.from({ length: 22 }, (_, i) => {
        const f = B.f(i * 0.6);
        return <rect key={i} x={B.x(0.36, f)} y={B.y(1, f) - 4 * B.sc(f)} width={B.x(0.64, f) - B.x(0.36, f)} height={Math.max(1, 12 * B.sc(f))} fill={lit ? '#4D4A44' : '#0A0A0A'} />;
      })}
      {rails.map((u) => (
        <polygon key={u} points={`${B.x(u - 0.008, 0)},${B.y(1, 0) - 10} ${B.x(u + 0.008, 0)},${B.y(1, 0) - 10} ${B.x(u, 1)},${B.y(1, 1)}`} fill={lit ? '#DCE2DE' : '#161919'} />
      ))}
      <path d={cable(0.5, 26)} fill="none" stroke={lit ? '#3E4442' : '#0C0E0E'} strokeWidth={4} />
      <path d={cable(0.58, 38)} fill="none" stroke={lit ? '#4A4F4C' : '#0C0E0E'} strokeWidth={6} />
      <path d={cable(0.66, 20)} fill="none" stroke={lit ? '#353A38' : '#0C0E0E'} strokeWidth={3} />
    </g>
  );
  const apex = [238, 361];
  const cone = `${apex[0]},${apex[1] - 6} 700,110 820,300 760,470 ${apex[0] + 6},${apex[1] + 4}`;
  const zf = B.f(7);
  const zsz = (0.36 * (B.y(1, zf) - B.y(0, zf))) / 100;
  return (
    <SceneSvg>
      <rect width={800} height={450} fill="#010202" />
      {scene(false)}
      {/* 먼 어둠 속 비상등 — 실루엣의 배경 */}
      <g className="zs-blink">
        <Glow id="zs-subway_tunnel-red" cx={470} cy={212} r={95} color="#FF3B2E" opacity={0.55} />
      </g>
      <circle cx={470} cy={190} r={2} fill="#FF6A5A" />
      <defs>
        <clipPath id="zs-subway_tunnel-clip">
          <polygon points={cone} />
        </clipPath>
        <radialGradient id="zs-subway_tunnel-beam" cx={apex[0]} cy={apex[1]} r={560} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#F4F8F6" stopOpacity={0.45} />
          <stop offset="0.45" stopColor="#DDE6E2" stopOpacity={0.14} />
          <stop offset="1" stopColor="#DDE6E2" stopOpacity={0} />
        </radialGradient>
        <radialGradient id="zs-subway_tunnel-fall" cx={apex[0]} cy={apex[1]} r={600} gradientUnits="userSpaceOnUse">
          <stop offset="0.2" stopColor="#000" stopOpacity={0} />
          <stop offset="1" stopColor="#000" stopOpacity={0.92} />
        </radialGradient>
      </defs>
      <g clipPath="url(#zs-subway_tunnel-clip)">
        {scene(true)}
        <rect width={800} height={450} fill="url(#zs-subway_tunnel-fall)" />
      </g>
      {/* 저 멀리 실루엣 */}
      {/* 벽의 대피로 표지 — 빛 속에서만 읽힌다 */}
      <g clipPath="url(#zs-subway_tunnel-clip)">
        <rect x={B.x(0.9, B.f(3.4)) - 46} y={B.y(0.36, B.f(3.4))} width={44} height={20} fill="#E8EEEA" opacity={0.85} />
        <text x={B.x(0.9, B.f(3.4)) - 24} y={B.y(0.36, B.f(3.4)) + 14.5} fontSize={11} fontWeight={800} textAnchor="middle" fill="#1A6B3A">대피로→</text>
      </g>
      <Zombie x={448} y={B.y(1, zf)} s={zsz} pose="shamble" fill="#010101" className="zs-sway" />
      <Zombie x={494} y={B.y(1, zf) + 1} s={zsz * 1.05} pose="reach" flip fill="#010101" />
      <Zombie x={500} y={B.y(1, B.f(12))} s={zsz * 0.7} pose="lurch" flip fill="#010101" />
      {/* 빛 원뿔 */}
      <g className="zs-glow">
        <polygon points={cone} fill="url(#zs-subway_tunnel-beam)" />
        <g fill="#FFFFFF" opacity={0.5}>
          {[[320, 300], [372, 262], [410, 330], [455, 240], [520, 300], [560, 210], [610, 350], [350, 340]].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={1.1} />
          ))}
        </g>
      </g>
      <Glow id="zs-subway_tunnel-hand" cx={apex[0]} cy={apex[1]} r={70} color="#F2F7F4" opacity={0.5} />
      {/* 손전등 든 생존자 — 빛 쪽 림라이트 */}
      <Person x={201.5} y={401} s={1.28} pose="crouch" prop="light" fill="#AEB8B3" />
      <Person x={200} y={402} s={1.28} pose="crouch" prop="light" fill={PAL.ink} />
      <circle cx={apex[0]} cy={apex[1]} r={3} fill="#FFFFFF" />
      <Vignette id="zs-subway_tunnel-vig" strength={0.9} />
    </SceneSvg>
  );
}

export const sceneGroupD: Partial<Record<SceneId, ComponentType>> = {
  street_chaos: StreetChaos,
  convenience_store: ConvenienceStore,
  subway_platform: SubwayPlatform,
  subway_tunnel: SubwayTunnel,
};
