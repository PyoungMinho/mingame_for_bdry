// src/lib/cloudcheck/qa/oracle.ts — FO-06 차등 오라클(테스트가 아니다): 무작위 세계 생성기 + QA가 명세 문장만 보고 짠 최소 참조 판정기 5개
// 참조 판정기는 엔진·룰 코드를 import하지 않는다(기획서 §6-2 문장 + 원칙 P3 '모르는 열거값은 해석 불가' + 방향서 결정 K-1만 근거).
// 2026-10-20 갱신: 출발지 해석은 기획팀장 결정(docs/planning/cloudcheck-qa-decisions.md §2 D-1 · D-3 · D-4, §9-1)의 문장대로 다시 짰다 —
//   trim · 주소 범위 합집합 = 전체 · 넓은 공인 대역(사설·예약 제외) · 프리픽스 리스트 · 서비스 태그는 위험 포트에서만 주의 · ASG · VirtualNetwork · AzureLoadBalancer = 내부 ·
//   출발지 없음 = 해석 불가(포트와 무관, 결정 §2-2). 결정이 정하지 않은 두 곳은 DB설계자 선택을 따른다(코드가 아니라 선택 문장): 한쪽 끝만 범위 밖인 포트는 잘라 읽음,
//   프로토콜 번호는 IP 프로토콜 번호 0~255만 포트 없는 프로토콜로 본다(P3 — 엔진은 1~3자리 숫자 전부를 받아 256 · 999도 건너뛴다: CC-QA-24).
//   엔진 코드(rules/sources.ts 등)는 import하지 않는다.
import fc from "fast-check";
import { clone, companyJson } from "./kit";
import type { Json } from "./kit";

export type St = "risk" | "caution" | "clear" | "unknown";
const RISKY = [20, 21, 22, 23, 135, 445, 1433, 1434, 3000, 3306, 3389, 4333, 5000, 5432, 5500, 5601, 8080, 8088, 8888, 9200, 9300, 1521, 2375, 2376, 2379, 2380, 5900, 5985, 5986, 6379, 10250, 11211, 27017];
const MAIL = [25, 110, 143];
const WEB = [80, 443];
const worst = (xs: readonly St[]): St => (xs.includes("risk") ? "risk" : xs.includes("caution") ? "caution" : xs.includes("unknown") ? "unknown" : "clear");

/** 구간 목록의 포트 분류(명세: 위험 포트 · 전체 포트(1~65535) = 위험 / 메일 = 주의 / 80·443 밖 = 주의) */
function classify(iv: readonly (readonly [number, number])[]): "risky" | "mail" | "other" | "none" {
  const has = (p: number): boolean => iv.some(([a, b]) => a <= p && p <= b);
  let all = true;
  // 1~65535 전체 덮음
  const sorted = [...iv].sort((x, y) => x[0] - y[0]);
  let reach = 0;
  for (const [a, b] of sorted) { if (a > reach + 1) { all = false; break; } reach = Math.max(reach, b); }
  if (reach < 65535) all = false;
  if (all || RISKY.some(has)) return "risky";
  if (MAIL.some(has)) return "mail";
  const known = new Set([...RISKY, ...MAIL, ...WEB]);
  for (const [a, b] of iv) { const n = b - a + 1; if (n > known.size + 1) return "other"; for (let p = a; p <= b; p++) if (!known.has(p)) return "other"; }
  return "none";
}

