// AWS-MFA-1 루트 사용자 자격증명 — 현관 · priority 60 · 최고 위험
// 구성원: 루트 1개(aws.mfa.root). 근거: 자격증명 보고서의 루트 행 + 계정 요약(GetAccountSummary) 교차 확인.
//  - 위험: 활성 루트 액세스 키 / 비밀번호가 있는데 MFA가 꺼짐 (양성이므로 부분 데이터에서도 유지)
//  - 주의: 최근 90일 안에 루트로 콘솔에 로그인함(일상 사용 의심)
//  - 이상 없음: 비밀번호 있음 + MFA 켜짐 + 활성 키 없음 + 최근 90일 로그인 없음
//  - 해당 없음(제외): 비밀번호도 활성 키도 없음 = 루트 자격증명 없음(Organizations 신규 멤버 계정 등) → 위험으로 오탐하지 않는다
//  - 루트 행의 비밀번호 열이 not_supported(AWS 문서 예시의 루트 행)이면 비밀번호가 있는 것으로 본다.
//  - 교차 확인: 보고서와 실시간 계정 요약이 다르면(보고서는 최대 4시간 전 상태) 어느 쪽도 믿지 않고 확인 불가(stale-evidence). 음성만이 아니라 양성도 보류한다.
//  - 루트 키 개수의 권위 있는 값은 계정 요약의 AccountAccessKeysPresent다(contract/NORMALIZED.md §6). 보고서만으로는 root.keys가 partial(열이 모자라 키 전체를 증명 못 함)일 수 있어,
//    partial이어도 요약이 있고 보고서가 보여 준 '키 있음/없음'과 같으면 키 목록을 완전한 것으로 본다. 요약이 없으면 partial 그대로 확인 불가(field-missing)다. 활성 키가 보이면 양성이라 partial이어도 위험이다.
import type { AwsMfaData, Instant, Slot, Src } from "../../contract/normalized";
import type { Ev, Member, ResourceDesc, RuleCtx } from "../../engine/types";
import { ROOT_RECENT_LOGIN_DAYS } from "../params";
import { N, ageMs, buildSpec, dateOf, defineRule, ev, evs, fact, findings, GLOBAL, mCaution, mClear, mExcluded, mRisk, mUnknown, olderThanDays, reasons, reuseWhy } from "../kit";
import { reasonOf, staleReport } from "./creds";

const ID = "AWS-MFA-1" as const;
const R = reasons(ID);
const F = findings(ID);
const DOC_ROOT = "https://docs.aws.amazon.com/IAM/latest/UserGuide/root-user-best-practices.html";
const DOC_MFA_ROOT = "https://docs.aws.amazon.com/IAM/latest/UserGuide/enable-mfa-for-root.html";
const DOC_REPORT = "https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_getting-report.html";

export const spec = buildSpec({
  id: ID, door: "mfa", maxStatus: "risk", allowsClear: true, priority: 60,
  cond: ["risk", "caution", "clear", "na", "unknown"], impact: true, question: true,
  paths: ["csv", "collector"],
  params: [{ name: "recent-login-days", value: ROOT_RECENT_LOGIN_DAYS, basis: "tool-default" }],
  cannotSee: 3, falsePositives: 4,
  fix: {
    impact: "medium", prodImpact: false,
    observe: { doc: DOC_REPORT, commands: [] },
    change: { property: "AccountMFAEnabled · access_key_1_active · access_key_2_active", doc: DOC_MFA_ROOT, commands: [] },
    revert: { commands: [] },
    runbook: null,
  },
  guide: null,
  asOfBasis: "credential-report",
  basis: [
    { name: "root-best-practices", url: DOC_ROOT, kind: "doc" },
    { name: "mfa-root", url: DOC_MFA_ROOT, kind: "doc" },
    { name: "credential-report", url: DOC_REPORT, kind: "doc" },
    { name: "securityhub-iam", url: "https://docs.aws.amazon.com/securityhub/latest/userguide/iam-controls.html", kind: "benchmark" },
  ],
  incident: null,
  lastVerified: "2026-10-19",
  families: { item: "aws.mfa.root", needs: [] },
  calls: ["iam:GenerateCredentialReport", "iam:GetCredentialReport", "iam:GetAccountSummary"],
  reasons: {
    "root-key-active": [], "root-no-mfa": [], "root-recent-login": ["days"], "root-secured": ["days"], "na-no-root-credentials": [],
  },
  facts: { "mfa-on": [], "mfa-off": [], "active-keys": ["n"], "console-last-login": ["d"], "console-never-used": [] },
  how: true,
  fixtures: {
    pass: "micro/AWS-MFA-1/pass",
    violate: ["micro/AWS-MFA-1/root-key", "micro/AWS-MFA-1/no-mfa", "micro/AWS-MFA-1/recent-login"],
    denied: { call: "iam:GetCredentialReport", expect: "unknown" },
    truncated: { na: "보고서는 한 번에 통째로 받아 잘림이 없다" },
    missingField: { path: "doors.mfa.data.root", expect: "unknown" },
    versionMismatch: "auto",
  },
});

