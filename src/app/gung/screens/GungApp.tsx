'use client';

/**
 * 게임 오케스트레이터 — §1-4 앱 프레임을 조립하고(헤더·본문·액션바·탭바), useGungGame으로 상태를
 * 영속화하며, 셋업(S1~S6)·방장(H1~H10)·플레이어(P1~P10)·오버레이(O1~O11)를 phase에 따라 스위치한다.
 *
 * 취객 가드(§10-2) 설계 메모
 *  - 진행 버튼(ActionBar)은 단계가 바뀌어도 **같은 GuButton 인스턴스**로 남긴다(키로 재마운트 금지). 그래야
 *    "다음"을 두 번 빨리 눌렀을 때 두 번째 탭이 600ms 디바운스에 걸려 두 단계 전진이 막힌다.
 *  - 그와 별개로 dispatch 단에서도 advance/skipIntro 를 600ms 안에 두 번 받지 않는다(본문 탭·액션바 탭이 겹쳐도).
 *  - 본문은 `phase|하위단계|탭` 키로만 재마운트한다 — 매 액션(updatedAt)마다 재마운트하면 단서를 처음 연 순간
 *    openClue 저장으로 카드가 통째로 다시 그려져 **열자마자 닫히는** 버그가 난다.
 *
 * 라운드 잠금(원고 3판) — 공용 화면 역할 독립성(QA RISK-04): 이 폰의 진행 단계가 "어느 역할이든 잠금 블록이 풀리는 라운드"
 * (이 사건은 조사 3)에 들어서는 순간, **모든 역할·모든 기기에 같은 문구** 「셋째 조사 — 각자 내 패를 다시 확인하시오」만 띄운다.
 * 내 기억이 풀렸는지는 '내 패' 봉인 속에서만 알 수 있다. 예전엔 기억 보유 역할만 「새 기억이 떠올랐소」를 받아, 방장이 조상궁·
 * 세자빈이면 공용 무대에 그 배너가 떠 역할이 드러났다. 새로고침 복원·자리 바꾸기 직후 첫 계산에선 띄우지 않는다(이미 본 사람).
 */
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import {
  type GameAction,
  type GameState,
  type RoundNo,
  applyAction,
  buildHostRecoveryUrl,
  canUndo,
  copyText,
  externalOpenUrl,
  formatRoomCode,
  genericPayload,
  invitePayload,
  ogResultUrl,
  openExternal,
  parseRoomCode,
  PHASE_LABELS,
  publicBoardUpTo,
  railStep,
  reachedRound,
  recheckRoundBetween,
  resultOf,
  resultPayload,
  resultShareInput,
  roundPlaces,
  share,
  sharedTerms,
  SITE_ORIGIN,
  type SharePayload,
  TIME_TABLE_NOTE,
  timeTable,
  ymd,
} from '@/lib/gung';
import { sejaCase } from '@/lib/gung/case-data';
import { ActionBar, Banner, BottomSheet, BottomTabs, CountdownOverlay, GuButton, GuFrame, GuHeader, PlaceGrid, ResultImageModal, Toast } from '../components';
import type { GuTabKey } from '../components';
import { useBackGuard, useSetupBackGuard } from '../lib/useBackGuard';
import { useGungGame } from '../lib/useGungGame';
import { ensureAudio, playGong, playTock, vibrate } from '../lib/sound';
import { useTimer } from '../lib/useTimer';
import { useWakeLock } from '../lib/useWakeLock';
import { placeToSummary, toHeaderRail } from './adapters';
import { HostPlayArea } from './HostScreens';
import { AbsentSheet, ConfirmSheet, MenuSheet, RulesSheet, SeatChangeSheet, SyncSheet, TermsSheet, WakeSheet, type ConfirmRequest, type MenuRow } from './Overlays';
import { PlayerPlayArea } from './PlayerScreens';
import { BadCodeScreen, ConflictScreen, CreateRoom, EnterCode, Home, Invite, SeatPick, type SeatPickStep } from './Setup';
import { CluesTab } from './Tabs';

interface ToastState {
  key: number;
  text: string;
  action?: { label: string; onClick: () => void };
  duration?: number;
  /**
   * 'advance' = 방장 단계 전진 되돌리기 토스트 · 'pick:N' = N라운드 장소 되돌리기 토스트.
   * 그 되돌리기가 더는 유효하지 않게 되면(다른 기록이 쌓임·단서를 엶) 토스트를 거둔다(QA BUG-09·BUG-17).
   */
  tag?: string;
}

type SheetKind = 'sync' | 'menu' | 'absent' | 'rules' | 'seat' | 'wake' | 'terms';

