// src/lib/cloudcheck/parse/mask.test.ts — maskedCopy: 결정성 · 원본 식별자 0 · 관계 보존 · 구조 불변 (R-13)
import { describe, expect, it } from "vitest";
import type { NormalizedInput } from "../contract/normalized";
import { BROAD_IPV4_PREFIX, BROAD_IPV6_PREFIX, RESERVED_IPV4_RANGES } from "../rules/params";
import { parseV4 } from "../rules/sources";
import { MASK_KEEPS_IPV4_MAX_PREFIX, MASK_KEEPS_IPV6_MAX_PREFIX, maskedCopy } from "./mask";
import { buildInput } from "./normalize";
import { EXTERNAL, REPORT_HEADER, SELF, SUB, SUB2, TENANT, awsFile, azureFile, rec, recCsv } from "./testdata";
import type { Json } from "./testdata";

const built = (file: Json, name?: string): NormalizedInput => {
  const b = buildInput([rec(file, name ? { name } : {})]);
  if (!b.ok) throw new Error("buildInput 실패");
  return b.input;
};
const richAws = (mut?: (f: Json) => void): NormalizedInput => built(awsFile({ mutate: (f) => {
  // 사설·예약 주소와 공인 주소를 한 규칙에 섞는다
  f.data.securityGroups[0].items[0].ingress[0].cidrs = ["0.0.0.0/0", "198.51.100.23/32", "10.1.2.0/24", "172.20.0.0/16", "192.168.1.1/32", "203.0.113.77/32"];
  f.data.securityGroups[0].items[0].ingress[0].ipv6Cidrs = ["::/0", "2001:db8:1::/48"];
  mut?.(f);
} }).file);
const text = (i: NormalizedInput): string => maskedCopy(i);
const parsed = (i: NormalizedInput): Json => JSON.parse(maskedCopy(i)) as Json;

/** 마스킹 전의 같은 모양(maskedCopy가 훑는 대상) */
const plainOf = (i: NormalizedInput): Json => {
  const j = JSON.parse(JSON.stringify({ inputs: i.inputs, identity: i.identity, doors: i.doors, coverage: i.coverage, receipts: [...i.receipts.values()] })) as Json;
  for (const c of Object.values(j.coverage as Record<string, Json>)) delete c.memberKeys;      // 구성원 신원 색인은 가명 사본에 싣지 않는다(아래 시험)
  return j;
};

/** 두 JSON을 나란히 걸으며 문자열이 아닌 값(숫자·불리언·null)·배열 길이·키 집합이 같은지 확인하고 어긋난 경로를 모은다 */
function structuralDiff(a: unknown, b: unknown, path: string, out: string[]): void {
  if (typeof a === "string" && typeof b === "string") return;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) { out.push(`${path}: 길이 ${a.length} → ${b.length}`); return; }
    a.forEach((x, i) => structuralDiff(x, b[i], `${path}[${i}]`, out));
    return;
  }
  if (a !== null && b !== null && typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) {
    const ka = Object.keys(a as object).sort().join(","), kb = Object.keys(b as object).sort().join(",");
    if (ka !== kb) { out.push(`${path}: 키 ${ka} → ${kb}`); return; }
    for (const k of Object.keys(a as object)) structuralDiff((a as Json)[k], (b as Json)[k], `${path}.${k}`, out);
    return;
  }
  if (a !== b) out.push(`${path}: ${JSON.stringify(a)} → ${JSON.stringify(b)}`);
}
/** 값이 그대로여야 하는 열거형 문자열 키 */
const KEEP_KEYS = new Set(["k", "why", "state", "result", "call", "iso", "kind", "cloud", "source", "direction", "access", "protocol", "permission", "grantee", "effect", "status", "interfaceType", "objectOwnership", "readWriteType"]);
function keptStrings(a: unknown, b: unknown, path: string, out: string[]): void {
  if (Array.isArray(a) && Array.isArray(b)) { a.forEach((x, i) => keptStrings(x, b[i], `${path}[${i}]`, out)); return; }
  if (a !== null && b !== null && typeof a === "object" && typeof b === "object") {
    for (const k of Object.keys(a as object)) {
      const x = (a as Json)[k], y = (b as Json)[k];
      if (typeof x === "string" && KEEP_KEYS.has(k) && x !== y) out.push(`${path}.${k}: ${x} → ${y}`);
      else keptStrings(x, y, `${path}.${k}`, out);
    }
  }
}

