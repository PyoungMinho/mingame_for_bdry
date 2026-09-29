/**
 * 씬 그룹 B — 집 안 → 복도 → 비상계단. 씬마다 광원 색을 달리해 단조로움을 피한다.
 * dog_kongi(늦은 오후 창빛) · home_dark(랜턴 앰버 + 붉은 하늘) · hallway(회녹 형광등) · stairwell(비상구 초록)
 */
import type { ComponentType, ReactNode } from 'react';
import type { SceneId } from '@/lib/zombie/types';
import { Dog, Glow, Haze, PAL, Person, SceneSvg, Skyline, Sky, Smoke, Vignette, Zombie } from './primitives';

type Pt = [number, number];
const pts = (p: Pt[]) => p.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

// ─────────────────────────────── dog_kongi ───────────────────────────────

function DogKongi() {
  const DX = 318;
  const DY = 404;
  const DS = 5.2;
  return (
    <SceneSvg>
      {/* 현관 벽 — 오른쪽 창에서 드는 늦은 오후빛 */}
      <Sky id="zs-dog_kongi-wall" stops={[[0, '#1A0D06'], [0.45, '#3A1F0E'], [0.75, '#52301A'], [1, '#2A160A']]} />
      <Glow id="zs-dog_kongi-sun" cx={640} cy={150} r={360} color="#FFB060" opacity={0.42} />

      {/* 창 — 바깥 하늘, 멀리 연기 */}
      <defs>
        <clipPath id="zs-dog_kongi-win">
          <rect x={560} y={40} width={196} height={220} />
        </clipPath>
        <linearGradient id="zs-dog_kongi-out" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F2B878" />
          <stop offset="0.7" stopColor="#FFD89A" />
          <stop offset="1" stopColor="#E89A55" />
        </linearGradient>
      </defs>
      <g clipPath="url(#zs-dog_kongi-win)">
        <rect x={560} y={40} width={196} height={220} fill="url(#zs-dog_kongi-out)" />
        <Skyline x0={540} x1={780} base={262} minH={20} maxH={70} seed={21} fill="#B8703E" />
        <Smoke x={620} y={230} s={0.9} color="#7A4424" opacity={0.55} lean={1} />
      </g>
      <g fill="#140904">
        <rect x={552} y={34} width={212} height={8} />
        <rect x={552} y={258} width={212} height={12} />
        <rect x={552} y={34} width={8} height={234} />
        <rect x={756} y={34} width={8} height={234} />
        <rect x={654} y={34} width={7} height={234} />
        <rect x={560} y={150} width={196} height={5} />
      </g>

      {/* 빛 기둥 — 창에서 바닥으로 */}
      <polygon points="560,60 756,60 520,420 150,420" fill="#FFC47A" opacity={0.09} />
      <polygon points="560,160 654,160 380,420 230,420" fill="#FFD89A" opacity={0.08} />
      <g className="zs-drift">
        {[[430, 210], [470, 250], [395, 280], [510, 300], [450, 330], [355, 240]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={1.4} fill="#FFE2B0" opacity={0.55} />
        ))}
      </g>

      {/* 현관문 + 신발장 (왼쪽) */}
      <rect x={34} y={40} width={150} height={320} fill="#0E0704" />
      <rect x={34} y={40} width={150} height={320} fill="none" stroke="#5A3418" strokeWidth={2} opacity={0.5} />
      <rect x={160} y={200} width={8} height={32} rx={2} fill="#6E4418" opacity={0.7} />
      <circle cx={109} cy={130} r={3} fill="#3A2210" />
      <rect x={190} y={120} width={70} height={240} fill="#120804" />
      <path d="M190 180 H260 M190 240 H260 M190 300 H260" stroke="#3A2210" strokeWidth={2} />

      {/* 현관 바닥 + 턱 */}
      <path d="M0 360 L800 360 L800 450 L0 450 Z" fill="#1A0D06" />
      <path d="M0 360 H800" stroke="#C07A3A" strokeWidth={2} opacity={0.55} />
      <path d="M0 382 H800 M0 412 H800" stroke="#000" strokeWidth={1} opacity={0.3} />
      {/* 신발 */}
      <g fill="#0A0503">
        <path d="M60 388 C60 376 84 374 100 382 L104 390 Z" />
        <path d="M106 396 C106 384 130 382 146 390 L150 398 Z" />
        <path d="M600 392 C600 380 626 378 644 386 L648 394 Z" />
      </g>

      {/* 바닥 빛 조각 — 창틀 그림자가 십자로 */}
      <polygon points="360,362 580,362 640,450 300,450" fill="#FFC47A" opacity={0.2} />
      <path d="M470 362 L486 450 M330 404 H610" stroke="#1A0D06" strokeWidth={6} opacity={0.45} />
      {/* 콩이 그림자(바닥) */}
      <ellipse cx={DX - 60} cy={DY + 2} rx={120} ry={10} fill="#050201" opacity={0.6} />

      {/* 콩이 — 림라이트: 밝은 사본을 광원 쪽으로 밀고 검은 본체를 얹는다 */}
      <g transform={`rotate(-9 ${DX} ${DY})`}>
        <Dog x={DX + 3.5} y={DY - 2} s={DS} fill="#F0A050" />
        <Dog x={DX} y={DY} s={DS} fill="#0B0603" className="zs-bob" />
        {/* 목줄 고리 */}
        <g transform={`translate(${DX} ${DY}) scale(${DS})`}>
          <path d="M3.4 -28.2 C6 -25.4 10.5 -24.2 13.4 -26.2" stroke="#B0301C" strokeWidth={1.8} fill="none" strokeLinecap="round" />
          <circle cx={9} cy={-24.6} r={1} fill="#E8B060" />
        </g>
        <circle cx={DX + 18.4 * DS} cy={DY - 31.5 * DS} r={2.4} fill="#FFE2B0" opacity={0.85} />
      </g>
      {/* 목줄 — 가슴 앞으로 늘어져 바닥에 똬리 */}
      <path d="M366 276 C382 296 390 334 390 378 C390 404 428 414 470 408 C502 404 508 422 482 428 C462 432 454 418 470 414" stroke="#9A2A16" strokeWidth={4} fill="none" strokeLinecap="round" />
      <path d="M366 276 C382 296 390 334 390 378" stroke="#FFB060" strokeWidth={1} opacity={0.5} fill="none" />
      <Haze id="zs-dog_kongi-haze" y={320} h={80} color="#E08A40" opacity={0.18} />
      <Vignette id="zs-dog_kongi-vig" strength={0.82} />
    </SceneSvg>
  );
}

