// 오후의 패 — 셔플 공정성 실측. 실제 게임처럼 랜덤 시드로 대량 딜해서
// 특정 좌석/사람에게 2(최강 패)가 쏠리지 않는지 통계로 검증한다.
import { describe, it, expect } from "vitest";
import { deal, makeRng } from "@/lib/pae/tiles";

describe("셔플 공정성 — 2(최강 4장)가 쏠리지 않는가", () => {
  it("2의 좌석 분포가 균등하고, 한 명 몰림이 드물다 (5인 5000판)", () => {
    const N = 5000;
    const players = 5;
    const seatTwoTotal = new Array(players).fill(0);
    let threePlusGames = 0; // 한 명이 2를 3장 이상 가진 판
    let fourGames = 0; // 한 명이 2를 4장 다 가진 판

    for (let g = 0; g < N; g++) {
      const seed = Math.floor(Math.random() * 2 ** 31); // 실게임 start route와 동일
      const { hands } = deal(players, makeRng(seed));
      let maxTwo = 0;
      hands.forEach((h, seat) => {
        const c = h.filter((t) => t.n === 2).length;
        seatTwoTotal[seat] += c;
        if (c > maxTwo) maxTwo = c;
      });
      if (maxTwo >= 3) threePlusGames++;
      if (maxTwo >= 4) fourGames++;
    }

    const expected = (N * 4) / players; // 각 좌석 기대 2 개수 = 4000
    // eslint-disable-next-line no-console
    console.log("좌석별 2 총개수:", seatTwoTotal, "| 기대(균등):", expected);
    // eslint-disable-next-line no-console
    console.log(`한명이 2를 3장+ 가진 판: ${threePlusGames}/${N} (${((threePlusGames / N) * 100).toFixed(2)}%)`);
    // eslint-disable-next-line no-console
    console.log(`한명이 2를 4장 다 가진 판: ${fourGames}/${N} (${((fourGames / N) * 100).toFixed(3)}%)`);

    // 균등이면 각 좌석 편차 ±10% 이내여야 한다
    seatTwoTotal.forEach((c) => {
      expect(c).toBeGreaterThan(expected * 0.9);
      expect(c).toBeLessThan(expected * 1.1);
    });
    // 한 명이 4장 다 갖는 판은 이론상 ~0.005% — 1% 미만이어야 정상
    expect(fourGames / N).toBeLessThan(0.01);
  });

  it("각 숫자가 좌석별로 고르게 분배된다 (4인 3000판, 숫자별 좌석 표준편차 확인)", () => {
    const N = 3000;
    const players = 4;
    // number(1..13) × seat 카운트
    const grid: number[][] = Array.from({ length: 14 }, () => new Array(players).fill(0));
    for (let g = 0; g < N; g++) {
      const seed = Math.floor(Math.random() * 2 ** 31);
      const { hands } = deal(players, makeRng(seed));
      hands.forEach((h, seat) => h.forEach((t) => grid[t.n][seat]++));
    }
    // 각 숫자는 4장 → N판 총 4N개가 4좌석에 분배, 좌석당 기대 N
    for (let n = 1; n <= 13; n++) {
      const row = grid[n];
      row.forEach((c) => {
        expect(c).toBeGreaterThan(N * 0.9);
        expect(c).toBeLessThan(N * 1.1);
      });
    }
  });
});
