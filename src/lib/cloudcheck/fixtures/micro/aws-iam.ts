// micro/aws-iam — AWS IAM 계열(mfa·key 문) 마이크로 세계 조립기
// 수집기 경로를 흉내 낸다: 자격증명 보고서(CSV 칸 + GetCredentialReport 영수증) + 실시간 호출(ListUsers · ListMFADevices · ListAccessKeys · ListAttached…Policies · ListGroupsForUser · ListRoles).
// 슬롯 출처 규칙(parse §4-7 우선순위): MFA 유무·키 목록·키 상태·키 생성일·정책·그룹 = 실시간 호출 / 비밀번호·마지막 사용·루트 사실 = 보고서 칸.
import type {
  AwsAccessKey, AwsAccountSummary, AwsCredentialReport, AwsIamGroup, AwsIamRole, AwsIamUser, AwsNormalizedInput, AwsRoot, AwsTrustStatement, Slot,
} from "../../contract/normalized";
import { MicroAws, byCell, byReceipt, inst, miss, none, part, val } from "./kit";

export interface KeySpec {
  readonly suffix: string;
  readonly status?: "Active" | "Inactive";
  readonly createdAt: string;
  /** null = 한 번도 안 씀(N/A) */
  readonly lastUsed: string | null;
  /** 보고서(CSV)만으로 읽은 키: 끝 4자리(idSuffix)가 없고 보고서 슬롯 번호만 있다 */
  readonly reportOnly?: boolean;
}
export interface UserSpec {
  readonly name: string;
  readonly createdAt?: string;
  readonly password: boolean;
  readonly passwordLastUsed?: string | null;
  readonly mfa: boolean;
  readonly keys?: readonly KeySpec[];
  readonly policies?: readonly string[];
  readonly groups?: readonly string[];
}
export interface RootSpec {
  readonly password: boolean;
  /** 보고서 루트 행의 password_enabled 칸이 TRUE/FALSE가 아니라 not_supported로 온 경우: 현재 파서는 해석 불가(missing), 앞으로는 값 없음(none)으로 줄 수 있다 */
  readonly passwordCell?: "not-supported" | "not-supported-none";
  readonly mfa: boolean;
  readonly passwordLastUsed?: string | null;
  readonly keys?: readonly KeySpec[];
  /** 보고서만으로는 루트 키 전체를 증명하지 못하는 경우(additional_credentials_info 열이 없는 옛 형식): 키 목록이 partial(field-missing)로 온다 */
  readonly keysPartial?: boolean;
}
export interface RoleSpec {
  readonly name: string;
  readonly path?: string;
  readonly trust: readonly Partial<AwsTrustStatement>[];
}
export interface GroupSpec { readonly name: string; readonly policies: readonly string[] }

export interface IamWorld {
  readonly root: RootSpec;
  readonly users: readonly UserSpec[];
  readonly roles?: readonly RoleSpec[];
  readonly groups?: readonly GroupSpec[];
  /** 보고서 생성 시각(기본: 수집 직전) */
  readonly reportAt?: string;
  /** 계정 요약을 싣는가(기본 true). 요약 값은 root/users에서 계산한다 */
  readonly summary?: boolean;
  /** 계산한 요약 값을 일부 덮어쓴다(보고서와 요약이 어긋난 상황을 만들 때) */
  readonly summaryOverride?: Partial<AwsAccountSummary>;
  readonly accountId?: string;
}

export const ADMIN = "arn:aws:iam::aws:policy/AdministratorAccess";
export const READ_ONLY = "arn:aws:iam::aws:policy/ReadOnlyAccess";

const trust = (t: Partial<AwsTrustStatement>): AwsTrustStatement => ({
  effect: "Allow", actions: ["sts:AssumeRole"], notPrincipal: false, conditionKeys: [],
  ...t,
  principal: { wildcard: false, aws: [], service: [], federated: [], canonicalUserCount: 0, ...(t.principal ?? {}) },
});

