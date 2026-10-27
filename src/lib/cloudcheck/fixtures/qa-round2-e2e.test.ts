// 종단 시험(STEP 5 QA 2라운드): 가짜 회사 수집기 JSON을 고쳐 recognize → buildInput → judge 전체 경로로 돌린다 — parse가 만든 범위 표(구성원 신원 집합 포함)와 엔진이 같이 맞물리는지 본다.
// 출발지 해석(결정 D-1 · D-3 · D-4)과 로그 전달 오류(D-2)의 기대값은 결정 문서(docs/planning/cloudcheck-qa-decisions.md)에서 먼저 썼다.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { judge } from "../engine/judge";
import type { ItemResult, Report, RuleId, RuleResult } from "../model/report";
import { buildInput } from "../parse/normalize";
import { recognize } from "../parse/recognize";
import { SET_IDS, companyJsonName } from "./companies";
import { checkReport } from "./report-invariants";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;
const COMPANIES = join(__dirname, "companies");
const NAME = { aws: "cloudcheck-aws-3333-20261019T031500Z.json", azure: "cloudcheck-azure-0001-20261019T031500Z.json" } as const;
const company = (cloud: "aws" | "azure", set: (typeof SET_IDS)[number]): Json => JSON.parse(readFileSync(join(COMPANIES, companyJsonName(cloud, set)), "utf8"));

function run(cloud: "aws" | "azure", json: Json): Report {
  const rec = recognize({ via: "file", name: NAME[cloud], bytes: new TextEncoder().encode(JSON.stringify(json)), lastModified: null });
  expect(rec.status).toBe("ok");
  const built = buildInput([rec]);
  if (!built.ok) throw new Error("buildInput 실패");
  const report = judge(built.input);
  expect(checkReport(report)).toEqual([]);
  return report;
}
const ruleOf = (r: Report, id: RuleId): RuleResult => r.doors.flatMap((d) => d.rules).find((x) => x.ruleId === id) as RuleResult;
const itemNamed = (r: RuleResult, name: string): ItemResult => {
  const i = r.items.find((x) => x.resource.name.kind === "sensitive" && x.resource.name.full === name);
  if (i === undefined) throw new Error(`${r.ruleId}: ${name} 대상이 없다`);
  return i;
};

/* ───────── AWS-NET-1: 회사 C의 bastion-ssh(sg-0c0ffee1, 22번, 공인 IP ENI에 연결 — 원래 위험) 출발지를 바꾼다 ───────── */
const SG = "sg-0c0ffee1";
const awsWith = (source: Json): Json => {
  const f = company("aws", "C");
  const sg = (f.data.securityGroups as Json[]).flatMap((p) => p.items ?? []).find((s: Json) => s.groupId === SG);
  sg.ingress = [{ protocol: "tcp", fromPort: 22, toPort: 22, cidrs: [], ipv6Cidrs: [], prefixListIds: [], sgRefCount: 0, ...source }];
  return f;
};
const sgItem = (source: Json): ItemResult => itemNamed(ruleOf(run("aws", awsWith(source)), "AWS-NET-1"), SG);
const slug = (i: ItemResult): string => i.why.code.split(":").pop() as string;

