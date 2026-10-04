/**
 * 서고(원고 10-2) — 서가가 양옆으로 높이 선 세자의 서재. 가운데 서안: 자물통이 비틀려 반쯤 열린 서랍, 서안 위 강학 일기 한 권,
 * 마룻바닥의 굳은 촛농 몇 방울. 오른쪽 열린 문간 너머 멀리 동궁 내문과 등롱을 든 수문 내관 실루엣. 먼지·먹 냄새의 차분한 어둠.
 * 발자국·서랍 속 내용·일기 글자는 그리지 않는다(장소 카드 몫).
 */
import type { SceneArtDef, SceneArtProps } from './types';
import { C, CommonDefs, Glow, GuardWithLantern, MaruFloor, Pillar, RoofSilhouette, SceneSvg, useSvgIds, Vignette } from './parts';

const BOOK_TONES = ['#3B3550', '#5A4426', '#2F3B46', '#4D2C26', '#6B5A3A', '#3E4A3A'];

/** 선반 한 칸 — 눕혀 쌓은 책 더미 몇 개 */
function Shelf({ x, y, w, seed }: { x: number; y: number; w: number; seed: number }) {
  let s = seed;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  const stacks: { x: number; w: number; books: { h: number; c: string }[] }[] = [];
  let cx = x + 10;
  while (cx < x + w - 60) {
    const bw = 60 + Math.floor(rnd() * 50);
    if (cx + bw > x + w - 8) break;
    const n = 2 + Math.floor(rnd() * 5);
    stacks.push({ x: cx, w: bw, books: Array.from({ length: n }, () => ({ h: 9 + Math.floor(rnd() * 7), c: BOOK_TONES[Math.floor(rnd() * BOOK_TONES.length)] })) });
    cx += bw + 10 + Math.floor(rnd() * 26);
  }
  return (
    <g>
      {stacks.map((st, i) => {
        let by = y;
        return (
          <g key={i}>
            {st.books.map((b, j) => {
              by -= b.h + 1;
              const off = (j % 2 ? 3 : -2) + (i % 3);
              return <rect key={j} x={st.x + off} y={by} width={st.w} height={b.h} fill={b.c} />;
            })}
          </g>
        );
      })}
      <rect x={x} y={y} width={w} height="12" fill={C.wood2} />
    </g>
  );
}