export function iamWorld(w: IamWorld): { readonly m: MicroAws; readonly keys: IamKeys; build: () => AwsNormalizedInput } {
  const m = new MicroAws();
  if (w.accountId !== undefined) m.accountId = w.accountId;
  const users = w.users;
  m.rc("iam:GenerateCredentialReport", "ok");
  const rep = m.rc("iam:GetCredentialReport", "ok");
  const sum = m.rc("iam:GetAccountSummary", "ok");
  const lu = m.rc("iam:ListUsers", users.length === 0 ? "empty" : "ok", { count: users.length });
  const cell = (row: number | null, column: string | null = null) => byCell(0, "csv-credential-report", row, column, rep);

  const report: Slot<AwsCredentialReport> = val<AwsCredentialReport>({
    generatedAt: inst(w.reportAt ?? "2026-10-19T02:58:30Z"), generatedAtSource: "api", rows: users.length + 1, ambiguousRows: [], rootRow: 2, hasAdditionalCredentialsColumn: true,
  }, cell(null));

  // reportOnly 키(CSV 경로): 끝 4자리가 없고, 상태 · 만든 날 · 마지막 사용이 모두 보고서 칸에서 온다(수집기 경로는 실시간 호출 영수증)
  const mkKey = (k: KeySpec, row: number, slot: 1 | 2, src: ReturnType<typeof byReceipt>): AwsAccessKey => {
    const rep = k.reportOnly === true;
    const col = (c: string) => cell(row, `access_key_${slot}_${c}`);
    const active = (k.status ?? "Active") === "Active";
    return {
      src: rep ? col("active") : src, slot, idSuffix: rep ? null : k.suffix, status: k.status ?? "Active",
      active: val(active, rep ? col("active") : src),
      createdAt: val(inst(k.createdAt), rep ? col("last_rotated") : src),
      lastUsed: val(k.lastUsed === null ? null : inst(k.lastUsed), col("last_used_date")),
      lastUsedRegion: k.lastUsed === null ? null : "ap-northeast-2", lastUsedService: k.lastUsed === null ? null : "s3",
    };
  };

  // 루트: 모든 사실이 보고서 루트 행에서 온다
  const rootKeys = w.root.keys ?? [];
  const rootKeyBlock = (): AwsAccessKey[] => rootKeys.map((k, i) => {
    const slot = (i + 1) as 1 | 2;
    return {
      src: cell(2, `access_key_${slot}_active`), slot, idSuffix: null, status: k.status ?? "Active",
      active: val((k.status ?? "Active") === "Active", cell(2, `access_key_${slot}_active`)),
      createdAt: val(inst(k.createdAt), cell(2, `access_key_${slot}_last_rotated`)),
      lastUsed: val(k.lastUsed === null ? null : inst(k.lastUsed), cell(2, `access_key_${slot}_last_used_date`)),
      lastUsedRegion: null, lastUsedService: null,
    };
  });
  const root: AwsRoot = {
    src: cell(2),
    passwordEnabled: w.root.passwordCell === "not-supported" ? miss<boolean>("value-unrecognized", cell(2, "password_enabled"))
      : w.root.passwordCell === "not-supported-none" ? none<boolean>(cell(2, "password_enabled")) : val(w.root.password, cell(2, "password_enabled")),
    passwordLastUsed: val(w.root.passwordLastUsed === undefined || w.root.passwordLastUsed === null ? null : inst(w.root.passwordLastUsed), cell(2, "password_last_used")),
    mfaActive: val(w.root.mfa, cell(2, "mfa_active")),
    keys: w.root.keysPartial === true ? part(rootKeyBlock(), "field-missing", cell(2)) : val(rootKeyBlock(), cell(2)),
  };

  // 사용자
  const keyReceipts: ReturnType<typeof byReceipt>[] = [];
  const keyReceiptKeys: `${number}:r-${string}`[] = [];
  let totalKeys = 0;
  const userFacts: AwsIamUser[] = users.map((u, i) => {
    const row = i + 3;
    const mfaKey = m.rc("iam:ListMFADevices", u.mfa ? "ok" : "empty", { resource: u.name, count: u.mfa ? 1 : 0 });
    const keysKey = m.rc("iam:ListAccessKeys", (u.keys ?? []).length > 0 ? "ok" : "empty", { resource: u.name, count: (u.keys ?? []).length });
    const polKey = m.rc("iam:ListAttachedUserPolicies", (u.policies ?? []).length > 0 ? "ok" : "empty", { resource: u.name, count: (u.policies ?? []).length });
    const grpKey = m.rc("iam:ListGroupsForUser", (u.groups ?? []).length > 0 ? "ok" : "empty", { resource: u.name, count: (u.groups ?? []).length });
    keyReceiptKeys.push(keysKey);
    keyReceipts.push(byReceipt(keysKey));
    totalKeys += (u.keys ?? []).length;
    const ksrc = byReceipt(keysKey);
    return {
      src: byReceipt(lu), name: u.name,
      createdAt: val(inst(u.createdAt ?? "2025-03-02T01:00:00Z"), byReceipt(lu)),
      passwordEnabled: val(u.password, cell(row, "password_enabled")),
      passwordLastUsed: val(u.passwordLastUsed === undefined || u.passwordLastUsed === null ? null : inst(u.passwordLastUsed), byReceipt(lu)),
      mfaActive: val(u.mfa, byReceipt(mfaKey)), mfaDevices: u.mfa ? 1 : 0,
      keys: val((u.keys ?? []).map((k, j) => mkKey(k, row, (j + 1) as 1 | 2, ksrc)), ksrc),
      attachedPolicyArns: val([...(u.policies ?? [])], byReceipt(polKey)),
      groupNames: val([...(u.groups ?? [])], byReceipt(grpKey)),
    };
  });

  // 역할·그룹
  const roles: AwsIamRole[] = [];
  const lr = m.rc("iam:ListRoles", (w.roles ?? []).length === 0 ? "empty" : "ok", { count: (w.roles ?? []).length });
  for (const r of w.roles ?? []) roles.push({ src: byReceipt(lr), name: r.name, path: r.path ?? "/", createdAt: inst("2024-11-01T00:00:00Z"), trust: val(r.trust.map(trust), byReceipt(lr)) });
  const groups: AwsIamGroup[] = (w.groups ?? []).map((g) => ({ name: g.name, attachedPolicyArns: val([...g.policies], byReceipt(m.rc("iam:ListAttachedGroupPolicies", "ok", { resource: g.name, count: g.policies.length }))) }));

  const rootActive = rootKeys.filter((k) => (k.status ?? "Active") === "Active").length;
  const summary: Slot<AwsAccountSummary> = w.summary === false
    ? { k: "missing", why: "not-collected", src: null }
    : val<AwsAccountSummary>({
      users: users.length, groups: groups.length, roles: roles.length, accountMfaEnabled: w.root.mfa ? 1 : 0,
      accountAccessKeysPresent: rootKeys.length > 0 ? Math.max(1, rootActive) : 0, accountSigningCertificatesPresent: 0, mfaDevicesInUse: users.filter((u) => u.mfa).length + (w.root.mfa ? 1 : 0),
      ...(w.summaryOverride ?? {}),
    }, byReceipt(sum));

  const usersSlot = val<readonly AwsIamUser[]>(userFacts, byReceipt(lu));
  m.mfa({ credentialReport: report, accountSummary: summary, root: val(root, cell(2)), users: usersSlot });
  m.key({ credentialReport: report, accountSummary: summary, users: usersSlot, groups, roles: val(roles, byReceipt(lr)) });

  const rows = users.length + 1;
  m.prove("aws.mfa.credential-report", { present: rows, receipts: [rep], expected: rows });
  m.prove("aws.mfa.root", { present: 1, receipts: [rep] });
  m.prove("aws.mfa.users", { present: users.length, receipts: [lu], expected: users.length });
  m.prove("aws.key.credential-report", { present: rows, receipts: [rep], expected: rows });
  m.prove("aws.key.users", { present: users.length, receipts: [lu], expected: users.length });
  m.prove("aws.key.access-keys", { present: totalKeys, receipts: [lu, ...keyReceiptKeys] });   // 사용자 목록이 미완결이면 키 목록도 미완결(실제 parse와 같은 의존)
  m.prove("aws.key.roles", { present: roles.length, receipts: [lr] });
  return { m, keys: { report: rep, summary: sum, users: lu, roles: lr }, build: () => m.build() };
}

export interface IamKeys {
  readonly report: `${number}:r-${string}`;
  readonly summary: `${number}:r-${string}`;
  readonly users: `${number}:r-${string}`;
  readonly roles: `${number}:r-${string}`;
}

/** 자주 쓰는 사용자·루트 표본 */
export const GOOD_ROOT: RootSpec = { password: true, mfa: true, passwordLastUsed: "2026-02-01T00:00:00Z", keys: [] };
export const aliceOk: UserSpec = {
  name: "alice", password: true, passwordLastUsed: "2026-10-10T09:00:00Z", mfa: true,
  keys: [{ suffix: "7QXZ", createdAt: "2026-08-01T00:00:00Z", lastUsed: "2026-10-17T12:00:00Z" }],
};
export const bobNoConsole: UserSpec = { name: "build-bot", password: false, mfa: false, keys: [{ suffix: "K3MQ", createdAt: "2026-09-01T00:00:00Z", lastUsed: "2026-10-18T00:00:00Z" }] };

