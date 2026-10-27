// src/app/cloudcheck/_client/mocks/reports.ts — 손으로 만든 목업 Report(모델 v1). 소유: 프론트팀장.
// 체험 세트 성격(UX §11-3 '요건' 열)을 반영했다. 카드 순서는 C → D → A → B(세트 글자는 화면에 쓰지 않는다).
//  C 아슬아슬상회 — 위험이 보이는 회사: firstLook=findings(서로 다른 문의 위험 3개), 위험 행 5개(모두 fix 있음), 위험·주의 섞임, 대상 표 3행 이상
//  D 반쯤본상회  — 확인 불가가 많은 회사: 권한 해제 힌트(권한 하나로 점검 2개), doors-skipped·areas-not-judged, isolated-denial, scope.missing,
//                  확인 불가 사유 6종, 직접 볼 목록(unknown-item 6개 묶음·unknown-rule·out-of-scope·auto-notice), 해당 없음만 있는 문(현관)
//  A 반듯상회    — 이상 없음·해당 없음: AWS는 firstLook=none-found(이상 없음 6 · 해당 없음 4), Azure는 firstLook=unlock(Entra MFA 가이드 카드)
//  B 멈춘시계상회 — 주의: 주의 7행(모두 questionKey), 위험 0, legacy-hint·intended-public-candidate 라벨, 예외 연습용 주의 대상 여러 개
// 추가: REPORT_REAL_D(실제 모드 + 알림 최대 밀도), REPORT_HOSTILE(적대 값 — R-12·G-D8 렌더 검사용)
// 가짜 계정 ID는 문서 표본 값(111122223333, 0으로 채운 GUID)만 쓴다(방향서 §10-7).
import type { DisplayValue, DoorId, IdentityBlock, InputSummary, ItemResult, ManualCheckItem, Report, Resolution, RuleId, ScopeBlock } from "../../../../lib/cloudcheck/model/report";
import {
  c, cautionItem, clearItem, collected, collectedAt, d, door, ev, evCsv, fact, globalProven, item, iso, msg, n, naCoverage, notCollected,
  partialCoverage, plain, receipt, receiptsSummary, redacted, region, regionsProven, report, resource, riskItem, rule, sens, subsProven, unknownItem,
} from "./build";

export const AWS_ACCOUNT = "111122223333";
export const AZURE_TENANT = "00000000-0000-0000-0000-000000000000";
const SUB1 = "00000000-0000-0000-0000-000000000001";
const SUB2 = "00000000-0000-0000-0000-000000000002";
const AT = "2026-10-19T03:12:00Z";
const CRED_AT = "2026-10-19T03:10:41Z";
const AS = collectedAt(AT);
const SEOUL = "ap-northeast-2";
const G = plain("global");

/* ───────── 공통 머리 ───────── */
function awsIdentity(principal: DisplayValue | null, principalType: IdentityBlock["principalType"] = "assumed-role"): IdentityBlock {
  return {
    cloud: "aws", account: sens("accountId", AWS_ACCOUNT, "••••3333"), accountLast4: "3333", alias: null, currentSubscription: null,
    principalType, principalName: principal, source: "collector", confirmed: "interactive",
  };
}
function awsScope(checked: number, visible: number, missing: ScopeBlock["missing"] = []): ScopeBlock {
  return { unit: "region", checked, visible, missing, outOfScope: [], subscriptions: [], proven: missing.length === 0 };
}
const ALL_USED: InputSummary["doors"] = { mfa: "used", key: "used", net: "used", sto: "used", log: "used" };
function awsInput(doors: InputSummary["doors"] = ALL_USED, via: InputSummary["via"] = "demo", knownRelease: boolean | null = null): InputSummary {
  return {
    index: 0, kind: "collector-json", via, name: sens("fileName", via === "demo" ? "cloudcheck-demo.aws.json" : "cloudcheck-result.json", "file-001"),
    bytes: 48_213, asOf: AS, collector: { name: "cloudcheck-aws", version: "1.0.0", knownRelease }, schema: { id: "cloudcheck.collect/1.0", support: "exact" },
    doors, scopeProven: true,
  };
}
const NO_PERMISSIONS: Report["permissions"] = { denied: [], unlockHints: [] };
const DEMO = (setId: "A" | "B" | "C" | "D"): Report["mode"] => ({ kind: "demo", setId });

/* ───────── 호출 기록(증거) ───────── */
const R = {
  cred: receipt("0:r-0004", "iam:GetCredentialReport", G, "ok", "2026-10-19T03:10:42Z"),
  summary: receipt("0:r-0005", "iam:GetAccountSummary", G, "ok", "2026-10-19T03:10:43Z"),
  users: receipt("0:r-0006", "iam:ListUsers", G, "ok", "2026-10-19T03:10:44Z", 3),
  roles: receipt("0:r-0013", "iam:ListRoles", G, "ok", "2026-10-19T03:10:50Z", 2),
  sg: receipt("0:r-0101", "ec2:DescribeSecurityGroups", plain(SEOUL), "ok", "2026-10-19T03:11:02Z", 4),
  eni: receipt("0:r-0102", "ec2:DescribeNetworkInterfaces", plain(SEOUL), "ok", "2026-10-19T03:11:03Z", 3),
  pabAcct: receipt("0:r-0150", "s3:GetAccountPublicAccessBlock", G, "ok", "2026-10-19T03:11:20Z"),
  buckets: receipt("0:r-0151", "s3:ListAllMyBuckets", G, "ok", "2026-10-19T03:11:21Z", 3),
  trails: receipt("0:r-0190", "cloudtrail:DescribeTrails", G, "ok", "2026-10-19T03:11:50Z", 1),
};
const keyReceipt = (i: number, result: "ok" | "denied" = "ok") =>
  receipt(`0:r-${String(30 + i).padStart(4, "0")}`, "iam:ListAccessKeys", G, result, "2026-10-19T03:10:46Z", result === "ok" ? 1 : null, result === "ok" ? null : "AccessDenied");
const bucketReceipt = (i: number, call: string, result: "ok" | "denied" = "ok") =>
  receipt(`0:r-${String(160 + i).padStart(4, "0")}`, call, plain(SEOUL), result, "2026-10-19T03:11:25Z", null, result === "ok" ? null : "AccessDenied");

/* ───────── 대상 만들기 ───────── */
const user = (name: string, masked: string) => resource("aws", AWS_ACCOUNT, "iam-user", name, sens("userName", name, masked));
const userKey = (name: string, masked: string, suffix: string) => resource("aws", AWS_ACCOUNT, "access-key", `${name}:${suffix}`, sens("userName", name, masked));
const role = (name: string, masked: string) => resource("aws", AWS_ACCOUNT, "iam-role", name, sens("roleName", name, masked));
const bucket = (name: string, masked: string) => resource("aws", AWS_ACCOUNT, "s3-bucket", name, sens("resourceName", name, masked), region(SEOUL));
const sg = (id: string, name: string, masked: string) => resource("aws", AWS_ACCOUNT, "security-group", id, sens("resourceName", name, masked), region(SEOUL));
const root = () => resource("aws", AWS_ACCOUNT, "root", "root", plain("root"));
const account = () => resource("aws", AWS_ACCOUNT, "aws-account", AWS_ACCOUNT, sens("accountId", AWS_ACCOUNT, "••••3333"));
const trail = (name: string, masked: string) => resource("aws", AWS_ACCOUNT, "trail", name, sens("resourceName", name, masked), region(SEOUL));
const regionRes = (r: string) => resource("aws", AWS_ACCOUNT, "region", r, plain(r), region(r));

