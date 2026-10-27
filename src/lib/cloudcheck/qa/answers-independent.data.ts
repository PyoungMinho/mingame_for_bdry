// src/lib/cloudcheck/qa/answers-independent.data.ts — AN-01 사람 재판정 표(QA실행자가 직접 적음, 2026-10-20)
// 근거: fixtures/companies/worlds-aws.ts · worlds-azure.ts의 회사 정의 + 기획서 §6-2 룰 상세 + 방향서 불변식(INV-1·4·5·7: 증거가 '답'이 아니면 이상 없음 불가 →
//   clear-without-evidence, 일부 대상만 거부된 점검 조회 → isolated-denial). 엔진 출력과 정답지 파일(answers/*.json)을 보기 전에 적었다.
//   예외: C.aws는 형식 확인 중 정답지 일부를 먼저 봤다(seenBeforeWriting) — 독립성은 나머지 7개 표에 있다. 설계서 §3의 C.aws IAM 14행 표본은 그대로 옮겼다.
// 행 선택(설계서 AN-01): 이상 없음 · 해당 없음 행 전부 + 위험 행 전부 + 확인 불가 사유가 둘 이상인 룰의 행. 대상 행 = [상태, 이름, 사유 slug].
// 이 파일은 데이터만 담는다(테스트: answers-independent.test.ts).

export type Row = readonly [string, string, string];
export interface RuleJudgment {
  readonly status: string;
  readonly why: string;
  readonly basis?: string;
  readonly gaps?: readonly string[];
  /** 선택한 대상 행(룰의 모든 행이 아닐 수 있다) */
  readonly rows: readonly Row[];
}
export interface CompanyJudgment {
  readonly set: "A" | "B" | "C" | "D";
  readonly cloud: "aws" | "azure";
  readonly seenBeforeWriting: boolean;
  readonly rules: Readonly<Record<string, RuleJudgment>>;
}

const ACCT = "111122223333";

