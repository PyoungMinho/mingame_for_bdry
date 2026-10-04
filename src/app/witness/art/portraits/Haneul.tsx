/**
 * 백하늘(S2, 26) — 보통 체형, 오버사이즈 상의로 어깨가 넓어 보임. 턱선 단발 + 옆 가르마 앞머리, 갸름한 타원 얼굴,
 * 귀에 무선 이어버드 한 짝. 베이지 가디건 + 검정 티, 손목에 검정 머리끈. 소품: 원고지 몇 장 + 펜.
 *  평소 = 반쯤 감긴 눈, 입꼬리 내림, 턱 괴기(시큰둥)
 *  당황 = 머리끈을 늘이며 만지작, 눈동자 옆으로, 땀 1
 *  무너짐 = 눈을 감고 원고지 3장이 흩날림, 입 일자(눈물 없음 — 건조한 인물)
 */
import { HAIR, SKIN, SPK, useSvgIds } from '../palette';
import { Backlight, Blush, Brows, Eyes, lookOf, Mouth, PortraitDefs, PortraitSvg, Rim, show, Sparks, Sweat, Vein, type PortraitProps } from './parts';

const [SK, SKD] = SKIN.light;
const CARD = '#D9C6A5';
const CARD_D = '#B5A07F';
const CARD_L = '#E8DAC0';
const TEE = '#1F1F28';
const PAPER = '#F4F1EA';

const HEAD = 'M300 182C346 182 370 216 370 260C370 316 340 360 300 362C260 360 230 316 230 260C230 216 254 182 300 182Z';
const HEAD_SH = 'M300 182C346 182 370 216 370 260C370 316 340 360 300 362C328 340 340 304 340 260C340 220 326 194 300 182Z';
const HAIR_B =
  'M212 304C200 222 238 160 300 158C364 160 400 222 388 304C386 334 384 356 378 370L352 366C364 326 366 284 358 244C336 224 266 220 242 242C234 280 236 326 248 366L222 370C216 356 214 334 212 304Z';
const BODY = 'M300 380C250 380 204 390 178 414C156 434 144 474 138 544L126 800H474L462 544C456 474 444 434 422 414C396 390 350 380 300 380Z';

/** 원고지 한 장(격자 줄 — 글자 없음) */
function Page({ x, y, r, s = 1 }: { x: number; y: number; r: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
      <rect x={-34} y={-44} width={68} height={88} rx={2} fill={PAPER} />
      <path d="M-26 -34h52M-26 -22h52M-26 -10h52M-26 2h52M-26 14h52M-26 26h52M-16 -38v72M-4 -38v72M8 -38v72M20 -38v72" stroke="#9FB2C8" strokeWidth={1.4} opacity={0.7} />
      <rect x={-34} y={-44} width={68} height={88} rx={2} fill="none" stroke="#D8D2C4" strokeWidth={2} />
    </g>
  );
}

