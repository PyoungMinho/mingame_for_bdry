// src/lib/cloudcheck/parse/mask-rejudge.test.ts — 마스킹 사본을 다시 판정해도 원본과 같은 판정이 나온다 (STEP 5 D-1b · D-3 · D-4)
// 가명 사본은 결과 파일이 아니라 recognize가 받지 않지만, 정규화된 사실의 JSON이라 같은 모양의 NormalizedInput으로 되살려 judge에 다시 넣을 수 있다.
// 그렇게 되살린 사본의 판정(룰 상태 · 사유 · 대상 상태 · 분포 · 먼저 볼 3개)이 원본과 같아야 상담 공유·골든 파일 사본이 원본을 대표한다.
// 이름·ID가 가명이 되므로 MatchKey는 비교에서 뺀다. 출발지 합집합 · 넓은 대역 · 서비스 태그 · 프리픽스 리스트 변형이 이 시험의 핵심이다 —
// 가명 사본이 넓은 대역(IPv4 ≤ /8 · IPv6 ≤ /16)이나 태그를 바꿔 버리면 원본이 위험·주의인데 사본은 이상 없음이 되는 식으로 어긋난다.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sealCoverage } from "../contract/normalized";
import type { CoverageDraft, NormalizedInput, ReceiptFact, ReceiptKey } from "../contract/normalized";
import { judge } from "../engine/judge";
import type { Report } from "../model/report";
import { maskedCopy } from "./mask";
import { buildInput } from "./normalize";
import { recognize } from "./recognize";
import { enc } from "./testdata";
import type { Json } from "./testdata";

const COMPANIES = join(__dirname, "..", "fixtures", "companies");
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const companyJson = (cloud: "aws" | "azure", set: string): Json => JSON.parse(readFileSync(join(COMPANIES, `${cloud}-${set}.json`), "utf8"));
const NAME = { aws: "cloudcheck-aws-3333-20261019T031500Z.json", azure: "cloudcheck-azure-0001-20261019T031500Z.json" } as const;

function normalize(cloud: "aws" | "azure", file: Json): NormalizedInput {
  const rc = recognize({ via: "file", name: NAME[cloud], bytes: enc(file), lastModified: null });
  expect(rc.status).toBe("ok");
  const b = buildInput([rc]);
  if (!b.ok) throw new Error("buildInput 실패");
  return b.input;
}
/** 가명 사본 JSON → judge가 받는 NormalizedInput. 범위 표는 봉인 함수로 다시 봉인하고 영수증은 Map으로 되돌린다 */
function revive(text: string): NormalizedInput {
  const m = JSON.parse(text) as Json;
  const coverage = Object.fromEntries(Object.entries(m.coverage as Record<string, CoverageDraft>).map(([family, c]) => [family, sealCoverage(c)]));
  const receipts = new Map<ReceiptKey, ReceiptFact>((m.receipts as ReceiptFact[]).map((r) => [r.key, r]));
  const { schema: _schema, note: _note, ...rest } = m;
  void _schema; void _note;
  return { ...rest, coverage, receipts } as unknown as NormalizedInput;
}
/** 이름이 가명이 되어도 같아야 하는 판정만: 룰 상태 · 첫 사유 · 대상 상태+사유(정렬) · 분포 · 먼저 볼 3개 */
function view(r: Report): string {
  return JSON.stringify({
    rules: r.doors.flatMap((d) => d.rules).map((x) => [x.ruleId, x.status, x.why.code, x.items.map((i) => `${i.status}:${i.why.code}`).sort()]),
    distribution: r.distribution, firstLook: r.firstLook,
  });
}
const ruleView = (r: Report, id: string): string => JSON.stringify(r.doors.flatMap((d) => d.rules).filter((x) => x.ruleId === id).map((x) => [x.status, x.why.code, x.items.map((i) => `${i.status}:${i.why.code}`).sort()]));

function sameAfterMasking(cloud: "aws" | "azure", file: Json): { original: Report; masked: Report } {
  const input = normalize(cloud, file);
  const original = judge(input);
  const masked = judge(revive(maskedCopy(input)));
  expect(view(masked)).toBe(view(original));
  return { original, masked };
}

describe("마스킹 사본 재판정 ① 회사 8곳", () => {
  for (const cloud of ["aws", "azure"] as const) for (const set of ["A", "B", "C", "D"]) {
    it(`${cloud}-${set}: 원본 판정 = 마스킹 사본을 다시 판정한 결과`, () => {
      sameAfterMasking(cloud, companyJson(cloud, set));
    });
  }
});

