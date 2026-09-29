/**
 * 씬 그룹 G — 탈출 거점들. han_bridge · helicopter · harbor · mountain.
 * 스타일: 시네마틱 실루엣 듀오톤(레퍼런스 balcony_view 기준). 씬마다 광원·색 무드를 달리한다.
 *   han_bridge  새벽 분홍·청색 + 강물 반사
 *   helicopter  서치라이트 백색 + 흩날리는 먼지, 경기장 조명
 *   harbor      새벽 회청색 바다 안개
 *   mountain    안개 낀 새벽 회녹색, 캠프 불빛 점점이
 */
import type { ComponentType } from 'react';
import type { SceneId } from '@/lib/zombie/types';
import { Car, Dog, Fire, Glow, Haze, Lamp, PAL, Person, SceneSvg, Skyline, Sky, Vignette, Zombie, rng } from './primitives';

// ─────────────────────────────── han_bridge ───────────────────────────────

const BR = { deck: 292, top: 188, hw: 134, spans: [150, 420, 690] };

function archD(c: number, off = 0) {
  const b = BR.deck - 4 + off;
  const t = BR.top + off;
  return `M${c - BR.hw} ${b} Q${c} ${2 * t - b} ${c + BR.hw} ${b}`;
}

function hangersD(c: number) {
  let d = '';
  for (let x = c - BR.hw + 16; x < c + BR.hw - 10; x += 15) {
    const k = (x - c) / BR.hw;
    const y = BR.deck - 4 - (BR.deck - 4 - BR.top) * (1 - k * k);
    d += `M${x.toFixed(1)} ${y.toFixed(1)} V${BR.deck - 4} `;
  }
  return d;
}

function BridgeBody({ ink }: { ink: string }) {
  return (
    <g>
      {BR.spans.map((c) => (
        <g key={c}>
          <path d={archD(c)} stroke={ink} strokeWidth={7} fill="none" />
          <path d={archD(c, 12)} stroke={ink} strokeWidth={2.5} fill="none" />
          <path d={hangersD(c)} stroke={ink} strokeWidth={1.6} />
        </g>
      ))}
      <rect x={-10} y={BR.deck - 6} width={820} height={14} fill={ink} />
    </g>
  );
}

