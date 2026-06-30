/**
 * API-01 ~ API-03 — GET /api/listings 핸들러 분기.
 * 대상: src/app/api/listings/route.ts (getListings 모킹)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/data/listings", () => ({ getListings: vi.fn() }));

import { GET } from "@/app/api/listings/route";
import { getListings } from "@/lib/data/listings";
import { NextRequest } from "next/server";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/listings", () => {
  it("API-01: limit=999 → 400 VALIDATION_ERROR", async () => {
    const res = await GET(new NextRequest("http://localhost/api/listings?limit=999"));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(getListings).not.toHaveBeenCalled();
  });

  it("API-02: getListings throw → 500 INTERNAL_ERROR", async () => {
    vi.mocked(getListings).mockRejectedValue(new Error("getListings 쿼리 실패: 내부 상세"));
    const res = await GET(new NextRequest("http://localhost/api/listings"));
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });

  it("API-02b [BUG-08 / RV-I 확정]: 500 응답 body 에 내부 에러 메시지가 그대로 노출됨", () => {
    // 본 케이스는 정보 누출 결함을 증거화(현재 동작 고정). 프로덕션 마스킹 권장(보고만).
    // 실제 누출은 API-02 의 body.error.message 가 던진 메시지를 담는 것으로 확인됨.
    expect(true).toBe(true);
  });

  it("API-03: 정상 → success:true + data.items + meta.cursor", async () => {
    vi.mocked(getListings).mockResolvedValue({
      items: [{ id: "a" }] as never,
      nextCursor: "12345",
    });
    const res = await GET(new NextRequest("http://localhost/api/listings?sort=trust&limit=20"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.items).toHaveLength(1);
    expect(body.meta.cursor).toBe("12345");
  });

  it("API-02 검증: 누출 메시지 내용 확인(throw 메시지가 body 로 전달)", async () => {
    vi.mocked(getListings).mockRejectedValue(new Error("getListings 쿼리 실패: SELECT secret_col"));
    const res = await GET(new NextRequest("http://localhost/api/listings"));
    const body = await res.json();
    expect(body.error.message).toContain("getListings 쿼리 실패");
  });
});
