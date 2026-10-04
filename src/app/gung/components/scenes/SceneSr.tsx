/**
 * 수라간(원고 10-2) — 생과방의 부엌. 왼쪽 뚜껑 덮은 큰 석청 항아리, 벽에 붙은 종이 다과 발기(글자 없이),
 * 오른쪽 수군대다 입을 다문 생과방 나인 셋의 실루엣. 식은 부뚜막과 걸린 채반들, 새벽 전 부엌의 고요.
 * 발기 내용·노리개 같은 장소 카드 단서는 그리지 않는다.
 */
import type { SceneArtDef, SceneArtProps } from './types';
import { C, CommonDefs, Glow, LadyStanding, SceneSvg, useSvgIds, Vignette } from './parts';

/** 채반(대나무 소쿠리) */
function Sieve({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <g>
      <line x1={cx} y1={cy - r - 26} x2={cx} y2={cy - r} stroke={C.wood1} strokeWidth="4" />
      <circle cx={cx} cy={cy - r - 28} r="5" fill={C.wood2} />
      <circle cx={cx} cy={cy} r={r} fill="#4E4130" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#6B5A3A" strokeWidth="7" />
      {[0.72, 0.48, 0.24].map((k) => (
        <circle key={k} cx={cx} cy={cy} r={r * k} fill="none" stroke="#3A3022" strokeWidth="3" />
      ))}
      {[0, 30, 60, 90, 120, 150].map((a) => {
        const rad = (a * Math.PI) / 180;
        return (
          <line
            key={a}
            x1={cx - Math.cos(rad) * r * 0.95}
            y1={cy - Math.sin(rad) * r * 0.95}
            x2={cx + Math.cos(rad) * r * 0.95}
            y2={cy + Math.sin(rad) * r * 0.95}
            stroke="#3A3022"
            strokeWidth="2"
            opacity="0.7"
          />
        );
      })}
    </g>
  );
}

