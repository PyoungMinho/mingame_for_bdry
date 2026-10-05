'use client';

/**
 * 「목격자는 AI」 앱 루트 — 쉘(.wt-shell) · 컨텍스트 · 화면 라우터 · 전역 시트(수첩·설정·도감·사건 파일·공유·지목 게이트).
 * URL 은 /witness 하나(해시·딥링크 없음). 화면은 run.screen 앵커로 복원한다(디자인 §2-3·§7-4).
 * 하이드레이션 안전: 서버·첫 렌더는 스켈레톤. 마운트 뒤 effect 에서 저장을 읽고 화면을 정한다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { absorbFound, canAccuse, exit as engineExit, getLine, getSet, keepSavedRun, minutesLeft, openSet, recallPlan, rewindOption, stars, startAccuse, visibleLines, type HintTarget, type RecallPlan, type RunState, type Screen } from '@/lib/witness';
import { BackStackProvider, useBackGuard, useEscClose } from '../lib/BackStack';
import { REPLAY_TEXT, TOAST } from '../lib/copy';
import { WtContext, useWt, type NotebookTab, type WtCtx } from '../lib/context';
import { vibrate } from '../lib/fx';
import type { EndingData } from '../lib/format';
import { useWitnessGame } from '../lib/useWitnessGame';
import { BottomSheet, ConfirmSheet } from '../components/BottomSheet';
import { StartSheet } from '../components/StartSheet';
import { CaseFileView, CollectionView } from '../components/Collection';
import { Notebook } from '../components/Notebook';
import { OrientationGuard, RainLayer } from '../components/Overlays';
import { RulesSheet, SettingsSheet } from '../components/Settings';
import { ShareSheet } from '../components/Ending';
import { ToastStack, useToasts } from '../components/Toast';
import { AccuseScreen } from './AccuseScreen';
import { EndingScreen, ExcludedScreen } from './EndingScreen';
import { HubScreen } from './HubScreen';
import { IntroScreen, RulesScreen } from './IntroScreen';
import { LocationScreen } from './LocationScreen';
import { SirenScreen } from './SirenScreen';
import { TestimonyScreen } from './TestimonyScreen';
import { TitleScreen, TitleSkeleton } from './TitleScreen';
import type { Scene } from '../audio/cues';
import { playSfx, useGameAudio, useSfxOnRise } from '../audio/useGameAudio';

export function WitnessApp() {
  return (
    <BackStackProvider>
      <AppInner />
    </BackStackProvider>
  );
}

function ambientOf(run: RunState | null, scr: string | undefined): 'tense' | 'siren' | 'clear' | undefined {
  if (!run) return undefined;
  if (run.phase === 'siren' || scr === 'siren') return 'siren';
  if (scr === 'accuse') return 'clear';
  if (run.phase === 'ended') return run.result && (run.result.ending === 'perfect' || run.result.ending === 'hidden') ? 'clear' : undefined;
  if (run.actions <= 3 || run.trust <= 2) return 'tense';
  return undefined;
}

/**
 * 소리용 장면 — 지금 화면에 보이는 것만(연출 중이면 잡아 둔 화면). PlayRouter 와 같은 규칙으로 고른다.
 * 엔딩 곡은 엔딩 화면이 실제로 뜬 뒤에만(지목 판정 연출 중에는 지목 곡 유지).
 */
export function sceneOf(ready: boolean, view: 'title' | 'play' | 'ending', run: RunState | null, held: Screen | null, lastEnding: string | undefined): Scene {
  if (!ready) return { ready: false, view: 'title' };
  if (view === 'ending') return { ready: true, view: 'ending', ending: (lastEnding as Scene['ending']) ?? null };
  if (view === 'title' || !run) return { ready: true, view: 'title' };
  if (run.phase === 'ended' && !held) return { ready: true, view: 'play', screen: 'ending', phase: run.phase, ending: run.result?.ending ?? null };
  const scr = held ?? run.screen;
  const setId = scr.name === 'testimony' ? scr.ref : undefined;
  return { ready: true, view: 'play', screen: scr.name, setId, setKind: setId ? getSet(setId)?.kind : undefined, phase: run.phase, actions: run.actions };
}

