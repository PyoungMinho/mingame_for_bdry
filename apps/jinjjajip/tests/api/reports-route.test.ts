/**
 * API-04 ~ API-08 — POST /api/listings/[id]/reports 핸들러.
 * 대상: src/app/api/listings/[id]/reports/route.ts (Supabase 모킹)
 * 제약 6(신고 즉시 비공개)의 진입 경로 + 인증/검증 분기.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(),
  getRequestUserId: vi.fn(),
}));

import { POST } from "@/app/api/listings/[id]/reports/route";
import { createServerClient, getRequestUserId } from "@/lib/supabase/server";
import { makeSupabaseMock } from "../helpers/supabase-mock";

const UUID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
});

function jsonReq(body: unknown, opts: { badJson?: boolean } = {}) {
  return {
    headers: new Headers(),
    url: "http://localhost/x",
    json: async () => {
      if (opts.badJson) throw new Error("bad json");
      return body;
    },
  } as never;
}

describe("POST reports", () => {
  it("API-04: userId=null(미인증) → 401 UNAUTHORIZED", async () => {
    vi.mocked(getRequestUserId).mockResolvedValue(null);
    const res = await POST(jsonReq({ reason: "fake_listing" }), { params: { id: UUID } });
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("API-05: body JSON 파싱 실패 → 400 PARSE_ERROR", async () => {
    vi.mocked(getRequestUserId).mockResolvedValue("u1");
    const res = await POST(jsonReq(null, { badJson: true }), { params: { id: UUID } });
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error.code).toBe("PARSE_ERROR");
  });

  it("API-06: path id 가 body 와 합쳐져 검증 (path id 우선 주입)", async () => {
    vi.mocked(getRequestUserId).mockResolvedValue("u1");
    const sb = makeSupabaseMock({
      listings: { selectResult: { data: { id: "L1" }, error: null } },
      reports: { insertResult: { data: null, error: null } },
    });
    vi.mocked(createServerClient).mockReturnValue(sb.client as never);
    // body 에 다른 listingId 를 넣어도 path 의 UUID 가 사용되어야 함
    const res = await POST(jsonReq({ reason: "fake_listing", listingId: "spoofed" }), {
      params: { id: UUID },
    });
    expect(res.status).toBe(204);
    const inserted = sb.inserts.reports?.[0] as { listing_id: string; reporter_id: string };
    expect(inserted.listing_id).toBe(UUID); // path 우선
    expect(inserted.reporter_id).toBe("u1"); // 서버 강제(위조 차단)
  });

  it("API-07: 매물 없음 → 404 NOT_FOUND", async () => {
    vi.mocked(getRequestUserId).mockResolvedValue("u1");
    const sb = makeSupabaseMock({ listings: { selectResult: { data: null, error: null } } });
    vi.mocked(createServerClient).mockReturnValue(sb.client as never);
    const res = await POST(jsonReq({ reason: "fake_listing" }), { params: { id: UUID } });
    const body = await res.json();
    expect(res.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("API-08: 정상 insert → 204 No Content", async () => {
    vi.mocked(getRequestUserId).mockResolvedValue("u1");
    const sb = makeSupabaseMock({
      listings: { selectResult: { data: { id: "L1" }, error: null } },
      reports: { insertResult: { data: null, error: null } },
    });
    vi.mocked(createServerClient).mockReturnValue(sb.client as never);
    const res = await POST(jsonReq({ reason: "fake_listing", detail: "허위" }), {
      params: { id: UUID },
    });
    expect(res.status).toBe(204);
    expect(sb.inserts.reports).toHaveLength(1);
  });

  it("잘못된 reason(enum 위반) → 400 VALIDATION_ERROR", async () => {
    vi.mocked(getRequestUserId).mockResolvedValue("u1");
    const sb = makeSupabaseMock({});
    vi.mocked(createServerClient).mockReturnValue(sb.client as never);
    const res = await POST(jsonReq({ reason: "spam" }), { params: { id: UUID } });
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});
