/**
 * POST/GET /api/exam/generate — 라우트 핸들러 직접 호출 (설계서 §2.7~§2.8)
 * Next 서버 미기동. route.ts의 export 함수에 new Request 주입.
 * RT-19는 generateVariants throw 모킹. RT-20/GT-03은 키 비노출 검증.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { withExamKey, FAKE_LIVE_KEY } from "./_helpers";

// route 모듈을 동적 import 하여 일부 테스트에서 generateVariants를 모킹할 수 있게 한다.
async function loadRoute() {
  return import("@/app/api/exam/generate/route");
}

/** JSON body로 POST Request 생성 (라우트는 NextRequest 시그니처지만 표준 Request로 충분) */
function postReq(body: unknown, rawBodyOverride?: string): NextRequest {
  const init: RequestInit = {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: rawBodyOverride !== undefined ? rawBodyOverride : JSON.stringify(body),
  };
  return new Request("http://x/api/exam/generate", init) as unknown as NextRequest;
}

const validBody = {
  source: "다음 식의 값을 구하시오.",
  subject: "math",
  difficulty: "medium",
  type: "multiple_choice",
  count: 3,
};

beforeEach(() => {
  vi.resetModules();
});

// ---------------------------------------------------------------------------
// §2.7 POST — 정상/검증
// ---------------------------------------------------------------------------
describe("POST /api/exam/generate — 정상 & zod 검증", () => {
  it("RT-01: 유효 입력 → 200, {mode:demo, variants(3), sourceSummary}", async () => {
    await withExamKey(undefined, async () => {
      const { POST } = await loadRoute();
      const res = await POST(postReq(validBody));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.mode).toBe("demo");
      expect(json.variants).toHaveLength(3);
      expect(json.sourceSummary).toBeTruthy();
    });
  });

  it("RT-02: 빈 body {} → 400 E_VALIDATION, subject/difficulty/type 에러", async () => {
    const { POST } = await loadRoute();
    const res = await POST(postReq({}));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("E_VALIDATION");
    expect(json.error.subject).toBeDefined();
    expect(json.error.difficulty).toBeDefined();
    expect(json.error.type).toBeDefined();
  });

  it("RT-03: source 공백+이미지 없음 → 400 E_VALIDATION, error.source", async () => {
    const { POST } = await loadRoute();
    const res = await POST(
      postReq({ source: "   ", subject: "math", difficulty: "easy", type: "short_answer", count: 1 })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("E_VALIDATION");
    expect(json.error.source).toBeDefined();
  });

  it("RT-04: count0 → 400 E_VALIDATION (zod min1). BUG H-3 비대칭(엔진은 GV-04에서 3 통과)", async () => {
    const { POST } = await loadRoute();
    const res = await POST(postReq({ ...validBody, count: 0 }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("E_VALIDATION");
    // ↑ 라우트는 거부. 엔진 직접호출은 length 3 (engine.test GV-04). 같은 입력 다른 결과 = H-3.
  });

  it("RT-05: count11 → 400 E_VALIDATION (zod max10)", async () => {
    const { POST } = await loadRoute();
    const res = await POST(postReq({ ...validBody, count: 11 }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("E_VALIDATION");
  });

  it("RT-06: count '3' 문자열 → coerce → 200, length 3", async () => {
    await withExamKey(undefined, async () => {
      const { POST } = await loadRoute();
      const res = await POST(postReq({ ...validBody, count: "3" }));
      expect(res.status).toBe(200);
      expect((await res.json()).variants).toHaveLength(3);
    });
  });

  it("RT-07: count2.5 → 400 (zod int 위반). 엔진 Math.round와 다른 처리(H-3)", async () => {
    const { POST } = await loadRoute();
    const res = await POST(postReq({ ...validBody, count: 2.5 }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("E_VALIDATION");
  });

  it("RT-08: subject 'history' (비-enum) → 400, error.subject", async () => {
    const { POST } = await loadRoute();
    const res = await POST(postReq({ ...validBody, subject: "history" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error.subject).toBeDefined();
  });

  it("RT-09: difficulty 'insane' → 400, error.difficulty", async () => {
    const { POST } = await loadRoute();
    const res = await POST(postReq({ ...validBody, difficulty: "insane" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error.difficulty).toBeDefined();
  });

  it("RT-10: type 'essay' → 400, error.type", async () => {
    const { POST } = await loadRoute();
    const res = await POST(postReq({ ...validBody, type: "essay" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error.type).toBeDefined();
  });

  it("RT-11: source 길이 8000 정확 → 200", async () => {
    await withExamKey(undefined, async () => {
      const { POST } = await loadRoute();
      const res = await POST(postReq({ ...validBody, source: "가".repeat(8000) }));
      expect(res.status).toBe(200);
    });
  });

  it("RT-12: source 길이 8001 → 400 E_VALIDATION", async () => {
    const { POST } = await loadRoute();
    const res = await POST(postReq({ ...validBody, source: "가".repeat(8001) }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("E_VALIDATION");
  });

  it("RT-13: imageBase64 8_000_000 + mediaType 유효 + source '' → 200", async () => {
    await withExamKey(undefined, async () => {
      const { POST } = await loadRoute();
      const res = await POST(
        postReq({
          source: "",
          imageBase64: "a".repeat(8_000_000),
          imageMediaType: "image/png",
          subject: "math",
          difficulty: "medium",
          type: "multiple_choice",
          count: 1,
        })
      );
      expect(res.status).toBe(200);
    });
  });

  it("RT-14: imageBase64 8_000_001 → 400 E_VALIDATION", async () => {
    const { POST } = await loadRoute();
    const res = await POST(
      postReq({
        source: "",
        imageBase64: "a".repeat(8_000_001),
        imageMediaType: "image/png",
        subject: "math",
        difficulty: "medium",
        type: "multiple_choice",
        count: 1,
      })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("E_VALIDATION");
  });

  it("RT-15: imageBase64 있는데 mediaType 없음 → 400, error.imageMediaType", async () => {
    const { POST } = await loadRoute();
    const res = await POST(
      postReq({
        source: "",
        imageBase64: "abc",
        subject: "math",
        difficulty: "medium",
        type: "multiple_choice",
        count: 1,
      })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error.imageMediaType).toBeDefined();
  });

  it("RT-16: imageMediaType 'image/gif' (enum 외) → 400 E_VALIDATION", async () => {
    const { POST } = await loadRoute();
    const res = await POST(
      postReq({
        source: "x",
        imageBase64: "abc",
        imageMediaType: "image/gif",
        subject: "math",
        difficulty: "medium",
        type: "multiple_choice",
        count: 1,
      })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("E_VALIDATION");
  });

  it("RT-17: 깨진 JSON 본문 → 400 E_BAD_JSON (catch 분기)", async () => {
    const { POST } = await loadRoute();
    const res = await POST(postReq(null, "{not json"));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("E_BAD_JSON");
  });

  it("RT-18: 빈 본문 → 400 E_BAD_JSON", async () => {
    const { POST } = await loadRoute();
    const res = await POST(postReq(null, ""));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("E_BAD_JSON");
  });

  it("RT-21: source에 <script> → 200 통과(서버는 sanitize 안 함, 렌더 책임). M-4 회귀가드", async () => {
    await withExamKey(undefined, async () => {
      const { POST } = await loadRoute();
      const res = await POST(
        postReq({ ...validBody, source: "<script>alert(1)</script>", count: 1 })
      );
      expect(res.status).toBe(200);
    });
  });

  it("RT-22: source에 이모지/유니코드 7999자 → 200 (코드유닛 길이 기준)", async () => {
    await withExamKey(undefined, async () => {
      const { POST } = await loadRoute();
      // 이모지는 서로게이트 페어(2 코드유닛). 7999 코드유닛 < 8000 max.
      const src = "가".repeat(7999);
      const res = await POST(postReq({ ...validBody, source: src, count: 1 }));
      expect(res.status).toBe(200);
    });
  });

  it("RT-23: unitId 지정 → 200 & 변형이 그 unitId를 에코백(해자 2 통로)", async () => {
    await withExamKey(undefined, async () => {
      const { POST } = await loadRoute();
      const res = await POST(postReq({ ...validBody, unitId: "math1-sequence", count: 2 }));
      expect(res.status).toBe(200);
      const json = await res.json();
      json.variants.forEach((v: { unitId?: string }) => expect(v.unitId).toBe("math1-sequence"));
    });
  });

  it("RT-24: unitId 65자(>64) → 400 E_VALIDATION", async () => {
    const { POST } = await loadRoute();
    const res = await POST(postReq({ ...validBody, unitId: "a".repeat(65) }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("E_VALIDATION");
  });

  it("RT-25: unitId 64자 경계 → 200(통과)", async () => {
    await withExamKey(undefined, async () => {
      const { POST } = await loadRoute();
      const res = await POST(postReq({ ...validBody, unitId: "a".repeat(64), count: 1 }));
      expect(res.status).toBe(200);
    });
  });
});

// ---------------------------------------------------------------------------
// RT-19: generateVariants throw → 502 E_GENERATE (모킹)
// ---------------------------------------------------------------------------
describe("POST — 엔진 throw 처리 (RT-19)", () => {
  it("RT-19: generateVariants가 throw하면 502 E_GENERATE + 에러 메시지", async () => {
    vi.resetModules();
    vi.doMock("@/lib/server/exam-engine", () => ({
      detectMode: () => "demo",
      generateVariants: vi.fn().mockRejectedValue(new Error("엔진 폭발")),
    }));
    const { POST } = await import("@/app/api/exam/generate/route");
    const res = await POST(postReq(validBody));
    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.code).toBe("E_GENERATE");
    expect(json.error).toBe("엔진 폭발");
    vi.doUnmock("@/lib/server/exam-engine");
  });
});

// ---------------------------------------------------------------------------
// RT-20: 보안 — 응답 본문에 키 원문 미포함
// ---------------------------------------------------------------------------
describe("POST — 키 비노출 (RT-20)", () => {
  it("RT-20: live env(가짜키)에서도 응답 본문에 키 원문 미포함", async () => {
    // live 경로지만 SDK는 모킹해서 키가 응답에 흘러가는지만 본다.
    vi.resetModules();
    const createMock = vi.fn().mockResolvedValue({
      content: [
        {
          type: "text",
          text: '"variants":[{"stem":"q","answer":"③","choices":[{"label":"③","text":"x"}]}]}',
        },
      ],
    });
    vi.doMock("@anthropic-ai/sdk", () => ({
      default: class {
        messages = { create: createMock };
        constructor(public o: unknown) {}
      },
    }));
    await withExamKey(FAKE_LIVE_KEY, async () => {
      const { POST } = await import("@/app/api/exam/generate/route");
      const res = await POST(postReq({ ...validBody, count: 1 }));
      const text = JSON.stringify(await res.json());
      expect(text).not.toContain(FAKE_LIVE_KEY);
      expect(text).not.toContain("sk-ant");
    });
    vi.doUnmock("@anthropic-ai/sdk");
  });

  it("RT-20b: 400 에러 응답에도 키 원문 미포함", async () => {
    await withExamKey(FAKE_LIVE_KEY, async () => {
      const { POST } = await loadRoute();
      const res = await POST(postReq({}));
      const text = JSON.stringify(await res.json());
      expect(text).not.toContain("sk-ant");
    });
  });
});

// ---------------------------------------------------------------------------
// §2.8 GET — 모드 조회
// ---------------------------------------------------------------------------
describe("GET /api/exam/generate — 모드 조회", () => {
  it("GT-01: 키 미설정 → 200 {mode:demo}, mode 외 키 없음", async () => {
    await withExamKey(undefined, async () => {
      const { GET } = await loadRoute();
      const res = await GET();
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({ mode: "demo" });
      expect(Object.keys(json)).toEqual(["mode"]);
    });
  });

  it("GT-02: 실키(가짜) set → 200 {mode:live}", async () => {
    await withExamKey(FAKE_LIVE_KEY, async () => {
      const { GET } = await loadRoute();
      const res = await GET();
      expect((await res.json()).mode).toBe("live");
    });
  });

  it("GT-03: 보안 — 실키 set 시 응답에 키 원문 미포함", async () => {
    await withExamKey(FAKE_LIVE_KEY, async () => {
      const { GET } = await loadRoute();
      const res = await GET();
      const text = JSON.stringify(await res.json());
      expect(text).not.toContain(FAKE_LIVE_KEY);
      expect(text).not.toContain("sk-ant");
    });
  });

  it("GT-04: placeholder 키 → {mode:demo} (placeholder 노출 안됨)", async () => {
    await withExamKey("sk-ant-your-key-here", async () => {
      const { GET } = await loadRoute();
      const res = await GET();
      expect((await res.json()).mode).toBe("demo");
    });
  });
});
