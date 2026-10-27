// src/lib/cloudcheck/parse/mask.ts — 마스킹 사본 (R-13: 상담 공유·골든 파일 제작용 · 방향서 §5-3, 백엔드팀장 검토 §5-2)
// maskedCopy(input) = NormalizedInput을 결정적으로 가명화한 JSON 텍스트. 같은 입력이면 항상 같은 출력이다:
//   두 번 훑는다(1차: 값 모으기 → 정렬해서 순번 매기기 → 2차: 바꾸기). 그래서 순회 순서·입력 순서에 흔들리지 않는다.
// 보존하는 것(판정 재현에 필요): 자기 계정 ↔ 외부 계정의 관계, 0.0.0.0/0·::/0, 사설·예약 주소, 이름 힌트 키워드(public·static·assets·cdn)와 $web,
//   AWS 소유 정책 ARN·서비스 주체·서비스 연결 역할 경로, 리전·시각·상태·개수·영수증 구조(모든 Src 위치),
//   넓은 출발지 대역(IPv4 접두 ≤ /8 · IPv6 접두 ≤ /16 — 어느 회사의 것도 아닌 큰 덩어리라 식별하지 않는다. 호스트 비트가 켜진 값만 네트워크 주소로 맞춘다)과
//   Azure 서비스 태그 이름(AzureCloud·Storage.KoreaCentral·GatewayManager … Microsoft가 정한 공개 이름 — 어떤 모양 기반 치환에도 걸리지 않아 그대로 남는다. mask.test.ts가 지킨다) —
//   '넓은 공인 대역'·'규칙 안 출발지 합집합이 전체를 덮는가'·'서비스 태그' 판정의 재료다(STEP 5 D-1b·D-3·D-4).
// 바꾸는 것: 계정 ID(자기 계정 111122223333, 외부 444455556666 · 777788889999 …), 모든 이름(<유형>-<순번>), sg-·eni-·vpc-·subnet-·pl- ID(순번 16진수),
//   GUID(0으로 채운 표본형), 좁은 공인 IP·CIDR(TEST-NET, 접두 길이 보존), 파일 이름(file-<순번>), Azure 리소스 ID 안의 구독·리소스 그룹·리소스 이름, 키 ID 끝 4자리.
// 이 사본은 정규화된 사실(NormalizedInput)의 가명 사본이며 수집기 결과 파일 형식이 아니다(다시 불러와 점검하는 용도가 아님).
import type { NormalizedInput } from "../contract/normalized";

type Json = unknown;
type Kind =
  | "user" | "group" | "role" | "bucket" | "trail" | "sgname" | "stacct" | "nsg" | "nic" | "pip" | "vnet" | "subnet" | "rg" | "container" | "diag" | "rule" | "subname" | "file"
  | "alias" | "principal" | "upn" | "policy" | "path" | "res" | "idsuffix" | "sgid" | "eniid" | "vpcid" | "subnetid" | "plid" | "acct" | "guid" | "ipv4" | "ipv6";

const HINT_RE = /(public|static|assets|cdn)/i;
/** 그대로 두는 IAM 역할 경로: 루트, 서비스 연결 역할(/aws-service-role/<서비스>/), AWS 예약(/aws-reserved/…), 콘솔 마법사 경로(/service-role/) */
const KEEP_PATH_RE = /^(?:\/|\/aws-service-role\/[a-z0-9.-]+\/|\/aws-reserved\/[A-Za-z0-9._\/-]*|\/service-role\/)$/;
const PREFIX: Record<Kind, string> = {
  user: "user", group: "group", role: "role", bucket: "bucket", trail: "trail", sgname: "sgname", stacct: "stacct", nsg: "nsg", nic: "nic", pip: "pip", vnet: "vnet", subnet: "subnet",
  rg: "rg", container: "container", diag: "diag", rule: "rule", subname: "subscription", file: "file", alias: "alias", principal: "principal", upn: "upn", policy: "policy", path: "path",
  res: "resource", idsuffix: "K", sgid: "sg", eniid: "eni", vpcid: "vpc", subnetid: "subnet", plid: "pl", acct: "acct", guid: "guid", ipv4: "ip", ipv6: "ip",
};
/** Azure는 대소문자를 구분하지 않으므로 키를 소문자로 맞춘다(ID 안의 이름과 이름 필드가 같은 가명을 받게) */
const LOWER_KINDS: ReadonlySet<Kind> = new Set(["stacct", "nsg", "nic", "pip", "vnet", "subnet", "rg", "guid"]);
const hintSuffix = (orig: string): string => { const m = HINT_RE.exec(orig); return m ? `-${m[1].toLowerCase()}` : ""; };
const EXTERNAL_FIRST = ["444455556666", "777788889999"] as const;
const externalAccount = (n: number): string => (n >= 1 && n <= EXTERNAL_FIRST.length ? EXTERNAL_FIRST[n - 1] : String(1e11 + n));
const fakeIpv4 = (n: number): string => `${["203.0.113", "198.51.100", "192.0.2"][Math.floor((n - 1) / 254) % 3]}.${((n - 1) % 254) + 1}`;

