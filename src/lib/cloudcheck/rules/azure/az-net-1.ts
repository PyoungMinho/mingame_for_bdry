// AZ-NET-1 관리·DB 포트의 인터넷 노출(NSG) — 창문 · priority 40 · 최고 위험(CSV 경로는 최고 주의)
// 구성원: NSG(azure.net.nsgs) + 필요한 패밀리: NIC(azure.net.nics), 공인 IP(azure.net.public-ips).
//  - 위험: 인바운드 Allow + 출발지 전체(*·Internet·Any·0.0.0.0/0·::/0, 한 규칙 안의 출발지를 합쳐 전체가 되는 경우 포함) + 위험 포트(또는 전체) + 같은 범위를 막는 더 높은 우선순위(작은 번호) Deny 없음(단순 평가)
//          + 공인 IP가 있는 NIC나, 그런 NIC가 있는 서브넷에 연결됨
//  - 주의: 같은 규칙이 있지만 연결·공인 IP를 알 수 없거나(Resource Graph CSV 경로) 연결돼 있지 않음 / 메일 포트 / 80·443 밖의 그 밖의 포트
//          / 위험 포트를 넓은 공인 대역(IPv4 /8 · IPv6 /16 이하, 사설·예약 제외, D-1b)이나 서비스 태그(VirtualNetwork · AzureLoadBalancer 제외, D-3a)에 연 경우(연결·공인 IP와 무관하게 주의가 상한)
//  - 이상 없음: 수집기 경로로 조회한 구독이 전부 성공했고 해당 규칙이 없음. CSV는 규칙 행이 잘렸는지 알 수 없어 NSG 단위 '없음'도 주지 않는다.
//  - 출발지는 문자열이 아니라 주소 범위로 본다(rules/sources.ts, 결정 D-1a · D-3): trim 뒤 해석하고, 서비스 태그는 영문자로 시작하는 태그 모양 값이다.
//    ASG 출발지(sourceAsgCount ≥ 1) · VirtualNetwork · AzureLoadBalancer · 좁은 CIDR은 인터넷 출발지가 아니라 판정에서 뺀다(D-3b: 기획서 §6-2의 'ASG가 섞이면 주의'를 뺀 명세 변경).
//    Deny는 출발지가 '전체'(합집합 포함)일 때만 그 포트를 뺀다 — 넓은 대역 · 태그 · 좁은 Deny는 노출을 지우지 못한다.
//  - 모르는 값은 건너뛰지 않는다(P3): 방향(Inbound · Outbound)·허용(Allow · Deny)이 그 밖의 값이거나, 인바운드 Allow 규칙의 프로토콜이 Tcp · Udp · Icmp · Esp · Ah · * · Any 밖이거나,
//    출발지가 CIDR · IP · 태그 모양이 아니거나 하나도 없거나(접두 0개 + ASG 0개 · 보고서 CSV는 ASG 모름), 출발지가 판정 대상인 Allow 규칙의 포트 칸이 비었거나 읽을 수 없는 조각이 있으면
//    그 규칙은 해석 불가다(다른 규칙에서 찾은 위험·주의는 유지하고, 찾은 것이 없으면 확인 불가). (CC-QA-17)
//  - 해당 없음: 조회한 구독에 NSG가 0개(na-no-nsgs). 근거 줄이 주의 사유(메일 포트 …)로 나가지 않게 따로 말한다(디자인 검수 K-1).
//  - 대상(NSG)의 사유는 가장 앞선 발견: 전체×위험 포트(위험/주의) > 넓은 대역×위험 포트 > 서비스 태그×위험 포트 > 전체×메일 > 전체×그 밖의 포트 (결정 §2-3 ⑥).
//  - 룰 수준 주의 사유: 주의 대상의 범주(연결 불명 · 출발지 확인 · 그 밖의 포트 · 메일)가 하나면 그 범주의 사유, 둘 이상이면 공통 사유(open-review)로 주의 전체 개수를 센다(K-6).
//  - 못 보는 것: Azure Firewall · ASG 멤버십 · Bastion·JIT · 로드밸런서 인바운드 NAT · 서비스 태그의 실제 주소 범위 · 사용자 정의 경로로 넓어지는 VirtualNetwork 태그 · 실제 응답 여부
import type { AzureNic, AzureNetData, AzureNsg, AzureNsgRule, AzurePublicIp, Slot } from "../../contract/normalized";
import type { Ev, Member, RMsg, RuleCtx } from "../../engine/types";
import type { FactCode } from "../../model/report";
import { BROAD_IPV4_PREFIX, BROAD_IPV6_PREFIX, MAIL_PORTS, RESERVED_IPV4_RANGES, RISKY_PORTS } from "../params";
import { classifyPorts, parsePortSpec, portList, subtract } from "../ports";
import type { Interval } from "../ports";
import { classifyAzureSources } from "../sources";
import { C, N, buildSpec, defineRule, evs, fact, findings, inSubscription, mCaution, mClear, mRisk, mUnknown, read, reasons, write } from "../kit";
import { why } from "./common";