function SceneSgArt({ idScope }: SceneArtProps) {
  const ids = useSvgIds('sg', idScope);
  return (
    <SceneSvg label="scene-sg">
      <defs>
        <CommonDefs ids={ids} />
        <linearGradient id={ids.id('outside')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0A0E1C" />
          <stop offset="1" stopColor="#151A2A" />
        </linearGradient>
        <linearGradient id={ids.id('desk')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4A3220" />
          <stop offset="1" stopColor="#2C1D12" />
        </linearGradient>
      </defs>

      <rect width="1600" height="1000" fill="#15121A" />
      <rect width="1600" height="44" fill={C.wood0} />
      <rect y="40" width="1600" height="34" fill={C.wood1} />

      {/* 뒷벽 걸개(글씨 없이 먹 번짐만) */}
      <rect x="652" y="104" width="112" height="196" fill="#B9AC8C" opacity="0.32" />
      <rect x="644" y="98" width="128" height="10" fill={C.wood2} />
      <path d="M 690 132 C 700 170 694 214 704 262" stroke="#0A0A0E" strokeWidth="9" strokeLinecap="round" fill="none" opacity="0.45" />
      <path d="M 730 140 C 724 180 734 220 726 250" stroke="#0A0A0E" strokeWidth="6" strokeLinecap="round" fill="none" opacity="0.35" />

      {/* 문간 너머 — 동궁 내문과 수문 내관 */}
      <rect x="1300" y="76" width="300" height="660" fill={ids.url('outside')} />
      <rect x="1300" y="540" width="300" height="196" fill="#11131B" />
      <RoofSilhouette x={1370} y={400} w={230} h={96} fill="#05060B" />
      <rect x="1398" y="398" width="176" height="142" fill="#07080D" />
      <rect x="1446" y="420" width="78" height="120" fill="#0F1018" />
      <Glow ids={ids} cx={1460} cy={410} r={240} soft />
      <GuardWithLantern ids={ids} x={1392} y={470} s={0.6} />
      <Pillar x={1286} y={70} w={30} h={680} />
      <path d="M 1316 90 L 1356 110 L 1356 724 L 1316 742 Z" fill={C.wood1} />

      {/* 서가 — 왼쪽 높게, 오른쪽 좁게 */}
      <rect x="0" y="70" width="388" height="680" fill="#0F0C10" />
      {[180, 292, 404, 516, 628, 738].map((y, i) => (
        <Shelf key={y} x={8} y={y} w={372} seed={i * 7 + 3} />
      ))}
      <rect x="380" y="70" width="18" height="680" fill={C.wood2} />
      <rect x="0" y="70" width="12" height="680" fill={C.wood2} />
      <rect x="1150" y="70" width="136" height="680" fill="#0F0C10" />
      {[200, 330, 460, 590, 720].map((y, i) => (
        <Shelf key={y} x={1156} y={y} w={124} seed={i * 5 + 40} />
      ))}
      <rect x="1146" y="70" width="12" height="680" fill={C.wood2} />

      {/* 마루 */}
      <MaruFloor x={0} y={736} w={1600} h={264} color="#33251A" boards={6} />
      <rect x="0" y="736" width="1600" height="264" fill={ids.url('floorFade')} />

      {/* 서안 */}
      <Glow ids={ids} cx={800} cy={430} r={620} soft />
      <path d="M 448 272 L 1152 272 L 1176 306 L 424 306 Z" fill="#5E4129" />
      <path d="M 424 306 L 1176 306 L 1176 318 L 424 318 Z" fill="#2A1B10" />
      <rect x="452" y="318" width="696" height="320" fill={ids.url('desk')} />
      <rect x="462" y="638" width="30" height="100" fill={C.wood1} />
      <rect x="1108" y="638" width="30" height="100" fill={C.wood1} />
      {/* 오른쪽 서랍 — 닫힘 */}
      <rect x="832" y="430" width="232" height="124" fill="#3A2716" stroke="#1C120A" strokeWidth="5" />
      <circle cx="948" cy="492" r="13" fill="none" stroke={C.goldDim} strokeWidth="5" />
      {/* 왼쪽 서랍 — 자물통이 비틀려 반쯤 열림 */}
      <rect x="560" y="430" width="232" height="124" fill="#0B0705" />
      <path d="M 560 430 L 548 450 L 548 590 L 560 554 Z" fill="#2A1B10" />
      <path d="M 792 430 L 806 450 L 806 590 L 792 554 Z" fill="#1F140C" />
      <rect x="548" y="450" width="258" height="140" fill="#46301C" stroke="#1C120A" strokeWidth="5" />
      <rect x="548" y="450" width="258" height="12" fill="#5E4129" />
      <g transform="rotate(24 676 532)">
        <path d="M 660 512 C 656 486 690 480 700 498" stroke={C.gold} strokeWidth="6" fill="none" />
        <rect x="652" y="510" width="52" height="34" rx="4" fill={C.goldDim} stroke={C.gold} strokeWidth="2" />
      </g>
      <path d="M 640 520 L 660 528" stroke={C.gold} strokeWidth="3" opacity="0.7" />
      {/* 서안 위 강학 일기 한 권(제목 글자 없이) */}
      <path d="M 892 268 L 1060 254 L 1072 270 L 904 286 Z" fill="#D8CFB4" opacity="0.8" />
      <path d="M 890 252 L 1058 238 L 1060 254 L 892 268 Z" fill="#26304F" />
      <path d="M 892 268 L 1060 254" stroke="#141A2E" strokeWidth="3" />
      {[0, 1, 2, 3].map((i) => (
        <circle key={i} cx={906 + i * 1.6} cy={258 - i * 0.2 - 2 + i * 0} r="2.6" fill="#B9AC8C" transform={`translate(${i * 0} ${i * -1})`} />
      ))}
      <ellipse cx="980" cy="254" rx="70" ry="9" fill="#FFFFFF" opacity="0.06" />

      {/* 굳은 촛농 몇 방울 */}
      <g fill="#E7DCC0" opacity="0.88">
        <ellipse cx="356" cy="800" rx="13" ry="5" />
        <ellipse cx="408" cy="818" rx="9" ry="4" />
        <ellipse cx="462" cy="796" rx="11" ry="4.5" />
        <ellipse cx="500" cy="826" rx="7" ry="3" />
        <ellipse cx="438" cy="842" rx="8" ry="3.4" />
      </g>
      <g fill="#000" opacity="0.35">
        <ellipse cx="358" cy="805" rx="13" ry="3" />
        <ellipse cx="464" cy="801" rx="11" ry="3" />
      </g>

      <Glow ids={ids} cx={1460} cy={420} r={520} soft />
      <Vignette ids={ids} />
    </SceneSvg>
  );
}

export const sceneSg: SceneArtDef = {
  key: 'scene-sg',
  Art: SceneSgArt,
  anchors: {
    'OB-SG1': [42, 64],
    'OB-SG2': [27, 91],
    'OB-SG3': [61, 34],
    'OB-SG4': [88, 54],
  },
  labels: {
    'OB-SG3': '일기책',
    'OB-SG4': '문간 너머',
  },
};
