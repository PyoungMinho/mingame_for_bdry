// src/lib/cloudcheck/parse/leak-scan.ts — 누출 스캔 (테스트 도구): 글자 덩어리에서 '문서 표본이 아닌, 진짜처럼 보이는 값'을 찾는다.
// 쓰는 곳: ① 시나리오·픽스처 원문(진짜 계정·키·주소가 섞여 들어오지 않았는지) ② maskedCopy 출력(가명화가 빠뜨린 식별자가 없는지).
// 규칙은 보수적이다: 표본으로 허용한 것(아래 SAMPLE_*)을 뺀 나머지는 전부 '발견'으로 센다. 순수 함수만 있다(DOM·node 모듈 없음).
//   account-number  12자리 숫자(표본 계정 목록 밖)      access-key-id  AKIA·ASIA 키 ID(AKIAIOSFODNN7EXAMPLE 밖)   iam-id  AIDA·AROA … 고유 ID(EXAMPLE이 없는 것)
//   guid            GUID(0으로 채운 표본형 밖)           email          주소(example.* · contoso.com 밖)            public-ipv4 / public-ipv6  공인 주소(문서용·사설·예약 밖, 넓은 네트워크 대역 제외)
// 넓은 네트워크 대역(IPv4 접두 ≤ /8 · IPv6 접두 ≤ /16이고 호스트 비트가 0인 CIDR — 128.0.0.0/1 · 52.0.0.0/8 · 2000::/3 …)은 어느 회사의 주소도 아니라 발견으로 세지 않는다.
//   가명 사본이 지키는 기준(mask.ts)·룰의 '넓은 공인 대역' 기준과 같다. 호스트 비트가 켜진 값(52.95.110.1/8)이나 /9 이상은 그대로 발견이다.
//   storage-host    blob·s3 호스트/ARN(표본 이름 밖)       jwt            eyJ… 토큰                                   private-key  -----BEGIN … 키 블록

export type LeakRule = "account-number" | "access-key-id" | "iam-id" | "guid" | "email" | "public-ipv4" | "public-ipv6" | "storage-host" | "jwt" | "private-key";
export interface LeakFinding { readonly rule: LeakRule; readonly line: number; readonly match: string }
export interface LeakOptions {
  /** 표본으로 더 허용할 12자리 계정 번호 */
  readonly allowAccounts?: readonly string[];
  /** 표본으로 더 허용할 저장소 이름(Azure 저장소 계정 · S3 버킷) */
  readonly allowStorageNames?: readonly string[];
}

/** 표본 계정: 시나리오 자기 계정, 외부 계정, 마스킹 사본의 가명 계정, AWS 문서 표본 */
export const SAMPLE_ACCOUNTS: readonly string[] = ["111122223333", "444455556666", "777788889999", "999999999999", "999988887777", "123456789012", "210987654321", "000000000000"];
/** 표본 키 ID(AWS 문서의 예) */
export const SAMPLE_KEY_ID = "AKIAIOSFODNN7EXAMPLE";
/** 표본 이메일 도메인(하위 도메인 포함) */
const SAMPLE_EMAIL_DOMAINS: readonly string[] = ["example.com", "example.org", "example.net", "contoso.com"];
const SAMPLE_EMAIL_TLDS: readonly string[] = ["test", "example", "invalid", "localhost"];
/** 표본 저장소 이름: 접두 또는 포함 표식 */
const SAMPLE_STORAGE_PREFIXES: readonly string[] = ["amzn-s3-demo-", "doc-example-bucket", "example", "contoso"];
const SAMPLE_STORAGE_SENTINEL = "poison";   // 시나리오의 '읽으면 안 되는 필드' 표식

const lineOf = (text: string, index: number): number => {
  let n = 1;
  for (let i = 0; i < index; i++) if (text.charCodeAt(i) === 10) n++;
  return n;
};
const blank = (text: string, re: RegExp): string => text.replace(re, (m) => " ".repeat(m.length));

