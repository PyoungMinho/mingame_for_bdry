'use client';

/**
 * 심문(W30) · 대질(W34) · 튜토리얼 브리핑(W05) — 디자인 §5-9·§5-10·§5-11·§6-2.
 *
 * 상태 기계: intro(대사) → idle(줄 카드·추궁/제시) ⇄ dialogue(추궁 응답·판정 대사·outro) / fx(컷인·판정 연출) → result(돌파 결과 카드).
 *  - 엔진 상태는 제시 즉시 반영·저장된다. 연출 동안은 직전 상태(hold)를 보여 줘 줄이 미리 깨져 보이지 않게 한다.
 *  - 연출 중에는 화면 전환을 잠근다(holdRoute) — 오답으로 수사 배제가 돼도 연출이 끝난 뒤에야 W65 로 넘어간다.
 *  - 진실 유형·정답 힌트를 화면에 쓰지 않는다. 추궁은 무료·무제한이고, 처음 한 번만 효과(숨은 줄·메모 증거·의문)가 있다.
 *  - 새로고침 복원: 같은 세트·같은 줄, 판정 직후였다면(screen.replay) 결과 카드부터.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CASE,
  EVIDENCE_TOTAL,
  diffOpened,
  evidenceCount,
  getBreak,
  getEvidence,
  getSet,
  present,
  press,
  profiles,
  visibleLines,
  roomStatus,
  setStatus,
  stars,
  getHotspot,
  openedReadKey,
  readLineKey,
  type Break,
  type CardId,
  type Dialogue,
  type EngineEvent,
  type Face,
  type Id,
  type OpenedItem,
  type RunState,
  type Speaker,
  type Step,
} from '@/lib/witness';
import { COACH_TEXT, TOAST } from '../lib/copy';
import { fxMs, T } from '../lib/fx';
import { nameOf, placeName, undoBreak } from '../lib/format';
import { useNav } from '../lib/useNav';
import { useWt } from '../lib/context';
import { CharacterStage } from '../components/CharacterStage';
import { DialogueBox } from '../components/DialogueBox';
import { EvidenceAcquireCard } from '../components/DeviceLog';
import { EvidenceSheet } from '../components/EvidenceSheet';
import { HudBar } from '../components/Hud';
import { CoachBubble } from '../components/Nav';
import { hasNotebookNews } from '../components/Notebook';
import { ResultCard } from '../components/ResultCard';
import { SpendPrompt, useSpend } from '../components/SpendPrompt';
import { TestimonyPanel } from '../components/TestimonyPanel';
import { ConfrontEntry } from '../components/Overlays';
import { Stamp, VerdictFx, type FxPlan } from '../components/VerdictFx';
import { playSfx } from '../audio/useGameAudio';

type Stage =
  | { k: 'idle' }
  | { k: 'wait' }
  | { k: 'entry'; ms: number }
  | { k: 'dialogue'; lines: Dialogue[]; key: string; instant?: boolean; readKey?: string; then: () => void }
  | { k: 'fx'; plan: FxPlan; id: number; onImpact?: () => void; onDone: () => void };

interface ResultState {
  brk: Break;
  items: OpenedItem[];
  trustDelta: number | null;
  outro: Dialogue[] | null;
  /** '새로 열린 것'을 전에 본 적이 있어 한 줄 칩으로 접는다 */
  folded?: boolean;
}

const setNames = (setId: string) =>
  (getSet(setId)?.speakers ?? []).map((s) => nameOf(s)).join(' · ');