function HanBridge() {
  const r = rng(41);
  const ink = '#0A0C18';
  const sunX = 604;
  const glints = Array.from({ length: 26 }, (_, i) => {
    const y = 252 + i * 7.4;
    const w = 6 + i * 2.2 + r() * 18;
    return <rect key={i} x={sunX - w / 2 + (r() - 0.5) * 10} y={y} width={w} height={1.8} fill="#FFD6B8" opacity={0.85 - i * 0.028} />;
  });
  let ripples = '';
  for (let i = 0; i < 22; i++) {
    const y = 344 + i * 4.8 + r() * 3;
    const x = r() * 760;
    ripples += `M${x.toFixed(0)} ${y.toFixed(1)} h${(40 + r() * 120).toFixed(0)} `;
  }
  let reeds = '';
  for (let i = 0; i < 30; i++) {
    const x = 6 + i * 9 + r() * 5;
    const base = 388 + (x / 290) * 50;
    const h = 26 + r() * 40;
    reeds += `M${x.toFixed(0)} ${base.toFixed(0)} q${(2 + r() * 6).toFixed(0)} ${(-h / 2).toFixed(0)} ${(5 + r() * 9).toFixed(0)} ${(-h).toFixed(0)} `;
  }
  return (
    <SceneSvg>
      <Sky id="zs-han_bridge-sky" h={262} stops={[[0, '#0D1328'], [0.3, '#26305A'], [0.58, '#5E5A86'], [0.8, '#C7879A'], [0.94, '#F4B6A4'], [1, '#FAD0B4']]} />
      <Glow id="zs-han_bridge-sun" cx={sunX} cy={226} r={230} color="#FFC0A4" opacity={0.75} />
      <circle cx={sunX} cy={228} r={20} fill="#FFE6CC" opacity={0.9} />
      <Skyline base={256} minH={12} maxH={62} seed={21} fill="#6B5E86" win="#FFD9B8" litRatio={0.03} />
      <path d="M160 256 L166 170 L178 162 L190 170 L196 256 Z" fill="#6B5E86" />
      <text x={178} y={186} textAnchor="middle" fontSize={9} fontWeight={800} fill="rgba(255,220,200,0.35)">63</text>
      <Haze id="zs-han_bridge-haze" y={206} h={70} color="#F0A8A0" opacity={0.45} />

      {/* 강물 — 하늘을 거꾸로 비춘다 */}
      <Sky id="zs-han_bridge-water" y={256} h={194} stops={[[0, '#E4A4A4'], [0.1, '#9E7896'], [0.35, '#474A76'], [1, '#0A0E22']]} />
      <g className="zs-shimmer">{glints}</g>
      <g transform="translate(0 676) scale(1 -1)" opacity={0.32}>
        <BridgeBody ink={ink} />
      </g>
      <path d={ripples} stroke="#9A7C9C" strokeWidth={1.2} opacity={0.35} />

      {/* 한강대교 — 아치 3경간, 교각 */}
      {[16, 286, 556, 824].map((x) => (
        <rect key={x} x={x - 9} y={BR.deck} width={18} height={46} fill={ink} />
      ))}
      <path d="M-10 338 H810" stroke="#C88E9C" strokeWidth={1} opacity={0.35} />
      <BridgeBody ink={ink} />
      {[420, 690].map((c) => (
        <path key={c} d={archD(c, -3)} stroke="#FFC4AE" strokeWidth={1.3} fill="none" opacity={0.55} />
      ))}
      <path d="M-10 285 H810" stroke="#FFC4AE" strokeWidth={1} opacity={0.3} />

      {/* 다리 위 — 버려진 차 행렬, 걷는 생존자와 콩이, 역광 속 좀비 */}
      {[40, 98, 196, 250, 452, 574, 640, 730].map((x, i) => (
        <Car key={x} x={x} y={BR.deck - 6} s={0.34} fill={ink} flip={i % 3 === 1} taxi={i === 3} />
      ))}
      <g className="zs-blink">
        <circle cx={452} cy={BR.deck - 12} r={2.2} fill={PAL.alert} />
        <circle cx={484} cy={BR.deck - 12} r={2.2} fill={PAL.alert} />
      </g>
      <Person x={350} y={BR.deck - 6} s={0.48} pose="walk" fill={ink} />
      <Dog x={378} y={BR.deck - 6} s={0.48} pose="stand" fill={ink} />
      <Zombie x={536} y={BR.deck - 6} s={0.48} pose="shamble" fill={ink} flip className="zs-sway" />
      <Zombie x={710} y={BR.deck - 6} s={0.4} pose="reach" fill={ink} flip />

      {/* 전경 — 둔치 갈대, 표지판 */}
      <path d="M0 384 C110 392 210 418 300 450 L0 450 Z" fill="#04050B" />
      <path d={reeds} stroke="#04050B" strokeWidth={2} fill="none" />
      <rect x={711} y={352} width={6} height={98} fill="#04050B" />
      <rect x={652} y={318} width={122} height={40} rx={3} fill="#17503A" stroke="#DCE8E0" strokeWidth={1.5} />
      <text x={713} y={342} textAnchor="middle" fontSize={17} fontWeight={800} fill="#F2F6F0">한강대교</text>
      <text x={713} y={353} textAnchor="middle" fontSize={7.5} fontWeight={700} fill="#CFE0D6">Hangang Br.</text>
      <Vignette id="zs-han_bridge-vig" strength={0.72} />
    </SceneSvg>
  );
}

// ─────────────────────────────── helicopter ───────────────────────────────