class Pseudo {
  mode: "collect" | "apply" = "collect";
  selfAccount = "";
  private readonly sets = new Map<Kind, Set<string>>();
  private readonly maps = new Map<Kind, Map<string, string>>();
  constructor() { for (const k of Object.keys(PREFIX) as Kind[]) this.sets.set(k, new Set()); }

  freeze(): void {
    this.mode = "apply";
    for (const [kind, set] of this.sets) {
      const m = new Map<string, string>();
      const sorted = [...set].sort();
      if (kind === "acct") {
        let n = 0;
        for (const orig of sorted) m.set(orig, orig === this.selfAccount ? "111122223333" : externalAccount(++n));
      } else sorted.forEach((orig, i) => m.set(orig, this.alias(kind, orig, i + 1)));
      this.maps.set(kind, m);
    }
  }
  private alias(kind: Kind, orig: string, n: number): string {
    const num3 = String(n).padStart(3, "0");
    switch (kind) {
      case "guid": return `00000000-0000-0000-0000-${n.toString(16).padStart(12, "0")}`;
      case "sgid": case "eniid": case "vpcid": case "subnetid": case "plid": return `${PREFIX[kind]}-${n.toString(16).padStart(16, "0")}`;
      case "idsuffix": return `K${num3}`;
      case "ipv4": return fakeIpv4(n);
      case "ipv6": return `2001:db8::${n.toString(16)}`;
      case "stacct": return `stacct${num3}${hintSuffix(orig).replace("-", "")}`.slice(0, 24);
      case "container": return orig === "$web" ? "$web" : `container-${num3}${hintSuffix(orig)}`;
      case "upn": return `upn-${num3}@example.com`;
      case "path": return orig === "/" ? "/" : `/path-${num3}/`;
      default: return `${PREFIX[kind]}-${num3}${hintSuffix(orig)}`;
    }
  }
  /** 값을 가명으로. collect 단계에서는 모으기만 하고 원문을 돌려준다 */
  to(kind: Kind, s: string): string {
    const key = LOWER_KINDS.has(kind) ? s.toLowerCase() : s;
    if (this.mode === "collect") { this.sets.get(kind)?.add(key); return s; }
    return this.maps.get(kind)?.get(key) ?? s;
  }
}