const perm = (...permissions: string[]): Resolution => ({ kind: "permission", permissions });
const RERUN: Resolution = { kind: "rerun", permissions: [] };
const GUIDE: Resolution = { kind: "guide", permissions: [] };
const NONE_COVERAGE = partialCoverage("none", null, null);

/* ═════════ C 아슬아슬상회(AWS) — 위험이 보이는 회사 ═════════ */
function buildC(): Report {
  const C = "AWS-MFA-2";
  return report({
    mode: DEMO("C"),
    identity: awsIdentity(sens("roleName", "cloudcheck-reader", "role-001")),
    scope: awsScope(17, 17),
    collection: { asOf: AS, asOfRange: null, credentialReport: { generatedAt: iso(CRED_AT), source: "api" }, receipts: receiptsSummary({ ok: 212, empty: 31, notconfigured: 6 }), inputs: [awsInput()] },
    permissions: NO_PERMISSIONS,
    banners: [],
    doors: [
      door("mfa", collected(AS), [
        rule("AWS-MFA-1", { status: "risk", why: msg("AWS-MFA-1:root-key-active", { n: n(1) }), asOf: AS, coverage: globalProven(1) }, [
          item("AWS-MFA-1", { id: "c-mfa1-root", resource: root(), facts: [fact("root-key-count", { n: n(1) })] }, riskItem(msg("AWS-MFA-1:root-access-key-active"), ev(R.cred), evCsv("access_key_1_active", 1))),
        ]),
        rule(C, { status: "risk", why: msg("AWS-MFA-2:console-no-mfa", { n: n(2) }), asOf: AS, coverage: globalProven(3) }, [
          item(C, { id: "c-mfa2-kim", resource: user("dev-kim", "user-001") }, riskItem(msg("AWS-MFA-2:user-no-mfa"), ev(R.cred))),
          item(C, { id: "c-mfa2-park", resource: user("intern-park", "user-002") }, riskItem(msg("AWS-MFA-2:user-no-mfa"), ev(R.cred))),
          item(C, { id: "c-mfa2-lee", resource: user("ops-lee", "user-003") }, clearItem(msg("AWS-MFA-2:user-has-mfa"), ev(R.cred))),
        ]),
      ]),
      door("key", collected(AS), [
        rule("AWS-KEY-4", { status: "risk", why: msg("AWS-KEY-4:trust-external-wildcard", { n: n(1) }), asOf: AS, coverage: globalProven(2) }, [
          item("AWS-KEY-4", { id: "c-key4-vendor", resource: role("vendor-access-role", "role-002"), facts: [fact("trust-principal", { principal: c("*") })] }, riskItem(msg("AWS-KEY-4:principal-wildcard"), ev(R.roles))),
          item("AWS-KEY-4", { id: "c-key4-ci", resource: role("ci-deploy-role", "role-003") }, clearItem(msg("AWS-KEY-4:trust-own-account"), ev(R.roles))),
        ]),
        rule("AWS-KEY-3", { status: "caution", why: msg("AWS-KEY-3:admin-keys-present", { n: n(1) }), asOf: AS, coverage: globalProven(1) }, [
          item("AWS-KEY-3", { id: "c-key3-kim", resource: user("dev-kim", "user-001"), facts: [fact("policy-name", { policy: c("AdministratorAccess") })] }, cautionItem(msg("AWS-KEY-3:admin-policy-with-key"), ev(keyReceipt(1)))),
        ]),
        rule("AWS-KEY-1", { status: "caution", why: msg("AWS-KEY-1:old-active-keys", { n: n(1), days: n(90) }), asOf: AS, coverage: globalProven(2) }, [
          item("AWS-KEY-1", { id: "c-key1-kim", resource: userKey("dev-kim", "user-001", "7Q2X"), facts: [fact("key-suffix", { suffix: c("7Q2X") }), fact("key-age-days", { n: n(412) })] }, cautionItem(msg("AWS-KEY-1:key-older-than-limit"), ev(keyReceipt(1)))),
          item("AWS-KEY-1", { id: "c-key1-lee", resource: userKey("ops-lee", "user-003", "M3PD"), facts: [fact("key-suffix", { suffix: c("M3PD") }), fact("key-age-days", { n: n(35) })] }, clearItem(msg("AWS-KEY-1:key-within-limit"), ev(keyReceipt(3)))),
        ]),
        rule("AWS-KEY-2", { status: "caution", why: msg("AWS-KEY-2:unused-credentials", { n: n(1), days: n(45) }), asOf: AS, coverage: globalProven(3) }, [
          item("AWS-KEY-2", { id: "c-key2-park", resource: user("intern-park", "user-002"), facts: [fact("last-used-days", { n: n(120) })] }, cautionItem(msg("AWS-KEY-2:password-unused"), ev(R.cred))),
          item("AWS-KEY-2", { id: "c-key2-kim", resource: user("dev-kim", "user-001") }, clearItem(msg("AWS-KEY-2:recently-used"), ev(R.cred))),
          item("AWS-KEY-2", { id: "c-key2-lee", resource: user("ops-lee", "user-003") }, clearItem(msg("AWS-KEY-2:recently-used"), ev(R.cred))),
        ]),
      ]),
      door("net", collected(AS), [
        rule("AWS-NET-1", { status: "risk", why: msg("AWS-NET-1:exposed-with-public-ip", { ports: c("22, 3389"), n: n(2) }), asOf: AS, coverage: regionsProven(17, 4) }, [
          item("AWS-NET-1", { id: "c-net1-ssh", resource: sg("sg-0a1b2c3d4e5f60001", "launch-wizard-1", "sg-001"), facts: [fact("port-cidr", { port: c("22/tcp"), cidr: c("0.0.0.0/0") }), fact("public-ip-attached")] }, riskItem(msg("AWS-NET-1:port-open-public-ip"), ev(R.sg), ev(R.eni))),
          item("AWS-NET-1", { id: "c-net1-rdp", resource: sg("sg-0a1b2c3d4e5f60002", "windows-admin", "sg-002"), facts: [fact("port-cidr", { port: c("3389/tcp"), cidr: c("0.0.0.0/0") }), fact("public-ip-attached")] }, riskItem(msg("AWS-NET-1:port-open-public-ip"), ev(R.sg), ev(R.eni))),
          item("AWS-NET-1", { id: "c-net1-mail", resource: sg("sg-0a1b2c3d4e5f60003", "mail-relay", "sg-003"), facts: [fact("port-cidr", { port: c("25/tcp"), cidr: c("0.0.0.0/0") })] }, cautionItem(msg("AWS-NET-1:open-mail-port", { ports: c("25") }), ev(R.sg))),
          item("AWS-NET-1", { id: "c-net1-internal", resource: sg("sg-0a1b2c3d4e5f60004", "internal-only", "sg-004") }, clearItem(msg("AWS-NET-1:no-open-rule"), ev(R.sg))),
        ]),
      ]),
      door("sto", collected(AS), [
        rule("AWS-STO-2", { status: "risk", why: msg("AWS-STO-2:bucket-public", { n: n(2) }), asOf: AS, coverage: globalProven(3) }, [
          item("AWS-STO-2", { id: "c-sto2-share", resource: bucket("acme-share-files", "bucket-001"), facts: [fact("policy-public")] }, riskItem(msg("AWS-STO-2:policy-public"), ev(bucketReceipt(1, "s3:GetBucketPolicyStatus")))),
          item("AWS-STO-2", { id: "c-sto2-uploads", resource: bucket("acme-old-uploads", "bucket-002"), facts: [fact("acl-all-users", { permission: c("READ") })] }, riskItem(msg("AWS-STO-2:acl-all-users"), ev(bucketReceipt(2, "s3:GetBucketAcl")))),
          item("AWS-STO-2", { id: "c-sto2-logs", resource: bucket("acme-app-logs", "bucket-003") }, clearItem(msg("AWS-STO-2:not-public"), ev(bucketReceipt(3, "s3:GetBucketPolicyStatus")), ev(bucketReceipt(4, "s3:GetBucketAcl")))),
        ]),
        rule("AWS-STO-1", { status: "caution", why: msg("AWS-STO-1:account-block-off"), asOf: AS, coverage: globalProven(1) }, [
          item("AWS-STO-1", { id: "c-sto1-acct", resource: account(), facts: [fact("block-flags-off", { n: n(4) })] }, cautionItem(msg("AWS-STO-1:block-settings-off"), ev(R.pabAcct))),
        ]),
      ]),
      door("log", collected(AS), [
        rule("AWS-LOG-1", { status: "caution", why: msg("AWS-LOG-1:no-trail"), asOf: AS, coverage: globalProven(1) }, [
          item("AWS-LOG-1", { id: "c-log1-acct", resource: account() }, cautionItem(msg("AWS-LOG-1:no-trail"), ev(receipt("0:r-0190", "cloudtrail:DescribeTrails", G, "empty", "2026-10-19T03:11:50Z", 0)))),
        ]),
      ]),
    ],
    manual: [],
  });
}

