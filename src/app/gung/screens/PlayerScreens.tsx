'use client';

/**
 * 플레이어 화면 P1~P10 (§3). 플레이어의 cards 단계(P3)는 T1 RoleCard를 본문에 직접 임베드한다.
 * GungApp이 GuFrame/게이트 캡션을 조립한다. PlayerPlayArea 는 훅 없는 순수 함수(본문/액션바 묶음)다 —
 * 본문과 액션바가 같이 쓰는 선택값(장소·지목 초안, 진상/모두의 패 보기 전환)은 GungApp 이 들고 내려준다.
 */
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  type Assignment,
  type GameAction,
  type GameState,
  type GungCase,
  type ResolvedSheet,
  type RoundNo,
  type RoundPick,
  getAllSheets,
  getClue,
  getSheet,
  parseRoomCode,
  publicSeat,
  publicSeats,
  reachedRound,
  resolveBriefing,
  rolesVisible,
  roundPlaces,
} from '@/lib/gung';
import { ClueCard, GuButton, MemoryBlock, PlaceGrid, RevealScroll, RoleIcon, RoundTagText, SealStamp, SeatGrid, ShareActions } from '../components';
import type { GuTabKey } from '../components';
import { useHoldReveal } from '../lib/useHoldReveal';
import { placeToSummary, sheetToContent } from './adapters';
import { roundEntryConfirm, roundSignal, type ConfirmRequest } from './Overlays';
import { MyCardTab } from './Tabs';

export interface PlayerAreaResult {
  body: ReactNode;
  actionBar?: ReactNode;
  actionSecondary?: ReactNode;
  gateCaption?: string;
  stageFullscreen?: boolean;
}

export interface PlayerAreaProps {
  c: GungCase;
  state: GameState;
  a: Assignment;
  sealEpoch: unknown;
  revealMode: 'hold' | 'tap';
  activeTab: GuTabKey;
  dispatch: (a: GameAction) => void;
  /** tag: 'pick:N' 등 — 그 되돌리기가 무효가 되면 GungApp 이 토스트를 거둔다 */
  onToast: (text: string, action?: { label: string; onClick: () => void }, duration?: number, tag?: string) => void;
  onConfirm: (req: ConfirmRequest) => void;
  onGoTab: (tab: GuTabKey) => void;
  /** P5 장소 초안(타일 선택 → ActionBar "○○ 조사하기") */
  draftPlace: string | null;
  setDraftPlace: (id: string | null) => void;
  /** P8 지목 초안(타일 선택 → ActionBar "N번 지목 확정") */
  draftVote: number | null;
  setDraftVote: (seat: number | null) => void;
  /** P9 진상 ↔ P10 모두의 패 */
  truthView: 'truth' | 'all';
  setTruthView: (v: 'truth' | 'all') => void;
  onShareGeneric: () => void;
  /** 내 패 탭을 「새 기억」 쪽부터 열기(알림 배너 → 내 패에서 보기) */
  cardFocus?: 'memory' | null;
}

/** 게이트 캡션 고정 문법(§2-C): "방장이 '{신호}'라고 외치면 누르세요" */
const gate = (signal: string) => `방장이 '${signal}'라고 외치면 누르세요`;

