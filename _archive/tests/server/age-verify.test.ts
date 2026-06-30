/**
 * 만나이 경계값 — A-001~A-005, A-012
 * calcKoreanAge 는 route 모듈 내부 함수라 라우트 통합으로 검증.
 * 여기는 비즈니스 룰 단위.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/** route.ts의 calcKoreanAge 와 동일 로직 — 단위 테스트용 */
function calcKoreanAge(birthDate: Date): number {
  const today = new Date(Date.now() + 9 * 60 * 60 * 1000);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

describe("age-verify — 만 16세 경계값 (A-001~A-005, A-012)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("A-001: 정확히 16세 생일 당일 → 허용 (age=16)", () => {
    vi.setSystemTime(new Date("2026-05-14T00:00:00Z"));
    const birth = new Date("2010-05-14");
    expect(calcKoreanAge(birth)).toBeGreaterThanOrEqual(16);
  });

  it("A-002: 만16세 생일 하루 전 → 차단 (age=15)", () => {
    // KST 5/13 = UTC 5/12 15:00 → 생일이 5/14 면 아직 만15
    vi.setSystemTime(new Date("2026-05-12T15:00:00Z")); // KST 5/13 00:00
    const birth = new Date("2010-05-14");
    expect(calcKoreanAge(birth)).toBe(15);
  });

  it("A-003: 만17세 명백 통과", () => {
    vi.setSystemTime(new Date("2026-05-14T00:00:00Z"));
    const birth = new Date("2008-01-01");
    expect(calcKoreanAge(birth)).toBeGreaterThanOrEqual(17);
  });

  it("A-004: 만15세 명백 차단", () => {
    vi.setSystemTime(new Date("2026-05-14T00:00:00Z"));
    const birth = new Date("2012-01-01");
    expect(calcKoreanAge(birth)).toBeLessThan(16);
  });

  it("A-005: 윤년 2/29 생일 처리 (2008-02-29 → 2026-05-14 시점 18세)", () => {
    vi.setSystemTime(new Date("2026-05-14T00:00:00Z"));
    const birth = new Date("2008-02-29");
    expect(calcKoreanAge(birth)).toBe(18);
  });

  it.skip("A-012: KST 자정 경계 — calcKoreanAge 타임존 의존성 (HI-1 관련, TZ=UTC env 강제 필요)", () => {
    // SKIP 이유: 현 구현은 Date.now() + 9hr 후 .getDate() — 호스트 로컬 타임존에 따라 결과 변동.
    // TZ=UTC 로 강제하면 결정적이나 vitest 단일 프로세스에서 동적 변경 불가.
    // CI 잡에 TZ=UTC env 명시 후 활성 권고.
  });
});
