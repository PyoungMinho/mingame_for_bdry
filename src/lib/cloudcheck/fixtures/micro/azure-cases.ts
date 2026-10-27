// micro/AZ-* — 손으로 쓴 pass·violate (기준 시각 2026-10-19T03:00:00Z, 키 회전 90일 = 2026-07-21 이전)
import type { AzureNormalizedInput, AzureNsg, AzureNsgRule } from "../../contract/normalized";
import { ADMIN_SEC, BLOB_ALL, SUB, azWorld, diag, nsgId } from "./azure-world";
import { MicroAzure, byCell, inst, miss, part, val, withLatestEvidence } from "./kit";
import type { SaSpec } from "./azure-world";

const FRESH = "2026-09-01T00:00:00Z";
const OLD = "2026-05-01T00:00:00Z";
const okSa: SaSpec = { name: "stwebfiles01", allowPublic: false, sharedKey: false, key1: FRESH, key2: FRESH, containers: [{ name: "assets", access: "None" }], blobDiag: [diag(BLOB_ALL, { storage: true })] };

/* ───── AZ-STO-1 ───── */
export const azSto1 = {
  pass: (): AzureNormalizedInput => azWorld({ doors: ["sto"], accounts: [okSa, { ...okSa, name: "stdata02" }] }).build(),
  allowTrue: (): AzureNormalizedInput => azWorld({ doors: ["sto"], accounts: [okSa, { ...okSa, name: "stopen03", allowPublic: true }] }).build(),
  allowUnset: (): AzureNormalizedInput => azWorld({ doors: ["sto"], accounts: [{ ...okSa, name: "stlegacy04", allowPublic: null }] }).build(),
  empty: (): AzureNormalizedInput => azWorld({ doors: ["sto"], accounts: [] }).build(),
};

/* ───── AZ-STO-2 ───── */
export const azSto2 = {
  pass: (): AzureNormalizedInput => azWorld({ doors: ["sto"], accounts: [okSa, { ...okSa, name: "stdata02", allowPublic: true, containers: [{ name: "private-docs", access: "None" }] }] }).build(),
  publicContainer: (): AzureNormalizedInput => azWorld({ doors: ["sto"], accounts: [{ ...okSa, name: "stopen03", allowPublic: true, containers: [{ name: "downloads", access: "Blob" }, { name: "docs", access: "None" }] }] }).build(),
  webContainer: (): AzureNormalizedInput => azWorld({ doors: ["sto"], accounts: [{ ...okSa, name: "stsite05", allowPublic: false, containers: [{ name: "$web", access: "None" }] }] }).build(),
  /** 계정이 익명 공개를 막으면 컨테이너 설정은 무력화된다 */
  accountBlocks: (): AzureNormalizedInput => azWorld({ doors: ["sto"], accounts: [{ ...okSa, containers: [{ name: "oldpublic", access: "Container" }] }] }).build(),
  noContainers: (): AzureNormalizedInput => azWorld({ doors: ["sto"], accounts: [{ ...okSa, containers: [] }] }).build(),
  /** publicAccess를 읽지 못함(null): 비공개("None")로 보지 않는다 — 확인 불가(백엔드팀장 STEP 4, fail-open 방지) */
  accessUnreadable: (): AzureNormalizedInput => azWorld({ doors: ["sto"], accounts: [{ ...okSa, name: "stodd06", allowPublic: true, containers: [{ name: "mystery", access: null }] }] }).build(),
  empty: (): AzureNormalizedInput => azWorld({ doors: ["sto"], accounts: [] }).build(),

  /** 컨테이너 목록이 '빈 목록 + 값 없음'(none): 컨테이너 0개로 읽는다 — 계정 단위 확인 불가가 아니다(CC-QA-23) */
  containersNone: (): AzureNormalizedInput => azWorld({ doors: ["sto"], accounts: [okSa, { ...okSa, name: "stempty02", containersNone: true }] }).build(),
  containersNoneOnly: (): AzureNormalizedInput => azWorld({ doors: ["sto"], accounts: [{ ...okSa, containersNone: true }] }).build(),
};