/* ═════════ 출발지 해석(결정 §2-1 · §2-3 — QA가 문장만 보고 짠 독립 구현) ═════════ */
type R4 = { lo: number; hi: number; len: number };
type R6 = { lo: bigint; hi: bigint; len: number };
/** IPv4 "a.b.c.d/n"(trim, 호스트 비트는 네트워크 주소로). bare면 접두 없는 단일 주소를 /32로 받는다(Azure만) */
function v4(text: string, bare: boolean): R4 | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?:\/(\d{1,2}))?$/.exec(text.trim());
  if (!m) return null;
  const o = m.slice(1, 5).map(Number);
  if (o.some((x) => x > 255)) return null;
  if (m[5] === undefined && !bare) return null;
  const len = m[5] === undefined ? 32 : Number(m[5]);
  if (len > 32) return null;
  const ip = ((o[0] * 256 + o[1]) * 256 + o[2]) * 256 + o[3];
  const size = 2 ** (32 - len);
  const lo = Math.floor(ip / size) * size;
  return { lo, hi: lo + size - 1, len };
}
/** IPv6 "addr/n"(:: 압축 · 16진 그룹). bare면 /128. IPv4 꼬리 표기는 받지 않는다(이 오라클의 세계에 없음) */
function v6(text: string, bare: boolean): R6 | null {
  const t = text.trim();
  const [addr, pre, extra] = t.split("/");
  if (extra !== undefined) return null;
  if (pre === undefined && !bare) return null;
  const len = pre === undefined ? 128 : /^\d{1,3}$/.test(pre) ? Number(pre) : NaN;
  if (!(len >= 0 && len <= 128)) return null;
  if (!/^[0-9a-fA-F:]+$/.test(addr) || !addr.includes(":")) return null;
  const parts = addr.split("::");
  if (parts.length > 2) return null;
  const g = (x: string): number[] | null => (x === "" ? [] : x.split(":").every((h) => /^[0-9a-fA-F]{1,4}$/.test(h)) ? x.split(":").map((h) => parseInt(h, 16)) : null);
  const head = g(parts[0]), tail = parts.length === 2 ? g(parts[1]) : [];
  if (head === null || tail === null) return null;
  if (parts.length === 1 && head.length !== 8) return null;
  if (parts.length === 2 && head.length + tail.length > 7) return null;
  const groups = parts.length === 1 ? head : [...head, ...Array<number>(8 - head.length - tail.length).fill(0), ...tail];
  let v = BigInt(0);
  for (const x of groups) v = (v << BigInt(16)) + BigInt(x);
  const host = (BigInt(1) << BigInt(128 - len)) - BigInt(1);
  const lo = v - (v & host);
  return { lo, hi: lo + host, len };
}
const ALL4 = 2 ** 32 - 1;
const ALL6 = (BigInt(1) << BigInt(128)) - BigInt(1);
function covers4(rs: readonly R4[]): boolean { let reach = -1; for (const r of [...rs].sort((a, b) => a.lo - b.lo)) { if (r.lo > reach + 1) return false; reach = Math.max(reach, r.hi); } return reach >= ALL4; }
function covers6(rs: readonly R6[]): boolean { let reach = BigInt(-1); for (const r of [...rs].sort((a, b) => (a.lo < b.lo ? -1 : 1))) { if (r.lo > reach + BigInt(1)) return false; if (r.hi > reach) reach = r.hi; } return reach >= ALL6; }
/** 사설·예약 IPv4(결정 §2-3 ④의 9개)의 합집합 — 붙어 있는 구간은 하나로(224.0.0.0/4 + 240.0.0.0/4 = 224.0.0.0/3) */
const RESERVED: readonly { lo: number; hi: number }[] = (() => {
  const xs = ["0.0.0.0/8", "10.0.0.0/8", "100.64.0.0/10", "127.0.0.0/8", "169.254.0.0/16", "172.16.0.0/12", "192.168.0.0/16", "224.0.0.0/4", "240.0.0.0/4"].map((c) => v4(c, false) as R4).sort((a, b) => a.lo - b.lo);
  const out: { lo: number; hi: number }[] = [];
  for (const r of xs) { const last = out[out.length - 1]; if (last && r.lo <= last.hi + 1) last.hi = Math.max(last.hi, r.hi); else out.push({ lo: r.lo, hi: r.hi }); }
  return out;
})();
/** 넓은 공인 대역: IPv4 접두 ≤ /8이면서 사설·예약 대역 합집합 안에 다 들어가지 않음 / IPv6 접두 ≤ /16이면서 2000::/3과 겹침 */
const broad4 = (r: R4): boolean => r.len <= 8 && !RESERVED.some((x) => x.lo <= r.lo && r.hi <= x.hi);
const G6 = v6("2000::/3", false) as R6;
const broad6 = (r: R6): boolean => r.len <= 16 && r.lo <= G6.hi && r.hi >= G6.lo;

/* ═════════ AWS-NET-1 ═════════ */
export interface SgRule { protocol: string; fromPort: number | null; toPort: number | null; cidrs: string[]; ipv6Cidrs: string[]; lists: string[]; sgRef: number }
export interface Sg { id: string; rules: SgRule[] }
export interface Eni { id: string; groups: string[]; publicIp: boolean; ipv6: boolean }
export interface NetWorld { sgs: Sg[]; enis: Eni[] }