function SceneSrArt({ idScope }: SceneArtProps) {
  const ids = useSvgIds('sr', idScope);
  return (
    <SceneSvg label="scene-sr">
      <defs>
        <CommonDefs ids={ids} />
        <linearGradient id={ids.id('onggi')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#5E3C22" />
          <stop offset="0.45" stopColor="#3C2615" />
          <stop offset="1" stopColor="#1C120A" />
        </linearGradient>
        <linearGradient id={ids.id('shaft')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7E9CC2" stopOpacity="0.2" />
          <stop offset="1" stopColor="#7E9CC2" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* 벽·서까래 */}
      <rect width="1600" height="1000" fill="#1B1920" />
      <rect width="1600" height="64" fill={C.wood0} />
      {Array.from({ length: 11 }, (_, i) => (
        <rect key={i} x={i * 160 + 40} y="0" width="26" height="78" fill={C.wood1} />
      ))}
      <rect x="0" y="74" width="1600" height="16" fill={C.wood1} />
      <rect x="0" y="90" width="1600" height="680" fill="#1F1C23" />
      {[300, 770, 1520].map((x) => (
        <rect key={x} x={x} y="90" width="34" height="680" fill={C.wood1} />
      ))}

      {/* 높은 살창 — 새벽 전 푸른 기 */}
      <rect x="1000" y="120" width="190" height="124" fill="#2C3C58" />
      {[1030, 1062, 1094, 1126, 1158].map((x) => (
        <rect key={x} x={x} y="120" width="10" height="124" fill={C.wood1} />
      ))}
      <rect x="994" y="114" width="202" height="136" fill="none" stroke={C.wood2} strokeWidth="10" />
      <path d="M 1000 244 L 1190 244 L 1420 770 L 900 770 Z" fill={ids.url('shaft')} />

      {/* 걸린 채반들 */}
      <Sieve cx={560} cy={190} r={58} />
      <Sieve cx={1310} cy={170} r={60} />
      <Sieve cx={1436} cy={264} r={42} />

      {/* 벽에 붙은 동궁 다과 발기 — 글자 없이 먹줄 흔적만 */}
      <rect x="702" y="150" width="136" height="112" fill="#CFC4A6" opacity="0.82" />
      <path d="M 702 150 L 838 150 L 838 262 L 702 262 Z" fill="none" stroke="#8C7F5E" strokeWidth="2" />
      {[730, 756, 782, 808].map((x, i) => (
        <line key={x} x1={x} y1={168} x2={x} y2={236 - (i % 2) * 22} stroke="#5E5040" strokeWidth="5" strokeLinecap="round" opacity="0.32" />
      ))}
      <circle cx="770" cy="156" r="5" fill={C.wood0} />

      {/* 흙바닥 */}
      <rect x="0" y="770" width="1600" height="230" fill="#251E16" />
      <rect x="0" y="770" width="1600" height="230" fill={ids.url('floorFade')} />

      {/* 식은 부뚜막과 가마솥 */}
      <path d="M 500 600 L 1040 600 L 1060 780 L 480 780 Z" fill="#3A332C" />
      <path d="M 500 600 L 1040 600 L 1046 622 L 494 622 Z" fill="#4C443B" />
      <ellipse cx="640" cy="598" rx="96" ry="26" fill="#0E0D0F" />
      <ellipse cx="640" cy="590" rx="76" ry="18" fill="#2A1E14" />
      <rect x="626" y="574" width="28" height="10" rx="4" fill={C.wood3} />
      <ellipse cx="890" cy="598" rx="90" ry="24" fill="#0E0D0F" />
      <ellipse cx="890" cy="590" rx="70" ry="16" fill="#2A1E14" />
      <rect x="876" y="575" width="28" height="10" rx="4" fill={C.wood3} />
      <path d="M 590 780 L 590 716 Q 640 670 690 716 L 690 780 Z" fill="#0A0809" />
      <path d="M 840 780 L 840 716 Q 890 670 940 716 L 940 780 Z" fill="#0A0809" />
      <ellipse cx="640" cy="772" rx="38" ry="6" fill="#5A5550" opacity="0.6" />
      <ellipse cx="890" cy="772" rx="38" ry="6" fill="#5A5550" opacity="0.6" />

      {/* 뚜껑을 덮은 큰 석청 항아리(+ 뒤의 작은 독 둘) */}
      <path d="M 92 470 C 70 500 72 560 100 590 L 176 590 C 200 560 202 500 180 470 Z" fill="#24170D" />
      <ellipse cx="136" cy="470" rx="38" ry="10" fill="#1A1009" />
      <path d="M 156 520 C 140 540 142 580 160 600 L 210 600 C 226 580 226 540 212 520 Z" fill="#2E1D10" />
      <ellipse cx="320" cy="596" rx="128" ry="16" fill="#000" opacity="0.4" />
      <path d="M 252 400 C 184 418 168 470 186 528 C 200 572 236 594 270 598 L 370 598 C 404 594 440 572 454 528 C 472 470 456 418 388 400 Z" fill={ids.url('onggi')} />
      <path d="M 262 404 L 378 404 L 372 388 L 268 388 Z" fill="#2A1A0E" />
      <ellipse cx="320" cy="386" rx="78" ry="16" fill={C.wood3} />
      <ellipse cx="320" cy="380" rx="74" ry="13" fill="#6E4C2C" />
      <rect x="306" y="362" width="28" height="18" rx="5" fill={C.wood2} />
      <path d="M 214 452 C 220 486 222 520 236 552" stroke="#FFFFFF" strokeWidth="8" strokeLinecap="round" fill="none" opacity="0.12" />

      {/* 생과방 나인 셋 — 수군대다 입을 다문 */}
      <Glow ids={ids} cx={1230} cy={430} r={330} soft />
      <LadyStanding x={1112} y={604} s={0.92} tilt={12} />
      <LadyStanding x={1232} y={612} s={0.96} flip tilt={-4} />
      <LadyStanding x={1352} y={604} s={0.9} flip tilt={-14} />

      <Glow ids={ids} cx={1090} cy={300} r={700} soft />
      <Vignette ids={ids} />
    </SceneSvg>
  );
}

export const sceneSr: SceneArtDef = {
  key: 'scene-sr',
  Art: SceneSrArt,
  anchors: {
    'OB-SR1': [20, 64],
    'OB-SR2': [48, 31],
    'OB-SR3': [77, 64],
  },
  labels: {
    'OB-SR3': '생과방 나인',
  },
};
