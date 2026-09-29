/**
 * 씬 그룹 A — 집 안에서 시작되는 첫 장면들.
 *  - home_living   : 따뜻한 오후 앰버 → 창밖 주황 연기, TV 의 차가운 청백광이 대비
 *  - phone_alert   : 짙은 남색 어둠 속 폰 화면의 앰버·빨강 섬광이 유일한 광원
 *  - door_peephole : 어안렌즈 원 안쪽만 병든 황록 형광등 빛, 원 바깥은 완전한 검정
 * (balcony_view 는 reference.tsx 가 담당)
 */
import type { ComponentType } from 'react';
import type { SceneId } from '@/lib/zombie/types';
import { Dog, Glow, Haze, PAL, Person, SceneSvg, Skyline, Sky, Smoke, Vignette } from './primitives';

// ─────────────────────────────── home_living ───────────────────────────────

const H_FLOOR = 108;

function HomeLiving() {
  const WIN = { x: 64, y: 44, w: 330, h: 252 };
  const floorY = 342;
  return (
    <SceneSvg>
      <Sky id="zs-home_living-wall" stops={[[0, '#0E0704'], [0.55, '#2A1509'], [1, '#170A05']]} />
      <Glow id="zs-home_living-spill" cx={230} cy={200} r={330} color="#E8742A" opacity={0.28} />

      {/* 창 — 바깥의 주황 오후와 검은 연기 기둥 */}
      <defs>
        <clipPath id="zs-home_living-winclip">
          <rect x={WIN.x} y={WIN.y} width={WIN.w} height={WIN.h} />
        </clipPath>
      </defs>
      <g clipPath="url(#zs-home_living-winclip)">
        <Sky id="zs-home_living-sky" x={WIN.x} y={WIN.y} w={WIN.w} h={WIN.h} stops={[[0, '#4A2012'], [0.45, '#B0461A'], [0.8, '#EE8A34'], [1, '#FFC878']]} />
        <Glow id="zs-home_living-sun" cx={150} cy={262} r={150} color="#FFD29A" opacity={0.6} />
        <Skyline x0={40} x1={420} base={300} minH={10} maxH={46} seed={21} fill="#7A3418" tower={132} />
        <Smoke x={292} y={292} s={1.55} color="#1C0906" opacity={0.92} />
        <Smoke x={196} y={296} s={0.7} color="#2A0E08" opacity={0.7} lean={-1} />
        <Haze id="zs-home_living-winhaze" y={236} h={70} color="#F09040" opacity={0.45} className="zs-drift" />
      </g>
      {/* 샷시 */}
      <g fill="#0B0503">
        <rect x={WIN.x - 8} y={WIN.y - 8} width={WIN.w + 16} height={8} />
        <rect x={WIN.x - 8} y={WIN.y + WIN.h} width={WIN.w + 16} height={10} />
        <rect x={WIN.x - 8} y={WIN.y} width={8} height={WIN.h} />
        <rect x={WIN.x + WIN.w} y={WIN.y} width={8} height={WIN.h} />
        <rect x={224} y={WIN.y} width={9} height={WIN.h} />
        <rect x={WIN.x} y={200} width={WIN.w} height={4} />
      </g>
      <path d={`M${WIN.x - 8} ${WIN.y + WIN.h + 10} H${WIN.x + WIN.w + 8}`} stroke="#E8862E" strokeWidth={1.5} opacity={0.5} />
      {/* 커튼 */}
      <path d="M22 30 C40 120 30 220 44 336 L68 336 C58 220 66 120 58 30 Z" fill="#0A0503" />
      <path d="M390 30 C402 120 396 220 408 336 L436 336 C424 230 430 120 422 30 Z" fill="#0A0503" />
      <path d="M58 30 C66 120 58 220 68 336" stroke="#C4501F" strokeWidth={1.4} fill="none" opacity={0.55} />

      {/* 벽 액자 — 창빛 림 */}
      <rect x={470} y={112} width={56} height={42} fill="#0C0604" stroke="#8A3A18" strokeWidth={1.2} />

      {/* 바닥 */}
      <Sky id="zs-home_living-floor" y={floorY} h={H_FLOOR} stops={[[0, '#2A1308'], [1, '#080302']]} />
      <path d={`M0 ${floorY} H800`} stroke="#6E2E14" strokeWidth={1.5} opacity={0.6} />
      <polygon points={`${WIN.x},${floorY} ${WIN.x + WIN.w},${floorY} 520,450 150,450`} fill="#FFB06A" opacity={0.14} />
      <polygon points="224,342 233,342 352,450 336,450" fill="#0A0503" opacity={0.5} />

      {/* TV — 차가운 청백광 */}
      <polygon points="588,282 250,450 610,450" fill={PAL.screen} opacity={0.07} />
      <Glow id="zs-home_living-tvglow" cx={660} cy={236} r={210} color={PAL.screen} opacity={0.32} className="zs-glow" />
      <rect x={560} y={300} width={200} height={44} fill="#070403" />
      <path d="M560 300 H760" stroke={PAL.screen} strokeWidth={1.2} opacity={0.4} />
      <rect x={648} y={286} width={24} height={14} fill="#070403" />
      <rect x={576} y={184} width={168} height={104} rx={3} fill="#050302" />
      <defs>
        <linearGradient id="zs-home_living-screen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#E4F3FF" />
          <stop offset="1" stopColor="#6E9FCC" />
        </linearGradient>
      </defs>
      <g className="zs-glow">
        <rect x={582} y={190} width={156} height={92} fill="url(#zs-home_living-screen)" />
        <path d="M596 262 C596 240 606 232 620 230 C612 224 612 206 622 202 C634 198 642 210 636 226 C650 230 658 240 658 262 Z" fill="#2E5478" opacity={0.75} />
        <path d="M672 250 C668 236 676 222 690 216 C700 210 716 214 720 226 C726 240 718 254 704 258 C692 262 678 260 672 250 Z" fill="#9CC4E4" stroke="#3E6A92" strokeWidth={1.5} />
        <circle cx={698} cy={236} r={11} fill="#E02020" opacity={0.75} />
        <circle cx={698} cy={236} r={4} fill="#FF4A3A" />
        <rect x={582} y={262} width={156} height={14} fill="#C81E1E" />
        <rect x={586} y={264} width={32} height={10} fill="#fff" />
        <text x={602} y={272.5} textAnchor="middle" fontSize={8.5} fontWeight={800} fill="#C81E1E">속보</text>
        <rect x={624} y={267} width={96} height={4} fill="#fff" opacity={0.75} />
      </g>

      {/* 소파 + 사람 — 창빛을 등지고 TV 를 본다 */}
      <g fill="#080403">
        <path d="M232 296 C232 288 240 284 250 284 C262 284 268 290 268 300 L268 386 L232 386 Z" />
        <rect x={250} y={344} width={216} height={30} rx={8} />
        <path d="M446 336 C446 328 452 324 460 324 C470 324 476 330 476 338 L476 386 L446 386 Z" />
        <rect x={236} y={370} width={240} height={16} />
        <rect x={244} y={386} width={8} height={8} />
        <rect x={458} y={386} width={8} height={8} />
      </g>
      <path d="M268 300 C268 290 262 284 250 284" stroke="#E8862E" strokeWidth={1.6} fill="none" opacity={0.7} />
      <path d="M446 336 C446 328 452 324 460 324 C470 324 476 330 476 338" stroke={PAL.screen} strokeWidth={1.4} fill="none" opacity={0.55} />
      <Person x={318.5} y={344} s={1.35} pose="sit" fill="#E8862E" pack={false} />
      <Person x={321.8} y={345} s={1.35} pose="sit" fill="#7FB0DA" pack={false} />
      <Person x={320} y={345} s={1.35} pose="sit" fill="#080403" pack={false} />

      {/* 콩이 — 창밖을 먼저 느낀다 */}
      <Dog x={531.5} y={418} s={1.45} pose="stand" flip fill="#7FB0DA" />
      <Dog x={530} y={419} s={1.45} pose="stand" flip fill="#080403" />

      <Haze id="zs-home_living-floorhaze" y={326} h={60} color="#C4501F" opacity={0.18} />

      {/* 전경 — 식탁 위 라면 냄비와 김 */}
      <g className="zs-rise">
        <path d="M98 350 C88 330 110 316 98 294 C88 276 104 262 98 246" stroke="#FFC878" strokeWidth={5} fill="none" opacity={0.18} strokeLinecap="round" />
        <path d="M118 348 C128 326 108 312 122 290 C132 274 118 258 126 240" stroke="#FFC878" strokeWidth={4} fill="none" opacity={0.14} strokeLinecap="round" />
      </g>
      <g fill="#050201">
        <rect x={-10} y={388} width={236} height={12} />
        <rect x={180} y={400} width={12} height={60} />
        <rect x={30} y={400} width={12} height={60} />
        <path d="M70 354 H150 L146 388 H74 Z" />
        <rect x={56} y={358} width={16} height={6} rx={3} />
        <rect x={148} y={358} width={16} height={6} rx={3} />
        <path d="M66 354 C80 342 140 340 156 350 Z" />
        <rect x={106} y={338} width={8} height={6} rx={2} />
      </g>
      <path d="M66 354 C80 342 140 340 156 350 M-10 388 H226" stroke="#FFB06A" strokeWidth={1.4} fill="none" opacity={0.6} />
      <Vignette id="zs-home_living-vig" strength={0.8} />
    </SceneSvg>
  );
}

