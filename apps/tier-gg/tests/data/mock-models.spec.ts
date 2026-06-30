/**
 * D-01 ~ D-08: mock-models 데이터 무결성
 */
import { describe, it, expect } from "vitest";
import {
  mockModels,
  mockProviders,
} from "@/lib/data/mock-models";

describe("mock-models 데이터 무결성", () => {
  it("D-01: slug는 유니크해야 한다", () => {
    const slugs = mockModels.map((m) => m.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("D-02: id는 유니크해야 한다", () => {
    const ids = mockModels.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("D-03: 모든 providerSlug가 mockProviders에 존재해야 한다", () => {
    const providerSlugs = new Set(mockProviders.map((p) => p.slug));
    const orphans = mockModels.filter(
      (m) => !providerSlugs.has(m.providerSlug)
    );
    expect(orphans).toEqual([]);
  });

  it("D-04: source.url은 http(s)로 시작해야 한다", () => {
    const bad = mockModels.filter((m) => !/^https?:\/\//.test(m.source.url));
    expect(bad).toEqual([]);
  });

  it("D-05: source.verifiedAt은 유효한 ISO 날짜여야 한다", () => {
    const bad = mockModels.filter((m) =>
      Number.isNaN(Date.parse(m.source.verifiedAt))
    );
    expect(bad).toEqual([]);
  });

  it("D-06: 벤치마크 점수(mmlu/humaneval/gpqa)는 0~100 범위", () => {
    for (const m of mockModels) {
      for (const key of ["mmlu", "humaneval", "gpqa"] as const) {
        const v = m.scores[key];
        if (v != null) {
          expect(v, `${m.slug}.${key}`).toBeGreaterThanOrEqual(0);
          expect(v, `${m.slug}.${key}`).toBeLessThanOrEqual(100);
        }
      }
    }
  });

  it("D-07: priceInput은 null이거나 0 이상", () => {
    const bad = mockModels.filter((m) => {
      const p = m.attrs.priceInput;
      return p != null && p < 0;
    });
    expect(bad).toEqual([]);
  });

  it("D-08: published 모델이 최소 1건 이상 있어야 한다", () => {
    const published = mockModels.filter((m) => m.status === "published");
    expect(published.length).toBeGreaterThan(0);
  });
});