/* ═════════ B 멈춘시계상회(AWS) — 주의는 무엇을 묻나 ═════════ */
function buildB(): Report {
  return report({
    mode: DEMO("B"),
    identity: awsIdentity(sens("roleName", "cloudcheck-reader", "role-001")),
    scope: awsScope(17, 17),
    collection: { asOf: AS, asOfRange: null, credentialReport: { generatedAt: iso(CRED_AT), source: "api" }, receipts: receiptsSummary({ ok: 188, empty: 40, notconfigured: 9 }), inputs: [awsInput()] },
    permissions: NO_PERMISSIONS,
    banners: [],
    doors: [
      door("mfa", collected(AS), [
        rule("AWS-MFA-1", { status: "clear", why: msg("AWS-MFA-1:root-ok"), asOf: AS, coverage: globalProven(1) }, [
          item("AWS-MFA-1", { id: "b-mfa1-root", resource: root() }, clearItem(msg("AWS-MFA-1:root-mfa-on-no-keys"), ev(R.cred), ev(R.summary))),
        ]),
        rule("AWS-MFA-2", { status: "clear", why: msg("AWS-MFA-2:all-mfa", { n: n(2) }), asOf: AS, coverage: globalProven(2) }, [
          item("AWS-MFA-2", { id: "b-mfa2-kim", resource: user("kim-2019", "user-001") }, clearItem(msg("AWS-MFA-2:user-has-mfa"), ev(R.cred))),
          item("AWS-MFA-2", { id: "b-mfa2-choi", resource: user("choi-2020", "user-002") }, clearItem(msg("AWS-MFA-2:user-has-mfa"), ev(R.cred))),
        ]),
      ]),
      door("key", collected(AS), [
        rule("AWS-KEY-4", { status: "clear", why: msg("AWS-KEY-4:no-external-trust", { n: n(2) }), asOf: AS, coverage: globalProven(2) }, [
          item("AWS-KEY-4", { id: "b-key4-app", resource: role("app-runtime-role", "role-002") }, clearItem(msg("AWS-KEY-4:trust-service-only"), ev(R.roles))),
          item("AWS-KEY-4", { id: "b-key4-batch", resource: role("batch-role", "role-003") }, clearItem(msg("AWS-KEY-4:trust-own-account"), ev(R.roles))),
        ]),
        rule("AWS-KEY-3", { status: "caution", why: msg("AWS-KEY-3:admin-keys-present", { n: n(1) }), asOf: AS, coverage: globalProven(1) }, [
          item("AWS-KEY-3", { id: "b-key3-admin", resource: user("old-admin", "user-003"), facts: [fact("policy-name", { policy: c("AdministratorAccess") })] }, cautionItem(msg("AWS-KEY-3:admin-policy-with-key"), ev(keyReceipt(3)))),
        ]),
        rule("AWS-KEY-1", { status: "caution", why: msg("AWS-KEY-1:old-active-keys", { n: n(2), days: n(90) }), asOf: AS, coverage: globalProven(3) }, [
          item("AWS-KEY-1", { id: "b-key1-kim", resource: userKey("kim-2019", "user-001", "K9AA"), facts: [fact("key-suffix", { suffix: c("K9AA") }), fact("key-age-days", { n: n(400) })] }, cautionItem(msg("AWS-KEY-1:key-older-than-limit"), ev(keyReceipt(1)))),
          item("AWS-KEY-1", { id: "b-key1-choi", resource: userKey("choi-2020", "user-002", "Z0QE"), facts: [fact("key-suffix", { suffix: c("Z0QE") }), fact("key-age-days", { n: n(190) })] }, cautionItem(msg("AWS-KEY-1:key-older-than-limit"), ev(keyReceipt(2)))),
          item("AWS-KEY-1", { id: "b-key1-admin", resource: userKey("old-admin", "user-003", "B7TT"), facts: [fact("key-suffix", { suffix: c("B7TT") }), fact("key-age-days", { n: n(20) })] }, clearItem(msg("AWS-KEY-1:key-within-limit"), ev(keyReceipt(3)))),
        ]),
        rule("AWS-KEY-2", { status: "caution", why: msg("AWS-KEY-2:unused-credentials", { n: n(1), days: n(45) }), asOf: AS, coverage: globalProven(3) }, [
          item("AWS-KEY-2", { id: "b-key2-admin", resource: user("old-admin", "user-003"), facts: [fact("last-used-days", { n: n(200) })] }, cautionItem(msg("AWS-KEY-2:key-unused"), ev(R.cred))),
          item("AWS-KEY-2", { id: "b-key2-kim", resource: user("kim-2019", "user-001") }, clearItem(msg("AWS-KEY-2:recently-used"), ev(R.cred))),
          item("AWS-KEY-2", { id: "b-key2-choi", resource: user("choi-2020", "user-002") }, clearItem(msg("AWS-KEY-2:recently-used"), ev(R.cred))),
        ]),
      ]),
      door("net", collected(AS), [
        rule("AWS-NET-1", { status: "caution", why: msg("AWS-NET-1:open-mail-port", { ports: c("25") }), asOf: AS, coverage: regionsProven(17, 2) }, [
          item("AWS-NET-1", { id: "b-net1-mail", resource: sg("sg-0b1b2c3d4e5f60001", "legacy-mail", "sg-001"), facts: [fact("port-cidr", { port: c("25/tcp"), cidr: c("0.0.0.0/0") })] }, cautionItem(msg("AWS-NET-1:open-mail-port", { ports: c("25") }), ev(R.sg))),
          item("AWS-NET-1", { id: "b-net1-web", resource: sg("sg-0b1b2c3d4e5f60002", "web-lb", "sg-002") }, clearItem(msg("AWS-NET-1:no-open-rule"), ev(R.sg))),
        ]),
      ]),
      door("sto", collected(AS), [
        rule("AWS-STO-2", { status: "caution", why: msg("AWS-STO-2:needs-review", { n: n(2) }), asOf: AS, coverage: globalProven(3) }, [
          item("AWS-STO-2", {
            id: "b-sto2-assets", resource: bucket("oldsite-assets-2019", "bucket-001"), facts: [fact("created-on", { date: d("2019-03-04") })],
            labels: [{ kind: "legacy-hint", basis: "created-before-2023-04" }, { kind: "name-hint", hint: "assets" }],
          }, cautionItem(msg("AWS-STO-2:block-off-not-public"), ev(bucketReceipt(11, "s3:GetBucketPublicAccessBlock")), ev(bucketReceipt(12, "s3:GetBucketPolicyStatus")))),
          item("AWS-STO-2", {
            id: "b-sto2-www", resource: bucket("oldsite-static-www", "bucket-002"), facts: [fact("website-enabled")],
            labels: [{ kind: "intended-public-candidate", basis: "static-website" }, { kind: "name-hint", hint: "static" }],
          }, cautionItem(msg("AWS-STO-2:static-website"), ev(bucketReceipt(13, "s3:GetBucketWebsite")))),
          item("AWS-STO-2", { id: "b-sto2-backup", resource: bucket("backup-2024", "bucket-003") }, clearItem(msg("AWS-STO-2:not-public"), ev(bucketReceipt(14, "s3:GetBucketPolicyStatus")))),
        ]),
        rule("AWS-STO-1", { status: "caution", why: msg("AWS-STO-1:account-block-missing"), asOf: AS, coverage: globalProven(1) }, [
          item("AWS-STO-1", { id: "b-sto1-acct", resource: account() }, cautionItem(msg("AWS-STO-1:no-account-block-config"),
            ev(receipt("0:r-0150", "s3:GetAccountPublicAccessBlock", G, "notconfigured", "2026-10-19T03:11:20Z", null, "NoSuchPublicAccessBlockConfiguration")))),
        ]),
      ]),
      door("log", collected(AS), [
        rule("AWS-LOG-1", { status: "caution", why: msg("AWS-LOG-1:no-trail"), asOf: AS, coverage: globalProven(1) }, [
          item("AWS-LOG-1", { id: "b-log1-acct", resource: account() }, cautionItem(msg("AWS-LOG-1:no-trail"), ev(receipt("0:r-0190", "cloudtrail:DescribeTrails", G, "empty", "2026-10-19T03:11:50Z", 0)))),
        ]),
      ]),
    ],
    manual: [],
  });
}

