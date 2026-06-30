/**
 * POST /api/moira/meetups — 라우트 계약 (설계서 §2-6, §2-6b).
 *
 * 라우트 export를 직접 import해 Request 주입(exam/route.test.ts 패턴).
 * vi.resetModules()로 모듈 캐시 격리(token SECRET·RL_PER_MIN이 모듈 로드시 평가됨).
 * demo 모드: ODSAY/KAKAO 키 없음. 레이트리밋: NODE_ENV='test'면 자동 skip.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { verifyToken } from "@/lib/moira/token";
import { withDemo, withLive, withEnv, postReq, makeCreateBody } from "./_helpers";

async function loadMeetups() {
  return import("@/app/api/moira/meetups/route");
}

beforeEach(() => {
  vi.resetModules();
});

// ---------------------------------------------------------------------------
// §2-6 정상 & 봉투
// ---------------------------------------------------------------------------
describe("POST /meetups — 정상 & 봉투 (§2-6)", () => {
  it("MT-01: 유효 입력 → 201, success, data 4필드, inviteUrl 형식, meta.mode=demo", async () => {
    await withDemo(async () => {
      const { POST } = await loadMeetups();
      const res = await POST(postReq(makeCreateBody()));
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.meetupId).toHaveLength(10);
      expect(json.data.hostToken.split(".")).toHaveLength(2); // 점 1개
      expect(json.data.inviteToken).toBeTruthy();
      expect(json.data.inviteUrl).toContain(`/j/${json.data.meetupId}?t=${json.data.inviteToken}`);
      expect(json.meta.mode).toBe("demo");
    });
  });

  it("MT-02: 봉투 형태 정밀 — top {success,data,meta}, data 키 정확", async () => {
    await withDemo(async () => {
      const { POST } = await loadMeetups();
      const res = await POST(postReq(makeCreateBody()));
      const json = await res.json();
      expect(Object.keys(json).sort()).toEqual(["data", "meta", "success"]);
      expect(Object.keys(json.data).sort()).toEqual(
        ["hostToken", "inviteToken", "inviteUrl", "meetupId"].sort()
      );
    });
  });

  it("MT-03: hostToken 검증가능 → verifyToken ok (requireSub=host)", async () => {
    await withDemo(async () => {
      const { POST } = await loadMeetups();
      const res = await POST(postReq(makeCreateBody()));
      const json = await res.json();
      const r = verifyToken(json.data.hostToken, {
        meetupId: json.data.meetupId,
        requireSub: "host",
      });
      expect(r.ok).toBe(true);
    });
  });

  it("MT-04: inviteToken sub → verifyToken ok (requireSub=invite)", async () => {
    await withDemo(async () => {
      const { POST } = await loadMeetups();
      const res = await POST(postReq(makeCreateBody()));
      const json = await res.json();
      const r = verifyToken(json.data.inviteToken, {
        meetupId: json.data.meetupId,
        requireSub: "invite",
      });
      expect(r.ok).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// §2-6 Zod 검증 경계
// ---------------------------------------------------------------------------
describe("POST /meetups — Zod 검증 (§2-6)", () => {
  async function postBody(body: unknown) {
    return withDemo(async () => {
      const { POST } = await loadMeetups();
      const res = await POST(postReq(body));
      return { status: res.status, json: await res.json() };
    });
  }

  it("MT-05: hostName '' → 400 E_VALIDATION, fieldErrors.hostName", async () => {
    const { status, json } = await postBody(makeCreateBody({ hostName: "" }));
    expect(status).toBe(400);
    expect(json.error.code).toBe("E_VALIDATION");
    expect(json.error.fieldErrors.hostName).toBeDefined();
  });

  it("MT-06: hostName 21자(>20) → 400 E_VALIDATION", async () => {
    const { status, json } = await postBody(makeCreateBody({ hostName: "가".repeat(21) }));
    expect(status).toBe(400);
    expect(json.error.code).toBe("E_VALIDATION");
    expect(json.error.fieldErrors.hostName).toBeDefined();
  });

  it("MT-07: hostName 20자 경계 → 201", async () => {
    const { status } = await postBody(makeCreateBody({ hostName: "가".repeat(20) }));
    expect(status).toBe(201);
  });

  it("MT-08: hostName 1자 경계 → 201", async () => {
    const { status } = await postBody(makeCreateBody({ hostName: "가" }));
    expect(status).toBe(201);
  });

  it("MT-09: hostOrigin 1자(<2) → 400 E_VALIDATION, fieldErrors.hostOrigin", async () => {
    const { status, json } = await postBody(makeCreateBody({ hostOrigin: "강" }));
    expect(status).toBe(400);
    expect(json.error.code).toBe("E_VALIDATION");
    expect(json.error.fieldErrors.hostOrigin).toBeDefined();
  });

  it("MT-10: hostOrigin 2자 경계 → 201", async () => {
    const { status } = await postBody(makeCreateBody({ hostOrigin: "강남" }));
    expect(status).toBe(201);
  });

  it("MT-11: hostOrigin 100자 경계 → 201", async () => {
    const { status } = await postBody(makeCreateBody({ hostOrigin: "가".repeat(100) }));
    expect(status).toBe(201);
  });

  it("MT-12: hostOrigin 101자(>100) → 400 E_VALIDATION", async () => {
    const { status, json } = await postBody(makeCreateBody({ hostOrigin: "가".repeat(101) }));
    expect(status).toBe(400);
    expect(json.error.code).toBe("E_VALIDATION");
  });

  it("MT-13: ttlHours 0(<1) → 400 E_VALIDATION, fieldErrors.ttlHours", async () => {
    const { status, json } = await postBody(makeCreateBody({ ttlHours: 0 }));
    expect(status).toBe(400);
    expect(json.error.code).toBe("E_VALIDATION");
    expect(json.error.fieldErrors.ttlHours).toBeDefined();
  });

  it("MT-14: ttlHours 73(>72) → 400 E_VALIDATION", async () => {
    const { status, json } = await postBody(makeCreateBody({ ttlHours: 73 }));
    expect(status).toBe(400);
    expect(json.error.code).toBe("E_VALIDATION");
  });

  it("MT-15: ttlHours 1 경계 → 201", async () => {
    const { status } = await postBody(makeCreateBody({ ttlHours: 1 }));
    expect(status).toBe(201);
  });

  it("MT-16: ttlHours 72 경계 → 201", async () => {
    const { status } = await postBody(makeCreateBody({ ttlHours: 72 }));
    expect(status).toBe(201);
  });

  it("MT-17: ttlHours '48' 문자열 coerce → 201", async () => {
    const { status } = await postBody(makeCreateBody({ ttlHours: "48" }));
    expect(status).toBe(201);
  });

  it("MT-18: ttlHours 'abc' → 400 E_VALIDATION (coerce NaN)", async () => {
    const { status, json } = await postBody(makeCreateBody({ ttlHours: "abc" }));
    expect(status).toBe(400);
    expect(json.error.code).toBe("E_VALIDATION");
  });

  it("MT-19: ttlHours 2.5(소수) → 400 E_VALIDATION (.int() 위반)", async () => {
    const { status, json } = await postBody(makeCreateBody({ ttlHours: 2.5 }));
    expect(status).toBe(400);
    expect(json.error.code).toBe("E_VALIDATION");
  });

  it("MT-20: ttlHours 생략 → default 48 → 201", async () => {
    const body = makeCreateBody();
    delete body.ttlHours;
    const { status } = await postBody(body);
    expect(status).toBe(201);
  });

  it("MT-21: 빈 객체 {} → 400, fieldErrors hostName·hostOrigin 둘 다", async () => {
    const { status, json } = await postBody({});
    expect(status).toBe(400);
    expect(json.error.code).toBe("E_VALIDATION");
    expect(json.error.fieldErrors.hostName).toBeDefined();
    expect(json.error.fieldErrors.hostOrigin).toBeDefined();
  });

  it("MT-22: bad JSON → 400 E_BAD_JSON", async () => {
    await withDemo(async () => {
      const { POST } = await loadMeetups();
      const res = await POST(postReq(null, "{not json"));
      expect(res.status).toBe(400);
      expect((await res.json()).error.code).toBe("E_BAD_JSON");
    });
  });

  it("MT-23: 빈 본문 '' → 400 E_BAD_JSON", async () => {
    await withDemo(async () => {
      const { POST } = await loadMeetups();
      const res = await POST(postReq(null, ""));
      expect(res.status).toBe(400);
      expect((await res.json()).error.code).toBe("E_BAD_JSON");
    });
  });
});

// ---------------------------------------------------------------------------
// §2-6 meetupId·토큰 형식/유일성 + PII/비밀 미노출
// ---------------------------------------------------------------------------
describe("POST /meetups — id/토큰/보안 (§2-6, INV-6/7)", () => {
  it("MT-24: meetupId 형식 /^[A-Za-z0-9]{10}$/", async () => {
    await withDemo(async () => {
      const { POST } = await loadMeetups();
      const res = await POST(postReq(makeCreateBody()));
      const json = await res.json();
      expect(json.data.meetupId).toMatch(/^[A-Za-z0-9]{10}$/);
    });
  });

  it("MT-25: meetupId 유일성 — 2회 호출 서로 다름", async () => {
    await withDemo(async () => {
      const { POST } = await loadMeetups();
      const a = await (await POST(postReq(makeCreateBody()))).json();
      const b = await (await POST(postReq(makeCreateBody()))).json();
      expect(a.data.meetupId).not.toBe(b.data.meetupId);
    });
  });

  it("MT-26: hostToken ≠ inviteToken", async () => {
    await withDemo(async () => {
      const { POST } = await loadMeetups();
      const json = await (await POST(postReq(makeCreateBody()))).json();
      expect(json.data.hostToken).not.toBe(json.data.inviteToken);
    });
  });

  it("MT-27: inviteUrl baseUrl 기본값 → https://moira.app/j/ 로 시작", async () => {
    await withEnv(
      { ODSAY_API_KEY: undefined, KAKAO_REST_KEY: undefined, NEXT_PUBLIC_MOIRA_BASE_URL: undefined },
      async () => {
        const { POST } = await loadMeetups();
        const json = await (await POST(postReq(makeCreateBody()))).json();
        expect(json.data.inviteUrl.startsWith("https://moira.app/j/")).toBe(true);
      }
    );
  });

  it("MT-28: PII 미노출 — hostOrigin 원문·lat/lng 응답에 미포함 (INV-6)", async () => {
    await withDemo(async () => {
      const { POST } = await loadMeetups();
      const res = await POST(postReq(makeCreateBody({ hostOrigin: "강남구 역삼동" })));
      const text = JSON.stringify(await res.json());
      expect(text).not.toContain("강남구 역삼동");
      expect(text).not.toContain("lat");
      expect(text).not.toContain("lng");
    });
  });

  it("MT-29: 토큰 비밀 미노출 — dev secret 문자열 응답에 미포함 (INV-7)", async () => {
    await withDemo(async () => {
      const { POST } = await loadMeetups();
      const res = await POST(postReq(makeCreateBody()));
      const text = JSON.stringify(await res.json());
      expect(text).not.toContain("moira-dev-secret");
      expect(text).not.toContain("MOIRA_TOKEN_SECRET");
    });
  });

  it("MT-31: meetupId 형식·유일성 회귀가드(300 표본) — nanoid10 rejection sampling(m-1) 깨짐 감지", async () => {
    await withDemo(async () => {
      const { POST } = await loadMeetups();
      const ids = new Set<string>();
      const re = /^[A-Za-z0-9]{10}$/;
      for (let i = 0; i < 300; i++) {
        const json = await (await POST(postReq(makeCreateBody()))).json();
        const id = json.data.meetupId as string;
        expect(id).toMatch(re); // 출력 계약 유지(영숫자 10자)
        ids.add(id);
      }
      expect(ids.size).toBe(300); // 충돌 0 (편향과 무관하게 계약 보장)
    });
  });

  it("MT-30: live 모드 meta(키 주입, geocode 모킹 실패) → mode=live, data 키집합 demo와 동일 (§6-3)", async () => {
    await withLive(async () => {
      // geocode가 실패해도(혹은 호출돼도) 토큰·meetupId는 생성됨. fetch를 실패로 스텁.
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response("err", { status: 500 }))
      );
      try {
        const { POST } = await loadMeetups();
        const res = await POST(postReq(makeCreateBody()));
        expect(res.status).toBe(201);
        const json = await res.json();
        expect(json.meta.mode).toBe("live");
        // 스키마 동일성: data 키집합이 demo와 동일
        expect(Object.keys(json.data).sort()).toEqual(
          ["hostToken", "inviteToken", "inviteUrl", "meetupId"].sort()
        );
      } finally {
        vi.unstubAllGlobals();
      }
    });
  });
});

// ---------------------------------------------------------------------------
// §2-6b 레이트리밋
// ---------------------------------------------------------------------------
describe("POST /meetups — 레이트리밋 (§2-6b)", () => {
  it("MT-RL-01: NODE_ENV=production + 동일 IP limit 초과 → 마지막 429 E_RATE_LIMIT + Retry-After", async () => {
    await withEnv(
      {
        NODE_ENV: "production",
        ODSAY_API_KEY: undefined,
        KAKAO_REST_KEY: undefined,
        MOIRA_RL_CREATE_PER_MIN: "2",
      },
      async () => {
        const { __resetRateLimit } = await import("@/lib/server/rate-limit");
        __resetRateLimit();
        try {
          const { POST } = await loadMeetups(); // RL_PER_MIN=2 가 모듈 로드시 평가
          const ip = { "x-forwarded-for": "203.0.113.7" };
          const r1 = await POST(postReq(makeCreateBody(), undefined, ip));
          const r2 = await POST(postReq(makeCreateBody(), undefined, ip));
          const r3 = await POST(postReq(makeCreateBody(), undefined, ip));
          expect(r1.status).toBe(201);
          expect(r2.status).toBe(201);
          expect(r3.status).toBe(429);
          const json = await r3.json();
          expect(json.error.code).toBe("E_RATE_LIMIT");
          expect(r3.headers.get("Retry-After")).toBeTruthy();
        } finally {
          __resetRateLimit();
        }
      }
    );
  });

  it("MT-RL-02: NODE_ENV=test(기본) 에서 limit 초과 다회 POST → 전부 201 (skip 회귀가드)", async () => {
    await withEnv(
      { ODSAY_API_KEY: undefined, KAKAO_REST_KEY: undefined, MOIRA_RL_CREATE_PER_MIN: "1" },
      async () => {
        const { POST } = await loadMeetups();
        const ip = { "x-forwarded-for": "203.0.113.8" };
        for (let i = 0; i < 4; i++) {
          const res = await POST(postReq(makeCreateBody(), undefined, ip));
          expect(res.status).toBe(201);
        }
      }
    );
  });

  it("MT-RL-03: 서로 다른 IP 독립 카운트 (한 IP 차단돼도 다른 IP 통과)", async () => {
    await withEnv(
      {
        NODE_ENV: "production",
        ODSAY_API_KEY: undefined,
        KAKAO_REST_KEY: undefined,
        MOIRA_RL_CREATE_PER_MIN: "1",
      },
      async () => {
        const { __resetRateLimit } = await import("@/lib/server/rate-limit");
        __resetRateLimit();
        try {
          const { POST } = await loadMeetups();
          const ipA = { "x-forwarded-for": "198.51.100.1" };
          const ipB = { "x-forwarded-for": "198.51.100.2" };
          expect((await POST(postReq(makeCreateBody(), undefined, ipA))).status).toBe(201);
          expect((await POST(postReq(makeCreateBody(), undefined, ipA))).status).toBe(429); // A 차단
          expect((await POST(postReq(makeCreateBody(), undefined, ipB))).status).toBe(201); // B 통과
        } finally {
          __resetRateLimit();
        }
      }
    );
  });
});
