/**
 * Coach chat 스키마 / 페르소나 키 — BUG-004 회귀
 * tokens/persona.ts 는 "sparta", schemas.ts 는 "spartan" → 불일치
 */
import { describe, it, expect } from "vitest";
import { CoachChatRequestSchema } from "@/lib/shared/schemas";
import { PERSONA_KEYS } from "@/components/tokens/persona";

describe("coach-chat — 페르소나 키 정합 (BUG-004)", () => {
  it("스키마의 persona enum 과 tokens/persona.ts PERSONA_KEYS 가 일치해야 한다", () => {
    const schemaKeys = ["mentor", "spartan", "friend"]; // 현 schemas.ts
    expect([...PERSONA_KEYS].sort()).toEqual(schemaKeys.sort());
  });

  it("스키마: persona 미지정 → 기본 mentor", () => {
    const parsed = CoachChatRequestSchema.parse({ message: "hi" });
    expect(parsed.persona).toBe("mentor");
  });

  it("스키마: persona='spartan' 통과", () => {
    const parsed = CoachChatRequestSchema.parse({ message: "hi", persona: "spartan" });
    expect(parsed.persona).toBe("spartan");
  });

  it("스키마: persona='sparta' (오타) reject — schemas/tokens 통일 후 spartan 만 통과", () => {
    const result = CoachChatRequestSchema.safeParse({ message: "hi", persona: "sparta" });
    expect(result.success).toBe(false);
  });

  it("스키마: message 빈 문자열 reject", () => {
    expect(CoachChatRequestSchema.safeParse({ message: "" }).success).toBe(false);
  });

  it("스키마: message 2001자 reject", () => {
    expect(
      CoachChatRequestSchema.safeParse({ message: "a".repeat(2001) }).success
    ).toBe(false);
  });
});
