// src/lib/cloudcheck/parse/normalize-common.ts — 정규화 공통 도구 (슬롯 만들기 · 영수증 색인 · 범위 초안)
// contract/normalized.ts의 Slot 주석("영수증 → 슬롯" 연결 규칙)을 그대로 구현한다:
//   ok + 값 = value / empty + 값([]) = value / empty + null(단일 값) = none / truncated + 값 = partial / notconfigured + null = none
//   / denied·error·throttled·unsupported + null = missing(result) / ok + null = missing(field-missing)
//   / 실패·notconfigured인데 값이 있음 = 모순 → 그 섹션 전체 missing(schema-unsupported) + notices.sectionIssues
import { AWS_CALLS, AZURE_CALLS } from "../contract/calls";
import type { AwsCall, AzureCall } from "../contract/calls";
import type { AwsReceipt, AzureReceipt } from "../contract/collect-schema";
import { sealCoverage } from "../contract/normalized";
import type {
  CoverageDraft, FamilyId, Instant, MissingReason, PartialReason, ReceiptFact, ReceiptKey, SectionIssue, Slot, Src, UnitCoverage,
} from "../contract/normalized";
import type { CoverageKind, DoorId, UnknownReason } from "../model/report";
import type { z } from "zod";
import type { CollectorParsed } from "./handle";
import type { Redactor } from "./secrets";
import { parseInstant } from "./strict-time";

type RawReceipt = z.infer<typeof AwsReceipt> | z.infer<typeof AzureReceipt>;

/** 섹션을 통째로 무효로 만드는 모순(영수증 참조 끊김, 호출·리소스 불일치, 실패 영수증 아래의 데이터 …) */
export class SectionInvalid extends Error {}

/** 열거 목록에 같은 대상이 두 번 든 모순(섹션 무효의 한 종류 — 항목 안쪽 목록이면 그 슬롯만 무효로 좁힐 수 있게 따로 구별한다) */
export class DuplicateTarget extends SectionInvalid {}
/** 열거 목록에 같은 대상이 두 번 들면 그 열거는 무효다: 개수만 맞는 바꿔치기(빠진 대상을 복제로 채움)를 막는다(CC-QA-15) */
export function noDup(keys: readonly string[], what: string): void {
  if (new Set(keys).size !== keys.length) throw new DuplicateTarget(`${what}이(가) 두 번 나온다`);
}

export const keyOf = (input: number, id: string): ReceiptKey => `${input}:${id}` as ReceiptKey;

/** 수집기 입력 1개의 영수증 색인 + 슬롯 만들기 도구 */
export class InputCtx {
  readonly facts = new Map<string, ReceiptFact>();   // 원본 영수증 ID(r-0001) → 사실
  constructor(readonly index: number, readonly p: CollectorParsed, readonly red: Redactor, readonly issues: SectionIssue[]) {
    const raw = (p.envelope.receipts as RawReceipt[]);
    for (const r of raw) {
      const at = parseInstant(r.at) as Instant;   // recognize가 이미 검증했다
      this.facts.set(r.id, {
        key: keyOf(index, r.id), input: index, call: r.call as AwsCall | AzureCall,
        region: r.region ?? null, subscription: "subscription" in r && r.subscription ? r.subscription.toLowerCase() : null,
        resource: r.resource === undefined || r.resource === null ? null : red.fix(r.resource),
        result: r.result, count: r.count, errorCode: r.errorCode, at, used: false,
      });
    }
  }
  /** 이 입력에서 문 d가 수집됐는가 */
  collected(d: DoorId): boolean { return this.p.envelope.run.doors[d] === "collected"; }
  src(id: string): Src { return { input: this.index, receipt: keyOf(this.index, id), csv: null }; }
  fact(id: string): ReceiptFact {
    const f = this.facts.get(id);
    if (!f) throw new SectionInvalid(`없는 영수증 참조: ${id}`);
    return f;
  }
  /** 영수증이 기대한 호출·리소스·리전·구독인지 확인한다(어긋나면 섹션 무효) */
  link(id: string, call: AwsCall | AzureCall, want: { resource?: string | null; region?: string; subscription?: string } = {}): ReceiptFact {
    const f = this.fact(id);
    if (f.call !== call) throw new SectionInvalid(`영수증 ${id}의 호출이 ${call}이(가) 아니다(${f.call})`);
    if (want.resource !== undefined && f.resource !== (want.resource === null ? null : this.red.fix(want.resource))) throw new SectionInvalid(`영수증 ${id}의 리소스가 다르다`);
    if (want.region !== undefined && f.region !== want.region) throw new SectionInvalid(`영수증 ${id}의 리전이 다르다`);
    if (want.subscription !== undefined && f.subscription !== want.subscription.toLowerCase()) throw new SectionInvalid(`영수증 ${id}의 구독이 다르다`);
    return f;
  }
  addIssue(door: DoorId, section: string, reason: SectionIssue["reason"]): void {
    if (!this.issues.some((i) => i.input === this.index && i.door === door && i.section === section && i.reason === reason)) this.issues.push({ input: this.index, door, section, reason });
  }
  /** 섹션 하나를 만든다. 모순(SectionInvalid)이면 fallback을 돌려주고 이슈를 남긴다 */
  guard<T>(door: DoorId, section: string, build: () => T, fallback: () => T): T {
    try { return build(); } catch (e) {
      if (!(e instanceof SectionInvalid)) throw e;
      this.addIssue(door, section, "schema-section");
      return fallback();
    }
  }
  /** 섹션 검증 결과 읽기: undefined = 파일에 없음, null = 스키마 불일치, 그 밖 = 값 */
  section<T>(name: string): T | null | undefined {
    const s = this.p.sections.get(name);
    if (s === undefined) return undefined;
    return s.ok ? (s.value as T) : null;
  }
}

