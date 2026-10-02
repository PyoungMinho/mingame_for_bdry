/**
 * §5-10 ClueCard — undecided/private = SealedCard(꾹), public = 개봉 한지(낭독용 20px) + "공개" 도장.
 * D5: 미결정·비공개 단서는 봉인, 공개 단서는 개봉(숨길 이유가 없음).
 */
'use client';

import { useState } from 'react';
import { paginateText } from './paginate';
import { SealedCard } from './SealedCard';
import { SealStamp } from './SealStamp';
import { DisclosureToggle } from './DisclosureToggle';
import { TermList } from './Glossary';
import { PlaceIcon } from './icons';
import type { Disclosure, PlaceSummary, PressBind, SealMode, TermItem } from './types';

export interface ClueCardProps {
  roundNo: 1 | 2 | 3;
  place: PlaceSummary;
  clueId: string;
  clueText: string;
  disclosure: Disclosure;
  /** undecided/private 상태의 봉인 열림 여부 — 상위(useHoldReveal)가 제어 */
  open?: boolean;
  mode?: SealMode;
  pressBind?: PressBind;
  holdProgress?: number;
  onDisclose?: (value: 'public' | 'private') => void;
  /** 단서를 한 번이라도 연 뒤에만 true(§3 P6) */
  disclosureEnabled?: boolean;
  /** 카드 연동 용어(원고 1-6 「그 카드를 열었을 때만 ?로 보임」) — 봉인 중엔 그리지 않고, 연 동안 마지막 쪽 아래에만 */
  terms?: TermItem[];
  className?: string;
}

export function ClueCard({ roundNo, place, clueId, clueText, disclosure, open = false, mode = 'hold', pressBind, holdProgress, onDisclose, disclosureEnabled = false, terms, className }: ClueCardProps) {
  // §5-7 쪽 나눔 — 봉인 상태(꾹 누르는 동안)에서만. 공개된 단서는 봉인이 없으니 전문을 그대로 보인다.
  const [page, setPage] = useState(0);
  const chunks = paginateText(clueText);
  const pageIndex = Math.min(page, chunks.length - 1);
  return (
    <div className={['gu-cluecard', className ?? ''].filter(Boolean).join(' ')}>
      <div className="gu-cluecard-head">
        <span className="gu-cluecard-round">조사 {roundNo}</span>
        <PlaceIcon iconKey={place.icon} size={20} />
        <span className="gu-cluecard-place gu-display">{place.name}</span>
        {/* QA BUG-25: 인원별 교체 카드(HW-1b)의 'b'는 교체 사실을 드러낸다(원고 4-1 "교체 사실 비노출") — 표시는 기본 번호만 */}
        <span className="gu-cluecard-id gu-num">{clueId.replace(/[a-z]+$/, '')}</span>
      </div>

      {disclosure === 'public' ? (
        <div className="gu-cluecard-opened">
          <SealStamp text="공개" size={56} className="gu-cluecard-stamp" />
          <p className="gu-cluecard-text">{clueText}</p>
          {terms && <TermList terms={terms} variant="card" />}
          <p className="gu-cluecard-readout">📢 소리 내어 읽어주시오</p>
        </div>
      ) : (
        <>
          <SealedCard
            seatLabel={`조사 ${roundNo} · ${place.name} 단서`}
            mode={mode}
            open={open}
            pressBind={pressBind}
            holdProgress={holdProgress}
            pages={chunks.length > 1 ? { index: pageIndex, count: chunks.length, onChange: setPage } : undefined}
            renderContent={() => (
              <>
                <p className="gu-cluecard-text">{chunks[pageIndex]}</p>
                {terms && pageIndex === chunks.length - 1 && <TermList terms={terms} variant="card" />}
              </>
            )}
          />
          {onDisclose && (
            <div className="gu-cluecard-disclose">
              <p className="gu-cluecard-disclose-q">이 단서를 밝히겠소?</p>
              <DisclosureToggle value={disclosure === 'undecided' ? null : disclosure} enabled={disclosureEnabled} onChange={onDisclose} />
              {!disclosureEnabled && <p className="gu-cluecard-disclose-hint">단서를 한 번 연 뒤에만 고를 수 있어요</p>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