/* ═════════ A 반듯상회(AWS) — 이상 없음과 해당 없음 ═════════ */
const AUTO_NOTICE_IDP: ManualCheckItem = {
  id: "m-aws-mfa-2-idp", origin: "auto-notice", door: "mfa", ruleId: "AWS-MFA-2", resource: null,
  what: msg("fact:idp-mfa"), why: null, howKey: "cc.rule.aws-mfa-2.auto.how", resolution: null,
};
function buildA(): Report {
  return report({
    mode: DEMO("A"),
    identity: awsIdentity(sens("roleName", "cloudcheck-reader", "role-001")),
    scope: awsScope(17, 17),
    collection: { asOf: AS, asOfRange: null, credentialReport: { generatedAt: iso(CRED_AT), source: "api" }, receipts: receiptsSummary({ ok: 120, empty: 58, notconfigured: 2 }), inputs: [awsInput()] },
    permissions: NO_PERMISSIONS,
    banners: [],
    doors: [
      door("mfa", collected(AS), [
        rule("AWS-MFA-1", { status: "clear", why: msg("AWS-MFA-1:root-ok"), asOf: AS, coverage: globalProven(1) }, [
          item("AWS-MFA-1", { id: "a-mfa1-root", resource: root() }, clearItem(msg("AWS-MFA-1:root-mfa-on-no-keys"), ev(R.cred), ev(R.summary))),
        ]),
        rule("AWS-MFA-2", { status: "na", why: msg("no-targets-proven"), basis: msg("AWS-MFA-2:na-no-console-users"), asOf: AS, coverage: naCoverage("account-global") }),
      ]),
      door("key", collected(AS), [
        rule("AWS-KEY-4", { status: "clear", why: msg("AWS-KEY-4:no-external-trust", { n: n(3) }), asOf: AS, coverage: globalProven(3) }, [
          item("AWS-KEY-4", { id: "a-key4-app", resource: role("app-runtime-role", "role-002") }, clearItem(msg("AWS-KEY-4:trust-service-only"), ev(R.roles))),
          item("AWS-KEY-4", { id: "a-key4-sso", resource: role("sso-admin-role", "role-003") }, clearItem(msg("AWS-KEY-4:trust-own-account"), ev(R.roles))),
          item("AWS-KEY-4", { id: "a-key4-ro", resource: role("readonly-role", "role-004") }, clearItem(msg("AWS-KEY-4:trust-own-account"), ev(R.roles))),
        ]),
        rule("AWS-KEY-3", { status: "na", why: msg("no-targets-proven"), basis: msg("AWS-KEY-3:na-no-admin-key-users"), asOf: AS, coverage: naCoverage("account-global") }),
        rule("AWS-KEY-1", { status: "na", why: msg("no-targets-proven"), basis: msg("AWS-KEY-1:na-no-active-keys"), asOf: AS, coverage: naCoverage("account-global") }),
        rule("AWS-KEY-2", { status: "na", why: msg("no-targets-proven"), basis: msg("AWS-KEY-2:na-no-credentials"), asOf: AS, coverage: naCoverage("account-global") }),
      ]),
      door("net", collected(AS), [
        rule("AWS-NET-1", { status: "clear", why: msg("AWS-NET-1:none-open", { n: n(17) }), asOf: AS, coverage: regionsProven(17, 3) }, [
          item("AWS-NET-1", { id: "a-net1-web", resource: sg("sg-0c1b2c3d4e5f60001", "web-lb", "sg-001") }, clearItem(msg("AWS-NET-1:no-open-rule"), ev(R.sg))),
          item("AWS-NET-1", { id: "a-net1-app", resource: sg("sg-0c1b2c3d4e5f60002", "app-tier", "sg-002") }, clearItem(msg("AWS-NET-1:no-open-rule"), ev(R.sg))),
          item("AWS-NET-1", { id: "a-net1-db", resource: sg("sg-0c1b2c3d4e5f60003", "db-tier", "sg-003") }, clearItem(msg("AWS-NET-1:no-open-rule"), ev(R.sg))),
        ]),
      ]),
      door("sto", collected(AS), [
        rule("AWS-STO-2", { status: "clear", why: msg("AWS-STO-2:none-public", { n: n(4) }), asOf: AS, coverage: globalProven(4) }, [
          item("AWS-STO-2", { id: "a-sto2-1", resource: bucket("tidy-app-data", "bucket-001") }, clearItem(msg("AWS-STO-2:not-public"), ev(bucketReceipt(21, "s3:GetBucketPolicyStatus")))),
          item("AWS-STO-2", { id: "a-sto2-2", resource: bucket("tidy-backups", "bucket-002") }, clearItem(msg("AWS-STO-2:not-public"), ev(bucketReceipt(22, "s3:GetBucketPolicyStatus")))),
          item("AWS-STO-2", { id: "a-sto2-3", resource: bucket("tidy-reports", "bucket-003") }, clearItem(msg("AWS-STO-2:not-public"), ev(bucketReceipt(23, "s3:GetBucketPolicyStatus")))),
          item("AWS-STO-2", { id: "a-sto2-4", resource: bucket("tidy-trail-logs", "bucket-004") }, clearItem(msg("AWS-STO-2:not-public"), ev(bucketReceipt(24, "s3:GetBucketPolicyStatus")))),
        ]),
        rule("AWS-STO-1", { status: "clear", why: msg("AWS-STO-1:account-block-all-on"), asOf: AS, coverage: globalProven(1) }, [
          item("AWS-STO-1", { id: "a-sto1-acct", resource: account() }, clearItem(msg("AWS-STO-1:block-settings-on"), ev(R.pabAcct))),
        ]),
      ]),
      door("log", collected(AS), [
        rule("AWS-LOG-1", { status: "clear", why: msg("AWS-LOG-1:trail-logging"), asOf: AS, coverage: globalProven(1) }, [
          item("AWS-LOG-1", { id: "a-log1-trail", resource: trail("org-trail", "trail-001") }, clearItem(msg("AWS-LOG-1:multi-region-logging"), ev(R.trails))),
        ]),
      ]),
    ],
    manual: [AUTO_NOTICE_IDP],
  });
}