const AWS_ORIGINALS = [
  SELF, EXTERNAL, "jane.doe", "ci-deployer", "platform-admins", "vendor-access", "acme-public-assets", "acme-prod-data", "acme-org-trail", "bastion-ssh", "SecurityAuditRole", "acme-prod",
  "198.51.100.23", "203.0.113.77", "sg-0a1b2c3d4e5f60718", "sg-0f0e0d0c0b0a09080", "vpc-0123456789abcdef0", "pl-0123456789abcdef0", "eni-0aaaabbbbccccdddd", "AWSServiceRoleForSupport", "MPLE", "cloudcheck-result.json",
];
const AZURE_ORIGINALS = [
  TENANT, SUB, SUB2, "stwebfiles01", "rg-web", "nsg-web", "nic-web1", "pip-web", "운영 구독", "보관 구독", "activity-to-law", "allow-rdp", "cloudcheck-result.json",
];

describe("결정성", () => {
  it("같은 입력은 같은 글자를 낸다", () => {
    expect(text(richAws())).toBe(text(richAws()));
    expect(text(built(azureFile().file))).toBe(text(built(azureFile().file)));
  });
  it("유효한 JSON이고 끝에 줄바꿈이 있으며 첫 키가 schema", () => {
    const t = text(richAws());
    expect(t.endsWith("\n")).toBe(true);
    const j = JSON.parse(t) as Json;
    expect(Object.keys(j)[0]).toBe("schema");
    expect(j.schema).toBe("cloudcheck.masked/1");
    expect(typeof j.note).toBe("string");
    expect(j.model).toBe("cloudcheck.normalized/1");
  });
  it("같은 사실이면 목록 순서가 달라도 같은 이름은 같은 가명을 받는다(두 번 훑어 순번을 정렬로 매긴다)", () => {
    const swap = (f: Json): void => {
      f.data.iamUsers.items.reverse();
      f.data.iamGroups.reverse();
      f.data.iamRoles.value.reverse();
      f.data.buckets.items.reverse();
    };
    const name = (j: Json, by: (u: Json) => boolean): string => (j.doors.mfa.data.users.value as Json[]).find(by)?.name as string;
    const a = parsed(richAws());
    const b = parsed(richAws(swap));
    const isJane = (u: Json): boolean => u.passwordLastUsed.value !== null;
    expect(name(a, isJane)).toBe(name(b, isJane));
    expect(name(a, (u) => !isJane(u))).toBe(name(b, (u) => !isJane(u)));
    const bucketNames = (j: Json): string[] => (j.doors.sto.data.buckets.value as Json[]).map((x) => x.name as string).sort();
    expect(bucketNames(a)).toEqual(bucketNames(b));
  });
});

describe("원본 식별자는 하나도 남지 않는다", () => {
  it("AWS: 계정 · 이름 · 주소 · ID · 파일 이름", () => {
    const t = text(richAws());
    for (const original of AWS_ORIGINALS) expect(t, original).not.toContain(original);
  });
  it("Azure: 테넌트 · 구독 · 리소스 · 이름 · 파일 이름", () => {
    const t = text(built(azureFile().file));
    for (const original of AZURE_ORIGINALS) expect(t, original).not.toContain(original);
    expect(t.toLowerCase()).not.toContain(SUB.toLowerCase());
    expect(t).not.toContain(`subscriptions/${SUB}`);
  });
  it("체험 입력도 같은 길이", () => {
    const b = buildInput([rec(awsFile().file, { via: "demo", name: "cloudcheck-demo-B.aws.json" })]);
    if (!b.ok) throw new Error("buildInput 실패");
    const t = text(b.input);
    for (const original of AWS_ORIGINALS.filter((x) => x !== "cloudcheck-result.json")) expect(t, original).not.toContain(original);
  });
  it("비밀 모양으로 지운 값(토큰)도 다시 나오지 않는다", () => {
    const i = richAws((f) => { f.data.iamGroups[0].groupName = "AKIAIOSFODNN7EXAMPLE"; f.data.iamUsers.items[0].groupNames.value = ["AKIAIOSFODNN7EXAMPLE"]; });
    const t = text(i);
    expect(t).not.toContain("AKIAIOSFODNN7EXAMPLE");
    expect(t).not.toContain("cc-redacted");
  });
});

