"use client";

/**
 * 플레이어 화면 P1~P10 (§3). 플레이어의 cards 단계(P3)는 T1 RoleCard를 본문에 직접 임베드한다.
 * GungApp이 GuFrame/게이트 캡션을 조립한다. PlayerPlayArea 는 훅 없는 순수 함수(본문/액션바 묶음)다 —
 * 본문과 액션바가 같이 쓰는 선택값(장소·지목 초안, 진상/모두의 패 보기 전환)은 GungApp 이 들고 내려준다.
 *
 * 개선 묶음 1
 *  - G1: 게이트 캡션 신호는 signals.ts(방장 캡션과 같은 함수).
 *  - G3: 자기소개 카드엔 역할명·공개 프로필만(말투 예시는 내 패 '말투' 섹션에만).
 *  - G5: 진상은 2단 — 대기 화면(범인·적중·본문 없음, 모든 역할 같은 DOM) → 확인 시트 → 진상 전문 → 모두의 패.
 *  - R2: 브리핑 아래 궁 배치도, 장소 고르기 위 「🗺 궁 배치도 보기」.
 *  - R3: 조사 화면 맨 위 「📢 이번 조사 공용 단서 ▸」(그 라운드 것만).
 *  - R5: 공개한 카드에 인장 번호 · 공개 토스트 · 장소 타일 「조사 N에 감」 · 고르기 위 안내.
 *  - R6: 변론 3칸 틀 + 수첩·단서함·내 패 바로가기. R7: 지목 확정 뒤에만 보너스 문항 참조 카드. M2: 모두 펼치기.
 *
 * 6판 진행 압축(docs/design/gung-compact-scene-spec.md §2)
 *  - P1 대기: 「오늘의 순서」 6줄 → 진행표(FlowStrip) + 한 줄. P2 개요: 규칙 넷 카드 + 「낭독문 전체 ▸」 접힘(방장이 읽는다).
 *  - P4 자기소개: 봉인 카드엔 이름·직함만(공개 프로필 전문은 「?」 › 인물).
 *  - 조사 게이트 확인 시트는 **잠금 기억이 풀리는 라운드(데이터 memories.fromRound — 이 사건은 조사 3)** 에만. 조사 1·2는 1탭.
 *  - P5 장소 고르기 안내 한 줄. P7 변론 「변론 준비」·「내 차례」 줄 삭제. P8 지목 → 진상 게이트·지목 바꾸기·보너스 열기 확인 시트 삭제.
 *  - P9 진상: 결론(≤ 200자) + 「진상 전문 ▸」 접힘. 말투 예시는 게임 뒤 '모두의 패'에서만.
 *
 * 7판(조사 따로 — PM 결정 「이동만 같이, 조사는 각자」)
 *  - 조사 화면(장소를 고르기 전) 맨 위 = 살펴보기(ExaminePanel): 그 조사 이동 장소 그림 + 물건 이름표, 라운드당 2번. 본 것은 이 폰에만.
 *  - 그 아래 「흩어져 한 곳만 뒤지시오」 장소 고르기. 장소를 확정하면 남은 살펴보기는 사라진다(6초 되돌리기 안에선 되살아난다).
 *  - 장소를 고른 뒤엔 단서 카드 아래 「내가 본 관찰 · 조사 N」(탭해 보기 + 자동 가림). 단서함에도 같은 목록.
 *  - 역할과 무관하게 같은 구조 — 사건·조사·이 폰의 살펴본 기록만 쓴다.
 */
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
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
  getRoundBoard,
  getSheet,
  GUIDE,
  guideText,
  examineLeft,
  observationsIn,
  parseRoomCode,
  publicSeat,
  publicSeats,
  reachedRound,
  recheckRoundBetween,
  resolveBriefing,
  rolesVisible,
  roundPlaces,
  timerMs,
} from "@/lib/gung";
import {
  ClueCard,
  GuButton,
  MemoryBlock,
  PlaceGrid,
  RevealScroll,
  RoleIcon,
  RoundTagText,
  SealStamp,
  SeatGrid,
  ShareActions,
  circledNum,
} from "../components";
import type { GuTabKey, PalaceMapProps, SectionKey } from "../components";
import { useHoldReveal } from "../lib/useHoldReveal";
import { placeToSummary, sheetToContent } from "./adapters";
import { roundEntryConfirm, type ConfirmRequest } from "./Overlays";
import {
  BonusReference,
  DefenseFrame,
  GameFlow,
  isNoteLine,
  PublicFold,
} from "./Shared";
import { gateCaption, gateSignal } from "./signals";
import { MyCardTab } from "./Tabs";
import { ExaminePanel, ObservationList } from "./ExaminePanel";