/* ═════════ D 반쯤본상회(AWS) — 확인 불가는 왜 생기나 ═════════ */
const D_USERS = [
  ["svc-reports", "user-001"], ["svc-backup", "user-002"], ["svc-sync", "user-003"],
  ["svc-export", "user-004"], ["svc-import", "user-005"], ["svc-billing", "user-006"],
] as const;
function deniedUserItems(ruleId: RuleId, call: string, permission: string, offset: number): ItemResult[] {
  return D_USERS.map(([name, masked], i) =>
    item(ruleId, { id: `d-${ruleId.toLowerCase()}-${i + 1}`, resource: user(name, masked) },
      unknownItem(msg("denied"), perm(permission), ev(receipt(`0:r-${String(offset + i).padStart(4, "0")}`, call, G, "denied", "2026-10-19T03:10:47Z", null, "AccessDenied")))),
  );
}
function manualFromUnknownItems(items: readonly ItemResult[], doorId: DoorId, howKey: `cc.${string}`): ManualCheckItem[] {
  return items.flatMap((it) => it.status !== "unknown" ? [] : [{
    id: `m-${it.id}`, origin: "unknown-item" as const, door: doorId, ruleId: it.ruleId, resource: it.resource,
    what: msg("fact:access-keys"), why: it.why, howKey, resolution: it.resolution,
  }]);
}
function buildD(): Report {
  const key1Items = deniedUserItems("AWS-KEY-1", "iam:ListAccessKeys", "iam:ListAccessKeys", 31);
  const key2Items = deniedUserItems("AWS-KEY-2", "iam:ListAccessKeys", "iam:ListAccessKeys", 31);
  const key3Items = deniedUserItems("AWS-KEY-3", "iam:ListAttachedUserPolicies", "iam:ListAttachedUserPolicies", 41);
  const sgDenied = receipt("0:r-0201", "ec2:DescribeSecurityGroups", plain("ap-east-1"), "denied", "2026-10-19T03:11:04Z", null, "UnauthorizedOperation");
  const sgUnsupported = receipt("0:r-0202", "ec2:DescribeSecurityGroups", plain("me-south-1"), "unsupported", "2026-10-19T03:11:05Z", null, "OptInRequired");
  const isolated = bucketReceipt(31, "s3:GetBucketPolicyStatus", "denied");
  const manual: ManualCheckItem[] = [
    AUTO_NOTICE_IDP,
    ...manualFromUnknownItems(key1Items, "key", "cc.rule.aws-key-1.how"),
    { id: "m-d-key4", origin: "unknown-rule", door: "key", ruleId: "AWS-KEY-4", resource: null, what: msg("fact:role-trust"), why: msg("truncated"), howKey: "cc.rule.aws-key-4.how", resolution: RERUN },
    { id: "m-d-net1", origin: "unknown-rule", door: "net", ruleId: "AWS-NET-1", resource: null, what: msg("fact:regions-unchecked", { n: n(2) }), why: msg("region-missing"), howKey: "cc.rule.aws-net-1.how", resolution: perm("ec2:DescribeSecurityGroups") },
    { id: "m-d-sto1", origin: "unknown-rule", door: "sto", ruleId: "AWS-STO-1", resource: null, what: msg("fact:account-block"), why: msg("field-missing"), howKey: "cc.rule.aws-sto-1.how", resolution: RERUN },
    { id: "m-d-log1", origin: "out-of-scope", door: "log", ruleId: "AWS-LOG-1", resource: null, what: msg("fact:cloudtrail"), why: null, howKey: "cc.rule.common.how-not-collected", resolution: RERUN },
  ];
  return report({
    mode: DEMO("D"),
    identity: awsIdentity(sens("userName", "readonly-helper", "user-007"), "iam-user"),
    scope: awsScope(15, 17, [
      { name: plain("ap-east-1"), reason: "denied", receiptId: "0:r-0201" },
      { name: plain("me-south-1"), reason: "unsupported", receiptId: "0:r-0202" },
    ]),
    collection: {
      asOf: AS, asOfRange: null, credentialReport: { generatedAt: iso(CRED_AT), source: "api" },
      receipts: receiptsSummary({ ok: 96, empty: 22, notconfigured: 1, denied: 14, unsupported: 1, truncated: 1, error: 1 }),
      inputs: [awsInput({ mfa: "used", key: "used", net: "used", sto: "used", log: "skipped" })],
    },
    permissions: {
      denied: [
        { call: "iam:ListAccessKeys", permission: "iam:ListAccessKeys", scope: G, errorCode: "AccessDenied", receiptIds: D_USERS.map((_, i) => `0:r-${String(31 + i).padStart(4, "0")}`), times: 6, ruleIds: ["AWS-KEY-1", "AWS-KEY-2"] },
        { call: "iam:ListAttachedUserPolicies", permission: "iam:ListAttachedUserPolicies", scope: G, errorCode: "AccessDenied", receiptIds: D_USERS.map((_, i) => `0:r-${String(41 + i).padStart(4, "0")}`), times: 6, ruleIds: ["AWS-KEY-3"] },
        { call: "ec2:DescribeSecurityGroups", permission: "ec2:DescribeSecurityGroups", scope: plain("ap-east-1"), errorCode: "UnauthorizedOperation", receiptIds: ["0:r-0201"], times: 1, ruleIds: ["AWS-NET-1"] },
        { call: "s3:GetBucketPolicyStatus", permission: "s3:GetBucketPolicyStatus", scope: plain(SEOUL), errorCode: "AccessDenied", receiptIds: [isolated.id], times: 1, ruleIds: ["AWS-STO-2"] },
      ],
      unlockHints: [
        { permission: "iam:ListAccessKeys", unlocks: [{ ruleId: "AWS-KEY-1", items: 6 }, { ruleId: "AWS-KEY-2", items: 6 }], total: 12 },
        { permission: "iam:ListAttachedUserPolicies", unlocks: [{ ruleId: "AWS-KEY-3", items: 6 }], total: 6 },
        { permission: "ec2:DescribeSecurityGroups", unlocks: [{ ruleId: "AWS-NET-1", items: 1 }], total: 1 },
      ],
    },
    banners: [
      { kind: "areas-not-judged", doors: ["sto"], reason: "field-missing" },
      { kind: "doors-skipped", doors: ["log"] },
    ],
    doors: [
      door("mfa", collected(AS), [
        rule("AWS-MFA-1", { status: "na", why: msg("no-targets-proven"), basis: msg("AWS-MFA-1:na-org-member-no-root"), asOf: AS, coverage: naCoverage("account-global") }),
        rule("AWS-MFA-2", { status: "na", why: msg("no-targets-proven"), basis: msg("AWS-MFA-2:na-no-console-users"), asOf: AS, coverage: naCoverage("account-global") }),
      ]),
      door("key", { status: "partial", judgeLevel: "full", reason: msg("denied"), asOf: AS, inputIndex: 0 }, [
        rule("AWS-KEY-4", { status: "unknown", why: msg("truncated"), gaps: ["truncated"], asOf: AS, coverage: partialCoverage("account-global", 1, 1), resolution: RERUN }, [
          item("AWS-KEY-4", { id: "d-key4-a", resource: role("reports-role", "role-001") }, clearItem(msg("AWS-KEY-4:trust-own-account"), ev(receipt("0:r-0013", "iam:ListRoles", G, "truncated", "2026-10-19T03:10:50Z", 100)))),
          item("AWS-KEY-4", { id: "d-key4-b", resource: role("sync-role", "role-002") }, clearItem(msg("AWS-KEY-4:trust-service-only"), ev(receipt("0:r-0013", "iam:ListRoles", G, "truncated", "2026-10-19T03:10:50Z", 100)))),
        ]),
        rule("AWS-KEY-3", { status: "unknown", why: msg("denied"), gaps: ["denied"], asOf: AS, coverage: partialCoverage("account-global", 1, 1), resolution: perm("iam:ListAttachedUserPolicies") }, key3Items),
        rule("AWS-KEY-1", { status: "unknown", why: msg("denied"), gaps: ["denied"], asOf: AS, coverage: partialCoverage("account-global", 1, 1), resolution: perm("iam:ListAccessKeys") }, key1Items),
        rule("AWS-KEY-2", { status: "unknown", why: msg("denied"), gaps: ["denied", "population-mismatch"], asOf: AS, coverage: partialCoverage("account-global", 1, 1), resolution: perm("iam:ListAccessKeys") }, key2Items),
      ]),
      door("net", { status: "partial", judgeLevel: "full", reason: msg("region-missing"), asOf: AS, inputIndex: 0 }, [
        rule("AWS-NET-1", { status: "unknown", why: msg("region-missing"), gaps: ["region-missing"], asOf: AS, coverage: partialCoverage("regions", 15, 17), resolution: perm("ec2:DescribeSecurityGroups") }, [
          item("AWS-NET-1", { id: "d-net1-east", resource: regionRes("ap-east-1") }, unknownItem(msg("denied"), perm("ec2:DescribeSecurityGroups"), ev(sgDenied))),
          item("AWS-NET-1", { id: "d-net1-me", resource: regionRes("me-south-1") }, unknownItem(msg("unsupported"), RERUN, ev(sgUnsupported))),
          item("AWS-NET-1", { id: "d-net1-web", resource: sg("sg-0d1b2c3d4e5f60001", "web-lb", "sg-001") }, clearItem(msg("AWS-NET-1:no-open-rule"), ev(R.sg))),
        ]),
      ]),
      door("sto", collected(AS), [
        rule("AWS-STO-2", { status: "caution", why: msg("isolated-denial"), asOf: AS, coverage: partialCoverage("account-global", 1, 1) }, [
          item("AWS-STO-2", { id: "d-sto2-reports", resource: bucket("team-reports", "bucket-001") }, cautionItem(msg("isolated-denial"), ev(isolated))),
          item("AWS-STO-2", { id: "d-sto2-share", resource: bucket("team-share", "bucket-002") }, clearItem(msg("AWS-STO-2:not-public"), ev(bucketReceipt(32, "s3:GetBucketPolicyStatus")))),
          item("AWS-STO-2", { id: "d-sto2-media", resource: bucket("team-media", "bucket-003") }, clearItem(msg("AWS-STO-2:not-public"), ev(bucketReceipt(33, "s3:GetBucketPolicyStatus")))),
        ]),
        rule("AWS-STO-1", { status: "unknown", why: msg("field-missing"), gaps: ["field-missing"], asOf: AS, coverage: partialCoverage("account-global", 1, 1), resolution: RERUN }),
      ]),
      door("log", notCollected(), [
        rule("AWS-LOG-1", { status: "unknown", why: msg("not-collected"), gaps: ["not-collected"], asOf: null, coverage: NONE_COVERAGE, resolution: RERUN }, [], { inputIndex: null }),
      ]),
    ],
    manual,
  });
}