// ─────────────────────────────── phone_alert ───────────────────────────────

function PhoneAlert() {
  const slats = Array.from({ length: 13 }, (_, i) => 66 + i * 12);
  return (
    <SceneSvg>
      <Sky id="zs-phone_alert-bg" stops={[[0, '#02040A'], [0.5, '#070D1C'], [1, '#03050B']]} />
      {/* 블라인드 창 — 희미한 남색 밤 */}
      <rect x={70} y={60} width={190} height={164} fill="#0F1C36" />
      <g fill="#050A16">
        {slats.map((y) => (
          <rect key={y} x={70} y={y} width={190} height={7} />
        ))}
      </g>
      <rect x={66} y={56} width={198} height={172} fill="none" stroke="#02040A" strokeWidth={6} />
      {/* 침대 헤드보드·협탁 — 폰빛에 가장자리만 */}
      <path d="M470 150 H760 V330 H470 Z" fill="#060A15" />
      <path d="M470 330 V150 H760" stroke="#FF9A40" strokeWidth={1.2} fill="none" opacity={0.18} />
      <rect x={86} y={286} width={110} height={70} fill="#050912" />
      <path d="M86 286 H196" stroke="#FF9A40" strokeWidth={1.2} opacity={0.25} />
      <path d="M126 286 L132 246 H150 L156 286 Z" fill="#050912" />
      <path d="M118 246 L126 214 H156 L164 246 Z" fill="#070C18" stroke="#FF9A40" strokeWidth={1} strokeOpacity={0.2} />

      <Glow id="zs-phone_alert-amber" cx={420} cy={236} r={340} color={PAL.alert} opacity={0.42} className="zs-glow" />
      <g className="zs-blink">
        <Glow id="zs-phone_alert-red" cx={420} cy={236} r={240} color="#FF2A1A" opacity={0.3} />
      </g>

      {/* 이불 — 주름마다 앰버 반사 */}
      <path d="M0 356 C120 332 240 350 330 340 C440 328 560 344 800 330 V450 H0 Z" fill="#060912" />
      <path d="M0 356 C120 332 240 350 330 340 C440 328 560 344 800 330" stroke="#E8742A" strokeWidth={1.6} fill="none" opacity={0.45} />
      <path d="M150 450 C200 400 260 380 330 376 M520 450 C540 410 600 384 690 374" stroke="#B0541A" strokeWidth={1.4} fill="none" opacity={0.35} />
      <Glow id="zs-phone_alert-pool" cx={430} cy={372} r={170} color="#E8742A" opacity={0.3} />

      {/* 손 + 폰 */}
      <g transform="translate(420 226) rotate(-9)">
        <path d="M30 96 C60 90 96 104 120 130 L190 290 L60 290 C40 230 20 170 30 96 Z" fill="#0A0605" />
        <path d="M120 130 L190 290" stroke="#FF9A40" strokeWidth={1.4} opacity={0.3} />
        <ellipse cx={34} cy={118} rx={58} ry={30} fill="#0A0605" />
        <rect x={-64} y={-122} width={128} height={244} rx={17} fill="#040303" />
        <rect x={-64} y={-122} width={128} height={244} rx={17} fill="none" stroke="#FFB870" strokeWidth={1.2} opacity={0.5} />
        <defs>
          <linearGradient id="zs-phone_alert-screen" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#FFB84A" />
            <stop offset="0.6" stopColor="#E0621A" />
            <stop offset="1" stopColor="#7A1A08" />
          </linearGradient>
        </defs>
        <rect x={-57} y={-112} width={114} height={224} rx={11} fill="url(#zs-phone_alert-screen)" />
        <g className="zs-blink">
          <rect x={-57} y={-112} width={114} height={224} rx={11} fill="#FF1E14" opacity={0.55} />
        </g>
        <rect x={-57} y={-112} width={114} height={46} rx={11} fill="#B8140C" opacity={0.85} />
        <path d="M0 -104 L17 -74 H-17 Z" fill="#FFE6B8" />
        <rect x={-1.6} y={-96} width={3.2} height={12} fill="#B8140C" />
        <circle cx={0} cy={-79} r={1.8} fill="#B8140C" />
        <g fill="#FFE6B8">
          <rect x={-44} y={-50} width={88} height={9} rx={2} opacity={0.95} />
          <rect x={-44} y={-32} width={76} height={6} rx={2} opacity={0.7} />
          <rect x={-44} y={-20} width={82} height={6} rx={2} opacity={0.7} />
          <rect x={-44} y={-8} width={58} height={6} rx={2} opacity={0.7} />
          <rect x={-44} y={70} width={88} height={22} rx={8} opacity={0.9} />
        </g>
        {/* 왼쪽으로 감싼 손가락 + 오른쪽 엄지 */}
        <rect x={-74} y={0} width={14} height={112} rx={6} fill="#0A0605" />
        {[2, 28, 54, 80].map((fy, i) => (
          <g key={fy}>
            <ellipse cx={-72 + i} cy={fy + 11} rx={14} ry={14} fill="#0A0605" />
            <path d={`M-66 ${fy + 2} C${-54 + i * 2} ${fy + 1} ${-45 + i * 2} ${fy + 5} ${-45 + i * 2} ${fy + 11} C${-45 + i * 2} ${fy + 17} ${-54 + i * 2} ${fy + 20} -66 ${fy + 20} Z`} fill="#1E0F09" />
            <path d={`M${-52 + i * 2} ${fy + 3.5} C${-47 + i * 2} ${fy + 6} ${-46 + i * 2} ${fy + 14} ${-50 + i * 2} ${fy + 18}`} stroke="#FFB870" strokeWidth={1.4} fill="none" opacity={0.65} />
          </g>
        ))}
        <path d="M-84 20 C-88 50 -88 80 -80 110" stroke="#FF9A40" strokeWidth={1.2} fill="none" opacity={0.18} />
        <path d="M70 110 C78 70 70 50 50 36 C40 30 32 38 38 48 C50 62 52 80 46 110 Z" fill="#1A0D08" />
        <path d="M38 48 C32 38 40 30 50 36 C60 42 66 50 70 60" stroke="#FFB870" strokeWidth={1.8} fill="none" opacity={0.75} />
      </g>
      <Vignette id="zs-phone_alert-vig" strength={0.9} />
    </SceneSvg>
  );
}

