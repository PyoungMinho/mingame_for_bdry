'use client';

import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { CHAPTERS, COMPANIONS, ITEMS, LOCATIONS } from '@/lib/zombie/contract';
import { formatClock, type RunState } from '@/lib/zombie/engine';
import type { ChapterId, LocationId } from '@/lib/zombie/types';
import { CompanionBadge } from './Hud';
import { SeoulMap } from './SeoulMap';

const CHAPTER_IDS: ChapterId[] = [1, 2, 3, 4, 5];

export function ChapterTrack({ chapter }: { chapter: ChapterId }) {
  return (
    <ol className="zb-track" aria-label="챕터 진행">
      {CHAPTER_IDS.map((c) => (
        <li key={c} data-state={c < chapter ? 'done' : c === chapter ? 'now' : 'next'} aria-current={c === chapter ? 'step' : undefined}>
          <span className="zb-track-no">{c}</span>
          <span className="zb-track-name">{CHAPTERS[c].name}</span>
        </li>
      ))}
    </ol>
  );
}

export function MapPanel({ state, current, chapter }: { state: RunState; current: LocationId; chapter: ChapterId }) {
  const log = [...state.history].reverse();
  return (
    <div className="zb-panel-body">
      <section aria-label="지도">
        <h2 className="zb-panel-h">작전지도</h2>
        <SeoulMap route={state.route} current={current} />
      </section>
      <section aria-label="챕터">
        <ChapterTrack chapter={chapter} />
      </section>
      <section aria-label="선택 기록">
        <h2 className="zb-panel-h">생존 기록 · {state.history.length}번의 선택</h2>
        {log.length === 0 ? (
          <p className="zb-empty">아직 아무것도 고르지 않았다.</p>
        ) : (
          <ol className="zb-journal">
            {log.map((h, i) => (
              <li key={`${h.nodeId}-${i}`}>
                <span className="zb-journal-when">
                  {formatClock(h.clock)} · {LOCATIONS[h.location].name}
                </span>
                <span className="zb-journal-title">{h.title}</span>
                <span className="zb-journal-choice">▸ {h.choiceLabel}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

export function BagPanel({ state }: { state: RunState }) {
  return (
    <div className="zb-panel-body">
      <section aria-label="동료">
        <h2 className="zb-panel-h">동행 · {state.companions.length}</h2>
        {state.companions.length === 0 ? (
          <p className="zb-empty">혼자다.</p>
        ) : (
          <ul className="zb-people">
            {state.companions.map((c) => (
              <li key={c}>
                <CompanionBadge id={c} size="md" />
                <div>
                  <p className="zb-people-name">
                    {COMPANIONS[c].name} <span>{COMPANIONS[c].role}</span>
                  </p>
                  <p className="zb-people-desc">{COMPANIONS[c].desc}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
        {state.lost.length > 0 && (
          <p className="zb-lost">
            잃은 사람들 — {state.lost.map((c) => COMPANIONS[c].name).join(', ')}
          </p>
        )}
      </section>
      <section aria-label="소지품">
        <h2 className="zb-panel-h">가방 · {state.items.length}</h2>
        {state.items.length === 0 ? (
          <p className="zb-empty">가방이 비어 있다.</p>
        ) : (
          <ul className="zb-items">
            {state.items.map((i) => (
              <li key={i}>
                <p className="zb-items-name">{ITEMS[i].name}</p>
                <p className="zb-items-desc">{ITEMS[i].desc}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/**
 * 바텀시트 다이얼로그. ESC·배경 클릭으로 닫히고, 열릴 때 닫기 버튼에 포커스,
 * Tab 은 시트 안에서만 순환하며, 닫히면 열기 전 포커스로 돌아간다.
 */
export function Drawer({ title, open, onClose, children }: { title: string; open: boolean; onClose: () => void; children: ReactNode }) {
  const close = useRef<HTMLButtonElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !sheet.current) return;
      const f = sheet.current.querySelectorAll<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])');
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      prevFocus?.focus?.({ preventScroll: true });
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="zb-drawer" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button type="button" className="zb-drawer-backdrop" aria-hidden tabIndex={-1} onClick={onClose} />
      <div className="zb-drawer-sheet" ref={sheet}>
        <div className="zb-drawer-head">
          <span className="zb-drawer-grip" aria-hidden />
          <h2 id={titleId}>{title}</h2>
          <button ref={close} type="button" className="zb-icon-btn" onClick={onClose} aria-label="닫기">
            <X aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