/* ═════════ A 반듯상회(Azure) — firstLook=unlock(Entra MFA 가이드 카드) ═════════ */
function buildAzureA(): Report {
  const ok = (id: string, call: string, sub: string, count: number | null = null) => receipt(id, call, sens("subscriptionId", sub, `••••${sub.slice(-4)}`), "ok", "2026-10-19T03:11:30Z", count);
  const sa = (sub: string, name: string, masked: string) =>
    resource("azure", AZURE_TENANT, "storage-account", `/subscriptions/${sub}/resourcegroups/rg-main/providers/microsoft.storage/storageaccounts/${name}`, sens("resourceName", name, masked), { kind: "subscription", value: sens("subscriptionId", sub, `••••${sub.slice(-4)}`) });
  const nsg = (sub: string, name: string, masked: string) =>
    resource("azure", AZURE_TENANT, "nsg", `/subscriptions/${sub}/resourcegroups/rg-main/providers/microsoft.network/networksecuritygroups/${name}`, sens("resourceName", name, masked), { kind: "subscription", value: sens("subscriptionId", sub, `••••${sub.slice(-4)}`) });
  const ctr = (sub: string, name: string, masked: string) =>
    resource("azure", AZURE_TENANT, "blob-container", `/subscriptions/${sub}/resourcegroups/rg-main/providers/microsoft.storage/storageaccounts/tidydata/blobservices/default/containers/${name}`, sens("resourceName", name, masked), { kind: "subscription", value: sens("subscriptionId", sub, `••••${sub.slice(-4)}`) });
  const sub1 = (id: string, n2: number | null = null) => ok(id, "azure:storage.account.list", SUB1, n2);
  const AZ_AS = AS;
  return report({
    mode: DEMO("A"),
    identity: {
      cloud: "azure", account: sens("tenantId", AZURE_TENANT, "••••0000"), accountLast4: "0000", alias: null,
      currentSubscription: sens("subscriptionId", SUB1, "••••0001"), principalType: "entra-user", principalName: null, source: "collector", confirmed: "interactive",
    },
    scope: {
      unit: "subscription", checked: 2, visible: 2, missing: [], outOfScope: [], proven: true,
      subscriptions: [
        { id: sens("subscriptionId", SUB1, "••••0001"), name: sens("subscriptionName", "tidy-main", "subscription-001"), state: "Enabled", queried: "ok" },
        { id: sens("subscriptionId", SUB2, "••••0002"), name: sens("subscriptionName", "tidy-dev", "subscription-002"), state: "Enabled", queried: "ok" },
      ],
    },
    collection: {
      asOf: AZ_AS, asOfRange: null, credentialReport: null, receipts: receiptsSummary({ ok: 41, empty: 12 }),
      inputs: [{
        index: 0, kind: "collector-json", via: "demo", name: sens("fileName", "cloudcheck-demo.azure.json", "file-001"), bytes: 21_904, asOf: AZ_AS,
        collector: { name: "cloudcheck-azure", version: "1.0.0", knownRelease: null }, schema: { id: "cloudcheck.collect/1.0", support: "exact" }, doors: ALL_USED, scopeProven: true,
      }],
    },
    permissions: NO_PERMISSIONS,
    banners: [],
    doors: [
      door("mfa", collected(AZ_AS), [
        rule("AZ-MFA-G", { status: "unknown", why: msg("guide-only"), gaps: ["guide-only"], asOf: null, coverage: NONE_COVERAGE, resolution: GUIDE }),
      ]),
      door("key", collected(AZ_AS), [
        rule("AZ-KEY-1", { status: "clear", why: msg("AZ-KEY-1:keys-recent-or-disabled", { n: n(2) }), asOf: AZ_AS, coverage: subsProven(2, 2) }, [
          item("AZ-KEY-1", { id: "az-key1-data", resource: sa(SUB1, "tidydata", "storage-001"), facts: [fact("shared-key-disabled")] }, clearItem(msg("AZ-KEY-1:shared-key-disabled"), ev(sub1("0:r-0021", 2)))),
          item("AZ-KEY-1", { id: "az-key1-logs", resource: sa(SUB2, "tidylogs", "storage-002"), facts: [fact("key-age-days", { n: n(30) })] }, clearItem(msg("AZ-KEY-1:keys-rotated"), ev(ok("0:r-0022", "azure:storage.account.list", SUB2, 1)))),
        ]),
      ]),
      door("net", collected(AZ_AS), [
        rule("AZ-NET-1", { status: "clear", why: msg("AZ-NET-1:none-open", { n: n(2) }), asOf: AZ_AS, coverage: subsProven(2, 2) }, [
          item("AZ-NET-1", { id: "az-net1-web", resource: nsg(SUB1, "nsg-web", "nsg-001") }, clearItem(msg("AZ-NET-1:no-open-rule"), ev(ok("0:r-0031", "azure:network.nsg.list", SUB1, 1)))),
          item("AZ-NET-1", { id: "az-net1-dev", resource: nsg(SUB2, "nsg-dev", "nsg-002") }, clearItem(msg("AZ-NET-1:no-open-rule"), ev(ok("0:r-0032", "azure:network.nsg.list", SUB2, 1)))),
        ]),
      ]),
      door("sto", collected(AZ_AS), [
        rule("AZ-STO-2", { status: "clear", why: msg("AZ-STO-2:no-public-containers", { n: n(3) }), asOf: AZ_AS, coverage: subsProven(2, 3) }, [
          item("AZ-STO-2", { id: "az-sto2-a", resource: ctr(SUB1, "reports", "container-001") }, clearItem(msg("AZ-STO-2:container-private"), ev(ok("0:r-0041", "azure:storage.container-rm.list", SUB1, 3)))),
          item("AZ-STO-2", { id: "az-sto2-b", resource: ctr(SUB1, "exports", "container-002") }, clearItem(msg("AZ-STO-2:container-private"), ev(ok("0:r-0041", "azure:storage.container-rm.list", SUB1, 3)))),
          item("AZ-STO-2", { id: "az-sto2-c", resource: ctr(SUB1, "uploads", "container-003") }, clearItem(msg("AZ-STO-2:container-private"), ev(ok("0:r-0041", "azure:storage.container-rm.list", SUB1, 3)))),
        ]),
        rule("AZ-STO-1", { status: "clear", why: msg("AZ-STO-1:all-blocked", { n: n(2) }), asOf: AZ_AS, coverage: subsProven(2, 2) }, [
          item("AZ-STO-1", { id: "az-sto1-data", resource: sa(SUB1, "tidydata", "storage-001") }, clearItem(msg("AZ-STO-1:anonymous-blocked"), ev(sub1("0:r-0021", 2)))),
          item("AZ-STO-1", { id: "az-sto1-logs", resource: sa(SUB2, "tidylogs", "storage-002") }, clearItem(msg("AZ-STO-1:anonymous-blocked"), ev(ok("0:r-0022", "azure:storage.account.list", SUB2, 1)))),
        ]),
      ]),
      door("log", collected(AZ_AS), [
        rule("AZ-LOG-1", { status: "clear", why: msg("AZ-LOG-1:exports-configured", { n: n(2) }), asOf: AZ_AS, coverage: subsProven(2, 2) }, [
          item("AZ-LOG-1", { id: "az-log1-main", resource: resource("azure", AZURE_TENANT, "subscription", SUB1, sens("subscriptionName", "tidy-main", "subscription-001"), null) }, clearItem(msg("AZ-LOG-1:export-on"), ev(ok("0:r-0051", "azure:monitor.diagnostic-settings.subscription.list", SUB1, 1)))),
          item("AZ-LOG-1", { id: "az-log1-dev", resource: resource("azure", AZURE_TENANT, "subscription", SUB2, sens("subscriptionName", "tidy-dev", "subscription-002"), null) }, clearItem(msg("AZ-LOG-1:export-on"), ev(ok("0:r-0052", "azure:monitor.diagnostic-settings.subscription.list", SUB2, 1)))),
        ]),
        rule("AZ-LOG-2", { status: "clear", why: msg("AZ-LOG-2:blob-logs-on", { n: n(2) }), asOf: AZ_AS, coverage: subsProven(2, 2) }, [
          item("AZ-LOG-2", { id: "az-log2-data", resource: sa(SUB1, "tidydata", "storage-001") }, clearItem(msg("AZ-LOG-2:blob-logs-on-item"), ev(ok("0:r-0061", "azure:monitor.diagnostic-settings.list", SUB1, 1)))),
          item("AZ-LOG-2", { id: "az-log2-logs", resource: sa(SUB2, "tidylogs", "storage-002") }, clearItem(msg("AZ-LOG-2:blob-logs-on-item"), ev(ok("0:r-0062", "azure:monitor.diagnostic-settings.list", SUB2, 1)))),
        ]),
      ]),
    ],
    manual: [{
      id: "m-az-mfa-g", origin: "guide-card", door: "mfa", ruleId: "AZ-MFA-G", resource: null,
      what: msg("fact:entra-mfa-policy"), why: null, howKey: "cc.rule.az-mfa-g.how", resolution: GUIDE,
    }],
  });
}

