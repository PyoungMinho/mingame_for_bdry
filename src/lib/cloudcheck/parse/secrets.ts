// src/lib/cloudcheck/parse/secrets.ts — 비밀 패턴 검사 (방향서 §4-5 ⑨, R-12) · 키 파일 판별 (디자인 B7)
// 우리 수집기는 키 ID 전체(AKIA…)·비밀 값을 출력하지 않는다. 입력에서 비밀 모양이 보이면 ① 파일 전체가 키 파일이면 거부(credentials-file),
// ② 정상 결과 파일 안의 문자열 값이면 그 값만 지우고(REDACTED) 배너를 띄운다. 어느 쪽이든 화면에 그리지 않고 어디로도 보내지 않는다.
import { REDACTED_PREFIX } from "../contract/normalized";

/** 값 하나(문자열)에서 찾는 비밀 모양. 이름은 진단용(화면에 내지 않는다) */
const SECRET_PATTERNS: ReadonlyArray<readonly [string, RegExp]> = [
  ["aws-access-key-id", /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ["private-key", /-----BEGIN [A-Z0-9 ]*(?:PRIVATE KEY|CERTIFICATE|PGP PRIVATE KEY BLOCK)-----/],
  ["jwt", /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]*/],
  ["azure-storage-key", /(?:^|[^A-Za-z0-9+/])[A-Za-z0-9+/]{86}==(?![A-Za-z0-9+/=])/],
  ["connection-string", /\b(?:AccountKey|SharedAccessKey|SharedAccessSignature|DefaultEndpointsProtocol)\s*=/i],
  ["sas-token", /[?&]sig=[A-Za-z0-9%+/=]{20,}/],
  ["secret-assignment", /\b(?:aws_secret_access_key|aws_session_token|client_secret|clientSecret)\s*[:=]\s*\S{8,}/i],
  ["github-token", /\bgh[pousr]_[A-Za-z0-9]{30,}\b/],
  ["slack-token", /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
  ["google-api-key", /\bAIza[0-9A-Za-z_-]{35}\b/],
  ["secret-key-token", /\bsk-[A-Za-z0-9_-]{20,}/],
];

/** 비밀 모양이 있으면 패턴 이름, 없으면 null */
export function findSecret(s: string): string | null {
  if (s.length < 8) return null;
  for (const [name, re] of SECRET_PATTERNS) if (re.test(s)) return name;
  return null;
}

const SECRET_GLOBALS: ReadonlyArray<RegExp> = SECRET_PATTERNS.map(([, re]) => new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`));
/**
 * 문자열 안의 비밀 모양 '값' 자체를 모두 돌려준다(없으면 빈 배열). 개수를 셀 때 쓴다: 같은 비밀이 이름 칸에도, 그 이름이 든 ARN 칸에도 나오면 1개다.
 * 앞뒤 경계 문자(azure-storage-key 패턴이 붙이는 앞 문자)는 값이 아니므로 떼어 낸다
 */
export function secretValues(s: string): string[] {
  if (s.length < 8) return [];
  const out = new Set<string>();
  for (const re of SECRET_GLOBALS) {
    re.lastIndex = 0;
    for (const m of s.matchAll(re)) out.add(m[0].replace(/^[^A-Za-z0-9+/]+/, ""));
  }
  return [...out];
}

/** 파일 전체가 '키 파일'로 보이는가: AWS credentials·config, 환경변수 내보내기, 새 액세스 키 CSV, assume-role/sts 출력, az 서비스 주체 출력, PEM, 연결 문자열 */
const KEY_FILE_PATTERNS: readonly RegExp[] = [
  /\baws_(?:access_key_id|secret_access_key|session_token)\s*=/i,
  /\bexport\s+AWS_(?:ACCESS_KEY_ID|SECRET_ACCESS_KEY|SESSION_TOKEN)\s*=/,
  /^\s*AWS_(?:ACCESS_KEY_ID|SECRET_ACCESS_KEY|SESSION_TOKEN)\s*=/m,
  /"(?:SecretAccessKey|aws_secret_access_key|SessionToken)"\s*:/,
  /"(?:clientSecret|client_secret|AccountKey|SharedAccessKey)"\s*:/,
  /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/,
  /\b(?:AccountKey|SharedAccessSignature|SharedAccessKey)\s*=\s*[A-Za-z0-9+/%=]{16,}/,
  /\bDefaultEndpointsProtocol\s*=\s*https?\b/i,
  /[?&]sig=[A-Za-z0-9%+/=]{20,}[^\n]*[?&]?se=/,
  /"(?:accessToken|access_token|refresh_token|refreshToken|id_token|idToken)"\s*:\s*"eyJ[A-Za-z0-9_-]{8,}\./,   // az account get-access-token · MSAL 토큰 응답
];
/** SAS 토큰: sig=와 만료(se=) 또는 저장된 액세스 정책(si=)이 한 글자 덩어리 안에 있으면 순서와 상관없이 키 파일이다(포털·SDK 기본 순서는 sig가 맨 끝).
 *  sv= 같은 한두 매개변수와 sig만 든 조각은 사용자 데이터 칸의 비밀 모양이라 파일째 거부하지 않고 그 값만 지운다 */
const SAS_SIG = /[?&]sig=[A-Za-z0-9%+/=]{20,}/;
const SAS_PARAM = /[?&](?:se|si)=/;
export function looksLikeKeyFile(text: string): boolean {
  if (KEY_FILE_PATTERNS.some((re) => re.test(text))) return true;
  if (SAS_SIG.test(text) && SAS_PARAM.test(text)) return true;
  // az ad sp create-for-rbac 출력({appId, password, tenant})
  if (/"appId"\s*:/.test(text) && /"password"\s*:\s*"[^"]{8,}"/.test(text) && /"tenant"\s*:/.test(text)) return true;
  // IAM 콘솔 '액세스 키 .csv 다운로드': 머리글에 Access key ID와 Secret access key가 함께 있다
  const firstLine = text.split(/\r\n|\r|\n/, 1)[0].toLowerCase().replace(/[\s_"]+/g, "");
  if (firstLine.includes("accesskeyid") && firstLine.includes("secretaccesskey")) return true;
  return false;
}

/**
 * 입력 하나 안에서 비밀 모양 문자열을 지우는 도우미. 같은 원문은 같은 토큰으로 바뀌어 조인(사용자명 ↔ 영수증 resource)이 유지되고,
 * 서로 다른 문자열은 서로 다른 토큰이 된다(REDACTED_PREFIX + 순번). 개수(count)는 지운 '비밀 값'의 서로 다른 수다 — 같은 비밀이 이름 칸과 그 이름이 든 ARN 칸에 함께 나와도 1개.
 */
export class Redactor {
  private readonly map = new Map<string, string>();
  /** 지운 '비밀 값'(서로 다른 것만). 같은 비밀이 여러 문자열에 들어 있어도 1개다(CC-QA-19) */
  private readonly values = new Set<string>();
  fix(s: string): string {
    const cached = this.map.get(s);
    if (cached !== undefined) return cached;
    if (findSecret(s) === null) return s;
    const token = `${REDACTED_PREFIX}${this.map.size + 1}`;
    this.map.set(s, token);
    const found = secretValues(s);
    if (found.length === 0) this.values.add(s);        // 패턴은 걸렸는데 값을 따로 떼지 못하면 문자열 전체를 값으로 센다
    for (const v of found) this.values.add(v);
    return token;
  }
  get count(): number { return this.values.size; }
}
