'use client';

/**
 * 판정 연출(디자인 §6-2) — 추궁 컷인 · 제시 컷인 · 판정 5종(★·◆·반쯤·우회·오답). 상태는 이미 엔진에 반영·저장돼 있다(연출은 표시일 뿐).
 * 판정 4채널: ① 글자(컷인·도장·칩) ② 아이콘 ③ 모션(쾅·흔들림·복귀·튕김) ④ 진동. 모션·진동을 꺼도 ①②로 구분된다.
 * 번쩍임은 ★ 돌파 1회(.55, 90ms)뿐. '줄이기'에서는 흔들림·번쩍임·스윕이 빠진다.
 * 그래픽은 그림 모듈(art/fx)의 사선 스트립 · 유리 균열 · 도장을 쓴다. 여기서는 배치·타이밍만 정한다.
 *  - play(키프레임 1회)는 화면 효과가 '줄이기'가 아니고 OS 모션 줄이기도 꺼져 있을 때만 켠다. 루트 globals.css 가 OS 모션 줄이기에서
 *    모든 애니메이션 길이를 0.01ms 로 만들기 때문에(레이어 important), 스윕을 켜 두면 마지막 프레임(화면 밖)에 멈춰 문구가 사라진다.
 *    play 를 끄면 스트립·균열·도장이 최종 모양 그대로 정지해 보이고, 사라지는 일은 언마운트(JS 타이머)가 맡는다.
 * 결과는 role="alert" 로 한 문장 읽는다. 타임라인 값은 lib/fx.ts.
 */
import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { CASE } from '@/lib/witness';
import { CutInStrip, GlassCrack, VerdictStamp, type CutInKind, type StampKind } from '../art/fx';
import { fxMs, T, VIB } from '../lib/fx';
import { useWt } from '../lib/context';
import { ActionChip } from './ActionChip';
import { playSfx, playVerdict } from '../audio/useGameAudio';

export type FxPlan =
  | { kind: 'press' }
  | {
      kind: 'present';
      cardNames: string[];
      verdict: 'BREAK' | 'HALF' | 'REDIRECT' | 'WRONG';
      tier?: 'star' | 'minor';
      /** ★ 3개째(진동 강화) */
      third?: boolean;
      tutorial?: boolean;
      /** 스크린 리더용 한 문장 */
      spoken: string;
    };

function verdictMs(plan: Extract<FxPlan, { kind: 'present' }>): number {
  if (plan.verdict === 'BREAK') return plan.tier === 'star' ? T.breakStar + T.stampStar - 400 : T.breakMinor;
  if (plan.verdict === 'HALF') return T.half;
  if (plan.verdict === 'REDIRECT') return T.redirect;
  return T.wrong;
}

/** 스트립 길이(ms, 기본 모드) — §6-2: 추궁 350 · 제시 450 · ★ 600(80ms 뒤) · ◆ 400 */
const STRIP_MS: Record<CutInKind, number> = { press: T.cutPress, present: T.cutPresent, star: 600, minor: 400 };
/** 판정 확정 뒤 도장이 찍히는 시점(ms, 기본 모드) — ★ +900 · ◆ +500 */
const STAMP_AT = { star: 900, minor: 500 } as const;

/** 같은 카드 조합이면 같은 균열(결정론), 조합마다 모양이 다르다 */
function seedOf(names: string[]): number {
  let h = 7;
  for (const ch of names.join('|')) h = (h * 31 + ch.charCodeAt(0)) % 9973;
  return h;
}

export interface VerdictFxProps {
  plan: FxPlan;
  /** 흔들림을 적용할 화면 요소 */
  shakeRef?: RefObject<HTMLElement>;
  /** 판정이 확정되는 순간(제시 컷인이 끝나고 판정 연출이 시작될 때) */
  onImpact?: () => void;
  onDone: () => void;
}

