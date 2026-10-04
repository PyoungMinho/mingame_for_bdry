/**
 * 표준혁(S4, 41) — 어깨가 넓고 자세가 곧음, 좌우 대칭. 7:3 가르마 단정한 검은 머리, 각진 턱, 얇은 금속테 안경.
 * 차콜 정장 + 흰 셔츠, 네이비 타이 + 은색 타이핀, 가슴 포켓스퀘어. 소품: 검정 가죽 일정 수첩.
 *  평소 = 정중한 미소(눈 ∩, 입 닫고 올림), 수첩을 가슴 앞에
 *  당황 = 한 손으로 넥타이 고쳐 매기, 미소 유지 + 한쪽 입꼬리 떨림, 관자놀이 땀 1, 안경 가장자리 김
 *  무너짐 = 넥타이 풀려 늘어짐, 셔츠 첫 단추 풀림, 안경 벗겨져 손에, 앞머리 한 가닥, 눈 반쯤, 입 일자
 * 다른 용의자와 같은 채도·조명·구도. 악당 같은 눈매·어두운 조명 금지(UI 스펙 6-3).
 * 최종 판정의 무대 연출(암전·줌)은 이 파일에 넣지 않는다 — VerdictStage 가 4명 공통 규칙으로 덧씌운다(디자인 §10).
 */
import { HAIR, SKIN, SPK, useSvgIds } from '../palette';
import { Backlight, Blush, Brows, Eyes, lookOf, Mouth, PortraitDefs, PortraitSvg, Rim, show, Sparks, Sweat, Vein, type PortraitProps } from './parts';

const [SK, SKD] = SKIN.mid;
const SUIT = '#353D50';
const SUIT_D = '#262C3B';
const SUIT_L = '#465068';
const SHIRT = '#F2F4F8';
const TIE = '#1F3A68';
const SILVER = '#C9D0DC';

const HEAD = 'M300 178C348 178 372 212 372 256L368 312C362 344 334 364 300 364C266 364 238 344 232 312L228 256C228 212 252 178 300 178Z';
const HEAD_SH = 'M300 178C348 178 372 212 372 256L368 312C362 344 334 364 300 364C326 342 340 304 340 258C340 216 326 190 300 178Z';
const HAIR_B = 'M224 262C214 202 246 160 300 158C356 160 388 200 378 262C374 236 368 216 354 206C320 196 280 196 246 206C234 218 228 238 224 262Z';
const BODY = 'M300 380C240 380 186 390 158 412C138 430 130 496 126 590L118 800H482L474 590C470 496 462 430 442 412C414 390 360 380 300 380Z';

