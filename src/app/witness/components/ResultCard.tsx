'use client';

/**
 * 돌파 결과 카드(W11, 디자인 §5-11) — 모든 돌파 뒤에 항상 띄운다. 해금이 없으면 축약형.
 * 「새로 열린 것」은 Unlock[] 이 아니라 돌파 전후 '열린 것'의 차이(engine.diffOpened)로 만든다(D18).
 * 모달이다(바깥 탭으로는 닫히지 않지만, 닫기(X)·Esc·뒤로가기로 닫을 수 있다 — [계속 추궁] 과 같다). 유료 대상으로 [바로 가기]하면 호출자가 비용 프롬프트를 거친다 — 자동으로 행동을 쓰지 않는다.
 */
import { BadgeAlert, BookOpen, ChevronDown, DoorOpen, Diamond, Search, ScrollText, Star, User, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { OpenedItem } from '@/lib/witness';
import { REPLAY_TEXT } from '../lib/copy';
import { gotoTarget, openedLine, type OpenedLine } from '../lib/format';
import { ActionChip } from './ActionChip';
import { BottomSheet } from './BottomSheet';

const ICON: Record<OpenedLine['icon'], React.ReactNode> = {
  set: <User size={16} aria-hidden />,
  confront: <Users size={16} aria-hidden />,
  location: <DoorOpen size={16} aria-hidden />,
  hotspot: <Search size={16} aria-hidden />,
  evidence: <ScrollText size={16} aria-hidden />,
  upgrade: <BadgeAlert size={16} aria-hidden />,
  secret: <BookOpen size={16} aria-hidden />,
};

export interface ResultCardProps {
  open: boolean;
  tier: 'star' | 'minor';
  revisedText?: string;
  /** 정정 진술 이름표 — 권한 해제(permission) 돌파면 「권한 해제」 */
  revisedLabel?: string;
  items: OpenedItem[];
  /** ★ 신뢰 변화(+1, 이미 최대면 0). null 이면 신뢰 줄을 그리지 않는다(새로고침 복원 — 직전 값을 모른다) */
  trustDelta: number | null;
  /** ★ 결정적 모순을 깬 직후의 누적 개수(스크린 리더용 — 카드가 뜨는 순간 몇 개째인지 바로 읽는다) */
  starCount?: number;
  coach?: string;
  /** 이 돌파의 '새로 열린 것'을 전에 본 적이 있다 → 한 줄 칩으로 접는다(탭하면 펼친다, 사양 f · X15) */
  folded?: boolean;
  onContinue: () => void;
  onGoto: (item: OpenedItem) => void;
}

export function ResultCard({ open, tier, revisedText, revisedLabel, items, trustDelta, starCount, coach, folded, onContinue, onGoto }: ResultCardProps) {
  const lines = items.map(openedLine);
  const [expanded, setExpanded] = useState(false);
  // 카드가 새로 열릴 때마다 접힘 상태를 처음으로
  useEffect(() => {
    if (open) setExpanded(false);
  }, [open]);
  const collapsed = !!folded && !expanded;
  const target = gotoTarget(items);
  const isStar = tier === 'star';
  return (
    // 닫기(X) · Esc · 뒤로가기 = [계속 추궁] 과 같다(아무것도 잃지 않는다). 바깥 탭은 실수로 닫히지 않게 막는다.
    <BottomSheet open={open} title={isStar ? '결정적 모순' : '모순 해소'} onClose={onContinue} variant="modal" scrimDismiss={false} hideTitle className="wt-sheet--result">
      <div className="wt-result" data-tier={tier}>
        <h2 className="wt-result-title wt-display">
          {isStar ? <Star size={22} aria-hidden /> : <Diamond size={22} aria-hidden />}
          <span>{isStar ? '결정적 모순' : '모순 해소'}</span>
          {isStar && starCount !== undefined && starCount > 0 && <span className="wt-sr">{`, ${starCount}번째`}</span>}
        </h2>
        {revisedText && (
          <p className="wt-result-revised">
            <small>{revisedLabel ?? '정정 진술'}</small>
            <span>「{revisedText}」</span>
          </p>
        )}
        {lines.length > 0 && collapsed && (
          <button type="button" className="wt-result-fold" onClick={() => setExpanded(true)} aria-expanded={false} data-testid="result-fold">
            <span>{REPLAY_TEXT.openedFold(lines.length)}</span>
            <ChevronDown size={16} aria-hidden />
          </button>
        )}
        {lines.length > 0 && !collapsed && (
          <>
            <p className="wt-result-sec">새로 열린 것</p>
            <ul className="wt-result-list">
              {lines.map((l) => (
                <li key={l.key}>
                  <span className="wt-result-ic">{ICON[l.icon]}</span>
                  <span className="wt-result-tx">{l.text}</span>
                  {l.chip && <ActionChip kind={l.chip.tone === 'free' ? 'free' : l.chip.tone === 'new' ? 'new' : 'cost'} label={l.chip.text} />}
                </li>
              ))}
            </ul>
          </>
        )}
        {isStar && trustDelta !== null && <p className="wt-result-trust">{trustDelta > 0 ? `신뢰 +${trustDelta}` : '신뢰 최대'}</p>}
        {coach && <p className="wt-result-coach">{coach}</p>}
        <div className="wt-actions">
          {target ? (
            <>
              <button type="button" className="wt-btn wt-btn--secondary" onClick={onContinue} data-testid="result-continue">
                계속 추궁
              </button>
              <button type="button" className="wt-btn wt-btn--primary" onClick={() => onGoto(target)} data-autofocus="" data-testid="result-goto">
                바로 가기 ▸
              </button>
            </>
          ) : (
            <button type="button" className="wt-btn wt-btn--primary wt-btn--full" onClick={onContinue} data-autofocus="" data-testid="result-continue">
              계속
            </button>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}
