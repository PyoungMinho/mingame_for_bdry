// QA FO-07 — 제외(해당 없음) 경로 전수 (설계서 §4-1 · §6-3, 백엔드 요청 5)
// 제외 7곳: AWS-MFA-1(루트 자격증명 없음) · MFA-2(콘솔 비밀번호 없음) · KEY-1(비활성 키) · KEY-2(활성 자격증명 없음) · KEY-3(활성 키 없음 · 관리자 아님) · KEY-4(서비스 연결 역할)
// 각 제외의 결정 슬롯을 missing(denied · field-missing · value-unrecognized) · partial · none · 보고서 신선도 실패로 바꾸면,
// 그 대상은 '제외'가 아니라 리포트에 남아야 하고(확인 불가 또는 위험·주의) 이상 없음이 아니어야 하며, 룰은 해당 없음·이상 없음이 되면 안 된다.
import { describe, expect, it } from "vitest";
import type { NormalizedInput } from "../contract/normalized";
import { judge } from "../engine/judge";
import { deepFreeze } from "../fixtures/invariants";
import type { Report, RuleId } from "../model/report";
import { companyCsv, companyJson, okReport, ruleOf, runCsv, runJson, setAt } from "./kit";
import type { Json, Path, Run } from "./kit";
import { replaceSlot } from "./nested";

const ACCT = "111122223333";
const k = (type: string, id: string): string => `aws|${ACCT}|${type}|-|${id}`;
const inputOf = (r: Run): NormalizedInput => { if (r.kind !== "ok") throw new Error(r.kind); return r.input; };

/** C 변형: ci-runner의 CI02 키를 비활성으로(KEY-1 제외), both = 두 키 모두 비활성(KEY-2 제외) */
function cVariant(both: boolean): NormalizedInput {
  const f = companyJson("aws", "C");
  const ci = (f.data.iamUsers.items as Json[]).find((u) => u.userName === "ci-runner");
  for (const key of ci.accessKeys.value as Json[]) if (both || key.idSuffix === "CI02") key.status = "Inactive";
  return inputOf(runJson(f));
}
/** C 변형: 관리자 admin-lee의 키 LE01을 비활성으로 → KEY-3:77(관리자인데 활성 키 없음) 제외. ci-runner처럼 관리자가 아닌 사용자는 키 상태와 무관하게 :112(관리자 아님)로 제외되는 것이 맞다 */
function adminNoActiveKey(): NormalizedInput {
  const f = companyJson("aws", "C");
  const admin = (f.data.iamUsers.items as Json[]).find((u) => u.userName === "admin-lee");
  for (const key of admin.accessKeys.value as Json[]) key.status = "Inactive";
  return inputOf(runJson(f));
}
const userIdx = (input: NormalizedInput, door: "mfa" | "key", name: string): number => {
  const sel = input.doors[door] as unknown as { data: { users: { value: { name: string }[] } } };
  const i = sel.data.users.value.findIndex((u) => u.name === name);
  if (i < 0) throw new Error(`사용자 없음 ${name}`);
  return i;
};
const keyIdx = (input: NormalizedInput, user: number, suffix: string): number => {
  const sel = input.doors.key as unknown as { data: { users: { value: { keys: { value: { idSuffix: string | null; slot: number | null }[] } }[] } } };
  const i = sel.data.users.value[user].keys.value.findIndex((x) => x.idSuffix === suffix || `slot${x.slot}` === suffix);
  if (i < 0) throw new Error(`키 없음 ${suffix}`);
  return i;
};