// ─────────────────────────────── door_peephole ───────────────────────────────

/** 움츠린 어깨 — 목이 어깨 사이로 파묻힌다 */
const FIG_BODY = 'M150 452 C160 404 214 378 290 366 C322 360 340 344 352 326 L436 326 C448 346 468 360 504 366 C580 378 636 404 650 452 Z';
const FIG_HAND =
  'M488 392 C486 372 492 356 506 350 C512 340 522 340 527 347 C532 338 543 340 546 349 C553 342 563 347 563 357 C571 356 577 366 573 377 C567 393 548 402 528 404 C510 406 492 402 488 392 Z';
/** 숙인 머리 — 앞으로 떨군 얼굴(턱이 가슴 쪽), 헝클어진 머리 뭉치와 몇 가닥 */
function FigHead({ fill }: { fill: string }) {
  return (
    <g fill={fill}>
      <path d="M336 308 C332 276 342 252 362 242 C368 236 376 236 382 238 C390 232 402 232 410 237 C418 235 428 240 432 246 C448 256 456 280 452 308 C450 340 426 360 394 360 C362 360 340 340 336 308 Z" />
      <ellipse cx={336} cy={318} rx={6} ry={12} />
      <ellipse cx={452} cy={318} rx={6} ry={12} />
      <path d="M358 246 C352 242 346 243 342 248 M384 237 C382 231 377 228 372 229 M404 235 C407 229 412 227 417 228 M436 249 C442 246 448 249 450 254 M340 276 C334 278 331 283 331 289 M450 280 C456 282 458 288 458 294" stroke={fill} strokeWidth={2.2} strokeLinecap="round" fill="none" />
    </g>
  );
}

