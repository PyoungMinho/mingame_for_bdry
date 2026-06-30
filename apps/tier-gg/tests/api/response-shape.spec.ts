/**
 * A-10: POST /api/v1/find — 200, weights/recommendations/input 포함, 캐시 헤더 없음
 * A-14: 성공 응답은 {success:true, data, error:null} 형식
 * A-15: 에러 응답은 {success:false, data:null, error:{code,message}} 형식
 */
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { POST as findPOST } from "@/app/api/v1/find/route";

function makeReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/v1/find", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/v1/find — 응답 형식", () => {
  it("A-10: 정상 body → 200 + weights/recommendations/input 포함 + Cache-Control 없음", async () => {
    const res = await findPOST(
      makeReq({ role: "developer", task: "coding", budget: "mid" })
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBeNull();
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.error).toBeNull();
    expect(json.data).toHaveProperty("recommendations");
    expect(json.data).toHaveProperty("weights");
    expect(json.data).toHaveProperty("input");
    expect(json.data.weights).toEqual({
      benchmark: 0.4,
      priceEfficiency: 0.4,
      other: 0.2,
    });
  });

  it("A-11: invalid JSON → 400 BAD_REQUEST", async () => {
    const res = await findPOST(makeReq("not a json{"));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.data).toBeNull();
    expect(json.error.code).toBe("BAD_REQUEST");
  });

  it("A-15: validation 실패 → 422 + 공통 에러 형식", async () => {
    const res = await findPOST(
      makeReq({ role: "wizard-king", task: "coding", budget: "mid" })
    );
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.data).toBeNull();
    expect(json.error).toMatchObject({ code: "VALIDATION_ERROR" });
    expect(typeof json.error.message).toBe("string");
  });
});