/* ───── AZ-KEY-1 ───── */
export const azKey1 = {
  pass: (): AzureNormalizedInput => azWorld({ doors: ["key"], accounts: [okSa, { ...okSa, name: "stkeys02", sharedKey: true, key1: FRESH, key2: "2026-08-15T00:00:00Z" }] }).build(),
  oldKey: (): AzureNormalizedInput => azWorld({ doors: ["key"], accounts: [{ ...okSa, name: "stold03", sharedKey: true, key1: OLD, key2: FRESH }] }).build(),
  noRecord: (): AzureNormalizedInput => azWorld({ doors: ["key"], accounts: [{ ...okSa, name: "stnorec04", sharedKey: null, key1: null, key2: FRESH }] }).build(),
  empty: (): AzureNormalizedInput => azWorld({ doors: ["key"], accounts: [] }).build(),

  // ── 수집 시각(2026-10-19T03:00:00Z)이 키 생성 시각보다 이른 경우(CC-QA-01, 로컬 CLI 시계 늦음). 허용치 5분 ──
  keyAfterCollectedAt: (): AzureNormalizedInput => azWorld({ doors: ["key"], accounts: [{ ...okSa, name: "stfuture01", sharedKey: true, key1: "2026-10-19T03:30:00Z", key2: FRESH }] }).build(),
  keyWithinTolerance: (): AzureNormalizedInput => azWorld({ doors: ["key"], accounts: [{ ...okSa, name: "stfresh01", sharedKey: true, key1: "2026-10-19T03:02:00Z", key2: FRESH }] }).build(),
  /** 계정 칸에는 역전이 없지만 parse가 알려 준 입력 안 가장 늦은 증거 시각(03:30)이 수집 시각(03:00)보다 늦다 → 확인 불가 */
  latestEvidenceLater: (): AzureNormalizedInput => withLatestEvidence(
    azWorld({ doors: ["key"], accounts: [{ ...okSa, name: "stkeys02", sharedKey: true, key1: FRESH, key2: "2026-08-15T00:00:00Z" }] }).build(), "2026-10-19T03:30:00Z"),
  /** 한 계정의 키 시각이 수집 시각보다 늦으면 시계가 틀린 것이다: 다른 계정의 '최근에 회전했다'도 확정하지 못한다. 공유 키를 끈 계정은 나이와 무관해 이상 없음, 오래된 키는 주의 그대로 */
  keyAfterCollectedAtOtherAccount: (): AzureNormalizedInput => azWorld({ doors: ["key"], accounts: [
    { ...okSa, name: "stok01", sharedKey: true, key1: "2026-09-01T00:00:00Z", key2: "2026-09-02T00:00:00Z" },
    { ...okSa, name: "stfuture02", sharedKey: true, key1: "2026-10-19T04:00:00Z", key2: FRESH },
    { ...okSa, name: "stoff03" },
    { ...okSa, name: "stold04", sharedKey: true, key1: OLD, key2: FRESH },
  ] }).build(),
};

/* ───── AZ-NET-1 ───── */
const rdpAny = { name: "allow-rdp", priority: 100, destPortRanges: ["3389"] };
/** 공인 IP NIC에 붙은 NSG 하나(규칙 하나). 기본 규칙은 Inbound · Allow · Tcp · 출발지 * · 22 */
const nsgOne = (rule: Partial<AzureNsgRule>): AzureNormalizedInput => azWorld({
  doors: ["net"],
  nsgs: [{ name: "nsg-vm", rules: [{ name: "r1", priority: 100, destPortRanges: ["22"], ...rule }], nicIds: ["nic-vm1"] }],
  nics: [{ name: "nic-vm1", nsg: "nsg-vm", publicIp: "pip-vm1" }], publicIps: [{ name: "pip-vm1", hasAddress: true }],
}).build();

/** 공인 IP NIC에 붙은 NSG 하나(규칙 여러 개). 규칙 이름 · 우선순위가 겹치지 않게 순서대로 100, 110 … 을 준다 */
const nsgMany = (rules: readonly Partial<AzureNsgRule>[], name = "nsg-vm"): AzureNormalizedInput => azWorld({
  doors: ["net"],
  nsgs: [{ name, rules: rules.map((r, i) => ({ name: `r${i + 1}`, priority: 100 + i * 10, destPortRanges: ["22"], ...r })), nicIds: ["nic-vm1"] }],
  nics: [{ name: "nic-vm1", nsg: name, publicIp: "pip-vm1" }], publicIps: [{ name: "pip-vm1", hasAddress: true }],
}).build();