function AppInner() {
  const game = useWitnessGame();
  const toasts = useToasts();
  const [nbOpen, setNbOpen] = useState(false);
  const [nbTab, setNbTab] = useState<NotebookTab>('evidence');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [collOpen, setCollOpen] = useState(false);
  const [caseOpen, setCaseOpen] = useState(false);
  const [shareData, setShareData] = useState<EndingData | null>(null);
  const [gate, setGate] = useState<null | 'info' | 'confirm'>(null);
  /** 새 수사 시트·확인(진입 3곳 공통) — plan 이 있으면 「기억 이어가기 / 처음부터」, 없으면 저장된 판 확인만 */
  const [startAsk, setStartAsk] = useState<null | { skipTutorial?: boolean; plan: RecallPlan | null; hasSaved: boolean; savedRewind: boolean }>(null);
  const lastBack = useRef(0);
  useEscClose();

  const run = game.run;
  const scrName = (game.heldScreen ?? run?.screen)?.name;
  const inPlay = game.ready && game.view === 'play' && !!run;

  // 플레이 중 저장이 막히면(용량·사생활 보호 모드) 한 번만 알린다 — 타이틀의 띠는 플레이 중엔 안 보인다
  const warnedSave = useRef(false);
  useEffect(() => {
    if (!inPlay || game.persistent || warnedSave.current) return;
    warnedSave.current = true;
    toasts.push({ kind: 'warn', text: TOAST.saveBlocked, ms: 4000 });
  }, [inPlay, game.persistent, toasts.push]);

  // 다른 탭에서 바뀐 저장을 다시 읽었으면 한 번 알린다(A1)
  useEffect(() => {
    if (game.synced > 0) toasts.push({ kind: 'info', text: TOAST.synced, ms: 2600 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.synced]);

  const vib = useCallback((p: number | readonly number[]) => vibrate(game.settings.haptics, p), [game.settings.haptics]);
  const toast = toasts.push;

  const startAccuseNow = useCallback(() => {
    setGate(null);
    game.act((r) => startAccuse(r));
  }, [game]);

  const requestAccuse = useCallback(() => {
    const r = game.getRun();
    if (!r || r.phase === 'ended') return;
    if (!canAccuse(r)) {
      setGate('info');
      return;
    }
    if (r.actions > 0 && r.phase === 'play') {
      setGate('confirm');
      return;
    }
    startAccuseNow();
  }, [game, startAccuseNow]);

  const requestNewRun = useCallback(
    (o: { skipTutorial?: boolean } = {}) => {
      const r = game.getRun();
      const hasSaved = !!r && keepSavedRun(r);
      // 저장된 판이 되감기를 기다리는 끝난 판이면 경고를 「되감기 기회도 사라져요」로(UX-10)
      const savedRewind = hasSaved && r!.phase === 'ended';
      // 끝나지 않은 판을 버리면 거기서 찾은 증거도 기억에 들어간다 — 시트의 「증거 n개」가 시작 때 실제 들고 가는 수와 같도록 미리 합쳐서 센다
      const base = r && r.phase !== 'ended' ? absorbFound(game.meta, r) : game.meta;
      const plan = recallPlan(base);
      if (!plan && !hasSaved) {
        game.startNew(o);
        return;
      }
      setStartAsk({ ...o, plan, hasSaved, savedRewind });
    },
    [game],
  );

  const pickStart = (recall: boolean) => {
    const a = startAsk;
    setStartAsk(null);
    if (!a) return;
    if (recall && a.plan) {
      playSfx('pickup');
      game.startNew({ skipTutorial: a.skipTutorial, plan: a.plan });
    } else game.startNew({ skipTutorial: a.skipTutorial });
  };

  const openNotebook = useCallback(
    (tab?: NotebookTab) => {
      const r = game.getRun();
      const scr = (game.heldScreen ?? r?.screen)?.name;
      if (tab) setNbTab(tab);
      if (scr === 'hub') game.anchor({ tab: 'notebook' });
      else setNbOpen(true);
    },
    [game],
  );

  const gotoTarget = useCallback(
    (t: HintTarget) => {
      setNbOpen(false);
      const r = game.getRun();
      if (!r) return;
      if (t.kind === 'accuse') {
        requestAccuse();
        return;
      }
      // 행동 0 인 대상(마지막 행동으로 들어온 장소·세트) 안: 여기서 나가면 곧 사이렌이다.
      // 메모의 [그 장소로/그 증언으로]는 나가기(사이렌)로 바꾸지 않고 안내만 한다(나가기는 [나가기]로만)
      if (r.phase === 'play' && r.actions <= 0 && r.screen.name !== 'hub') {
        toast({ kind: 'warn', text: TOAST.zeroInside, ms: 2400 });
        return;
      }
      game.setHighlight({ target: t, at: Date.now() });
      const tab = t.kind === 'set' ? 'people' : 'house';
      if (r.screen.name === 'hub') game.anchor({ tab });
      else {
        const step = game.act((x) => engineExit(x, tab));
        if (step.error) toast({ kind: 'warn', text: TOAST.sirenLocked });
      }
    },
    [game, requestAccuse, toast],
  );

  const jumpToLine = useCallback(
    (lineId: string) => {
      const ref = getLine(lineId);
      if (!ref) return;
      setNbOpen(false);
      // gotoTarget 과 같은 가드(QA-BAL-01): 행동 0 대상 안에서는 그 대상(final) 밖 증언으로 바로 건너가지 않는다
      const r = game.getRun();
      if (r && r.phase === 'play' && r.actions <= 0 && r.screen.name !== 'hub' && !r.final.includes(ref.set.id)) {
        toast({ kind: 'warn', text: TOAST.zeroInside, ms: 2400 });
        return;
      }
      const step = game.act((r) => openSet(r, ref.set.id));
      if (step.error) {
        toast({ kind: 'warn', text: TOAST.sirenLocked });
        return;
      }
      const idx = visibleLines(step.run, ref.set.id).findIndex((x) => x.line.id === lineId);
      if (idx >= 0) game.anchor({ line: idx });
    },
    [game, toast],
  );

  const ctx = useMemo<WtCtx>(
    () => ({
      game,
      fx: game.fxMode,
      toast,
      openNotebook,
      closeNotebook: () => setNbOpen(false),
      notebookOpen: nbOpen,
      nbTab,
      setNbTab,
      requestAccuse,
      jumpToLine,
      openSettings: () => setSettingsOpen(true),
      openRules: () => setRulesOpen(true),
      openCollection: () => setCollOpen(true),
      openCaseFile: () => setCaseOpen(true),
      openShare: (d) => setShareData(d),
      requestNewRun,
      vib,
      gotoTarget,
      coachSeen: (id) => game.meta.coach.includes(id),
    }),
    [game, toast, openNotebook, nbOpen, nbTab, requestAccuse, jumpToLine, requestNewRun, vib, gotoTarget],
  );

  // 하드웨어·브라우저 뒤로: 열린 층 닫기 → 한 단계 위 화면 → 허브에서는 한 번 더 누르면 나감
  useBackGuard(inPlay, () => {
    if (game.heldScreen) return 'handled';
    const r = game.getRun();
    if (!r) return 'handled';
    if (r.phase === 'ended') {
      game.leaveEnding();
      game.toTitle();
      return 'handled';
    }
    switch (r.screen.name) {
      case 'location':
      case 'testimony':
        game.act((x) => engineExit(x));
        return 'handled';
      case 'hub': {
        const now = Date.now();
        if (now - lastBack.current < 2000) return 'leave';
        lastBack.current = now;
        toast({ kind: 'info', text: TOAST.backAgain, ms: 2000 });
        return 'handled';
      }
      case 'accuse':
        if (r.accuse?.stage === 'slots') {
          game.patch((x) => (x.accuse ? { ...x, accuse: { ...x.accuse, stage: 'suspect' } } : x));
        } else game.patch((x) => ({ ...x, accuse: undefined, screen: { name: 'hub', tab: x.screen.tab ?? 'house' } }));
        return 'handled';
      default:
        return 'handled';
    }
  });

  // N = 수첩(입력창·열린 시트가 없을 때만)
  useEffect(() => {
    if (!inPlay) return;
    const on = (e: KeyboardEvent) => {
      if ((e.key !== 'n' && e.key !== 'N') || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (/^(input|textarea|select)$/i.test(t.tagName) || t.isContentEditable)) return;
      if (document.querySelector('.wt-sheet')) return;
      e.preventDefault();
      openNotebook();
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [inPlay, openNotebook]);

  // 탭이 숨겨지면 애니메이션 일시정지
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const f = () => setPaused(document.visibilityState === 'hidden');
    document.addEventListener('visibilitychange', f);
    return () => document.removeEventListener('visibilitychange', f);
  }, []);

  // 연출 ‘줄이기’ 기본값 등으로 바뀌는 문서 언어·테마 색
  const s = game.settings;

  // 소리 — 장면 → 곡, 설정 → 음량. 수첩 열기 · 사이렌은 바뀌는 순간만(이어하기 직후 첫 동기화는 무음)
  useGameAudio(sceneOf(game.ready, game.view, run, game.heldScreen, game.meta.lastEnding?.ending), s);
  useSfxOnRise(nbOpen || (scrName === 'hub' && run?.screen.tab === 'notebook'), 'paper', inPlay);
  // 사이렌 효과음은 '사이렌에 처음 들어갈 때' 한 번만(디자인 §5-6). 사이렌 뒤 배제 엔딩(ended)은 사이렌이 이어지는 것으로 보아
  // 되감기(ended → siren)에서 다시 울리지 않는다(QA-BAL-02). 연결부만 — audio/ 기능은 그대로
  // 지목 되감기(accuseCp 가 사이렌 뒤)도 같다 — 사이렌 뒤에 지목했다가 되감아 사이렌 화면으로 돌아와도 다시 울리지 않는다
  const sirenOn = run?.phase === 'siren' || (run?.phase === 'ended' && ((run.result?.ending === 'excluded' && run.checkpoint?.phase === 'siren') || run.accuseCp?.phase === 'siren'));
  useSfxOnRise(sirenOn, 'siren', inPlay);
  const ambient = ambientOf(run, scrName);
  // 되감기를 기다리는 끝난 판 — 사건 파일(진상·내가 못 깬 모순)을 잠근다(A2·UX-1)
  const rewindPending = !!run && run.phase === 'ended' && rewindOption(run) !== null;

  let body: React.ReactNode;
  if (!game.ready) body = <TitleSkeleton />;
  else if (game.view === 'title') body = <TitleScreen />;
  else if (game.view === 'ending') body = <EndingScreen />;
  else if (!run) body = <TitleScreen />;
  else body = <PlayRouter />;

  const mins = run ? minutesLeft(run) : 0;
  return (
    <WtContext.Provider value={ctx}>
      <div
        className={['wt-shell', paused ? 'wt-paused' : ''].filter(Boolean).join(' ')}
        data-text={s.text}
        data-speed={s.speed}
        data-fx={game.fxMode}
        data-hand={s.leftHand ? 'left' : undefined}
        data-ambient={ambient}
        lang="ko"
      >
        <RainLayer />
        <OrientationGuard />
        <div className="wt-frame">{body}</div>
        <ToastStack items={toasts.items} />

        {/* 전역 시트 */}
        {run && (
          <BottomSheet open={nbOpen} title="수첩" onClose={() => setNbOpen(false)} height="full" hideTitle className="wt-sheet--notebook">
            <Notebook run={run} tab={nbTab} onTab={setNbTab} onGoto={gotoTarget} onJumpLine={jumpToLine} asSheet />
          </BottomSheet>
        )}
        <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} inGame={inPlay} onTitle={() => { setSettingsOpen(false); game.toTitle(); }} onShowRules={() => setRulesOpen(true)} />
        <RulesSheet open={rulesOpen} onClose={() => setRulesOpen(false)} />
        <CollectionView open={collOpen} meta={game.meta} waitRewind={rewindPending} onClose={() => setCollOpen(false)} onCaseFile={() => setCaseOpen(true)} />
        <CaseFileView open={caseOpen} meta={game.meta} waitRewind={rewindPending} brokenIds={run?.phase === 'ended' && !rewindPending ? run.broken : undefined} onClose={() => setCaseOpen(false)} />
        {shareData && <ShareSheet open data={shareData} plays={game.meta.plays} onClose={() => setShareData(null)} />}

        {startAsk?.plan ? (
          <StartSheet
            open
            plan={startAsk.plan}
            warn={startAsk.hasSaved ? (startAsk.savedRewind ? REPLAY_TEXT.sheetWarnRewind : REPLAY_TEXT.sheetWarn) : null}
            primary={game.meta.lastEnding?.ending === 'perfect' || game.meta.lastEnding?.ending === 'hidden' ? 'fresh' : 'recall'}
            onRecall={() => pickStart(true)}
            onFresh={() => pickStart(false)}
            onClose={() => setStartAsk(null)}
          />
        ) : (
          <ConfirmSheet open={!!startAsk} title="새 수사를 시작할까요?" confirmLabel="새로 시작" cancelLabel="취소" onCancel={() => setStartAsk(null)} onConfirm={() => pickStart(false)}>
            <p>{startAsk?.savedRewind ? REPLAY_TEXT.sheetWarnRewind : '지금 수사 기록이 지워져요.'} (엔딩 도감·업적은 그대로예요)</p>
          </ConfirmSheet>
        )}

        <BottomSheet open={gate === 'info'} title="아직 지목할 수 없다" onClose={() => setGate(null)} height="confirm">
          <p className="wt-confirm-body">결정적 모순 3개를 깨면 지목할 수 있다. 지금 {run ? stars(run) : 0}개.</p>
          <div className="wt-actions">
            <button type="button" className="wt-btn wt-btn--primary wt-btn--full" onClick={() => setGate(null)} data-autofocus="">
              알겠어요
            </button>
          </div>
        </BottomSheet>
        <ConfirmSheet open={gate === 'confirm'} title="남은 시간을 버리고 지목할까요?" confirmLabel="지목하러 간다" cancelLabel="수사 계속" onCancel={() => setGate(null)} onConfirm={startAccuseNow}>
          <p>지금 넘기면 「강력팀 도착 {mins}분 전」이 돼요.</p>
        </ConfirmSheet>
      </div>
    </WtContext.Provider>
  );
}

/** run.screen 앵커 → 화면. 연출 중(heldScreen)에는 그 시점의 화면을 유지한다 */
function PlayRouter() {
  const { game } = useWt();
  const run = game.run!;
  const scr = game.heldScreen ?? run.screen;
  if (run.phase === 'ended' && !game.heldScreen) {
    return run.result?.ending === 'excluded' ? <ExcludedScreen /> : <EndingScreen />;
  }
  switch (scr.name) {
    case 'intro':
      return <IntroScreen key="intro" />;
    case 'rules':
      return <RulesScreen key="rules" />;
    case 'location':
      return scr.ref ? <LocationScreen key={`loc:${scr.ref}`} locId={scr.ref} /> : <HubScreen key="hub" />;
    case 'testimony':
      return scr.ref ? <TestimonyScreen key={`set:${scr.ref}`} setId={scr.ref} /> : <HubScreen key="hub" />;
    case 'accuse':
      return <AccuseScreen key="accuse" />;
    case 'siren':
      return <SirenScreen key="siren" />;
    case 'ending':
      return run.result?.ending === 'excluded' ? <ExcludedScreen key="ex" /> : <EndingScreen key="end" />;
    default:
      return <HubScreen key="hub" />;
  }
}