const ID = "AZ-NET-1" as const;
const R = reasons(ID);
const F = findings(ID);
const DOC_NSG = "https://learn.microsoft.com/en-us/azure/virtual-network/network-security-groups-overview";
const DOC_MANAGE = "https://learn.microsoft.com/en-us/azure/virtual-network/manage-network-security-group";

export const spec = buildSpec({
  id: ID, door: "net", maxStatus: "risk", allowsClear: true, priority: 40,
  cond: ["risk", "caution", "clear", "na", "unknown"], impact: true, question: true,
  paths: ["csv", "collector"],
  params: [
    { name: "risky-ports", value: [...RISKY_PORTS], basis: "tool-default" },
    { name: "mail-ports", value: [...MAIL_PORTS], basis: "tool-default" },
    { name: "web-ports", value: [80, 443], basis: "public-standard" },
    { name: "broad-prefix", value: [BROAD_IPV4_PREFIX, BROAD_IPV6_PREFIX], basis: "tool-default" },
    { name: "reserved-ranges", value: [...RESERVED_IPV4_RANGES], basis: "public-standard" },
  ],
  cannotSee: 7, falsePositives: 2,
  fix: {
    impact: "medium", prodImpact: true,
    observe: { doc: DOC_MANAGE, commands: [read("az", "az network nsg rule list --resource-group [[resource-group-name]] --nsg-name [[nsg-name]]")] },
    change: {
      property: "securityRules (sourceAddressPrefix · destinationPortRange)",
      doc: DOC_MANAGE,
      commands: [
        write("az", "az network nsg rule update --resource-group [[resource-group-name]] --nsg-name [[nsg-name]] --name [[rule-name]] --source-address-prefixes [[allowed-cidr]]"),
        write("az", "az network nsg rule delete --resource-group [[resource-group-name]] --nsg-name [[nsg-name]] --name [[rule-name]]"),
      ],
    },
    revert: { commands: [write("az", "az network nsg rule create --resource-group [[resource-group-name]] --nsg-name [[nsg-name]] --name [[rule-name]] --priority [[rule-priority]] --access Allow --protocol Tcp --destination-port-ranges [[port]] --source-address-prefixes [[removed-source]]")] },
    runbook: null,
  },
  guide: null,
  basis: [
    { name: "nsg-overview", url: DOC_NSG, kind: "doc" },
    { name: "manage-nsg", url: DOC_MANAGE, kind: "doc" },
    { name: "securityhub-ec2-19", url: "https://docs.aws.amazon.com/securityhub/latest/userguide/ec2-controls.html", kind: "benchmark" },
  ],
  incident: null,
  lastVerified: "2026-10-20",
  families: { item: "azure.net.nsgs", needs: ["azure.net.nics", "azure.net.public-ips"] },
  calls: ["azure:account.list", "azure:network.nsg.list", "azure:network.nic.list", "azure:network.public-ip.list"],
  reasons: {
    "exposed-with-public-ip": ["ports", "n"], "exposed-unattached": ["n"], "open-mail-port": ["n"], "open-other-port": ["n"], "open-review": ["n"], "none-open": ["n"], "na-no-nsgs": [],
    "nsg-public": ["ports"], "nsg-attachment-unknown": ["ports"], "nsg-unattached": ["ports"], "nsg-private": ["ports"], "nsg-mail": ["ports"], "nsg-other": ["ports"], "nsg-closed": [],
    "nsg-source-broad": ["ports"], "nsg-source-service-tag": ["ports", "tag"], "open-unclear-source": ["n"],
  },
  facts: { "port-cidr": ["port", "cidr"], "public-ip-attached": [], "public-ip-unknown": [], "no-attached-interface": [], "private-only": [], "nsg-name": ["name"] },
  how: true,
  fixtures: {
    pass: "micro/AZ-NET-1/pass",
    violate: ["micro/AZ-NET-1/public-rdp", "micro/AZ-NET-1/csv-attachment-unknown", "micro/AZ-NET-1/service-tag", "micro/AZ-NET-1/broad-source"],
    denied: { call: "azure:network.nsg.list", expect: "unknown" },
    truncated: { call: "azure:network.nsg.list", expect: "unknown" },
    missingField: { path: "doors.net.data.nsgs[0].items", expect: "unknown" },
    versionMismatch: "auto",
  },
});