/** 참조: 보안 그룹 하나의 상태(결정 §2-2 상태 표) */
export function refNet1(sg: Sg, enis: readonly Eni[]): St {
  let unrec = false;
  const found: { kind: "whole" | "broad" | "list"; tier: "risky" | "mail" | "other"; v4: boolean; v6: boolean }[] = [];
  for (const r of sg.rules) {
    const a = r.cidrs.map((c) => v4(c, false));
    const b = r.ipv6Cidrs.map((c) => v6(c, false));
    if (a.some((x) => x === null) || b.some((x) => x === null) || r.lists.some((l) => l.trim() === "")) unrec = true;
    if (r.cidrs.length + r.ipv6Cidrs.length + r.lists.length === 0 && r.sgRef === 0) unrec = true;     // 출발지 없는 규칙(포트와 무관)
    const ra = a.filter((x): x is R4 => x !== null), rb = b.filter((x): x is R6 => x !== null);
    const w4 = ra.length > 0 && covers4(ra), w6 = rb.length > 0 && covers6(rb);
    const isBroad = (!w4 && ra.some(broad4)) || (!w6 && rb.some(broad6));
    const isList = r.lists.some((l) => l.trim() !== "");
    if (!w4 && !w6 && !isBroad && !isList) continue;
    const p = r.protocol.trim().toLowerCase();
    let iv: [number, number][];
    if (p === "-1") iv = [[0, 65535]];
    else if (p === "tcp" || p === "udp" || p === "6" || p === "17") {
      const f = r.fromPort, t = r.toPort;
      if (f === null || t === null || !Number.isInteger(f) || !Number.isInteger(t) || f > t || t < 0 || f > 65535) { unrec = true; continue; }
      iv = [[Math.max(0, f), Math.min(65535, t)]];                                   // 한쪽 끝만 범위 밖이면 잘라 읽는다(DB설계자 선택)
    } else if (/^(icmp|icmpv6)$/.test(p) || (/^(0|[1-9]\d{0,2})$/.test(p) && Number(p) <= 255)) continue;   // 포트가 없는 프로토콜: 이름 2개 + IP 프로토콜 번호 0~255(P3 — 256 · 999 · 006은 모르는 값, CC-QA-24)
    else { unrec = true; continue; }                                                  // 모르는 프로토콜(P3)
    const c = classify(iv);
    if ((w4 || w6) && c !== "none") found.push({ kind: "whole", tier: c, v4: w4, v6: w6 });
    if (c === "risky" && isBroad) found.push({ kind: "broad", tier: "risky", v4: false, v6: false });
    if (c === "risky" && isList) found.push({ kind: "list", tier: "risky", v4: false, v6: false });
  }
  const risky = found.filter((f) => f.kind === "whole" && f.tier === "risky");
  if (risky.length > 0) {
    const w4 = risky.some((f) => f.v4), w6 = risky.some((f) => f.v6);
    const attached = enis.filter((e) => e.groups.includes(sg.id));
    return attached.some((e) => (w4 && e.publicIp) || (w6 && e.ipv6)) ? "risk" : "caution";
  }
  if (found.length > 0) return "caution";
  return unrec ? "unknown" : "clear";
}

const anomaly = <T>(normal: fc.Arbitrary<T>, odd: fc.Arbitrary<T>): fc.Arbitrary<T> => fc.oneof({ weight: 9, arbitrary: normal }, { weight: 1, arbitrary: odd });
const sgRule: fc.Arbitrary<SgRule> = fc.record({
  protocol: anomaly(fc.constantFrom("tcp", "udp", "-1", "icmp", "6"), fc.constantFrom("TCP ", "zzz", "", " tcp", "132")),
  ports: anomaly(fc.constantFrom<[number | null, number | null]>([22, 22], [3389, 3389], [443, 443], [80, 80], [25, 25], [1000, 2000], [0, 65535], [8443, 8443], [null, null]), fc.constantFrom<[number | null, number | null]>([-1, -1], [3389, 22], [65536, 65536], [22, 70000], [-5, 22])),
  cidrs: anomaly(
    fc.constantFrom(["0.0.0.0/0"], ["10.0.0.0/8"], ["203.0.113.0/24"], [], ["0.0.0.0/0", "10.0.0.0/8"], ["1.0.0.0/8"], ["0.0.0.0/1", "128.0.0.0/1"], ["100.64.0.0/10"], ["224.0.0.0/4"], ["12.0.0.0/6"]),
    fc.constantFrom(["0.0.0.0/0 "], ["0.0.0.0/2", "64.0.0.0/2", "128.0.0.0/1"], ["10.1.2.3/1", "200.1.1.1/1"], ["zzz"], ["300.0.0.0/8"], ["1.2.3.4"], ["0.0.0.0/1", "128.0.0.0/2"]),
  ),
  ipv6Cidrs: fc.constantFrom([], [], [], ["::/0"], ["2001:db8::/32"], ["2000::/3"], ["fc00::/7"], ["::/1", "8000::/1"]),
  lists: fc.constantFrom<string[]>([], [], [], ["pl-0123abcd"], [" pl-0123abcd "], [""]),
  sgRef: fc.constantFrom(0, 0, 1),
}).map(({ protocol, ports, cidrs, ipv6Cidrs, lists, sgRef }) => ({ protocol, fromPort: ports[0], toPort: ports[1], cidrs, ipv6Cidrs, lists, sgRef }));
export const netWorld: fc.Arbitrary<NetWorld> = fc.array(fc.array(sgRule, { maxLength: 3 }), { minLength: 1, maxLength: 4 }).chain((ruleSets) => {
  const sgs = ruleSets.map((rules, i) => ({ id: `sg-0${(0xa000 + i).toString(16)}0000`, rules }));
  return fc.array(fc.record({ g: fc.subarray(sgs.map((s) => s.id)), publicIp: fc.boolean(), ipv6: fc.boolean() }), { maxLength: 4 })
    .map((es) => ({ sgs, enis: es.map((e, i) => ({ id: `eni-0${(0xe000 + i).toString(16)}0000`, groups: e.g, publicIp: e.publicIp, ipv6: e.ipv6 })) }));
});

