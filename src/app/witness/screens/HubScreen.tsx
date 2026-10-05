'use client';

/**
 * 수사 허브(W10, 디자인 §5-5) — HUD(96px) + 탭 3개(집 안 · 사람 · 수첩) + 하단 탭바 + 최종 지목 바(★ ≥ 3).
 *  - 집 안: 블루프린트 스킨 2×3 타일 [서재][손님방]/[거실][주방]/[옥상 정원][다용도실]. 칩은 엔진 셀렉터 roomStatus 에서 받는다(UI 가 비용을 계산하지 않는다).
 *  - 사람: 용의자 4 + 또박이(증인 — 용의자가 아님을 틀로 구분) 블록, 증언 행 ≥ 56px. 잠긴 증언은 한 줄로 합쳐 개수·제목을 알리지 않는다.
 *  - 유료 대상은 항상 비용 프롬프트(2탭)를 거친다. 목록 뷰 토글은 설정에 기억한다.
 */
import { ChevronDown, ChevronUp, Lock, List, Map as MapIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CASE, canAccuse, endInvestigation, roomStatus, setStatus, stars, starsToGate, type Location, type TestimonySet } from '@/lib/witness';
import { COACH_TEXT, END_SHEET, HUD_TOUR, TOAST } from '../lib/copy';
import { houseLayout, nameOf, placeName, tutorialDone } from '../lib/format';
import { useNav } from '../lib/useNav';
import { useWt } from '../lib/context';
import { ActionChip, ChipRow, statusChips, type ChipKind } from '../components/ActionChip';
import { LedBadge } from '../components/CharacterStage';
import { ArtSlot } from '../components/ArtSlot';
import { HudBar } from '../components/Hud';
import { AccuseBar, BottomTabs, CoachBubble, EndInvestigationBar } from '../components/Nav';
import { ConfirmSheet } from '../components/BottomSheet';
import { Notebook, hasNotebookNews } from '../components/Notebook';
import { SpendPrompt, useSpend, type SpendTarget } from '../components/SpendPrompt';

const chipText: Record<string, string> = {
  cost: '행동 1',
  free: '무료',
  new: 'NEW',
  visited: '다녀옴',
  locked: '잠김',
  siren: '사이렌 뒤',
  cleared: '다 털었다',
};
const chipAria = (cs: { kind: ChipKind; label?: string }[]) => cs.map((c) => c.label ?? chipText[c.kind] ?? '').filter(Boolean).join(', ');

const setWho = (s: TestimonySet) => s.speakers.map((w) => nameOf(w)).join('·');

/**
 * HUD 투어 — 말풍선마다 '보여 준 순간' meta.coach 에 기록한다(hudTour1~3).
 * 허브를 다시 열거나(장소 → 허브) 새로고침·이어하기를 해도 이미 본 말풍선은 나오지 않고, 안 본 다음 말풍선부터 이어 간다.
 * 마지막 말풍선을 닫으면 hudTour(투어 전체 끝)를 기록한다.
 */
function useHudTour(settled: boolean): { on: boolean; step: number; next: () => void } {
  const { game, coachSeen } = useWt();
  const last = HUD_TOUR.length - 1;
  const wanted = settled && !coachSeen('hudTour');
  // 이 마운트에서 처음 보여 줄 말풍선(아직 안 본 첫 번째). null = 아직 정하지 않음
  const [step, setStep] = useState<number | null>(null);
  if (wanted && step === null) {
    const first = HUD_TOUR.findIndex((t) => !coachSeen(t.id));
    setStep(first < 0 ? HUD_TOUR.length : first);
  }
  const cur = step ?? 0;
  const on = wanted && step !== null && cur <= last;
  useEffect(() => {
    if (!wanted || step === null) return;
    // 지금 보이는 말풍선을 '봤다'로. 전부 본 상태로 다시 왔다면(마지막을 안 닫고 나간 경우) 투어를 끝낸다
    if (cur <= last) game.markCoach(HUD_TOUR[cur].id);
    else game.markCoach('hudTour');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted, step]);
  return {
    on,
    step: Math.min(cur, last),
    next: () => {
      if (cur >= last) {
        game.markCoach('hudTour');
        setStep(HUD_TOUR.length);
      } else setStep(cur + 1);
    },
  };
}

