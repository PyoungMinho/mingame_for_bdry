// src/app/cloudcheck/_build/generate.mjs — 문단속 5 단일 HTML 생성기. 소유: 프론트팀장(쓰기 모드는 프론트팀장만).
//
// 사용(레포 루트에서)
//   node src/app/cloudcheck/_build/generate.mjs                          _generated/page.ts 쓰기(프론트팀장, 통합 때)
//   node src/app/cloudcheck/_build/generate.mjs --check                  커밋된 page.ts와 다르면 exit 1
//   node src/app/cloudcheck/_build/generate.mjs --preview <레포 밖 파일>  HTML만 쓴다(팀원용). file://로 열면 실제 CSP가 걸린다
//   node src/app/cloudcheck/_build/generate.mjs --preview <파일> --watch  _client·_serve·src/lib/cloudcheck가 바뀌면 다시 쓴다
//
// 파이프라인(방향서 §2-3, 프론트 검토 §3-4)
//  1. esbuild(vite 경유 간접 의존 0.21.5, build API만 — serve 금지): _client/main.tsx → iife·압축·charset utf8·legalComments eof → JS + CSS
//  2. 후처리: JS의 '<!--'·'<script' 앞 '<'를 \x3C로(문자열·정규식 안에만 나타남 → 실행 값 같음). CR·NUL·'</script' 0, vm.Script 컴파일 확인.
//     CSS는 '</style'·CR·NUL 0. (정책 검사 — url()·@import·16진 색 등 — 는 테스트가 한다. 생성기는 HTML을 깨는 것만 막는다)
//  3. sha256(base64) → _serve/headers.ts의 metaCsp()(헤더와 같은 함수)로 meta CSP
//  4. 데이터 블록: 수집기 원문(text/plain, 파일 바이트 그대로), 수집기 메타·릴리스·체험 4×2(application/json, '<' → <)
//  5. template.mjs로 조립 → _generated/page.ts(시각·절대경로 없음 → 같은 입력이면 같은 바이트)
// 아직 없는 입력(수집기·체험 데이터·E 카탈로그·config.ts·정적 셸 키)은 빈 블록으로 두고 pending 목록으로 알린다.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, watch, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { gzipSync } from "node:zlib";
import { renderHtml, STATIC_KEYS } from "./template.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../../../..");
const APP = path.join(REPO, "src/app/cloudcheck");
const CLIENT = path.join(APP, "_client");
const LIB = path.join(REPO, "src/lib/cloudcheck");

/** 레포 기준 경로(테스트·메시지용) */
export const PATHS = Object.freeze({
  repo: REPO,
  app: APP,
  client: CLIENT,
  lib: LIB,
  entry: path.join(CLIENT, "main.tsx"),
  config: path.join(CLIENT, "config.ts"),
  generated: path.join(APP, "_generated/page.ts"),
  collectorDir: path.join(LIB, "collector"),
  sha256sums: path.join(LIB, "collector/SHA256SUMS"),
  releases: path.join(LIB, "collector/RELEASES.json"),
  demoDir: path.join(LIB, "fixtures/companies"),
});

export const COLLECTOR_FILES = Object.freeze({ aws: "cloudcheck-aws.sh", azure: "cloudcheck-azure.sh" });
export const DEFAULT_VERSION = "0.0.0-dev";
const VERSION_RE = /export\s+const\s+PAGE_VERSION\s*(?::\s*string\s*)?=\s*"([0-9A-Za-z][0-9A-Za-z.-]{0,39})"/;

const rel = (p) => path.relative(REPO, p).split(path.sep).join("/");
const sha256b64 = (s) => createHash("sha256").update(s, "utf8").digest("base64");
const sha256hex = (b) => createHash("sha256").update(b).digest("hex");
const jsonBlock = (v) => JSON.stringify(v).replace(/</g, "\\u003c");

function fail(msg) {
  const e = new Error(`cloudcheck generate: ${msg}`);
  e.ccGenerate = true;
  throw e;
}

