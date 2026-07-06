"use client";

// 오후의 패 — 게임 테이블 프레젠테이션 (봇 데모 / 실시간 공유). props만으로 렌더.
import { useState } from "react";
import type { Tile } from "@/lib/pae/tiles";
import RulesModal from "@/components/pae/RulesModal";

export interface TableViewProps {
  roomLabel?: string;
  playerNames: string[];
  handCounts: number[];
  turn: number;
  phase: "playing" | "ended";
  winner: number | null;
  mySeat: number;
  leadTiles: Tile[] | null;
  leadLabel: string | null;
  myHand: Tile[];
  selectedIds: string[];
  playableIds: string[] | null;
  selLabel: string | null;
  canPlay: boolean;
  myTurn: boolean;
  noPlayable: boolean;
  roundScores?: number[];
  cumScores?: number[];
  setRound?: number;
  isFinal?: boolean;
  shake?: boolean;
  statusNote?: string;
  bubbles?: { seat: number; text: string; key: number }[];
  awaySeats?: number[];
  onToggle: (t: Tile) => void;
  onPlay: () => void;
  onPass: () => void;
  onHint: () => void;
  onRestart?: () => void;
  onExit?: () => void;
  onSendChat?: (text: string) => void;
}

const RING = ["", "c1", "c2", "c3", "c1", "c2"];

function tid(t: Tile) {
  return `${t.suit}-${t.n}`;
}

export default function GameTableView(p: TableViewProps) {
  const [showRules, setShowRules] = useState(false);
  const [chatText, setChatText] = useState("");

  const bubbleOf = (seat: number) => p.bubbles?.find((b) => b.seat === seat)?.text ?? null;
  const send = () => {
    const t = chatText.trim();
    if (t && p.onSendChat) {
      p.onSendChat(t);
      setChatText("");
    }
  };

  const turnLabel =
    p.phase === "ended"
      ? "라운드 종료"
      : p.turn === p.mySeat
        ? "내 차례"
        : `${p.playerNames[p.turn] ?? ""} 차례`;

  return (
    <div className={`felt ${p.shake ? "shake" : ""}`}>
      <div className="top">
        <div className="brand">오후의 패 <b>牌</b></div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {typeof p.setRound === "number" && <span className="cnt">라운드 {p.setRound}/3</span>}
          {p.roomLabel && <span className="cnt">{p.roomLabel}</span>}
          <button className="ghost" onClick={() => setShowRules(true)}>족보</button>
          {p.onExit && <button className="ghost" onClick={p.onExit}>나가기</button>}
        </div>
      </div>

      <div className="opps">
        {p.playerNames.map((name, i) => {
          if (i === p.mySeat) return null;
          const away = p.awaySeats?.includes(i);
          return (
            <div key={i} className={`opp ${p.turn === i && p.phase === "playing" ? "now" : ""} ${away ? "away" : ""}`}>
              {bubbleOf(i) && <div className="bubble">{bubbleOf(i)}</div>}
              <div className={`ava ${RING[i] ?? ""}`}>{name[0]}</div>
              <div className="nm">{name}</div>
              <div className="cnt">{away ? "자리비움 · 자동진행" : `${p.handCounts[i]}장`}</div>
            </div>
          );
        })}
      </div>

      <div className="center">
        <div className={`turn ${p.turn === p.mySeat && p.phase === "playing" ? "mine" : ""}`}>{turnLabel}</div>
        {p.leadTiles ? (
          <div className="lead">
            <div className="lbl">바닥패 · {p.leadLabel}</div>
            <div className="row">{p.leadTiles.map((t) => <TileView key={tid(t)} tile={t} />)}</div>
          </div>
        ) : (
          <div className="lbl muted">{p.phase === "playing" ? "새 트릭 — 자유롭게 리드하세요" : ""}</div>
        )}
        {p.statusNote && <div className="lbl muted">{p.statusNote}</div>}
      </div>

      <div className="mine">
        <div className="mlbl">
          내 패 {p.myHand.length}장
          {p.myTurn && p.noPlayable ? " · 낼 수 있는 패가 없어요 (패스)" : ""}
        </div>
        <div className="hand">
          {p.myHand.map((t) => {
            const id = tid(t);
            const isSel = p.selectedIds.includes(id);
            const dim = !!p.playableIds && !p.playableIds.includes(id) && !isSel;
            return <TileView key={id} tile={t} raised={isSel} dim={dim} onClick={() => p.onToggle(t)} />;
          })}
        </div>
        <div className="acts">
          <button className="ghost" onClick={p.onHint} disabled={!p.myTurn}>힌트</button>
          <button className="pass" onClick={p.onPass} disabled={!p.myTurn || !p.leadTiles}>패스</button>
          <button className="play" onClick={p.onPlay} disabled={!p.myTurn || !p.canPlay}>
            {p.selLabel ? `${p.selLabel} 내기` : "내기"}
          </button>
        </div>
        {p.onSendChat && (
          <div className="chat-bar">
            {bubbleOf(p.mySeat) && <div className="bubble my-bubble">{bubbleOf(p.mySeat)}</div>}
            <input
              className="chat-input"
              value={chatText}
              maxLength={40}
              placeholder="채팅 (엔터로 전송)"
              onChange={(e) => setChatText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) send();
              }}
            />
            <button className="ghost" onClick={send}>보내기</button>
          </div>
        )}
      </div>

      {p.phase === "ended" && p.winner !== null && (
        <ResultOverlay
          playerNames={p.playerNames}
          handCounts={p.handCounts}
          winner={p.winner}
          mySeat={p.mySeat}
          roundScores={p.roundScores}
          cumScores={p.cumScores}
          setRound={p.setRound}
          isFinal={p.isFinal}
          onRestart={p.onRestart}
          onExit={p.onExit}
        />
      )}

      <RulesModal open={showRules} onClose={() => setShowRules(false)} />
    </div>
  );
}