function Heli({ x, y, s, ink }: { x: number; y: number; s: number; ink: string }) {
  return (
    <g>
      <g transform={`translate(${x} ${y}) scale(${s})`}>
        {/* 블랙호크형 동체 — 각진 조종석, 엔진 혹, 가늘어지는 꼬리붐 */}
        <path d="M-150 -44 C-150 -56 -142 -66 -126 -72 L-102 -88 L-44 -92 L-34 -104 L34 -106 L56 -92 L80 -84 L196 -74 L204 -120 L218 -120 L214 -62 L188 -58 L80 -56 C70 -40 56 -28 30 -24 L-120 -24 C-140 -24 -150 -32 -150 -44 Z" fill={ink} />
        <path d="M186 -66 L236 -74 L238 -67 L188 -60 Z" fill={ink} />
        <path d="M-143 -50 C-140 -60 -132 -67 -122 -70 L-102 -84 L-100 -52 Z" fill="#8FB0C8" opacity={0.4} />
        <path d="M-102 -84 L-100 -52" stroke={ink} strokeWidth={3} />
        <rect x={-72} y={-80} width={52} height={52} fill="#E9E4C8" opacity={0.72} />
        <Person x={-48} y={-28} s={0.4} pose="stand" pack={false} fill={ink} flip />
        <rect x={-6} y={-78} width={20} height={14} rx={2} fill="#1A2228" />
        <text x={130} y={-62} textAnchor="middle" fontSize={10} fontWeight={800} fill="rgba(210,220,225,0.5)">육군</text>
        <path d="M-110 -24 L-116 -4 M40 -26 L50 -4 M196 -60 L200 -8" stroke={ink} strokeWidth={4} />
        <circle cx={-116} cy={-6} r={7} fill={ink} />
        <circle cx={50} cy={-6} r={7} fill={ink} />
        <circle cx={200} cy={-6} r={4.5} fill={ink} />
        <rect x={-4} y={-116} width={8} height={12} fill={ink} />
        <ellipse cx={212} cy={-100} rx={4} ry={24} fill="#C8D4DC" opacity={0.2} />
        <path d="M-126 -72 L-102 -88 L-44 -92 L-34 -104 L34 -106 L56 -92 L80 -84 L196 -74 L204 -120" stroke="#DCE8F4" strokeWidth={1.6} fill="none" opacity={0.75} strokeLinejoin="round" />
        <circle cx={-148} cy={-40} r={2.4} fill="#FFF6DA" />
        <circle cx={214} cy={-118} r={2} fill="#FF4A40" />
      </g>
      {/* 로터 블러 — 살짝 위에서 본 원반 */}
      <g transform={`translate(${x} ${y - 116 * s}) scale(${s})`}>
        <defs>
          <radialGradient id="zs-helicopter-disc">
            <stop offset="0" stopColor="#0A0E12" stopOpacity={0.55} />
            <stop offset="0.8" stopColor="#1A242C" stopOpacity={0.35} />
            <stop offset="1" stopColor="#C8D4DC" stopOpacity={0.3} />
          </radialGradient>
        </defs>
        <ellipse cx={0} cy={0} rx={200} ry={16} fill="url(#zs-helicopter-disc)" />
        <g className="zs-spin">
          <path d="M-196 -3 L0 -2 L0 2 L-196 4 Z M190 -4 L0 -2 L0 2 L190 3 Z" fill={ink} opacity={0.7} />
        </g>
      </g>
    </g>
  );
}

