/**
 * API-15 ~ API-17 — GET /api/uploads/[uploadId] 폴링 응답.
 * 대상: src/app/api/uploads/[uploadId]/route.ts (Supabase 모킹)
 * 타인 업로드 차단(uploader_id=userId) + done 전 scoreDelta/badge null(낙관금지).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(),
  getRequestUserId: vi.fn(),
}));

import { GET } from "@/app/api/uploads/[uploadId]/route";
import { createServerClient, getRequestUserId } from "@/lib/supabase/server";
import { makeSupabaseMock } from "../helpers/supabase-mock";

beforeEach(() => {
  vi.clearAllMocks();
});

const req = { headers: new Headers(), url: "http://localhost/x" } as never;

function uploadRow(status: "processing" | "error" | "done", extra: Record<string, unknown> = {}) {
  return {
    id: "up1",
    listing_id: "L1",
    accepted_count: 1,
    rejected_count: 0,
    status,
    score_delta: null,
    badge_achieved: null,
    ...extra,
  };
}

describe("GET uploads/[id]", () => {
  it("API-15: uploader_id≠userId → 404 (타인 업로드 차단; 쿼리 eq 필터로 null 반환)", async () => {
    vi.mocked(getRequestUserId).mockResolvedValue("u1");
    const sb = makeSupabaseMock({ uploads: { selectResult: { data: null, error: null } } });
    vi.mocked(createServerClient).mockReturnValue(sb.client as never);
    const res = await GET(req, { params: { uploadId: "up1" } });
    const body = await res.json();
    expect(res.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("미인증(userId=null) → 401", async () => {
    vi.mocked(getRequestUserId).mockResolvedValue(null);
    const res = await GET(req, { params: { uploadId: "up1" } });
    expect(res.status).toBe(401);
  });

  it("API-16: status=done → done:true + scoreDelta/badge 채움", async () => {
    vi.mocked(getRequestUserId).mockResolvedValue("u1");
    const sb = makeSupabaseMock({
      uploads: {
        selectResult: {
          data: uploadRow("done", { score_delta: 30, badge_achieved: "gold" }),
          error: null,
        },
      },
    });
    vi.mocked(createServerClient).mockReturnValue(sb.client as never);
    const res = await GET(req, { params: { uploadId: "up1" } });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.done).toBe(true);
    expect(body.data.scoreDelta).toBe(30);
    expect(body.data.badgeAchieved).toBe("gold");
  });

  it("API-17: status=processing → done:false + scoreDelta=null (낙관금지)", async () => {
    vi.mocked(getRequestUserId).mockResolvedValue("u1");
    // 서버에 score_delta 가 잘못 채워져 있어도 done 전이면 null 로 마스킹되어야 함
    const sb = makeSupabaseMock({
      uploads: {
        selectResult: {
          data: uploadRow("processing", { score_delta: 99, badge_achieved: "gold" }),
          error: null,
        },
      },
    });
    vi.mocked(createServerClient).mockReturnValue(sb.client as never);
    const res = await GET(req, { params: { uploadId: "up1" } });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.done).toBe(false);
    expect(body.data.scoreDelta).toBeNull();
    expect(body.data.badgeAchieved).toBeNull();
  });

  it("status=error → status:'error', done:false", async () => {
    vi.mocked(getRequestUserId).mockResolvedValue("u1");
    const sb = makeSupabaseMock({
      uploads: { selectResult: { data: uploadRow("error"), error: null } },
    });
    vi.mocked(createServerClient).mockReturnValue(sb.client as never);
    const res = await GET(req, { params: { uploadId: "up1" } });
    const body = await res.json();
    expect(body.data.status).toBe("error");
    expect(body.data.done).toBe(false);
  });
});