describe("마스킹 사본 재판정 ② AWS 출발지 변형(AWS-NET-1) — bastion-ssh(22)의 출발지를 바꾼다", () => {
  const variant = (mut: (rule: Json) => void): Json => {
    const f = clone(companyJson("aws", "C"));
    mut(f.data.securityGroups[0].items[0].ingress[0]);
    return f;
  };
  const CASES: ReadonlyArray<readonly [string, (r: Json) => void]> = [
    ["이진 분할 전체(0.0.0.0/1 + 128.0.0.0/1)", (r) => { r.cidrs = ["0.0.0.0/1", "128.0.0.0/1"]; }],
    ["네 조각 분할 전체(/2 × 4)", (r) => { r.cidrs = ["0.0.0.0/2", "64.0.0.0/2", "128.0.0.0/2", "192.0.0.0/2"]; }],
    ["분할 전체 + 좁은 조각이 섞임", (r) => { r.cidrs = ["0.0.0.0/1", "128.0.0.0/1", "203.0.113.0/24"]; }],
    ["분할이 한 조각 모자람(전체 아님)", (r) => { r.cidrs = ["0.0.0.0/2", "64.0.0.0/2", "128.0.0.0/1"]; }],
    ["넓은 공인 대역 /8", (r) => { r.cidrs = ["52.0.0.0/8"]; }],
    ["넓은 공인 대역 /8 + 호스트 비트", (r) => { r.cidrs = ["203.0.113.77/8"]; }],
    ["넓은 공인 대역 /7", (r) => { r.cidrs = ["52.0.0.0/7"]; }],
    ["사설 /8(넓지만 사설)", (r) => { r.cidrs = ["10.0.0.0/8"]; }],
    ["좁은 공인 /24", (r) => { r.cidrs = ["203.0.113.0/24"]; }],
    ["좁은 공인 /9(넓은 대역 경계 밖)", (r) => { r.cidrs = ["198.51.100.0/9"]; }],
    ["앞뒤 공백이 낀 전체", (r) => { r.cidrs = [" 0.0.0.0/0 "]; }],
    ["IPv6 분할 전체(::/1 + 8000::/1)", (r) => { r.cidrs = []; r.ipv6Cidrs = ["::/1", "8000::/1"]; }],
    ["IPv6 넓은 공인 대역 2000::/3", (r) => { r.cidrs = []; r.ipv6Cidrs = ["2000::/3"]; }],
    ["IPv6 넓은 공인 대역 + 호스트 비트", (r) => { r.cidrs = []; r.ipv6Cidrs = ["2001:db8:1450::/12"]; }],
    ["IPv6 /32(좁음)", (r) => { r.cidrs = []; r.ipv6Cidrs = ["2001:db8::/32"]; }],
    ["프리픽스 리스트", (r) => { r.cidrs = []; r.prefixListIds = ["pl-0123456789abcdef0"]; }],
    ["프리픽스 리스트 + 좁은 주소", (r) => { r.cidrs = ["203.0.113.0/24"]; r.prefixListIds = ["pl-0123456789abcdef0"]; }],
  ];
  const views = new Set<string>();
  for (const [title, mut] of CASES) {
    it(`${title}: 원본 판정 = 마스킹 사본 재판정`, () => {
      const { original } = sameAfterMasking("aws", variant(mut));
      views.add(ruleView(original, "AWS-NET-1"));
    });
  }
  it("전제: 변형들이 AWS-NET-1에서 서로 다른 판정을 낸다(시험이 헛돌지 않는다)", () => {
    expect(views.size).toBeGreaterThanOrEqual(3);
  });
});

describe("마스킹 사본 재판정 ③ Azure 출발지 변형(AZ-NET-1) — nsg-acme-jump(공인 IP NIC에 연결)의 규칙을 출발지가 다른 허용 규칙 하나로 바꾼다", () => {
  const variant = (prefixes: string[], ports: string[] = ["3389"]): Json => {
    const f = clone(companyJson("azure", "C"));
    f.data.nsgs[0].items[0].rules = [{ name: "allow-variant", direction: "Inbound", access: "Allow", priority: 100, protocol: "Tcp", sourcePrefixes: prefixes, sourceAsgCount: 0, destPortRanges: ports }];
    return f;
  };
  const CASES: ReadonlyArray<readonly [string, string[], string[]?]> = [
    ["서비스 태그 AzureCloud", ["AzureCloud"]],
    ["서비스 태그 Storage.KoreaCentral", ["Storage.KoreaCentral"]],
    ["서비스 태그 GatewayManager(필수 규칙 포트 65200-65535)", ["GatewayManager"], ["65200-65535"]],
    ["서비스 태그 + 좁은 주소", ["AzureCloud", "203.0.113.0/24"]],
    ["VirtualNetwork(내부)", ["VirtualNetwork"]],
    ["AzureLoadBalancer(내부)", ["AzureLoadBalancer"]],
    ["이진 분할 전체", ["0.0.0.0/1", "128.0.0.0/1"]],
    ["넓은 공인 대역 /8", ["52.0.0.0/8"]],
    ["넓은 공인 대역 + 호스트 비트", ["203.0.113.77/8"]],
    ["IPv6 넓은 공인 대역", ["2000::/3"]],
    ["IPv6 분할 전체", ["::/1", "8000::/1"]],
    ["좁은 공인 /24", ["203.0.113.0/24"]],
    ["단일 공인 주소", ["203.0.113.9"]],
    ["Internet 태그(전체)", ["Internet"]],
  ];
  const views = new Set<string>();
  for (const [title, prefixes, ports] of CASES) {
    it(`${title}: 원본 판정 = 마스킹 사본 재판정`, () => {
      const { original } = sameAfterMasking("azure", variant(prefixes, ports));
      views.add(ruleView(original, "AZ-NET-1"));
    });
  }
  it("전제: 변형들이 AZ-NET-1에서 서로 다른 판정을 낸다(시험이 헛돌지 않는다)", () => {
    expect(views.size).toBeGreaterThanOrEqual(3);
  });
});
