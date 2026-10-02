'use client';

/**
 * 방장 화면 H1~H10 (§3). GungApp이 GuFrame(헤더·탭바)을 조립하고, 이 모듈은 본문+ActionBar만 만든다.
 * 방장도 자리 1 플레이어다(D1) — H5에서 "방장의 조사"를 본문 인라인으로 넣는다(진행 버튼과 분리, §1-4).
 *
 * HostPlayArea 는 컴포넌트가 아니라 "본문/액션바 묶음"을 돌려주는 순수 함수다(훅 호출 없음 — 훅이 필요한
 * 조각은 HostPlacePicker·HostOwnClue 처럼 별도 컴포넌트로 만든다).
 */
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Hand } from 'lucide-react';
import {
  type Assignment,
  type GameAction,
  type GameState,
  type GungCase,
  type RoundNo,
  type RoundPick,
  activeSeats,
  gateRoundsShown,
  gateTimeline,
  getAllSheets,
  getClue,
  getRoundBoard,
  getSheet,
  parseRoomCode,
  publicSeat,
  publicSeats,
  reachedRound,
  resolveBriefing,
  resolveVerdict,
  resultOf,
  revealBeats,
  roleById,
  roundDef,
  roundPlaces,
  rolesVisible,
  timeTable,
  TIME_TABLE_NOTE,
} from '@/lib/gung';
import {
  ClueCard,
  GateTimelineBar,
  GuButton,
  HostCue,
  IncenseTimer,
  PlaceGrid,
  RevealScroll,
  RoleIcon,
  RoomCode,
  ScoreRow,
  SealStamp,
  SeatRing,
  ShareActions,
  TallyBars,
  TimeTable,
  VoteStepper,
} from '../components';
import type { GuTabKey, IncenseTimerValue, ScoreMission } from '../components';
import { useHoldReveal } from '../lib/useHoldReveal';
import { gateToView, placeToSummary, seatRingItems } from './adapters';
import type { ConfirmRequest } from './Overlays';
import { MyCardTab } from './Tabs';

/** §13 기본 진행 대본 — 사건 데이터 hostCue 가 있으면 그쪽이 이긴다 */
export const HOST_CUE = {
  lobby: '2번부터 차례로 번호와 사건 표식을 외치시오',
  briefing: '모두 귀를 기울이시오. 소리 내어 읽어주시오',
  cards: '각자 자기 패를 몰래 확인하시오. 남의 패를 엿보면 곤장이오',
  intro: '1번부터 차례로 신분을 밝히시오. 사극 말투는 필수요',
  select: '조사할 곳을 한 군데만 고르시오. 시간은 2분이오',
  discuss: '찾은 단서를 밝힐지 숨길지는 각자의 몫. 밝힌다면 소리 내어 읽으시오',
  defense: '한 사람씩 1분, 마지막 변론을 하시오',
  vote: '셋을 세면, 범인이라 생각하는 자를 동시에 손가락으로 가리키시오',
  reveal: '이제 그날 밤의 진상을 밝히겠소',
  result: '각자 개인 미션을 밝히고, 성공했는지 모두가 판정하시오',
} as const;

export interface HostAreaResult {
  body: ReactNode;
  actionBar?: ReactNode;
  actionSecondary?: ReactNode;
  /** H9 진상 공개 — 탭바 숨김(액션바는 유지) */
  stageFullscreen?: boolean;
  gateCaption?: string;
}

export interface HostAreaProps {
  c: GungCase;
  state: GameState;
  a: Assignment;
  sealEpoch: unknown;
  revealMode: 'hold' | 'tap';
  activeTab: GuTabKey;
  timerValue: IncenseTimerValue | null;
  onTimer: (op: 'pause' | 'resume' | 'add30' | 'restart') => void;
  dispatch: (a: GameAction) => void;
  onConfirm: (req: ConfirmRequest) => void;
  /** tag: 'pick:N' 등 — 그 되돌리기가 무효가 되면 GungApp 이 토스트를 거둔다 */
  onToast: (text: string, action?: { label: string; onClick: () => void }, duration?: number, tag?: string) => void;
  onStartCountdown: () => void;
  onGoTab: (tab: GuTabKey) => void;
  stageScale: 1 | 1.2;
  onToggleScale: () => void;
  onShareInvite: () => void;
  onShareResult: () => void;
  onCopyResult: () => void;
  resultCopied: boolean;
  onSaveImage: () => void;
  /** 결과 카드 미리보기(현재 origin 기준 — 로컬에서도 보이게) */
  ogPreviewUrl: string | null;
  /** H1 인원 바꾸기 · H10 새 사건 — 저장을 지우고 S2 방 만들기로 */
  onNewRoom: () => void;
  /** H10 처음으로 — 저장을 지우고 S1 홈으로 */
  onFinish: () => void;
  /** 내 패 탭을 「새 기억」 쪽부터 열기(알림 배너 → 내 패에서 보기) */
  cardFocus?: 'memory' | null;
}

/**
 * 타이머 자리 — 돌던 타이머가 있으면 향 막대, 없으면(단계 맞추기·방장 복구 직후: 엔진 hostSync 가 timer=null) "타이머 시작" 버튼.
 * QA BUG-07: 예전엔 타이머가 null 이면 영역 자체가 사라져 그 단계 시간을 잴 방법이 없었다.
 */
