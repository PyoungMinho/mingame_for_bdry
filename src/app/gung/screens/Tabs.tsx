'use client';

/**
 * T1 내 패 / T2 단서함 — §3 T1·T2. 둘 다 BottomTabs에서 띄우는 탭이면서, 플레이어의 cards 단계(P3)
 * 본문으로도 그대로 임베드된다(§3: "P3. 패 확인 = T1 RoleCard 임베드").
 */
import { useEffect, useState } from 'react';
import { getClue, type Assignment, type GungCase, type ResolvedSheet, type RoundNo } from '@/lib/gung';
import { ClueCard, RoleCard } from '../components';
import type { Disclosure, SectionKey, TermItem } from '../components/types';
import { useHoldReveal } from '../lib/useHoldReveal';
import { placeToSummary, sheetToContent } from './adapters';

export function MyCardTab({
  sheet,
  seat,
  sealEpoch,
  revealMode,
  focus,
}: {
  /** getSheet(…, reachedRound(phase)) — 이 폰의 진행 단계로 잠금 블록이 이미 걸러져 있어야 한다 */
  sheet: ResolvedSheet;
  seat: number;
  sealEpoch: unknown;
  revealMode: 'hold' | 'tap';
  /** 'memory' — 「새 기억이 떠올랐소」 알림에서 들어옴: '비밀' 섹션의 잠금 블록 쪽부터 */
  focus?: 'memory' | null;
}) {
  const [section, setSection] = useState<SectionKey>(focus === 'memory' ? 'secret' : 'identity');
  const reveal = useHoldReveal(revealMode, `${String(sealEpoch)}-${section}`);
  const content = sheetToContent(sheet, seat);
  // §10-1 워터마크 "3번 · 22:41" — 열린 상태에서만 그리므로 렌더 시각을 써도 서버 렌더와 불일치가 없다
  const watermark = reveal.open ? `${seat}번 · ${hhmm(new Date())}` : undefined;
  return (
    <RoleCard
      content={content}
      activeSection={section}
      onSectionChange={setSection}
      open={reveal.open}
      mode={reveal.mode}
      pressBind={reveal.pressBind}
      holdProgress={reveal.holdProgress}
      tapRemainingMs={reveal.tapRemainingMs}
      tapTotalMs={reveal.tapTotalMs}
      watermark={watermark}
      startAt={focus === 'memory' ? 'memory' : undefined}
    />
  );
}

function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export interface RoundClueState {
  placeId?: string;
  disclosure: Disclosure;
  opened: boolean;
}

export function CluesTab({
  c,
  a,
  seat,
  reachedRound,
  rounds,
  publicUpTo,
  sealEpoch,
  revealMode,
  onDisclose,
  onOpened,
  onPickNow,
}: {
  c: GungCase;
  a: Assignment;
  seat: number;
  reachedRound: 0 | RoundNo;
  rounds: Partial<Record<RoundNo, RoundClueState>>;
  /** 이 폰이 들어선 라운드까지의 공용·NPC 단서(지금 라운드 포함 — 원고 1-7: 라운드 시작 때 공개, QA BUG-04 결정) */
  publicUpTo: { id: string; round: RoundNo; title: string; body: string }[];
  sealEpoch: unknown;
  revealMode: 'hold' | 'tap';
  onDisclose: (round: RoundNo, value: 'public' | 'private') => void;
  /** 단서함에서 처음 열었을 때 — 공개 세그 활성화·장소 되돌리기 소멸(§3 P5·P6) */
  onOpened: (round: RoundNo) => void;
  onPickNow: (round: RoundNo) => void;
}) {
  const roundNos: RoundNo[] = [1, 2, 3];
  return (
    <div className="gu-cluestab">
      {roundNos
        .filter((r) => r <= reachedRound)
        .map((r) => {
          const pick = rounds[r];
          if (!pick?.placeId) {
            return (
              <div key={r} className="gu-cluestab-empty">
                <p className="gu-cluestab-empty-label">조사 {r} · 아직 고르지 않음</p>
                <button type="button" className="gu-btn gu-btn--secondary gu-btn--full" onClick={() => onPickNow(r)}>
                  <span className="gu-btn-label">지금 고르기</span>
                </button>
              </div>
            );
          }
          const clue = getClue(c, a, r, pick.placeId, seat);
          return (
            <ClueTabCard
              key={r}
              round={r}
              placeId={pick.placeId}
              c={c}
              text={clue?.body ?? ''}
              clueId={clue?.id ?? ''}
              terms={(clue?.terms ?? []).map((t) => ({ term: t.term, desc: t.desc }))}
              disclosure={pick.disclosure}
              opened={pick.opened}
              sealEpoch={sealEpoch}
              revealMode={revealMode}
              onDisclose={(v) => onDisclose(r, v)}
              onOpened={() => onOpened(r)}
            />
          );
        })}
      {publicUpTo.length > 0 && (
        <div className="gu-cluestab-public">
          <p className="gu-cluestab-public-label">공용 단서</p>
          {publicUpTo.map((p) => (
            <p key={`${p.round}-${p.id}`} className="gu-cluestab-public-item">
              <span className="gu-cluestab-public-round">조사 {p.round} · {p.title}</span> {p.body}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function ClueTabCard({
  round,
  placeId,
  c,
  text,
  clueId,
  terms,
  disclosure,
  opened,
  sealEpoch,
  revealMode,
  onDisclose,
  onOpened,
}: {
  round: RoundNo;
  placeId: string;
  c: GungCase;
  text: string;
  clueId: string;
  /** 카드 연동 용어 — 연 동안만(봉인 속) */
  terms: TermItem[];
  disclosure: Disclosure;
  opened: boolean;
  sealEpoch: unknown;
  revealMode: 'hold' | 'tap';
  onDisclose: (value: 'public' | 'private') => void;
  onOpened: () => void;
}) {
  const reveal = useHoldReveal(revealMode, `${String(sealEpoch)}-${round}`);
  useEffect(() => {
    if (reveal.open && !opened) onOpened();
    // onOpened 는 매 렌더 새 람다 — 열림 전이에만 반응한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reveal.open, opened]);
  const place = placeToSummary(c, placeId);
  return (
    <ClueCard
      roundNo={round}
      place={place}
      clueId={clueId}
      clueText={text}
      terms={terms}
      disclosure={disclosure}
      open={reveal.open}
      mode={reveal.mode}
      pressBind={reveal.pressBind}
      holdProgress={reveal.holdProgress}
      onDisclose={onDisclose}
      disclosureEnabled={opened}
    />
  );
}
