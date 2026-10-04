/**
 * 선우강(S1, 49) — 키 크고 마른 체형, 후드로 어깨가 처짐. 새치 섞인 헝클어진 짧은 머리(뾰족한 가닥 2~3),
 * 각진 얼굴 + 수염 그림자, 무테 사각 안경. 회색 후드티 + 흰 후드 끈, 목에 이어폰 선. 소품: 무늬 없는 커피 머그.
 *  평소 = 팔짱 + 머그, 입 한쪽 살짝 올림, 안경 사선 글린트
 *  당황 = 안경을 벗어 닦는 손, 눈 감김, 땀 1
 *  무너짐 = 후드를 뒤집어써 이마를 가림, 눈 ㅡㅡ, 입 물결, 어깨 움츠림
 * 금기: 「수상한 해커」 클리셰 과장 금지(UI 스펙 6-3).
 */
import { HAIR, RIM, SKIN, SPK, useSvgIds } from '../palette';
import { Backlight, Blush, Brows, Eyes, lookOf, Mouth, PortraitDefs, PortraitSvg, Rim, show, Sparks, Sweat, Vein, type PortraitProps } from './parts';

const [SK, SKD] = SKIN.light;
const HOOD = '#7F8AA3';
const HOOD_D = '#5D6780';
const HOOD_L = '#95A0B8';

const HEAD = 'M300 176C350 176 374 210 374 256L370 316C362 348 332 366 300 366C268 366 238 348 230 316L226 256C226 210 250 176 300 176Z';
const HEAD_SH = 'M300 176C350 176 374 210 374 256L370 316C362 348 332 366 300 366C326 344 342 304 342 258C342 214 328 188 300 176Z';
const HAIR_B =
  'M224 266C212 226 218 192 240 176L248 146L268 160C272 154 278 151 286 150L296 118L310 148C326 148 340 152 352 160L374 140L368 178C386 198 390 232 380 266C374 238 364 218 350 208C330 200 272 200 250 208C236 218 228 238 224 266Z';
const BODY = 'M300 380C250 380 212 394 184 422C158 448 146 500 138 590L126 800H474L462 590C454 500 442 448 416 422C388 394 350 380 300 380Z';
const HOOD_UP =
  'M194 334C184 222 230 146 300 142C370 146 416 222 406 334C404 388 376 420 300 422C224 420 196 388 194 334ZM246 282C246 248 268 236 300 236C332 236 354 248 354 282L352 330C346 354 328 368 300 368C272 368 254 354 248 330Z';

function Glasses({ glint = true }: { glint?: boolean }) {
  return (
    <g>
      <path d="M234 240h56v36h-56zM310 240h56v36h-56z" fill="#BFE8FF" fillOpacity={0.12} stroke="#DDE6F4" strokeOpacity={0.85} strokeWidth={3} strokeLinejoin="round" />
      <path d="M290 254q10 -6 20 0M234 250l-10 3M366 250l10 3" stroke="#DDE6F4" strokeWidth={3} fill="none" strokeLinecap="round" />
      {glint && <path d="M244 272l22 -28M256 272l12 -16" stroke="#FFFFFF" strokeWidth={4} strokeLinecap="round" opacity={0.75} />}
    </g>
  );
}

