// src/lib/cloudcheck/parse/normalize.aws.test.ts — buildInput(AWS): 슬롯 연결 규칙 · 모수/범위 · 다중 입력 병합 · 비밀 제거 · 불변식
import { describe, expect, it } from "vitest";
import { checkInvariants } from "../contract/normalized-invariants";
import type { AwsNormalizedInput, AwsIamUser, Slot } from "../contract/normalized";
import { buildInput } from "./normalize";
import { EXTERNAL, SELF, awsFile, azureFile, rec, recCsv, reportCsv } from "./testdata";
import type { AwsOpts, Json } from "./testdata";
import type { InputRecognition } from "../model/report";

const ok = (b: ReturnType<typeof buildInput>): AwsNormalizedInput => {
  if (!b.ok || b.input.cloud !== "aws") throw new Error(`buildInput 실패: ${JSON.stringify(b.recognitions.map((r) => r.status))}`);
  expect(checkInvariants(b.input), "불변식").toEqual([]);
  return b.input;
};
const one = (o: AwsOpts = {}): AwsNormalizedInput => ok(buildInput([rec(awsFile(o).file)]));
const sel = <D,>(d: { state: string; data?: D }): D => { if (d.state !== "selected") throw new Error(`문이 선택되지 않았다: ${d.state}`); return d.data as D; };
const users = (s: Slot<readonly AwsIamUser[]>): readonly AwsIamUser[] => { if (s.k !== "value" && s.k !== "partial") throw new Error(`사용자 슬롯: ${s.k}`); return s.value; };
const cov = (i: AwsNormalizedInput, f: keyof AwsNormalizedInput["coverage"]) => i.coverage[f];
const fails = (rs: readonly InputRecognition[]): string[] => rs.map((r) => r.status);

describe("정상 파일", () => {
  const i = one();
  it("최상위 모양: 모델 · 클라우드 · 실제 모드 · 입력 요약 · 신원", () => {
    expect([i.model, i.cloud, i.mode]).toEqual(["cloudcheck.normalized/1", "aws", { kind: "real" }]);
    expect(i.inputs).toHaveLength(1);
    expect(i.inputs[0]).toMatchObject({ index: 0, kind: "collector-json", via: "file", scopeProven: true, schema: { id: "cloudcheck.collect/1.0", support: "exact" }, collector: { name: "cloudcheck-aws", version: "1.0.0", sha256: null, knownRelease: null } });
    expect(i.inputs[0].doors).toEqual({ mfa: "used", key: "used", net: "used", sto: "used", log: "used" });
    expect(i.identity).toMatchObject({ input: 0, source: "collector", accountId: SELF, principalType: "assumed-role", principalName: "SecurityAuditRole", confirmed: "interactive", receipt: "0:r-0001", alias: { k: "value", value: "acme-prod" } });
    expect(i.notices).toEqual({ redactions: 0, sectionIssues: [] });
  });
  it("모든 문이 이 입력에서 선택되고 기준 시각은 수집 시각", () => {
    for (const d of ["mfa", "key", "net", "sto", "log"] as const) expect(i.doors[d]).toMatchObject({ state: "selected", input: 0, asOf: { source: "collected-at", at: { iso: "2026-10-19T03:12:00Z" } } });
  });
  it("범위(coverage)가 13개 패밀리 모두 완결이고 모수·기대 수가 맞다", () => {
    const want: Record<string, [number, number | null]> = {
      "aws.mfa.credential-report": [3, 3], "aws.mfa.root": [1, 1], "aws.mfa.users": [2, 2], "aws.key.credential-report": [3, 3], "aws.key.users": [2, 2], "aws.key.access-keys": [1, null],
      "aws.key.roles": [2, 2], "aws.net.security-groups": [2, null], "aws.net.enis": [1, null], "aws.sto.account": [1, null], "aws.sto.buckets": [2, 2], "aws.log.account": [1, null], "aws.log.trails": [1, null],
    };
    for (const [f, [pop, expected]] of Object.entries(want)) {
      const c = i.coverage[f as keyof typeof i.coverage];
      expect([f, c.complete, c.population, c.present, c.expected, c.gaps]).toEqual([f, true, pop, pop, expected, []]);
    }
    expect(cov(i, "aws.net.security-groups").unit).toEqual({ kind: "regions", covered: 2, total: 2 });
    expect(cov(i, "aws.net.security-groups").units.map((u) => [u.unit, u.state])).toEqual([["ap-northeast-2", "ok"], ["us-east-1", "ok"]]);
  });
  it("영수증 색인: 입력 번호를 붙인 키 · 항목 단위 호출에는 resource · 전부 used", () => {
    expect(i.receipts.size).toBe(awsFile().file.receipts.length);
    const f = i.receipts.get("0:r-0001");
    expect(f).toMatchObject({ call: "sts:GetCallerIdentity", result: "ok", used: true, at: { iso: "2026-10-19T03:12:00Z" } });
    const acl = [...i.receipts.values()].filter((r) => r.call === "s3:GetBucketAcl");
    expect(acl.map((r) => r.resource)).toEqual(["acme-public-assets", "acme-prod-data"]);
    expect([...i.receipts.values()].every((r) => r.used)).toBe(true);
  });
  it("깊게 freeze된다(엔진이 바꾸면 TypeError)", () => {
    expect(Object.isFrozen(i) && Object.isFrozen(i.doors) && Object.isFrozen(i.inputs[0]) && Object.isFrozen(i.identity)).toBe(true);
    const mfa = sel(i.doors.mfa);
    expect(() => { (mfa.root as { k: string }).k = "none"; }).toThrow(TypeError);
    expect(Object.isFrozen(i.receipts.get("0:r-0001"))).toBe(true);
  });
  it("결정적이다: 같은 입력을 두 번 만들면 같다", () => {
    const dump = (x: AwsNormalizedInput): string => JSON.stringify({ ...x, receipts: [...x.receipts] });
    expect(dump(one())).toBe(dump(i));
  });
});

