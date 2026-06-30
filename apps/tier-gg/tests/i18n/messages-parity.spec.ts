/**
 * I-01: en/ko 메시지 키 셋이 동일해야 한다
 */
import { describe, it, expect } from "vitest";
import en from "../../messages/en.json";
import ko from "../../messages/ko.json";

function collectKeys(obj: unknown, prefix = ""): string[] {
  if (obj === null || typeof obj !== "object") return [prefix];
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const nested = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      out.push(...collectKeys(v, nested));
    } else {
      out.push(nested);
    }
  }
  return out.sort();
}

describe("i18n 메시지 키 parity", () => {
  it("I-01: en.json과 ko.json의 키 셋이 완전히 동일해야 한다", () => {
    const enKeys = collectKeys(en);
    const koKeys = collectKeys(ko);
    const onlyInEn = enKeys.filter((k) => !koKeys.includes(k));
    const onlyInKo = koKeys.filter((k) => !enKeys.includes(k));
    expect({ onlyInEn, onlyInKo }).toEqual({ onlyInEn: [], onlyInKo: [] });
  });
});
