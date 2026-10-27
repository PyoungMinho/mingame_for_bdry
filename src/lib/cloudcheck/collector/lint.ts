// src/lib/cloudcheck/collector/lint.ts — 수집기 명령 단위 린터 (방향서 §3·§8 G4, 백엔드팀장 검토 §2-7)
// 순수 함수: 파일 읽기는 테스트가 한다. 수집기 스크립트(bash)를 셸 단어 단위로 읽어 규칙 L-01~L-14와 호출 허용 목록(contract/calls.ts)을 검사한다.
//  - 정규식 한 줄 검사가 아니라 작은 셸 토크나이저 + 명령 파서를 쓴다(프로토타입에서 `x=$(aws secretsmanager …)` 우회가 정규식 린터를 뚫었다).
//  - 2차 방어: shim 실행 테스트(collector.*.test.ts)가 실제로 호출된 모든 명령을 같은 허용 목록으로 검사한다.
//  - React·DOM·node:* 에 의존하지 않는다.
import { AWS_CALLS, AZURE_CALLS } from "../contract/calls";
import { CALL_MARKER_RE, SECTION_MARKER_RE } from "./markers";

export type Cloud = "aws" | "azure";
export const LINT_RULES = [
  { id: "L-01", title: "머리·꼬리·길이: shebang, set -euo pipefail·umask 077, 마지막 줄 main \"$@\", 260줄 이하, CR 없음, 따옴표 짝" },
  { id: "L-02", title: "바이트: UTF-8 · BOM 없음 · LF만 · bidi·zero-width·제어 문자 금지 · 따옴표 밖 코드에는 ASCII만(Trojan Source)" },
  { id: "L-03", title: "주석: 줄 전체 주석만(행 끝 금지) · 모든 호출 바로 위 1~2줄에 한국어 마커 주석(@cc:문.이름, 원문 안에서 고유)" },
  { id: "L-04", title: "클라우드 호출 추출: aws/az 단어는 call/slot 래퍼의 `-- aws|az …` 뒤에서만(`$(aws …)`·백틱 우회 포함)" },
  { id: "L-05", title: "허용 목록: 호출 집합 = 카탈로그 집합(완전 일치) · 라벨 = 카탈로그 키 · 읽기 동사 · --output json(az는 -o json --only-show-errors)" },
  { id: "L-06", title: "비밀 반환 명령 금지 목록(허용 목록과 교집합 0)" },
  { id: "L-07", title: "외부 명령 화이트리스트(명령 위치) + 명령별 인자 제한" },
  { id: "L-08", title: "송신·실행·인코딩 도구 금지(curl, nc, ssh, python, awk, sed, xargs, eval, source, base64 …)" },
  { id: "L-09", title: "오류 삼키기 금지: /dev/null, || true, || :, 줄 끝 ||, set +e, 2>&- · || 는 `|| rc=$?` 형태만" },
  { id: "L-10", title: "덤프·우회 금지: env, printenv, 단독 set, declare -p, PATH= 대입, ${!, 백틱, aws()/jq() 재정의, 허용 밖 export" },
  { id: "L-11", title: "엔드포인트 변조 금지: --endpoint-url, --debug, --no-verify-ssl, --ca-bundle, 프록시·CA 환경변수, az cloud register|set" },
  { id: "L-12", title: "bash 3.2 호환: declare -A, mapfile, ${x,,}, [[ -v, coproc, ;;&, |&, &>>, wait -n, 배열 등 금지" },
  { id: "L-13", title: "jq 1.6 호환: 모든 if에 else · jq 1.7+ 내장 함수 금지 · env/input/debug 금지 · 프로그램은 작은따옴표 리터럴" },
  { id: "L-14", title: "출력 규율: 리다이렉트 대상은 \"$TMP/…\"·\"$OUT_TMP\"·&1/&2만 · 최종 mv 1회 · 파일을 읽는 명령은 임시 디렉터리 안의 파일만" },
] as const;
export type LintRuleId = (typeof LINT_RULES)[number]["id"];

export interface LintFinding { readonly rule: LintRuleId; readonly line: number; readonly code: string; readonly text: string }
export interface CallSite { readonly line: number; readonly wrapper: "call" | "slot"; readonly label: string | null; readonly cli: string | null }
export interface LintResult {
  readonly cloud: Cloud;
  readonly findings: LintFinding[];
  readonly calls: CallSite[];
  readonly cliSet: string[];
  readonly markers: string[];
  readonly lineCount: number;
}

/* ───────── 규칙 상수 ───────── */
export const MAX_LINES = 260;
/** 눈에 안 보이거나 방향을 바꾸는 문자 구간(코드 포인트): soft hyphen, 결합 문자 접착제, ALM, 한글 채움 문자, bidi 제어, zero-width, 줄·문단 구분자, 보이지 않는 연산자, 변형 선택자, BOM, 태그 문자 등 */
const INVISIBLE_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0xad, 0xad], [0x34f, 0x34f], [0x61c, 0x61c], [0x115f, 0x1160], [0x17b4, 0x17b5], [0x180b, 0x180e], [0x200b, 0x200f], [0x2028, 0x202e],
  [0x2060, 0x206f], [0x3164, 0x3164], [0xfe00, 0xfe0f], [0xfeff, 0xfeff], [0xffa0, 0xffa0], [0xfff9, 0xfffb], [0xe0000, 0xe007f], [0xe0100, 0xe01ef],
];
const hasInvisible = (s: string): boolean => { for (const ch of s) { const cp = ch.codePointAt(0) ?? 0; if (INVISIBLE_RANGES.some(([a, b]) => cp >= a && cp <= b)) return true; } return false; };
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/;
const HANGUL_RE = /[가-힣]/;

