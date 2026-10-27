// src/lib/cloudcheck/fixtures/micro/kit.ts — 룰 단위 NormalizedInput 조립 도구 (엔진·룰 단위 테스트용)
// parse가 없어도 엔진을 시험할 수 있게, parse가 만들 모양을 손으로 짠 사실에서 조립한다. 봉인(sealCoverage)은 fixtures에서만 부른다.
// 표본 값만 쓴다: 계정 111122223333, GUID는 0으로 채운 값, 버킷은 amzn-s3-demo-…
import { notCollectedCoverage, sealCoverage, AWS_FAMILIES, AZURE_FAMILIES, familyDoor, NORMALIZED_MODEL } from "../../contract/normalized";
import type {
  AsOfFact, AwsDoors, AwsFamilyId, AwsNormalizedInput, AzureDoors, AzureFamilyId, AzureNormalizedInput, CoverageDraft, CsvKind, DoorSelection, FamilyCoverage,
  FamilyId, InputFacts, Instant, MissingReason, PartialReason, ReceiptFact, ReceiptKey, Slot, Src, UnitCoverage,
} from "../../contract/normalized";
import type { AwsCall, AzureCall } from "../../contract/calls";
import { DOORS } from "../../model/report";
import type { CoverageKind, DoorId, IsoUtc, ReceiptResult, UnknownReason } from "../../model/report";
import { deepFreeze } from "../invariants";

/* ───────── 원자 ───────── */
const CANON = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})Z$/;
export const inst = (iso: string): Instant => {
  const m = CANON.exec(iso);
  if (!m) throw new Error(`정규형 시각이 아님: ${iso}`);
  const [y, mo, d, h, mi, s] = m.slice(1).map(Number);
  return { iso: iso as IsoUtc, ms: Date.UTC(y, mo - 1, d, h, mi, s) };
};
/**
 * parse가 알려 주는 '입력 안의 가장 늦은 증거 시각'(InputFacts.latestEvidence)을 첫 입력에 단 사본.
 * 룰이 직접 읽는 칸 밖의 시각(비밀번호 변경 · 인증서 회전 …)이 기준 시각보다 늦은 상황을 흉내 낸다. 영수증에 묶이지 않은 값이라 증거를 지우는 변이로는 사라지지 않는다.
 */
export function withLatestEvidence<T extends AwsNormalizedInput | AzureNormalizedInput>(input: T, iso: string): T {
  return { ...input, inputs: input.inputs.map((f, i) => (i === 0 ? { ...f, latestEvidence: inst(iso) } : f)) } as T;
}
export const AT = inst("2026-10-19T03:00:00Z");
export const ASOF: AsOfFact = { at: AT, source: "collected-at" };
export const ZERO_GUID = "00000000-0000-0000-0000-000000000000";
export const guid = (n: number): string => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;

export const rk = (input: number, n: number): ReceiptKey => `${input}:r-${String(n).padStart(4, "0")}`;
export const byReceipt = (key: ReceiptKey): Src => ({ input: Number(key.split(":")[0]), receipt: key, csv: null });
export const byCell = (input: number, kind: CsvKind, row: number | null, column: string | null = null, receipt: ReceiptKey | null = null): Src =>
  ({ input, receipt, csv: { kind, row, column } });
export const val = <T>(value: T, src: Src): Slot<T> => ({ k: "value", value, src });
export const part = <T>(value: T, why: PartialReason, src: Src): Slot<T> => ({ k: "partial", value, why, src });
export const none = <T>(src: Src): Slot<T> => ({ k: "none", src });
export const miss = <T>(why: MissingReason, src: Src | null = null): Slot<T> => ({ k: "missing", why, src });

/* ───────── 공통 빌더 ───────── */
interface FamOpts {
  readonly present: number;
  readonly receipts?: readonly ReceiptKey[];
  readonly expected?: number | null;
  readonly unit?: { readonly kind: CoverageKind; readonly covered: number | null; readonly total: number | null };
  readonly units?: readonly UnitCoverage[];
  /** 증명하는 구성원의 신원 집합(FamilyCoverage.memberKeys). 주면 엔진이 룰이 평가한 구성원의 신원 집합과 대조한다. 개수는 present와 같아야 한다 */
  readonly memberKeys?: readonly string[];
}
const ACCOUNT_WIDE = { kind: "account-global", covered: 1, total: 1 } as const;