/** 실패 영수증 결과 → 슬롯 사유 */
export const FAIL_RESULTS = ["denied", "error", "throttled", "unsupported"] as const;
export type FailResult = (typeof FAIL_RESULTS)[number];
export const isFail = (r: string): r is FailResult => (FAIL_RESULTS as readonly string[]).includes(r);

/**
 * Ev 슬롯({receipt, value}) → Slot<T>. 영수증 결과와 값을 함께 보고 null의 뜻을 푼다.
 *  - 모순(실패·notconfigured인데 값이 있음, 목록 개수 ≠ 영수증 count)은 SectionInvalid
 *  - toValue가 null을 돌려주면 그 슬롯만 missing(value-unrecognized)
 */
export function evSlot<V, T>(f: ReceiptFact, value: V | null, toValue: (v: V) => T | null): Slot<T> {
  const src: Src = { input: f.input, receipt: f.key, csv: null };
  if (isFail(f.result)) {
    if (value !== null) throw new SectionInvalid(`실패 영수증(${f.result}) 아래에 데이터가 있다`);
    return { k: "missing", why: f.result, src };
  }
  if (f.result === "notconfigured") {
    if (value !== null) throw new SectionInvalid("notconfigured 영수증 아래에 데이터가 있다");
    return { k: "none", src };
  }
  if (value === null) return f.result === "empty" ? { k: "none", src } : { k: "missing", why: "field-missing", src };
  if (Array.isArray(value)) {
    if (f.result === "empty" && value.length > 0) throw new SectionInvalid("empty 영수증인데 목록이 비어 있지 않다");
    if (f.count !== null && f.result !== "empty" && value.length !== f.count) throw new SectionInvalid(`영수증 count ${f.count} ≠ 목록 ${value.length}`);
  }
  const v = toValue(value);
  if (v === null) return { k: "missing", why: "value-unrecognized", src };
  return f.result === "truncated" ? { k: "partial", value: v, why: "truncated", src } : { k: "value", value: v, src };
}

export const missing = <T>(why: MissingReason, src: Src | null = null): Slot<T> => ({ k: "missing", why, src });
export const val = <T>(value: T, src: Src): Slot<T> => ({ k: "value", value, src });
export const part = <T>(value: T, why: PartialReason, src: Src): Slot<T> => ({ k: "partial", value, why, src });
export const none = <T>(src: Src): Slot<T> => ({ k: "none", src });

/** 슬롯 → 사유(UnknownReason). 빈틈 사유 계산용 */
export function slotWhy(s: Slot<unknown>): UnknownReason | null {
  if (s.k === "missing") return s.why;
  if (s.k === "partial") return s.why;
  return null;
}

/* ───────── 범위 초안 ───────── */
export interface CovArgs<F extends FamilyId> {
  family: F; input: number | null; complete: boolean; present: number; expected: number | null; gaps: UnknownReason[];
  receipts: readonly ReceiptKey[]; unit: { kind: CoverageKind; covered: number | null; total: number | null }; units?: UnitCoverage[];
  /** 완결일 때 증명한 구성원의 신원 집합(FamilyCoverage.memberKeys). 중복이 있거나 개수가 present와 다르면 sealCoverage가 미완결로 봉인한다 */
  memberKeys?: readonly string[];
}
/** 초안을 만들어 봉인한다(불변식이 깨지면 sealCoverage가 미완결로 봉인한다) */
export function seal<F extends FamilyId>(a: CovArgs<F>): ReturnType<typeof sealCoverage<F>> {
  const draft: CoverageDraft<F> = {
    family: a.family, input: a.input, complete: a.complete, population: a.complete ? a.present : null, present: a.present, expected: a.expected,
    gaps: a.complete ? [] : a.gaps, receipts: a.receipts, unit: a.unit, units: a.units ?? [],
    ...(a.memberKeys !== undefined && a.complete ? { memberKeys: a.memberKeys } : {}),
  };
  return sealCoverage(draft);
}

export const ACCOUNT_UNIT = (ok: boolean): { kind: CoverageKind; covered: number | null; total: number | null } => ({ kind: "account-global", covered: ok ? 1 : 0, total: 1 });

/** 영수증 phases를 보고 이 영수증이 판정에 쓰였는지 계산한다 */
export function isUsed(call: AwsCall | AzureCall, inputIndex: number, selectedDoors: ReadonlySet<DoorId>, identityInput: number): boolean {
  const meta = (AWS_CALLS as Record<string, { phases: readonly string[] }>)[call] ?? (AZURE_CALLS as Record<string, { phases: readonly string[] }>)[call];
  if (!meta) return false;
  return meta.phases.some((ph) => {
    if (ph === "identity") return inputIndex === identityInput;
    if (ph === "scope") return selectedDoors.size > 0;
    return selectedDoors.has(ph as DoorId);
  });
}
