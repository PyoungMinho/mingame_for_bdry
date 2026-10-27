// QA FO-08 · FO-09 — 백엔드 요청 사례(설계서 §4-1, §7 백엔드 1·2)
// FO-08: 백엔드가 새로 만든 micro 사례(AZ-STO-2/access-unreadable · AWS-KEY-4/wildcard-action · AZ-LOG-2/audit-group)에
//        FO-01(증거 제거)·FO-03(중첩 슬롯) 변이를 더해도 단조성이 지켜지고, 값 변종(publicAccess · 신뢰 문장 Action)이 기대대로 판정된다.
// FO-09: 입력 안전 사례 — 활성 리전 빈 배열 · 신뢰 정책이 객체 하나(수집기 trust:null) · publicAccess null·모르는 값 · 와일드카드 액션.
import { describe, expect, it } from "vitest";
import type { NormalizedInput } from "../contract/normalized";
import { judge } from "../engine/judge";
import { evidenceRemovingMutations } from "../fixtures/mutate";
import { resolveFixture } from "../fixtures/micro";
import type { Report, RuleId } from "../model/report";
import { companyJson, label, monotoneViolations, nameText, okReport, ruleOf, runJson } from "./kit";
import type { Json } from "./kit";
import { isNested, replaceSlot, slotPaths } from "./nested";

const MICROS: readonly (readonly [string, RuleId, string])[] = [
  ["micro/AZ-STO-2/access-unreadable", "AZ-STO-2", "unknown"],
  ["micro/AWS-KEY-4/wildcard-action", "AWS-KEY-4", "risk"],
  ["micro/AZ-LOG-2/audit-group", "AZ-LOG-2", "unknown"],
];

function mutationViolations(base: NormalizedInput, what: string): { n: number; v: string[] } {
  const before = judge(base);
  const v: string[] = [];
  let n = 0;
  for (const m of evidenceRemovingMutations(base)) {
    let mutated: NormalizedInput;
    try { mutated = m.apply(base); } catch { continue; }
    n++;
    v.push(...monotoneViolations(before, judge(mutated), `${what} ${m.name}`));
  }
  for (const p of slotPaths(base).filter(isNested)) for (const kind of ["missing", "partial"] as const) {
    const mutated = replaceSlot(base, p, kind);
    if (mutated === null) continue;
    n++;
    v.push(...monotoneViolations(before, judge(mutated), `${what} ${p.join(".")} → ${kind}`));
  }
  return { n, v };
}

describe("FO-08 백엔드 새 micro 사례 — 기대 상태 + 변이 단조성", () => {
  for (const [ref, rule, want] of MICROS) {
    it(`${ref}: 기대 상태 ${want}`, () => {
      expect(ruleOf(judge(resolveFixture(ref)), rule).status).toBe(want);
    });
    it(`${ref}: FO-01·FO-03 변이 뒤에도 이상 없음·해당 없음이 새로 생기지 않는다`, () => {
      const { n, v } = mutationViolations(resolveFixture(ref), ref);
      expect(v).toEqual([]);
      expect(n).toBeGreaterThan(3);
    });
  }
});

/* ───────── FO-08 값 변종 ───────── */
const azureContainers = (f: Json): Json[] => (f.data.storageAccounts as Json[]).flatMap((p) => p.items ?? []).flatMap((a: Json) => a.containers?.value ?? []);
const containerStatus = (r: Report, name: string): string[] => ruleOf(r, "AZ-STO-2").items.filter((i) => nameText(i) === name).map((i) => i.status);

describe("FO-08 publicAccess 변종(Azure A의 컨테이너 app-data)", () => {
  const cases: readonly (readonly [string | null, string])[] = [["None", "clear"], ["none ", "unknown"], ["Private", "unknown"], ["", "unknown"], [null, "unknown"], ["Blob", "clear"], ["Container", "clear"]];
  for (const [v, want] of cases) {
    it(`publicAccess ${JSON.stringify(v)} → ${want}${v === "Blob" || v === "Container" ? "(계정 allowBlobPublicAccess=false가 막는다: account-blocks)" : ""}`, () => {
      const f = companyJson("azure", "A");
      azureContainers(f).find((c) => c.name === "app-data").publicAccess = v;
      expect(containerStatus(okReport(runJson(f)), "app-data")).toEqual([want]);
    });
  }
  it("같은 변종이 계정 allowBlobPublicAccess=true에서는 Blob·Container = 위험, 모르는 값 = 확인 불가(위험·이상 없음 아님)", () => {
    for (const [v, want] of [["Blob", "risk"], ["Container", "risk"], ["Private", "unknown"], ["", "unknown"]] as const) {
      const f = companyJson("azure", "A");
      const acct = (f.data.storageAccounts as Json[]).flatMap((p) => p.items ?? []).find((a: Json) => a.name === "stbanjeutapp01");
      acct.allowBlobPublicAccess = true;
      acct.containers.value.find((c: Json) => c.name === "app-data").publicAccess = v;
      expect(containerStatus(okReport(runJson(f)), "app-data"), v).toEqual([want]);
    }
  });
});