// ─────────────────────────────── home_dark ───────────────────────────────

function HomeDark() {
  const LX = 402;
  const LY = 372;
  return (
    <SceneSvg>
      <Sky id="zs-home_dark-wall" stops={[[0, '#060303'], [0.6, '#120806'], [1, '#0A0504']]} />

      {/* 창 — 붉게 물든 도시 하늘 + 먼 불길 */}
      <defs>
        <clipPath id="zs-home_dark-win">
          <rect x={470} y={60} width={272} height={214} />
        </clipPath>
      </defs>
      <g clipPath="url(#zs-home_dark-win)">
        <Sky id="zs-home_dark-sky" x={470} y={60} w={272} h={214} stops={[[0, '#12040A'], [0.5, '#5A120E'], [0.85, '#B0381A'], [1, '#E0622A']]} />
        <Glow id="zs-home_dark-fire" cx={660} cy={262} r={110} color="#FF7A30" opacity={0.7} className="zs-glow" />
        <Skyline x0={460} x1={760} base={276} minH={22} maxH={84} seed={33} fill="#2A0908" win="#FFB060" litRatio={0.02} tower={540} />
        <Smoke x={662} y={250} s={1.1} color="#1A0605" opacity={0.8} lean={-1} />
      </g>
      <g fill="#050202">
        <rect x={462} y={52} width={288} height={9} />
        <rect x={462} y={272} width={288} height={12} />
        <rect x={462} y={52} width={9} height={228} />
        <rect x={741} y={52} width={9} height={228} />
        <rect x={602} y={52} width={8} height={228} />
      </g>
      {/* 창빛 — 바닥으로 떨어지는 붉은 사다리꼴 */}
      <polygon points="470,274 742,274 780,450 520,450" fill="#C4401A" opacity={0.12} />

      {/* 랜턴 광원 — 벽을 넓게 데운다 */}
      <Glow id="zs-home_dark-lamp" cx={LX} cy={LY - 18} r={320} color="#E8923A" opacity={0.5} className="zs-glow" />
      <Glow id="zs-home_dark-bounce" cx={210} cy={230} r={200} color="#B8662A" opacity={0.28} />

      {/* 바닥 */}
      <defs>
        <radialGradient id="zs-home_dark-pool">
          <stop offset="0" stopColor="#E8923A" stopOpacity={0.4} />
          <stop offset="1" stopColor="#E8923A" stopOpacity={0} />
        </radialGradient>
      </defs>
      <path d="M0 360 H800 V450 H0 Z" fill="#0E0605" />
      <ellipse cx={LX} cy={LY + 4} rx={260} ry={46} fill="url(#zs-home_dark-pool)" />
      <path d="M0 360 H800" stroke="#6E4418" strokeWidth={1.5} opacity={0.5} />

      {/* 현관문 (바리케이드 뒤) */}
      <rect x={70} y={96} width={128} height={264} fill="#0A0403" stroke="#6E4418" strokeWidth={1.5} strokeOpacity={0.5} />

      {/* 바리케이드: 옆으로 세운 소파 + 다리가 하늘로 향한 뒤집힌 식탁 + 의자 */}
      <g fill="#060202" stroke="#060202" strokeLinecap="round">
        <path d="M30 362 V268 C30 256 38 250 50 250 H232 C244 250 250 256 250 268 V362 Z" strokeWidth={0} />
        <path d="M36 254 C36 236 46 230 60 230 C74 230 80 238 80 252 Z M244 254 C244 236 234 230 220 230 C206 230 200 238 200 252 Z" strokeWidth={0} />
        <rect x={52} y={214} width={214} height={16} strokeWidth={0} />
        <path d="M64 214 V134 M254 214 V134 M104 214 V150 M214 214 V150" strokeWidth={9} fill="none" />
        <path d="M262 362 L266 290 H318 L322 362 H312 L308 304 H276 L272 362 Z M268 290 L262 216 H274 L280 290 Z" strokeWidth={0} />
      </g>
      {/* 바리케이드 림라이트 — 랜턴 쪽 가장자리 */}
      <g stroke="#F0A050" strokeWidth={2} fill="none" strokeLinecap="round">
        <path d="M232 250 C244 250 250 256 250 268 V362" opacity={0.6} />
        <path d="M52 214 H266 V230" opacity={0.5} />
        <path d="M259 214 V134 M218 214 V150" opacity={0.45} />
        <path d="M322 362 L318 290 M280 290 L274 216" opacity={0.55} />
        <path d="M86 300 H236 M86 330 H236" opacity={0.12} />
      </g>

      {/* 생존자 + 콩이, 랜턴 곁에 (랜턴 쪽 림라이트) */}
      <Person x={336} y={391} s={1.15} pose="sit" fill="#F0A050" />
      <Person x={334} y={392} s={1.15} pose="sit" fill="#0A0504" />
      <Dog x={486} y={393} s={1.8} pose="sit" fill="#F0A050" flip />
      <Dog x={488} y={394} s={1.8} pose="sit" fill="#0A0504" flip className="zs-bob" />

      {/* 캠핑 랜턴 */}
      <g>
        <rect x={LX - 11} y={LY - 4} width={22} height={8} rx={2} fill="#1A0D06" />
        <rect x={LX - 9} y={LY - 30} width={18} height={26} rx={4} fill="#FFD89A" />
        <rect x={LX - 5} y={LY - 26} width={10} height={18} rx={3} fill="#FFF4DA" />
        <rect x={LX - 11} y={LY - 36} width={22} height={7} rx={2} fill="#1A0D06" />
        <path d={`M${LX - 7} ${LY - 36} C${LX - 7} ${LY - 48} ${LX + 7} ${LY - 48} ${LX + 7} ${LY - 36}`} stroke="#1A0D06" strokeWidth={2} fill="none" />
      </g>

      {/* 앞쪽 물건 실루엣: 생수·가방 */}
      <g fill="#030101">
        <rect x={560} y={404} width={16} height={34} rx={4} />
        <rect x={580} y={396} width={16} height={42} rx={4} />
        <path d="M608 438 C606 408 620 396 646 398 C670 400 678 414 676 438 Z" />
        <path d="M0 438 H800 V450 H0 Z" />
      </g>
      <Haze id="zs-home_dark-haze" y={250} h={120} color="#8E3417" opacity={0.12} />
      <Vignette id="zs-home_dark-vig" strength={0.9} />
    </SceneSvg>
  );
}

