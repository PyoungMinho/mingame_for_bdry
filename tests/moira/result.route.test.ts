/**
 * GET /api/moira/meetups/[id]/result — 라우트 계약 (설계서 §2-7).
 *
 * 호출: GET(req, { params: { id } }). demo 모드에서만 200.
 * 모듈 상단 MOIRA_SCORE_* 상수가 로드시 평가되므로 가중치 테스트는 resetModules + import 필수.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { gapOf, avgOf, fairLevel } from "@/lib/moira/fairness";
import { withDemo, withLive, withEnv, getReq } from "./_helpers";

async function loadResult() {
  return import("@/app/api/moira/meetups/[id]/result/route");
}

beforeEach(() => {
  vi.resetModules();
});

const PARAMS = (id: string) => ({ params: { id } });

describe("GET /result — demo 응답 (§2-7)", () => {
  it("RS-01: 200, success, 추천역=을지로3가, lines 배열, places 5개", async () => {
    await withDemo(async () => {
      const { GET } = await loadResult();
      const res = await GET(getReq(), PARAMS("abcd123456"));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.recommendedStation.name).toBe("을지로3가");
      expect(Array.isArray(json.data.recommendedStation.lines)).toBe(true);
      expect(json.data.places).toHaveLength(5);
    });
  });

  it("RS-02: meta — mode=demo, version=1, meetupId echo", async () => {
    await withDemo(async () => {
      const { GET } = await loadResult();
      const res = await GET(getReq(), PARAMS("abcd123456"));
      const json = await res.json();
      expect(json.meta.mode).toBe("demo");
      expect(json.meta.version).toBe(1);
      expect(json.meta.meetupId).toBe("abcd123456");
    });
  });

  it("RS-03: place 스키마 — 11필드 전부 존재", async () => {
    await withDemo(async () => {
      const { GET } = await loadResult();
      const res = await GET(getReq(), PARAMS("abcd123456"));
      const json = await res.json();
      const keys = [
        "id", "name", "category", "walkMin", "blurb", "times",
        "fairGap", "fairAvg", "fairScore", "fairLevel", "votes",
      ];
      for (const place of json.data.places) {
        for (const k of keys) expect(place).toHaveProperty(k);
      }
    });
  });

  it("RS-04: nogari fairGap === 6 (gapOf 일치)", async () => {
    await withDemo(async () => {
      const { GET } = await loadResult();
      const json = await (await GET(getReq(), PARAMS("x"))).json();
      const nogari = json.data.places.find((p: { id: string }) => p.id === "nogari");
      expect(nogari.fairGap).toBe(6);
      expect(nogari.fairGap).toBe(gapOf([{ name: "", minutes: 22 }, { name: "", minutes: 28 }, { name: "", minutes: 26 }, { name: "", minutes: 24 }]));
    });
  });

  it("RS-05: nogari fairAvg === 25 (avgOf 일치)", async () => {
    await withDemo(async () => {
      const { GET } = await loadResult();
      const json = await (await GET(getReq(), PARAMS("x"))).json();
      const nogari = json.data.places.find((p: { id: string }) => p.id === "nogari");
      expect(nogari.fairAvg).toBe(25);
      expect(nogari.fairAvg).toBe(avgOf([{ name: "", minutes: 22 }, { name: "", minutes: 28 }, { name: "", minutes: 26 }, { name: "", minutes: 24 }]));
    });
  });

  it("RS-06: 전 place fairLevel === fairLevel(fairGap)", async () => {
    await withDemo(async () => {
      const { GET } = await loadResult();
      const json = await (await GET(getReq(), PARAMS("x"))).json();
      for (const p of json.data.places) {
        expect(p.fairLevel).toBe(fairLevel(p.fairGap));
      }
    });
  });

  it("RS-07: 정렬 — fairScore 오름차순(전구간)", async () => {
    await withDemo(async () => {
      const { GET } = await loadResult();
      const json = await (await GET(getReq(), PARAMS("x"))).json();
      const scores = json.data.places.map((p: { fairScore: number }) => p.fairScore);
      for (let i = 0; i + 1 < scores.length; i++) {
        expect(scores[i]).toBeLessThanOrEqual(scores[i + 1]);
      }
    });
  });

  it("RS-08: places[0] === fairScore 최소값", async () => {
    await withDemo(async () => {
      const { GET } = await loadResult();
      const json = await (await GET(getReq(), PARAMS("x"))).json();
      const scores = json.data.places.map((p: { fairScore: number }) => p.fairScore);
      expect(json.data.places[0].fairScore).toBe(Math.min(...scores));
      // 데모 정본: 가장 공평한 1위는 nogari(노가리골목)
      expect(json.data.places[0].id).toBe("nogari");
      expect(json.data.places[0].fairLevel).toBe("good");
    });
  });

  it("RS-09: fairScore 공식 — 0.4*avg+0.4*max+0.2*stddev_pop ×10 round /10", async () => {
    await withDemo(async () => {
      const { GET } = await loadResult();
      const json = await (await GET(getReq(), PARAMS("x"))).json();
      const sd = (xs: number[]) => {
        const m = xs.reduce((s, x) => s + x, 0) / xs.length;
        return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length);
      };
      for (const p of json.data.places) {
        const mins = p.times.map((t: { minutes: number }) => t.minutes);
        const avg = mins.reduce((s: number, x: number) => s + x, 0) / mins.length;
        const max = Math.max(...mins);
        const expected = Math.round((0.4 * avg + 0.4 * max + 0.2 * sd(mins)) * 10) / 10;
        expect(Math.abs(p.fairScore - expected)).toBeLessThanOrEqual(0.05);
      }
    });
  });

  it("RS-10: 가중치 env(ALPHA=1,BETA=0,GAMMA=0) → fairScore = round(avg*10)/10", async () => {
    await withEnv(
      {
        ODSAY_API_KEY: undefined,
        KAKAO_REST_KEY: undefined,
        MOIRA_SCORE_ALPHA: "1",
        MOIRA_SCORE_BETA: "0",
        MOIRA_SCORE_GAMMA: "0",
      },
      async () => {
        vi.resetModules(); // 모듈 상단 상수 재평가 보장
        const { GET } = await loadResult();
        const json = await (await GET(getReq(), PARAMS("x"))).json();
        for (const p of json.data.places) {
          const mins = p.times.map((t: { minutes: number }) => t.minutes);
          const avg = mins.reduce((s: number, x: number) => s + x, 0) / mins.length;
          expect(Math.abs(p.fairScore - Math.round(avg * 10) / 10)).toBeLessThanOrEqual(0.05);
        }
      }
    );
  });

  it("RS-11: live 미연결 → 409 E_NOT_READY", async () => {
    await withLive(async () => {
      const { GET } = await loadResult();
      const res = await GET(getReq(), PARAMS("x"));
      expect(res.status).toBe(409);
      expect((await res.json()).error.code).toBe("E_NOT_READY");
    });
  });

  it("RS-12: PII 미노출 — origin 원문·lat/lng 응답에 미포함 (INV-6)", async () => {
    await withDemo(async () => {
      const { GET } = await loadResult();
      const res = await GET(getReq(), PARAMS("x"));
      const text = JSON.stringify(await res.json());
      expect(text).not.toContain("강남구 역삼동");
      expect(text).not.toContain("노원구 상계동");
      expect(text).not.toContain("lat");
      expect(text).not.toContain("lng");
    });
  });

  it("RS-13: times 구조 — {name,minutes,transfers?}만(좌표·origin 없음)", async () => {
    await withDemo(async () => {
      const { GET } = await loadResult();
      const json = await (await GET(getReq(), PARAMS("x"))).json();
      for (const p of json.data.places) {
        for (const t of p.times) {
          const allowed = new Set(["name", "minutes", "transfers"]);
          for (const k of Object.keys(t)) expect(allowed.has(k)).toBe(true);
          expect(typeof t.name).toBe("string");
          expect(typeof t.minutes).toBe("number");
        }
      }
    });
  });

  it("RS-14: data 최상위 키집합 === [recommendedStation, places] (§6-3 회귀가드)", async () => {
    await withDemo(async () => {
      const { GET } = await loadResult();
      const json = await (await GET(getReq(), PARAMS("x"))).json();
      expect(Object.keys(json.data).sort()).toEqual(["places", "recommendedStation"]);
    });
  });

  it("RS-15: 빈 id → 현 스텁은 200 (DB 미조회, 현 동작 회귀가드)", async () => {
    await withDemo(async () => {
      const { GET } = await loadResult();
      const res = await GET(getReq(), PARAMS(""));
      expect(res.status).toBe(200); // 미래 DB 연결 시 404로 바뀌어야 함(코드리뷰 m-4)
    });
  });

  it("RS-16: 모든 place fairScore 가 유한수(NaN/Infinity 없음) — calcScore 방어 회귀가드(m-2)", async () => {
    await withDemo(async () => {
      const { GET } = await loadResult();
      const json = await (await GET(getReq(), PARAMS("x"))).json();
      for (const p of json.data.places) {
        expect(Number.isFinite(p.fairScore)).toBe(true);
      }
      // 데모 정본 1위 score(=21.6)가 유지되는지(가드가 정상 경로 행동을 바꾸지 않음 회귀가드)
      expect(json.data.places[0].fairScore).toBe(21.6);
    });
  });
});