describe("FO-08 신뢰 문장 Action 변종(C cross-acct-admin: Principal '*', 조건 없음)", () => {
  const role = (f: Json): Json => (f.data.iamRoles.value as Json[]).find((r) => r.roleName === "cross-acct-admin");
  const status = (actions: string[]): string => {
    const f = companyJson("aws", "C");
    role(f).trust[0].actions = actions;
    return ruleOf(okReport(runJson(f)), "AWS-KEY-4").items.filter((i) => nameText(i) === "cross-acct-admin").map((i) => i.status).join(",");
  };
  for (const a of ["sts:Assume*", "sts:AssumeRole?ithSAML", "*", "STS:ASSUMEROLE", "sts:*", "sts:AssumeRoleWithWebIdentity", "sts:AssumeRole+"]) {
    it(`Action ${JSON.stringify(a)} → 위험(역할 맡기를 덮거나 예상 밖 글자)`, () => expect(status([a])).toBe("risk"));
  }
  for (const a of [["sts:TagSession"], ["iam:PassRole"], ["sts:TagSession", "sts:SetSourceIdentity"]]) {
    it(`Action ${JSON.stringify(a)}만 → 이상 없음(역할 맡기 문장이 아님 — 설계 의도)`, () => expect(status(a)).toBe("clear"));
  }
  it("Action 빈 목록 → 위험(액션 미지정 문장은 덮는 것으로 본다)", () => expect(status([])).toBe("risk"));
});

/* ───────── FO-09 입력 안전 사례 ───────── */
describe("FO-09 입력 안전 사례", () => {
  it("활성 리전이 빈 배열(empty 영수증)이면 창문은 확인 불가(scope-unproven)", () => {
    const f = companyJson("aws", "A");
    f.scope.regions.value = [];
    const rc = (f.receipts as Json[]).find((r) => r.id === f.scope.regions.receipt);
    rc.result = "empty"; rc.count = 0;
    const r = okReport(runJson(f));
    expect(label(ruleOf(r, "AWS-NET-1"))).toBe("unknown(scope-unproven)");
  });
  it("신뢰 정책이 객체 하나라서 수집기가 trust:null로 둔 역할은 확인 불가, 다른 역할 판정은 그대로", () => {
    const f = companyJson("aws", "C");
    (f.data.iamRoles.value as Json[]).find((r) => r.roleName === "vendor-access").trust = null;
    const r = okReport(runJson(f));
    const items = Object.fromEntries(ruleOf(r, "AWS-KEY-4").items.map((i) => [nameText(i), `${i.status}:${i.why.code}`]));
    expect(items["vendor-access"]).toBe("unknown:value-unrecognized");
    expect(items["cross-acct-admin"]).toBe("risk:AWS-KEY-4:trust-wildcard-open");
    expect(ruleOf(r, "AWS-KEY-4").status).toBe("risk");
  });
  it("publicAccess null·모르는 값 → 컨테이너 확인 불가 → AZ-STO-2 룰은 이상 없음이 아니다", () => {
    for (const v of [null, "zzz"]) {
      const f = companyJson("azure", "A");
      azureContainers(f)[0].publicAccess = v;
      const r = okReport(runJson(f));
      expect(ruleOf(r, "AZ-STO-2").status, String(v)).toBe("unknown");
    }
  });
  it("와일드카드 액션('*')을 가진 Principal '*' 신뢰 문장은 위험", () => {
    const f = companyJson("aws", "A");
    const lambda = (f.data.iamRoles.value as Json[]).find((r) => r.roleName === "app-lambda-exec");
    lambda.trust = [{ effect: "Allow", actions: ["*"], notPrincipal: false, principal: { wildcard: true, aws: [], service: [], federated: [], canonicalUserCount: 0 }, conditionKeys: [] }];
    expect(ruleOf(okReport(runJson(f)), "AWS-KEY-4").status).toBe("risk");
  });
});