describe("관계 보존 — 판정 재현에 필요한 것", () => {
  it("자기 계정은 111122223333, 외부 계정은 444455556666 · 777788889999 … (신뢰 정책의 외부 주체와 정책 ARN 안에서도)", () => {
    const j = parsed(richAws((f) => {
      f.data.iamRoles.value[1].trust[0].principal.aws.push("arn:aws:iam::777000000001:role/other-vendor", `arn:aws:iam::${SELF}:root`);
    }));
    expect(j.identity.accountId).toBe("111122223333");
    const roles = j.doors.key.data.roles.value as Json[];
    const vendor = roles.find((r) => (r.trust.value as Json[]).some((s) => (s.principal.aws as string[]).some((a) => a.includes("444455556666"))));
    expect(vendor).toBeDefined();
    const aws = (vendor?.trust.value as Json[])[0].principal.aws as string[];
    expect(aws[0]).toBe("arn:aws:iam::444455556666:root");                       // 이름순으로 첫 외부 계정
    expect(aws[1]).toMatch(/^arn:aws:iam::777788889999:role\/role-\d{3}$/);       // 두 번째 외부 계정
    expect(aws[2]).toBe("arn:aws:iam::111122223333:root");                        // 자기 계정과의 관계 보존
    expect(j.inputs[0].runKey).toContain("111122223333");
  });
  it("0.0.0.0/0 · ::/0 · 사설·예약 주소는 그대로, 공인 주소는 문서용 주소로 접두 길이를 지키며 바뀐다", () => {
    const j = parsed(richAws());
    const rule = j.doors.net.data.securityGroups[0].items.value[0].ingress[0] as Json;
    const cidrs = rule.cidrs as string[];
    expect(cidrs.slice(0, 1)).toEqual(["0.0.0.0/0"]);
    expect(cidrs).toContain("10.1.2.0/24");
    expect(cidrs).toContain("172.20.0.0/16");
    expect(cidrs).toContain("192.168.1.1/32");
    const publics = cidrs.filter((c) => !["0.0.0.0/0", "10.1.2.0/24", "172.20.0.0/16", "192.168.1.1/32"].includes(c));
    expect(publics).toHaveLength(2);
    for (const p of publics) expect(p).toMatch(/^(203\.0\.113|198\.51\.100|192\.0\.2)\.\d{1,3}\/32$/);
    expect(new Set(publics).size).toBe(2);
    expect(rule.ipv6Cidrs).toEqual(["::/0", "2001:db8:1::/48"]);
  });
  it("같은 원문은 어디에 나와도 같은 가명 — 영수증 resource · 항목 이름 · 조인 키", () => {
    const j = parsed(richAws());
    const buckets = j.doors.sto.data.buckets.value as Json[];
    const names = buckets.map((b) => b.name as string);
    expect(new Set(names).size).toBe(2);
    const aclResources = (j.receipts as Json[]).filter((r) => r.call === "s3:GetBucketAcl").map((r) => r.resource as string);
    expect(aclResources.sort()).toEqual([...names].sort());
    const sgId = j.doors.net.data.securityGroups[0].items.value[0].id as string;
    expect(j.doors.net.data.networkInterfaces[0].items.value[0].groupIds).toEqual([sgId]);
    expect(sgId).toMatch(/^sg-[0-9a-f]{16}$/);
  });
  it("이름 힌트 키워드(public · static · assets · cdn)는 가명에 남는다", () => {
    const j = parsed(richAws((f) => { f.data.buckets.items[1].name = "corp-cdn-bucket"; f.data.buckets.items[1].acl.value.publicGrants = []; f.receipts.forEach((r: Json) => { if (r.resource === "acme-prod-data") r.resource = "corp-cdn-bucket"; }); }));
    const names = (j.doors.sto.data.buckets.value as Json[]).map((b) => b.name as string);
    expect(names.some((n) => /^bucket-\d{3}-public$/.test(n))).toBe(true);
    expect(names.some((n) => /^bucket-\d{3}-cdn$/.test(n))).toBe(true);
  });
  it("AWS 소유 정책 ARN · 서비스 주체 · 서비스 연결 역할 경로는 그대로", () => {
    const j = parsed(richAws());
    const users = j.doors.key.data.users.value as Json[];
    const policies = users.flatMap((u) => (u.attachedPolicyArns.value ?? []) as string[]);
    expect(policies).toContain("arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess");
    const groups = j.doors.key.data.groups as Json[];
    expect(groups[0].attachedPolicyArns.value).toEqual(["arn:aws:iam::aws:policy/AdministratorAccess"]);
    const roles = j.doors.key.data.roles.value as Json[];
    const svc = roles.find((r) => (r.trust.value as Json[])[0].principal.service.includes("support.amazonaws.com")) as Json;
    expect(svc.path).toBe("/aws-service-role/support.amazonaws.com/");
  });
  it("일반 역할 경로는 가명으로, 루트 경로(/)는 그대로", () => {
    const j = parsed(richAws((f) => { f.data.iamRoles.value[1].path = "/team-secret-platform/"; }));
    const roles = j.doors.key.data.roles.value as Json[];
    const paths = roles.map((r) => r.path as string);
    expect(paths.join("|")).not.toContain("team-secret-platform");
    expect(paths.some((p) => /^\/path-\d{3}\/$/.test(p))).toBe(true);
  });
  it("키 ID는 끝 4자리도 가명(K001 …) — 끝 4자리가 이름에서 유추되지 않게", () => {
    const j = parsed(richAws());
    const bot = (j.doors.key.data.users.value as Json[]).find((u) => u.keys.k === "value" && (u.keys.value as Json[]).length > 0) as Json;
    expect((bot.keys.value as Json[])[0].idSuffix).toMatch(/^K\d{3}$/);
  });
  it("Azure: GUID는 0으로 채운 표본형, 리소스 ID 안의 구독·리소스 그룹·이름도 같은 가명으로 일관된다", () => {
    const j = parsed(built(azureFile().file));
    expect(j.identity.tenantId).toMatch(/^00000000-0000-0000-0000-[0-9a-f]{12}$/);
    const subs = (j.doors.key.data.subscriptions.value as Json[]).map((s) => s.id as string);
    for (const s of subs) expect(s).toMatch(/^00000000-0000-0000-0000-[0-9a-f]{12}$/);
    expect(new Set([...subs, j.identity.tenantId]).size).toBe(3);
    const acct = (j.doors.sto.data.storageAccounts[0].items.value as Json[])[0];
    expect(acct.id).toMatch(/^\/subscriptions\/00000000-0000-0000-0000-[0-9a-f]{12}\/resourcegroups\/rg-\d{3}\/providers\/microsoft\.storage\/storageaccounts\/stacct\d{3}/);
    expect(acct.name).toMatch(/^stacct\d{3}/);
    const nsg = (j.doors.net.data.nsgs[0].items.value as Json[])[0];
    const nic = (j.doors.net.data.nics[0].items.value as Json[])[0];
    expect(nsg.nicIds.value).toEqual([nic.id]);                 // NSG가 가리키는 NIC = NIC 자신의 ID
    expect(nic.nsgId).toBe(nsg.id);
    const pip = (j.doors.net.data.publicIps[0].items.value as Json[])[0];
    expect(nic.ipConfigs[0].publicIpId).toBe(pip.id);
    expect(j.doors.key.data.subscriptions.value[0].tenantId).toBe(j.identity.tenantId);
    expect(j.doors.sto.data.subscriptions.value[0].id).toBe(acct.subscription);
  });
  it("Azure: $web 컨테이너와 힌트 키워드는 남는다", () => {
    const j = parsed(built(azureFile({ mutate: (f) => {
      f.data.storageAccounts[0].items[0].containers.value = [{ name: "$web", publicAccess: "Container" }, { name: "static-assets", publicAccess: "Blob" }, { name: "private-data", publicAccess: null }];
      f.receipts.find((r: Json) => r.call === "azure:storage.container-rm.list").count = 3;
    } }).file));
    const names = ((j.doors.sto.data.storageAccounts[0].items.value as Json[])[0].containers.value as Json[]).map((c) => c.name as string);
    expect(names).toContain("$web");
    expect(names.some((n) => /^container-\d{3}-static$/.test(n))).toBe(true);
    expect(names.some((n) => /^container-\d{3}$/.test(n))).toBe(true);
  });
});

