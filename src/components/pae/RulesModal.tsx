"use client";

// 오후의 패 — 게임 방법 & 족보 모달. 미니 타일로 조합을 시각화.
type Suit = "sun" | "moon" | "star" | "cloud";

function Mini({ n, suit }: { n: number; suit: Suit }) {
  return (
    <span className={`mini-tile ${suit}`}>
      <b>{n}</b>
      <svg viewBox="0 0 24 24"><use href={`#d-${suit}`} /></svg>
    </span>
  );
}

const COMBOS: { name: string; rank?: string; tiles: [number, Suit][]; desc: string }[] = [
  { name: "싱글", tiles: [[9, "sun"]], desc: "한 장. 더 강한 싱글로만 받음" },
  { name: "페어", tiles: [[9, "sun"], [9, "moon"]], desc: "같은 숫자 2장" },
  { name: "트리플", tiles: [[9, "sun"], [9, "moon"], [9, "star"]], desc: "같은 숫자 3장" },
  {
    name: "스트레이트",
    rank: "5장 · 가장 약함",
    tiles: [[3, "sun"], [4, "moon"], [5, "star"], [6, "cloud"], [7, "sun"]],
    desc: "연속 5장(색 무관). 최고 숫자로 비교, 11-15가 최강",
  },
  {
    name: "플러시",
    rank: "5장",
    tiles: [[3, "moon"], [6, "moon"], [9, "moon"], [11, "moon"], [14, "moon"]],
    desc: "같은 색 5장",
  },
  {
    name: "풀하우스",
    rank: "5장",
    tiles: [[9, "sun"], [9, "moon"], [9, "star"], [4, "sun"], [4, "cloud"]],
    desc: "트리플 + 페어. 트리플 숫자로 비교",
  },
  {
    name: "포카드",
    rank: "5장",
    tiles: [[7, "sun"], [7, "moon"], [7, "star"], [7, "cloud"], [3, "sun"]],
    desc: "같은 숫자 4장 + 아무 1장",
  },
  {
    name: "스트레이트 플러시",
    rank: "5장 · 최강",
    tiles: [[3, "sun"], [4, "sun"], [5, "sun"], [6, "sun"], [7, "sun"]],
    desc: "같은 색 연속 5장",
  },
];

export default function RulesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="rules-overlay" onClick={onClose}>
      <div className="rules-card" onClick={(e) => e.stopPropagation()}>
        <div className="rules-top">
          <h3>게임 방법 &amp; 족보</h3>
          <button className="rules-x" onClick={onClose} aria-label="닫기">✕</button>
        </div>

        <div className="rules-sec">
          <h4>🎯 목표</h4>
          <p>손에 든 타일을 <b>가장 먼저 다 내려놓으면 승리</b>. 라운드가 끝났을 때 남은 타일이 적을수록 점수가 좋아요.</p>
        </div>

        <div className="rules-sec">
          <h4>▶ 진행</h4>
          <p><b>구름3</b>을 가진 사람부터 시작해요. 자기 차례엔 <b>바닥패보다 강한 &lsquo;같은 장수&rsquo;의 조합</b>을 내거나 <b>패스</b>. 모두 패스해서 마지막에 낸 사람 차례가 돌아오면, 그 사람이 새 조합으로 다시 시작합니다. (패스해도 다음 차례에 또 낼 수 있어요.)</p>
        </div>

        <div className="rules-sec">
          <h4>⚖️ 강함 순서</h4>
          <p>색: <span className="ck sun">해</span> › <span className="ck moon">달</span> › <span className="ck star">별</span> › <span className="ck cloud">구름</span></p>
          <p>숫자: <b>3 ‹ 4 ‹ … ‹ 15 ‹ 1 ‹ 2</b> — <b>2가 가장 강해요</b></p>
        </div>

        <div className="rules-sec">
          <h4>🃏 조합 &amp; 족보 <span className="muted">(아래로 갈수록 강함)</span></h4>
          <div className="combo-list">
            {COMBOS.map((c) => (
              <div className="combo-row" key={c.name}>
                <div className="combo-head">
                  <span className="combo-name">{c.name}</span>
                  {c.rank && <span className="combo-rank">{c.rank}</span>}
                </div>
                <div className="combo-tiles">
                  {c.tiles.map(([n, s], i) => <Mini key={i} n={n} suit={s} />)}
                </div>
                <div className="combo-desc">{c.desc}</div>
              </div>
            ))}
          </div>
          <p className="muted small">※ 5장 족보끼리는 <b>스트레이트 ‹ 플러시 ‹ 풀하우스 ‹ 포카드 ‹ 스트레이트플러시</b> 순서로 강해요. 서로 <b>같은 장수의 조합만</b> 받을 수 있어요 (싱글은 싱글로, 5장은 5장으로).</p>
        </div>

        <button className="play rules-done" onClick={onClose}>알겠어요!</button>
      </div>
    </div>
  );
}