const GUID_RE = /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g;
const ZERO_GUID_RE = /^0{8}-0{4}-0{4}-0{4}-[0-9a-fA-F]{12}$/;
const KEY_ID_RE = /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g;
const IAM_ID_RE = /\b(?:AIDA|AROA|AGPA|ANPA|ANVA|AIPA|APKA)[A-Z0-9]{16}\b/g;
const ACCOUNT_RE = /\b\d{12}\b/g;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})/g;
const JWT_RE = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]*/g;
const PEM_RE = /-----BEGIN [A-Z0-9 ]+-----/g;
const IPV4_RE = /\b(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\b/g;
const IPV6_CAND_RE = /[0-9A-Fa-f:]{2,}/g;
const BLOB_RE = /\b([a-z0-9][a-z0-9-]{1,62})\.(?:blob|file|queue|table|dfs|web)\.core\.windows\.net\b/gi;
const S3_HOST_RE = /\b([a-z0-9][a-z0-9.-]{1,61}[a-z0-9])\.s3(?:[.-][a-z0-9-]+)*\.amazonaws\.com\b/gi;
const S3_URI_RE = /\bs3:\/\/([a-z0-9][a-z0-9.-]{1,61}[a-z0-9])/gi;
const S3_ARN_RE = /\barn:aws[a-z-]*:s3:::([A-Za-z0-9][A-Za-z0-9._-]{1,61})/g;

/** a.b.c.d/n 이 접두 ≤ /8 이고 호스트 비트가 모두 0인 넓은 네트워크인가 */
const isWideNetwork4 = (o: readonly number[], prefix: number): boolean =>
  prefix <= 8 && o[1] === 0 && o[2] === 0 && o[3] === 0 && (o[0] & ~((0xff << (8 - prefix)) & 0xff) & 0xff) === 0;
/** 묶음 8개 주소가 /n(≤ 16) 이고 호스트 비트가 모두 0인 넓은 네트워크인가 */
const isWideNetwork6 = (g: readonly number[], prefix: number): boolean =>
  prefix <= 16 && g.slice(1).every((x) => x === 0) && (g[0] & ~((0xffff << (16 - prefix)) & 0xffff) & 0xffff) === 0;
const prefixAfter = (text: string, at: number, maxDigits: number): number | null => {
  const m = new RegExp(`^/(\\d{1,${maxDigits}})(?!\\d)`).exec(text.slice(at, at + maxDigits + 2));
  return m === null ? null : Number(m[1]);
};

const isPublicIpv4 = (a: number, b: number, c: number): boolean => {
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 192 && b === 0 && c === 2) return false;        // TEST-NET-1
  if (a === 198 && b === 51 && c === 100) return false;     // TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return false;      // TEST-NET-3
  return true;
};

/** IPv6 주소를 8개 묶음(16비트)으로 푼다. 문법이 틀리면 null */
function parseIpv6(s: string): number[] | null {
  if (!/^[0-9A-Fa-f:]+$/.test(s)) return null;
  const dbl = s.indexOf("::");
  if (dbl !== s.lastIndexOf("::")) return null;
  const toGroups = (part: string): number[] | null => {
    if (part === "") return [];
    const out: number[] = [];
    for (const g of part.split(":")) {
      if (!/^[0-9A-Fa-f]{1,4}$/.test(g)) return null;
      out.push(parseInt(g, 16));
    }
    return out;
  };
  if (dbl < 0) {
    const g = toGroups(s);
    return g !== null && g.length === 8 ? g : null;
  }
  const head = toGroups(s.slice(0, dbl));
  const tail = toGroups(s.slice(dbl + 2));
  if (head === null || tail === null || head.length + tail.length > 7) return null;
  return [...head, ...new Array<number>(8 - head.length - tail.length).fill(0), ...tail];
}
const isPublicIpv6 = (g: readonly number[]): boolean => {
  if (g.every((x) => x === 0)) return false;                              // ::
  if (g.slice(0, 7).every((x) => x === 0) && g[7] === 1) return false;   // ::1
  if ((g[0] & 0xffc0) === 0xfe80) return false;                           // fe80::/10 링크 로컬
  if ((g[0] & 0xfe00) === 0xfc00) return false;                           // fc00::/7 사설
  if ((g[0] & 0xff00) === 0xff00) return false;                           // ff00::/8 멀티캐스트
  if (g[0] === 0x2001 && g[1] === 0x0db8) return false;                   // 문서용 2001:db8::/32
  return true;
};