function TileView({ tile, raised, dim, onClick }: { tile: Tile; raised?: boolean; dim?: boolean; onClick?: () => void }) {
  return (
    <button
      className={`tile ${tile.suit} ${raised ? "up" : ""} ${dim ? "dim" : ""}`}
      onClick={onClick}
      disabled={!onClick}
      aria-label={`${tile.n} ${tile.suit}`}
    >
      <span className="num">{tile.n}</span>
      <svg className="suit" viewBox="0 0 24 24"><use href={`#d-${tile.suit}`} /></svg>
    </button>
  );
}

function ResultOverlay({
  playerNames,
  handCounts,
  winner,
  mySeat,
  roundScores,
  cumScores,
  setRound,
  isFinal,
  onRestart,
  onExit,
}: {
  playerNames: string[];
  handCounts: number[];
  winner: number;
  mySeat: number;
  roundScores?: number[];
  cumScores?: number[];
  setRound?: number;
  isFinal?: boolean;
  onRestart?: () => void;
  onExit?: () => void;
}) {
  const rank = cumScores ?? handCounts;
  const rows = playerNames
    .map((name, i) => ({ name, left: handCounts[i], round: roundScores?.[i] ?? 0, cum: rank[i], i }))
    .sort((a, b) => a.cum - b.cum);

  const title = isFinal ? "🏆 세트 최종 등수" : `🏆 ${playerNames[winner]} 승리`;
  const sub = isFinal ? "3라운드 누적 · 낮을수록 1등" : setRound ? `라운드 ${setRound}/3 · 누적 벌점` : undefined;
  const restartLabel = isFinal ? "새 세트 시작" : "다음 라운드";

  return (
    <div className="overlay">
      <div className="card">
        <h3>{title}</h3>
        {sub && <div className="ov-sub">{sub}</div>}
        <table>
          <thead>
            <tr><th>순위</th><th>플레이어</th><th>이번</th><th>누적</th></tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={r.i} className={r.i === mySeat ? "me" : ""}>
                <td>{isFinal && idx === 0 ? "🥇" : idx + 1}</td>
                <td>{r.name}</td>
                <td className="ov-round">+{r.round}</td>
                <td className="ov-cum">{r.cum}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="ovbtns">
          {onExit && <button className="pass" onClick={onExit}>나가기</button>}
          {onRestart && <button className="play" onClick={onRestart}>{restartLabel}</button>}
        </div>
      </div>
    </div>
  );
}
