// AWS-NET-1 관리·DB 포트의 인터넷 노출 — 창문 · priority 30 · 최고 위험
// 구성원: 보안 그룹(aws.net.security-groups, 활성 리전 전체) + 필요한 패밀리: ENI(aws.net.enis).
//  - 위험: 인터넷 전체(0.0.0.0/0 · ::/0, 한 규칙 안의 출발지를 합쳐 전체가 되는 경우 포함)에 위험 포트(33개) 또는 전체 포트·프로토콜을 연 보안 그룹이, 공인 IP(IPv6면 IPv6 주소)가 있는 ENI에 연결돼 있음
//  - 주의: 같은 규칙이 있지만 연결된 ENI가 없거나(무장은 됐지만 연결 안 됨) 공인 IP가 없거나 확인하지 못함 / 메일 포트(25·110·143) / 80·443을 뺀 그 밖의 포트
//          / 위험 포트를 넓은 공인 대역(IPv4 /8 · IPv6 /16 이하, 사설·예약 제외, D-1b)이나 프리픽스 리스트(내용을 읽지 않음, D-4)에 연 경우(연결·공인 IP와 무관하게 주의가 상한)
//  - 이상 없음: 활성 리전을 모두 조회했고 해당 규칙이 없음. 일부 리전이 거부·누락이면 그 리전은 확인 불가이고 다른 리전에서 찾은 위험은 유지한다(INV-4).
//  - 출발지는 문자열이 아니라 주소 범위로 본다(rules/sources.ts, 결정 D-1a): trim 뒤 해석하고, 규칙 하나 안의 출발지 합집합이 전체를 덮으면 0.0.0.0/0과 같다. 규칙을 넘는 합집합은 보지 않는다(못 보는 것).
//    넓은 대역 · 프리픽스 리스트는 위험 포트에서만 주의를 만든다(메일 · 그 밖의 포트 · 80·443은 제외). 보안 그룹 참조(sgRefCount)는 내부라 판정에서 뺀다.
//  - 모르는 값은 건너뛰지 않는다(P3): 출발지가 IPv4/IPv6 CIDR 모양이 아니거나 하나도 없거나, 출발지가 판정 대상인 규칙의 프로토콜이 모르는 값이거나, tcp/udp 포트가 비었거나 거꾸로이거나 구간 전체가 0~65535 밖이면
//    그 규칙은 해석 불가다(다른 규칙·출발지에서 찾은 위험·주의는 유지하고, 찾은 것이 없으면 확인 불가). 포트 구간의 한쪽 끝만 0~65535 밖이면 범위 안쪽으로 잘라 읽는다(안전한 방향 — 열려 있는 포트가 그대로 보인다). (CC-QA-03)
//    프로토콜 번호는 IP 프로토콜 번호 0~255의 정규 표기(앞자리 0 없는 10진 정수)만 안다: 6 · 17은 tcp · udp, 그 밖의 번호(1 ICMP · 50 ESP · 58 ICMPv6 …)는 포트가 없어 건너뛴다.
//    범위 밖(256 · 999)이나 비정규 표기(006 · +6)는 AWS가 내지 않는 모양이라 모르는 값이다 — '포트 없는 프로토콜'로 건너뛰면 0.0.0.0/0의 22번 규칙이 이상 없음이 된다. (CC-QA-24)
//  - ENI 목록이 잘렸거나 받지 못했으면 '연결된 인터페이스 없음'·'공인 IP 없음'을 단정하지 않는다(sg-eni-unknown). 잘린 목록에서 공인 IP ENI가 보이면 위험은 그대로 유지한다. (CC-QA-13)
//  - 해당 없음: 활성 리전을 모두 조회했고 보안 그룹이 0개(na-no-security-groups). 근거 줄이 주의 사유(메일 포트 …)로 나가지 않게 따로 말한다(디자인 검수 K-1).
//  - 대상(보안 그룹)의 사유는 가장 앞선 발견: 전체×위험 포트(위험/주의) > 넓은 대역×위험 포트 > 프리픽스 리스트×위험 포트 > 전체×메일 > 전체×그 밖의 포트 (결정 §2-3 ⑥).
//  - 룰 수준 주의 사유: 주의 대상의 범주(연결 불명 · 출발지 확인 · 그 밖의 포트 · 메일)가 하나면 그 범주의 사유, 둘 이상이면 공통 사유(open-review)로 주의 전체 개수를 센다(K-6).
import type { AwsEni, AwsNetData, AwsSecurityGroup, Slot } from "../../contract/normalized";
import type { Ev, Member, RuleCtx } from "../../engine/types";
import type { FactCode } from "../../model/report";
import type { RMsg } from "../../engine/types";
import { BROAD_IPV4_PREFIX, BROAD_IPV6_PREFIX, RESERVED_IPV4_RANGES, RISKY_PORTS, MAIL_PORTS } from "../params";
import { classifyPorts, portList, subtract } from "../ports";
import type { Interval } from "../ports";
import { classifyAwsSources } from "../sources";
import { C, N, buildSpec, defineRule, evs, fact, findings, inRegion, mCaution, mClear, mRisk, mUnknown, read, reasons, write } from "../kit";

