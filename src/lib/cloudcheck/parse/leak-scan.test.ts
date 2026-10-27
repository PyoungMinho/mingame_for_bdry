// src/lib/cloudcheck/parse/leak-scan.test.ts — 누출 스캔: 스캐너 자체 검사(린터의 린터) · 시나리오·픽스처 원문 · 마스킹 사본
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { awsCase } from "../collector/__scenarios__";
import { maskedCopy } from "./mask";
import { buildInput } from "./normalize";
import { scanForLeaks } from "./leak-scan";
import type { LeakFinding, LeakRule } from "./leak-scan";
import { SUB, SUB2, TENANT, awsFile, azureFile, rec } from "./testdata";
import type { Json } from "./testdata";

// 가짜 비밀 모양 값은 실행 중에 조각을 이어 붙여 만든다(공개 저장소 푸시 보호: 소스 바이트에 완성된 비밀 모양을 남기지 않는다). 값은 예전 리터럴과 글자 하나까지 같다.
// AWS 문서가 공개한 예시(AKIAIOSFODNN7EXAMPLE)는 예외로 그대로 둔다.
const j = (...parts: readonly string[]): string => parts.join("");
const rulesOf = (text: string): LeakRule[] => [...new Set(scanForLeaks(text).map((f) => f.rule))].sort();
const SAMPLE_STORAGE = ["stwebfiles01", "stlogsarchive02"];

