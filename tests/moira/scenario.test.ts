/**
 * scenario.ts — 출발지 프리셋 시드 엔진 (0원 재계산) 무결성.
 *
 * 목적 검증: ①기본(강남)은 큐레이트 데모 무손상 ②나머지 프리셋은 유효 시나리오 생성
 * ③출발지에 따라 추천이 실제로 갈림 ④결정적(SSR 하이드레이션 안전).
 */
import { describe, it, expect } from "vitest";
import {
  ORIGIN_PRESETS,
  DEFAULT_ORIGIN_ID,
  buildScenario,
  resolveOriginId,
  getOriginPreset,
} from "@/lib/moira/scenario";
import { RECOMMENDED_STATION } from "@/lib/moira/mock";

const NON_DEFAULT = ORIGIN_PRESETS.filter((p) => p.id !== DEFAULT_ORIGIN_ID);

describe("resolveOriginId", () => {
  it("라벨/축약을 프리셋 id로 매핑", () => {
    expect(resolveOriginId("봉천역")).toBe("bongcheon");
    expect(resolveOriginId("소래포구역")).toBe("soraepogu");
    expect(resolveOriginId("강남구 역삼동")).toBe("gangnam"); // '강남' 포함 → 강남
  });
  it("빈값·미매칭은 기본(강남)", () => {
    expect(resolveOriginId("")).toBe(DEFAULT_ORIGIN_ID);
    expect(resolveOriginId(null)).toBe(DEFAULT_ORIGIN_ID);
    expect(resolveOriginId("부산 서면")).toBe(DEFAULT_ORIGIN_ID);
  });
});

describe("buildScenario — 기본(강남)은 큐레이트 무손상", () => {
  it("gangnam은 기존 을지로3가 데모 그대로", () => {
    const s = buildScenario("gangnam");
    expect(s.station.name).toBe(RECOMMENDED_STATION.name); // 을지로3가
    expect(s.station).toBe(RECOMMENDED_STATION); // 동일 참조(큐레이트 그대로)
    expect(s.members).toHaveLength(4);
  });
  it("알 수 없는 id도 안전하게 기본으로 폴백", () => {
    expect(buildScenario("zzz").station.name).toBe(RECOMMENDED_STATION.name);
  });
});

describe("buildScenario — 프리셋별 유효 시나리오", () => {
  it.each(NON_DEFAULT.map((p) => [p.id, p.label] as const))(
    "%s(%s): 추천역·4멤버·장소·경로가 유효",
    (id) => {
      const s = buildScenario(id);
      expect(s.originId).toBe(id);
      expect(s.station.name.length).toBeGreaterThan(0);
      expect(s.station.lines.length).toBeGreaterThan(0);
      expect(s.members).toHaveLength(4);
      expect(s.members[0].origin).toBe(getOriginPreset(id).label); // 호스트 출발지 = 선택 프리셋
      expect(s.places.length).toBeGreaterThanOrEqual(1);
      // 모든 이동시간 양수 (DB CHECK 계약과 동일)
      for (const pl of s.places)
        for (const t of pl.times) expect(t.minutes).toBeGreaterThan(0);
      // 경로지도용 3곳, 공평순 오름차순, fairScore 범위
      expect(s.routePlaces).toHaveLength(3);
      const gaps = s.routePlaces.map(
        (rp) =>
          Math.max(...rp.memberRoutes.map((m) => m.minutes)) -
          Math.min(...rp.memberRoutes.map((m) => m.minutes)),
      );
      expect(gaps[0]).toBeLessThanOrEqual(gaps[gaps.length - 1]); // [0]이 가장 공평
      for (const rp of s.routePlaces) {
        expect(rp.fairScore).toBeGreaterThanOrEqual(38);
        expect(rp.fairScore).toBeLessThanOrEqual(96);
        expect(rp.memberRoutes).toHaveLength(4);
        for (const mr of rp.memberRoutes)
          expect(mr.polyline.length).toBeGreaterThan(2); // 곡선 다점
      }
    },
  );
});

describe("buildScenario — 출발지에 따라 추천이 실제로 갈림", () => {
  it("멀리 떨어진 출발지는 강남과 다른 허브를 추천", () => {
    // 소래포구(인천 남서) → 을지로3가일 수 없음
    const sorae = buildScenario("soraepogu");
    expect(sorae.station.name).not.toBe("을지로3가");
  });
  it("최소 두 종류 이상의 추천역이 나온다(획일화 아님)", () => {
    const stations = new Set(ORIGIN_PRESETS.map((p) => buildScenario(p.id).station.name));
    expect(stations.size).toBeGreaterThanOrEqual(2);
  });
});

describe("buildScenario — 결정적(SSR 하이드레이션 안전)", () => {
  it.each(ORIGIN_PRESETS.map((p) => p.id))("%s: 두 번 호출 동일", (id) => {
    expect(JSON.stringify(buildScenario(id))).toBe(JSON.stringify(buildScenario(id)));
  });
});