const lc = (s: string): string => s.trim().toLowerCase();
const protoOf = (r: AzureNsgRule): string => lc(r.protocol);
const isTcpUdpAny = (p: string): boolean => p === "tcp" || p === "udp" || p === "*" || p === "any";
/** NSG 규칙이 가질 수 있는 프로토콜(포트가 없는 icmp · esp · ah 포함). 그 밖은 해석 불가 */
const KNOWN_PROTOCOLS: ReadonlySet<string> = new Set(["tcp", "udp", "*", "any", "icmp", "esp", "ah"]);
const covers = (deny: string, allow: string): boolean => deny === "*" || deny === "any" || deny === allow;

type Tier = "risky" | "mail" | "other";
/** 출발지 종류: 출발지 전체(whole) · 넓은 공인 대역(broad) · 서비스 태그(tag) */
type Kind = "whole" | "broad" | "tag";
interface Exposure {
  readonly kind: Kind;
  readonly tier: Tier;
  readonly ports: readonly number[];
  readonly all: boolean;
  readonly other: readonly Interval[];
  /** 사실 줄의 출발지 칸: whole = "*" 또는 접두 ≤ /8 조각, broad = 넓은 대역, tag = 태그 이름 */
  readonly sources: readonly string[];
  readonly rule: string;
}

/**
 * 위험 노출 계산: 인바운드 Allow(출발지 전체 · 넓은 대역 · 서비스 태그)에서 더 높은 우선순위(작은 번호)의 출발지 전체 Deny가 막는 포트를 뺀다.
 * 넓은 대역 · 서비스 태그는 위험 포트에서만 노출로 센다(메일 · 그 밖의 포트 · 80·443은 판정에서 뺀다 — 결정 §2-2).
 */