describe("스캐너 자체 검사 — 진짜처럼 보이는 값은 모두 잡고, 문서 표본은 잡지 않는다", () => {
  const BAD: ReadonlyArray<readonly [LeakRule, string]> = [
    ["account-number", "account 210987654322"],
    ["account-number", '{"Account":"835712649320"}'],
    ["account-number", "arn:aws:iam::835712649320:root"],
    ["access-key-id", `key ${"AKIA"}${"ZZZZZZZZZZZZZZZZ"}`],
    ["access-key-id", `${"ASIA"}${"ZZZZZZZZZZZZZZZZ"}`],
    ["iam-id", `${"AIDA"}${"JQABLZS4A3QDU576Q"}`.slice(0, 20)],
    ["iam-id", `${"AROA"}${"JQABLZS4A3QDU5ZZ"}`],
    ["guid", "tenant 3f2504e0-4f89-11d3-9a0c-0305e82c3301"],
    ["guid", "00000001-0000-0000-0000-000000000001"],           // 앞이 0으로 채워지지 않은 값
    ["email", "mail kim@gmail.com"],
    ["email", "kim@corp.co.kr"],
    ["email", "kim@notexample.com"],
    ["public-ipv4", "ip 8.8.8.8"],
    ["public-ipv4", "52.94.76.1/24"],
    ["public-ipv4", "198.51.101.9"],          // TEST-NET-2 바로 옆 대역
    ["public-ipv4", "192.0.3.1"],
    ["public-ipv4", "172.32.0.1"],            // 사설 대역 밖
    ["public-ipv6", "2606:4700:4700::1111"],
    ["public-ipv6", "2a00:1450:4001:81b::200e/128"],
    ["public-ipv6", "2001:4860:4860:0:0:0:0:8888"],
    ["public-ipv4", "52.0.0.0/9"],            // 접두 /9는 넓은 대역이 아니다
    ["public-ipv4", "52.95.110.1/8"],         // 호스트 비트가 켜진 값은 네트워크가 아니라 호스트다
    ["public-ipv4", "128.0.0.1/1"],
    ["public-ipv4", "52.0.0.0"],              // 접두가 없으면 호스트 하나
    ["public-ipv6", "2000::/17"],
    ["public-ipv6", "2a00:1450::/12"],        // 호스트 비트가 켜져 있다
    ["public-ipv6", "2606:4700::/32"],
    ["storage-host", "https://mystorageacct.blob.core.windows.net/container"],
    ["storage-host", "https://prodlogs99.file.core.windows.net"],
    ["storage-host", "https://acme-prod-data.s3.amazonaws.com/object"],
    ["storage-host", "acme-prod-data.s3.ap-northeast-2.amazonaws.com"],
    ["storage-host", "s3://acme-secrets/backup.tar"],
    ["storage-host", "arn:aws:s3:::acme-prod-data/*"],
    ["jwt", j("Bearer ", "ey", "J", "hbGciOiJIUzI1NiJ9", ".", "ey", "J", "zdWIiOiIxMjM0NTY3ODkwIn0", ".", "dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk")],
    ["private-key", j("-----BEGIN ", "RSA ", "PRIVATE", " KEY", "-----")],
    ["private-key", "-----BEGIN CERTIFICATE-----"],
  ];
  for (const [rule, text] of BAD) it(`${rule}: ${text.slice(0, 50)}`, () => { expect(rulesOf(text)).toContain(rule); });

  const GOOD: readonly string[] = [
    "111122223333", "444455556666", "777788889999", "123456789012", "arn:aws:iam::123456789012:root", "arn:aws:iam::aws:policy/AdministratorAccess",
    "AKIAIOSFODNN7EXAMPLE", "AIDAEXAMPLEEXAMPLE01", "AROAEXAMPLEEXAMPLE0", "AGPAEXAMPLEEXAMPLE01",
    "00000000-0000-0000-0000-000000000001", "00000000-0000-0000-0000-0000000000aa",
    "kim@example.com", "x@contoso.com", "upn-001@example.com", "ops@mail.example.org", "a@b.test", "a@b.invalid",
    "0.0.0.0/0", "10.0.0.8", "172.16.5.1", "172.31.255.255", "192.168.0.1", "127.0.0.1", "169.254.169.254", "100.64.0.1", "203.0.113.9", "198.51.100.23/32", "192.0.2.1", "255.255.255.255", "224.0.0.1",
    "2.17.0.1.5", "version 1.2.3.4.5", "300.1.1.1", "999.999.999.999",
    "128.0.0.0/1", "0.0.0.0/1", "64.0.0.0/2", "192.0.0.0/3", "52.0.0.0/8", "52.0.0.0/7", "3.0.0.0/8",        // 넓은 네트워크 대역(IPv4 ≤ /8, 호스트 비트 0)
    "2000::/3", "8000::/1", "4000::/2", "2400::/12", "::/1", "2a00::/12",                                      // 넓은 네트워크 대역(IPv6 ≤ /16, 호스트 비트 0)
    "::/0", "::", "::1", "2001:db8::1", "2001:db8:1::/48", "fe80::1", "fd00::1234", "ff02::1", "arn:aws:s3:::amzn-s3-demo-logs", "s3://amzn-s3-demo-assets/index.html", "amzn-s3-demo-data.s3.amazonaws.com",
    "arn:aws:s3:::POISON-data-bucket/", "https://example-store.blob.core.windows.net/", "https://contosostore.blob.core.windows.net/",
    "2026-10-19T03:12:00Z", "03:12:00", "12:30", "arn:aws:iam::aws:policy/ReadOnlyAccess", "user@host", "key@ap-northeast-2", "s3api get-bucket-acl#amzn-s3-demo-logs@ap-northeast-2",
    "1792379520000", "c0ffee00c0ffee00c0ffee00c0ffee00c0ffee00c0ffee00c0ffee00c0ffee00",
  ];
  for (const text of GOOD) it(`허용: ${text.slice(0, 60)}`, () => { expect(scanForLeaks(text), text).toEqual([]); });

  it("GUID 끝 묶음(12자리 숫자처럼 보임)을 계정 번호로 오인하지 않는다", () => {
    expect(rulesOf("00000000-0000-0000-0000-000000000011")).toEqual([]);
    expect(rulesOf("3f2504e0-4f89-11d3-9a0c-030512345678")).toEqual(["guid"]);          // 진짜처럼 보이는 GUID는 guid 하나로만 센다
  });
  it("줄 번호와 일치한 글자를 돌려주고, 줄 번호 순서로 정렬한다", () => {
    const f = scanForLeaks("ok\nline two 8.8.8.8\n\nkim@gmail.com\n");
    expect(f.map((x: LeakFinding) => [x.line, x.rule, x.match])).toEqual([[2, "public-ipv4", "8.8.8.8"], [4, "email", "kim@gmail.com"]]);
  });
  it("옵션으로 표본을 더 허용할 수 있다(계정 번호 · 저장소 이름)", () => {
    expect(scanForLeaks("835712649320")).toHaveLength(1);
    expect(scanForLeaks("835712649320", { allowAccounts: ["835712649320"] })).toEqual([]);
    expect(scanForLeaks("https://stwebfiles01.blob.core.windows.net/")).toHaveLength(1);
    expect(scanForLeaks("https://stwebfiles01.blob.core.windows.net/", { allowStorageNames: ["StWebFiles01"] })).toEqual([]);
  });
  it("아주 큰 글에도 오래 걸리지 않는다(2MB)", () => {
    const big = `${"line with some text 2026-10-19T03:12:00Z 10.0.0.8 arn:aws:iam::111122223333:root\n".repeat(25_000)}`;
    const t0 = performance.now();
    expect(scanForLeaks(big)).toEqual([]);
    expect(performance.now() - t0).toBeLessThan(5000);
  });
});