describe("구조 · 개수 · 시각 · 영수증 위치는 그대로", () => {
  for (const [name, make] of [["AWS", () => richAws()], ["Azure", () => built(azureFile().file)]] as const) {
    it(`${name}: 문자열이 아닌 값·배열 길이·키 집합·열거형 문자열이 전부 같다`, () => {
      const i = make();
      const before = plainOf(i);
      const after = parsed(i);
      const after5 = { inputs: after.inputs, identity: after.identity, doors: after.doors, coverage: after.coverage, receipts: after.receipts };
      const diffs: string[] = [];
      structuralDiff(before, after5, "$", diffs);
      expect(diffs).toEqual([]);
      const kept: string[] = [];
      keptStrings(before, after5, "$", kept);
      expect(kept).toEqual([]);
    });
  }
  it("범위 표의 구성원 신원 색인(memberKeys)은 가명 사본에 싣지 않는다 — 원본 이름 목록이므로. 완결 여부·개수는 그대로", () => {
    const i = richAws();
    expect(Object.values(i.coverage).some((c) => c.memberKeys !== undefined && c.memberKeys.length > 0)).toBe(true);      // 입력에는 있다
    const j = parsed(i);
    for (const c of Object.values(j.coverage as Record<string, Json>)) expect("memberKeys" in c).toBe(false);
    expect(j.coverage["aws.mfa.users"]).toMatchObject({ complete: true, population: 2 });
  });
  it("notices · mode · 모델 이름은 그대로 옮긴다", () => {
    const i = richAws();
    const j = parsed(i);
    expect(j.notices).toEqual(JSON.parse(JSON.stringify(i.notices)));
    expect(j.mode).toEqual(i.mode);
    expect(j.cloud).toBe("aws");
  });
  it("마스킹은 입력을 바꾸지 않는다(깊게 freeze된 NormalizedInput에서도 던지지 않는다)", () => {
    const i = richAws();
    const before = JSON.stringify(plainOf(i));
    expect(() => maskedCopy(i)).not.toThrow();
    expect(JSON.stringify(plainOf(i))).toBe(before);
  });
  it("아주 큰 입력(사용자 3000명)은 한 줄 JSON으로 내서 크기를 줄인다 — 내용은 같은 규칙으로 가명화된다", () => {
    const header = REPORT_HEADER;
    const root = "<root_account>,arn:aws:iam::123456789012:root,2020-01-01T00:00:00+00:00,not_supported,2026-07-01T00:10:00+00:00,not_supported,not_supported,true,false,N/A,N/A,N/A,N/A,false,N/A,N/A,N/A,N/A,false,N/A,false,N/A";
    const rows = Array.from({ length: 3000 }, (_, k) => `emp.${k},arn:aws:iam::123456789012:user/emp.${k},2025-03-02T01:00:00+00:00,true,2026-10-18T09:00:00+00:00,2025-03-02T01:00:00+00:00,N/A,true,false,N/A,N/A,N/A,N/A,false,N/A,N/A,N/A,N/A,false,N/A,false,N/A`);
    const b = buildInput([recCsv([header, root, ...rows, ""].join("\n"), "big.csv", 1_792_300_000_000)]);
    if (!b.ok) throw new Error("buildInput 실패");
    const t = maskedCopy(b.input);
    expect(t.split("\n").length).toBe(2);                         // 한 줄 + 끝 줄바꿈
    expect(t.length).toBeLessThan(40_000_000);
    const j = JSON.parse(t) as Json;
    expect(j.doors.mfa.data.users.value.length).toBe(3000);
    expect(t.includes("emp.2999")).toBe(false);                    // 통째로 출력하지 않도록 불리언으로 비교한다
    expect(t.includes(SELF)).toBe(false);
  });
  it("다시 불러올 수 없는 파일이다 — recognize가 결과 파일로 받아들이지 않는다", () => {
    const b = buildInput([rec(parsed(richAws()))]);
    expect(b.ok).toBe(false);
  });
});

