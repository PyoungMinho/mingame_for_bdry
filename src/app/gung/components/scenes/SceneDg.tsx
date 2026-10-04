/**
 * 동궁전(원고 10-2) — 대청을 가운데 둔 가로 단면. 왼쪽 동온돌: 빈 이부자리 + 머리맡 약상(탕약 사발·빈 정과 접시·은숟가락),
 * 가운데 대청 끝 엎드린 번 나인 둘, 오른쪽 서온돌: 다과상 위 백자 꿀단지(유지 덮고 실로 묶음) + 자개 문갑.
 * 그믐밤, 등잔 하나의 노란 빛. 매듭 모양·티끌·개미 같은 장소 카드 단서는 그리지 않는다.
 */
import type { SceneArtDef, SceneArtProps } from './types';
import { C, CommonDefs, DancheongBand, Glow, LadyProstrate, Lattice, MaruFloor, OilLamp, Pillar, NacreDots, SceneSvg, useSvgIds, Vignette } from './parts';

function SceneDgArt({ idScope }: SceneArtProps) {
  const ids = useSvgIds('dg', idScope);
  return (
    <SceneSvg label="scene-dg">
      <defs>
        <CommonDefs ids={ids} />
        <linearGradient id={ids.id('porc')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#F4EFE2" />
          <stop offset="0.55" stopColor="#D9D3C3" />
          <stop offset="1" stopColor="#8F8A7E" />
        </linearGradient>
        <linearGradient id={ids.id('tray')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5A2A19" />
          <stop offset="1" stopColor="#3A1A10" />
        </linearGradient>
        <linearGradient id={ids.id('ondol')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4C3517" />
          <stop offset="1" stopColor="#2E1F0E" />
        </linearGradient>
      </defs>

      {/* 바탕·천장·서까래 */}
      <rect width="1600" height="1000" fill={C.night1} />
      <rect width="1600" height="112" fill={C.wood0} />
      {Array.from({ length: 21 }, (_, i) => (
        <line key={i} x1={i * 80 + 20} y1="0" x2={i * 80 + 40} y2="112" stroke={C.wood2} strokeWidth="14" opacity="0.6" />
      ))}
      <DancheongBand x={0} y={108} w={1600} h={54} step={128} />

      {/* 뒷벽 3칸 */}
      <rect x="0" y="162" width="1600" height="340" fill={C.wall} />
      {/* 동온돌 창 — 등잔 빛이 번진 한지, 바깥 나뭇가지 그림자 */}
      <Lattice ids={ids} x={112} y={196} w={400} h={214} cols={5} rows={4} lit />
      <g stroke="#2A1A0C" strokeLinecap="round" fill="none" opacity="0.32">
        <path d="M 120 260 C 210 250 290 236 380 210" strokeWidth="9" />
        <path d="M 250 244 C 280 276 300 300 340 318" strokeWidth="6" />
        <path d="M 330 226 C 360 250 410 262 470 258" strokeWidth="5" />
      </g>
      {/* 대청 분합문 — 밖은 달 없는 밤 */}
      <Lattice ids={ids} x={640} y={184} w={380} h={318} cols={4} rows={6} />
      {/* 서온돌 창 */}
      <Lattice ids={ids} x={1150} y={196} w={340} h={196} cols={4} rows={4} />

      {/* 바닥: 온돌 장판 · 대청 마루 · 온돌 장판 */}
      <rect x="0" y="500" width="604" height="500" fill={ids.url('ondol')} />
      <MaruFloor x={604} y={500} w={456} h={500} color={C.floor} boards={8} />
      <rect x="1104" y="500" width="496" height="500" fill={ids.url('ondol')} />
      <rect x="0" y="500" width="1600" height="500" fill={ids.url('floorFade')} />

      {/* 기둥 */}
      <Pillar x={26} y={162} w={44} h={838} />
      <Pillar x={560} y={162} w={44} h={838} />
      <Pillar x={1060} y={162} w={44} h={838} />
      <Pillar x={1530} y={162} w={44} h={838} />

      {/* 동온돌 — 비어 있는 이부자리(요 + 젖힌 이불 + 베개) */}
      <path d="M 96 470 L 520 470 L 548 556 L 76 556 Z" fill="#2B2C45" />
      <path d="M 96 470 L 520 470 L 524 482 L 94 482 Z" fill="#3E4064" />
      <path d="M 290 474 C 340 452 430 450 520 470 L 548 556 C 470 540 380 536 300 546 Z" fill="#4A2F45" />
      <path d="M 300 546 C 380 536 470 540 548 556" stroke="#6B4762" strokeWidth="4" fill="none" />
      <rect x="110" y="452" width="96" height="36" rx="16" fill="#5B3A2A" />
      <ellipse cx="114" cy="470" rx="10" ry="18" fill={C.redDim} />
      <ellipse cx="202" cy="470" rx="10" ry="18" fill={C.blueDim} />

      {/* 등잔 하나 */}
      <Glow ids={ids} cx={540} cy={300} r={560} />
      <OilLamp x={540} y={560} h={262} />

      {/* 대청 끝 — 엎드려 떠는 번 나인 둘 */}
      <Glow ids={ids} cx={960} cy={700} r={260} soft />
      <LadyProstrate x={962} y={700} s={0.6} flip />
      <LadyProstrate x={918} y={752} s={0.78} flip />

      {/* 서온돌 — 자개 문갑 */}
      <rect x="1404" y="372" width="120" height="132" rx="4" fill="#0D0B10" />
      <NacreDots x={1412} y={382} w={104} h={112} n={20} seed={11} />
      <line x1="1404" y1="438" x2="1524" y2="438" stroke="#2A2430" strokeWidth="3" />
      <rect x="1456" y="426" width="16" height="24" rx="2" fill={C.goldDim} />

      {/* 서온돌 — 다과상 위 백자 꿀단지(유지를 덮어 실로 묶음) */}
      <Glow ids={ids} cx={1312} cy={450} r={260} soft />
      <path d="M 1180 520 L 1444 520 L 1430 548 L 1194 548 Z" fill={C.wood2} />
      <ellipse cx="1312" cy="520" rx="132" ry="20" fill={C.wood3} />
      <rect x="1206" y="546" width="16" height="96" fill={C.wood1} />
      <rect x="1402" y="546" width="16" height="96" fill={C.wood1} />
      <path d="M 1266 426 C 1232 440 1228 500 1262 520 L 1362 520 C 1396 500 1392 440 1358 426 Z" fill={ids.url('porc')} />
      <rect x="1290" y="396" width="44" height="34" fill={ids.url('porc')} />
      <path d="M 1272 404 Q 1312 372 1352 404 L 1360 428 Q 1312 436 1264 428 Z" fill="#B99556" opacity="0.92" />
      <path d="M 1270 418 Q 1312 426 1354 418" stroke="#6E5230" strokeWidth="4" fill="none" />
      <ellipse cx="1286" cy="468" rx="9" ry="22" fill="#FFFFFF" opacity="0.35" />

      {/* 머리맡 약상(소반) — 앞쪽 크게: 윗판 + 전(가장자리) + 앞면 + 다리 */}
      <path d="M 40 936 L 72 1000 L 98 1000 L 82 936 Z" fill={C.wood0} />
      <path d="M 628 936 L 616 1000 L 642 1000 L 672 936 Z" fill={C.wood0} />
      <path d="M 18 902 L 694 902 L 694 938 L 18 938 Z" fill="#2E1A0E" />
      <path d="M 62 546 L 648 546 L 694 904 L 18 904 Z" fill={ids.url('tray')} />
      <path d="M 62 546 L 648 546 L 694 904 L 18 904 Z" fill="none" stroke="#8A5A34" strokeWidth="9" strokeLinejoin="round" />
      <path d="M 84 566 L 628 566 L 668 886 L 44 886 Z" fill="none" stroke="#2A160C" strokeWidth="4" opacity="0.55" />
      <ellipse cx="300" cy="700" rx="300" ry="150" fill="#FFD98E" opacity="0.06" />
      {/* 탕약 사발 — 안쪽에 검은 찌꺼기 */}
      <ellipse cx="196" cy="600" rx="56" ry="10" fill="#000" opacity="0.45" />
      <path d="M 106 522 Q 116 584 166 598 L 226 598 Q 276 584 286 522 Z" fill={ids.url('porc')} />
      <rect x="166" y="594" width="60" height="8" rx="3" fill="#B9B2A2" />
      <ellipse cx="196" cy="522" rx="90" ry="20" fill="#EFE9DA" />
      <ellipse cx="196" cy="524" rx="79" ry="14" fill="#2A190E" />
      <ellipse cx="190" cy="527" rx="52" ry="7" fill="#100808" />
      <path d="M 130 556 Q 150 566 172 566" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.35" />
      {/* 빈 정과 접시 — 부스러기 하나 없다 */}
      <ellipse cx="226" cy="852" rx="108" ry="26" fill="#000" opacity="0.38" />
      <ellipse cx="226" cy="838" rx="108" ry="28" fill="#D3D9DC" />
      <ellipse cx="226" cy="836" rx="78" ry="18" fill="#BCC4C9" />
      <ellipse cx="226" cy="836" rx="78" ry="18" fill="none" stroke="#7C93A6" strokeWidth="3" opacity="0.7" />
      {/* 은숟가락 — 끈적한 게 말라붙음 */}
      <path d="M 566 700 L 694 652" stroke="#000" strokeWidth="12" strokeLinecap="round" opacity="0.3" transform="translate(4 8)" />
      <path d="M 566 700 L 694 652" stroke={C.silver} strokeWidth="12" strokeLinecap="round" />
      <path d="M 566 700 L 694 652" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" opacity="0.55" />
      <ellipse cx="530" cy="714" rx="44" ry="24" transform="rotate(-20 530 714)" fill={C.silver} />
      <ellipse cx="526" cy="716" rx="27" ry="13" transform="rotate(-20 526 716)" fill="#A97E3A" opacity="0.6" />

      <Vignette ids={ids} />
    </SceneSvg>
  );
}

export const sceneDg: SceneArtDef = {
  key: 'scene-dg',
  Art: SceneDgArt,
  anchors: {
    'OB-DG1': [12, 65],
    'OB-DG2': [14, 92],
    'OB-DG3': [38, 79],
    'OB-DG4': [82, 60],
    'OB-DG5': [62, 81],
  },
  labels: {
    'OB-DG4': '꿀단지',
    'OB-DG5': '번 나인 둘',
  },
};