const ID = "AWS-NET-1" as const;
const R = reasons(ID);
const F = findings(ID);

export const spec = buildSpec({
  id: ID, door: "net", maxStatus: "risk", allowsClear: true, priority: 30,
  cond: ["risk", "caution", "clear", "na", "unknown"], impact: true, question: true,
  paths: ["collector"],
  params: [
    { name: "risky-ports", value: [...RISKY_PORTS], basis: "tool-default" },
    { name: "mail-ports", value: [...MAIL_PORTS], basis: "tool-default" },
    { name: "web-ports", value: [80, 443], basis: "public-standard" },
    { name: "broad-prefix", value: [BROAD_IPV4_PREFIX, BROAD_IPV6_PREFIX], basis: "tool-default" },
    { name: "reserved-ranges", value: [...RESERVED_IPV4_RANGES], basis: "public-standard" },
  ],
  cannotSee: 6, falsePositives: 2,
  fix: {
    impact: "medium", prodImpact: true,
    observe: {
      doc: "https://docs.aws.amazon.com/vpc/latest/userguide/working-with-security-group-rules.html",
      commands: [
        read("aws", "aws ec2 describe-network-interfaces --filters Name=group-id,Values=[[security-group-id]]"),
        read("aws", "aws ec2 get-managed-prefix-list-entries --prefix-list-id [[prefix-list-id]]"),
      ],
    },
    change: {
      property: "Security group inbound rule (IpPermissions)",
      doc: "https://docs.aws.amazon.com/vpc/latest/userguide/working-with-security-group-rules.html",
      commands: [
        write("aws", "aws ec2 authorize-security-group-ingress --group-id [[security-group-id]] --protocol tcp --port [[port]] --cidr [[allowed-cidr]]"),
        write("aws", "aws ec2 revoke-security-group-ingress --group-id [[security-group-id]] --protocol tcp --port [[port]] --cidr 0.0.0.0/0"),
        write("aws", "aws ec2 revoke-security-group-ingress --group-id [[security-group-id]] --ip-permissions IpProtocol=tcp,FromPort=[[port]],ToPort=[[port]],Ipv6Ranges=[{CidrIpv6=::/0}]"),
      ],
    },
    revert: { commands: [write("aws", "aws ec2 authorize-security-group-ingress --group-id [[security-group-id]] --protocol tcp --port [[port]] --cidr [[removed-cidr]]")] },
    runbook: null,
  },
  guide: null,
  basis: [
    { name: "securityhub-ec2-19", url: "https://docs.aws.amazon.com/securityhub/latest/userguide/ec2-controls.html", kind: "benchmark" },
    { name: "security-group-rules", url: "https://docs.aws.amazon.com/vpc/latest/userguide/working-with-security-group-rules.html", kind: "doc" },
  ],
  incident: null,
  lastVerified: "2026-10-20",
  families: { item: "aws.net.security-groups", needs: ["aws.net.enis"] },
  calls: ["ec2:DescribeRegions", "ec2:DescribeSecurityGroups", "ec2:DescribeNetworkInterfaces"],
  reasons: {
    "exposed-with-public-ip": ["ports", "n"], "exposed-unattached": ["n"], "open-mail-port": ["n"], "open-other-port": ["n"], "open-review": ["n"], "none-open": ["n"], "na-no-security-groups": [],
    "sg-public": ["ports"], "sg-eni-unknown": ["ports"], "sg-unattached": ["ports"], "sg-private": ["ports"], "sg-mail": ["ports"], "sg-other": ["ports"], "sg-closed": [],
    "sg-source-broad": ["ports"], "sg-source-prefix-list": ["ports"], "open-unclear-source": ["n"],
  },
  facts: { "port-cidr": ["port", "cidr"], "port-prefix-list": ["port", "list"], "public-ip-attached": [], "public-ip-unknown": [], "no-attached-interface": [], "private-only": [], "sg-name": ["name"] },
  how: true,
  fixtures: {
    pass: "micro/AWS-NET-1/pass",
    violate: ["micro/AWS-NET-1/public-ssh", "micro/AWS-NET-1/unattached", "micro/AWS-NET-1/other-port", "micro/AWS-NET-1/split-world", "micro/AWS-NET-1/broad-v4", "micro/AWS-NET-1/prefix-list"],
    denied: { call: "ec2:DescribeSecurityGroups", region: "us-east-1", expect: "unknown" },
    truncated: { call: "ec2:DescribeNetworkInterfaces", expect: "unknown" },
    missingField: { path: "doors.net.data.regions", expect: "unknown" },
    versionMismatch: "auto",
  },
});

