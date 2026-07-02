// 오후의 패 — 입장 결정 로직 (순수 함수, 서버 라우트와 분리해 테스트 가능).
// 재접속(마운트마다 호출되는 join)에서 기존 참가자가 튕기지 않도록,
// "기존 참가자 통과"를 status·정원 체크보다 먼저 판정한다.

export interface JoinPlayer {
  uid: string;
  seat: number | null;
}

export type JoinDecision =
  | { action: "ok" } // 이미 입장한 참가자 — 재접속 허용, DB 변경 없음
  | { action: "insert"; seat: number } // 신규 참가자 — 이 seat으로 추가
  | { action: "reject"; reason: string };

/**
 * 입장 요청을 판정한다.
 *   1) 기존 참가자면 무조건 ok (재접속) — status·정원과 무관.
 *   2) 그 다음 status가 waiting이 아니면 reject.
 *   3) 정원이 찼으면 reject.
 *   4) 그 외 insert (seat = max(seat)+1, 빈 배열이면 0).
 */
export function resolveJoin(
  status: string,
  players: JoinPlayer[],
  uid: string,
  max: number,
): JoinDecision {
  if (players.some((p) => p.uid === uid)) return { action: "ok" };
  if (status !== "waiting") return { action: "reject", reason: "이미 시작된 방입니다" };
  if (players.length >= max) return { action: "reject", reason: "정원이 찼습니다" };
  return { action: "insert", seat: nextSeat(players) };
}

/** 남은 자리 중 다음 seat 번호 = max(seat)+1 (빈 방이면 0). seat 중복 방지. */
export function nextSeat(players: JoinPlayer[]): number {
  let maxSeat = -1;
  for (const p of players) {
    if (typeof p.seat === "number" && p.seat > maxSeat) maxSeat = p.seat;
  }
  return maxSeat + 1;
}
