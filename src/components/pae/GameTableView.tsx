"use client";

// 오후의 패 — 게임 테이블 프레젠테이션 (봇 데모 / 실시간 공유).
// 상태 소스(로컬 엔진 or 서버)와 무관하게 props만으로 렌더한다.
import type { Tile } from "@/lib/pae/tiles";

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
  playableIds: string[] | null; // null = 내 차례 아님(딤 처리 안 함)
  selLabel: string | null; // 선택한 조합명 (없으면 null)
  canPlay: boolean;
  myTurn: boolean;
  noPlayable: boolean;
  scores?: number[];
  shake?: boolean;
  statusNote?: string; // 상대 차례 등 안내(실시간용)
  onToggle: (t: Tile) => void;
  onPlay: () => void;
  onPass: () => void;
  onHint: () => void;
  onRestart?: () => void;
  onExit?: () => void;
}

const RING = ["", "c1", "c2", "c3", "c1", "c2"]; // seat별 아바타 링 색

function tid(t: Tile) {
  return `${t.suit}-${t.n}`;
}

export default function GameTableView(p: TableViewProps) {
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
          {p.roomLabel && <span className="cnt">{p.roomLabel}</span>}
          {p.onRestart && <button className="ghost" onClick={p.onRestart}>새 게임</button>}
          {p.onExit && <button className="ghost" onClick={p.onExit}>나가기</button>}
        </div>
      </div>

      <div className="opps">
        {p.playerNames.map((name, i) =>
          i === p.mySeat ? null : (
            <div key={i} className={`opp ${p.turn === i && p.phase === "playing" ? "now" : ""}`}>
              <div className={`ava ${RING[i] ?? ""}`}>{name[0]}</div>
              <div className="nm">{name}</div>
              <div className="cnt">{p.handCounts[i]}장</div>
            </div>
          ),
        )}
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
      </div>

      {p.phase === "ended" && p.winner !== null && (
        <ResultOverlay
          playerNames={p.playerNames}
          handCounts={p.handCounts}
          winner={p.winner}
          mySeat={p.mySeat}
          scores={p.scores}
          onRestart={p.onRestart}
          onExit={p.onExit}
        />
      )}
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
  scores,
  onRestart,
  onExit,
}: {
  playerNames: string[];
  handCounts: number[];
  winner: number;
  mySeat: number;
  scores?: number[];
  onRestart?: () => void;
  onExit?: () => void;
}) {
  const rows = playerNames
    .map((name, i) => ({ name, left: handCounts[i], score: scores?.[i] ?? 0, i }))
    .sort((a, b) => a.left - b.left || b.score - a.score);
  return (
    <div className="overlay">
      <div className="card">
        <h3>🏆 {playerNames[winner]} 승리</h3>
        <table>
          <thead><tr><th>순위</th><th>플레이어</th><th>남은 패</th><th>점수</th></tr></thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={r.i} className={r.i === mySeat ? "me" : ""}>
                <td>{idx + 1}</td>
                <td>{r.name}</td>
                <td>{r.left}장</td>
                <td className={r.score >= 0 ? "pos" : "neg"}>{r.score > 0 ? `+${r.score}` : r.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="ovbtns">
          {onExit && <button className="pass" onClick={onExit}>나가기</button>}
          {onRestart && <button className="play" onClick={onRestart}>한 판 더</button>}
        </div>
      </div>
    </div>
  );
}
