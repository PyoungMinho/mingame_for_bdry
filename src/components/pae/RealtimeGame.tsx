"use client";

// 오후의 패 — 실시간 게임. useRoom의 서버 상태 + 본인 손패로 GameTableView를 렌더하고,
// 액션은 서버 권위 API로 보낸다. (상태는 부모 RealtimeRoom의 useRoom을 props로 공유)
import { useState } from "react";
import GameTableView from "@/components/pae/GameTableView";
import { playableAgainst } from "@/lib/pae/engine";
import { classify, canBeat, COMBO_KO } from "@/lib/pae/combos";
import { tileId, type Tile } from "@/lib/pae/tiles";
import type { UseRoom } from "@/lib/pae/useRoom";

export default function RealtimeGame({ room, code, onExit }: { room: UseRoom; code: string; onExit?: () => void }) {
  const [selected, setSelected] = useState<Tile[]>([]);
  const [shake, setShake] = useState(false);

  const pub = room.publicState!;
  const mySeat = pub.players.findIndex((p) => p.id === room.myUid);
  const myTurn = pub.phase === "playing" && pub.turn === mySeat;
  const lead = pub.lead;
  const myHand = room.myHand;
  const isHost = !!room.hostUid && !!room.myUid && room.hostUid === room.myUid;

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
    const err = await room.play(selected);
    if (err) {
      setShake(true);
      setTimeout(() => setShake(false), 400);
    } else {
      setSelected([]);
    }
  };
  const doPass = () => {
    room.pass();
  };
  const doHint = () => {
    const opts = playableAgainst(myHand, lead);
    if (opts.length) setSelected([...opts].sort((a, b) => a.size - b.size || a.key - b.key)[0].tiles);
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
      canPlay={canPlay}
      myTurn={myTurn}
      noPlayable={!!playableIds && playableIds.length === 0 && !!lead}
      roundScores={pub.scores}
      cumScores={pub.scores ? pub.cumulative.map((c, i) => c + (pub.scores as number[])[i]) : undefined}
      setRound={pub.setRound}
      isFinal={pub.phase === "ended" && pub.setRound >= 3}
      shake={shake}
      onRestart={isHost ? room.restart : undefined}
      onExit={onExit}
      onToggle={toggle}
      onPlay={doPlay}
      onPass={doPass}
      onHint={doHint}
    />
  );
}