type Tier = "risky" | "mail" | "other";
/** 출발지 종류: 인터넷 전체(whole) · 넓은 공인 대역(broad) · 프리픽스 리스트(list) */
type Kind = "whole" | "broad" | "list";
interface Exposure {
  readonly kind: Kind;
  readonly tier: Tier;
  /** whole일 때 어느 쪽 전체인가(공인 IPv4 · IPv6 ENI와 맞추는 데 쓴다) */
  readonly v4: boolean;
  readonly v6: boolean;
  readonly ports: readonly number[];
  readonly all: boolean;
  readonly other: readonly Interval[];
  /** 사실 줄에 보일 출발지: whole = 접두 ≤ /8(IPv6 /16)인 조각(없으면 0.0.0.0/0 · ::/0), broad = 넓은 대역 */
  readonly cidrs: readonly string[];
  /** list일 때 프리픽스 리스트 ID */
  readonly lists: readonly string[];
}

/**
 * tcp/udp 포트 구간. 정수가 아니거나(null 포함) 거꾸로(from > to)이거나 구간 전체가 0~65535 밖이면 null(해석 불가).
 * 한쪽 끝만 범위 밖이면 범위 안쪽으로 자른다 — 열려 있는 포트가 있으면 그대로 보이게(위험을 이상 없음으로 접지 않는다).
 */
function portInterval(from: number | null, to: number | null): Interval | null {
  if (from === null || to === null || !Number.isInteger(from) || !Number.isInteger(to) || from > to) return null;
  if (to < 0 || from > 65535) return null;
  return [Math.max(0, from), Math.min(65535, to)];
}

/** IP 프로토콜 번호(0~255)의 정규 표기인가: 앞자리 0 없는 10진 정수만. 범위 밖 · "006" · "+6" · "6.0"은 아니다(모르는 값, CC-QA-24) */
const isProtocolNumber = (s: string): boolean => /^(0|[1-9]\d{0,2})$/.test(s) && Number(s) <= 255;