interface Site { readonly title: string; readonly rule: RuleId; readonly member: string; readonly input: () => NormalizedInput; readonly slots: (i: NormalizedInput) => Path[]; readonly fresh: boolean }
const SITES: readonly Site[] = [
  { title: "AWS-MFA-1:141 루트 자격증명 없음(D, 수집기)", rule: "AWS-MFA-1", member: k("root", "root"), input: () => inputOf(runJson(companyJson("aws", "D"))),
    slots: () => [["doors", "mfa", "data", "root", "value", "passwordEnabled"], ["doors", "mfa", "data", "root", "value", "keys"]], fresh: true },
  { title: "AWS-MFA-1:141 루트 자격증명 없음(D, 보고서 CSV)", rule: "AWS-MFA-1", member: k("root", "root"), input: () => inputOf(runCsv(companyCsv("D"))),
    slots: () => [["doors", "mfa", "data", "root", "value", "passwordEnabled"], ["doors", "mfa", "data", "root", "value", "keys"]], fresh: false },
  { title: "AWS-MFA-2:74 콘솔 비밀번호 없음(C ci-runner)", rule: "AWS-MFA-2", member: k("iam-user", "ci-runner"), input: () => inputOf(runJson(companyJson("aws", "C"))),
    slots: (i) => [["doors", "mfa", "data", "users", "value", userIdx(i, "mfa", "ci-runner"), "passwordEnabled"]], fresh: true },
  { title: "AWS-KEY-1:78 비활성 키(C ci-runner CI02)", rule: "AWS-KEY-1", member: k("access-key", "ci-runner/CI02"), input: () => cVariant(false),
    slots: (i) => { const u = userIdx(i, "key", "ci-runner"); return [["doors", "key", "data", "users", "value", u, "keys", "value", keyIdx(i, u, "CI02"), "active"]]; }, fresh: false },
  { title: "AWS-KEY-2:136 활성 자격증명 없음(C ci-runner 두 키 비활성)", rule: "AWS-KEY-2", member: k("iam-user", "ci-runner"), input: () => cVariant(true),
    slots: (i) => { const u = userIdx(i, "key", "ci-runner"); return [["doors", "key", "data", "users", "value", u, "passwordEnabled"], ["doors", "key", "data", "users", "value", u, "keys"], ["doors", "key", "data", "users", "value", u, "keys", "value", keyIdx(i, u, "CI01"), "active"]]; }, fresh: true },
  { title: "AWS-KEY-3:77 활성 키 없음(C ex-employee)", rule: "AWS-KEY-3", member: k("iam-user", "ex-employee"), input: () => inputOf(runJson(companyJson("aws", "C"))),
    slots: (i) => [["doors", "key", "data", "users", "value", userIdx(i, "key", "ex-employee"), "keys"]], fresh: false },
  { title: "AWS-KEY-3:77 활성 키 없음(C admin-lee 키 비활성 — 키 목록·키 상태 슬롯)", rule: "AWS-KEY-3", member: k("iam-user", "admin-lee"), input: adminNoActiveKey,
    slots: (i) => { const u = userIdx(i, "key", "admin-lee"); return [["doors", "key", "data", "users", "value", u, "keys"], ["doors", "key", "data", "users", "value", u, "keys", "value", keyIdx(i, u, "LE01"), "active"]]; }, fresh: false },
  { title: "AWS-KEY-3:112 관리자 아님(C ci-runner)", rule: "AWS-KEY-3", member: k("iam-user", "ci-runner"), input: () => inputOf(runJson(companyJson("aws", "C"))),
    slots: (i) => { const u = userIdx(i, "key", "ci-runner"); return [["doors", "key", "data", "users", "value", u, "attachedPolicyArns"], ["doors", "key", "data", "users", "value", u, "groupNames"]]; }, fresh: false },
  { title: "AWS-KEY-3:112 관리자 아님(C dev-kim이 아닌 그룹 경유 — 그룹 정책 슬롯)", rule: "AWS-KEY-3", member: k("iam-user", "dev-kim"), input: () => {
      const f = companyJson("aws", "C");
      // engineers 그룹 정책을 관리자급이 아닌 것으로 바꿔 dev-kim을 '관리자 아님(제외)'으로 만든다
      f.data.iamGroups[0].attachedPolicyArns.value = ["arn:aws:iam::aws:policy/ReadOnlyAccess"];
      return inputOf(runJson(f));
    }, slots: () => [["doors", "key", "data", "groups", 0, "attachedPolicyArns"]], fresh: false },
];

const MUTATIONS: readonly (readonly [string, "missing" | "partial" | "none", string])[] = [
  ["missing(denied)", "missing", "denied"], ["missing(field-missing)", "missing", "field-missing"], ["missing(value-unrecognized)", "missing", "value-unrecognized"],
  ["partial", "partial", "truncated"], ["none", "none", ""],
];

function check(report: Report, s: Site, what: string): string[] {
  const out: string[] = [];
  const rule = ruleOf(report, s.rule);
  const item = rule.items.find((i) => i.resource.key === s.member);
  if (item === undefined) out.push(`${what}: 대상이 리포트에 없다(여전히 제외됨)`);
  else if (item.status === "clear") out.push(`${what}: 대상이 이상 없음`);
  if (rule.status === "na" || rule.status === "clear") out.push(`${what}: 룰이 ${rule.status}`);
  return out;
}

describe("FO-07 전제: 각 제외 경로가 실제로 제외를 만든다(원본에서 그 대상은 리포트에 없다)", () => {
  for (const s of SITES) {
    it(s.title, () => {
      const r = judge(s.input());
      expect(ruleOf(r, s.rule).items.find((i) => i.resource.key === s.member)).toBeUndefined();
    });
  }
});

