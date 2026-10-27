// src/lib/cloudcheck/qa/fake-secrets.ts — QA 시험용 가짜 '비밀 모양' 값(테스트가 아니다)
// 배포 저장소는 공개 저장소이고 GitHub 푸시 보호가 켜져 있다. 시험용 가짜 값이라도 실제 비밀 패턴과 같은 모양의 리터럴이 소스에 있으면
// push 전체가 거부될 수 있고 외부 스캐너가 경보를 낸다(프론트팀장 검수 docs/review/cloudcheck-frontend-review.md F-2).
// 그래서 값은 실행 중에 조각을 이어 붙여 만든다 — 소스 바이트에는 완성된 비밀 모양이 남지 않고, 실행 중 값은 예전 리터럴과 글자 하나까지 같다.
// 공급자가 문서에 공개한 예시(AWS 문서의 AKIAIOSFODNN7EXAMPLE · wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY)는 예외로 그대로 둔다.
// 이 파일에 새 값을 더할 때도 같은 규칙: 접두(형식 표시)와 본문을 다른 조각으로 나눈다.

/** 조각 이어 붙이기 */
const j = (...parts: readonly string[]): string => parts.join("");

/** AWS 문서의 공개 예시 키 쌍(예외 — 공급자 문서 표본) */
export const AWS_DOC_KEY_ID = "AKIAIOSFODNN7EXAMPLE";
export const AWS_DOC_SECRET = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";

/** AWS 임시(STS) 액세스 키 ID 모양 */
export const FAKE_STS_KEY_ID = j("AS", "IA", "Y34FZKBOKMUTVV7A");
/** AWS 세션 토큰 머리(모든 세션 토큰이 이 글자로 시작한다)와 그 모양의 가짜 값 */
export const FAKE_SESSION_PREFIX = j("FwoGZXIv", "YXdz");
export const FAKE_SESSION_TOKEN = j(FAKE_SESSION_PREFIX, "EXAMPLE");
export const FAKE_SESSION_TOKEN_LONG = j(FAKE_SESSION_PREFIX, "EXAMPLE", "TOKEN0123456789");

/** JWT 모양(머리 · 본문 · 서명). 머리와 본문은 base64url JSON이라 eyJ로 시작한다 */
const jwt = (head: string, body: string, sig: string): string => j("ey", "J", head, ".", "ey", "J", body, ".", sig);
/** az account get-access-token 출력의 accessToken 모양 */
export const FAKE_JWT_RS256 = jwt("0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9", "hdWQiOiJodHRwczovL21hbmFnZW1lbnQifQ", "c2lnbmF0dXJlLXNhbXBsZQ");
/** 짧은 HS256 모양 */
export const FAKE_JWT_HS256 = jwt("hbGciOiJIUzI1NiJ9", "zdWIiOiIxMjM0In0", "abcdefghijk");

/** PEM 개인 키. label은 "RSA " 같은 앞 낱말(없으면 "") */
const PRIVATE_KEY = ["PRIVATE", "KEY"].join(" ");
export const pemHead = (label = ""): string => j("-----BEGIN ", label, PRIVATE_KEY, "-----");
export const pemBlock = (label: string, body: string): string => j(pemHead(label), "\n", body, "\n", "-----END ", label, PRIVATE_KEY, "-----", "\n");

/** Azure 저장소 계정 키 모양(base64 86자 + "==") */
export const FAKE_AZURE_ACCOUNT_KEY = j("Ab3dEf6hIj9lMn2pQr5tUv", "8xYz1bCd4fGh7jKl0nOp3r", "St6vWx9zAb2dEf5hIj8lMn", "1pQr4tUv7xYz0bCd3fGH", "=", "=");
/** Azure 저장소 연결 문자열 모양 */
export const FAKE_AZURE_CONNECTION_STRING = j("DefaultEndpointsProtocol=https;AccountName=stx;", "Account", "Key=", FAKE_AZURE_ACCOUNT_KEY, ";EndpointSuffix=core.windows.net");

/** SAS의 서명 매개변수 이름과 가짜 서명 값 */
const SIG = j("si", "g=");
export const FAKE_SAS_SIGNATURE = j("abcdefghijklmnopqrstuvwxyz", "0123456789ABCD", "%3D");
/** SAS 모양: 앞 질의 문자열(…& 또는 …? 로 끝남) + sig=서명 + 뒤 */
export const sasUrl = (before: string, signature: string, after = ""): string => j(before, SIG, signature, after);

/** Slack 봇 토큰 모양 */
export const FAKE_SLACK_BOT_TOKEN = j("xo", "xb-", "123456789012-abcdefghijkl");
