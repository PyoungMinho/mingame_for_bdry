'use client';

import { ChevronRight, Lock } from 'lucide-react';
import { useEffect } from 'react';
import { visibleChoices, type RunState } from '@/lib/zombie/engine';
import type { StoryNode } from '@/lib/zombie/types';

/** 모달(드로어·다이얼로그)이 열려 있으면 전역 단축키를 멈춘다 */
export function modalOpen(): boolean {
  return Boolean(document.querySelector('.zb-shell [aria-modal="true"]'));
}

/** 선택지 목록. 1~4(또는 a~d) 키로도 고를 수 있다(열린 선택지만). */
export function ChoiceList({
  state,
  node,
  onChoose,
  disabled,
}: {
  state: RunState;
  node: StoryNode;
  onChoose: (id: string) => void;
  disabled?: boolean;
}) {
  const list = visibleChoices(state, node);

  useEffect(() => {
    if (disabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || modalOpen()) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const k = e.key.toLowerCase();
      const i = /^[1-4]$/.test(k) ? Number(k) - 1 : 'abcd'.indexOf(k);
      if (i < 0 || i >= list.length || list[i].status !== 'open') return;
      e.preventDefault();
      onChoose(list[i].choice.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [list, onChoose, disabled]);

  return (
    <ol className="zb-choices" aria-label="선택지 (숫자 1~4 키로도 고를 수 있어요)">
      {list.map(({ choice, status }, i) => (
        <li key={choice.id} style={{ ['--i' as string]: i }}>
          <button
            type="button"
            className="zb-choice"
            data-status={status}
            aria-disabled={status === 'locked' || undefined}
            aria-keyshortcuts={status === 'open' ? String(i + 1) : undefined}
            onClick={() => status === 'open' && onChoose(choice.id)}
          >
            <span className="zb-choice-key" aria-hidden>
              {status === 'locked' ? <Lock /> : i + 1}
            </span>
            <span className="zb-choice-main">
              <span className="zb-choice-label">{choice.label}</span>
              {status === 'locked' ? (
                <span className="zb-choice-locked">{choice.lockedHint}</span>
              ) : (
                choice.hint && <span className="zb-choice-hint">{choice.hint}</span>
              )}
            </span>
            {status === 'open' && <ChevronRight className="zb-choice-go" aria-hidden />}
          </button>
        </li>
      ))}
    </ol>
  );
}