const ROUND_WORD: Record<RoundNo, string> = { 1: '첫째', 2: '둘째', 3: '셋째' };
/** 셋업에서 하드웨어 뒤로를 "이전 셋업 단계"로 바꾸는 화면(§12-4, QA BUG-21) — 홈은 가드하지 않는다(뒤로 = 페이지 이탈) */
const GUARDED_SETUP = new Set(['createRoom', 'enterCode', 'seatPick', 'conflict', 'badCode']);

const ADVANCE_GUARD_MS = 600;

const VOTE_TITLES: Record<string, string> = { ready: '지목', input: '지목 입력', tally: '지목 집계', revote: '재지목', final: '재지목 집계' };

/** 헤더 단계명(§3 와이어프레임) */
function headerTitle(s: GameState): string {
  const isHost = s.role === 'host';
  switch (s.phase) {
    case 'lobby':
      return isHost ? '대기실 · 준비' : '대기 · 준비';
    case 'briefing':
    case 'intro':
      return `${PHASE_LABELS[s.phase]} · 준비`;
    case 'cards':
      return isHost ? '패 확인 · 준비' : '내 패 확인 · 준비';
    case 'r1':
    case 'r2':
    case 'r3': {
      const r = Number(s.phase[1]) as RoundNo;
      if (isHost) return `${PHASE_LABELS[s.phase]} · ${s.host?.roundSub === 'discuss' ? '토론' : '장소 고르기'}`;
      return `${PHASE_LABELS[s.phase]} · ${s.rounds[r] ? '단서' : '장소 고르기'}`;
    }
    case 'vote':
      return isHost ? VOTE_TITLES[s.host?.vote?.sub ?? 'ready'] ?? '지목' : '지목';
    case 'reveal':
      return '그날 밤의 진상';
    default:
      return PHASE_LABELS[s.phase];
  }
}