/** L-06: 읽기 동사여도 비밀을 돌려주거나 데이터 평면으로 나가는 명령. 허용 목록(calls.ts)과의 교집합이 0이어야 한다(두 곳을 함께 고쳐야만 추가 가능) */
export const SECRET_COMMANDS: readonly string[] = [
  "aws secretsmanager get-secret-value", "aws ssm get-parameter", "aws ssm get-parameters", "aws ssm get-parameters-by-path",
  "aws lambda get-function", "aws lambda get-function-configuration", "aws ec2 describe-instance-attribute", "aws ec2 get-password-data",
  "aws ec2 get-console-output", "aws sts assume-role", "aws sts get-session-token", "aws sts get-federation-token",
  "aws configure export-credentials", "aws configure get", "aws ecr get-login-password", "aws ecr get-authorization-token",
  "aws codeartifact get-authorization-token", "aws rds generate-db-auth-token", "aws eks get-token", "aws iam create-access-key",
  "aws iam get-login-profile", "aws iam get-ssh-public-key", "aws kms decrypt", "aws s3 cp", "aws s3api get-object",
  "az storage account keys", "az storage account show-connection-string", "az storage account generate-sas", "az storage container generate-sas",
  "az storage container list", "az storage blob", "az keyvault secret", "az keyvault key", "az account get-access-token",
  "az webapp deployment list-publishing-profiles", "az functionapp keys", "az cosmosdb keys", "az redis list-keys",
  "az acr credential", "az aks get-credentials", "az rest", "az graph", "az ad", "az login", "az cloud",
];
const FORBIDDEN_TOOLS = new Set([
  "curl", "wget", "nc", "ncat", "netcat", "socat", "ssh", "scp", "sftp", "rsync", "ftp", "tftp", "telnet", "openssl", "dig", "nslookup", "host", "ping",
  "python", "python2", "python3", "perl", "ruby", "node", "php", "pwsh", "awk", "gawk", "sed", "xargs", "eval", "source", "exec", "alias", "builtin",
  "sudo", "nohup", "disown", "crontab", "at", "base64", "xxd", "od", "gzip", "gunzip", "zcat", "bzip2", "xz", "uudecode", "tar", "zip", "unzip", "nmap", "git", "bash", "sh", "zsh", "dash", ".",
]);
const BUILTINS = new Set([":", "[", "echo", "printf", "read", "shift", "exit", "return", "break", "continue", "local", "export", "trap", "set", "umask", "command", "true", "false", "test"]);
const EXTERNALS = new Set(["jq", "date", "mktemp", "head", "cat", "mv", "rm", "sleep", "sha256sum", "shasum"]);
const KEYWORDS = new Set(["if", "then", "elif", "else", "fi", "while", "until", "do", "done", "in", "case", "esac", "function", "!", "{", "}", "time"]);
/** 덤프·탈출·불필요한 도구. 이름만으로 거부한다 */
const DUMP_COMMANDS = new Set(["env", "printenv", "compgen", "history", "declare", "typeset", "readonly", "unset", "hash", "enable", "ulimit", "shopt", "getopts", "wait", "kill", "pushd", "popd", "cd", "pwd", "ls", "find", "grep", "tr", "cut", "sort", "uniq", "wc", "tee", "ln", "cp", "touch", "chmod", "chown", "stat", "uname", "id", "whoami", "hostname", "ps", "select", "coproc", "mapfile", "readarray"]);
/** AWS_IGNORE_CONFIGURED_ENDPOINT_URLS=true: 환경변수(AWS_ENDPOINT_URL*)·설정 파일(endpoint_url)의 엔드포인트 지정을 무시하게 한다(백엔드팀장 STEP 4 결정, AWS SDK·도구 참조 가이드 [확인]) */
const EXPORT_ALLOWED = new Set(["LC_ALL", "AWS_PAGER", "AWS_RETRY_MODE", "AWS_MAX_ATTEMPTS", "AWS_IGNORE_CONFIGURED_ENDPOINT_URLS", "AZURE_CORE_COLLECT_TELEMETRY", "AZURE_CORE_NO_COLOR"]);
/** 래퍼 밖에서 허용하는 로컬 버전 조회(정확히 이 인자열만). az --version은 최신 버전을 인터넷에서 조회하므로 허용하지 않는다 [확인: azure-cli 소스] */
export const LOCAL_VERSION_ARGS: Readonly<Record<"aws" | "az", string>> = { aws: "--version", az: "version -o json --only-show-errors" };
const isLocalVersion = (name: string, args: readonly Word[]): boolean =>
  (name === "aws" || name === "az") && args.length > 0 && args.every((a) => !a.quoted) && args.map((a) => a.text).join(" ") === LOCAL_VERSION_ARGS[name];
const ASSIGN_DENY_RE = /^(PATH|LD_[A-Za-z_]*|DYLD_[A-Za-z_]*|BASH[A-Za-z_]*|ENV|SHELL[A-Za-z_]*|PS4|PROMPT_COMMAND|CDPATH|GLOBIGNORE|HOME|TMPDIR|AWS_[A-Za-z_]*|AZURE_[A-Za-z_]*|AZ_[A-Za-z_]*|[A-Za-z_]*_[Pp][Rr][Oo][Xx][Yy]|[A-Za-z_]*CA_BUNDLE|SSL_[A-Za-z_]*|REQUESTS_[A-Za-z_]*|CURL_[A-Za-z_]*|ADAL_[A-Za-z_]*|PYTHON[A-Za-z_]*|NODE_[A-Za-z_]*)$/;
/** L-11 보강: AWS 수집기는 머리에서 이 값을 export해 환경변수·설정 파일의 엔드포인트 지정을 무력화해야 한다(이름만 같고 값이 다르면 위반) */
export const ENDPOINT_GUARD = "AWS_IGNORE_CONFIGURED_ENDPOINT_URLS=true";
/** L-11: 서명된 요청이 세션 토큰과 함께 다른 곳으로 나갈 수 있는 경로 */
const ENDPOINT_RES: readonly RegExp[] = [
  /--endpoint-url\b/, /--debug\b/, /--no-verify-ssl\b/, /--ca-bundle\b/, /\bAWS_ENDPOINT_URL[A-Za-z_]*/, /\b(http|https|all|no)_proxy\b/i,
  /\bREQUESTS_CA_BUNDLE\b/, /\bAWS_CA_BUNDLE\b/, /\bCURL_CA_BUNDLE\b/, /\bSSL_CERT_(FILE|DIR)\b/,
  /\bAZURE_CLI_DISABLE_CONNECTION_VERIFICATION\b/, /\bADAL_PYTHON_SSL_NO_VERIFY\b/, /\baz\s+cloud\s+(register|set|update)\b/, /--cli-input-(json|yaml)\b/, /--generate-cli-skeleton\b/,
];
/** L-13: jq 1.7 이후에만 있거나(1.6에 없음), 환경·입력을 읽는 내장 */
const JQ17_ONLY = new Set(["pick", "abs", "toarray", "have_literal_numbers", "have_decnum", "trim", "ltrim", "rtrim", "trimstr", "skip", "@base32d", "@urid", "$__loc__"]);
const JQ_DENY = new Set(["env", "$ENV", "input", "inputs", "debug", "stderr", "halt", "halt_error", "input_filename", "import", "include", "modulemeta", "get_search_list", "$__prog_args", "input_line_number", "getpath_"]);

