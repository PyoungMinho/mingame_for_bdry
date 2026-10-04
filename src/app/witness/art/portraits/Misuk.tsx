/**
 * 방미숙(S3, 58) — 둥글고 넉넉한 어깨, 구름 모양 짧은 파마 + 새치 하이라이트, 둥근 얼굴, 눈가 주름 호 2개, 볼 홍조.
 * 크림 앞치마 + 틸 끈, 점무늬 블라우스. 소품: 국자.
 *  평소 = 앞치마에 양손 닦기, 눈이 호(웃음), 큰 미소 — 국자는 앞치마 주머니
 *  당황 = 접은 종이로 부채질, 땀 3, 홍조 진하게
 *  무너짐 = 주저앉음(머리 +40px 아래), 양손으로 볼, 눈 ∩∩, 입 「o」, 국자는 바닥
 * 금기: 우스꽝스러운 노인 희화 금지, 존중하는 톤(UI 스펙 6-3).
 */
import { HAIR, SKIN, SPK, useSvgIds } from '../palette';
import { Backlight, Blush, Brows, Eyes, lookOf, Mouth, PortraitDefs, PortraitSvg, Rim, show, Sparks, Sweat, Vein, type PortraitProps } from './parts';

const [SK, SKD] = SKIN.mid;
const BLOUSE = '#E4E9F2';
const BLOUSE_D = '#C2CADA';
const DOT = '#7C8DB0';
const APRON = '#F4E3C1';
const APRON_D = '#D9C49C';
const TEAL = '#2C7A7B';
const STEEL = '#C9D0DC';

const HEAD = 'M300 184C352 184 380 220 380 268C380 322 346 362 300 362C254 362 220 322 220 268C220 220 248 184 300 184Z';
const HEAD_SH = 'M300 184C352 184 380 220 380 268C380 322 346 362 300 362C330 340 348 306 348 266C348 224 330 198 300 184Z';
const HAIR_B =
  'M206 300C186 280 190 248 208 236C196 208 214 178 242 178C248 152 280 140 300 152C322 140 352 152 358 178C386 178 404 208 392 236C410 248 414 280 394 300C390 276 380 254 366 242C334 226 266 226 234 242C220 254 210 276 206 300Z';
const BODY = 'M300 378C240 378 190 392 164 422C140 450 132 510 126 600L118 800H482L474 600C468 510 460 450 436 422C410 392 360 378 300 378Z';

