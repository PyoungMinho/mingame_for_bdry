"use client";

// 오후의 패 — 봇 데모 모드. 로컬 엔진을 구동해 봇 상대로 플레이하고 GameTableView로 렌더한다.
// 3라운드 세트 + 누적 벌점. 실시간(Supabase) 미설정 시 폴백.
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  startGame,
  nextRound,
  play,
  pass,
  playableAgainst,
  roundPenalty,
  cumulativeWithRound,
  isSetOver,
  type GameState,
  type Player,
} from "@/lib/pae/engine";
import { classify, canBeat, COMBO_KO } from "@/lib/pae/combos";
import { tileId, makeRng, type Tile } from "@/lib/pae/tiles";
import GameTableView from "@/components/pae/GameTableView";

const BOTS = ["준봇", "민봇", "수봇"];
const ME = 0;
// 봇 데모용 랜덤 멘트 — 채팅 말풍선이 살아있는 느낌을 준다.
const BOT_LINES = ["받아라!", "음…", "이거 어때?", "좋았어", "아 아까비", "가보자고", "패스~", "오~"];

function botAction(state: GameState): { type: "play"; tiles: Tile[] } | { type: "pass" } {
  const hand = state.hands[state.turn];
  const opts = playableAgainst(hand, state.lead);
  if (state.lead === null) {
    return { type: "play", tiles: [...opts].sort((a, b) => a.size - b.size || a.key - b.key)[0].tiles };
  }
  if (opts.length === 0) return { type: "pass" };
  return { type: "play", tiles: [...opts].sort((a, b) => a.key - b.key)[0].tiles };
}

export default function GameTable({ myName = "나", onExit }: { myName?: string; onExit?: () => void }) {
  const players = useMemo<Player[]>(
    () => [{ id: "me", name: myName }, ...BOTS.map((b, i) => ({ id: `b${i}`, name: b }))],
    [myName],
  );
  const [seed, setSeed] = useState(7);
  const [state, setState] = useState<GameState>(() => startGame(players, makeRng(7)));
  const [selected, setSelected] = useState<Tile[]>([]);
  const [shake, setShake] = useState(false);

  // 사라지는 채팅 말풍선 (봇 데모: 로컬 표시만, 저장·전송 없음)
  const [bubbles, setBubbles] = useState<{ seat: number; text: string; key: number }[]>([]);
  const bubbleKey = useRef(0);
  const addBubble = useCallback((seat: number, text: string) => {
    const key = ++bubbleKey.current;
    setBubbles((prev) => [...prev.filter((b) => b.seat !== seat), { seat, text, key }]);
    setTimeout(() => setBubbles((prev) => prev.filter((b) => b.key !== key)), 4000);
  }, []);
  const sendChat = useCallback(
    (text: string) => {
      const t = text.trim().slice(0, 40);
      if (t) addBubble(ME, t);
    },
    [addBubble],
  );

  // "다음 라운드" / "새 세트" — nextRound가 세트 진행을 관리.
  const restart = useCallback(() => {
    const s = seed + 101;
    setSeed(s);
    setState((prev) => nextRound(prev, makeRng(s)));
    setSelected([]);
  }, [seed]);

  useEffect(() => {
    if (state.phase !== "playing" || state.turn === ME) return;
    const botSeat = state.turn;
    const id = setTimeout(() => {
      const a = botAction(state);
      const r = a.type === "play" ? play(state, state.turn, a.tiles) : pass(state, state.turn);
      if (r.ok) {
        setState(r.state);
        if (Math.random() < 0.28) addBubble(botSeat, BOT_LINES[Math.floor(Math.random() * BOT_LINES.length)]);
      }
    }, 780);
    return () => clearTimeout(id);
  }, [state, addBubble]);

  const myHand = state.hands[ME];
  const myTurn = state.phase === "playing" && state.turn === ME;

  const playableIds = useMemo(() => {
    if (!myTurn) return null;
    const ids: string[] = [];
    for (const c of playableAgainst(myHand, state.lead)) for (const t of c.tiles) ids.push(tileId(t));
    return ids;
  }, [myHand, state.lead, myTurn]);

  const selCombo = selected.length ? classify(selected) : null;
  const canPlaySel = !!selCombo && (state.lead === null || canBeat(selCombo, state.lead.combo));

  const toggle = (t: Tile) => {
    if (!myTurn) return;
    setSelected((p) =>
      p.some((x) => tileId(x) === tileId(t)) ? p.filter((x) => tileId(x) !== tileId(t)) : [...p, t],
    );
  };
  const doPlay = () => {
    const r = play(state, ME, selected);
    if (r.ok) {
      setState(r.state);
      setSelected([]);
    } else {
      setShake(true);
      setTimeout(() => setShake(false), 400);
    }
  };
  const doPass = () => {
    const r = pass(state, ME);
    if (r.ok) setState(r.state);
  };

  return (
    <GameTableView
      playerNames={state.players.map((p) => p.name)}
      handCounts={state.hands.map((h) => h.length)}
      turn={state.turn}
      phase={state.phase}
      winner={state.winner}
      mySeat={ME}
      leadTiles={state.lead?.combo.tiles ?? null}
      leadLabel={state.lead ? COMBO_KO[state.lead.combo.type] : null}
      myHand={myHand}
      selectedIds={selected.map(tileId)}
      playableIds={playableIds}
      selLabel={selCombo ? COMBO_KO[selCombo.type] : null}
      canPlay={canPlaySel}
      myTurn={myTurn}
      noPlayable={!!playableIds && playableIds.length === 0 && !!state.lead}
      roundScores={state.phase === "ended" ? roundPenalty(state) : undefined}
      cumScores={state.phase === "ended" ? cumulativeWithRound(state) : undefined}
      setRound={state.setRound}
      isFinal={isSetOver(state)}
      shake={shake}
      onToggle={toggle}
      onPlay={doPlay}
      onPass={doPass}
      onRestart={restart}
      onExit={onExit}
      bubbles={bubbles}
      onSendChat={sendChat}
    />
  );
}
