// src/lib/cloudcheck/parse/exceptions.ts — 예외 파일 읽기·쓰기 (방향서 §4-3, 디자인 X10)
// 예외는 상태를 바꾸지 않고 라벨만 붙인다(INV-8). 이 모듈은 파일 '모양'만 다룬다: 만료 판정은 overlayExceptions(report, file, today)가 한다.
// 실패하면 issues에 코드 문자열만 돌려준다(UI가 cc.report.exc.issue.<코드>로 문구를 만든다). 모르는 실패는 "format"이다.
import { ExceptionsFile } from "../contract/exceptions-schema";
import { isRedacted } from "../contract/normalized";
import { maxJsonDepth } from "./scan";
import { Redactor } from "./secrets";

export type ExceptionIssue = "format" | "reason" | "until" | "span" | "rule" | "too-many";
const ORDER: readonly ExceptionIssue[] = ["format", "reason", "until", "span", "rule", "too-many"];
const MAX_ENTRIES = 1000;
const MAX_CHARS = 4_000_000;   // 예외 1000개의 최대 크기(사유 500자 · 리소스 1024자 …)보다 넉넉한 상한

export function parseExceptions(text: string): { ok: true; file: ExceptionsFile } | { ok: false; issues: string[] } {
  const bad = (...codes: ExceptionIssue[]): { ok: false; issues: string[] } => ({ ok: false, issues: ORDER.filter((c) => codes.includes(c)) });
  try {
    if (typeof text !== "string") return bad("format");
    if (text.length > MAX_CHARS) return bad("too-many");
    const body = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
    if (maxJsonDepth(body, 32).exceeded) return bad("format");
    let root: unknown;
    try { root = JSON.parse(body); } catch { return bad("format"); }
    if (typeof root !== "object" || root === null || Array.isArray(root)) return bad("format");
    const entries = (root as { entries?: unknown }).entries;
    if (Array.isArray(entries) && entries.length > MAX_ENTRIES) return bad("too-many");
    const r = ExceptionsFile.safeParse(root);
    if (r.success) return { ok: true, file: hideSecrets(r.data) };
    const codes = new Set<ExceptionIssue>();
    // 날짜 모양이 틀린 항목은 기간(span)을 따질 수 없다 → span은 날짜 모양이 맞는 항목에서만 낸다(같은 잘못이 두 코드로 겹쳐 보이지 않게)
    const badDate = new Set<unknown>();
    for (const i of r.error.issues) if (i.path[0] === "entries" && (i.path[2] === "until" || i.path[2] === "createdAt")) badDate.add(i.path[1]);
    for (const i of r.error.issues) {
      const field = i.path[0] === "entries" && typeof i.path[1] === "number" ? i.path[2] : undefined;
      if (i.code === "too_big" && i.path.length === 1 && i.path[0] === "entries") codes.add("too-many");
      else if (i.code === "custom" && field === undefined && i.path[0] === "entries") { if (!badDate.has(i.path[1])) codes.add("span"); }
      else if (field === "ruleId") codes.add("rule");
      else if (field === "reason") codes.add("reason");
      else if (field === "until" || field === "createdAt") codes.add("until");
      else codes.add("format");
    }
    return bad(...(codes.size > 0 ? codes : new Set<ExceptionIssue>(["format"])));
  } catch {
    return bad("format");
  }
}

/**
 * 사유(자유 텍스트)에 비밀 모양이 있으면 그 사유를 지운 토큰으로 바꾼다(R-12: 올린 파일의 비밀 모양을 화면에 그리지 않는다 — CC-QA-12).
 * 엔진은 정리보다 먼저 isRedacted를 확인해 redacted(secret-pattern)로 그린다. 같은 사유는 같은 토큰이다
 */
function hideSecrets(file: ExceptionsFile): ExceptionsFile {
  const red = new Redactor();
  return { ...file, entries: file.entries.map((e) => ({ ...e, reason: red.fix(e.reason) })) };
}
/** 내보낼 때 지운 토큰(NUL이 든 내부 표지)은 사람이 읽는 안내 글로 바꾼다: 비밀 모양 값이 파일로 다시 나가지 않는다 */
const HIDDEN_REASON = "(비밀 모양 값이 있어 지웠습니다)";

/** 예외 파일을 사람이 읽을 수 있는 JSON 텍스트로(키 순서 고정 · 끝에 줄바꿈). parseExceptions(serializeExceptions(f))가 성립해야 한다 */
export function serializeExceptions(file: ExceptionsFile): string {
  const o = {
    schema: file.schema,
    entries: file.entries.map((e) => ({ ruleId: e.ruleId, resource: e.resource, reason: isRedacted(e.reason) ? HIDDEN_REASON : e.reason, until: e.until, createdAt: e.createdAt })),
  };
  return `${JSON.stringify(o, null, 2)}\n`;
}
