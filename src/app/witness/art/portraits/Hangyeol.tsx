/**
 * 나한결 순경(COP, 25) — 둥근 얼굴, 큰 눈, 짧고 단정한 머리, 약간 큰 네이비 제복, 어깨 무전기(단순 직사각),
 * 가슴 계급장은 추상 도형(원 + 가로선). 실제 경찰 휘장·모자·엠블럼 모사 금지. 소품: 수첩 + 펜.
 *  평소 = 밝은 미소, 눈 반짝, 수첩에 받아 적기
 *  당황 = 눈썹 처짐, 입 일자
 *  무너짐 = 울상(눈 ㅠ), 수첩을 꼭 안음, 어깨 움츠림
 *
 * 신뢰도 5단계(HUD 아바타와 공용, UI 스펙 6-4) — `trust` 를 주면 face 보다 우선:
 *  5 평소 · 4 평소 + 땀 1 · 3 당황 · 2 당황 + 식은땀 3 + 눈 흔들림 · 1 무너짐 · 0 (엔딩 키아트 — 여기선 무너짐)
 */
import { HAIR, SKIN, SPK, useSvgIds } from '../palette';
import type { ArtFace } from './parts';
import { Backlight, Blush, Brows, Eyes, lookOf, Mouth, PortraitDefs, PortraitSvg, Rim, show, Sparks, Sweat, Vein, type PortraitProps } from './parts';

const [SK, SKD] = SKIN.light;
const NAVY = '#243A6B';
const NAVY_D = '#182A52';
const NAVY_L = '#2F4A84';
const SHIRT = '#DCE6F5';
const NOTE = '#F2EEE4';

const HEAD = 'M300 184C352 184 378 222 378 270C378 324 344 364 300 364C256 364 222 324 222 270C222 222 248 184 300 184Z';
const HEAD_SH = 'M300 184C352 184 378 222 378 270C378 324 344 364 300 364C330 342 346 308 346 268C346 226 330 198 300 184Z';
const HAIR_B = 'M220 266C210 206 244 164 300 162C358 164 392 206 380 266C376 240 368 222 354 212C322 202 278 202 246 212C232 222 224 240 220 266Z';
const BODY = 'M300 380C238 380 188 392 162 418C140 440 132 500 128 590L120 800H480L472 590C468 500 460 440 438 418C412 392 362 380 300 380Z';

export type TrustLevel = 0 | 1 | 2 | 3 | 4 | 5;

/** 신뢰도 → 그림 표정 + 덧그림(HUD 아바타도 같은 규칙) */
export function hangyeolLook(trust: TrustLevel): { face: ArtFace; drops: 0 | 1 | 3; shake: boolean } {
  if (trust >= 5) return { face: 'normal', drops: 0, shake: false };
  if (trust === 4) return { face: 'normal', drops: 1, shake: false };
  if (trust === 3) return { face: 'sweat', drops: 0, shake: false };
  if (trust === 2) return { face: 'sweat', drops: 3, shake: true };
  return { face: 'break', drops: 0, shake: false };
}