const isSampleStorage = (name: string, extra: readonly string[]): boolean => {
  const n = name.toLowerCase();
  return n.includes(SAMPLE_STORAGE_SENTINEL) || SAMPLE_STORAGE_PREFIXES.some((p) => n.startsWith(p)) || extra.some((e) => e.toLowerCase() === n);
};
const isSampleEmailDomain = (domain: string): boolean => {
  const d = domain.toLowerCase();
  return SAMPLE_EMAIL_DOMAINS.some((s) => d === s || d.endsWith(`.${s}`)) || SAMPLE_EMAIL_TLDS.includes(d.slice(d.lastIndexOf(".") + 1));
};

/** 글자 덩어리에서 진짜처럼 보이는 값을 모두 찾는다(없으면 빈 배열) */
export function scanForLeaks(text: string, opts: LeakOptions = {}): LeakFinding[] {
  const out: LeakFinding[] = [];
  const add = (rule: LeakRule, index: number, match: string): void => { out.push({ rule, line: lineOf(text, index), match }); };
  const accounts = new Set([...SAMPLE_ACCOUNTS, ...(opts.allowAccounts ?? [])]);
  const extraNames = opts.allowStorageNames ?? [];

  for (const m of text.matchAll(PEM_RE)) add("private-key", m.index ?? 0, m[0]);
  for (const m of text.matchAll(JWT_RE)) add("jwt", m.index ?? 0, m[0]);
  for (const m of text.matchAll(KEY_ID_RE)) if (m[0] !== SAMPLE_KEY_ID) add("access-key-id", m.index ?? 0, m[0]);
  for (const m of text.matchAll(IAM_ID_RE)) if (!m[0].includes("EXAMPLE")) add("iam-id", m.index ?? 0, m[0]);
  for (const m of text.matchAll(EMAIL_RE)) if (!isSampleEmailDomain(m[1])) add("email", m.index ?? 0, m[0]);
  for (const m of text.matchAll(BLOB_RE)) if (!isSampleStorage(m[1], extraNames)) add("storage-host", m.index ?? 0, m[0]);
  for (const re of [S3_HOST_RE, S3_URI_RE, S3_ARN_RE]) for (const m of text.matchAll(re)) if (!isSampleStorage(m[1], extraNames)) add("storage-host", m.index ?? 0, m[0]);

  // GUID를 먼저 찾아 지운 뒤(마지막 묶음이 12자리 숫자처럼 보인다) 계정 번호·주소를 본다
  for (const m of text.matchAll(GUID_RE)) if (!ZERO_GUID_RE.test(m[0])) add("guid", m.index ?? 0, m[0]);
  const rest = blank(blank(text, GUID_RE), KEY_ID_RE);

  for (const m of rest.matchAll(ACCOUNT_RE)) if (!accounts.has(m[0])) add("account-number", m.index ?? 0, m[0]);
  for (const m of rest.matchAll(IPV4_RE)) {
    const i = m.index ?? 0;
    const end = i + m[0].length;
    if (rest[i - 1] === "." || (rest[end] === "." && /\d/.test(rest[end + 1] ?? ""))) continue;     // 1.2.3.4.5 같은 버전·번호열
    const o = [m[1], m[2], m[3], m[4]].map(Number);
    if (o.some((x) => x > 255)) continue;
    const p4 = prefixAfter(rest, end, 2);
    if (p4 !== null && isWideNetwork4(o, p4)) continue;                          // 넓은 네트워크 대역
    if (isPublicIpv4(o[0], o[1], o[2])) add("public-ipv4", i, m[0]);
  }
  for (const m of rest.matchAll(IPV6_CAND_RE)) {
    const i = m.index ?? 0;
    const prev = rest[i - 1] ?? "", next = rest[i + m[0].length] ?? "";
    if (/[A-Za-z0-9_]/.test(prev) || /[A-Za-z0-9_]/.test(next)) continue;       // 낱말 안(arn:aws:iam::… 의 일부 등)
    if (!m[0].includes("::") && (m[0].match(/:/g) ?? []).length !== 7) continue;     // 시각(03:12:00) 같은 짧은 묶음은 주소가 아니다
    const g = parseIpv6(m[0]);
    if (g === null) continue;
    const p6 = prefixAfter(rest, i + m[0].length, 3);
    if (p6 !== null && isWideNetwork6(g, p6)) continue;                          // 넓은 네트워크 대역
    if (isPublicIpv6(g)) add("public-ipv6", i, m[0]);
  }
  return out.sort((a, b) => a.line - b.line || (a.rule < b.rule ? -1 : a.rule > b.rule ? 1 : 0));
}
