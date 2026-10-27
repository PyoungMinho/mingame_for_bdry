// QA — CC-QA-04 출발지 해석(기획팀장 결정 docs/planning/cloudcheck-qa-decisions.md §2 D-1 · D-3 · D-4, §9-2)을 셋으로 나눠 직접 시험한다.
//  A. AWS 합집합 = 인터넷 전체(D-1a, 베타 차단) — E-10 직접 시험 포함
//  B. AWS 넓은 공인 대역(D-1b) · 프리픽스 리스트(D-4) — G8 전
//  C. Azure 서비스 태그(D-3a) · ASG / VirtualNetwork / AzureLoadBalancer = 내부(D-3b) · 합집합 · Deny 빼기 · 출발지 없는 규칙 — Azure 공개 전
//  + 마스킹 재현(§9-6): 같은 입력의 마스킹 사본을 되살려 다시 판정해도 판정이 같다(넓은 대역 · 태그 이름 · 합집합이 사본에서 깨지지 않는다)
import { describe, expect, it } from "vitest";
import { sealCoverage } from "../contract/normalized";
import type { CoverageDraft, NormalizedInput, ReceiptFact, ReceiptKey } from "../contract/normalized";
import { judge } from "../engine/judge";
import type { Report } from "../model/report";
import { maskedCopy } from "../parse/mask";
import { companyJson, nameText, okReport, ruleOf, rulesOf, runJson } from "./kit";
import type { Json } from "./kit";
import { azNetJson } from "./oracle";
import type { NsgRule } from "./oracle";

/* ───────── AWS: 아슬아슬상회(C)의 bastion-ssh(sg-0c0ffee1, 공인 IP ENI eni-0c0f0001 연결) 규칙을 바꾼다 ───────── */
type Ingress = { protocol: string; fromPort: number | null; toPort: number | null; cidrs: string[]; ipv6Cidrs: string[]; prefixListIds: string[]; sgRefCount: number };
const rule = (o: Partial<Ingress>): Ingress => ({ protocol: "tcp", fromPort: 22, toPort: 22, cidrs: [], ipv6Cidrs: [], prefixListIds: [], sgRefCount: 0, ...o });
function awsWith(ingress: Ingress[], eni: { publicIp?: boolean; ipv6?: boolean } = {}): Json {
  const f = companyJson("aws", "C");
  const sg = (f.data.securityGroups as Json[]).flatMap((p) => p.items ?? []).find((s: Json) => s.groupId === "sg-0c0ffee1");
  sg.ingress = ingress;
  const e = (f.data.networkInterfaces as Json[]).flatMap((p) => p.items ?? []).find((x: Json) => x.eniId === "eni-0c0f0001");
  if (eni.publicIp !== undefined) e.hasPublicIp = eni.publicIp;
  if (eni.ipv6 !== undefined) e.hasIpv6 = eni.ipv6;
  return f;
}
const bastion = (f: Json): { status: string; why: string; facts: string[] } => {
  const i = ruleOf(okReport(runJson(f)), "AWS-NET-1").items.find((x) => nameText(x) === "sg-0c0ffee1");
  if (i === undefined) throw new Error("bastion 대상이 없다");
  return { status: i.status, why: i.why.code, facts: i.facts.map((x) => `${x.code}${JSON.stringify(x.params ?? {})}`) };
};