export function PlayerPlayArea(props: PlayerAreaProps): PlayerAreaResult {
  const { c, state, a, dispatch } = props;
  const seat = state.seat;
  // 라운드 잠금(원고 3판) — 서버가 없으니 "지금 라운드" = 이 폰의 로컬 진행 단계
  const sheet = getSheet(c, a, seat, reachedRound(state.phase));
  if (!sheet) return { body: <p className="gu-body">패를 읽지 못했소. 메뉴 › 자리 바꾸기로 자리를 확인하시오.</p> };

  if (props.activeTab === 'cards') {
    return { body: <MyCardTab sheet={sheet} seat={seat} sealEpoch={props.sealEpoch} revealMode={props.revealMode} focus={props.cardFocus} /> };
  }

  switch (state.phase) {
    case 'lobby': {
      const room = parseRoomCode(state.code);
      return {
        body: (
          <>
            <p className="gu-display">
              {seat}번 자리로 들었소
            </p>
            <p className="gu-body">
              사건 표식 「<span className="gu-gold">{room?.tag}</span>」 — 방장 화면과 같은지 보시오
            </p>
            <p className="gu-h3">오늘의 순서</p>
            <ol className="gu-plainlist gu-steps">
              <li>① 사건 개요 듣기</li>
              <li>② 내 패 몰래 보기</li>
              <li>③ 자기소개</li>
              <li>④ 조사 3번(장소 → 단서)</li>
              <li>⑤ 최종 변론</li>
              <li>⑥ 동시 지목 → 진상</li>
            </ol>
            <p className="gu-micro">자리 번호가 틀렸다면 ⋮ › 자리 바꾸기 · 늦게 왔다면 위쪽 기둥을 눌러 단계를 맞추시오</p>
          </>
        ),
        actionBar: (
          <GuButton variant="primary" onClick={() => dispatch({ type: 'advance' })}>
            사건 시작됐어요 →
          </GuButton>
        ),
        gateCaption: gate('사건을 시작하겠소'),
      };
    }
    case 'briefing': {
      const b = resolveBriefing(c, a.n);
      return {
        body: (
          <>
            <p className="gu-display">{b.heading}</p>
            {b.paragraphs.map((p, i) => (
              <p key={i} className="gu-body gu-briefing-p gu-briefing-p--private">
                {p}
              </p>
            ))}
          </>
        ),
        actionBar: (
          <GuButton variant="primary" onClick={() => dispatch({ type: 'advance' })}>
            내 패 확인하기 →
          </GuButton>
        ),
        gateCaption: gate('각자 자기 패를 몰래 보시오'),
      };
    }
    case 'cards':
      return {
        body: <MyCardTab sheet={sheet} seat={seat} sealEpoch={props.sealEpoch} revealMode={props.revealMode} />,
        actionBar: (
          <GuButton variant="primary" onClick={() => dispatch({ type: 'advance' })}>
            자기소개 시작됐어요 →
          </GuButton>
        ),
        gateCaption: gate('1번부터 신분을 밝히시오'),
      };
    case 'intro':
      return {
        body: (
          <>
            <p className="gu-display">
              내 차례: {seat}번째
            </p>
            <p className="gu-body">방장이 내 번호를 부르면, 아래를 꾹 눌러 &apos;신분&apos;을 사극 말투로 읽으시오</p>
            <PlayerIntroCard sheet={sheet} seat={seat} sealEpoch={props.sealEpoch} revealMode={props.revealMode} />
          </>
        ),
        actionBar: (
          // 조사 라운드 진입은 어떤 경로든 같은 확인(QA BUG-05) — 넘어가면 첫째 조사 장소·공용 단서가 풀린다
          <GuButton variant="primary" onClick={() => props.onConfirm(roundEntryConfirm(1, 'player', () => dispatch({ type: 'advance' })))}>
            1라운드 시작됐어요 →
          </GuButton>
        ),
        gateCaption: gate(roundSignal(1)),
      };
    case 'r1':
    case 'r2':
    case 'r3':
      return playerRound(props);
    case 'defense':
      return {
        body: (
          <>
            <p className="gu-display">최종 변론 · 1번부터 1분씩</p>
            <p className="gu-body">
              내 차례: {seat}번째
            </p>
            <p className="gu-h3">변론 준비</p>
            <div className="gu-row2">
              <GuButton variant="secondary" onClick={() => props.onGoTab('cards')}>
                🪪 내 패 다시 보기
              </GuButton>
              <GuButton variant="secondary" onClick={() => props.onGoTab('clues')}>
                📜 단서함
              </GuButton>
            </div>
          </>
        ),
        actionBar: (
          <GuButton variant="primary" onClick={() => dispatch({ type: 'advance' })}>
            지목 시작됐어요 →
          </GuButton>
        ),
        gateCaption: gate('지목하겠소'),
      };
    case 'vote':
      return playerVote(props);
    case 'reveal':
    case 'result':
      return props.truthView === 'all' ? playerAllSheets(props) : playerTruth(props, sheet);
    default:
      return { body: null };
  }
}