/** G5: 'wait' = 진상 대기(범인 없음) · 'truth' = 진상 전문 · 'all' = 모두의 패 */
export type TruthView = "wait" | "truth" | "all";

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
  revealMode: "hold" | "tap";
  activeTab: GuTabKey;
  dispatch: (a: GameAction) => void;
  /** tag: 'pick:N' 등 — 그 되돌리기가 무효가 되면 GungApp 이 토스트를 거둔다 */
  onToast: (
    text: string,
    action?: { label: string; onClick: () => void },
    duration?: number,
    tag?: string,
  ) => void;
  onConfirm: (req: ConfirmRequest) => void;
  onGoTab: (tab: GuTabKey) => void;
  /** P5 장소 초안(타일 선택 → ActionBar "○○ 조사하기") */
  draftPlace: string | null;
  setDraftPlace: (id: string | null) => void;
  /** P8 지목 초안(타일 선택 → ActionBar "N번 지목 확정") */
  draftVote: number | null;
  setDraftVote: (seat: number | null) => void;
  /** P9-0 진상 대기 ↔ P9 진상 ↔ P10 모두의 패 */
  truthView: TruthView;
  setTruthView: (v: TruthView) => void;
  onShareGeneric: () => void;
  /** 내 패 탭을 「새 기억」 쪽부터 열기(알림 배너 → 내 패에서 보기) */
  cardFocus?: "memory" | null;
  /** R2 궁 배치도 데이터 */
  map: Pick<PalaceMapProps, "maps" | "placeIcons" | "note">;
  onOpenMap: () => void;
  /** R5 장소 카드 id → 인장 */
  sealOf: (cardId: string) => number | null;
  /** R1 P1 — 한 번 연 칩 점(UI 상태) */
  seenSections?: Partial<Record<SectionKey, boolean>>;
  onSeenSection?: (section: SectionKey) => void;
}

/** 게이트 캡션 — 신호는 signals.ts 단일 출처(G1) */
const gate = (phase: GameState["phase"]) => {
  const sig = gateSignal(phase);
  return sig ? gateCaption(sig) : undefined;
};

/**
 * 조사 라운드 게이트 — 넘어가면 잠금 기억(「R3에 떠오르는 기억」)이 풀리는 라운드일 때만 확인 시트(QA BUG-05 유지).
 * 판정은 데이터(memories.fromRound)로만 — 역할·자리 무관(모든 폰이 같은 시트를 받는다). 그 밖의 라운드는 1탭(6판).
 */
function roundGate(
  c: GungCase,
  from: number,
  to: RoundNo,
  onConfirm: PlayerAreaProps["onConfirm"],
  go: () => void,
): () => void {
  return () => {
    if (recheckRoundBetween(c, from, to) === null) return go();
    onConfirm(roundEntryConfirm(to, "player", go));
  };
}

/** 60_000 → '1분', 45_000 → '45초' */
function durationLabel(ms: number): string {
  return ms % 60_000 === 0 ? `${ms / 60_000}분` : `${Math.round(ms / 1000)}초`;
}

/** 브리핑 규칙 줄(원고 7-1 「하나~넷」) */
const RULE_LINE = /^(하나|둘|셋|넷|다섯)\./;