export const azNet1 = {
  pass: (): AzureNormalizedInput => azWorld({
    doors: ["net"], nsgs: [{ name: "nsg-web", rules: [{ name: "allow-https", priority: 100, destPortRanges: ["443"] }, { name: "allow-ssh-office", priority: 110, sourcePrefixes: ["203.0.113.0/24"], destPortRanges: ["22"] }], nicIds: [] }],
  }).build(),
  publicRdp: (): AzureNormalizedInput => azWorld({
    doors: ["net"],
    nsgs: [{ name: "nsg-vm", rules: [rdpAny], nicIds: ["nic-vm1"] }],
    nics: [{ name: "nic-vm1", nsg: "nsg-vm", publicIp: "pip-vm1" }], publicIps: [{ name: "pip-vm1", hasAddress: true }],
  }).build(),
  unattached: (): AzureNormalizedInput => azWorld({ doors: ["net"], nsgs: [{ name: "nsg-idle", rules: [rdpAny], nicIds: [] }] }).build(),
  privateOnly: (): AzureNormalizedInput => azWorld({
    doors: ["net"], nsgs: [{ name: "nsg-db", rules: [{ name: "allow-sql", destPortRanges: ["1433"] }], nicIds: ["nic-db"] }],
    nics: [{ name: "nic-db", nsg: "nsg-db" }], publicIps: [],
  }).build(),
  /** 더 높은 우선순위의 거부 규칙이 같은 범위를 막는다 → 노출 아님 */
  deniedFirst: (): AzureNormalizedInput => azWorld({
    doors: ["net"], nsgs: [{ name: "nsg-safe", rules: [{ name: "deny-rdp", priority: 90, access: "Deny", destPortRanges: ["3389"] }, rdpAny], nicIds: [] }],
  }).build(),
  /** 서브넷에 붙은 NSG → 서브넷 안 NIC의 공인 IP로 노출 */
  viaSubnet: (): AzureNormalizedInput => azWorld({
    doors: ["net"], nsgs: [{ name: "nsg-subnet", rules: [{ name: "allow-ssh", destPortRanges: ["22"] }], nicIds: [], subnetIds: [`/subscriptions/${SUB}/resourcegroups/rg-main/providers/microsoft.network/virtualnetworks/vnet-main/subnets/snet-app`] }],
    nics: [{ name: "nic-app", subnet: "snet-app", publicIp: "pip-app" }], publicIps: [{ name: "pip-app", hasAddress: true }],
  }).build(),
  portRange: (): AzureNormalizedInput => azWorld({ doors: ["net"], nsgs: [{ name: "nsg-wide", rules: [{ name: "allow-range", destPortRanges: ["1000-2000"] }], nicIds: [] }] }).build(),
  mailPort: (): AzureNormalizedInput => azWorld({ doors: ["net"], nsgs: [{ name: "nsg-mail", rules: [{ name: "allow-smtp", destPortRanges: ["25"] }], nicIds: [] }] }).build(),
  // ── 모르는 값 경계 사례(CC-QA-17, P3): 건너뛰어 위험이 이상 없음이 되면 안 된다. 기본 규칙: Inbound · Allow · Tcp · 출발지 * · 22 ──
  unknownDirection: (): AzureNormalizedInput => nsgOne({ direction: "zzz" }),
  unknownAccess: (): AzureNormalizedInput => nsgOne({ access: "" }),
  unknownProtocol: (): AzureNormalizedInput => nsgOne({ protocol: "zzz" }),
  emptyPortCell: (): AzureNormalizedInput => nsgOne({ destPortRanges: [""] }),
  noPortCells: (): AzureNormalizedInput => nsgOne({ destPortRanges: [] }),
  /** 읽은 조각(22)이 있으면 비어 있는 조각이 섞여도 열린 포트는 그대로 본다(양성 유지) */
  partialPortCells: (): AzureNormalizedInput => nsgOne({ destPortRanges: ["22", ""] }),
  /** 방향 값의 앞뒤 공백은 같은 값으로 읽는다 */
  directionTrailingSpace: (): AzureNormalizedInput => nsgOne({ direction: "Inbound " }),
  /** 포트가 없는 프로토콜(Icmp)은 건너뛴다 */
  icmpFromWorld: (): AzureNormalizedInput => nsgOne({ protocol: "Icmp" }),
  outboundOnly: (): AzureNormalizedInput => nsgOne({ direction: "Outbound" }),
  // ── 출발지를 주소 범위 · 태그로 본다(CC-QA-04, 결정 D-1 · D-3). 기본 규칙: Inbound · Allow · Tcp · 22, 공인 IP NIC에 연결 ──
  /** 서비스 태그 + 위험 포트 → 주의(연결·공인 IP와 무관, 태그 이름을 보인다) */
  serviceTag: (): AzureNormalizedInput => nsgOne({ sourcePrefixes: ["AzureCloud"] }),
  serviceTagRegional: (): AzureNormalizedInput => nsgOne({ sourcePrefixes: ["Storage.KoreaCentral"], destPortRanges: ["3389"] }),
  /** 메일 · 80·443 · 위험 포트가 아닌 구간은 태그에서 판정에서 뺀다(App Gateway 필수 규칙 GatewayManager 65200-65535 포함) */
  serviceTagMail: (): AzureNormalizedInput => nsgOne({ sourcePrefixes: ["AzureCloud"], destPortRanges: ["25"] }),
  serviceTagWeb: (): AzureNormalizedInput => nsgOne({ sourcePrefixes: ["AzureCloud"], destPortRanges: ["443"] }),
  gatewayManager: (): AzureNormalizedInput => nsgOne({ sourcePrefixes: ["GatewayManager"], destPortRanges: ["65200-65535"] }),
  /** 내부 출발지(VirtualNetwork · AzureLoadBalancer · ASG)는 인터넷 출발지가 아니라 판정에서 뺀다(D-3b) */
  virtualNetworkSource: (): AzureNormalizedInput => nsgOne({ sourcePrefixes: ["VirtualNetwork"] }),
  loadBalancerSource: (): AzureNormalizedInput => nsgOne({ sourcePrefixes: ["AzureLoadBalancer"] }),
  asgSource: (): AzureNormalizedInput => nsgOne({ sourcePrefixes: [], sourceAsgCount: 1 }),
  /** 출발지가 하나도 없는 Allow 규칙은 해석 불가 */
  noSource: (): AzureNormalizedInput => nsgOne({ sourcePrefixes: [], sourceAsgCount: 0 }),
  /** 넓은 공인 대역 → 주의, 사설·예약 · 단일 IP는 판정에서 뺀다 */
  broadSource: (): AzureNormalizedInput => nsgOne({ sourcePrefixes: ["12.0.0.0/8"] }),
  broadSourceMail: (): AzureNormalizedInput => nsgOne({ sourcePrefixes: ["12.0.0.0/8"], destPortRanges: ["25"] }),
  privateWideSource: (): AzureNormalizedInput => nsgOne({ sourcePrefixes: ["10.0.0.0/8"] }),
  bareIpSource: (): AzureNormalizedInput => nsgOne({ sourcePrefixes: ["203.0.113.9"] }),
  /** 합쳐서 전체인 출발지(D-1a) → 출발지 전체와 같다: 공인 IP NIC에 연결돼 있으면 위험 */
  splitWorld: (): AzureNormalizedInput => nsgOne({ sourcePrefixes: ["0.0.0.0/1", "128.0.0.0/1"] }),
  /** Deny: 출발지가 '전체'(합집합 포함)일 때만 그 포트를 뺀다. 넓은 대역 · 태그 Deny는 노출을 지우지 못한다 */
  splitDeny: (): AzureNormalizedInput => nsgMany([{ access: "Deny", sourcePrefixes: ["0.0.0.0/1", "128.0.0.0/1"], priority: 90 }, { sourcePrefixes: ["*"], priority: 100 }]),
  broadDeny: (): AzureNormalizedInput => nsgMany([{ access: "Deny", sourcePrefixes: ["12.0.0.0/8"], priority: 90 }, { sourcePrefixes: ["*"], priority: 100 }]),
  tagDeny: (): AzureNormalizedInput => nsgMany([{ access: "Deny", sourcePrefixes: ["AzureCloud"], priority: 90 }, { sourcePrefixes: ["*"], priority: 100 }]),
  /** 출발지 전체 Deny는 서비스 태그 Allow도 막는다 */
  tagBlockedByWorldDeny: (): AzureNormalizedInput => nsgMany([{ access: "Deny", sourcePrefixes: ["*"], priority: 90 }, { sourcePrefixes: ["AzureCloud"], priority: 100 }]),
  tagAndWorld: (): AzureNormalizedInput => nsgMany([{ sourcePrefixes: ["*"], destPortRanges: ["22"] }, { sourcePrefixes: ["AzureCloud"], destPortRanges: ["3389"] }]),
  /** 모르는 모양의 출발지는 해석 불가, 알아본 전체가 함께 있으면 그 위험은 유지한다(양성 유지) */
  garbageSource: (): AzureNormalizedInput => nsgOne({ sourcePrefixes: ["zzz!"] }),
  worldWithGarbage: (): AzureNormalizedInput => nsgOne({ sourcePrefixes: ["*", "zzz!"] }),
  /** Internet · Any 는 대소문자와 앞뒤 공백을 가리지 않는다 */
  internetCaseTrim: (): AzureNormalizedInput => nsgOne({ sourcePrefixes: [" INTERNET "] }),
  /** 룰 수준 사유: 주의 범주가 '출발지 확인' 하나뿐 → open-unclear-source, 연결 없음이 섞이면 open-review */
  sourceOnlyCaution: (): AzureNormalizedInput => azWorld({
    doors: ["net"],
    nsgs: [
      { name: "nsg-tag", rules: [{ name: "allow-ssh", priority: 100, sourcePrefixes: ["AzureCloud"], destPortRanges: ["22"] }], nicIds: [] },
      { name: "nsg-wide", rules: [{ name: "allow-rdp", priority: 100, sourcePrefixes: ["12.0.0.0/8"], destPortRanges: ["3389"] }], nicIds: [] },
    ],
  }).build(),
  sourceAndUnattached: (): AzureNormalizedInput => azWorld({
    doors: ["net"],
    nsgs: [
      { name: "nsg-tag", rules: [{ name: "allow-ssh", priority: 100, sourcePrefixes: ["AzureCloud"], destPortRanges: ["22"] }], nicIds: [] },
      { name: "nsg-idle", rules: [rdpAny], nicIds: [] },
    ],
  }).build(),
  /** 조회한 구독에 NSG가 0개 → 해당 없음(근거 줄이 주의 사유로 나가면 안 된다 · 디자인 검수 K-1) */
  empty: (): AzureNormalizedInput => azWorld({ doors: ["net"], nsgs: [] }).build(),
  /** 주의 범주가 셋(연결 없음 · 그 밖의 포트 · 메일) → 룰 수준 사유는 주의 전체 개수(3)를 공통 사유로 말한다(디자인 검수 K-6) */
  mixedCaution: (): AzureNormalizedInput => azWorld({
    doors: ["net"],
    nsgs: [
      { name: "nsg-idle", rules: [rdpAny], nicIds: [] },
      { name: "nsg-app", rules: [{ name: "allow-app", destPortRanges: ["9000-9100"] }], nicIds: [] },
      { name: "nsg-mail", rules: [{ name: "allow-smtp", destPortRanges: ["25"] }], nicIds: [] },
    ],
  }).build(),
};