function Planner({ x, y, r = 0 }: { x: number; y: number; r?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r})`}>
      <rect x={-62} y={-80} width={124} height={160} rx={8} fill="#15161C" />
      <rect x={-62} y={-80} width={18} height={160} rx={6} fill="#22242C" />
      <path d="M40 -80v160" stroke="#3A3D48" strokeWidth={6} />
      <path d="M-50 -76h106" stroke="#4A4E5C" strokeWidth={2} />
    </g>
  );
}
function Glasses({ fog }: { fog?: boolean }) {
  return (
    <g>
      {fog && <path d="M236 262h50v12h-50zM314 262h50v12h-50z" fill="#FFFFFF" opacity={0.55} />}
      <rect x={234} y={240} width={54} height={36} rx={10} fill="none" stroke={SILVER} strokeWidth={3} />
      <rect x={312} y={240} width={54} height={36} rx={10} fill="none" stroke={SILVER} strokeWidth={3} />
      <path d="M288 254q12 -6 24 0M234 252l-8 2M366 252l8 2" stroke={SILVER} strokeWidth={3} fill="none" strokeLinecap="round" />
    </g>
  );
}

export function JunhyeokPortrait({ face = 'normal', smirk, crop, backlight = true, idle = true, title, decorative, idScope, className }: PortraitProps) {
  const ids = useSvgIds('p-s4', idScope);
  const k = lookOf(face, smirk);
  const brk = k.pose === 'break';
  return (
    <PortraitSvg name="표준혁" face={face} crop={crop} idle={idle} title={title} decorative={decorative} className={className}>
      <PortraitDefs ids={ids} spk={SPK.S4} />
      <Backlight ids={ids} on={backlight} />
      <g className="wt-art-figure">
        <g className="wt-art-breath">
          <Rim paths={[HAIR_B, HEAD, BODY]} />
          <path d={HAIR_B} fill={HAIR.black} />
          {/* body — 차콜 정장 + 흰 셔츠 */}
          <path d={BODY} fill={SUIT} />
          <path d="M442 412C462 430 470 496 474 590L482 800H420L424 590C426 500 420 440 404 404Z" fill={SUIT_D} />
          <path d="M262 382L300 480L338 382C326 380 312 380 300 380C288 380 274 380 262 382Z" fill={SHIRT} />
          <path d="M280 336h40v50q-20 8 -40 0z" fill={SKD} />
          {/* 칼라 */}
          <path d="M276 376L300 404L290 420L264 390ZM324 376L300 404L310 420L336 390Z" fill={SHIRT} display={show(!brk)} />
          <path d="M270 380L294 418L280 428L258 396ZM330 380L306 404L320 414L344 392Z" fill={SHIRT} display={show(brk)} />
          {/* 라펠 */}
          <path d="M262 382L224 462L258 520L300 480Z" fill={SUIT_L} />
          <path d="M338 382L376 462L342 520L300 480Z" fill={SUIT_D} />
          {/* 넥타이(평소·당황) */}
          <g display={show(!brk)}>
            <path d="M288 402h24l-4 20h-16z" fill="#2A4A80" />
            <path d="M292 422h16l12 112l-20 24l-20 -24z" fill={TIE} />
            <path d="M286 470h28" stroke={SILVER} strokeWidth={4} strokeLinecap="round" />
          </g>
          {/* 넥타이 풀림(무너짐) + 첫 단추 풀림 */}
          <g display={show(brk)}>
            <path d="M290 428l18 0l-2 6h-14z" fill="#2A4A80" />
            <path d="M292 434c-6 40 -4 80 -14 120l-6 30l18 8l8 -30c8 -40 6 -80 10 -128z" fill={TIE} />
            <path d="M286 410l14 22l14 -22" fill={SKD} />
            <circle cx={300} cy={444} r={3} fill="#C9CFDC" />
          </g>
          {/* 포켓스퀘어 */}
          <path d="M392 548h36l-4 10h-28z" fill={SUIT_D} />
          <path d="M396 548l8 -14l8 10l8 -12l6 16z" fill={SHIRT} />
          <circle cx={300} cy={560} r={4} fill="#151821" />
          <circle cx={300} cy={620} r={4} fill="#151821" />
          {/* head */}
          <ellipse cx={230} cy={268} rx={11} ry={19} fill={SK} />
          <ellipse cx={370} cy={268} rx={11} ry={19} fill={SKD} />
          <path d={HEAD} fill={SK} />
          <path d={HEAD_SH} fill={SKD} opacity={0.7} />
          <path d="M300 286l-5 16h8" stroke={SKD} strokeWidth={3} fill="none" strokeLinecap="round" />

          {/* ── 포즈: 평소 — 수첩을 가슴 앞에 ── */}
          <g data-part="pose-normal" display={show(k.pose === 'normal')}>
            <path d="M158 440C142 520 150 590 196 630L240 604C212 580 204 530 210 448Z" fill={SUIT} />
            <path d="M442 440C458 520 450 590 404 630L360 604C388 580 396 530 390 448Z" fill={SUIT_D} />
            <path d="M210 448C204 530 212 580 240 604M390 448C396 530 388 580 360 604" stroke="#151821" strokeWidth={4} fill="none" />
            <Planner x={300} y={588} r={-4} />
            <ellipse cx={240} cy={612} rx={22} ry={18} fill={SK} />
            <ellipse cx={360} cy={612} rx={22} ry={18} fill={SKD} />
            <path d="M226 606h22M352 606h20" stroke={SKD} strokeWidth={2.5} strokeLinecap="round" />
          </g>
          {/* ── 포즈: 당황 — 넥타이 고쳐 매기 ── */}
          <g data-part="pose-sweat" display={show(k.pose === 'sweat')}>
            <path d="M210 448C204 560 206 680 210 800" stroke="#151821" strokeWidth={4} fill="none" />
            <Planner x={170} y={700} r={6} />
            <ellipse cx={186} cy={640} rx={20} ry={16} fill={SK} />
            <path d="M442 440C470 520 452 560 400 520L344 452L322 430L340 404L380 440C410 470 420 470 404 440Z" fill={SUIT_D} />
            <path d="M442 440C470 520 452 560 400 520L344 452" stroke="#151821" strokeWidth={4} fill="none" />
            <ellipse cx={326} cy={418} rx={24} ry={20} fill={SKD} />
            <path d="M314 408q12 -4 22 6M312 420q12 -2 22 6" stroke="#9A6B4A" strokeWidth={2.5} fill="none" strokeLinecap="round" />
          </g>
          {/* ── 포즈: 무너짐 — 안경 벗겨져 손에 ── */}
          <g data-part="pose-break" display={show(k.pose === 'break')}>
            <path d="M210 448C204 560 206 680 210 800" stroke="#151821" strokeWidth={4} fill="none" />
            <path d="M442 440C462 540 454 620 420 676L380 660C404 606 410 540 398 448Z" fill={SUIT_D} />
            <path d="M398 448C410 540 404 606 380 660" stroke="#151821" strokeWidth={4} fill="none" />
            <ellipse cx={402} cy={684} rx={24} ry={20} fill={SKD} />
            <g transform="rotate(16 400 700)">
              <rect x={352} y={694} width={42} height={28} rx={8} fill="none" stroke={SILVER} strokeWidth={3} />
              <rect x={406} y={694} width={42} height={28} rx={8} fill="none" stroke={SILVER} strokeWidth={3} />
              <path d="M394 704q6 -4 12 0" stroke={SILVER} strokeWidth={3} fill="none" />
            </g>
          </g>

          {/* ── 이목구비 ── */}
          <g data-part="face-normal" display={show(k.feat === 'normal')}>
            <Brows kind="soft" c={HAIR.black} w={5} />
            <Eyes kind="arc" />
            <Mouth kind="polite" />
          </g>
          <g data-part="face-sweat" display={show(k.feat === 'sweat')}>
            <Brows kind="worry" c={HAIR.black} w={5} />
            <Eyes kind="arc" />
            <Mouth kind="tremble" />
          </g>
          <g data-part="face-shock" display={show(k.feat === 'shock')}>
            <Brows kind="raise" dy={-6} c={HAIR.black} w={5} />
            <Eyes kind="wide" />
            <Mouth kind="o" />
          </g>
          <g data-part="face-angry" display={show(k.feat === 'angry')}>
            <Brows kind="angry" c={HAIR.black} w={6} />
            <Eyes kind="dot" />
            <Mouth kind="line" dy={2} />
          </g>
          <g data-part="face-smirk" display={show(k.feat === 'smirk')}>
            <Brows kind="oneup" c={HAIR.black} w={5} />
            <Eyes kind="half" />
            <Mouth kind="smirk" />
          </g>
          <g data-part="face-break" display={show(k.feat === 'break')}>
            <Brows kind="soft" dy={4} c={HAIR.black} w={5} />
            <Eyes kind="half" dy={2} />
            <Mouth kind="line" dy={2} />
          </g>
          <Blush o={0.14} />
          <g display={show(!brk)}>
            <Glasses fog={k.pose === 'sweat'} />
          </g>

          {/* hair-front — 7:3 가르마 */}
          <path d="M262 170C304 160 360 170 378 222C362 206 340 200 318 202C298 204 280 212 266 226C268 208 266 188 262 170Z" fill={HAIR.black} />
          <path d="M262 170C244 178 230 198 226 226C238 210 250 200 262 196Z" fill={HAIR.black} />
          <path d="M276 180q44 -8 82 22" stroke="#3A3A4C" strokeWidth={4} fill="none" strokeLinecap="round" />
          <path d="M262 172l2 20" stroke={SKD} strokeWidth={2} opacity={0.6} />
          {/* 무너짐: 앞머리 한 가닥 */}
          <path d="M300 208c-8 18 -6 34 4 48c-2 -16 0 -30 8 -42z" fill={HAIR.black} display={show(brk)} />

          <g display={show(k.feat === 'sweat' || k.feat === 'shock')}>
            <Sweat x={378} y={238} s={0.85} />
          </g>
          <Sparks on={k.spark} />
          <Vein on={k.vein} />
        </g>
      </g>
    </PortraitSvg>
  );
}
