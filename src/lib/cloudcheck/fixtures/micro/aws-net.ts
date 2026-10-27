// micro/AWS-NET-1 — 활성 리전 2개(ap-northeast-2, us-east-1)의 보안 그룹·ENI 세계
import type { AwsEni, AwsNetData, AwsNormalizedInput, AwsSecurityGroup, PerRegion, ReceiptKey, UnitCoverage } from "../../contract/normalized";
import { truncate } from "../mutate";
import { MicroAws, byReceipt, unit, val } from "./kit";

export interface IngressSpec {
  readonly protocol: string; readonly from: number | null; readonly to: number | null;
  /** 생략하면 ["0.0.0.0/0"] */
  readonly cidrs?: readonly string[]; readonly ipv6?: readonly string[];
  /** 프리픽스 리스트 ID(내용은 수집하지 않는다) · 보안 그룹 참조 개수 */
  readonly prefixLists?: readonly string[]; readonly sgRefs?: number;
}
export interface SgSpec { readonly id: string; readonly name: string; readonly region: string; readonly ingress: readonly IngressSpec[] }
export interface EniSpec { readonly id: string; readonly region: string; readonly groups: readonly string[]; readonly publicIp: boolean; readonly ipv6?: boolean }

export const REGIONS = ["ap-northeast-2", "us-east-1"] as const;
export const world = (o: { sgs: readonly SgSpec[]; enis: readonly EniSpec[]; regions?: readonly string[]; sgKeys?: readonly string[] }): { readonly m: MicroAws; build: () => AwsNormalizedInput } => {
  const regions = o.regions ?? REGIONS;
  const m = new MicroAws();
  const dr = m.rc("ec2:DescribeRegions", "ok", { count: regions.length });
  const sgPer: PerRegion<AwsSecurityGroup>[] = [];
  const eniPer: PerRegion<AwsEni>[] = [];
  const sgUnits: UnitCoverage[] = [];
  const eniUnits: UnitCoverage[] = [];
  const sgKeys: ReceiptKey[] = [];
  const eniKeys: ReceiptKey[] = [];
  for (const region of regions) {
    const sgs = o.sgs.filter((s) => s.region === region);
    const enis = o.enis.filter((e) => e.region === region);
    const ks = m.rc("ec2:DescribeSecurityGroups", sgs.length === 0 ? "empty" : "ok", { region, count: sgs.length });
    const ke = m.rc("ec2:DescribeNetworkInterfaces", enis.length === 0 ? "empty" : "ok", { region, count: enis.length });
    sgKeys.push(ks); eniKeys.push(ke);
    sgUnits.push(unit(region, "ok", ks)); eniUnits.push(unit(region, "ok", ke));
    sgPer.push({
      region, items: val(sgs.map((s): AwsSecurityGroup => ({
        src: byReceipt(ks), id: s.id, name: s.name, vpcId: "vpc-0123", region,
        ingress: s.ingress.map((r) => ({ protocol: r.protocol, fromPort: r.from, toPort: r.to, cidrs: [...(r.cidrs ?? ["0.0.0.0/0"])], ipv6Cidrs: [...(r.ipv6 ?? [])], prefixListIds: [...(r.prefixLists ?? [])], sgRefCount: r.sgRefs ?? 0 })),
      })), byReceipt(ks)),
    });
    eniPer.push({
      region, items: val(enis.map((e): AwsEni => ({
        src: byReceipt(ke), id: e.id, region, groupIds: [...e.groups], hasPublicIp: e.publicIp, hasIpv6: e.ipv6 ?? false,
        interfaceType: "interface", status: "in-use", requesterManaged: false,
      })), byReceipt(ke)),
    });
  }
  const data: AwsNetData = { regions: val([...regions], byReceipt(dr)), regionsRequested: null, securityGroups: sgPer, networkInterfaces: eniPer };
  m.net(data);
  const unitInfo = { kind: "regions" as const, covered: regions.length, total: regions.length };
  // 범위 표가 증명하는 구성원 신원: 리전 단위 ID라 "<리전>/<ID>"(parse와 같다). sgKeys로 바꿔치기한 신원 집합을 시험할 수 있다
  m.prove("aws.net.security-groups", { present: o.sgs.length, receipts: sgKeys, unit: unitInfo, units: sgUnits, memberKeys: o.sgKeys ?? o.sgs.map((s) => `${s.region}/${s.id}`) });
  m.prove("aws.net.enis", { present: o.enis.length, receipts: eniKeys, unit: unitInfo, units: eniUnits, memberKeys: o.enis.map((e) => `${e.region}/${e.id}`) });
  return { m, build: () => m.build() };
};