describe("[CC-QA-04 A] AWS 합집합 = 인터넷 전체(D-1a · 베타 차단)", () => {
  it("[CC-QA-04 A · E-10] 22번 출발지 0.0.0.0/1 + 128.0.0.0/1, 공인 IP ENI 연결 → 위험(sg-public), 사실 줄에 실제 조각이 보인다", () => {
    const x = bastion(awsWith([rule({ cidrs: ["0.0.0.0/1", "128.0.0.0/1"] })]));
    expect([x.status, x.why]).toEqual(["risk", "AWS-NET-1:sg-public"]);
    expect(x.facts.some((f) => f.includes("0.0.0.0/1")) && x.facts.some((f) => f.includes("128.0.0.0/1"))).toBe(true);
  });
  it("[CC-QA-04 A] 세 조각(0.0.0.0/2 + 64.0.0.0/2 + 128.0.0.0/1)도 전체 → 위험", () => {
    expect(bastion(awsWith([rule({ cidrs: ["0.0.0.0/2", "64.0.0.0/2", "128.0.0.0/1"] })])).status).toBe("risk");
  });
  it("[CC-QA-04 A] 앞뒤 공백(\"0.0.0.0/0 \")은 trim 뒤 전체 → 위험(CC-QA-03의 CIDR 부분)", () => {
    expect(bastion(awsWith([rule({ cidrs: ["0.0.0.0/0 "] })])).status).toBe("risk");
  });
  it("[CC-QA-04 A] 호스트 비트가 켜진 값(10.1.2.3/1 + 200.1.1.1/1)은 네트워크 주소로 맞춰 합집합 = 전체 → 위험", () => {
    expect(bastion(awsWith([rule({ cidrs: ["10.1.2.3/1", "200.1.1.1/1"] })])).status).toBe("risk");
  });
  it("[CC-QA-04 A] IPv6 합집합(::/1 + 8000::/1) + IPv6 ENI → 위험, IPv6가 없는 ENI면 주의(공인 IPv4만으로는 IPv6 노출 아님)", () => {
    expect(bastion(awsWith([rule({ ipv6Cidrs: ["::/1", "8000::/1"] })], { ipv6: true })).status).toBe("risk");
    expect(bastion(awsWith([rule({ ipv6Cidrs: ["::/1", "8000::/1"] })], { ipv6: false })).status).toBe("caution");
  });
  it("[CC-QA-04 A] 빈틈이 있으면(0.0.0.0/1 + 128.0.0.0/2) 전체가 아니다 → 넓은 대역 주의(위험 아님)", () => {
    expect(bastion(awsWith([rule({ cidrs: ["0.0.0.0/1", "128.0.0.0/2"] })]))).toMatchObject({ status: "caution", why: "AWS-NET-1:sg-source-broad" });
  });
  it("[CC-QA-04 A] 합집합은 규칙 하나 안에서만 본다 — 두 규칙에 나눠 적은 0.0.0.0/1 · 128.0.0.0/1은 각각 넓은 대역 주의(알려진 한계 §2-7)", () => {
    expect(bastion(awsWith([rule({ cidrs: ["0.0.0.0/1"] }), rule({ cidrs: ["128.0.0.0/1"] })]))).toMatchObject({ status: "caution", why: "AWS-NET-1:sg-source-broad" });
  });
});

describe("[CC-QA-04 B] AWS 넓은 공인 대역(D-1b) · 프리픽스 리스트(D-4) — G8 전", () => {
  it("[CC-QA-04 B] 22번 출발지 1.0.0.0/8(넓은 공인 대역) → 공인 IP ENI가 있어도 주의가 상한(sg-source-broad)", () => {
    expect(bastion(awsWith([rule({ cidrs: ["1.0.0.0/8"] })]))).toMatchObject({ status: "caution", why: "AWS-NET-1:sg-source-broad" });
  });
  it("[CC-QA-04 B] 사설·예약 대역은 넓어도 뺀다: 10.0.0.0/8 · 224.0.0.0/4 · 224.0.0.0/3(224/4 + 240/4 합집합 안) → 이상 없음", () => {
    for (const c of ["10.0.0.0/8", "224.0.0.0/4", "224.0.0.0/3"]) expect(bastion(awsWith([rule({ cidrs: [c] })])).status, c).toBe("clear");
  });
  it("[CC-QA-04 B] 접두가 /8보다 길면 넓은 대역이 아니다(100.64.0.0/10 · 12.0.0.0/9) → 이상 없음", () => {
    for (const c of ["100.64.0.0/10", "12.0.0.0/9"]) expect(bastion(awsWith([rule({ cidrs: [c] })])).status, c).toBe("clear");
  });
  it("[CC-QA-04 B] 넓은 대역은 위험 포트에서만 본다 — 443 · 80 · 25(메일)만 열면 이상 없음", () => {
    for (const p of [443, 80, 25]) expect(bastion(awsWith([rule({ cidrs: ["1.0.0.0/8"], fromPort: p, toPort: p })])).status, String(p)).toBe("clear");
  });
  it("[CC-QA-04 B] IPv6 넓은 공인 대역(2000::/3) → 주의, 공인 대역 밖(fc00::/7 ULA)은 이상 없음", () => {
    expect(bastion(awsWith([rule({ ipv6Cidrs: ["2000::/3"] })])).status).toBe("caution");
    expect(bastion(awsWith([rule({ ipv6Cidrs: ["fc00::/7"] })])).status).toBe("clear");
  });
  it("[CC-QA-04 B · D-4] 프리픽스 리스트 + 위험 포트 → 주의(sg-source-prefix-list), 같은 그룹의 전체 출발지 위험이 있으면 위험이 먼저", () => {
    expect(bastion(awsWith([rule({ prefixListIds: ["pl-0123abcd"] })]))).toMatchObject({ status: "caution", why: "AWS-NET-1:sg-source-prefix-list" });
    expect(bastion(awsWith([rule({ prefixListIds: ["pl-0123abcd"] }), rule({ cidrs: ["0.0.0.0/0"], fromPort: 3389, toPort: 3389 })])).status).toBe("risk");
  });
  it("[CC-QA-04 B] 출발지가 하나도 없는 규칙(CIDR · 프리픽스 리스트 · 보안 그룹 참조 0)은 포트와 무관하게 확인 불가(결정 §2-2)", () => {
    expect(bastion(awsWith([rule({})]))).toMatchObject({ status: "unknown", why: "value-unrecognized" });
    expect(bastion(awsWith([rule({ fromPort: 443, toPort: 443 })])).status).toBe("unknown");
  });
  it("[CC-QA-04 B] 대조: 보안 그룹 참조만 있는 규칙(sgRefCount 1)은 내부 → 이상 없음", () => {
    expect(bastion(awsWith([rule({ sgRefCount: 1 })])).status).toBe("clear");
  });
  it("[CC-QA-04 B] 형식이 아닌 출발지('zzz' · '300.0.0.0/8' · 접두 없는 '1.2.3.4')는 해석 불가 — 다른 발견이 없으면 확인 불가", () => {
    for (const c of ["zzz", "300.0.0.0/8", "1.2.3.4"]) expect(bastion(awsWith([rule({ cidrs: [c] })])).status, c).toBe("unknown");
  });
});

