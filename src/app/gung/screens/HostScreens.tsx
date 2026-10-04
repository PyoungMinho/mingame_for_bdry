'use client';

/**
 * 방장 화면 H1~H10 (§3). GungApp이 GuFrame(헤더·탭바)을 조립하고, 이 모듈은 본문+ActionBar만 만든다.
 *
 * HostPlayArea 는 컴포넌트가 아니라 "본문/액션바 묶음"을 돌려주는 순수 함수다(훅 호출 없음).
 *
 * 개선 묶음 1
 *  - G1: 단계 전진 버튼 위 캡션 「누르고 외치시오: '…'」 — 신호는 signals.ts(플레이어 게이트와 같은 함수).
 *  - G2: (6판에서 바뀜) 낭독은 현장 보기가 맡고, 고르기 타이머는 현장 → 고르기 전진 때 돈다. 단계 맞추기로 오면 「다 읽었소 → 고르기 1분 시작」.
 *        방장 본인의 조사(장소 고르기·봉인 단서)는 **무대에서 뺐다** — 공용 무대에 봉인 카드가 하나도 없다(.gu-sealed 0개).
 *        방장은 단서함 탭의 「지금 고르기」로 고른다. 무대 버튼 문구는 '골랐는지'조차 드러내지 않는 고정 문구.
 *  - G3: 자기소개 큐에서 '사극 말투 필수' 삭제(말투 예시가 검증 밖 정보 경로라).
 *  - R1: 토론 화면 큐 아래 「물으면 사실대로」 상기 한 줄(질문 주제는 제안하지 않음).
 *  - R2: 브리핑 시각표 아래 궁 배치도(누르면 큰 시트).
 *  - R3: 지난 공용 단서·공용 단서 전체 접힘 블록, 시각 어림 한 줄 — 라운드 게이팅 그대로.
 *  - R5: 공개 단서 보드(인장으로만 올림) — 토론에선 펼침, 다음 라운드 고르기·변론·지목 준비에선 접힘.
 *  - R6: 최종 변론 3칸 틀 + 변론 칩 역할 아이콘(자기소개 뒤).
 *  - R7: 보너스 문항을 집계 아래 펼친 단계로, 0개 입력이면 진상 공개 확인 문구가 바뀐다.
 *  - M1: 결과 화면 「같은 사건으로 새 방」(6판 문구 압축).
 *
 * 6판(엔진 단계): 조사 라운드 = 현장 보기(scene, 조용한 1분) → 장소 고르기 → 토론.
 *  통합(프론트팀장): hostScene 무대 맨 위가 현장 그림(SceneView — 장소 그림 + 물건 단추 + 다 같이 보는 관찰 카드), 그 아래 공용 단서.
 *  SceneView 에는 사건·들어선 라운드·방 코드(본 물건 기록을 판마다 나누는 데만)·공개 배치도만 넘긴다 — 인원·자리·역할은 넘기지 않는다.
 *  고르기·토론에선 「현장 다시 보기」 시트(GungApp)로 언제든 다시 본다.
 *
 * 6판 진행 압축(UX 스펙 §2-2) — 누르기·확인 시트·안내 문구 줄이기
 *  - H1 대기실: 자리별 롤콜 → 표식 한 번에 외치기(자리 칩은 선택), 「사건을 시작하겠소?」 확인 시트 삭제, 진행표(FlowStrip).
 *  - H2 개요: 시각표·배치도 상시 노출 → 「배치도 · 시각표 ›」 링크(「?」 시트). ※ 날짜 안내는 작은 글씨(낭독 안 함).
 *  - H3 패 확인: 큐 1줄 + 타이머. 「자기소개 건너뛰기」는 ⋮ 메뉴로.
 *  - H4 자기소개: 「다음 사람 →」 삭제(자리 링 탭은 선택), 이름·직함만.
 *  - H5a·H5b·H6: 맨 위 하위 단계 표시(현장 → 고르기 → 토론), 시각 어림은 현장 화면 접힘 1곳, 고르기·토론의 공용 단서는 접힘.
 *  - H8: 지목 준비 불릿 삭제, 「진상을 공개하겠소?」·보너스 0개 확인 시트 삭제(판결 확정 전엔 버튼 비활성 + 인라인 경고),
 *        보너스는 자리당 한 줄에 Q1·Q2 나란히.
 *  - R5 보드 내리기: 확인 시트 → 5초 되돌리기 토스트. H10: 결과 카드 미리보기 상시 노출 삭제(이미지 저장에서만).
 */
