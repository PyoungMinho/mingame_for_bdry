/**
 * Checkin 스키마/검증 — B-005~B-009
 */
import { describe, it, expect } from "vitest";
import { CheckinRequestSchema } from "@/lib/shared/schemas";

const HAPPY = { health: 70, learning: 60, relation: 50, achievement: 80 };

describe("checkin schema (B-005~B-009)", () => {
  it("B-005: happy path 통과", () => {
    expect(CheckinRequestSchema.safeParse(HAPPY).success).toBe(true);
  });

  it("B-006: 축 누락 (health) → reject", () => {
    const { health: _h, ...rest } = HAPPY;
    expect(CheckinRequestSchema.safeParse(rest).success).toBe(false);
  });

  it("B-007: 음수 → reject", () => {
    expect(CheckinRequestSchema.safeParse({ ...HAPPY, health: -1 }).success).toBe(false);
  });

  it("B-007b: 101 → reject", () => {
    expect(CheckinRequestSchema.safeParse({ ...HAPPY, health: 101 }).success).toBe(false);
  });

  it("B-008: memo 500자 통과", () => {
    expect(
      CheckinRequestSchema.safeParse({ ...HAPPY, memo: "a".repeat(500) }).success
    ).toBe(true);
  });

  it("B-009: memo 501자 reject", () => {
    expect(
      CheckinRequestSchema.safeParse({ ...HAPPY, memo: "a".repeat(501) }).success
    ).toBe(false);
  });

  it("B-009b: 정수 외 float reject (AxisScoreSchema .int())", () => {
    expect(CheckinRequestSchema.safeParse({ ...HAPPY, health: 50.5 }).success).toBe(false);
  });
});