export function VerdictFx({ plan, shakeRef, onImpact, onDone }: VerdictFxProps) {
  const { fx, vib, game } = useWt();
  const play = fx !== 'reduced' && !game.reducedMotion;
  const [phase, setPhase] = useState<'present' | 'verdict'>(plan.kind === 'press' ? 'verdict' : 'present');
  const [stampOn, setStampOn] = useState(false);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const impactRef = useRef(onImpact);
  impactRef.current = onImpact;

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const shake = (kind: 'star' | 'minor' | 'wrong', delay: number, len: number) => {
      const el = shakeRef?.current;
      if (!el || fx === 'reduced') return;
      timers.push(setTimeout(() => el.setAttribute('data-shake', kind), delay));
      timers.push(setTimeout(() => el.removeAttribute('data-shake'), delay + len));
    };
    // 소리: 컷인 시작(휙·쾅) → 판정이 화면에 뜨는 순간(impact)에만 판정음. 판정 종류 말고는 아무것도 보지 않는다
    if (plan.kind === 'press') {
      vib(VIB.tap);
      playSfx('press');
      timers.push(setTimeout(() => doneRef.current(), fxMs(T.cutPress, fx)));
    } else {
      const pre = fxMs(T.cutPresent + T.flyCard, fx);
      const len = fxMs(verdictMs(plan), fx);
      playSfx('present');
      timers.push(
        setTimeout(() => {
          setPhase('verdict');
          impactRef.current?.();
          playVerdict(plan.verdict, plan.tier, plan.tutorial);
          if (plan.verdict === 'BREAK') vib(plan.tier === 'star' ? (plan.third ? VIB.star3 : VIB.star) : VIB.minor);
          else if (plan.verdict === 'HALF') vib(VIB.half);
          else if (plan.verdict === 'WRONG' && !plan.tutorial) vib(VIB.trustDown);
        }, pre),
      );
      if (plan.verdict === 'BREAK') {
        shake(plan.tier === 'star' ? 'star' : 'minor', pre + fxMs(120, fx), fxMs(plan.tier === 'star' ? 300 : 200, fx));
        timers.push(
          setTimeout(() => {
            setStampOn(true);
            if (plan.tier === 'star') playSfx('star');
          }, pre + fxMs(plan.tier === 'star' ? STAMP_AT.star : STAMP_AT.minor, fx)),
        );
      }
      if (plan.verdict === 'WRONG') shake('wrong', pre + fxMs(60, fx), fxMs(300, fx));
      timers.push(setTimeout(() => doneRef.current(), pre + len));
    }
    return () => {
      timers.forEach(clearTimeout);
      shakeRef?.current?.removeAttribute('data-shake');
    };
    // 플랜은 한 번 재생하고 끝난다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const star = plan.kind === 'present' && plan.verdict === 'BREAK' && plan.tier === 'star';
  const minor = plan.kind === 'present' && plan.verdict === 'BREAK' && plan.tier === 'minor';
  const half = plan.kind === 'present' && plan.verdict === 'HALF';
  const redirect = plan.kind === 'present' && plan.verdict === 'REDIRECT';
  const wrong = plan.kind === 'present' && plan.verdict === 'WRONG';

  const seed = plan.kind === 'present' ? seedOf(plan.cardNames) : 5;

  return (
    <div className="wt-fx" data-phase={phase} data-verdict={plan.kind === 'press' ? 'press' : plan.verdict} data-tier={star ? 'star' : minor ? 'minor' : undefined}>
      {plan.kind === 'press' && <CutIn kind="press" text={CASE.cutIns.press} play={play} />}
      {plan.kind === 'present' && phase === 'present' && (
        <>
          <CutIn kind="present" text={CASE.cutIns.present} play={play} />
          <div className="wt-fx-card" aria-hidden>
            {plan.cardNames.map((n) => (
              <span key={n}>{n}</span>
            ))}
          </div>
        </>
      )}
      {plan.kind === 'present' && phase === 'verdict' && (
        <>
          {star && <div className="wt-flash" aria-hidden />}
          {(star || minor) && <GlassCrack className="wt-fx-crack" cx={50} cy={48} tone="cyan" rays={star ? 10 : 8} seed={seed} play={play} />}
          {(star || minor) && <CutIn kind={star ? 'star' : 'minor'} text={CASE.cutIns.break} play={play} />}
          {star && stampOn && <Stamp kind="star" play={play} />}
          {minor && stampOn && <Stamp kind="minor" play={play} />}
          {half && (
            <div className="wt-fx-chip wt-fx-chip--half">
              <ActionChip kind="half" />
            </div>
          )}
          {redirect && (
            <div className="wt-fx-chip">
              <ActionChip kind="redirect" />
            </div>
          )}
          {wrong && (
            <>
              <div className="wt-vignette" aria-hidden />
              <div className="wt-fx-chip wt-fx-chip--wrong">
                <ActionChip kind="wrong" label={plan.tutorial ? '튜토리얼이라 감점 없음' : undefined} />
              </div>
            </>
          )}
        </>
      )}
      {plan.kind === 'present' && (
        <p className="wt-sr" role="alert">
          {plan.spoken}
        </p>
      )}
    </div>
  );
}

/** 컷인 사선 스트립(art/fx) — 길이는 §6-2 값을 CSS 변수로 넘긴다(× --wt-fx-scale). 장식이라 aria-hidden(그림이 이미 숨김) */
export function CutIn({ kind, text, play }: { kind: CutInKind; text: string; play: boolean }) {
  const style = { '--wt-art-cutin-ms': `${STRIP_MS[kind]}ms` } as CSSProperties;
  return (
    <div className="wt-fx-strip" data-kind={kind} style={style}>
      <CutInStrip kind={kind} text={text} play={play} />
    </div>
  );
}

/** 판정 도장(art/fx) — 결정적 · 모순 해소 · 다 털었다. 글자가 항상 함께 있어 색만으로 구분하지 않는다 */
export function Stamp({ kind, play }: { kind: StampKind; play: boolean }) {
  return (
    <div className="wt-fx-stamp" data-kind={kind} aria-hidden>
      <VerdictStamp kind={kind} play={play} />
    </div>
  );
}
