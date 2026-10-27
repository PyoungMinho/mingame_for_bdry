// src/lib/cloudcheck/collector/testcommon.ts — AWS·Azure shim 실행 테스트의 공통 검사 (테스트 전용)
// 2차 방어(백엔드팀장 검토 §2-7): 정적 린트가 못 잡는 우회를 실행 기록으로 잡는다 — 실제로 호출된 모든 명령이 카탈로그에 속하고,
// 금지 플래그가 없고, 호출마다 영수증이 하나씩 남고, 결과 파일이 계약 스키마를 통과하고 비밀 모양 문자열이 없는지 본다.
import { AWS_CALLS, AZURE_CALLS } from "../contract/calls";
import { AwsCollectFile, AzureCollectFile } from "../contract/collect-schema";
import { commandOf } from "./testkit";
import type { RunResult, ShimCall } from "./testkit";

export const FORBIDDEN_FLAGS = ["--endpoint-url", "--debug", "--no-verify-ssl", "--ca-bundle", "--cli-input-json", "--cli-input-yaml", "--generate-cli-skeleton"] as const;

/** 로컬 버전 조회(`aws --version`, `az version`)를 뺀 실제 클라우드 호출 */
export const realCalls = (r: RunResult): ShimCall[] => r.calls.filter((c) => c.args[0] !== "--version" && !(c.tool === "az" && c.args[0] === "version"));
export const catalogClis = (cloud: "aws" | "azure"): Set<string> => new Set(Object.values(cloud === "aws" ? AWS_CALLS : AZURE_CALLS).map((m) => m.cli));

/** 결과 JSON 안의 모든 receipt 참조(문자열 r-NNNN)를 모은다 */
export function receiptRefs(node: unknown, out: string[] = []): string[] {
  if (Array.isArray(node)) { node.forEach((x) => receiptRefs(x, out)); return out; }
  if (typeof node !== "object" || node === null) return out;
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    if ((k === "receipt" || k === "generateReceipt") && typeof v === "string") out.push(v);
    else receiptRefs(v, out);
  }
  return out;
}

/** 어떤 시나리오에서든 지켜야 하는 것. 위반 설명 문자열 배열을 돌려준다(빈 배열 = 통과) */
export function commonProblems(r: RunResult, cloud: "aws" | "azure"): string[] {
  const out: string[] = [];
  if (r.signal) out.push(`신호로 종료: ${r.signal}`);
  if (r.unexpected.length > 0) out.push(`시나리오 밖 호출: ${r.unexpected.join(", ")}`);
  const cat = catalogClis(cloud);
  const calls = realCalls(r);
  for (const c of calls) {
    const cmd = commandOf(c);
    if (!cat.has(cmd)) out.push(`카탈로그 밖 명령: ${cmd}`);
    if (cloud === "aws") {
      const i = c.args.indexOf("--output");
      if (i < 0 || c.args[i + 1] !== "json") out.push(`--output json 없음: ${cmd}`);
    } else {
      const i = c.args.indexOf("-o");
      if (i < 0 || c.args[i + 1] !== "json" || !c.args.includes("--only-show-errors")) out.push(`-o json --only-show-errors 없음: ${cmd}`);
    }
    for (const f of FORBIDDEN_FLAGS) if (c.args.includes(f)) out.push(`금지 플래그 ${f}: ${cmd}`);
    if (c.args.some((a) => /\bAKIA[0-9A-Z]{16}\b/.test(a))) out.push(`호출 인자에 키 ID: ${cmd}`);
  }
  if (r.outputText !== null) {
    const parsed = (cloud === "aws" ? AwsCollectFile : AzureCollectFile).safeParse(r.output);
    if (!parsed.success) out.push(`계약 스키마 위반: ${JSON.stringify(parsed.error.issues.slice(0, 3))}`);
    if (/AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}/.test(r.outputText)) out.push("출력에 키 ID 전체가 있다");
    // eslint-disable-next-line no-control-regex
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(r.outputText)) out.push("출력에 제어 문자가 있다");
    if (r.outputMode !== "600") out.push(`결과 파일 권한이 600이 아니다: ${String(r.outputMode)}`);
    if (r.outputText.trim().includes("\n")) out.push("결과 JSON이 한 줄이 아니다");
    const o = r.output as { receipts?: { id: string; call: string }[]; data?: unknown } | null;
    if (o && Array.isArray(o.receipts)) {
      const ids = o.receipts.map((x) => x.id);
      if (new Set(ids).size !== ids.length) out.push("영수증 ID가 중복된다");
      if (ids.some((id, i) => id !== `r-${String(i + 1).padStart(4, "0")}`)) out.push("영수증 ID가 r-0001부터 순서대로가 아니다");
      if (o.receipts.length !== calls.length) out.push(`영수증 ${o.receipts.length}건 ≠ 호출 ${calls.length}건`);
      const set = new Set(ids);
      for (const ref of receiptRefs(o)) if (!set.has(ref)) out.push(`없는 영수증 참조: ${ref}`);
    }
    if (!r.stderr.includes("결과 파일")) out.push("결과 파일 이름을 화면에 알리지 않았다");
  }
  return out;
}