function Notebook({ x, y, r = 0, open = true }: { x: number; y: number; r?: number; open?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r})`}>
      <rect x={-52} y={-64} width={104} height={128} rx={6} fill="#2C3E66" />
      {open && <rect x={-46} y={-58} width={92} height={116} rx={3} fill={NOTE} />}
      {open && <path d="M-36 -40h66M-36 -26h56M-36 -12h62M-36 2h44" stroke="#9AA6BE" strokeWidth={3} strokeLinecap="round" />}
      <path d="M-52 -54h-6M-52 -34h-6M-52 -14h-6M-52 6h-6M-52 26h-6M-52 46h-6" stroke="#C9D0DC" strokeWidth={4} strokeLinecap="round" />
    </g>
  );
}

export function HangyeolPortrait({ face = 'normal', smirk, crop, backlight = true, idle = true, title, decorative, idScope, className, trust }: PortraitProps & { trust?: TrustLevel }) {
  const ids = useSvgIds('p-cop', idScope);
  const t = trust === undefined ? null : hangyeolLook(trust);
  const f: ArtFace = t ? t.face : face;
  const k = lookOf(f, smirk);
  const drops = t ? t.drops : k.feat === 'sweat' || k.feat === 'shock' ? 1 : 0;
  return (
    <PortraitSvg name="한결" face={f} crop={crop} idle={idle} title={title} decorative={decorative} className={className}>
      <PortraitDefs ids={ids} spk={SPK.COP} />
      <Backlight ids={ids} on={backlight} />
      <g className="wt-art-figure">
        <g className="wt-art-breath">
          <Rim paths={[HAIR_B, HEAD, BODY]} />
          <path d={HAIR_B} fill={HAIR.black} />
          {/* body — 약간 큰 네이비 제복 */}
          <path d={BODY} fill={NAVY} />
          <path d="M438 418C460 440 468 500 472 590L480 800H418L422 590C424 500 418 446 402 410Z" fill={NAVY_D} />
          <path d="M262 384L300 446L338 384C326 380 312 380 300 380C288 380 274 380 262 384Z" fill={SHIRT} />
          <path d="M280 338h40v50q-20 8 -40 0z" fill={SKD} />
          <path d="M264 384L300 446L284 456L252 396ZM336 384L300 446L316 456L348 396Z" fill={NAVY_L} />
          <path d="M300 446V800" stroke={NAVY_D} strokeWidth={4} />
          <circle cx={300} cy={500} r={5} fill="#C9D0DC" />
          <circle cx={300} cy={580} r={5} fill="#C9D0DC" />
          <circle cx={300} cy={660} r={5} fill="#C9D0DC" />
          {/* 견장(단순 띠) · 어깨 무전기 */}
          <path d="M170 420l60 -20" stroke={NAVY_L} strokeWidth={14} strokeLinecap="round" />
          <path d="M430 420l-60 -20" stroke={NAVY_D} strokeWidth={14} strokeLinecap="round" />
          <rect x={194} y={396} width={34} height={54} rx={6} fill="#14171F" transform="rotate(-14 211 423)" />
          <rect x={204} y={384} width={6} height={18} rx={3} fill="#14171F" transform="rotate(-14 207 393)" />
          <circle cx={214} cy={420} r={3} fill="#5BE3A0" />
          {/* 가슴 계급장 — 추상 도형(원 + 가로선) */}
          <circle cx={372} cy={490} r={13} fill="none" stroke="#E6D9A8" strokeWidth={4} />
          <path d="M352 516h40" stroke="#E6D9A8" strokeWidth={5} strokeLinecap="round" />
          <rect x={210} y={480} width={46} height={12} rx={3} fill="#E6EAF2" opacity={0.8} />
          {/* head */}
          <ellipse cx={224} cy={276} rx={12} ry={18} fill={SK} />
          <ellipse cx={376} cy={276} rx={12} ry={18} fill={SKD} />
          <path d={HEAD} fill={SK} />
          <path d={HEAD_SH} fill={SKD} opacity={0.7} />
          <path d="M300 292q-4 8 2 12" stroke={SKD} strokeWidth={3} fill="none" strokeLinecap="round" />

          {/* ── 포즈: 평소·당황 — 수첩 + 펜 ── */}
          <g data-part="pose-normal" display={show(k.pose === 'normal' || k.pose === 'sweat')}>
            <path d="M162 440C146 520 150 590 190 640L234 620C206 586 200 530 208 446Z" fill={NAVY} />
            <path d="M208 446C200 530 206 586 234 620" stroke={NAVY_D} strokeWidth={4} fill="none" />
            <path d="M438 440C454 520 446 580 408 616L366 596C394 566 400 520 392 446Z" fill={NAVY_D} />
            <g transform={k.pose === 'sweat' ? 'translate(0 26)' : undefined}>
              <Notebook x={262} y={600} r={-8} />
              <ellipse cx={226} cy={628} rx={22} ry={18} fill={SK} />
              <path d="M330 560l58 40" stroke="#1C2236" strokeWidth={8} strokeLinecap="round" />
              <path d="M326 556l8 6" stroke="#C9D0DC" strokeWidth={8} strokeLinecap="round" />
              <ellipse cx={378} cy={600} rx={22} ry={18} fill={SKD} />
            </g>
          </g>
          {/* ── 포즈: 무너짐 — 수첩을 꼭 안음, 어깨 움츠림 ── */}
          <g data-part="pose-break" display={show(k.pose === 'break')}>
            <path d="M162 430C150 400 190 380 236 386L232 420C206 418 186 424 162 430ZM438 430C450 400 410 380 364 386L368 420C394 418 414 424 438 430Z" fill={NAVY_L} />
            <Notebook x={300} y={560} r={0} open={false} />
            <path d="M160 470C150 540 168 600 220 620L330 604L326 566L230 576C206 556 200 520 206 476Z" fill={NAVY} />
            <path d="M440 470C450 540 432 600 380 620L272 610L276 572L370 576C394 556 400 520 394 476Z" fill={NAVY_D} />
            <ellipse cx={330} cy={584} rx={22} ry={18} fill={SK} />
            <ellipse cx={272} cy={590} rx={22} ry={18} fill={SKD} />
          </g>

          {/* ── 이목구비 ── */}
          <g data-part="face-normal" display={show(k.feat === 'normal')}>
            <Brows kind="soft" dy={-4} c={HAIR.black} w={5} />
            <Eyes kind="big" sparkle />
            <Mouth kind="grin" dy={4} />
          </g>
          <g data-part="face-sweat" display={show(k.feat === 'sweat')}>
            <Brows kind="worry" c={HAIR.black} w={5} />
            <Eyes kind={t?.shake ? 'shake' : 'big'} />
            <Mouth kind="line" dy={4} />
          </g>
          <g data-part="face-shock" display={show(k.feat === 'shock')}>
            <Brows kind="raise" dy={-8} c={HAIR.black} w={5} />
            <Eyes kind="wide" />
            <Mouth kind="o" dy={2} />
          </g>
          <g data-part="face-angry" display={show(k.feat === 'angry')}>
            <Brows kind="angry" c={HAIR.black} w={6} />
            <Eyes kind="big" />
            <Mouth kind="down" dy={4} />
          </g>
          <g data-part="face-smirk" display={show(k.feat === 'smirk')}>
            <Brows kind="oneup" c={HAIR.black} w={5} />
            <Eyes kind="half" />
            <Mouth kind="smirk" dy={2} />
          </g>
          <g data-part="face-break" display={show(k.feat === 'break')}>
            <Brows kind="worry" dy={2} c={HAIR.black} w={5} />
            <Eyes kind="tear" />
            <Mouth kind="wave" dy={6} />
          </g>
          <Blush o={0.3} dy={4} />

          {/* hair-front — 짧고 단정한 앞머리 */}
          <path d="M226 228C232 196 262 178 300 178C338 178 368 196 374 228C356 214 336 208 316 210L306 222L294 210C272 208 246 214 226 228Z" fill={HAIR.black} />
          <path d="M252 194q40 -16 88 0" stroke="#3A3A4C" strokeWidth={4} fill="none" strokeLinecap="round" />

          <g display={show(drops >= 1)}>
            <Sweat x={390} y={232} />
          </g>
          <g display={show(drops >= 3)}>
            <Sweat x={212} y={236} s={0.8} />
            <Sweat x={392} y={300} s={0.7} />
          </g>
          <Sparks on={k.spark} />
          <Vein on={k.vein} />
        </g>
      </g>
    </PortraitSvg>
  );
}