// ─────────────────────────────── hallway ───────────────────────────────

/** 1점 투시 — 소실점 (VX,VY), 깊이 d 에서 배율 1/(1+d) */
const VX = 404;
const VY = 214;
const pj = (X: number, Y: number, d: number): Pt => {
  const s = 1 / (1 + d);
  return [VX + X * s, VY + Y * s];
};
const WL = -470;
const WR = 470;
const CEIL = -250;
const FLOOR = 250;
const FAR = 6;

function Hallway() {
  const doors = [0.8, 1.9, 3.0, 4.1, 5.1];
  const tubes: { d: number; st: 'on' | 'flick' | 'off' }[] = [
    { d: 0.55, st: 'on' },
    { d: 1.6, st: 'flick' },
    { d: 2.6, st: 'off' },
    { d: 3.6, st: 'off' },
    { d: 4.6, st: 'on' },
    { d: 5.6, st: 'on' },
  ];
  // 소화전함 투시 행렬 (100×100 단위 공간 → 벽면)
  const h0 = pj(WL, -70, 0.28);
  const h1 = pj(WL, -70, 0.56);
  const h2 = pj(WL, 110, 0.28);
  const hm = [(h1[0] - h0[0]) / 100, (h1[1] - h0[1]) / 100, (h2[0] - h0[0]) / 100, (h2[1] - h0[1]) / 100, h0[0], h0[1]].map((v) => v.toFixed(3)).join(' ');
  const tubeQuad = (d: number): Pt[] => [pj(-40, CEIL, d), pj(40, CEIL, d), pj(40, CEIL, d + 0.12), pj(-40, CEIL, d + 0.12)];
  const light = (d: number, st: string, key: string | number): ReactNode => {
    const g = (
      <g>
        <polygon points={pts([pj(-40, CEIL, d), pj(40, CEIL, d), pj(330, FLOOR, d + 0.25), pj(-330, FLOOR, d + 0.25)])} fill="#BFE6D0" opacity={0.07} />
        <polygon points={pts(tubeQuad(d))} fill="#E6FFF2" />
        <ellipse cx={pj(0, FLOOR, d + 0.4)[0]} cy={pj(0, FLOOR, d + 0.4)[1]} rx={300 / (1.4 + d)} ry={46 / (1.4 + d)} fill="url(#zs-hallway-poolg)" />
      </g>
    );
    return st === 'flick' ? <g key={key} className="zs-flicker">{g}</g> : <g key={key}>{g}</g>;
  };
  return (
    <SceneSvg>
      <rect width={800} height={450} fill="#070C0A" />
      {/* 막다른 끝 — 창 너머 차가운 빛 */}
      <polygon points={pts([pj(WL, CEIL, FAR), pj(WR, CEIL, FAR), pj(WR, FLOOR, FAR), pj(WL, FLOOR, FAR)])} fill="#14211C" />
      <polygon points={pts([pj(-260, -150, FAR), pj(260, -150, FAR), pj(260, 60, FAR), pj(-260, 60, FAR)])} fill="#5E8583" />
      <Glow id="zs-hallway-end" cx={VX} cy={VY - 6} r={120} color="#8FB8AA" opacity={0.55} />
      {/* 천장·바닥·벽 */}
      <defs>
        <linearGradient id="zs-hallway-floor" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#0A100E" />
          <stop offset="1" stopColor="#2A3A33" />
        </linearGradient>
        <radialGradient id="zs-hallway-poolg">
          <stop offset="0" stopColor="#BFE6D0" stopOpacity={0.45} />
          <stop offset="1" stopColor="#BFE6D0" stopOpacity={0} />
        </radialGradient>
        <linearGradient id="zs-hallway-lwall" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#0E1613" />
          <stop offset="1" stopColor="#24332D" />
        </linearGradient>
      </defs>
      <polygon points={pts([pj(WL, CEIL, 0), pj(WR, CEIL, 0), pj(WR, CEIL, FAR), pj(WL, CEIL, FAR)])} fill="#0C1311" />
      <polygon points={pts([pj(WL, FLOOR, 0), pj(WR, FLOOR, 0), pj(WR, FLOOR, FAR), pj(WL, FLOOR, FAR)])} fill="url(#zs-hallway-floor)" />
      <polygon points={pts([pj(WL, CEIL, 0), pj(WL, CEIL, FAR), pj(WL, FLOOR, FAR), pj(WL, FLOOR, 0)])} fill="url(#zs-hallway-lwall)" />
      {/* 오른쪽: 복도식 — 난간벽 + 바깥 창 */}
      <polygon points={pts([pj(WR, CEIL, 0), pj(WR, CEIL, FAR), pj(WR, FLOOR, FAR), pj(WR, FLOOR, 0)])} fill="#101A16" />
      <polygon points={pts([pj(WR, -170, 0.2), pj(WR, -170, FAR), pj(WR, 60, FAR), pj(WR, 60, 0.2)])} fill="#0A1418" />
      {[0.2, 0.9, 1.7, 2.6, 3.6, 4.7].map((d) => (
        <polygon key={d} points={pts([pj(WR, -170, d), pj(WR, -170, d + 0.06), pj(WR, 60, d + 0.06), pj(WR, 60, d)])} fill="#1C2A25" />
      ))}
      <polyline points={pts([pj(WR, 60, 0), pj(WR, 60, FAR)])} stroke="#3E5A50" strokeWidth={2} fill="none" />
      {/* 걸레받이 선 */}
      <polyline points={pts([pj(WL, FLOOR - 16, 0), pj(WL, FLOOR - 16, FAR)])} stroke="#050807" strokeWidth={3} fill="none" />

      {/* 현관문 줄 */}
      {doors.map((d, i) => {
        const q: Pt[] = [pj(WL + 2, -150, d), pj(WL + 2, -150, d + 0.5), pj(WL + 2, FLOOR, d + 0.5), pj(WL + 2, FLOOR, d)];
        const plate = pj(WL + 2, -110, d + 0.25);
        const knob = pj(WL + 2, 60, d + 0.44);
        return (
          <g key={d}>
            <polygon points={pts(q)} fill="#0A0F0D" stroke="#3A5249" strokeWidth={1.2} />
            <rect x={plate[0] - 5 / (1 + d)} y={plate[1] - 5 / (1 + d)} width={16 / (1 + d)} height={9 / (1 + d)} fill="#8FB8AA" opacity={0.5} />
            <circle cx={knob[0]} cy={knob[1]} r={6 / (1 + d)} fill="#6E8C82" />
            {i === 3 && <polygon points={pts([pj(WL + 2, -150, d + 0.5), pj(WL + 2, -150, d + 0.62), pj(WL + 2, FLOOR, d + 0.62), pj(WL + 2, FLOOR, d + 0.5)])} fill="#000" />}
          </g>
        );
      })}

      {/* 형광등 */}
      {tubes.map((t, i) => (t.st === 'off' ? <polygon key={i} points={pts(tubeQuad(t.d))} fill="#2A3A33" /> : light(t.d, t.st, i)))}

      {/* 복도 끝의 기울어진 실루엣 */}
      <Glow id="zs-hallway-pool" cx={pj(60, FLOOR, 3.9)[0]} cy={pj(60, FLOOR, 3.9)[1]} r={50} color="#A8D4BE" opacity={0.25} />
      <Zombie x={pj(60, FLOOR, 3.5)[0]} y={pj(60, FLOOR, 3.5)[1]} s={0.84} pose="lurch" fill="#020403" flip className="zs-sway" />

      {/* 소화전함 (왼쪽 벽 근경) */}
      <g transform={`matrix(${hm})`}>
        <rect x={0} y={0} width={100} height={100} fill="#9E1A14" />
        <rect x={0} y={0} width={100} height={100} fill="none" stroke="#3A0806" strokeWidth={4} />
        <rect x={8} y={8} width={84} height={56} fill="#C42A1E" />
        <text x={50} y={42} textAnchor="middle" fontSize={24} fontWeight={800} fill="#FFE8E0">소화전</text>
        <circle cx={50} cy={80} r={8} fill="#FFB020" className="zs-blink" />
      </g>
      <polygon points={pts([h0, h1, pj(WL, 110, 0.56), h2])} fill="#FF4030" opacity={0.08} />

      <Haze id="zs-hallway-haze" y={170} h={110} color="#5E8583" opacity={0.18} />
      <Vignette id="zs-hallway-vig" strength={0.88} />
    </SceneSvg>
  );
}