describe("슬롯: 영수증 결과 → 값의 뜻", () => {
  it("설정 없음(notconfigured)은 none = 유효한 답(INV-6), 값이 있는 칸은 value, 영수증 src를 단다", () => {
    const sto = sel(one().doors.sto);
    expect(sto.accountPublicAccessBlock).toMatchObject({ k: "none", src: { input: 0, receipt: expect.stringMatching(/^0:r-\d{4}$/), csv: null } });
    const buckets = sto.buckets;
    if (buckets.k !== "value") throw new Error("buckets");
    const logs = buckets.value.find((b) => b.name === "acme-prod-data");
    expect(logs?.policyStatus.k).toBe("none");
    expect(logs?.website.k).toBe("none");
    expect(logs?.publicAccessBlock).toMatchObject({ k: "value", value: { blockPublicAcls: true } });
    expect(buckets.value.find((b) => b.name === "acme-public-assets")?.acl).toMatchObject({ k: "value", value: { publicGrants: [{ grantee: "AllUsers", permission: "READ" }] } });
  });
  it("거부(denied)·오류·제한·미지원 영수증은 missing(result), 값은 없다", () => {
    for (const result of ["denied", "error", "throttled", "unsupported"] as const) {
      const i = one({ mutate: (f, r) => {
        const id = r.add("s3:GetBucketAcl", result, { resource: "acme-prod-data", region: "ap-northeast-2" });
        f.data.buckets.items[1].acl = { receipt: id, value: null };
      } });
      const b = sel(i.doors.sto).buckets;
      if (b.k !== "value") throw new Error("buckets");
      expect(b.value.find((x) => x.name === "acme-prod-data")?.acl, result).toMatchObject({ k: "missing", why: result });
    }
  });
  it("ok인데 값이 null이면 missing(field-missing), truncated + 값은 partial(truncated)", () => {
    const i = one({ mutate: (f, r) => {
      f.data.buckets.items[1].ownership = { receipt: f.data.buckets.items[1].ownership.receipt, value: null };
      const id = r.add("s3:GetBucketAcl", "truncated", { resource: "acme-prod-data", region: "ap-northeast-2", count: 1 });
      f.data.buckets.items[1].acl = { receipt: id, value: { publicGrants: [] } };
    } });
    const b = sel(i.doors.sto).buckets;
    if (b.k !== "value") throw new Error("buckets");
    const bucket = b.value.find((x) => x.name === "acme-prod-data");
    expect(bucket?.ownership).toMatchObject({ k: "missing", why: "field-missing" });
    expect(bucket?.acl).toMatchObject({ k: "partial", why: "truncated" });
  });
  it("모순(실패 영수증 아래의 데이터)은 그 섹션 전체를 missing(schema-unsupported)로 만들고 이슈를 남긴다", () => {
    const i = one({ mutate: (f, r) => {
      const id = r.add("cloudtrail:DescribeTrails", "denied");
      f.data.trails.receipt = id;
    } });
    expect(sel(i.doors.log).trails).toMatchObject({ k: "missing", why: "schema-unsupported" });
    expect(i.notices.sectionIssues).toEqual([{ input: 0, door: "log", section: "trails", reason: "schema-section" }]);
    expect(cov(i, "aws.log.trails")).toMatchObject({ complete: false, gaps: ["schema-unsupported"] });
  });
  it("영수증 참조가 끊기거나 호출이 어긋나면 섹션 무효: 없는 영수증 · 다른 호출 · 다른 리소스 · count 불일치", () => {
    const bad: Array<[string, (f: Json) => void]> = [
      ["없는 영수증", (f) => { f.data.accountSummary.receipt = "r-9999"; }],
      ["다른 호출의 영수증", (f) => { f.data.accountSummary.receipt = f.identity.receipt; }],
      ["다른 리소스의 영수증", (f) => { f.data.buckets.items[0].acl.receipt = f.data.buckets.items[1].acl.receipt; }],
      ["count 불일치", (f) => { f.receipts.find((r: Json) => r.id === f.data.buckets.receipt).count = 5; }],
      ["empty인데 목록이 비어 있지 않다", (f) => { f.receipts.find((r: Json) => r.id === f.data.buckets.receipt).result = "empty"; f.receipts.find((r: Json) => r.id === f.data.buckets.receipt).count = 0; }],
    ];
    for (const [name, m] of bad) {
      const i = one({ mutate: (f) => m(f) });
      expect(i.notices.sectionIssues.length, name).toBeGreaterThan(0);
      expect(i.notices.sectionIssues.every((x) => x.reason === "schema-section"), name).toBe(true);
    }
  });
});