function DoorPeephole() {
  const C = { x: 400, y: 225, r: 206 };
  const rim = '#B8DA58';
  return (
    <SceneSvg>
      <rect width={800} height={450} fill="#000" />
      <defs>
        <clipPath id="zs-door_peephole-lens">
          <circle cx={C.x} cy={C.y} r={C.r} />
        </clipPath>
        <radialGradient id="zs-door_peephole-fish" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0.55" stopColor="#000" stopOpacity={0} />
          <stop offset="0.86" stopColor="#000" stopOpacity={0.55} />
          <stop offset="1" stopColor="#000" stopOpacity={1} />
        </radialGradient>
        <filter id="zs-door_peephole-grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={4} />
          <feColorMatrix values="0 0 0 0 0.7  0 0 0 0 0.85  0 0 0 0 0.4  0 0 0 0.6 0" />
        </filter>
      </defs>
      <g clipPath="url(#zs-door_peephole-lens)">
        {/* 휘어진 복도 — 천장·양벽·바닥이 소실점으로 */}
        <path d="M150 0 Q252 62 396 176 L444 176 Q568 62 660 0 Z" fill="#4E6A22" />
        <path d="M150 0 Q252 62 396 176 L396 232 Q262 352 150 450 Z" fill="#1E2A10" />
        <path d="M660 0 Q568 62 444 176 L444 232 Q556 352 660 450 Z" fill="#26361A" />
        <path d="M150 450 Q262 352 396 232 L444 232 Q556 352 660 450 Z" fill="#0F160A" />
        <rect x={396} y={176} width={48} height={56} fill="#3A4F1C" />
        <rect x={408} y={194} width={24} height={38} fill="#141D0F" />
        <rect x={405} y={181} width={30} height={10} fill={PAL.exit} />
        <text x={420} y={189} textAnchor="middle" fontSize={7.5} fontWeight={800} fill="#062312">비상구</text>
        {/* 문들 */}
        <g fill="#0C1308" stroke="#6E8C2E" strokeWidth={1} strokeOpacity={0.4}>
          <path d="M214 92 L300 146 L300 300 L214 360 Z" />
          <path d="M338 164 L366 181 L366 244 L338 262 Z" />
          <path d="M626 92 L540 146 L540 300 L626 360 Z" />
          <path d="M502 164 L474 181 L474 244 L502 262 Z" />
        </g>
        <g fill="#A6C84A" opacity={0.6}>
          <circle cx={288} cy={232} r={3.5} />
          <circle cx={552} cy={232} r={3.5} />
        </g>
        <text x={256} y={128} textAnchor="middle" fontSize={13} fontWeight={800} fill="#A6C84A" opacity={0.55} transform="rotate(30 256 128)">1202</text>
        <text x={584} y={128} textAnchor="middle" fontSize={13} fontWeight={800} fill="#A6C84A" opacity={0.55} transform="rotate(-30 584 128)">1204</text>
        <path d="M396 232 L444 232" stroke="#2C3D18" strokeWidth={1} />
        {/* 형광등 줄 */}
        <rect x={414} y={158} width={12} height={2.4} fill="#E8FFA0" opacity={0.7} />
        <rect x={404} y={128} width={32} height={4} fill="#E8FFA0" opacity={0.8} />
        <Glow id="zs-door_peephole-pool" cx={420} cy={330} r={170} color="#A6C84A" opacity={0.2} />
        <g className="zs-flicker">
          <Glow id="zs-door_peephole-tube" cx={420} cy={58} r={230} color="#C8E86A" opacity={0.55} />
          <rect x={350} y={44} width={140} height={11} rx={4} fill="#F2FFC0" />
          <polygon points="350,56 490,56 600,330 240,330" fill="#C8E86A" opacity={0.07} />
        </g>

        {/* 렌즈에 바짝 붙은 사람 — 팔을 부여잡고 고개를 숙임 */}
        <g className="zs-bob">
          <g transform="translate(0 -3)" fill={rim} opacity={0.85}>
            <path d={FIG_BODY} />
            <FigHead fill={rim} />
            <path d={FIG_HAND} />
          </g>
          <g fill="#070B04">
            <path d={FIG_BODY} />
            <FigHead fill="#070B04" />
          </g>
          {/* 움켜쥔 팔 — 몸 위를 가로지르는 앞팔, 윤곽광으로 분리 */}
          <path d="M250 452 C320 420 420 392 500 376" stroke="#7A9A34" strokeOpacity={0.55} strokeWidth={49} strokeLinecap="round" fill="none" />
          <path d="M250 452 C320 420 420 392 500 376" stroke="#020301" strokeWidth={44} strokeLinecap="round" fill="none" />
          <path d={FIG_HAND} fill="#020301" />
          <path d="M518 380 C522 404 526 414 525 426 M540 384 C543 396 544 404 542 412" stroke={PAL.blood} strokeWidth={2.6} strokeLinecap="round" />
        </g>

        <rect x={C.x - C.r} y={C.y - C.r} width={C.r * 2} height={C.r * 2} filter="url(#zs-door_peephole-grain)" opacity={0.12} />
        <circle cx={C.x} cy={C.y} r={C.r} fill="url(#zs-door_peephole-fish)" />
        <path d="M268 92 A190 190 0 0 1 452 42" stroke="#fff" strokeWidth={10} fill="none" opacity={0.06} strokeLinecap="round" />
      </g>
      <circle cx={C.x} cy={C.y} r={C.r - 1} fill="none" stroke="#3A5020" strokeWidth={2} opacity={0.6} />
    </SceneSvg>
  );
}

export const sceneGroupA: Partial<Record<SceneId, ComponentType>> = {
  home_living: HomeLiving,
  phone_alert: PhoneAlert,
  door_peephole: DoorPeephole,
};