/* ───────── 원문 스캔 ───────── */
const LIB = resolve(__dirname, "..");
function sourcesIn(dir: string, re = /\.(ts|tsx|json|sh)$/): Array<{ file: string; text: string }> {
  if (!existsSync(dir)) return [];
  return (readdirSync(dir, { recursive: true }) as string[])
    .map((f) => join(dir, f))
    .filter((f) => re.test(f) && statSync(f).isFile())
    .sort()
    .map((file) => ({ file, text: readFileSync(file, "utf8") }));
}
/** POISON 표식이 있는 줄은 '읽으면 안 되는 필드' 시험용 가짜 값이다 — 거기서는 토큰·키 모양만 허용한다 */
function unexpected(file: string, text: string): string[] {
  const lines = text.split("\n");
  return scanForLeaks(text, { allowStorageNames: SAMPLE_STORAGE })
    .filter((f) => !(/POISON/.test(lines[f.line - 1] ?? "") && (f.rule === "jwt" || f.rule === "private-key")))
    .map((f) => `${file.slice(LIB.length + 1)}:${f.line} [${f.rule}] ${f.match}`);
}

describe("시나리오 원문에 진짜 값이 섞이지 않았다", () => {
  const files = sourcesIn(join(LIB, "collector/__scenarios__"));
  it("시나리오 파일을 찾았다", () => { expect(files.length).toBeGreaterThanOrEqual(6); });
  it("계정은 표본 번호, 키는 AKIAIOSFODNN7EXAMPLE, GUID는 0으로 채운 값, 이메일은 example.com, 버킷은 amzn-s3-demo-…", () => {
    expect(files.flatMap((f) => unexpected(f.file, f.text))).toEqual([]);
  });
  it("POISON 줄의 토큰·키 모양 가짜 값은 실제로 있고(스캐너가 본다), 그것 말고는 없다", () => {
    // 가짜 PEM 머리글은 시나리오 원문에 완성된 모양으로 남아 있지 않고(실행 중 조립) 시나리오를 만들 때 생긴다 → 원문과 '조립된 독이 든 시나리오'를 함께 훑는다
    const all = [...files.map((f) => f.text), JSON.stringify(awsCase("aws-10-poison").scenario)].join("\n");
    const rules = new Set(scanForLeaks(all, { allowStorageNames: SAMPLE_STORAGE }).map((f) => f.rule));
    expect([...rules].sort()).toEqual(["jwt", "private-key"]);
  });
});