export function HaneulPortrait({ face = 'normal', smirk, crop, backlight = true, idle = true, title, decorative, idScope, className }: PortraitProps) {
  const ids = useSvgIds('p-s2', idScope);
  const k = lookOf(face, smirk);
  return (
    <PortraitSvg name="백하늘" face={face} crop={crop} idle={idle} title={title} decorative={decorative} className={className}>
      <PortraitDefs ids={ids} spk={SPK.S2} />
      <Backlight ids={ids} on={backlight} />
      <g className="wt-art-figure">
        <g className="wt-art-breath">
          <Rim paths={[HAIR_B, HEAD, BODY]} />
          <path d={HAIR_B} fill={HAIR.black} />
          {/* body — 오버사이즈 가디건 + 검정 티 */}
          <path d={BODY} fill={CARD} />
          <path d="M422 414C444 434 456 474 462 544L474 800H414L420 544C422 480 414 440 398 406Z" fill={CARD_D} />
          <path d="M262 386L300 476L338 386C326 382 312 380 300 380C288 380 274 382 262 386Z" fill={TEE} />
          <path d="M262 386L300 476L300 800H248C250 640 254 500 262 386Z" fill={TEE} />
          <path d="M338 386L300 476L300 800H352C350 640 346 500 338 386Z" fill={TEE} />
          <path d="M262 386C254 500 250 640 248 800M338 386C346 500 350 640 352 800" stroke={CARD_L} strokeWidth={10} fill="none" />
          <path d="M266 386C274 410 288 424 300 430C312 424 326 410 334 386" stroke="#2C2C38" strokeWidth={6} fill="none" />
          <path d="M280 336h40v54q-20 8 -40 0z" fill={SKD} />
          {/* head */}
          <path d={HEAD} fill={SK} />
          <path d={HEAD_SH} fill={SKD} opacity={0.7} />
          <path d="M300 290l-4 14h7" stroke={SKD} strokeWidth={3} fill="none" strokeLinecap="round" />

          {/* ── 포즈: 평소 — 턱 괴기, 다른 손엔 원고지 + 펜 ── */}
          <g data-part="pose-normal" display={show(k.pose === 'normal')}>
            <path d="M432 452C446 540 440 620 420 690L384 680C398 610 400 540 392 458Z" fill={CARD_D} />
            <path d="M392 458C400 540 398 610 384 680" stroke="#9C8868" strokeWidth={4} fill="none" />
            <rect x={380} y={664} width={44} height={12} rx={5} fill="#14141C" transform="rotate(8 402 670)" />
            <Page x={430} y={716} r={10} />
            <path d="M398 690l52 -44" stroke="#2A3550" strokeWidth={6} strokeLinecap="round" />
            <ellipse cx={404} cy={698} rx={22} ry={18} fill={SKD} />
            <path d="M168 456C158 530 168 600 210 652L254 632C226 592 214 532 218 460Z" fill={CARD} />
            <path d="M218 460C214 532 226 592 254 632" stroke={CARD_D} strokeWidth={4} fill="none" />
            <path d="M210 652C228 560 252 470 278 398L320 410C298 482 276 570 256 640C246 662 216 668 210 652Z" fill={CARD} />
            <path d="M210 652C228 560 252 470 278 398M320 410C298 482 276 570 256 640" stroke={CARD_D} strokeWidth={4} fill="none" />
            <path d="M276 402l46 12" stroke={CARD_L} strokeWidth={14} strokeLinecap="round" />
            <path d="M270 390C266 368 284 356 302 358C320 360 330 376 324 394C318 408 278 410 270 390Z" fill={SK} />
            <path d="M280 372q10 -6 20 0M284 384q8 -4 16 0" stroke={SKD} strokeWidth={2.5} fill="none" strokeLinecap="round" />
          </g>
          {/* ── 포즈: 당황 — 머리끈 늘이며 만지작 ── */}
          <g data-part="pose-sweat" display={show(k.pose === 'sweat')}>
            <path d="M168 452C150 540 166 612 214 642L264 630L260 592L228 594C206 568 204 520 216 458Z" fill={CARD} />
            <path d="M216 458C204 520 206 568 228 594" stroke={CARD_D} strokeWidth={4} fill="none" />
            <path d="M432 452C450 540 434 612 386 642L336 630L340 592L372 594C394 568 396 520 384 458Z" fill={CARD_D} />
            <path d="M384 458C396 520 394 568 372 594" stroke="#9C8868" strokeWidth={4} fill="none" />
            <ellipse cx={264} cy={612} rx={24} ry={20} fill={SK} />
            <ellipse cx={336} cy={612} rx={24} ry={20} fill={SKD} />
            <path d="M270 604C290 590 310 590 330 604" stroke="#14141C" strokeWidth={6} fill="none" strokeLinecap="round" />
            <path d="M270 620C290 634 310 634 330 620" stroke="#14141C" strokeWidth={6} fill="none" strokeLinecap="round" />
          </g>
          {/* ── 포즈: 무너짐 — 원고지 3장이 흩날림 ── */}
          <g data-part="pose-break" display={show(k.pose === 'break')}>
            <path d="M200 456C190 560 190 680 196 800M400 456C410 560 410 680 404 800" stroke={CARD_D} strokeWidth={5} fill="none" />
            <Page x={150} y={300} r={-24} s={0.9} />
            <Page x={458} y={250} r={18} s={0.85} />
            <Page x={430} y={520} r={-12} s={0.95} />
            <path d="M118 360q-14 10 -6 24M496 300q14 6 8 22M470 590q10 10 2 22" stroke="#FFFFFF" strokeWidth={3} opacity={0.4} fill="none" strokeLinecap="round" />
          </g>

          {/* ── 이목구비 ── */}
          <g data-part="face-normal" display={show(k.feat === 'normal')}>
            <Brows kind="flat" dy={2} c={HAIR.black} w={5} />
            <Eyes kind="half" />
            <Mouth kind="down" />
          </g>
          <g data-part="face-sweat" display={show(k.feat === 'sweat')}>
            <Brows kind="worry" c={HAIR.black} w={5} />
            <Eyes kind="side" />
            <Mouth kind="line" />
          </g>
          <g data-part="face-shock" display={show(k.feat === 'shock')}>
            <Brows kind="raise" dy={-6} c={HAIR.black} w={5} />
            <Eyes kind="wide" />
            <Mouth kind="o" />
          </g>
          <g data-part="face-angry" display={show(k.feat === 'angry')}>
            <Brows kind="angry" c={HAIR.black} w={6} />
            <Eyes kind="half" />
            <Mouth kind="line" dy={2} />
          </g>
          <g data-part="face-smirk" display={show(k.feat === 'smirk')}>
            <Brows kind="oneup" c={HAIR.black} w={5} />
            <Eyes kind="half" />
            <Mouth kind="smirk" />
          </g>
          <g data-part="face-break" display={show(k.feat === 'break')}>
            <Brows kind="soft" dy={4} c={HAIR.black} w={5} />
            <Eyes kind="closed" dy={2} />
            <Mouth kind="line" dy={2} />
          </g>
          <Blush o={0.16} />

          {/* hair-front — 옆 가르마 앞머리 + 이어버드 */}
          <path d="M268 186C306 176 356 190 372 244C356 230 334 224 314 226C296 232 278 244 258 252C268 236 272 208 268 186Z" fill={HAIR.black} />
          <path d="M268 186C246 194 232 214 230 242C240 228 252 216 266 210Z" fill={HAIR.black} />
          <path d="M282 196q40 -6 70 24" stroke="#3A3A4C" strokeWidth={4} fill="none" strokeLinecap="round" />
          <g>
            <ellipse cx={234} cy={290} rx={9} ry={11} fill="#F4F6FA" />
            <rect x={229} y={296} width={8} height={22} rx={4} fill="#E2E6EE" />
          </g>

          <g display={show(k.feat === 'sweat')}>
            <Sweat x={384} y={226} />
          </g>
          <Sparks on={k.spark} />
          <Vein on={k.vein} x={350} y={214} />
        </g>
      </g>
    </PortraitSvg>
  );
}
