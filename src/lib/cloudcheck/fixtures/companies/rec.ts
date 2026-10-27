// src/lib/cloudcheck/fixtures/companies/rec.ts — 가짜 회사 빌더 공용: 영수증 기록기 · 장애 주입 · 시각 도우미
// 수집기가 호출마다 영수증 하나를 남기는 것을 흉내 낸다(ID는 r-0001부터 순서대로, 시각은 수집 시작 + 순번 초).
// 장애(Fault)는 회사 정의에 적고, 기록기가 호출·대상·리전·구독이 맞는 첫 장애를 골라 결과를 바꾼다. 값(data)은 호출 쪽에서 결과를 보고 비운다.
// 값은 문서 표본만 쓴다(계정 111122223333, 키 끝 4자리, 0으로 채운 GUID, amzn-s3-demo-…, example.com).

export type Result = "ok" | "empty" | "notconfigured" | "denied" | "error" | "throttled" | "truncated" | "unsupported";
/** ok-null = 호출은 성공했는데 응답에서 이 필드가 빠졌다(필드 부재) */
export type FaultKind = "denied" | "error" | "throttled" | "unsupported" | "truncated" | "ok-null";

export interface Fault {
  readonly call: string;
  readonly resource?: string;
  readonly region?: string;
  readonly subscription?: string;
  readonly kind: FaultKind;
  /** truncated: 받은 개수(1 이상) */
  readonly keep?: number;
}

export interface Scope { readonly region?: string; readonly resource?: string | null; readonly subscription?: string }
export interface Natural { readonly result: "ok" | "empty" | "notconfigured"; readonly count?: number | null; readonly errorCode?: string }

export interface Outcome {
  readonly id: string;
  readonly result: Result;
  /** 값(data)을 null로 둬야 하는가: 실패 · notconfigured · ok-null */
  readonly noValue: boolean;
  /** truncated일 때 값 목록을 자를 개수 */
  readonly keep: number | null;
}

export interface ReceiptOut {
  id: string;
  call: string;
  region?: string;
  subscription?: string;
  resource?: string | null;
  result: Result;
  count: number | null;
  errorCode: string | null;
  at: string;
}

const CODES: Readonly<Record<string, Readonly<Record<"denied" | "error" | "throttled" | "unsupported", string>>>> = {
  iam: { denied: "AccessDenied", error: "ServiceFailure", throttled: "Throttling", unsupported: "UnsupportedOperation" },
  ec2: { denied: "UnauthorizedOperation", error: "InternalError", throttled: "RequestLimitExceeded", unsupported: "UnsupportedOperation" },
  s3: { denied: "AccessDenied", error: "InternalError", throttled: "SlowDown", unsupported: "NotImplemented" },
  cloudtrail: { denied: "AccessDeniedException", error: "InternalFailure", throttled: "ThrottlingException", unsupported: "UnsupportedOperationException" },
  azure: { denied: "AuthorizationFailed", error: "InternalServerError", throttled: "TooManyRequests", unsupported: "FeatureNotSupportedForAccount" },
};
const codeFor = (call: string, kind: "denied" | "error" | "throttled" | "unsupported"): string => (CODES[call.split(":")[0]] ?? CODES.iam)[kind];

/* ───────── 시각 ───────── */
const STAMP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})Z$/;
export function stampMs(stamp: string): number {
  const m = STAMP.exec(stamp);
  if (m === null) throw new Error(`수집기 시각 형식 오류: ${stamp}`);
  const [y, mo, d, h, mi, s] = m.slice(1).map(Number);
  return Date.UTC(y, mo - 1, d, h, mi, s);
}
export const stampOf = (ms: number): string => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
/** AWS CLI가 내는 모양(+00:00)으로 */
export const awsTime = (stamp: string): string => stamp.replace(/Z$/, "+00:00");

/* ───────── 기록기 ───────── */
export class Recorder {
  readonly receipts: ReceiptOut[] = [];
  private readonly t0: number;
  constructor(collectedAt: string, private readonly faults: readonly Fault[]) { this.t0 = stampMs(collectedAt); }

  /** 호출 하나를 기록한다. natural = 장애가 없을 때의 결과 */
  call(call: string, scope: Scope, natural: Natural): Outcome {
    const fault = this.faults.find((f) =>
      f.call === call
      && (f.resource === undefined || f.resource === scope.resource)
      && (f.region === undefined || f.region === scope.region)
      && (f.subscription === undefined || f.subscription === scope.subscription));
    const id = `r-${String(this.receipts.length + 1).padStart(4, "0")}`;
    const at = stampOf(this.t0 + this.receipts.length + 1);
    const base: ReceiptOut = { id, call, result: "ok", count: null, errorCode: null, at };
    if (scope.region !== undefined) base.region = scope.region;
    if (scope.subscription !== undefined) base.subscription = scope.subscription;
    if (scope.resource !== undefined) base.resource = scope.resource;

    let out: Outcome;
    if (fault === undefined) {
      const r: ReceiptOut = { ...base, result: natural.result, count: natural.result === "empty" ? 0 : natural.count ?? null, errorCode: natural.result === "notconfigured" ? natural.errorCode ?? "NotConfigured" : null };
      this.receipts.push(this.ordered(r));
      out = { id, result: natural.result, noValue: natural.result === "notconfigured", keep: null };
    } else if (fault.kind === "truncated") {
      const keep = fault.keep ?? 1;
      this.receipts.push(this.ordered({ ...base, result: "truncated", count: keep, errorCode: null }));
      out = { id, result: "truncated", noValue: false, keep };
    } else if (fault.kind === "ok-null") {
      this.receipts.push(this.ordered({ ...base, result: "ok", count: null, errorCode: null }));
      out = { id, result: "ok", noValue: true, keep: null };
    } else {
      this.receipts.push(this.ordered({ ...base, result: fault.kind, count: null, errorCode: codeFor(call, fault.kind) }));
      out = { id, result: fault.kind, noValue: true, keep: null };
    }
    return out;
  }

  /** 키 순서를 고정한다(JSON 바이트가 빌드마다 같아야 한다): id · call · (region · subscription · resource) · result · count · errorCode · at */
  private ordered(r: ReceiptOut): ReceiptOut {
    const out: Record<string, unknown> = { id: r.id, call: r.call };
    if (r.region !== undefined) out.region = r.region;
    if (r.subscription !== undefined) out.subscription = r.subscription;
    if (r.resource !== undefined) out.resource = r.resource;
    out.result = r.result;
    out.count = r.count;
    out.errorCode = r.errorCode;
    out.at = r.at;
    return out as unknown as ReceiptOut;
  }

  /** 마지막 영수증 시각 + 1초 */
  finishedAt(): string {
    return stampOf(this.t0 + this.receipts.length + 1);
  }
}

/** 목록을 자르는 장애(truncated)면 keep개만, 아니면 그대로 */
export function applyList<T>(o: Outcome, list: readonly T[]): T[] | null {
  if (o.noValue) return null;
  return o.keep === null ? [...list] : list.slice(0, o.keep);
}