function TimerSlot({ timerValue, onTimer, size, label }: { timerValue: IncenseTimerValue | null; onTimer: HostAreaProps['onTimer']; size: 'stage' | 'compact'; label: string }) {
  if (timerValue) {
    return <IncenseTimer value={timerValue} size={size} onPause={() => onTimer('pause')} onResume={() => onTimer('resume')} onAdd30={() => onTimer('add30')} />;
  }
  return (
    <GuButton variant="secondary" onClick={() => onTimer('restart')}>
      ⏱ {label} 타이머 시작
    </GuButton>
  );
}

/** 내문 출입 타임라인을 방장 화면 상단에 그리는 단계 — 공용 카드 PB-2 가 열릴 수 있는 조사 2부터 지목까지 */
const GATE_TIMELINE_PHASES: ReadonlySet<GameState['phase']> = new Set(['r2', 'r3', 'defense', 'vote']);

/** 원고 1-8 앱 구현 메모(3판): PB-2·PB-3가 열리면 방장 폰 상단에 내문 출입 타임라인 막대 */
function hostGateTimeline(c: GungCase, a: Assignment, state: GameState): ReactNode {
  if (!GATE_TIMELINE_PHASES.has(state.phase)) return null;
  const t = gateTimeline(c, a.n, gateRoundsShown(state));
  return t ? <GateTimelineBar data={gateToView(t)} /> : null;
}

export function HostPlayArea(props: HostAreaProps): HostAreaResult {
  const { c, state, a } = props;

  if (props.activeTab === 'cards') {
    // 라운드 잠금(원고 3판) — 방장도 자리 1 플레이어. 방장 폰의 진행 단계 기준
    const sheet = getSheet(c, a, 1, reachedRound(state.phase));
    if (!sheet) return { body: <p className="gu-body">패를 읽지 못했소.</p> };
    return { body: <MyCardTab sheet={sheet} seat={1} sealEpoch={props.sealEpoch} revealMode={props.revealMode} focus={props.cardFocus} /> };
  }

  const res = hostPhaseArea(props);
  const timeline = hostGateTimeline(c, a, state);
  return timeline ? { ...res, body: <>{timeline}{res.body}</> } : res;
}

function hostPhaseArea(props: HostAreaProps): HostAreaResult {
  const { state } = props;
  const host = state.host!;
  switch (state.phase) {
    case 'lobby':
      return hostLobby(props);
    case 'briefing':
      return hostBriefing(props);
    case 'cards':
      return hostCards(props);
    case 'intro':
      return hostIntro(props);
    case 'r1':
    case 'r2':
    case 'r3':
      return host.roundSub === 'discuss' ? hostDiscuss(props) : hostSelect(props);
    case 'defense':
      return hostDefense(props);
    case 'vote':
      return hostVote(props);
    case 'reveal':
      return hostReveal(props);
    case 'result':
      return hostResult(props);
    default:
      return { body: null };
  }
}

function roundOf(state: GameState): RoundNo {
  return Number(state.phase[1]) as RoundNo;
}

/** 공용 화면 자리 라벨 — 자기소개 이후에만 역할명(D16) */
function seatName(c: GungCase, a: Assignment, state: GameState, seat: number): string {
  const ps = rolesVisible(c, state.phase) ? publicSeat(c, a, seat) : null;
  return ps ? `${seat}번 · ${ps.shortName}` : `${seat}번`;
}

// ─────────────────────────────── H1 대기실 ───────────────────────────────

function hostLobby({ state, a, dispatch, onConfirm, onShareInvite, onNewRoom }: HostAreaProps): HostAreaResult {
  const host = state.host!;
  const n = a.n;
  const room = parseRoomCode(state.code);
  const unchecked = n - host.rollCall.length;
  const items = seatRingItems(n, { mode: 'rollcall', rollCall: host.rollCall });
  return {
    body: (
      <>
        <RoomCode code={state.code} compact n={n} tag={room?.tag} />
        <HostCue>{HOST_CUE.lobby}</HostCue>
        <SeatRing n={n} mode="rollcall" items={items} onTapSeat={(seat) => seat !== 1 && dispatch({ type: 'rollCall', seat })} />
        <p className="gu-h2">
          확인 {host.rollCall.length} / {n}
        </p>
        <GuButton variant="secondary" onClick={onShareInvite}>
          💬 초대 다시 보내기
        </GuButton>
        <button
          type="button"
          className="gu-ghostlink gu-text-danger"
          onClick={() =>
            onConfirm({
              title: '인원을 바꾸겠소?',
              body: '인원을 바꾸면 새 방이 되오. 방 코드가 바뀌니 모두에게 다시 초대를 보내야 하오.',
              confirmLabel: '새 방 만들기',
              danger: true,
              onConfirm: onNewRoom,
            })
          }
        >
          인원 바꾸기(새 방) ›
        </button>
      </>
    ),
    actionBar: (
      <GuButton
        variant="primary"
        onClick={() => {
          if (unchecked > 0) {
            onConfirm({
              title: '사건을 시작하겠소?',
              body: `${unchecked}명 확인 안 됐소. 그래도 시작?`,
              confirmLabel: '시작하겠소',
              onConfirm: () => dispatch({ type: 'advance' }),
            });
          } else {
            dispatch({ type: 'advance' });
          }
        }}
      >
        사건 시작 →
      </GuButton>
    ),
  };
}

