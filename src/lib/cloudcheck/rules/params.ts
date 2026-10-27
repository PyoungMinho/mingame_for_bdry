// src/lib/cloudcheck/rules/params.ts — 룰 공통 파라미터 (방향서 §6-2·§6-3·§6-4)
// 파라미터마다 근거를 '공개 기준(public-standard)'과 '도구 기준(tool-default)'으로 나눠 적는다. 화면 V7이 이 구분을 그대로 보인다.
// 값을 바꾸면 룰셋이 바뀐 것이므로 version.ts의 RULESET_VERSION을 올리고 params.test.ts의 기준 표를 함께 고친다.

export const MINUTE_MS = 60_000;
export const HOUR_MS = 3_600_000;
export const DAY_MS = 86_400_000;

/** AWS Security Hub IAM.3 — 액세스 키 회전 [확인: 2026-10-19, docs.aws.amazon.com/securityhub/.../iam-controls.html#iam-3] */
export const KEY_MAX_AGE_DAYS = 90;
/** AWS Security Hub IAM.22 · CIS AWS v5.0.0/1.11 — 미사용 자격증명 [확인: 같은 문서 #iam-22] */
export const CREDENTIAL_UNUSED_DAYS = 45;
/** 만든 지 얼마 안 된 자격증명은 아직 안 썼어도 주의로 보지 않는다(도구 기준) */
export const CREDENTIAL_GRACE_DAYS = 7;
/** 루트 최근 콘솔 로그인(도구 기준). CIS는 일상 사용 금지만 요구하고 일수를 정하지 않는다 */
export const ROOT_RECENT_LOGIN_DAYS = 90;
/** Azure 스토리지 공유 키 회전(도구 기준). Microsoft 문서는 정기 회전을 권고하고 일수를 정하지 않는다 [확인: 2026-10-19, storage-account-keys-manage] */
export const AZURE_KEY_ROTATION_DAYS = 90;
/** 자격증명 보고서는 최대 4시간 캐시 [확인: 2026-10-19, id_credentials_getting-report]. 수집 시각과 생성 시각 차이 허용치 = 4시간 5분 */
export const REPORT_FRESHNESS_MS = 4 * HOUR_MS + 5 * MINUTE_MS;
/** 시간 알림(도구 기준, 기획서 §5-4 INV-9) */
export const SNAPSHOT_STALE_HOURS = 24;
export const SNAPSHOT_VERY_STALE_DAYS = 7;
export const GUIDANCE_STALE_DAYS = 180;
export const FUTURE_SKEW_MINUTES = 5;

/** 2023-04 이전에 만든 버킷은 '레거시' 힌트(라벨만, 판정을 바꾸지 않는다) */
export const LEGACY_BUCKET_BEFORE = "2023-04-01";
/** 이름 힌트(라벨만) */
export const NAME_HINTS = ["public", "static", "assets", "cdn"] as const;

/**
 * 위험 포트(방향서 §6-3). 인바운드 출발지가 0.0.0.0/0 · ::/0 이고 포트 범위가 겹치면 해당. TCP·UDP를 같은 목록으로 본다.
 * EC2.19의 24개 [확인: 2026-10-19, ec2-controls.html#ec2-19] 에서 메일 포트 25·110·143을 뺀 21개 + 도구 기준 12개 = 33개.
 */
export const RISKY_PORTS_EC2_19: readonly number[] = [
  20, 21, 22, 23, 135, 445, 1433, 1434, 3000, 3306, 3389, 4333, 5000, 5432, 5500, 5601, 8080, 8088, 8888, 9200, 9300,
];
export const RISKY_PORTS_TOOL: readonly number[] = [1521, 2375, 2376, 2379, 2380, 5900, 5985, 5986, 6379, 10250, 11211, 27017];
export const RISKY_PORTS: readonly number[] = [...RISKY_PORTS_EC2_19, ...RISKY_PORTS_TOOL].sort((a, b) => a - b);
/**
 * 넓은 공인 대역(결정 D-1b, 도구 기준): 인터넷 전체는 아니지만 위험 포트의 출발지로 두기에는 너무 넓은 값. IPv4 접두 /8 이하 · IPv6 접두 /16 이하.
 * 사설·예약 대역 안에 다 들어가는 IPv4 값과 공인 대역(2000::/3)과 겹치지 않는 IPv6 값은 넓어도 뺀다.
 */