import type { ReactNode } from 'react';
import { Hand } from 'lucide-react';
import {
  type Assignment,
  type BoardEntry,
  type GameAction,
  type GameState,
  type GungCase,
  type RoundNo,
  activeSeats,
  displayCardId,
  gateRoundsShown,
  gateTimeline,
  getAllSheets,
  getRoundBoard,
  getSheet,
  GUIDE,
  timerMs,
  timerMinutes,
  guideText,
  parseRoomCode,
  placeCardById,
  publicBoardUpTo,
  publicSeat,
  publicSeats,
  reachedRound,
  resolveBriefing,
  resolveVerdict,
  resultOf,
  revealBeats,
  roleById,
  roundDef,
  rolesVisible,
  timeHint,
} from '@/lib/gung';
import {
  GateTimelineBar,
  GuButton,
  HostCue,
  IncenseTimer,
  RevealScroll,
  RoleIcon,
  RoomCode,
  RoundSteps,
  ScoreRow,
  SealStamp,
  SeatRing,
  ShareActions,
  TallyBars,
  VoteStepper,
} from '../components';
import type { GuTabKey, IncenseTimerValue, PalaceMapProps, ScoreMission, SectionKey } from '../components';
import { gateToView, seatRingItems } from './adapters';
import type { ConfirmRequest } from './Overlays';
import { DefenseFrame, GameFlow, isNoteLine, PublicCardList, PublicFold, TimeHintLine } from './Shared';
import { hostCaption, hostSignal, type HostSignalSub } from './signals';
import { MyCardTab } from './Tabs';
import { SceneView } from './SceneView';

/** §13 기본 진행 대본 — 사건 데이터 hostCue 가 있으면 그쪽이 이긴다(6판: 한 줄 ≤ 40자) */
export const HOST_CUE = {
  lobby: GUIDE.lobbyCue,
  briefing: '모두 귀를 기울이시오. 소리 내어 읽어주시오',
  cards: '각자 자기 패를 몰래 확인하시오. 남의 패를 엿보면 곤장이오',
  intro: GUIDE.introCue,
  select: GUIDE.selectCue,
  discuss: '밝힐 단서는 소리 내어 읽고 인장을 불러 주시오',
  defense: GUIDE.defenseCue,
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
  /** R2 궁 배치도 데이터(사건 부록) */
  map: Pick<PalaceMapProps, 'maps' | 'placeIcons' | 'note'>;
  /** R2 배치도만 담은 시트 열기 */
  onOpenMap: () => void;
  /** 6판 H2 — 「배치도 · 시각표 ›」 = 「?」 시트(없으면 배치도 시트) */
  onOpenHelp?: () => void;
  /** R5 인장 키패드 시트 열기 */
  onOpenSealPad: () => void;
  /** 통합: 「현장 다시 보기」 시트(고르기·토론 중 언제든) */
  onOpenScene?: () => void;
  /** R1 P1 — 한 번 연 칩 점(UI 상태) */
  seenSections?: Partial<Record<SectionKey, boolean>>;
  onSeenSection?: (section: SectionKey) => void;
}

/**
 * 타이머 자리 — 돌던 타이머가 있으면 향 막대, 없으면(단계 맞추기·방장 복구 직후: 엔진 hostSync 가 timer=null) "타이머 시작" 버튼.
 * QA BUG-07: 예전엔 타이머가 null 이면 영역 자체가 사라져 그 단계 시간을 잴 방법이 없었다.
 */
