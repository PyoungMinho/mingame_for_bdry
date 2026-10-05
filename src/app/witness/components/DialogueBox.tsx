'use client';

/**
 * 대사창(디자인 §5-8) — 한 번에 한 줄. 글자가 나오는 중의 탭 = 그 줄 즉시 완성, 다 나온 뒤의 탭 = 다음 줄(탭 1번 = 다음 줄). Space/Enter 동일.
 * 길게 누르기(450ms) = 연속 넘김: 누르고 있는 동안 0.28초마다 줄을 완성하고 넘긴다. 마지막 줄에서 멈춘다 —
 * 대사를 끝내는 일(다음 단계로 넘어가는 일)은 꼭 탭 한 번으로 한다. 손을 뗄 때 이어지는 클릭은 삼킨다.
 * 단, 길게 누르는 동안 아무것도 넘기지 못했다면(마지막 줄에서 0.45초 넘게 누른 '느린 탭') 그 클릭은 보통 탭으로 처리한다.
 * 목소리 변형(data-voice): 사람(고딕) · 한결 · 나(명조 + 좌측 바) · 내레이션(패널 없음) · 또박이(고정폭 + 시안 틴트 + 이퀄라이저) · 기기.
 * 접근성: 화면 표시용 타이핑 사본은 aria-hidden, 같은 문장 전체를 sr-only role="log" 로 먼저 둔다.
 * 읽은 대사: meta.plays ≥ 1 + 설정 켬 + readLines 에 있으면 즉시 표시. 줄이 끝나면 읽음으로 기록한다(키 = readLineKey: 문구 해시 포함).
 *   단, 길게 누르기 연속 넘김으로 지나간 줄과 [≫ 읽은 건 넘기기]로 건너뛴 줄은 새로 기록하지 않는다(사양 f · X12).
 * [≫ 읽은 건 넘기기](readKey 가 있는 블록만): 지금 줄 포함 연속으로 읽은 줄이 2개 이상일 때 켜지고, 눌러서 다음 '처음 보는 줄'로 점프한다
 *   (끝까지 읽은 블록이면 onDone). 자리는 오른쪽 위에 항상 잡아 두고 투명도만 바꾼다. 건너뛴 구간의 마지막 표정·화자는 onLine 으로 한 번 알려 준다(M4).
 * 소리: 글자가 나오는 동안 2~3자마다 아주 작은 타자음(화자 종류별 음색 — 또박이 · 사람 · 나 · 기기, 내레이션은 없음).
 */
import { ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { readLineKey, skipPlan, type Dialogue } from '@/lib/witness';
import { COACH_TEXT, REPLAY_TEXT } from '../lib/copy';
import { ledOf, nameOf, spokenText } from '../lib/format';
import { useWt } from '../lib/context';
import { LONG_PRESS_MS } from '../lib/fx';
import { useTypewriter } from '../lib/useTypewriter';
import { ArtSlot } from './ArtSlot';
import { CoachBubble } from './Nav';

/** 넘기기 버튼이 켜진 뒤 누름을 받기 시작하는 시간(UX-6) */
const SKIP_ARM_MS = 400;
import { blipEvery } from '../audio/cues';
import { playBlip } from '../audio/useGameAudio';

export function useDocVisible(): boolean {
  const [v, setV] = useState(true);
  useEffect(() => {
    const on = () => setV(document.visibilityState !== 'hidden');
    on();
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);
  return v;
}

/** 길게 누르는 동안 줄을 넘기는 간격(ms) */
export const HOLD_STEP_MS = 280;

export type Voice = 'sus' | 'cop' | 'me' | 'narr' | 'ai' | 'dev';

export function voiceOf(who: Dialogue['who']): Voice {
  if (who === 'COP') return 'cop';
  if (who === 'ME') return 'me';
  if (who === 'NARR') return 'narr';
  if (who === 'AI') return 'ai';
  if (who === 'DEV') return 'dev';
  return 'sus';
}

export interface DialogueBoxProps {
  lines: Dialogue[];
  /** 바뀌면 처음부터 다시 */
  playKey: string;
  onDone: () => void;
  onLine?: (line: Dialogue, index: number) => void;
  /** 읽은 대사 기록 키의 접두(키 = `${readKey}#${index}~${문구 해시 4자}`, readLineKey) */
  readKey?: string;
  /** 즉시 표시(이미 추궁한 줄 등) */
  instant?: boolean;
  className?: string;
  /** 오른쪽 아래 진행 표시를 숨김 */
  quiet?: boolean;
}

export function DialogueBox({ lines, playKey, onDone, onLine, readKey, instant, className, quiet }: DialogueBoxProps) {
  const { game, coachSeen } = useWt();
  const [st, setSt] = useState({ k: playKey, i: 0 });
  const idx = st.k === playKey ? st.i : 0;
  if (st.k !== playKey) setSt({ k: playKey, i: 0 });
  const line = lines[Math.min(idx, Math.max(0, lines.length - 1))];
  const visible = useDocVisible();
  const rk = readKey && line ? readLineKey(readKey, idx, line.text) : null;
  const known = rk ? game.isRead(rk) : false;
  const plan = skipPlan(lines, readKey, idx, game.isRead);
  // 넘기기 안내 말풍선은 '켜진 그 줄'에서만 보인다(다음 줄로 넘어가면 사라진다)
  const [coachKey, setCoachKey] = useState<string | null>(null);
  const lineKey = `${playKey}:${idx}`;
  const coachOn = coachKey === lineKey;
  const instantNow = !!instant || (game.meta.plays >= 1 && game.settings.readFast && known);
  const tw = useTypewriter(line?.text ?? '', game.settings.speed, { instant: instantNow, paused: !visible, resetKey: `${playKey}:${idx}` });
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const onLineRef = useRef(onLine);
  onLineRef.current = onLine;
  const tapRef = useRef<HTMLButtonElement>(null);
  const hold = useRef<{ start: ReturnType<typeof setTimeout> | null; tick: ReturnType<typeof setInterval> | null; fired: boolean; steps: number; holding: boolean }>({ start: null, tick: null, fired: false, steps: 0, holding: false });
  const holdStepRef = useRef<() => void>(() => undefined);

  // 빈 대사는 곧바로 끝낸다
  useEffect(() => {
    if (lines.length === 0) doneRef.current();
  }, [playKey, lines.length]);

  useEffect(() => {
    if (line) onLineRef.current?.(line, idx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playKey, idx]);

  // 대사 타자음: 글자가 한 자씩 나올 때만, 2~3자마다 한 번(즉시·읽은 대사·건너뛰기 = 소리 없음). 음색은 화자 '종류'로만
  const blip = useRef({ key: '', len: 0, n: 0 });
  const shownLen = tw.shown.length;
  const every = instantNow ? 0 : blipEvery(game.settings.speed);
  useEffect(() => {
    const b = blip.current;
    const k = `${playKey}:${idx}`;
    if (b.key !== k) {
      b.key = k;
      b.len = shownLen;
      b.n = 0;
      return;
    }
    const step = shownLen - b.len;
    b.len = shownLen;
    if (step !== 1 || !every || !line) return;
    b.n += 1;
    if (b.n % every === 1 || every === 1) playBlip(line.who);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownLen, playKey, idx]);

  // 길게 누르기로 훑는 동안(holding)에 끝난 줄은 읽음으로 치지 않는다 — 탭으로 지나간 줄만 기록(X12)
  useEffect(() => {
    if (tw.done && rk && !hold.current.holding) game.markRead([rk]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tw.done, rk]);

  // 넘기기 버튼이 켜진 직후 잠깐(400ms)은 누름을 흘려보낸다 — 대사창 오른쪽 위를 연타하던 엄지가 막 켜진 버튼에 걸리지 않게(UX-6)
  const armedAt = useRef(0);
  const swallow = useRef(false);
  useEffect(() => {
    if (plan.enabled) armedAt.current = Date.now();
  }, [plan.enabled]);

  // 넘기기 코치마크 자리(UX-7): 대사창 아래에 자리가 있으면 아래(엔딩·증언), 없으면(장소 화면 — 아래는 하단 바) 버튼보다 위
  const coachBelow = (() => {
    if (!coachOn || typeof window === 'undefined') return true;
    const r = tapRef.current?.getBoundingClientRect();
    return !r || r.bottom + 96 <= window.innerHeight;
  })();

  // [≫ 읽은 건 넘기기]가 처음 켜질 때 한 번만 안내(1회차에는 띄우지 않는다)
  useEffect(() => {
    if (!plan.enabled || coachOn || game.meta.plays < 1 || coachSeen('skipRead')) return;
    setCoachKey(lineKey);
    game.markCoach('skipRead');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.enabled]);

  // 키보드 진행: 시트가 없을 때만 포커스를 가져온다
  useEffect(() => {
    if (typeof document === 'undefined' || document.querySelector('.wt-sheet')) return;
    const a = document.activeElement;
    if (!a || a === document.body || (a as HTMLElement).closest?.('.wt-screen')) tapRef.current?.focus({ preventScroll: true });
  }, [playKey, idx]);

  const stopHold = () => {
    const h = hold.current;
    if (h.start) clearTimeout(h.start);
    if (h.tick) clearInterval(h.tick);
    h.start = null;
    h.tick = null;
    h.holding = false;
  };
  // 언마운트·대사 교체 때 타이머를 남기지 않는다
  useEffect(() => stopHold, []);
  useEffect(() => {
    stopHold();
  }, [playKey]);

  if (!line) return null;
  const voice = voiceOf(line.who);
  const name = line.who === 'NARR' ? '' : line.who === 'ME' ? '나' : nameOf(line.who, line.label);
  const last = idx >= lines.length - 1;
  const led = line.who === 'AI' ? ledOf(line.face) : undefined;

  const advance = () => {
    if (!tw.done) {
      tw.skip();
      return;
    }
    // 탭으로 지나가는 줄은 읽음(길게 누르는 중에 끝난 줄이어도, 사람이 탭해서 넘기면 읽은 것)
    if (rk) game.markRead([rk]);
    if (last) doneRef.current();
    else setSt({ k: playKey, i: idx + 1 });
  };
  // 연속 넘김 한 걸음: 글자가 나오는 중이면 완성, 다 나왔으면 다음 줄. 마지막 줄이면 멈춘다(끝내기는 탭으로)
  holdStepRef.current = () => {
    if (!tw.done) {
      tw.skip();
      hold.current.steps += 1;
    } else if (!last) {
      setSt({ k: playKey, i: idx + 1 });
      hold.current.steps += 1;
    } else stopHold();
  };
  const onDown = (e: React.PointerEvent) => {
    if (e.button !== undefined && e.button > 0) return;
    stopHold();
    hold.current.fired = false;
    hold.current.steps = 0;
    hold.current.start = setTimeout(() => {
      hold.current.start = null;
      hold.current.fired = true;
      hold.current.holding = true;
      holdStepRef.current();
      hold.current.tick = setInterval(() => holdStepRef.current(), HOLD_STEP_MS);
    }, LONG_PRESS_MS);
  };
  const onClick = () => {
    // 길게 눌렀다 뗀 뒤에 따라오는 클릭은 이미 넘긴 줄을 또 넘기므로 삼킨다.
    // 넘긴 게 없으면(마지막 줄의 느린 탭) 삼키지 않는다 — 그대로 두면 탭이 먹혀서 한 번 더 눌러야 한다
    if (hold.current.fired) {
      hold.current.fired = false;
      if (hold.current.steps > 0) return;
    }
    advance();
  };

  /** [≫ 읽은 건 넘기기] — 다음 '처음 보는 줄'로(없으면 블록 끝). 건너뛴 줄은 읽음으로 기록하지 않는다 */
  const skipRead = () => {
    if (swallow.current) {
      swallow.current = false;
      return;
    }
    if (!plan.enabled) return;
    stopHold();
    if (plan.to === null) {
      doneRef.current();
      return;
    }
    if (plan.carry) onLineRef.current?.({ who: plan.carry.who, face: plan.carry.face, text: '' }, plan.to - 1);
    setSt({ k: playKey, i: plan.to });
  };

  return (
    <div className={['wt-dialogue', className].filter(Boolean).join(' ')} data-voice={voice} data-spk={line.who} data-led={led}>
      <div className="wt-sr" role="log" aria-live="polite">
        {spokenText(line)}
      </div>
      <button
        ref={tapRef}
        type="button"
        className="wt-dialogue-tap"
        onClick={onClick}
        onPointerDown={onDown}
        onPointerUp={stopHold}
        onPointerLeave={stopHold}
        onPointerCancel={stopHold}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          // 키를 누르고 있어도(Enter 자동 반복) 줄이 줄줄이 넘어가지 않게 한다 — 연속 넘김은 길게 누르기로만
          hold.current.fired = false;
          if (e.repeat) e.preventDefault();
        }}
        aria-label={tw.done ? (last ? '대사 닫기' : '다음 대사') : '대사 모두 보기'}
      />
      <div className="wt-dialogue-visual" aria-hidden>
        {voice !== 'narr' && (
          <span className="wt-nametag" data-spk={line.who}>
            <i className="wt-nametag-led" />
            <span>{name}</span>
          </span>
        )}
        {voice === 'cop' && (
          <span className="wt-dialogue-avatar">
            <ArtSlot kind="portrait" who="COP" face={line.face} crop="head" />
          </span>
        )}
        <p className="wt-dialogue-text">{tw.shown}</p>
        {voice === 'ai' && (
          <span className="wt-eq" data-on={tw.done ? undefined : '1'}>
            <i />
            <i />
            <i />
            <i />
            <i />
          </span>
        )}
        {!quiet && tw.done && <ChevronDown className="wt-next" size={18} />}
      </div>
      {readKey && (
        <button
          type="button"
          className="wt-skipread"
          data-on={plan.enabled ? '1' : undefined}
          disabled={!plan.enabled}
          aria-hidden={plan.enabled ? undefined : true}
          tabIndex={plan.enabled ? 0 : -1}
          onPointerDown={() => {
            swallow.current = Date.now() - armedAt.current < SKIP_ARM_MS;
          }}
          onClick={skipRead}
          data-testid="skip-read"
        >
          {REPLAY_TEXT.skipRead}
        </button>
      )}
      {coachOn && <CoachBubble text={COACH_TEXT.skipRead} placement={coachBelow ? 'top' : 'bottom'} className={coachBelow ? 'wt-coach--skipread' : 'wt-coach--skipread-up'} onDismiss={() => setCoachKey(null)} />}
    </div>
  );
}
