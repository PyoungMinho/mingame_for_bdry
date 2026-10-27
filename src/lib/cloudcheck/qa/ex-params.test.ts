// QA EX-03 — 파라미터 조합 (설계서 §4-5, G7)
// 파라미터가 있는 모든 카탈로그 키(C · S · E)에 숫자 0 · 1 · 7 · 45 · 90 · 180 · 1000, 시각, 날짜를 넣어 문장을 만든다.
// 기대: findBanned 0(허용 키 2개 제외), '%' 0, 채워지지 않은 자리({이름}) 0, ⟦키⟧ 0.
import { describe, expect, it } from "vitest";
import { ALLOWED_KEYS, findBanned } from "../model/banned-words";
import type { CatalogKey, IsoDate, IsoUtc } from "../model/report";
import { catalogEntries, t } from "../../../app/cloudcheck/_client/i18n/index";
import type { TextParam } from "../../../app/cloudcheck/_client/i18n/index";

const PARAM_RE = /\{([A-Za-z][A-Za-z0-9]*)\}/g;
const NUMBERS = [0, 1, 7, 45, 90, 180, 1000];
const OTHERS: readonly TextParam[] = [{ t: "2026-10-19T03:15:00Z" as IsoUtc }, { d: "2026-10-19" as IsoDate }, "22/tcp", "ap-northeast-2"];

const withParams = (["components", "screens", "engine"] as const).flatMap((file) => catalogEntries(file).filter(([, v]) => PARAM_RE.test(v)).map(([k, v]) => [file, k, v] as const));

describe("EX-03 파라미터가 있는 카탈로그 키 × 값 조합", () => {
  it("대상 키가 충분하다(세 파일 모두)", () => {
    expect(withParams.length).toBeGreaterThan(100);
    expect(new Set(withParams.map((x) => x[0])).size).toBe(3);
  });
  it("숫자 · 시각 · 날짜 · 상수를 넣은 문장에 금지어 · '%' · 빈 자리 · ⟦키⟧가 없다", () => {
    const bad: string[] = [];
    let n = 0;
    for (const [, key, template] of withParams) {
      if (key in ALLOWED_KEYS) continue;
      const names = [...template.matchAll(PARAM_RE)].map((m) => m[1]);
      for (const v of [...NUMBERS, ...OTHERS]) {
        const params = Object.fromEntries(names.map((x) => [x, v]));
        const text = t(key as CatalogKey, params);
        n++;
        const hits = findBanned(text).map((h) => `${h.label}'${h.match}'`);
        if (hits.length > 0) bad.push(`${key} (${JSON.stringify(v)}): ${hits.join(", ")} — ${text.slice(0, 80)}`);
        if (/\{[A-Za-z][A-Za-z0-9]*\}/.test(text)) bad.push(`${key}: 빈 자리 — ${text.slice(0, 80)}`);
        if (text.includes("⟦")) bad.push(`${key}: ⟦키⟧`);
      }
    }
    expect(n).toBeGreaterThan(800);
    expect([...new Set(bad)]).toEqual([]);
  });
});