function TimerSlot({
  timerValue,
  onTimer,
  size,
  label,
  startLabel,
}: {
  timerValue: IncenseTimerValue | null;
  onTimer: HostAreaProps['onTimer'];
  size: 'stage' | 'compact' | 'mini';
  label: string;
  /** 시작 버튼 문구를 통째로(G2 「다 읽었소 → 고르기 2분 시작」) */
  startLabel?: string;
}) {
  if (timerValue) {
    return <IncenseTimer value={timerValue} size={size} onPause={() => onTimer('pause')} onResume={() => onTimer('resume')} onAdd30={() => onTimer('add30')} />;
  }
  // 진행(전진) 버튼은 액션바의 금색 하나뿐(§1-4) — 타이머 시작은 보조 버튼(취중 오탭으로 '토론 시작'과 헷갈리지 않게)
  return (
    <GuButton variant="secondary" onClick={() => onTimer('restart')}>
      {startLabel ?? `⏱ ${label} 타이머 시작`}
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
    return {
      body: (
        <MyCardTab
          sheet={sheet}
          seat={1}
          sealEpoch={props.sealEpoch}
          revealMode={props.revealMode}
          focus={props.cardFocus}
          hint={state.phase === 'cards' ? GUIDE.cardsMustSee : undefined}
          seen={props.seenSections}
          onSeen={props.onSeenSection}
        />
      ),
    };
  }

  const res = hostPhaseArea(props);
  // G1: 그 단계의 전진 버튼에만 「누르고 외치시오」 — 신호표는 플레이어 게이트와 같은 함수(signals.ts)
  const signal = hostSignal(state.phase, hostSignalSub(c, a, state));
  const withCaption = signal && res.actionBar ? { ...res, gateCaption: hostCaption(signal) } : res;
  // 통합: 현장 보기 하위 단계는 그림이 첫 화면에 들도록 타임라인을 맨 위가 아니라 공용 단서(출입 기록) 바로 아래에 둔다(hostScene)
  if (isSceneStep(state)) return withCaption;
  const timeline = hostGateTimeline(c, a, state);
  return timeline ? { ...withCaption, body: <>{timeline}{withCaption.body}</> } : withCaption;
}

function isSceneStep(state: GameState): boolean {
  return (state.phase === 'r1' || state.phase === 'r2' || state.phase === 'r3') && state.host?.roundSub === 'scene';
}