/** 회사 A(AWS)의 ap-northeast-2 보안 그룹·ENI를 세계로 바꾼 수집 JSON(us-east-1은 그대로) */
export function awsNetJson(w: NetWorld): Json {
  const f = companyJson("aws", "A");
  const kr = (sec: string): Json => (f.data[sec] as Json[]).find((p) => p.region === "ap-northeast-2");
  const sg = kr("securityGroups");
  sg.items = w.sgs.map((s) => ({ groupId: s.id, groupName: s.id, vpcId: "vpc-0bb1", ingress: s.rules.map((r) => ({ protocol: r.protocol, fromPort: r.fromPort, toPort: r.toPort, cidrs: r.cidrs, ipv6Cidrs: r.ipv6Cidrs, prefixListIds: r.lists, sgRefCount: r.sgRef })) }));
  setCount(f, sg.receipt, sg.items.length);
  const en = kr("networkInterfaces");
  en.items = w.enis.map((e) => ({ eniId: e.id, groupIds: e.groups, hasPublicIp: e.publicIp, hasIpv6: e.ipv6, interfaceType: "interface", status: "in-use", requesterManaged: false }));
  setCount(f, en.receipt, en.items.length);
  return f;
}
function setCount(f: Json, id: string, n: number): void {
  const r = (f.receipts as Json[]).find((x) => x.id === id);
  if (n === 0) { r.result = "empty"; r.count = 0; } else { r.result = "ok"; r.count = n; }
  r.errorCode = null;
}

/* ═════════ AWS-STO-2 ═════════ */
type Pab = boolean[] | null;   // 4개 플래그 또는 설정 없음
export interface Bucket { name: string; pab: Pab; policyPublic: boolean | null; grants: boolean; ownership: string | null; website: boolean }
export interface StoWorld { account: Pab; buckets: Bucket[] }
const flag = (p: Pab, i: number): boolean => (p === null ? false : p[i]);
/** 참조: 버킷 하나의 상태(명세 §6-2 AWS-STO-2 + 모르는 소유권 값은 ACL 사용으로 본다는 결정 ④) */
export function refSto2(b: Bucket, account: Pab): St {
  const eff = [0, 1, 2, 3].map((i) => flag(account, i) || flag(b.pab, i));     // blockPublicAcls · ignorePublicAcls · blockPublicPolicy · restrictPublicBuckets
  if (eff.every(Boolean)) return "clear";
  const polPublic = b.policyPublic === true;
  const exposed = (polPublic && !eff[3]) || (b.grants && !eff[1]);
  if (exposed) return b.website ? "caution" : "risk";
  if (eff.every((x) => !x)) return "caution";                                   // 공개될 수 있는 상태
  const aclEnabled = b.ownership !== "BucketOwnerEnforced";
  if (aclEnabled && !eff[1]) return "caution";
  return "clear";
}
const pabArb: fc.Arbitrary<Pab> = fc.oneof(fc.constant(null), fc.constant([true, true, true, true]), fc.constant([false, false, false, false]), fc.array(fc.boolean(), { minLength: 4, maxLength: 4 }));
export const stoWorld: fc.Arbitrary<StoWorld> = fc.record({
  account: pabArb,
  buckets: fc.array(fc.record({
    pab: pabArb, policyPublic: fc.constantFrom<boolean | null>(true, false, null), grants: fc.boolean(),
    ownership: anomaly(fc.constantFrom<string | null>("BucketOwnerEnforced", "BucketOwnerPreferred", "ObjectWriter", null), fc.constantFrom<string | null>("zzz", "bucketownerenforced", "")),
    website: fc.boolean(),
  }), { minLength: 1, maxLength: 4 }).map((bs) => bs.map((b, i) => ({ ...b, name: `amzn-s3-demo-qa-${i}` }))),
});
/** 회사 A(AWS)의 버킷 섹션을 세계로 바꾼다(버킷별 영수증 5개 + 목록 영수증 count) */
export function awsStoJson(w: StoWorld): Json {
  const f = companyJson("aws", "A");
  const old = new Set((f.data.buckets.items as Json[]).flatMap((b) => ["publicAccessBlock", "policyStatus", "acl", "ownership", "website"].map((k) => b[k].receipt)));
  f.receipts = (f.receipts as Json[]).filter((r) => !old.has(r.id));
  let n = 9000;
  const rc = (call: string, bucket: string, result: string, errorCode: string | null = null): string => {
    const id = `r-${n++}`;
    (f.receipts as Json[]).push({ id, call, region: "ap-northeast-2", resource: bucket, result, count: null, errorCode, at: "2026-10-19T03:14:00Z" });
    return id;
  };
  const pabObj = (p: Pab) => (p === null ? null : { blockPublicAcls: p[0], ignorePublicAcls: p[1], blockPublicPolicy: p[2], restrictPublicBuckets: p[3] });
  const acct = f.data.accountPublicAccessBlock;
  const acctRc = (f.receipts as Json[]).find((r) => r.id === acct.receipt);
  if (w.account === null) { acctRc.result = "notconfigured"; acctRc.errorCode = "NoSuchPublicAccessBlockConfiguration"; acct.value = null; } else { acctRc.result = "ok"; acctRc.errorCode = null; acct.value = pabObj(w.account); }
  f.data.buckets.items = w.buckets.map((b) => ({
    name: b.name, createDate: "2024-06-01T00:00:00+00:00", region: { value: "ap-northeast-2", source: "list", receipt: null },
    publicAccessBlock: { receipt: rc("s3:GetBucketPublicAccessBlock", b.name, b.pab === null ? "notconfigured" : "ok", b.pab === null ? "NoSuchPublicAccessBlockConfiguration" : null), value: pabObj(b.pab) },
    policyStatus: { receipt: rc("s3:GetBucketPolicyStatus", b.name, b.policyPublic === null ? "notconfigured" : "ok", b.policyPublic === null ? "NoSuchBucketPolicy" : null), value: b.policyPublic === null ? null : { isPublic: b.policyPublic } },
    acl: { receipt: rc("s3:GetBucketAcl", b.name, "ok"), value: { publicGrants: b.grants ? [{ grantee: "AllUsers", permission: "READ" }] : [] } },
    ownership: { receipt: rc("s3:GetBucketOwnershipControls", b.name, b.ownership === null ? "notconfigured" : "ok", b.ownership === null ? "OwnershipControlsNotFoundError" : null), value: b.ownership === null ? null : { objectOwnership: b.ownership } },
    website: { receipt: rc("s3:GetBucketWebsite", b.name, b.website ? "ok" : "notconfigured", b.website ? null : "NoSuchWebsiteConfiguration"), value: b.website ? { enabled: true } : null },
  }));
  f.data.buckets.budget = { limit: 200, total: w.buckets.length, collected: w.buckets.length };
  setCount(f, f.data.buckets.receipt, w.buckets.length);
  return f;
}