/* ───────── 셸 토크나이저 ───────── */
export interface Word { readonly kind: "word"; readonly raw: string; readonly text: string; readonly quoted: boolean; readonly singles: readonly string[]; readonly subs: readonly string[]; readonly line: number; readonly backtick: boolean }
export interface Op { readonly kind: "op"; readonly op: string; readonly line: number }
export type Tok = Word | Op;
interface Comment { readonly line: number; readonly text: string; readonly inline: boolean }
export interface Lexed { readonly toks: Tok[]; readonly comments: Comment[]; readonly errors: { line: number; msg: string }[] }

const isSpace = (c: string): boolean => c === " " || c === "\t" || c === "\r";
const OP_START = new Set([";", "&", "|", "(", ")", "<", ">"]);

/** s[from] === open 인 위치에서 짝이 되는 닫는 문자의 인덱스(따옴표·중첩 처리). 없으면 -1 */
function matchPair(s: string, from: number, open: string, close: string): number {
  let depth = 0;
  for (let i = from; i < s.length; i++) {
    const c = s[i];
    if (c === "\\") { i++; continue; }
    if (c === "'") { const j = s.indexOf("'", i + 1); if (j < 0) return -1; i = j; continue; }
    if (c === '"') { const j = skipDouble(s, i); if (j < 0) return -1; i = j; continue; }
    if (c === open) depth++;
    else if (c === close) { depth--; if (depth === 0) return i; }
  }
  return -1;
}
/** s[i] === '"' 에서 닫는 따옴표의 인덱스. $(…)·${…}·백틱 안의 따옴표는 건너뛴다 */
function skipDouble(s: string, i: number): number {
  for (let j = i + 1; j < s.length; j++) {
    const c = s[j];
    if (c === "\\") { j++; continue; }
    if (c === '"') return j;
    if (c === "$" && s[j + 1] === "(") { const k = matchPair(s, j + 1, "(", ")"); if (k < 0) return -1; j = k; continue; }
    if (c === "$" && s[j + 1] === "{") { const k = matchPair(s, j + 1, "{", "}"); if (k < 0) return -1; j = k; continue; }
    if (c === "`") { const k = s.indexOf("`", j + 1); if (k < 0) return -1; j = k; continue; }
  }
  return -1;
}

/** ${…}·$((…)) 안에 숨은 $(…)·백틱 명령 치환을 꺼낸다(`${a:-$(curl x)}` 우회 방지). 따옴표 종류와 무관하게 보수적으로 잡는다 */
function innerSubs(s: string): string[] {
  const out: string[] = [];
  for (let k = 0; k < s.length; k++) {
    const c = s[k];
    if (c === "\\") { k++; continue; }
    if (c === "$" && s[k + 1] === "(") {
      const e = matchPair(s, k + 1, "(", ")");
      if (e < 0) break;
      if (s[k + 2] === "(") out.push(...innerSubs(s.slice(k + 3, e - 1))); else out.push(s.slice(k + 2, e));
      k = e; continue;
    }
    if (c === "`") { const e = s.indexOf("`", k + 1); if (e < 0) break; out.push(s.slice(k + 1, e)); k = e; continue; }
  }
  return out;
}

export function lexShell(src: string, baseLine = 1): Lexed {
  const toks: Tok[] = [];
  const comments: Comment[] = [];
  const errors: { line: number; msg: string }[] = [];
  const n = src.length;
  let line = baseLine, i = 0, lineHasTok = false;
  while (i < n) {
    const c = src[i];
    if (c === "\n") { toks.push({ kind: "op", op: "\n", line }); line++; i++; lineHasTok = false; continue; }
    if (isSpace(c)) { i++; continue; }
    if (c === "\\" && src[i + 1] === "\n") { i += 2; line++; continue; }
    if (c === "#") {
      const j = src.indexOf("\n", i); const end = j < 0 ? n : j;
      comments.push({ line, text: src.slice(i, end), inline: lineHasTok }); i = end; continue;
    }
    if (OP_START.has(c)) {
      lineHasTok = true;
      const two = src.slice(i, i + 2), three = src.slice(i, i + 3);
      let op: string;
      if (three === ";;&" || three === "&>>" || three === "<<<" || three === "<<-") op = three;
      else if ([";;", ";&", "&&", "&>", "||", "|&", ">>", ">&", "<&", "<<", "<>", ">|"].includes(two)) op = two;
      else op = c;
      toks.push({ kind: "op", op, line }); i += op.length; continue;
    }
    // 단어
    const startLine = line, start = i;
    let text = "", quoted = false, backtick = false, fdPrefix = false;
    const singles: string[] = [], subs: string[] = [];
    while (i < n) {
      const ch = src[i];
      if (isSpace(ch) || ch === "\n") break;
      if (ch === "\\" && src[i + 1] === "\n") { i += 2; line++; continue; }
      if (OP_START.has(ch)) {
        if ((ch === "<" || ch === ">") && !quoted && /^\d+$/.test(text) && start === i - text.length) fdPrefix = true;
        break;
      }
      if (ch === "'") {
        const j = src.indexOf("'", i + 1);
        if (j < 0) { errors.push({ line, msg: "닫히지 않은 작은따옴표" }); i = n; break; }
        const body = src.slice(i + 1, j); singles.push(body); text += body; quoted = true; line += body.split("\n").length - 1; i = j + 1; continue;
      }
      if (ch === '"') {
        const j = skipDouble(src, i);
        if (j < 0) { errors.push({ line, msg: "닫히지 않은 큰따옴표" }); i = n; break; }
        const body = src.slice(i + 1, j);
        quoted = true;
        for (let k = 0; k < body.length; k++) {
          const b = body[k];
          if (b === "\\") { text += body[k + 1] ?? ""; k++; continue; }
          if (b === "$" && body[k + 1] === "(") {
            const e = matchPair(body, k + 1, "(", ")");
            if (body[k + 2] === "(") { if (e > 0) subs.push(...innerSubs(body.slice(k + 3, e - 1))); text += "$A"; k = e < 0 ? body.length : e; continue; }
            if (e < 0) { errors.push({ line, msg: "닫히지 않은 $(" }); break; }
            subs.push(body.slice(k + 2, e)); text += "$S"; k = e; continue;
          }
          if (b === "$" && body[k + 1] === "{") { const e = matchPair(body, k + 1, "{", "}"); if (e > 0) subs.push(...innerSubs(body.slice(k + 2, e))); text += "$V"; k = e < 0 ? body.length : e; continue; }
          if (b === "`") { const e = body.indexOf("`", k + 1); if (e < 0) break; subs.push(body.slice(k + 1, e)); backtick = true; text += "$S"; k = e; continue; }
          text += b;
        }
        line += body.split("\n").length - 1; i = j + 1; continue;
      }
      if (ch === "\\") { text += src[i + 1] ?? ""; i += 2; continue; }
      if (ch === "$" && src[i + 1] === "(") {
        const e = matchPair(src, i + 1, "(", ")");
        if (e < 0) { errors.push({ line, msg: "닫히지 않은 $(" }); i = n; break; }
        if (src[i + 2] === "(") { subs.push(...innerSubs(src.slice(i + 3, e - 1))); text += "$A"; i = e + 1; continue; }
        subs.push(src.slice(i + 2, e)); text += "$S"; line += src.slice(i, e).split("\n").length - 1; i = e + 1; continue;
      }
      if (ch === "$" && src[i + 1] === "{") { const e = matchPair(src, i + 1, "{", "}"); if (e > 0) subs.push(...innerSubs(src.slice(i + 2, e))); text += "$V"; i = e < 0 ? n : e + 1; continue; }
      if (ch === "`") {
        const e = src.indexOf("`", i + 1);
        if (e < 0) { errors.push({ line, msg: "닫히지 않은 백틱" }); i = n; break; }
        subs.push(src.slice(i + 1, e)); backtick = true; text += "$S"; i = e + 1; continue;
      }
      text += ch; i++;
    }
    lineHasTok = true;
    if (fdPrefix) {
      // "2>" 같은 파일 번호 접두는 단어가 아니라 리다이렉트 연산자의 일부다
      const two = src.slice(i, i + 2), three = src.slice(i, i + 3);
      let op: string;
      if (three === "&>>" || three === "<<<" || three === "<<-") op = three;
      else if ([">>", ">&", "<&", "<<", "<>", ">|"].includes(two)) op = two;
      else op = src[i];
      i += op.length;
      toks.push({ kind: "op", op: text + op, line: startLine }); continue;
    }
    const raw = src.slice(start, i);
    if (raw.length > 0) toks.push({ kind: "word", raw, text, quoted, singles, subs, line: startLine, backtick });
  }
  return { toks, comments, errors };
}