/** 방장 하위 상태 → 신호가 붙는 전진인가(signals.hostSignal) */
export function hostSignalSub(c: GungCase, a: Assignment, state: GameState): HostSignalSub {
  const host = state.host;
  if (!host) return null;
  switch (state.phase) {
    case 'r1':
    case 'r2':
    case 'r3':
      return host.roundSub === 'discuss' ? 'discuss' : 'select';
    case 'defense': {
      const d = host.defense;
      return !d || d.index >= d.order.length - 1 ? 'last' : 'next';
    }
    case 'vote': {
      const v = host.vote;
      if (!v || (v.sub !== 'tally' && v.sub !== 'final')) return 'pending';
      return resolveVerdict(v, activeSeats(a.n, host.absentSeats), a.culpritSeat).stage === 'decided' ? 'decided' : 'pending';
    }
    case 'reveal': {
      const beats = revealBeats(c);
      return beats[Math.min(host.revealIndex, beats.length - 1)]?.kind === 'culprit' ? 'culprit' : 'beat';
    }
    default:
      return null;
  }
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
      return host.roundSub === 'discuss' ? hostDiscuss(props) : host.roundSub === 'scene' ? hostScene(props) : hostSelect(props);
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

function hostLobby({ c, state, a, dispatch, onShareInvite }: HostAreaProps): HostAreaResult {
  const host = state.host!;
  const n = a.n;
  const room = parseRoomCode(state.code);
  const items = seatRingItems(n, { mode: 'rollcall', rollCall: host.rollCall });
  return {
    body: (
      <>
        <RoomCode code={state.code} compact n={n} tag={room?.tag} />
        <HostCue>{HOST_CUE.lobby}</HostCue>
        {/* 6판: 자리 칩은 선택(눌러 표시만) — 시작을 막지 않는다(「사건을 시작하겠소?」 확인 시트 삭제) */}
        <SeatRing n={n} mode="rollcall" items={items} onTapSeat={(seat) => seat !== 1 && dispatch({ type: 'rollCall', seat })} />
        <GameFlow c={c} n={n} />
        <GuButton variant="secondary" onClick={onShareInvite}>
          💬 초대 다시 보내기
        </GuButton>
      </>
    ),
    actionBar: (
      <GuButton variant="primary" onClick={() => dispatch({ type: 'advance' })}>
        사건 시작 →
      </GuButton>
    ),
  };
}

// ─────────────────────────────── H2 브리핑 ───────────────────────────────

function hostBriefing({ c, a, dispatch, stageScale, onToggleScale, onOpenMap, onOpenHelp }: HostAreaProps): HostAreaResult {
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
        {b.paragraphs.map((p, i) =>
          // 원고 6판 7-1: ※ 날짜 안내는 낭독하지 않고 화면 작은 글씨로
          isNoteLine(p) ? (
            <p key={i} className="gu-micro gu-briefing-note">
              {p}
            </p>
          ) : (
            <p key={i} className="gu-stagebody gu-briefing-p">
              {p}
            </p>
          ),
        )}
        <p className="gu-micro gu-text-right">약 {b.readMinutes}분 낭독</p>
        {/* 6판: 시각표·배치도 상시 노출 → 링크 한 줄(「?」 시트에 배치도·시각표·인물·용어가 다 있다) */}
        <button type="button" className="gu-ghostlink gu-center-self" onClick={onOpenHelp ?? onOpenMap}>
          {GUIDE.helpLink}
        </button>
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

function hostCards({ c, dispatch, onGoTab, timerValue, onTimer }: HostAreaProps): HostAreaResult {
  return {
    body: (
      <>
        <Hand aria-hidden size={64} className="gu-hero-icon" />
        <HostCue className="gu-hostcue--lg">{HOST_CUE.cards}</HostCue>
        {/* 6판: 큐 1줄 + 타이머. 안내 불릿·「자기소개 건너뛰기」(⋮ 메뉴로 옮김) 삭제 */}
        <TimerSlot timerValue={timerValue} onTimer={onTimer} size="stage" label={`패 확인 ${durationLabel(timerMs(c, 'cards'))}`} />
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
  };
}

// ─────────────────────────────── H4 자기소개 ───────────────────────────────

function hostIntro({ a, state, dispatch }: HostAreaProps): HostAreaResult {
  const host = state.host!;
  const active = activeSeats(a.n, host.absentSeats);
  const curIdx = active.indexOf(host.introCurrent);
  const done = curIdx > 0 ? active.slice(0, curIdx) : [];
  const items = seatRingItems(a.n, { mode: 'progress', current: host.introCurrent, done, absentSeats: host.absentSeats });
  return {
    body: (
      <>
        <HostCue>{HOST_CUE.intro}</HostCue>
        {/* 6판: 「다음 사람 →」 삭제 — 차례 표시는 원하면 자리 링을 눌러서(선택) */}
        <SeatRing n={a.n} mode="progress" items={items} onTapSeat={(seat) => dispatch({ type: 'introSet', seat })} />
        <p className="gu-micro gu-center">{GUIDE.introProfileLink}</p>
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

/** G2 무대 버튼 — 방장 본인 조사는 단서함에서. 고정 문구(골랐는지도 드러내지 않는다) */
function OwnClueLink({ onGoTab }: { onGoTab: HostAreaProps['onGoTab'] }) {
  return (
    <GuButton variant="secondary" onClick={() => onGoTab('clues')}>
      {GUIDE.hostOwnClueLink}
    </GuButton>
  );
}

/** R3 지난 라운드 공용 단서(접힘) — 이 폰이 들어선 라운드 전까지만 */
function PastPublic({ c, a, round }: { c: GungCase; a: Assignment; round: RoundNo }) {
  if (round <= 1) return null;
  const cards = publicBoardUpTo(c, a.n, round - 1);
  const summary = round - 1 === 1 ? guideText.publicPast(1).replace('1~1', '1') : guideText.publicPast(round - 1);
  return <PublicFold summary={summary} cards={cards} npcHeading={c.npcHeading ?? '추가 증언'} className="gu-fold--past" />;
}

/** 6판: 이번 조사 공용 단서(접힘) — 현장 보기에서 이미 읽었으니 고르기·토론에선 접어 둔다 */
function ThisRoundPublicFold({ c, a, round }: { c: GungCase; a: Assignment; round: RoundNo }) {
  const b = getRoundBoard(c, a.n, round);
  return <PublicFold summary={GUIDE.publicThisRound} cards={[...b.publicCards, ...b.npcCards]} npcHeading={b.npcHeading} className="gu-fold--round" />;
}

/** 6판 현장 화면 접힘 1곳 — 지난 공용 단서 + 시각 어림(고르기·토론 화면의 시각 어림 줄은 뺐다. 「?」 시각표에도 있다) */
function PastAndTimeFold({ c, a, round }: { c: GungCase; a: Assignment; round: RoundNo }) {
  const cards = round > 1 ? publicBoardUpTo(c, a.n, round - 1) : [];
  return (
    <details className="gu-fold gu-fold--past">
      <summary className="gu-fold-summary">{guideText.pastAndTime(round)}</summary>
      {cards.length > 0 && <PublicCardList cards={cards} npcHeading={c.npcHeading ?? '추가 증언'} />}
      <TimeHintLine text={timeHint(c)} />
    </details>
  );
}

/** R3 공용 단서 전체(접힘) — 변론·지목 준비 */
function AllPublic({ c, a, state }: { c: GungCase; a: Assignment; state: GameState }) {
  const cards = publicBoardUpTo(c, a.n, reachedRound(state.phase));
  return <PublicFold summary={GUIDE.publicAll} cards={cards} npcHeading={c.npcHeading ?? '추가 증언'} className="gu-fold--all" />;
}

/** 6판 조사 라운드 하위 단계 표시 — 현장 보기 → 장소 고르기 → 토론(분은 타이머 값) */
function HostRoundSteps({ c, current }: { c: GungCase; current: 'scene' | 'select' | 'discuss' }) {
  return (
    <RoundSteps
      label={GUIDE.roundStepsLabel}
      current={current}
      steps={[
        { key: 'scene', label: GUIDE.sceneLabel, minutes: timerMinutes(c, 'scene') },
        { key: 'select', label: '고르기', minutes: timerMinutes(c, 'select') },
        { key: 'discuss', label: '토론', minutes: timerMinutes(c, 'discuss') },
      ]}
    />
  );
}

function hostSelect(props: HostAreaProps): HostAreaResult {
  const { c, state, a, dispatch, timerValue, onTimer, onGoTab } = props;
  const round = roundOf(state);
  const cue = roundDef(c, round).hostCue?.select ?? HOST_CUE.select;
  return {
    body: (
      <>
        <HostRoundSteps c={c} current="select" />
        <HostCue>{cue}</HostCue>
        <TimerSlot timerValue={timerValue} onTimer={onTimer} size="compact" label="장소 고르기" startLabel={timerValue ? undefined : GUIDE.selectTimerStart} />
        <OwnClueLink onGoTab={onGoTab} />
        <ThisRoundPublicFold c={c} a={a} round={round} />
        <PastPublic c={c} a={a} round={round} />
        <SceneAgainLink onOpenScene={props.onOpenScene} />
        {round > 1 && <BoardPanel {...props} fold />}
      </>
    ),
    actionBar: (
      <GuButton variant="primary" onClick={() => dispatch({ type: 'advance' })}>
        토론 {durationLabel(timerMs(c, 'discuss'))} 시작 →
      </GuButton>
    ),
  };
}

/** 60_000 → '1분', 45_000 → '45초' */
function durationLabel(ms: number): string {
  return ms % 60_000 === 0 ? `${ms / 60_000}분` : `${Math.round(ms / 1000)}초`;
}

// ─────────────────────────────── H5a 조사 — 현장 보기(6판) ───────────────────────────────

/**
 * 현장 보기 무대 — 맨 위가 다 같이 보는 현장 그림(SceneView), 그 아래 이번 조사 공용 단서(낭독), 접힘 1곳(지난 공용 단서·시각 어림).
 * SceneView 는 역할 무관(사건·라운드·방 코드·공개 배치도만). idScope='host' — 그림 SVG id 가 렌더마다 같다(역할 무관 DOM 비교).
 * 방 코드는 본 물건(✓) 기록을 판마다 나누는 데만 쓰고 화면엔 그리지 않는다.
 */
function hostScene(props: HostAreaProps): HostAreaResult {
  const { c, state, a, dispatch, timerValue, onTimer, map } = props;
  const round = roundOf(state);
  const timeUp = Boolean(timerValue && timerValue.remainingMs <= 0);
  return {
    body: (
      <>
        <HostRoundSteps c={c} current="scene" />
        {/* 통합: 그림·관찰 카드가 첫 화면에 들도록 — 큐 한 줄 + 한 줄 타이머(현장 타이머는 조용한 조연) */}
        <HostCue className="gu-hostcue--line">{GUIDE.sceneCue}</HostCue>
        <TimerSlot timerValue={timerValue} onTimer={onTimer} size="mini" label={GUIDE.sceneLabel} />
        {/* 현장 타이머는 조용히 끝난다(징 없음) — 0:00 엔 이 한 줄만 */}
        {timeUp && <p className="gu-micro gu-center">{GUIDE.sceneTimerDone}</p>}
        <section className="gu-scene-slot" data-scene-slot="host" aria-label={GUIDE.sceneLabel}>
          <SceneView c={c} upTo={round} code={state.code} idScope="host" map={map} startAtNew />
        </section>
        <PublicBoard c={c} a={a} round={round} />
        {hostGateTimeline(c, a, state)}
        <PastAndTimeFold c={c} a={a} round={round} />
      </>
    ),
    actionBar: (
      <GuButton variant="primary" onClick={() => dispatch({ type: 'advance' })}>
        고르기 {durationLabel(timerMs(c, 'select'))} 시작 →
      </GuButton>
    ),
  };
}

/** 고르기·토론 화면 — 「현장 다시 보기」 시트 링크(현장은 공용 정보라 언제 다시 봐도 된다) */
function SceneAgainLink({ onOpenScene }: { onOpenScene?: () => void }) {
  if (!onOpenScene) return null;
  return (
    <button type="button" className="gu-ghostlink gu-center-self gu-scene-againlink" onClick={onOpenScene}>
      {GUIDE.sceneAgainLink}
    </button>
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
      <p className="gu-micro">{GUIDE.publicAlsoInPhones}</p>
    </div>
  );
}

/**
 * R5 공개 단서 보드 — 방장이 인장으로만 올린다(간편 모드 없음). 본문은 언제나 사건 데이터에서 다시 읽는다.
 * 라운드별 묶음(최신 라운드 펼침), 항목 머리 「조사 r · 장소 · 표시 id 제목」·본문 전문·「N번 공개」·내리기.
 * 이 폰이 들어선 라운드까지만 그린다(되돌리기·단계 맞추기로 뒤로 가면 그 뒤 라운드 항목은 숨는다).
 * 내용은 입력된 인장 순서로만 정해진다 — 방장 역할과 무관(불변 1). 숨김 표시는 어디에도 없다.
 */
function BoardPanel({ c, a, state, onToast, onOpenSealPad, dispatch, fold }: HostAreaProps & { fold?: boolean }) {
  const reached = reachedRound(state.phase);
  const entries: BoardEntry[] = (state.host?.board ?? []).filter((e) => e.round <= reached);
  const rounds = Array.from(new Set(entries.map((e) => e.round))).sort((x, y) => x - y);
  const latest = rounds[rounds.length - 1];
  const title = guideText.boardTitle(entries.length);
  const content = (
    <>
      {!entries.length && <p className="gu-muted">{GUIDE.boardEmpty}</p>}
      {rounds.map((r) => (
        <details key={r} className="gu-board-round" open={r === latest}>
          <summary className="gu-board-round-head">
            <span>
              조사 {r} · <span className="gu-num">{entries.filter((e) => e.round === r).length}</span>장
            </span>
          </summary>
          {entries
            .filter((e) => e.round === r)
            .map((e) => {
              const card = placeCardById(c, a.n, e.id);
              if (!card) return null;
              return (
                <article key={e.id} className="gu-board-item">
                  <p className="gu-board-item-head">
                    조사 {card.round} · {card.placeName} · <span className="gu-num">{displayCardId(card.id)}</span> {card.title}
                  </p>
                  <p className="gu-board-item-body">{card.body}</p>
                  <div className="gu-board-item-foot">
                    {e.seats.map((s) => (
                      <span key={s} className="gu-board-seat">
                        {guideText.boardSeat(s)}
                      </span>
                    ))}
                    <button
                      type="button"
                      className="gu-ghostlink gu-board-unpost"
                      onClick={() => {
                        // 6판: 확인 시트 대신 5초 되돌리기(같은 자리 기록으로 다시 올린다)
                        const seats = e.seats.slice();
                        dispatch({ type: 'unpostClue', id: e.id });
                        onToast(GUIDE.unpostToast, { label: '되돌리기', onClick: () => dispatch({ type: 'postClue', id: e.id, seats }) }, 5000);
                      }}
                    >
                      {GUIDE.unpost}
                    </button>
                  </div>
                </article>
              );
            })}
        </details>
      ))}
      <GuButton variant="secondary" onClick={onOpenSealPad}>
        {GUIDE.boardAdd}
      </GuButton>
      <p className="gu-micro">{GUIDE.boardFooter}</p>
    </>
  );
  return fold ? (
    <details className="gu-board gu-fold">
      <summary className="gu-fold-summary">{title} ▸</summary>
      {content}
    </details>
  ) : (
    <section className="gu-board" aria-label={title}>
      <p className="gu-board-title gu-display">{title}</p>
      {content}
    </section>
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
        <HostRoundSteps c={c} current="discuss" />
        <TimerSlot timerValue={timerValue} onTimer={onTimer} size="stage" label="토론" />
        <HostCue>{cue}</HostCue>
        {/* R1: 규칙만 상기 — 질문 주제는 제안하지 않는다 */}
        <p className="gu-askline">{GUIDE.discussAskLine}</p>
        <BoardPanel {...props} />
        <ThisRoundPublicFold c={c} a={a} round={round} />
        <PastPublic c={c} a={a} round={round} />
        <SceneAgainLink onOpenScene={props.onOpenScene} />
        <OwnClueLink onGoTab={onGoTab} />
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

function hostDefense(props: HostAreaProps): HostAreaResult {
  const { c, a, state, dispatch, timerValue, onTimer } = props;
  const host = state.host!;
  const d = host.defense ?? { order: [], index: 0 };
  const seat = d.order[d.index] ?? 1;
  const isLast = d.index >= d.order.length - 1;
  const showRoles = rolesVisible(c, state.phase);
  return {
    body: (
      <>
        <HostCue>{HOST_CUE.defense}</HostCue>
        <p className="gu-micro gu-center">지금 차례</p>
        <p className="gu-display gu-display-xl gu-center">{seatName(c, a, state, seat)}</p>
        <TimerSlot timerValue={timerValue} onTimer={onTimer} size="stage" label="변론" />
        <div className="gu-defense-chips" aria-label="변론 순서">
          {d.order.map((s, i) => {
            const ps = showRoles ? publicSeat(c, a, s) : null;
            return (
              <span key={s} className="gu-defense-chip" data-state={i < d.index ? 'done' : i === d.index ? 'current' : 'todo'}>
                {i < d.index ? '✓' : ''}
                {s}
                {/* R6: 자기소개 뒤엔 16px 역할 아이콘(텍스트 없이 — 6칩이 한 줄에) */}
                {ps && <RoleIcon iconKey={ps.icon} size={16} className="gu-defense-chip-icon" />}
              </span>
            );
          })}
        </div>
        <DefenseFrame />
        <AllPublic c={c} a={a} state={state} />
        <BoardPanel {...props} fold />
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
  const { c, a, state, dispatch, onStartCountdown, timerValue, onTimer } = props;
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
          <AllPublic c={c} a={a} state={state} />
          <BoardPanel {...props} fold />
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
  const hasBonus = Boolean(c.bonusQuestions && c.bonusQuestions.length > 0);
  const bonusFilled = bonusFilledCount(c, state, active);
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
        {!needsRevote && hasBonus && <BonusInput c={c} state={state} active={active} dispatch={dispatch} nameOf={nameOf} />}
        {/* 6판: 보너스 0개 확인 시트 대신 버튼 위 인라인 경고(막지 않는다) */}
        {decided && hasBonus && bonusFilled === 0 && (
          <p className="gu-sheet-warn gu-bonus-zero" role="status">
            {GUIDE.bonusZeroInline}
          </p>
        )}
      </>
    ),
    actionBar: needsRevote ? (
      <GuButton variant="primary" onClick={() => dispatch({ type: 'startRevote' })}>
        재지목 시작 →
      </GuButton>
    ) : (
      // 6판: 「진상을 공개하겠소?」 확인 시트 삭제 — 판결 확정 전엔 비활성, 잘못 넘겼으면 ↶
      <GuButton variant="primary" disabled={!decided} disabledReason="지목 집계를 마치시오" onClick={() => dispatch({ type: 'advance' })}>
        진상 공개 →
      </GuButton>
    ),
  };
}

/** 보너스 입력 수(활성 자리 × 문항) */
function bonusFilledCount(c: GungCase, state: GameState, active: number[]): number {
  const answers = state.host?.vote?.bonus ?? {};
  return (c.bonusQuestions ?? []).reduce((n, q) => n + active.filter((s) => answers[s]?.[q.id] !== undefined).length, 0);
}

/**
 * 보너스 문항 입력(원고 8-1·8-2: 범인 외 정답당 +1, 어의 미션 ② 판정 근거). 진상 공개 전에만 받는다(공개 뒤엔 답이 드러나므로).
 * 개선 묶음 1(R7): 접힌 '선택' 구역이 아니라 판결 확정 뒤 **펼친 단계**로 둔다 — 건너뛰면 '추리 게임'이 '범인 한 명 찍기'로 납작해진다.
 * 미션 이름은 쓰지 않는다(진상 전에 '어의 미션'이라 쓰면 비밀 미션 내용이 샌다).
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
  const filled = bonusFilledCount(c, state, active);
  const questions = c.bonusQuestions ?? [];
  // 6판: 문항별 자리 행(자리 × 문항 줄) → 문항 머리는 위에 한 번, 자리당 한 줄에 Q1·Q2 나란히(읽기·스크롤 1회)
  return (
    <section className="gu-bonus" aria-label={GUIDE.bonusHostHead}>
      <p className="gu-bonus-summary">
        {GUIDE.bonusHostHead} · <span className="gu-num">{filled}</span>개 입력됨
      </p>
      <p className="gu-micro">{GUIDE.bonusHostGuide}</p>
      <div className="gu-bonus-qheads">
        {questions.map((q, qi) => (
          <div key={q.id} className="gu-bonus-qhead">
            <p className="gu-bonus-prompt gu-display">
              <span className="gu-num">Q{qi + 1}</span> {q.prompt}
            </p>
            <ol className="gu-bonus-legend">
              {q.options.map((o, i) => (
                <li key={i}>
                  <span className="gu-num">{i + 1}</span> {o}
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
      <div className="gu-bonus-rows">
        {active.map((seat) => (
          <div key={seat} className="gu-bonus-row gu-bonus-row--compact">
            <span className="gu-bonus-who">{nameOf(seat)}</span>
            {questions.map((q, qi) => {
              const cur = answers[seat]?.[q.id];
              return (
                <span key={q.id} className="gu-bonus-opts" role="group" aria-label={`${nameOf(seat)} — ${q.prompt}`}>
                  <span className="gu-bonus-qtag gu-num" aria-hidden>
                    Q{qi + 1}
                  </span>
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
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </section>
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
              title: '범인을 바로 밝히겠소?',
              body: '남은 정황을 건너뛰고 범인 도장(자백)으로 가오. 판결은 그다음이오.',
              confirmLabel: '밝히겠소',
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
  const { c, a, state, dispatch, onShareResult, onCopyResult, resultCopied, onSaveImage } = props;
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
        {/* 6판: 결과 카드 미리보기 상시 노출 삭제 — 「이미지 저장」(ResultImageModal)에서만 본다 */}
        {result.decided ? (
          <>
            <ShareActions kind="result" onShare={onShareResult} onSaveImage={onSaveImage} onCopyLink={onCopyResult} copied={resultCopied} />
            <p className="gu-micro gu-center">{GUIDE.resultNoSpoiler}</p>
          </>
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
                title: GUIDE.sameCaseTitle,
                body: GUIDE.sameCaseBody,
                confirmLabel: GUIDE.sameCaseOk,
                danger: true,
                onConfirm: props.onNewRoom,
              })
            }
          >
            {GUIDE.sameCaseNewRoom}
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