function exposures(sg: AwsSecurityGroup): { list: Exposure[]; unrecognized: boolean } {
  const list: Exposure[] = [];
  let unrecognized = false;
  for (const rule of sg.ingress) {
    // 출발지: trim 뒤 주소 범위로 읽는다. 모르는 모양(출발지가 하나도 없는 규칙 포함)은 건너뛰지 않고 해석 불가로 센다
    const src = classifyAwsSources(rule);
    if (src.unrecognized) unrecognized = true;
    const whole = src.whole4 || src.whole6;
    const hasBroad = src.broad.length > 0;
    const hasList = src.prefixLists.length > 0;
    if (!whole && !hasBroad && !hasList) continue;
    // 프로토콜: -1 · tcp(6) · udp(17)만 포트로 읽는다. icmp · icmpv6 · 그 밖의 IP 프로토콜 번호(0~255 정규 표기)는 포트가 없다.
    // 그 밖의 문자열(범위 밖 번호 · 앞자리 0 · 모르는 이름)은 해석 불가(CC-QA-24)
    const proto = rule.protocol.trim().toLowerCase();
    let iv: readonly Interval[];
    if (proto === "-1") iv = [[0, 65535]];
    else if (proto === "tcp" || proto === "udp" || proto === "6" || proto === "17") {
      const one = portInterval(rule.fromPort, rule.toPort);
      if (one === null) { unrecognized = true; continue; }
      iv = [one];
    } else if (proto === "icmp" || proto === "icmpv6" || isProtocolNumber(proto)) continue;
    else { unrecognized = true; continue; }
    const pc = classifyPorts(iv);
    const riskyHit = pc.all || pc.risky.length > 0;
    const riskyPorts = pc.all ? [] : pc.risky;
    if (whole) {
      const cidrs = [...(src.whole4 ? src.wholeText4 : []), ...(src.whole6 ? src.wholeText6 : [])];
      const base = { kind: "whole" as const, v4: src.whole4, v6: src.whole6, cidrs, lists: [] as string[] };
      if (riskyHit) list.push({ ...base, tier: "risky", ports: riskyPorts, all: pc.all, other: [] });
      else if (pc.mail.length > 0) list.push({ ...base, tier: "mail", ports: pc.mail, all: false, other: [] });
      else if (pc.other) {
        const known: Interval[] = [...RISKY_PORTS, ...MAIL_PORTS, 80, 443].map((p): Interval => [p, p]);
        list.push({ ...base, tier: "other", ports: [], all: false, other: subtract(iv, known) });
      }
    }
    // 넓은 공인 대역 · 프리픽스 리스트: 위험 포트에서만 본다(메일 · 그 밖의 포트 · 80·443은 판정에서 뺀다 — 결정 §2-2)
    if (riskyHit && hasBroad) list.push({ kind: "broad", tier: "risky", v4: false, v6: false, ports: riskyPorts, all: pc.all, other: [], cidrs: src.broad.slice(0, 3), lists: [] });
    if (riskyHit && hasList) list.push({ kind: "list", tier: "risky", v4: false, v6: false, ports: riskyPorts, all: pc.all, other: [], cidrs: [], lists: src.prefixLists });
  }
  return { list, unrecognized };
}

const rangeText = (iv: readonly Interval[]): string => iv.slice(0, 3).map(([a, b]) => (a === b ? String(a) : `${a}-${b}`)).join(", ");
/** 위험 포트 표기: 전체 포트가 하나라도 있으면 "0-65535", 아니면 포트 번호 오름차순 나열 */
const portsOf = (exps: readonly Exposure[]): string =>
  exps.some((e) => e.all) ? "0-65535" : portList([...new Set(exps.flatMap((e) => [...e.ports]))].sort((a, b) => a - b));