function exposuresOf(rules: readonly AzureNsgRule[]): { list: Exposure[]; unrecognized: boolean } {
  const list: Exposure[] = [];
  let unrecognized = false;
  // 모르는 방향 · 허용 값은 규칙을 건너뛰지 않고 해석 불가로 센다(P3)
  for (const r of rules) {
    const dir = lc(r.direction);
    const acc = lc(r.access);
    if (!(dir === "inbound" || dir === "outbound") || !(acc === "allow" || acc === "deny")) unrecognized = true;
  }
  const inbound = rules.filter((r) => lc(r.direction) === "inbound").sort((a, b) => a.priority - b.priority);
  inbound.forEach((r, i) => {
    if (lc(r.access) !== "allow") return;
    const proto = protoOf(r);
    if (!KNOWN_PROTOCOLS.has(proto)) { unrecognized = true; return; }
    // 출발지: trim 뒤 주소 범위 · 태그로 읽는다. 모르는 모양(출발지가 하나도 없는 규칙 포함)은 건너뛰지 않고 해석 불가로 센다
    const src = classifyAzureSources(r.sourcePrefixes, r.sourceAsgCount);
    if (src.unrecognized) unrecognized = true;
    if (!isTcpUdpAny(proto)) return;
    if (!src.whole && src.broad.length === 0 && src.tags.length === 0) return;
    const spec_ = parsePortSpec(r.destPortRanges);
    if (!spec_.ok) unrecognized = true;                 // 읽은 조각이 있으면 그것으로 양성은 계속 본다
    if (spec_.intervals.length === 0) return;
    let effective: readonly Interval[] = spec_.intervals;
    for (const d of inbound.slice(0, i)) {
      if (lc(d.access) !== "deny" || !covers(protoOf(d), proto)) continue;
      if (!classifyAzureSources(d.sourcePrefixes, d.sourceAsgCount).whole) continue;   // 막는 범위가 전체가 아니면 노출이 남는다
      const dp = parsePortSpec(d.destPortRanges);
      if (dp.ok) effective = subtract(effective, dp.intervals);
    }
    const pc = classifyPorts(effective);
    const riskyHit = pc.all || pc.risky.length > 0;
    const riskyPorts = pc.all ? [] : pc.risky;
    if (src.whole) {
      if (riskyHit) list.push({ kind: "whole", tier: "risky", ports: riskyPorts, all: pc.all, other: [], sources: src.wholeText, rule: r.name });
      else if (pc.mail.length > 0) list.push({ kind: "whole", tier: "mail", ports: pc.mail, all: false, other: [], sources: src.wholeText, rule: r.name });
      else if (pc.other) {
        const known: Interval[] = [...RISKY_PORTS, ...MAIL_PORTS, 80, 443].map((p): Interval => [p, p]);
        list.push({ kind: "whole", tier: "other", ports: [], all: false, other: subtract(effective, known), sources: src.wholeText, rule: r.name });
      }
    }
    if (riskyHit && src.broad.length > 0) list.push({ kind: "broad", tier: "risky", ports: riskyPorts, all: pc.all, other: [], sources: src.broad.slice(0, 3), rule: r.name });
    if (riskyHit && src.tags.length > 0) list.push({ kind: "tag", tier: "risky", ports: riskyPorts, all: pc.all, other: [], sources: src.tags.slice(0, 3), rule: r.name });
  });
  return { list, unrecognized };
}

const rangeText = (iv: readonly Interval[]): string => iv.slice(0, 3).map(([a, b]) => (a === b ? String(a) : `${a}-${b}`)).join(", ");
/** 위험 포트 표기: 전체 포트가 하나라도 있으면 "0-65535", 아니면 포트 번호 오름차순 나열 */
const portsOf = (exps: readonly Exposure[]): string =>
  exps.some((e) => e.all) ? "0-65535" : portList([...new Set(exps.flatMap((e) => [...e.ports]))].sort((a, b) => a - b));
/** 사실 줄: 포트 × 출발지(전체 · 넓은 대역 · 서비스 태그). 앞선 발견이 먼저 보이게 종류 순으로 늘어놓고 6개까지 */
const KIND_RANK: Readonly<Record<string, number>> = { "whole|risky": 0, "broad|risky": 1, "tag|risky": 2, "whole|mail": 3, "whole|other": 4 };
function portFacts(list: readonly Exposure[]): RMsg<FactCode>[] {
  const ordered = [...list].sort((a, b) => (KIND_RANK[`${a.kind}|${a.tier}`] ?? 9) - (KIND_RANK[`${b.kind}|${b.tier}`] ?? 9));
  return ordered.flatMap((e): RMsg<FactCode>[] => {
    const ports = e.all ? ["0-65535"] : e.tier === "other" ? [rangeText(e.other)] : e.ports.map(String);
    return ports.slice(0, 4).flatMap((p) => e.sources.map((c) => fact("port-cidr", { port: C(p), cidr: C(c) })));
  }).slice(0, 6);
}
const valueOf = <T,>(s: Slot<readonly T[]> | undefined): readonly T[] | null => (s !== undefined && (s.k === "value" || s.k === "partial") ? s.value : null);