/* ═════════ AWS-KEY-4 ═════════ */
export interface Stmt { effect: string; actions: string[]; wildcard: boolean; aws: string[]; conditionKeys: string[]; canonical: number }
export interface Role { name: string; trust: Stmt[] | null }
const SELF = "111122223333";
/** ExternalId 보호로 인정하는 조건 키(결정 §8-A CC-QA-05): 값 일치 연산자만. Null · 부정형 · …IfExists · ForAllValues는 보호가 아니다 */
const EQ_EXTERNAL = /^(ForAnyValue:)?(StringEquals|StringEqualsIgnoreCase|StringLike):sts:ExternalId$/i;
const ORG = /(^|:)aws:(principalorgid|principalorgpaths|sourceaccount|sourceorgid|sourceorgpaths)$/i;
function coversAssume(a: string): boolean {
  const x = a.trim().toLowerCase();
  if (x === "*") return true;
  if (!/^[a-z0-9-]+:[a-z0-9*?]+$/.test(x)) return true;                         // 형식 밖 = 덮는 것으로(fail-closed)
  const re = new RegExp(`^${x.replace(/\*/g, ".*").replace(/\?/g, ".")}$`);
  return ["sts:assumerole", "sts:assumerolewithsaml", "sts:assumerolewithwebidentity"].some((t) => re.test(t));
}
/** 참조: 역할 하나의 상태(명세 §6-2 AWS-KEY-4 + P3) */
export function refKey4(r: Role): St {
  if (r.trust === null || r.trust.length === 0) return "unknown";
  const out: St[] = [];
  for (const s of r.trust) {
    const eff = s.effect.trim().toLowerCase();
    if (eff === "deny") continue;
    if (eff !== "allow") { out.push("unknown"); continue; }
    if (s.actions.length > 0 && !s.actions.some(coversAssume)) continue;
    const hasCond = s.conditionKeys.length > 0;
    const ext = s.conditionKeys.some((k) => EQ_EXTERNAL.test(k.trim()));
    const org = s.conditionKeys.some((k) => ORG.test(k.trim()));
    if (s.wildcard || s.aws.includes("*")) out.push(hasCond ? "caution" : "risk");
    for (const p of s.aws) {
      if (p === "*") continue;
      if (/^A(ID|RO)A[A-Z0-9]{12,}$/.test(p)) continue;                        // 삭제된 주체의 고유 ID: 아무도 쓸 수 없다(엔진 설계와 같음)
      const m = /^(\d{12})$/.exec(p) ?? /^arn:aws[a-z-]*:(?:iam|sts)::(\d{12}):/.exec(p);
      if (m === null) { out.push("unknown"); continue; }
      if (m[1] !== SELF && !ext) out.push("caution");
    }
    if (s.canonical > 0 && !ext) out.push("caution");
    void org;
  }
  return worst(out);
}
const stmt: fc.Arbitrary<Stmt> = fc.record({
  effect: anomaly(fc.constantFrom("Allow", "Allow", "Deny"), fc.constantFrom("Allow ", "", "Permit", "allow")),
  actions: anomaly(fc.constantFrom(["sts:AssumeRole"], ["sts:AssumeRole"], ["sts:*"], ["sts:TagSession"], [], ["sts:AssumeRoleWithWebIdentity"]), fc.constantFrom(["zzz"], ["STS:ASSUMEROLE"], ["sts:Assume*"])),
  wildcard: fc.boolean(),
  aws: anomaly(fc.constantFrom([], [`arn:aws:iam::${SELF}:root`], ["arn:aws:iam::999988887777:root"], ["999988887777"], ["arn:aws:sts::999988887777:assumed-role/x/y"]), fc.constantFrom(["*"], ["arn:aws:iam::bad"], ["AIDAEXAMPLEEXAMPLE01"])),
  conditionKeys: anomaly(fc.constantFrom([], [], ["StringEquals:sts:ExternalId"], ["StringEquals:aws:PrincipalOrgID"], ["Bool:aws:MultiFactorAuthPresent"]), fc.constantFrom(["Null:sts:ExternalId"], ["StringNotEquals:sts:ExternalId"], ["StringLike:sts:ExternalId"], ["StringEqualsIfExists:sts:ExternalId"], ["ForAllValues:StringEquals:sts:ExternalId"], ["ForAnyValue:StringEquals:sts:ExternalId"])),
  canonical: fc.constantFrom(0, 0, 0, 1),
});
export const rolesWorld: fc.Arbitrary<Role[]> = fc.array(fc.oneof({ weight: 9, arbitrary: fc.array(stmt, { minLength: 1, maxLength: 2 }) }, { weight: 1, arbitrary: fc.constantFrom<Stmt[] | null>(null, []) }), { minLength: 1, maxLength: 4 })
  .map((ts) => ts.map((trust, i) => ({ name: `qa-role-${i}`, trust })));