// ─────────────────────────────── H2 브리핑 ───────────────────────────────

function hostBriefing({ c, a, dispatch, stageScale, onToggleScale }: HostAreaProps): HostAreaResult {
  const b = resolveBriefing(c, a.n);
  return {
    body: (
      <>
        <div className="gu-cue-row">
          <HostCue>{b.hostCue ?? HOST_CUE.briefing}</HostCue>
          <button type="button" className="gu-scale-toggle" aria-pressed={stageScale > 1} onClick={onToggleScale}>
            {stageScale > 1 ? '가 보통' : '가 크게'}
          </button>
        </div>
        {b.paragraphs.map((p, i) => (
          <p key={i} className="gu-stagebody gu-briefing-p">
            {p}
          </p>
        ))}
        <p className="gu-micro gu-text-right">약 {b.readMinutes}분 낭독</p>
        {/* 원고 1-8 ① 브리핑 = 낭독문 + 시각표. 조사 중엔 헤더 「?」(용어 풀이·시각표)에서 다시 본다 */}
        <TimeTable rows={timeTable(c)} note={TIME_TABLE_NOTE} />
      </>
    ),
    actionBar: (
      <GuButton variant="primary" onClick={() => dispatch({ type: 'advance' })}>
        다 읽었소 → 패 확인
      </GuButton>
    ),
  };
}

// ─────────────────────────────── H3 패 확인 안내 ───────────────────────────────

function hostCards({ dispatch, onGoTab, timerValue, onTimer }: HostAreaProps): HostAreaResult {
  return {
    body: (
      <>
        <Hand aria-hidden size={64} className="gu-hero-icon" />
        <HostCue className="gu-hostcue--lg">{HOST_CUE.cards}</HostCue>
        {/* 원고 1-8 ② 「각자 폰을 가리고 확인하세요」 카운트다운 3분 */}
        <TimerSlot timerValue={timerValue} onTimer={onTimer} size="stage" label="패 확인 3분" />
        <ul className="gu-plainlist">
          <li>· 아래 &apos;내 패&apos; 탭에서 꾹 눌러 보기</li>
          <li>· 손으로 화면을 가리고 보시오</li>
          <li>· 방장도 자기 패를 확인하시오</li>
        </ul>
        <GuButton variant="secondary" onClick={() => onGoTab('cards')}>
          🪪 내 패 보러 가기
        </GuButton>
      </>
    ),
    actionBar: (
      <GuButton variant="primary" onClick={() => dispatch({ type: 'advance' })}>
        다 봤소 → 자기소개
      </GuButton>
    ),
    actionSecondary: (
      <button type="button" className="gu-ghostlink" onClick={() => dispatch({ type: 'skipIntro' })}>
        자기소개 건너뛰기 ›
      </button>
    ),
  };
}

// ─────────────────────────────── H4 자기소개 ───────────────────────────────

function hostIntro({ a, state, dispatch }: HostAreaProps): HostAreaResult {
  const host = state.host!;
  const active = activeSeats(a.n, host.absentSeats);
  const curIdx = active.indexOf(host.introCurrent);
  const done = curIdx > 0 ? active.slice(0, curIdx) : [];
  const isLast = curIdx >= active.length - 1;
  const items = seatRingItems(a.n, { mode: 'progress', current: host.introCurrent, done, absentSeats: host.absentSeats });
  return {
    body: (
      <>
        <HostCue>{HOST_CUE.intro}</HostCue>
        <p className="gu-display gu-center">
          지금: {host.introCurrent}번
        </p>
        <SeatRing n={a.n} mode="progress" items={items} onTapSeat={(seat) => dispatch({ type: 'introSet', seat })} />
        <p className="gu-micro gu-center">방장 차례엔 &apos;내 패 › 신분&apos;을 꾹</p>
        <GuButton variant="secondary" disabled={isLast} disabledReason="마지막 사람이오" onClick={() => dispatch({ type: 'introNext' })}>
          다음 사람 →
        </GuButton>
      </>
    ),
    actionBar: (
      <GuButton variant="primary" onClick={() => dispatch({ type: 'advance' })}>
        첫째 조사 시작 →
      </GuButton>
    ),
  };
}

// ─────────────────────────────── H5 조사 — 장소 고르기 ───────────────────────────────

