/**
 * §5-8 RoleCard — 호패(끈 구멍 + 나무결 프레임) + SectionChips + SealedCard.
 * 섹션별 렌더: 정체(범인이면 '정체' 섹션이 **열린 상태에서만** SealStamp "범인"), 신분(역할명+프로필),
 * 비밀, 그날 밤(시각 리스트), 거짓말(불릿), 미션(손글씨 메모), 말투(손글씨 ×2~3).
 * 비밀 섹션 끝엔 라운드 잠금 블록(「R3에 떠오르는 기억」)이 따로 쪽을 차지한다 — 잠긴 동안엔 안내 한 줄만.
 * 「R2부터」「R3부터」 표기는 글자 그대로 두고 배지(RoundTagText)로만 꾸민다.
 */
'use client';

import { useState } from 'react';
import { paginateItems, paginateText } from './paginate';
import type { SealedCardPages } from './SealedCard';
import { SealedCard } from './SealedCard';
import { SealStamp } from './SealStamp';
import { RoundTagText } from './RoundTagText';
import { SectionChips } from './SectionChips';
import type { MemoryContent, NightBeat, PressBind, RoleCardContent, SealMode, SectionKey } from './types';
import { sectionText } from './types';

type Chunk = { body?: string; list?: string[]; night?: NightBeat[]; memory?: MemoryContent };

/** 섹션 → 쪽(한 화면 분량) 목록. '비밀'이면 잠금 블록 쪽을 뒤에 붙인다. */
function buildChunks(content: RoleCardContent, section: SectionKey): Chunk[] {
  const full = sectionText(content, section);
  // D3: '정체'는 절대 쪽을 나누지 않는다 — 범인 문구만 길어 봉인면에 "1/2" 칩이 뜨면 어깨 너머로 범인이 드러난다
  const chunks: Chunk[] = full.body
    ? (section === 'identity' ? [full.body] : paginateText(full.body)).map((body) => ({ body }))
    : full.list
      ? paginateItems(full.list, (x) => x.length + 8).map((list) => ({ list }))
      : full.night
        ? paginateItems(full.night, (b) => b.time.length + b.text.length + 10).map((night) => ({ night }))
        : [{}];
  if (section === 'secret') {
    for (const m of content.memories ?? []) {
      if (m.lines?.length) {
        for (const lines of paginateItems(m.lines, (x) => x.length + 8)) chunks.push({ memory: { ...m, lines } });
      } else {
        chunks.push({ memory: { title: m.title, round: m.round, lockedHint: m.lockedHint } });
      }
    }
  }
  return chunks;
}

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
  pages?: SealedCardPages;
  className?: string;
  /** 'memory' — 처음 그릴 때 '비밀' 섹션의 잠금 블록 쪽부터 연다(「새 기억이 떠올랐소」 → 내 패에서 보기) */
  startAt?: 'memory';
}

export function RoleCard({ content, activeSection, onSectionChange, open, mode, pressBind, holdProgress, tapRemainingMs, tapTotalMs, watermark, pages, className, startAt }: RoleCardProps) {
  const full = sectionText(content, activeSection);
  const chunks = buildChunks(content, activeSection);
  // §5-7 쪽 나눔 — 꾹 누른 채로는 스크롤이 안 되므로 한 화면 분량으로 자른다(섹션이 바뀌면 1쪽부터)
  const [pageState, setPageState] = useState<{ section: SectionKey; index: number }>(() => ({
    section: activeSection,
    index: startAt === 'memory' ? Math.max(0, chunks.findIndex((ch) => ch.memory)) : 0,
  }));
  const pageIndex = pageState.section === activeSection ? Math.min(pageState.index, chunks.length - 1) : 0;
  const section = { title: full.title, ...chunks[pageIndex] };
  // D3(QA BUG-01): 쪽 칩은 섹션·역할과 무관하게 **늘** 둔다 — 쪽이 여러 장일 때만 칩이 있으면 그 존재 자체가 내용 길이를 흘린다.
  const autoPages: SealedCardPages = { index: pageIndex, count: chunks.length, onChange: (index) => setPageState({ section: activeSection, index }) };

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
          pages={pages ?? autoPages}
          renderContent={() => (
            <div className="gu-hopae-content">
              <h3 className="gu-hopae-section-title gu-display">{section.title}</h3>
              {activeSection === 'identity' && pageIndex === 0 && content.isCulprit && <SealStamp text="범인" size={56} className="gu-hopae-stamp" />}
              {activeSection === 'profile' && pageIndex === 0 && <p className="gu-hopae-rolename gu-display">{content.roleName}</p>}
              {section.body && (
                <p className="gu-hopae-body">
                  <RoundTagText text={section.body} current={content.round} />
                </p>
              )}
              {section.memory && <MemoryBlock memory={section.memory} />}
              {section.night && (
                <ul className="gu-hopae-night">
                  {section.night.map((b, i) => (
                    <li key={i}>
                      <span className="gu-hopae-night-time">{b.time}</span>
                      <span>{b.text}</span>
                    </li>
                  ))}
                </ul>
              )}
              {section.list && activeSection === 'speech' && (
                <ul className="gu-hopae-speech">
                  {section.list.map((s, i) => (
                    <li key={i} className="gu-font-hand">
                      “{s}”
                    </li>
                  ))}
                </ul>
              )}
              {section.list && activeSection !== 'speech' && (
                <ul className="gu-hopae-list">
                  {section.list.map((s, i) => (
                    <li key={i}>
                      <RoundTagText text={s} current={content.round} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        />
      </div>
    </div>
  );
}

/** 라운드 잠금 블록 한 쪽 — 열린 뒤엔 촛불 테두리 + 줄 목록, 잠긴 동안엔 안내 한 줄(본문 없음) */
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