export function GungApp() {
  const g = useGungGame();
  const c = sejaCase;
  const state = g.state;
  const a = g.assignment;
  const isHost = state?.role === 'host';

  const [activeTab, setActiveTab] = useState<GuTabKey>('progress');
  const [sealEpoch, setSealEpoch] = useState(0);
  const [showInvite, setShowInvite] = useState(false);
  const [sheet, setSheet] = useState<SheetKind | null>(null);
  const [confirmReq, setConfirmReq] = useState<ConfirmRequest | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [showCountdown, setShowCountdown] = useState(false);
  const [copied, setCopied] = useState<'invite' | 'result' | null>(null);
  const [catchUpRound, setCatchUpRound] = useState<RoundNo | null>(null);
  const [draftPlace, setDraftPlace] = useState<string | null>(null);
  const [draftVote, setDraftVote] = useState<number | null>(null);
  const [truthView, setTruthView] = useState<'truth' | 'all'>('truth');
  const [resultImageOpen, setResultImageOpen] = useState(false);
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});
  const [ua, setUa] = useState('');
  /**
   * 내 패 탭을 '비밀' 섹션(잠금 블록이 있으면 그 쪽)부터 열기(배너 → 내 패 보기). 탭·단계가 바뀌면 비운다.
   * 봉인 중엔 쪽 수·현재 쪽이 안 보이므로 기억이 있든 없든 봉인 화면은 같다.
   */
  const [cardFocus, setCardFocus] = useState<'memory' | null>(null);
  /** 「셋째 조사 — 각자 내 패를 다시 확인하시오」 — 역할·인원과 무관하게 모든 기기에 같은 알림(QA RISK-04) */
  const [roundNotice, setRoundNotice] = useState<RoundNo | null>(null);
  const roundWatch = useRef<{ key: string; round: number } | null>(null);
  /** S5 랜딩 ↔ S6 자리 고르기 — 하드웨어 뒤로가 이전 단계로 가도록 여기서 쥔다 */
  const [seatStep, setSeatStep] = useState<SeatPickStep>('landing');

  const lastAdvanceRef = useRef(0);
  const toastSeq = useRef(0);
  const copyTimer = useRef<number | undefined>(undefined);
  const stateRef = useRef(state);
  stateRef.current = state;
  const soundRef = useRef(g.prefs.sound);
  soundRef.current = g.prefs.sound;

  useEffect(() => setUa(navigator.userAgent), []);
  useEffect(() => () => window.clearTimeout(copyTimer.current), []);

  // 단계·하위 단계가 바뀌면: 진행 탭으로, 초안 비우기, 모든 봉인 즉시 재봉인(§1-4, §10-1)
  const phaseKey = state ? `${state.phase}|${state.host?.roundSub ?? ''}` : '';
  useEffect(() => {
    setActiveTab('progress');
    setDraftPlace(null);
    setDraftVote(null);
    setTruthView('truth');
    setCardFocus(null);
    setSealEpoch((n) => n + 1);
  }, [phaseKey]);

  // 잠금 블록이 풀리는 조사 라운드에 이 폰이 막 들어섰는가 — 서버가 없으니 기준은 이 폰의 로컬 진행 단계.
  // 판정에 역할·자리·인원을 쓰지 않는다(recheckRoundBetween) → 같은 순간 모든 폰에 같은 알림.
  const myReached = state ? reachedRound(state.phase) : 0;
  const myCode = state?.code ?? '';
  const mySeat = state?.seat ?? 0;
  useEffect(() => {
    if (!myCode || !mySeat) {
      roundWatch.current = null;
      return;
    }
    const key = `${myCode}|${mySeat}`;
    const prev = roundWatch.current;
    roundWatch.current = { key, round: myReached };
    if (!prev || prev.key !== key) {
      setRoundNotice(null); // 첫 계산(복원)·자리 바꾸기 — 알림 없음
      return;
    }
    if (myReached < prev.round) {
      // 되돌리기·단계 맞추기로 뒤로 — 아직 안 온 라운드의 알림은 거둔다
      setRoundNotice((n) => (n && n > myReached ? null : n));
      return;
    }
    const r = recheckRoundBetween(sejaCase, prev.round, myReached);
    if (r) setRoundNotice(r);
  }, [myReached, myCode, mySeat]);

  // S6 로 새로 들어올 때마다 랜딩부터
  useEffect(() => {
    if (g.mode === 'seatPick') setSeatStep('landing');
  }, [g.mode]);

  // 시트·확인창이 열리면 즉시 재봉인(§10-1)
  useEffect(() => {
    if (sheet || confirmReq || resultImageOpen) setSealEpoch((n) => n + 1);
  }, [sheet, confirmReq, resultImageOpen]);

  const pushToast = useCallback((text: string, action?: { label: string; onClick: () => void }, duration = 2500, tag?: string) => {
    toastSeq.current += 1;
    setToast({ key: toastSeq.current, text, action, duration, tag });
  }, []);
  const dropToast = useCallback((tag: string) => setToast((t) => (t?.tag === tag ? null : t)), []);

  const changeTab = useCallback((tab: GuTabKey) => {
    setActiveTab(tab);
    setCardFocus(null);
    setSealEpoch((n) => n + 1);
  }, []);

  // 1회성 알림(새로고침 복원 토스트 · 방장 복구 → O1)
  const { notice, clearNotice } = g;
  useEffect(() => {
    if (!notice) return;
    if (notice.kind === 'resumed') pushToast(`이어하는 중 · ${notice.seat}번 자리 · ${PHASE_LABELS[notice.phase]}`, undefined, 1500);
    else setSheet('sync');
    clearNotice();
  }, [notice, clearNotice, pushToast]);

  const rawDispatch = g.dispatch;
  const dispatch = useCallback(
    (action: GameAction) => {
      const prev = stateRef.current;
      const isAdvance = action.type === 'advance' || action.type === 'skipIntro';
      if (isAdvance) {
        const t = Date.now();
        if (t - lastAdvanceRef.current < ADVANCE_GUARD_MS) return; // 더블탭 2단 전진 방지(§10-2)
        lastAdvanceRef.current = t;
      }
      // 장소 되돌리기는 단서를 열기 전까지만 — 열었으면 그 토스트의 '되돌리기'는 죽은 버튼이 되므로 거둔다(QA BUG-17)
      if (action.type === 'openClue') dropToast(`pick:${action.round}`);
      if (prev?.role === 'host') {
        // iOS: AudioContext 는 사용자 탭 안에서 만들어야 나중에 징이 울린다(§12-6)
        if (soundRef.current) ensureAudio();
        const next = applyAction(prev, action, { c: sejaCase, now: Date.now() });
        // QA BUG-09: 전진 토스트의 '되돌리기'는 "가장 최근 기록"을 되돌린다 — 그 뒤에 다른 기록(다음 사람·롤콜·지목…)이
        // 쌓였다면 토스트가 가리키는 전진이 아니라 그 기록이 되돌려진다. 되돌리기 스택이 바뀌면 토스트를 거둔다.
        if (next !== prev && next.host?.history !== prev.host?.history) dropToast('advance');
        if (isAdvance) {
          const moved = next !== prev && (next.phase !== prev.phase || next.host?.roundSub !== prev.host?.roundSub);
          // §10-2 방장 단계 전진 6초 되돌리기 토스트(진상 비트는 ↶ 로만 — 전체화면을 가리지 않게)
          if (moved && next.phase !== 'reveal' && prev.phase !== 'reveal') {
            pushToast(`넘어갔소 → ${headerTitle(next)}`, { label: '되돌리기', onClick: () => rawDispatch({ type: 'undo' }) }, 6000, 'advance');
          }
        }
      }
      rawDispatch(action);
    },
    [rawDispatch, pushToast, dropToast],
  );

  const wake = useWakeLock(Boolean(state) && state?.phase !== 'result', isHost);

  useBackGuard(Boolean(state), () => {
    if (resultImageOpen) return setResultImageOpen(false), true;
    if (confirmReq) return setConfirmReq(null), true;
    if (sheet) return setSheet(null), true;
    if (catchUpRound !== null) return setCatchUpRound(null), true;
    if (showCountdown) return true;
    // QA BUG-22: S3 초대 화면엔 ⋮ 가 없다
    if (showInvite) return pushToast('초대를 마쳤으면 「대기실로 →」를 누르시오'), true;
    pushToast('나가려면 ⋮ › 처음으로');
  });

  // §12-4 셋업 화면(S2~S6·O9·코드 오류): 하드웨어 뒤로 = 이전 셋업 단계(QA BUG-21). 셋업에서 연 시트·확인창은 먼저 닫는다.
  const setupGuardKey =
    !state && g.ready && (GUARDED_SETUP.has(g.mode) || sheet || confirmReq) ? `${g.mode}|${g.mode === 'seatPick' ? seatStep : ''}|${sheet ?? ''}|${confirmReq ? 'c' : ''}` : null;
  useSetupBackGuard(setupGuardKey, () => {
    if (confirmReq) return setConfirmReq(null);
    if (sheet) return setSheet(null);
    if (g.mode === 'seatPick' && seatStep === 'seat') return setSeatStep('landing');
    g.goHome();
  });

  const hostTimer = isHost ? state?.host?.timer ?? null : null;
  const timerValue = useTimer(hostTimer, () => {
    playGong(soundRef.current);
    vibrate([200, 100, 200]);
  });

  const result = state && isHost ? resultOf(c, state) : null;
  // QA BUG-06: 판결이 안 난 판(지목 미완료로 건너뜀)은 결과 카드·OG 를 만들지 않는다 — "범인 도주 · 완전범죄"로 새지 않게
  const resultInput = result && a && state?.phase === 'result' && result.decided ? resultShareInput(result, a.n, ymd(new Date())) : null;
  const ogPublicUrl = resultInput ? ogResultUrl(resultInput) : null;
  // §8-3 H10 진입 즉시 결과 이미지를 미리 데운다(카카오 스크레이퍼가 콜드스타트를 맞지 않게)
  useEffect(() => {
    if (!ogPublicUrl) return;
    const img = new Image();
    img.src = ogPublicUrl;
  }, [ogPublicUrl]);

  if (!g.ready) return <div className="gu-boot" />;

  const origin = typeof window !== 'undefined' ? window.location.origin : SITE_ORIGIN;

  const flashCopied = (which: 'invite' | 'result') => {
    setCopied(which);
    window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => setCopied(null), 2000);
  };
  /** §8-5 폴백 체인 — sendDefault/navigator.share 는 탭 핸들러 안에서 await 전에 동기 호출된다(share() 계약) */
  const doShare = (payload: SharePayload, which: 'invite' | 'result' | null) => {
    void share(payload).then((outcome) => {
      if (outcome === 'copied') {
        if (which) flashCopied(which);
        pushToast('공유 대신 복사했소 — 단톡방에 붙여 넣으시오');
      } else if (outcome === 'failed') {
        pushToast('공유하지 못했소 — 링크 복사를 눌러 주시오');
      }
    });
  };
  const doCopy = (text: string, which: 'invite' | 'result') => {
    void copyText(text).then((ok) => (ok ? flashCopied(which) : pushToast('복사하지 못했소')));
  };

  const confirmReset = () =>
    setConfirmReq({ title: '처음으로 가겠소?', body: '지금 진행 중인 사건 기록이 지워지오.', danger: true, confirmLabel: '처음으로', onConfirm: g.resetToHome });
  const newRoom = () => {
    setShowInvite(false);
    g.resetToHome();
    g.goCreateRoom();
  };

  const storageBanner =
    !g.storagePersistent && !dismissed.storage ? (
      <Banner tone="warn" onDismiss={() => setDismissed((d) => ({ ...d, storage: true }))}>
        이 브라우저는 저장이 안 돼요. 새로고침하면 처음부터예요(같은 코드·자리로 다시 들어오면 내용은 같아요).
      </Banner>
    ) : null;

  // ── 셋업(게임 시작 전) ──────────────────────────────────────────────
  if (!state) {
    let screen: React.ReactNode;
    switch (g.mode) {
      case 'home': {
        const resume = g.entry && (g.entry.kind === 'home' || g.entry.kind === 'badCode') ? g.entry.resume : null;
        screen = (
          <Home
            hasResume={Boolean(resume)}
            resumeLabel={resume ? `${formatRoomCode(resume.code)} · ${resume.seat}번 자리 · ${PHASE_LABELS[resume.phase]}` : undefined}
            onResume={g.resumeSaved}
            onCreateRoom={
              resume
                ? () =>
                    setConfirmReq({
                      title: '새 방을 열겠소?',
                      body: `진행 중인 사건(${formatRoomCode(resume.code)} · ${PHASE_LABELS[resume.phase]})은 새 방을 여는 순간 지워지오.`,
                      danger: true,
                      confirmLabel: '새 방으로',
                      onConfirm: g.goCreateRoom,
                    })
                : g.goCreateRoom
            }
            onEnterCode={g.goEnterCode}
            onRules={() => setSheet('rules')}
            banner={storageBanner}
          />
        );
        break;
      }
      case 'createRoom':
        screen = (
          <CreateRoom
            c={c}
            onBack={g.goHome}
            onCreate={(n) => {
              ensureAudio(); // §12-6 S2 '방 열기' 탭에서 AudioContext 생성·resume
              if (g.createHost(n)) setShowInvite(true);
              else pushToast('방을 만들지 못했소. 다시 눌러 주시오');
            }}
          />
        );
        break;
      case 'enterCode':
        screen = <EnterCode onBack={g.goHome} onSubmit={(code) => g.submitCode(code)} />;
        break;
      case 'seatPick':
        screen = g.pendingRoom ? (
          <SeatPick
            c={c}
            room={g.pendingRoom.room}
            asHost={g.pendingRoom.asHost}
            onEnter={g.goHome}
            onBecomeHost={g.hostRecover}
            onSeat={g.joinAsPlayer}
            onRules={() => setSheet('rules')}
            versionMismatch={g.linkVersionMismatch}
            step={seatStep}
            onStepChange={setSeatStep}
          />
        ) : (
          <div className="gu-boot" />
        );
        break;
      case 'conflict': {
        const saved = g.conflictSaved;
        screen = (
          <ConflictScreen
            savedLabel={saved ? `${formatRoomCode(saved.code)} · ${PHASE_LABELS[saved.phase]}` : '이전 사건'}
            newLabel={g.pendingRoom?.room.display}
            onResume={g.resumeSaved}
            onFresh={() =>
              setConfirmReq({
                title: '기존 사건을 지우겠소?',
                body: '진행 중이던 사건 기록이 지워지고, 새 링크의 사건으로 들어가오.',
                danger: true,
                confirmLabel: '지우고 입장',
                onConfirm: g.startFreshFromConflict,
              })
            }
          />
        );
        break;
      }
      case 'badCode':
        screen = <BadCodeScreen onHome={g.goHome} />;
        break;
      default:
        screen = <div className="gu-boot" />;
    }
    return (
      <>
        {screen}
        {toast && (
          <div className="gu-floating-toast">
            <Toast key={toast.key} text={toast.text} action={toast.action} duration={toast.duration} onDismiss={() => setToast(null)} />
          </div>
        )}
        <RulesSheet open={sheet === 'rules'} onClose={() => setSheet(null)} c={c} />
        <ConfirmSheet request={confirmReq} onClose={() => setConfirmReq(null)} />
      </>
    );
  }

  if (!a) return <div className="gu-boot" />;
  const room = parseRoomCode(state.code);

  const recoverUrl = buildHostRecoveryUrl(origin, state.code);
  const canOpenExternal = Boolean(externalOpenUrl(recoverUrl, ua));
  const wakeBanner =
    isHost && wake.status === 'off' && !dismissed.wake ? (
      <Banner
        tone="warn"
        onDismiss={() => setDismissed((d) => ({ ...d, wake: true }))}
        action={
          canOpenExternal ? (
            <GuButton variant="secondary" fullWidth={false} onClick={() => openExternal(recoverUrl, { ua })}>
              기본 브라우저로 열기
            </GuButton>
          ) : undefined
        }
      >
        🌙 방장 폰은 화면이 꺼지면 타이머 종이 안 울려요. 설정 › 자동 잠금을 늘리시오.
      </Banner>
    ) : null;

  const shareInvite = () => {
    if (!room) return;
    doShare(invitePayload({ code: room.code, n: room.n, tag: room.tag, caseVersion: c.version, origin }), 'invite');
  };

  // S3 초대 — 방 생성 직후(phase 는 이미 'lobby'), 대기실 진입 전 로컬 서브스텝
  if (showInvite && room && isHost) {
    const payload = invitePayload({ code: room.code, n: room.n, tag: room.tag, caseVersion: c.version, origin });
    return (
      <>
        <Invite
          room={room}
          onContinue={() => setShowInvite(false)}
          onShare={shareInvite}
          onCopyLink={() => doCopy(payload.copyText, 'invite')}
          copied={copied === 'invite'}
          banner={wakeBanner}
        />
        {toast && (
          <div className="gu-floating-toast">
            <Toast key={toast.key} text={toast.text} action={toast.action} duration={toast.duration} onDismiss={() => setToast(null)} />
          </div>
        )}
        <video ref={wake.videoRef} src="/gung/awake.mp4" muted playsInline loop aria-hidden className="gu-sr" />
      </>
    );
  }

  const menuRows: MenuRow[] = [
    { key: 'rules', label: '하는 법', onClick: () => setSheet('rules') },
    { key: 'terms', label: '용어 풀이 · 시각표', onClick: () => setSheet('terms') },
    { key: 'sync', label: '진행 단계 맞추기', onClick: () => setSheet('sync') },
    ...(!isHost ? [{ key: 'seat', label: `자리 바꾸기 (지금 ${state.seat}번)`, onClick: () => setSheet('seat') }] : []),
    {
      key: 'reveal',
      label: `보기 방식: ${g.prefs.revealMode === 'hold' ? '꾹 누르는 동안' : '탭하면 15초'} — 바꾸기`,
      onClick: () => {
        const next = g.prefs.revealMode === 'hold' ? 'tap' : 'hold';
        g.setPrefs({ revealMode: next });
        pushToast(next === 'tap' ? '이제 탭하면 15초 동안 보여요' : '이제 꾹 누르는 동안만 보여요');
      },
    },
    { key: 'scale', label: `글자 크게: ${g.prefs.stageScale > 1 ? '켜짐' : '꺼짐'}`, onClick: () => g.setPrefs({ stageScale: g.prefs.stageScale > 1 ? 1 : 1.2 }) },
    { key: 'wake', label: `화면 꺼짐 방지: ${wake.status === 'on' ? '켜짐 🕯' : wake.status === 'off' ? '안 됨 🌙' : '확인 중'}`, onClick: () => setSheet('wake') },
    ...(isHost
      ? [
          { key: 'sound', label: `소리: ${g.prefs.sound ? '켜짐' : '꺼짐'}`, onClick: () => g.setPrefs({ sound: !g.prefs.sound }) },
          { key: 'invite', label: '초대 다시 보내기', onClick: shareInvite },
          ...(state.phase !== 'lobby' ? [{ key: 'absent', label: '자리 비우기', onClick: () => setSheet('absent') }] : []),
          ...(state.phase === 'lobby'
            ? [
                {
                  key: 'recount',
                  label: '인원 바꾸기(새 방)',
                  tone: 'danger' as const,
                  onClick: () =>
                    setConfirmReq({
                      title: '인원을 바꾸겠소?',
                      body: '인원을 바꾸면 새 방이 되오. 방 코드가 바뀌니 다시 초대해야 하오.',
                      danger: true,
                      confirmLabel: '새 방 만들기',
                      onConfirm: newRoom,
                    }),
                },
              ]
            : []),
        ]
      : []),
    { key: 'home', label: '처음으로', tone: 'danger' as const, onClick: confirmReset },
  ];

  const ogPreviewUrl = resultInput ? ogResultUrl({ ...resultInput, imageOrigin: origin }) : null;

  const area = isHost
    ? HostPlayArea({
        c,
        state,
        a,
        sealEpoch,
        revealMode: g.prefs.revealMode,
        activeTab,
        timerValue,
        onTimer: (op) => dispatch({ type: 'timer', op }),
        dispatch,
        onConfirm: setConfirmReq,
        onToast: pushToast,
        onStartCountdown: () => {
          if (g.prefs.sound) ensureAudio();
          setShowCountdown(true);
        },
        onGoTab: changeTab,
        stageScale: g.prefs.stageScale,
        onToggleScale: () => g.setPrefs({ stageScale: g.prefs.stageScale > 1 ? 1 : 1.2 }),
        onShareInvite: shareInvite,
        onShareResult: () => {
          if (!resultInput) return;
          doShare(resultPayload({ ...resultInput, origin }), 'result');
        },
        onCopyResult: () => {
          if (!resultInput) return;
          doCopy(resultPayload({ ...resultInput, origin }).copyText, 'result');
        },
        resultCopied: copied === 'result',
        onSaveImage: () => setResultImageOpen(true),
        ogPreviewUrl,
        onNewRoom: newRoom,
        onFinish: g.resetToHome,
        cardFocus,
      })
    : PlayerPlayArea({
        c,
        state,
        a,
        sealEpoch,
        revealMode: g.prefs.revealMode,
        activeTab,
        dispatch,
        onToast: pushToast,
        onConfirm: setConfirmReq,
        onGoTab: changeTab,
        draftPlace,
        setDraftPlace,
        draftVote,
        setDraftVote,
        truthView,
        setTruthView,
        onShareGeneric: () => doShare(genericPayload({ origin }), null),
        cardFocus,
      });

  const counting = isHost && showCountdown && state.phase === 'vote';
  const peekTip = !g.prefs.seenPeekTip && !sheet && !confirmReq && (activeTab === 'cards' || (!isHost && state.phase === 'cards'));

  const header = (
    <GuHeader
      left={isHost && canUndo(state) ? 'undo' : null}
      onLeft={() => {
        rawDispatch({ type: 'undo' });
        pushToast('되돌렸소');
      }}
      title={headerTitle(state)}
      rail={(() => {
        const r = toHeaderRail(railStep(state.phase));
        return r ? { current: r, onTap: () => setSheet('sync') } : undefined;
      })()}
      wake={wake.status}
      onHelp={() => setSheet('terms')}
      onMenu={() => setSheet('menu')}
    />
  );

  const tabsNode =
    !area.stageFullscreen && !counting ? (
      <BottomTabs
        role={state.role}
        active={activeTab}
        onChange={changeTab}
        clueBadge={Object.values(state.rounds).filter((r) => r?.disclosure === 'undecided').length}
      />
    ) : undefined;

  let body = area.body;
  let actionBar = area.actionBar;
  let actionSecondary = area.actionSecondary;
  let gateCaption = area.gateCaption;
  if (activeTab === 'clues') {
    const reached = reachedRound(state.phase);
    const publicUpTo = publicBoardUpTo(c, a.n, reached).map((card) => ({ id: card.id, round: card.round, title: card.title, body: card.body }));
    body = (
      <CluesTab
        c={c}
        a={a}
        seat={state.seat}
        reachedRound={reached}
        rounds={state.rounds}
        publicUpTo={publicUpTo}
        sealEpoch={sealEpoch}
        revealMode={g.prefs.revealMode}
        onDisclose={(round, value) => {
          dispatch({ type: 'disclose', round, value });
          if (value === 'public') pushToast('공개로 표시했소', { label: '되돌리기', onClick: () => dispatch({ type: 'undoDisclose', round }) }, 5000);
        }}
        onOpened={(round) => dispatch({ type: 'openClue', round })}
        onPickNow={setCatchUpRound}
      />
    );
  }
  if (activeTab !== 'progress') {
    // 내 패·단서함 탭 위에선 진행 버튼을 숨긴다 — 남의 화면(단서함)을 보다가 "다음"이 눌리지 않게.
    // 돌아가기는 바로 아래 탭바의 '진행/지금'.
    actionBar = undefined;
    actionSecondary = undefined;
    gateCaption = undefined;
  }

  const toastNode = toast ? <Toast key={toast.key} text={toast.text} action={toast.action} duration={toast.duration} onDismiss={() => setToast(null)} /> : undefined;
  const actionBarNode =
    !counting && (actionBar || gateCaption || toastNode || actionSecondary) ? (
      <ActionBar primary={actionBar} secondary={actionSecondary} caption={gateCaption} toast={toastNode} />
    ) : undefined;

  // cardFocus 포함(QA BUG-20): 이미 내 패 탭에 있을 때 「내 패에서 보기」를 눌러도 기억 쪽부터 다시 그린다
  const bodyKey = `${phaseKey}|${activeTab}|${truthView}|${cardFocus ?? ''}`;
  const banners = (
    <>
      {storageBanner}
      {g.saveVersionMismatch && !dismissed.version && (
        <Banner tone="warn" onDismiss={() => setDismissed((d) => ({ ...d, version: true }))}>
          사건 내용이 갱신됐어요. 새 방을 권해요.
        </Banner>
      )}
      {state.phase === 'lobby' && wakeBanner}
      {roundNotice && (
        // 모든 역할·모든 기기에 같은 문구(QA RISK-04) — 방장 공용 무대에 떠도 아무것도 드러나지 않는다
        <Banner
          tone="info"
          className="gu-banner--round"
          onDismiss={() => setRoundNotice(null)}
          action={
            <GuButton
              variant="secondary"
              fullWidth={false}
              onClick={() => {
                setRoundNotice(null);
                changeTab('cards');
                setCardFocus('memory');
              }}
            >
              지금 확인하기
            </GuButton>
          }
        >
          {ROUND_WORD[roundNotice]} 조사 — 각자 내 패를 다시 확인하시오
        </Banner>
      )}
    </>
  );

  return (
    <>
      <GuFrame
        header={header}
        actionBar={actionBarNode}
        tabs={tabsNode}
        surface={activeTab === 'progress' && isHost ? 'stage' : 'private'}
        className={g.prefs.stageScale > 1 ? 'gu-frame--large' : undefined}
      >
        {banners}
        <Fragment key={bodyKey}>{body}</Fragment>
      </GuFrame>
      {counting && (
        <CountdownOverlay
          onWordChange={(_, i) => (i < 3 ? playTock(soundRef.current) : playGong(soundRef.current))}
          onDone={() => {
            setShowCountdown(false);
            dispatch({ type: 'advance' });
          }}
        />
      )}
      {isHost && <video ref={wake.videoRef} src="/gung/awake.mp4" muted playsInline loop aria-hidden className="gu-sr" />}
      <SyncSheet open={sheet === 'sync'} onClose={() => setSheet(null)} state={state} onSync={(phase) => dispatch({ type: 'syncPhase', phase })} onConfirm={setConfirmReq} />
      <MenuSheet open={sheet === 'menu'} onClose={() => setSheet(null)} rows={menuRows} />
      {isHost ? (
        <AbsentSheet open={sheet === 'absent'} onClose={() => setSheet(null)} state={state} n={a.n} onConfirm={(seat) => dispatch({ type: 'setAbsent', seat, absent: true })} />
      ) : (
        <SeatChangeSheet
          open={sheet === 'seat'}
          onClose={() => setSheet(null)}
          state={state}
          n={a.n}
          onChange={(seat) => {
            dispatch({ type: 'changeSeat', seat });
            pushToast(`${seat}번 자리로 바꿨소`);
          }}
        />
      )}
      <RulesSheet open={sheet === 'rules'} onClose={() => setSheet(null)} c={c} />
      <TermsSheet
        open={sheet === 'terms'}
        onClose={() => setSheet(null)}
        rows={timeTable(c)}
        note={TIME_TABLE_NOTE}
        terms={sharedTerms(c, a.n, reachedRound(state.phase)).map((t) => ({ term: t.term, desc: t.desc }))}
      />
      <WakeSheet
        open={sheet === 'wake'}
        onClose={() => setSheet(null)}
        status={wake.status}
        isHost={isHost}
        canOpenExternal={canOpenExternal}
        onOpenExternal={() => openExternal(recoverUrl, { ua })}
      />
      <ConfirmSheet request={confirmReq} onClose={() => setConfirmReq(null)} />
      <BottomSheet title={`조사 ${catchUpRound ?? ''} · 지금 고르기`} open={catchUpRound !== null} onClose={() => setCatchUpRound(null)}>
        {catchUpRound !== null && (
          <CatchUpPicker
            places={roundPlaces(c, catchUpRound).map((p) => placeToSummary(c, p.id))}
            onPick={(id) => {
              const round = catchUpRound;
              dispatch({ type: 'pickPlace', round, placeId: id });
              setCatchUpRound(null);
              pushToast('골랐소 — 단서함에서 꾹 눌러 보시오');
            }}
          />
        )}
      </BottomSheet>
      {resultImageOpen && ogPreviewUrl && <ResultImageModal src={ogPreviewUrl} onClose={() => setResultImageOpen(false)} />}
      {/* O10 꾹 누르기 첫 안내(최초 1회) — 내 패를 처음 보는 순간 */}
      <BottomSheet
        title="몰래 보는 법"
        open={peekTip}
        onClose={() => g.setPrefs({ seenPeekTip: true })}
        actions={
          <GuButton variant="primary" onClick={() => g.setPrefs({ seenPeekTip: true })}>
            알겠소
          </GuButton>
        }
      >
        <p className="gu-sheet-body-text">
          손으로 화면을 가리고, {g.prefs.revealMode === 'hold' ? '꾹 누르고 있는 동안만 보여요. 손을 떼면 바로 가려져요.' : '탭하면 15초 동안 보여요. 다시 탭하면 바로 가려져요.'}
        </p>
        <p className="gu-micro">누르기 힘들면 ⋮ › 보기 방식에서 바꿀 수 있소.</p>
      </BottomSheet>
    </>
  );
}

/** 단서함 '지금 고르기'(늦참·복구) — 2탭(선택 → 확정) */
function CatchUpPicker({ places, onPick }: { places: ReturnType<typeof placeToSummary>[]; onPick: (id: string) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const place = places.find((p) => p.id === selected);
  return (
    <>
      <PlaceGrid places={places} selected={selected} onSelect={setSelected} />
      <GuButton variant="primary" disabled={!place} disabledReason="장소를 고르시오" onClick={() => place && onPick(place.id)}>
        {place ? `${place.name} 조사하기` : '장소를 고르시오'}
      </GuButton>
    </>
  );
}