/** 국자 */
function Ladle({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r})`}>
      <rect x={-5} y={-110} width={10} height={110} rx={5} fill={STEEL} />
      <path d="M-4 -110q-6 -14 4 -18q10 4 4 18z" fill={STEEL} />
      <path d="M-26 0a26 20 0 0 0 52 0z" fill={STEEL} />
      <path d="M-26 0h52" stroke="#A7B0C0" strokeWidth={3} />
      <path d="M-16 6a16 10 0 0 0 20 6" stroke="#FFFFFF" strokeWidth={3} fill="none" opacity={0.6} />
    </g>
  );
}

export function MisukPortrait({ face = 'normal', smirk, crop, backlight = true, idle = true, title, decorative, idScope, className }: PortraitProps) {
  const ids = useSvgIds('p-s3', idScope);
  const k = lookOf(face, smirk);
  const sink = k.pose === 'break' ? 40 : 0;
  return (
    <PortraitSvg name="방미숙" face={face} crop={crop} idle={idle} title={title} decorative={decorative} className={className}>
      <PortraitDefs ids={ids} spk={SPK.S3} />
      <defs>
        <pattern id={ids.id('dots')} width="26" height="26" patternUnits="userSpaceOnUse">
          <circle cx="6" cy="6" r="3.2" fill={DOT} />
          <circle cx="19" cy="19" r="3.2" fill={DOT} />
        </pattern>
      </defs>
      <Backlight ids={ids} on={backlight} />
      <g className="wt-art-figure">
        <g transform={sink ? `translate(0 ${sink})` : undefined}>
        <g className="wt-art-breath">
          <Rim paths={[HAIR_B, HEAD, BODY]} />
          <path d={HAIR_B} fill={HAIR.brown} />
          {/* body — 점무늬 블라우스 + 앞치마 */}
          <path d={BODY} fill={BLOUSE} />
          <path d={BODY} fill={ids.url('dots')} opacity={0.55} />
          <path d="M436 422C460 450 468 510 474 600L482 800H418L422 600C424 510 418 456 400 414Z" fill={BLOUSE_D} opacity={0.75} />
          <path d="M262 382L300 420L338 382" stroke={BLOUSE_D} strokeWidth={8} fill="none" strokeLinejoin="round" />
          <path d="M282 334h36v52q-18 8 -36 0z" fill={SKD} />
          {/* 앞치마 */}
          <path d="M216 470H384L398 800H202Z" fill={APRON} />
          <path d="M350 470H384L398 800H360Z" fill={APRON_D} />
          <path d="M228 470L196 400M372 470L404 400" stroke={TEAL} strokeWidth={12} strokeLinecap="round" />
          <path d="M216 470H384" stroke={TEAL} strokeWidth={6} />
          <path d="M210 600H390" stroke={TEAL} strokeWidth={10} />
          <path d="M318 640h62v56q0 8 -8 8h-46q-8 0 -8 -8z" fill={APRON_D} />
          {/* head */}
          <path d={HEAD} fill={SK} />
          <path d={HEAD_SH} fill={SKD} opacity={0.7} />
          <path d="M300 288q-6 12 0 18" stroke={SKD} strokeWidth={3} fill="none" strokeLinecap="round" />

          {/* ── 포즈: 평소 — 앞치마에 양손 닦기, 국자는 주머니 ── */}
          <g data-part="pose-normal" display={show(k.pose === 'normal')}>
            <Ladle x={350} y={668} r={14} />
            <path d="M318 640h62v56q0 8 -8 8h-46q-8 0 -8 -8z" fill={APRON_D} />
            <path d="M318 640h62" stroke="#C4AE84" strokeWidth={3} />
            <path d="M160 460C142 540 150 600 196 640L260 632L256 596L214 596C196 570 196 520 206 468Z" fill={BLOUSE} />
            <path d="M160 460C142 540 150 600 196 640L260 632L256 596L214 596C196 570 196 520 206 468Z" fill={ids.url('dots')} opacity={0.5} />
            <path d="M440 460C458 540 450 600 404 640L340 632L344 596L386 596C404 570 404 520 394 468Z" fill={BLOUSE_D} />
            <path d="M160 460C142 540 150 600 196 640L260 632L256 596L214 596C196 570 196 520 206 468Z" fill="none" stroke="#A3ADC4" strokeWidth={3.5} strokeLinejoin="round" />
            <path d="M440 460C458 540 450 600 404 640L340 632L344 596L386 596C404 570 404 520 394 468Z" fill="none" stroke="#98A2B8" strokeWidth={3.5} strokeLinejoin="round" />
            <ellipse cx={268} cy={616} rx={30} ry={22} fill={SK} transform="rotate(-12 268 616)" />
            <ellipse cx={330} cy={622} rx={30} ry={22} fill={SKD} transform="rotate(12 330 622)" />
            <path d="M250 610q18 -6 34 4M314 616q16 -8 32 0" stroke={SKD} strokeWidth={2.5} fill="none" strokeLinecap="round" />
          </g>
          {/* ── 포즈: 당황 — 접은 종이로 부채질 ── */}
          <g data-part="pose-sweat" display={show(k.pose === 'sweat')}>
            <Ladle x={350} y={668} r={14} />
            <path d="M318 640h62v56q0 8 -8 8h-46q-8 0 -8 -8z" fill={APRON_D} />
            <path d="M200 470C186 560 190 680 196 800" stroke="#A9B2C6" strokeWidth={4} fill="none" />
            <path d="M444 470C470 420 470 380 448 352L408 372C422 400 420 432 400 470Z" fill={BLOUSE_D} />
            <path d="M440 470C452 540 446 600 420 640L392 624C410 590 412 530 404 474Z" fill={BLOUSE_D} />
            <ellipse cx={430} cy={352} rx={24} ry={22} fill={SKD} />
            <path d="M418 340l70 -76l20 14l-60 82z" fill="#F4F1EA" />
            <path d="M432 330l60 -62M444 340l58 -60" stroke="#D2CBBE" strokeWidth={3} />
            <path d="M518 250q10 12 4 26M530 236q16 18 6 40" stroke="#FFFFFF" strokeWidth={3} opacity={0.45} fill="none" strokeLinecap="round" />
          </g>
          {/* ── 포즈: 무너짐 — 양손으로 볼 ── */}
          <g data-part="pose-break" display={show(k.pose === 'break')}>
            <path d="M150 520C136 440 160 370 210 330L240 352C204 388 192 444 198 520Z" fill={BLOUSE} />
            <path d="M150 520C136 440 160 370 210 330L240 352C204 388 192 444 198 520Z" fill={ids.url('dots')} opacity={0.5} />
            <path d="M450 520C464 440 440 370 390 330L360 352C396 388 408 444 402 520Z" fill={BLOUSE_D} />
            <ellipse cx={228} cy={318} rx={26} ry={34} fill={SK} />
            <ellipse cx={372} cy={318} rx={26} ry={34} fill={SKD} />
            <path d="M216 300v30M230 296v34M386 300v30M372 296v34" stroke={SKD} strokeWidth={2.5} strokeLinecap="round" />
          </g>

          {/* ── 이목구비 ── */}
          <g data-part="face-normal" display={show(k.feat === 'normal')}>
            <Brows kind="soft" c={HAIR.brown} w={5} />
            <Eyes kind="arc" />
            <Mouth kind="grin" dy={2} />
          </g>
          <g data-part="face-sweat" display={show(k.feat === 'sweat')}>
            <Brows kind="worry" c={HAIR.brown} w={5} />
            <Eyes kind="dot" />
            <Mouth kind="open" dy={2} />
          </g>
          <g data-part="face-shock" display={show(k.feat === 'shock')}>
            <Brows kind="raise" dy={-6} c={HAIR.brown} w={5} />
            <Eyes kind="wide" />
            <Mouth kind="o" />
          </g>
          <g data-part="face-angry" display={show(k.feat === 'angry')}>
            <Brows kind="angry" c={HAIR.brown} w={6} />
            <Eyes kind="dot" />
            <Mouth kind="line" dy={2} />
          </g>
          <g data-part="face-smirk" display={show(k.feat === 'smirk')}>
            <Brows kind="oneup" c={HAIR.brown} w={5} />
            <Eyes kind="half" />
            <Mouth kind="smirk" />
          </g>
          <g data-part="face-break" display={show(k.feat === 'break')}>
            <Brows kind="worry" c={HAIR.brown} w={5} />
            <path d="M248 262q14 -16 28 0M324 262q14 -16 28 0" stroke="#2A1E1E" strokeWidth={5} fill="none" strokeLinecap="round" />
            <Mouth kind="o" dy={4} />
          </g>
          {/* 눈가 주름 호 2 + 홍조 */}
          <path d="M232 250q-6 8 -2 16M368 250q6 8 2 16" stroke={SKD} strokeWidth={3} fill="none" strokeLinecap="round" />
          <Blush o={k.pose === 'sweat' ? 0.6 : 0.38} r={18} />

          {/* hair-front — 파마 앞머리 + 새치 */}
          <path d="M232 214C234 190 252 176 272 180C278 166 298 162 310 172C324 164 346 168 352 184C368 184 378 198 376 216C364 206 348 204 336 208C324 200 306 200 298 208C284 200 266 202 256 210C248 208 240 210 232 214Z" fill={HAIR.brown} />
          <path d="M248 190q10 -10 22 -6M292 176q12 -6 24 0M340 180q12 0 20 10M222 176q8 -12 20 -12M364 172q12 2 18 14M204 262q-6 -10 0 -20M398 262q6 -10 0 -20" stroke={HAIR.grayHi} strokeWidth={3.5} fill="none" strokeLinecap="round" opacity={0.85} />

          <g display={show(k.feat === 'sweat' || k.feat === 'shock')}>
            <Sweat x={392} y={226} />
            <Sweat x={214} y={232} s={0.8} />
            <Sweat x={378} y={312} s={0.7} />
          </g>
          <Sparks on={k.spark} />
          <Vein on={k.vein} />
        </g>
        </g>
      </g>
      {/* 무너짐: 국자는 바닥에(몸 앞) */}
      <g display={show(k.pose === 'break')}>
        <ellipse cx={470} cy={784} rx={66} ry={8} fill="#000" opacity={0.4} />
        <Ladle x={480} y={776} r={-80} />
      </g>
    </PortraitSvg>
  );
}
