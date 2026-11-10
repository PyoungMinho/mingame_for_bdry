'use client';

/**
 * 시트 셸 한 벌 (방·연습 공용). RoomController 인터페이스만 본다 — 실전/연습/mock이 같은 화면.
 *
 *  - 두 레이어(게임·숨기기)는 SheetShell이 모두 마운트하고, 전환은 ViewStore가 data-view를 동기로 바꾼다.
 *  - 메모·토스트·경보·대화상자·검산·팝오버는 전부 game 슬롯 안에 둔다(숨기는 순간 같이 사라짐). body 포털 없음.
 *  - 숨기는 순간 같은 프레임에 지우는 것: 메모, 상태줄, 열린 메뉴·드롭다운·팝오버·공유 패널, 힌트 고르기, 도발 목록, 배치 범위·끌기. 보존: 검산 입력값, 배치 초안.
 *  - 숨김 중에는 게임 기능이 하나도 동작하지 않는다(QA BUG-01·02): 크롬의 게임 명령(Σ·의견 남기기·공유·⋯)은 클릭을 버리고,
 *    파일·도움말 메뉴는 열리고 닫히기만 한다([새 문서] = 숨기기 시트 첫 탭). 크롬에 보이는 게임 값은 숨기기 직전 값으로 고정(BUG-07).
 *  - 단계: W 대기 · P 배치 · B 대전 · R 결과. 예외: J 입장 · E2 꽉 참 · E3 없음 · E4 점검.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { FIRST_DOC_VERSION, INDUSTRIES, OFFLINE_LABEL_MS, type IndustryId } from '@/lib/monthly-close/constants';
import {
  alarmLine, COMMON_PACK, fileNameOf, fillCopy, formatClock, formatHM, memoLine, packOf, Picker, shortName, statusText, tauntLine,
} from '@/lib/monthly-close/copy/pick';
import { UI } from '@/lib/monthly-close/copy/ui-text';
import type { RoomController } from '@/lib/monthly-close/client/controller';
import { mcApi } from '@/lib/monthly-close/client/api';
import { EventCursor } from '@/lib/monthly-close/client/events';
import { getDisguiseSeed, getLastIndustry, getSavedNickname, defaultNickname, setLastIndustry, setSavedNickname, addRecentDoc, setPracticeDone, takeFreshRoom } from '@/lib/monthly-close/client/identity';
import { blankWaitingView } from '@/lib/monthly-close/client/mockViews';
import { useCommandMode } from '@/lib/monthly-close/client/useCommandMode';
import { useDocumentTitle } from '@/lib/monthly-close/client/useDocumentTitle';
import { useHideKeys } from '@/lib/monthly-close/client/useHideKeys';
import { useViewSnapshot, type ViewStore } from '@/lib/monthly-close/client/viewStore';
import { useIsMobile, useKeyboardOffset } from '@/lib/monthly-close/client/useViewport';
import { isMyTurn, outcomeOf } from '@/lib/monthly-close/client/viewModel';
import type { DisguiseSpec } from '@/lib/monthly-close/sheet/disguise';
import type { LaughLevel, LineId, RoomView } from '@/lib/monthly-close/protocol';
import { FormulaBar, MenuBar, ToolBar, TopBar, type MenuId } from '../_components/sheet/Chrome';
import { SheetShell } from '../_components/sheet/SheetFrame';
import { SplitPanes } from '../_components/sheet/Panes';
import { SheetTabs, type SheetTabDef } from '../_components/sheet/SheetTabs';
import { StatusBar } from '../_components/sheet/StatusBar';
import { DisguiseSheet } from '../_components/disguise/DisguiseSheet';
import { DecoSheet } from '../_components/disguise/DecoSheet';
import { useDisguiseSheet } from '../_components/disguise/useDisguiseSheet';
import { AlarmToast, ConfirmPopover, Dropdown, InlineDialog, Popover, Toast } from '../_components/overlays/Popovers';
import { MemoLine, MobileSheetTabs, MobileTopBar } from '../_components/mobile/Mobile';
import { CellMemo } from '../_components/sheet/CellMemo';
import { Button } from '../_components/form/controls';
import type { MemoKind } from '../_components/sheet/Cell';
import { PaneGrid, type PaneMemo } from './PaneGrid';
import { noopToolbar, type PaneBundle, type ScreenCtx } from './ctx';
import { usePlacement } from './Placement';
import { useBattle } from './Battle';
import { JoinDialog } from './JoinDialog';
import { SharePanel } from './Share';
import { ResultTab } from './Result';

export interface GameScreenProps {
  controller: RoomController;
  store: ViewStore;
  mode: 'room' | 'practice';
  /** 연습 코치 말풍선 문장 인덱스(copy.practice.coach) — 연습만 */
  coachLine?: number | null;
  coachStep?: string;
  /** 박대리 도발(연습) */
  partnerTaunt?: { seq: number; index: number } | null;
  /** 이 화면에서 처음 join()으로 자리를 얻었는가는 내부에서 추적한다 */
  onHome: () => void;
  onPractice?: () => void;
  onNewDoc?: () => void;
  /** 연습이 끝났을 때 큰 버튼 "동료 초대" */
  onInvite?: () => void;
  initialIndustry?: IndustryId;
  roomCode: string | null;
}

export function GameScreen(props: GameScreenProps) {
  const view0 = props.controller.state.view;
  const [joinIndustry, setJoinIndustryRaw] = useState<IndustryId>(props.initialIndustry ?? 0);
  useEffect(() => {
    if (props.initialIndustry === undefined) setJoinIndustryRaw(getLastIndustry());
  }, [props.initialIndustry]);
  // 입장 대화상자의 닉네임은 업종이 바뀌어 GameInner가 다시 마운트돼도 남아야 한다(BUG-05: key={industry} 재마운트가 입력을 지웠다).
  const [nick, setNick] = useState('');
  useEffect(() => setNick(getSavedNickname() ?? defaultNickname()), []);
  // 양식을 바꿔 다시 마운트된 대화상자는 닉네임 칸이 아니라 고른 양식에 포커스를 둔다(방향키로 양식을 고르던 흐름 유지)
  const joinFocus = useRef<'nickname' | 'industry'>('nickname');
  const setJoinIndustry = useCallback((v: IndustryId) => {
    joinFocus.current = 'industry';
    setJoinIndustryRaw(v);
  }, []);
  const industry: IndustryId = view0?.me.industry ?? joinIndustry;
  // 시트는 현재 시각·브라우저별 seed로 숫자를 만들어 서버 렌더와 어긋난다(하이드레이션 오류).
  // 게임 화면은 검색 노출이 없는(noindex) 브라우저 전용이므로 마운트 뒤에만 그린다.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return (
    <GameInner
      key={industry}
      {...props}
      industry={industry}
      joinIndustry={joinIndustry}
      setJoinIndustry={setJoinIndustry}
      nick={nick}
      setNick={setNick}
      joinFocus={joinFocus.current}
    />
  );
}