function Helicopter() {
  const r = rng(77);
  const ink = '#05070A';
  const dust = Array.from({ length: 150 }, (_, i) => {
    const near = i < 90;
    const x = near ? 170 + r() * 460 : r() * 800;
    const y = near ? 250 + r() * 160 : 150 + r() * 290;
    return <circle key={i} cx={x} cy={y} r={0.5 + r() * 1.8} fill="#EEF0E6" opacity={0.15 + r() * 0.5} />;
  });
  const beam = (x: number, delay: string) => (
    <g className="zs-sweep" style={{ animationDelay: delay }}>
      <polygon points={`${x - 4},300 ${x + 4},300 ${x + 90},-30 ${x - 90},-30`} fill="#EEF4FF" opacity={0.11} />
    </g>
  );
  return (
    <SceneSvg>
      <Sky id="zs-helicopter-sky" stops={[[0, '#04060A'], [0.4, '#0C131C'], [0.62, '#1C2833']]} />
      {beam(250, '0s')}
      {beam(640, '-3.5s')}
      {/* 롯데월드타워 + 잠실종합운동장 */}
      <path d="M548 214 L555 86 C558 58 562 36 566 22 C570 36 574 58 577 86 L584 214 Z" fill="#1A2530" />
      <circle cx={566} cy={22} r={2.2} fill="#FF4A40" />
      <path d="M36 292 L50 206 C200 180 600 180 750 206 L764 292 Z" fill="#141D26" />
      <path d="M50 206 C200 180 600 180 750 206 L744 214 C600 190 200 190 56 214 Z" fill="#26343F" />
      <path d="M50 206 C200 180 600 180 750 206" stroke="#7A8C9C" strokeWidth={1.6} fill="none" />
      <path d={Array.from({ length: 25 }, (_, i) => { const xx = 60 + i * 28; return `M${xx} ${214 - Math.sin((i / 24) * Math.PI) * 22} V292`; }).join(' ')} stroke="#1E2A34" strokeWidth={3} />
      <text x={150} y={236} textAnchor="middle" fontSize={13} fontWeight={800} fill="rgba(220,230,240,0.34)">잠실종합운동장</text>
      {[110, 690].map((x) => (
        <g key={x}>
          <rect x={x - 2} y={130} width={4} height={80} fill="#17202A" />
          <Glow id={`zs-helicopter-tower${x}`} cx={x} cy={128} r={130} color="#E4EEFA" opacity={0.6} />
          <rect x={x - 14} y={120} width={28} height={14} rx={2} fill="#F6FAFF" />
          <polygon points={`${x - 12},134 ${x + 12},134 ${x + (x < 400 ? 200 : -60)},300 ${x + (x < 400 ? 60 : -200)},300`} fill="#E4EEFA" opacity={0.07} />
        </g>
      ))}
      {/* 지면 · 헬기장 · 철조망 너머 좀비 */}
      <Sky id="zs-helicopter-ground" y={290} h={160} stops={[[0, '#1C2328'], [0.35, '#0B0F12'], [1, '#030405']]} />
      <Glow id="zs-helicopter-pool" cx={290} cy={352} r={300} color="#DCE2DA" opacity={0.5} />
      <polygon points="286,312 300,302 60,450 250,450" fill="#F2F6FF" opacity={0.09} />
      <ellipse cx={470} cy={366} rx={220} ry={36} stroke="rgba(236,240,228,0.32)" strokeWidth={3} fill="none" />
      {Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2;
        return <circle key={i} cx={470 + Math.cos(a) * 220} cy={366 + Math.sin(a) * 36} r={2.2} fill={PAL.alert} opacity={0.8} />;
      })}
      <Zombie x={58} y={302} s={0.42} pose="reach" fill="#0C1218" />
      <Zombie x={98} y={304} s={0.4} pose="shamble" fill="#0C1218" />
      <path d="M20 250 H236 M20 262 H236 M20 274 H236 M20 286 H236" stroke="#6E7C86" strokeWidth={0.8} opacity={0.5} />
      <path d="M20 244 V306 M74 244 V306 M128 244 V306 M182 244 V306 M236 244 V306" stroke="#0A0E12" strokeWidth={3} />
      <Haze id="zs-helicopter-haze" y={262} h={120} color="#A6B0B2" opacity={0.38} />

      <Heli x={470} y={360} s={1.25} ink={ink} />
      <g className="zs-drift">{dust}</g>

      {/* 헬기로 달려가는 사람들 */}
      <Person x={262} y={372} s={0.64} pose="stand" pack={false} fill={ink} flip />
      <Person x={184} y={402} s={0.72} pose="run" fill={ink} />
      <Dog x={144} y={428} s={0.8} pose="stand" fill={ink} />
      <Person x={96} y={430} s={0.84} pose="run" fill={ink} />

      {/* 전경 — 모래주머니 바리케이드 */}
      <g fill="#050608">
        {Array.from({ length: 7 }, (_, i) => (
          <ellipse key={i} cx={610 + i * 30} cy={430} rx={18} ry={10} />
        ))}
        <rect x={596} y={430} width={210} height={20} />
      </g>
      <rect x={636} y={392} width={104} height={28} rx={3} fill="#15120A" stroke={PAL.alert} strokeWidth={1.5} />
      <text x={688} y={412} textAnchor="middle" fontSize={15} fontWeight={800} fill={PAL.alert}>구조거점</text>
      <Vignette id="zs-helicopter-vig" strength={0.8} />
    </SceneSvg>
  );
}