// ─────────────────────────────── stairwell ───────────────────────────────

/** 층계참 모서리를 움켜쥔 손(부분 묘사). (x,y)=손가락 뿌리가 걸린 모서리, 손가락은 위로 */
function GripHand({ x, y, s = 1, rim, rot = 0 }: { x: number; y: number; s?: number; rim: string; rot?: number }) {
  const fx = [-14, -5.8, 2.4, 10.6];
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
      <g fill="#020403">
        <path d="M-13 120 C-12 70 -11 40 -10 14 L14 14 C15 40 17 70 19 120 Z" />
        <path d="M-16 16 C-18 4 -16 -4 -8 -6 L18 -6 C23 -4 23 8 17 16 Z" />
        {fx.map((fxx, i) => (
          <rect key={i} x={fxx} y={i === 0 || i === 3 ? -21 : -26} width={7} height={24} rx={3.5} />
        ))}
        <path d="M-16 8 C-24 4 -27 -6 -23 -12 C-21 -14 -17 -12 -17 -8 Z" />
      </g>
      <g stroke={rim} strokeLinecap="round" fill="none">
        {fx.map((fxx, i) => (
          <path key={i} d={`M${fxx + 0.6} ${(i === 0 || i === 3 ? -14 : -19)} C${fxx + 0.6} ${(i === 0 || i === 3 ? -20 : -25)} ${fxx + 4} ${(i === 0 || i === 3 ? -22 : -27)} ${fxx + 6} ${(i === 0 || i === 3 ? -19 : -24)}`} strokeWidth={1.3} opacity={0.85} />
        ))}
        <path d="M-23 -12 C-27 -6 -24 4 -16 8" strokeWidth={1.2} opacity={0.6} />
        <path d="M-10 16 C-11 40 -12 70 -13 120" strokeWidth={1.2} opacity={0.35} />
      </g>
    </g>
  );
}

