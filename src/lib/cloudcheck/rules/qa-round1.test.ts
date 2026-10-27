// STEP 5 QA 수정 1라운드(CC-QA-01 · 03 · 05 · 07 · 13 · 16 · 17 · 23)의 경계 시험 — micro 정답표(micro-expectations)가 다루지 않는 모양:
// 값 표(모르는 토큰을 여러 개씩), MatchKey 동일성, 예외 표시, 해석 불가 사유. 기대값은 P3(모르는 값은 해석 불가)와 룰 명세에서 먼저 썼다.
import { describe, expect, it } from "vitest";
import { overlayExceptions } from "../engine/exceptions";
import { judge } from "../engine/judge";
import { azWorld } from "../fixtures/micro/azure-world";
import { world } from "../fixtures/micro/aws-net";
import type { IngressSpec } from "../fixtures/micro/aws-net";
import { iamWorld, GOOD_ROOT } from "../fixtures/micro/aws-iam";
import { resolveFixture } from "../fixtures/micro";
import type { IsoDate, ItemResult, Report, RuleId, RuleResult } from "../model/report";
import type { NormalizedInput } from "../contract/normalized";

const ruleOf = (input: NormalizedInput, id: RuleId): RuleResult => judge(input).doors.flatMap((d) => d.rules).find((r) => r.ruleId === id) as RuleResult;
const states = (r: RuleResult): string[] => r.items.map((i) => i.status);

/* ───────── AWS-NET-1 (CC-QA-03) ───────── */
const sg = (rule: IngressSpec, publicIp = true): NormalizedInput => world({
  sgs: [{ id: "sg-0qa00001", name: "qa", region: "ap-northeast-2", ingress: [rule] }],
  enis: [{ id: "eni-0qa", region: "ap-northeast-2", groups: ["sg-0qa00001"], publicIp }],
}).build() as NormalizedInput;

describe("AWS-NET-1: 인터넷 전체를 연 규칙의 값이 이상하면 이상 없음이 아니다 (CC-QA-03)", () => {
  it("모르는 프로토콜 문자열은 해석 불가다", () => {
    for (const protocol of ["", " ", "zzz", "Allowed", "ＴＣＰ", "tcp\\n", "all", "any", "-2", "tcp udp"]) {
      expect(states(ruleOf(sg({ protocol, from: 22, to: 22 }), "AWS-NET-1")), JSON.stringify(protocol)).toEqual(["unknown"]);
    }
  });
  it("앞뒤 공백 · 대소문자만 다른 tcp · udp · -1은 같은 값으로 읽는다(위험 그대로)", () => {
    for (const protocol of ["TCP", " tcp ", "Udp", "6", "17", "-1", " -1"]) {
      expect(states(ruleOf(sg({ protocol, from: 22, to: 22 }), "AWS-NET-1")), JSON.stringify(protocol)).toEqual(["risk"]);
    }
  });
  it("포트가 없는 프로토콜(icmp · icmpv6 · 번호)은 포트 규칙이 아니라 건너뛴다", () => {
    for (const protocol of ["icmp", "ICMP", "icmpv6", "1", "58", "132"]) {
      expect(states(ruleOf(sg({ protocol, from: 3389, to: 3389 }), "AWS-NET-1")), protocol).toEqual(["clear"]);
    }
  });
  it("tcp · udp의 포트가 비었거나(null) 소수 · 거꾸로 · 구간 전체가 범위 밖이면 해석 불가다", () => {
    const bad: [number | null, number | null][] = [[null, null], [22, null], [null, 22], [3389, 22], [-5, -1], [65536, 70000], [1.5, 22], [22, 22.5]];
    for (const [from, to] of bad) expect(states(ruleOf(sg({ protocol: "tcp", from, to }), "AWS-NET-1")), `${from}..${to}`).toEqual(["unknown"]);
  });
  it("한쪽 끝만 범위 밖이면 범위 안쪽으로 잘라 읽는다 — 열려 있는 위험 포트는 그대로 보인다", () => {
    for (const [from, to] of [[-10, 22], [22, 70000], [0, 70000], [-1, 65536]] as const) {
      expect(states(ruleOf(sg({ protocol: "tcp", from, to }), "AWS-NET-1")), `${from}..${to}`).toEqual(["risk"]);
    }
  });
  it("출발지 문자열이 CIDR 모양이 아니면(빈 값 · 접두 없음 · 범위 밖 옥텟 · 접두 길이 · IPv6 모양) 해석 불가다", () => {
    for (const c of ["", "zzz", "0.0.0.0", "0.0.0.0/33", "256.0.0.0/8", "0.0.0/0", "0.0.0.0/-1", "::/0"]) {
      expect(states(ruleOf(sg({ protocol: "tcp", from: 22, to: 22, cidrs: [c] }), "AWS-NET-1")), JSON.stringify(c)).toEqual(["unknown"]);
    }
  });
  it("앞뒤 공백은 trim한 뒤 읽는다 — 공백이 붙은 0.0.0.0/0 은 인터넷 전체라 위험이다(결정 D-1a)", () => {
    for (const c of ["0.0.0.0/0 ", " 0.0.0.0/0", "\t0.0.0.0/0\n"]) {
      expect(states(ruleOf(sg({ protocol: "tcp", from: 22, to: 22, cidrs: [c] }), "AWS-NET-1")), JSON.stringify(c)).toEqual(["risk"]);
    }
  });
  it("IPv6 출발지도 모양을 확인한다: ::/0 · 0:0:0:0:0:0:0:0/0 · ::0/0은 전체(앞뒤 공백은 trim), 모르는 모양은 해석 불가", () => {
    const v6 = (c: string) => states(ruleOf(sg({ protocol: "tcp", from: 22, to: 22, cidrs: [], ipv6: [c] }, true), "AWS-NET-1"));
    // 공인 IP는 있으나 IPv6 주소는 없는 ENI: 인터넷 전체 IPv6를 열었어도 노출은 아니다(주의) — 단 전체로 읽혀야 규칙이 보인다
    for (const c of ["::/0", "0:0:0:0:0:0:0:0/0", "::0/0", "2001:db8::/0", "::/0 ", " ::/0"]) expect(v6(c), JSON.stringify(c)).toEqual(["caution"]);
    for (const c of ["", "zzz", ":::/0", "1:2:3:4:5:6:7:8:9/0", "::/129", "g::/0"]) expect(v6(c), JSON.stringify(c)).toEqual(["unknown"]);
    expect(v6("2001:db8::/32")).toEqual(["clear"]);
  });
  it("인터넷 전체가 아닌 규칙의 프로토콜 · 포트는 보지 않는다(해석 불가로 세지 않는다)", () => {
    expect(states(ruleOf(sg({ protocol: "zzz", from: 9, to: 1, cidrs: ["10.0.0.0/8"] }), "AWS-NET-1"))).toEqual(["clear"]);
  });
  it("한 규칙이 해석 불가여도 다른 규칙에서 찾은 위험 · 주의는 남는다(양성 유지)", () => {
    const input = world({
      sgs: [{ id: "sg-0qa00001", name: "qa", region: "ap-northeast-2", ingress: [{ protocol: "zzz", from: 1, to: 1 }, { protocol: "tcp", from: 22, to: 22 }, { protocol: "tcp", from: 5, to: 1 }] }],
      enis: [{ id: "eni-0qa", region: "ap-northeast-2", groups: ["sg-0qa00001"], publicIp: true }],
    }).build() as NormalizedInput;
    expect(states(ruleOf(input, "AWS-NET-1"))).toEqual(["risk"]);
  });
});

