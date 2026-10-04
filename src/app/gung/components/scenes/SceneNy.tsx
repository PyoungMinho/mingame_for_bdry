/**
 * 내의원(원고 10-5) — 벽 한 면을 채운 약장(이름표 붙은 서랍, 서랍 하나에 글자 없는 쪽지), 가운데 서안 위 펼쳐진 출납 장부(글자 없이),
 * 왼쪽 화로 위 식은 약탕관, 화로와 서안 사이 바닥에 돌 약절구, 구석에 고개 숙인 의녀 달래. 천장에 매달린 약초 다발.
 * 7판: 이 그림은 방장 화면·큰 화면(공용)에도 뜬다 — 관찰 줄의 겉모습(장부 먹물·약절구 가루·쪽지 글자)은 그리지 않는다.
 * 본 것은 살펴본 사람만 안다(원고 10-1 「그림 금지」 · 10-5).
 */
import type { SceneArtDef, SceneArtProps } from './types';
import { C, CommonDefs, Glow, LadyCrouch, OilLamp, SceneSvg, useSvgIds, Vignette } from './parts';

const HERBS = [
  { x: 120, len: 70, c: '#4C5A33' },
  { x: 236, len: 46, c: '#6B5A33' },
  { x: 350, len: 80, c: '#3E5236' },
  { x: 470, len: 54, c: '#5E4E2E' },
  { x: 590, len: 74, c: '#4A5A3A' },
  { x: 706, len: 50, c: '#6A5530' },
  { x: 816, len: 66, c: '#3F4F30' },
];