interface Attach {
  readonly known: boolean;
  readonly nics: readonly AzureNic[];
  readonly publicNics: readonly AzureNic[];
  readonly srcs: Ev[];
}

function attachmentOf(nsg: AzureNsg, data: AzureNetData): Attach {
  const nicsPer = data.nics.find((p) => p.subscription === nsg.subscription);
  const ipsPer = data.publicIps.find((p) => p.subscription === nsg.subscription);
  const nics = valueOf<AzureNic>(nicsPer?.items);
  const ips = valueOf<AzurePublicIp>(ipsPer?.items);
  const nicIds = valueOf<string>(nsg.nicIds);
  const subnetIds = valueOf<string>(nsg.subnetIds);
  const nicsComplete = nicsPer !== undefined && nicsPer.items.k === "value";
  const ipsComplete = ipsPer !== undefined && ipsPer.items.k === "value";
  if (nics === null || ips === null || !nicsComplete || !ipsComplete || nicIds === null || subnetIds === null || nsg.nicIds.k !== "value" || nsg.subnetIds.k !== "value") {
    return { known: false, nics: [], publicNics: [], srcs: [] };
  }
  const linked = nics.filter((n) => n.nsgId === nsg.id || n.ipConfigs.some((c) => c.subnetId !== null && subnetIds.includes(c.subnetId)));
  const publicNics = linked.filter((n) => n.ipConfigs.some((c) => c.publicIpId !== null && ips.some((p) => p.id === c.publicIpId && p.hasAddress)));
  return { known: true, nics: linked, publicNics, srcs: evs(nsg.nicIds.src, nsg.subnetIds.src, nicsPer?.items.src, ipsPer?.items.src) };
}

function evalNsg(nsg: AzureNsg, data: AzureNetData, listPartial: boolean): Member {
  const res = { type: "nsg" as const, name: { type: "resourceName" as const, value: nsg.name }, where: inSubscription(nsg.subscription), id: nsg.id };
  const nameFact = fact("nsg-name", { name: { raw: { type: "resourceName", value: nsg.name, prefix: "nsg" } } });
  const known = nsg.rules.flatMap((s) => (s.k === "value" ? [s.value] : []));
  const badRule = nsg.rules.find((s) => s.k !== "value");
  const { list, unrecognized } = exposuresOf(known);
  const ruleSrcs: Ev[] = evs(nsg.src, ...nsg.rules.map((s) => s.src));
  const pcFacts = portFacts(list);

  const risky = list.filter((e) => e.kind === "whole" && e.tier === "risky");
  if (risky.length > 0) {
    const ports = portsOf(risky);
    const at = attachmentOf(nsg, data);
    const params = { ports: C(ports) };
    if (at.known && at.publicNics.length > 0) return mRisk(res, F("nsg-public", params), [...ruleSrcs, ...at.srcs], { facts: [nameFact, ...pcFacts, fact("public-ip-attached")] });
    if (!at.known) return mCaution(res, F("nsg-attachment-unknown", params), ruleSrcs, { facts: [nameFact, ...pcFacts, fact("public-ip-unknown")] });
    if (at.nics.length === 0) return mCaution(res, F("nsg-unattached", params), [...ruleSrcs, ...at.srcs], { facts: [nameFact, ...pcFacts, fact("no-attached-interface")] });
    return mCaution(res, F("nsg-private", params), [...ruleSrcs, ...at.srcs], { facts: [nameFact, ...pcFacts, fact("private-only")] });
  }
  // 넓은 공인 대역 · 서비스 태그에 위험 포트를 연 경우: 연결·공인 IP와 무관하게 주의가 상한이다(위험은 아니다 — 결정 D-1b · D-3a)
  const broad = list.filter((e) => e.kind === "broad");
  if (broad.length > 0) return mCaution(res, F("nsg-source-broad", { ports: C(portsOf(broad)) }), ruleSrcs, { facts: [nameFact, ...pcFacts] });
  const tagged = list.filter((e) => e.kind === "tag");
  if (tagged.length > 0) {
    const tags = [...new Set(tagged.flatMap((e) => [...e.sources]))].slice(0, 3).join(", ");
    return mCaution(res, F("nsg-source-service-tag", { ports: C(portsOf(tagged)), tag: C(tags) }), ruleSrcs, { facts: [nameFact, ...pcFacts] });
  }
  const mail = list.filter((e) => e.tier === "mail");
  if (mail.length > 0) return mCaution(res, F("nsg-mail", { ports: C(portList([...new Set(mail.flatMap((e) => [...e.ports]))].sort((a, b) => a - b))) }), ruleSrcs, { facts: [nameFact, ...pcFacts] });
  const other = list.filter((e) => e.tier === "other");
  if (other.length > 0) return mCaution(res, F("nsg-other", { ports: C(rangeText(other.flatMap((e) => [...e.other]))) }), ruleSrcs, { facts: [nameFact, ...pcFacts] });

  // 해당 규칙이 없다: 모든 규칙 행을 읽었고 목록이 완결일 때만 이상 없음(CSV는 행이 잘렸는지 알 수 없다)
  if (badRule !== undefined) return mUnknown(res, why(badRule), ruleSrcs, { facts: [nameFact] });
  if (unrecognized) return mUnknown(res, "value-unrecognized", ruleSrcs, { facts: [nameFact] });
  if (listPartial) return mUnknown(res, "csv-scope-unproven", ruleSrcs, { facts: [nameFact] });
  return mClear(res, R("nsg-closed"), ruleSrcs, { facts: [nameFact] });
}

