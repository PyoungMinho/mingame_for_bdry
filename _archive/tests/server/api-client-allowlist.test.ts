/**
 * API 클라이언트 경로 화이트리스트 — A-106
 * 차단 경로 호출 시 OreumApiError(E_REDLINE_REJECT)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// useAuthStore 모킹 — getState().accessToken 만 필요
vi.mock("@/lib/store/auth", () => ({
  useAuthStore: {
    getState: () => ({ accessToken: "fake-jwt" }),
  },
}));

import { apiClient, OreumApiError } from "@/lib/api/client";

describe("api-client — 레드라인 차단 경로 (A-106)", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  const blocked = [
    "/api/leaderboard",
    "/api/ranking",
    "/api/compare-others",
    "/api/peer-scores",
    "/api/average-all",
  ];

  for (const path of blocked) {
    it(`A-106: ${path} 차단 → fetch 호출 0회`, async () => {
      await expect(apiClient(path)).rejects.toBeInstanceOf(OreumApiError);
      expect(global.fetch).not.toHaveBeenCalled();
    });
  }

  it("A-106z: /api/checkin 정상 허용 → fetch 호출됨", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ success: true, data: { ok: true } }),
    } as Response);
    const result = await apiClient<{ ok: boolean }>("/api/checkin");
    expect(result).toEqual({ ok: true });
    expect(global.fetch).toHaveBeenCalledOnce();
  });
});
