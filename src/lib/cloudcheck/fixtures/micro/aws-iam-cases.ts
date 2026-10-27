// micro/AWS-MFA-1 · AWS-MFA-2 · AWS-KEY-1 · AWS-KEY-2 · AWS-KEY-3 · AWS-KEY-4 — 손으로 쓴 pass·violate (나머지 4케이스는 mutate.ts가 파생)
// 기준 시각: 수집 2026-10-19T03:00:00Z, 보고서 생성 2026-10-19T02:58:30Z. 키 나이 90일 = 2026-07-21 이전, 미사용 45일 = 2026-09-04 이전.
import type { AwsNormalizedInput } from "../../contract/normalized";
import { ADMIN, GOOD_ROOT, READ_ONLY, aliceOk, bobNoConsole, iamWorld } from "./aws-iam";
import type { IamWorld, KeySpec, RoleSpec, UserSpec } from "./aws-iam";
import { withLatestEvidence } from "./kit";

const w = (o: Partial<IamWorld> & Pick<IamWorld, "users">): AwsNormalizedInput => iamWorld({ root: GOOD_ROOT, ...o }).build();
const key = (suffix: string, createdAt: string, lastUsed: string | null, status: KeySpec["status"] = "Active"): KeySpec => ({ suffix, createdAt, lastUsed, status });

/* ───── AWS-MFA-1 ───── */
export const mfa1 = {
  pass: (): AwsNormalizedInput => w({ users: [] }),
  rootKey: (): AwsNormalizedInput => w({ users: [], root: { ...GOOD_ROOT, keys: [key("ROOT", "2024-01-01T00:00:00Z", null)] } }),
  noMfa: (): AwsNormalizedInput => w({ users: [], root: { ...GOOD_ROOT, mfa: false } }),
  recentLogin: (): AwsNormalizedInput => w({ users: [], root: { ...GOOD_ROOT, passwordLastUsed: "2026-09-20T00:00:00Z" } }),
  /** Organizations 신규 멤버: 비밀번호도 키도 없다 → 해당 없음 */
  noCredentials: (): AwsNormalizedInput => w({ users: [], root: { password: false, mfa: false, passwordLastUsed: null, keys: [] } }),
  /** 보고서는 MFA 꺼짐, 실시간 요약은 켜짐 → 어느 쪽도 믿지 않는다 */
  conflict: (): AwsNormalizedInput => w({ users: [], root: { ...GOOD_ROOT, mfa: false }, summaryOverride: { accountMfaEnabled: 1 } }),
  /** AWS 문서 예시의 루트 행: 비밀번호 칸이 not_supported → 비밀번호가 있는 것으로 본다. 현재 파서가 주는 모양(해석 불가)과 앞으로 줄 수 있는 모양(값 없음) 둘 다 */
  notSupported: (): AwsNormalizedInput => w({ users: [], root: { ...GOOD_ROOT, passwordCell: "not-supported" } }),
  notSupportedNone: (): AwsNormalizedInput => w({ users: [], root: { ...GOOD_ROOT, passwordCell: "not-supported-none" } }),
  notSupportedNoMfa: (): AwsNormalizedInput => w({ users: [], root: { ...GOOD_ROOT, passwordCell: "not-supported", mfa: false } }),
  /** 요약 없이(CSV 경로) 보고서만 */
  noSummary: (): AwsNormalizedInput => w({ users: [], summary: false }),
  /** 옛 형식 보고서(루트 키 목록이 partial) + 실시간 요약이 '루트 키 0개' → 요약이 권위라 키 없음이 확정된다 */
  partialKeysSummaryZero: (): AwsNormalizedInput => w({ users: [], root: { ...GOOD_ROOT, keysPartial: true } }),
  /** 옛 형식 보고서만(요약 없음): 키 전체를 증명하지 못해 확인 불가 */
  partialKeysNoSummary: (): AwsNormalizedInput => w({ users: [], root: { ...GOOD_ROOT, keysPartial: true }, summary: false }),
  /** 옛 형식 보고서는 키 없음인데 요약은 '루트 키 있음' → 어느 쪽도 믿지 않는다 */
  partialKeysSummaryDisagrees: (): AwsNormalizedInput => w({ users: [], root: { ...GOOD_ROOT, keysPartial: true }, summaryOverride: { accountAccessKeysPresent: 1 } }),
  /** 옛 형식 보고서에서 활성 키가 보이고 요약도 키 있음 → 양성은 partial이어도 위험 */
  partialKeysActive: (): AwsNormalizedInput => w({ users: [], root: { ...GOOD_ROOT, keysPartial: true, keys: [key("ROOT", "2024-01-01T00:00:00Z", null)] } }),
  /** 같은 상황을 요약 없이: 양성은 그대로 위험 */
  partialKeysActiveNoSummary: (): AwsNormalizedInput => w({ users: [], root: { ...GOOD_ROOT, keysPartial: true, keys: [key("ROOT", "2024-01-01T00:00:00Z", null)] }, summary: false }),
  /** 옛 형식 보고서 + 요약 없음 + MFA 꺼짐: 양성(MFA 없음)은 키 목록이 partial이어도 위험 */
  partialKeysNoMfaNoSummary: (): AwsNormalizedInput => w({ users: [], root: { ...GOOD_ROOT, keysPartial: true, mfa: false }, summary: false }),
};

