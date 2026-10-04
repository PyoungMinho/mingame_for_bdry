/**
 * 내관 처소(원고 10-2) — 좁고 어수선한 숙소. 흐트러진 이부자리 위 속이 불룩한 베개, 오른쪽 벽의 문이 꼭 닫힌 이불장,
 * 열린 문간 밖으로 바로 곁 내의원 지붕, 툇마루에 버티고 앉은 장 별감 실루엣. 등잔 그을음, 남루한 생활감.
 * 투전목은 그리지 않는다. R2 관찰(「문틈으로 비단 보퉁이 끝」)의 겉모습은 조사 2부터만 그린다(속은 그리지 않는다).
 */
import type { SceneArtDef, SceneArtProps } from './types';
import { C, CommonDefs, Glow, ManSitting, OilLamp, RoofSilhouette, SceneSvg, Stars, useSvgIds, Vignette } from './parts';

function SceneNgArt({ round, idScope }: SceneArtProps) {
  const ids = useSvgIds('ng', idScope);
  return (
    <SceneSvg label="scene-ng">
      <defs>
        <CommonDefs ids={ids} />
        <clipPath id={ids.id('door')}>
          <rect x="700" y="118" width="204" height="440" />
        </clipPath>
        <radialGradient id={ids.id('soot')} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#000" stopOpacity="0.7" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={ids.id('outside')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#070912" />
          <stop offset="1" stopColor="#121726" />
        </linearGradient>
      </defs>

      <rect width="1600" height="1000" fill="#151114" />
      {/* 낮은 천장 + 그을음 */}
      <rect width="1600" height="92" fill={C.wood0} />
      <rect y="84" width="1600" height="18" fill={C.wood1} />
      <rect x="0" y="102" width="1290" height="500" fill="#1F191B" />
      <ellipse cx="600" cy="150" rx="210" ry="110" fill={ids.url('soot')} />
      <ellipse cx="560" cy="300" rx="90" ry="140" fill={ids.url('soot')} opacity="0.6" />
      <g stroke="#0E0B0C" strokeWidth="3" fill="none" opacity="0.7">
        <path d="M 120 200 L 160 260 L 150 320 L 190 380" />
        <path d="M 1000 140 L 970 200 L 990 240" />
        <path d="M 330 420 L 380 450 L 400 520" />
      </g>

      {/* 열린 문간 — 바로 곁 내의원 지붕 */}
      <rect x="700" y="118" width="204" height="440" fill={ids.url('outside')} />
      <g clipPath={ids.url('door')}>
        <Stars x={700} y={118} w={204} h={120} n={10} seed={5} opacity={0.6} />
        <RoofSilhouette x={612} y={300} w={420} h={120} fill="#04050A" />
        <rect x="700" y="300" width="204" height="260" fill="#0B0D14" />
        <rect x="700" y="470" width="204" height="90" fill="#141720" />
      </g>
      <rect x="688" y="110" width="20" height="458" fill={C.wood2} />
      <rect x="896" y="110" width="20" height="458" fill={C.wood2} />
      <rect x="688" y="104" width="228" height="18" fill={C.wood2} />
      <path d="M 916 130 L 962 150 L 962 540 L 916 560 Z" fill={C.wood1} />

      {/* 이불장 — 문이 꼭 닫힘(장석) */}
      <rect x="988" y="214" width="276" height="412" fill="#3A2716" />
      <rect x="1000" y="226" width="124" height="388" fill="#46301C" />
      <rect x="1128" y="226" width="124" height="388" fill="#46301C" />
      <line x1="1126" y1="226" x2="1126" y2="614" stroke="#120B06" strokeWidth="4" />
      {[262, 560].map((y) => (
        <g key={y} fill={C.goldDim}>
          <path d={`M 1000 ${y} l 26 -14 l 0 28 Z`} />
          <path d={`M 1252 ${y} l -26 -14 l 0 28 Z`} />
        </g>
      ))}
      <circle cx="1126" cy="372" r="22" fill={C.goldDim} />
      <rect x="1118" y="364" width="16" height="16" fill="#2A1A0E" />
      {round >= 2 && (
        <g data-detail="r2">
          <path d="M 1124 404 L 1150 418 L 1128 430 Z" fill="#8E2A3A" />
          <path d="M 1126 410 L 1146 419" stroke={C.gold} strokeWidth="2.5" />
        </g>
      )}
      <rect x="988" y="626" width="276" height="16" fill={C.wood0} />

      {/* 툇마루 쪽 — 방 경계 기둥 너머 바깥 */}
      <rect x="1290" y="92" width="310" height="560" fill="#0A0C14" />
      <Stars x={1300} y={110} w={300} h={260} n={18} seed={41} opacity={0.5} />
      <path d="M 1290 92 L 1600 92 L 1600 150 Q 1440 132 1290 140 Z" fill={C.wood0} />
      <rect x="1272" y="92" width="30" height="720" fill={C.wood1} />

      {/* 바닥(낡은 장판) + 툇마루 널 */}
      <rect x="0" y="602" width="1290" height="398" fill="#3A2A16" />
      {[[140, 820, 120, 80], [700, 900, 160, 70], [980, 760, 110, 60]].map(([x, y, w, h]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={w} height={h} fill="#2C1F10" opacity="0.8" />
      ))}
      <rect x="1290" y="652" width="310" height="348" fill="#3E2B19" />
      {[1330, 1380, 1430, 1480, 1530, 1580].map((x) => (
        <line key={x} x1={x} y1="652" x2={x + (x - 1440) * 0.4} y2="1000" stroke={C.wood0} strokeWidth="3" opacity="0.6" />
      ))}
      <rect x="1290" y="648" width="310" height="10" fill={C.woodHi} opacity="0.5" />
      <rect x="0" y="602" width="1600" height="398" fill={ids.url('floorFade')} />

      {/* 흐트러진 이부자리 + 속이 불룩한 베개 */}
      <path d="M 70 600 L 640 590 L 690 760 L 40 772 Z" fill="#2E2A3A" />
      <path d="M 210 620 C 300 580 460 600 560 640 C 620 670 660 720 690 760 L 300 770 C 260 720 220 680 210 620 Z" fill="#4A3A2E" />
      <path d="M 300 770 C 260 720 220 680 210 620" stroke="#6A5440" strokeWidth="5" fill="none" />
      <path d="M 352 552 C 340 530 372 520 400 526 C 430 516 470 522 482 540 C 496 560 486 590 460 600 C 430 610 392 606 368 598 C 348 590 340 570 352 552 Z" fill="#6E5D45" />
      <ellipse cx="356" cy="572" rx="12" ry="24" fill="#6A2A26" opacity="0.8" />
      <ellipse cx="478" cy="566" rx="12" ry="26" fill="#6A2A26" opacity="0.8" />
      <path d="M 392 540 C 410 548 440 546 456 536" stroke="#8C7A5E" strokeWidth="4" fill="none" opacity="0.6" />

      {/* 등잔 */}
      <Glow ids={ids} cx={600} cy={420} r={480} />
      <OilLamp x={600} y={596} h={150} scale={0.9} />

      {/* 툇마루에 버티고 앉은 장 별감 */}
      <Glow ids={ids} cx={1440} cy={560} r={220} soft />
      <ManSitting x={1440} y={772} s={0.96} />

      {/* 짚신 한 켤레 */}
      <g fill="#6E5A3A">
        <ellipse cx="1180" cy="880" rx="44" ry="15" transform="rotate(-8 1180 880)" />
        <ellipse cx="1236" cy="900" rx="44" ry="15" transform="rotate(4 1236 900)" />
      </g>
      <g stroke="#3E321E" strokeWidth="2" opacity="0.8">
        <line x1="1146" y1="884" x2="1214" y2="874" />
        <line x1="1202" y1="898" x2="1270" y2="902" />
      </g>

      <Vignette ids={ids} />
    </SceneSvg>
  );
}

export const sceneNg: SceneArtDef = {
  key: 'scene-ng',
  Art: SceneNgArt,
  anchors: {
    'OB-NG1': [26, 66],
    'OB-NG2': [70, 50],
    'OB-NG3': [50, 31],
    'OB-NG4': [88, 78],
  },
  labels: {},
};