/** 간접 의존 esbuild를 레포 기준으로 찾는다(없으면 즉시 실패 — 승격은 PM 승인, 방향서 §2-3) */
export function loadEsbuild() {
  const require = createRequire(path.join(REPO, "package.json"));
  try {
    return require("esbuild");
  } catch {
    return fail("esbuild를 찾지 못했습니다(vite 경유 간접 의존). `npm ci` 뒤 다시 실행하고, 계속 없으면 devDependency 승격(B안)을 PM에게 요청하세요.");
  }
}

/** 빌드 때만 쓰는 TS 모듈(헤더·셸 id·카탈로그)을 esbuild로 묶어 격리된 vm에서 실행한다. 네트워크·파일 접근 없음 */
async function loadBuildModules(esbuild) {
  const contents = [
    'export { metaCsp } from "./src/app/cloudcheck/_serve/headers.ts";',
    'export { SHELL, BLOCK, CLOUDS, DEMO_SETS } from "./src/app/cloudcheck/_client/shell.ts";',
    'export { lookup, catalogEntries, engineCatalogMerged } from "./src/app/cloudcheck/_client/i18n/index.ts";',
  ].join("\n");
  const r = await esbuild.build({
    stdin: { contents, resolveDir: REPO, sourcefile: "cc-build-modules.ts", loader: "ts" },
    absWorkingDir: REPO,
    bundle: true,
    write: false,
    format: "cjs",
    platform: "neutral",
    target: ["es2020"],
    logLevel: "silent",
  });
  const mod = { exports: {} };
  vm.runInNewContext(r.outputFiles[0].text, { module: mod, exports: mod.exports }, { filename: "cc-build-modules.cjs" });
  return mod.exports;
}

function readPageVersion(pending) {
  if (!existsSync(PATHS.config)) {
    pending.push("config: _client/config.ts 없음 → 페이지 버전 기본값 사용");
    return DEFAULT_VERSION;
  }
  const m = VERSION_RE.exec(readFileSync(PATHS.config, "utf8"));
  if (m === null) {
    pending.push('config: `export const PAGE_VERSION = "x.y.z";` 형태를 찾지 못함 → 기본값 사용');
    return DEFAULT_VERSION;
  }
  return m[1];
}

function readCollectors(pending) {
  const blocks = {};
  const meta = {};
  for (const [cloud, file] of Object.entries(COLLECTOR_FILES)) {
    const p = path.join(PATHS.collectorDir, file);
    if (!existsSync(p)) {
      pending.push(`collector: ${rel(p)} 없음 → 빈 블록`);
      blocks[cloud] = "";
      meta[cloud] = null;
      continue;
    }
    const buf = readFileSync(p);
    let text;
    try {
      text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(buf);
    } catch {
      fail(`${rel(p)}가 UTF-8이 아닙니다.`);
    }
    if (text.charCodeAt(0) === 0xfeff) fail(`${rel(p)}에 BOM이 있습니다(셔뱅이 깨집니다).`);
    for (const [re, why] of [[/\r/, "CR(줄 끝은 LF만 — HTML 파서가 CR을 바꿔 바이트가 달라진다)"], [/\0/, "NUL"], [/<\/script/i, "'</script'"], [/<!--/, "'<!--'"], [/<script/i, "'<script'"]]) {
      if (re.test(text)) fail(`${rel(p)}에 데이터 블록에 넣을 수 없는 문자열: ${why}`);
    }
    blocks[cloud] = text;
    meta[cloud] = { file, bytes: buf.length, sha256: sha256hex(buf) };
  }
  return { blocks, meta };
}

function readJsonFile(p) {
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch (e) {
    return fail(`${rel(p)}를 JSON으로 읽지 못했습니다: ${e instanceof Error ? e.message : String(e)}`);
  }
}

function readReleases(pending) {
  if (!existsSync(PATHS.releases)) {
    pending.push(`releases: ${rel(PATHS.releases)} 없음 → null`);
    return null;
  }
  return readJsonFile(PATHS.releases);
}

