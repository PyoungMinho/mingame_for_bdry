/**
 * SC-01 ~ SC-24 — 신뢰점수 순수함수 (SSOT) 전수 검증.
 * 대상: src/lib/types/domain.ts — clampScore / computeGrade / aggregateTrustScore
 *
 * 절대 제약 7 핵심: earned=null(pending)은 0점이 아니다 → 점수 제외 + isLowerBound=true.
 * QA설계자 케이스 매트릭스 §2.1. 모든 기대값은 QA실행자가 실제 실행으로 확인함.
 */
import { describe, it, expect } from "vitest";
import {
  clampScore,
  computeGrade,
  aggregateTrustScore,
  SCORE_WEIGHTS,
  SCORE_TOTAL,
  GRADE_CUTOFFS,
  type ScoreBreakdownItem,
} from "@/lib/types/domain";

describe("clampScore — 하한/상한/반올림/NaN 가드", () => {
  it("SC-01: 음수(-5)는 0으로 하한 클램프", () => {
    expect(clampScore(-5)).toBe(0);
  });
  it("SC-02: 초과(150)는 100으로 상한 클램프", () => {
    expect(clampScore(150)).toBe(100);
  });
  it("SC-03: 79.6은 80으로 반올림", () => {
    expect(clampScore(79.6)).toBe(80);
  });
  it("SC-04: NaN은 0으로 가드", () => {
    expect(clampScore(NaN)).toBe(0);
  });
  it("SC-05: 0은 0 그대로 통과", () => {
    expect(clampScore(0)).toBe(0);
  });
  it("추가: 79.4는 79로 내림(반올림 경계 하향)", () => {
    expect(clampScore(79.4)).toBe(79);
  });
  it("추가: 100은 100 그대로", () => {
    expect(clampScore(100)).toBe(100);
  });
});

describe("computeGrade — 등급 컷오프 경계 (Gold≥80 / Silver 55~79 / Unverified<55)", () => {
  it("SC-06: 80 → gold (Gold 하한 경계)", () => {
    expect(computeGrade(80)).toBe("gold");
  });
  it("SC-07: 79 → silver (Gold 직전)", () => {
    expect(computeGrade(79)).toBe("silver");
  });
  it("SC-08: 55 → silver (Silver 하한 경계)", () => {
    expect(computeGrade(55)).toBe("silver");
  });
  it("SC-09: 54 → unverified (Silver 직전)", () => {
    expect(computeGrade(54)).toBe("unverified");
  });
  it("SC-10: 0 → unverified", () => {
    expect(computeGrade(0)).toBe("unverified");
  });
  it("SC-11: 100 → gold", () => {
    expect(computeGrade(100)).toBe("gold");
  });
  it("SC-12: 79.5는 clamp(반올림)→80 → gold (clamp 후 등급)", () => {
    expect(computeGrade(79.5)).toBe("gold");
  });
  it("추가: 54.5는 clamp→55 → silver (Silver 경계 반올림)", () => {
    expect(computeGrade(54.5)).toBe("silver");
  });
});

// ──────────────────────────────────────────────
// aggregateTrustScore
// ──────────────────────────────────────────────

const fullVerified: ScoreBreakdownItem[] = [
  { key: "photo", earned: 35, max: 35, status: "verified" },
  { key: "exif", earned: 20, max: 20, status: "verified" },
  { key: "community", earned: 20, max: 20, status: "verified" },
  { key: "owner", earned: 15, max: 15, status: "verified" },
  { key: "transaction", earned: 10, max: 10, status: "verified" },
];