type Pop = null | 'resign' | 'absent' | 'rules' | 'close-practice';

/**
 * 숨김(disguise) 중 크롬(상단바·메뉴·도구줄)에서 눌려도 되는 명령. 나머지 `data-mc-cmd`는 숨김 중 클릭을 버린다(BUG-01·02).
 * 메뉴 열기·항목은 진짜 시트처럼 열리고 닫히기만 한다(항목 처리는 onMenuItem의 숨김 분기). ✕ ✓는 숨기기 시트의 편집 취소·입력.
 */
const HIDDEN_SAFE_CMDS = new Set(['menu-file', 'menu-help', 'file:new', 'file:close', 'file:endPractice', 'help:rules', 'cancel', 'confirm']);

/**
 * 숨김 중에는 마지막으로 보이던 값을 그대로 돌려준다 → 숨긴 동안 크롬(파일명·버전 기록·편집자·[Σ] 숫자·탭 줄)이 바뀌지 않는다(BUG-07).
 * 복귀하는 렌더부터 지금 값. 렌더 중 ref 갱신은 같은 입력이면 같은 결과라 StrictMode 이중 렌더에도 안전하다.
 */
function useHeldWhileHidden<T>(hidden: boolean, live: T): T {
  const held = useRef(live);
  if (!hidden) held.current = live;
  return hidden ? held.current : live;
}

interface InnerProps extends GameScreenProps {
  industry: IndustryId;
  joinIndustry: IndustryId;
  setJoinIndustry: (v: IndustryId) => void;
  nick: string;
  setNick: (v: string) => void;
  joinFocus: 'nickname' | 'industry';
}