function Stairwell() {
  const G = PAL.exit;
  return (
    <SceneSvg>
      {/* 벽 — 비상구 사인이 유일한 광원 */}
      <Sky id="zs-stairwell-wall" stops={[[0, '#030605'], [0.5, '#081510'], [1, '#040806']]} h={300} />
      <Glow id="zs-stairwell-sign" cx={150} cy={86} r={440} color={G} opacity={0.34} className="zs-glow" />
      <polygon points="92,106 212,106 460,344 -80,344" fill={G} opacity={0.07} />

      {/* 12F — 벽에 크게 칠한 층 표시 */}
      <text x={392} y={206} textAnchor="middle" fontSize={132} fontWeight={800} fill="#6FE0A0" opacity={0.3} style={{ letterSpacing: '-0.04em' }}>
        12F
      </text>
      <path d="M302 226 H488" stroke="#6FE0A0" strokeWidth={6} opacity={0.18} />

      {/* 방화문 + 비상구 사인 */}
      <rect x={70} y={120} width={132} height={180} fill="#050A07" stroke="#1E4A32" strokeWidth={2} />
      <rect x={82} y={200} width={108} height={9} rx={3} fill="#0E1A14" stroke={G} strokeOpacity={0.35} />
      <path d="M204 198 C207 202 206 208 203 212" stroke={PAL.blood} strokeWidth={2.5} opacity={0.55} fill="none" />
      <g>
        <rect x={86} y={62} width={130} height={44} rx={3} fill={G} />
        <rect x={180} y={68} width={26} height={32} fill="#E8FFF2" />
        <rect x={184} y={72} width={18} height={28} fill={G} />
        <Person x={140} y={100} s={0.36} pose="run" fill="#F2FFF7" pack={false} />
        <text x={110} y={98} textAnchor="middle" fontSize={11} fontWeight={800} fill="#F2FFF7">비상구</text>
      </g>

      {/* 층계참 바닥 — 사인 아래가 가장 밝다 */}
      <defs>
        <linearGradient id="zs-stairwell-floor" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#1C4A34" />
          <stop offset="0.6" stopColor="#10281C" />
          <stop offset="1" stopColor="#081410" />
        </linearGradient>
      </defs>
      <path d="M0 300 H560 L566 344 H0 Z" fill="url(#zs-stairwell-floor)" />
      <path d="M0 300 H560" stroke="#000" strokeWidth={2} opacity={0.5} />
      <path d="M0 344 H566" stroke={G} strokeWidth={1.6} opacity={0.45} />
      <rect x={0} y={345} width={570} height={13} fill="#030504" />

      {/* 아래로 꺾여 내려가는 계단 (오른쪽) */}
      {Array.from({ length: 7 }, (_, i) => (
        <g key={i} opacity={1 - i * 0.13}>
          <rect x={562 + i * 32} y={344 + i * 17} width={260} height={17} fill="#07100B" />
          <path d={`M${562 + i * 32} ${344 + i * 17} H820`} stroke={G} strokeWidth={1.4} opacity={0.35} />
        </g>
      ))}

      {/* 아래층 — 칠흑. 희미한 아랫 난간 */}
      <rect x={0} y={358} width={562} height={92} fill="#000" />
      <path d="M30 450 L330 372" stroke="#0E2218" strokeWidth={4} />
      <path d="M30 450 L330 372" stroke={G} strokeWidth={1} opacity={0.14} />

      {/* 난간 — 층계참 가장자리 → 계단 따라 아래로 */}
      <g stroke="#020403" strokeLinecap="round" fill="none">
        <path d="M238 244 H560 L800 382" strokeWidth={7} />
        {Array.from({ length: 15 }, (_, i) => 250 + i * 22).map((x) => (
          <path key={x} d={`M${x} 244 V340`} strokeWidth={3} />
        ))}
        {Array.from({ length: 7 }, (_, i) => i).map((i) => {
          const x = 586 + i * 32;
          const y = 244 + ((x - 560) * 138) / 240;
          return <path key={i} d={`M${x} ${y} V${y + 92}`} strokeWidth={3} />;
        })}
        <path d="M238 244 V340" strokeWidth={6} />
      </g>
      <path d="M238 242 H560 L800 380" stroke={G} strokeWidth={1.4} opacity={0.5} fill="none" />

      {/* 어둠에서 올라오는 손 — 층계참 모서리를 움켜쥔다 */}
      <Glow id="zs-stairwell-under" cx={440} cy={372} r={70} color={G} opacity={0.1} />
      <GripHand x={426} y={346} s={1.55} rim="#7CF0B0" rot={-4} />
      <g className="zs-bob">
        <GripHand x={520} y={410} s={1.05} rim={G} rot={14} />
      </g>

      <Haze id="zs-stairwell-haze" y={290} h={90} color={G} opacity={0.06} className="zs-drift" />
      <Vignette id="zs-stairwell-vig" strength={0.9} />
    </SceneSvg>
  );
}

export const sceneGroupB: Partial<Record<SceneId, ComponentType>> = {
  dog_kongi: DogKongi,
  home_dark: HomeDark,
  hallway: Hallway,
  stairwell: Stairwell,
};