/** Resource Graph CSV 경로: NSG 규칙 행만 있고 연결(NIC·서브넷)·공인 IP는 모른다. 목록은 '없음'을 증명하지 못한다(csv-scope-unproven) */
function azNsgCsv(rules: readonly Partial<AzureNsgRule>[], name = "nsg-csv"): AzureNormalizedInput {
  const m = new MicroAzure();
  m.asOf = { at: inst("2026-10-19T04:10:00Z"), source: "file-time" };
  const cell = (row: number | null, column: string | null = null) => byCell(0, "csv-rg-nsg", row, column);
  const nsg: AzureNsg = {
    src: cell(2), id: nsgId(name), name, location: "koreacentral", subscription: SUB,
    rules: rules.map((r, i) => val<AzureNsgRule>({
      name: r.name ?? `rule-${i}`, direction: r.direction ?? "Inbound", access: r.access ?? "Allow", priority: r.priority ?? 100 + i, protocol: r.protocol ?? "Tcp",
      sourcePrefixes: r.sourcePrefixes ?? ["*"], sourceAsgCount: null, destPortRanges: r.destPortRanges ?? ["3389"],
    }, cell(2 + i))),
    nicIds: miss("not-collected"), subnetIds: miss("not-collected"), nicCount: 1, subnetCount: 0,
  };
  m.net({ subscriptions: miss("not-collected"), subscriptionsRequested: null, nsgs: [{ subscription: SUB, items: part([nsg], "csv-scope-unproven", cell(null)) }], nics: [], publicIps: [] });
  m.setKind("csv-rg-nsg", false);
  m.gap("azure.net.nsgs", ["csv-scope-unproven"], { present: 1, unit: { kind: "csv-rows", covered: 1, total: 1 } });
  return m.build();
}
export const azNet1Csv = {
  attachmentUnknown: (): AzureNormalizedInput => azNsgCsv([{ name: "allow-rdp", destPortRanges: ["3389"] }]),
  /** CSV에서도 서비스 태그 + 위험 포트의 주의는 그대로 낸다(찾은 발견은 유지) */
  serviceTag: (): AzureNormalizedInput => azNsgCsv([{ name: "allow-ssh", sourcePrefixes: ["AzureCloud"], destPortRanges: ["22"] }]),
  /** CSV는 ASG 개수를 모른다: 접두도 없으면 출발지를 해석할 수 없다 */
  noSource: (): AzureNormalizedInput => azNsgCsv([{ name: "allow-ssh", sourcePrefixes: [], destPortRanges: ["22"] }]),
  /** CSV에서 위험 규칙이 없어도 NSG 단위 이상 없음을 주지 않는다 */
  noRisk: (): AzureNormalizedInput => azNsgCsv([{ name: "allow-https", destPortRanges: ["443"] }]),
};