abstract class MicroBase<F extends FamilyId, Out> {
  readonly receipts = new Map<ReceiptKey, ReceiptFact>();
  protected n = 0;
  protected selected = new Set<DoorId>();
  protected cov = new Map<F, FamilyCoverage>();
  asOf: AsOfFact | null = ASOF;
  protected doorData: Partial<Record<DoorId, { data: unknown; asOf: AsOfFact | null }>> = {};
  protected inputKind: InputFacts["kind"] = "collector-json";
  protected scopeProven = true;
  /** 입력 종류를 바꾼다(CSV 경로 픽스처: 수집기 아님 · 범위 미증명) */
  setKind(kind: InputFacts["kind"], scopeProven: boolean): this { this.inputKind = kind; this.scopeProven = scopeProven; return this; }

  /** 영수증을 만들고 키를 돌려준다 */
  rc(call: AwsCall | AzureCall, result: ReceiptResult, o: { region?: string; subscription?: string; resource?: string; count?: number; errorCode?: string } = {}): ReceiptKey {
    this.n++;
    const key = rk(0, this.n);
    const fail = result === "denied" || result === "error" || result === "throttled" || result === "unsupported" || result === "notconfigured";
    const defaultCode = result === "denied" ? "AccessDenied" : result === "notconfigured" ? "NotConfigured" : result === "throttled" ? "Throttling" : result === "unsupported" ? "UnsupportedOperation" : "InternalError";
    this.receipts.set(key, {
      key, input: 0, call, region: o.region ?? (o.subscription === undefined ? "global" : null), subscription: o.subscription ?? null, resource: o.resource ?? null,
      result, count: fail ? null : result === "empty" ? 0 : (o.count ?? null), errorCode: fail ? (o.errorCode ?? defaultCode) : null, at: AT, used: true,
    });
    return key;
  }
  src(key: ReceiptKey): Src { return byReceipt(key); }

  /** 문 하나의 데이터를 선택 상태로 넣는다 */
  protected put(door: DoorId, data: unknown, asOf: AsOfFact | null = this.asOf): void {
    this.selected.add(door);
    this.doorData[door] = { data, asOf };
  }

  /** 완결로 봉인한 패밀리 */
  prove(family: F, o: FamOpts): this {
    this.cov.set(family, sealCoverage({
      family, input: 0, complete: true, population: o.present, present: o.present, expected: o.expected ?? null, gaps: [],
      receipts: o.receipts ?? [], unit: o.unit ?? ACCOUNT_WIDE, units: o.units ?? [],
      ...(o.memberKeys === undefined ? {} : { memberKeys: o.memberKeys }),
    } as CoverageDraft<F>));
    return this;
  }
  /** 미완결로 봉인한 패밀리 */
  gap(family: F, gaps: readonly UnknownReason[], o: FamOpts): this {
    this.cov.set(family, sealCoverage({
      family, input: 0, complete: false, population: null, present: o.present, expected: o.expected ?? null, gaps: [...gaps],
      receipts: o.receipts ?? [], unit: o.unit ?? { kind: "none", covered: null, total: null }, units: o.units ?? [],
    } as CoverageDraft<F>));
    return this;
  }

  protected abstract families(): readonly F[];
  protected coverageTable(): Record<string, FamilyCoverage> {
    const out: Record<string, FamilyCoverage> = {};
    for (const f of this.families()) {
      const have = this.cov.get(f);
      const door = familyDoor(f);
      out[f] = have ?? notCollectedCoverage(f, this.selected.has(door) ? 0 : null);
    }
    return out;
  }
  protected doorsRecord(): Record<DoorId, DoorSelection<unknown>> {
    const out = {} as Record<DoorId, DoorSelection<unknown>>;
    for (const d of DOORS) {
      const have = this.doorData[d];
      out[d] = have === undefined ? { state: "skipped", inputs: [0] } : { state: "selected", input: 0, asOf: have.asOf, data: have.data };
    }
    return out;
  }
  protected inputFacts(name: string, runKey: string | null, collector: InputFacts["collector"]): InputFacts {
    const doors = {} as Record<DoorId, "used" | "superseded" | "skipped" | "absent">;
    for (const d of DOORS) doors[d] = this.selected.has(d) ? "used" : "skipped";
    return {
      index: 0, kind: this.inputKind, via: "file", name, bytes: 4_096, asOf: this.asOf, runKey, collector,
      schema: this.inputKind === "collector-json" ? { id: "cloudcheck.collect/1.0", support: "exact" } : null, doors, scopeProven: this.scopeProven,
    };
  }
  abstract build(): Out;
  protected receiptsMap(): ReadonlyMap<ReceiptKey, ReceiptFact> { return new Map(this.receipts); }
}

