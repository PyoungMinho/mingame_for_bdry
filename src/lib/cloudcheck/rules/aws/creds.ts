// src/lib/cloudcheck/rules/aws/creds.ts — IAM 자격증명 룰(AWS-MFA-*, AWS-KEY-*) 공용 헬퍼
import type { AwsAccessKey, AwsKeyData, Instant, Slot, Src } from "../../contract/normalized";
import type { RuleCtx } from "../../engine/types";
import type { UnknownReason } from "../../model/report";
import { C, fact, gapOfSlot } from "../kit";

/** 키 상태: 활성 / 비활성 / 모름(활성 여부 슬롯이 답이 아님) */
export function keyState(k: AwsAccessKey): "active" | "inactive" | "unknown" {
  if (k.active.k !== "value") return "unknown";
  return k.active.value ? "active" : "inactive";
}

/** 키 표시용 식별: 수집기 경로는 끝 4자리, 보고서 경로는 슬롯 번호 */
export const keyLabel = (k: AwsAccessKey): string => k.idSuffix ?? (k.slot === null ? "?" : `slot${k.slot}`);

/** 열쇠 문의 시각 칸(사용자 만든 날 · 콘솔 마지막 사용 · 키 만든 날 · 키 마지막 사용): 기준 시각이 증거보다 이른지 가르는 데 쓴다 */
export function keyDoorTimes(data: AwsKeyData): { t: Instant; src: Src | null }[] {
  const out: { t: Instant; src: Src | null }[] = [];
  const take = (s: Slot<Instant | null>): void => { if ((s.k === "value" || s.k === "partial") && s.value !== null) out.push({ t: s.value, src: s.src }); };
  const users = data.users;
  if (users.k !== "value" && users.k !== "partial") return out;
  for (const u of users.value) {
    take(u.createdAt);
    take(u.passwordLastUsed);
    if (u.keys.k === "value" || u.keys.k === "partial") for (const k of u.keys.value) { take(k.createdAt); take(k.lastUsed); }
  }
  return out;
}

/** 값이 답이 아닐 때의 사유(없으면 value-unrecognized로 둔다) */
export const reasonOf = (s: Slot<unknown>, fallback: UnknownReason = "value-unrecognized"): UnknownReason => gapOfSlot(s) ?? fallback;

/**
 * 보고서에서 온 증거(CSV 칸이 달린 출처)가 허용 신선도보다 오래됐는가.
 * 수집기 실시간 호출(list-*)에서 온 사실은 보고서 신선도와 무관하다.
 */
export const staleReport = (ctx: RuleCtx<unknown>, ...srcs: readonly (Src | null)[]): boolean => !ctx.reportFresh && srcs.some((s) => s !== null && s.csv !== null);

/** 관리형 정책 ARN → 정책 이름(경로 없는 AWS 관리형만). 그 밖은 null */
export function awsManagedPolicyName(arn: string): string | null {
  const m = /^arn:aws[a-z-]*:iam::aws:policy\/([^/]+)$/.exec(arn);
  return m === null ? null : m[1];
}

/** 키를 가리키는 사실: 수집기 경로는 끝 4자리, 보고서 경로(키 ID 없음)는 슬롯 번호 */
export const keyFact = (k: AwsAccessKey) => (k.idSuffix !== null ? fact("key-suffix", { suffix: C(k.idSuffix) }) : fact("key-slot", { slot: C(k.slot === null ? "?" : String(k.slot)) }));
