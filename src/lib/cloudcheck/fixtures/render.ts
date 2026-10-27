// src/lib/cloudcheck/fixtures/render.ts — 시험 도구: 리포트의 메시지(MsgRef)를 한국어 카탈로그(ENGINE_KO)로 글자로 바꿔 본다.
// 화면(프론트 _client/i18n의 keyOf · t())와 같은 규칙이다: 코드 → 키 → 템플릿의 {이름}을 파라미터로 채운다. 빠진 자리는 {이름} 그대로 남는다(조용히 지우지 않는다).
// 사용자 데이터({v})는 내용이 시험을 흔들지 않게 고정 글자로 바꾼다. 현재 시각을 읽지 않고 판정 코드를 import하지 않는다(리포트 JSON만 읽는다).
import type { MessageCode, MsgParam, MsgRef } from "../model/report";
import { ENGINE_KO } from "../rules/i18n/ko";
import { walk } from "./invariants";

const KO: Readonly<Record<string, string>> = ENGINE_KO;

/** 확인 불가 사유 21종(모델 UnknownReason과 같다) */
const UNKNOWN = new Set<string>([
  "denied", "error", "throttled", "truncated", "unsupported", "budget-exceeded", "region-missing", "subscription-missing", "scope-unproven", "csv-scope-unproven",
  "csv-row-ambiguous", "field-missing", "value-unrecognized", "schema-unsupported", "parse-failed", "not-collected", "stale-evidence", "population-mismatch",
  "clear-without-evidence", "no-clear-rule", "guide-only",
]);

/** 메시지 코드 → 카탈로그 키(프론트 keyOf와 같은 규칙) */
export function keyOf(code: MessageCode | string): string {
  if (UNKNOWN.has(code)) return `cc.reason.unknown.${code}`;
  const c = code.toLowerCase();
  if (c === "isolated-denial" || c === "no-targets-proven") return `cc.reason.${c}`;
  if (c.startsWith("fact:")) return `cc.fact.${c.slice(5)}`;
  const i = c.indexOf(":");
  return i > 0 ? `cc.reason.${c.slice(0, i)}.${c.slice(i + 1)}` : `cc.reason.${c}`;
}

export const templateOf = (code: MessageCode | string): string | undefined => KO[keyOf(code)];

/** 사용자 데이터 자리에 들어가는 고정 글자 */
export const USER_VALUE = "⟨값⟩";

export function renderParam(p: MsgParam): string {
  if ("n" in p) return String(p.n);
  if ("t" in p) return p.t;
  if ("d" in p) return p.d;
  if ("c" in p) return p.c;
  return USER_VALUE;
}

/** 메시지를 글자로. 키가 없으면 ⟦키⟧, 빠진 파라미터는 {이름} 그대로 */
export function renderMsg(m: MsgRef): string {
  const key = keyOf(m.code);
  const template = KO[key];
  if (template === undefined) return `⟦${key}⟧`;
  return template.replace(/\{([A-Za-z][A-Za-z0-9]*)\}/g, (whole, name: string) => {
    const p = m.params?.[name];
    return p === undefined ? whole : renderParam(p);
  });
}

/** 리포트 안의 모든 메시지(MsgRef: code와 선택적 params만 가진 객체)와 그 위치 */
export function collectMsgs(report: unknown): { readonly path: string; readonly msg: MsgRef }[] {
  const out: { path: string; msg: MsgRef }[] = [];
  walk(report, (o, path) => {
    const keys = Object.keys(o);
    if (typeof o.code === "string" && keys.every((k) => k === "code" || k === "params")) out.push({ path, msg: o as unknown as MsgRef });
  });
  return out;
}