/* ═════════ 내보내기 ═════════ */
export const REPORT_C: Report = buildC();
export const REPORT_D: Report = buildD();
export const REPORT_A: Report = buildA();
export const REPORT_B: Report = buildB();
export const REPORT_AZURE_A: Report = buildAzureA();
/** 체험 카드 순서(C → D → A → B)대로 */
export const MOCK_REPORTS_AWS: readonly Report[] = [REPORT_C, REPORT_D, REPORT_A, REPORT_B];
export const MOCK_REPORTS: Readonly<Record<"A" | "B" | "C" | "D", Report>> = { A: REPORT_A, B: REPORT_B, C: REPORT_C, D: REPORT_D };

/** 실제 모드 D: beforeunload·맥락 줄 별칭·마스킹 사본·예외 내보내기 경로 + 알림 최대 밀도(엔진 배너 9종 중 7종) */
export const REPORT_REAL_D: Report = {
  ...REPORT_D,
  mode: { kind: "real" },
  identity: { ...REPORT_D.identity, alias: sens("alias", "halfseen-prod", "alias-001"), confirmed: "flag-yes" },
  collection: {
    ...REPORT_D.collection,
    inputs: [
      { ...awsInput({ mfa: "used", key: "used", net: "used", sto: "used", log: "skipped" }, "file", false), schema: { id: "cloudcheck.collect/1.1", support: "newer-minor" } },
      { ...awsInput({ mfa: "superseded", key: "superseded", net: "absent", sto: "absent", log: "absent" }, "file", false), index: 1, kind: "csv-credential-report", name: sens("fileName", "status_reports_2026-10-19.csv", "file-002"), collector: null, schema: null, asOf: { at: iso("2026-10-19T02:00:00Z"), source: "filename" } },
    ],
  },
  banners: [
    { kind: "secrets-detected", count: 1 },
    { kind: "areas-not-judged", doors: ["sto"], reason: "field-missing" },
    { kind: "schema-newer-minor", got: "cloudcheck.collect/1.1", supported: "cloudcheck.collect/1.0" },
    { kind: "identity-unconfirmed" },
    { kind: "collector-unknown-release" },
    // STEP 5 CC-QA-01: 입력 안의 기록이 기준 시각보다 늦다(엔진 순서 = 모델 Banner 순서 — collected-at-approximate 다음)
    { kind: "as-of-before-evidence" },
    { kind: "doors-skipped", doors: ["log"] },
    { kind: "duplicate-input-ignored", count: 1 },
  ],
};