/** 설계상 허용: 루트 키 목록이 partial이어도 실시간 계정 요약(AccountAccessKeysPresent)이 '루트 키 0'을 말하면 완결로 본다(aws-mfa-1.ts keysComplete) */
const ALLOWED = (s: Site, p: Path, kind: string): boolean => s.rule === "AWS-MFA-1" && s.title.includes("수집기") && p[p.length - 1] === "keys" && kind === "partial";

describe("FO-07 결정 슬롯을 비우면 제외가 아니라 리포트에 남는다(확인 불가 등)", () => {
  for (const s of SITES) {
    it(s.title, () => {
      const base = s.input();
      const problems: string[] = [];
      let n = 0;
      for (const p of s.slots(base)) for (const [label, kind, why] of MUTATIONS) {
        if (ALLOWED(s, p, kind)) continue;
        const m = replaceSlot(base, p, kind, why);
        if (m === null) continue;
        n++;
        problems.push(...check(judge(m), s, `${p.slice(3).join(".")} → ${label}`));
      }
      expect(problems).toEqual([]);
      expect(n).toBeGreaterThan(0);
    });
  }
});

describe("FO-07 보고서 신선도 실패(수집 시각 − 보고서 생성 시각 > 4시간 5분)면 보고서 근거 제외는 확인 불가", () => {
  const stale = (input: NormalizedInput): NormalizedInput => {
    const d = structuredClone(input) as Json;
    const old = { iso: "2026-10-18T03:00:00Z", ms: Date.UTC(2026, 9, 18, 3, 0, 0) };
    for (const door of ["mfa", "key"]) if (d.doors[door].state === "selected" && d.doors[door].data.credentialReport.k === "value") setAt(d, ["doors", door, "data", "credentialReport", "value", "generatedAt"], old);
    return deepFreeze(d as NormalizedInput);
  };
  for (const s of SITES.filter((x) => x.fresh)) {
    it(s.title, () => {
      expect(check(judge(stale(s.input())), s, "보고서 신선도 실패")).toEqual([]);
    });
  }
});

describe("FO-07 AWS-MFA-1 루트 키 목록 partial의 교차 확인(설계 의도 확인)", () => {
  const keysPath: Path = ["doors", "mfa", "data", "root", "value", "keys"];
  it("partial + 실시간 요약 AccountAccessKeysPresent = 0 → 제외 유지(요약이 증거)", () => {
    const m = replaceSlot(inputOf(runJson(companyJson("aws", "D"))), keysPath, "partial");
    if (m === null) throw new Error("변이 불가");
    expect(ruleOf(judge(m), "AWS-MFA-1").status).toBe("na");
  });
  it("partial + 실시간 요약 없음(missing) → 제외하지 않고 확인 불가", () => {
    const base = replaceSlot(inputOf(runJson(companyJson("aws", "D"))), ["doors", "mfa", "data", "accountSummary"], "missing", "denied");
    if (base === null) throw new Error("변이 불가");
    const m = replaceSlot(base, keysPath, "partial");
    if (m === null) throw new Error("변이 불가");
    const r = judge(m);
    expect(ruleOf(r, "AWS-MFA-1").status).toBe("unknown");
    expect(ruleOf(r, "AWS-MFA-1").items.map((i) => i.resource.key)).toEqual([k("root", "root")]);
  });
});

describe("FO-07 AWS-KEY-4:120 서비스 연결 역할 — 경로만으로 제외(설계 의도 확인)", () => {
  const roleKey = k("iam-role", "AWSServiceRoleForSupport");
  it("경로가 정확히 /aws-service-role/…이면 신뢰 정책을 읽지 못해도 제외다(AWS 예약 경로: 사용자가 만들 수 없다)", () => {
    const f = companyJson("aws", "C");
    (f.data.iamRoles.value as Json[])[0].trust = null;
    expect(ruleOf(okReport(runJson(f)), "AWS-KEY-4").items.find((i) => i.resource.key === roleKey)).toBeUndefined();
  });
  it("경로에 공백이 붙는 등 정확히 일치하지 않으면 제외하지 않고 보통 역할로 판정한다(안전한 방향)", () => {
    for (const path of [" /aws-service-role/support.amazonaws.com/", "/AWS-SERVICE-ROLE/support.amazonaws.com/", "/aws-service-role"]) {
      const f = companyJson("aws", "C");
      (f.data.iamRoles.value as Json[])[0].path = path;
      const item = ruleOf(okReport(runJson(f)), "AWS-KEY-4").items.find((i) => i.resource.key === roleKey);
      expect(item?.status, path).toBe("clear");
    }
  });
});
