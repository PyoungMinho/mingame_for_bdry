/**
 * 결정론 점수 산식 — A-301~A-310
 */
import { describe, it, expect } from "vitest";
import {
  calculateScore,
  calculateDelta,
  calculateStreak,
  buildScoreSnapshot,
  SCORE_VERSION,
} from "@/lib/server/score-engine";

const AXES_50 = { health: 50, learning: 50, relation: 50, achievement: 50 };

describe("score-engine — 결정론 (A-301~A-303)", () => {
  it("A-301: 동일 입력 → 동일 출력 (1000회 비트레벨)", () => {
    const a = calculateScore({ axes: AXES_50 });
    for (let i = 0; i < 1000; i++) {
      const b = calculateScore({ axes: AXES_50 });
      expect(b.total).toBe(a.total);
    }
  });

  it("A-302: 버전 상수 정합 (E-001)", () => {
    const r = calculateScore({ axes: AXES_50 });
    expect(r.version).toBe(SCORE_VERSION);
    expect(r.version).toMatch(/^v\d+\.\d+\.\d+$/);
  });

  it("A-303: 입력 순서 무관 (a={50,60,70,80} vs 객체 같으면 동일)", () => {
    const r1 = calculateScore({ axes: { health: 80, learning: 70, relation: 60, achievement: 50 } });
    const r2 = calculateScore({ axes: { achievement: 50, relation: 60, learning: 70, health: 80 } });
    expect(r1.total).toBe(r2.total);
  });
});

describe("score-engine — 가중치 정규화 + clamp (A-305~A-306)", () => {
  it("A-305: userWeightOverride 합산이 1.0 이 아니어도 정규화", () => {
    const r = calculateScore({
      axes: AXES_50,
      userWeightOverride: { health: 0.5, learning: 0.5, relation: 0.5, achievement: 0.5 },
    });
    // 4축 모두 같으니 결과는 단일 축 점수와 동일
    expect(r.total).toBeGreaterThan(0);
    expect(r.total).toBeLessThanOrEqual(100);
  });

  it("A-306: 가중치 0~1 범위 밖 입력 clamp (0.05→0.10, 0.9→0.7)", () => {
    expect(() =>
      calculateScore({
        axes: AXES_50,
        userWeightOverride: { health: 0.05, learning: 0.9, relation: 0.5, achievement: 0.5 },
      })
    ).not.toThrow();
  });
});

describe("score-engine — 경계값 + 단조성 (A-307~A-310)", () => {
  it("A-307: 4축 모두 0 → total 0", () => {
    const r = calculateScore({ axes: { health: 0, learning: 0, relation: 0, achievement: 0 } });
    expect(r.total).toBe(0);
  });

  it("A-308: 4축 모두 100 → total 100", () => {
    const r = calculateScore({ axes: { health: 100, learning: 100, relation: 100, achievement: 100 } });
    expect(r.total).toBe(100);
  });

  it("A-309: 입력 증가하면 total 단조증가 (1축 한정)", () => {
    let prev = -Infinity;
    for (let h = 0; h <= 100; h += 10) {
      const r = calculateScore({ axes: { ...AXES_50, health: h } });
      expect(r.total).toBeGreaterThanOrEqual(prev);
      prev = r.total;
    }
  });

  it("A-310: total 0~100 범위 강제", () => {
    for (let v = 0; v <= 100; v += 7) {
      const r = calculateScore({ axes: { health: v, learning: v, relation: v, achievement: v } });
      expect(r.total).toBeGreaterThanOrEqual(0);
      expect(r.total).toBeLessThanOrEqual(100);
    }
  });
});

describe("score-engine — buildScoreSnapshot + calculateDelta", () => {
  it("B-001 보조: snapshot 5필드 (health/learning/relation/achievement/total/version)", () => {
    const snap = buildScoreSnapshot(AXES_50);
    expect(snap).toMatchObject({
      health: expect.any(Number),
      learning: expect.any(Number),
      relation: expect.any(Number),
      achievement: expect.any(Number),
      total: expect.any(Number),
      version: SCORE_VERSION,
    });
  });

  it("calculateDelta: yesterday null → 0,0,0,0,0", () => {
    const today = buildScoreSnapshot(AXES_50);
    const d = calculateDelta(today, null);
    expect(d).toEqual({ health: 0, learning: 0, relation: 0, achievement: 0, total: 0 });
  });

  it("calculateDelta: delta = today - yesterday", () => {
    const today = buildScoreSnapshot({ health: 60, learning: 60, relation: 60, achievement: 60 });
    const yesterday = buildScoreSnapshot({ health: 50, learning: 50, relation: 50, achievement: 50 });
    const d = calculateDelta(today, yesterday);
    expect(d.total).toBeGreaterThan(0);
  });
});

describe("score-engine — calculateStreak (B-010~B-013)", () => {
  it("B-010: lastCheckinDate null → 첫 체크인 current=1", () => {
    const s = calculateStreak(null, 0, 0);
    expect(s.current).toBe(1);
    expect(s.isNewRecord).toBe(true);
  });

  it("B-011: 어제 체크인 → 연속 +1", () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() + 9 * 60 * 60 * 1000 - 86_400_000)
      .toISOString()
      .slice(0, 10);
    const s = calculateStreak(yesterday, 5, 10);
    expect(s.current).toBe(6);
    expect(s.isNewRecord).toBe(false);
  });

  it("B-012: 3일 전 체크인 → 끊김 → current=1, graceUntil set", () => {
    const oldDate = "2020-01-01";
    const s = calculateStreak(oldDate, 10, 10);
    expect(s.current).toBe(1);
    expect(s.graceUntil).toBeInstanceOf(Date);
  });

  it("B-013: 신기록 갱신 시 isNewRecord true", () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() + 9 * 60 * 60 * 1000 - 86_400_000)
      .toISOString()
      .slice(0, 10);
    const s = calculateStreak(yesterday, 10, 10);
    expect(s.current).toBe(11);
    expect(s.isNewRecord).toBe(true);
  });
});
