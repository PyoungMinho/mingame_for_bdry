/**
 * §5-4 BottomTabs — 60px + safe-area. 방장 첫 탭 '진행'(Landmark) / 플레이어 '지금'(Footprints).
 * 탭 전환 시 모든 봉인 카드를 재봉인해야 한다(§1-4) — 그 호출은 상위(screens)가 onChange 안에서 한다.
 */
import { Contact, Footprints, Landmark, ScrollText } from 'lucide-react';

export type GuTabKey = 'progress' | 'cards' | 'clues';

export interface BottomTabsProps {
  role: 'host' | 'player';
  active: GuTabKey;
  onChange: (key: GuTabKey) => void;
  /** 단서함 뱃지 — 예: 아직 공개 여부를 정하지 않은 단서 수 */
  clueBadge?: number;
  className?: string;
}

export function BottomTabs({ role, active, onChange, clueBadge, className }: BottomTabsProps) {
  const progressLabel = role === 'host' ? '진행' : '지금';
  const ProgressIcon = role === 'host' ? Landmark : Footprints;
  const tabs: { key: GuTabKey; label: string; icon: typeof Landmark; badge?: number }[] = [
    { key: 'progress', label: progressLabel, icon: ProgressIcon },
    { key: 'cards', label: '내 패', icon: Contact },
    { key: 'clues', label: '단서함', icon: ScrollText, badge: clueBadge },
  ];
  return (
    <nav className={['gu-tabbar', className ?? ''].filter(Boolean).join(' ')} aria-label="화면 전환">
      {tabs.map((t) => {
        const Icon = t.icon;
        const isActive = active === t.key;
        return (
          <button key={t.key} type="button" className="gu-tab" data-active={isActive || undefined} onClick={() => onChange(t.key)} aria-current={isActive ? 'page' : undefined}>
            <span className="gu-tab-iconwrap">
              <Icon aria-hidden size={24} />
              {!!t.badge && (
                <span className="gu-tab-badge" aria-hidden>
                  {t.badge > 9 ? '9+' : t.badge}
                </span>
              )}
            </span>
            <span className="gu-tab-label">{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