/* ───── AZ-LOG-1 ───── */
export const azLog1 = {
  pass: (): AzureNormalizedInput => azWorld({ doors: ["log"], accounts: [], activityExports: [[diag(ADMIN_SEC, { workspace: true })]] }).build(),
  noExport: (): AzureNormalizedInput => azWorld({ doors: ["log"], accounts: [], activityExports: [[]] }).build(),
  categoriesMissing: (): AzureNormalizedInput => azWorld({ doors: ["log"], accounts: [], activityExports: [[diag([{ category: "Administrative" }], { workspace: true })]] }).build(),
  eventHubOnly: (): AzureNormalizedInput => azWorld({ doors: ["log"], accounts: [], activityExports: [[diag(ADMIN_SEC, { eventHub: true })]] }).build(),
  allLogsGroup: (): AzureNormalizedInput => azWorld({ doors: ["log"], accounts: [], activityExports: [[diag([{ categoryGroup: "allLogs" }], { storage: true })]] }).build(),
  auditGroupOnly: (): AzureNormalizedInput => azWorld({ doors: ["log"], accounts: [], activityExports: [[diag([{ categoryGroup: "audit" }], { workspace: true })]] }).build(),
  /** 조회 범위 안 구독이 0개 → 해당 없음(근거 줄이 '내보내지 않는 구독 0개'로 나가면 안 된다 · 디자인 검수 K-2) */
  empty: (): AzureNormalizedInput => azWorld({ doors: ["log"], accounts: [], subs: [] }).build(),
  /** 내보내는 곳이 작업 영역과 스토리지 계정 둘 → 사실 문구가 값마다 따로 나간다(디자인 검수 K-5) */
  bothDestinations: (): AzureNormalizedInput => azWorld({ doors: ["log"], accounts: [], activityExports: [[diag(ADMIN_SEC, { workspace: true, storage: true })]] }).build(),
};