export const QA_JUDGMENTS: readonly CompanyJudgment[] = [
  /* ───────── AWS A 반듯상회: IAM 사용자 0명, 루트 MFA만, 전부 정리됨 ───────── */
  { set: "A", cloud: "aws", seenBeforeWriting: false, rules: {
    "AWS-MFA-1": { status: "clear", why: "AWS-MFA-1:root-secured", rows: [["clear", "root", "root-secured"]] },      // not_supported = 비밀번호 있음, MFA 켜짐, 키 0, 마지막 로그인 2026-03-02(231일)
    "AWS-MFA-2": { status: "na", why: "no-targets-proven", basis: "AWS-MFA-2:na-no-console-users", rows: [] },
    "AWS-KEY-1": { status: "na", why: "no-targets-proven", basis: "AWS-KEY-1:na-no-active-keys", rows: [] },
    "AWS-KEY-2": { status: "na", why: "no-targets-proven", basis: "AWS-KEY-2:na-no-active-credentials", rows: [] },
    "AWS-KEY-3": { status: "na", why: "no-targets-proven", basis: "AWS-KEY-3:na-no-admin-keys", rows: [] },
    "AWS-KEY-4": { status: "clear", why: "AWS-KEY-4:no-external-trust", rows: [["clear", "app-lambda-exec", "trust-ok"], ["clear", "partner-readonly", "trust-ok"]] },   // 서비스 연결 역할은 제외, 협력사는 ExternalId 있음
    "AWS-NET-1": { status: "clear", why: "AWS-NET-1:none-open", rows: [["clear", "sg-0a1b2c3d", "sg-closed"], ["clear", "sg-0b2c3d4e", "sg-closed"], ["clear", "sg-0c3d4e5f", "sg-closed"], ["clear", "sg-0d4e5f6a", "sg-closed"]] },   // 80·443만 공개, SSH는 사무실 대역
    "AWS-STO-1": { status: "clear", why: "AWS-STO-1:all-blocked", rows: [["clear", ACCT, "all-blocked"]] },
    "AWS-STO-2": { status: "clear", why: "AWS-STO-2:all-private", rows: [["clear", "amzn-s3-demo-banjeut-logs", "block-all-on"], ["clear", "amzn-s3-demo-banjeut-backup", "block-all-on"], ["clear", "amzn-s3-demo-banjeut-data", "block-all-on"]] },   // data는 버킷 차단 없음 + 계정 차단 4개
    "AWS-LOG-1": { status: "clear", why: "AWS-LOG-1:trail-ok", rows: [["clear", ACCT, "trail-ok"]] },
  } },
  /* ───────── AWS B 멈춘시계상회 ───────── */
  { set: "B", cloud: "aws", seenBeforeWriting: false, rules: {
    "AWS-MFA-1": { status: "clear", why: "AWS-MFA-1:root-secured", rows: [["clear", "root", "root-secured"]] },      // 마지막 루트 로그인 2025-06-20(486일)
    "AWS-MFA-2": { status: "clear", why: "AWS-MFA-2:all-mfa", rows: [["clear", "park-ops", "user-has-mfa"], ["clear", "intern-2021", "user-has-mfa"]] },   // old-deploy는 콘솔 없음(제외)
    "AWS-KEY-2": { status: "caution", why: "AWS-KEY-2:unused-credentials", rows: [["clear", "park-ops", "credentials-used"]] },   // 콘솔 2026-10-12 · 키 2026-10-15 사용
    "AWS-NET-1": { status: "clear", why: "AWS-NET-1:none-open", rows: [["clear", "sg-0b0b0b01", "sg-closed"], ["clear", "sg-0b0b0b02", "sg-closed"], ["clear", "sg-0b0b0b03", "sg-closed"]] },
    "AWS-STO-2": { status: "caution", why: "AWS-STO-2:buckets-attention", rows: [["clear", "amzn-s3-demo-oldshop-backup", "block-all-on"]] },
  } },
  /* ───────── AWS C 아슬아슬상회(정답지 일부를 먼저 봄) ───────── */
  { set: "C", cloud: "aws", seenBeforeWriting: true, rules: {
    "AWS-MFA-1": { status: "risk", why: "AWS-MFA-1:root-key-active", rows: [["risk", "root", "root-key-active"]] },
    "AWS-MFA-2": { status: "risk", why: "AWS-MFA-2:console-no-mfa", rows: [["risk", "dev-kim", "user-no-mfa"], ["risk", "ex-employee", "user-no-mfa"], ["clear", "admin-lee", "user-has-mfa"]] },
    "AWS-KEY-2": { status: "caution", why: "AWS-KEY-2:unused-credentials", rows: [["clear", "dev-kim", "credentials-used"], ["clear", "admin-lee", "credentials-used"]] },
    "AWS-KEY-4": { status: "risk", why: "AWS-KEY-4:roles-open", rows: [["risk", "cross-acct-admin", "trust-wildcard-open"]] },
    "AWS-NET-1": { status: "risk", why: "AWS-NET-1:exposed-with-public-ip", rows: [["risk", "sg-0c0ffee1", "sg-public"], ["clear", "sg-0c0ffee3", "sg-closed"], ["clear", "sg-0c0ffee4", "sg-closed"]] },
    "AWS-STO-2": { status: "risk", why: "AWS-STO-2:buckets-public", rows: [["risk", "amzn-s3-demo-acme-customer-export", "bucket-public-policy"], ["clear", "amzn-s3-demo-acme-logs", "block-all-on"]] },
  } },
  /* ───────── AWS D 반쯤본상회: 권한 부족 · log 건너뜀 ───────── */
  { set: "D", cloud: "aws", seenBeforeWriting: false, rules: {
    "AWS-MFA-1": { status: "na", why: "no-targets-proven", basis: "AWS-MFA-1:na-no-root-credentials", rows: [] },   // 멤버 계정: 루트 비밀번호 FALSE + 키 0
    "AWS-MFA-2": { status: "na", why: "no-targets-proven", basis: "AWS-MFA-2:na-no-console-users", rows: [] },
    "AWS-KEY-1": { status: "na", why: "no-targets-proven", basis: "AWS-KEY-1:na-no-active-keys", rows: [] },
    "AWS-KEY-2": { status: "na", why: "no-targets-proven", basis: "AWS-KEY-2:na-no-active-credentials", rows: [] },
    "AWS-KEY-3": { status: "na", why: "no-targets-proven", basis: "AWS-KEY-3:na-no-admin-keys", rows: [] },
    // list-roles 잘림(1개만): 받은 역할의 증거 영수증이 '답'(ok·empty·notconfigured)이 아니다 → 이상 없음 불가(clear-without-evidence)
    "AWS-KEY-4": { status: "unknown", why: "truncated", gaps: ["truncated", "clear-without-evidence"], rows: [["unknown", "app-lambda-exec", "clear-without-evidence"]] },
    // us-east-1 보안 그룹 거부 · ap-southeast-1 ENI 제한 → 리전 단위 빈틈. 받은 보안 그룹 3개는 각자 이상 없음
    "AWS-NET-1": { status: "unknown", why: "region-missing", gaps: ["region-missing"], rows: [["clear", "sg-0d0d0d01", "sg-closed"], ["clear", "sg-0d0d0d02", "sg-closed"], ["clear", "sg-0d0d0d03", "sg-closed"]] },
  } },
  /* ───────── Azure A 반듯상회 ───────── */
  { set: "A", cloud: "azure", seenBeforeWriting: false, rules: {
    "AZ-KEY-1": { status: "clear", why: "AZ-KEY-1:all-ok", rows: [["clear", "stbanjeutapp01", "shared-key-off"], ["clear", "stbanjeutlogs02", "keys-rotated"], ["clear", "stbanjeutdev03", "shared-key-off"]] },   // logs02: 공유 키 허용 + 두 키 39·37일
    "AZ-NET-1": { status: "clear", why: "AZ-NET-1:none-open", rows: [["clear", "nsg-banjeut-web", "nsg-closed"], ["clear", "nsg-banjeut-dev", "nsg-closed"]] },
    "AZ-STO-1": { status: "clear", why: "AZ-STO-1:all-blocked", rows: [["clear", "stbanjeutapp01", "allow-false"], ["clear", "stbanjeutlogs02", "allow-false"], ["clear", "stbanjeutdev03", "allow-false"]] },
    "AZ-STO-2": { status: "clear", why: "AZ-STO-2:all-private", rows: [["clear", "app-data", "container-private"], ["clear", "backups", "container-private"], ["clear", "insights-logs", "container-private"], ["clear", "scratch", "container-private"]] },
    "AZ-LOG-1": { status: "clear", why: "AZ-LOG-1:all-exported", rows: [["clear", "반듯상회-운영", "exported"], ["clear", "반듯상회-개발", "exported"]] },
    "AZ-LOG-2": { status: "clear", why: "AZ-LOG-2:all-logged", rows: [["clear", "stbanjeutapp01", "blob-logged"], ["clear", "stbanjeutlogs02", "blob-logged"], ["clear", "stbanjeutdev03", "blob-logged"]] },
  } },
  /* ───────── Azure B 멈춘시계상회 ───────── */
  { set: "B", cloud: "azure", seenBeforeWriting: false, rules: {
    "AZ-NET-1": { status: "clear", why: "AZ-NET-1:none-open", rows: [["clear", "nsg-oldshop", "nsg-closed"]] },     // 443만 공개
    "AZ-STO-2": { status: "caution", why: "AZ-STO-2:containers-attention", rows: [["clear", "images", "container-private"], ["clear", "backup", "container-private"]] },   // $web은 주의
  } },
  /* ───────── Azure C 아슬아슬상회 ───────── */
  { set: "C", cloud: "azure", seenBeforeWriting: false, rules: {
    "AZ-KEY-1": { status: "caution", why: "AZ-KEY-1:keys-stale", rows: [["clear", "stacmedev02", "shared-key-off"]] },
    "AZ-NET-1": { status: "risk", why: "AZ-NET-1:exposed-with-public-ip", rows: [["risk", "nsg-acme-jump", "nsg-public"], ["risk", "nsg-acme-db", "nsg-public"], ["clear", "nsg-acme-dev", "nsg-closed"]] },
    "AZ-STO-2": { status: "risk", why: "AZ-STO-2:containers-public", rows: [["risk", "exports", "container-public"], ["risk", "reports", "container-public"], ["clear", "private-data", "container-private"], ["clear", "tmp", "container-private"]] },
  } },
  /* ───────── Azure D 반쯤본상회: dev 계정 목록 잘림 · legacy 거부 · net 건너뜀 ───────── */
  { set: "D", cloud: "azure", seenBeforeWriting: false, rules: {
    // dev 목록이 잘려(truncated) 받은 stdemodev03의 증거 영수증이 '답'이 아니다 → clear-without-evidence. legacy 구독 목록 거부 → subscription-missing
    "AZ-KEY-1": { status: "unknown", why: "truncated", gaps: ["truncated", "subscription-missing", "clear-without-evidence"], rows: [["clear", "stdemoapp01", "shared-key-off"], ["clear", "stdemodata02", "shared-key-off"], ["unknown", "stdemodev03", "clear-without-evidence"]] },
    "AZ-STO-1": { status: "unknown", why: "truncated", gaps: ["truncated", "subscription-missing", "clear-without-evidence"], rows: [["clear", "stdemoapp01", "allow-false"], ["clear", "stdemodata02", "allow-false"], ["unknown", "stdemodev03", "clear-without-evidence"]] },
    // stdemodata02만 컨테이너 조회 거부(다른 계정은 성공) → 주의(isolated-denial). 룰 사유도 isolated-denial(자기 사유가 있는 주의 대상이 없다)
    "AZ-STO-2": { status: "caution", why: "isolated-denial", rows: [["clear", "app-data", "container-private"], ["unknown", "scratch", "clear-without-evidence"]] },
    "AZ-LOG-1": { status: "unknown", why: "denied", gaps: ["denied"], rows: [["clear", "반쯤본상회-운영", "exported"]] },
    "AZ-LOG-2": { status: "unknown", why: "denied", gaps: ["denied", "truncated", "unsupported", "subscription-missing", "field-missing"], rows: [["unknown", "stdemoapp01", "denied"], ["unknown", "stdemodata02", "field-missing"], ["unknown", "stdemodev03", "unsupported"]] },
  } },
];
