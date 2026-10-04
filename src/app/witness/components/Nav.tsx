'use client';

/**
 * 하단 탭바(집 안·사람·수첩) · 최종 지목 바 · 코치마크 말풍선 — 디자인 §3-3·§6-7.
 * 탭바는 허브·수첩에서만 보인다(조사·심문·대질·지목·엔딩에서는 숨김). 최종 지목 바는 ★ ≥ 3 에서만 자리를 차지한다.
 */
import { DoorOpen, Gavel, NotebookPen, Users } from 'lucide-react';
import type { HubTab } from '@/lib/witness';

export function BottomTabs({ tab, newDot, onTab }: { tab: HubTab; newDot?: boolean; onTab: (t: HubTab) => void }) {
  const items: { id: HubTab; label: string; icon: React.ReactNode }[] = [
    { id: 'house', label: '집 안', icon: <DoorOpen size={20} aria-hidden /> },
    { id: 'people', label: '사람', icon: <Users size={20} aria-hidden /> },
    { id: 'notebook', label: '수첩', icon: <NotebookPen size={20} aria-hidden /> },
  ];
  return (
    <nav className="wt-tabbar" aria-label="수사 메뉴">
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          className="wt-tab"
          aria-current={tab === it.id ? 'page' : undefined}
          data-active={tab === it.id ? '1' : undefined}
          onClick={() => onTab(it.id)}
          aria-label={it.id === 'notebook' && newDot ? '수첩 (새 내용 있음)' : it.label}
        >
          {it.icon}
          <span>{it.label}</span>
          {it.id === 'notebook' && newDot && <i className="wt-dot" aria-hidden />}
        </button>
      ))}
    </nav>
  );
}

export function AccuseBar({ onClick }: { onClick: () => void }) {
  return (
    <div className="wt-accusebar">
      <button type="button" className="wt-accusebar-btn" onClick={onClick} aria-label="최종 지목" aria-describedby="wt-accusebar-desc">
        <Gavel size={18} aria-hidden />
        <span id="wt-accusebar-desc">최종 지목 · 지금 넘길 수 있다</span>
      </button>
    </div>
  );
}

/** 코치마크 — 한 탭으로 닫히고 게임 입력을 막지 않는다. 부모는 position: relative */
export function CoachBubble({ text, onDismiss, placement = 'top', label = '알겠어요' }: { text: string; onDismiss: () => void; placement?: 'top' | 'bottom' | 'center' | 'dock'; label?: string }) {
  return (
    <div className={`wt-coach wt-coach--${placement}`} role="status">
      <p>{text}</p>
      <button type="button" className="wt-coach-ok" onClick={onDismiss}>
        {label}
      </button>
    </div>
  );
}
