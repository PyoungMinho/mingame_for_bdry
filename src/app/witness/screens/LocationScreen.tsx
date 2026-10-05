'use client';

/**
 * 조사(W20, 튜토리얼 W04 겸용) — 장면 + 점·레일 이중 구조, 대사 오버레이, 기기 로그 시트(W21), 증거 획득 카드(W22).
 *  - 조사 흐름: 점 탭 → (정밀 조사면 비용 프롬프트) → 독백 대사 → 기기면 로그 시트(열리는 순간 이미 획득·저장), 아니면 획득 카드.
 *  - 다시 본 핫스팟: 독백을 한 줄 요약으로 즉시 표시 + [수첩에서 보기]. 비용 0, 재획득 없음.
 *  - 튜토리얼: 첫 점(분필 선)만 활성. 증거 1개 이상이면 앰버 [브리핑 시작]이 레일 오른쪽 끝에 켜진다.
 *  - [나가기]는 항상 무료이고 확인창이 없다. 행동이 0 이었다면 나가는 순간 사이렌.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { CASE, EVIDENCE_TOTAL, RULES, evidenceCount, examine, getEvidence, visibleHotspots, type Dialogue, type Hotspot, type Id } from '@/lib/witness';
import { COACH_TEXT, TOAST } from '../lib/copy';
import { TUTORIAL_SET, tutorialDone } from '../lib/format';
import { useNav } from '../lib/useNav';
import { useWt } from '../lib/context';
import { DeviceLogSheet, EvidenceAcquireCard } from '../components/DeviceLog';
import { DialogueBox } from '../components/DialogueBox';
import { HudBar } from '../components/Hud';
import { CoachBubble } from '../components/Nav';
import { hasNotebookNews } from '../components/Notebook';
import { HotspotRail, SceneView, type SceneSpot } from '../components/SceneView';
import { SpendPrompt, useSpend } from '../components/SpendPrompt';
import { fxMs, T } from '../lib/fx';
import { playSfx } from '../audio/useGameAudio';

type Flow =
  | { k: 'explore' }
  | { k: 'dialogue'; spot: Hotspot; lines: Dialogue[]; acquired: Id[]; summary: boolean }
  | { k: 'log'; spot: Hotspot; ids: Id[] }
  | { k: 'acquire'; ids: Id[]; i: number };

export function LocationScreen({ locId }: { locId: string }) {
  const { game, toast, openNotebook, fx, coachSeen, requestAccuse } = useWt();
  const run = game.run!;
  const nav = useNav();
  const loc = CASE.locations.find((l) => l.id === locId)!;
  const [flow, setFlow] = useState<Flow>({ k: 'explore' });
  const [pan, setPan] = useState<{ id: string; n: number } | null>(null);
  const spend = useSpend();
  const [pendingPrecise, setPendingPrecise] = useState<Hotspot | null>(null);

  const spots: SceneSpot[] = useMemo(() => visibleHotspots(run, locId), [run, locId]);
  const tutorial = !!loc.tutorial && !tutorialDone(run);
  const firstId = loc.hotspots[0]?.id;
  const dim = useMemo(() => {
    if (!tutorial || !firstId || run.visited.includes(firstId)) return undefined;
    return new Set(loc.hotspots.filter((h) => h.id !== firstId).map((h) => h.id));
  }, [tutorial, firstId, run.visited, loc.hotspots]);

  const busy = flow.k !== 'explore' || !!spend.target;
  /**
   * 연타 가드 — 레일 패닝 지연(setTimeout) 동안이나 연 직후 flow 가 아직 렌더되기 전에는 다시 열지 않는다.
   * (없으면 패닝 중 두 번째 탭이 낡은 클로저로 같은 핫스팟을 또 열어, 획득 카드·기기 로그를 빈 흐름으로 덮어쓴다)
   * flow 가 탐색으로 돌아오면(busy → false) 풀린다.
   */
  const gateRef = useRef(false);
  const panTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!busy) gateRef.current = false;
  }, [busy]);
  useEffect(
    () => () => {
      if (panTimer.current) clearTimeout(panTimer.current);
    },
    [],
  );

  const doExamine = (h: Hotspot) => {
    const prev = game.getRun()?.actions ?? RULES.normal.actions;
    const step = game.act((r) => examine(r, h.id));
    if (step.error) {
      gateRef.current = false;
      toast({ kind: 'warn', text: step.error === 'siren' ? TOAST.sirenLocked : '지금은 조사할 수 없다' });
      return;
    }
    nav.feedback(step.events, prev);
    const acquired = step.events.filter((e) => e.t === 'acquired').map((e) => (e as { t: 'acquired'; id: Id }).id);
    setFlow({ k: 'dialogue', spot: h, lines: h.lines, acquired, summary: false });
  };

  const openSpot = (h: Hotspot) => {
    if (busy || gateRef.current) return;
    const cur = game.getRun() ?? run;
    const examined = cur.visited.includes(h.id);
    if (examined) {
      gateRef.current = true;
      setFlow({ k: 'dialogue', spot: h, lines: h.lines.slice(0, 1), acquired: [], summary: true });
      return;
    }
    if (h.precise) {
      // 마지막 행동으로 들어온 장소(행동 0): 정밀 조사(+1)는 못 한다 — 「0 → −1」 비용 프롬프트를 띄우지 않고 안내만
      if (cur.actions < 1) {
        toast({ kind: 'warn', text: TOAST.noActionPrecise, ms: 2400 });
        return;
      }
      gateRef.current = true;
      setPendingPrecise(h);
      spend.request({ kind: 'precise', id: h.id, label: h.label, preNote: h.preNote });
      return;
    }
    gateRef.current = true;
    doExamine(h);
  };

  const viaRail = (h: Hotspot) => {
    if (busy || gateRef.current) return;
    setPan({ id: h.id, n: (pan?.n ?? 0) + 1 });
    const ms = fxMs(T.panRail, fx);
    if (ms <= 0) openSpot(h);
    else {
      gateRef.current = true;
      panTimer.current = setTimeout(() => {
        panTimer.current = null;
        gateRef.current = false;
        openSpot(h);
      }, ms);
    }
  };

  const afterDialogue = () => {
    if (flow.k !== 'dialogue') return;
    const { spot, acquired, summary } = flow;
    if (summary || acquired.length === 0) {
      setFlow({ k: 'explore' });
      return;
    }
    // 획득 카드·기기 로그가 뜨는 순간 픽업음
    playSfx('pickup');
    if (spot.device) setFlow({ k: 'log', spot, ids: acquired });
    else setFlow({ k: 'acquire', ids: acquired, i: 0 });
  };

  const afterLog = () => {
    if (flow.k !== 'log') return;
    const rest = flow.ids.slice(1);
    toast({ kind: 'ok', text: TOAST.evidenceAdded(evidenceCount(game.getRun()!), EVIDENCE_TOTAL), ms: 1600 });
    setFlow(rest.length ? { k: 'acquire', ids: rest, i: 0 } : { k: 'explore' });
  };

  const afterAcquire = () => {
    if (flow.k !== 'acquire') return;
    if (flow.i + 1 < flow.ids.length) setFlow({ k: 'acquire', ids: flow.ids, i: flow.i + 1 });
    else {
      toast({ kind: 'ok', text: TOAST.evidenceAdded(evidenceCount(game.getRun()!), EVIDENCE_TOTAL), ms: 1600 });
      setFlow({ k: 'explore' });
    }
  };

  const confirmPrecise = () => {
    const h = pendingPrecise;
    spend.cancel();
    setPendingPrecise(null);
    if (h) doExamine(h);
  };

  const startBriefing = () => {
    if (!TUTORIAL_SET) return;
    nav.openSet(TUTORIAL_SET.id);
  };

  // 튜토리얼 코치(한 번에 하나만)
  const noCoachBlock = flow.k === 'explore' && !spend.target;
  let coach: { id: string; text: string } | null = null;
  if (tutorial && noCoachBlock) {
    if (!run.visited.includes(firstId ?? '') && !coachSeen('firstDot')) coach = { id: 'firstDot', text: COACH_TEXT.firstDot };
    else if (run.evidence.length > 0 && !coachSeen('acquire')) coach = { id: 'acquire', text: COACH_TEXT.acquire };
    else if (coachSeen('acquire') && !coachSeen('freeLook')) coach = { id: 'freeLook', text: COACH_TEXT.freeLook };
  }
  const showBriefing = tutorial && run.evidence.length > 0 && flow.k === 'explore';
  const acquireCardId = flow.k === 'acquire' ? flow.ids[flow.i] : null;
  const logEv = flow.k === 'log' ? getEvidence(flow.ids[0]) : undefined;
  const dlg = flow.k === 'dialogue' ? flow : null;

  return (
    <div className="wt-screen wt-screen--loc" data-loc={loc.art}>
      <HudBar variant="compact" run={run} onBack={() => nav.exit()} onNotebook={() => openNotebook()} notebookDot={hasNotebookNews(run)} previewPips={spend.target ? 1 : 0} onStar={requestAccuse} />
      <h1 className="wt-sr">{loc.name}</h1>
      <SceneView location={loc} spots={spots} dimIds={dim} locked={busy} onTap={openSpot} panTo={pan}>
        {dlg && (
          <div className="wt-loc-dialogue">
            <DialogueBox lines={dlg.lines} playKey={`hs:${dlg.spot.id}:${dlg.summary ? 's' : 'n'}`} onDone={afterDialogue} readKey={`${dlg.spot.id}`} instant={dlg.summary} />
            {dlg.summary && (
              <button type="button" className="wt-btn wt-btn--ghost wt-btn--sm" onClick={() => { setFlow({ k: 'explore' }); openNotebook('evidence'); }}>
                수첩에서 보기
              </button>
            )}
          </div>
        )}
        {spend.target && (
          <div className="wt-loc-spend">
            <SpendPrompt
              run={run}
              target={spend.target}
              onConfirm={confirmPrecise}
              onCancel={() => {
                spend.cancel();
                setPendingPrecise(null);
              }}
              onOpenNotebook={() => {
                spend.cancel();
                setPendingPrecise(null);
                openNotebook();
              }}
            />
          </div>
        )}
        {coach && <CoachBubble text={coach.text} placement="dock" onDismiss={() => game.markCoach(coach!.id)} />}
      </SceneView>
      <HotspotRail
        spots={spots}
        dimIds={dim}
        disabled={busy}
        onPick={viaRail}
        onExit={() => nav.exit()}
        extra={
          showBriefing ? (
            <button type="button" className="wt-btn wt-btn--primary wt-btn--sm wt-rail-brief" onClick={startBriefing} data-testid="briefing-start">
              브리핑 시작
            </button>
          ) : undefined
        }
      />

      <DeviceLogSheet open={flow.k === 'log'} hotspot={flow.k === 'log' ? flow.spot : null} evidence={logEv ?? null} onClose={afterLog} />
      <EvidenceAcquireCard
        open={flow.k === 'acquire'}
        evidence={acquireCardId ? getEvidence(acquireCardId) ?? null : null}
        count={evidenceCount(run)}
        total={EVIDENCE_TOTAL}
        onClose={afterAcquire}
      />
    </div>
  );
}