describe("aggregateTrustScore — 만점/pending/신고 감점", () => {
  it("SC-13: 5항목 전부 verified 만점 → score=100, maxPossible=100, isLowerBound=false, badge=gold", () => {
    const r = aggregateTrustScore(fullVerified);
    expect(r.score).toBe(100);
    expect(r.maxPossible).toBe(100);
    expect(r.isLowerBound).toBe(false);
    expect(r.badgeAchieved).toBe("gold");
  });

  it("SC-14: photo=pending(null), 나머지 verified → isLowerBound=true, score는 photo 제외 합(65), maxPossible=100", () => {
    const items: ScoreBreakdownItem[] = [
      { key: "photo", earned: null, max: 35, status: "pending" },
      ...fullVerified.slice(1),
    ];
    const r = aggregateTrustScore(items);
    expect(r.isLowerBound).toBe(true);
    expect(r.score).toBe(65); // 20+20+15+10
    expect(r.maxPossible).toBe(100);
    // pending 제외분(65)은 silver 구간
    expect(r.badgeAchieved).toBe("silver");
  });

  it("SC-15: 전 항목 pending(null) → score=0, isLowerBound=true, maxPossible=합(여기선 단일항목 35)", () => {
    const r = aggregateTrustScore([{ key: "photo", earned: null, max: 35, status: "pending" }]);
    expect(r.score).toBe(0);
    expect(r.isLowerBound).toBe(true);
    expect(r.maxPossible).toBe(35);
    expect(r.badgeAchieved).toBe("unverified");
  });

  it("SC-15b: 5항목 전부 pending → score=0, maxPossible=100, isLowerBound=true (pending≠0점)", () => {
    const items: ScoreBreakdownItem[] = fullVerified.map((i) => ({
      ...i,
      earned: null,
      status: "pending" as const,
    }));
    const r = aggregateTrustScore(items);
    expect(r.score).toBe(0);
    expect(r.maxPossible).toBe(100);
    expect(r.isLowerBound).toBe(true);
  });

  it("SC-16: community=processing(earned=null)도 pending 취급 → score 제외 + isLowerBound=true", () => {
    const items: ScoreBreakdownItem[] = [
      { key: "photo", earned: 35, max: 35, status: "verified" },
      { key: "community", earned: null, max: 20, status: "processing" },
    ];
    const r = aggregateTrustScore(items);
    expect(r.score).toBe(35);
    expect(r.isLowerBound).toBe(true);
    expect(r.maxPossible).toBe(55);
  });

  it("SC-17: transaction reported earned=5 delta=-5 → 해당항목 0 반영, 나머지 합산", () => {
    const items: ScoreBreakdownItem[] = [
      { key: "photo", earned: 35, max: 35, status: "verified" },
      { key: "transaction", earned: 5, max: 10, status: "reported", deltaIfReported: -5 },
    ];
    const r = aggregateTrustScore(items);
    expect(r.score).toBe(35); // 35 + max(0, 5-5)
    expect(r.isLowerBound).toBe(false);
  });

  it("SC-18: reported earned=3 delta=-10 → Math.max(0,-7)=0 (음수 클램프 0 하한)", () => {
    const r = aggregateTrustScore([
      { key: "transaction", earned: 3, max: 10, status: "reported", deltaIfReported: -10 },
    ]);
    expect(r.score).toBe(0);
  });

  it("SC-19 [현재동작 고정 / BUG: RV-C·BUG-05]: reported earned=30, delta 없음(undefined) → 30점 전액 합산", () => {
    // ⚠ 의도(설계): 신고 항목은 감점/0 처리되어야 함.
    // ⚠ 현재(실측): deltaIfReported 가 undefined 면 감점 미적용 → 30점 그대로 합산.
    // 본 테스트는 "현재 동작"을 회귀로 고정. 정책 결정은 백엔드/기획 영역(보고만). docs/qa/bug-report.md BUG-05 참조.
    const r = aggregateTrustScore([{ key: "photo", earned: 30, max: 35, status: "reported" }]);
    expect(r.score).toBe(30);
  });

  it("SC-20: verified인데 earned=null(모순) → null 우선 → pending 취급, score 제외", () => {
    const r = aggregateTrustScore([{ key: "photo", earned: null, max: 35, status: "verified" }]);
    expect(r.score).toBe(0);
    expect(r.isLowerBound).toBe(true);
  });

  it("SC-21: maxPossible 합>100(malformed max) → maxPossible 100으로 클램프", () => {
    const r = aggregateTrustScore([{ key: "photo", earned: 60, max: 120, status: "verified" }]);
    expect(r.maxPossible).toBe(100);
    expect(r.score).toBe(60);
  });

  it("SC-22: reported인데 earned=null → null 체크 우선 → 감점 미적용, score 제외(pending 취급)", () => {
    const r = aggregateTrustScore([
      { key: "photo", earned: null, max: 35, status: "reported", deltaIfReported: -5 },
    ]);
    expect(r.score).toBe(0);
    expect(r.isLowerBound).toBe(true);
  });

  it("SC-23: 빈 배열 [] → score=0, maxPossible=0, isLowerBound=false, badge=unverified", () => {
    const r = aggregateTrustScore([]);
    expect(r.score).toBe(0);
    expect(r.maxPossible).toBe(0);
    expect(r.isLowerBound).toBe(false);
    expect(r.badgeAchieved).toBe("unverified");
  });

  it("breakdown 원본은 반환 객체에 그대로 보존(참조 유지)", () => {
    const items: ScoreBreakdownItem[] = [{ key: "photo", earned: 10, max: 35, status: "verified" }];
    const r = aggregateTrustScore(items);
    expect(r.breakdown).toBe(items);
  });
});

describe("점수 상수 (SC-24)", () => {
  it("SC-24: SCORE_WEIGHTS 합(35+20+20+15+10)===SCORE_TOTAL(100)", () => {
    const sum = Object.values(SCORE_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBe(SCORE_TOTAL);
    expect(SCORE_TOTAL).toBe(100);
  });
  it("배점 개별값 고정 (배점 변경 회귀 가드)", () => {
    expect(SCORE_WEIGHTS).toEqual({ photo: 35, exif: 20, community: 20, owner: 15, transaction: 10 });
  });
  it("등급 컷오프 고정 (Gold 80 / Silver 55)", () => {
    expect(GRADE_CUTOFFS.gold).toBe(80);
    expect(GRADE_CUTOFFS.silver).toBe(55);
  });
});