/* ───────── 모양 기반 치환(문자열 안의 GUID · ARN · Azure 리소스 ID · sg-… ID · IP · 계정 번호) ───────── */
const GUID_RE = /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g;
const ARN_RE = /^arn:(aws[a-z-]*):([a-z0-9-]+):([a-z0-9-]*):(\d{12}|aws|):([\s\S]*)$/;
const AZID_RE = /^\/subscriptions\/([0-9a-fA-F-]{36})\/resourcegroups\/([^/]+)\/providers\/([^/]+)\/([\s\S]+)$/i;
const SGID_RE = /\b(sg|eni|vpc|subnet|pl)-[0-9a-f]{8,17}\b/g;
const IPV4_RE = /\b(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(\/\d{1,2})?(?![\d.])/g;
const IPV6_CAND = /[0-9a-fA-F:]{3,}(?:\/\d{1,3})?/g;
const ACCT_RE = /\b\d{12}\b/g;
/** 그대로 두는 사설·예약 주소(어느 회사의 것도 아니라 식별하지 않음). rules/params RESERVED_IPV4_RANGES와 같은 9개 대역이지만 목적이 달라 따로 둔다 — 같음은 mask.test.ts가 경계 주소로 대조한다(백엔드팀장 STEP 6) */
const keepIpv4 =(a: number, b: number): boolean => a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
const AZ_TYPE: Readonly<Record<string, Kind>> = { storageaccounts: "stacct", networksecuritygroups: "nsg", networkinterfaces: "nic", publicipaddresses: "pip", virtualnetworks: "vnet", subnets: "subnet" };
const isIpv6 = (m: string): boolean => { const addr = m.replace(/\/\d+$/, ""); return addr.includes("::") ? /^[0-9a-fA-F:]+$/.test(addr) && addr.length >= 3 : /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/.test(addr); };

/* ───────── 넓은 출발지 대역(그대로 둔다): IPv4 접두 ≤ /8 · IPv6 접두 ≤ /16 ───────── */
/** 가명 사본이 그대로 두는 넓은 출발지 대역의 접두 상한. 룰의 '넓은 공인 대역' 기준(rules/params BROAD_IPV4_PREFIX · BROAD_IPV6_PREFIX)과 같아야 한다 — mask.test.ts가 대조한다 */
export const MASK_KEEPS_IPV4_MAX_PREFIX = 8;
export const MASK_KEEPS_IPV6_MAX_PREFIX = 16;
/** IPv4 "a.b.c.d/n"(n ≤ 8)이면 호스트 비트를 지운 네트워크 형태를 돌려준다. 이미 그 모양이면 원문 그대로. 아니면 null */
function wideIpv4(m: string, octets: readonly string[], len: string | undefined): string | null {
  if (len === undefined) return null;
  const n = Number(len.slice(1));
  if (!(n >= 0 && n <= MASK_KEEPS_IPV4_MAX_PREFIX)) return null;
  const o = octets.map(Number);
  if (o.some((x) => x > 255)) return null;
  const first = o[0] & ((0xff << (8 - n)) & 0xff);
  const canonical = octets.every((x) => String(Number(x)) === x);
  if (canonical && first === o[0] && o[1] === 0 && o[2] === 0 && o[3] === 0) return m;
  return `${first}.0.0.0/${n}`;
}
/** "::"를 푼 여덟 개의 16비트 묶음. 모양이 틀리면 null */
function ipv6Groups(addr: string): number[] | null {
  const groups = (t: string): number[] | null => {
    if (t === "") return [];
    const parts = t.split(":");
    return parts.every((g) => /^[0-9a-fA-F]{1,4}$/.test(g)) ? parts.map((g) => parseInt(g, 16)) : null;
  };
  const halves = addr.split("::");
  if (halves.length > 2) return null;
  if (halves.length === 1) { const g = groups(halves[0]); return g !== null && g.length === 8 ? g : null; }
  const head = groups(halves[0]), tail = groups(halves[1]);
  if (head === null || tail === null) return null;
  const fill = 8 - head.length - tail.length;
  return fill >= 1 ? [...head, ...new Array<number>(fill).fill(0), ...tail] : null;
}
/** IPv6 "addr/n"(n ≤ 16)이면 호스트 비트를 지운 네트워크 형태를 돌려준다. 이미 그 모양이면 원문 그대로. 아니면 null */
function wideIpv6(m: string): string | null {
  const slash = m.lastIndexOf("/");
  if (slash < 0) return null;
  const n = Number(m.slice(slash + 1));
  if (!(n >= 0 && n <= MASK_KEEPS_IPV6_MAX_PREFIX)) return null;
  const g = ipv6Groups(m.slice(0, slash));
  if (g === null) return null;
  const first = g[0] & ((0xffff << (16 - n)) & 0xffff);
  if (first === g[0] && g.slice(1).every((x) => x === 0)) return m;
  return `${first === 0 ? "" : first.toString(16)}::/${n}`;
}

function maskArn(p: Pseudo, m: RegExpExecArray): string {
  const [, partition, service, region, account, resource] = m;
  const acct = account === "aws" || account === "" ? account : p.to("acct", account);
  let res = resource;
  const keep = /(^|\/)aws-service-role\//.test(res) || /^role\/AWSReservedSSO_/.test(res) || /\.amazonaws\.com$/.test(res) || res === "root" || res === "*";
  if (!keep) {
    const parts = res.split("/");
    if (parts.length === 1) res = p.to("res", res);
    else {
      const type = parts[0];
      const awsPolicy = account === "aws" && type === "policy";
      const kind: Kind = type === "user" || type === "mfa" ? "user" : type === "role" ? "role" : type === "group" ? "group" : type === "policy" ? "policy" : type === "trail" ? "trail" : "res";
      res = awsPolicy ? res : parts.map((seg, i) => (i === 0 ? seg : i === parts.length - 1 ? p.to(kind, seg) : seg)).join("/");
    }
  }
  return `arn:${partition}:${service}:${region}:${acct}:${res}`;
}

function maskShapes(p: Pseudo, s: string): string {
  const arn = ARN_RE.exec(s);
  if (arn) return maskArn(p, arn);
  const az = AZID_RE.exec(s);
  if (az) {
    const [, sub, rg, ns, rest] = az;
    const segs = rest.split("/");
    const mapped = segs.map((seg, i) => {
      if (i % 2 === 0) return seg;
      const kind = AZ_TYPE[segs[i - 1].toLowerCase()];
      return kind ? p.to(kind, seg) : seg.startsWith("$") ? seg : p.to("res", seg.toLowerCase());
    });
    return `/subscriptions/${p.to("guid", sub)}/resourcegroups/${p.to("rg", rg)}/providers/${ns}/${mapped.join("/")}`;
  }
  let out = s;
  out = out.replace(GUID_RE, (g) => p.to("guid", g));
  out = out.replace(SGID_RE, (m) => p.to(m.startsWith("sg-") ? "sgid" : m.startsWith("eni-") ? "eniid" : m.startsWith("vpc-") ? "vpcid" : m.startsWith("subnet-") ? "subnetid" : "plid", m));
  out = out.replace(IPV4_RE, (m, a: string, b: string, c: string, d: string, len: string | undefined) => {
    const wide = wideIpv4(m, [a, b, c, d], len);
    if (wide !== null) return wide;                                                  // 접두 ≤ /8: 넓은 대역은 그대로(호스트 비트만 지움)
    return m === "0.0.0.0" || keepIpv4(Number(a), Number(b)) ? m : `${p.to("ipv4", m.replace(/\/\d+$/, ""))}${len ?? ""}`;
  });
  out = out.replace(IPV6_CAND, (m) => {
    if (!isIpv6(m)) return m;
    const wide = wideIpv6(m);
    if (wide !== null) return wide;                                                  // 접두 ≤ /16: 넓은 대역은 그대로(호스트 비트만 지움)
    return /^(::|fe80:|f[cd]|2001:db8)/i.test(m) ? m : `${p.to("ipv6", m.replace(/\/\d+$/, ""))}${/\/\d+$/.exec(m)?.[0] ?? ""}`;
  });
  out = out.replace(ACCT_RE, (m) => (m === "000000000000" ? m : p.to("acct", m)));
  return out;
}

/* ───────── 필드 이름 기반 치환 ───────── */
const NAME_CONTAINERS = ["users", "groups", "roles", "buckets", "trails", "securityGroups", "storageAccounts", "nsgs", "containers", "blobDiagnostics", "activityLogExports", "rules", "subscriptions", "inputs"] as const;
const nearest = (anc: readonly string[], ...names: readonly string[]): string | null => { for (let i = anc.length - 1; i >= 0; i--) if (names.includes(anc[i])) return anc[i]; return null; };
const RESOURCE_KIND_BY_CALL: Readonly<Record<string, Kind>> = {
  "iam:ListAccessKeys": "user", "iam:ListMFADevices": "user", "iam:ListAttachedUserPolicies": "user", "iam:ListGroupsForUser": "user", "iam:ListAttachedGroupPolicies": "group",
  "s3:GetBucketLocation": "bucket", "s3:GetBucketPublicAccessBlock": "bucket", "s3:GetBucketPolicyStatus": "bucket", "s3:GetBucketAcl": "bucket", "s3:GetBucketOwnershipControls": "bucket", "s3:GetBucketWebsite": "bucket",
};
const CONTAINER_KIND: Readonly<Record<string, Kind>> = {
  users: "user", groups: "group", roles: "role", buckets: "bucket", trails: "trail", securityGroups: "sgname", storageAccounts: "stacct", nsgs: "nsg", containers: "container",
  blobDiagnostics: "diag", activityLogExports: "diag", rules: "rule", subscriptions: "subname",
};
const isSlot = (o: Record<string, Json>): boolean => typeof o.k === "string" && (o.k === "value" || o.k === "partial" || o.k === "none" || o.k === "missing");

function walk(p: Pseudo, node: Json, anc: readonly string[], key: string, parent: Record<string, Json> | null): Json {
  if (typeof node === "string") {
    if (parent !== null && key === "resource" && typeof parent.call === "string") { const k = RESOURCE_KIND_BY_CALL[parent.call]; return k ? p.to(k, node) : maskShapes(p, node); }
    if (parent !== null && key === "principalName" && anc.includes("identity")) return p.to(parent.principalType === "root" ? "principal" : String(parent.principalType).includes("role") ? "role" : "user", node);
    if (key === "alias") return p.to("alias", node);
    if (key === "accountId") return p.to("acct", node);
    if (key === "groupNames") return p.to("group", node);
    if (key === "idSuffix") return p.to("idsuffix", node);
    if (key === "user" && anc.includes("entraUsers")) return p.to("upn", node);
    if (key === "path" && anc.includes("roles")) return KEEP_PATH_RE.test(node) ? node : p.to("path", node);
    if (key === "name" && parent !== null) {
      const c = nearest(anc, ...NAME_CONTAINERS);
      if (c === "inputs") return parent.via === "file" ? p.to("file", node) : maskShapes(p, node);
      if (c !== null) return p.to(CONTAINER_KIND[c], node);
    }
    return maskShapes(p, node);
  }
  if (Array.isArray(node)) return node.map((x) => walk(p, x, anc.concat(key), key, parent));
  if (typeof node !== "object" || node === null) return node;
  const o = node as Record<string, Json>;
  if ("iso" in o && "ms" in o && Object.keys(o).length === 2) return o;                                   // 시각
  if ("input" in o && "receipt" in o && "csv" in o && Object.keys(o).length === 3) return o;            // 출처 위치(입력 번호·영수증 키·행 번호·열 이름)
  if (isSlot(o)) {                                                                                         // 슬롯은 자기 필드 이름으로 값을 읽는다(alias, groupNames …)
    const out: Record<string, Json> = { ...o };
    if ("value" in o) out.value = walk(p, o.value, anc, key, parent);
    return out;
  }
  const out: Record<string, Json> = {};
  for (const [k, v] of Object.entries(o)) out[k] = walk(p, v, anc.concat(key), k, o);
  return out;
}

/** 범위 표의 구성원 신원 색인(memberKeys)은 사실에서 파생한 원본 이름 목록이라 가명 사본에 싣지 않는다(개수·완결 여부는 그대로) */
function withoutMemberKeys(table: NormalizedInput["coverage"]): Json {
  const out: Record<string, Json> = {};
  for (const [family, c] of Object.entries(table)) {
    const { memberKeys: _omit, ...rest } = c as unknown as Record<string, Json>;
    void _omit;
    out[family] = rest;
  }
  return out;
}

export function maskedCopy(input: NormalizedInput): string {
  const p = new Pseudo();
  p.selfAccount = input.cloud === "aws" ? input.identity.accountId : "";
  const plain: Record<string, Json> = {
    schema: "cloudcheck.masked/1",
    note: "정규화된 사실의 가명 사본입니다. 이름·ID·주소는 가명으로 바뀌었고 구조·개수·시각은 그대로입니다. 결과 파일이 아니므로 다시 불러와 점검할 수 없습니다.",
    model: input.model, cloud: input.cloud, mode: input.mode, notices: input.notices,
    inputs: input.inputs, identity: input.identity, doors: input.doors, coverage: withoutMemberKeys(input.coverage),
    receipts: [...input.receipts.values()],
  };
  walk(p, plain, [], "", null);   // 1차: 값을 모은다
  p.freeze();
  const masked = walk(p, plain, [], "", null);   // 2차: 바꾼다
  // 사람이 읽는 들여쓰기 형식은 보통 크기에서만 쓴다: 사용자 수천 명짜리 입력은 들여쓰기만으로 몇 배 커져 브라우저 메모리를 쓴다 → 한 줄 JSON
  const compact = JSON.stringify(masked);
  return `${compact.length <= PRETTY_LIMIT ? JSON.stringify(masked, null, 2) : compact}\n`;
}
const PRETTY_LIMIT = 2_000_000;