describe("수집기·계약·파서 소스에 진짜 값이 섞이지 않았다", () => {
  it("collector · contract · parse의 소스 파일에는 표본 밖 계정·주소·키가 없다(스캐너·비밀 패턴 정의 파일은 제외)", () => {
    const skip = new Set(["parse/leak-scan.ts", "parse/leak-scan.test.ts", "parse/secrets.ts", "parse/redaction-fuzz.test.ts", "parse/recognize.test.ts", "parse/foundation.test.ts", "parse/normalize.aws.test.ts", "parse/normalize.azure.test.ts", "parse/mask.test.ts", "parse/testdata.ts", "parse/secrets.test.ts", "parse/exceptions.test.ts", "contract/clean-text.test.ts"]);
    const files = ["collector", "contract", "parse"].flatMap((d) => sourcesIn(join(LIB, d), /\.(ts|sh|json)$/)).filter((f) => !f.file.includes("__scenarios__") && ![...skip].some((s) => f.file.endsWith(s)));
    expect(files.length).toBeGreaterThan(30);
    expect(files.flatMap((f) => unexpected(f.file, f.text))).toEqual([]);
  });
});

describe("룰(문구 포함) · 엔진 · 모델 원문에 진짜 값이 섞이지 않았다(백엔드팀장 STEP 4: 페이지 번들에 들어가는 lib 전부)", () => {
  it("rules · engine · model 소스에는 표본 밖 계정·주소·키·이메일이 없다", () => {
    const files = ["rules", "engine", "model"].flatMap((d) => sourcesIn(join(LIB, d), /\.(ts|json)$/));
    expect(files.length).toBeGreaterThan(40);
    expect(files.flatMap((f) => unexpected(f.file, f.text))).toEqual([]);
  });
});

describe("픽스처 원문(DB설계자)", () => {
  const files = sourcesIn(join(LIB, "fixtures"), /\.(ts|json)$/);
  it.skipIf(files.length === 0)("표본 밖 계정·주소·키·이메일이 없다", () => {
    expect(files.flatMap((f) => unexpected(f.file, f.text))).toEqual([]);
  });
});

/* ───────── 마스킹 사본 ───────── */
const built = (file: Json) => {
  const b = buildInput([rec(file)]);
  if (!b.ok) throw new Error("buildInput 실패");
  return b.input;
};
describe("마스킹 사본에는 진짜처럼 보이는 값이 없다", () => {
  const richAws = (): Json => awsFile({ mutate: (f) => {
    f.data.securityGroups[0].items[0].ingress[0].cidrs = ["0.0.0.0/0", "52.94.76.1/32", "10.1.2.0/24", "203.0.113.77/32"];
    f.data.securityGroups[0].items[0].ingress[0].ipv6Cidrs = ["::/0", "2606:4700:4700::1111/128"];
    f.data.iamRoles.value[1].trust[0].principal.aws.push("arn:aws:iam::835712649320:role/contractor");
  } }).file;
  /** GUID를 진짜처럼 보이는 값으로 바꾼 Azure 수집 파일(마스킹이 빠뜨리면 스캐너가 잡는다) */
  const realAzure = (): Json => {
    const swap: ReadonlyArray<readonly [string, string]> = [[TENANT, "3f2504e0-4f89-11d3-9a0c-0305e82c3301"], [SUB, "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"], [SUB2, "6ba7b810-9dad-11d1-80b4-00c04fd430c8"]];
    let text = JSON.stringify(azureFile().file);
    for (const [from, to] of swap) text = text.split(from).join(to);
    return JSON.parse(text) as Json;
  };
  const dump = (x: unknown): string => JSON.stringify(x, (_k, v) => (v instanceof Map ? [...v] : v));
  it("AWS", () => { expect(scanForLeaks(maskedCopy(built(richAws())))).toEqual([]); });
  it("Azure(진짜처럼 보이는 GUID를 넣어도)", () => { expect(scanForLeaks(maskedCopy(built(realAzure())))).toEqual([]); });
  it("대조군: 마스킹 전 정규화 결과에는 같은 스캐너가 진짜처럼 보이는 값을 찾는다", () => {
    const aws = scanForLeaks(dump(built(richAws()))).map((f) => f.rule);
    expect(aws).toContain("public-ipv4");
    expect(aws).toContain("account-number");
    expect(aws).toContain("public-ipv6");
    expect(scanForLeaks(dump(built(realAzure()))).map((f) => f.rule)).toContain("guid");
  });
});