/**
 * 루트 행의 password_enabled. AWS 문서 예시의 루트 행은 이 열이 not_supported다(TRUE/FALSE는 IAM 사용자 행 · Organizations 신규 멤버의 FALSE).
 * not_supported는 '비밀번호 있음'으로 본다. 파서가 이를 값 없음(none) 또는 해석 불가(missing: value-unrecognized)로 주어도 같다.
 * 그 밖의 빈틈(거부 · 열 누락 …)은 모름이다.
 */
type RootPw = "yes" | "no" | "unknown";
function rootPassword(s: Slot<boolean>): RootPw {
  if (s.k === "value") return s.value ? "yes" : "no";
  if (s.k === "none") return "yes";
  if (s.k === "missing" && s.why === "value-unrecognized") return "yes";
  return "unknown";
}

/** 루트 최근 로그인인가: 나이를 잴 수 없는(기준 시각보다 늦은) 로그인 시각은 최근으로 본다 — 주의는 안전한 방향이다 */
function recentLogin(asOf: NonNullable<RuleCtx<AwsMfaData>["asOf"]>, last: Instant, src: Src | null): boolean {
  const age = ageMs(asOf, last, src);
  return age === null || !olderThanDays(age, ROOT_RECENT_LOGIN_DAYS);
}

const ROOT_RES: ResourceDesc = { type: "root", name: { plain: "root" }, where: GLOBAL, id: "root" };