/** 사실 줄: 포트 × 출발지(whole · broad) 또는 포트 × 프리픽스 리스트(list). 앞선 발견이 먼저 보이게 종류 순으로 늘어놓고 6개까지 */
const KIND_RANK: Readonly<Record<string, number>> = { "whole|risky": 0, "broad|risky": 1, "list|risky": 2, "whole|mail": 3, "whole|other": 4 };
function portFacts(list: readonly Exposure[]): RMsg<FactCode>[] {
  const ordered = [...list].sort((a, b) => (KIND_RANK[`${a.kind}|${a.tier}`] ?? 9) - (KIND_RANK[`${b.kind}|${b.tier}`] ?? 9));
  return ordered.flatMap((e): RMsg<FactCode>[] => {
    const ports = e.all ? ["0-65535"] : e.tier === "other" ? [rangeText(e.other)] : e.ports.map(String);
    if (e.kind === "list") {
      return ports.slice(0, 2).flatMap((p) => e.lists.slice(0, 3).map((id) => fact("port-prefix-list", { port: C(p), list: { raw: { type: "resourceName", value: id, prefix: "prefix-list" } } })));
    }
    return ports.slice(0, 4).flatMap((p) => e.cidrs.map((c) => fact("port-cidr", { port: C(p), cidr: C(c) })));
  }).slice(0, 6);
}

function evalSg(sg: AwsSecurityGroup, enis: Slot<readonly AwsEni[]> | undefined): Member {
  // 범위 표의 구성원 신원은 "<리전>/<ID>"(리전 단위 ID)다. MatchKey의 위치 마디가 리전을 따로 가지므로 id에는 ID만 두고 familyKey로 맞춘다
  const res = { type: "security-group" as const, name: { type: "resourceName" as const, value: sg.id }, where: inRegion(sg.region), id: sg.id, familyKey: `${sg.region}/${sg.id}` };
  const nameFact = fact("sg-name", { name: { raw: { type: "groupName", value: sg.name } } });
  const { list, unrecognized } = exposures(sg);
  const baseEv: Ev[] = evs(sg.src);
  if (list.length === 0) {
    return unrecognized ? mUnknown(res, "value-unrecognized", baseEv, { facts: [nameFact] }) : mClear(res, R("sg-closed"), baseEv, { facts: [nameFact] });
  }
  const pcFacts = portFacts(list);
  const risky = list.filter((e) => e.kind === "whole" && e.tier === "risky");
  if (risky.length > 0) {
    const ports = portsOf(risky);
    const v4 = risky.some((e) => e.v4);
    const v6 = risky.some((e) => e.v6);
    // 잘린(partial) 목록은 본 만큼만 믿는다: 공인 IP ENI가 보이면 위험이지만, 보이지 않는다고 '연결 없음'이나 '공인 IP 없음'을 말할 수는 없다(CC-QA-13)
    const eniSeen = enis !== undefined && (enis.k === "value" || enis.k === "partial");
    const eniComplete = enis !== undefined && enis.k === "value";
    const attached: readonly AwsEni[] = eniSeen ? enis.value.filter((e) => e.groupIds.includes(sg.id)) : [];
    const exposed = attached.filter((e) => (v4 && e.hasPublicIp) || (v6 && e.hasIpv6));
    const params = { ports: C(ports) };
    if (exposed.length > 0) return mRisk(res, F("sg-public", params), evs(sg.src, ...exposed.map((e) => e.src)), { facts: [nameFact, ...pcFacts, fact("public-ip-attached")] });
    if (!eniComplete) return mCaution(res, F("sg-eni-unknown", params), baseEv, { facts: [nameFact, ...pcFacts, fact("public-ip-unknown")] });
    if (attached.length === 0) return mCaution(res, F("sg-unattached", params), evs(sg.src, enis.src), { facts: [nameFact, ...pcFacts, fact("no-attached-interface")] });
    return mCaution(res, F("sg-private", params), evs(sg.src, ...attached.map((e) => e.src)), { facts: [nameFact, ...pcFacts, fact("private-only")] });
  }
  // 넓은 공인 대역 · 프리픽스 리스트에 위험 포트를 연 경우: 연결·공인 IP와 무관하게 주의가 상한이다(위험은 아니다 — 결정 D-1b · D-4)
  const broad = list.filter((e) => e.kind === "broad");
  if (broad.length > 0) return mCaution(res, F("sg-source-broad", { ports: C(portsOf(broad)) }), baseEv, { facts: [nameFact, ...pcFacts] });
  const lists = list.filter((e) => e.kind === "list");
  if (lists.length > 0) return mCaution(res, F("sg-source-prefix-list", { ports: C(portsOf(lists)) }), baseEv, { facts: [nameFact, ...pcFacts] });
  const mail = list.filter((e) => e.tier === "mail");
  if (mail.length > 0) return mCaution(res, F("sg-mail", { ports: C(portList([...new Set(mail.flatMap((e) => [...e.ports]))].sort((a, b) => a - b))) }), baseEv, { facts: [nameFact, ...pcFacts] });
  const other = list.filter((e) => e.tier === "other");
  return mCaution(res, F("sg-other", { ports: C(rangeText(other.flatMap((e) => [...e.other]))) }), baseEv, { facts: [nameFact, ...pcFacts] });
}

