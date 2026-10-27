// src/lib/cloudcheck/collector/testkit.ts — 수집기 shim 실행 도우미(테스트 전용 · Node 전용)
// 실제 bash로 수집기를 돌리되, PATH 맨 앞에 가짜 aws/az/date/sleep을 끼운다. 이 맥에는 aws·az CLI가 없고(확인), 실제 클라우드는 부르지 않는다.
//  - 환경을 최소화한다(PATH·HOME·TMPDIR·시나리오 경로뿐). 실제 자격증명이 섞일 여지가 없다.
//  - 시나리오에 없는 호출은 shim이 종료 코드 99 + UNEXPECTED로 돌려주고 로그에 남긴다 → result.unexpected로 테스트가 잡는다.
//  - 레포의 실행 비트에 기대지 않는다(임시 bin 디렉터리에 복사해 chmod 755).
// 이 모듈은 production 번들에 들어가지 않는다(src/app이 import하지 않는다).
import { spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

export const COLLECTOR_DIR = resolve(__dirname);
export const SCRIPT_PATH = { aws: join(COLLECTOR_DIR, "cloudcheck-aws.sh"), azure: join(COLLECTOR_DIR, "cloudcheck-azure.sh") } as const;
const SHIM_DIR = join(COLLECTOR_DIR, "__shims__");

/* ───────── 시나리오 ───────── */
export interface ShimEntry { readonly stdout?: string; readonly stderr?: string; readonly rc?: number }
/** 배열이면 호출 순서대로 응답한다(마지막 응답을 반복) — 보고서 생성 폴링 등 */
export type ShimValue = ShimEntry | readonly ShimEntry[];
/** 키 = "<명령 토큰들>" + "#<리소스>" + "@<리전 또는 구독>" (예: "s3api get-bucket-acl#amzn-s3-demo-logs@ap-northeast-2") */
export type Scenario = Readonly<Record<string, ShimValue>>;

export const sanitizeKey = (k: string): string => k.replace(/[^A-Za-z0-9._-]/g, "_");

/* ───────── 실행 ───────── */
export interface ShimCall { readonly tool: string; readonly args: readonly string[] }
export interface RunOptions {
  readonly cloud: "aws" | "azure";
  readonly scenario: Scenario;
  readonly args?: readonly string[];
  readonly env?: Readonly<Record<string, string>>;
  /** 기본: 레포의 수집기. 린터 샘플·변조 시험에서 다른 스크립트 경로를 줄 수 있다 */
  readonly scriptPath?: string;
  /** 스크립트 원문을 직접 준다(잘린 파일·변조 시험). scriptPath보다 우선하며 임시 디렉터리에 써서 실행한다 */
  readonly scriptText?: string;
  readonly timeoutMs?: number;
  /** date shim이 돌려줄 시각(YYYY-MM-DDTHH:MM:SSZ) */
  readonly fakeNow?: string;
  /** PATH에서 뺄 도구. "aws"/"az"는 shim을 설치하지 않고, 나머지는 실제 도구를 링크하지 않는다 */
  readonly withoutTools?: readonly string[];
  /** 표준 입력(비대화형이라 TTY가 아니다) */
  readonly input?: string;
  /** 작업 디렉터리에 미리 둘 파일 */
  readonly workFiles?: Readonly<Record<string, string>>;
  readonly keepDir?: boolean;
}
export interface RunResult {
  readonly status: number | null;
  readonly signal: string | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly calls: readonly ShimCall[];
  readonly unexpected: readonly string[];
  readonly sleeps: number;
  /** 작업 디렉터리에 남은 파일 이름 */
  readonly files: readonly string[];
  /** 결과 파일(cloudcheck-<cloud>-*.json) 이름·원문. 없으면 null */
  readonly outputName: string | null;
  readonly outputText: string | null;
  readonly output: unknown;
  /** 결과 파일 권한(8진수 문자열, 예: "600"). 없으면 null */
  readonly outputMode: string | null;
  readonly dir: string;
}

/** 실제 도구를 가져오는 목록(withoutTools로 뺄 수 있다). jq는 시스템 것을 쓴다 */
const REAL_TOOLS = ["jq", "mktemp", "head", "cat", "mv", "rm", "shasum", "sha256sum", "uname"] as const;
const SYSTEM_PATH = ["/usr/bin", "/bin", "/usr/sbin", "/sbin"] as const;
function findTool(name: string): string | null {
  for (const d of SYSTEM_PATH) { const p = join(d, name); if (existsSync(p)) return p; }
  return null;
}

export function runCollector(opts: RunOptions): RunResult {
  const root = mkdtempSync(join(tmpdir(), "cc-run-"));
  const bin = join(root, "bin"), scn = join(root, "scn"), work = join(root, "work"), home = join(root, "home"), tmp = join(root, "tmp");
  for (const d of [bin, scn, work, home, tmp]) mkdirSync(d);
  const without = new Set(opts.withoutTools ?? []);
  try {
    // shim 설치(복사 + chmod): aws/az는 같은 파일, date·sleep은 고정 동작
    const install = (src: string, name: string): void => { const dst = join(bin, name); copyFileSync(join(SHIM_DIR, src), dst); chmodSync(dst, 0o755); };
    if (!without.has("aws")) install("cli.sh", "aws");
    if (!without.has("az")) install("cli.sh", "az");
    install("date.sh", "date");
    install("sleep.sh", "sleep");
    for (const t of REAL_TOOLS) {
      if (without.has(t)) continue;
      const real = findTool(t);
      if (real) symlinkSync(real, join(bin, t));
    }
    // 시나리오 풀기: 키마다 응답 파일(.out/.err/.rc)과 개수(.n)
    const seen = new Map<string, string>();
    for (const [key, val] of Object.entries(opts.scenario)) {
      const f = sanitizeKey(key);
      const prev = seen.get(f);
      if (prev !== undefined && prev !== key) throw new Error(`시나리오 키 충돌: "${prev}" ↔ "${key}"`);
      seen.set(f, key);
      const list: readonly ShimEntry[] = Array.isArray(val) ? (val as readonly ShimEntry[]) : [val as ShimEntry];
      list.forEach((e, i) => {
        writeFileSync(join(scn, `${f}.${i}.out`), e.stdout ?? "");
        writeFileSync(join(scn, `${f}.${i}.err`), e.stderr ?? "");
        writeFileSync(join(scn, `${f}.${i}.rc`), String(e.rc ?? 0));
      });
      writeFileSync(join(scn, `${f}.n`), String(list.length));
    }
    for (const [name, text] of Object.entries(opts.workFiles ?? {})) writeFileSync(join(work, name), text);
    const log = join(root, "shim.log");
    writeFileSync(log, "");
    const env: Record<string, string> = {
      PATH: bin, HOME: home, TMPDIR: tmp, LANG: "C",
      CC_SHIM_LOG: log, CC_SHIM_DIR: scn, CC_FAKE_NOW: opts.fakeNow ?? "2026-10-19T03:12:00Z",
      AWS_CONFIG_FILE: "/nonexistent", AWS_SHARED_CREDENTIALS_FILE: "/nonexistent",
      ...(opts.env ?? {}),
    };
    let script = opts.scriptPath ?? SCRIPT_PATH[opts.cloud];
    if (opts.scriptText !== undefined) { script = join(root, "script.sh"); writeFileSync(script, opts.scriptText); }
    const r = spawnSync("/bin/bash", [script, ...(opts.args ?? [])], {
      cwd: work, env: env as unknown as NodeJS.ProcessEnv, encoding: "utf8", timeout: opts.timeoutMs ?? 60_000, input: opts.input ?? "", maxBuffer: 256 * 1024 * 1024,
    });
    const calls: ShimCall[] = [];
    const unexpected: string[] = [];
    let sleeps = 0;
    for (const line of readFileSync(log, "utf8").split("\n")) {
      if (!line) continue;
      if (line.startsWith("!UNEXPECTED\t")) { unexpected.push(line.slice("!UNEXPECTED\t".length)); continue; }
      const [tool, ...args] = line.split("\u001f");
      if (tool === "sleep") sleeps++; else calls.push({ tool, args });
    }
    const files = readdirSync(work).sort();
    const outputName = files.find((n) => new RegExp(`^cloudcheck-${opts.cloud}-.*\\.json$`).test(n)) ?? null;
    const outputText = outputName ? readFileSync(join(work, outputName), "utf8") : null;
    const outputMode = outputName ? (statSync(join(work, outputName)).mode & 0o777).toString(8) : null;
    let output: unknown = null;
    if (outputText !== null) { try { output = JSON.parse(outputText); } catch { output = null; } }
    return {
      status: r.status, signal: r.signal, stdout: r.stdout ?? "", stderr: r.stderr ?? "",
      calls, unexpected, sleeps, files, outputName, outputText, output, outputMode, dir: root,
    };
  } finally {
    if (!opts.keepDir) rmSync(root, { recursive: true, force: true });
  }
}

/** 호출 로그에서 "svc op" 형태의 명령(aws) 또는 토큰열(az)을 뽑는다 — 카탈로그 일치 검사용 */
export function commandOf(c: ShimCall): string {
  if (c.tool === "aws") return `aws ${c.args[0] ?? ""} ${c.args[1] ?? ""}`;
  const toks: string[] = [];
  for (const a of c.args) { if (a.startsWith("-")) break; toks.push(a); }
  return `az ${toks.join(" ")}`;
}