/* ───── AWS-MFA-2 ───── */
const carolNoMfa: UserSpec = { name: "carol", password: true, passwordLastUsed: "2026-10-12T00:00:00Z", mfa: false, keys: [] };
export const mfa2 = {
  pass: (): AwsNormalizedInput => w({ users: [aliceOk, bobNoConsole] }),
  noMfa: (): AwsNormalizedInput => w({ users: [aliceOk, carolNoMfa, bobNoConsole] }),
  /** 콘솔 비밀번호가 있는 사용자가 한 명도 없다 → 해당 없음 + IdP 안내 */
  noConsoleUsers: (): AwsNormalizedInput => w({ users: [bobNoConsole] }),
  empty: (): AwsNormalizedInput => w({ users: [] }),
};

/* ───── AWS-KEY-1 ───── */
const dave: UserSpec = { name: "dave", password: false, mfa: false, keys: [key("OLD1", "2024-02-01T00:00:00Z", null, "Inactive"), key("NEW1", "2026-10-01T00:00:00Z", "2026-10-18T00:00:00Z")] };
export const key1 = {
  pass: (): AwsNormalizedInput => w({ users: [aliceOk, bobNoConsole, dave] }),
  oldKey: (): AwsNormalizedInput => w({ users: [{ ...aliceOk, keys: [key("7QXZ", "2026-06-01T00:00:00Z", "2026-10-17T12:00:00Z")] }, bobNoConsole] }),
  /** 활성 키가 하나도 없다 → 해당 없음 */
  noActiveKeys: (): AwsNormalizedInput => w({ users: [{ name: "erin", password: true, passwordLastUsed: "2026-10-10T00:00:00Z", mfa: true, keys: [key("OFF1", "2024-02-01T00:00:00Z", null, "Inactive")] }] }),

  // ── 기준 시각이 증거보다 이른 경우(CC-QA-01). 보고서 생성 02:00, 수집 03:00. CSV 칸(reportOnly)은 5분, 실시간 호출은 보고서 캐시(4시간 5분)까지 늦을 수 있다 ──
  /** 보고서(02:00)와 수집(03:00)보다 늦은 '마지막 사용'(03:30)이 같은 보고서에 있다 → 기준 시각이 틀렸다. 키 자체는 79일(90일 안)이라 이대로면 이상 없음이 되는 자리 */
  clockSkewCsv: (): AwsNormalizedInput => w({ users: [{ ...aliceOk, keys: [{ ...key("7QXZ", "2026-08-01T00:00:00Z", "2026-10-19T03:30:00Z"), reportOnly: true }] }], reportAt: "2026-10-19T02:00:00Z" }),
  /** 같은 상황이 다른 사용자 행에서 드러나도 모든 키의 '최근' 결론이 막힌다 */
  clockSkewOtherRow: (): AwsNormalizedInput => w({ users: [
    { ...aliceOk, keys: [{ ...key("7QXZ", "2026-08-01T00:00:00Z", "2026-10-18T00:00:00Z"), reportOnly: true }] },
    { name: "kim", password: false, mfa: false, keys: [{ ...key("KIM1", "2026-09-01T00:00:00Z", "2026-10-19T03:40:00Z"), reportOnly: true }] },
  ], reportAt: "2026-10-19T02:00:00Z" }),
  /** 허용치(5분) 안의 어긋남(3분)은 시계 차이로 본다 → 이상 없음 */
  clockSkewWithinTolerance: (): AwsNormalizedInput => w({ users: [{ ...aliceOk, keys: [{ ...key("7QXZ", "2026-08-01T00:00:00Z", "2026-10-19T02:03:00Z"), reportOnly: true }] }], reportAt: "2026-10-19T02:00:00Z" }),
  /** 키 만든 날(보고서 칸)이 보고서 생성(02:00)과 수집(03:00)보다 늦다(03:15) → 확인 불가 */
  createdAfterReportCsv: (): AwsNormalizedInput => w({ users: [{ ...aliceOk, keys: [{ ...key("7QXZ", "2026-10-19T03:15:00Z", null), reportOnly: true }] }], reportAt: "2026-10-19T02:00:00Z" }),
  /** 수집기 경로: 캐시된 보고서(02:00) 뒤에 만든 키(02:15, 실시간 목록에서 온 시각)는 정상이다 → 이상 없음 */
  createdAfterReportLive: (): AwsNormalizedInput => w({ users: [{ ...aliceOk, keys: [key("7QXZ", "2026-10-19T02:15:00Z", null)] }], reportAt: "2026-10-19T02:00:00Z" }),
  /** 실시간 시각이라도 보고서 캐시(4시간 5분)를 넘게 늦으면 이상하다 → 확인 불가 */
  createdLongAfterReportLive: (): AwsNormalizedInput => w({ users: [{ ...aliceOk, keys: [key("7QXZ", "2026-10-19T07:00:00Z", null)] }], reportAt: "2026-10-19T02:00:00Z" }),
  /** 키·사용자 칸에는 역전이 없고 모두 보고서(02:00) 안이다. 그러나 parse가 알려 준 입력 안 가장 늦은 증거 시각(룰이 안 읽는 칸 — 비밀번호 변경 같은 것, 03:30)이 보고서보다 늦다 → 확인 불가 */
  latestEvidenceLater: (): AwsNormalizedInput => withLatestEvidence(
    w({ users: [{ ...aliceOk, keys: [{ ...key("7QXZ", "2026-08-01T00:00:00Z", "2026-10-18T00:00:00Z"), reportOnly: true }] }], reportAt: "2026-10-19T02:00:00Z" }), "2026-10-19T03:30:00Z"),
  /** 같은 값이 허용치(5분) 안(02:04)이면 시계 차이다 → 이상 없음 */
  latestEvidenceWithinTolerance: (): AwsNormalizedInput => withLatestEvidence(
    w({ users: [{ ...aliceOk, keys: [{ ...key("7QXZ", "2026-08-01T00:00:00Z", "2026-10-18T00:00:00Z"), reportOnly: true }] }], reportAt: "2026-10-19T02:00:00Z" }), "2026-10-19T02:04:00Z"),
  /** 오래된 키(주의)는 다른 행의 시각 역전과 무관하게 주의로 남는다(양성 유지) */
  oldKeyWithSkew: (): AwsNormalizedInput => w({ users: [
    { ...aliceOk, keys: [{ ...key("OLD1", "2026-01-01T00:00:00Z", "2026-10-18T00:00:00Z"), reportOnly: true }] },
    { name: "kim", password: false, mfa: false, keys: [{ ...key("KIM1", "2026-09-01T00:00:00Z", "2026-10-19T03:40:00Z"), reportOnly: true }] },
  ], reportAt: "2026-10-19T02:00:00Z" }),
};