export function PlayerPlayArea(props: PlayerAreaProps): PlayerAreaResult {
  const { c, state, a, dispatch } = props;
  const seat = state.seat;
  // 라운드 잠금(원고 3판) — 서버가 없으니 "지금 라운드" = 이 폰의 로컬 진행 단계
  const sheet = getSheet(c, a, seat, reachedRound(state.phase));
  if (!sheet)
    return {
      body: (
        <p className="gu-body">
          패를 읽지 못했소. 메뉴 › 자리 바꾸기로 자리를 확인하시오.
        </p>
      ),
    };

  if (props.activeTab === "cards") {
    return {
      body: (
        <MyCardTab
          sheet={sheet}
          seat={seat}
          sealEpoch={props.sealEpoch}
          revealMode={props.revealMode}
          focus={props.cardFocus}
          hint={state.phase === "cards" ? GUIDE.cardsMustSee : undefined}
          seen={props.seenSections}
          onSeen={props.onSeenSection}
        />
      ),
    };
  }

  switch (state.phase) {
    case "lobby": {
      const room = parseRoomCode(state.code);
      return {
        body: (
          <>
            <p className="gu-display">{seat}번 자리로 들었소</p>
            <p className="gu-body">
              사건 표식 「<span className="gu-gold">{room?.tag}</span>」 —{" "}
              {GUIDE.lobbyPlayer}
            </p>
            {/* 6판: 「오늘의 순서」 6줄 → 진행표(분은 타이머 상수에서) */}
            <GameFlow c={c} n={a.n} />
            <p className="gu-micro">{GUIDE.lobbyPlayerMicro}</p>
          </>
        ),
        actionBar: (
          <GuButton
            variant="primary"
            onClick={() => dispatch({ type: "advance" })}
          >
            사건 시작됐어요 →
          </GuButton>
        ),
        gateCaption: gate("lobby"),
      };
    }
    case "briefing": {
      const b = resolveBriefing(c, a.n);
      // 6판: 방장이 낭독하니 플레이어는 규칙 넷만 카드로, 낭독문 전체는 접힘(같은 글 — 정보는 그대로)
      const rules = b.paragraphs.filter((p) => RULE_LINE.test(p.trim()));
      const notes = b.paragraphs.filter(isNoteLine);
      const paragraphs = b.paragraphs.map((p, i) => (
        <p
          key={i}
          className={
            isNoteLine(p)
              ? "gu-micro gu-briefing-note"
              : "gu-body gu-briefing-p gu-briefing-p--private"
          }
        >
          {p}
        </p>
      ));
      return {
        body: (
          <>
            <p className="gu-display">{b.heading}</p>
            {rules.length > 0 ? (
              <>
                <p className="gu-body">{GUIDE.briefingPlayerLine}</p>
                <section
                  className="gu-rulecard"
                  aria-label={GUIDE.briefingRulesHead}
                >
                  <p className="gu-rulecard-title">
                    {GUIDE.briefingRulesHead}
                  </p>
                  {rules.map((p, i) => (
                    <p key={i} className="gu-rulecard-line">
                      {p}
                    </p>
                  ))}
                </section>
                {notes.map((p, i) => (
                  <p key={i} className="gu-micro gu-briefing-note">
                    {p}
                  </p>
                ))}
                <details className="gu-fold gu-fold--briefing">
                  <summary className="gu-fold-summary">
                    {GUIDE.briefingFold}
                  </summary>
                  {paragraphs}
                </details>
              </>
            ) : (
              paragraphs
            )}
            {/* R2: 배치도는 큰 시트로(플레이어 뷰 2-1 — 블라인드 검증 때와 같은 정보) */}
            <button
              type="button"
              className="gu-ghostlink gu-maplink"
              onClick={props.onOpenMap}
            >
              {GUIDE.mapLink}
            </button>
          </>
        ),
        actionBar: (
          <GuButton
            variant="primary"
            onClick={() => dispatch({ type: "advance" })}
          >
            내 패 확인하기 →
          </GuButton>
        ),
        gateCaption: gate("briefing"),
      };
    }
    case "cards":
      return {
        body: (
          <MyCardTab
            sheet={sheet}
            seat={seat}
            sealEpoch={props.sealEpoch}
            revealMode={props.revealMode}
            hint={GUIDE.cardsMustSee}
            seen={props.seenSections}
            onSeen={props.onSeenSection}
          />
        ),
        actionBar: (
          <GuButton
            variant="primary"
            onClick={() => dispatch({ type: "advance" })}
          >
            자기소개 시작됐어요 →
          </GuButton>
        ),
        gateCaption: gate("cards"),
      };
    case "intro":
      return {
        body: (
          <>
            <p className="gu-display">내 차례: {seat}번째</p>
            <p className="gu-body">{GUIDE.introPlayer}</p>
            <PlayerIntroCard
              sheet={sheet}
              seat={seat}
              sealEpoch={props.sealEpoch}
              revealMode={props.revealMode}
            />
          </>
        ),
        actionBar: (
          // 6판: 조사 1 진입은 1탭(풀리는 잠금 기억이 없다). 확인 여부는 데이터로만 — roundGate
          <GuButton
            variant="primary"
            onClick={roundGate(c, 0, 1, props.onConfirm, () =>
              dispatch({ type: "advance" }),
            )}
          >
            1라운드 시작됐어요 →
          </GuButton>
        ),
        gateCaption: gate("intro"),
      };
    case "r1":
    case "r2":
    case "r3":
      return playerRound(props);
    case "defense":
      return {
        body: (
          <>
            <p className="gu-display">
              {guideText.defenseHead(durationLabel(timerMs(c, "defense")))}
            </p>
            {/* R6: 무대와 같은 3칸 틀(입력칸 없음) — 범인도 같은 틀로 말한다. 6판: 「변론 준비」·「내 차례」 줄 삭제 */}
            <DefenseFrame />
            <div className="gu-row3">
              <GuButton
                variant="secondary"
                onClick={() => props.onGoTab("notes")}
              >
                {GUIDE.notesShortcut}
              </GuButton>
              <GuButton
                variant="secondary"
                onClick={() => props.onGoTab("clues")}
              >
                📜 단서함
              </GuButton>
              <GuButton
                variant="secondary"
                onClick={() => props.onGoTab("cards")}
              >
                🪪 내 패
              </GuButton>
            </div>
          </>
        ),
        actionBar: (
          <GuButton
            variant="primary"
            onClick={() => dispatch({ type: "advance" })}
          >
            지목 시작됐어요 →
          </GuButton>
        ),
        gateCaption: gate("defense"),
      };
    case "vote":
      return playerVote(props);
    case "reveal":
    case "result":
      if (props.truthView === "all") return playerAllSheets(props);
      // G5: reveal 단계의 첫 화면은 대기 — 방장 낭독(범인 비트)보다 먼저 탁자 위 폰에 범인이 뜨지 않게
      if (props.truthView === "wait" && state.phase === "reveal")
        return playerTruthWait(props);
      return playerTruth(props, sheet);
    default:
      return { body: null };
  }
}

