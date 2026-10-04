'use client';

/**
 * 대사창(디자인 §5-8) — 한 번에 한 줄. 글자가 나오는 중의 탭 = 그 줄 즉시 완성, 다 나온 뒤의 탭 = 다음 줄(탭 1번 = 다음 줄). Space/Enter 동일.
 * 길게 누르기(450ms) = 연속 넘김: 누르고 있는 동안 0.28초마다 줄을 완성하고 넘긴다. 마지막 줄에서 멈춘다 —
 * 대사를 끝내는 일(다음 단계로 넘어가는 일)은 꼭 탭 한 번으로 한다. 손을 뗄 때 이어지는 클릭은 삼킨다.
 * 단, 길게 누르는 동안 아무것도 넘기지 못했다면(마지막 줄에서 0.45초 넘게 누른 '느린 탭') 그 클릭은 보통 탭으로 처리한다.
 * 목소리 변형(data-voice): 사람(고딕) · 한결 · 나(명조 + 좌측 바) · 내레이션(패널 없음) · 또박이(고정폭 + 시안 틴트 + 이퀄라이저) · 기기.
 * 접근성: 화면 표시용 타이핑 사본은 aria-hidden, 같은 문장 전체를 sr-only role="log" 로 먼저 둔다.
 * 읽은 대사: meta.plays ≥ 1 + 설정 켬 + readLines 에 있으면 즉시 표시. 줄이 끝나면 읽음으로 기록한다.
 */
import { ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Dialogue } from '@/lib/witness';
import { ledOf, nameOf, spokenText } from '../lib/format';
import { useWt } from '../lib/context';
import { LONG_PRESS_MS } from '../lib/fx';
import { useTypewriter } from '../lib/useTypewriter';
import { ArtSlot } from './ArtSlot';

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
  /** 읽은 대사 기록 키의 접두(`${readKey}#${index}`) */
  readKey?: string;
  /** 즉시 표시(이미 추궁한 줄 등) */
  instant?: boolean;
  className?: string;
  /** 오른쪽 아래 진행 표시를 숨김 */
  quiet?: boolean;
}

export function DialogueBox({ lines, playKey, onDone, onLine, readKey, instant, className, quiet }: DialogueBoxProps) {
  const { game } = useWt();
  const [st, setSt] = useState({ k: playKey, i: 0 });
  const idx = st.k === playKey ? st.i : 0;
  if (st.k !== playKey) setSt({ k: playKey, i: 0 });
  const line = lines[Math.min(idx, Math.max(0, lines.length - 1))];
  const visible = useDocVisible();
  const rk = readKey ? `${readKey}#${idx}` : null;
  const known = rk ? game.isRead(rk) : false;
  const instantNow = !!instant || (game.meta.plays >= 1 && game.settings.readFast && known);
  const tw = useTypewriter(line?.text ?? '', game.settings.speed, { instant: instantNow, paused: !visible, resetKey: `${playKey}:${idx}` });
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const onLineRef = useRef(onLine);
  onLineRef.current = onLine;
  const tapRef = useRef<HTMLButtonElement>(null);
  const hold = useRef<{ start: ReturnType<typeof setTimeout> | null; tick: ReturnType<typeof setInterval> | null; fired: boolean; steps: number }>({ start: null, tick: null, fired: false, steps: 0 });
  const holdStepRef = useRef<() => void>(() => undefined);

  // 빈 대사는 곧바로 끝낸다
  useEffect(() => {
    if (lines.length === 0) doneRef.current();
  }, [playKey, lines.length]);

  useEffect(() => {
    if (line) onLineRef.current?.(line, idx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playKey, idx]);

  useEffect(() => {
    if (tw.done && rk) game.markRead([rk]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tw.done, rk]);

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
    </div>
  );
}