function evaluate(ctx: RuleCtx<AwsNetData>) {
  const members: Member[] = [];
  const enisBy = new Map<string, Slot<readonly AwsEni[]>>(ctx.data.networkInterfaces.map((p) => [p.region, p.items]));
  for (const per of ctx.data.securityGroups) {
    // 이 리전의 보안 그룹 목록을 못 받았다: 대상이 없다 → 범위 증명(리전 단위)의 빈틈이 확인 불가를 만든다
    if (per.items.k !== "value" && per.items.k !== "partial") continue;
    for (const sg of per.items.value) members.push(evalSg(sg, enisBy.get(per.region)));
  }
  return { members, coverage: ctx.scope };
}

export const AWS_NET_1 = defineRule<"aws", "net">({
  spec, evaluate,
  explain: (x) => {
    const code = (m: Member): string => m.why.code.split(":")[1];
    if (x.status === "na") return { msg: R("na-no-security-groups") };
    if (x.status === "clear") return { msg: R("none-open", { n: N(x.unitTotal ?? x.applicable ?? x.members.length) }) };
    if (x.status === "risk") {
      const ports = [...new Set(x.members.flatMap((m) => (m.why.params?.ports !== undefined && "c" in m.why.params.ports ? m.why.params.ports.c.split(", ") : [])))];
      return { msg: R("exposed-with-public-ip", { ports: C(ports.length === 0 ? "-" : ports.join(", ")), n: N(x.members.length) }) };
    }
    const count = (slugs: readonly string[]): number => x.members.filter((m) => slugs.includes(code(m))).length;
    const attach = count(["sg-eni-unknown", "sg-unattached", "sg-private"]);
    const source = count(["sg-source-broad", "sg-source-prefix-list"]);
    const other = count(["sg-other"]);
    const mail = count(["sg-mail"]);
    // 범주가 둘 이상이면 어느 한 범주의 개수가 아니라 주의 전체 개수를 공통 사유로 말한다(대상 표의 주의 개수와 같아야 한다)
    if ([attach, source, other, mail].filter((c) => c > 0).length > 1) return { msg: R("open-review", { n: N(attach + source + other + mail) }) };
    if (attach > 0) return { msg: R("exposed-unattached", { n: N(attach) }) };
    if (source > 0) return { msg: R("open-unclear-source", { n: N(source) }) };
    if (other > 0) return { msg: R("open-other-port", { n: N(other) }) };
    return { msg: R("open-mail-port", { n: N(mail) }) };
  },
});
