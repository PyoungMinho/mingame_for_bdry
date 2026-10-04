/**
 * 물비늘타워 외관 야경(사건 소개 컷1 · 타이틀 배경) — 수직 구도, 폭우, 41층 창 한 칸만 앰버로 켜짐.
 * 4:3(800×600). 타워를 가운데(x 330~470)에 세워 세로 화면 slice 에서도 41층 창이 보인다.
 * 번개 없음(광과민). 실존 건물·로고 아님.
 */
import { C, rng, r1, useSvgIds } from '../palette';
import { Glow, RainOnGlass, SceneDefs } from '../scenes/parts';

export function TowerArt({ idScope, rain = true, className, fit = 'slice' }: { idScope?: string; rain?: boolean; className?: string; fit?: 'slice' | 'meet' }) {
  const ids = useSvgIds('tower', idScope);
  const rnd = rng(41);
  // 타워 창 격자: 층 높이 9, 41층 = y 168(가운데쯤)
  let wins = '';
  let lit = '';
  for (let f = 0; f < 60; f++) {
    const y = 60 + f * 9;
    for (let c = 0; c < 8; c++) {
      const x = 338 + c * 16;
      if (rnd() < 0.06) lit += `M${x} ${y}h11v5h-11z`;
      else wins += `M${x} ${y}h11v5h-11z`;
    }
  }
  const W41 = { x: 386, y: 168 };
  // 양옆 빌딩
  let side = '';
  let sideWin = '';
  for (let x = 0; x < 800; ) {
    const w = 40 + rnd() * 60;
    const h = 120 + rnd() * 220;
    if (x + w < 320 || x > 480) {
      side += `M${r1(x)} 480V${r1(480 - h)}h${r1(w)}V480z`;
      for (let k = 0; k < 6; k++) if (rnd() < 0.6) sideWin += `M${r1(x + 6 + rnd() * (w - 14))} ${r1(480 - h + 10 + rnd() * (h - 20))}h4v3h-4z`;
    }
    x += w + 4;
  }
  return (
    <svg className={className ? `wt-art-scene ${className}` : 'wt-art-scene'} viewBox="0 0 800 600" preserveAspectRatio={`xMidYMid ${fit}`} aria-hidden="true" focusable="false" data-art="tower" xmlns="http://www.w3.org/2000/svg">
      <SceneDefs ids={ids}>
        <linearGradient id={ids.id('sky2')} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#05070F" />
          <stop offset="0.7" stopColor="#141E3C" />
          <stop offset="1" stopColor="#1E2A50" />
        </linearGradient>
        <linearGradient id={ids.id('glassT')} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#24345C" />
          <stop offset="0.6" stopColor="#16223F" />
          <stop offset="1" stopColor="#0C1428" />
        </linearGradient>
      </SceneDefs>
      <rect width={800} height={600} fill={ids.url('sky2')} />
      <Glow ids={ids} tone="violet" cx={600} cy={60} rx={320} ry={90} o={0.18} />
      <path d={side} fill="#0E1730" />
      <path d={sideWin} fill={C.amber} opacity={0.6} />
      {/* 타워 */}
      <path d="M330 600V70L400 26L470 70V600Z" fill={ids.url('glassT')} />
      <path d="M400 26L470 70V600H446V82Z" fill="#0A1124" opacity={0.7} />
      <path d={wins} fill="#0A1226" opacity={0.85} />
      <path d={lit} fill="#6E7FA8" opacity={0.5} />
      <path d="M400 26V0" stroke="#3A4870" strokeWidth={3} />
      <circle cx={400} cy={2} r={3} fill={C.red} />
      <path d="M330 70L400 26L470 70" stroke={C.cyan} strokeWidth={2} opacity={0.5} fill="none" />
      <path d="M330 600V70" stroke="#5C7AB8" strokeWidth={2} opacity={0.5} />
      {/* 41층 — 한 칸만 앰버 */}
      <Glow ids={ids} tone="amber" cx={W41.x + 20} cy={W41.y + 3} rx={70} ry={30} o={0.7} />
      <rect x={W41.x} y={W41.y - 1} width={43} height={8} fill="#FFD08A" />
      <rect x={W41.x} y={W41.y - 1} width={43} height={8} fill={C.amber} opacity={0.5} />
      {/* 강 · 강변도로 */}
      <rect y={480} width={800} height={120} fill="#0A1430" />
      <path d="M0 482H800" stroke="#1E2C52" strokeWidth={4} />
      {Array.from({ length: 12 }, (_, i) => (
        <circle key={i} cx={20 + i * 68} cy={488} r={2.4} fill={C.amber} opacity={0.8} />
      ))}
      <path d="M404 500v90M392 510v60M418 506v70" stroke={C.amber} strokeWidth={3} opacity={0.35} strokeDasharray="10 8" />
      <path d="M80 530h40M600 560h60M200 570h30M520 520h24" stroke="#5C7AB8" strokeWidth={2} opacity={0.4} strokeLinecap="round" />
      <RainOnGlass ids={ids} name="all" x={0} y={0} w={800} h={600} n={70} seed={23} o={0.45} slant={-0.1} rain={rain} drops={false} />
      <rect width={800} height={600} fill={ids.url('vig')} />
    </svg>
  );
}