// ─────────────────────────────── harbor ───────────────────────────────

function Crane({ x, y, s, fill }: { x: number; y: number; s: number; fill: string }) {
  const st = { stroke: fill, fill: 'none' };
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-40 0 L-34 -150 M40 0 L34 -150 M-44 -40 H44 M-38 -100 H38" {...st} strokeWidth={7} />
      <path d="M-40 -40 L34 -100 M40 -40 L-34 -100" {...st} strokeWidth={3} />
      <rect x={-210} y={-162} width={320} height={11} fill={fill} />
      <path d="M-34 -152 L0 -250 L34 -152" {...st} strokeWidth={6} />
      <path d="M0 -250 L-210 -160 M0 -250 L-130 -160 M0 -250 L108 -160" {...st} strokeWidth={2} />
      <rect x={-52} y={-180} width={42} height={19} fill={fill} />
      <rect x={-156} y={-151} width={16} height={12} fill={fill} />
      <path d="M-148 -139 V-66" {...st} strokeWidth={1.2} />
    </g>
  );
}

function Harbor() {
  const r = rng(58);
  const boxC = ['#56433C', '#34454C', '#4E4A3C', '#3E3A48'];
  const boxes = Array.from({ length: 30 }, (_, i) => {
    const col = i % 10;
    const row = Math.floor(i / 10);
    if (r() < 0.25 && row > 0) return null;
    return <rect key={i} x={588 + col * 21} y={322 - (row + 1) * 13} width={20} height={12} fill={boxC[Math.floor(r() * 4)]} />;
  });
  return (
    <SceneSvg>
      <Sky id="zs-harbor-sky" h={290} stops={[[0, '#172029'], [0.35, '#394B59'], [0.72, '#7A8C96'], [0.92, '#AEB8BA']]} />
      <Glow id="zs-harbor-sun" cx={236} cy={214} r={200} color="#EDE0C8" opacity={0.5} />
      <circle cx={236} cy={214} r={18} fill="#F4ECDA" opacity={0.45} />
      <Crane x={560} y={270} s={0.5} fill="#72828C" />
      <Crane x={680} y={270} s={0.5} fill="#72828C" />
      <Crane x={780} y={270} s={0.5} fill="#72828C" />
      <Sky id="zs-harbor-sea" y={266} h={80} stops={[[0, '#9AA8AC'], [1, '#4A5A64']]} />
      <Haze id="zs-harbor-haze1" y={218} h={80} color="#B4BEC0" opacity={0.55} />
      <Crane x={650} y={322} s={0.86} fill="#29343C" />
      {boxes}
      <g className="zs-blink">
        {[
          [560, 145],
          [680, 145],
          [780, 145],
          [650, 107],
        ].map(([cx, cy]) => (
          <circle key={cx} cx={cx} cy={cy} r={2.6} fill="#FF5A4A" />
        ))}
      </g>

      {/* 정박한 회색 수송선 */}
      <g className="zs-bob">
        <path d="M60 262 L540 256 L562 262 L550 334 L92 334 C76 312 66 288 60 262 Z" fill="#3A4650" />
        <path d="M400 257 V200 H430 V176 H502 V200 H530 V257 Z" fill="#323E48" />
        <path d="M468 176 V118 M452 132 H486 M462 146 H476" stroke="#323E48" strokeWidth={3} />
        {[438, 452, 466, 480, 494].map((x) => (
          <rect key={x} x={x} y={182} width={8} height={5} fill="#FFE2B0" opacity={0.75} />
        ))}
        <path d="M60 262 L540 256 L562 262 M430 176 H502 M400 200 H430" stroke="#C4CED2" strokeWidth={1.4} fill="none" opacity={0.5} />
        <path d="M70 256 H398" stroke="#323E48" strokeWidth={1.5} strokeDasharray="1.5 7" />
        <text x={214} y={304} textAnchor="middle" fontSize={28} fontWeight={800} fill="rgba(232,238,240,0.55)">687</text>
        <text x={470} y={296} textAnchor="middle" fontSize={11} fontWeight={700} fill="rgba(232,238,240,0.35)">대한민국 해군</text>
        {[150, 260, 360].map((x) => (
          <circle key={x} cx={x} cy={268} r={1.8} fill="#FFE2B0" opacity={0.8} />
        ))}
      </g>
      <Haze id="zs-harbor-haze2" y={280} h={70} color="#B8C2C4" opacity={0.42} className="zs-drift" />

      {/* 부두 — 승선 줄 */}
      <Sky id="zs-harbor-quay" y={336} h={114} stops={[[0, '#232B31'], [0.4, '#11161A'], [1, '#06080A']]} />
      <path d="M0 337 H800" stroke="#A4B2B8" strokeWidth={1.4} opacity={0.4} />
      <path d="M150 336 Q196 316 224 298 M476 336 Q500 312 522 296" stroke="#0B0F13" strokeWidth={1.6} fill="none" />
      <path d="M144 338 h12 v-7 h-12 Z M470 338 h12 v-7 h-12 Z" fill="#0B0F13" />
      <path d="M292 348 L338 258" stroke="#0B0F13" strokeWidth={5} />
      <path d="M296 334 L340 248" stroke="#0B0F13" strokeWidth={1.4} />
      <Person x={322} y={306} s={0.44} pose="walk" fill="#0B0F13" flip />
      <Person x={280} y={350} s={0.52} pose="stand" pack={false} fill="#0B0F13" />
      {[
        [352, 351, 'walk'],
        [390, 353, 'stand'],
        [428, 355, 'walk'],
        [468, 357, 'walk'],
        [512, 360, 'stand'],
      ].map(([x, y, pose]) => (
        <Person key={x} x={Number(x)} y={Number(y)} s={0.54} pose={pose === 'walk' ? 'walk' : 'stand'} fill="#0B0F13" flip />
      ))}
      <Haze id="zs-harbor-haze3" y={340} h={50} color="#8E9CA2" opacity={0.25} />

      {/* 전경 — 나와 콩이, 가로등과 부두 표지 */}
      <Person x={604} y={430} s={0.92} pose="walk" fill={PAL.ink} flip />
      <Dog x={662} y={432} s={0.86} pose="stand" fill={PAL.ink} flip />
      <Lamp x={40} y={450} h={250} lit color="#FFE3B8" fill={PAL.ink} />
      <rect x={42} y={296} width={98} height={44} rx={3} fill="#1B3C66" stroke="#DCE6F0" strokeWidth={1.4} />
      <text x={91} y={318} textAnchor="middle" fontSize={17} fontWeight={800} fill="#F2F6FA">인천항</text>
      <text x={91} y={333} textAnchor="middle" fontSize={10} fontWeight={700} fill="#C8D6E6">제1부두 · 승선</text>
      <Vignette id="zs-harbor-vig" strength={0.7} />
    </SceneSvg>
  );
}