/* ───────── 명령 파서 ───────── */
export interface Redir { readonly op: string; readonly target: Word | null; readonly line: number }
export interface Cmd { name: string; nameWord: Word | null; args: Word[]; assigns: Word[]; redirs: Redir[]; line: number }
interface Parsed { cmds: Cmd[]; comments: Comment[]; defs: string[]; errors: { line: number; msg: string }[]; orOps: { line: number; next: string | null }[]; hasBacktick: boolean; heredoc: number[]; procSubst: number[] }

const ASSIGN_RE = /^[A-Za-z_][A-Za-z0-9_]*\+?=/;
const REDIR_RE = /^\d*(>>?|<|>&|<&|>\||&>|&>>|<>|<<<?|<<-)$/;
const emptyCmd = (line: number): Cmd => ({ name: "", nameWord: null, args: [], assigns: [], redirs: [], line });

export function parseShell(src: string, baseLine = 1): Parsed {
  const lx = lexShell(src, baseLine);
  const out: Parsed = { cmds: [], comments: [...lx.comments], defs: [], errors: [...lx.errors], orOps: [], hasBacktick: false, heredoc: [], procSubst: [] };
  let cur = emptyCmd(baseLine);
  let expectCmd = true, caseDepth = 0, awaitIn = false, inPattern = false, condMode = false;
  let pending: { op: string; line: number } | null = null;
  const flush = (line: number): void => {
    if (cur.name !== "" || cur.assigns.length > 0 || cur.redirs.length > 0) out.cmds.push(cur);
    cur = emptyCmd(line);
  };
  const absorb = (p: Parsed): void => {
    out.cmds.push(...p.cmds); out.defs.push(...p.defs); out.heredoc.push(...p.heredoc); out.procSubst.push(...p.procSubst); out.errors.push(...p.errors); out.orOps.push(...p.orOps);
    out.hasBacktick ||= p.hasBacktick; out.comments.push(...p.comments);
  };
  const t = lx.toks;
  for (let k = 0; k < t.length; k++) {
    const tok = t[k];
    if (tok.kind === "op") {
      const op = tok.op;
      if (condMode) { cur.args.push({ kind: "word", raw: op, text: op, quoted: false, singles: [], subs: [], line: tok.line, backtick: false }); continue; }
      if (/^\d*(<<<?|<<-)$/.test(op)) out.heredoc.push(tok.line);
      if (pending && op === "(") { out.procSubst.push(tok.line); pending = null; flush(tok.line); expectCmd = true; continue; }
      if (REDIR_RE.test(op)) { pending = { op, line: tok.line }; continue; }
      if (op === "||") { const nx = t[k + 1]; out.orOps.push({ line: tok.line, next: nx && nx.kind === "word" ? nx.raw : null }); }
      if (op === "(" && cur.name !== "" && cur.args.length === 0 && t[k + 1]?.kind === "op" && (t[k + 1] as Op).op === ")") {
        out.defs.push(cur.name); cur = emptyCmd(tok.line); expectCmd = true; k++; continue;
      }
      if (op === ")" && inPattern) { inPattern = false; expectCmd = true; continue; }
      if (inPattern && (op === "|" || op === "(" || op === "\n")) continue;
      if (op === ";;") { flush(tok.line); inPattern = caseDepth > 0; expectCmd = true; continue; }
      if (op === "\n" && awaitIn) continue;
      flush(tok.line); expectCmd = true;
      continue;
    }
    if (tok.backtick) out.hasBacktick = true;
    for (const s of tok.subs) absorb(parseShell(s, tok.line));
    if (pending) { cur.redirs.push({ op: pending.op, target: tok, line: pending.line }); pending = null; continue; }
    if (condMode) { cur.args.push(tok); if (tok.text === "]]" && !tok.quoted) condMode = false; continue; }
    if (inPattern) { if (tok.text === "esac" && !tok.quoted) { inPattern = false; caseDepth--; } continue; }
    if (awaitIn) { if (tok.text === "in" && !tok.quoted) { awaitIn = false; inPattern = true; } continue; }
    if (expectCmd) {
      if (ASSIGN_RE.test(tok.raw)) { if (cur.assigns.length === 0 && cur.name === "") cur.line = tok.line; cur.assigns.push(tok); continue; }
      if (!tok.quoted && KEYWORDS.has(tok.text)) {
        if (tok.text === "case") { caseDepth++; awaitIn = true; expectCmd = false; continue; }
        if (tok.text === "function") { const nm = t[k + 1]; if (nm && nm.kind === "word") { out.defs.push(nm.text); k++; } continue; }
        continue;
      }
      if (!tok.quoted && tok.text === "for") { cur.name = "for"; cur.nameWord = tok; cur.line = tok.line; expectCmd = false; continue; }
      if (!tok.quoted && tok.text === "[[") { cur.name = "[["; cur.nameWord = tok; cur.line = tok.line; condMode = true; expectCmd = false; continue; }
      cur.name = tok.text; cur.nameWord = tok; if (cur.assigns.length === 0) cur.line = tok.line; expectCmd = false; continue;
    }
    cur.args.push(tok);
  }
  flush(baseLine);
  return out;
}