describe("종단 AWS-NET-1: 출발지를 주소 범위로 본다 (D-1 · D-4)", () => {
  it("기준: 인터넷 전체(0.0.0.0/0)는 위험 — 공인 IP ENI에 연결돼 있다", () => {
    expect([sgItem({ cidrs: ["0.0.0.0/0"] }).status, slug(sgItem({ cidrs: ["0.0.0.0/0"] }))]).toEqual(["risk", "sg-public"]);
  });
  it("합쳐서 전체인 출발지(0.0.0.0/1 + 128.0.0.0/1)는 인터넷 전체와 같은 위험 · 같은 사유다(E-10)", () => {
    for (const cidrs of [["0.0.0.0/1", "128.0.0.0/1"], ["0.0.0.0/2", "64.0.0.0/2", "128.0.0.0/1"], [" 0.0.0.0/1", "128.0.0.0/1 "], ["0.0.0.0/0 "]]) {
      const i = sgItem({ cidrs });
      expect([i.status, slug(i)], JSON.stringify(cidrs)).toEqual(["risk", "sg-public"]);
    }
  });
  it("빈틈이 있는 합집합은 전체가 아니라 넓은 공인 대역 → 주의", () => {
    const i = sgItem({ cidrs: ["0.0.0.0/1", "128.0.0.0/2"] });
    expect([i.status, slug(i)]).toEqual(["caution", "sg-source-broad"]);
  });
  it("넓은 공인 대역(IPv4 /8 · IPv6 /16 이하)은 주의, 연결 사실 없이 대상 증거만 싣는다", () => {
    for (const source of [{ cidrs: ["12.0.0.0/8"] }, { ipv6Cidrs: ["2400::/12"] }, { cidrs: ["64.0.0.0/2"] }]) {
      const i = sgItem(source);
      expect([i.status, slug(i)], JSON.stringify(source)).toEqual(["caution", "sg-source-broad"]);
    }
  });
  it("사설·예약 대역 · 좁은 공인 대역 · IPv6 ULA는 넓어도·좁아도 판정에서 뺀다 → 이상 없음", () => {
    for (const source of [{ cidrs: ["10.0.0.0/8"] }, { cidrs: ["203.0.113.0/24"] }, { cidrs: ["172.16.0.0/12"] }, { ipv6Cidrs: ["fc00::/7"] }, { sgRefCount: 1 }]) {
      expect(sgItem(source).status, JSON.stringify(source)).toBe("clear");
    }
  });
  it("프리픽스 리스트 + 위험 포트 → 주의(위험 아님), 사실 줄에 목록 ID가 사용자 데이터로 실린다 (E-25)", () => {
    const i = sgItem({ prefixListIds: ["pl-0123abcd"] });
    expect([i.status, slug(i)]).toEqual(["caution", "sg-source-prefix-list"]);
    const f = i.facts.find((x) => x.code === "fact:port-prefix-list");
    expect(f?.params?.port).toEqual({ c: "22" });
    expect(f?.params?.list).toMatchObject({ v: { kind: "sensitive", full: "pl-0123abcd" } });
  });
  it("프리픽스 리스트 + 80·443 · 메일 포트는 판정에서 뺀다", () => {
    for (const port of [80, 443, 25]) expect(sgItem({ prefixListIds: ["pl-0123abcd"], fromPort: port, toPort: port }).status, String(port)).toBe("clear");
  });
  it("출발지가 하나도 없는 규칙은 해석 불가(포트와 무관)", () => {
    for (const port of [22, 443]) {
      const i = sgItem({ fromPort: port, toPort: port });
      expect([i.status, i.why.code], String(port)).toEqual(["unknown", "value-unrecognized"]);
    }
  });
  it("룰 수준: 위험이 사라지면(회사 C의 다른 대상 rds-open은 공인 IP가 없는 주의) 주의 범주가 둘(출발지 확인 · 연결 불명)이라 공통 사유 open-review가 주의 전체 개수를 말한다", () => {
    const r = ruleOf(run("aws", awsWith({ prefixListIds: ["pl-0123abcd"] })), "AWS-NET-1");
    expect(r.status).toBe("caution");
    expect(itemNamed(r, "sg-0c0ffee2").why.code).toBe("AWS-NET-1:sg-private");
    expect(r.why.code).toBe("AWS-NET-1:open-review");
    expect(r.why.params?.n).toEqual({ n: 2 });
  });
  it("룰 수준: 위험이 하나라도 있으면 위험 사유가 먼저다", () => {
    const r = ruleOf(run("aws", awsWith({ cidrs: ["0.0.0.0/1", "128.0.0.0/1"] })), "AWS-NET-1");
    expect(r.status).toBe("risk");
    expect(r.why.code).toBe("AWS-NET-1:exposed-with-public-ip");
  });
});

/* ───────── AZ-NET-1: 회사 C의 nsg-acme-jump(점프 서버, 공인 IP NIC에 연결 — 원래 위험) 규칙을 바꾼다 ───────── */
const NSG = "nsg-acme-jump";
const azureWith = (rules: Json[]): Json => {
  const f = company("azure", "C");
  const nsg = (f.data.nsgs as Json[]).flatMap((p) => p.items ?? []).find((n: Json) => n.name === NSG);
  nsg.rules = rules.map((r, i) => ({ name: `r${i + 1}`, direction: "Inbound", access: "Allow", priority: 100 + i * 10, protocol: "Tcp", sourcePrefixes: ["*"], sourceAsgCount: 0, destPortRanges: ["22"], ...r }));
  return f;
};
const nsgItem = (rules: Json[]): ItemResult => itemNamed(ruleOf(run("azure", azureWith(rules)), "AZ-NET-1"), NSG);

