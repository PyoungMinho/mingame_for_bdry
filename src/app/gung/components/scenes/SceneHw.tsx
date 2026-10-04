/**
 * 후원 연못(원고 10-2) — 그믐밤의 검은 연못. 앞쪽 징검돌과 빽빽한 연잎, 왼쪽 물가의 불 꺼진 석등,
 * 오른쪽 큰길에서 비껴 들어오는 좁은 오솔길, 멀리 취향당 쪽 희미한 불빛. 달이 없어 별빛만 물에 비친다.
 * 바꽃은 그리지 않는다(인원 무관 — 원고 10-1). 석등 밑 흔적도 그리지 않는다.
 * R2 관찰(「연잎 하나에 하얀 것」)의 겉모습은 조사 2부터만 그린다(글씨·가루 없이 하얀 것 하나).
 */
import type { SceneArtDef, SceneArtProps } from './types';
import { C, CommonDefs, Glow, SceneSvg, Stars, useSvgIds, Vignette } from './parts';

/** 연잎 하나 — 갈라진 홈 + 잎맥 */
function LotusLeaf({ cx, cy, r, tone = '#1F3A28', rot = 0 }: { cx: number; cy: number; r: number; tone?: string; rot?: number }) {
  const ry = r * 0.56;
  return (
    <g transform={`rotate(${rot} ${cx} ${cy})`}>
      <ellipse cx={cx} cy={cy + 4} rx={r} ry={ry} fill="#000" opacity="0.45" />
      <path
        d={`M ${cx} ${cy} L ${cx + r * 0.97} ${cy - ry * 0.16} A ${r} ${ry} 0 1 1 ${cx + r * 0.97} ${cy + ry * 0.16} Z`}
        fill={tone}
      />
      <path
        d={`M ${cx} ${cy} L ${cx + r * 0.97} ${cy - ry * 0.16} A ${r} ${ry} 0 1 1 ${cx + r * 0.97} ${cy + ry * 0.16} Z`}
        fill="none"
        stroke="#4F7A55"
        strokeWidth="2.5"
        opacity="0.55"
      />
      {[150, 200, 250, 300].map((a) => {
        const rad = (a * Math.PI) / 180;
        return <line key={a} x1={cx} y1={cy} x2={cx + Math.cos(rad) * r * 0.85} y2={cy + Math.sin(rad) * ry * 0.85} stroke="#0E1F14" strokeWidth="2" />;
      })}
    </g>
  );
}