function hostSelect(props: HostAreaProps): HostAreaResult {
  const { c, state, a, dispatch, timerValue, onTimer, onToast } = props;
  const round = roundOf(state);
  const myPick: RoundPick | undefined = state.rounds[round];
  const cue = roundDef(c, round).hostCue?.select ?? HOST_CUE.select;
  return {
    body: (
      <>
        <HostCue>{cue}</HostCue>
        <TimerSlot timerValue={timerValue} onTimer={onTimer} size="compact" label="장소 고르기" />
        <PublicBoard c={c} a={a} round={round} />
        <section className="gu-private-zone" aria-label="방장의 조사">
          <p className="gu-h3 gu-private-label">방장의 조사</p>
          {myPick ? (
            <HostOwnClue
              c={c}
              a={a}
              round={round}
              pick={myPick}
              dispatch={dispatch}
              sealEpoch={props.sealEpoch}
              revealMode={props.revealMode}
              onToast={onToast}
            />
          ) : (
            <HostPlacePicker
              places={roundPlaces(c, round).map((p) => placeToSummary(c, p.id))}
              onPick={(id, name) => {
                dispatch({ type: 'pickPlace', round, placeId: id });
                onToast(`${name}에 갔소 · 단서를 열기 전까지 되돌릴 수 있소`, { label: '되돌리기', onClick: () => dispatch({ type: 'unpickPlace', round }) }, 6000, `pick:${round}`);
              }}
            />
          )}
        </section>
      </>
    ),
    actionBar: (
      <GuButton variant="primary" onClick={() => dispatch({ type: 'advance' })}>
        토론 {Math.round((c.timers?.discussMs ?? 7 * 60_000) / 60_000)}분 시작 →
      </GuButton>
    ),
  };
}

