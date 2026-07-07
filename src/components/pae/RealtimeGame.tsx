"use client";

// 오후의 패 — 실시간 게임. useRoom의 서버 상태 + 본인 손패로 GameTableView를 렌더하고,
// 액션은 서버 권위 API로 보낸다. (상태는 부모 RealtimeRoom의 useRoom을 props로 공유)
import { useState, useRef } from "react";
import GameTableView from "@/components/pae/GameTableView";
import { playableAgainst } from "@/lib/pae/engine";
import { classify, canBeat, COMBO_KO } from "@/lib/pae/combos";
import { tileId, type Tile } from "@/lib/pae/tiles";
import type { UseRoom } from "@/lib/pae/useRoom";

export default function RealtimeGame({ room, code, onExit }: { room: UseRoom; code: string; onExit?: () => void }) {
  const [selected, setSelected] = useState<Tile[]>([]);
  const [shake, setShake] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const submittingRef = useRef(false); // 광클(리렌더 전 연타) 동기 차단

  const fail = (err: string) => {
    setShake(true);
    setMsg(err);
    setTimeout(() => setShake(false), 400);
    setTimeout(() => setMsg(null), 2500);
  };

  const pub = room.publicState!;
  const mySeat = pub.players.findIndex((p) => p.id === room.myUid);
  const myTurn = pub.phase === "playing" && pub.turn === mySeat;
  const lead = pub.lead;
  const myHand = room.myHand;
  const isHost = !!room.hostUid && !!room.myUid && room.hostUid === room.myUid;

  // 레디: 접속(자리비움 제외) 참가자 중 준비 완료 수
  const myReady = room.members.find((m) => m.uid === room.myUid)?.ready ?? false;
  const activeMembers = room.members.filter((m) => !room.awaySeats.includes(m.seat));
  const readyCount = activeMembers.filter((m) => m.ready).length;
  const activeCount = activeMembers.length;

  const playableIds = myTurn
    ? (() => {
        const ids: string[] = [];
        for (const c of playableAgainst(myHand, lead)) for (const t of c.tiles) ids.push(tileId(t));
        return ids;
      })()
    : null;

  const selCombo = selected.length ? classify(selected) : null;
  const canPlay = !!selCombo && (lead === null || canBeat(selCombo, lead.combo));

  const toggle = (t: Tile) => {
    if (!myTurn) return;
    setSelected((p) => (p.some((x) => tileId(x) === tileId(t)) ? p.filter((x) => tileId(x) !== tileId(t)) : [...p, t]));
  };
  const doPlay = async () => {
    if (submittingRef.current) return; // 광클·중복 제출 차단(동기)
    submittingRef.current = true;
    setSubmitting(true);
    const err = await room.play(selected);
    submittingRef.current = false;
    setSubmitting(false);
    if (err) fail(err);
    else {
      setMsg(null);
      setSelected([]);
    }
  };
  const doPass = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    const err = await room.pass();
    submittingRef.current = false;
    setSubmitting(false);
    if (err) fail(err);
  };

  return (
    <GameTableView
      roomLabel={`방 ${code}`}
      playerNames={pub.players.map((p) => p.name)}
      handCounts={pub.handCounts}
      turn={pub.turn}
      phase={pub.phase}
      winner={pub.winner}
      mySeat={mySeat}
      leadTiles={lead?.combo.tiles ?? null}
      leadLabel={lead ? COMBO_KO[lead.combo.type] : null}
      myHand={myHand}
      selectedIds={selected.map(tileId)}
      playableIds={playableIds}
      selLabel={selCombo ? COMBO_KO[selCombo.type] : null}
      canPlay={canPlay && !submitting}
      myTurn={myTurn}
      statusNote={msg ?? undefined}
      noPlayable={!!playableIds && playableIds.length === 0 && !!lead}
      roundScores={pub.scores}
      cumScores={pub.scores ? pub.cumulative.map((c, i) => c + (pub.scores as number[])[i]) : undefined}
      setRound={pub.setRound}
      totalRounds={pub.totalRounds}
      isFinal={pub.phase === "ended" && pub.setRound >= pub.totalRounds}
      shake={shake}
      onRestart={isHost ? room.restart : undefined}
      onExit={onExit}
      onToggle={toggle}
      onPlay={doPlay}
      onPass={doPass}
      bubbles={room.bubbles}
      awaySeats={room.awaySeats}
      onSendChat={room.sendChat}
      onReady={room.sendReady}
      myReady={myReady}
      readyCount={readyCount}
      activeCount={activeCount}
    />
  );
}