export function SungangPortrait({ face = 'normal', smirk, crop, backlight = true, idle = true, title, decorative, idScope, className }: PortraitProps) {
  const ids = useSvgIds('p-s1', idScope);
  const k = lookOf(face, smirk);
  const glassesOn = k.pose !== 'sweat';
  return (
    <PortraitSvg name="선우강" face={face} crop={crop} idle={idle} title={title} decorative={decorative} className={className}>
      <PortraitDefs ids={ids} spk={SPK.S1} />
      <Backlight ids={ids} on={backlight} />
      <g className="wt-art-figure">
        <g className="wt-art-breath">
          <Rim paths={k.pose === 'break' ? [HEAD, BODY] : [HAIR_B, HEAD, BODY]} />
          <path d={HAIR_B} fill={HAIR.gray} display={show(k.pose !== 'break')} />
          {/* body — 후드티 */}
          <path d={BODY} fill={HOOD} />
          <path d="M416 422C442 448 454 500 462 590L474 800H410L414 590C416 504 406 452 384 412Z" fill={HOOD_D} />
          <path d="M228 410C240 372 270 358 300 358C330 358 360 372 372 410C352 398 328 392 300 392C272 392 248 398 228 410Z" fill={HOOD_L} />
          <path d="M228 410C248 398 272 392 300 392C328 392 352 398 372 410" stroke={HOOD_D} strokeWidth={4} fill="none" />
          <path d="M276 334h48v62q-24 10 -48 0z" fill={SKD} />
          <path d="M262 376C266 410 286 426 300 430C314 426 334 410 338 376M300 430V478" stroke="#F4F6FA" strokeWidth={2.5} fill="none" opacity={0.85} />
          <path d="M284 398L278 500M316 398L322 500" stroke="#F4F6FA" strokeWidth={5} strokeLinecap="round" />
          <path d="M274 498h8v14h-8zM318 498h8v14h-8z" fill="#C9CFDC" />
          {/* head */}
          <ellipse cx={228} cy={270} rx={12} ry={20} fill={SK} />
          <ellipse cx={372} cy={270} rx={12} ry={20} fill={SKD} />
          <path d={HEAD} fill={SK} />
          <path d={HEAD_SH} fill={SKD} opacity={0.75} />
          <path d="M236 300C244 344 270 364 300 364C330 364 356 344 364 300C352 332 330 350 300 350C270 350 248 332 236 300Z" fill="#5E5A6C" opacity={0.28} />
          <path d="M300 286l-6 18h10" stroke={SKD} strokeWidth={3} fill="none" strokeLinecap="round" />

          {/* ── 포즈: 평소 — 한 팔을 허리에 걸치고 다른 손에 머그 ── */}
          <g data-part="pose-normal" display={show(k.pose === 'normal')}>
            <path d="M194 498C190 560 196 600 214 626" stroke={HOOD_D} strokeWidth={4} fill="none" />
            <path d="M456 500C466 560 456 610 430 640L398 626C414 590 418 548 410 500Z" fill={HOOD_D} />
            <path d="M178 594C240 604 330 614 418 616L422 664C330 666 240 656 176 646C152 640 150 600 178 594Z" fill={HOOD_L} />
            <path d="M168 598C240 606 330 614 418 616" stroke="#B4BDD0" strokeWidth={3} fill="none" />
            <path d="M176 646C240 656 330 666 422 664" stroke={HOOD_D} strokeWidth={3} fill="none" />
            <ellipse cx={414} cy={640} rx={20} ry={18} fill={SKD} />
            <path d="M432 640C424 588 404 536 384 504L346 520C364 552 382 598 392 640Z" fill={HOOD} />
            <path d="M346 520C364 552 382 598 392 640" stroke={HOOD_D} strokeWidth={4} fill="none" />
            <path d="M386 500l-42 18" stroke={HOOD_D} strokeWidth={10} strokeLinecap="round" />
            {/* 머그(무늬 없음) */}
            <path d="M338 444h52v58q0 12 -12 12h-28q-12 0 -12 -12z" fill="#E9E4DA" />
            <path d="M372 444h18v58q0 12 -12 12h-6z" fill="#C9C2B4" />
            <path d="M338 458q-20 0 -20 18t20 18" stroke="#C9C2B4" strokeWidth={7} fill="none" />
            <ellipse cx={364} cy={445} rx={26} ry={6} fill="#4A2E22" />
            <ellipse cx={370} cy={500} rx={24} ry={18} fill={SK} />
            <path d="M356 494h22M358 504h20" stroke={SKD} strokeWidth={2.5} strokeLinecap="round" />
            <path d="M352 430q-6 -12 0 -22M368 430q-6 -12 0 -22" stroke="#FFFFFF" strokeWidth={3} opacity={0.35} fill="none" strokeLinecap="round" />
          </g>
          {/* ── 포즈: 당황 — 안경 벗어 닦기 ── */}
          <g data-part="pose-sweat" display={show(k.pose === 'sweat')}>
            <path d="M194 500C190 580 192 690 196 800" stroke={HOOD_D} strokeWidth={4} fill="none" />
            <path d="M480 800C476 700 450 560 392 486L350 510C396 580 416 700 410 800Z" fill={HOOD} />
            <path d="M350 510C396 580 416 700 410 800" stroke={HOOD_D} strokeWidth={4} fill="none" />
            <path d="M388 482l-40 26" stroke={HOOD_D} strokeWidth={10} strokeLinecap="round" />
            <path d="M330 470h76v22h-76z" fill="#E6ECF4" transform="rotate(-20 368 481)" />
            <ellipse cx={370} cy={470} rx={30} ry={25} fill={SK} />
            <path d="M352 462h22M354 474h20" stroke={SKD} strokeWidth={2.5} strokeLinecap="round" />
            <path d="M316 432h36v24h-36zM360 428h36v24h-36z" fill="#BFE8FF" fillOpacity={0.15} stroke="#DDE6F4" strokeWidth={3} transform="rotate(-12 356 442)" />
            <path d="M352 440q4 -4 8 0" stroke="#DDE6F4" strokeWidth={3} fill="none" />
          </g>
          {/* ── 포즈: 무너짐 — 어깨 움츠림, 손은 앞주머니 ── */}
          <g data-part="pose-break" display={show(k.pose === 'break')}>
            <path d="M208 612Q300 594 392 612L410 708Q300 728 190 708Z" fill={HOOD_D} />
            <path d="M208 612Q300 594 392 612" stroke={HOOD_L} strokeWidth={4} fill="none" />
            <path d="M232 640q30 -14 60 0M310 640q30 -14 60 0" stroke={HOOD} strokeWidth={6} fill="none" strokeLinecap="round" />
            <path d="M192 500C186 560 194 610 220 640M408 500C414 560 406 610 380 640" stroke={HOOD_D} strokeWidth={4} fill="none" strokeLinecap="round" />
          </g>

          {/* ── 이목구비 ── */}
          <g data-part="face-normal" display={show(k.feat === 'normal')}>
            <Brows kind="flat" dy={-2} c={HAIR.black} />
            <Eyes kind="dot" />
            <path d="M284 324q16 2 32 -6" stroke="#2A1E1E" strokeWidth={5} fill="none" strokeLinecap="round" />
          </g>
          <g data-part="face-sweat" display={show(k.feat === 'sweat')}>
            <Brows kind="worry" c={HAIR.black} />
            <Eyes kind="closed" />
            <Mouth kind="line" />
          </g>
          <g data-part="face-shock" display={show(k.feat === 'shock')}>
            <Brows kind="raise" dy={-6} c={HAIR.black} />
            <Eyes kind="wide" />
            <Mouth kind="o" />
          </g>
          <g data-part="face-angry" display={show(k.feat === 'angry')}>
            <Brows kind="angry" c={HAIR.black} w={7} />
            <Eyes kind="dot" />
            <Mouth kind="line" dy={2} />
          </g>
          <g data-part="face-smirk" display={show(k.feat === 'smirk')}>
            <Brows kind="oneup" c={HAIR.black} />
            <Eyes kind="half" />
            <Mouth kind="smirk" />
          </g>
          <g data-part="face-break" display={show(k.feat === 'break')}>
            <Eyes kind="flat" dy={4} />
            <Mouth kind="wave" dy={4} />
            <Blush o={0.18} />
          </g>
          <g display={show(glassesOn)}>
            <Glasses glint={k.feat === 'normal' || k.feat === 'smirk'} />
          </g>

          {/* hair-front — 헝클어진 앞머리 + 새치 */}
          <g display={show(k.pose !== 'break')}>
            <path d="M228 228C232 196 262 180 300 180C338 180 368 196 372 228L360 212L354 224L340 204L328 220L316 198L304 216L292 198L280 218L268 202L258 220L246 206L238 222Z" fill={HAIR.gray} />
            <path d="M250 194q30 -16 60 -10M322 186q22 4 36 20M298 150l2 -18M262 168l-8 -12" stroke={HAIR.grayHi} strokeWidth={4} fill="none" strokeLinecap="round" />
          </g>
          {/* 무너짐: 후드를 뒤집어씀(이마 가림) */}
          <g display={show(k.pose === 'break')}>
            <path d={HOOD_UP} fill={RIM} opacity={0.55} transform="translate(6 0)" fillRule="evenodd" />
            <path d={HOOD_UP} fill={HOOD} fillRule="evenodd" />
            <path d="M300 142C370 146 416 222 406 334C404 388 376 420 300 422C336 404 360 370 362 330L354 282C354 248 332 236 300 236Z" fill={HOOD_D} opacity={0.6} />
            <path d="M246 282C246 248 268 236 300 236C332 236 354 248 354 282" stroke={HOOD_D} strokeWidth={6} fill="none" />
            <path d="M286 372L280 470M314 372L320 470" stroke="#F4F6FA" strokeWidth={5} strokeLinecap="round" />
          </g>

          <g display={show(k.feat === 'sweat')}>
            <Sweat x={392} y={222} />
          </g>
          <Sparks on={k.spark} />
          <Vein on={k.vein} />
        </g>
      </g>
    </PortraitSvg>
  );
}