function SceneHwArt({ round, idScope }: SceneArtProps) {
  const ids = useSvgIds('hw', idScope);
  return (
    <SceneSvg label="scene-hw">
      <defs>
        <CommonDefs ids={ids} />
        <linearGradient id={ids.id('sky')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#03040A" />
          <stop offset="1" stopColor="#0E1222" />
        </linearGradient>
        <linearGradient id={ids.id('water')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0A1020" />
          <stop offset="1" stopColor="#020309" />
        </linearGradient>
      </defs>

      {/* 하늘 — 달 없음, 별만 */}
      <rect width="1600" height="1000" fill={ids.url('sky')} />
      <Stars x={0} y={0} w={1600} h={260} n={70} seed={13} />

      {/* 담장과 나무 */}
      <rect x="0" y="262" width="1600" height="70" fill="#0C0E16" />
      <path d="M 0 262 L 1600 262 L 1600 248 Q 800 236 0 248 Z" fill="#06070C" />
      {Array.from({ length: 27 }, (_, i) => (
        <path key={i} d={`M ${i * 60} 250 q 30 -10 60 0`} stroke="#151826" strokeWidth="4" fill="none" />
      ))}
      <path d="M 0 330 L 0 120 C 30 110 60 140 80 120 C 110 92 150 130 170 104 C 196 140 236 150 250 190 C 220 210 230 240 200 262 L 160 330 Z" fill="#05080A" />
      <path d="M 40 330 L 52 180 L 70 180 L 76 330 Z" fill="#05080A" />
      <path d="M 1010 332 L 1030 250 L 1060 262 L 1080 214 L 1112 230 L 1140 196 L 1170 226 L 1200 210 L 1226 250 L 1256 244 L 1270 332 Z" fill="#05080A" />
      {/* 멀리 취향당 쪽 희미한 불빛 */}
      <Glow ids={ids} cx={1470} cy={292} r={150} />
      <rect x="1452" y="282" width="26" height="18" fill={C.candle} opacity="0.55" />

      {/* 땅 */}
      <rect x="0" y="330" width="1600" height="670" fill="#070B09" />

      {/* 검은 연못 */}
      <path
        d="M 236 548 C 250 410 620 336 980 342 C 1268 348 1338 500 1276 640 C 1214 776 900 838 620 816 C 356 798 222 690 236 548 Z"
        fill={ids.url('water')}
      />
      <path
        d="M 236 548 C 250 410 620 336 980 342 C 1268 348 1338 500 1276 640 C 1214 776 900 838 620 816 C 356 798 222 690 236 548 Z"
        fill="none"
        stroke="#1E2838"
        strokeWidth="6"
      />
      <g opacity="0.55">
        <Stars x={360} y={380} w={820} h={300} n={34} seed={29} opacity={0.6} />
      </g>
      {[[540, 470, 60], [820, 420, 90], [1040, 520, 70], [700, 600, 50]].map(([x, y, w]) => (
        <line key={`${x}-${y}`} x1={x - w / 2} y1={y} x2={x + w / 2} y2={y} stroke="#8EA4C8" strokeWidth="2" opacity="0.22" />
      ))}
      {/* 물가 돌 */}
      {[[250, 600, 46], [300, 690, 40], [1290, 560, 44], [1250, 680, 50], [400, 430, 36], [1180, 400, 40]].map(([x, y, r]) => (
        <ellipse key={`${x}-${y}`} cx={x} cy={y} rx={r} ry={r * 0.55} fill="#1E2026" />
      ))}

      {/* 연잎 빽빽 + 징검돌 */}
      <LotusLeaf cx={540} cy={650} r={64} rot={-4} />
      <LotusLeaf cx={640} cy={700} r={56} tone="#22402B" rot={6} />
      <LotusLeaf cx={470} cy={730} r={52} tone="#1C3424" rot={-8} />
      <LotusLeaf cx={900} cy={720} r={62} tone="#22402B" rot={6} />
      <LotusLeaf cx={1000} cy={660} r={48} rot={-6} />
      <LotusLeaf cx={820} cy={640} r={44} tone="#1C3424" rot={8} />
      <LotusLeaf cx={1080} cy={740} r={50} rot={-4} />
      {[[600, 960, 70], [668, 870, 64], [736, 790, 58], [800, 726, 50], [860, 672, 44]].map(([x, y, r]) => (
        <g key={`${x}-${y}`}>
          <ellipse cx={x} cy={y + 6} rx={r} ry={r * 0.42} fill="#000" opacity="0.5" />
          <ellipse cx={x} cy={y} rx={r} ry={r * 0.42} fill="#3A3D44" />
          <ellipse cx={x - r * 0.2} cy={y - r * 0.08} rx={r * 0.6} ry={r * 0.2} fill="#55585F" opacity="0.6" />
        </g>
      ))}
      {round >= 2 && (
        <g data-detail="r2">
          <path d="M 520 640 L 562 632 L 566 652 L 524 660 Z" fill="#E9E6DC" />
          <path d="M 520 640 L 562 632" stroke="#FFFFFF" strokeWidth="2" opacity="0.7" />
        </g>
      )}

      {/* 불 꺼진 석등 */}
      <g>
        <rect x="196" y="600" width="120" height="40" fill="#2A2C33" />
        <rect x="236" y="440" width="40" height="164" fill="#33353D" />
        <rect x="204" y="420" width="104" height="24" fill="#3A3C44" />
        <rect x="214" y="334" width="84" height="88" fill="#3A3C44" />
        <rect x="236" y="352" width="40" height="50" fill="#07080B" />
        <path d="M 180 336 L 332 336 L 314 312 Q 256 286 198 312 Z" fill="#43454D" />
        <path d="M 176 338 L 166 326 M 336 338 L 346 326" stroke="#43454D" strokeWidth="8" strokeLinecap="round" />
        <path d="M 246 296 L 266 296 L 262 266 Q 256 254 250 266 Z" fill="#43454D" />
        <rect x="236" y="440" width="10" height="164" fill="#4A4C55" opacity="0.6" />
      </g>

      {/* 큰길에서 비껴 든 좁은 오솔길 */}
      <path
        d="M 1600 470 C 1470 498 1336 540 1286 600 C 1238 660 1256 760 1334 862 L 1392 1000 L 1494 1000 L 1424 862 C 1352 762 1338 684 1374 634 C 1422 574 1510 544 1600 532 Z"
        fill="#2B2920"
      />
      {[[1350, 640], [1310, 720], [1380, 820], [1430, 930], [1480, 560], [1540, 520]].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="4" fill="#4A463A" />
      ))}
      <path d="M 1180 1000 C 1170 900 1220 800 1250 700 C 1270 640 1300 600 1330 580 L 1340 640 C 1300 700 1280 800 1300 1000 Z" fill="#050806" />
      <path d="M 1600 600 C 1520 620 1440 680 1420 760 C 1410 820 1460 900 1540 1000 L 1600 1000 Z" fill="#050806" />

      <Glow ids={ids} cx={800} cy={560} r={760} cold />
      <Vignette ids={ids} />
    </SceneSvg>
  );
}

export const sceneHw: SceneArtDef = {
  key: 'scene-hw',
  Art: SceneHwArt,
  anchors: {
    'OB-HW1': [16, 54],
    'OB-HW2': [46, 75],
    'OB-HW3': [81, 59],
    'OB-HW4': [58, 42],
  },
  labels: {
    'OB-HW2': '연잎·징검돌',
  },
};
