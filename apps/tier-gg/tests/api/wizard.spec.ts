/**
 * W-01/02/04/05: wizard 추천 로직 검증 (mock 분기)
 */
import { describe, it, expect } from "vitest";
import { recommendModels } from "@/lib/api/wizard";
import { mockModels } from "@/lib/data/mock-models";

describe("recommendModels (mock 분기)", () => {
  it("W-01: budget=free → priceInput이 0 또는 null인 모델만 통과", async () => {
    const res = await recommendModels({
      role: "developer",
      task: "writing",
      budget: "free",
    });
    for (const r of res) {
      const p = r.model.price_input_per_1m;
      expect(p === 0 || p === null).toBe(true);
    }
  });

  it("W-02: budget=low → priceInput이 2 이하 또는 null", async () => {
    const res = await recommendModels({
      role: "developer",
      task: "coding",
      budget: "low",
    });
    for (const r of res) {
      const p = r.model.price_input_per_1m;
      expect(p === null || (typeof p === "number" && p <= 2)).toBe(true);
    }
  });

  it("W-04: totalScore = nb*0.4 + np*0.4 + no*0.2 (가중치 정확성)", async () => {
    const res = await recommendModels({
      role: "developer",
      task: "coding",
      budget: "high",
    });
    expect(res.length).toBeGreaterThan(0);
    for (const r of res) {
      const sum =
        r.scoreBreakdown.benchmark +
        r.scoreBreakdown.priceEfficiency +
        r.scoreBreakdown.other;
      // 모든 항목이 반올림되어 있으므로 0.02 허용
      expect(Math.abs(sum - r.totalScore)).toBeLessThanOrEqual(0.02);
    }
  });

  it("W-05: 각 추천 항목에 weights 필드 포함 (투명성)", async () => {
    const res = await recommendModels({
      role: "developer",
      task: "coding",
      budget: "mid",
    });
    expect(res.length).toBeGreaterThan(0);
    for (const r of res) {
      expect(r.weights).toEqual({
        benchmark: 0.4,
        priceEfficiency: 0.4,
        other: 0.2,
      });
    }
  });

  it("Top3 길이 보장 + rank 1·2·3 순서", async () => {
    const res = await recommendModels({
      role: "developer",
      task: "coding",
      budget: "high",
    });
    expect(res.length).toBeLessThanOrEqual(3);
    res.forEach((r, i) => expect(r.rank).toBe(i + 1));
  });

  it("sanity: published 모델이 충분히 존재", () => {
    const published = mockModels.filter((m) => m.status === "published");
    expect(published.length).toBeGreaterThanOrEqual(3);
  });
});
