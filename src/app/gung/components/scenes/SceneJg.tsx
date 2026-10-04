/**
 * 중궁전(원고 10-2) — 화려한 안방. 가운데 마주 놓인 비단 방석 둘, 그 곁 늦여름인데 피운 흔적이 있는 차 화로(재 수북),
 * 뒤쪽 굳게 닫힌 자개 문갑, 문 앞을 지키는 나인 은월의 실루엣. 금박 병풍과 향 연기, 위엄 있고 긴장된 분위기.
 * R2 관찰(「재 속에 타다 만 종잇조각」)의 겉모습은 조사 2부터만 그린다(글자 없이 조각만). 쪽지 내용은 그리지 않는다.
 */
import type { SceneArtDef, SceneArtProps } from './types';
import { C, CandleStand, CommonDefs, DancheongBand, Glow, LadyStanding, NacreDots, SceneSvg, useSvgIds, Vignette } from './parts';

function SceneJgArt({ round, idScope }: SceneArtProps) {
  const ids = useSvgIds('jg', idScope);
  const panels = 8;
  const px = 120;
  const pw = 116;
  return (
    <SceneSvg label="scene-jg">
      <defs>
        <CommonDefs ids={ids} />
        <linearGradient id={ids.id('gold')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8C6A2C" />
          <stop offset="0.5" stopColor="#B08A44" />
          <stop offset="1" stopColor="#5E461C" />
        </linearGradient>
        <linearGradient id={ids.id('jangpan')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5A3E1A" />
          <stop offset="1" stopColor="#2E1F0C" />
        </linearGradient>
        <linearGradient id={ids.id('bronze')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#7A5A2C" />
          <stop offset="0.5" stopColor="#5A4220" />
          <stop offset="1" stopColor="#2E2210" />
        </linearGradient>
      </defs>

      <rect width="1600" height="1000" fill="#160F12" />
      <rect width="1600" height="72" fill={C.wood0} />
      {Array.from({ length: 10 }, (_, i) => (
        <rect key={i} x={i * 170} y="8" width="150" height="54" fill="#1E1418" stroke={C.goldDim} strokeWidth="2" opacity="0.7" />
      ))}
      <DancheongBand x={0} y={70} w={1600} h={50} step={120} />
      <rect x="0" y="120" width="1600" height="450" fill="#21181B" />

      {/* 금박 병풍 8폭 */}
      <rect x={px - 12} y="132" width={panels * pw + 24} height="426" fill="#2A1410" />
      {Array.from({ length: panels }, (_, i) => (
        <g key={i}>
          <rect x={px + i * pw + 4} y="142" width={pw - 8} height="406" fill={ids.url('gold')} opacity="0.62" />
          <rect x={px + i * pw + 4} y="142" width={pw - 8} height="406" fill="none" stroke="#3A1A12" strokeWidth="4" />
        </g>
      ))}
      <g fill="none" stroke={C.goldHi} strokeLinecap="round" opacity="0.35">
        <path d="M 140 500 C 260 440 360 470 460 400 C 560 330 640 360 760 300 C 860 250 950 270 1040 220" strokeWidth="6" />
        <path d="M 460 400 C 470 360 500 340 530 330 M 760 300 C 760 260 790 236 820 226" strokeWidth="4" />
        {[[300, 452], [530, 330], [820, 226], [640, 360], [960, 262]].map(([x, y]) => (
          <g key={`${x}-${y}`}>
            <circle cx={x} cy={y} r="22" strokeWidth="4" />
            <circle cx={x} cy={y} r="9" strokeWidth="3" />
          </g>
        ))}
        <path d="M 180 220 q 30 -24 60 0 q 30 24 60 0 M 620 180 q 26 -20 52 0 q 26 20 52 0" strokeWidth="4" />
      </g>

      {/* 문간 — 지키는 나인 은월 */}
      <rect x="1326" y="150" width="212" height="560" fill="#2C2230" />
      <rect x="1326" y="150" width="212" height="560" fill={ids.url('glowSoft')} />
      <rect x="1302" y="132" width="262" height="26" fill={C.wood2} />
      <rect x="1302" y="132" width="26" height="600" fill={C.wood2} />
      <rect x="1536" y="132" width="26" height="600" fill={C.wood2} />

      {/* 장판 */}
      <rect x="0" y="566" width="1600" height="434" fill={ids.url('jangpan')} />
      <rect x="0" y="566" width="1600" height="434" fill={ids.url('floorFade')} />
      <ellipse cx="420" cy="720" rx="420" ry="90" fill="#FFD98E" opacity="0.035" />

      <LadyStanding x={1430} y={702} s={1.12} flip />

      {/* 굳게 닫힌 자개 문갑 */}
      <rect x="1080" y="404" width="268" height="30" fill={C.wood1} />
      <rect x="1080" y="224" width="268" height="184" rx="4" fill="#0B0A0E" />
      <NacreDots x={1092} y={236} w={244} h={160} n={24} seed={21} />
      <line x1="1214" y1="228" x2="1214" y2="404" stroke="#26202C" strokeWidth="4" />
      <rect x="1198" y="300" width="32" height="40" rx="4" fill={C.goldDim} stroke={C.gold} strokeWidth="2" />
      {[[1084, 228], [1330, 228], [1084, 390], [1330, 390]].map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="14" height="14" fill={C.goldDim} />
      ))}

      {/* 촛대와 향 연기 */}
      <Glow ids={ids} cx={190} cy={300} r={560} />
      <CandleStand x={190} y={600} h={300} />
      <rect x="292" y="520" width="64" height="40" fill={C.wood2} />
      <path d="M 302 520 Q 324 494 346 520 Z" fill={C.goldDim} />
      <g fill="none" stroke="#C8C2B6" strokeLinecap="round" opacity="0.22">
        <path d="M 324 500 C 300 460 350 430 320 390 C 296 356 340 320 318 280" strokeWidth="5" />
        <path d="M 326 470 C 352 440 330 400 356 360" strokeWidth="3" />
      </g>

      {/* 마주 놓인 비단 방석 둘 */}
      <path d="M 726 556 L 896 548 L 920 600 L 744 610 Z" fill="#6A1E26" />
      <path d="M 726 556 L 896 548 L 920 600 L 744 610 Z" fill="none" stroke={C.gold} strokeWidth="5" opacity="0.7" />
      <path d="M 960 562 L 1110 556 L 1140 612 L 978 620 Z" fill="#1E2A52" />
      <path d="M 960 562 L 1110 556 L 1140 612 L 978 620 Z" fill="none" stroke={C.gold} strokeWidth="5" opacity="0.7" />
      <ellipse cx="820" cy="578" rx="40" ry="10" fill="#000" opacity="0.18" />
      <ellipse cx="1050" cy="588" rx="40" ry="10" fill="#000" opacity="0.18" />

      {/* 차 화로 — 재가 수북 */}
      <ellipse cx="544" cy="566" rx="92" ry="16" fill="#000" opacity="0.4" />
      <rect x="486" y="540" width="14" height="30" fill="#2E2210" />
      <rect x="588" y="540" width="14" height="30" fill="#2E2210" />
      <path d="M 456 470 C 460 520 490 548 544 550 C 598 548 628 520 632 470 Z" fill={ids.url('bronze')} />
      <ellipse cx="544" cy="470" rx="88" ry="16" fill="#7A5A2C" />
      <path d="M 466 470 C 470 446 492 426 514 420 C 528 404 560 402 576 418 C 604 424 622 446 624 470 Z" fill="#77726D" />
      <path d="M 486 462 C 494 440 514 430 532 428 M 540 420 C 556 412 572 416 580 426" stroke="#A6A19B" strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.55" />
      <path d="M 470 470 C 520 462 580 462 620 470" stroke="#4E4A46" strokeWidth="4" fill="none" />
      {round >= 2 && (
        <g data-detail="r2">
          <path d="M 556 444 L 588 436 L 594 452 L 584 458 L 560 458 Z" fill="#E4DAC0" />
          <path d="M 584 458 L 560 458 L 556 444" stroke="#2A1A0E" strokeWidth="4" fill="none" />
        </g>
      )}

      <Vignette ids={ids} />
    </SceneSvg>
  );
}

export const sceneJg: SceneArtDef = {
  key: 'scene-jg',
  Art: SceneJgArt,
  anchors: {
    'OB-JG1': [34, 62],
    'OB-JG2': [58, 68],
    'OB-JG3': [76, 45],
    'OB-JG4': [88, 76],
  },
  labels: {
    'OB-JG2': '방석 둘',
  },
};