/* ───────── AZ-NET-1 (CC-QA-17) ───────── */
const nsg = (rule: Record<string, unknown>): NormalizedInput => azWorld({
  doors: ["net"],
  nsgs: [{ name: "nsg-vm", rules: [{ name: "r1", priority: 100, destPortRanges: ["22"], ...rule }], nicIds: ["nic-vm1"] }],
  nics: [{ name: "nic-vm1", nsg: "nsg-vm", publicIp: "pip-vm1" }], publicIps: [{ name: "pip-vm1", hasAddress: true }],
}).build() as NormalizedInput;

describe("AZ-NET-1: 규칙의 방향 · 허용 · 프로토콜 · 포트 칸이 이상하면 이상 없음이 아니다 (CC-QA-17)", () => {
  it("모르는 방향 · 허용 값은 해석 불가다(공백 · 대소문자만 다른 값은 같은 값)", () => {
    for (const direction of ["", "zzz", "Allowed", "In bound", "Inbound1"]) expect(states(ruleOf(nsg({ direction }), "AZ-NET-1")), JSON.stringify(direction)).toEqual(["unknown"]);
    for (const access of ["", "zzz", "Permit", "Allow1"]) expect(states(ruleOf(nsg({ access }), "AZ-NET-1")), JSON.stringify(access)).toEqual(["unknown"]);
    for (const direction of ["inbound", " INBOUND ", "Inbound\t"]) expect(states(ruleOf(nsg({ direction }), "AZ-NET-1")), JSON.stringify(direction)).toEqual(["risk"]);
    for (const access of ["allow", " ALLOW"]) expect(states(ruleOf(nsg({ access }), "AZ-NET-1")), JSON.stringify(access)).toEqual(["risk"]);
  });
  it("인바운드 Allow의 프로토콜이 모르는 값이면 해석 불가, 포트가 없는 프로토콜(Icmp · Esp · Ah)은 건너뛴다", () => {
    for (const protocol of ["", "zzz", "Allowed", "Tcp Udp"]) expect(states(ruleOf(nsg({ protocol }), "AZ-NET-1")), JSON.stringify(protocol)).toEqual(["unknown"]);
    for (const protocol of ["Icmp", "ESP", " ah "]) expect(states(ruleOf(nsg({ protocol }), "AZ-NET-1")), protocol).toEqual(["clear"]);
    for (const protocol of ["Tcp", "Udp", "*", "Any"]) expect(states(ruleOf(nsg({ protocol }), "AZ-NET-1")), protocol).toEqual(["risk"]);
  });
  it("포트 칸이 비었거나(빈 목록 · 빈 조각) 읽을 수 없는 조각뿐이면 해석 불가, 읽은 조각이 있으면 그 포트로 판정한다", () => {
    for (const destPortRanges of [[], [""], [" "], [",", ""], ["zzz"], ["70000"], ["30-20"]]) {
      expect(states(ruleOf(nsg({ destPortRanges }), "AZ-NET-1")), JSON.stringify(destPortRanges)).toEqual(["unknown"]);
    }
    expect(states(ruleOf(nsg({ destPortRanges: ["22", "zzz"] }), "AZ-NET-1"))).toEqual(["risk"]);
    expect(states(ruleOf(nsg({ destPortRanges: ["", "3389"] }), "AZ-NET-1"))).toEqual(["risk"]);
    expect(states(ruleOf(nsg({ destPortRanges: ["80", "zzz"] }), "AZ-NET-1"))).toEqual(["unknown"]);
  });
  it("방향이 모르는 값인 규칙 하나가 다른 규칙의 위험을 가리지 않는다(양성 유지)", () => {
    const input = azWorld({
      doors: ["net"],
      nsgs: [{ name: "nsg-vm", rules: [{ name: "odd", priority: 90, direction: "zzz", destPortRanges: ["1"] }, { name: "rdp", priority: 100, destPortRanges: ["3389"] }], nicIds: ["nic-vm1"] }],
      nics: [{ name: "nic-vm1", nsg: "nsg-vm", publicIp: "pip-vm1" }], publicIps: [{ name: "pip-vm1", hasAddress: true }],
    }).build() as NormalizedInput;
    expect(states(ruleOf(input, "AZ-NET-1"))).toEqual(["risk"]);
  });
});