/* ───────── Azure: 회사 A의 구독 b1 NSG를 세계로(oracle.azNetJson) ───────── */
const nsg = (rules: Partial<NsgRule>[], nicPublic: boolean | null = true): Json =>
  azNetJson([{ name: "nsg-qa-0", nicPublic, rules: rules.map((r, k) => ({ direction: "Inbound", access: "Allow", priority: 100 + k * 10, protocol: "Tcp", sources: ["*"], asg: 0, ports: ["22"], ...r })) }]);
const az = (f: Json): { status: string; why: string } => {
  const i = ruleOf(okReport(runJson(f)), "AZ-NET-1").items.find((x) => nameText(x) === "nsg-qa-0");
  if (i === undefined) throw new Error("nsg-qa-0 대상이 없다");
  return { status: i.status, why: i.why.code };
};

describe("[CC-QA-04 C] Azure 출발지(D-3 · 합집합 · Deny) — Azure 공개 전", () => {
  it("대조: 출발지 * · 22 · 공인 IP NIC → 위험(nsg-public)", () => {
    expect(az(nsg([{}]))).toEqual({ status: "risk", why: "AZ-NET-1:nsg-public" });
  });
  it("[CC-QA-04 C · D-3a] 서비스 태그 AzureCloud · 22 → 주의(nsg-source-service-tag), 공인 IP NIC여도 위험 아님", () => {
    expect(az(nsg([{ sources: ["AzureCloud"] }]))).toEqual({ status: "caution", why: "AZ-NET-1:nsg-source-service-tag" });
  });
  it("[CC-QA-04 C · D-3a] 서비스 태그는 위험 포트에서만: GatewayManager 65200-65535 · AzureCloud 443 → 이상 없음", () => {
    expect(az(nsg([{ sources: ["GatewayManager"], ports: ["65200-65535"] }])).status).toBe("clear");
    expect(az(nsg([{ sources: ["AzureCloud"], ports: ["443"] }])).status).toBe("clear");
  });
  it("[CC-QA-04 C · D-3b] ASG 출발지만(접두 0개 + ASG 1개) · VirtualNetwork · AzureLoadBalancer → 내부(이상 없음)", () => {
    expect(az(nsg([{ sources: [], asg: 1 }])).status).toBe("clear");
    expect(az(nsg([{ sources: ["VirtualNetwork"] }])).status).toBe("clear");
    expect(az(nsg([{ sources: ["AzureLoadBalancer"] }])).status).toBe("clear");
  });
  it("[CC-QA-04 C · D-3b] 출발지가 하나도 없는 허용 규칙(접두 0개 + ASG 0개)은 확인 불가", () => {
    expect(az(nsg([{ sources: [], asg: 0 }]))).toEqual({ status: "unknown", why: "value-unrecognized" });
  });
  it("[CC-QA-04 C · D-1a] 합집합 0.0.0.0/1 + 128.0.0.0/1 · 22 · 공인 IP NIC → 위험", () => {
    expect(az(nsg([{ sources: ["0.0.0.0/1", "128.0.0.0/1"] }])).status).toBe("risk");
  });
  it("[CC-QA-04 C · D-1b] 넓은 공인 대역 1.0.0.0/8 · 22 → 주의(nsg-source-broad)", () => {
    expect(az(nsg([{ sources: ["1.0.0.0/8"] }]))).toEqual({ status: "caution", why: "AZ-NET-1:nsg-source-broad" });
  });
  it("[CC-QA-04 C · §2-3 ⑧] 더 높은 우선순위의 '합쳐서 전체' Deny는 그 포트를 막는다 → 이상 없음 · 넓은 대역 Deny는 막지 않는다 → 위험 유지", () => {
    expect(az(nsg([{ access: "Deny", sources: ["0.0.0.0/1", "128.0.0.0/1"] }, {}])).status).toBe("clear");
    expect(az(nsg([{ access: "Deny", sources: ["1.0.0.0/8"] }, {}])).status).toBe("risk");
  });
  it("[CC-QA-04 C] 태그 모양이 아닌 값('zzz!' · 빈 문자열)은 해석 불가 — 다른 발견이 없으면 확인 불가", () => {
    expect(az(nsg([{ sources: ["zzz!"] }])).status).toBe("unknown");
    expect(az(nsg([{ sources: [""] }])).status).toBe("unknown");
  });
});