export const BROAD_IPV4_PREFIX = 8;
export const BROAD_IPV6_PREFIX = 16;
/**
 * 넓어도 판정에서 빼는 IPv4 사설·예약 대역(공개 기준: RFC 1918·6598·1122·3927·5735·6890 등). parse/mask.ts의 보존 목록(keepIpv4)과 같은 9개다.
 * 두 목록은 목적이 달라 한 상수로 묶지 않는다(백엔드팀장 STEP 6): 여기는 판정 파라미터, 마스킹 쪽은 '회사를 식별하지 않는 주소' 정책이다. 같음은 parse/mask.test.ts가 대역 경계 주소로 대조한다.
 */
export const RESERVED_IPV4_RANGES: readonly string[] = [
  "0.0.0.0/8", "10.0.0.0/8", "100.64.0.0/10", "127.0.0.0/8", "169.254.0.0/16", "172.16.0.0/12", "192.168.0.0/16", "224.0.0.0/4", "240.0.0.0/4",
];
/** 메일 포트: 주의 단계("메일 서버라면 의도된 공개일 수 있습니다") */
export const MAIL_PORTS: readonly number[] = [25, 110, 143];
/** 웹 기본 포트: EC2.18의 기본 허용 TCP 80·443 [확인: 2026-10-19, ec2-controls.html#ec2-18] */
export const WEB_PORTS: readonly number[] = [80, 443];

/**
 * 관리자급 관리형 정책(AWS-KEY-3, 방향서 §6-4). ARN 접미 ':iam::aws:policy/<이름>'으로 파티션과 무관하게 비교한다.
 * 정책 문서 대조(2026-10-19): AdministratorAccess = Action * on Resource * / PowerUserAccess = iam·organizations·account 외 전부 /
 * IAMFullAccess = iam:* / AWSOrganizationsFullAccess = organizations:*.
 * 검토 후보 3종은 목록에 넣지 않았다 — 셋 모두 `*:*`가 아니라 서비스별 동작 나열이다.
 *  AdministratorAccess-Amplify: Amplify·CloudFormation·Cognito 등 나열(IAM 역할 생성·정책 연결 동작이 있어 권한 상승 경로는 가능하나 전체 관리자와 같지는 않음) /
 *  AdministratorAccess-AWSElasticBeanstalk: 'awseb-*' 등 이름 접두로 범위를 좁힌 Elastic Beanstalk 관리 /
 *  job-function/SystemAdministrator: iam:*가 없고 IAM은 읽기 위주.
 * 목록 밖 정책과 인라인·고객 관리형 정책의 관리자급 권한은 AWS-KEY-3의 '못 보는 것'으로 고지한다.
 */
export const ADMIN_POLICY_NAMES: readonly string[] = ["AdministratorAccess", "PowerUserAccess", "IAMFullAccess", "AWSOrganizationsFullAccess"];

/** 예외 최대 기간은 contract/exceptions-schema.ts의 EXCEPTION_MAX_DAYS(90)를 쓴다 */

/** 판정에 쓰이는 값의 기준 표. 이 표와 위 상수가 다르면 params.test.ts가 실패한다(룰셋 버전을 올리라는 신호) */
export const PARAMS_FINGERPRINT = {
  keyMaxAgeDays: KEY_MAX_AGE_DAYS,
  credentialUnusedDays: CREDENTIAL_UNUSED_DAYS,
  credentialGraceDays: CREDENTIAL_GRACE_DAYS,
  rootRecentLoginDays: ROOT_RECENT_LOGIN_DAYS,
  azureKeyRotationDays: AZURE_KEY_ROTATION_DAYS,
  reportFreshnessMinutes: REPORT_FRESHNESS_MS / MINUTE_MS,
  snapshotStaleHours: SNAPSHOT_STALE_HOURS,
  snapshotVeryStaleDays: SNAPSHOT_VERY_STALE_DAYS,
  guidanceStaleDays: GUIDANCE_STALE_DAYS,
  futureSkewMinutes: FUTURE_SKEW_MINUTES,
  riskyPortCount: RISKY_PORTS.length,
  mailPorts: MAIL_PORTS,
  webPorts: WEB_PORTS,
  broadIpv4Prefix: BROAD_IPV4_PREFIX,
  broadIpv6Prefix: BROAD_IPV6_PREFIX,
  reservedIpv4Ranges: RESERVED_IPV4_RANGES,
  adminPolicies: ADMIN_POLICY_NAMES,
} as const;