function evaluate(ctx: RuleCtx<AzureNetData>) {
  const members: Member[] = [];
  for (const per of ctx.data.nsgs) {
    if (per.items.k !== "value" && per.items.k !== "partial") continue;
    for (const nsg of per.items.value) members.push(evalNsg(nsg, ctx.data, per.items.k === "partial"));
  }
  return { members, coverage: ctx.scope };
}

export const AZ_NET_1 = defineRule<"azure", "net">({
  spec, evaluate,
  explain: (x) => {
    const code = (m: Member): string => m.why.code.split(":")[1];
    if (x.status === "na") return { msg: R("na-no-nsgs") };
    if (x.status === "clear") return { msg: R("none-open", { n: N(x.applicable ?? x.members.length) }) };
    if (x.status === "risk") {
      const ports = [...new Set(x.members.flatMap((m) => (m.why.params?.ports !== undefined && "c" in m.why.params.ports ? m.why.params.ports.c.split(", ") : [])))];
      return { msg: R("exposed-with-public-ip", { ports: C(ports.length === 0 ? "-" : ports.join(", ")), n: N(x.members.length) }) };
    }
    const count = (slugs: readonly string[]): number => x.members.filter((m) => slugs.includes(code(m))).length;
    const attach = count(["nsg-attachment-unknown", "nsg-unattached", "nsg-private"]);
    const source = count(["nsg-source-broad", "nsg-source-service-tag"]);
    const other = count(["nsg-other"]);
    const mail = count(["nsg-mail"]);
    // 범주가 둘 이상이면 어느 한 범주의 개수가 아니라 주의 전체 개수를 공통 사유로 말한다(대상 표의 주의 개수와 같아야 한다)
    if ([attach, source, other, mail].filter((c) => c > 0).length > 1) return { msg: R("open-review", { n: N(attach + source + other + mail) }) };
    if (attach > 0) return { msg: R("exposed-unattached", { n: N(attach) }) };
    if (source > 0) return { msg: R("open-unclear-source", { n: N(source) }) };
    if (other > 0) return { msg: R("open-other-port", { n: N(other) }) };
    return { msg: R("open-mail-port", { n: N(mail) }) };
  },
});
