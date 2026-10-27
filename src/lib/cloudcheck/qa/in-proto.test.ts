// QA IN-08 — 프로토타입 이름 (설계서 §4-4)
// 사용자 · 버킷 · 역할 · 그룹 · 구독 이름이 __proto__ · constructor · prototype · hasOwnProperty · toString이어도
// 정상 판정, 실행 뒤 ({}).polluted === undefined(프로토타입 오염 없음), 마스킹 사본 가명 순번 정상.
import { describe, expect, it } from "vitest";
import { maskedCopy } from "../parse/mask";
import { companyJson, nameText, ruleOf, renameBucket, renameGroup, renameRole, renameUser, runJson } from "./kit";
import type { Json } from "./kit";

const NAMES = ["__proto__", "constructor", "prototype", "hasOwnProperty", "toString"] as const;

describe("IN-08 프로토타입 이름", () => {
  for (const name of NAMES) {
    it(`AWS C: 사용자(ex-employee) · 버킷(logs) · 역할(vendor-access) · 그룹(engineers)을 '${name}'로 — 판정 정상, 오염 0`, () => {
      const f = companyJson("aws", "C");
      renameUser(f, "ex-employee", name);
      renameBucket(f, "amzn-s3-demo-acme-logs", `${name}-bucket`.slice(0, 63));
      renameRole(f, "vendor-access", name);
      renameGroup(f, "engineers", name);
      const run = runJson(f);
      if (run.kind !== "ok") throw new Error(run.kind);
      const r = run.report;
      expect(ruleOf(r, "AWS-MFA-2").items.find((i) => nameText(i) === name)?.status).toBe("risk");                  // 콘솔 + MFA 없음
      expect(ruleOf(r, "AWS-KEY-4").items.find((i) => nameText(i) === name)?.status).toBe("caution");               // 외부 계정, ExternalId 없음
      expect(ruleOf(r, "AWS-KEY-3").items.find((i) => nameText(i) === "dev-kim")?.status).toBe("caution");          // 그룹 이름이 바뀌어도 그룹 정책(PowerUser)이 따라온다
      expect(ruleOf(r, "AWS-STO-2").items.find((i) => nameText(i).startsWith(name))?.status).toBe("clear");
      const masked = maskedCopy(run.input);
      expect(masked.length).toBeGreaterThan(100);
      expect(JSON.parse(masked).schema).toBe("cloudcheck.masked/1");
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
      expect(Object.getPrototypeOf({})).toBe(Object.prototype);
      expect(typeof ({} as Json).hasOwnProperty).toBe("function");
      expect(typeof ({} as Json).toString).toBe("function");
    });
  }
  it("Azure A: 구독 이름 · 스토리지 계정 컨테이너 이름이 '__proto__'·'constructor'여도 판정 정상", () => {
    const f = companyJson("azure", "A");
    (f.scope.subscriptions.value as Json[])[0].name = "__proto__";
    (f.scope.subscriptions.value as Json[])[1].name = "constructor";
    const c = (f.data.storageAccounts as Json[])[0].items[0].containers.value[0];
    c.name = "__proto__";
    const run = runJson(f);
    if (run.kind !== "ok") throw new Error(run.kind);
    expect(ruleOf(run.report, "AZ-LOG-1").items.map(nameText).sort()).toEqual(["__proto__", "constructor"]);
    expect(ruleOf(run.report, "AZ-STO-2").items.find((i) => nameText(i) === "__proto__")?.status).toBe("clear");
    expect(JSON.parse(maskedCopy(run.input)).schema).toBe("cloudcheck.masked/1");
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});
