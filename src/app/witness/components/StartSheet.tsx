'use client';

/**
 * 새 수사 시트(witness-replay.md §g-3) — 2회차부터, 기억할 증거가 있을 때 진입 3곳(타이틀·엔딩·배제 화면) 공통으로 뜬다.
 *   [ 기억 이어가기 ]  증거 n개 들고 · 최고 B        ← 위(고정)
 *   [ 처음부터 ]       빈손 · 최고 S · 최단 기록       ← 아래(고정)
 * 위치·순서는 고정이고 주 버튼 색만 직전 결과로 바뀐다(실패면 기억, 완벽·숨은이면 처음부터). 직전 선택을 기본값으로 기억하지 않는다(실수 진입 방지).
 * 저장된 판이 있으면 경고 한 줄(「저장된 수사는 사라져요」 · 되감기 대기 판이면 「되감기 기회도 사라져요」)을 이 시트에 합친다 — 확인 시트를 따로 거치지 않는다(3탭이 아니다).
 * 1회차(plays 0)·기억할 증거 0개에서는 이 시트가 뜨지 않는다(호출자가 recallPlan 으로 거른다).
 */
import type { RecallPlan } from '@/lib/witness';
import { REPLAY_TEXT } from '../lib/copy';
import { BottomSheet } from './BottomSheet';

export interface StartSheetProps {
  open: boolean;
  plan: RecallPlan;
  /** 저장된(되감기 가능하거나 진행 중인) 판이 있으면 경고 문구, 없으면 null */
  warn: string | null;
  /** 주 버튼으로 칠할 쪽(직전 결과로 정한다) */
  primary: 'recall' | 'fresh';
  onRecall: () => void;
  onFresh: () => void;
  onClose: () => void;
}

export function StartSheet({ open, plan, warn, primary, onRecall, onFresh, onClose }: StartSheetProps) {
  const opt = (kind: 'recall' | 'fresh') => ({
    className: `wt-btn wt-btn--full wt-startopt ${primary === kind ? 'wt-btn--primary' : 'wt-btn--secondary'}`,
    'data-primary': primary === kind ? '1' : undefined,
    'data-autofocus': primary === kind ? '' : undefined,
  });
  return (
    <BottomSheet open={open} title={REPLAY_TEXT.sheetTitle} onClose={onClose} height="confirm" className="wt-sheet--start">
      {warn && (
        <p className="wt-start-warn" data-testid="start-warn">
          {warn}
        </p>
      )}
      <div className="wt-start-opts">
        <button type="button" {...opt('recall')} onClick={onRecall} data-testid="start-recall">
          <b>{REPLAY_TEXT.recall}</b>
          <small>{REPLAY_TEXT.recallSub(plan.count)}</small>
        </button>
        <button type="button" {...opt('fresh')} onClick={onFresh} data-testid="start-fresh">
          <b>{REPLAY_TEXT.fresh}</b>
          <small>{REPLAY_TEXT.freshSub}</small>
        </button>
      </div>
    </BottomSheet>
  );
}