/** 적대 값(엔진 정리 뒤의 모양: 양방향·제어 문자는 U+FFFD로 치환 + flag, 256자 상한 + truncated, 비밀 패턴은 redacted) */
export const HOSTILE_VALUES: readonly DisplayValue[] = [
  sens("resourceName", "<img src=x onerror=alert(1)>", "bucket-901"),
  sens("resourceName", "</script><script>alert(1)</script>", "bucket-902"),
  sens("resourceName", "evil\uFFFDtxt.sh", "bucket-903", ["bidi-replaced"]),
  sens("userName", `${"a".repeat(255)}\u2026`, "user-904", ["truncated"]),
  sens("userName", "__proto__", "user-905"),
  sens("roleName", "constructor", "role-906"),
  sens("freeText", "\"'><svg onload=alert(1)>", "•••"),
  sens("resourceName", "zero\uFFFDwidth", "sg-907", ["control-chars-replaced"]),
  redacted("secret-pattern"),
];
/** C의 모든 대상 이름·별칭·실행 주체를 적대 값으로 바꾼 리포트(G-D8 속성 누출·R-12 렌더 검사용) */
function withHostileNames(r: Report): Report {
  let i = 0;
  const next = (): DisplayValue => HOSTILE_VALUES[i++ % HOSTILE_VALUES.length] as DisplayValue;
  return {
    ...r,
    identity: { ...r.identity, alias: sens("alias", "<b>alias</b>", "alias-001"), principalName: next() },
    doors: r.doors.map((dr) => ({
      ...dr,
      rules: dr.rules.map((ru) => ({
        ...ru,
        items: ru.items.map((it) => ({ ...it, resource: { ...it.resource, name: next() }, labels: [...it.labels, { kind: "unusual-characters" as const }] })),
      })),
    })),
  };
}
export const REPORT_HOSTILE: Report = withHostileNames(REPORT_C);