/* ───────── §9-6 마스킹 재현: judge(되살린 maskedCopy(x)) = judge(x) ───────── */
/** 가명 사본 JSON(정규화된 사실) → judge가 받는 NormalizedInput(범위 표 다시 봉인 · 영수증 Map) */
function revive(text: string): NormalizedInput {
  const m = JSON.parse(text) as Json;
  const coverage = Object.fromEntries(Object.entries(m.coverage as Record<string, CoverageDraft>).map(([family, c]) => [family, sealCoverage(c)]));
  const receipts = new Map<ReceiptKey, ReceiptFact>((m.receipts as ReceiptFact[]).map((r) => [r.key, r]));
  const { schema: _s, note: _n, ...rest } = m;
  void _s; void _n;
  return { ...rest, coverage, receipts } as unknown as NormalizedInput;
}
/** 이름이 가명이 되어도 같아야 하는 판정: 룰 상태 · 사유 · 대상 상태+사유(정렬) · 분포 */
const verdict = (r: Report): string => JSON.stringify({ rules: rulesOf(r).map((x) => [x.ruleId, x.status, x.why.code, x.items.map((i) => `${i.status}:${i.why.code}`).sort()]), dist: r.distribution });

describe("§9-6 마스킹 사본을 되살려 다시 판정해도 원본과 같다(넓은 대역 · 합집합 · 태그 · 프리픽스 리스트)", () => {
  const cases: readonly [string, Json][] = [
    ["AWS 합집합 22", awsWith([rule({ cidrs: ["0.0.0.0/1", "128.0.0.0/1"] })])],
    ["AWS 넓은 대역 1.0.0.0/8 · 12.0.0.0/6 · 2000::/3", awsWith([rule({ cidrs: ["1.0.0.0/8", "12.0.0.0/6"], ipv6Cidrs: ["2000::/3"] })])],
    ["AWS 사설 10.0.0.0/8(제외 유지)", awsWith([rule({ cidrs: ["10.0.0.0/8"] })])],
    ["AWS 프리픽스 리스트 22", awsWith([rule({ prefixListIds: ["pl-0123abcd"] })])],
    ["Azure 서비스 태그 22", nsg([{ sources: ["AzureCloud"] }])],
    ["Azure 합집합 Deny + 허용", nsg([{ access: "Deny", sources: ["0.0.0.0/2", "64.0.0.0/2", "128.0.0.0/1"] }, {}])],
    ["Azure 넓은 대역 1.0.0.0/8", nsg([{ sources: ["1.0.0.0/8"] }])],
  ];
  for (const [title, f] of cases) {
    it(title, () => {
      const run = runJson(f);
      if (run.kind !== "ok") throw new Error(run.kind);
      expect(verdict(judge(revive(maskedCopy(run.input))))).toBe(verdict(run.report));
    });
  }
});
