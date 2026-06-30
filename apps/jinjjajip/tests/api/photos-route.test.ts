/**
 * API-09 ~ API-14 — POST /api/listings/[id]/photos 핸들러 = 허위매물 차단 게이트(보안 핵심).
 * 대상: src/app/api/listings/[id]/photos/route.ts (Supabase 모킹)
 *
 * 제약: tenant + identity_verified + 미신고 매물만 업로드 허용. 응답은 processing(낙관금지).
 * 주의: NextRequest.formData() 가 jsdom+undici 에서 실제 File 파싱 시 멈추는 환경 이슈가 있어,
 *       formData() 를 제어 가능한 stub 으로 주입한다(핸들러는 formData/headers/url 만 사용).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(),
  getRequestUserId: vi.fn(),
}));

import { POST } from "@/app/api/listings/[id]/photos/route";
import { createServerClient, getRequestUserId } from "@/lib/supabase/server";
import { makeSupabaseMock } from "../helpers/supabase-mock";

const LID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
});

function formReq(fileCount: number, fields: Record<string, string> = {}) {
  const fd = new FormData();
  fd.set("fileCount", String(fileCount));
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  for (let i = 0; i < fileCount; i++) {
    fd.set(`file_${i}`, new File(["x"], `a${i}.jpg`, { type: "image/jpeg" }));
  }
  return { headers: new Headers(), url: "http://localhost/x", formData: async () => fd } as never;
}

function profileSel(role: string, identity_verified: boolean) {
  return { selectResult: { data: { role, identity_verified }, error: null } };
}

describe("POST photos — 허위매물 차단 게이트", () => {
  it("API-09: userId=null → 403 (로그인 필요)", async () => {
    vi.mocked(getRequestUserId).mockResolvedValue(null);
    const res = await POST(formReq(1), { params: { id: LID } });
    const body = await res.json();
    expect(res.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("API-10: role!=tenant → 403 (게이트)", async () => {
    vi.mocked(getRequestUserId).mockResolvedValue("u1");
    const sb = makeSupabaseMock({ profiles: profileSel("landlord", true) });
    vi.mocked(createServerClient).mockReturnValue(sb.client as never);
    const res = await POST(formReq(1), { params: { id: LID } });
    expect(res.status).toBe(403);
  });

  it("API-11: identity_verified=false → 403 (게이트)", async () => {
    vi.mocked(getRequestUserId).mockResolvedValue("u1");
    const sb = makeSupabaseMock({ profiles: profileSel("tenant", false) });
    vi.mocked(createServerClient).mockReturnValue(sb.client as never);
    const res = await POST(formReq(1), { params: { id: LID } });
    expect(res.status).toBe(403);
  });

  it("API-11b: 프로필 자체가 없음 → 403", async () => {
    vi.mocked(getRequestUserId).mockResolvedValue("u1");
    const sb = makeSupabaseMock({ profiles: { selectResult: { data: null, error: null } } });
    vi.mocked(createServerClient).mockReturnValue(sb.client as never);
    const res = await POST(formReq(1), { params: { id: LID } });
    expect(res.status).toBe(403);
  });

  it("API-12: listing status=reported → 403 (신고매물 업로드 금지)", async () => {
    vi.mocked(getRequestUserId).mockResolvedValue("u1");
    const sb = makeSupabaseMock({
      profiles: profileSel("tenant", true),
      listings: { selectResult: { data: { id: "L1", status: "reported" }, error: null } },
    });
    vi.mocked(createServerClient).mockReturnValue(sb.client as never);
    const res = await POST(formReq(1), { params: { id: LID } });
    const body = await res.json();
    expect(res.status).toBe(403);
    expect(body.error.message).toContain("신고되거나 내려간 매물");
  });

  it("API-12b: 매물 없음 → 404", async () => {
    vi.mocked(getRequestUserId).mockResolvedValue("u1");
    const sb = makeSupabaseMock({
      profiles: profileSel("tenant", true),
      listings: { selectResult: { data: null, error: null } },
    });
    vi.mocked(createServerClient).mockReturnValue(sb.client as never);
    const res = await POST(formReq(1), { params: { id: LID } });
    expect(res.status).toBe(404);
  });

  it("API-13: fileCount=0 → 400", async () => {
    vi.mocked(getRequestUserId).mockResolvedValue("u1");
    const sb = makeSupabaseMock({
      profiles: profileSel("tenant", true),
      listings: { selectResult: { data: { id: "L1", status: "verified" }, error: null } },
    });
    vi.mocked(createServerClient).mockReturnValue(sb.client as never);
    const res = await POST(formReq(0), { params: { id: LID } });
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("API-13b: fileCount=11 → 400", async () => {
    vi.mocked(getRequestUserId).mockResolvedValue("u1");
    const sb = makeSupabaseMock({
      profiles: profileSel("tenant", true),
      listings: { selectResult: { data: { id: "L1", status: "verified" }, error: null } },
    });
    vi.mocked(createServerClient).mockReturnValue(sb.client as never);
    const res = await POST(formReq(11), { params: { id: LID } });
    expect(res.status).toBe(400);
  });

  it("API-14: 정상 → 202 + status:'processing', done:false (낙관금지) + 비공개 버킷 저장", async () => {
    vi.mocked(getRequestUserId).mockResolvedValue("u1");
    const sb = makeSupabaseMock({
      profiles: profileSel("tenant", true),
      listings: { selectResult: { data: { id: "L1", status: "verified" }, error: null } },
      uploads: { insertSelectSingle: { data: { id: "up1" }, error: null } },
      photos: { insertResult: { data: null, error: null } },
    });
    vi.mocked(createServerClient).mockReturnValue(sb.client as never);
    const res = await POST(formReq(1), { params: { id: LID } });
    const body = await res.json();
    expect(res.status).toBe(202);
    expect(body.data.status).toBe("processing");
    expect(body.data.done).toBe(false);
    // 낙관금지: 점수/배지 미확정
    expect(body.data.scoreDelta).toBeNull();
    expect(body.data.badgeAchieved).toBeNull();
    // 비공개 버킷에 저장됨 (제약 5)
    expect(sb.storageUpload).toHaveBeenCalledTimes(1);
    expect(sb.client.storage.from).toHaveBeenCalledWith("listing-photos-original");
  });
});