/** 허브 범례 말풍선(「자동으로 저장돼요」) — 보여 준 순간 기록하고, 닫을 때까지는 이 마운트에서 유지한다 */
function useLegendOnce(settled: boolean): { on: boolean; dismiss: () => void } {
  const { game, coachSeen } = useWt();
  const wanted = settled && coachSeen('hudTour') && !coachSeen('hubLegend');
  const [shown, setShown] = useState(false);
  if (wanted && !shown) setShown(true);
  useEffect(() => {
    if (shown) game.markCoach('hubLegend');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown]);
  return { on: shown, dismiss: () => setShown(false) };
}

export function HubScreen() {
  const { game, toast, openSettings, requestAccuse, openNotebook, nbTab, setNbTab, jumpToLine, gotoTarget, coachSeen } = useWt();
  const run = game.run!;
  const nav = useNav();
  // 연출 중(heldScreen)에는 그 시점의 앵커를 따른다 — 수첩 정리로 사이렌이 울려도 시트를 닫기 전까지 수첩이 그대로 있어야 한다
  const anchor = game.heldScreen ?? run.screen;
  const tab = anchor.tab ?? 'house';
  const spend = useSpend();
  const [endOpen, setEndOpen] = useState(false);
  const settled = tutorialDone(run);
  const { step: tourStep, on: tourOn, next: nextTour } = useHudTour(settled);
  const legendOn = useLegendOnce(settled);
  const hl = game.highlight;
  const hlActive = !!hl && Date.now() - hl.at < 2500;

  // 하이라이트는 2번 깜빡인 뒤 지운다
  useEffect(() => {
    if (!hl) return;
    const t = setTimeout(() => game.setHighlight(null), 2200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hl?.at]);

  const setTab = (t: 'house' | 'people' | 'notebook') => game.anchor({ tab: t });

  // 사이렌 뒤 재방문으로 새로 열린 비용 0 증언(대질·chain) — 사람 탭 점 + 「수사 종료」 시트 한 줄(UX-3)
  const newSetAfterSiren = run.phase === 'siren' && CASE.sets.some((x) => {
    const st = setStatus(run, x.id);
    return st.state === 'open' && st.isNew;
  });

  const confirmSpend = () => {
    const t = spend.target;
    spend.cancel();
    if (!t?.id) return;
    if (t.kind === 'location') nav.enterLocation(t.id);
    else if (t.kind === 'set') nav.openSet(t.id);
  };

  const askLocation = (loc: Location) => {
    const st = roomStatus(run, loc.id);
    if (st.state === 'locked') {
      toast({ kind: 'info', text: st.lockedLabel ?? '아직 들어갈 수 없다', ms: 3200 });
      return;
    }
    if (st.state === 'siren') {
      toast({ kind: 'warn', text: TOAST.sirenLocked });
      return;
    }
    if (st.cost > 0) {
      spend.request({ kind: 'location', id: loc.id, label: placeName(loc) } as SpendTarget);
      return;
    }
    nav.enterLocation(loc.id);
  };

  const askSet = (s: TestimonySet) => {
    const st = setStatus(run, s.id);
    if (st.state === 'locked') return;
    if (st.state === 'siren') {
      toast({ kind: 'warn', text: TOAST.sirenLocked });
      return;
    }
    if (st.cost > 0) {
      spend.request({ kind: 'set', id: s.id, label: `${setWho(s)} 「${s.title}」` });
      return;
    }
    nav.openSet(s.id);
  };

  return (
    <div className="wt-screen wt-screen--hub" data-tab={tab}>
      <HudBar
        variant="hub"
        run={run}
        onMenu={openSettings}
        onStar={requestAccuse}
        previewPips={spend.target ? 1 : 0}
        tour={tourOn ? HUD_TOUR[tourStep].anchor : null}
      />
      {tourOn && <CoachBubble text={HUD_TOUR[tourStep].text} placement="top" label={tourStep >= HUD_TOUR.length - 1 ? '알겠어요' : '다음'} onDismiss={nextTour} />}

      <main className="wt-hub-main">
        {tab === 'house' && <HouseTab onRoom={askLocation} highlightLoc={hlActive && hl?.target.kind === 'location' ? hl.target.id : null} />}
        {tab === 'people' && <PeopleTab onSet={askSet} highlightSet={hlActive && hl?.target.kind === 'set' ? hl.target.id : null} />}
        {tab === 'notebook' && <Notebook run={run} tab={nbTab} onTab={setNbTab} onGoto={gotoTarget} onJumpLine={jumpToLine} />}
      </main>

      <div className="wt-hub-bottom">
        {legendOn.on && <CoachBubble text={COACH_TEXT.hubLegend} placement="bottom" onDismiss={legendOn.dismiss} />}
        {spend.target && (
          <SpendPrompt
            run={run}
            target={spend.target}
            onConfirm={confirmSpend}
            onCancel={spend.cancel}
            onOpenNotebook={() => {
              spend.cancel();
              openNotebook();
            }}
            coach={!coachSeen('firstSpend') ? COACH_TEXT.firstSpend : undefined}
          />
        )}
        {canAccuse(run) && run.phase !== 'ended' && <AccuseBar onClick={requestAccuse} afterSiren={run.phase === 'siren'} />}
        {run.phase === 'siren' && !canAccuse(run) && <EndInvestigationBar onClick={() => setEndOpen(true)} />}
        <BottomTabs tab={tab} newDot={hasNotebookNews(run)} peopleDot={newSetAfterSiren} onTab={setTab} />
      </div>

      <ConfirmSheet
        open={endOpen}
        title={END_SHEET.title}
        confirmLabel={END_SHEET.yes}
        cancelLabel={END_SHEET.no}
        onCancel={() => setEndOpen(false)}
        onConfirm={() => {
          setEndOpen(false);
          game.act((r) => endInvestigation(r));
        }}
        confirmTestId="end-yes"
        danger
      >
        <p>{END_SHEET.lead}</p>
        <p>{END_SHEET.body(starsToGate(run))}</p>
        {newSetAfterSiren && <p data-testid="end-newset">{END_SHEET.newSet}</p>}
      </ConfirmSheet>
    </div>
  );
}

function HouseTab({ onRoom, highlightLoc }: { onRoom: (l: Location) => void; highlightLoc: string | null }) {
  const { game } = useWt();
  const run = game.run!;
  const [goalOpen, setGoalOpen] = useState(() => stars(run) < 1);
  const layout = houseLayout();
  const list = game.settings.hubView === 'list';

  const rows = layout
    .filter((l): l is Location => !!l)
    .map((loc) => {
      const st = roomStatus(run, loc.id);
      const chips = statusChips({ state: st.state, cost: st.cost, isNew: st.isNew });
      return { loc, st, chips };
    });

  return (
    <div className="wt-house">
      <div className="wt-goal">
        {run.phase === 'siren' ? (
          <p data-testid="siren-goal">
            <b>사이렌 뒤</b> · 이미 연 곳은 다시 볼 수 있다{starsToGate(run) > 0 ? ` · ★ ${starsToGate(run)}개 더` : ''}
          </p>
        ) : goalOpen ? (
          <p>
            <b>목표</b> · 결정적 모순 3개를 깨면 지목할 수 있다
          </p>
        ) : (
          <p className="wt-muted">목표는 접어 뒀어요</p>
        )}
        {run.phase !== 'siren' && (
          <button type="button" className="wt-iconbtn wt-iconbtn--sm" onClick={() => setGoalOpen((v) => !v)} aria-label={goalOpen ? '목표 접기' : '목표 펼치기'} aria-expanded={goalOpen}>
            {goalOpen ? <ChevronUp size={16} aria-hidden /> : <ChevronDown size={16} aria-hidden />}
          </button>
        )}
      </div>

      {list ? (
        <ul className="wt-roomlist">
          {rows.map(({ loc, st, chips }) => (
            <li key={loc.id}>
              <button type="button" className="wt-roomrow" data-state={st.state} data-flash={highlightLoc === loc.id ? '1' : undefined} onClick={() => onRoom(loc)} aria-label={`${placeName(loc)}, ${chipAria(chips)}${st.state === 'locked' ? '. ' + (st.lockedLabel ?? '') : ''}`} data-testid={`room-${loc.id}`}>
                <span className="wt-room-name">{placeName(loc)}</span>
                <ChipRow chips={chips} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="wt-blueprint">
          {layout.map((loc, i) => {
            if (!loc) return <div key={`e${i}`} className="wt-room wt-room--empty" aria-hidden />;
            const r = rows.find((x) => x.loc.id === loc.id)!;
            return (
              <button key={loc.id} type="button" className="wt-room" data-state={r.st.state} data-flash={highlightLoc === loc.id ? '1' : undefined} onClick={() => onRoom(loc)} aria-label={`${placeName(loc)}, ${chipAria(r.chips)}${r.st.state === 'locked' ? '. ' + (r.st.lockedLabel ?? '') : ''}`} data-testid={`room-${loc.id}`}>
                <span className="wt-room-name">{placeName(loc)}</span>
                {r.st.state === 'locked' && <Lock size={16} aria-hidden className="wt-room-lock" />}
                <ChipRow chips={r.chips} />
              </button>
            );
          })}
        </div>
      )}

      <div className="wt-legend">
        <span className="wt-legend-chips" aria-label="범례">
          <ActionChip kind="free" />
          <ActionChip kind="cost" />
          <ActionChip kind="locked" />
          <ActionChip kind="new" />
        </span>
        <button type="button" className="wt-btn wt-btn--ghost wt-btn--sm" onClick={() => game.updateSettings({ hubView: list ? 'map' : 'list' })} aria-label={list ? '지도로 보기' : '목록으로 보기'}>
          {list ? <MapIcon size={14} aria-hidden /> : <List size={14} aria-hidden />} {list ? '지도' : '목록'}
        </button>
      </div>
    </div>
  );
}

function PeopleTab({ onSet, highlightSet }: { onSet: (s: TestimonySet) => void; highlightSet: string | null }) {
  const { game } = useWt();
  const run = game.run!;
  const people: ('S1' | 'S2' | 'S3' | 'S4' | 'AI')[] = ['S1', 'S2', 'S3', 'S4', 'AI'];
  const confronts = CASE.sets.filter((s) => s.kind === 'confront' && setStatus(run, s.id).state !== 'locked');
  const anyLocked = CASE.sets.some((s) => setStatus(run, s.id).state === 'locked');

  const renderRow = (s: TestimonySet) => {
    const st = setStatus(run, s.id);
    const chips = statusChips({ state: st.state === 'locked' ? 'locked' : st.state, cost: st.cost, isNew: st.isNew, cleared: st.cleared, pressed: st.pressed, visibleLines: st.visibleLines });
    return (
      <li key={s.id}>
        <button type="button" className="wt-prow" data-state={st.state} data-flash={highlightSet === s.id ? '1' : undefined} onClick={() => onSet(s)} aria-label={`${setWho(s)} 「${s.title}」, ${chipAria(chips)}`} data-testid={`set-${s.id}`}>
          <span className="wt-prow-t">
            <b>「{s.title}」</b>
            {s.kind === 'confront' && <small>{setWho(s)}</small>}
          </span>
          <ChipRow chips={chips} />
        </button>
      </li>
    );
  };

  return (
    <div className="wt-people">
      {confronts.length > 0 && (
        <section className="wt-pblock wt-pblock--confront" aria-label="대질">
          <h2 className="wt-sec-h">대질</h2>
          <ul>{confronts.map(renderRow)}</ul>
        </section>
      )}
      {people.map((who) => {
        const sets = CASE.sets.filter((s) => s.kind !== 'confront' && s.speakers.length === 1 && s.speakers[0] === who && setStatus(run, s.id).state !== 'locked');
        const prof = CASE.profiles.find((p) => p.id === who);
        const isAi = who === 'AI';
        return (
          <section key={who} className={['wt-pblock', isAi ? 'wt-pblock--ai' : ''].filter(Boolean).join(' ')} aria-label={nameOf(who)}>
            <header className="wt-pblock-head">
              <span className="wt-pblock-art">
                <ArtSlot kind="portrait" who={who} crop="head" title={nameOf(who)} />
              </span>
              <span className="wt-pblock-id">
                <b>{nameOf(who)}</b>
                {isAi && <span className="wt-pblock-tag">증인</span>}
                <small>{prof?.summary[0]}</small>
              </span>
              {isAi && <LedBadge />}
            </header>
            <ul>{sets.map(renderRow)}</ul>
          </section>
        );
      })}
      {anyLocked && (
        <p className="wt-locked-line">
          <Lock size={14} aria-hidden /> 그 밖의 증언 · 잠김
        </p>
      )}
    </div>
  );
}

