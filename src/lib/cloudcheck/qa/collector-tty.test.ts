// QA CL-03 — 수집기 TTY 경로 (설계서 §4-6, G4)
// /usr/bin/expect의 가상 터미널로 shim 수집기(AWS)를 돌린다(실제 클라우드 호출 없음 — PATH 맨 앞의 가짜 aws/date/sleep, collector/testkit.ts와 같은 환경).
//  ① 계정 확인에서 Enter → 진행, 마지막 'Enter = 삭제' 질문에서 Ctrl+C → 결과 파일이 남는다(지우지 않음)
//  ② 계정 확인에서 Ctrl+C → 결과·임시 파일 0, 호출은 신원 단계 2건뿐(sts get-caller-identity + iam list-account-aliases — 확인 화면에 별칭을 보여 주는 설계.
//     설계서의 '호출 1건'은 '신원 단계 호출만'으로 정정해 기록)
//  ③ 계정 확인 Enter → 마지막 질문에서 Enter → 결과 파일이 지워진다
//  ④ 비대화형(표준 입력이 터미널이 아님) + --yes 없음 → 종료 코드 3, 호출은 신원 단계 2건뿐
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";
import { awsBase } from "../collector/__scenarios__";
import { realCalls } from "../collector/testcommon";
import { runCollector, SCRIPT_PATH } from "../collector/testkit";

vi.setConfig({ testTimeout: 120_000 });
const EXPECT = "/usr/bin/expect";
const hasExpect = existsSync(EXPECT);

/** 비대화형 1회(④)로 shim 디렉터리를 만들고 남겨 둔다(keepDir) */
const prep = runCollector({ cloud: "aws", scenario: awsBase(), args: [], keepDir: true });
const root = prep.dir;
const work = join(root, "work");
const log = join(root, "shim.log");
afterAll(() => rmSync(root, { recursive: true, force: true }));

function envOf(): Record<string, string> {
  return {
    PATH: join(root, "bin"), HOME: join(root, "home"), TMPDIR: join(root, "tmp"), LANG: "C", TERM: "dumb",
    CC_SHIM_LOG: log, CC_SHIM_DIR: join(root, "scn"), CC_FAKE_NOW: "2026-10-19T03:12:00Z",
    AWS_CONFIG_FILE: "/nonexistent", AWS_SHARED_CREDENTIALS_FILE: "/nonexistent",
  };
}
/** expect 스크립트: 첫 질문(계정 확인)에 first, 두 번째 질문(삭제)에 second를 보낸다. second가 null이면 두 번째 질문을 기다리지 않는다 */
function tty(first: "enter" | "ctrl-c", second: "enter" | "ctrl-c" | null): { code: number | null; files: string[]; calls: number; out: string } {
  for (const f of readdirSync(work)) rmSync(join(work, f), { recursive: true, force: true });
  writeFileSync(log, "");
  const key = (k: "enter" | "ctrl-c"): string => (k === "enter" ? "\\r" : "\\003");
  // 한 줄짜리 expect { … } 형식은 이 맥의 expect에서 질문마다 수십 초씩 늦어졌다 → 여러 줄 형식 + send_user로 표시
  const script = [
    "set timeout 30",
    "log_user 0",
    `spawn /bin/bash {${SCRIPT_PATH.aws}}`,                 // 경로에 공백이 있다(Tcl 중괄호 인용)
    "expect {",
    '  "Ctrl+C" { send_user "Q1\\n" }',
    "  timeout { exit 90 }",
    "  eof { exit 91 }",
    "}",
    `send "${key(first)}"`,
    ...(second === null ? [] : ["expect {", '  "Ctrl+C" { send_user "Q2\\n" }', "  timeout { exit 92 }", "  eof { exit 93 }", "}", `send "${key(second)}"`]),
    "expect {",
    "  eof { send_user \"EOF\\n\" }",
    "  timeout { exit 94 }",
    "}",
    "catch wait result",
    "exit [lindex $result 3]",
  ].join("\n");
  const r = spawnSync(EXPECT, ["-c", script], { cwd: work, env: envOf() as unknown as NodeJS.ProcessEnv, encoding: "utf8", timeout: 90_000 });
  const calls = readFileSync(log, "utf8").split("\n").filter((l) => l !== "" && !l.startsWith("!UNEXPECTED") && !l.startsWith("sleep")).map((l) => l.split("\u001f")).filter((a) => a[1] !== "--version").length;
  return { code: r.status, files: readdirSync(work).sort(), calls, out: (r.stdout ?? "").slice(-400) };
}

describe("CL-03 ④ 비대화형 + --yes 없음", () => {
  it("종료 코드 3, 실제 호출은 신원 단계 2건(읽기)뿐, 결과 파일 0", () => {
    expect(prep.status).toBe(3);
    expect(realCalls(prep).map((c) => `${c.tool} ${c.args.slice(0, 2).join(" ")}`)).toEqual(["aws sts get-caller-identity", "aws iam list-account-aliases"]);
    expect(prep.files).toEqual([]);
  });
});

describe.skipIf(!hasExpect)("CL-03 대화형(가상 터미널, expect)", () => {
  it("① 계정 확인 Enter → 마지막 삭제 질문에서 Ctrl+C → 결과 파일 1개가 남는다", () => {
    const r = tty("enter", "ctrl-c");
    expect(r.code, "expect 시간 초과(90~94)가 아니어야 한다").toBeLessThan(90);
    expect(r.files.filter((f) => /^cloudcheck-aws-.*\.json$/.test(f)), r.out).toHaveLength(1);
    expect(r.files.filter((f) => !/^cloudcheck-aws-.*\.json$/.test(f))).toEqual([]);   // 임시 파일 0
    expect(r.calls).toBeGreaterThan(10);
  });
  it("② 계정 확인에서 Ctrl+C → 결과 · 임시 파일 0, 호출은 신원 단계 2건뿐", () => {
    const r = tty("ctrl-c", null);
    expect(r.code, "expect 시간 초과(90~94)가 아니어야 한다").toBeLessThan(90);
    expect(r.files, r.out).toEqual([]);
    expect(r.calls).toBe(2);
  });
  it("③ 계정 확인 Enter → 마지막 질문에서 Enter → 결과 파일이 지워진다", () => {
    const r = tty("enter", "enter");
    expect(r.files, r.out).toEqual([]);
    expect(r.calls).toBeGreaterThan(10);
    expect(r.code).toBe(0);
  });
});