function evaluate(ctx: RuleCtx<AwsMfaData>) {
  const slot = ctx.data.root;
  if (slot.k !== "value") return { members: [mUnknown(ROOT_RES, reasonOf(slot), ev(slot.src))], coverage: ctx.scope };
  const root = slot.value;
  const sum = ctx.data.accountSummary;
  const summary = sum.k === "value" ? sum.value : null;

  // 실시간 계정 요약과의 교차 확인값
  const liveMfa = summary !== null && summary.accountMfaEnabled !== null ? summary.accountMfaEnabled > 0 : null;
  const liveKeys = summary !== null && summary.accountAccessKeysPresent !== null ? summary.accountAccessKeysPresent > 0 : null;
  const sumSrc = sum.k === "value" ? sum.src : null;

  const pw = root.passwordEnabled;
  const pwState = rootPassword(pw);
  const mfaRep = root.mfaActive;
  const keys = root.keys;
  const last = root.passwordLastUsed;

  const keyList = keys.k === "value" || keys.k === "partial" ? keys.value : null;
  const activeKeys = keyList === null ? 0 : keyList.filter((k) => k.active.k === "value" && k.active.value).length;
  const allEv: Ev[] = evs(pw.src, mfaRep.src, keys.src, last.src, sumSrc);

  // 보고서와 요약이 다르면 어느 쪽도 믿지 않는다(키 목록이 partial이어도 '키가 있다/없다'는 요약과 맞춰 본다)
  const mfaConflict = mfaRep.k === "value" && liveMfa !== null && mfaRep.value !== liveMfa;
  const keyConflict = keyList !== null && liveKeys !== null && (keyList.length > 0) !== liveKeys;
  if (mfaConflict || keyConflict) return { members: [mUnknown(ROOT_RES, "stale-evidence", allEv)], coverage: ctx.scope };
  // 키 목록이 완전한가: 수집기·새 형식 보고서는 value. partial이면 위에서 요약과 어긋나지 않은 것이 확인된 경우(요약이 있을 때)만 완전하다
  const keysComplete = keys.k === "value" || (keys.k === "partial" && liveKeys !== null);

  const effMfa: boolean | null = mfaRep.k === "value" ? mfaRep.value : liveMfa;
  const mfaSrc = mfaRep.k === "value" ? mfaRep.src : sumSrc;
  const facts = [
    ...(effMfa === null ? [] : [fact(effMfa ? "mfa-on" : "mfa-off")]),
    ...(keyList === null || (!keysComplete && activeKeys === 0) ? [] : [fact("active-keys", { n: N(activeKeys) })]),
  ];

  const m: Member[] = [];
  const stale = staleReport(ctx, pw.src, mfaRep.src, keys.src, last.src);

  // 양성 1: 활성 루트 액세스 키
  if (activeKeys > 0) {
    m.push(mRisk(ROOT_RES, F("root-key-active"), evs(keys.src), { facts }));
  // 양성 2: 비밀번호가 있는데 MFA가 꺼짐
  } else if (effMfa === false && pwState === "yes") {
    m.push(mRisk(ROOT_RES, F("root-no-mfa"), evs(pw.src, mfaSrc), { facts }));
  // 비밀번호 유무를 모르는데 MFA가 꺼져 있음: 위험으로 확정하지 못한다
  } else if (effMfa === false && pwState === "unknown") {
    m.push(mUnknown(ROOT_RES, reasonOf(pw), allEv, { facts }));
  } else if (ctx.asOf !== null && last.k === "value" && last.value !== null && recentLogin(ctx.asOf, last.value, last.src) && pwState === "yes") {
    // 주의: 최근 로그인(기준 시각보다 늦은 로그인 시각도 '최근'이다: 보고서를 받은 뒤 로그인했거나 시계가 틀린 것 — 이상 없음으로 접지 않는 안전한 쪽)
    m.push(mCaution(ROOT_RES, F("root-recent-login", { days: N(ROOT_RECENT_LOGIN_DAYS) }), evs(last.src), { facts: [...facts, fact("console-last-login", { d: { d: dateOf(last.value) } })] }));
  } else if (pwState === "unknown") {
    m.push(mUnknown(ROOT_RES, reasonOf(pw), allEv, { facts }));
  } else if (!keysComplete) {
    m.push(mUnknown(ROOT_RES, reasonOf(keys), allEv, { facts }));
  } else if (keyList !== null && keyList.some((k) => k.active.k !== "value")) {
    const bad = keyList.find((k) => k.active.k !== "value");
    m.push(mUnknown(ROOT_RES, bad === undefined ? "value-unrecognized" : reasonOf(bad.active), allEv, { facts }));
  } else if (stale) {
    m.push(mUnknown(ROOT_RES, "stale-evidence", allEv, { facts }));
  } else if (pwState === "no") {
    // 비밀번호가 없고 활성 키도 없다 → 사용할 수 있는 루트 자격증명 없음
    m.push(mExcluded(ROOT_RES, R("na-no-root-credentials"), evs(pw.src, keys.src), { facts }));
  } else if (effMfa === null) {
    m.push(mUnknown(ROOT_RES, reasonOf(mfaRep), allEv, { facts }));
  } else if (last.k !== "value") {
    m.push(mUnknown(ROOT_RES, reasonOf(last), allEv, { facts }));
  } else if (ctx.asOf === null) {
    m.push(mUnknown(ROOT_RES, "field-missing", allEv, { facts }));
  } else {
    // 비밀번호 있음 + MFA 켜짐 + 활성 키 없음 + 최근 로그인 없음
    m.push(mClear(ROOT_RES, R("root-secured", { days: N(ROOT_RECENT_LOGIN_DAYS) }), allEv, { facts }));
  }
  return { members: m, coverage: ctx.scope };
}

export const AWS_MFA_1 = defineRule<"aws", "mfa">({
  spec, evaluate,
  explain: (x) => {
    if (x.status === "na") return { msg: R("na-no-root-credentials") };
    if (x.status === "clear") return { msg: R("root-secured", { days: N(ROOT_RECENT_LOGIN_DAYS) }) };
    return { msg: reuseWhy(x.members[0]) };
  },
});
