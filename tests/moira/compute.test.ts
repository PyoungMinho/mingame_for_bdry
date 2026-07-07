/**
 * compute.ts — 라이브 실계산 오케스트레이션.
 *
 * ① 키 없으면 {mode:"demo"} (프론트 시드 폴백) — 네트워크 호출 없음
 * ② 키 있고 네트워크 mock 시 유효한 라이브 Scenario 생성 (지오코딩→ODsay→조립)
 * ③ 지오코딩 실패 시 {mode:"error"}
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { computeScenario, type ComputeMember } from "@/lib/moira/server/compute";

const FRIENDS: ComputeMember[] = [
  { id: "me", name: "민호", avatar: "#6366F1", address: "봉천역" },
  { id: "seoyeon", name: "서연", avatar: "#0EA5E9", latLng: { lat: 37.6542, lng: 127.0633 } },
  { id: "jihoon", name: "지훈", avatar: "#14B8A6", latLng: { lat: 37.4759, lng: 126.9814 } },
  { id: "yerin", name: "예린", avatar: "#A855F7", latLng: { lat: 37.5567, lng: 126.9243 } },
];

// URL로 카카오/ODsay 구분해 가짜 응답을 주는 fetch mock
function mockFetch(odsayOk = true, geoOk = true) {
  return vi.fn(async (url: string) => {
    if (url.includes("dapi.kakao.com")) {
      return {
        ok: true,
        json: async () => (geoOk ? { documents: [{ x: "126.9419", y: "37.4824" }] } : { documents: [] }),
      } as Response;
    }
    // ODsay — 도착 경도(EX)로 소요시간 차등 → 허브별로 다른 값
    const ex = Number(new URL(url).searchParams.get("EX") ?? "127");
    const total = Math.round(20 + Math.abs(ex - 126.95) * 120);
    return {
      ok: true,
      json: async () =>
        odsayOk
          ? {
              result: {
                path: [
                  {
                    info: { totalTime: total, subwayTransitCount: 1, busTransitCount: 0 },
                    subPath: [
                      {
                        trafficType: 1,
                        sectionTime: total - 4,
                        lane: [{ name: "2호선" }],
                        passStopList: { stations: [{ x: "126.97", y: "37.53" }, { x: "126.99", y: "37.55" }] },
                      },
                    ],
                  },
                ],
              },
            }
          : { error: { code: -8, message: "경로없음" } },
    } as Response;
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("computeScenario — 키 없으면 demo 폴백", () => {
  it("ODSAY/KAKAO 키 미설정 시 {mode:'demo'}, 네트워크 호출 없음", async () => {
    const fetchSpy = mockFetch();
    vi.stubGlobal("fetch", fetchSpy);
    const out = await computeScenario(FRIENDS);
    expect(out.mode).toBe("demo");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("computeScenario — 라이브 실계산(mock 네트워크)", () => {
  it("키 있으면 유효한 live Scenario 조립", async () => {
    vi.stubEnv("KAKAO_REST_KEY", "k");
    vi.stubEnv("ODSAY_API_KEY", "o");
    vi.stubGlobal("fetch", mockFetch());

    const out = await computeScenario(FRIENDS);
    expect(out.mode).toBe("live");
    if (out.mode !== "live") return;
    const s = out.scenario;
    expect(s.members).toHaveLength(4);
    expect(s.members[0].originLatLng).toBeTruthy(); // 호스트 지오코딩됨
    expect(s.station.name.length).toBeGreaterThan(0);
    expect(s.places.length).toBeGreaterThanOrEqual(1);
    expect(s.routePlaces).toHaveLength(3);
    for (const rp of s.routePlaces) {
      expect(rp.memberRoutes).toHaveLength(4);
      for (const mr of rp.memberRoutes) {
        expect(mr.minutes).toBeGreaterThan(0);
        expect(mr.polyline.length).toBeGreaterThanOrEqual(2); // passStopList 꺾은선
      }
      expect(rp.fairScore).toBeGreaterThanOrEqual(38);
      expect(rp.fairScore).toBeLessThanOrEqual(96);
    }
  });

  it("지오코딩 실패 시 {mode:'error'}", async () => {
    vi.stubEnv("KAKAO_REST_KEY", "k");
    vi.stubEnv("ODSAY_API_KEY", "o");
    vi.stubGlobal("fetch", mockFetch(true, false)); // geoOk=false
    const out = await computeScenario(FRIENDS);
    expect(out.mode).toBe("error");
  });

  it("모든 대중교통 경로 실패 시 {mode:'error'}", async () => {
    vi.stubEnv("KAKAO_REST_KEY", "k");
    vi.stubEnv("ODSAY_API_KEY", "o");
    vi.stubGlobal("fetch", mockFetch(false, true)); // odsayOk=false
    const out = await computeScenario(FRIENDS);
    expect(out.mode).toBe("error");
  });
});