function GameInner(props: InnerProps) {
  const { controller, store, mode, industry } = props;
  const pack = packOf(industry);
  const entry = controller.state.entry;
  const rawView: RoomView | null = controller.state.view;
  const seated = entry.kind === 'seated' && rawView !== null;
  const view: RoomView = rawView ?? blankWaitingView(industry);
  const snap = useViewSnapshot(store);
  const shellBox = useRef<HTMLDivElement | null>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);
  const [, setTick] = useState(0);
  const nowMs = controller.now();
  // 1024px 미만 = 모바일(창 1개 + [내 시트][상대 시트] 탭, 메모 줄, 확정 줄, 키보드 위 시트 탭)
  const isMobile = useIsMobile();
  const kbOffset = useKeyboardOffset(isMobile);
  const [mPane, setMPane] = useState<'mine' | 'theirs'>('mine');
  const [moreOpen, setMoreOpen] = useState(false);

  // ── 셸 속성 직결 ──
  useEffect(() => {
    store.attachShell(shellBox.current?.querySelector<HTMLElement>('.mc-shell') ?? null);
    return () => store.attachShell(null);
  }, [store]);

  // ── 키·제목·명령 이동 ──
  const [lastSave, setLastSave] = useState(() => Date.now());
  // "저장됨" 토스트는 누른 순간 보이던 레이어에 띄운다(BUG-04: 숨김 중 Ctrl/Cmd+S 토스트가 안 보이는 게임 레이어에만 있었다)
  const [savedToast, setSavedToast] = useState<null | 'game' | 'disguise'>(null);
  const savedTimer = useRef<number | null>(null);
  useEffect(() => () => {
    if (savedTimer.current !== null) window.clearTimeout(savedTimer.current);
  }, []);
  // 숨기기 시트에서 포커스가 격자 밖일 때의 Tab = 다음 칸 (ds는 아래에서 만든다 → ref로 연결)
  const hiddenTabRef = useRef<(k: 'tab' | 'shift-tab') => void>(() => undefined);
  useHideKeys(store, {
    tabHides: entry.kind !== 'needJoin',
    onHiddenTab: (k) => hiddenTabRef.current(k),
    onSave: () => {
      setLastSave(Date.now());
      setSavedToast(store.view);
      if (savedTimer.current !== null) window.clearTimeout(savedTimer.current);
      savedTimer.current = window.setTimeout(() => {
        savedTimer.current = null;
        setSavedToast(null);
      }, 1500);
    },
  });
  const cmd = useCommandMode(store, shellBox);
  void cmd;
  const fileNameLive =
    mode === 'practice'
      ? COMMON_PACK.practice.fileName
      : seated
        ? fileNameOf(pack, FIRST_DOC_VERSION + view.room.matchSeq - 1)
        : entry.kind === 'needJoin' || entry.kind === 'loading'
          ? fileNameOf(pack, FIRST_DOC_VERSION)
          : fileNameOf(packOf(0), FIRST_DOC_VERSION);
  // 숨긴 동안 재대결로 판 번호가 올라도 파일명·탭 제목은 그대로(BUG-07)
  const fileName = useHeldWhileHidden(snap.view === 'disguise', fileNameLive);
  useDocumentTitle(fileName);

  // ── 컨트롤러에 보기 전환 보고 + 숨기는 순간 정리 ──
  const alarm = view.status === 'playing' ? view.game.alarm : null;
  const alarmRef = useRef(alarm);
  alarmRef.current = alarm;
  const alarmSeenAt = useRef<number | null>(null);
  const returnNote = useRef<string | null>(null);
  const [memos, setMemos] = useState<Partial<Record<'mine' | 'opp', PaneMemo & { until: number }>>>({});
  const [msg, setMsg] = useState<{ text: string; until: number } | null>(null);
  const [menu, setMenu] = useState<MenuId | null>(null);
  const [sharing, setSharing] = useState(false);
  const [pop, setPop] = useState<Pop>(null);
  const [disTab, setDisTab] = useState<'ds' | 'deco'>('ds');
  const [resultOpen, setResultOpen] = useState(false);
  const [resultSeen, setResultSeen] = useState(false);
  // 피식 응답은 판(matchId)당 1회(MC-FE-03): 결과 탭 컴포넌트 안에 두면 게임 탭 ↔ 결과 탭을 오갈 때 다시 마운트되어 같은 판에 또 보낼 수 있었다.
  // 새로고침 뒤에도 같은 판이면 눌린 채로(sessionStorage). 저장소가 막혀 있어도 이 화면 안에서는 1회.
  const [laughs, setLaughs] = useState<Record<string, LaughLevel>>({});
  const laughOf = (matchId: string): LaughLevel | null => {
    if (laughs[matchId]) return laughs[matchId]!;
    try {
      const v = sessionStorage.getItem(`mc:laugh:${matchId}`);
      return v === 'none' || v === 'some' || v === 'lol' ? v : null;
    } catch {
      return null;
    }
  };
  const answerLaugh = (matchId: string, laugh: LaughLevel) => {
    if (laughOf(matchId) !== null) return;
    setLaughs((m) => ({ ...m, [matchId]: laugh }));
    try {
      sessionStorage.setItem(`mc:laugh:${matchId}`, laugh);
    } catch {
      /* 저장소 차단: 화면 안 1회만 지킨다 */
    }
    if (props.roomCode) void mcApi.feedback({ type: 'feedback', code: props.roomCode, matchId, laugh });
  };
  const resetRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    return store.onChange((v, reason) => {
      controller.reportView(v);
      if (v === 'disguise') {
        const a = alarmRef.current;
        if (a && !a.reported && alarmSeenAt.current !== null) {
          controller.reportAlarm(a.issuedAt, Math.max(0, Date.now() - alarmSeenAt.current));
          alarmSeenAt.current = null;
        }
        setMemos({});
        setMsg(null);
        setMenu(null);
        setMoreOpen(false);
        setSharing(false);
        setPop(null);
        resetRef.current();
      } else if (reason === 'return' && returnNote.current) {
        setMsg({ text: returnNote.current, until: Date.now() + 5000 });
        returnNote.current = null;
      }
    });
  }, [store, controller]);

  useEffect(() => {
    if (!alarm || alarm.reported) return;
    if (store.view === 'disguise') controller.reportAlarm(alarm.issuedAt, 0);
    else alarmSeenAt.current = Date.now();
  }, [alarm?.issuedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  // 새로고침·다시 열기: 자리가 있는 방은 숨김으로 시작 (연습은 처음부터)
  const joinedHere = useRef(false);
  const initHandled = useRef(false);
  // 공동 편집자가 들어와 대기가 끝나면 공유 패널을 닫는다(배치·대전 판을 가리지 않게).
  const roomStatus = rawView?.status;
  const prevRoomStatus = useRef(roomStatus);
  useEffect(() => {
    if (prevRoomStatus.current === 'waiting' && roomStatus && roomStatus !== 'waiting') setSharing(false);
    prevRoomStatus.current = roomStatus;
  }, [roomStatus]);

  useEffect(() => {
    if (mode !== 'room' || initHandled.current || !seated) return;
    initHandled.current = true;
    if (joinedHere.current) return;
    // 홈에서 방금 만든 방의 첫 진입은 "다시 열기"가 아니다(A9 예외) → 게임 화면 + 공유 패널
    if (props.roomCode && takeFreshRoom(props.roomCode)) {
      if (rawView?.status === 'waiting') setSharing(true);
      return;
    }
    store.hide('init');
  }, [seated, mode, store]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 상태줄 ──
  const flash = useCallback(
    (text: string, ms = 5000) => {
      if (store.view === 'disguise') return;
      setMsg({ text, until: Date.now() + ms });
    },
    [store],
  );
  const note = useCallback(
    (text: string) => {
      if (store.view === 'disguise') returnNote.current = text;
      else flash(text, 5000);
    },
    [store, flash],
  );
  const picker = useMemo(() => new Picker(`${props.roomCode ?? 'practice'}:${view.room.matchSeq}:${view.me.seat}`), [props.roomCode, view.room.matchSeq, view.me.seat]);
  const oppName = shortName(view.opp?.nickname ?? '');
  // 이번 판에 띄운 메모(칸별 마지막 1개). 자동으로 닫힌 뒤 삼각형에 마우스를 올리면 다시 보인다(디자인 §3-2, 방향서 §9 #9)
  const memoLog = useRef(new Map<string, { kind: MemoKind; head: string; body: string }>());
  const memoMatch = useRef<number>(view.room.matchSeq);
  if (memoMatch.current !== view.room.matchSeq) {
    memoMatch.current = view.room.matchSeq;
    memoLog.current.clear();
  }
  const memo = useCallback(
    (pane: 'mine' | 'opp', addr: string, kind: MemoKind, head: string, body: string) => {
      memoLog.current.set(`${pane}:${addr}`, { kind, head, body });
      if (store.view === 'disguise') return;
      const ms = Math.min(7000, Math.max(3000, 2500 + Array.from(body).length * 70));
      setMemos((m) => ({ ...m, [pane]: { id: `${Date.now()}`, addr, kind, head, body, until: Date.now() + ms } }));
    },
    [store],
  );
  const reshowMemo = (pane: 'mine' | 'opp', addr: string) => {
    if (store.view === 'disguise') return;
    const m = memoLog.current.get(`${pane}:${addr}`);
    if (!m) return;
    setMemos((cur) => (cur[pane]?.addr === addr ? cur : { ...cur, [pane]: { id: `re${Date.now()}`, addr, ...m, until: Date.now() + 3000 } }));
  };

  const ctx: ScreenCtx = { controller, view, pack, picker, store, nowMs, mode, flash, memo, nameRef, oppName };
  const placement = usePlacement(ctx);
  const battle = useBattle(ctx);
  const bundle: PaneBundle | null = !seated ? null : view.status === 'waiting' || view.status === 'placing' ? placement : battle;
  resetRef.current = () => {
    placement.reset();
    battle.reset();
  };

  // ── 사건 → 메모·상태줄 ──
  const cursor = useRef(new EventCursor());
  const logSeq = useRef<number | null>(null);
  /** logSeq가 가리키는 판(matchId). 엔진의 game.log 순번은 판마다 1부터 다시 시작한다 */
  const logMatch = useRef<string | null>(null);
  useEffect(() => {
    if (!seated) return;
    for (const e of cursor.current.take(view.events)) {
      const me = view.me.seat;
      switch (e.type) {
        case 'fire': {
          const slot = e.result === 'sunk' ? e.slot : undefined;
          const m = memoLine(pack, picker, e.result, e.cell, slot);
          const kind: MemoKind = e.result;
          if (e.by === me) memo('opp', e.cell, kind, UI.battle.memoHeadMine, m.text);
          else {
            memo('mine', e.cell, kind, UI.battle.memoHeadOpp(oppName), m.text);
            flash(statusText('oppShot', { 상대: oppName, c: e.cell }), 5000);
          }
          break;
        }
        case 'timeout':
          flash(e.seat === me ? statusText(view.me.consecutiveTimeouts >= 2 ? 'timeout2' : 'timeout') : statusText('timeout'), 3000);
          break;
        case 'quizSettled':
          note(e.expired ? statusText('quizClosed') : e.awarded.includes(me) ? statusText('quizGot') : statusText('quizDone'));
          break;
        case 'alarmResult':
          note(e.outcomes[me] === 'fail' ? statusText('alarmFail') : statusText('alarmPass'));
          break;
        case 'hideBudgetOut':
          if (e.seat === me) note(statusText('hideBudget'));
          break;
        case 'autoPlaced':
          if (e.seats.includes(me)) flash(statusText('autoPlaced'), 5000);
          break;
        case 'joined':
          if (e.seat !== me) {
            flash(statusText('guestJoined'), 5000);
            setSharing(false);
          }
          break;
        case 'left':
          if (e.seat !== me) {
            flash(statusText('guestLeft'), 5000);
            setSharing(true);
          }
          break;
        case 'rematchExpired':
          flash(statusText('rematchExpired', { n: FIRST_DOC_VERSION + view.room.matchSeq }), 5000);
          break;
        case 'ended':
          if (view.status === 'ended') flash(pack.result.status[outcomeOf(view)], 5000);
          setResultOpen(false);
          setResultSeen(false);
          break;
        default:
          break;
      }
    }
    if (view.status === 'playing' || view.status === 'ended') {
      const log = view.game.log;
      if (logMatch.current !== view.game.matchId) {
        // 첫 마운트(새로고침·다시 열기)는 지금까지의 로그를 이미 본 것으로, 재대결 새 판은 처음부터 처리한다
        // (MC-FE-01: 판이 바뀌어도 커서가 직전 판 마지막 순번에 남아 v8 이후 판의 받은 도발이 안 떴다)
        logSeq.current = logMatch.current === null ? (log.length ? log[log.length - 1]!.seq : 0) : 0;
        logMatch.current = view.game.matchId;
      }
      for (const l of log.filter((x) => x.seq > logSeq.current!)) {
        logSeq.current = l.seq;
        if (l.by !== view.me.seat && l.type === 'taunt') {
          const last = view.game.myShots[view.game.myShots.length - 1]?.cell ?? view.game.oppShots[view.game.oppShots.length - 1]?.cell;
          const text = mode === 'practice' ? (COMMON_PACK.practice.taunts[props.partnerTaunt?.index ?? 0] ?? '') : tauntLine(l.tauntId).text;
          if (last) memo(view.game.myShots.some((s) => s.cell === last) ? 'opp' : 'mine', last, 'note', UI.battle.memoHeadOpp(oppName), text);
          flash(statusText('oppTaunt', { 상대: oppName }), 5000);
        }
      }
    }
  }, [view.room.version, view.events.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 틱: 카운트다운·메모/상태줄 만료 ──
  useEffect(() => {
    const id = window.setInterval(() => {
      const t = Date.now();
      setTick((n) => n + 1);
      setMsg((m) => (m && m.until <= t ? null : m));
      setMemos((m) => {
        const next = { ...m };
        let changed = false;
        for (const k of ['mine', 'opp'] as const) if (next[k] && next[k]!.until <= t) { delete next[k]; changed = true; }
        return changed ? next : m;
      });
    }, 250);
    return () => window.clearInterval(id);
  }, []);

  // 부재 처리 (Battle이 이벤트로 알린다)
  useEffect(() => {
    const h = () => setPop('absent');
    window.addEventListener('mc-absent', h);
    return () => window.removeEventListener('mc-absent', h);
  }, []);

  // ── 숨기기 시트 ──
  const today = new Date();
  const asOf = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const ds = useDisguiseSheet(pack.disguise as unknown as DisguiseSpec, { seed: getDisguiseSeed(props.roomCode), asOf: asOf });
  const [decoSel, setDecoSel] = useState({ addr: 'B3', text: '' });
  const focusDisguiseGrid = () => shellBox.current?.querySelector<HTMLElement>('[data-layer="disguise"] [role="grid"]')?.focus({ preventScroll: true });
  hiddenTabRef.current = (k) => {
    if (disTab === 'ds') ds.dispatch({ type: 'commit', advance: k === 'tab' ? 'right' : 'left' });
    focusDisguiseGrid();
  };
  // 숨는 순간 포커스를 숨기기 시트 격자로 옮긴다(사라진 게임 칸·이름 상자에 남아 Tab이 브라우저 포커스 이동이 되지 않게).
  // 모바일은 화면 키보드를 건드리지 않도록 옮기지 않는다.
  useEffect(() => {
    if (snap.view === 'disguise' && !isMobile) focusDisguiseGrid();
  }, [snap.version, disTab]); // eslint-disable-line react-hooks/exhaustive-deps
  const filterRight = fillCopy(COMMON_PACK.filterRow.lastSaved, { 'HH:MM': formatHM(lastSave) });
  const decoRows = pack.deco.memos.map((m, i) => ({
    date: `${asOf.slice(0, 8)}${String(Math.max(1, today.getDate() - (i * 3 + 1))).padStart(2, '0')}`,
    memo: m,
    owner: pack.deco.owners[i % pack.deco.owners.length] ?? '',
  }));

  // ── 파생 값 ──
  const hidden = snap.view === 'disguise';
  const g = view.status === 'playing' || view.status === 'ended' ? view.game : null;
  const myTurn = isMyTurn(view);
  const oppOffline = view.opp ? nowMs - view.opp.lastSeenAt > OFFLINE_LABEL_MS : false;

  const clockMs = g ? (g.clock.state === 'running' ? g.clock.deadlineAt - nowMs : g.clock.remainingMs) : 0;
  const baseStatus = (): string => {
    if (!seated) return entry.kind === 'loading' ? statusText('loading') : statusText('ready');
    if (hidden) return statusText('ready');
    if (controller.state.connection === 'reconnecting' || controller.state.connection === 'down') return statusText('reconnecting');
    if (controller.state.pending) return statusText('computing');
    switch (view.status) {
      case 'waiting':
        return statusText('waitingGuest');
      case 'placing':
        return view.me.placed ? statusText('placeWait') : statusText('placing', { t: formatClock(view.placeDeadlineAt - nowMs) });
      case 'playing': {
        if (view.game.quiz) return statusText('quiz', { t: formatClock(view.game.quiz.deadlineAt - nowMs) });
        if (oppOffline) return statusText('oppOffline', { 상대: oppName });
        if (myTurn) {
          const selected = bundle?.formula.armed && bundle.formula.nameValue ? bundle.formula.nameValue : null;
          return selected ? statusText('selected', { t: formatClock(clockMs), c: selected }) : statusText('myTurn', { t: formatClock(clockMs) });
        }
        if (view.opp.hidden) return statusText('oppHidden', { 상대: oppName, t: formatClock(clockMs) });
        return statusText('oppTurn', { t: formatClock(clockMs) });
      }
      case 'ended': {
        if (view.rematch.requested[view.me.seat] && view.rematch.expiresAt) return statusText('rematchWait', { 상대: oppName, t: formatClock(view.rematch.expiresAt - nowMs) });
        return statusText('ready');
      }
    }
  };
  const practiceCoach = mode === 'practice' && props.coachLine != null ? COMMON_PACK.practice.coach[props.coachLine] : null;
  const message = msg && msg.until > Date.now() ? msg.text : baseStatus();
  const statusMsg = hidden ? statusText('ready') : message;
  const rightText = hidden ? '100%' : g ? `회차 ${g.round} · 100%` : '100%';
  void practiceCoach;

  // ── 창 머리 ──
  const ph = COMMON_PACK.paneHead;
  const leftHead = !seated ? ph.left.editable : view.status === 'ended' ? ph.left.final : view.status === 'playing' ? ph.left.coedit : view.me.placed ? ph.left.saved : ph.left.editable;
  const rightHead = !seated
    ? ph.right.waiting
    : view.status === 'waiting'
      ? ph.right.waiting
      : view.status === 'placing'
        ? ph.right.drafting
        : view.status === 'ended'
          ? ph.right.final
          : oppOffline
            ? ph.right.offline
            : myTurn
              ? ph.right.editable
              : ph.right.readonly;

  // ── 결과 탭 ──
  const ended = seated && view.status === 'ended' ? view : null;
  const resultKindKey = ended ? (outcomeOf(ended) === 'win' ? 'award' : outcomeOf(ended) === 'lose' ? 'reprimand' : 'joint') : null;
  const tabs: SheetTabDef[] = isMobile
    ? [
        { id: 'game-mine', label: UI.mobile.mine, kind: 'game' },
        { id: 'game-theirs', label: UI.mobile.theirs, kind: 'game' },
      ]
    : [{ id: 'game', label: pack.tabs.game, kind: 'game' }];
  if (resultKindKey) tabs.push({ id: 'result', label: COMMON_PACK.resultDocs.tabs[resultKindKey], kind: 'result', fresh: !resultSeen });
  tabs.push({ id: 'ds', label: pack.tabs.disguise, kind: 'disguise' });
  if (!isMobile) tabs.push({ id: 'deco', label: pack.tabs.deco, kind: 'deco' });
  // 숨긴 동안 판이 끝나도 결과 탭("품의서"·새 표시)이 생기지 않는다 — 복귀하면 그때 생긴다(BUG-07). 창 폭이 바뀌어 탭 구성이 달라지면 지금 값.
  const heldTabs = useHeldWhileHidden(hidden, { isMobile, tabs });
  const shownTabs = heldTabs.isMobile === isMobile ? heldTabs.tabs : tabs;
  const activeTab = hidden ? disTab : resultOpen && resultKindKey ? 'result' : isMobile ? `game-${mPane}` : 'game';
  const onTab = (id: string, kind: SheetTabDef['kind']) => {
    if (kind === 'game' || kind === 'result') {
      setResultOpen(kind === 'result');
      if (kind === 'result') setResultSeen(true);
      if (id === 'game-mine' || id === 'game-theirs') setMPane(id === 'game-mine' ? 'mine' : 'theirs');
      store.show();
    } else {
      // 모바일: 탭 한 번 = 입력칸 blur(화면 키보드 내림) + 숨기기 (디자인 A7)
      if (isMobile && document.activeElement instanceof HTMLElement) document.activeElement.blur();
      setDisTab(kind === 'deco' ? 'deco' : 'ds');
      store.hide('tabclick');
    }
  };

  // 모바일 창 자동 전환: 내 차례·검산이 오면 [상대 시트]로만 (UX §5). 배치 중에는 [내 시트].
  const quizId = g?.quiz?.id ?? null;
  useEffect(() => {
    if (!isMobile) return;
    if (myTurn || quizId) setMPane('theirs');
  }, [isMobile, myTurn, quizId]);
  const placingNow = view.status === 'waiting' || view.status === 'placing';
  useEffect(() => {
    if (isMobile && placingNow) setMPane('mine');
  }, [isMobile, placingNow]);

  // ── 도구줄·메뉴 ──
  const tb = bundle?.toolbar ?? noopToolbar;
  const alarmOnScreen = alarm && !alarm.reported;
  const fileItems = mode === 'practice' ? [{ id: 'endPractice', label: UI.chrome.fileMenu.endPractice }] : [{ id: 'new', label: UI.chrome.fileMenu.newDoc }, { id: 'close', label: UI.chrome.fileMenu.closeDoc }];
  const moreItems = [
    { id: 'taunt', label: UI.chrome.taunt, disabled: tb.tauntOff },
    { id: 'hint', label: UI.mobile.hintMenu(tb.hintCount), disabled: tb.hintOff },
    { id: 'rules', label: UI.chrome.helpMenu.rules },
    ...fileItems,
  ];
  const onMoreItem = (id: string) => {
    setMoreOpen(false);
    if (store.view === 'disguise') return;
    if (id === 'taunt') return tb.onTaunt();
    if (id === 'hint') {
      setMPane('theirs');
      return tb.onHint();
    }
    if (id === 'rules') return setPop('rules');
    onMenuItem('file', id);
  };
  const onMenuItem = (m: MenuId, id: string) => {
    setMenu(null);
    if (store.view === 'disguise') {
      // 숨기기 시트의 메뉴는 진짜 시트처럼 무해하게(BUG-02): [새 문서] = 빈 업무 시트(숨기기 시트 첫 탭)로, 나머지는 닫히기만 한다.
      // 홈(게임 안내)으로 가거나 복귀 순간 튀어나올 팝오버(규칙·기권 확인)를 열지 않는다.
      if (id === 'new') setDisTab('ds');
      return;
    }
    if (m === 'help') return setPop('rules');
    if (id === 'new' || id === 'endPractice') return props.onHome();
    if (id === 'close') {
      if (seated && view.status === 'playing') setPop('resign');
      else void controller.leave().then(props.onHome);
    }
  };

  // ── 공유 ──
  const link = typeof window !== 'undefined' && props.roomCode ? `${window.location.origin}/monthly-close/${props.roomCode}` : '';
  const copyText = async (text: string, okKey: 'copied' | 'copyFail') => {
    try {
      await navigator.clipboard.writeText(text);
      flash(statusText('copied'), 3000);
    } catch {
      flash(statusText(okKey === 'copied' ? 'copyFail' : 'copyFail'), 5000);
    }
  };

  // ── 입장 ── (닉네임 상태는 바깥 GameScreen에 있다: 양식 변경 재마운트에도 유지, BUG-05)
  const { nick, setNick } = props;
  const [joinError, setJoinError] = useState('');
  const doJoin = async () => {
    setSavedNickname(nick);
    setLastIndustry(props.joinIndustry);
    // join 응답이 화면 데이터를 반영하는 순간(동기 렌더 + effect) "새로고침이면 숨김으로 시작" effect가 먼저 돈다.
    // await 뒤에 표시하면 늦어서 방금 입장한 사람이 숨기기 시트로 떨어졌다(D3 브라우저 확인) → 요청 전에 표시.
    joinedHere.current = true;
    const r = await controller.join({ nickname: nick.trim(), industry: props.joinIndustry });
    if (!r.ok) joinedHere.current = false;
    if (r.ok) {
      initHandled.current = true;
      if (props.roomCode) addRecentDoc({ code: props.roomCode, industry: props.joinIndustry, at: Date.now() });
    } else setJoinError(r.error === 'RATE_LIMITED' ? statusText('rate') : r.error === 'INVALID' ? statusText('badAddr') : statusText('conflict'));
  };

  const exceptional = entry.kind === 'notFound' || entry.kind === 'full' || entry.kind === 'down';
  const banner =
    entry.kind === 'notFound'
      ? [COMMON_PACK.banners.notFound, COMMON_PACK.banners.expired]
      : entry.kind === 'full'
        ? [COMMON_PACK.banners.full, COMMON_PACK.banners.otherBrowser]
        : entry.kind === 'down'
          ? [COMMON_PACK.banners.maintenance, COMMON_PACK.banners.serverDown]
          : [];

  const formula = snap.view === 'disguise'
    ? (disTab === 'deco' ? { nameValue: decoSel.addr, formula: decoSel.text, armed: false } : ds.formulaBar)
    : (bundle?.formula ?? { nameValue: '', formula: '', armed: false });
  const emptyMap = useMemo(() => new Map(), []);

  // 숨김 중 [공유]는 아무 일도 하지 않는다(복귀 순간 공유 패널이 튀어나오지 않게, BUG-02)
  const onShare = props.roomCode
    ? () => {
        if (store.view === 'disguise') return;
        setSharing((s) => !s);
      }
    : undefined;
  const onMore = () => {
    if (store.view === 'disguise') return;
    setMoreOpen((o) => !o);
  };
  // 숨김 중 크롬은 게임 기능이 하나도 동작하지 않는다(BUG-01): 도발 목록·힌트 고르기를 열지 않고, 눌림 모양도 없다.
  // 숫자·흐림 상태는 숨기기 직전 값 그대로(BUG-07: 검산 확정 등으로 [Σ] 숫자가 바뀌지 않게).
  const toolShown = useHeldWhileHidden(hidden, { hintCount: tb.hintCount, hintOff: tb.hintOff, tauntOff: tb.tauntOff });
  const topShown = useHeldWhileHidden(hidden, {
    versionLabel: seated && mode === 'room' ? UI.chrome.versionLabel(view.room.record.wins[view.me.seat], view.room.record.wins[view.me.seat === 0 ? 1 : 0]) : undefined,
    coEditLabel: seated && view.opp ? UI.chrome.coEdit : undefined,
    editors: seated ? [{ initial: Array.from(view.me.nickname)[0] ?? '' }, ...(view.opp ? [{ initial: Array.from(view.opp.nickname)[0] ?? '', offline: oppOffline }] : [])] : [],
  });
  /** 숨김 중 크롬의 게임 명령 클릭을 캡처 단계에서 버린다(렌더가 따라오기 전 같은 프레임의 클릭까지 막는 안전망) */
  const blockHiddenCmd = (e: ReactMouseEvent) => {
    if (store.view !== 'disguise') return;
    const t = e.target instanceof Element ? e.target.closest('[data-mc-cmd]') : null;
    if (!t || t.closest('[data-layer="disguise"]')) return;
    if (HIDDEN_SAFE_CMDS.has(t.getAttribute('data-mc-cmd') ?? '')) return;
    e.preventDefault();
    e.stopPropagation();
  };
  const formulaBar = (
    <FormulaBar
      nameValue={formula.nameValue}
      onNameValueChange={'onNameChange' in formula ? formula.onNameChange : (formula as { onNameValueChange?: (v: string) => void }).onNameValueChange}
      onNameSubmit={'onNameSubmit' in formula ? formula.onNameSubmit : undefined}
      nameDisplayOnly={isMobile}
      hideButtons={isMobile}
      formula={formula.formula}
      onFormulaChange={!isMobile && 'onFormulaChange' in formula ? (formula as { onFormulaChange?: (v: string) => void }).onFormulaChange : undefined}
      armed={formula.armed}
      onCancel={'onCancel' in formula ? formula.onCancel : undefined}
      onConfirm={'onConfirm' in formula ? formula.onConfirm : undefined}
      nameRef={nameRef}
      cancelLabel={UI.chrome.cancel}
      confirmLabel={UI.chrome.confirm}
      nameLabel={UI.chrome.nameBox}
      formulaLabel={UI.chrome.formulaBar}
    />
  );
  const chrome = isMobile ? (
    <>
      <MobileTopBar fileName={fileName} shareLabel={UI.chrome.shareBtn} shareDisabled={!props.roomCode} onShare={onShare} moreLabel={UI.mobile.more} moreOpen={!hidden && moreOpen} onMore={onMore} />
      {formulaBar}
    </>
  ) : (
    <>
      <div>
        <TopBar
          fileName={fileName}
          versionLabel={topShown.versionLabel}
          coEditLabel={topShown.coEditLabel}
          editors={topShown.editors}
          shareLabel={UI.chrome.shareBtn}
          shareDisabled={!props.roomCode}
          onShare={onShare}
        />
      </div>
      <MenuBar
        open={menu}
        onToggle={(m) => setMenu((cur) => (cur === m ? null : m))}
        fileItems={fileItems}
        helpItems={[{ id: 'rules', label: UI.chrome.helpMenu.rules }]}
        onItem={onMenuItem}
      />
      <ToolBar
        hintLabel={UI.chrome.hint}
        hintCount={toolShown.hintCount}
        hintOff={toolShown.hintOff}
        hintActive={!hidden && tb.hintActive}
        onHint={hidden ? undefined : tb.onHint}
        tauntLabel={UI.chrome.taunt}
        tauntOff={toolShown.tauntOff}
        tauntOpen={!hidden && tb.tauntOpen}
        onTaunt={hidden ? undefined : tb.onTaunt}
        tauntMenu={hidden ? null : tb.tauntMenu}
      />
      {formulaBar}
    </>
  );

  const mineMemo = memos.mine ? [{ ...memos.mine }] : [];
  const oppMemo = memos.opp ? [{ ...memos.opp }] : [];

  const showResult = ended && resultOpen && resultKindKey;
  const boardCols = isMobile ? 9 : undefined; // 모바일: A~I(9열, I열 = 행 힌트) — 가로 스크롤 없음
  // 모바일 판 1~8행은 정사각형에 가까운 40px(터치), 그 아래 표는 기본 높이
  const rowH = isMobile ? (r: number) => (r < 8 ? 40 : bundle?.rowHeight?.(r)) : bundle?.rowHeight;
  const leftPane = (
    <PaneGrid
      id="mine"
      head={leftHead}
      label={UI.mobile.mine}
      cols={boardCols}
      specs={bundle?.leftSpecs ?? emptyMap}
      merges={bundle?.leftMerges}
      selected={bundle?.leftSelected}
      range={bundle?.leftRange}
      rangeBad={bundle?.rangeBad}
      hoverable={bundle?.leftHoverable}
      onCellDown={bundle?.onLeftDown}
      onCellEnter={(c, r, addr, hasMemo) => {
        bundle?.onLeftEnter?.(c, r);
        if (hasMemo) reshowMemo('mine', addr);
      }}
      onKeyDown={bundle?.onLeftKey}
      memos={isMobile ? [] : mineMemo}
      rowHeight={rowH}
      gridFocus={isMobile || placingNow}
    />
  );
  const rightPane = (
    <PaneGrid
      id="theirs"
      head={rightHead}
      headRight={bundle?.rightHeadRight}
      label={UI.mobile.theirs}
      cols={boardCols}
      specs={bundle?.rightSpecs ?? emptyMap}
      merges={bundle?.rightMerges}
      selected={bundle?.rightSelected}
      selectionTone={bundle?.rightTone}
      range={bundle?.rightRange}
      rangeBad={bundle?.rangeBad}
      hoverable={bundle?.rightHoverable}
      readOnly={!myTurn}
      pick={bundle?.rightPick}
      pickedCols={bundle?.pickedCols}
      pickedRows={bundle?.pickedRows}
      onPickCol={bundle?.onPickCol}
      onPickRow={bundle?.onPickRow}
      onCellDown={bundle?.onRightDown}
      onCellEnter={(_c, _r, addr, hasMemo) => hasMemo && reshowMemo('opp', addr)}
      onKeyDown={bundle?.onRightKey}
      memos={isMobile ? [] : oppMemo}
      rowHeight={isMobile ? rowH : undefined}
      gridFocus={isMobile || !placingNow}
      overlay={bundle?.rightOverlay}
    />
  );
  const gameLayer = (
    <>
      {showResult ? (
        <ResultTab
          view={ended}
          pack={pack}
          now={Date.now()}
          filterLeft={COMMON_PACK.filterRow.view}
          filterRight={filterRight}
          practice={mode === 'practice'}
          alarmFailed={ended.events.some((e) => e.type === 'alarmResult' && e.outcomes[ended.me.seat] === 'fail')}
          onSave={() => void controller.rematch()}
          onNew={props.onNewDoc ?? props.onHome}
          laugh={laughOf(ended.game.matchId)}
          onFeedback={(laugh: LaughLevel) => answerLaugh(ended.game.matchId, laugh)}
          onReport={(lineId: LineId) => {
            if (props.roomCode) void mcApi.feedback({ type: 'line_report', code: props.roomCode, matchId: ended.game.matchId, lineId });
            flash(statusText('reported'), 3000);
          }}
          onCopied={(kind, ok) => {
            flash(statusText(ok ? 'textCopied' : 'copyFail'), 4000);
            if (ok && props.roomCode) void mcApi.feedback({ type: 'share_copied', code: props.roomCode, matchId: ended.game.matchId, doc: kind });
          }}
        />
      ) : (
        <SplitPanes
          left={isMobile && mPane === 'theirs' ? rightPane : leftPane}
          right={isMobile ? undefined : rightPane}
        />
      )}

      {sharing && seated && props.roomCode ? (
        <SharePanel
          code={props.roomCode}
          alarmOn={view.room.alarmOn}
          waiting={view.status === 'waiting'}
          onCopyLink={() => void copyText(link, 'copied')}
          onCopyNumber={() => void copyText(props.roomCode!, 'copied')}
          onShareNative={
            typeof navigator !== 'undefined' && 'share' in navigator
              ? () => {
                  store.graceNextLeave();
                  void navigator.share({ url: link }).catch(() => undefined);
                }
              : undefined
          }
        />
      ) : null}

      {alarmOnScreen && alarm ? (
        <AlarmToast
          text={alarmLine(pack, alarm.issuedAt).text}
          chip={(isMobile ? COMMON_PACK.toasts.alarmChipMobile : COMMON_PACK.toasts.alarmChipDesktop).replace(/[[\]]/g, '')}
          onActivate={() => store.hide('alarm')}
        />
      ) : null}
      {ended && !alarmOnScreen && ended.rematch.requested[ended.opp.seat] && !ended.rematch.requested[ended.me.seat] ? (
        <Toast
          text={fillCopy(COMMON_PACK.toasts.rematchRequest, { n: FIRST_DOC_VERSION + ended.room.matchSeq })}
          action={{ label: COMMON_PACK.toasts.rematchChip.replace(/[[\]]/g, ''), cmd: 'rematch', onClick: () => void controller.rematch() }}
        />
      ) : ended && !resultOpen && !resultSeen ? (
        <Toast
          text={COMMON_PACK.toasts.docMade}
          action={{ label: COMMON_PACK.toasts.openChip.replace(/[[\]]/g, ''), cmd: 'open-result', onClick: () => { setResultOpen(true); setResultSeen(true); } }}
        />
      ) : savedToast === 'game' ? (
        <Toast text={COMMON_PACK.toasts.saved} />
      ) : null}

      {pop === 'resign' ? (
        <ConfirmPopover
          title={UI.confirm.resignText}
          confirmLabel={UI.confirm.resignOk}
          cancelLabel={UI.confirm.cancel}
          danger
          onCancel={() => setPop(null)}
          onConfirm={() => void controller.resign().then(() => { setPop(null); props.onHome(); })}
        />
      ) : null}
      {pop === 'absent' ? (
        <ConfirmPopover
          title={UI.confirm.absentText}
          confirmLabel={UI.confirm.absentOk}
          cancelLabel={UI.confirm.cancel}
          onCancel={() => setPop(null)}
          onConfirm={() => void controller.claimAbsent().then(() => setPop(null))}
        />
      ) : null}
      {pop === 'rules' ? (
        <Popover title={UI.rulesTitle} style={{ top: 4, right: 12 }}>
          <ol style={{ margin: 0, paddingLeft: 20 }}>
            {UI.home.rules.map((r) => <li key={r}>{r}</li>)}
          </ol>
          <div className="mc-pop__row"><Button variant="secondary" cmd="confirm-cancel" onClick={() => setPop(null)}>{UI.confirm.cancel}</Button></div>
        </Popover>
      ) : null}

      {entry.kind === 'needJoin' ? (
        <JoinDialog
          code={props.roomCode ?? ''}
          nickname={nick}
          onNickname={setNick}
          industry={props.joinIndustry}
          onIndustry={props.setJoinIndustry}
          pending={controller.state.pending}
          error={joinError}
          onOpen={doJoin}
          initialFocus={props.joinFocus}
        />
      ) : null}
      {exceptional ? (
        <InlineDialog
          title={banner[0] ?? ''}
          actions={
            <>
              {entry.kind !== 'notFound' ? <Button variant="secondary" cmd="open-practice" onClick={props.onPractice}>{UI.errors.openPractice}</Button> : null}
              {entry.kind !== 'down' ? <Button cmd="new-doc" onClick={props.onNewDoc ?? props.onHome}>{UI.errors.newDoc}</Button> : null}
            </>
          }
        >
          <div role="alert">{banner[1]}</div>
        </InlineDialog>
      ) : null}
      {mode === 'practice' && props.onInvite && ended ? (
        <InlineDialog
          title={UI.result.practiceSummary}
          actions={
            <>
              <Button variant="secondary" cmd="open-result" onClick={() => { setResultOpen(true); setResultSeen(true); }}>{COMMON_PACK.resultDocs.tabs[resultKindKey ?? 'award']}</Button>
              <Button size="lg" cmd="invite" onClick={props.onInvite}>{UI.result.inviteColleague}</Button>
            </>
          }
        >
          <div>{COMMON_PACK.endReasons[ended.result.reason]}</div>
        </InlineDialog>
      ) : null}
      {mode === 'practice' && practiceCoach && !hidden ? (
        // 연습 코치: 메모 컴포넌트 재사용, 머리 줄에 단계 n/8 (UX §2-5). 게임 레이어 안이라 숨기면 같이 사라진다
        <div className="mc-coach">
          <CellMemo kind="note" head={props.coachStep ? `${UI.practiceCoachHead} ${props.coachStep}` : UI.practiceCoachHead} body={fillCopy(practiceCoach, { 탭: pack.tabs.game })} x={0} y={0} />
        </div>
      ) : null}
      {isMobile && moreOpen ? (
        <div className="mc-mmore">
          <Dropdown label={UI.mobile.more} cmdPrefix="more" items={moreItems} onPick={(id) => onMoreItem(String(id))} />
        </div>
      ) : null}
      {isMobile && tb.tauntMenu ? <div className="mc-mmore">{tb.tauntMenu}</div> : null}
    </>
  );

  const disguiseLayer = (
    <>
      {disTab === 'deco' ? (
        <DecoSheet
          label={pack.tabs.deco}
          title={COMMON_PACK.deco.title}
          headers={COMMON_PACK.deco.heads as unknown as [string, string, string]}
          rows={decoRows}
          filterLeft={COMMON_PACK.filterRow.view}
          filterRight={filterRight}
          onSelect={(addr, text) => setDecoSel({ addr, text })}
        />
      ) : (
        <DisguiseSheet controller={ds} label={pack.tabs.disguise} filterLeft={COMMON_PACK.filterRow.view} filterRight={filterRight} mobile={isMobile} />
      )}
      {/* 숨김 중 Ctrl/Cmd+S → 보이는 숨기기 시트 위에 "저장됨"(진짜 시트와 같은 반응, BUG-04) */}
      {hidden && savedToast === 'disguise' ? <Toast text={COMMON_PACK.toasts.saved} /> : null}
    </>
  );
  // 모바일 메모 줄: 창 위 말풍선 대신 최근 메모 한 줄(같은 3~7초 규칙). 없으면 상태 문장
  const latestMemo = [memos.mine, memos.opp].filter((m): m is NonNullable<typeof m> => !!m).sort((a, b) => b.until - a.until)[0];
  const mobileMemo = !hidden && latestMemo ? `${latestMemo.addr} ${latestMemo.body}` : null;
  const mc = bundle?.mobileConfirm ?? null;

  return (
    <div ref={shellBox} onClickCapture={blockHiddenCmd}>
      <SheetShell
        view={snap.view}
        chrome={chrome}
        game={gameLayer}
        disguise={disguiseLayer}
        mobile={isMobile}
        footer={
          isMobile ? (
            <>
              <MemoLine text={mobileMemo ?? statusMsg} time={mobileMemo && g && view.status === 'playing' ? formatClock(clockMs) : undefined} />
              {mc && !hidden && !showResult ? (
                <div className="mc-confirmrow" data-pair={mc.secondary ? 'true' : undefined}>
                  {mc.secondary ? (
                    <Button variant="secondary" cmd={mc.secondary.cmd} disabled={mc.secondary.disabled} onClick={mc.secondary.onConfirm}>
                      {mc.secondary.label}
                    </Button>
                  ) : null}
                  <Button cmd={mc.cmd} disabled={mc.disabled} onClick={mc.onConfirm}>
                    {mc.label}
                  </Button>
                </div>
              ) : null}
              <MobileSheetTabs tabs={shownTabs} activeId={activeTab} onTab={onTab} keyboardOffset={kbOffset} />
            </>
          ) : (
            <>
              <SheetTabs tabs={shownTabs} activeId={activeTab} onTab={onTab} onAdd={() => { setDisTab('ds'); store.hide('tabclick'); }} />
              <StatusBar message={statusMsg} right={rightText} />
            </>
          )
        }
      />
    </div>
  );
}

export { INDUSTRIES, setPracticeDone };