/* ───────── AWS-STO-2 MatchKey (CC-QA-16) ───────── */
describe("AWS-STO-2: 버킷 리전 조회에 실패해도 같은 버킷은 같은 MatchKey다 (CC-QA-16)", () => {
  const itemOf = (r: Report): ItemResult => r.doors.flatMap((d) => d.rules).find((x) => x.ruleId === "AWS-STO-2")!.items.find((i) => i.resource.name.kind === "sensitive" && i.resource.name.full === "amzn-s3-demo-bucket-open")!;
  const known = judge(resolveFixture("micro/AWS-STO-2/public-policy"));
  const unknown = judge(resolveFixture("micro/AWS-STO-2/region-unknown"));

  it("키는 같고 화면 위치만 다르다(리전을 알면 리전, 모르면 전역 표시)", () => {
    expect(itemOf(unknown).resource.key).toBe(itemOf(known).resource.key);
    expect(itemOf(known).resource.key).toBe("aws|111122223333|s3-bucket|-|amzn-s3-demo-bucket-open");
    expect(itemOf(known).resource.location).toMatchObject({ kind: "region" });
    expect(itemOf(unknown).resource.location).toMatchObject({ kind: "global" });
  });
  it("리전을 알던 때 낸 예외 표시가 리전 조회 실패 때도 그 버킷에 붙는다 (전후 비교의 짝 맞추기도 같은 키를 쓴다)", () => {
    const file = { schema: "cloudcheck.exceptions/1.0" as const, entries: [{ ruleId: "AWS-STO-2" as const, resource: itemOf(known).resource.key, reason: "의도한 공개", until: "2026-12-31" as IsoDate, createdAt: "2026-10-01" as IsoDate }] };
    expect(overlayExceptions(known, file, "2026-10-19" as IsoDate).counts).toEqual({ active: 1, expired: 0, unmatched: 0 });
    expect(overlayExceptions(unknown, file, "2026-10-19" as IsoDate).counts).toEqual({ active: 1, expired: 0, unmatched: 0 });
  });
  it("항목 id(화면 렌더 키)도 리전 조회 성공 · 실패와 무관하게 안정적이다", () => {
    expect(itemOf(unknown).id).toBe(itemOf(known).id);
  });
});

/* ───────── 대조: 루트 키 목록 같은 다른 경로가 이번 수정으로 달라지지 않는다 ───────── */
describe("대조: 시각 허용치를 도입해도 정상 입력의 판정은 그대로다", () => {
  it("키가 만들어진 직후(같은 시각)는 나이 0일로 이상 없음이다", () => {
    const input = iamWorld({ root: GOOD_ROOT, users: [{ name: "alice", password: true, passwordLastUsed: "2026-10-10T09:00:00Z", mfa: true, keys: [{ suffix: "7QXZ", createdAt: "2026-10-19T02:58:30Z", lastUsed: null }] }] }).build();
    expect(states(ruleOf(input, "AWS-KEY-1"))).toEqual(["clear"]);
  });
});