/** 회사 A(AWS)의 역할 목록을 바꾼다(ListRoles count · 계정 요약 Roles 맞춤). 서비스 연결 역할(support)은 그대로 둔다 */
export function awsRolesJson(roles: readonly Role[]): Json {
  const f = companyJson("aws", "A");
  const keep = (f.data.iamRoles.value as Json[]).filter((r) => String(r.path).startsWith("/aws-service-role/"));
  const items = roles.map((r) => ({
    roleName: r.name, path: "/", createDate: "2025-01-01T00:00:00+00:00",
    trust: r.trust === null ? null : r.trust.map((s) => ({ effect: s.effect, actions: s.actions, notPrincipal: false, principal: { wildcard: s.wildcard, aws: s.aws, service: [], federated: [], canonicalUserCount: s.canonical }, conditionKeys: s.conditionKeys })),
  }));
  f.data.iamRoles.value = [...keep, ...items];
  setCount(f, f.data.iamRoles.receipt, f.data.iamRoles.value.length);
  f.data.accountSummary.value.Roles = f.data.iamRoles.value.length;
  return f;
}

/* ═════════ AZ-NET-1 ═════════ */
export interface NsgRule { direction: string; access: string; priority: number; protocol: string; sources: string[]; asg: number; ports: string[] }
export interface Nsg { name: string; rules: NsgRule[]; nicPublic: boolean | null }   // null = 연결 없음, true/false = NIC(공인 IP 유무)에 연결
/** "22" · "1000-2000" · "*" · "80,443". 목록이 비거나 빈 조각 · 모르는 조각이 있으면 ok = false(읽은 조각은 남긴다) */
function parsePorts(specs: readonly string[]): { ok: boolean; iv: [number, number][] } {
  let ok = specs.length > 0;
  const iv: [number, number][] = [];
  for (const spec of specs) for (const raw of spec.split(",")) {
    const t = raw.trim();
    if (t === "") { ok = false; continue; }
    if (t === "*") { iv.push([0, 65535]); continue; }
    const m = /^(\d{1,5})(?:\s*-\s*(\d{1,5}))?$/.exec(t);
    if (!m) { ok = false; continue; }
    const a = Number(m[1]), b = m[2] === undefined ? a : Number(m[2]);
    if (a > 65535 || b > 65535 || a > b) { ok = false; continue; }
    iv.push([a, b]);
  }
  return { ok, iv };
}
function subtract(a: readonly [number, number][], b: readonly [number, number][]): [number, number][] {
  let cur = a.map(([x, y]) => [x, y] as [number, number]);
  for (const [bs, be] of b) {
    const next: [number, number][] = [];
    for (const [s, e] of cur) { if (be < s || bs > e) next.push([s, e]); else { if (s < bs) next.push([s, bs - 1]); if (e > be) next.push([be + 1, e]); } }
    cur = next;
  }
  return cur;
}
/** Azure 규칙 하나의 출발지(결정 §2-1 · §2-3 ②): 전체 글자 · 내부 태그 · CIDR/IP · 서비스 태그 모양 · 그 밖 = 해석 불가 */
function azSources(prefixes: readonly string[], asg: number): { whole: boolean; broad: boolean; tag: boolean; unrec: boolean } {
  let whole = false, tag = false, unrec = false;
  const a: R4[] = [], b: R6[] = [];
  for (const raw of prefixes) {
    const t = raw.trim(), l = t.toLowerCase();
    if (l === "*" || l === "internet" || l === "any") { whole = true; continue; }
    if (l === "virtualnetwork" || l === "azureloadbalancer") continue;
    const x = v4(t, true);
    if (x !== null) { a.push(x); continue; }
    const y = v6(t, true);
    if (y !== null) { b.push(y); continue; }
    if (/^[A-Za-z][A-Za-z0-9.]{0,79}$/.test(t)) { tag = true; continue; }
    unrec = true;
  }
  if (prefixes.length === 0 && asg === 0) unrec = true;                              // 출발지 없는 규칙(ASG만 있으면 내부)
  const w4 = a.length > 0 && covers4(a), w6 = b.length > 0 && covers6(b);
  return { whole: whole || w4 || w6, broad: (!w4 && a.some(broad4)) || (!w6 && b.some(broad6)), tag, unrec };
}
/** 참조: NSG 하나의 상태(결정 §2-2 상태 표 + CC-QA-17 방향 · 허용 · 프로토콜 닫힌 목록 · 빈 포트 칸 = 해석 불가) */
export function refAzNet1(n: Nsg): St {
  let unrec = false;
  const lc = (x: string): string => x.trim().toLowerCase();
  for (const r of n.rules) if (!["inbound", "outbound"].includes(lc(r.direction)) || !["allow", "deny"].includes(lc(r.access))) unrec = true;
  const inbound = n.rules.filter((r) => lc(r.direction) === "inbound").sort((a, b) => a.priority - b.priority);
  const found: { kind: "whole" | "broad" | "tag"; tier: "risky" | "mail" | "other" }[] = [];
  inbound.forEach((r, i) => {
    if (lc(r.access) !== "allow") return;
    const proto = lc(r.protocol);
    if (!["tcp", "udp", "*", "any", "icmp", "esp", "ah"].includes(proto)) { unrec = true; return; }
    const src = azSources(r.sources, r.asg);
    if (src.unrec) unrec = true;
    if (!["tcp", "udp", "*", "any"].includes(proto)) return;
    if (!src.whole && !src.broad && !src.tag) return;
    const ps = parsePorts(r.ports);
    if (!ps.ok) unrec = true;
    if (ps.iv.length === 0) return;
    let eff = ps.iv;
    for (const d of inbound.slice(0, i)) {
      if (lc(d.access) !== "deny") continue;
      const dp = lc(d.protocol);
      if (!(dp === "*" || dp === "any" || dp === proto)) continue;
      if (!azSources(d.sources, d.asg).whole) continue;                                // 막는 범위가 전체일 때만 뺀다(결정 §2-3 ⑧)
      const dv = parsePorts(d.ports);
      if (dv.ok) eff = subtract(eff, dv.iv);
    }
    const c = classify(eff);
    if (src.whole && c !== "none") found.push({ kind: "whole", tier: c });
    if (c === "risky" && src.broad) found.push({ kind: "broad", tier: "risky" });
    if (c === "risky" && src.tag) found.push({ kind: "tag", tier: "risky" });
  });
  if (found.some((f) => f.kind === "whole" && f.tier === "risky")) return n.nicPublic === true ? "risk" : "caution";
  if (found.length > 0) return "caution";
  return unrec ? "unknown" : "clear";
}
const nsgRule: fc.Arbitrary<NsgRule> = fc.record({
  direction: anomaly(fc.constantFrom("Inbound", "Inbound", "Outbound"), fc.constantFrom("zzz", "Inbound ", "")),
  access: anomaly(fc.constantFrom("Allow", "Allow", "Deny"), fc.constantFrom("Allowed", "")),
  priority: fc.integer({ min: 100, max: 4096 }),
  protocol: anomaly(fc.constantFrom("Tcp", "Udp", "*", "Icmp"), fc.constantFrom("zzz", "TCP ")),
  src: anomaly(
    fc.constantFrom<[string[], number]>([["*"], 0], [["Internet"], 0], [["10.0.0.0/8"], 0], [["203.0.113.0/24"], 0], [["VirtualNetwork"], 0], [["AzureCloud"], 0], [["0.0.0.0/1", "128.0.0.0/1"], 0], [["Storage.KoreaCentral"], 0], [["1.0.0.0/8"], 0], [[], 1], [["GatewayManager"], 0], [["203.0.113.5"], 0]),
    fc.constantFrom<[string[], number]>([["zzz!"], 0], [[""], 0], [[], 0], [[" Internet "], 0], [["AzureLoadBalancer"], 0], [["2000::/3"], 0], [["0.0.0.0/1", "128.0.0.0/2"], 0]),
  ),
  ports: anomaly(fc.constantFrom(["22"], ["3389"], ["443"], ["80"], ["1000-2000"], ["*"], ["25"], ["443", "8443"], ["65200-65535"]), fc.constantFrom([""], ["zzz"], ["70000"], [], ["22", ""])),
}).map(({ src, ...r }) => ({ ...r, sources: src[0], asg: src[1] }));
export const azNetWorld: fc.Arbitrary<Nsg[]> = fc.array(fc.record({ rules: fc.array(nsgRule, { maxLength: 3 }), nicPublic: fc.constantFrom<boolean | null>(null, true, false) }), { minLength: 1, maxLength: 3 })
  .map((ns) => ns.map((n, i) => ({ name: `nsg-qa-${i}`, ...n })));
