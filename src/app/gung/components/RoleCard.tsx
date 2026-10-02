/**
 * §5-8 RoleCard — 호패(끈 구멍 + 나무결 프레임) + SectionChips + SealedCard.
 * 섹션별 렌더: 정체(범인이면 '정체' 섹션이 **열린 상태에서만** SealStamp "범인"), 신분(역할명+프로필),
 * 비밀, 그날 밤(시각 리스트), 거짓말(불릿), 미션(손글씨 메모), 말투(손글씨 ×2~3).
 * 비밀 섹션 끝엔 라운드 잠금 블록(「R3에 떠오르는 기억」)이 따로 붙는다.
 * 「R2부터」「R3부터」 표기는 글자 그대로 두고 배지(RoundTagText)로만 꾸민다.
 *
 * PM 피드백(쪽 나눔 폐지) — 그날 밤·거짓말·미션·말투처럼 항목이 여럿인 섹션은 원고 줄 구분을 살려
 * ①②③ 번호 목록으로 한 화면에 다 보여준다(SealedCard가 글자 크기를 알아서 줄인다). 더는 쪽을 나누지 않으므로
 * 섹션을 바꾸면(= 봉인이 다시 걸리면) 그다음 열 때 늘 처음부터 전체가 보인다 — "몇 쪽인지 모르겠다"는 불만 자체가 사라진다.
 */
'use client';

import { useEffect, useRef } from 'react';
import { circledNum } from './numbering';
import { SealedCard } from './SealedCard';
import { SealStamp } from './SealStamp';
import { RoundTagText } from './RoundTagText';
import { SectionChips } from './SectionChips';
import type { MemoryContent, PressBind, RoleCardContent, SealMode, SectionKey } from './types';
import { sectionText } from './types';

export interface RoleCardProps {
  content: RoleCardContent;
  activeSection: SectionKey;
  onSectionChange: (section: SectionKey) => void;
  open: boolean;
  mode: SealMode;
  pressBind?: PressBind;
  holdProgress?: number;
  tapRemainingMs?: number;
  tapTotalMs?: number;
  watermark?: string;
  className?: string;
  /** 'memory' — 처음 그릴 때 '비밀' 섹션을 열면 새로 풀린 기억 블록이 보이도록 그리로 스크롤한다(「새 기억이 떠올랐소」 알림 뒤) */
  startAt?: 'memory';
}

export function RoleCard({ content, activeSection, onSectionChange, open, mode, pressBind, holdProgress, tapRemainingMs, tapTotalMs, watermark, className, startAt }: RoleCardProps) {
  const full = sectionText(content, activeSection);
  const memoryRef = useRef<HTMLDivElement>(null);

  // 「새 기억이 떠올랐소」에서 들어왔으면 — 비밀 섹션을 열 때 새 기억 블록이 보이는 자리로 스크롤(내용은 처음부터 전부 그려진다)
  useEffect(() => {
    if (open && startAt === 'memory' && activeSection === 'secret') {
      memoryRef.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [open, startAt, activeSection]);

  return (
    <div className={['gu-rolecard', className ?? ''].filter(Boolean).join(' ')}>
      <SectionChips active={activeSection} onChange={onSectionChange} />
      <div className="gu-hopae">
        <span className="gu-hopae-hole" aria-hidden />
        <SealedCard
          seatLabel={content.seatLabel}
          mode={mode}
          open={open}
          pressBind={pressBind}
          holdProgress={holdProgress}
          tapRemainingMs={tapRemainingMs}
          tapTotalMs={tapTotalMs}
          watermark={watermark}
          renderContent={() => (
            <div className="gu-hopae-content">
              <h3 className="gu-hopae-section-title gu-display">{full.title}</h3>
              {activeSection === 'identity' && content.isCulprit && <SealStamp text="범인" size={56} className="gu-hopae-stamp" />}
              {activeSection === 'profile' && <p className="gu-hopae-rolename gu-display">{content.roleName}</p>}
              {full.body && (
                <p className="gu-hopae-body">
                  <RoundTagText text={full.body} current={content.round} />
                </p>
              )}
              {activeSection === 'secret' &&
                content.memories?.map((m, i) => (
                  <div key={i} ref={i === 0 ? memoryRef : undefined}>
                    <MemoryBlock memory={m} />
                  </div>
                ))}
              {full.night && (
                <ol className="gu-hopae-night gu-numlist">
                  {full.night.map((b, i) => (
                    <li key={i}>
                      <span className="gu-numitem-mark" aria-hidden>
                        {circledNum(i + 1)}
                      </span>
                      <span>
                        {b.time && <span className="gu-hopae-night-time">{b.time}</span>}
                        {b.text}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
              {full.list && activeSection === 'speech' && (
                <ol className="gu-hopae-speech gu-numlist">
                  {full.list.map((s, i) => (
                    <li key={i} className="gu-font-hand">
                      <span className="gu-numitem-mark" aria-hidden>
                        {circledNum(i + 1)}
                      </span>
                      “{s}”
                    </li>
                  ))}
                </ol>
              )}
              {full.list && activeSection !== 'speech' && (
                <ol className="gu-hopae-list gu-numlist">
                  {full.list.map((s, i) => (
                    <li key={i}>
                      <span className="gu-numitem-mark" aria-hidden>
                        {circledNum(i + 1)}
                      </span>
                      <span>
                        <RoundTagText text={s} current={content.round} />
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        />
      </div>
    </div>
  );
}

/** 라운드 잠금 블록 — 열린 뒤엔 촛불 테두리 + 줄 목록, 잠긴 동안엔 안내 한 줄(본문 없음) */
export function MemoryBlock({ memory }: { memory: MemoryContent }) {
  const unlocked = Boolean(memory.lines?.length);
  return (
    <div className="gu-memory" data-locked={!unlocked || undefined}>
      <p className="gu-memory-head">
        <span className="gu-rtag" data-state={unlocked ? 'open' : 'locked'}>
          R{memory.round}
        </span>
        <span className="gu-memory-title">{memory.title}</span>
      </p>
      {unlocked ? (
        <ul className="gu-memory-lines">
          {memory.lines!.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      ) : (
        memory.lockedHint && <p className="gu-memory-locked">{memory.lockedHint}</p>
      )}
    </div>
  );
}
