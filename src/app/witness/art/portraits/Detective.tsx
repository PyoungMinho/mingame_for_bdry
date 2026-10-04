/**
 * 나(탐정) — 얼굴 없는 트렌치코트 실루엣(옷깃 세움, 3/4 뒷모습). 성별·나이를 정하지 않는다(1인칭).
 * 사건 소개 컷과 독백 아바타에만 쓴다. 표정 없음(face 무시).
 */
import { RIM, useSvgIds } from '../palette';
import { Backlight, PortraitDefs, PortraitSvg, type PortraitProps } from './parts';

const COAT = '#3A3328';
const COAT_D = '#2A251D';
const COAT_L = '#4C4334';
const SIL = 'M300 160C350 160 376 200 374 250C372 290 360 318 346 336L352 372C406 380 452 404 470 440C490 480 494 560 498 640L504 800H96L102 640C106 560 110 480 130 440C148 404 194 380 248 372L254 336C240 318 228 290 226 250C224 200 250 160 300 160Z';

export function DetectivePortrait({ crop, backlight = true, idle = true, title, decorative, idScope, className }: PortraitProps) {
  const ids = useSvgIds('p-me', idScope);
  return (
    <PortraitSvg name="나" face="normal" crop={crop} idle={idle} title={title} decorative={decorative} className={className}>
      <PortraitDefs ids={ids} spk="#EAF1FF" />
      <Backlight ids={ids} on={backlight} />
      <g className="wt-art-breath">
        <path d={SIL} fill={RIM} opacity={0.55} transform="translate(6 0)" />
        <path d={SIL} fill="#141824" />
        {/* 머리 뒤통수(그림자 덩어리) */}
        <path d="M300 160C350 160 376 200 374 250C372 290 360 318 346 336C330 346 270 346 254 336C240 318 228 290 226 250C224 200 250 160 300 160Z" fill="#1E2230" />
        <path d="M330 168C356 180 372 210 372 250" stroke="#2C3244" strokeWidth={10} fill="none" strokeLinecap="round" />
        {/* 코트 */}
        <path d="M130 440C148 404 194 380 248 372L300 420L352 372C406 380 452 404 470 440C490 480 494 560 498 640L504 800H96L102 640C106 560 110 480 130 440Z" fill={COAT} />
        <path d="M470 440C490 480 494 560 498 640L504 800H420L424 640C424 540 416 470 400 410Z" fill={COAT_D} />
        {/* 세운 옷깃 */}
        <path d="M236 330L300 420L248 392L214 372Z" fill={COAT_L} />
        <path d="M364 330L300 420L352 392L386 372Z" fill={COAT_D} />
        <path d="M236 330L254 300L300 420ZM364 330L346 300L300 420Z" fill={COAT_L} opacity={0.9} />
        {/* 벨트 · 등 주름 */}
        <path d="M118 600H482" stroke={COAT_D} strokeWidth={22} />
        <rect x={278} y={588} width={44} height={24} rx={4} fill="none" stroke="#8A7A5A" strokeWidth={4} />
        <path d="M300 612V800M250 640l-10 160M350 640l10 160" stroke={COAT_D} strokeWidth={4} />
        <path d="M150 470C140 540 136 620 132 700" stroke={COAT_L} strokeWidth={4} fill="none" opacity={0.7} />
      </g>
    </PortraitSvg>
  );
}