/** 회사 A(Azure)의 구독 b1 NSG · NIC · 공인 IP를 세계로 바꾼다 */
export function azNetJson(nsgs: readonly Nsg[]): Json {
  const f = companyJson("azure", "A");
  const SUB = "00000000-0000-0000-0000-0000000000b1";
  const base = `/subscriptions/${SUB}/resourceGroups/rg-qa/providers/Microsoft.Network`;
  const per = (sec: string): Json => (f.data[sec] as Json[]).find((p) => p.subscription === SUB);
  const nsgPer = per("nsgs"), nicPer = per("nics"), pipPer = per("publicIps");
  nsgPer.items = nsgs.map((n, i) => ({
    id: `${base}/networkSecurityGroups/${n.name}`, name: n.name, location: "koreacentral",
    rules: n.rules.map((r, k) => ({ name: `rule-${i}-${k}`, direction: r.direction, access: r.access, priority: r.priority, protocol: r.protocol, sourcePrefixes: r.sources, sourceAsgCount: r.asg, destPortRanges: r.ports })),
    nicIds: n.nicPublic === null ? [] : [`${base}/networkInterfaces/nic-qa-${i}`], subnetIds: [],
  }));
  nicPer.items = nsgs.flatMap((n, i) => (n.nicPublic === null ? [] : [{ id: `${base}/networkInterfaces/nic-qa-${i}`, nsgId: `${base}/networkSecurityGroups/${n.name}`, ipConfigs: [{ subnetId: null, publicIpId: n.nicPublic ? `${base}/publicIPAddresses/pip-qa-${i}` : null }] }]));
  pipPer.items = nsgs.flatMap((n, i) => (n.nicPublic === true ? [{ id: `${base}/publicIPAddresses/pip-qa-${i}`, hasAddress: true, allocationMethod: "Static", attachedTo: `${base}/networkInterfaces/nic-qa-${i}` }] : []));
  for (const p of [nsgPer, nicPer, pipPer]) setCount(f, p.receipt, p.items.length);
  return f;
}

