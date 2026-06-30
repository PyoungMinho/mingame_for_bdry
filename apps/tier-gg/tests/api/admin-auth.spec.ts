/**
 * AD-01: Authorization 헤더 없음 → 401
 * AD-03: ADMIN_EMAIL 미설정 → 500
 * AD-04: 유효 JWT, 이메일 불일치 → 403
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// supabaseAdmin.auth.getUser 모킹 — 이메일 시나리오 제어
const getUserMock = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  isMockMode: () => false, // requireAdmin 자체는 모드와 무관, 단 라우트 가드를 우회
  supabaseAdmin: {
    auth: { getUser: (...args: unknown[]) => getUserMock(...args) },
  },
}));

import { requireAdmin } from "@/lib/api/auth";

function makeReq(headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/admin/models", {
    method: "POST",
    headers,
  });
}

const ORIGINAL_ADMIN_EMAIL = process.env.ADMIN_EMAIL;

beforeEach(() => {
  getUserMock.mockReset();
  process.env.ADMIN_EMAIL = "admin@test.local";
});

afterEach(() => {
  process.env.ADMIN_EMAIL = ORIGINAL_ADMIN_EMAIL;
});

describe("requireAdmin — 관리자 인증", () => {
  it("AD-01: Authorization 헤더 없음 → 401 UNAUTHORIZED", async () => {
    const result = await requireAdmin(makeReq());
    // NextResponse 반환 확인
    expect(result).toHaveProperty("status");
    const res = result as Response;
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error.code).toBe("UNAUTHORIZED");
  });

  it("AD-03: ADMIN_EMAIL 미설정 → 500 INTERNAL_ERROR", async () => {
    delete process.env.ADMIN_EMAIL;
    const result = await requireAdmin(
      makeReq({ Authorization: "Bearer fake-token" })
    );
    const res = result as Response;
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error.code).toBe("INTERNAL_ERROR");
  });

  it("AD-04: 유효 JWT지만 ADMIN_EMAIL과 불일치 → 403 FORBIDDEN", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "u-1", email: "intruder@evil.com" } },
      error: null,
    });
    const result = await requireAdmin(
      makeReq({ Authorization: "Bearer valid-token" })
    );
    const res = result as Response;
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error.code).toBe("FORBIDDEN");
  });
});
