/**
 * ZV-01 ~ ZV-17 — zod 계약 경계/거부 검증.
 * 대상: src/lib/validation/index.ts
 * QA설계자 케이스 매트릭스 §2.3.
 */
import { describe, it, expect } from "vitest";
import {
  listingSearchQuerySchema,
  reportPayloadSchema,
  uploadInitSchema,
} from "@/lib/validation";

const VALID_UUID = "11111111-1111-4111-8111-111111111111";

describe("listingSearchQuerySchema", () => {
  it("ZV-01: {} → sort 기본 'trust', limit 기본 20", () => {
    const r = listingSearchQuerySchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.sort).toBe("trust");
      expect(r.data.limit).toBe(20);
    }
  });
  it("ZV-02: region:'busan' → 거부(enum 위반)", () => {
    expect(listingSearchQuerySchema.safeParse({ region: "busan" }).success).toBe(false);
  });
  it("ZV-03: limit:'30'(문자) → coerce → 30 통과", () => {
    const r = listingSearchQuerySchema.safeParse({ limit: "30" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.limit).toBe(30);
  });
  it("ZV-04: limit:0 → 거부(min 1)", () => {
    expect(listingSearchQuerySchema.safeParse({ limit: 0 }).success).toBe(false);
  });
  it("ZV-05: limit:51 → 거부(max 50)", () => {
    expect(listingSearchQuerySchema.safeParse({ limit: 51 }).success).toBe(false);
  });
  it("ZV-06: depositMax:-1 → 거부(nonnegative)", () => {
    expect(listingSearchQuerySchema.safeParse({ depositMax: -1 }).success).toBe(false);
  });
  it("추가: limit:50 경계 통과", () => {
    expect(listingSearchQuerySchema.safeParse({ limit: 50 }).success).toBe(true);
  });
  it("추가: minGrade:'gold' 통과 / sort:'recent' 통과", () => {
    expect(listingSearchQuerySchema.safeParse({ minGrade: "gold", sort: "recent" }).success).toBe(
      true,
    );
  });
});

describe("reportPayloadSchema", () => {
  it("ZV-07: listingId:'not-uuid' → 거부(UUID 메시지)", () => {
    const r = reportPayloadSchema.safeParse({ listingId: "not-uuid", reason: "fake_listing" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.message.includes("UUID"))).toBe(true);
    }
  });
  it("ZV-08: reason:'spam' → 거부(enum)", () => {
    expect(
      reportPayloadSchema.safeParse({ listingId: VALID_UUID, reason: "spam" }).success,
    ).toBe(false);
  });
  it("ZV-09: detail 201자 → 거부(max 200)", () => {
    const r = reportPayloadSchema.safeParse({
      listingId: VALID_UUID,
      reason: "fake_listing",
      detail: "가".repeat(201),
    });
    expect(r.success).toBe(false);
  });
  it("ZV-10: detail 200자 정확 → 통과(경계)", () => {
    const r = reportPayloadSchema.safeParse({
      listingId: VALID_UUID,
      reason: "fake_listing",
      detail: "가".repeat(200),
    });
    expect(r.success).toBe(true);
  });
  it("ZV-11: 정상 fake_listing + uuid → 통과", () => {
    const r = reportPayloadSchema.safeParse({ listingId: VALID_UUID, reason: "fake_listing" });
    expect(r.success).toBe(true);
  });
  it("추가: evidencePhotoId 비-uuid → 거부", () => {
    expect(
      reportPayloadSchema.safeParse({
        listingId: VALID_UUID,
        reason: "other",
        evidencePhotoId: "xyz",
      }).success,
    ).toBe(false);
  });
});

describe("uploadInitSchema", () => {
  const validMeta = { name: "a.jpg", size: 1024, mimeType: "image/jpeg" as const };

  it("ZV-12: fileCount:0 → 거부(min 1)", () => {
    const r = uploadInitSchema.safeParse({
      listingId: VALID_UUID,
      fileCount: 0,
      fileMetas: [validMeta],
    });
    expect(r.success).toBe(false);
  });
  it("ZV-13: fileCount:11 → 거부(max 10)", () => {
    const r = uploadInitSchema.safeParse({
      listingId: VALID_UUID,
      fileCount: 11,
      fileMetas: Array.from({ length: 11 }, () => validMeta),
    });
    expect(r.success).toBe(false);
  });
  it("ZV-14: fileMetas size 20MB+1 → 거부(20MB 초과)", () => {
    const r = uploadInitSchema.safeParse({
      listingId: VALID_UUID,
      fileCount: 1,
      fileMetas: [{ name: "big.jpg", size: 20 * 1024 * 1024 + 1, mimeType: "image/jpeg" }],
    });
    expect(r.success).toBe(false);
  });
  it("ZV-14b: size 정확히 20MB → 통과(경계)", () => {
    const r = uploadInitSchema.safeParse({
      listingId: VALID_UUID,
      fileCount: 1,
      fileMetas: [{ name: "ok.jpg", size: 20 * 1024 * 1024, mimeType: "image/jpeg" }],
    });
    expect(r.success).toBe(true);
  });
  it("ZV-15: mimeType image/gif → 거부(허용 4종 외)", () => {
    const r = uploadInitSchema.safeParse({
      listingId: VALID_UUID,
      fileCount: 1,
      fileMetas: [{ name: "a.gif", size: 1024, mimeType: "image/gif" }],
    });
    expect(r.success).toBe(false);
  });
  it("ZV-16: mimeType image/heic → 통과(허용)", () => {
    const r = uploadInitSchema.safeParse({
      listingId: VALID_UUID,
      fileCount: 1,
      fileMetas: [{ name: "a.heic", size: 1024, mimeType: "image/heic" }],
    });
    expect(r.success).toBe(true);
  });
  it("ZV-17: fileMetas size 0 → 거부(positive)", () => {
    const r = uploadInitSchema.safeParse({
      listingId: VALID_UUID,
      fileCount: 1,
      fileMetas: [{ name: "a.jpg", size: 0, mimeType: "image/jpeg" }],
    });
    expect(r.success).toBe(false);
  });
});