/**
 * P4 — 신분 섹션 고정 봉인 카드(보기 방식 설정·재봉인 신호를 그대로 따른다).
 * 6판: 이름 + 직함 한 줄만(자기소개 1인 약 10초). 공개 프로필 전문은 「?」 › 인물(자기소개 뒤 모두에게 같은 목록), 내 패 '신분'.
 * 말투 예시는 블라인드 검증에 들어가지 않은 정보 경로라 자기소개에서 읽지 않는다(G3) — 게임 뒤 '모두의 패'에만 남는다.
 */
function PlayerIntroCard({
  sheet,
  seat,
  sealEpoch,
  revealMode,
}: {
  sheet: ResolvedSheet;
  seat: number;
  sealEpoch: unknown;
  revealMode: "hold" | "tap";
}) {
  const reveal = useHoldReveal(revealMode, `${String(sealEpoch)}-intro`);
  return (
    <div className="gu-introcard">
      <div
        {...reveal.pressBind}
        role="button"
        tabIndex={0}
        aria-pressed={reveal.open}
        aria-label={`${seat}번 자리의 신분 — ${revealMode === "hold" ? "길게 누르는 동안 표시" : "탭하면 잠시 표시"}`}
        className="gu-sealed gu-sealed-surface"
        data-open={reveal.open || undefined}
        onContextMenu={(e) => e.preventDefault()}
      >
        {!reveal.open ? (
          <div className="gu-sealed-closed">
            <span
              className="gu-sealed-mark"
              style={{ ["--gu-hold-progress" as string]: reveal.holdProgress }}
              aria-hidden
            >
              봉
            </span>
            <p className="gu-sealed-hint">
              ✋{" "}
              {revealMode === "hold"
                ? "꾹 누르고 있으면 보여요"
                : "탭하면 보여요"}
            </p>
          </div>
        ) : (
          <div className="gu-sealed-open">
            <div className="gu-sealed-paper">
              <p className="gu-display gu-hopae-rolename">{sheet.name}</p>
              {sheet.subtitle && (
                <p className="gu-hopae-body gu-intro-subtitle">
                  {sheet.subtitle}
                </p>
              )}
            </div>
            <p className="gu-sealed-release">
              {revealMode === "hold"
                ? "✋ 손을 떼면 바로 가려져요"
                : "다시 탭하면 가려져요"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/** R3 — 이 조사의 공용 단서·추가 증언(접힘). 그 라운드 것만(지난 라운드·다음 라운드 없음) */
function ThisRoundPublic({
  c,
  a,
  round,
}: {
  c: GungCase;
  a: Assignment;
  round: RoundNo;
}) {
  const b = getRoundBoard(c, a.n, round);
  return (
    <PublicFold
      summary={GUIDE.publicThisRound}
      cards={[...b.publicCards, ...b.npcCards]}
      npcHeading={b.npcHeading}
      className="gu-fold--round"
    />
  );
}

function playerRound(props: PlayerAreaProps): PlayerAreaResult {
  const {
    c,
    state,
    a,
    dispatch,
    onToast,
    onConfirm,
    draftPlace,
    setDraftPlace,
  } = props;
  const round = Number(state.phase[1]) as RoundNo;
  const pick: RoundPick | undefined = state.rounds[round];
  const nextLabel =
    round < 3 ? `${round + 1}라운드 시작됐어요 →` : "최종 변론 시작됐어요 →";
  // QA BUG-05: 다음 조사 라운드로 넘어가면 그 라운드 장소 단서(와 「R3에 떠오르는 기억」)가 바로 풀린다 — 한 번 보면 못 되돌린다.
  // 6판: 확인 시트는 잠금 기억이 풀리는 라운드(데이터로 판정 — 이 사건은 조사 3)에만. 문구는 모든 역할에 같다(역할 메타 누설 금지).
  // 진행 단계 맞추기(O1)는 예전처럼 모든 조사 진입에 같은 시트(roundEntryConfirm). 조사 3→최종 변론은 1탭.
  const go = () => dispatch({ type: "advance" });
  const advanceGate =
    round >= 3 ? go : roundGate(c, round, (round + 1) as RoundNo, onConfirm, go);

  if (!pick) {
    const places = roundPlaces(c, round).map((p) => placeToSummary(c, p.id));
    const chosen = places.find((p) => p.id === draftPlace);
    const left = examineLeft(c, state.examined, round);
    return {
      body: (
        <>
          {/* 7판: 다 같이 옮겨 온 장소의 물건을 각자 살펴본다(이 폰에만). 방장 화면엔 그림·장소 이름만 */}
          <ExaminePanel
            c={c}
            round={round}
            log={state.examined}
            closed={false}
            onExamine={(objectId) => dispatch({ type: "examine", round, objectId })}
            sealEpoch={props.sealEpoch}
            idScope="player"
          />
          <ThisRoundPublic c={c} a={a} round={round} />
          <p className="gu-placehint">{GUIDE.placeHint}</p>
          <button
            type="button"
            className="gu-ghostlink gu-maplink"
            onClick={props.onOpenMap}
          >
            {GUIDE.mapLink}
          </button>
          <PlaceGrid
            places={places}
            selected={draftPlace}
            onSelect={(id) => setDraftPlace(id)}
            tags={visitedTags(state, round)}
          />
          {left > 0 && <p className="gu-micro gu-examine-closenote">{GUIDE.examineCloseNote}</p>}
        </>
      ),
      actionBar: (
        <GuButton
          variant="primary"
          disabled={!chosen}
          disabledReason="장소를 고르시오"
          onClick={() => {
            if (!chosen) return;
            dispatch({ type: "pickPlace", round, placeId: chosen.id });
            onToast(
              `${chosen.name}에 갔소`,
              {
                label: "되돌리기",
                onClick: () => dispatch({ type: "unpickPlace", round }),
              },
              6000,
              `pick:${round}`,
            );
          }}
        >
          {chosen ? `${chosen.name} 조사하기 →` : "장소를 고르시오"}
        </GuButton>
      ),
    };
  }

  return {
    body: (
      <>
        <ThisRoundPublic c={c} a={a} round={round} />
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
          sealOf={props.sealOf}
        />
        <p className="gu-micro">{GUIDE.clueMicro}</p>
        {/* 7판: 이번 조사에 내가 본 관찰(탭해 보기 + 자동 가림) — 단서함에도 같은 목록 */}
        <ObservationList
          observations={observationsIn(c, state.examined, round)}
          sealEpoch={props.sealEpoch}
          heading={`${GUIDE.obsHead} · 조사 ${round}`}
        />
      </>
    ),
    actionBar: (
      <GuButton variant="primary" onClick={advanceGate}>
        {nextLabel}
      </GuButton>
    ),
    gateCaption: gate(state.phase),
  };
}

/** R5 — 내 지난 방문 꼬리표(이 폰 기록만. 남이 많이 간 곳 같은 집계는 없다) */
function visitedTags(state: GameState, round: RoundNo): Record<string, string> {
  const tags: Record<string, string> = {};
  for (const r of [1, 2, 3] as RoundNo[]) {
    if (r >= round) break;
    const p = state.rounds[r];
    if (p?.placeId)
      tags[p.placeId] = tags[p.placeId]
        ? `${tags[p.placeId]} · ${guideText.visitedTag(r)}`
        : guideText.visitedTag(r);
  }
  return tags;
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
  sealOf,
}: {
  c: GungCase;
  a: Assignment;
  round: RoundNo;
  pick: RoundPick;
  seat: number;
  dispatch: (a: GameAction) => void;
  onToast: PlayerAreaProps["onToast"];
  sealEpoch: unknown;
  revealMode: "hold" | "tap";
  sealOf: PlayerAreaProps["sealOf"];
}) {
  const reveal = useHoldReveal(
    revealMode,
    `${String(sealEpoch)}-${round}-clue`,
  );
  useEffect(() => {
    if (reveal.open && !pick.opened) dispatch({ type: "openClue", round });
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
      seal={pick.disclosure === "public" ? sealOf(clue.id) : null}
      onDisclose={(value) => {
        dispatch({ type: "disclose", round, value });
        if (value === "public")
          onToast(
            guideText.sealToast(sealOf(clue.id)),
            {
              label: "되돌리기",
              onClick: () => dispatch({ type: "undoDisclose", round }),
            },
            5000,
          );
      }}
    />
  );
}

function playerVote(props: PlayerAreaProps): PlayerAreaResult {
  const { c, a, state, dispatch, draftVote, setDraftVote } = props;
  const showRoles = rolesVisible(c, state.phase);
  // 6판: 지목 → 진상 게이트 확인 시트 삭제 — 다음 화면(G5 진상 대기)은 범인을 보여 주지 않는다. 범인 보기 시트는 그대로.
  const revealGate = () => dispatch({ type: "advance" });

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
          <p className="gu-body">
            셋에 손가락으로도 가리키시오. 방장이 물으면 이 화면을 드시오.
          </p>
          <VoteAfterConfirm
            questions={c.bonusQuestions ?? []}
            onClear={() => dispatch({ type: "clearVote" })}
          />
        </div>
      ),
      actionBar: (
        <GuButton variant="primary" onClick={revealGate}>
          진상 공개 시작됐어요 →
        </GuButton>
      ),
      gateCaption: gate("vote"),
    };
  }

  const items = publicSeats(c, a)
    .filter((s) => s.seat !== state.seat)
    .map((s) => ({
      seat: s.seat,
      roleName: showRoles ? s.shortName : undefined,
      icon: showRoles ? s.icon : undefined,
    }));
  return {
    body: (
      <>
        {/* 원고 8-1 투표 화면 문구 + 작은 글씨(규칙 1) */}
        <p className="gu-display">{GUIDE.votePrompt}</p>
        <p className="gu-micro">{GUIDE.voteNote}</p>
        <SeatGrid
          seats={items}
          selected={draftVote}
          onSelect={(s) => setDraftVote(s)}
          showRoles={showRoles}
        />
        <GuButton variant="secondary" onClick={() => props.onGoTab("notes")}>
          {GUIDE.notesShortcut}
        </GuButton>
      </>
    ),
    actionBar: (
      <GuButton
        variant="primary"
        disabled={draftVote === null}
        disabledReason="지목할 사람을 고르시오"
        onClick={() =>
          draftVote !== null &&
          dispatch({ type: "castVote", target: draftVote })
        }
      >
        {draftVote !== null
          ? `${draftVote}번 지목 확정 🔒`
          : "지목할 사람을 고르시오"}
      </GuButton>
    ),
    actionSecondary: (
      <button type="button" className="gu-ghostlink" onClick={revealGate}>
        폰 지목 없이 진상으로 ›
      </button>
    ),
  };
}

/**
 * P9-0 진상 대기(G5) — 범인·적중 여부·진상 본문·'모두의 패' 버튼이 모두 없다. 모든 역할(범인 포함)에서 DOM 이 같다
 * (내 지목 숫자만 다름). 방장이 범인 도장 비트에서 「범인이 밝혀졌소」를 외치면 → 확인 시트 → P9.
 */
/**
 * 지목 확정 뒤: 「지목 바꾸기」 또는 「보너스 문항 보기」(연 뒤엔 지목 변경 불가 — 보너스로 범인 판단이 흔들리지 않게).
 * 6판: 두 확인 시트를 없앴다 — 지목은 로컬·되돌릴 수 있고, 보너스 잠금은 버튼 옆 한 줄로 알린다.
 */
function VoteAfterConfirm({
  questions,
  onClear,
}: {
  questions: NonNullable<GungCase["bonusQuestions"]>;
  onClear: () => void;
}) {
  const [bonusOpen, setBonusOpen] = useState(false);
  if (bonusOpen) return <BonusReference questions={questions} />;
  return (
    <>
      <button
        type="button"
        className="gu-ghostlink gu-center-self"
        onClick={onClear}
      >
        지목 바꾸기 ›
      </button>
      {questions.length > 0 && (
        <>
          <button
            type="button"
            className="gu-ghostlink gu-center-self"
            onClick={() => setBonusOpen(true)}
          >
            보너스 문항 보기 ›
          </button>
          <p className="gu-micro gu-center">{GUIDE.bonusOpenNote}</p>
        </>
      )}
    </>
  );
}

function playerTruthWait(props: PlayerAreaProps): PlayerAreaResult {
  const { state, onConfirm, setTruthView } = props;
  const mine = state.myVote?.seat;
  return {
    body: (
      <div className="gu-ptruth gu-ptruth-wait">
        <p className="gu-display">{GUIDE.truthWaitTitle}</p>
        <p className="gu-body">{GUIDE.truthWaitBody}</p>
        {mine !== undefined && (
          <p className="gu-votechip">{guideText.myVoteChip(mine)}</p>
        )}
      </div>
    ),
    actionBar: (
      <GuButton
        variant="primary"
        onClick={() =>
          onConfirm({
            title: GUIDE.truthConfirmTitle,
            body: GUIDE.truthConfirmBody,
            confirmLabel: GUIDE.truthConfirmOk,
            onConfirm: () => setTruthView("truth"),
          })
        }
      >
        {GUIDE.truthWaitButton}
      </GuButton>
    ),
    gateCaption: gate("reveal"),
  };
}

/** P9 — 진상 전문(비트 없이 한 번에) + 내 지목 적중 칩 + 모두의 패 + 다른 모임에 추천 */
function playerTruth(
  props: PlayerAreaProps,
  sheet: ResolvedSheet,
): PlayerAreaResult {
  const { c, a, state, setTruthView, onShareGeneric } = props;
  const culprit = publicSeat(c, a, a.culpritSeat);
  const mine = state.myVote?.seat;
  const hit = mine !== undefined && mine === a.culpritSeat;
  return {
    body: (
      <div className="gu-ptruth">
        {sheet.isCulprit && (
          <p className="gu-banner-inline gu-banner-inline--red">
            당신이 범인이었소. 판결(검거·도주)은 방장 화면을 보시오.
          </p>
        )}
        <div className="gu-ptruth-head">
          <SealStamp text="범인" size={56} />
          <p className="gu-display gu-display-xl">
            {a.culpritSeat}번 · {culprit?.shortName}
          </p>
        </div>
        {mine !== undefined && !sheet.isCulprit && (
          <p className="gu-votechip" data-hit={hit || undefined}>
            내 지목: {mine}번 {hit ? "✓ 적중" : "✗"}
          </p>
        )}
        {/* 6판: 낭독은 이미 들었다 — 결론(원고 7-2 ⑤ 요약)만 펼치고, 전문(비트·자백·결말)은 접힘 */}
        {c.truth.summary && (
          <>
            <p className="gu-h3">{GUIDE.truthConclusion}</p>
            <p className="gu-ptruth-summary">{c.truth.summary}</p>
          </>
        )}
        <details className="gu-fold gu-ptruth-full" open={!c.truth.summary}>
          <summary className="gu-fold-summary">{GUIDE.truthFullFold}</summary>
          <RevealScroll
            beats={c.truth.beats.map((b) => ({
              time: b.time ?? "",
              text: b.text,
            }))}
            index={c.truth.beats.length - 1}
            mode="all"
          />
          <p className="gu-ptruth-line gu-display">{c.truth.culpritLine}</p>
          <p className="gu-ptruth-confession">{c.truth.confession}</p>
          {/* 원고 7-2 순서: ④ 결말(→ ⑤ 요약은 위 결론) */}
          {c.truth.epilogue && (
            <p className="gu-ptruth-summary gu-ptruth-epilogue">
              {c.truth.epilogue}
            </p>
          )}
        </details>
        <ShareActions kind="generic" onShare={onShareGeneric} />
        <p className="gu-micro gu-center">
          점수·결과 카드는 방장 폰에서 공유해요
        </p>
      </div>
    ),
    actionBar: (
      <GuButton variant="primary" onClick={() => setTruthView("all")}>
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
      <GuButton variant="secondary" onClick={() => setTruthView("truth")}>
        ‹ 진상으로
      </GuButton>
    ),
  };
}

function AllSheets({ sheets }: { sheets: ResolvedSheet[] }) {
  const [openSeats, setOpenSeats] = useState<number[]>(
    sheets[0] ? [sheets[0].seat] : [],
  );
  const allOpen =
    sheets.length > 0 && sheets.every((sh) => openSeats.includes(sh.seat));
  const toggle = (seat: number) =>
    setOpenSeats((o) =>
      o.includes(seat) ? o.filter((x) => x !== seat) : [...o, seat],
    );
  return (
    <div className="gu-allsheets">
      {/* M2: 게임이 끝난 뒤의 화면이라 노출 위험이 없다 */}
      <button
        type="button"
        className="gu-ghostlink gu-allsheets-toggle"
        onClick={() => setOpenSeats(allOpen ? [] : sheets.map((sh) => sh.seat))}
      >
        {allOpen ? GUIDE.collapseAll : GUIDE.expandAll}
      </button>
      {sheets.map((sh) => {
        const isOpen = openSeats.includes(sh.seat);
        const content = sheetToContent(sh, sh.seat);
        return (
          <section
            key={sh.seat}
            className="gu-allsheets-item"
            data-culprit={sh.isCulprit || undefined}
          >
            <button
              type="button"
              className="gu-allsheets-head"
              aria-expanded={isOpen}
              onClick={() => toggle(sh.seat)}
            >
              <span aria-hidden>{isOpen ? "▾" : "▸"}</span>
              <span className="gu-num">{sh.seat}번</span>
              <RoleIcon iconKey={sh.icon} size={20} />
              <span className="gu-allsheets-name">{sh.name}</span>
              {sh.isCulprit && (
                <span className="gu-scorerow-culprit-chip">범인</span>
              )}
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
                  <ul className="gu-hopae-list gu-numlist">
                    {content.lies.map((l, i) => (
                      <li key={i}>
                        <span className="gu-numitem-mark" aria-hidden>
                          {circledNum(i + 1)}
                        </span>
                        <span>
                          <RoundTagText text={l} current={content.round} />
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                {content.speech.length > 0 && (
                  // 6판: 말투 예시는 게임이 끝난 뒤 여기서만(내 패 칩에서 뺐다)
                  <div className="gu-allsheets-block">
                    <p className="gu-allsheets-title">{GUIDE.speechSection}</p>
                    <ul className="gu-hopae-list">
                      {content.speech.map((sp, i) => (
                        <li key={i} className="gu-font-hand">
                          “{sp}”
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {content.mission.length > 0 && (
                  <div className="gu-allsheets-block">
                    <p className="gu-allsheets-title">미션</p>
                    <ul className="gu-hopae-list gu-numlist">
                      {content.mission.map((m, i) => (
                        <li key={i}>
                          <span className="gu-numitem-mark" aria-hidden>
                            {circledNum(i + 1)}
                          </span>
                          <span>{m}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
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