/** 방장 본인 장소 고르기 — 2탭(타일 선택 → 인라인 "○○ 조사하기"), 진행 버튼(ActionBar)과 섞지 않는다(§1-4, D11) */
function HostPlacePicker({ places, onPick }: { places: ReturnType<typeof placeToSummary>[]; onPick: (id: string, name: string) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const place = places.find((p) => p.id === selected);
  return (
    <>
      <PlaceGrid places={places} selected={selected} onSelect={setSelected} />
      <GuButton variant="secondary" disabled={!place} disabledReason="장소를 고르시오" onClick={() => place && onPick(place.id, place.name)}>
        {place ? `${place.name} 조사하기` : '장소를 고르시오'}
      </GuButton>
    </>
  );
}

function HostOwnClue({
  c,
  a,
  round,
  pick,
  dispatch,
  sealEpoch,
  revealMode,
  onToast,
}: {
  c: GungCase;
  a: Assignment;
  round: RoundNo;
  pick: RoundPick;
  dispatch: (a: GameAction) => void;
  sealEpoch: unknown;
  revealMode: 'hold' | 'tap';
  onToast: HostAreaProps['onToast'];
}) {
  const clue = getClue(c, a, round, pick.placeId, 1);
  const reveal = useHoldReveal(revealMode, `${String(sealEpoch)}-own-${round}`);
  useEffect(() => {
    if (reveal.open && !pick.opened) dispatch({ type: 'openClue', round });
  }, [reveal.open, pick.opened, round, dispatch]);
  if (!clue) return <p className="gu-muted">이 장소엔 단서가 없소.</p>;
  return (
    <ClueCard
      roundNo={round}
      place={placeToSummary(c, pick.placeId)}
      clueId={clue.id}
      clueText={clue.body}
      terms={clue.terms.map((t) => ({ term: t.term, desc: t.desc }))}
      disclosure={pick.disclosure}
      open={reveal.open}
      mode={reveal.mode}
      pressBind={reveal.pressBind}
      holdProgress={reveal.holdProgress}
      disclosureEnabled={pick.opened}
      onDisclose={(value) => {
        dispatch({ type: 'disclose', round, value });
        if (value === 'public') onToast('공개로 표시했소', { label: '되돌리기', onClick: () => dispatch({ type: 'undoDisclose', round }) }, 5000);
      }}
    />
  );
}

/**
 * 그 라운드 공용 카드(PB)·추가 증언(NPC) — **라운드 시작 때 공개**(원고 1-7 규칙 4·4-1·1-8, QA BUG-04 결정).
 * 장소 고르기 화면부터 토론까지 그대로 보인다. 인원만 받는다(역할 무관) — 플레이어 단서함과 같은 목록.
 */
function PublicBoard({ c, a, round }: { c: GungCase; a: Assignment; round: RoundNo }) {
  const board = getRoundBoard(c, a.n, round);
  if (board.publicCards.length + board.npcCards.length === 0) return null;
  return (
    <div className="gu-publicclue">
      <p className="gu-publicclue-label">📢 공용 단서 · 조사 {round} — 소리 내어 읽으시오</p>
      {board.publicCards.map((card) => (
        <div key={card.id} className="gu-publicclue-card">
          <p className="gu-publicclue-title gu-display">{card.title}</p>
          <p className="gu-publicclue-body">{card.body}</p>
        </div>
      ))}
      {board.npcCards.length > 0 && <p className="gu-publicclue-label">{board.npcHeading}</p>}
      {board.npcCards.map((card) => (
        <div key={card.id} className="gu-publicclue-card">
          <p className="gu-publicclue-title gu-display">{card.title}</p>
          <p className="gu-publicclue-body">{card.body}</p>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────── H6 조사 — 토론 ───────────────────────────────

function hostDiscuss(props: HostAreaProps): HostAreaResult {
  const { c, state, a, dispatch, timerValue, onTimer, onGoTab } = props;
  const round = roundOf(state);
  const cue = roundDef(c, round).hostCue?.discuss ?? HOST_CUE.discuss;
  return {
    body: (
      <>
        <TimerSlot timerValue={timerValue} onTimer={onTimer} size="stage" label="토론" />
        <HostCue>{cue}</HostCue>
        <PublicBoard c={c} a={a} round={round} />
        <button type="button" className="gu-ghostlink" onClick={() => onGoTab('clues')}>
          내 단서 다시 보기 ›
        </button>
      </>
    ),
    actionBar: (
      <GuButton variant="primary" onClick={() => dispatch({ type: 'advance' })}>
        {round < 3 ? `${round === 1 ? '둘째' : '셋째'} 조사 시작 →` : '최종 변론으로 →'}
      </GuButton>
    ),
  };
}

// ─────────────────────────────── H7 최종 변론 ───────────────────────────────

function hostDefense({ c, a, state, dispatch, timerValue, onTimer }: HostAreaProps): HostAreaResult {
  const host = state.host!;
  const d = host.defense ?? { order: [], index: 0 };
  const seat = d.order[d.index] ?? 1;
  const isLast = d.index >= d.order.length - 1;
  return {
    body: (
      <>
        <HostCue>{HOST_CUE.defense}</HostCue>
        <p className="gu-micro gu-center">지금 차례</p>
        <p className="gu-display gu-display-xl gu-center">{seatName(c, a, state, seat)}</p>
        <TimerSlot timerValue={timerValue} onTimer={onTimer} size="stage" label="변론" />
        <div className="gu-defense-chips" aria-label="변론 순서">
          {d.order.map((s, i) => (
            <span key={s} className="gu-defense-chip" data-state={i < d.index ? 'done' : i === d.index ? 'current' : 'todo'}>
              {i < d.index ? '✓' : ''}
              {s}
            </span>
          ))}
        </div>
      </>
    ),
    actionBar: (
      <GuButton variant="primary" onClick={() => dispatch({ type: 'advance' })}>
        {isLast ? '지목하러 →' : `다음 사람 → ${d.order[d.index + 1] ?? ''}번`}
      </GuButton>
    ),
  };
}

// ─────────────────────────────── H8 지목 ───────────────────────────────

function hostVote(props: HostAreaProps): HostAreaResult {
  const { c, a, state, dispatch, onStartCountdown, onConfirm, timerValue, onTimer } = props;
  const host = state.host!;
  // 저장 정합성은 storage 가 맞추지만(QA BUG-19), 화면도 null 로 죽지 않게 지목 준비 상태로 본다
  const vote = host.vote ?? { sub: 'ready' as const, first: {} };
  const active = activeSeats(a.n, host.absentSeats);
  const showRoles = rolesVisible(c, state.phase);
  const seats = publicSeats(c, a);
  const gridItems = seats
    .filter((s) => active.includes(s.seat))
    .map((s) => ({ seat: s.seat, roleName: showRoles ? s.shortName : undefined, icon: showRoles ? s.icon : undefined }));
  const nameOf = (seat: number) => seatName(c, a, state, seat);

  if (vote.sub === 'ready') {
    return {
      body: (
        <>
          <HostCue>{HOST_CUE.vote}</HostCue>
          <ul className="gu-plainlist">
            <li>· 폰으로 고른 사람은 화면을 드시오</li>
            <li>· 방장이 다 적을 때까지 손을 내리지 마시오</li>
          </ul>
        </>
      ),
      actionBar: (
        <GuButton variant="primary" onClick={onStartCountdown}>
          셋 세기 시작 →
        </GuButton>
      ),
    };
  }

  if (vote.sub === 'input' || vote.sub === 'revote') {
    const isRevote = vote.sub === 'revote';
    const candidates = isRevote ? vote.revote!.candidates : active;
    const ballots = isRevote ? vote.revote!.ballots : vote.first;
    // "이전 사람" = 지금 묻는 사람 바로 앞(자리 순)에서 표가 있는 사람
    const current = active.find((v) => ballots[v] === undefined);
    const before = current === undefined ? active : active.slice(0, active.indexOf(current));
    const prev = [...before].reverse().find((v) => ballots[v] !== undefined);
    return {
      body: (
        <>
          {isRevote && <p className="gu-banner-inline">재지목 — 후보 {candidates.map((s) => `${s}번`).join('·')} 중에서만</p>}
          <VoteStepper
            voters={gridItems}
            candidates={gridItems.filter((g) => candidates.includes(g.seat))}
            ballots={ballots}
            revote={isRevote}
            onBallot={(voter, target) => dispatch({ type: 'ballot', voter, target })}
            onBack={prev !== undefined ? () => dispatch({ type: 'clearBallot', voter: prev }) : undefined}
          />
        </>
      ),
    };
  }

  // tally / final
  const verdict = resolveVerdict(vote, active, a.culpritSeat);
  const isFinal = vote.sub === 'final';
  const tally = isFinal && verdict.revote ? verdict.revote : verdict.first;
  const ballots = isFinal ? vote.revote?.ballots ?? {} : vote.first;
  const rows = Object.entries(tally.counts).map(([seat, count]) => {
    const s = Number(seat);
    const ps = showRoles ? seats.find((x) => x.seat === s) : undefined;
    return { seat: s, roleName: ps?.shortName, count };
  });
  const needsRevote = verdict.stage === 'needsRevote';
  const decided = verdict.stage === 'decided';
  return {
    body: (
      <>
        <p className="gu-h3">{isFinal ? '재지목 집계' : '지목 집계'} · 탭하면 그 사람부터 다시 입력</p>
        <ul className="gu-ballotlist">
          {active.map((voter) => (
            <li key={voter}>
              <button type="button" className="gu-ballotlist-row" onClick={() => dispatch({ type: 'clearBallot', voter })} aria-label={`${voter}번의 지목 고치기`}>
                <span className="gu-num">{voter}번</span>
                <span aria-hidden>→</span>
                <span className="gu-num">{ballots[voter] !== undefined ? `${ballots[voter]}번` : '—'}</span>
                <span className="gu-ballotlist-edit" aria-hidden>
                  ›
                </span>
              </button>
            </li>
          ))}
        </ul>
        <TallyBars rows={rows} tiedSeats={needsRevote ? tally.top : []} />
        {decided && verdict.accusedSeat !== null && (
          <p className="gu-h2 gu-center">
            최다 지목: {nameOf(verdict.accusedSeat)} (<span className="gu-num">{tally.counts[verdict.accusedSeat] ?? 0}</span>표)
          </p>
        )}
        {decided && verdict.accusedSeat === null && <p className="gu-h2 gu-center gu-text-danger">끝내 동률 — 아무도 지목되지 않았소</p>}
        {needsRevote && (
          <p className="gu-sheet-warn" role="status">
            {tally.top.map((s) => `${s}번`).join('·')} 동률! 이 중에서 다시 지목하시오
          </p>
        )}
        {needsRevote && (
          // 원고 8-1: 동률자만 30초씩 추가 변론 → 재투표
          <section className="gu-tiedefense" aria-label="동률자 추가 변론">
            <p className="gu-h3">동률자 추가 변론 — {tally.top.map(nameOf).join(' → ')} 한 사람씩 30초</p>
            <TimerSlot timerValue={timerValue} onTimer={onTimer} size="compact" label="동률 변론 30초" />
            {timerValue && (
              <button type="button" className="gu-ghostlink" onClick={() => onTimer('restart')}>
                다음 사람 30초 다시 ›
              </button>
            )}
          </section>
        )}
        {!needsRevote && c.bonusQuestions && c.bonusQuestions.length > 0 && <BonusInput c={c} state={state} active={active} dispatch={dispatch} nameOf={nameOf} />}
      </>
    ),
    actionBar: needsRevote ? (
      <GuButton variant="primary" onClick={() => dispatch({ type: 'startRevote' })}>
        재지목 시작 →
      </GuButton>
    ) : (
      <GuButton
        variant="primary"
        onClick={() =>
          onConfirm({
            title: '진상을 공개하겠소?',
            body: '공개하면 모두의 비밀이 드러나오. 지목 집계는 끝났소?',
            confirmLabel: '공개하겠소',
            onConfirm: () => dispatch({ type: 'advance' }),
          })
        }
      >
        진상 공개 →
      </GuButton>
    ),
  };
}

/**
 * 보너스 문항 입력(원고 8-1·8-2: 범인 외 정답당 +1, 어의 미션 ② 판정 근거). 디자인 스펙엔 없던 원고 요소라
 * 집계 화면 아래에 접힌 선택 구역으로 둔다 — 진상 공개 전에만 받는다(공개 뒤엔 답이 드러나므로).
 */
function BonusInput({
  c,
  state,
  active,
  dispatch,
  nameOf,
}: {
  c: GungCase;
  state: GameState;
  active: number[];
  dispatch: (a: GameAction) => void;
  nameOf: (seat: number) => string;
}) {
  const answers = state.host?.vote?.bonus ?? {};
  const filled = (c.bonusQuestions ?? []).reduce((n, q) => n + active.filter((s) => answers[s]?.[q.id] !== undefined).length, 0);
  return (
    <details className="gu-bonus">
      <summary className="gu-bonus-summary">
        보너스 문항 입력(선택) · <span className="gu-num">{filled}</span>개 입력됨
      </summary>
      <p className="gu-micro">각 문항을 읽고, 셋에 손가락 1~{Math.max(...(c.bonusQuestions ?? []).map((q) => q.options.length))}개로 답하게 하시오. 범인의 답은 점수에 들어가지 않소.</p>
      {(c.bonusQuestions ?? []).map((q) => (
        <fieldset key={q.id} className="gu-bonus-q">
          <legend className="gu-bonus-prompt gu-display">{q.prompt}</legend>
          <ol className="gu-bonus-legend">
            {q.options.map((o, i) => (
              <li key={i}>
                <span className="gu-num">{i + 1}</span> {o}
              </li>
            ))}
          </ol>
          {active.map((seat) => {
            const cur = answers[seat]?.[q.id];
            return (
              <div key={seat} className="gu-bonus-row" role="group" aria-label={`${nameOf(seat)} — ${q.prompt}`}>
                <span className="gu-bonus-who">{nameOf(seat)}</span>
                {q.options.map((o, i) => (
                  <button
                    key={i}
                    type="button"
                    className="gu-bonus-opt gu-num"
                    data-active={cur === i || undefined}
                    aria-pressed={cur === i}
                    aria-label={`${i + 1}번 ${o}`}
                    onClick={() => dispatch({ type: 'bonusAnswer', seat, questionId: q.id, option: cur === i ? null : i })}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            );
          })}
        </fieldset>
      ))}
    </details>
  );
}

// ─────────────────────────────── H9 진상 공개 ───────────────────────────────

function hostReveal(props: HostAreaProps): HostAreaResult {
  const { c, a, state, dispatch } = props;
  const host = state.host!;
  const beats = revealBeats(c);
  const beat = beats[Math.min(host.revealIndex, beats.length - 1)];
  const culprit = publicSeat(c, a, a.culpritSeat);
  const result = resultOf(c, state);
  const storyBeats = c.truth.beats.map((b) => ({ time: b.time ?? '', text: b.text }));

  let body: ReactNode;
  let primaryLabel = `다음 (${host.revealIndex + 1}/${beats.length})`;
  switch (beat.kind) {
    case 'dark':
      body = <p className="gu-reveal-dark gu-display">그날 밤…</p>;
      break;
    case 'story':
      body = <RevealScroll beats={storyBeats} index={beat.index} mode="beat" onNext={() => dispatch({ type: 'advance' })} />;
      break;
    case 'culpritLine':
      body = <p className="gu-reveal-line gu-display">{beat.text}</p>;
      break;
    case 'culprit':
      body = (
        <div className="gu-reveal-culprit">
          {culprit && <RoleIcon iconKey={culprit.icon} size={96} />}
          <p className="gu-display gu-display-xl">
            {a.culpritSeat}번 · {culprit?.shortName ?? roleById(c, a.culpritRole)?.name}
          </p>
          <SealStamp text="범인" size={120} />
          <p className="gu-reveal-confession">{beat.confession}</p>
        </div>
      );
      break;
    case 'verdict': {
      const caught = Boolean(result?.caught);
      // QA BUG-06: 지목을 마치지 않고 건너왔으면 '도주'가 아니라 판결 없음
      const decided = Boolean(result?.decided);
      const accused = result?.verdict.accusedSeat ?? null;
      const tally = result?.verdict.revote ?? result?.verdict.first;
      body = (
        <div className="gu-reveal-verdict">
          <SealStamp text={!decided ? '미결' : caught ? '검거' : '도주'} size={140} />
          {/* QA BUG-02: 범인이 자리를 비운 사실은 자리 비우기 화면이 아니라 여기(진상 공개 뒤)에서만 드러난다 */}
          {result?.culpritAbsent && <p className="gu-reveal-stats">범인({result.culpritSeat}번)이 자리를 비워 판결이 없소. 새 방에서 다시 해 보시오.</p>}
          {result && !decided && !result.culpritAbsent && <p className="gu-reveal-stats">지목이 끝나지 않아 판결이 없소. ↶ 로 돌아가 지목을 마치시오.</p>}
          {result && decided && (
            <p className="gu-reveal-stats">
              {accused !== null
                ? `최다 지목 ${seatName(c, a, state, accused)} (${tally?.counts[accused] ?? 0}표)`
                : '끝내 아무도 지목되지 않았소'}
            </p>
          )}
          {result && decided && (
            <p className="gu-reveal-stats">
              {result.judges}명 중 {result.hits}명이 진범을 짚었소(범인 제외)
            </p>
          )}
          {/* 원고 7-2 순서: ④ 결말 → ⑤ 요약 */}
          {beat.epilogue && <p className="gu-reveal-summary gu-reveal-epilogue">{beat.epilogue}</p>}
          {beat.summary && <p className="gu-reveal-summary">{beat.summary}</p>}
          <details className="gu-reveal-all">
            <summary>그날 밤의 진상 전체 다시 보기</summary>
            <RevealScroll beats={storyBeats} index={storyBeats.length - 1} mode="all" />
          </details>
        </div>
      );
      primaryLabel = '점수 보기 →';
      break;
    }
  }

  return {
    stageFullscreen: true,
    body,
    actionBar: (
      <GuButton variant="primary" onClick={() => dispatch({ type: 'advance' })}>
        {primaryLabel}
      </GuButton>
    ),
    // QA BUG-15: 정황을 건너뛰는 건 되돌리기 어려운 연출 선택 — 확인을 받고, 범인 도장(자백) 비트까지만 간다
    actionSecondary:
      beat.kind !== 'verdict' && beat.kind !== 'culprit' ? (
        <button
          type="button"
          className="gu-ghostlink"
          onClick={() =>
            props.onConfirm({
              title: '정황을 건너뛰고 범인을 밝히겠소?',
              body: '남은 정황 낭독을 건너뛰고 범인 도장(자백)으로 바로 가오. 판결은 그다음이오.',
              confirmLabel: '범인을 밝히겠소',
              onConfirm: () => dispatch({ type: 'revealAll' }),
            })
          }
        >
          전체 한 번에 보기 ›
        </button>
      ) : undefined,
  };
}

// ─────────────────────────────── H10 결과 ───────────────────────────────

function hostResult(props: HostAreaProps): HostAreaResult {
  const { c, a, state, dispatch, onShareResult, onCopyResult, resultCopied, onSaveImage, ogPreviewUrl } = props;
  const result = resultOf(c, state);
  if (!result) return { body: null };
  const seats = publicSeats(c, a);
  const sheets = getAllSheets(c, a);
  const rowsBySeat = new Map(result.rows.map((r) => [r.seat, r]));
  // 판정 중엔 자리 순으로 고정(누른 행이 손가락 밑에서 순위 따라 튀면 취객이 엉뚱한 사람 미션을 누른다),
  // 미판정이 0이 되면 점수 내림차순으로 정렬(§3 H10). 순위 숫자는 항상 표시.
  const order = result.pendingMissions > 0 ? result.rows.filter((r) => !r.absent).map((r) => r.seat) : result.ranking;
  const ranked = order.map((s) => rowsBySeat.get(s)).filter((r): r is NonNullable<typeof r> => Boolean(r));
  const culprit = seats.find((s) => s.seat === result.culpritSeat);
  const mvp = result.mvpSeats.map((s) => seats.find((x) => x.seat === s)).filter((x): x is NonNullable<typeof x> => Boolean(x));

  return {
    body: (
      <>
        <div className="gu-result-head">
          <SealStamp text={!result.decided ? '미결' : result.caught ? '검거' : '도주'} size={56} />
          <p className="gu-h2">
            {!result.decided ? (result.culpritAbsent ? '판결 없음(범인 자리 비움)' : '판결 없음(지목 미완료)') : result.caught ? '범인 검거' : '범인 도주'} · {result.culpritSeat}번{' '}
            {culprit?.shortName}
          </p>
          <p className="gu-micro">
            {result.minutes ?? '?'}분 · {result.revoted ? '재지목 끝에' : '재지목 없음'}
          </p>
        </div>
        <HostCue>{HOST_CUE.result}</HostCue>
        {result.pendingMissions > 0 && <p className="gu-micro gu-center">아직 판정 안 한 미션 {result.pendingMissions}개</p>}
        <div className="gu-scorelist">
          {ranked.map((row) => {
            const ps = seats.find((s) => s.seat === row.seat);
            const sheet = sheets.find((s) => s.seat === row.seat);
            const missions: ScoreMission[] = row.missions.map((m) => ({
              id: m.id,
              label: `${m.tag ? `${m.tag} ` : ''}${m.text}`,
              detail: !m.auto && !m.void && sheet?.secretLine ? `거수로 판정할 비밀: ${sheet.secretLine}` : undefined,
              points: m.points,
              value: m.value,
              auto: m.auto,
              void: m.void,
            }));
            return (
              <ScoreRow
                key={row.seat}
                rank={row.rank}
                seat={row.seat}
                roleName={ps?.shortName ?? ''}
                icon={ps?.icon}
                score={row.score}
                isCulprit={row.isCulprit}
                vote={row.isCulprit ? undefined : { targetSeat: row.vote, correct: Boolean(row.correct) }}
                culpritOutcome={row.isCulprit && result.decided ? (result.caught ? 'caught' : 'escaped') : undefined}
                missions={missions}
                onMissionChange={(missionId, value) => dispatch({ type: 'mission', seat: row.seat, missionId, value })}
              />
            );
          })}
        </div>
        {mvp.length > 0 && (
          <p className="gu-display gu-mvp">
            {result.caught ? '오늘의 명판관' : '오늘의 주인공: 범인'} — {mvp.map((m) => `${m.seat}번 · ${m.shortName}`).join(', ')}
          </p>
        )}
        {ogPreviewUrl && (
          <figure className="gu-resultpreview">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ogPreviewUrl} alt="결과 카드 미리보기 — 범인이 누구인지는 적혀 있지 않소" width={1200} height={630} loading="lazy" />
            <figcaption className="gu-micro">결과 카드엔 범인이 누구인지 적히지 않소(스포일러 없음)</figcaption>
          </figure>
        )}
        {result.decided ? (
          <ShareActions kind="result" onShare={onShareResult} onSaveImage={onSaveImage} onCopyLink={onCopyResult} copied={resultCopied} />
        ) : (
          // QA BUG-06: 판결 없는 판을 "범인 도주 · 완전범죄"로 공유하지 않는다
          <p className="gu-sheet-warn" role="status">
            {result.culpritAbsent
              ? '범인이 자리를 비워 판결이 없소. 결과 카드는 공유하지 않소 — 새 방에서 다시 해 보시오.'
              : '지목을 마치지 않아 판결이 없소. 결과 카드는 지목을 마친 뒤에 공유할 수 있소(⋮ › 진행 단계 맞추기 › 지목).'}
          </p>
        )}
        <div className="gu-result-footer-links">
          <button
            type="button"
            className="gu-ghostlink"
            onClick={() =>
              props.onConfirm({
                title: '새 사건(새 방)을 여시겠소?',
                body: '지금 사건 기록이 지워지고, 새 방 코드를 만드오.',
                confirmLabel: '새 방 열기',
                danger: true,
                onConfirm: props.onNewRoom,
              })
            }
          >
            새 사건(새 방) ›
          </button>
          <button
            type="button"
            className="gu-ghostlink"
            onClick={() =>
              props.onConfirm({
                title: '처음으로 가겠소?',
                body: '지금 사건 기록이 지워지오.',
                danger: true,
                confirmLabel: '처음으로',
                onConfirm: props.onFinish,
              })
            }
          >
            처음으로 ›
          </button>
        </div>
      </>
    ),
  };
}