export function TestimonyScreen({ setId }: { setId: string }) {
  const { game, toast, openNotebook, fx, vib, coachSeen, requestAccuse } = useWt();
  const run = game.run!;
  const nav = useNav();
  const set = getSet(setId)!;
  const tutorial = set.kind === 'tutorial';
  const multi = set.speakers.length > 1;
  const frameRef = useRef<HTMLDivElement>(null);
  const spend = useSpend();
  const seq = useRef(0);
  const releaseRef = useRef<(() => void) | null>(null);
  const halfRef = useRef<{ lineId: Id; cards: CardId[] } | null>(null);

  const [hold, setHold] = useState<RunState | null>(null);
  const shown = hold ?? run;
  const rows = useMemo(() => visibleLines(shown, setId), [shown, setId]);
  const anchor = game.heldScreen ?? run.screen;
  const idx = Math.min(Math.max(anchor.line ?? 0, 0), Math.max(0, rows.length - 1));
  const row = rows[idx];

  const [sheetOpen, setSheetOpen] = useState(false);
  const [acq, setAcq] = useState<{ ids: Id[]; i: number } | null>(null);
  const [result, setResult] = useState<ResultState | null>(() => {
    const id = run.screen.replay;
    const b = id ? getBreak(id) : undefined;
    if (!b) return null;
    return { brk: b.brk, items: diffOpened(undoBreak(run, b.brk), run), trustDelta: null, outro: null };
  });
  const [stage, setStage] = useState<Stage>(() => {
    if (run.screen.replay) return { k: 'idle' };
    const introRead = set.intro.length === 0 || set.intro.every((l, i) => game.isRead(readLineKey(`${set.id}#intro`, i, l.text)));
    if (introRead || (run.screen.line ?? 0) > 0) return { k: 'idle' };
    if (set.kind === 'confront') return { k: 'entry', ms: set.speakers.includes('AI') ? 2000 : 1000 };
    return { k: 'dialogue', lines: set.intro, key: `intro:${set.id}`, readKey: `${set.id}#intro`, then: () => setStage({ k: 'idle' }) };
  });
  const [dlgFaces, setDlgFaces] = useState<Partial<Record<Speaker, Face>>>({});
  const [active, setActive] = useState<Speaker | null>(null);
  const [bubble, setBubble] = useState<string | null>(null);
  const [smirkWho, setSmirkWho] = useState<Speaker | null>(null);
  const [stamp, setStamp] = useState(false);
  const [eventCoach, setEventCoach] = useState<{ id: string; text: string } | null>(null);

  // 화면을 떠날 때 잠금 해제
  useEffect(
    () => () => {
      releaseRef.current?.();
      releaseRef.current = null;
    },
    [],
  );

  const lock = () => {
    if (!releaseRef.current) releaseRef.current = game.holdRoute();
  };
  const unlock = () => {
    releaseRef.current?.();
    releaseRef.current = null;
  };

  const goIdle = () => {
    setStage({ k: 'idle' });
    setDlgFaces({});
    setActive(null);
    setSmirkWho(null);
  };

  const dialogue = (lines: Dialogue[], then: () => void, opts: { instant?: boolean; readKey?: string } = {}) => {
    if (lines.length === 0) {
      then();
      return;
    }
    seq.current += 1;
    setDlgFaces({});
    setStage({ k: 'dialogue', lines, key: `d${seq.current}`, instant: opts.instant, readKey: opts.readKey, then });
  };

  // ─────────── 이벤트 → 토스트·코치 ───────────
  const showCoachOnce = (id: string) => {
    if (!coachSeen(id) && id in COACH_TEXT) setEventCoach({ id, text: COACH_TEXT[id as keyof typeof COACH_TEXT] });
  };

  /** sound=false: 돌파 결과 카드가 따로 소리를 낸다(같은 순간 두 번 울리지 않게) */
  const eventsFeedback = (events: EngineEvent[], after: RunState, sound = true) => {
    if (sound && events.some((e) => e.t === 'revealed' || e.t === 'hotspotOpened')) playSfx('unlock');
    for (const e of events) {
      if (e.t === 'revealed') {
        const n = visibleLines(after, setId).findIndex((x) => x.line.id === e.line) + 1;
        toast({ kind: 'info', text: TOAST.linesGrew(n || rows.length + 1), ms: 3200 });
      } else if (e.t === 'question') {
        toast({ kind: 'info', text: TOAST.question, ms: 1600 });
        showCoachOnce('firstQuestion');
      } else if (e.t === 'hotspotOpened') {
        const h = getHotspot(e.hotspot);
        toast({ kind: 'info', text: TOAST.newSpot(h ? placeName(h.location) : ''), ms: 3200 });
      } else if (e.t === 'upgraded') {
        toast({ kind: 'info', text: TOAST.upgraded(getEvidence(e.from)?.name ?? '', getEvidence(e.to)?.name ?? ''), ms: 3200 });
        showCoachOnce('firstUpgrade');
      }
    }
  };

  // ─────────── 줄 이동 ───────────
  const setLine = (i: number, wrapped?: boolean) => {
    if (i !== idx) game.anchor({ line: i });
    if (wrapped) toast({ kind: 'info', text: TOAST.firstLine, ms: 1200 });
    if (tutorial && !coachSeen('lineNav')) game.markCoach('lineNav');
  };

  // ─────────── 추궁 ───────────
  const onPress = () => {
    if (stage.k !== 'idle' || !row) return;
    const first = !row.pressed;
    const lineId = row.line.id;
    if (tutorial && !coachSeen('press')) game.markCoach('press');
    if (!first) {
      dialogue(row.line.press.lines, goIdle, { instant: true });
      return;
    }
    seq.current += 1;
    setStage({
      k: 'fx',
      id: seq.current,
      plan: { kind: 'press' },
      onDone: () => {
        const step = game.act((r) => press(r, lineId));
        if (step.error) {
          goIdle();
          return;
        }
        const acquired = step.events.filter((e): e is Extract<EngineEvent, { t: 'acquired' }> => e.t === 'acquired').map((e) => e.id);
        dialogue(
          row.line.press.lines,
          () => {
            eventsFeedback(step.events, step.run, !acquired.length);
            if (acquired.length) {
              playSfx('pickup');
              setAcq({ ids: acquired, i: 0 });
            }
            goIdle();
          },
          { readKey: `${lineId}#press` },
        );
      },
    });
  };

  // ─────────── 제시 ───────────
  const cardName = (id: CardId) => getEvidence(id)?.name ?? profiles(run).find((p) => p.id === id)?.name ?? id;

  const onSubmitCards = (cards: CardId[]) => {
    setSheetOpen(false);
    if (!row) return;
    const lineId = row.line.id;
    const before = game.getRun()!;
    lock();
    setStage({ k: 'wait' });
    window.setTimeout(() => {
      const step = game.act((r) => present(r, lineId, cards));
      if (step.error) {
        unlock();
        toast({ kind: 'warn', text: '지금은 낼 수 없다' });
        goIdle();
        return;
      }
      const v = step.events.find((e): e is Extract<EngineEvent, { t: 'verdict' }> => e.t === 'verdict');
      if (!v) {
        unlock();
        goIdle();
        return;
      }
      if (v.kind === 'ALREADY') {
        unlock();
        toast({ kind: 'info', text: TOAST.already });
        goIdle();
        return;
      }
      const third = step.events.some((e) => e.t === 'star' && e.count === 3);
      // ★ 는 몇 개째인지를 판정 안내(role=alert)에 바로 싣는다 — HUD 안내를 기다리지 않게
      const starN = step.events.find((e): e is Extract<EngineEvent, { t: 'star' }> => e.t === 'star')?.count;
      const spoken =
        v.kind === 'BREAK'
          ? `${v.tier === 'star' ? `결정적 모순 돌파${starN ? `, ${starN}개째` : ''}` : '모순 해소'}.${getBreak(v.breakId ?? '')?.brk.revisedText ? ` 정정: ${getBreak(v.breakId ?? '')!.brk.revisedText}` : ''}`
          : v.kind === 'HALF'
            ? '반쯤 맞음, 감점 없음'
            : v.kind === 'REDIRECT'
              ? '감점 없음'
              : v.tutorial
                ? '오답, 튜토리얼이라 감점 없음'
                : `오답, 신뢰 ${step.run.trust}`;
      const plan: FxPlan = { kind: 'present', cardNames: cards.map(cardName), verdict: v.kind, tier: v.tier, third, tutorial: v.tutorial, spoken };
      setHold(before);
      seq.current += 1;
      setStage({
        k: 'fx',
        id: seq.current,
        plan,
        onImpact: () => {
          const w = row.line.who;
          if (v.kind === 'BREAK') setDlgFaces({ [w]: 'shock' });
          else if (v.kind === 'HALF') setDlgFaces({ [w]: 'sweat' });
          else if (v.kind === 'WRONG' && !v.tutorial && w !== 'AI') setSmirkWho(w);
        },
        onDone: () => afterVerdict(step, before, v),
      });
    }, fxMs(T.sheetClose, fx));
  };

  const afterVerdict = (step: Step, before: RunState, v: Extract<EngineEvent, { t: 'verdict' }>) => {
    setHold(null);
    const after = step.run;
    if (v.kind !== 'HALF') halfRef.current = null;
    if (v.kind === 'BREAK') {
      const brk = getBreak(v.breakId ?? '')?.brk;
      const trustDelta = step.events.filter((e): e is Extract<EngineEvent, { t: 'trust' }> => e.t === 'trust').reduce((a, e) => a + e.delta, 0);
      const cleared = step.events.find((e): e is Extract<EngineEvent, { t: 'cleared' }> => e.t === 'cleared');
      const starEv = step.events.find((e): e is Extract<EngineEvent, { t: 'star' }> => e.t === 'star');
      dialogue(v.lines, () => {
        if (!brk) {
          unlock();
          goIdle();
          return;
        }
        if (starEv?.count === 3) toast({ kind: 'star', text: TOAST.ready, ms: 3200 });
        if (starEv?.count === 1) showCoachOnce('firstStar');
        eventsFeedback(step.events, after, false);
        const items = diffOpened(before, after);
        // 결과 카드가 뜨는 순간: 새로 열린 곳(세트·장소·핫스팟·비밀)이 있으면 걸쇠, 증거만이면 픽업
        if (items.some((it) => it.kind === 'set' || it.kind === 'location' || it.kind === 'hotspot' || it.kind === 'secret')) playSfx('unlock');
        else if (items.length) playSfx('pickup');
        // 이 돌파의 '새로 열린 것'을 전에 봤으면 접는다. 처음 보여 주는 것이면 보여 준 뒤에 '봤다'를 남긴다(다음 판부터 접힘)
        const openedKey = openedReadKey(brk.id);
        const folded = game.isRead(openedKey);
        if (!folded && items.length > 0) game.markRead([openedKey]);
        setResult({ brk, items, trustDelta, outro: cleared?.outro ?? null, folded });
        goIdle();
      }, { readKey: `${v.breakId}#break` });
      return;
    }
    if (v.kind === 'HALF') {
      toast({ kind: 'cost', text: TOAST.half, ms: 1600 });
      showCoachOnce('firstHalf');
      dialogue(v.lines, () => {
        unlock();
        goIdle();
      });
      return;
    }
    if (v.kind === 'REDIRECT') {
      toast({ kind: 'info', text: TOAST.redirect, ms: 1600 });
      showCoachOnce('firstRedirect');
      dialogue(v.lines, () => {
        unlock();
        goIdle();
      });
      return;
    }
    // WRONG
    toast({ kind: v.tutorial ? 'info' : 'danger', text: v.tutorial ? TOAST.tutorialWrong : TOAST.trustMinus, ms: 1600 });
    if (!v.tutorial) showCoachOnce('firstWrong');
    dialogue(v.lines, () => {
      if (!v.tutorial) {
        const bubbleText = CASE.copTrustLines[Math.max(1, Math.min(5, after.trust)) as 1 | 2 | 3 | 4 | 5];
        if (after.phase !== 'ended' && bubbleText) {
          setBubble(bubbleText);
          setTimeout(() => setBubble(null), Math.max(60, fxMs(1200, fx)));
        }
        if (after.trust === 1) showCoachOnce('firstTrust1');
      }
      unlock();
      goIdle();
    });
  };

  // ─────────── 결과 카드 ───────────
  const closeResult = (after?: () => void) => {
    const r = result;
    setResult(null);
    game.anchor({ replay: undefined });
    if (r?.outro && r.outro.length) {
      dialogue(r.outro, () => {
        setStamp(true);
        playSfx('stamp');
        setTimeout(() => setStamp(false), fxMs(1400, fx) || 10);
        unlock();
        goIdle();
        if (tutorial) nav.exit('house');
        else after?.();
      });
      return;
    }
    unlock();
    goIdle();
    after?.();
  };

  const gotoItem = (item: OpenedItem) => {
    const go = () => {
      // 행동 0(마지막 행동으로 연 세트 안): 새로 돈이 드는 곳은 갈 수 없다 — 「0 → −1」 비용 프롬프트·헛걸음 대신 안내만(이미 연 곳은 다시 갈 수 있다)
      const cur = game.getRun()!;
      const blocked =
        item.kind === 'set'
          ? setStatus(cur, item.id).state === 'siren'
          : item.kind === 'location'
            ? roomStatus(cur, item.id).state === 'siren'
            : item.kind === 'hotspot'
              ? roomStatus(cur, item.location).state === 'siren'
              : false;
      if (blocked) {
        toast({ kind: 'warn', text: cur.actions <= 0 && cur.phase === 'play' ? TOAST.zeroInside : TOAST.sirenLocked, ms: 2400 });
        return;
      }
      if (item.kind === 'set') {
        if (item.cost > 0) {
          spend.request({ kind: 'set', id: item.id, label: `${setNames(item.id)} 「${getSet(item.id)?.title ?? ''}」` });
        } else nav.openSet(item.id);
      } else if (item.kind === 'location') {
        if (item.cost > 0) spend.request({ kind: 'location', id: item.id, label: placeName(CASE.locations.find((l) => l.id === item.id)!) });
        else nav.enterLocation(item.id);
      } else if (item.kind === 'hotspot') {
        const locId = item.location;
        const st = roomStatus(game.getRun()!, locId);
        if (st.cost > 0) spend.request({ kind: 'location', id: locId, label: placeName(CASE.locations.find((l) => l.id === locId)!) });
        else nav.enterLocation(locId);
      }
    };
    closeResult(go);
  };

  const confirmSpend = () => {
    const t = spend.target;
    spend.cancel();
    if (!t?.id) return;
    if (t.kind === 'set') nav.openSet(t.id);
    else if (t.kind === 'location') nav.enterLocation(t.id);
  };

  // ─────────── 파생 표시값 ───────────
  const idleFace = (): Face => {
    if (!row) return 'normal';
    if (row.line.who === 'AI') return row.broken ? 'shock' : row.line.truth === 'refusal' ? 'angry' : 'normal';
    return row.broken ? 'sweat' : 'normal';
  };
  const faces: Partial<Record<Speaker, Face>> = {};
  for (const s of set.speakers) faces[s] = s === row?.line.who ? idleFace() : 'normal';
  Object.assign(faces, dlgFaces);
  const activeNow: Speaker | null = stage.k === 'dialogue' ? active : multi && row ? row.line.who : null;

  const idle = stage.k === 'idle' && !result && !sheetOpen && !acq && !spend.target;
  let coach: { id: string; text: string } | null = null;
  if (idle && tutorial) {
    if (!coachSeen('lineNav')) coach = { id: 'lineNav', text: COACH_TEXT.lineNav };
    else if (!coachSeen('press')) coach = { id: 'press', text: COACH_TEXT.press };
    else if (!coachSeen('present')) coach = { id: 'present', text: COACH_TEXT.present };
  }
  if (idle && !coach && eventCoach) coach = eventCoach;
  const pulse = tutorial && !!row?.line.breaks?.length && !row.broken && (coachSeen('press') || coachSeen('lineNav'));
  const acqEv = acq ? getEvidence(acq.ids[acq.i]) : undefined;
  const sheetInitial = halfRef.current && row && halfRef.current.lineId === row.line.id ? halfRef.current.cards : undefined;

  return (
    <div className="wt-screen wt-screen--test" ref={frameRef} data-confront={multi ? '1' : undefined}>
      <HudBar variant="compact" run={shown} onBack={stage.k === 'fx' || stage.k === 'wait' ? undefined : () => nav.exit()} onNotebook={() => openNotebook()} notebookDot={hasNotebookNews(run)} bubble={bubble} onStar={requestAccuse} previewPips={spend.target ? 1 : 0} />
      <div className="wt-test-title">
        <b>「{set.title}」</b>
        <small>{setNames(setId)}</small>
      </div>
      <CharacterStage speakers={set.speakers} active={activeNow} faces={faces} talking={stage.k === 'dialogue'} smirk={smirkWho} />

      <div className="wt-test-panel" data-mode={stage.k === 'dialogue' ? 'dialogue' : 'testimony'}>
        {stage.k === 'dialogue' ? (
          <DialogueBox
            lines={stage.lines}
            playKey={stage.key}
            readKey={stage.readKey}
            instant={stage.instant}
            onLine={(l) => {
              if (set.speakers.includes(l.who as Speaker)) {
                setActive(l.who as Speaker);
                if (l.face) setDlgFaces((f) => ({ ...f, [l.who]: l.face }));
              } else setActive(null);
            }}
            onDone={stage.then}
          />
        ) : (
          row && (
            <TestimonyPanel
              rows={rows}
              index={idx}
              multi={multi}
              tutorial={tutorial}
              disabled={stage.k !== 'idle' || !!result}
              onIndex={setLine}
              onPress={onPress}
              onPresent={() => {
                if (tutorial && !coachSeen('present')) game.markCoach('present');
                setSheetOpen(true);
              }}
              pulsePresent={pulse}
              keysEnabled={idle}
              coach={coach ? <CoachBubble text={coach.text} placement="bottom" onDismiss={() => { game.markCoach(coach!.id); if (eventCoach && coach!.id === eventCoach.id) setEventCoach(null); }} /> : undefined}
            />
          )
        )}
        {spend.target && (
          <SpendPrompt run={run} target={spend.target} onConfirm={confirmSpend} onCancel={spend.cancel} onOpenNotebook={() => { spend.cancel(); openNotebook(); }} />
        )}
      </div>

      {stage.k === 'entry' && (
        <ConfrontEntry
          names={set.speakers.map((s) => nameOf(s))}
          ms={stage.ms}
          onDone={() => dialogue(set.intro, goIdle, { readKey: `${set.id}#intro` })}
        />
      )}
      {stage.k === 'fx' && <VerdictFx key={stage.id} plan={stage.plan} shakeRef={frameRef} onImpact={stage.onImpact} onDone={stage.onDone} />}
      {stamp && (
        <div className="wt-fx wt-fx--passive" aria-hidden>
          <Stamp kind="cleared" play={fx !== 'reduced' && !game.reducedMotion} />
        </div>
      )}

      <EvidenceSheet
        open={sheetOpen}
        mode="present"
        run={run}
        target={row ? { index: idx, total: rows.length, text: row.line.text } : undefined}
        initial={sheetInitial}
        onClose={() => setSheetOpen(false)}
        onSubmit={(cards) => {
          halfRef.current = { lineId: row?.line.id ?? '', cards };
          onSubmitCards(cards);
        }}
      />
      <ResultCard
        open={!!result}
        tier={result?.brk.tier ?? 'minor'}
        revisedText={result?.brk.revisedText}
        revisedLabel={result?.brk.type === 'permission' ? '권한 해제' : undefined}
        items={result?.items ?? []}
        trustDelta={result ? result.trustDelta : null}
        starCount={result?.brk.tier === 'star' ? stars(run) : undefined}
        coach={tutorial && !coachSeen('result') ? COACH_TEXT.result : undefined}
        folded={result?.folded}
        onContinue={() => {
          if (tutorial && !coachSeen('result')) game.markCoach('result');
          closeResult();
        }}
        onGoto={(item) => {
          if (tutorial && !coachSeen('result')) game.markCoach('result');
          gotoItem(item);
        }}
      />
      <EvidenceAcquireCard
        open={!!acq}
        evidence={acqEv ?? null}
        count={evidenceCount(run)}
        total={EVIDENCE_TOTAL}
        onClose={() => {
          if (!acq) return;
          if (acq.i + 1 < acq.ids.length) setAcq({ ids: acq.ids, i: acq.i + 1 });
          else setAcq(null);
        }}
      />
    </div>
  );
}