/** 체험 데이터 입력 계약: src/lib/cloudcheck/fixtures/companies/<cloud>-<set>.json(수집기 결과 파일 형식). 통합 때 조정 가능 */
function readDemo(clouds, sets, pending) {
  const out = {};
  for (const cloud of clouds) {
    for (const set of sets) {
      const p = path.join(PATHS.demoDir, `${cloud}-${set}.json`);
      if (existsSync(p)) out[`${cloud}-${set}`] = readJsonFile(p);
      else {
        out[`${cloud}-${set}`] = null;
        pending.push(`demo: ${rel(p)} 없음 → null`);
      }
    }
  }
  return out;
}

/**
 * esbuild 옵션(테스트가 같은 옵션인지 본다).
 * target es2020(D4 통합에서 es2019 → es2020): 런타임이 이미 ES2020 기능(String.prototype.matchAll — i18n 템플릿 파서)을 쓰므로
 * 문법만 낮춰도 지원 브라우저가 넓어지지 않는다. ?. · ?? 를 풀어 쓰지 않아 JS가 5.6 KiB(gzip 2 KiB) 준다(2026-10-19 실측).
 */
export function bundleOptions() {
  return {
    absWorkingDir: REPO,
    entryPoints: [rel(PATHS.entry)],
    bundle: true,
    write: false,
    outdir: "cc-out",
    entryNames: "main",
    format: "iife",
    platform: "browser",
    target: ["es2020"],
    minify: true,
    charset: "utf8",
    legalComments: "eof",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
    metafile: true,
    logLevel: "silent",
  };
}

/** JS 후처리: 인라인 스크립트를 HTML 파서가 잘못 끊지 않게 한다 */
export function postprocessJs(raw) {
  const js = raw.replace(/<(?=!--|script)/gi, "\\x3C");
  for (const [re, why] of [[/<!--/, "'<!--'"], [/<script/i, "'<script'"], [/<\/script/i, "'</script'"], [/\r/, "CR"], [/\0/, "NUL"]]) {
    if (re.test(js)) fail(`후처리 뒤에도 스크립트에 ${why}가 남았습니다.`);
  }
  try {
    new vm.Script(js, { filename: "cloudcheck-inline.js" });
  } catch (e) {
    fail(`후처리한 스크립트가 컴파일되지 않습니다: ${e instanceof Error ? e.message : String(e)}`);
  }
  return js;
}

export function checkCss(css) {
  for (const [re, why] of [[/<\/style/i, "'</style'"], [/\r/, "CR"], [/\0/, "NUL"]]) {
    if (re.test(css)) fail(`CSS에 ${why}가 있습니다.`);
  }
  return css;
}

/**
 * 메모리에서 생성한다(파일을 쓰지 않음).
 * @returns {Promise<import("./generate.d.mts").GenerateResult>}
 */