/* ───────── AWS ───────── */
export class MicroAws extends MicroBase<AwsFamilyId, AwsNormalizedInput> {
  accountId = "111122223333";
  constructor() { super(); }
  protected families(): readonly AwsFamilyId[] { return AWS_FAMILIES; }

  mfa(data: unknown, asOf?: AsOfFact | null): this { this.put("mfa", data, asOf); return this; }
  key(data: unknown, asOf?: AsOfFact | null): this { this.put("key", data, asOf); return this; }
  net(data: unknown, asOf?: AsOfFact | null): this { this.put("net", data, asOf); return this; }
  sto(data: unknown, asOf?: AsOfFact | null): this { this.put("sto", data, asOf); return this; }
  log(data: unknown, asOf?: AsOfFact | null): this { this.put("log", data, asOf); return this; }

  build(): AwsNormalizedInput {
    const idReceipt = this.n + 1000;                       // 신원 영수증은 번호가 겹치지 않게 뒤쪽 번호
    const idKey = rk(0, idReceipt);
    this.receipts.set(idKey, { key: idKey, input: 0, call: "sts:GetCallerIdentity", region: "global", subscription: null, resource: null, result: "ok", count: null, errorCode: null, at: AT, used: true });
    const input: AwsNormalizedInput = {
      model: NORMALIZED_MODEL, cloud: "aws", mode: { kind: "real" },
      inputs: [this.inputFacts("cloudcheck-aws-result.json", `aws|${this.accountId}|${AT.iso}`, { name: "cloudcheck-aws", version: "1.0.0", sha256: null, knownRelease: null })],
      identity: {
        input: 0, source: "collector", accountId: this.accountId, alias: none(byReceipt(idKey)),
        principalType: "assumed-role", principalName: "SecurityAuditRole", confirmed: "interactive", receipt: idKey,
      },
      doors: this.doorsRecord() as unknown as AwsDoors,
      receipts: this.receiptsMap(),
      coverage: this.coverageTable() as unknown as AwsNormalizedInput["coverage"],
      notices: { redactions: 0, sectionIssues: [] },
    };
    return deepFreeze(input);
  }
}

/* ───────── Azure ───────── */
export class MicroAzure extends MicroBase<AzureFamilyId, AzureNormalizedInput> {
  tenantId = guid(1);
  subscriptions = [guid(11)];
  constructor() { super(); }
  protected families(): readonly AzureFamilyId[] { return AZURE_FAMILIES; }

  mfa(data: unknown, asOf?: AsOfFact | null): this { this.put("mfa", data, asOf); return this; }
  key(data: unknown, asOf?: AsOfFact | null): this { this.put("key", data, asOf); return this; }
  net(data: unknown, asOf?: AsOfFact | null): this { this.put("net", data, asOf); return this; }
  sto(data: unknown, asOf?: AsOfFact | null): this { this.put("sto", data, asOf); return this; }
  log(data: unknown, asOf?: AsOfFact | null): this { this.put("log", data, asOf); return this; }

  build(): AzureNormalizedInput {
    const idKey = rk(0, this.n + 1000);
    this.receipts.set(idKey, { key: idKey, input: 0, call: "azure:account.show", region: null, subscription: null, resource: null, result: "ok", count: null, errorCode: null, at: AT, used: true });
    const input: AzureNormalizedInput = {
      model: NORMALIZED_MODEL, cloud: "azure", mode: { kind: "real" },
      inputs: [this.inputFacts("cloudcheck-azure-result.json", `azure|${this.tenantId}|${AT.iso}`, { name: "cloudcheck-azure", version: "1.0.0", sha256: null, knownRelease: null })],
      identity: {
        input: 0, source: "collector", tenantId: this.tenantId, currentSubscription: this.subscriptions[0] ?? null, cloudName: "AzureCloud",
        principalType: "entra-user", confirmed: "interactive", receipt: idKey,
      },
      doors: this.doorsRecord() as unknown as AzureDoors,
      receipts: this.receiptsMap(),
      coverage: this.coverageTable() as unknown as AzureNormalizedInput["coverage"],
      notices: { redactions: 0, sectionIssues: [] },
    };
    return deepFreeze(input);
  }
}

export const unit = (name: string, state: UnitCoverage["state"], receipt: ReceiptKey | null, why: UnknownReason | null = null): UnitCoverage => ({ unit: name, state, why, receipt });