/* ───── AZ-LOG-2 ───── */
export const azLog2 = {
  pass: (): AzureNormalizedInput => azWorld({ doors: ["log"], accounts: [okSa], activityExports: [[diag(ADMIN_SEC)]] }).build(),
  noDiagnostics: (): AzureNormalizedInput => azWorld({ doors: ["log"], accounts: [{ ...okSa, blobDiag: [] }], activityExports: [[diag(ADMIN_SEC)]] }).build(),
  categoriesMissing: (): AzureNormalizedInput => azWorld({ doors: ["log"], accounts: [{ ...okSa, blobDiag: [diag([{ category: "StorageRead" }, { category: "StorageWrite" }], { storage: true })] }], activityExports: [[diag(ADMIN_SEC)]] }).build(),
  auditGroup: (): AzureNormalizedInput => azWorld({ doors: ["log"], accounts: [{ ...okSa, blobDiag: [diag([{ categoryGroup: "audit" }], { workspace: true })] }], activityExports: [[diag(ADMIN_SEC)]] }).build(),
  disabledCategory: (): AzureNormalizedInput => azWorld({ doors: ["log"], accounts: [{ ...okSa, blobDiag: [diag([{ category: "StorageRead" }, { category: "StorageWrite" }, { category: "StorageDelete", enabled: false }])] }], activityExports: [[diag(ADMIN_SEC)]] }).build(),
  empty: (): AzureNormalizedInput => azWorld({ doors: ["log"], accounts: [], activityExports: [[diag(ADMIN_SEC)]] }).build(),
};
