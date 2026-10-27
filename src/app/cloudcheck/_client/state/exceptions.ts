// src/app/cloudcheck/_client/state/exceptions.ts — 예외 표시 흐름의 순수 함수. 소유: 페이지개발자. 근거: 디자인 최종안 §6-0 '예외 표시', 방향서 §5-3, 상태 불변 INV-8.
//  - 새 항목 { ruleId, resource: item.resource.key, reason, until, createdAt: todayLocal() } 를 만든 뒤
//    parseExceptions(serializeExceptions(next)) 로 왕복 검사한다(스키마를 따로 import하지 않는 단일 원천).
//  - 라벨은 overlayExceptions() 결과로만 그린다. 여기서는 파일(항목 목록)만 다룬다. 상태(위험·주의 등)는 건드리지 않는다.
import type { ExceptionsFile } from "../../../../lib/cloudcheck/contract/exceptions-schema";
import type { IsoDate, ItemResult } from "../../../../lib/cloudcheck/model/report";
import type { EngineDeps } from "./deps";

/** 빈 예외 파일. schema 리터럴은 ExceptionsFile 타입이 강제한다(바뀌면 type-check가 알린다) */
export const EMPTY_EXCEPTIONS: ExceptionsFile = { schema: "cloudcheck.exceptions/1.0", entries: [] };

/** 불러오는 예외 파일 크기 상한(무한 읽기 방지. 예외는 최대 1000건 글자라 이보다 훨씬 작다) */
export const EXC_FILE_MAX_BYTES = 5 * 1024 * 1024;

export type ExceptionEntry = ExceptionsFile["entries"][number];
export type ExceptionResult = { readonly ok: true; readonly file: ExceptionsFile } | { readonly ok: false; readonly issues: readonly string[] };

/** 예외 항목을 만든다(대상의 MatchKey는 화면에 그리지 않고 파일 값으로만 쓴다) */
export function makeEntry(item: ItemResult, v: { readonly reason: string; readonly until: IsoDate }, today: IsoDate): ExceptionEntry {
  return { ruleId: item.ruleId, resource: item.resource.key, reason: v.reason.trim(), until: v.until, createdAt: today };
}

const sameTarget = (e: ExceptionEntry, ruleId: string, resource: string): boolean => e.ruleId === ruleId && e.resource === resource;

/** 같은 점검·같은 대상의 기존 항목은 새 항목으로 바꾼다. 왕복 검사에 실패하면 파일을 바꾸지 않는다 */
export function addException(deps: EngineDeps, file: ExceptionsFile | null, entry: ExceptionEntry): ExceptionResult {
  const base = file ?? EMPTY_EXCEPTIONS;
  const next: ExceptionsFile = { ...base, entries: [...base.entries.filter((e) => !sameTarget(e, entry.ruleId, entry.resource)), entry] };
  const back = deps.parseExceptions(deps.serializeExceptions(next));
  return back.ok ? { ok: true, file: back.file } : { ok: false, issues: back.issues };
}

/** 대상 하나의 예외 항목을 뺀다. 항목이 없으면 그대로 */
export function removeException(file: ExceptionsFile | null, item: ItemResult): ExceptionsFile | null {
  if (file === null) return null;
  const entries = file.entries.filter((e) => !sameTarget(e, item.ruleId, item.resource.key));
  return entries.length === file.entries.length ? file : { ...file, entries };
}

/** parseExceptions 실패 사유 코드 → 카탈로그 키(모르는 값은 format — 디자인 X10) */
export const EXCEPTION_ISSUES = ["format", "reason", "until", "span", "rule", "too-many"] as const;
export type ExceptionIssue = (typeof EXCEPTION_ISSUES)[number];
export function firstIssue(issues: readonly string[]): ExceptionIssue {
  for (const i of issues) if ((EXCEPTION_ISSUES as readonly string[]).includes(i)) return i as ExceptionIssue;
  return "format";
}