// ─────────────────────────────── mountain ───────────────────────────────

function Pine({ x, y, s, fill }: { x: number; y: number; s: number; fill: string }) {
  return (
    <path
      transform={`translate(${x} ${y}) scale(${s})`}
      d="M-1.5 0 V-8 L-12 -8 L-3 -20 L-9 -20 L-2 -32 L-6 -32 L0 -46 L6 -32 L2 -32 L9 -20 L3 -20 L12 -8 L1.5 -8 V0 Z"
      fill={fill}
    />
  );
}

function Mountain() {
  const r = rng(93);
  const pines = Array.from({ length: 22 }, (_, i) => {
    const x = 8 + i * 36 + r() * 16;
    const y = 318 - Math.sin(x / 130) * 12 - (x > 500 ? 18 : 0) + r() * 6;
    return <Pine key={i} x={x} y={y} s={0.7 + r() * 0.6} fill="#27322C" />;
  });
  const lights: [number, number][] = [[560, 286], [596, 280], [700, 276], [738, 282], [470, 300], [520, 272], [650, 262]];
  const ribbons: [number, number, number, string][] = [[586, 62, 46, '#C8323A'], [612, 58, 58, '#E8B838'], [640, 54, 40, '#E8E6DC'], [668, 50, 52, '#3A6EC8'], [700, 44, 44, '#C8323A']];
  return (
    <SceneSvg>
      <Sky id="zs-mountain-sky" stops={[[0, '#18211D'], [0.3, '#3A483E'], [0.55, '#8A9A86'], [0.72, '#C9CCB2']]} />
      <Glow id="zs-mountain-sun" cx={610} cy={190} r={240} color="#F2E4BE" opacity={0.55} />
      <path d="M0 250 C90 228 150 244 220 230 C320 212 420 236 520 226 C640 214 720 232 800 222 V450 H0 Z" fill="#A6AE98" />
      {/* 북한산 삼봉 — 인수봉(둥근 화강암 돔) · 백운대(태극기) · 만경대. 여명은 오른쪽 뒤 */}
      <path d="M130 312 C176 292 214 252 232 206 C246 166 258 132 286 110 C312 90 352 92 374 112 C392 128 400 152 406 176 L422 168 L438 128 L452 110 L462 86 L472 70 L482 86 L494 82 L506 108 L522 122 L540 116 L556 138 L590 186 L632 232 L692 280 L750 312 Z" fill="#5F6B5C" />
      <path d="M232 206 C246 166 258 132 286 110 C298 101 310 96 322 95 C300 136 290 220 298 312 L170 312 C200 286 222 250 232 206 Z" fill="#4E5A4C" opacity={0.75} />
      <path d="M438 128 L452 110 L462 86 L472 70 C466 110 474 150 492 190 C470 230 462 270 470 300 L420 300 L406 176 L422 168 Z" fill="#4E5A4C" opacity={0.45} />
      <path d="M292 118 C318 104 344 104 362 122 M300 150 C326 136 356 140 376 160 M318 190 C340 178 370 182 392 204" stroke="#5A6658" strokeWidth={1.4} fill="none" opacity={0.7} />
      <path d="M322 95 C346 92 362 100 374 112 C392 128 400 152 406 176 M472 70 L482 86 L494 82 L506 108 L522 122 L540 116 L556 138 L590 186 L632 232" stroke="#F4E8C4" strokeWidth={1.8} fill="none" opacity={0.75} strokeLinejoin="round" />
      <path d="M472 71 V46" stroke="#1E2622" strokeWidth={1.8} />
      <rect x={473} y={46} width={13} height={9} fill="#F2F0E8" />
      <circle cx={479.5} cy={50.5} r={2.4} fill="#C8323A" />
      <path d="M477.1 50.5 A2.4 2.4 0 0 0 481.9 50.5 Z" fill="#2A4E9A" />
      <Haze id="zs-mountain-haze1" y={196} h={130} color="#CDD0B8" opacity={0.55} className="zs-drift" />

      {/* 능선 — 캠프 */}
      <path d="M0 330 C100 302 200 318 300 298 C400 280 500 300 560 290 C640 276 720 280 800 268 V450 H0 Z" fill="#34403A" />
      {pines}
      <defs>
        <radialGradient id="zs-mountain-dot">
          <stop offset="0" stopColor="#FFD690" stopOpacity={0.8} />
          <stop offset="1" stopColor="#FFD690" stopOpacity={0} />
        </radialGradient>
      </defs>
      {lights.map(([x, y]) => (
        <g key={x}>
          <circle cx={x} cy={y} r={14} fill="url(#zs-mountain-dot)" />
          <circle cx={x} cy={y} r={1.8} fill="#FFE6B0" />
        </g>
      ))}
      {[[586, 292, 26], [680, 284, 30]].map(([x, y, w]) => (
        <g key={x}>
          <path d={`M${x - w / 2} ${y} L${x} ${y - w * 0.7} L${x + w / 2} ${y} Z`} fill="#1C2420" />
          <path d={`M${x - w / 4} ${y} L${x} ${y - w * 0.46} L${x + w / 4} ${y} Z`} fill="#E8A850" opacity={0.75} />
        </g>
      ))}
      <Fire id="zs-mountain-fire" x={634} y={292} s={0.34} />
      <Person x={612} y={293} s={0.3} pose="sit" fill="#141A17" />
      <Person x={660} y={291} s={0.32} pose="stand" fill="#141A17" flip />
      <Person x={742} y={282} s={0.3} pose="stand" pack={false} fill="#141A17" flip />
      <Haze id="zs-mountain-haze2" y={296} h={90} color="#8A9884" opacity={0.35} />

      {/* 전경 — 바위, 나와 콩이, 이정표, 산악회 리본 */}
      <path d="M0 372 C60 360 140 364 210 378 C260 390 300 410 336 450 H0 Z" fill="#090D0B" />
      <path d="M0 372 C60 360 140 364 210 378 C260 390 300 410 336 450" stroke="#B8BEA4" strokeWidth={1.2} fill="none" opacity={0.35} />
      <Person x={165.6} y={368} s={0.96} pose="stand" fill="#C9C6A4" />
      <Dog x={205.4} y={377} s={0.9} pose="sit" fill="#C9C6A4" />
      <Person x={164} y={369} s={0.96} pose="stand" fill={PAL.ink} />
      <Dog x={204} y={378} s={0.9} pose="sit" fill={PAL.ink} />
      <rect x={60} y={318} width={6} height={50} fill={PAL.ink} />
      <rect x={30} y={304} width={100} height={22} rx={2} fill="#4E3820" stroke="#1E140A" strokeWidth={1.5} />
      <text x={80} y={320} textAnchor="middle" fontSize={12} fontWeight={800} fill="#F2E8D0">백운대 1.2km</text>
      <path d="M800 0 V450 H770 C774 330 776 160 784 0 Z" fill={PAL.ink} />
      <path d="M786 24 C720 36 650 44 570 60 L572 66 C650 54 720 46 784 40 Z" fill={PAL.ink} />
      {[[600, 50, 30, 12], [660, 40, 36, 12], [728, 30, 34, 14], [770, 70, 30, 20]].map(([cx, cy, rx, ry]) => (
        <ellipse key={cx} cx={cx} cy={cy} rx={rx} ry={ry} fill={PAL.ink} />
      ))}
      {ribbons.map(([x, y, len, c]) => (
        <path key={x} d={`M${x} ${y} c-2 ${len * 0.4} 4 ${len * 0.7} 1 ${len} l5 -1 c3 ${-len * 0.3} -3 ${-len * 0.6} -1 ${-len} Z`} fill={c} opacity={0.9} />
      ))}
      <Vignette id="zs-mountain-vig" strength={0.72} />
    </SceneSvg>
  );
}

export const sceneGroupG: Partial<Record<SceneId, ComponentType>> = {
  han_bridge: HanBridge,
  helicopter: Helicopter,
  harbor: Harbor,
  mountain: Mountain,
};