describe("종단 AZ-NET-1: 출발지를 주소 범위 · 태그로 본다 (D-1 · D-3)", () => {
  it("기준: 출발지 *는 위험, Internet · Any는 대소문자와 공백을 가리지 않는다", () => {
    for (const p of ["*", "Internet", "internet", " ANY "]) {
      const i = nsgItem([{ sourcePrefixes: [p] }]);
      expect([i.status, slug(i)], p).toEqual(["risk", "nsg-public"]);
    }
  });
  it("합쳐서 전체인 출발지는 위험이다", () => {
    const i = nsgItem([{ sourcePrefixes: ["0.0.0.0/1", "128.0.0.0/1"] }]);
    expect([i.status, slug(i)]).toEqual(["risk", "nsg-public"]);
  });
  it("서비스 태그 + 위험 포트 → 주의, 태그 이름을 문장 인자로 싣는다", () => {
    const i = nsgItem([{ sourcePrefixes: ["AzureCloud"] }]);
    expect([i.status, slug(i)]).toEqual(["caution", "nsg-source-service-tag"]);
    expect(i.why.params?.tag).toEqual({ c: "AzureCloud" });
    expect(i.why.params?.ports).toEqual({ c: "22" });
  });
  it("넓은 공인 대역 → 주의", () => {
    expect(slug(nsgItem([{ sourcePrefixes: ["12.0.0.0/8"] }]))).toBe("nsg-source-broad");
  });
  it("내부 출발지(VirtualNetwork · AzureLoadBalancer · ASG)와 좁은 출발지, 위험 포트가 아닌 태그 구간은 판정에서 뺀다", () => {
    for (const rule of [
      { sourcePrefixes: ["VirtualNetwork"] }, { sourcePrefixes: ["AzureLoadBalancer"] }, { sourcePrefixes: [], sourceAsgCount: 2 },
      { sourcePrefixes: ["203.0.113.0/24"] }, { sourcePrefixes: ["10.0.0.0/8"] }, { sourcePrefixes: ["GatewayManager"], destPortRanges: ["65200-65535"] },
      { sourcePrefixes: ["AzureCloud"], destPortRanges: ["443"] },
    ]) expect(nsgItem([rule]).status, JSON.stringify(rule)).toBe("clear");
  });
  it("출발지가 하나도 없는 Allow 규칙은 해석 불가", () => {
    const i = nsgItem([{ sourcePrefixes: [], sourceAsgCount: 0 }]);
    expect([i.status, i.why.code]).toEqual(["unknown", "value-unrecognized"]);
  });
  it("출발지 전체 Deny는 포트를 빼고(합집합 포함 · 태그 Allow도 막는다), 넓은 대역 · 태그 Deny는 빼지 못한다", () => {
    const deny = (sourcePrefixes: string[]) => ({ access: "Deny", priority: 90, sourcePrefixes });
    expect(nsgItem([deny(["0.0.0.0/1", "128.0.0.0/1"]), { priority: 100 }]).status).toBe("clear");
    expect(nsgItem([deny(["*"]), { priority: 100, sourcePrefixes: ["AzureCloud"] }]).status).toBe("clear");
    expect(nsgItem([deny(["12.0.0.0/8"]), { priority: 100 }]).status).toBe("risk");
    expect(nsgItem([deny(["AzureCloud"]), { priority: 100 }]).status).toBe("risk");
  });
});

/* ───────── AWS-LOG-1: 회사 A의 trail(기록 중 · 다중 리전 · 검증 켜짐)에 전달 오류 기록을 넣는다 ───────── */
describe("종단 AWS-LOG-1: 기록 중이어도 로그 전달 오류 기록이 있으면 주의 (D-2)", () => {
  const trailWith = (mut: (status: Json) => void): RuleResult => {
    const f = company("aws", "A");
    mut(f.data.trails.value[0].status.value);
    return ruleOf(run("aws", f), "AWS-LOG-1");
  };
  it("기준: 오류 기록이 없으면 이상 없음", () => {
    expect(trailWith(() => undefined).status).toBe("clear");
  });
  it("전달 오류 기록이 있으면 주의 trail-delivery-error", () => {
    const r = trailWith((s) => { s.hasDeliveryError = true; });
    expect([r.status, r.why.code]).toEqual(["caution", "AWS-LOG-1:trail-delivery-error"]);
    expect(r.items[0].facts.map((f) => f.code)).toContain("fact:trail-delivery-error");
  });
  it("기록이 중지돼 있으면 중지가 먼저 보인다(빈틈 순서)", () => {
    const r = trailWith((s) => { s.hasDeliveryError = true; s.isLogging = false; });
    expect(r.why.code).toBe("AWS-LOG-1:trail-not-logging");
  });
});