/* ───── AWS-KEY-2 ───── */
export const key2 = {
  pass: (): AwsNormalizedInput => w({ users: [aliceOk, bobNoConsole] }),
  unusedKey: (): AwsNormalizedInput => w({ users: [{ ...aliceOk, keys: [key("7QXZ", "2025-06-01T00:00:00Z", "2026-07-01T00:00:00Z")] }, bobNoConsole] }),
  neverUsedKey: (): AwsNormalizedInput => w({ users: [{ ...aliceOk, keys: [key("7QXZ", "2026-09-01T00:00:00Z", null)] }, bobNoConsole] }),
  /** 만든 지 7일이 안 된 키는 아직 안 썼어도 주의가 아니다 */
  graceKey: (): AwsNormalizedInput => w({ users: [{ ...aliceOk, keys: [key("7QXZ", "2026-10-17T00:00:00Z", null)] }, bobNoConsole] }),
  /** 보고서(CSV)만으로 읽은 키는 끝 4자리가 없고 슬롯 번호만 있다 — 사실 문구에 내부 표기(slot1)가 그대로 나오면 안 된다(디자인 검수 K-4) */
  unusedKeyReportOnly: (): AwsNormalizedInput => w({ users: [{ ...aliceOk, keys: [{ ...key("7QXZ", "2025-06-01T00:00:00Z", "2026-07-01T00:00:00Z"), reportOnly: true }] }, bobNoConsole] }),
  neverUsedKeyReportOnly: (): AwsNormalizedInput => w({ users: [{ ...aliceOk, keys: [{ ...key("7QXZ", "2026-09-01T00:00:00Z", null), reportOnly: true }] }, bobNoConsole] }),
  unusedConsole: (): AwsNormalizedInput => w({ users: [{ ...aliceOk, passwordLastUsed: "2026-07-01T00:00:00Z" }, bobNoConsole] }),
  noActive: (): AwsNormalizedInput => w({ users: [{ name: "erin", password: false, mfa: false, keys: [key("OFF1", "2024-02-01T00:00:00Z", null, "Inactive")] }] }),

  // ── 기준 시각이 증거보다 이른 경우(CC-QA-01) ──
  usedAfterReportCsv: (): AwsNormalizedInput => w({ users: [{ ...aliceOk, keys: [{ ...key("7QXZ", "2026-08-01T00:00:00Z", "2026-10-19T03:30:00Z"), reportOnly: true }] }], reportAt: "2026-10-19T02:00:00Z" }),
  /** 한 사용자 행의 시각 역전이 다른 사용자의 '최근에 썼다'도 막는다 */
  usedAfterReportOtherRow: (): AwsNormalizedInput => w({ users: [
    { ...aliceOk, keys: [{ ...key("7QXZ", "2026-08-01T00:00:00Z", "2026-10-18T00:00:00Z"), reportOnly: true }] },
    { name: "kim", password: false, mfa: false, keys: [{ ...key("KIM1", "2026-09-01T00:00:00Z", "2026-10-19T03:40:00Z"), reportOnly: true }] },
  ], reportAt: "2026-10-19T02:00:00Z" }),
  /** 한 번도 안 쓴 키가 보고서보다 늦게 만들어졌다고 적혀 있다 */
  neverUsedCreatedAfterReport: (): AwsNormalizedInput => w({ users: [{ ...aliceOk, keys: [{ ...key("7QXZ", "2026-10-19T03:20:00Z", null), reportOnly: true }] }], reportAt: "2026-10-19T02:00:00Z" }),
  /** 콘솔 마지막 로그인(실시간 목록 시각)이 보고서보다 30분 늦다: 캐시 안이라 정상 → 이상 없음 */
  consoleAfterReportLive: (): AwsNormalizedInput => w({ users: [{ ...aliceOk, passwordLastUsed: "2026-10-19T02:30:00Z" }], reportAt: "2026-10-19T02:00:00Z" }),
  /** 6시간 늦으면 캐시로 설명되지 않는다 → 확인 불가 */
  consoleFarAfterReportLive: (): AwsNormalizedInput => w({ users: [{ ...aliceOk, passwordLastUsed: "2026-10-19T08:00:00Z" }], reportAt: "2026-10-19T02:00:00Z" }),
  /** 사용자 행에는 역전이 없지만 parse가 알려 준 입력 안 가장 늦은 증거 시각(03:30)이 보고서(02:00)보다 늦다 → '최근에 썼다'를 확정하지 못한다 */
  latestEvidenceLater: (): AwsNormalizedInput => withLatestEvidence(
    w({ users: [{ ...aliceOk, keys: [{ ...key("7QXZ", "2026-08-01T00:00:00Z", "2026-10-18T00:00:00Z"), reportOnly: true }] }], reportAt: "2026-10-19T02:00:00Z" }), "2026-10-19T03:30:00Z"),
  /** 오래 안 쓴 키(주의)는 시각 역전과 무관하게 주의로 남는다 */
  unusedKeyWithSkew: (): AwsNormalizedInput => w({ users: [
    { ...aliceOk, keys: [{ ...key("7QXZ", "2025-06-01T00:00:00Z", "2026-07-01T00:00:00Z"), reportOnly: true }] },
    { name: "kim", password: false, mfa: false, keys: [{ ...key("KIM1", "2026-09-01T00:00:00Z", "2026-10-19T03:40:00Z"), reportOnly: true }] },
  ], reportAt: "2026-10-19T02:00:00Z" }),
};

