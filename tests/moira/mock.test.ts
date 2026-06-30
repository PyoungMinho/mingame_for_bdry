/**
 * mock.ts — 데모 정본 데이터 무결성 (설계서 §2-8).
 *
 * times↔MEMBERS 정합, 추천역이 실제로 가장 공평한지, DB CHECK 계약(minutes>0 등).
 */
import { describe, it, expect } from "vitest";
import {
  MEMBERS,
  PLACES,
  RECOMMENDED_STATION,
  APPOINTMENT,
} from "@/lib/moira/mock";
import { fairLevel } from "@/lib/moira/fairness";

const CATEGORIES = new Set(["호프·포차", "전통시장", "칼국수", "카페·전시", "북카페"]);
const MEMBER_NAMES = ["민호", "서연", "지훈", "예린"];

// result/route.ts와 동일 공식(α=0.4,β=0.4,γ=0.2, 모표준편차)
function stddevPop(xs: number[]): number {
  const m = xs.reduce((s, x) => s + x, 0) / xs.length;
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length);
}
function scoreOf(mins: number[]): number {
  const avg = mins.reduce((s, x) => s + x, 0) / mins.length;
  return 0.4 * avg + 0.4 * Math.max(...mins) + 0.2 * stddevPop(mins);
}
function gapOfMins(mins: number[]): number {
  return Math.max(...mins) - Math.min(...mins);
}

describe("mock — MEMBERS (§2-8)", () => {
  it("MK-01: MEMBERS.length === 4", () => {
    expect(MEMBERS).toHaveLength(4);
  });
  it("MK-02: host 단일(id=me, name=민호)", () => {
    const hosts = MEMBERS.filter((m) => m.status === "host");
    expect(hosts).toHaveLength(1);
    expect(hosts[0].id).toBe("me");
    expect(hosts[0].name).toBe("민호");
  });
  it("MK-03: avatar hex 형식 /^#[0-9A-F]{6}$/i", () => {
    for (const m of MEMBERS) expect(m.avatar).toMatch(/^#[0-9A-F]{6}$/i);
  });
  it("MK-04: id 유일성", () => {
    const ids = MEMBERS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("mock — PLACES (§2-8)", () => {
  it("MK-05: PLACES.length === 5", () => {
    expect(PLACES).toHaveLength(5);
  });
  it("MK-06: times↔MEMBERS 정합 — 각 place times 4개, 이름 순서 일치", () => {
    for (const p of PLACES) {
      expect(p.times).toHaveLength(4);
      expect(p.times.map((t) => t.name)).toEqual(MEMBER_NAMES);
    }
  });
  it("MK-07: place id 유일성", () => {
    const ids = PLACES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("MK-08: 모든 minutes > 0 (DB CHECK minutes>0 계약)", () => {
    for (const p of PLACES) for (const t of p.times) expect(t.minutes).toBeGreaterThan(0);
  });
  it("MK-09: 모든 transfers >= 0", () => {
    for (const p of PLACES)
      for (const t of p.times)
        if (t.transfers !== undefined) expect(t.transfers).toBeGreaterThanOrEqual(0);
  });
  it("MK-10: walkMin >= 0", () => {
    for (const p of PLACES) expect(p.walkMin).toBeGreaterThanOrEqual(0);
  });
  it("MK-11: votes >= 0 (nogari:2,gwangjang:1,나머지0)", () => {
    for (const p of PLACES) expect(p.votes).toBeGreaterThanOrEqual(0);
    expect(PLACES.find((p) => p.id === "nogari")!.votes).toBe(2);
    expect(PLACES.find((p) => p.id === "gwangjang")!.votes).toBe(1);
  });
  it("MK-12: category enum 5종 중 하나", () => {
    for (const p of PLACES) expect(CATEGORIES.has(p.category)).toBe(true);
  });
});

describe("mock — 추천 정합 (§2-8, MK-13)", () => {
  it("MK-13: 정렬 1위(=최소 score) place의 fairLevel이 good, 추천 의도와 모순 없음", () => {
    const ranked = PLACES.map((p) => {
      const mins = p.times.map((t) => t.minutes);
      return { id: p.id, score: scoreOf(mins), gap: gapOfMins(mins) };
    }).sort((a, b) => a.score - b.score);

    const top = ranked[0];
    // 가장 공평한 1위는 good 등급이어야 한다(색=공평도 불변식의 데모 기준)
    expect(fairLevel(top.gap)).toBe("good");
    // 데모 정본: nogari(노가리골목)가 1위(가장 공평)
    expect(top.id).toBe("nogari");
    // APPOINTMENT.placeId(확정 약속)도 nogari → 추천-확정 일관성
    expect(APPOINTMENT.placeId).toBe(top.id);
  });
});

describe("mock — APPOINTMENT / RECOMMENDED_STATION (§2-8)", () => {
  it("MK-14: APPOINTMENT.placeId 가 PLACES 내 존재(nogari)", () => {
    expect(APPOINTMENT.placeId).toBe("nogari");
    expect(PLACES.some((p) => p.id === APPOINTMENT.placeId)).toBe(true);
  });
  it("MK-15: RECOMMENDED_STATION 구조 {name,lines,reason}", () => {
    expect(typeof RECOMMENDED_STATION.name).toBe("string");
    expect(Array.isArray(RECOMMENDED_STATION.lines)).toBe(true);
    expect(RECOMMENDED_STATION.lines.length).toBeGreaterThan(0);
    expect(typeof RECOMMENDED_STATION.reason).toBe("string");
  });
});
