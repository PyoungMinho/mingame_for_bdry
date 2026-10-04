'use client';

/**
 * 비용 프롬프트(디자인 §5-3) — 유료 행동은 항상 2탭. 자동으로 행동을 쓰는 경로는 없다.
 *  남은 행동 ≥ 3 → 인라인 띠 · = 2 → 확인 시트(초기 포커스 [돌아간다]) · = 1 → 마지막 행동 시트(3변형).
 * 문구는 대본 6장 + 디자인 §5-3 표 그대로. 정답·결과를 암시하지 않는다.
 */
import { Siren } from 'lucide-react';
import { useState } from 'react';
import { stars as starsOf, rulesOf, type RunCore } from '@/lib/witness';
import { LAST_ACTION, SPEND_TEXT } from '../lib/copy';
import { BottomSheet, ConfirmSheet } from './BottomSheet';

export interface SpendTarget {
  kind: 'location' | 'set' | 'precise' | 'hint';
  id?: string;
  /** 장소·정밀 라벨 / 증언은 「인물 「제목」」 */
  label: string;
  /** 정밀 조사 누르기 전 작가 문구 */
  preNote?: string;
  hintsLeft?: number;
}

export function useSpend(): { target: SpendTarget | null; request: (t: SpendTarget) => void; cancel: () => void } {
  const [target, setTarget] = useState<SpendTarget | null>(null);
  return { target, request: setTarget, cancel: () => setTarget(null) };
}

function lineOf(t: SpendTarget, left: number): { main: string; sub?: string } {
  const arrow = `행동 1 (${left} → ${left - 1})`;
  switch (t.kind) {
    case 'location':
      return { main: `${t.label} · 처음 들어간다 · ${arrow}` };
    case 'set':
      return { main: `${t.label} · 처음 듣는다 · ${arrow}` };
    case 'precise':
      return { main: t.preNote ?? '꼼꼼히 살펴야 한다.', sub: SPEND_TEXT.preciseMore(left) };
    default:
      return { main: `수첩 정리 · ${arrow} · 남은 ${t.hintsLeft ?? 0}회`, sub: SPEND_TEXT.hintExplain };
  }
}

const YES: Record<SpendTarget['kind'], string> = { location: '들어간다', set: '듣는다', precise: '조사한다', hint: '정리한다' };
const NO: Record<SpendTarget['kind'], string> = { location: '닫기', set: '닫기', precise: '나중에', hint: '닫기' };

export interface SpendPromptProps {
  run: RunCore;
  target: SpendTarget;
  onConfirm: () => void;
  onCancel: () => void;
  /** 마지막 행동 시트의 「수첩 먼저 보기」(수첩 안에서는 생략) */
  onOpenNotebook?: () => void;
  /** 첫 유료 프롬프트 코치 문구 */
  coach?: string;
}

export function SpendPrompt({ run, target, onConfirm, onCancel, onOpenNotebook, coach }: SpendPromptProps) {
  const left = run.actions;
  const { main, sub } = lineOf(target, left);

  if (left >= 3) {
    return (
      <div className="wt-spend" role="group" aria-label="행동을 쓸까요">
        <p className="wt-spend-main">{main}</p>
        {sub && <p className="wt-spend-sub">{sub}</p>}
        {coach && <p className="wt-spend-coach">{coach}</p>}
        <div className="wt-actions">
          <button type="button" className="wt-btn wt-btn--primary" onClick={onConfirm} data-testid="spend-yes">
            {YES[target.kind]}
          </button>
          <button type="button" className="wt-btn wt-btn--secondary" onClick={onCancel} data-testid="spend-no">
            {NO[target.kind]}
          </button>
        </div>
      </div>
    );
  }

  if (left === 2) {
    return (
      <ConfirmSheet open title={SPEND_TEXT.confirmTitle(left)} confirmLabel="쓴다" cancelLabel="돌아간다" onConfirm={onConfirm} onCancel={onCancel} focus="cancel" confirmTestId="spend-yes">
        <p className="wt-spend-main">{main}</p>
        {sub && <p className="wt-spend-sub">{sub}</p>}
        <p className="wt-spend-ask">{SPEND_TEXT.ask}</p>
      </ConfirmSheet>
    );
  }

  // 남은 행동 1 — 마지막 행동 시트
  const gate = starsOf(run) >= rulesOf(run).starGate;
  let note: string;
  if (target.kind === 'set') note = LAST_ACTION.setNote;
  else if (!gate) note = LAST_ACTION.noGate(rulesOf(run).starGate - starsOf(run));
  else note = target.kind === 'hint' ? LAST_ACTION.hintNoteGate : LAST_ACTION.placeNoteGate;
  return (
    <BottomSheet open title={LAST_ACTION.title} onClose={onCancel} height="auto" hideTitle className="wt-sheet--last">
      <p className="wt-last-head">
        <Siren size={18} aria-hidden /> <b>{LAST_ACTION.title}</b>
      </p>
      <p className="wt-spend-main">{main}</p>
      <p className="wt-last-body">{LAST_ACTION.body1}</p>
      <p className="wt-last-body">{LAST_ACTION.body2}</p>
      <p className="wt-last-note">{note}</p>
      {gate && <p className="wt-last-sub">{LAST_ACTION.sub}</p>}
      <div className="wt-actions wt-actions--stack">
        <button type="button" className="wt-btn wt-btn--primary" onClick={onCancel} data-autofocus="">
          돌아간다
        </button>
        <button type="button" className="wt-btn wt-btn--outline" onClick={onConfirm} data-testid="spend-yes">
          그래도 한다
        </button>
        {onOpenNotebook && (
          <button type="button" className="wt-link" onClick={onOpenNotebook}>
            수첩 먼저 보기
          </button>
        )}
      </div>
    </BottomSheet>
  );
}