/* ───────── STEP 5 D-1b · D-3 · D-4: 판정 재료인 출발지는 가명 사본에도 남는다 ───────── */
describe("넓은 출발지 대역 · Azure 서비스 태그 보존", () => {
  const awsRule = (mut: (r: Json) => void): Json => {
    const j = parsed(built(awsFile({ mutate: (f) => mut(f.data.securityGroups[0].items[0].ingress[0]) }).file));
    return j.doors.net.data.securityGroups[0].items.value[0].ingress[0] as Json;
  };
  const azRules = (prefixes: string[]): string[] => {
    const j = parsed(built(azureFile({ mutate: (f) => { f.data.nsgs[0].items[0].rules[0].sourcePrefixes = prefixes; } }).file));
    return j.doors.net.data.nsgs[0].items.value[0].rules[0].value.sourcePrefixes as string[];
  };

  it("가명 사본이 지키는 접두 상한은 룰의 '넓은 공인 대역' 기준과 같다(어긋나면 판정 재료가 깨진다)", () => {
    expect(MASK_KEEPS_IPV4_MAX_PREFIX).toBe(BROAD_IPV4_PREFIX);
    expect(MASK_KEEPS_IPV6_MAX_PREFIX).toBe(BROAD_IPV6_PREFIX);
  });
  // 백엔드팀장 결정(STEP 6, DB설계자 질문): 룰의 RESERVED_IPV4_RANGES(넓은 대역 판정에서 뺄 범위 · 판정 파라미터)와 이 파일의 keepIpv4(회사를 식별하지 않아 그대로 둘 주소 · 개인정보 정책)는
  // 목적과 소유가 달라 한 상수로 묶지 않는다(룰 쪽 편집이 가명 사본의 노출 범위를 몰래 바꾸지 않게). 대신 지금 둘이 같은 9개라는 사실을 경계 주소로 못 박는다 —
  // 어느 한쪽을 바꾸면 이 시험이 깨지고, 고치는 사람이 다른 쪽을 같이 바꿀지(또는 이 시험을 이유와 함께 바꿀지) 정해야 한다.
  // 판정 정확성에는 서로 기대지 않는다: 접두 ≤ /8 값은 keepIpv4와 무관하게 그대로 남고(wideIpv4), 룰의 예약 대역 목록은 접두 ≤ /8 값에만 쓰인다.
  it("가명 사본이 그대로 두는 사설·예약 주소 = 룰의 사설·예약 대역(RESERVED_IPV4_RANGES) — 대역마다 첫·끝 주소와 바로 바깥 주소로 대조", () => {
    const toText = (n: number): string => `${Math.floor(n / 16_777_216) % 256}.${Math.floor(n / 65_536) % 256}.${Math.floor(n / 256) % 256}.${n % 256}`;
    const reserved = RESERVED_IPV4_RANGES.map((c) => { const r = parseV4(c, false); if (r === null) throw new Error(c); return r; });
    const inReserved = (n: number): boolean => reserved.some((r) => r.lo <= n && n <= r.hi);
    const probes = [...new Set(reserved.flatMap((r) => [r.lo - 1, r.lo, r.hi, r.hi + 1]).filter((n) => n >= 0 && n <= 2 ** 32 - 1))].sort((a, b) => a - b);
    expect(probes.length).toBeGreaterThanOrEqual(30);
    const cidrs = probes.map((n) => `${toText(n)}/32`);
    const masked = awsRule((r) => { r.cidrs = cidrs; }).cidrs as string[];
    expect(masked).toHaveLength(cidrs.length);
    const mismatch = cidrs.filter((c, i) => (masked[i] === c) !== inReserved(probes[i]));
    expect(mismatch).toEqual([]);
    expect(cidrs.filter((c, i) => masked[i] === c).length).toBeGreaterThan(0);      // 대조군: 둘 다 있다(그대로 둔 주소 · 바뀐 주소)
    expect(cidrs.filter((c, i) => masked[i] !== c).length).toBeGreaterThan(0);
  });
  it("IPv4: 접두 ≤ /8은 그대로(분할한 전체 · 넓은 공인 대역 · 사설), /9 이상의 공인 주소만 문서용 주소로 바뀐다", () => {
    const rule = awsRule((r) => { r.cidrs = ["0.0.0.0/1", "128.0.0.0/1", "0.0.0.0/2", "64.0.0.0/2", "128.0.0.0/2", "192.0.0.0/3", "52.0.0.0/8", "3.0.0.0/8", "10.0.0.0/8", "203.0.113.0/24", "198.51.100.23/32", "52.0.0.0/9"]; });
    const c = rule.cidrs as string[];
    expect(c.slice(0, 10)).toEqual(["0.0.0.0/1", "128.0.0.0/1", "0.0.0.0/2", "64.0.0.0/2", "128.0.0.0/2", "192.0.0.0/3", "52.0.0.0/8", "3.0.0.0/8", "10.0.0.0/8", expect.stringMatching(/^(203\.0\.113|198\.51\.100|192\.0\.2)\.\d{1,3}\/24$/)]);
    expect(c[10]).toMatch(/^(203\.0\.113|198\.51\.100|192\.0\.2)\.\d{1,3}\/32$/);
    expect(c[11]).toMatch(/^(203\.0\.113|198\.51\.100|192\.0\.2)\.\d{1,3}\/9$/);          // /9는 넓은 대역이 아니다 → 접두 길이만 지키며 바뀐다
    expect(c[11]).not.toBe("52.0.0.0/9");
  });
  it("IPv4: 호스트 비트가 켜진 넓은 값은 네트워크 주소로 맞춘다 — 원래 주소 조각이 새지 않는다", () => {
    const rule = awsRule((r) => { r.cidrs = ["52.95.110.1/8", "1.2.3.4/0", "200.201.202.203/3"]; });
    expect(rule.cidrs).toEqual(["52.0.0.0/8", "0.0.0.0/0", "192.0.0.0/3"]);
    const t = text(built(awsFile({ mutate: (f) => { f.data.securityGroups[0].items[0].ingress[0].cidrs = ["52.95.110.1/8", "1.2.3.4/0", "200.201.202.203/3"]; } }).file));
    for (const leak of ["52.95", "110.1", "1.2.3.4", "200.201", "202.203"]) expect(t.includes(leak), leak).toBe(false);
  });
  it("IPv6: 접두 ≤ /16은 그대로, /17 이상의 공인 주소만 바뀐다 · 호스트 비트는 지운다", () => {
    const rule = awsRule((r) => { r.ipv6Cidrs = ["2000::/3", "4000::/2", "8000::/1", "::/1", "2400::/12", "2a00:1450::/12", "2606:4700::/32", "2001:db8:1::/48", "fe80::/10"]; });
    const c = rule.ipv6Cidrs as string[];
    expect(c.slice(0, 5)).toEqual(["2000::/3", "4000::/2", "8000::/1", "::/1", "2400::/12"]);
    expect(c[5]).toBe("2a00::/12");                                              // 호스트 비트(1450)는 지운다
    expect(c[6]).toMatch(/^2001:db8::[0-9a-f]+\/32$/);                           // /32는 넓은 대역이 아니다 → 문서용 주소
    expect(c[7]).toBe("2001:db8:1::/48");                                        // 문서용 주소는 원래도 그대로
    expect(c[8]).toBe("fe80::/10");
    const t = text(built(awsFile({ mutate: (f) => { f.data.securityGroups[0].items[0].ingress[0].ipv6Cidrs = ["2a00:1450::/12", "2606:4700::/32"]; } }).file));
    expect(t.includes("1450")).toBe(false);
    expect(t.includes("2606:4700")).toBe(false);
  });
  it("넓은 값이 있어도 다른 값의 가명 순번은 흔들리지 않는다(넓은 값은 순번을 쓰지 않는다)", () => {
    const base = awsRule((r) => { r.cidrs = ["203.0.113.0/24", "198.51.100.0/24"]; }).cidrs as string[];
    const withWide = awsRule((r) => { r.cidrs = ["52.0.0.0/8", "203.0.113.0/24", "128.0.0.0/1", "198.51.100.0/24"]; }).cidrs as string[];
    expect([withWide[1], withWide[3]]).toEqual(base);
  });
  it("프리픽스 리스트 ID는 지금처럼 가명(pl-… 모양은 지킨다)", () => {
    const rule = awsRule((r) => { r.prefixListIds = ["pl-0123456789abcdef0"]; });
    expect(rule.prefixListIds).toHaveLength(1);
    expect((rule.prefixListIds as string[])[0]).toMatch(/^pl-[0-9a-f]{16}$/);
    expect((rule.prefixListIds as string[])[0]).not.toContain("0123456789abcdef");
  });
  it("Azure: 서비스 태그 이름은 그대로, *·Internet·VirtualNetwork·AzureLoadBalancer도 그대로, 넓은 대역은 그대로, 좁은 공인 주소만 바뀐다", () => {
    const out = azRules(["AzureCloud", "Storage.KoreaCentral", "GatewayManager", "AzureFrontDoor.Backend", "AzureCloud.KoreaCentral", "Internet", "VirtualNetwork", "AzureLoadBalancer", "*", "0.0.0.0/1", "128.0.0.0/1", "52.0.0.0/8", "2000::/3", "203.0.113.0/24", "198.51.100.77"]);
    expect(out.slice(0, 13)).toEqual(["AzureCloud", "Storage.KoreaCentral", "GatewayManager", "AzureFrontDoor.Backend", "AzureCloud.KoreaCentral", "Internet", "VirtualNetwork", "AzureLoadBalancer", "*", "0.0.0.0/1", "128.0.0.0/1", "52.0.0.0/8", "2000::/3"]);
    expect(out[13]).toMatch(/^(203\.0\.113|198\.51\.100|192\.0\.2)\.\d{1,3}\/24$/);
    expect(out[14]).toMatch(/^(203\.0\.113|198\.51\.100|192\.0\.2)\.\d{1,3}$/);
  });
  it("Azure 서비스 태그 보존은 sourcePrefixes에서만 — 이름 칸의 같은 글자는 여전히 가명이다", () => {
    const j = parsed(built(azureFile({ mutate: (f) => { f.data.nsgs[0].items[0].name = "AzureCloud"; f.data.nsgs[0].items[0].rules[0].name = "GatewayManager"; f.data.nsgs[0].items[0].rules[0].sourcePrefixes = ["AzureCloud"]; } }).file));
    const nsg = j.doors.net.data.nsgs[0].items.value[0] as Json;
    expect(nsg.name).not.toBe("AzureCloud");
    expect(nsg.rules[0].value.name).not.toBe("GatewayManager");
    expect(nsg.rules[0].value.sourcePrefixes).toEqual(["AzureCloud"]);
  });
  it("보존 규칙을 더해도 마스킹은 결정적이다 — 두 번 만들면 같은 글자", () => {
    const mk = (): string => text(built(awsFile({ mutate: (f) => { const r = f.data.securityGroups[0].items[0].ingress[0]; r.cidrs = ["128.0.0.0/1", "52.95.110.1/8", "203.0.113.5/32"]; r.ipv6Cidrs = ["2a00:1450::/12", "2606:4700::/32"]; } }).file));
    expect(mk()).toBe(mk());
  });
});