/* ═════════ AZ-STO-2 ═════════ */
export interface Ctn { name: string; access: string | null }
export interface Acct { allow: boolean | null; containers: Ctn[] }
/** 참조: 컨테이너 하나의 상태(명세 §6-2 AZ-STO-2 + P3) */
export function refAzSto2(c: Ctn, a: Acct): St {
  if (c.name === "$web") return "caution";
  if (c.access === null) return "unknown";
  const v = c.access;
  if (v === "None" || v.toLowerCase() === "none" && v === v.trim()) return "clear";
  if (!["blob", "container"].includes(v.toLowerCase()) || v !== v.trim()) return "unknown";
  return a.allow === false ? "clear" : "risk";
}
export const azStoWorld: fc.Arbitrary<Acct[]> = fc.array(fc.record({
  allow: fc.constantFrom<boolean | null>(true, false, null),
  containers: fc.array(fc.record({ name: fc.constantFrom("data", "logs", "$web", "assets", "backup"), access: anomaly(fc.constantFrom<string | null>("None", "Blob", "Container"), fc.constantFrom<string | null>("none ", "Private", "", null, "BLOB")) }), { maxLength: 3 }),
}), { minLength: 1, maxLength: 3 }).map((as) => as.map((a) => ({ ...a, containers: a.containers.filter((c, i, xs) => xs.findIndex((y) => y.name === c.name) === i) })));
/** 회사 A(Azure)의 구독 b1 스토리지 계정을 세계로 바꾼다(계정별 컨테이너 · 진단 설정 영수증) */
export function azStoJson(accts: readonly Acct[]): Json {
  const f = companyJson("azure", "A");
  const SUB = "00000000-0000-0000-0000-0000000000b1";
  const per = (f.data.storageAccounts as Json[]).find((p) => p.subscription === SUB);
  const proto = clone((per.items as Json[])[0]);
  const old = new Set((per.items as Json[]).flatMap((a) => [a.containers.receipt, a.blobDiagnostics.receipt]));
  f.receipts = (f.receipts as Json[]).filter((r) => !old.has(r.id));
  let n = 9000;
  const rc = (call: string, resource: string, count: number): string => {
    const id = `r-${n++}`;
    (f.receipts as Json[]).push({ id, call, subscription: SUB, resource, result: count === 0 ? "empty" : "ok", count, errorCode: null, at: "2026-10-19T03:14:00Z" });
    return id;
  };
  per.items = accts.map((a, i) => {
    const id = `/subscriptions/${SUB}/resourceGroups/rg-qa/providers/Microsoft.Storage/storageAccounts/stqa${i}`;
    return { ...clone(proto), id, name: `stqa${i}`, allowBlobPublicAccess: a.allow, containers: { receipt: rc("azure:storage.container-rm.list", id, a.containers.length), value: a.containers.map((c) => ({ name: c.name, publicAccess: c.access })) }, blobDiagnostics: { receipt: rc("azure:monitor.diagnostic-settings.list", id, 1), value: proto.blobDiagnostics.value } };
  });
  per.budget = { limit: 100, total: accts.length, collected: accts.length };
  setCount(f, per.receipt, accts.length);
  return f;
}