/* ───── AWS-KEY-3 ───── */
export const key3 = {
  /** 관리자급 정책 사용자 없음 → 이상 없음을 주지 않는 룰이라 '해당 없음' */
  pass: (): AwsNormalizedInput => w({ users: [{ ...aliceOk, policies: [READ_ONLY] }, bobNoConsole] }),
  adminKey: (): AwsNormalizedInput => w({ users: [{ ...aliceOk, policies: [ADMIN] }, bobNoConsole] }),
  adminViaGroup: (): AwsNormalizedInput => w({ users: [{ ...aliceOk, groups: ["ops"] }, bobNoConsole], groups: [{ name: "ops", policies: ["arn:aws:iam::aws:policy/PowerUserAccess"] }] }),
  /** 관리자급이지만 활성 키가 없다 */
  adminNoKey: (): AwsNormalizedInput => w({ users: [{ name: "frank", password: true, mfa: true, passwordLastUsed: "2026-10-10T00:00:00Z", keys: [], policies: [ADMIN] }] }),
};

/* ───── AWS-KEY-4 ───── */
const SELF = "111122223333";
const svc: RoleSpec = { name: "AWSServiceRoleForSupport", path: "/aws-service-role/support.amazonaws.com/", trust: [{ principal: { wildcard: false, aws: [], service: ["support.amazonaws.com"], federated: [], canonicalUserCount: 0 } }] };
const lambdaRole: RoleSpec = { name: "app-lambda", trust: [{ principal: { wildcard: false, aws: [], service: ["lambda.amazonaws.com"], federated: [], canonicalUserCount: 0 } }] };
const selfRole: RoleSpec = { name: "ci-admin", trust: [{ principal: { wildcard: false, aws: [`arn:aws:iam::${SELF}:root`], service: [], federated: [], canonicalUserCount: 0 } }] };
const extRole = (cond: string[] = []): RoleSpec => ({ name: "vendor-audit", trust: [{ conditionKeys: cond, principal: { wildcard: false, aws: ["arn:aws:iam::999988887777:root"], service: [], federated: [], canonicalUserCount: 0 } }] });
const P_STAR = { wildcard: true, aws: [] as string[], service: [] as string[], federated: [] as string[], canonicalUserCount: 0 };
const stmtRole = (name: string, st: RoleSpec["trust"][number]): RoleSpec => ({ name, trust: [st] });
export const key4 = {
  pass: (): AwsNormalizedInput => w({ users: [], roles: [svc, lambdaRole, selfRole, extRole(["StringEquals:sts:ExternalId"])] }),
  wildcard: (): AwsNormalizedInput => w({ users: [], roles: [lambdaRole, { name: "open-role", trust: [{ principal: { wildcard: true, aws: [], service: [], federated: [], canonicalUserCount: 0 } }] }] }),
  wildcardConditioned: (): AwsNormalizedInput => w({ users: [], roles: [{ name: "org-role", trust: [{ conditionKeys: ["StringEquals:aws:PrincipalOrgID"], principal: { wildcard: true, aws: [], service: [], federated: [], canonicalUserCount: 0 } }] }] }),
  externalNoExternalId: (): AwsNormalizedInput => w({ users: [], roles: [lambdaRole, extRole()] }),
  externalOrgCondition: (): AwsNormalizedInput => w({ users: [], roles: [extRole(["StringEquals:aws:PrincipalOrgID"])] }),
  /** 외부 계정의 역할 세션(sts ARN)과 번호만 적은 주체도 외부 계정으로 읽는다. 자기 계정의 세션은 외부가 아니다 */
  externalSessionPrincipal: (): AwsNormalizedInput => w({ users: [], roles: [{ name: "session-trust", trust: [{ principal: { wildcard: false, aws: ["arn:aws:sts::999988887777:assumed-role/ops/kim"], service: [], federated: [], canonicalUserCount: 0 } }] }] }),
  accountNumberPrincipal: (): AwsNormalizedInput => w({ users: [], roles: [{ name: "number-trust", trust: [{ principal: { wildcard: false, aws: ["999988887777"], service: [], federated: [], canonicalUserCount: 0 } }] }] }),
  selfSessionPrincipal: (): AwsNormalizedInput => w({ users: [], roles: [{ name: "self-session", trust: [{ principal: { wildcard: false, aws: [`arn:aws:sts::${SELF}:assumed-role/ops/kim`, SELF], service: [], federated: [], canonicalUserCount: 0 } }] }] }),
  /** 사용자가 만든 역할이 없다(서비스 연결 역할뿐) → 해당 없음 */
  onlyServiceLinked: (): AwsNormalizedInput => w({ users: [], roles: [svc] }),
  empty: (): AwsNormalizedInput => w({ users: [], roles: [] }),
  /** 와일드카드 액션(sts:Assume*)도 역할 맡기를 덮는다 — 이 문장을 건너뛰면 Principal '*'가 이상 없음이 된다(백엔드팀장 STEP 4 fail-open 수정) */
  wildcardAction: (): AwsNormalizedInput => w({ users: [], roles: [{ name: "glob-role", trust: [{ actions: ["sts:Assume*"], principal: { wildcard: true, aws: [], service: [], federated: [], canonicalUserCount: 0 } }] }] }),
  // ── 모르는 값 경계 사례(CC-QA-05, P3): 건너뛰어 이상 없음이 되면 안 된다 ──
  effectPermit: (): AwsNormalizedInput => w({ users: [], roles: [stmtRole("odd-effect", { effect: "Permit", principal: P_STAR })] }),
  effectTrailingSpace: (): AwsNormalizedInput => w({ users: [], roles: [stmtRole("padded-effect", { effect: "Allow ", principal: P_STAR })] }),
  effectEmpty: (): AwsNormalizedInput => w({ users: [], roles: [stmtRole("empty-effect", { effect: "", principal: P_STAR })] }),
  /** 앞 문장은 모르는 Effect, 뒤 문장은 확실한 위험 → 양성은 유지 */
  effectPermitPlusRisk: (): AwsNormalizedInput => w({ users: [], roles: [{ name: "mixed", trust: [{ effect: "Permit", principal: P_STAR }, { principal: P_STAR }] }] }),
  denyWildcard: (): AwsNormalizedInput => w({ users: [], roles: [stmtRole("deny-all", { effect: "Deny", principal: P_STAR })] }),
  actionGarbage: (): AwsNormalizedInput => w({ users: [], roles: [stmtRole("odd-action", { actions: ["zzz"], principal: P_STAR })] }),
  actionOtherService: (): AwsNormalizedInput => w({ users: [], roles: [stmtRole("tag-only", { actions: ["sts:TagSession"], principal: P_STAR })] }),
  awsStarWithoutFlag: (): AwsNormalizedInput => w({ users: [], roles: [stmtRole("star-no-flag", { principal: { wildcard: false, aws: ["*"], service: [], federated: [], canonicalUserCount: 0 } })] }),
  externalNullOperator: (): AwsNormalizedInput => w({ users: [], roles: [extRole(["Null:sts:ExternalId"])] }),
  externalNotEquals: (): AwsNormalizedInput => w({ users: [], roles: [extRole(["StringNotEquals:sts:ExternalId"])] }),
  externalForAllValues: (): AwsNormalizedInput => w({ users: [], roles: [extRole(["ForAllValues:StringNotLike:sts:ExternalId"])] }),
  externalStringLike: (): AwsNormalizedInput => w({ users: [], roles: [extRole(["StringLike:sts:ExternalId"])] }),
  externalForAnyValue: (): AwsNormalizedInput => w({ users: [], roles: [extRole(["ForAnyValue:StringEquals:sts:ExternalId"])] }),
  /** …IfExists는 키가 없으면 통과하므로 ExternalId를 요구하는 조건이 아니다 */
  externalIfExists: (): AwsNormalizedInput => w({ users: [], roles: [extRole(["StringEqualsIfExists:sts:ExternalId"])] }),
  zeroStatements: (): AwsNormalizedInput => w({ users: [], roles: [{ name: "no-statements", trust: [] }] }),
  /** S3 정식 사용자 ID(CanonicalUser)를 믿는다: 모든 주체(*)가 아니다 — 사실 문구에 '모든 주체'가 붙으면 안 된다(디자인 검수 K-3) */
  canonicalUser: (): AwsNormalizedInput => w({ users: [], roles: [{ name: "canonical-trust", trust: [{ principal: { wildcard: false, aws: [], service: [], federated: [], canonicalUserCount: 1 } }] }] }),
  /** 거부(Deny) 문장·STS 밖 동작은 보지 않는다 */
  denyAndOtherActions: (): AwsNormalizedInput => w({ users: [], roles: [{ name: "limited", trust: [
    { effect: "Deny", principal: { wildcard: true, aws: [], service: [], federated: [], canonicalUserCount: 0 } },
    { actions: ["sts:TagSession"], principal: { wildcard: false, aws: ["arn:aws:iam::999988887777:root"], service: [], federated: [], canonicalUserCount: 0 } },
  ] }] }),
};
