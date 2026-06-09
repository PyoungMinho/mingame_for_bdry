/**
 * dday.ts 유닛 테스트 — 수능 D-day & 일일 학습량 순수 헬퍼
 * 대상: daysUntil(), dateKey(), bumpDaily(), SUNEUNG 상수
 *
 * Date는 모두 로컬시간 생성자(new Date(y, m-1, d, ...))로 주입해 결정적으로 만든다.
 */
import { describe, it, expect } from "vitest";
import {
  daysUntil,
  dateKey,
  bumpDaily,
  bumpStreak,
  streakDisplay,
  SUNEUNG,
} from "@/lib/dday";

describe("daysUntil() — 남은 일수", () => {
  it("DD-01: 같은 날이면 0 (시각 무시)", () => {
    expect(daysUntil("2026-11-19", new Date(2026, 10, 19, 9, 0))).toBe(0);
  });
  it("DD-02: 하루 전이면 1", () => {
    expect(daysUntil("2026-11-19", new Date(2026, 10, 18, 23, 59))).toBe(1);
  });
  it("DD-03: 자정 직후도 날짜 기준으로 1", () => {
    expect(daysUntil("2026-11-19", new Date(2026, 10, 18, 0, 0))).toBe(1);
  });
  it("DD-04: 지난 뒤는 음수", () => {
    expect(daysUntil("2026-11-19", new Date(2026, 10, 20, 0, 0))).toBe(-1);
  });
  it("DD-05: 6월 9일 → 11월 19일 = 163일", () => {
    expect(daysUntil("2026-11-19", new Date(2026, 5, 9, 12, 0))).toBe(163);
  });
});

describe("SUNEUNG 상수", () => {
  it("DD-06: date는 YYYY-MM-DD 형식", () => {
    expect(SUNEUNG.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("DD-07: year는 4자리 학년도", () => {
    expect(SUNEUNG.year).toBeGreaterThanOrEqual(2026);
  });
});

describe("dateKey() — 로컬 날짜 키", () => {
  it("DK-01: 0패딩된 YYYY-MM-DD", () => {
    expect(dateKey(new Date(2026, 0, 3, 5))).toBe("2026-01-03");
  });
  it("DK-02: 두 자리 월/일", () => {
    expect(dateKey(new Date(2026, 11, 25, 23))).toBe("2026-12-25");
  });
});

describe("bumpDaily() — 일일 누적", () => {
  const now = new Date(2026, 5, 9, 10);
  it("BD-01: prev 없으면 오늘치로 시작", () => {
    expect(bumpDaily(null, 5, now)).toEqual({ date: "2026-06-09", solved: 5 });
  });
  it("BD-02: 같은 날이면 누적", () => {
    expect(bumpDaily({ date: "2026-06-09", solved: 5 }, 3, now)).toEqual({
      date: "2026-06-09",
      solved: 8,
    });
  });
  it("BD-03: 날짜가 바뀌면 리셋", () => {
    expect(bumpDaily({ date: "2026-06-08", solved: 20 }, 4, now)).toEqual({
      date: "2026-06-09",
      solved: 4,
    });
  });
  it("BD-04: 초기화 시 음수 add는 0으로 클램프", () => {
    expect(bumpDaily(null, -3, now).solved).toBe(0);
  });
});

describe("bumpStreak() — 연속 학습일 누적", () => {
  const now = new Date(2026, 5, 9, 10); // 2026-06-09

  it("BS-01: prev 없으면 1로 시작", () => {
    expect(bumpStreak(null, now)).toEqual({ lastDate: "2026-06-09", count: 1 });
  });
  it("BS-02: 오늘 이미 기록했으면 그대로(하루 한 번만)", () => {
    expect(bumpStreak({ lastDate: "2026-06-09", count: 3 }, now)).toEqual({
      lastDate: "2026-06-09",
      count: 3,
    });
  });
  it("BS-03: 어제 이어왔으면 +1", () => {
    expect(bumpStreak({ lastDate: "2026-06-08", count: 3 }, now)).toEqual({
      lastDate: "2026-06-09",
      count: 4,
    });
  });
  it("BS-04: 이틀 이상 비면 1로 리셋", () => {
    expect(bumpStreak({ lastDate: "2026-06-06", count: 9 }, now)).toEqual({
      lastDate: "2026-06-09",
      count: 1,
    });
  });
  it("BS-05: 월 경계도 어제로 인식(6/1 ← 5/31)", () => {
    const june1 = new Date(2026, 5, 1, 8);
    expect(bumpStreak({ lastDate: "2026-05-31", count: 5 }, june1)).toEqual({
      lastDate: "2026-06-01",
      count: 6,
    });
  });
  it("BS-06: 손상된 prev(count 0)도 최소 1 보장", () => {
    expect(bumpStreak({ lastDate: "2026-06-08", count: 0 }, now).count).toBe(2);
  });
});

describe("streakDisplay() — 화면 표시용 현재 연속일", () => {
  const now = new Date(2026, 5, 9, 10); // 2026-06-09

  it("SD-01: prev 없으면 0", () => {
    expect(streakDisplay(null, now)).toBe(0);
  });
  it("SD-02: 오늘 기록이면 그 값 유지", () => {
    expect(streakDisplay({ lastDate: "2026-06-09", count: 7 }, now)).toBe(7);
  });
  it("SD-03: 어제까지 이어졌으면 아직 살아있음(유지)", () => {
    expect(streakDisplay({ lastDate: "2026-06-08", count: 7 }, now)).toBe(7);
  });
  it("SD-04: 이틀 이상 비면 끊겨서 0", () => {
    expect(streakDisplay({ lastDate: "2026-06-06", count: 7 }, now)).toBe(0);
  });
});