describe("자격증명 보고서 · 사용자 · 키", () => {
  it("실시간 > 보고서: MFA는 list-mfa-devices, 비밀번호 마지막 사용은 list-users, 비밀번호 사용 여부는 보고서에서만", () => {
    const mfa = sel(one().doors.mfa);
    const u = users(mfa.users);
    const jane = u.find((x) => x.name === "jane.doe") as AwsIamUser;
    expect(jane.mfaActive).toMatchObject({ k: "value", value: true, src: { csv: null } });
    expect(jane.mfaDevices).toBe(1);
    expect(jane.passwordEnabled).toMatchObject({ k: "value", value: true, src: { csv: { kind: "csv-credential-report", row: 3, column: "password_enabled" } } });
    expect(jane.passwordLastUsed).toMatchObject({ k: "value", value: { iso: "2026-10-18T09:00:00Z" }, src: { csv: null } });
    const bot = u.find((x) => x.name === "ci-deployer") as AwsIamUser;
    expect(bot.passwordLastUsed).toMatchObject({ k: "value", value: null });
    expect(bot.mfaActive).toMatchObject({ k: "value", value: false });
  });
  it("키 슬롯 조인: last_rotated ↔ CreateDate로 보고서의 마지막 사용을 붙이고, 끝 4자리·상태를 싣는다", () => {
    const key = sel(one().doors.key);
    const bot = users(key.users).find((x) => x.name === "ci-deployer") as AwsIamUser;
    if (bot.keys.k !== "value") throw new Error("keys");
    expect(bot.keys.value).toHaveLength(1);
    expect(bot.keys.value[0]).toMatchObject({
      slot: 1, idSuffix: "MPLE", status: "Active", active: { k: "value", value: true }, createdAt: { k: "value", value: { iso: "2026-01-05T00:00:00Z" } },
      lastUsed: { k: "value", value: { iso: "2026-10-17T12:00:00Z" }, src: { csv: { kind: "csv-credential-report", row: 4, column: "access_key_1_last_used_date" } } },
      lastUsedRegion: "ap-northeast-2", lastUsedService: "s3",
    });
  });
  it("조인 실패(생성일이 다름)·상태 해석 불가·Inactive/Expired를 구별한다", () => {
    const i = one({ mutate: (f, r) => {
      const item = f.data.iamUsers.items.find((x: Json) => x.userName === "ci-deployer");
      const id = r.add("iam:ListAccessKeys", "ok", { resource: "ci-deployer", region: "global", count: 3 });
      item.accessKeys = { receipt: id, value: [
        { status: "Active", createDate: "2020-02-02T00:00:00+00:00", idSuffix: "AAAA" },     // 보고서 슬롯과 생성일이 다름
        { status: "Expired", createDate: "2026-01-05T00:00:00+00:00", idSuffix: "BBBB" },
        { status: "Weird", createDate: "2021-01-01T00:00:00+00:00", idSuffix: "CCCC" },
      ] };
    } });
    const bot = users(sel(i.doors.key).users).find((x) => x.name === "ci-deployer") as AwsIamUser;
    if (bot.keys.k !== "value") throw new Error("keys");
    const [a, b, c] = bot.keys.value;
    expect([a.slot, a.lastUsed.k]).toEqual([null, "missing"]);
    expect(a.lastUsed).toMatchObject({ why: "stale-evidence" });   // 보고서에 이 키(생성일)가 없다 = 보고서가 만들어진 뒤에 바뀐 키
    expect([b.slot, b.active]).toMatchObject([1, { k: "value", value: false }]);
    expect(c.active).toMatchObject({ k: "missing", why: "value-unrecognized" });
  });
  it("보고서만 있으면(CSV) 키는 additional_credentials_info 열이 없을 때 partial(field-missing) — 이상 없음을 줄 수 없다", () => {
    const i = ok(buildInput([recCsv(reportCsv(), "r.csv", 1_792_300_000_000)]));
    const bot = users(sel(i.doors.key).users).find((x) => x.name === "ci-deployer") as AwsIamUser;
    expect(bot.keys).toMatchObject({ k: "partial", why: "field-missing" });
    expect(cov(i, "aws.key.access-keys")).toMatchObject({ complete: false, gaps: ["field-missing"] });
    // 열이 있고 값이 비어 있으면 키 전체를 증명한다
    const withCol = reportCsv().split("\n").map((l, n) => (n === 0 ? `${l},additional_credentials_info` : l === "" ? l : `${l},`)).join("\n");
    const j = ok(buildInput([recCsv(withCol, "r.csv", 1_792_300_000_000)]));
    expect(users(sel(j.doors.key).users).find((x) => x.name === "ci-deployer")?.keys.k).toBe("value");
    expect(cov(j, "aws.key.access-keys")).toMatchObject({ complete: true, population: 1 });
    // 값이 있으면 3번째 키부터 확인 불가
    const withVal = withCol.replace(/^(ci-deployer.*),$/m, "$1,3rd-key");
    expect(users(sel(ok(buildInput([recCsv(withVal, "r.csv", 1)])).doors.key).users).find((x) => x.name === "ci-deployer")?.keys.k).toBe("partial");
  });
  it("루트 행: 루트 사실은 보고서에서만 · 루트 행이 없으면 missing(field-missing)", () => {
    const mfa = sel(one().doors.mfa);
    expect(mfa.root).toMatchObject({ k: "value", value: { mfaActive: { k: "value", value: true }, passwordLastUsed: { k: "value", value: { iso: "2026-07-01T00:10:00Z" } } } });
    if (mfa.root.k !== "value") throw new Error("root");
    expect(mfa.root.value.passwordEnabled).toMatchObject({ k: "missing", why: "value-unrecognized" });   // not_supported
    const noRoot = reportCsv().split("\n").filter((l) => !l.startsWith("<root_account>")).join("\n");
    const i = one({ csv: noRoot });
    expect(sel(i.doors.mfa).root).toMatchObject({ k: "missing", why: "field-missing" });
    expect(cov(i, "aws.mfa.root")).toMatchObject({ complete: false, gaps: ["field-missing"] });
    expect(cov(i, "aws.mfa.credential-report").gaps).toContain("field-missing");
  });
  it("모호한 행(필드 수가 다름)은 사용자로 만들지 않고 범위를 증명하지 못한다", () => {
    const i = one({ csv: reportCsv(["broken,arn:aws:iam::123456789012:user/broken,2025-01-01T00:00:00+00:00"]) });
    const rep = sel(i.doors.mfa).credentialReport;
    expect(rep).toMatchObject({ k: "value", value: { ambiguousRows: [5], rows: 4 } });
    expect(cov(i, "aws.mfa.credential-report")).toMatchObject({ complete: false, population: null, present: 3, gaps: ["csv-row-ambiguous"] });
    expect(cov(i, "aws.key.credential-report")).toMatchObject({ complete: false, population: null, gaps: ["csv-row-ambiguous"] });
    expect(cov(i, "aws.mfa.users").complete).toBe(true);   // 실시간 사용자 목록은 보고서와 별개로 완결
    expect(users(sel(i.doors.mfa).users).map((u) => u.name)).not.toContain("broken");
  });
  it("필수 열이 없으면 보고서 전체가 field-missing + 이슈(mfa·key 둘 다)", () => {
    const noCol = reportCsv().split("\n").map((l) => l.split(",").slice(0, 4).join(",")).join("\n");
    const i = one({ csv: noCol });
    expect(sel(i.doors.mfa).credentialReport).toMatchObject({ k: "missing", why: "field-missing" });
    expect(i.notices.sectionIssues.filter((x) => x.section === "credentialReport").map((x) => `${x.door}/${x.reason}`).sort()).toEqual(["key/field-missing", "mfa/field-missing"]);
    expect(cov(i, "aws.mfa.root")).toMatchObject({ complete: false, gaps: ["field-missing"] });
  });
  it("보고서 호출이 거부돼도 실시간 목록으로 사용자는 만든다 — 보고서 기반 칸만 확인 불가(denied)", () => {
    const i = one({ mutate: (f, r) => {
      const id = r.add("iam:GetCredentialReport", "denied");
      f.data.credentialReport.receipt = id; f.data.credentialReport.value = null;
    } });
    const u = users(sel(i.doors.mfa).users);
    expect(u).toHaveLength(2);
    expect(u[0].passwordEnabled).toMatchObject({ k: "missing", why: "denied" });
    expect(u[1].mfaActive).toMatchObject({ k: "value" });
    expect(sel(i.doors.mfa).credentialReport).toMatchObject({ k: "missing", why: "denied" });
    expect(sel(i.doors.mfa).root).toMatchObject({ k: "missing", why: "denied" });
    expect(cov(i, "aws.mfa.credential-report")).toMatchObject({ complete: false, gaps: ["denied"] });
    expect(cov(i, "aws.mfa.users")).toMatchObject({ complete: true, population: 2 });
  });
  it("list-users가 거부되면 보고서 행으로 사용자를 만든다(Src는 CSV 행)", () => {
    const i = one({ usersResult: "denied" });
    const mfa = sel(i.doors.mfa);
    const u = users(mfa.users);
    expect(u.map((x) => x.name)).toEqual(["jane.doe", "ci-deployer"]);
    expect(u[0].src).toMatchObject({ input: 0, csv: { kind: "csv-credential-report", row: 3 } });
    expect(u[0].attachedPolicyArns).toMatchObject({ k: "missing", why: "not-collected" });
    expect(cov(i, "aws.mfa.users")).toMatchObject({ complete: true, population: 2, expected: 2 });
    expect(i.notices.sectionIssues).toEqual([]);
  });
  it("list-users가 잘리면 partial(truncated) · 요약의 사용자 수와 다르면 population-mismatch", () => {
    const t = one({ usersResult: "truncated" });
    expect(sel(t.doors.mfa).users).toMatchObject({ k: "partial", why: "truncated" });
    expect(cov(t, "aws.mfa.users")).toMatchObject({ complete: false, gaps: ["truncated"] });
    const m = one({ summaryUsers: 5 });
    expect(cov(m, "aws.mfa.users")).toMatchObject({ complete: false, gaps: ["population-mismatch"], expected: 5, present: 2 });
    expect(cov(m, "aws.mfa.credential-report")).toMatchObject({ complete: false, gaps: ["population-mismatch"], expected: 6 });
  });
  it("예산 초과: 목록 밖 사용자의 세부 슬롯은 missing(budget-exceeded), 목록은 partial, 모수는 증명되지 않는다", () => {
    const i = one({ mutate: (f) => {
      const it = f.data.iamUsers;
      it.budget = { limit: 1, total: 2, collected: 1 };
      it.items[1].accessKeys = { receipt: it.receipt, value: null }; it.items[1].mfaDevices = { receipt: it.receipt, value: null };
      it.items[1].attachedPolicyArns = { receipt: it.receipt, value: null }; it.items[1].groupNames = { receipt: it.receipt, value: null };
    } });
    const key = sel(i.doors.key);
    expect(key.users).toMatchObject({ k: "partial", why: "budget-exceeded" });
    const u = users(key.users);
    expect(u[1].keys.k).toBe("partial");                       // 보고서로 대체(실시간 슬롯이 없으므로)
    expect(u[1].groupNames).toMatchObject({ k: "missing", why: "budget-exceeded" });
    expect(u[0].groupNames.k).toBe("value");
    expect(cov(i, "aws.key.users")).toMatchObject({ complete: false, gaps: ["budget-exceeded"] });
    expect(cov(i, "aws.key.access-keys").complete).toBe(false);
  });
  it("요청하지 않은 문의 칸은 호출되지 않았으므로 not-collected(실시간 mfa 없음 → 보고서로 대체)", () => {
    const i = one({ doors: { mfa: "skipped" } });
    expect(i.doors.mfa).toEqual({ state: "skipped", inputs: [0] });
    expect(i.inputs[0].doors.mfa).toBe("skipped");
    const bot = users(sel(i.doors.key).users).find((x) => x.name === "ci-deployer") as AwsIamUser;
    expect(bot.mfaDevices).toBeNull();
    expect(bot.mfaActive).toMatchObject({ k: "value", value: false, src: { csv: { column: "mfa_active" } } });   // 보고서 값
    expect(cov(i, "aws.mfa.users")).toMatchObject({ complete: false, input: null, gaps: ["not-collected"] });
  });
  it("IAM 사용자 이름 __proto__ · constructor도 안전하게 조인한다(Map 조회)", () => {
    const csv = reportCsv(["__proto__,arn:aws:iam::123456789012:user/__proto__,2025-01-01T00:00:00+00:00,true,N/A,N/A,N/A,true,false,N/A,N/A,N/A,N/A,false,N/A,N/A,N/A,N/A,false,N/A,false,N/A", "constructor,arn:aws:iam::123456789012:user/constructor,2025-01-01T00:00:00+00:00,false,N/A,N/A,N/A,false,false,N/A,N/A,N/A,N/A,false,N/A,N/A,N/A,N/A,false,N/A,false,N/A"]);
    const i = one({ csv, mutate: (f, r) => {
      const mk = (userName: string): Json => {
        const hole = (call: string, v: unknown): Json => ({ receipt: r.add(call, "ok", { resource: userName, region: "global", count: 1 }), value: v });
        return { userName, createDate: "2025-01-01T00:00:00+00:00", passwordLastUsed: null, accessKeys: { receipt: r.add("iam:ListAccessKeys", "empty", { resource: userName, region: "global" }), value: [] }, mfaDevices: hole("iam:ListMFADevices", { count: 1 }), attachedPolicyArns: { receipt: r.add("iam:ListAttachedUserPolicies", "empty", { resource: userName, region: "global" }), value: [] }, groupNames: { receipt: r.add("iam:ListGroupsForUser", "empty", { resource: userName, region: "global" }), value: [] } };
      };
      f.data.iamUsers.items.push(mk("__proto__"), mk("constructor"));
      f.data.iamUsers.budget = { limit: 150, total: 4, collected: 4 };
      f.receipts.find((x: Json) => x.id === f.data.iamUsers.receipt).count = 4;
      f.data.accountSummary.value.Users = 4;
    } });
    const u = users(sel(i.doors.mfa).users);
    expect(u.map((x) => x.name)).toEqual(["ci-deployer", "jane.doe", "__proto__", "constructor"]);
    expect(u[2].passwordEnabled).toMatchObject({ k: "value", value: true });
    expect(u[3].passwordEnabled).toMatchObject({ k: "value", value: false });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe("역할 · 그룹", () => {
  it("신뢰 정책은 주체와 조건 키 이름만 · 그룹 정책 ARN · 외부 계정 ARN 보존", () => {
    const key = sel(one().doors.key);
    if (key.roles.k !== "value") throw new Error("roles");
    const vendor = key.roles.value.find((r) => r.name === "vendor-access");
    if (vendor?.trust.k !== "value") throw new Error("trust");
    expect(vendor.trust.value[0]).toMatchObject({ effect: "Allow", principal: { aws: [`arn:aws:iam::${EXTERNAL}:root`], wildcard: false }, conditionKeys: ["StringEquals:sts:ExternalId"] });
    const svc = key.roles.value.find((r) => r.name === "AWSServiceRoleForSupport");
    expect(svc?.path).toBe("/aws-service-role/support.amazonaws.com/");
    expect(key.groups).toHaveLength(1);
    expect(key.groups[0]).toMatchObject({ name: "platform-admins", attachedPolicyArns: { k: "value", value: ["arn:aws:iam::aws:policy/AdministratorAccess"] } });
  });
  it("trust가 null이면 그 역할만 확인 불가(value-unrecognized)", () => {
    const i = one({ mutate: (f) => { f.data.iamRoles.value[1].trust = null; } });
    const key = sel(i.doors.key);
    if (key.roles.k !== "value") throw new Error("roles");
    expect(key.roles.value[1].trust).toMatchObject({ k: "missing", why: "value-unrecognized" });
    expect(key.roles.value[0].trust.k).toBe("value");
  });
  it("roles가 거부되면 roles 패밀리가 미완결(denied)", () => {
    const i = one({ mutate: (f, r) => { f.data.iamRoles = { receipt: r.add("iam:ListRoles", "denied"), value: null }; } });
    expect(sel(i.doors.key).roles).toMatchObject({ k: "missing", why: "denied" });
    expect(cov(i, "aws.key.roles")).toMatchObject({ complete: false, gaps: ["denied"] });
  });
});

describe("창문 · 창고 · CCTV 범위", () => {
  it("리전 하나가 거부되면 그 리전만 failed(찾은 것은 유지) → region-missing, 모수는 증명되지 않는다", () => {
    const i = one({ mutate: (f, r) => {
      const id = r.add("ec2:DescribeSecurityGroups", "denied", { region: "us-east-1", errorCode: "UnauthorizedOperation" });
      f.data.securityGroups[1] = { region: "us-east-1", receipt: id, items: null };
    } });
    const net = sel(i.doors.net);
    expect(net.securityGroups.map((p) => [p.region, p.items.k])).toEqual([["ap-northeast-2", "value"], ["us-east-1", "missing"]]);
    expect(cov(i, "aws.net.security-groups")).toMatchObject({ complete: false, population: null, present: 1, gaps: ["region-missing"], unit: { kind: "regions", covered: 1, total: 2 } });
    expect(cov(i, "aws.net.security-groups").units[1]).toMatchObject({ unit: "us-east-1", state: "failed", why: "denied" });
    expect(cov(i, "aws.net.enis").complete).toBe(true);
  });
  it("요청 리전이 활성 리전 전부가 아니면 빠진 리전은 not-queried(region-missing)", () => {
    const i = one({ mutate: (f) => { f.scope.regionsRequested = ["ap-northeast-2"]; f.data.securityGroups.pop(); f.data.networkInterfaces.pop(); } });
    const c = cov(i, "aws.net.security-groups");
    expect(c.complete).toBe(false);
    expect(c.units.map((u) => `${u.unit}:${u.state}`)).toEqual(["ap-northeast-2:ok", "us-east-1:not-queried"]);
    expect(c.gaps).toContain("region-missing");
    expect(sel(i.doors.net).regionsRequested).toEqual(["ap-northeast-2"]);
  });
  it("활성 리전 목록을 못 받으면(denied) 범위를 증명할 수 없다(scope-unproven) — 조회한 리전의 양성은 유지", () => {
    const i = one({ mutate: (f, r) => { f.scope.regions = { receipt: r.add("ec2:DescribeRegions", "denied"), value: null }; } });
    expect(sel(i.doors.net).regions).toMatchObject({ k: "missing", why: "denied" });
    expect(cov(i, "aws.net.security-groups")).toMatchObject({ complete: false, gaps: ["scope-unproven"], unit: { total: null } });
    expect(i.inputs[0].scopeProven).toBe(false);
  });
  it("활성 리전 목록이 빈 배열(empty)이면 '보안 그룹 0개'를 증명하지 않는다(scope-unproven · 백엔드팀장 STEP 4)", () => {
    const i = one({ mutate: (f, r) => {
      f.scope.regions = { receipt: r.add("ec2:DescribeRegions", "empty", { count: 0 }), value: [] };
      f.data.securityGroups = []; f.data.networkInterfaces = [];
    } });
    for (const fam of ["aws.net.security-groups", "aws.net.enis"] as const) {
      expect(cov(i, fam)).toMatchObject({ complete: false, population: null, present: 0 });
      expect(cov(i, fam).gaps).toContain("scope-unproven");
    }
  });
  it("버킷 목록 잘림 → partial(truncated) · 예산 초과 → partial(budget-exceeded) · 버킷 하나의 조회 실패는 패밀리 완결에 영향이 없다", () => {
    const t = one({ mutate: (f) => { const rr = f.receipts.find((x: Json) => x.id === f.data.buckets.receipt); rr.result = "truncated"; rr.count = 2; } });
    expect(sel(t.doors.sto).buckets).toMatchObject({ k: "partial", why: "truncated" });
    expect(cov(t, "aws.sto.buckets")).toMatchObject({ complete: false, gaps: ["truncated"], present: 2, population: null });
    const b = one({ mutate: (f) => { f.data.buckets.budget = { limit: 1, total: 2, collected: 1 }; const it = f.data.buckets.items[1]; for (const k of ["publicAccessBlock", "policyStatus", "acl", "ownership", "website"]) it[k] = { receipt: f.data.buckets.receipt, value: null }; it.region = { value: null, source: "location", receipt: f.data.buckets.receipt }; } });
    const bs = sel(b.doors.sto).buckets;
    if (bs.k !== "partial") throw new Error("buckets");
    expect(bs.why).toBe("budget-exceeded");
    expect(bs.value[1]).toMatchObject({ acl: { k: "missing", why: "budget-exceeded" }, region: { k: "missing", why: "budget-exceeded" } });
    expect(bs.value[0].acl.k).toBe("value");
    const one1 = one({ mutate: (f, r) => { f.data.buckets.items[0].acl = { receipt: r.add("s3:GetBucketAcl", "denied", { resource: "acme-public-assets", region: "us-east-1" }), value: null }; } });
    expect(cov(one1, "aws.sto.buckets")).toMatchObject({ complete: true, population: 2 });
  });
  it("버킷 리전: location 호출 결과 / 목록 값 · 위치 호출이 실패하면 region = missing", () => {
    const i = one({ mutate: (f, r) => {
      const id = r.add("s3:GetBucketLocation", "denied", { resource: "acme-prod-data", region: "global" });
      f.data.buckets.items[1].region = { value: null, source: "location", receipt: id };
    } });
    const bs = sel(i.doors.sto).buckets;
    if (bs.k !== "value") throw new Error("buckets");
    expect(bs.value[0].region).toMatchObject({ k: "value", value: "us-east-1" });
    expect(bs.value[1].region).toMatchObject({ k: "missing", why: "denied" });
  });
  it("trail: 상태·이벤트 선택기 슬롯 · 목록이 비면 trail 없음(완결)", () => {
    const t = sel(one().doors.log).trails;
    if (t.k !== "value") throw new Error("trails");
    expect(t.value[0]).toMatchObject({ name: "acme-org-trail", status: { k: "value", value: { isLogging: true } }, selectors: { k: "value", value: { basic: [{ readWriteType: "All" }] } } });
    const none = one({ mutate: (f, r) => { f.data.trails = { receipt: r.add("cloudtrail:DescribeTrails", "empty"), value: [] }; } });
    expect(sel(none.doors.log).trails).toMatchObject({ k: "value", value: [] });
    expect(cov(none, "aws.log.account")).toMatchObject({ complete: true, population: 1 });
    expect(cov(none, "aws.log.trails")).toMatchObject({ complete: true, population: 0 });
  });
});

describe("다중 입력 병합(§4-8)", () => {
  const csvRec = (n = "status_reports_2026-10-18T22_15_00Z.csv"): InputRecognition => recCsv(reportCsv(), n);
  it("수집기 JSON > CSV: 같은 문을 담으면 CSV는 superseded, 인식 결과의 doors는 실제로 쓰인 문만 남는다", () => {
    const b = buildInput([rec(awsFile().file), csvRec()]);
    const i = ok(b);
    expect(i.inputs.map((x) => [x.kind, x.doors])).toEqual([
      ["collector-json", { mfa: "used", key: "used", net: "used", sto: "used", log: "used" }],
      ["csv-credential-report", { mfa: "superseded", key: "superseded", net: "absent", sto: "absent", log: "absent" }],
    ]);
    expect(b.recognitions.map((r) => r.doors)).toEqual([["mfa", "key", "net", "sto", "log"], []]);
    expect(sel(i.doors.mfa).credentialReport).toMatchObject({ k: "value", value: { generatedAtSource: "api" } });
    expect(i.inputs[1].asOf).toMatchObject({ source: "filename", at: { iso: "2026-10-18T22:15:00Z" } });
  });
  it("수집기가 mfa·key를 건너뛰면 CSV가 그 문을 채운다(문 단위 선택)", () => {
    const i = ok(buildInput([rec(awsFile({ doors: { mfa: "skipped", key: "skipped" } }).file), csvRec()]));
    expect(i.doors.mfa).toMatchObject({ state: "selected", input: 1 });
    expect(i.doors.key).toMatchObject({ state: "selected", input: 1 });
    expect(i.doors.net).toMatchObject({ state: "selected", input: 0 });
    expect(i.inputs[0].doors).toEqual({ mfa: "skipped", key: "skipped", net: "used", sto: "used", log: "used" });
    expect(i.inputs[1].doors).toEqual({ mfa: "used", key: "used", net: "absent", sto: "absent", log: "absent" });
    expect(sel(i.doors.mfa).accountSummary).toMatchObject({ k: "missing", why: "not-collected" });
    expect(cov(i, "aws.mfa.credential-report")).toMatchObject({ input: 1, complete: true, unit: { kind: "csv-rows", covered: 3, total: 3 } });
    expect([...i.receipts.values()].every((r) => r.used)).toBe(true);   // 수집기 파일에는 mfa·key 호출이 아예 없고, 나머지는 전부 쓰였다
  });
  it("CSV만 넣으면 net·sto·log는 absent, 해당 패밀리는 not-collected", () => {
    const i = ok(buildInput([csvRec()]));
    expect([i.doors.net.state, i.doors.sto.state, i.doors.log.state]).toEqual(["absent", "absent", "absent"]);
    expect(i.identity).toMatchObject({ source: "csv-arn", accountId: SELF, principalType: "unknown", confirmed: null, receipt: null, alias: { k: "missing", why: "not-collected" } });
    expect(cov(i, "aws.sto.buckets")).toMatchObject({ complete: false, input: null, gaps: ["not-collected"] });
    expect(cov(i, "aws.mfa.users")).toMatchObject({ complete: true, population: 2, input: 0 });
    expect(cov(i, "aws.key.roles")).toMatchObject({ complete: false, input: 0, gaps: ["not-collected"] });
    expect(i.inputs[0]).toMatchObject({ scopeProven: true, collector: null, schema: null, runKey: null });
  });
  it("--doors로 나눠 실행한 두 파일은 문 단위로 합쳐진다(A: mfa·key, B: net·sto·log)", () => {
    const a = awsFile({ doors: { net: "skipped", sto: "skipped", log: "skipped" }, mutate: (f) => { f.collectedAt = "2026-10-19T03:00:00Z"; } }).file;
    const b = awsFile({ doors: { mfa: "skipped", key: "skipped" }, mutate: (f) => { f.collectedAt = "2026-10-19T03:05:00Z"; } }).file;
    const i = ok(buildInput([rec(a), rec(b)]));
    expect(["mfa", "key", "net", "sto", "log"].map((d) => (i.doors[d as "mfa"] as { input: number }).input)).toEqual([0, 0, 1, 1, 1]);
    expect(i.inputs[0].doors).toEqual({ mfa: "used", key: "used", net: "skipped", sto: "skipped", log: "skipped" });
    expect(i.inputs[1].doors).toEqual({ mfa: "skipped", key: "skipped", net: "used", sto: "used", log: "used" });
    expect(i.identity.input).toBe(1);   // 신원 출처 = 기준 시각이 가장 최신인 수집기 JSON
    expect(i.doors.mfa).toMatchObject({ asOf: { at: { iso: "2026-10-19T03:00:00Z" } } });
    expect(i.doors.net).toMatchObject({ asOf: { at: { iso: "2026-10-19T03:05:00Z" } } });
  });
  it("같은 문을 담은 수집기 JSON 둘: 기준 시각이 최신인 것이 이기고, 같은 실행(runKey)의 다른 내용은 내용 지문이 작은 쪽이 이긴다(입력 순서와 무관)", () => {
    const older = awsFile({ mutate: (f) => { f.collectedAt = "2026-10-19T01:00:00Z"; } }).file;
    const newer = awsFile({ mutate: (f) => { f.collectedAt = "2026-10-19T02:00:00Z"; } }).file;
    const i = ok(buildInput([rec(newer), rec(older)]));
    expect(i.doors.net).toMatchObject({ state: "selected", input: 0 });
    expect(i.inputs[1].doors.net).toBe("superseded");
    const flags = (idx: number, call: string): boolean[] => [...i.receipts.values()].filter((r) => r.input === idx && r.call === call).map((r) => r.used);
    expect(flags(0, "ec2:DescribeSecurityGroups")).toEqual([true, true]);
    expect(flags(1, "ec2:DescribeSecurityGroups")).toEqual([false, false]);        // 밀려난 입력의 영수증은 used = false
    expect(flags(0, "sts:GetCallerIdentity")).toEqual([true]);
    expect(flags(1, "sts:GetCallerIdentity")).toEqual([false]);
    // runKey가 같고 내용이 다른 두 파일: 하나만 쓰이고 나머지는 중복(superseded)이다. 어느 쪽이 쓰이는지는 넣은 순서가 아니라 내용으로 정해진다(N1)
    const x = rec(awsFile().file, { name: "x.json" });
    const y = rec(awsFile({ mutate: (f) => { f.collectedAt = "2026-10-19T03:12:00Z"; f.run.finishedAt = "2026-10-19T03:12:01Z"; } }).file, { name: "y.json" });
    const usedName = (recs: Parameters<typeof buildInput>[0]): string => {
      const t = ok(buildInput(recs));
      const idx = (t.doors.net as { input: number }).input;
      expect(fails(buildInput(recs).recognitions).filter((st) => st === "superseded")).toHaveLength(1);
      return t.inputs[idx].name;
    };
    expect(usedName([x, y])).toBe(usedName([y, x]));
  });
  it("같은 수집 실행(runKey)이 두 번이면 뒤의 것은 superseded — 입력에는 남지만 모든 문이 superseded", () => {
    const f = awsFile().file;
    const b = buildInput([rec(f), rec(f, { name: "again.json" })]);
    const i = ok(b);
    expect(fails(b.recognitions)).toEqual(["ok", "superseded"]);
    expect(i.inputs[1].doors).toEqual({ mfa: "superseded", key: "superseded", net: "superseded", sto: "superseded", log: "superseded" });
    expect(i.inputs[1].runKey).toBe(i.inputs[0].runKey);
    expect([...i.receipts.values()].filter((r) => r.input === 1).every((r) => !r.used)).toBe(true);
  });
  it("계정이 다르면 합치지 않는다(account-mismatch) · 클라우드가 다르면 cloud-mismatch · 읽지 못한 입력은 그대로", () => {
    const other = awsFile({ mutate: (f) => { f.identity.accountId = EXTERNAL; } }).file;
    const b = buildInput([rec(awsFile().file), rec(other, { name: "other.json" })]);
    expect(b.ok).toBe(false);
    expect(fails(b.recognitions)).toEqual(["ok", "account-mismatch"]);
    expect(b.recognitions[1].identityPreview).toMatchObject({ accountLast4: EXTERNAL.slice(-4) });   // 두 신원을 나란히 보여 주기 위해 남긴다
    const c = buildInput([rec(awsFile().file), rec(azureFile().file)]);
    expect([c.ok, fails(c.recognitions)]).toEqual([false, ["ok", "cloud-mismatch"]]);
    const d = buildInput([rec('{"schema": "cloudcheck.collect/1.0",'), rec(awsFile().file)]);
    expect([d.ok, fails(d.recognitions)]).toEqual([true, ["parse-error", "ok"]]);
    expect(buildInput([rec("garbage")]).ok).toBe(false);
    expect(buildInput([]).ok).toBe(false);
    const mismatchCsv = recCsv(reportCsv([], EXTERNAL));
    const e = buildInput([rec(awsFile().file), mismatchCsv]);
    expect([e.ok, fails(e.recognitions)]).toEqual([false, ["ok", "account-mismatch"]]);
  });
  it("체험과 실제를 섞지 않는다 · 체험 두 세트도 섞지 않는다", () => {
    const demoA = rec(awsFile().file, { via: "demo", name: "cloudcheck-demo-A.aws.json" });
    const demoB = rec(awsFile().file, { via: "demo", name: "cloudcheck-demo-B.aws.json" });
    expect(fails(buildInput([demoA, rec(awsFile().file)]).recognitions)).toEqual(["ok", "account-mismatch"]);
    expect(fails(buildInput([demoA, demoB]).recognitions)).toEqual(["ok", "account-mismatch"]);
    const i = ok(buildInput([demoA]));
    expect(i.mode).toEqual({ kind: "demo", setId: "A" });
    expect(i.inputs[0]).toMatchObject({ via: "demo", name: "cloudcheck-demo.aws.json" });   // 세트 글자는 표시에서 숨긴다
  });
  it("핸들을 잃은 인식 결과(위조된 ok)는 not-cloudcheck로 내려 앉는다", () => {
    const fake: InputRecognition = { ...rec(awsFile().file), handle: Object.freeze({}) as never };
    const b = buildInput([fake]);
    expect([b.ok, fails(b.recognitions)]).toEqual([false, ["not-cloudcheck"]]);
  });
});

describe("비밀 패턴 제거(R-12)", () => {
  it("키 ID 모양의 사용자 이름은 지운 토큰으로 바뀌고(영수증·보고서 조인 유지), 개수가 notices에 남는다", () => {
    const bad = "AKIAIOSFODNN7EXAMPLE";
    const csv = reportCsv([`${bad},arn:aws:iam::${SELF}:user/${bad},2025-01-01T00:00:00+00:00,false,N/A,N/A,N/A,false,false,N/A,N/A,N/A,N/A,false,N/A,N/A,N/A,N/A,false,N/A,false,N/A`]);
    const i = one({ csv, mutate: (f, r) => {
      const hole = (call: string, v: unknown, result: "ok" | "empty" = "ok"): Json => ({ receipt: r.add(call, result, { resource: bad, region: "global", count: result === "ok" ? 1 : undefined }), value: v });
      f.data.iamUsers.items.push({ userName: bad, createDate: "2025-01-01T00:00:00+00:00", passwordLastUsed: null, accessKeys: hole("iam:ListAccessKeys", [], "empty"), mfaDevices: hole("iam:ListMFADevices", { count: 0 }, "empty"), attachedPolicyArns: hole("iam:ListAttachedUserPolicies", [], "empty"), groupNames: hole("iam:ListGroupsForUser", [], "empty") });
      f.data.iamUsers.budget = { limit: 150, total: 3, collected: 3 };
      f.receipts.find((x: Json) => x.id === f.data.iamUsers.receipt).count = 3;
      f.data.accountSummary.value.Users = 3;
    } });
    const names = users(sel(i.doors.mfa).users).map((u) => u.name);
    const red = names.find((n) => n.startsWith("\u0000cc-redacted:")) as string;
    expect(red).toBeDefined();
    expect(JSON.stringify([...i.receipts.values(), i.doors])).not.toContain(bad);
    expect([...i.receipts.values()].some((r) => r.resource === red)).toBe(true);        // 영수증 resource도 같은 토큰
    const redUser = users(sel(i.doors.mfa).users).find((u) => u.name === red) as AwsIamUser;
    expect(redUser.passwordEnabled).toMatchObject({ k: "value", value: false });         // 보고서 행과도 이어졌다
    expect(i.notices.redactions).toBe(1);   // 지운 '비밀 값'은 1개: 사용자 이름 칸과 그 이름이 든 보고서 ARN 칸에 같은 값이 나와도 1개(CC-QA-19)
  });
  it("비밀이 없으면 0", () => { expect(one().notices.redactions).toBe(0); });
});

describe("시나리오 변형이 불변식을 깨지 않는다", () => {
  const variants: Array<[string, AwsOpts]> = [
    ["문 일부만", { doors: { net: "skipped", sto: "skipped" } }], ["mfa·key 없음", { doors: { mfa: "skipped", key: "skipped" } }], ["list-users 실패", { usersResult: "error" }],
    ["list-users 잘림", { usersResult: "truncated" }], ["요약 불일치", { summaryUsers: 9 }], ["모든 문 건너뜀", { doors: { mfa: "skipped", key: "skipped", net: "skipped", sto: "skipped", log: "skipped" } }],
  ];
  for (const [name, o] of variants) it(name, () => { expect(() => ok(buildInput([rec(awsFile(o).file)]))).not.toThrow(); });
});