const closedSg: SgSpec = { id: "sg-0a1b2c3d", name: "web", region: "ap-northeast-2", ingress: [{ protocol: "tcp", from: 443, to: 443 }, { protocol: "tcp", from: 22, to: 22, cidrs: ["10.0.0.0/8"] }] };
const publicEni = (groups: string[], region = "ap-northeast-2"): EniSpec => ({ id: "eni-0f00", region, groups, publicIp: true });

/** 인터넷 전체(기본 0.0.0.0/0)를 향한 규칙 하나짜리 보안 그룹. 기본은 공인 IP ENI가 붙어 있다 */
const one = (rule: IngressSpec, enis?: readonly EniSpec[]): AwsNormalizedInput => world({
  sgs: [{ id: "sg-0qa00001", name: "qa", region: "ap-northeast-2", ingress: [rule] }],
  enis: enis ?? [publicEni(["sg-0qa00001"])],
}).build();

export const net1 = {
  pass: (): AwsNormalizedInput => world({ sgs: [closedSg], enis: [publicEni(["sg-0a1b2c3d"])] }).build(),
  publicSsh: (): AwsNormalizedInput => world({
    sgs: [{ id: "sg-0bad0001", name: "bastion", region: "ap-northeast-2", ingress: [{ protocol: "tcp", from: 22, to: 22 }] }],
    enis: [publicEni(["sg-0bad0001"])],
  }).build(),
  unattached: (): AwsNormalizedInput => world({
    sgs: [{ id: "sg-0bad0002", name: "rdp-unused", region: "ap-northeast-2", ingress: [{ protocol: "tcp", from: 3389, to: 3389 }] }], enis: [],
  }).build(),
  privateOnly: (): AwsNormalizedInput => world({
    sgs: [{ id: "sg-0bad0003", name: "db", region: "ap-northeast-2", ingress: [{ protocol: "tcp", from: 5432, to: 5432 }] }],
    enis: [{ id: "eni-0f01", region: "ap-northeast-2", groups: ["sg-0bad0003"], publicIp: false }],
  }).build(),
  otherPort: (): AwsNormalizedInput => world({
    sgs: [{ id: "sg-0bad0004", name: "app", region: "ap-northeast-2", ingress: [{ protocol: "tcp", from: 9000, to: 9100 }] }], enis: [],
  }).build(),
  mailPort: (): AwsNormalizedInput => world({
    sgs: [{ id: "sg-0bad0005", name: "mail", region: "ap-northeast-2", ingress: [{ protocol: "tcp", from: 25, to: 25 }] }], enis: [],
  }).build(),
  allTraffic: (): AwsNormalizedInput => world({
    sgs: [{ id: "sg-0bad0006", name: "open", region: "ap-northeast-2", ingress: [{ protocol: "-1", from: null, to: null }] }],
    enis: [publicEni(["sg-0bad0006"])],
  }).build(),
  /** 두 번째 리전에 위험 규칙, 첫 리전은 깨끗 */
  otherRegion: (): AwsNormalizedInput => world({
    sgs: [closedSg, { id: "sg-0bad0007", name: "legacy", region: "us-east-1", ingress: [{ protocol: "tcp", from: 6379, to: 6379 }] }],
    enis: [publicEni(["sg-0a1b2c3d"]), { id: "eni-0f02", region: "us-east-1", groups: ["sg-0bad0007"], publicIp: true }],
  }).build(),
  /** IPv6만 열렸고 ENI에 IPv6 주소가 없다 → 노출 아님(주의: 사설) */
  ipv6Only: (): AwsNormalizedInput => world({
    sgs: [{ id: "sg-0bad0008", name: "v6", region: "ap-northeast-2", ingress: [{ protocol: "tcp", from: 22, to: 22, cidrs: [], ipv6: ["::/0"] }] }],
    enis: [{ id: "eni-0f03", region: "ap-northeast-2", groups: ["sg-0bad0008"], publicIp: true, ipv6: false }],
  }).build(),
  /** 규칙이 없는 보안 그룹(목록은 비어 있지 않다) */
  noRules: (): AwsNormalizedInput => world({ sgs: [{ id: "sg-0good0001", name: "empty", region: "ap-northeast-2", ingress: [] }], enis: [] }).build(),
  // ── 모르는 값 경계 사례(CC-QA-03, P3) ──
  weirdProtocol: (): AwsNormalizedInput => one({ protocol: "zzz", from: 22, to: 22 }),
  protocolTrailingSpace: (): AwsNormalizedInput => one({ protocol: "TCP ", from: 22, to: 22 }),
  protocolEmpty: (): AwsNormalizedInput => one({ protocol: "", from: 22, to: 22 }),
  portReversed: (): AwsNormalizedInput => one({ protocol: "tcp", from: 3389, to: 22 }),
  portNegative: (): AwsNormalizedInput => one({ protocol: "tcp", from: -1, to: -1 }),
  /** 한쪽 끝만 범위 밖이면 범위 안쪽으로 잘라 읽는다: 22번이 열려 있다는 사실은 그대로 보인다 */
  portUpperClamped: (): AwsNormalizedInput => one({ protocol: "tcp", from: 22, to: 70000 }),
  portAllOutside: (): AwsNormalizedInput => one({ protocol: "tcp", from: 65536, to: 65536 }),
  cidrTrailingSpace: (): AwsNormalizedInput => one({ protocol: "tcp", from: 22, to: 22, cidrs: ["0.0.0.0/0 "] }),
  /** 형식이 깨진 IPv4 출발지가 있어도 같은 규칙의 IPv6 전체 공개(::/0)는 그대로 본다(양성 유지) */
  cidrGarbageWithV6World: (): AwsNormalizedInput => one({ protocol: "tcp", from: 22, to: 22, cidrs: ["zzz"], ipv6: ["::/0"] }, [{ id: "eni-0f0a", region: "ap-northeast-2", groups: ["sg-0qa00001"], publicIp: false, ipv6: true }]),
  v6Malformed: (): AwsNormalizedInput => one({ protocol: "tcp", from: 22, to: 22, cidrs: [], ipv6: ["::/129"] }),
  /** 앞뒤 공백은 trim한 뒤 읽는다(D-1a): ::/0 이고 ENI에 IPv6 주소가 있으면 위험 */
  v6TrailingSpace: (): AwsNormalizedInput => one({ protocol: "tcp", from: 22, to: 22, cidrs: [], ipv6: ["::/0 "] }, [{ id: "eni-0f0b", region: "ap-northeast-2", groups: ["sg-0qa00001"], publicIp: false, ipv6: true }]),
  /** 접두 길이 0은 주소와 무관하게 인터넷 전체 */
  slashZeroWorld: (): AwsNormalizedInput => one({ protocol: "tcp", from: 22, to: 22, cidrs: ["10.0.0.0/0"] }),
  /** 포트가 없는 프로토콜(icmp)은 건너뛴다 */
  icmpFromWorld: (): AwsNormalizedInput => one({ protocol: "icmp", from: 3389, to: 3389 }),
  /** 인터넷 전체가 아닌 규칙의 프로토콜은 보지 않는다 */
  weirdProtocolNotWorld: (): AwsNormalizedInput => one({ protocol: "zzz", from: 22, to: 22, cidrs: ["10.0.0.0/8"] }),
  // ── 프로토콜 번호(CC-QA-24, P3): IP 프로토콜 번호는 0~255의 정규 표기만 안다 ──
  /** 범위 밖 번호(256 · 999)는 '포트 없는 프로토콜'이 아니라 모르는 값이다 → 0.0.0.0/0의 22번 규칙을 건너뛰지 않는다 */
  protocolNumber256: (): AwsNormalizedInput => one({ protocol: "256", from: 22, to: 22 }),
  protocolNumber999: (): AwsNormalizedInput => one({ protocol: "999", from: 22, to: 22 }),
  /** 앞자리 0 표기("006")는 tcp(6)도, 포트 없는 번호도 아닌 모르는 값이다 */
  protocolLeadingZero: (): AwsNormalizedInput => one({ protocol: "006", from: 22, to: 22 }),
  /** 경계: 0 · 255는 실제 번호(포트 없음) → 건너뛴다 */
  protocolNumber0: (): AwsNormalizedInput => one({ protocol: "0", from: 22, to: 22 }),
  protocolNumber255: (): AwsNormalizedInput => one({ protocol: "255", from: 22, to: 22 }),
  /** 대조: 6은 tcp로 읽어 위험, 50(ESP)은 포트가 없어 건너뛴다 */
  protocolNumberTcp: (): AwsNormalizedInput => one({ protocol: "6", from: 22, to: 22 }),
  protocolNumberEsp: (): AwsNormalizedInput => one({ protocol: "50", from: 22, to: 22 }),
  /** 모르는 번호의 규칙이 있어도 같은 보안 그룹의 다른 규칙에서 찾은 위험은 그대로다(INV-4) */
  protocolOutOfRangePlusRisk: (): AwsNormalizedInput => world({
    sgs: [{ id: "sg-0qa00001", name: "qa", region: "ap-northeast-2", ingress: [{ protocol: "256", from: 22, to: 22 }, { protocol: "tcp", from: 3389, to: 3389 }] }],
    enis: [publicEni(["sg-0qa00001"])],
  }).build(),
  // ── ENI 목록이 잘렸을 때(CC-QA-13): 본 만큼만 믿는다 ──
  eniTruncatedUnseen: (): AwsNormalizedInput => truncate(world({
    sgs: [{ id: "sg-0qa00001", name: "qa", region: "ap-northeast-2", ingress: [{ protocol: "tcp", from: 22, to: 22 }] }],
    enis: [{ id: "eni-0other", region: "ap-northeast-2", groups: ["sg-0other"], publicIp: true }],
  }).build(), "ec2:DescribeNetworkInterfaces", { region: "ap-northeast-2" }) as AwsNormalizedInput,
  eniTruncatedPublicSeen: (): AwsNormalizedInput => truncate(world({
    sgs: [{ id: "sg-0qa00001", name: "qa", region: "ap-northeast-2", ingress: [{ protocol: "tcp", from: 22, to: 22 }] }],
    enis: [publicEni(["sg-0qa00001"])],
  }).build(), "ec2:DescribeNetworkInterfaces", { region: "ap-northeast-2" }) as AwsNormalizedInput,
  eniTruncatedPrivateSeen: (): AwsNormalizedInput => truncate(world({
    sgs: [{ id: "sg-0qa00001", name: "qa", region: "ap-northeast-2", ingress: [{ protocol: "tcp", from: 22, to: 22 }] }],
    enis: [{ id: "eni-0f01", region: "ap-northeast-2", groups: ["sg-0qa00001"], publicIp: false }],
  }).build(), "ec2:DescribeNetworkInterfaces", { region: "ap-northeast-2" }) as AwsNormalizedInput,
  // ── 출발지를 주소 범위로 본다(CC-QA-04 · CC-QA-14, 결정 D-1 · D-4) ──
  /** 한 규칙 안의 출발지 합집합이 IPv4 전체를 덮는다(0.0.0.0/1 + 128.0.0.0/1) → 0.0.0.0/0 과 같다: 공인 IP ENI에 연결돼 있으면 위험 */
  splitWorld: (): AwsNormalizedInput => one({ protocol: "tcp", from: 22, to: 22, cidrs: ["0.0.0.0/1", "128.0.0.0/1"] }),
  splitWorldThree: (): AwsNormalizedInput => one({ protocol: "tcp", from: 22, to: 22, cidrs: ["0.0.0.0/2", "64.0.0.0/2", "128.0.0.0/1"] }),
  splitWorldSpaces: (): AwsNormalizedInput => one({ protocol: "tcp", from: 22, to: 22, cidrs: [" 0.0.0.0/1", "128.0.0.0/1 "] }),
  /** 마지막 1/4(0.0.0.0/1 과 128.0.0.0/2 로는 덮이지 않는 구간)가 빠져 전체가 아니다 → 넓은 공인 대역(주의) */
  splitIncomplete: (): AwsNormalizedInput => one({ protocol: "tcp", from: 22, to: 22, cidrs: ["0.0.0.0/1", "128.0.0.0/2"] }),
  splitWorldUnattached: (): AwsNormalizedInput => one({ protocol: "tcp", from: 22, to: 22, cidrs: ["0.0.0.0/1", "128.0.0.0/1"] }, []),
  splitWorldMail: (): AwsNormalizedInput => one({ protocol: "tcp", from: 25, to: 25, cidrs: ["0.0.0.0/1", "128.0.0.0/1"] }),
  /** 넓은 공인 대역(IPv4 /8 이하)에 위험 포트 → 주의(연결·공인 IP와 무관) */
  broadV4: (): AwsNormalizedInput => one({ protocol: "tcp", from: 22, to: 22, cidrs: ["12.0.0.0/8"] }),
  broadV4AllTraffic: (): AwsNormalizedInput => one({ protocol: "-1", from: null, to: null, cidrs: ["12.0.0.0/8"] }),
  /** 메일 · 그 밖의 포트 · 80·443은 넓은 대역에서 판정에서 뺀다(이상 없음) */
  broadV4Mail: (): AwsNormalizedInput => one({ protocol: "tcp", from: 25, to: 25, cidrs: ["12.0.0.0/8"] }),
  broadV4OtherPort: (): AwsNormalizedInput => one({ protocol: "tcp", from: 9000, to: 9100, cidrs: ["12.0.0.0/8"] }),
  broadV4Web: (): AwsNormalizedInput => one({ protocol: "tcp", from: 443, to: 443, cidrs: ["12.0.0.0/8"] }),
  broadV6: (): AwsNormalizedInput => one({ protocol: "tcp", from: 22, to: 22, cidrs: [], ipv6: ["2000::/3"] }),
  /** 사설·예약 대역은 넓어도 뺀다(10.0.0.0/8 은 흔한 VPC 내부 허용), 좁은 공인 대역(사무실 /24)은 좁아서 뺀다, 호스트 비트는 네트워크 주소로 맞춘다 */
  privateWide: (): AwsNormalizedInput => one({ protocol: "tcp", from: 22, to: 22, cidrs: ["10.0.0.0/8"] }),
  narrowPublic: (): AwsNormalizedInput => one({ protocol: "tcp", from: 22, to: 22, cidrs: ["203.0.113.0/24"] }),
  hostBitsPrivate: (): AwsNormalizedInput => one({ protocol: "tcp", from: 22, to: 22, cidrs: ["10.1.2.3/8"] }),
  /** 프리픽스 리스트 출발지 + 위험 포트 → 주의(위험 아님, 목록 안의 주소는 읽지 않는다) */
  prefixList: (): AwsNormalizedInput => one({ protocol: "tcp", from: 22, to: 22, cidrs: [], prefixLists: ["pl-0abc0001"] }),
  prefixListAllTraffic: (): AwsNormalizedInput => one({ protocol: "-1", from: null, to: null, cidrs: [], prefixLists: ["pl-0abc0001"] }),
  prefixListWeb: (): AwsNormalizedInput => one({ protocol: "tcp", from: 443, to: 443, cidrs: [], prefixLists: ["pl-0abc0001"] }),
  prefixListMail: (): AwsNormalizedInput => one({ protocol: "tcp", from: 25, to: 25, cidrs: [], prefixLists: ["pl-0abc0001"] }),
  prefixListIcmp: (): AwsNormalizedInput => one({ protocol: "icmp", from: -1, to: -1, cidrs: [], prefixLists: ["pl-0abc0001"] }),
  /** 출발지가 하나도 없는 규칙은 해석 불가(포트와 무관). 보안 그룹 참조만 있는 규칙은 내부라 판정에서 뺀다 */
  noSource: (): AwsNormalizedInput => one({ protocol: "tcp", from: 22, to: 22, cidrs: [] }),
  noSourceWeb: (): AwsNormalizedInput => one({ protocol: "tcp", from: 443, to: 443, cidrs: [] }),
  sgRefOnly: (): AwsNormalizedInput => one({ protocol: "tcp", from: 22, to: 22, cidrs: [], sgRefs: 1 }),
  /** 한 규칙에 인터넷 전체와 프리픽스 리스트가 함께 있으면 앞선 발견(전체 × 위험 포트)이 사유다 */
  worldAndPrefixList: (): AwsNormalizedInput => one({ protocol: "tcp", from: 22, to: 22, prefixLists: ["pl-0abc0001"] }),
  /** 전체 × 메일 규칙과 프리픽스 리스트 × 위험 포트 규칙: 사유는 더 앞선 발견(프리픽스 리스트) */
  mailAndPrefixList: (): AwsNormalizedInput => world({
    sgs: [{ id: "sg-0qa00001", name: "qa", region: "ap-northeast-2", ingress: [{ protocol: "tcp", from: 25, to: 25 }, { protocol: "tcp", from: 22, to: 22, cidrs: [], prefixLists: ["pl-0abc0001"] }] }],
    enis: [publicEni(["sg-0qa00001"])],
  }).build(),
  /** 넓은 대역과 프리픽스 리스트가 함께 있으면 넓은 대역이 앞선다 */
  broadAndPrefixList: (): AwsNormalizedInput => one({ protocol: "tcp", from: 22, to: 22, cidrs: ["12.0.0.0/8"], prefixLists: ["pl-0abc0001"] }),
  /** 룰 수준 사유: 주의 범주가 '출발지 확인' 하나뿐(대상 2개) → open-unclear-source, 연결 없음이 섞이면 open-review */
  sourceOnlyCaution: (): AwsNormalizedInput => world({
    sgs: [
      { id: "sg-0bad0101", name: "wide", region: "ap-northeast-2", ingress: [{ protocol: "tcp", from: 22, to: 22, cidrs: ["12.0.0.0/8"] }] },
      { id: "sg-0bad0102", name: "list", region: "ap-northeast-2", ingress: [{ protocol: "tcp", from: 3389, to: 3389, cidrs: [], prefixLists: ["pl-0abc0001"] }] },
    ],
    enis: [],
  }).build(),
  sourceAndUnattached: (): AwsNormalizedInput => world({
    sgs: [
      { id: "sg-0bad0101", name: "wide", region: "ap-northeast-2", ingress: [{ protocol: "tcp", from: 22, to: 22, cidrs: ["12.0.0.0/8"] }] },
      { id: "sg-0bad0102", name: "idle", region: "ap-northeast-2", ingress: [{ protocol: "tcp", from: 3389, to: 3389 }] },
    ],
    enis: [],
  }).build(),
  /** 활성 리전을 모두 조회했는데 보안 그룹이 0개 → 해당 없음(근거 줄이 주의 사유로 나가면 안 된다 · 디자인 검수 K-1) */
  empty: (): AwsNormalizedInput => world({ sgs: [], enis: [] }).build(),
  /** 주의 범주가 셋(연결 없음 · 그 밖의 포트 · 메일) → 룰 수준 사유는 주의 전체 개수(3)를 공통 사유로 말한다(디자인 검수 K-6) */
  mixedCaution: (): AwsNormalizedInput => world({
    sgs: [
      { id: "sg-0bad0002", name: "rdp-unused", region: "ap-northeast-2", ingress: [{ protocol: "tcp", from: 3389, to: 3389 }] },
      { id: "sg-0bad0004", name: "app", region: "ap-northeast-2", ingress: [{ protocol: "tcp", from: 9000, to: 9100 }] },
      { id: "sg-0bad0005", name: "mail", region: "ap-northeast-2", ingress: [{ protocol: "tcp", from: 25, to: 25 }] },
    ],
    enis: [],
  }).build(),
};