export async function generate() {
  const esbuild = loadEsbuild();
  const pending = [];
  const mods = await loadBuildModules(esbuild);

  let result;
  try {
    result = await esbuild.build(bundleOptions());
  } catch (e) {
    const errors = e && Array.isArray(e.errors) ? e.errors.map((x) => `${x.location ? `${x.location.file}:${x.location.line} ` : ""}${x.text}`).join("\n") : String(e);
    return fail(`번들 실패\n${errors}`);
  }
  if (result.warnings.length > 0) {
    fail(`번들 경고 ${result.warnings.length}건(경고 0을 유지한다)\n${result.warnings.map((w) => `${w.location ? `${w.location.file}:${w.location.line} ` : ""}${w.text}`).join("\n")}`);
  }
  const jsFile = result.outputFiles.find((f) => f.path.endsWith(".js"));
  const cssFile = result.outputFiles.find((f) => f.path.endsWith(".css"));
  if (jsFile === undefined) fail("번들 결과에 JS가 없습니다.");
  const js = postprocessJs(jsFile.text);
  const css = checkCss(cssFile === undefined ? "" : cssFile.text);
  if (css === "") pending.push("css: 아직 CSS가 없음(styles/** — 컴포넌트개발자)");
  const inputs = Object.keys(result.metafile.inputs).sort();

  const version = readPageVersion(pending);
  const collectors = readCollectors(pending);
  const releases = readReleases(pending);
  const demo = readDemo(mods.CLOUDS, mods.DEMO_SETS, pending);
  if (!mods.engineCatalogMerged()) pending.push("catalog: E(rules/i18n/ko.ts) 미병합 → 엔진 문장은 ⟦키⟧로 보임");
  for (const key of STATIC_KEYS) if (mods.lookup(key) === undefined) pending.push(`static: 정적 셸 키 ${key} 없음 → 그 요소를 뺌`);

  const blocks = [];
  for (const cloud of mods.CLOUDS) blocks.push({ id: mods.BLOCK.collector(cloud), type: "text/plain", content: collectors.blocks[cloud] ?? "" });
  blocks.push({ id: mods.BLOCK.collectors, type: "application/json", content: jsonBlock(collectors.meta) });
  blocks.push({ id: mods.BLOCK.releases, type: "application/json", content: jsonBlock(releases) });
  for (const cloud of mods.CLOUDS) {
    for (const set of mods.DEMO_SETS) blocks.push({ id: mods.BLOCK.demo(cloud, set), type: "application/json", content: jsonBlock(demo[`${cloud}-${set}`]) });
  }

  const scriptHash = sha256b64(js);
  const styleHash = sha256b64(css);
  const html = renderHtml({
    js,
    css,
    metaCsp: mods.metaCsp({ scriptHash, styleHash }),
    text: (key) => mods.lookup(key) ?? null,
    ids: mods.SHELL,
    blocks,
  });
  const page = {
    version,
    esbuildVersion: esbuild.version,
    sha256: sha256hex(Buffer.from(html, "utf8")),
    scriptHash,
    styleHash,
    bytes: Buffer.byteLength(html, "utf8"),
    collectors: { aws: collectors.meta.aws ?? null, azure: collectors.meta.azure ?? null },
    html,
  };
  const sizes = {
    html: page.bytes,
    htmlGzip: gzipSync(Buffer.from(html, "utf8"), { level: 9 }).length,
    js: Buffer.byteLength(js, "utf8"),
    css: Buffer.byteLength(css, "utf8"),
    collectors: Object.values(collectors.blocks).reduce((n, s) => n + Buffer.byteLength(s, "utf8"), 0),
    demo: blocks.filter((b) => b.id.startsWith("cc-demo-")).reduce((n, b) => n + Buffer.byteLength(b.content, "utf8"), 0),
  };
  return { page, js, css, blocks, inputs, pending, sizes };
}

/** _generated/page.ts 본문(결정적) */
export function renderPageModule(page) {
  const c = (m) => (m === null ? "null" : `{ file: ${JSON.stringify(m.file)}, bytes: ${m.bytes}, sha256: ${JSON.stringify(m.sha256)} }`);
  return [
    "// src/app/cloudcheck/_generated/page.ts — GENERATED by src/app/cloudcheck/_build/generate.mjs. 손으로 고치지 마세요.",
    "// 재생성은 프론트팀장만(방향서 §3). 검사: node src/app/cloudcheck/_build/generate.mjs --check",
    "export interface CollectorRecord {",
    "  readonly file: string;",
    "  readonly bytes: number;",
    "  readonly sha256: string;",
    "}",
    "export interface GeneratedPage {",
    "  readonly version: string;",
    "  readonly esbuildVersion: string;",
    "  readonly sha256: string;",
    "  readonly scriptHash: string;",
    "  readonly styleHash: string;",
    "  readonly bytes: number;",
    "  readonly collectors: { readonly aws: CollectorRecord | null; readonly azure: CollectorRecord | null };",
    "  readonly html: string;",
    "}",
    "export const PAGE: GeneratedPage = {",
    `  version: ${JSON.stringify(page.version)},`,
    `  esbuildVersion: ${JSON.stringify(page.esbuildVersion)},`,
    `  sha256: ${JSON.stringify(page.sha256)},`,
    `  scriptHash: ${JSON.stringify(page.scriptHash)},`,
    `  styleHash: ${JSON.stringify(page.styleHash)},`,
    `  bytes: ${page.bytes},`,
    `  collectors: { aws: ${c(page.collectors.aws)}, azure: ${c(page.collectors.azure)} },`,
    `  html: ${JSON.stringify(page.html)},`,
    "};",
    "",
  ].join("\n");
}