function SceneNyArt({ idScope }: SceneArtProps) {
  const ids = useSvgIds('ny', idScope);
  const cols = 9;
  const rows = 7;
  const cx0 = 896;
  const cy0 = 116;
  const dw = 70;
  const dh = 66;
  return (
    <SceneSvg label="scene-ny">
      <defs>
        <CommonDefs ids={ids} />
        <linearGradient id={ids.id('pot')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#7A5434" />
          <stop offset="0.5" stopColor="#5A3A22" />
          <stop offset="1" stopColor="#2A1A0E" />
        </linearGradient>
      </defs>

      <rect width="1600" height="1000" fill="#18141A" />
      <rect width="1600" height="40" fill={C.wood0} />
      <rect y="40" width="1600" height="30" fill={C.wood1} />
      <rect x="40" y="66" width="860" height="8" fill={C.wood2} />

      {/* 매달린 약초 다발 */}
      {HERBS.map((h) => (
        <g key={h.x}>
          <line x1={h.x} y1={72} x2={h.x} y2={72 + h.len} stroke="#8C7A55" strokeWidth="3" />
          <path d={`M ${h.x - 8} ${72 + h.len} L ${h.x + 8} ${72 + h.len} L ${h.x + 34} ${h.len + 196} L ${h.x - 30} ${h.len + 200} Z`} fill={h.c} />
          <path d={`M ${h.x} ${76 + h.len} L ${h.x - 14} ${h.len + 196} M ${h.x} ${76 + h.len} L ${h.x + 16} ${h.len + 194} M ${h.x} ${76 + h.len} L ${h.x} ${h.len + 200}`} stroke="#1E2416" strokeWidth="3" opacity="0.6" />
          <rect x={h.x - 10} y={66 + h.len} width="20" height="10" rx="3" fill="#8C6A3E" />
        </g>
      ))}

      {/* 약장 — 이름표 붙은 서랍(글자 없음) */}
      <rect x={cx0 - 18} y={cy0 - 18} width={cols * dw + 36} height={rows * dh + 36} fill={C.wood1} />
      {Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => {
          const x = cx0 + c * dw;
          const y = cy0 + r * dh;
          return (
            <g key={`${r}-${c}`}>
              <rect x={x + 3} y={y + 3} width={dw - 6} height={dh - 6} fill="#4A3220" />
              <rect x={x + 3} y={y + 3} width={dw - 6} height="5" fill="#5E4129" />
              <rect x={x + dw / 2 - 16} y={y + 14} width="32" height="16" fill="#D6CBAE" opacity="0.62" />
              <circle cx={x + dw / 2} cy={y + 46} r="6" fill="none" stroke={C.goldDim} strokeWidth="3" />
            </g>
          );
        }),
      )}
      <rect x={cx0 - 18} y={cy0 + rows * dh + 18} width={cols * dw + 36} height="26" fill={C.wood0} />
      {/* 서랍 하나(4째 줄 5째 칸)에 꽂힌 글자 없는 쪽지 */}
      <rect x={cx0 + 4 * dw + 40} y={cy0 + 3 * dh - 12} width="20" height="30" fill="#EDE4CC" transform={`rotate(-9 ${cx0 + 4 * dw + 50} ${cy0 + 3 * dh + 3})`} />

      {/* 마룻바닥 */}
      <rect x="0" y="640" width="1600" height="360" fill="#2E2116" />
      {[680, 738, 812, 904].map((y, i) => (
        <line key={y} x1="0" y1={y} x2="1600" y2={y} stroke={C.wood0} strokeWidth={2 + i} opacity="0.5" />
      ))}
      <rect x="0" y="640" width="1600" height="360" fill={ids.url('floorFade')} />

      {/* 화로 위 식은 약탕관 */}
      <path d="M 186 560 L 392 560 L 372 648 L 206 648 Z" fill="#3A2E28" />
      <ellipse cx="289" cy="560" rx="104" ry="18" fill="#4D3F36" />
      <ellipse cx="289" cy="560" rx="86" ry="12" fill="#1A1412" />
      <rect x="214" y="646" width="18" height="40" fill="#2A211C" />
      <rect x="346" y="646" width="18" height="40" fill="#2A211C" />
      <path d="M 236 474 C 214 500 220 540 248 556 L 330 556 C 358 540 364 500 342 474 Z" fill={ids.url('pot')} />
      <ellipse cx="289" cy="474" rx="54" ry="12" fill="#6A4A2C" />
      <ellipse cx="289" cy="470" rx="40" ry="9" fill="#3A2616" />
      <path d="M 342 492 L 430 462 L 434 474 L 346 506 Z" fill="#4A2F1A" />
      <path d="M 236 490 L 214 480 L 210 492 L 234 500 Z" fill="#5A3A22" />

      {/* 서안 위 출납 장부(글자 없이 줄만) */}
      <Glow ids={ids} cx={640} cy={420} r={520} />
      <path d="M 560 520 L 1040 520 L 1060 548 L 540 548 Z" fill="#5A3E26" />
      <rect x="548" y="548" width="504" height="16" fill="#2A1B10" />
      <rect x="566" y="564" width="22" height="78" fill={C.wood1} />
      <rect x="1012" y="564" width="22" height="78" fill={C.wood1} />
      <path d="M 692 512 L 798 518 L 800 470 L 704 462 Z" fill="#D8CEB2" />
      <path d="M 800 518 L 908 512 L 896 462 L 800 470 Z" fill="#E4DAC0" />
      <path d="M 798 518 L 800 470" stroke="#8C7F5E" strokeWidth="3" />
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i} stroke="#8C7F5E" strokeWidth="2" opacity="0.55">
          <line x1={712 + i * 0.5} y1={474 + i * 9} x2={792} y2={478 + i * 9} />
          <line x1={808} y1={478 + i * 9} x2={894 - i * 0.5} y2={474 + i * 9} />
        </g>
      ))}
      <OilLamp x={594} y={520} h={104} scale={0.9} />

      {/* 화로와 서안 사이 바닥의 돌 약절구 + 공이(가루는 그리지 않는다) */}
      <ellipse cx="474" cy="738" rx="74" ry="13" fill="#000" opacity="0.4" />
      <path d="M 410 668 C 412 712 432 736 474 738 C 516 736 536 712 538 668 Z" fill="#5E5A54" />
      <path d="M 420 690 C 430 718 448 730 474 731" stroke="#7E7A72" strokeWidth="4" fill="none" opacity="0.6" />
      <ellipse cx="474" cy="668" rx="64" ry="16" fill="#8A857D" />
      <ellipse cx="474" cy="668" rx="50" ry="11" fill="#26221E" />
      <path d="M 494 664 L 566 598" stroke="#2A1E14" strokeWidth="20" strokeLinecap="round" opacity="0.35" transform="translate(4 6)" />
      <path d="M 494 664 L 566 598" stroke="#7A6248" strokeWidth="18" strokeLinecap="round" />
      <path d="M 498 656 L 562 598" stroke="#A88A64" strokeWidth="5" strokeLinecap="round" opacity="0.5" />

      {/* 구석의 의녀 달래 */}
      <Glow ids={ids} cx={1380} cy={560} r={240} soft />
      <LadyCrouch x={1380} y={652} s={1.05} flip />

      <Vignette ids={ids} />
    </SceneSvg>
  );
}

export const sceneNy: SceneArtDef = {
  key: 'scene-ny',
  Art: SceneNyArt,
  // QA 7판 BUG-V7-02: 약탕관·약절구 이름표가 위아래로 붙어 약절구 56px 터치 칸이 약탕관 이름표 아래쪽을 덮었다(폰 폭 전부에서
  // 약탕관을 눌러도 약절구가 골리는 자리 11~35%). 약탕관은 탕관 바로 밑(61), 약절구는 절구 바로 밑(84)으로 벌렸다.
  anchors: {
    'OB-NY1': [18, 61],
    'OB-NY2': [50, 60],
    'OB-NY3': [74, 34],
    'OB-NY4': [86, 71],
    'OB-NY5': [30, 84],
  },
  labels: {
    'OB-NY2': '출납 장부',
  },
};
