'use client';

/**
 * T1 내 패 / T2 단서함 — §3 T1·T2. 둘 다 BottomTabs에서 띄우는 탭이면서, 플레이어의 cards 단계(P3)
 * 본문으로도 그대로 임베드된다(§3: "P3. 패 확인 = T1 RoleCard 임베드").
 *
 * 개선 묶음 1
 *  - R1: 패 확인 단계엔 칩 위 「꼭 볼 3칸」(모든 역할 같은 문구), 한 번 연 칩엔 점(onSeen → 상위 UI 상태, 저장 안 함).
 *  - R3: 단서함 '공용 단서' 위에 내문 출입 타임라인(방장과 같은 gateTimeline·gateRoundsShown), 목록 아래 시각 어림 한 줄.
 *  - R5: 공개한 장소 카드에만 인장 번호.
 *
 * 7판(조사 따로): 단서함 조사마다 「내가 본 관찰 · 조사 N」(이 폰이 살펴본 물건만, 탭해 보기 + 자동 가림).
 *  아직 고르지 않은 조사엔 남은 살펴보기 횟수 — 「지금 고르기」 시트에서 살펴보고 고른다(방장 본인 조사도 여기서).
 */
import { Fragment, useEffect, useState } from 'react';
import { examineLeft, getClue, GUIDE, guideText, observationsIn, sceneStop, type Assignment, type ExamineLog, type GungCase, type ResolvedSheet, type RoundNo } from '@/lib/gung';
import { ClueCard, GateTimelineBar, RoleCard } from '../components';
import type { GateTimelineView } from '../components';
import type { Disclosure, SectionKey, TermItem } from '../components/types';
import { useHoldReveal } from '../lib/useHoldReveal';
import { placeToSummary, sheetToContent } from './adapters';
import { ObservationList } from './ExaminePanel';

export function MyCardTab({
  sheet,
  seat,
  sealEpoch,
  revealMode,
  focus,
  hint,
  seen,
  onSeen,
}: {
  /** getSheet(…, reachedRound(phase)) — 이 폰의 진행 단계로 잠금 블록이 이미 걸러져 있어야 한다 */
  sheet: ResolvedSheet;
  seat: number;
  sealEpoch: unknown;
  revealMode: 'hold' | 'tap';
  /** 'memory' — 「새 기억이 떠올랐소」 알림에서 들어옴: '비밀' 섹션의 잠금 블록 쪽부터 */
  focus?: 'memory' | null;
  /** 칩 위 안내(패 확인 단계 「꼭 볼 3칸」) */
  hint?: string;
  /** 한 번 연 섹션(칩 점) */
  seen?: Partial<Record<SectionKey, boolean>>;
  onSeen?: (section: SectionKey) => void;
}) {
  const [section, setSection] = useState<SectionKey>(focus === 'memory' ? 'secret' : 'identity');
  const reveal = useHoldReveal(revealMode, `${String(sealEpoch)}-${section}`);
  useEffect(() => {
    if (reveal.open && !seen?.[section]) onSeen?.(section);
    // onSeen 은 매 렌더 새 람다 — 열림 전이·섹션 변경에만 반응한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reveal.open, section]);
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
      hint={hint}
      seen={seen}
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
  examined,
  publicUpTo,
  sealEpoch,
  revealMode,
  onDisclose,
  onOpened,
  onPickNow,
  timeline,
  timeHint,
  sealOf,
}: {
  c: GungCase;
  a: Assignment;
  seat: number;
  reachedRound: 0 | RoundNo;
  rounds: Partial<Record<RoundNo, RoundClueState>>;
  /** 7판: 이 폰이 살펴본 물건 기록(GameState.examined) */
  examined?: ExamineLog;
  /** 이 폰이 들어선 라운드까지의 공용·NPC 단서(지금 라운드 포함 — 원고 1-7: 라운드 시작 때 공개, QA BUG-04 결정) */
  publicUpTo: { id: string; round: RoundNo; title: string; body: string }[];
  /** R3 — 방장과 같은 내문 출입 타임라인(이 폰이 들어선 라운드의 공용 카드 출입 기록만) */
  timeline?: GateTimelineView | null;
  /** R3 — 시각 어림 한 줄(timeTable 에서 생성) */
  timeHint?: string;
  /** R5 — 장소 카드 id → 인장(공개한 카드에만 그린다) */
  sealOf?: (cardId: string) => number | null;
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
          // 7판: 그 조사에 내가 본 관찰 — 장소 카드 아래(고르기 전이면 「지금 고르기」 아래)
          const mine = (
            <ObservationList observations={observationsIn(c, examined, r)} sealEpoch={sealEpoch} heading={`${GUIDE.obsHead} · 조사 ${r}`} />
          );
          if (!pick?.placeId) {
            const stop = sceneStop(c, r);
            const left = examineLeft(c, examined, r);
            return (
              <Fragment key={r}>
                <div className="gu-cluestab-empty">
                  <p className="gu-cluestab-empty-label">
                    조사 {r} · 아직 고르지 않음
                    {stop && left > 0 && (
                      <span className="gu-cluestab-examine">
                        {' '}
                        · {GUIDE.examineHead} {guideText.examineLeft(left, stop.examine)}
                      </span>
                    )}
                  </p>
                  <button type="button" className="gu-btn gu-btn--secondary gu-btn--full" onClick={() => onPickNow(r)}>
                    <span className="gu-btn-label">지금 고르기</span>
                  </button>
                </div>
                {mine}
              </Fragment>
            );
          }
          const clue = getClue(c, a, r, pick.placeId, seat);
          return (
            <Fragment key={r}>
              <ClueTabCard
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
                seal={pick.disclosure === 'public' && clue ? sealOf?.(clue.id) ?? null : null}
              />
              {mine}
            </Fragment>
          );
        })}
      {timeline && <GateTimelineBar data={timeline} />}
      {publicUpTo.length > 0 && (
        <div className="gu-cluestab-public">
          <p className="gu-cluestab-public-label">공용 단서</p>
          {publicUpTo.map((p) => (
            <p key={`${p.round}-${p.id}`} className="gu-cluestab-public-item">
              <span className="gu-cluestab-public-round">조사 {p.round} · {p.title}</span> {p.body}
            </p>
          ))}
          {timeHint && <p className="gu-timehint">{timeHint}</p>}
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
  seal,
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
  seal?: number | null;
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
      seal={disclosure === 'public' ? seal : null}
    />
  );
}