function summary(r) {
  const kib = (n) => `${(n / 1024).toFixed(1)} KiB`;
  const s = r.sizes;
  const lines = [
    `version ${r.page.version} · esbuild ${r.page.esbuildVersion}`,
    `html ${kib(s.html)} (gzip ${kib(s.htmlGzip)}) · js ${kib(s.js)} · css ${kib(s.css)} · 수집기 ${kib(s.collectors)} · 체험 ${kib(s.demo)}`,
    `sha256 ${r.page.sha256}`,
    `script 'sha256-${r.page.scriptHash}' · style 'sha256-${r.page.styleHash}'`,
  ];
  if (r.pending.length > 0) lines.push(`대기 중인 입력 ${r.pending.length}건:`, ...r.pending.map((p) => `  - ${p}`));
  return lines.join("\n");
}

function insideRepo(p) {
  const r = path.relative(REPO, p);
  return r === "" || (!r.startsWith("..") && !path.isAbsolute(r));
}

async function writePreview(target) {
  const r = await generate();
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, r.page.html);
  console.log(`${summary(r)}\n미리보기: ${target}`);
}

async function main(argv) {
  const args = argv.slice(2);
  const known = new Set(["--check", "--preview", "--watch"]);
  const pi = args.indexOf("--preview");
  for (let i = 0; i < args.length; i += 1) {
    if (i === pi + 1 && pi >= 0) continue;
    if (!known.has(args[i])) fail(`모르는 인자: ${args[i]}`);
  }
  if (args.includes("--check")) {
    const r = await generate();
    const fresh = renderPageModule(r.page);
    const current = existsSync(PATHS.generated) ? readFileSync(PATHS.generated, "utf8") : "";
    if (fresh !== current) {
      console.error(`${summary(r)}\n✗ _generated/page.ts가 지금 소스와 다릅니다. 프론트팀장이 재생성해야 합니다: node src/app/cloudcheck/_build/generate.mjs`);
      process.exitCode = 1;
      return;
    }
    console.log(`${summary(r)}\n_generated/page.ts가 지금 소스와 같습니다.`);
    return;
  }
  if (pi >= 0) {
    const arg = args[pi + 1];
    if (arg === undefined || arg.startsWith("--")) fail("--preview 다음에 레포 밖 파일 경로를 주세요(예: --preview /tmp/cc/index.html).");
    const target = path.resolve(process.cwd(), arg);
    if (insideRepo(target)) fail(`미리보기는 레포 밖에만 씁니다(_generated 쓰기 경합 방지): ${target}`);
    await writePreview(target);
    if (args.includes("--watch")) {
      let timer = null;
      const kick = () => {
        if (timer !== null) clearTimeout(timer);
        timer = setTimeout(() => {
          timer = null;
          writePreview(target).catch((e) => console.error(e instanceof Error ? e.message : String(e)));
        }, 200);
      };
      for (const dir of [CLIENT, path.join(APP, "_serve"), LIB]) if (existsSync(dir)) watch(dir, { recursive: true }, kick);
      console.log("감시 중(Ctrl+C로 끝냄)…");
    }
    return;
  }
  if (args.includes("--watch")) fail("--watch는 --preview와 함께만 씁니다.");
  const r = await generate();
  mkdirSync(path.dirname(PATHS.generated), { recursive: true });
  writeFileSync(PATHS.generated, renderPageModule(r.page));
  console.log(`${summary(r)}\n썼습니다: ${rel(PATHS.generated)}`);
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv).catch((e) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exitCode = 1;
  });
}