/* ───────── jq 프로그램 검사(L-13) ───────── */
export interface JqIssue { readonly code: string; readonly detail: string }
export function checkJq(program: string): JqIssue[] {
  const issues: JqIssue[] = [];
  const stack: { hasElse: boolean }[] = [];
  const n = program.length;
  /** program[from] === '"' → 닫는 따옴표 인덱스. \( … ) 보간은 중첩 코드로 보고 같은 검사를 한다 */
  const skipString = (from: number): number => {
    let j = from + 1;
    while (j < n) {
      const c = program[j];
      if (c === "\\") {
        if (program[j + 1] === "(") {
          let d = 0, k = j + 1;
          for (; k < n; k++) { const x = program[k]; if (x === "(") d++; else if (x === ")") { d--; if (d === 0) break; } else if (x === '"') k = skipString(k); }
          issues.push(...checkJq(program.slice(j + 2, k)));
          j = k + 1; continue;
        }
        j += 2; continue;
      }
      if (c === '"') return j;
      j++;
    }
    return n;
  };
  let i = 0;
  while (i < n) {
    const c = program[i];
    if (c === '"') { i = skipString(i) + 1; continue; }
    if (c === "#") { while (i < n && program[i] !== "\n") i++; continue; }
    if (/[A-Za-z_$@]/.test(c)) {
      let j = i + 1;
      while (j < n && /[A-Za-z0-9_]/.test(program[j])) j++;
      const word = program.slice(i, j);
      const prev = program.slice(0, i).replace(/\s+$/, "").slice(-1);
      const next = program.slice(j).replace(/^\s+/, "")[0] ?? "";
      const isField = program[i - 1] === ".";
      const isObjKey = next === ":" && (prev === "{" || prev === ",");
      if (!isField && !isObjKey) {
        if (word === "if") stack.push({ hasElse: false });
        else if (word === "else") { if (stack.length > 0) stack[stack.length - 1].hasElse = true; }
        else if (word === "end") {
          const top = stack.pop();
          if (!top) issues.push({ code: "end-without-if", detail: "end에 짝이 되는 if가 없다" });
          else if (!top.hasElse) issues.push({ code: "if-without-else", detail: "else 없는 if(jq 1.6은 문법 오류)" });
        } else if (JQ_DENY.has(word)) issues.push({ code: "jq-denied", detail: word });
        else if (JQ17_ONLY.has(word)) issues.push({ code: "jq17-only", detail: word });
        else if (word === "add" && next === "(") issues.push({ code: "jq17-only", detail: "add(f)" });
        else if (word === "scan" && /^scan\s*\([^()]*;/.test(program.slice(i))) issues.push({ code: "jq17-only", detail: "scan/2" });
      }
      i = j; continue;
    }
    if (c === "?" && program[i + 1] === "/" && program[i + 2] === "/") { issues.push({ code: "jq-alt-destructuring", detail: "?//" }); i += 3; continue; }
    i++;
  }
  while (stack.length > 0) { stack.pop(); issues.push({ code: "if-without-end", detail: "닫히지 않은 if" }); }
  return issues;
}

/* ───────── 본 검사 ───────── */
const WRAPPERS = { call: { labelAt: 0, progAt: [3, 4] }, slot: { labelAt: 2, progAt: [5, 6] } } as const;
/** 임시 디렉터리 안의 파일 피연산자("$TMP/…", "$TMP"/p.*, "${2:-$TMP/…}") */
const TMP_OPERANDS: readonly RegExp[] = [/^"\$TMP\/[A-Za-z0-9_.$*{}:-]+"$/, /^"\$TMP"\/[A-Za-z0-9_.*]+$/, /^"\$\{2:-\$TMP\/[A-Za-z0-9_.]+\}"$/];
const isTmpOperand = (raw: string): boolean => TMP_OPERANDS.some((re) => re.test(raw));
const TMP_REDIR_RE = /^"\$TMP\/[A-Za-z0-9_.$/{}:-]+"$/;
const NAME_RE = /^[a-z][a-z0-9-]*$/;

export function lintCollector(src: string, cloud: Cloud): LintResult {
  const findings: LintFinding[] = [];
  const add = (rule: LintRuleId, line: number, code: string, text: string): void => { findings.push({ rule, line, code, text: text.length > 160 ? `${text.slice(0, 157)}...` : text }); };
  const catalog = cloud === "aws" ? AWS_CALLS : AZURE_CALLS;
  const entries = Object.entries(catalog) as [string, { cli: string; readOnly: boolean }][];
  const cliToLabel = new Map(entries.map(([k, m]) => [m.cli, k]));
  /** 카탈로그에서 비조회(readOnly: false)로 표시된 호출만 쓰기 동사 예외가 된다(C-03 명시 예외 1건) */
  const writeException = entries.find(([, m]) => !m.readOnly)?.[1].cli ?? null;
  const rawLines = src.split("\n");
  const lineCount = src.endsWith("\n") ? rawLines.length - 1 : rawLines.length;

  /* L-01 머리·꼬리·길이 · L-02 바이트 */
  if (src.includes("\r")) add("L-01", 0, "cr", "CR 문자가 있다");
  if (rawLines[0] !== "#!/usr/bin/env bash") add("L-01", 1, "shebang", rawLines[0] ?? "");
  const head = rawLines.slice(0, 8);
  for (const must of ["set -euo pipefail", "umask 077"]) if (!head.includes(must)) add("L-01", 0, "header", `앞 8줄 안에 '${must}'가 없다`);
  const lastCode = [...rawLines].reverse().find((l) => l.trim() !== "");
  if (lastCode !== 'main "$@"') add("L-01", lineCount, "last-line", `마지막 줄이 main "$@"가 아니다: ${String(lastCode)}`);
  if (lineCount > MAX_LINES) add("L-01", lineCount, "length", `${lineCount}줄 > ${MAX_LINES}줄`);
  if (src.charCodeAt(0) === 0xfeff) add("L-02", 1, "bom", "BOM");
  rawLines.forEach((l, idx) => {
    if (hasInvisible(l)) add("L-02", idx + 1, "invisible-char", "bidi·zero-width·숨은 문자");
    if (CONTROL_RE.test(l)) add("L-02", idx + 1, "control-char", "제어 문자");
  });

  const parsed = parseShell(src);
  for (const e of parsed.errors) add("L-01", e.line, "syntax", e.msg);
  const defs = new Set(parsed.defs);
  for (const d of defs) {
    if (EXTERNALS.has(d) || BUILTINS.has(d) || FORBIDDEN_TOOLS.has(d) || d === "aws" || d === "az" || DUMP_COMMANDS.has(d) || KEYWORDS.has(d)) add("L-10", 0, "redefine-command", `${d}() 재정의`);
  }
  if (parsed.hasBacktick) add("L-10", 0, "backtick", "백틱 명령 치환");

  /* L-03 주석 */
  const commentByLine = new Map<number, string>();
  for (const c of parsed.comments) {
    if (c.inline) add("L-03", c.line, "inline-comment", c.text);
    else commentByLine.set(c.line, c.text);
  }
  const markerIds = new Set<string>();
  commentByLine.forEach((text, line) => {
    const m = CALL_MARKER_RE.exec(text);
    if (m) {
      if (m[1] === "section") return;
      if (!HANGUL_RE.test(text)) add("L-03", line, "marker-not-korean", text);
      const id = `${m[1]}.${m[2]}`;
      if (markerIds.has(id)) add("L-03", line, "marker-duplicate", id);
      markerIds.add(id);
    } else if (text.startsWith("# @cc:") && !SECTION_MARKER_RE.test(text)) add("L-03", line, "marker-format", text);
  });

  /* L-02: 따옴표 밖 코드에는 ASCII만 */
  const wordsOf = (c: Cmd): Word[] => [...(c.nameWord ? [c.nameWord] : []), ...c.assigns, ...c.args, ...c.redirs.flatMap((r) => (r.target ? [r.target] : []))];
  for (const c of parsed.cmds) for (const w of wordsOf(c)) if (!w.quoted && /[^\x20-\x7e]/.test(w.raw)) add("L-02", w.line, "non-ascii-code", w.raw);

  /* 호출 지점(L-04·L-05·L-06) + jq 프로그램(L-13) */
  const calls: CallSite[] = [];
  const cliSet = new Set<string>();
  for (const c of parsed.cmds) {
    const isWrapper = (c.name === "call" || c.name === "slot") && defs.has(c.name);
    const args = c.args;
    if (isWrapper) {
      const kind = c.name as "call" | "slot";
      if (args[0] && args[0].quoted && args[0].text === "$@") continue;   // 래퍼가 자기 인자를 그대로 넘기는 줄(slot → call)
      const spec = WRAPPERS[kind];
      const dd = args.findIndex((a) => !a.quoted && a.text === "--");
      let cli: string | null = null;
      if (dd < 0) add("L-04", c.line, "no-double-dash", `${kind} 호출에 '--' 구분자가 없다`);
      else {
        const target = args[dd + 1];
        if (!target || target.quoted || (target.text !== "aws" && target.text !== "az")) add("L-04", c.line, "call-target-not-cli", target ? target.raw : "(없음)");
        else {
          const toks: string[] = [];
          for (const a of args.slice(dd + 2)) {
            if (a.quoted || !NAME_RE.test(a.text)) break;
            toks.push(a.text);
            if (target.text === "aws" && toks.length === 2) break;
          }
          if (toks.length === 0) add("L-04", c.line, "no-service-op", args.slice(dd + 1).map((a) => a.raw).join(" "));
          cli = `${target.text} ${toks.join(" ")}`.trim();
          cliSet.add(cli);
          if (target.text !== (cloud === "aws" ? "aws" : "az")) add("L-05", c.line, "wrong-cloud-cli", cli);
          const flags = args.slice(dd + 2).map((a) => a.text);
          const oi = flags.indexOf(cloud === "aws" ? "--output" : "-o");
          if (oi < 0 || flags[oi + 1] !== "json" || (cloud === "azure" && !flags.includes("--only-show-errors"))) add("L-05", c.line, "output-json", cli);
        }
      }
      const labelWord = args[spec.labelAt];
      const label = labelWord && !labelWord.quoted && /^[A-Za-z0-9:._-]+$/.test(labelWord.text) ? labelWord.text : null;
      if (label === null) add("L-04", c.line, "label-not-literal", labelWord ? labelWord.raw : "(없음)");
      calls.push({ line: c.line, wrapper: kind, label, cli });
      if (cli !== null) {
        const expected = cliToLabel.get(cli);
        if (expected === undefined) {
          add("L-05", c.line, "not-allowlisted", cli);
          if (SECRET_COMMANDS.some((s) => cli === s || cli.startsWith(`${s} `))) add("L-06", c.line, "secret-command", cli);
        } else if (label !== expected) add("L-05", c.line, "label-mismatch", `${cli} → ${String(label)} (기대: ${expected})`);
        const verb = cli.split(" ").slice(-1)[0] ?? "";
        const readVerb = cloud === "aws" ? /^(get|list|describe)-/.test(verb) : verb === "list" || verb === "show";
        if (!readVerb && !(cli === writeException)) add("L-05", c.line, "write-verb", cli);
      }
      // jq 프로그램은 작은따옴표 리터럴이어야 한다(AWS의 목록 경로 인자는 프로그램이 아니다)
      spec.progAt.forEach((at, idx) => {
        const pw = args[at];
        if (!pw || (cloud === "aws" && idx === 0)) return;
        if (pw.raw === "-" || pw.raw === "null" || pw.raw === "length") return;
        if (!(pw.raw.startsWith("'") && pw.singles.length === 1 && pw.raw.length === pw.singles[0].length + 2)) { add("L-13", c.line, "jq-program-not-literal", pw.raw); return; }
        for (const iss of checkJq(pw.singles[0])) add("L-13", c.line, iss.code, iss.detail);
      });
      continue;
    }
    // 래퍼 밖의 aws/az: 로컬 버전 조회(`aws --version`, `az version -o json --only-show-errors`)만 허용
    if (c.name === "aws" || c.name === "az") {
      if (isLocalVersion(c.name, args)) cliSet.add(`${c.name} ${LOCAL_VERSION_ARGS[c.name]}`);
      else add("L-04", c.line, "aws-outside-call", `${c.name} ${args.map((a) => a.raw).join(" ")}`);
    }
  }
  for (const [, m] of entries) if (!cliSet.has(m.cli)) add("L-05", 0, "catalog-unused", `카탈로그에 있지만 수집기가 부르지 않는다: ${m.cli}`);
  for (const cs of calls) {
    let ok = false;
    for (let up = 1; up <= 2 && !ok; up++) { const t = commentByLine.get(cs.line - up); if (t && CALL_MARKER_RE.test(t) && !t.startsWith("# @cc:section")) ok = true; }
    if (!ok) add("L-03", cs.line, "call-without-marker", `${cs.wrapper} ${String(cs.label)}`);
  }

  /* 명령 위치: L-07 · L-08 · L-09 · L-10 · L-12 · L-13 · L-14 */
  let mvCount = 0;
  let endpointGuard = false;
  for (const c of parsed.cmds) {
    for (const a of c.assigns) {
      const name = a.raw.split("=")[0].replace(/\+$/, "");
      if (ASSIGN_DENY_RE.test(name)) add("L-10", a.line, "assign-denied", a.raw);
      if (name === "IFS" && c.name !== "read") add("L-10", a.line, "ifs-assign", a.raw);
    }
    // 리다이렉트(L-14·L-09·L-12)
    for (const r of c.redirs) {
      const op = r.op.replace(/^\d+/, "");
      const tgt = r.target?.raw ?? "";
      if (/^<<<?|^<<-/.test(op)) { add("L-14", r.line, "heredoc", r.op); continue; }
      if (op === ">&" || op === "<&") { if (tgt === "-") add("L-09", r.line, "close-fd", `${r.op}${tgt}`); else if (!/^[12]$/.test(tgt)) add("L-14", r.line, "redirect-fd", `${r.op}${tgt}`); continue; }
      if (op === "&>" || op === "&>>") { add("L-12", r.line, "amp-redirect", `${r.op} ${tgt}`); continue; }
      if (tgt.includes("/dev/null")) add("L-09", r.line, "dev-null", tgt);
      if (/^\/dev\/(tcp|udp)\//.test(tgt)) add("L-08", r.line, "dev-tcp", tgt);
      if (!TMP_REDIR_RE.test(tgt) && tgt !== '"$OUT_TMP"') add("L-14", r.line, "redirect-target", `${r.op} ${tgt}`);
    }
    if (c.name === "" || !c.nameWord) continue;
    const nm = c.name;
    if (c.nameWord.quoted) { if (c.nameWord.raw !== '"$@"') add("L-07", c.line, "quoted-command", c.nameWord.raw); continue; }
    if (nm.startsWith("$")) { add("L-07", c.line, "dynamic-command", c.nameWord.raw); continue; }
    if (FORBIDDEN_TOOLS.has(nm)) { add("L-08", c.line, "forbidden-tool", nm); continue; }
    if (DUMP_COMMANDS.has(nm)) { add("L-10", c.line, "dump-or-escape-command", nm); continue; }
    const cloudVersion = isLocalVersion(nm, c.args);
    if (!(BUILTINS.has(nm) || EXTERNALS.has(nm) || defs.has(nm) || nm === "[[" || nm === "for" || cloudVersion)) { add("L-07", c.line, "command-not-allowed", nm); continue; }
    const argTexts = c.args.map((a) => a.text);
    switch (nm) {
      case "set":
        if (c.args.length === 0) add("L-10", c.line, "bare-set", "set");
        if (argTexts.some((x) => /^\+[a-zA-Z]+$/.test(x))) add("L-09", c.line, "set-plus", argTexts.join(" "));
        if (argTexts.some((x) => /^-[a-zA-Z]*[xv]/.test(x) || x === "-o" || x === "+o")) add("L-10", c.line, "set-trace", argTexts.join(" "));
        break;
      case "export":
        for (const a of c.args) {
          const name = a.raw.split("=")[0];
          if (a.raw.startsWith("-")) add("L-10", c.line, "export-flag", a.raw);
          else if (!EXPORT_ALLOWED.has(name)) add("L-10", c.line, "export-not-allowlisted", a.raw);
          else if (name === ENDPOINT_GUARD.split("=")[0]) { if (a.raw !== ENDPOINT_GUARD) add("L-11", c.line, "endpoint-guard", a.raw); else if (c.line <= 10) endpointGuard = true; }
        }
        break;
      case "command": if (!(argTexts.length === 2 && argTexts[0] === "-v")) add("L-07", c.line, "command-builtin", argTexts.join(" ")); break;
      case "trap": if (!(c.args.length === 2 && c.args[0].raw === `'rm -rf "$TMP" "$OUT_TMP"'` && c.args[1].text === "EXIT")) add("L-07", c.line, "trap-not-allowed", c.args.map((a) => a.raw).join(" ")); break;
      case "cat": for (const a of c.args) if (!isTmpOperand(a.raw) && !/^"\$out"$/.test(a.raw)) add("L-14", c.line, "cat-operand", a.raw); break;
      case "head": {
        const rest = c.args.filter((a, i) => !(a.raw === "-c" || (i > 0 && c.args[i - 1].raw === "-c")));
        if (c.args[0]?.raw !== "-c") add("L-14", c.line, "head-option", c.args.map((a) => a.raw).join(" "));
        for (const a of rest) if (!isTmpOperand(a.raw)) add("L-14", c.line, "head-operand", a.raw);
        break;
      }
      case "rm": {
        const ok1 = c.args.length === 3 && c.args[0].raw === "-rf" && c.args[1].raw === '"$TMP"' && c.args[2].raw === '"$OUT_TMP"';
        const ok2 = c.args.length === 2 && c.args[0].raw === "-f" && c.args[1].raw === '"$out"';
        if (!ok1 && !ok2) add("L-14", c.line, "rm-operand", c.args.map((a) => a.raw).join(" "));
        break;
      }
      case "mv": mvCount++; if (!(c.args.length === 2 && c.args[0].raw === '"$OUT_TMP"' && c.args[1].raw === '"$out"')) add("L-14", c.line, "mv-operand", c.args.map((a) => a.raw).join(" ")); break;
      case "mktemp": if (!(c.args.length === 1 && (c.args[0].raw === "-d" || c.args[0].raw === '"$out.XXXXXX"'))) add("L-14", c.line, "mktemp-operand", c.args.map((a) => a.raw).join(" ")); break;
      case "date": if (!(c.args.length === 2 && c.args[0].raw === "-u" && /^\+[%YmdHMSTZ:-]+$/.test(c.args[1].raw))) add("L-07", c.line, "date-args", c.args.map((a) => a.raw).join(" ")); break;
      case "sha256sum": if (!(c.args.length === 1 && c.args[0].raw === '"$0"')) add("L-14", c.line, "sha-operand", c.args.map((a) => a.raw).join(" ")); break;
      case "shasum": if (!(c.args.length === 3 && c.args[0].raw === "-a" && c.args[1].raw === "256" && c.args[2].raw === '"$0"')) add("L-14", c.line, "sha-operand", c.args.map((a) => a.raw).join(" ")); break;
      case "sleep": if (!(c.args.length === 1 && /^\d+$/.test(c.args[0].raw))) add("L-07", c.line, "sleep-args", c.args.map((a) => a.raw).join(" ")); break;
      case "read": for (const a of c.args) if (a.raw === "-a" || a.raw === "-N") add("L-12", c.line, "read-option", a.raw); break;
      case "jq": {
        const a = c.args; let progSeen = false;
        for (let i = 0; i < a.length; i++) {
          const w = a[i], r = w.raw;
          if (r.startsWith("-") && !w.quoted) {
            if (r === "--arg" || r === "--argjson") { i += 2; continue; }
            if (r === "--slurpfile" || r === "--rawfile") { const f = a[i + 2]; if (!f || !isTmpOperand(f.raw)) add("L-14", c.line, "jq-file-operand", f ? f.raw : "(없음)"); i += 2; continue; }
            if (r === "--version" || /^-[nceSrsR]+$/.test(r)) continue;
            add("L-13", c.line, "jq-option", r); continue;
          }
          if (!progSeen) {
            progSeen = true;
            if (/^"\$(proj|cexpr)"$/.test(r)) continue;
            if (!(r.startsWith("'") && w.singles.length === 1 && r.length === w.singles[0].length + 2)) { add("L-13", c.line, "jq-program-not-literal", r); continue; }
            for (const iss of checkJq(w.singles[0])) add("L-13", c.line, iss.code, iss.detail);
            continue;
          }
          if (!isTmpOperand(r)) add("L-14", c.line, "jq-file-operand", r);
        }
        break;
      }
      default: break;
    }
  }
  if (mvCount !== 1) add("L-14", 0, "mv-count", `최종 mv는 정확히 1회여야 한다(현재 ${mvCount}회)`);
  if (cloud === "aws" && !endpointGuard) add("L-11", 0, "endpoint-guard", `머리 10줄 안의 export에 ${ENDPOINT_GUARD}가 없다(환경변수·설정 파일의 엔드포인트 지정을 막지 못한다)`);
  for (const h of parsed.heredoc) add("L-14", h, "heredoc", "here-document·here-string 금지");
  for (const h of parsed.procSubst) add("L-14", h, "process-substitution", "프로세스 치환 <( )·>( ) 금지");
  for (const o of parsed.orOps) if (o.next !== "rc=$?") add("L-09", o.line, "or-not-rc", `|| ${String(o.next)}`);

  /* 원문 패턴: L-09 · L-08 · L-10 · L-11 · L-12 (주석 줄 제외) */
  rawLines.forEach((l, idx) => {
    const n = idx + 1;
    if (/^\s*#/.test(l)) return;
    if (/\/dev\/null/.test(l)) add("L-09", n, "dev-null", l.trim());
    if (/\/dev\/(tcp|udp)\b/.test(l)) add("L-08", n, "dev-tcp", l.trim());
    if (/\$\{!/.test(l)) add("L-10", n, "indirect-expansion", l.trim());
    if (/\|\|\s*$/.test(l)) add("L-09", n, "trailing-or", l.trim());
    for (const re of ENDPOINT_RES) if (re.test(l)) { add("L-11", n, "endpoint-tamper", l.trim()); break; }
    if (/printf\s+['"]?%\(/.test(l)) add("L-12", n, "bash4-syntax", l.trim());
    const s = l.replace(/'[^']*'/g, "''");   // 작은따옴표 안(jq 프로그램)은 구조 검사에서 뺀다
    if (/\b(declare|typeset|local|readonly)\s+-[A-Za-z]*[AanIl]\b/.test(s)) add("L-12", n, "declare-flag", l.trim());
    if (/\b(mapfile|readarray|coproc)\b/.test(s)) add("L-12", n, "bash4-builtin", l.trim());
    if (/\$\{[^}]*(,,|\^\^|@Q|@E|@P|@A|@a|@U|@L)[^}]*\}/.test(s) || /\$\{[A-Za-z_0-9]+[,^]\}/.test(s)) add("L-12", n, "case-modify", l.trim());
    if (/\[\[\s+-v\b/.test(s)) add("L-12", n, "test-v", l.trim());
    if (/;;&|;&|\|&|&>>|wait\s+-n|\bEPOCH(SECONDS|REALTIME)\b|\bSRANDOM\b|\bBASHPID\b/.test(s)) add("L-12", n, "bash4-syntax", l.trim());
    if (/(^|[\s;(])[A-Za-z_][A-Za-z0-9_]*\+?=\(/.test(s) || /\[@\]|\[\*\]/.test(s)) add("L-12", n, "array", l.trim());
    if (/shopt\s+-s\s+(globstar|extglob|lastpipe)/.test(s) || /\*\*\//.test(s)) add("L-12", n, "bash4-glob", l.trim());
  });
  // 래퍼 밖에서 나온 `$(aws secretsmanager …)` 같은 호출도 비밀 반환 명령 목록으로 한 번 더 본다
  for (const c of parsed.cmds) {
    if (c.name !== "aws" && c.name !== "az") continue;
    const text = [c.name, ...c.args.filter((a) => !a.quoted).map((a) => a.text)].join(" ");
    for (const s of SECRET_COMMANDS) if (text === s || text.startsWith(`${s} `)) add("L-06", c.line, "secret-command", s);
  }

  const seen = new Set<string>();
  const uniq = findings.filter((f) => { const k = `${f.rule}|${f.line}|${f.code}|${f.text}`; if (seen.has(k)) return false; seen.add(k); return true; });
  return { cloud, findings: uniq, calls, cliSet: [...cliSet].sort(), markers: [...markerIds], lineCount };
}

/** 카탈로그의 cli 집합(린터의 기준) */
export const catalogCli = (cloud: Cloud): string[] => Object.values(cloud === "aws" ? AWS_CALLS : AZURE_CALLS).map((m) => m.cli).sort();