/** P4 — 신분 섹션 고정 봉인 카드(보기 방식 설정·재봉인 신호를 그대로 따른다) */
function PlayerIntroCard({ sheet, seat, sealEpoch, revealMode }: { sheet: ResolvedSheet; seat: number; sealEpoch: unknown; revealMode: 'hold' | 'tap' }) {
  const reveal = useHoldReveal(revealMode, `${String(sealEpoch)}-intro`);
  return (
    <div className="gu-introcard">
      <div
        {...reveal.pressBind}
        role="button"
        tabIndex={0}
        aria-pressed={reveal.open}
        aria-label={`${seat}번 자리의 신분 — ${revealMode === 'hold' ? '길게 누르는 동안 표시' : '탭하면 잠시 표시'}`}
        className="gu-sealed gu-sealed-surface"
        data-open={reveal.open || undefined}
        onContextMenu={(e) => e.preventDefault()}
      >
        {!reveal.open ? (
          <div className="gu-sealed-closed">
            <span className="gu-sealed-mark" style={{ ['--gu-hold-progress' as string]: reveal.holdProgress }} aria-hidden>
              봉
            </span>
            <p className="gu-sealed-hint">✋ {revealMode === 'hold' ? '꾹 누르고 있으면 보여요' : '탭하면 보여요'}</p>
          </div>
        ) : (
          <div className="gu-sealed-open">
            <div className="gu-sealed-paper">
              <p className="gu-display gu-hopae-rolename">{sheet.name}</p>
              <p className="gu-hopae-body">{sheet.profile}</p>
              {sheet.speech.slice(0, 2).map((s, i) => (
                <p key={i} className="gu-font-hand gu-speech-memo">
                  “{s}”
                </p>
              ))}
            </div>
            <p className="gu-sealed-release">{revealMode === 'hold' ? '✋ 손을 떼면 바로 가려져요' : '다시 탭하면 가려져요'}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function playerRound(props: PlayerAreaProps): PlayerAreaResult {
  const { c, state, a, dispatch, onToast, onConfirm, draftPlace, setDraftPlace } = props;
  const round = Number(state.phase[1]) as RoundNo;
  const pick: RoundPick | undefined = state.rounds[round];
  const nextLabel = round < 3 ? `${round + 1}라운드 시작됐어요 →` : '최종 변론 시작됐어요 →';
  const signal = round < 3 ? roundSignal((round + 1) as RoundNo) : '최종 변론이오';
  // QA BUG-05: 다음 조사 라운드로 넘어가면 그 라운드 장소 단서(와 「R3에 떠오르는 기억」)가 바로 풀린다 — 한 번 보면 못 되돌린다.
  // 취중 오탭 한 번으로 방장 신호 전에 풀리지 않게 확인 시트를 거친다. 진행 단계 맞추기(O1)도 같은 시트(roundEntryConfirm).
  // 문구는 모든 역할에 같다(역할 메타 누설 금지). 조사 3→최종 변론은 새로 풀리는 정보가 없어 1탭.
  const advanceGate = () => {
    if (round >= 3) {
      dispatch({ type: 'advance' });
      return;
    }
    onConfirm(roundEntryConfirm((round + 1) as RoundNo, 'player', () => dispatch({ type: 'advance' })));
  };

  if (!pick) {
    const places = roundPlaces(c, round).map((p) => placeToSummary(c, p.id));
    const chosen = places.find((p) => p.id === draftPlace);
    return {
      body: (
        <>
          <p className="gu-display">어디를 조사하겠소?</p>
          <p className="gu-body">한 라운드에 한 곳만. 단서를 열면 못 바꿔요.</p>
          <PlaceGrid places={places} selected={draftPlace} onSelect={(id) => setDraftPlace(id)} />
        </>
      ),
      actionBar: (
        <GuButton
          variant="primary"
          disabled={!chosen}
          disabledReason="장소를 고르시오"
          onClick={() => {
            if (!chosen) return;
            dispatch({ type: 'pickPlace', round, placeId: chosen.id });
            onToast(`${chosen.name}에 갔소`, { label: '되돌리기', onClick: () => dispatch({ type: 'unpickPlace', round }) }, 6000, `pick:${round}`);
          }}
        >
          {chosen ? `${chosen.name} 조사하기 →` : '장소를 고르시오'}
        </GuButton>
      ),
    };
  }

  return {
    body: (
      <>
        <PlayerClue
          c={c}
          a={a}
          round={round}
          pick={pick}
          seat={state.seat}
          dispatch={dispatch}
          onToast={onToast}
          sealEpoch={props.sealEpoch}
          revealMode={props.revealMode}
        />
        <p className="gu-micro">공개/비공개는 내 폰에만 남는 메모예요. 다른 폰으로 전송되지 않아요.</p>
      </>
    ),
    actionBar: (
      <GuButton variant="primary" onClick={advanceGate}>
        {nextLabel}
      </GuButton>
    ),
    gateCaption: gate(signal),
  };
}

function PlayerClue({
  c,
  a,
  round,
  pick,
  seat,
  dispatch,
  onToast,
  sealEpoch,
  revealMode,
}: {
  c: GungCase;
  a: Assignment;
  round: RoundNo;
  pick: RoundPick;
  seat: number;
  dispatch: (a: GameAction) => void;
  onToast: PlayerAreaProps['onToast'];
  sealEpoch: unknown;
  revealMode: 'hold' | 'tap';
}) {
  const reveal = useHoldReveal(revealMode, `${String(sealEpoch)}-${round}-clue`);
  useEffect(() => {
    if (reveal.open && !pick.opened) dispatch({ type: 'openClue', round });
  }, [reveal.open, pick.opened, round, dispatch]);
  const clue = getClue(c, a, round, pick.placeId, seat);
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

function playerVote(props: PlayerAreaProps): PlayerAreaResult {
  const { c, a, state, dispatch, onConfirm, draftVote, setDraftVote } = props;
  const showRoles = rolesVisible(c, state.phase);
  const revealGate = () =>
    onConfirm({
      title: '진상 공개로 넘어가겠소?',
      body: '방장이 진상을 밝히기 시작했을 때만 누르시오. 넘어가면 범인과 모두의 비밀이 보이오.',
      confirmLabel: '넘어가겠소',
      onConfirm: () => dispatch({ type: 'advance' }),
    });

  if (state.myVote) {
    const ps = publicSeat(c, a, state.myVote.seat);
    return {
      body: (
        <div className="gu-myvote">
          <p className="gu-body">나의 지목</p>
          <p className="gu-num gu-myvote-seat">{state.myVote.seat}번</p>
          {showRoles && ps && (
            <p className="gu-display gu-myvote-role">
              <RoleIcon iconKey={ps.icon} size={28} /> {ps.shortName}
            </p>
          )}
          <SealStamp text="확정" size={72} />
          <p className="gu-body">셋에 손가락으로도 가리키시오. 방장이 물으면 이 화면을 드시오.</p>
          <button
            type="button"
            className="gu-ghostlink gu-center-self"
            onClick={() =>
              onConfirm({
                title: '지목을 바꾸겠소?',
                body: '방장이 이미 적었다면 방장에게도 말하시오.',
                confirmLabel: '바꾸겠소',
                onConfirm: () => dispatch({ type: 'clearVote' }),
              })
            }
          >
            지목 바꾸기 ›
          </button>
        </div>
      ),
      actionBar: (
        <GuButton variant="primary" onClick={revealGate}>
          진상 공개 시작됐어요 →
        </GuButton>
      ),
      gateCaption: gate('그날 밤의 진상을 밝히겠소'),
    };
  }

  const items = publicSeats(c, a)
    .filter((s) => s.seat !== state.seat)
    .map((s) => ({ seat: s.seat, roleName: showRoles ? s.shortName : undefined, icon: showRoles ? s.icon : undefined }));
  return {
    body: (
      <>
        <p className="gu-display">범인이라 생각하는 자를 고르시오</p>
        <SeatGrid seats={items} selected={draftVote} onSelect={(s) => setDraftVote(s)} showRoles={showRoles} />
        <p className="gu-micro">내 자리({state.seat}번)는 목록에 없소. 고르면 확정 버튼을 누르시오.</p>
      </>
    ),
    actionBar: (
      <GuButton
        variant="primary"
        disabled={draftVote === null}
        disabledReason="지목할 사람을 고르시오"
        onClick={() => draftVote !== null && dispatch({ type: 'castVote', target: draftVote })}
      >
        {draftVote !== null ? `${draftVote}번 지목 확정 🔒` : '지목할 사람을 고르시오'}
      </GuButton>
    ),
    actionSecondary: (
      <button type="button" className="gu-ghostlink" onClick={revealGate}>
        폰 지목 없이 진상으로 ›
      </button>
    ),
  };
}

/** P9 — 진상 전문(비트 없이 한 번에) + 내 지목 적중 칩 + 모두의 패 + 다른 모임에 추천 */
function playerTruth(props: PlayerAreaProps, sheet: ResolvedSheet): PlayerAreaResult {
  const { c, a, state, setTruthView, onShareGeneric } = props;
  const culprit = publicSeat(c, a, a.culpritSeat);
  const mine = state.myVote?.seat;
  const hit = mine !== undefined && mine === a.culpritSeat;
  return {
    body: (
      <div className="gu-ptruth">
        {sheet.isCulprit && (
          <p className="gu-banner-inline gu-banner-inline--red">당신이 범인이었소. 판결(검거·도주)은 방장 화면을 보시오.</p>
        )}
        <div className="gu-ptruth-head">
          <SealStamp text="범인" size={56} />
          <p className="gu-display gu-display-xl">
            {a.culpritSeat}번 · {culprit?.shortName}
          </p>
        </div>
        {mine !== undefined && !sheet.isCulprit && (
          <p className="gu-votechip" data-hit={hit || undefined}>
            내 지목: {mine}번 {hit ? '✓ 적중' : '✗'}
          </p>
        )}
        <p className="gu-h3">그날 밤의 진상</p>
        <RevealScroll beats={c.truth.beats.map((b) => ({ time: b.time ?? '', text: b.text }))} index={c.truth.beats.length - 1} mode="all" />
        <p className="gu-ptruth-line gu-display">{c.truth.culpritLine}</p>
        <p className="gu-ptruth-confession">{c.truth.confession}</p>
        {/* 원고 7-2 순서: ④ 결말 → ⑤ 요약 */}
        {c.truth.epilogue && <p className="gu-ptruth-summary gu-ptruth-epilogue">{c.truth.epilogue}</p>}
        {c.truth.summary && <p className="gu-ptruth-summary">{c.truth.summary}</p>}
        <ShareActions kind="generic" onShare={onShareGeneric} />
        <p className="gu-micro gu-center">점수·결과 카드는 방장 폰에서 공유해요</p>
      </div>
    ),
    actionBar: (
      <GuButton variant="primary" onClick={() => setTruthView('all')}>
        모두의 패 보기 →
      </GuButton>
    ),
  };
}

/** P10 — 모두의 패(게임 종료 후라 봉인 없음). 아코디언, 첫 행만 펼침 */
function playerAllSheets(props: PlayerAreaProps): PlayerAreaResult {
  const { c, a, setTruthView } = props;
  const sheets = getAllSheets(c, a);
  return {
    body: (
      <>
        <p className="gu-display">모두의 패</p>
        <AllSheets sheets={sheets} />
      </>
    ),
    actionBar: (
      <GuButton variant="secondary" onClick={() => setTruthView('truth')}>
        ‹ 진상으로
      </GuButton>
    ),
  };
}

function AllSheets({ sheets }: { sheets: ResolvedSheet[] }) {
  const [openSeat, setOpenSeat] = useState<number | null>(sheets[0]?.seat ?? null);
  return (
    <div className="gu-allsheets">
      {sheets.map((sh) => {
        const isOpen = openSeat === sh.seat;
        const content = sheetToContent(sh, sh.seat);
        return (
          <section key={sh.seat} className="gu-allsheets-item" data-culprit={sh.isCulprit || undefined}>
            <button
              type="button"
              className="gu-allsheets-head"
              aria-expanded={isOpen}
              onClick={() => setOpenSeat(isOpen ? null : sh.seat)}
            >
              <span aria-hidden>{isOpen ? '▾' : '▸'}</span>
              <span className="gu-num">{sh.seat}번</span>
              <RoleIcon iconKey={sh.icon} size={20} />
              <span className="gu-allsheets-name">{sh.name}</span>
              {sh.isCulprit && <span className="gu-scorerow-culprit-chip">범인</span>}
            </button>
            {isOpen && (
              <div className="gu-allsheets-body gu-sealed-paper">
                <SheetBlock title="정체" body={content.identity} />
                <SheetBlock title="신분" body={content.profile} />
                <SheetBlock title="비밀" body={content.secret} />
                {content.memories?.map((m, i) => (
                  <div key={i} className="gu-allsheets-block">
                    <MemoryBlock memory={m} />
                  </div>
                ))}
                <div className="gu-allsheets-block">
                  <p className="gu-allsheets-title">그날 밤</p>
                  <ul className="gu-hopae-night">
                    {content.night.map((b, i) => (
                      <li key={i}>
                        <span className="gu-hopae-night-time">{b.time}</span>
                        <span>{b.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="gu-allsheets-block">
                  <p className="gu-allsheets-title">거짓말</p>
                  <ul className="gu-hopae-list">
                    {content.lies.map((l, i) => (
                      <li key={i}>
                        <RoundTagText text={l} current={content.round} />
                      </li>
                    ))}
                  </ul>
                </div>
                <SheetBlock title="미션" body={content.mission} />
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function SheetBlock({ title, body }: { title: string; body: string }) {
  if (!body) return null;
  return (
    <div className="gu-allsheets-block">
      <p className="gu-allsheets-title">{title}</p>
      <p className="gu-hopae-body">
        <RoundTagText text={body} current={3} />
      </p>
    </div>
  );
}
