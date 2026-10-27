// src/app/cloudcheck/_build/guards.test.ts — 코드 수준 강제 층 ①(소스 AST) + CSS 원본 검사. 소유: 프론트팀장.
// 근거: 방향서 §2-4(가드 조정분), 프론트 검토 §6(R-04·R-06·R-07(d)·R-11·R-12), 디자인 최종안 §11-2(G-D1~G-D28 중 정적 검사 가능한 것).
// TypeScript 컴파일러 API로 구문 트리를 본다 → 주석·문자열 속 단어로 오탐하지 않는다(ESLint는 루트 공유 설정이라 쓰지 않음).
// 대상: _client/**(테스트 제외) · src/lib/cloudcheck/{model,contract,parse,engine,rules}/**(테스트 제외) · 두 라우트 · _serve/headers.ts · _client/**/*.css
// 렌더로만 확인할 수 있는 규칙(G-D3·4·7·8·9·11·12·13·19·20·21·23)은 각 개발자의 RTL 테스트가 맡는다.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { engineCatalogMerged, fileOfKey, hasKey, KEY_RE } from "../_client/i18n/index";
import { PATHS } from "./generate.mjs";

/* ───────── 파일 모으기 ───────── */
const APP = PATHS.app;
const CLIENT = PATHS.client;
const LIB = PATHS.lib;
const LIB5 = ["model", "contract", "parse", "engine", "rules"] as const;

type Scope = "client" | "lib" | "route";
interface Src {
  readonly abs: string;
  readonly rel: string;       // 레포 기준
  readonly local: string;     // 스코프 기준(_client/… 또는 lib/…)
  readonly scope: Scope;
  readonly sf: ts.SourceFile;
}
interface Violation {
  readonly rule: string;
  readonly at: string;        // 파일:줄
  readonly what: string;
}

const posix = (p: string): string => p.split(path.sep).join("/");
const relRepo = (p: string): string => posix(path.relative(PATHS.repo, p));

function listFiles(dir: string, re: RegExp): string[] {
  if (!existsSync(dir)) return [];
  return (readdirSync(dir, { recursive: true }) as string[])
    .map((f) => path.join(dir, f))
    .filter((f) => re.test(f) && statSync(f).isFile())
    .sort();
}
const isTestFile = (f: string): boolean => /\.(test|spec)\.tsx?$/.test(f) || /\.typetest\.ts$/.test(f) || /[\\/]__[^\\/]+__[\\/]/.test(f);

function parse(abs: string, scope: Scope, base: string): Src {
  const text = readFileSync(abs, "utf8");
  const kind = abs.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return { abs, rel: relRepo(abs), local: posix(path.relative(base, abs)), scope, sf: ts.createSourceFile(abs, text, ts.ScriptTarget.Latest, true, kind) };
}

const CLIENT_SRC: Src[] = listFiles(CLIENT, /\.tsx?$/).filter((f) => !isTestFile(f)).map((f) => parse(f, "client", CLIENT));
const LIB_SRC: Src[] = LIB5.flatMap((d) => listFiles(path.join(LIB, d), /\.ts$/)).filter((f) => !isTestFile(f)).map((f) => parse(f, "lib", LIB));
const ROUTE_SRC: Src[] = [path.join(APP, "route.ts"), path.join(APP, "download/route.ts"), path.join(APP, "_serve/headers.ts")]
  .filter((f) => existsSync(f))
  .map((f) => parse(f, "route", APP));
const ALL: Src[] = [...CLIENT_SRC, ...LIB_SRC, ...ROUTE_SRC];

/* ───────── 구문 도우미 ───────── */
function walk(node: ts.Node, visit: (n: ts.Node) => void): void {
  visit(node);
  ts.forEachChild(node, (c) => walk(c, visit));
}
function at(src: Src, node: ts.Node): string {
  return `${src.rel}:${src.sf.getLineAndCharacterOfPosition(node.getStart(src.sf)).line + 1}`;
}
function snippet(src: Src, node: ts.Node): string {
  return node.getText(src.sf).replace(/\s+/g, " ").slice(0, 100);
}
/** 식별자가 '값 참조'인지(속성 이름·선언 이름·타입 위치가 아님) */
function isReference(id: ts.Identifier): boolean {
  const p = id.parent;
  if (ts.isPropertyAccessExpression(p) && p.name === id) return false;
  if (ts.isQualifiedName(p) && p.right === id) return false;
  if ((ts.isPropertyAssignment(p) || ts.isPropertyDeclaration(p) || ts.isPropertySignature(p) || ts.isMethodDeclaration(p) || ts.isMethodSignature(p) ||
    ts.isGetAccessor(p) || ts.isSetAccessor(p) || ts.isEnumMember(p)) && p.name === id) return false;
  if (ts.isBindingElement(p) && p.propertyName === id) return false;
  if (ts.isImportSpecifier(p) || ts.isExportSpecifier(p)) return false;
  if (ts.isJsxAttribute(p)) return false;
  if (ts.isTypeReferenceNode(p) || ts.isTypeQueryNode(p) || ts.isExpressionWithTypeArguments(p)) return false;
  if (ts.isLabeledStatement(p) || ts.isBreakOrContinueStatement(p)) return false;
  return true;
}
/** obj.prop 또는 obj["prop"]의 속성 이름 */
function accessName(n: ts.Node): string | null {
  if (ts.isPropertyAccessExpression(n)) return n.name.text;
  if (ts.isElementAccessExpression(n) && ts.isStringLiteralLike(n.argumentExpression)) return n.argumentExpression.text;
  return null;
}
function accessObject(n: ts.PropertyAccessExpression | ts.ElementAccessExpression): string {
  return n.expression.getText().replace(/\s+/g, "");
}
function isAssignTarget(n: ts.Node): boolean {
  const p = n.parent;
  return ts.isBinaryExpression(p) && p.left === n && p.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && p.operatorToken.kind <= ts.SyntaxKind.LastAssignment;
}
function jsxTag(n: ts.JsxOpeningElement | ts.JsxSelfClosingElement): string {
  return n.tagName.getText();
}
function jsxAttrs(n: ts.JsxOpeningElement | ts.JsxSelfClosingElement): Map<string, ts.JsxAttribute> {
  const m = new Map<string, ts.JsxAttribute>();
  for (const a of n.attributes.properties) if (ts.isJsxAttribute(a)) m.set(a.name.getText(), a);
  return m;
}
/** JSX 속성의 리터럴 값("x" / {"x"} / {false}) — 식이면 null */
function attrLiteral(a: ts.JsxAttribute | undefined): string | null {
  if (a === undefined) return null;
  const init = a.initializer;
  if (init === undefined) return "true";
  if (ts.isStringLiteral(init)) return init.text;
  if (ts.isJsxExpression(init) && init.expression !== undefined) {
    const e = init.expression;
    if (ts.isStringLiteralLike(e)) return e.text;
    if (e.kind === ts.SyntaxKind.FalseKeyword) return "false";
    if (e.kind === ts.SyntaxKind.TrueKeyword) return "true";
  }
  return null;
}
const HANGUL = /[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF]/;

/* ───────── 규칙 표 ───────── */
const BANNED_IDS: ReadonlyMap<string, string> = new Map(Object.entries({
  // R-06 영속 저장 0
  localStorage: "R-06", sessionStorage: "R-06", indexedDB: "R-06", cookieStore: "R-06",
  BroadcastChannel: "R-06", Worker: "R-06", SharedWorker: "R-06", showSaveFilePicker: "R-06", showDirectoryPicker: "R-06",
  // R-07(d) 추가 요청 0
  fetch: "R-07", XMLHttpRequest: "R-07", WebSocket: "R-07", EventSource: "R-07", RTCPeerConnection: "R-07",
  webkitRTCPeerConnection: "R-07", importScripts: "R-07",
  // R-11 원클릭 복사 0
  ClipboardItem: "R-11",
  // R-12 HTML 문자열 실행·주입 0
  eval: "R-12", DOMParser: "R-12", Function: "R-12",
  // CSSOM 우회(방향서 §1-2 H)
  CSSStyleSheet: "G-D1",
}));
const BANNED_PROPS: ReadonlyMap<string, string> = new Map(Object.entries({
  innerHTML: "R-12", outerHTML: "R-12", insertAdjacentHTML: "R-12", createContextualFragment: "R-12", srcdoc: "R-12",
  localStorage: "R-06", sessionStorage: "R-06", indexedDB: "R-06", serviceWorker: "R-06", replaceState: "R-06", cookieStore: "R-06", caches: "R-06",
  sendBeacon: "R-07",
  clipboard: "R-11", execCommand: "R-11", writeText: "R-11",
  insertRule: "G-D1", adoptedStyleSheets: "G-D1",
}));
const BANNED_JSX_TAGS = new Set([
  "img", "iframe", "frame", "frameset", "script", "link", "object", "embed", "video", "audio", "source", "track", "picture",
  "portal", "base", "meta", "style", "image", "feImage", "foreignObject",
]);
const SVG_TAGS = new Set(["svg", "path", "circle", "rect", "line", "polyline", "polygon", "g", "ellipse", "symbol", "defs", "use", "text", "tspan"]);
const TEXT_INPUT_ATTRS: Readonly<Record<string, string>> = {
  spellCheck: "false", autoComplete: "off", autoCorrect: "off", autoCapitalize: "off",
  "data-gramm": "false", "data-gramm_editor": "false", "data-enable-grammarly": "false",
};
const TEXT_INPUT_TYPES = new Set(["text", "search", "email", "url", "tel", "password"]);
/** href를 만들 수 있는 관문(방향서 §2-4, 디자인 G-D5) */
const HREF_GATES = new Set(["components/DocLink.tsx", "components/DownloadLink.tsx"]);
/** StatusIcon을 import할 수 있는 곳(디자인 R2·G-D2) */
const STATUS_ICON_IMPORTERS = new Set(["components/StatusBadge.tsx", "components/DistributionChips.tsx", "components/StatusLegend.tsx"]);
/** DisplayValue.full·masked를 읽을 수 있는 곳(R-12·R-13 단일 통로) */
const MASKED_VALUE_GATE = "components/MaskedValue.tsx";
/** pushState 관문(방향서 §1-1 #3) */
const HISTORY_GATE = "state/history.ts";

/**
 * _client → lib import 허용 목록(방향서 §3 규칙 4 + 디자인 X11 + 메인 세션 2026-10-19: contract/normalized는 demoInputName만).
 * value = 값 import로 허용하는 이름, type = 타입 전용 import로 허용하는 이름. null = 모든 이름.
 * contract/normalized의 타입은 NormalizedInput 하나만(buildInput 결과를 상태에 보관할 때 쓴다). 내용 접근은 아래 타입 검사기 가드가 막는다.
 */
interface LibImportRule { readonly value: readonly string[] | null; readonly type: readonly string[] | null }
const ANY: LibImportRule = { value: null, type: null };
const LIB_IMPORTS: ReadonlyMap<string, LibImportRule> = new Map<string, LibImportRule>([
  ["model/report", ANY], ["model/banned-words", ANY],
  ["contract/calls", ANY], ["contract/rg-queries", ANY],
  ["contract/collect-schema", { value: ["LIMITS"], type: null }],
  ["contract/exceptions-schema", { value: ["EXCEPTION_MAX_DAYS"], type: null }],
  ["contract/normalized", { value: ["demoInputName"], type: ["NormalizedInput"] }],
  ["parse/recognize", ANY], ["parse/normalize", ANY], ["parse/mask", ANY], ["parse/exceptions", ANY],
  ["engine/judge", ANY], ["engine/time", ANY], ["engine/exceptions", ANY], ["engine/compare", ANY],
  ["rules/catalog", ANY], ["rules/i18n/ko", ANY],
  // D4 통합(프론트팀장): 룰셋 버전 상수 하나(바닥 줄·V8). 전에는 deps.real이 failClosedReport(null)로 우회해 읽었다
  ["rules/version", { value: ["RULESET_VERSION"], type: null }],
]);
/**
 * lib 5폴더 밖 import의 유일한 예외(메인 세션 결정 2026-10-19): parse/ → collector/RELEASES.json(릴리스 기록의 단일 원천, SHA256SUMS 옆 추가 전용).
 * 수집기 .sh 원문·SHA256SUMS·markers 등 collector의 다른 파일과, parse/ 밖에서의 import는 계속 lib-boundary 위반이다.
 */
const LIB_OUTSIDE_EXCEPTION = { fromDir: "parse/", target: "collector/RELEASES.json" } as const;
const CLIENT_PACKAGES = new Set(["react", "react-dom", "react-dom/client"]);
const LIB_PACKAGES = new Set(["zod"]);

/* ───────── 검사 실행 ───────── */
let sink: Violation[] = [];
const add = (rule: string, src: Src, node: ts.Node, what: string): void => {
  sink.push({ rule, at: at(src, node), what: `${what} — ${snippet(src, node)}` });
};
/** 파일 하나를 검사해 위반 목록을 돌려준다(실제 파일과 자체 검사 샘플이 같은 함수를 쓴다) */
function scan(src: Src): Violation[] {
  const prev = sink;
  sink = [];
  walk(src.sf, (n) => checkNode(src, n));
  const out = sink;
  sink = prev;
  return out;
}

function checkImports(src: Src, node: ts.ImportDeclaration | ts.ExportDeclaration): void {
  const specNode = node.moduleSpecifier;
  if (specNode === undefined || !ts.isStringLiteral(specNode)) return;
  const spec = specNode.text;
  if (src.scope === "route") {
    const okSet = src.local === "route.ts" ? ["./_generated/page", "./_serve/headers"] : src.local === "download/route.ts" ? ["../_generated/page", "../_serve/headers"] : [];
    if (!okSet.includes(spec)) add("route-imports", src, node, "라우트·헤더 모듈은 _generated·_serve만 import한다(방향서 §2-2)");
    return;
  }
  if (!spec.startsWith(".")) {
    const allowed = src.scope === "client" ? CLIENT_PACKAGES : LIB_PACKAGES;
    if (!allowed.has(spec)) add("imports", src, node, `${src.scope === "client" ? "_client" : "lib"}에서 허용하지 않은 패키지·경로: ${spec}`);
    return;
  }
  const target = path.resolve(path.dirname(src.abs), spec).replace(/\.(tsx?|mjs|js)$/, "");
  const inClient = !path.relative(CLIENT, target).startsWith("..");
  const libRel = posix(path.relative(LIB, target));
  const inLib = !libRel.startsWith("..") && !path.isAbsolute(libRel);
  if (src.scope === "lib") {
    const narrowException = inLib && src.local.startsWith(LIB_OUTSIDE_EXCEPTION.fromDir) && libRel === LIB_OUTSIDE_EXCEPTION.target && ts.isImportDeclaration(node);
    if ((!inLib || !LIB5.some((d) => libRel.startsWith(`${d}/`))) && !narrowException) add("lib-boundary", src, node, `lib 5폴더 밖 import 금지: ${spec}`);
    return;
  }
  // client
  if (inClient) {
    if (/(^|\/)StatusIcon$/.test(posix(target)) && !STATUS_ICON_IMPORTERS.has(src.local) && src.local !== "components/StatusIcon.tsx") {
      add("G-D2", src, node, "StatusIcon은 StatusBadge·DistributionChips·StatusLegend만 import한다");
    }
    return;
  }
  if (!inLib) {
    add("imports", src, node, `_client는 _client·src/lib/cloudcheck 밖을 import하지 않는다: ${spec}`);
    return;
  }
  const rule = LIB_IMPORTS.get(libRel);
  if (rule === undefined) {
    add("lib-allowlist", src, node, `_client → lib import 허용 목록 밖(방향서 §3 규칙 4 + X11): ${libRel}`);
    return;
  }
  if (!ts.isImportDeclaration(node)) {
    add("lib-allowlist", src, node, `${libRel}를 _client에서 다시 내보내지 않는다`);
    return;
  }
  const clause = node.importClause;
  if (clause === undefined) return; // 부수 효과 import(이름 없음)
  const check = (name: string, isType: boolean): void => {
    const allowed = isType ? rule.type : rule.value;
    if (allowed !== null && !allowed.includes(name)) {
      add("lib-allowlist", src, node, `${libRel}에서 ${isType ? "타입" : "값"} import로 허용된 이름은 ${allowed.length > 0 ? allowed.join(", ") : "없음"}뿐: ${name}`);
    }
  };
  if (clause.name !== undefined) check("default", clause.isTypeOnly);
  const nb = clause.namedBindings;
  if (nb !== undefined && ts.isNamespaceImport(nb)) check("* as", clause.isTypeOnly);
  if (nb !== undefined && ts.isNamedImports(nb)) {
    for (const el of nb.elements) check((el.propertyName ?? el.name).text, clause.isTypeOnly || el.isTypeOnly);
  }
}

function checkClassTokens(src: Src, node: ts.Node, text: string, firstIsStart: boolean, rule: string): void {
  const parts = text.split(/(\s+)/);
  let start = firstIsStart;
  for (const part of parts) {
    if (/^\s+$/.test(part)) {
      start = true;
      continue;
    }
    if (part !== "" && start && !part.startsWith("cc-")) add(rule, src, node, `클래스는 cc- 접두: '${part}'`);
    start = false;
  }
}
/** className 식 안의 '값 위치' 문자열만 본다(비교 연산의 피연산자는 건너뜀) */
function checkClassExpr(src: Src, e: ts.Node): void {
  if (ts.isStringLiteralLike(e)) return checkClassTokens(src, e, e.text, true, "G-D15");
  if (ts.isTemplateExpression(e)) {
    checkClassTokens(src, e, e.head.text, true, "G-D15");
    for (const span of e.templateSpans) {
      checkClassExpr(src, span.expression);
      checkClassTokens(src, e, span.literal.text, /^\s/.test(span.literal.text), "G-D15");
    }
    return;
  }
  if (ts.isBinaryExpression(e)) {
    const k = e.operatorToken.kind;
    const compare = [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken,
      ts.SyntaxKind.ExclamationEqualsToken, ts.SyntaxKind.LessThanToken, ts.SyntaxKind.GreaterThanToken, ts.SyntaxKind.InKeyword].includes(k);
    if (compare) return;
    checkClassExpr(src, e.left);
    checkClassExpr(src, e.right);
    return;
  }
  if (ts.isConditionalExpression(e)) {
    checkClassExpr(src, e.whenTrue);
    checkClassExpr(src, e.whenFalse);
    return;
  }
  if (ts.isCallExpression(e)) {
    // [..].join(" ") 같은 호출: 대상 식만 본다(인자는 구분자)
    if (ts.isPropertyAccessExpression(e.expression)) checkClassExpr(src, e.expression.expression);
    return;
  }
  if (ts.isArrayLiteralExpression(e)) {
    for (const el of e.elements) checkClassExpr(src, el);
    return;
  }
  if (ts.isParenthesizedExpression(e) || ts.isAsExpression(e)) return checkClassExpr(src, e.expression);
}

function checkJsx(src: Src, n: ts.JsxOpeningElement | ts.JsxSelfClosingElement): void {
  const tag = jsxTag(n);
  const attrs = jsxAttrs(n);
  if (BANNED_JSX_TAGS.has(tag)) add("R-07", src, n, `요청·실행을 만들 수 있는 요소 <${tag}> 금지`);
  if (attrs.has("dangerouslySetInnerHTML")) add("R-12", src, n, "dangerouslySetInnerHTML 금지");
  if (attrs.has("style")) add("G-D1", src, n, "style prop 금지(SVG 포함, 예외 없음)");
  for (const name of ["href", "xlinkHref", "xlink:href"]) {
    if (attrs.has(name) && !HREF_GATES.has(src.local)) add("G-D5", src, n, `${name}는 DocLink·DownloadLink 관문에서만`);
  }
  for (const name of ["action", "formAction", "src", "srcSet", "srcDoc", "ping", "poster", "background"]) {
    if (attrs.has(name)) add("R-07", src, n, `${name} 속성 금지`);
  }
  for (const [name] of attrs) if (/^on[A-Z]/.test(name) && ts.isStringLiteral(attrs.get(name)?.initializer ?? n)) add("R-12", src, n, `문자열 이벤트 처리기 ${name}`);
  if (attrLiteral(attrs.get("target")) === "_blank") {
    const rel = attrLiteral(attrs.get("rel")) ?? "";
    if (!/\bnoopener\b/.test(rel) || !/\bnoreferrer\b/.test(rel)) add("G-D5", src, n, 'target="_blank"는 rel="noopener noreferrer"와 함께');
  }
  const cls = attrs.get("className");
  if (cls?.initializer !== undefined) {
    if (ts.isStringLiteral(cls.initializer)) checkClassTokens(src, cls, cls.initializer.text, true, "G-D15");
    else if (ts.isJsxExpression(cls.initializer) && cls.initializer.expression !== undefined) checkClassExpr(src, cls.initializer.expression);
  }
  if (attrs.has("class")) add("G-D15", src, n, "class가 아니라 className");
  if (SVG_TAGS.has(tag)) {
    for (const name of ["width", "height", "fill", "stroke", "style"]) if (attrs.has(name)) add("G-D22", src, n, `SVG에 ${name} 속성 금지(크기·색은 클래스로)`);
    if (tag === "svg") {
      if (attrLiteral(attrs.get("aria-hidden")) !== "true") add("G-D22", src, n, '장식 SVG에 aria-hidden="true"');
      if (attrLiteral(attrs.get("focusable")) !== "false") add("G-D22", src, n, '장식 SVG에 focusable="false"');
    }
  }
  const needsTextGuard = tag === "textarea" || (tag === "input" && (() => {
    const type = attrs.get("type");
    if (type === undefined) return true;
    const lit = attrLiteral(type);
    return lit === null || TEXT_INPUT_TYPES.has(lit);
  })());
  if (needsTextGuard) {
    for (const [name, want] of Object.entries(TEXT_INPUT_ATTRS)) {
      if (attrLiteral(attrs.get(name)) !== want) add("G-D10", src, n, `글자 입력칸에 ${name}=${want}(맞춤법·자동완성 차단, 방향서 §2-4)`);
    }
  }
}

function checkCall(src: Src, n: ts.CallExpression): void {
  const callee = n.expression;
  if (callee.kind === ts.SyntaxKind.ImportKeyword) add("R-07", src, n, "동적 import() 금지");
  if (ts.isIdentifier(callee) && ["setTimeout", "setInterval", "setImmediate"].includes(callee.text)) {
    const first = n.arguments[0];
    if (first !== undefined && (ts.isStringLiteralLike(first) || ts.isTemplateExpression(first))) add("R-12", src, n, "문자열을 실행하는 타이머 금지");
  }
  if (ts.isIdentifier(callee) && callee.text === "open") add("R-07", src, n, "window.open 금지");
  if (ts.isPropertyAccessExpression(callee)) {
    const name = callee.name.text;
    const obj = accessObject(callee);
    if (name === "open" && /^(window|globalThis|self|top|parent)$/.test(obj)) add("R-07", src, n, "window.open 금지");
    if ((name === "assign" || name === "replace" || name === "reload") && /(^|\.)location$/.test(obj)) add("R-07", src, n, `location.${name} 금지`);
    if ((name === "write" || name === "writeln") && obj === "document") add("R-12", src, n, "document.write 금지");
    if (name === "setAttribute") {
      const a0 = n.arguments[0];
      const attr = a0 !== undefined && ts.isStringLiteralLike(a0) ? a0.text.toLowerCase() : null;
      if (attr === null) add("G-D1", src, n, "setAttribute 첫 인자는 리터럴이어야 검사할 수 있다");
      else if (attr === "style") add("G-D1", src, n, "setAttribute('style') 금지");
      else if (attr === "href" || attr === "src" || attr === "srcdoc" || attr === "action" || attr.startsWith("on")) {
        if (!(attr === "href" && src.local === "components/DownloadLink.tsx")) add("R-12", src, n, `setAttribute('${attr}') 금지`);
      } else if (attr === "class") add("G-D15", src, n, "setAttribute('class') 대신 className·classList");
    }
    if (obj.endsWith("classList") && ["add", "remove", "toggle", "replace", "contains"].includes(name)) {
      for (const a of n.arguments) if (ts.isStringLiteralLike(a)) checkClassTokens(src, a, a.text, true, "G-D15");
    }
    if (name === "pushState") {
      const okShape =
        src.scope === "client" && src.local === HISTORY_GATE && n.arguments.length === 2 &&
        ts.isObjectLiteralExpression(n.arguments[0]!) && n.arguments[0].properties.length === 1 &&
        (() => {
          const p = (n.arguments[0] as ts.ObjectLiteralExpression).properties[0]!;
          return (ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)) && p.name.getText() === "cc";
        })() &&
        ts.isStringLiteralLike(n.arguments[1]!) && (n.arguments[1] as ts.StringLiteralLike).text === "";
      if (!okShape) add("G-D28", src, n, `pushState는 ${HISTORY_GATE}에서 history.pushState({ cc: <ScreenId> }, "") 모양으로만`);
    }
  }
}

function checkNode(src: Src, n: ts.Node): void {
  if (ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) checkImports(src, n);
  if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) checkJsx(src, n);
  if (ts.isCallExpression(n)) checkCall(src, n);
  // new Function·new Worker 등은 아래 식별자 규칙(BANNED_IDS)이 잡는다. Image·Audio는 흔한 이름이라 new 식일 때만, caches는 CacheStorage 호출 모양일 때만 본다
  if (ts.isNewExpression(n) && ts.isIdentifier(n.expression) && (n.expression.text === "Image" || n.expression.text === "Audio")) add("R-07", src, n, `new ${n.expression.text}() 금지(요청을 만든다)`);
  if (ts.isPropertyAccessExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === "caches" && ["open", "match", "keys", "delete", "has"].includes(n.name.text)) add("R-06", src, n, "CacheStorage(caches) 금지");
  if (ts.isIdentifier(n) && isReference(n)) {
    const rule = BANNED_IDS.get(n.text);
    if (rule !== undefined) add(rule, src, n, `${n.text} 사용 금지`);
    if (src.scope === "lib" && ["document", "window", "navigator"].includes(n.text)) add("lib-boundary", src, n, `lib(5폴더)는 DOM을 쓰지 않는다: ${n.text}`);
  }
  if (ts.isPropertyAccessExpression(n) || ts.isElementAccessExpression(n)) {
    const name = accessName(n);
    if (name !== null) {
      const rule = BANNED_PROPS.get(name);
      if (rule !== undefined) add(rule, src, n, `.${name} 사용 금지`);
      const obj = accessObject(n);
      if (name === "cookie" && obj === "document") add("R-06", src, n, "document.cookie 금지");
      if (name === "pushState" && !ts.isCallExpression(n.parent)) add("G-D28", src, n, "pushState를 값으로 꺼내지 않는다");
      if (name === "style" && src.scope === "client") add("G-D1", src, n, ".style(CSSOM 인라인 스타일) 금지 — 필요하면 프론트팀장 승인 아래 단일 유틸로");
      if (name === "env" && obj === "process") add("env", src, n, "process.env 금지(cloudcheck는 환경변수를 쓰지 않는다 — 방향서 §10-5)");
      if ((name === "full" || name === "masked") && src.scope === "client" && src.local !== MASKED_VALUE_GATE && !src.local.startsWith("mocks/")) {
        add("R-12/R-13", src, n, `DisplayValue.${name}는 MaskedValue에서만 읽는다(사용자 데이터 단일 통로)`);
      }
      if (isAssignTarget(n)) {
        if ((name === "href" && /(^|\.)location$/.test(obj)) || (name === "location" && /^(window|document|globalThis|self|top|parent)$/.test(obj))) add("R-07", src, n, "최상위 이동(location 대입) 금지");
        else if (["hash", "search", "pathname"].includes(name) && /(^|\.)location$/.test(obj)) add("R-06", src, n, `location.${name} 대입 금지(URL·해시 불변)`);
        else if (name === "name" && /^(window|globalThis|self)$/.test(obj)) add("R-06", src, n, "window.name 대입 금지");
        else if (name === "href" && src.local !== "components/DownloadLink.tsx") add("G-D5", src, n, ".href 대입은 DownloadLink(Blob 내려받기)에서만");
        else if (["innerText", "outerText"].includes(name)) add("R-12", src, n, `${name} 대입 대신 JSX`);
      }
    }
  }
  if (ts.isBinaryExpression(n) && ts.isIdentifier(n.left) && n.left.text === "location" && n.operatorToken.kind === ts.SyntaxKind.EqualsToken) add("R-07", src, n, "location 대입 금지");
  // 방향서 §2-4 lib 경계: engine/·rules/·contract/는 현재 시각·난수를 읽지 않는다(INV-9 — judge는 입력만의 함수). 백엔드 소스 스캔과 같은 규칙(중복 방어)
  if (src.scope === "lib" && /^(engine|rules|contract)\//.test(src.local)) {
    if (ts.isPropertyAccessExpression(n)) {
      const obj = n.expression.getText(src.sf);
      const name = n.name.text;
      if ((obj === "Date" && name === "now") || (obj === "Math" && name === "random") || (obj === "performance" && name === "now") ||
        (/(^|\.)crypto$/.test(obj) && (name === "getRandomValues" || name === "randomUUID"))) add("determinism", src, n, `${obj}.${name} 금지(현재 시각·난수)`);
    }
    if (ts.isNewExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === "Date" && (n.arguments === undefined || n.arguments.length === 0)) add("determinism", src, n, "인자 없는 new Date() 금지");
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === "Date") add("determinism", src, n, "Date() 호출(현재 시각 문자열) 금지");
  }
  if (ts.isBindingElement(n) && src.scope === "client" && src.local !== MASKED_VALUE_GATE && !src.local.startsWith("mocks/")) {
    const prop = (n.propertyName ?? n.name).getText();
    if (prop === "full" || prop === "masked") add("R-12/R-13", src, n, `DisplayValue.${prop}를 구조 분해로 꺼내지 않는다(MaskedValue에서만)`);
  }
  // R3·R-04: 화면 글자는 카탈로그로만(_client의 i18n·mocks 밖에서 한글 문자열·JSX 글자 금지)
  if (src.scope === "client" && !src.local.startsWith("i18n/") && !src.local.startsWith("mocks/")) {
    if (ts.isJsxText(n) && HANGUL.test(n.text)) add("R3", src, n, "JSX 안 한글 글자 — t()·<T>로 카탈로그에서 꺼낸다");
    if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && HANGUL.test(n.text)) add("R3", src, n, "한글 문자열 리터럴 — 카탈로그(i18n/ko/*)에 넣는다");
    if ((ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) && HANGUL.test(n.text)) add("R3", src, n, "한글 템플릿 문자열 — 카탈로그에 넣는다");
  }
}

const V: Violation[] = ALL.flatMap(scan);

const violations = (prefix: string): string[] => V.filter((v) => v.rule === prefix).map((v) => `${v.at} [${v.rule}] ${v.what}`);

/* ───────── 가드 자체 검사(린터의 린터): 위반 샘플은 모두 잡히고, 허용 모양은 잡히지 않는다 ───────── */
function sample(local: string, scope: Scope, text: string): Src {
  const base = scope === "client" ? CLIENT : scope === "lib" ? LIB : APP;
  const abs = path.join(base, local);
  const kind = local.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return { abs, rel: `selftest:${local}`, local, scope, sf: ts.createSourceFile(abs, text, ts.ScriptTarget.Latest, true, kind) };
}
const rulesOf = (s: Src): string[] => [...new Set(scan(s).map((v) => v.rule))].sort();
const BAD_SAMPLES: readonly { readonly rule: string; readonly local: string; readonly scope: Scope; readonly code: string }[] = [
  { rule: "R-12", local: "components/X.tsx", scope: "client", code: "export function f(el: HTMLElement, x: string) { el.innerHTML = x; }" },
  { rule: "R-12", local: "components/X.tsx", scope: "client", code: "export const A = (x: string) => <div dangerouslySetInnerHTML={{ __html: x }} />;" },
  { rule: "R-12", local: "components/X.tsx", scope: "client", code: 'export const v = eval("1");' },
  { rule: "R-12", local: "components/X.tsx", scope: "client", code: 'export const fn = new Function("a", "return a");' },
  { rule: "R-12", local: "components/X.tsx", scope: "client", code: 'setTimeout("alert(1)", 1);' },
  { rule: "R-12", local: "components/X.tsx", scope: "client", code: 'document.write("x");' },
  { rule: "R-12", local: "components/X.tsx", scope: "client", code: 'export const d = new DOMParser();' },
  { rule: "R-06", local: "state/x.ts", scope: "client", code: 'localStorage.setItem("a", "b");' },
  { rule: "R-06", local: "state/x.ts", scope: "client", code: 'document.cookie = "a=b";' },
  { rule: "R-06", local: "state/x.ts", scope: "client", code: 'navigator.serviceWorker.register("/sw.js");' },
  { rule: "R-06", local: "state/x.ts", scope: "client", code: 'history.replaceState(null, "");' },
  { rule: "R-06", local: "state/x.ts", scope: "client", code: 'location.hash = "#x";' },
  { rule: "R-06", local: "state/x.ts", scope: "client", code: 'window.name = "x";' },
  { rule: "R-06", local: "state/x.ts", scope: "client", code: 'caches.open("v1");' },
  { rule: "R-06", local: "state/x.ts", scope: "client", code: 'export const c = window.caches;' },
  { rule: "R-07", local: "state/x.ts", scope: "client", code: "export const a = new Audio();" },
  { rule: "R-07", local: "state/x.ts", scope: "client", code: 'fetch("/api/health");' },
  { rule: "R-07", local: "state/x.ts", scope: "client", code: "export const x = new XMLHttpRequest();" },
  { rule: "R-07", local: "state/x.ts", scope: "client", code: 'export const m = import("./y");' },
  { rule: "R-07", local: "state/x.ts", scope: "client", code: "export const i = new Image();" },
  { rule: "R-07", local: "state/x.ts", scope: "client", code: 'window.open("https://example.com");' },
  { rule: "R-07", local: "state/x.ts", scope: "client", code: 'location.href = "https://example.com";' },
  { rule: "R-07", local: "state/x.ts", scope: "client", code: 'navigator.sendBeacon("/x", "y");' },
  { rule: "R-07", local: "components/X.tsx", scope: "client", code: 'export const A = () => <img alt="" />;' },
  { rule: "R-07", local: "components/X.tsx", scope: "client", code: "export const A = () => <iframe />;" },
  { rule: "R-07", local: "components/X.tsx", scope: "client", code: 'export const A = () => <form action="/x" />;' },
  { rule: "R-11", local: "components/X.tsx", scope: "client", code: 'navigator.clipboard.writeText("x");' },
  { rule: "R-11", local: "components/X.tsx", scope: "client", code: 'document.execCommand("copy");' },
  { rule: "R3", local: "components/X.tsx", scope: "client", code: "export const A = () => <p>안녕하세요</p>;" },
  { rule: "R3", local: "screens/X.tsx", scope: "client", code: 'export const s = "리포트";' },
  { rule: "R3", local: "screens/X.tsx", scope: "client", code: 'export const A = () => <button aria-label="닫기" />;' },
  { rule: "G-D1", local: "components/X.tsx", scope: "client", code: 'export const A = () => <div style={{ color: "red" }} />;' },
  { rule: "G-D1", local: "components/X.tsx", scope: "client", code: 'export function f(el: HTMLElement) { el.style.color = "red"; }' },
  { rule: "G-D1", local: "components/X.tsx", scope: "client", code: 'export function f(el: HTMLElement) { el.setAttribute("style", "x"); }' },
  { rule: "G-D2", local: "components/X.tsx", scope: "client", code: 'import { StatusIcon } from "./StatusIcon"; export const A = StatusIcon;' },
  { rule: "G-D5", local: "components/X.tsx", scope: "client", code: 'export const A = () => <a href="https://docs.aws.amazon.com/">x</a>;' },
  { rule: "G-D5", local: "screens/X.tsx", scope: "client", code: 'export const A = () => <button>{"#"}</button>; export const B = () => <a href="#top">x</a>;' },
  { rule: "G-D5", local: "components/DocLink.tsx", scope: "client", code: 'export const A = () => <a href="https://x" target="_blank" rel="noopener">x</a>;' },
  { rule: "G-D10", local: "components/X.tsx", scope: "client", code: "export const A = () => <textarea />;" },
  { rule: "G-D10", local: "components/X.tsx", scope: "client", code: 'export const A = () => <input type="text" spellCheck={false} />;' },
  { rule: "G-D15", local: "components/X.tsx", scope: "client", code: 'export const A = () => <div className="btn" />;' },
  { rule: "G-D15", local: "components/X.tsx", scope: "client", code: "export const A = (x: string) => <div className={`cc-a ${x} big`} />;" },
  { rule: "G-D15", local: "state/x.ts", scope: "client", code: 'document.documentElement.classList.add("active");' },
  { rule: "G-D22", local: "components/X.tsx", scope: "client", code: 'export const A = () => <svg viewBox="0 0 1 1"><path d="M0 0" /></svg>;' },
  { rule: "G-D22", local: "components/X.tsx", scope: "client", code: 'export const A = () => <svg aria-hidden="true" focusable="false" width="16"><path fill="red" d="M0 0" /></svg>;' },
  { rule: "G-D28", local: "components/X.tsx", scope: "client", code: 'history.pushState({ cc: "start" }, "");' },
  { rule: "G-D28", local: "state/history.ts", scope: "client", code: 'history.pushState({ cc: "start" }, "", "/x");' },
  { rule: "G-D28", local: "state/history.ts", scope: "client", code: 'history.pushState({ cc: "start", data: 1 }, "");' },
  { rule: "lib-allowlist", local: "state/x.ts", scope: "client", code: 'import { aggregate } from "../../../../lib/cloudcheck/engine/aggregate"; export const a = aggregate;' },
  { rule: "lib-allowlist", local: "state/x.ts", scope: "client", code: 'import { AwsCollectFile } from "../../../../lib/cloudcheck/contract/collect-schema"; export const a = AwsCollectFile;' },
  { rule: "lib-allowlist", local: "state/x.ts", scope: "client", code: 'import { DEMO_NAME_RE } from "../../../../lib/cloudcheck/contract/normalized"; export const r = DEMO_NAME_RE;' },
  { rule: "lib-allowlist", local: "state/x.ts", scope: "client", code: 'import type { AwsDoors } from "../../../../lib/cloudcheck/contract/normalized"; export type D = AwsDoors;' },
  { rule: "lib-allowlist", local: "state/x.ts", scope: "client", code: 'import * as N from "../../../../lib/cloudcheck/contract/normalized"; export const n = N;' },
  { rule: "lib-allowlist", local: "state/x.ts", scope: "client", code: 'export { demoInputName } from "../../../../lib/cloudcheck/contract/normalized";' },
  { rule: "imports", local: "components/X.tsx", scope: "client", code: 'import clsx from "clsx"; export const c = clsx;' },
  { rule: "imports", local: "components/X.tsx", scope: "client", code: 'import { x } from "../../../flight/lib/x"; export const y = x;' },
  { rule: "R-12/R-13", local: "components/X.tsx", scope: "client", code: "export const f = (v: { full: string }) => v.full;" },
  { rule: "R-12/R-13", local: "components/X.tsx", scope: "client", code: "export const f = ({ masked }: { masked: string }) => masked;" },
  { rule: "env", local: "config.ts", scope: "client", code: "export const v = process.env.NODE_ENV;" },
  { rule: "imports", local: "engine/x.ts", scope: "lib", code: 'import { useState } from "react"; export const u = useState;' },
  { rule: "imports", local: "engine/x.ts", scope: "lib", code: 'import { readFileSync } from "node:fs"; export const r = readFileSync;' },
  { rule: "lib-boundary", local: "engine/x.ts", scope: "lib", code: 'import { a } from "../fixtures/companies"; export const b = a;' },
  { rule: "lib-boundary", local: "engine/x.ts", scope: "lib", code: "export const t = document.title;" },
  // RELEASES.json 예외는 parse/ → collector/RELEASES.json의 import 선언 하나뿐(다른 폴더·다른 collector 파일·다시 내보내기는 위반)
  { rule: "lib-boundary", local: "engine/x.ts", scope: "lib", code: 'import R from "../collector/RELEASES.json"; export const r = R;' },
  { rule: "lib-boundary", local: "parse/x.ts", scope: "lib", code: 'import { SECTION_MARKER_RE } from "../collector/markers"; export const m = SECTION_MARKER_RE;' },
  { rule: "lib-boundary", local: "parse/x.ts", scope: "lib", code: 'import S from "../collector/SHA256SUMS"; export const s = S;' },
  { rule: "lib-boundary", local: "parse/x.ts", scope: "lib", code: 'import A from "../collector/cloudcheck-aws.sh"; export const a = A;' },
  { rule: "lib-boundary", local: "parse/x.ts", scope: "lib", code: 'export { default as R } from "../collector/RELEASES.json";' },
  { rule: "lib-allowlist", local: "state/x.ts", scope: "client", code: 'import R from "../../../../lib/cloudcheck/collector/RELEASES.json"; export const r = R;' },
  { rule: "lib-allowlist", local: "state/x.ts", scope: "client", code: 'import { OTHER } from "../../../../lib/cloudcheck/rules/version"; export const o = OTHER;' },
  { rule: "route-imports", local: "route.ts", scope: "route", code: 'import { x } from "./_client/main"; export const y = x;' },
  { rule: "determinism", local: "engine/x.ts", scope: "lib", code: "export const t = Date.now();" },
  { rule: "determinism", local: "rules/x.ts", scope: "lib", code: "export const d = new Date();" },
  { rule: "determinism", local: "contract/x.ts", scope: "lib", code: "export const r = Math.random();" },
  { rule: "determinism", local: "engine/x.ts", scope: "lib", code: "export const s = Date();" },
];
const GOOD_SAMPLES: readonly { readonly local: string; readonly scope: Scope; readonly code: string }[] = [
  { local: "state/history.ts", scope: "client", code: 'export function go(s: string) { history.pushState({ cc: s }, ""); }' },
  { local: "components/StatusBadge.tsx", scope: "client", code: 'import { StatusIcon } from "./StatusIcon"; export const A = StatusIcon;' },
  { local: "components/MaskedValue.tsx", scope: "client", code: "export const f = (v: { full: string; masked: string }) => v.full + v.masked;" },
  { local: "components/DocLink.tsx", scope: "client", code: 'export const A = (h: string) => <a className="cc-ext" href={h} target="_blank" rel="noopener noreferrer">x</a>;' },
  { local: "components/DownloadLink.tsx", scope: "client", code: 'export function f(u: string) { const a = document.createElement("a"); a.href = u; a.download = "x"; a.click(); }' },
  { local: "components/PasteBox.tsx", scope: "client", code: 'export const A = () => <textarea className="cc-ta cc-paste" spellCheck={false} autoComplete="off" autoCorrect="off" autoCapitalize="off" data-gramm="false" data-gramm_editor="false" data-enable-grammarly="false" />;' },
  { local: "components/X.tsx", scope: "client", code: 'export const A = () => <input type="date" className="cc-in" />;' },
  { local: "components/X.tsx", scope: "client", code: "export const A = (s: string, on: boolean) => <span className={`cc-sb cc-st--${s} ${on ? \"cc-open\" : \"\"}`} />;" },
  { local: "components/X.tsx", scope: "client", code: 'export const A = (k: string) => <div className={k === "open" ? "cc-open" : "cc-closed"} />;' },
  { local: "components/Icon.tsx", scope: "client", code: 'export const A = () => <svg className="cc-ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path className="cc-si__s" d="M0 0" /></svg>;' },
  { local: "state/x.ts", scope: "client", code: 'import { LIMITS } from "../../../../lib/cloudcheck/contract/collect-schema"; export const l = LIMITS.jsonBytes;' },
  { local: "state/x.ts", scope: "client", code: 'import type { ExceptionsFile } from "../../../../lib/cloudcheck/contract/exceptions-schema"; export type E = ExceptionsFile;' },
  { local: "state/x.ts", scope: "client", code: 'import { judge } from "../../../../lib/cloudcheck/engine/judge"; export const j = judge;' },
  { local: "state/x.ts", scope: "client", code: 'import { demoInputName } from "../../../../lib/cloudcheck/contract/normalized"; export const name = demoInputName("C", "aws");' },
  { local: "state/x.ts", scope: "client", code: 'import { type NormalizedInput, demoInputName } from "../../../../lib/cloudcheck/contract/normalized"; export type S = { input: NormalizedInput | null }; export const n = demoInputName;' },
  { local: "state/x.ts", scope: "client", code: 'export function f(e: ClipboardEvent) { return e.clipboardData?.getData("text/plain") ?? ""; }' },
  { local: "state/x.ts", scope: "client", code: 'export function f(d: HTMLDialogElement) { return d.open; }' },
  { local: "state/x.ts", scope: "client", code: 'export function boot() { document.documentElement.setAttribute("data-cc-booted", ""); document.documentElement.classList.add("cc-compact"); }' },
  { local: "engine/x.ts", scope: "lib", code: 'import { z } from "zod"; import type { Report } from "../model/report"; export const s = z.string(); export type R = Report; export const loc = (r: { location: string }) => r.location;' },
  { local: "engine/x.ts", scope: "lib", code: "export const ms = Date.UTC(2026, 9, 19); export const d = new Date(ms); export const iso = d.toISOString();" },
  { local: "engine/x.ts", scope: "lib", code: "const caches = new Map<string, number>(); export const hit = (k: string) => caches.get(k); export type Image = { readonly w: number };" },
  { local: "parse/x.ts", scope: "lib", code: "export const parsedAt = (lastModified: number) => new Date(lastModified).toISOString();" },
  { local: "parse/x.ts", scope: "lib", code: 'import RELEASES from "../collector/RELEASES.json"; export const n = RELEASES.releases.length;' },
  { local: "state/x.ts", scope: "client", code: 'import { RULESET_VERSION } from "../../../../lib/cloudcheck/rules/version"; export const v = RULESET_VERSION;' },
];
describe("가드 자체 검사(위반 샘플은 모두 잡힌다)", () => {
  for (const b of BAD_SAMPLES) {
    it(`[${b.rule}] ${b.local}: ${b.code.slice(0, 70)}`, () => {
      expect(rulesOf(sample(b.local, b.scope, b.code))).toContain(b.rule);
    });
  }
  for (const g of GOOD_SAMPLES) {
    it(`허용: ${g.local}: ${g.code.slice(0, 70)}`, () => {
      expect(scan(sample(g.local, g.scope, g.code)).map((v) => `${v.rule} ${v.what}`)).toEqual([]);
    });
  }
});

/* ───────── 테스트 ───────── */
describe("가드 대상", () => {
  it("검사 대상 파일을 찾았다(_client·라우트는 반드시 있어야 한다)", () => {
    expect(CLIENT_SRC.length).toBeGreaterThan(0);
    expect(ROUTE_SRC.map((s) => s.local).sort()).toEqual(["_serve/headers.ts", "download/route.ts", "route.ts"]);
    expect(CLIENT_SRC.some((s) => s.local === "main.tsx")).toBe(true);
  });
});

describe("R-12 · R-13 HTML 주입 0 · 사용자 데이터 단일 통로", () => {
  it("innerHTML·outerHTML·insertAdjacentHTML·document.write·DOMParser·eval·new Function·문자열 타이머·dangerouslySetInnerHTML 0", () => {
    expect(violations("R-12")).toEqual([]);
  });
  it("DisplayValue.full·masked는 MaskedValue.tsx에서만", () => {
    expect(violations("R-12/R-13")).toEqual([]);
  });
});
describe("R-06 영속 저장 0", () => {
  it("저장소·쿠키·서비스 워커·워커·BroadcastChannel·replaceState·URL/해시 대입·window.name 0", () => {
    expect(violations("R-06")).toEqual([]);
  });
});
describe("R-07(d) 추가 요청 0", () => {
  it("fetch·XHR·WebSocket·EventSource·sendBeacon·import()·new Image·RTCPeerConnection·window.open·location 이동·요청 요소 0", () => {
    expect(violations("R-07")).toEqual([]);
  });
});
describe("R-11 원클릭 복사 0", () => {
  it("navigator.clipboard·execCommand·ClipboardItem·writeText 0", () => {
    expect(violations("R-11")).toEqual([]);
  });
});
describe("R3 · R-04 화면 글자는 카탈로그로만", () => {
  it("_client(i18n·mocks 밖)에 한글 문자열·JSX 글자 0", () => {
    expect(violations("R3")).toEqual([]);
  });
});
describe("디자인 가드(정적)", () => {
  it("G-D1 style prop·.style·setAttribute('style')·insertRule·CSSStyleSheet 0", () => expect(violations("G-D1")).toEqual([]));
  it("G-D2 StatusIcon import는 StatusBadge·DistributionChips·StatusLegend만", () => expect(violations("G-D2")).toEqual([]));
  it("G-D5 href는 DocLink·DownloadLink 관문에서만, target=_blank는 rel=noopener noreferrer", () => expect(violations("G-D5")).toEqual([]));
  it("G-D10 글자 입력칸 7속성(spellCheck·autoComplete·autoCorrect·autoCapitalize·data-gramm·data-gramm_editor·data-enable-grammarly)", () =>
    expect(violations("G-D10")).toEqual([]));
  it("G-D15 클래스 이름은 전부 cc- 접두(className·classList)", () => expect(violations("G-D15")).toEqual([]));
  it("G-D22 SVG: width·height·fill·stroke·style 속성 0, svg에 aria-hidden=true·focusable=false", () => expect(violations("G-D22")).toEqual([]));
  it("G-D28 pushState는 state/history.ts에서 ({ cc: ScreenId }, \"\") 모양으로만", () => expect(violations("G-D28")).toEqual([]));
});
describe("경계", () => {
  it("_client → lib 값 import는 허용 목록만(방향서 §3 규칙 4 + X11: LIMITS·EXCEPTION_MAX_DAYS·rg-queries)", () => expect(violations("lib-allowlist")).toEqual([]));
  it("_client는 react·react-dom·_client·lib만, lib 5폴더는 zod·5폴더 안만 import", () => expect(violations("imports")).toEqual([]));
  it("lib 5폴더는 React·DOM·node:* 0, 5폴더 밖(fixtures·collector·qa·src/app) import 0 — 예외 1건: parse/ → collector/RELEASES.json", () => expect(violations("lib-boundary")).toEqual([]));
  it("라우트·헤더 모듈은 _generated·_serve만 import", () => expect(violations("route-imports")).toEqual([]));
  it("process.env 0(env 드리프트 해당 없음)", () => expect(violations("env")).toEqual([]));
  it("engine·rules·contract는 Date.now·인자 없는 new Date()·Math.random·performance.now·crypto 난수 0(INV-9 — 백엔드 스캔과 같은 규칙)", () => expect(violations("determinism")).toEqual([]));
  it("규칙 표에 없는 위반 종류가 생기지 않았다", () => {
    const known = new Set(["R-12", "R-12/R-13", "R-06", "R-07", "R-11", "R3", "G-D1", "G-D2", "G-D5", "G-D10", "G-D15", "G-D22", "G-D28", "lib-allowlist", "imports", "lib-boundary", "route-imports", "env", "determinism"]);
    expect(V.filter((v) => !known.has(v.rule))).toEqual([]);
  });
});

describe("파일 배치(방향서 §2-2·§3, G5)", () => {
  it("/cloudcheck에 page·layout 파일이 없다(Route Handler만. _로 시작하는 private 폴더는 라우팅되지 않으므로 제외)", () => {
    const found = listFiles(APP, /[\\/](page|layout|template|loading|error|not-found)\.(t|j)sx?$/).filter((f) => !posix(path.relative(APP, f)).split("/").some((seg) => seg.startsWith("_")));
    expect(found.map(relRepo)).toEqual([]);
  });
  it("next.config·middleware를 만들지 않았다", () => {
    const names = ["next.config.js", "next.config.mjs", "next.config.ts", "next.config.cjs", "middleware.ts", "middleware.js", "src/middleware.ts", "src/middleware.js"];
    expect(names.filter((n) => existsSync(path.join(PATHS.repo, n)))).toEqual([]);
  });
  it("src/ 어디에도 serviceWorker가 없다(같은 origin의 서비스 워커 차단 — G5)", () => {
    const hits = listFiles(path.join(PATHS.repo, "src"), /\.(t|j)sx?$|\.mjs$/)
      .filter((f) => !f.startsWith(path.join(APP, "_build")))
      .filter((f) => readFileSync(f, "utf8").includes("serviceWorker"));
    expect(hits.map(relRepo)).toEqual([]);
  });
  it("S1 스파이크 스텁이 남아 있지 않다", () => {
    for (const s of ROUTE_SRC) expect(s.sf.text.includes("S1 SPIKE"), s.rel).toBe(false);
  });
});

/* ───────── NormalizedInput 내용 접근 0(백엔드팀장 제안 — 타입 검사기 사용) ─────────
 * UI는 buildInput()이 준 input(NormalizedInput)을 상태에 보관했다가 judge()·maskedCopy()에 그대로 넘긴다(contract/NORMALIZED.md §1).
 * _client에서 그 타입(contract/normalized.ts에 선언된 타입)의 값에 대해 속성 접근·구조 분해·전개·for-in·Object.keys류·JSON.stringify를 하면 실패한다.
 * 구문만으로는 변수의 타입을 알 수 없어 TypeScript Program(레포 tsconfig 옵션)을 만들어 검사한다. 자체 검사 샘플은 가상 파일로 같은 Program에 넣는다. */
const NORMALIZED_SUFFIX = "/src/lib/cloudcheck/contract/normalized.ts";
const PROBE_IMPORT = 'import type { NormalizedInput } from "../../../lib/cloudcheck/contract/normalized";\n';
const NORMALIZED_PROBES: readonly { readonly name: string; readonly bad: boolean; readonly code: string }[] = [
  { name: "속성 읽기", bad: true, code: "export const f = (i: NormalizedInput) => i.cloud;" },
  { name: "선택적 체이닝", bad: true, code: "export const f = (i: NormalizedInput | null) => i?.mode;" },
  { name: "대괄호 접근", bad: true, code: 'export const f = (i: NormalizedInput) => i["inputs"];' },
  { name: "구조 분해(변수)", bad: true, code: "export const f = (i: NormalizedInput) => { const { doors } = i; return doors; };" },
  { name: "구조 분해(매개변수)", bad: true, code: "export const f = ({ identity }: NormalizedInput) => identity;" },
  { name: "전개", bad: true, code: "export const f = (i: NormalizedInput) => ({ ...i });" },
  { name: "JSON.stringify", bad: true, code: "export const f = (i: NormalizedInput) => JSON.stringify(i);" },
  { name: "Object.keys", bad: true, code: "export const f = (i: NormalizedInput) => Object.keys(i);" },
  { name: "for-in", bad: true, code: "export function f(i: NormalizedInput) { const out: string[] = []; for (const k in i) out.push(k); return out; }" },
  { name: "보관·전달은 허용", bad: false, code: "export const keep = (i: NormalizedInput | null): readonly (NormalizedInput | null)[] => [i];\nexport const pass = (i: NormalizedInput, use: (x: NormalizedInput) => number) => use(i);" },
  { name: "buildInput 결과 객체의 input 꺼내기는 허용", bad: false, code: "export const f = (r: { readonly ok: true; readonly input: NormalizedInput }) => r.input;" },
  { name: "demoInputName 결과(문자열)는 허용", bad: false, code: 'import { demoInputName } from "../../../lib/cloudcheck/contract/normalized";\nexport const len = demoInputName("C", "aws").length;' },
];
const probeAbs = (i: number): string => path.join(CLIENT, `zz-guard-probe-${i}.ts`);

function createClientProgram(): ts.Program {
  const cfg = ts.readConfigFile(path.join(PATHS.repo, "tsconfig.json"), ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(cfg.config, ts.sys, PATHS.repo);
  const options: ts.CompilerOptions = { ...parsed.options, noEmit: true, incremental: false, tsBuildInfoFile: undefined };
  const virtual = new Map<string, string>(NORMALIZED_PROBES.map((p, i) => [path.resolve(probeAbs(i)), PROBE_IMPORT + p.code]));
  const host = ts.createCompilerHost(options, true);
  const getSourceFile = host.getSourceFile.bind(host);
  const fileExists = host.fileExists.bind(host);
  const readFile = host.readFile.bind(host);
  host.getSourceFile = (fileName, lang, onError, fresh) => {
    const text = virtual.get(path.resolve(fileName));
    return text !== undefined ? ts.createSourceFile(fileName, text, lang, true) : getSourceFile(fileName, lang, onError, fresh);
  };
  host.fileExists = (f) => virtual.has(path.resolve(f)) || fileExists(f);
  host.readFile = (f) => virtual.get(path.resolve(f)) ?? readFile(f);
  return ts.createProgram({ rootNames: [...CLIENT_SRC.map((s) => s.abs), ...virtual.keys()], options, host });
}

function isNormalizedType(t: ts.Type): boolean {
  const parts = t.isUnionOrIntersection() ? t.types : [t];
  return parts.some((p) => {
    const sym = p.aliasSymbol ?? p.getSymbol();
    return (sym?.declarations ?? []).some((d) => posix(d.getSourceFile().fileName).endsWith(NORMALIZED_SUFFIX));
  });
}

function scanNormalizedAccess(sf: ts.SourceFile, checker: ts.TypeChecker): string[] {
  const out: string[] = [];
  const flag = (node: ts.Node, what: string): void => {
    out.push(`${posix(path.relative(PATHS.repo, sf.fileName))}:${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1} ${what} — ${node.getText(sf).replace(/\s+/g, " ").slice(0, 80)}`);
  };
  const typeOf = (n: ts.Node): ts.Type => checker.getTypeAtLocation(n);
  walk(sf, (n) => {
    if ((ts.isPropertyAccessExpression(n) || ts.isElementAccessExpression(n)) && isNormalizedType(typeOf(n.expression))) flag(n, "NormalizedInput 속성 접근");
    if (ts.isVariableDeclaration(n) && ts.isObjectBindingPattern(n.name) && n.initializer !== undefined && isNormalizedType(typeOf(n.initializer))) flag(n, "NormalizedInput 구조 분해");
    if (ts.isParameter(n) && (ts.isObjectBindingPattern(n.name) || ts.isArrayBindingPattern(n.name)) && isNormalizedType(typeOf(n))) flag(n, "NormalizedInput 구조 분해(매개변수)");
    if ((ts.isSpreadAssignment(n) || ts.isSpreadElement(n) || ts.isJsxSpreadAttribute(n)) && isNormalizedType(typeOf(n.expression))) flag(n, "NormalizedInput 전개");
    if (ts.isForInStatement(n) && isNormalizedType(typeOf(n.expression))) flag(n, "NormalizedInput for-in");
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
      const obj = n.expression.expression.getText(sf);
      const name = n.expression.name.text;
      const inspects = (obj === "Object" && ["keys", "values", "entries", "assign", "getOwnPropertyNames", "fromEntries"].includes(name)) || (obj === "JSON" && name === "stringify");
      if (inspects && n.arguments.some((a) => isNormalizedType(typeOf(a)))) flag(n, `NormalizedInput을 ${obj}.${name}로 열어 봄`);
    }
  });
  return out;
}

describe("NormalizedInput 내용 접근 0(백엔드팀장 제안, 타입 검사기)", () => {
  const program = createClientProgram();
  const checker = program.getTypeChecker();
  it("_client(테스트·목업 제외)에서 NormalizedInput의 속성 접근·구조 분해·전개·열거·직렬화 0 — 보관했다가 judge·maskedCopy에 그대로 넘긴다", () => {
    const hits = CLIENT_SRC.filter((s) => !s.local.startsWith("mocks/")).flatMap((s) => {
      const sf = program.getSourceFile(s.abs);
      return sf === undefined ? [`${s.rel}: Program에 없음`] : scanNormalizedAccess(sf, checker);
    });
    expect(hits).toEqual([]);
  });
  NORMALIZED_PROBES.forEach((p, i) => {
    it(`자체 검사 — ${p.bad ? "잡혀야 함" : "허용"}: ${p.name}`, () => {
      const sf = program.getSourceFile(path.resolve(probeAbs(i)));
      expect(sf, "가상 파일이 Program에 들어갔다").toBeDefined();
      const hits = sf === undefined ? [] : scanNormalizedAccess(sf, checker);
      if (p.bad) expect(hits.length, p.code).toBeGreaterThan(0);
      else expect(hits, p.code).toEqual([]);
    });
  });
  it("자체 검사 샘플이 컴파일 오류 없이 타입을 얻었다(오류 타입으로 통과하는 거짓 음성 방지)", () => {
    const diags = NORMALIZED_PROBES.flatMap((_, i) => {
      const sf = program.getSourceFile(path.resolve(probeAbs(i)));
      return sf === undefined ? [] : program.getSemanticDiagnostics(sf).map((d) => `probe-${i}: ${ts.flattenDiagnosticMessageText(d.messageText, " ")}`);
    });
    expect(diags).toEqual([]);
  });
});

/* ───────── 카탈로그 키 리터럴 ───────── */
describe("코드에 적은 카탈로그 키가 카탈로그에 있다", () => {
  const literal: { key: string; at: string }[] = [];
  for (const src of CLIENT_SRC) {
    if (src.local.startsWith("i18n/ko/") || src.local.startsWith("mocks/")) continue;
    walk(src.sf, (n) => {
      if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && KEY_RE.test(n.text)) literal.push({ key: n.text, at: at(src, n) });
    });
  }
  it("C·S 네임스페이스 키 리터럴이 모두 있다(t() 밖 — labelKey 같은 props — 도 잡는다)", () => {
    const missing = literal.filter((l) => fileOfKey(l.key) !== "engine" && !hasKey(l.key)).map((l) => `${l.at} ${l.key}`);
    expect(missing).toEqual([]);
  });
  if (engineCatalogMerged()) {
    it("E 네임스페이스 키 리터럴이 모두 있다", () => {
      const missing = literal.filter((l) => fileOfKey(l.key) === "engine" && !hasKey(l.key)).map((l) => `${l.at} ${l.key}`);
      expect(missing).toEqual([]);
    });
  } else {
    it.todo("E 네임스페이스 키 리터럴 검사 — E 카탈로그(rules/i18n/ko.ts) 병합 뒤 켜진다");
  }
});

/* ───────── CSS 원본(디자인 §4-1 금지 목록, G-D6·14·16·17·26) ───────── */
describe("CSS 원본", () => {
  const files = listFiles(CLIENT, /\.css$/);
  if (files.length === 0) {
    it.todo("CSS 원본 대기(styles/**·components/*.css — 컴포넌트개발자, screens.css — 페이지개발자). 생기면 아래 검사가 켜진다");
    return;
  }
  const strip = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, "");
  const local = (f: string): string => posix(path.relative(CLIENT, f));
  it("CR·'</style'·@import·url(·expression( 0(G-D26)", () => {
    const bad: string[] = [];
    for (const f of files) {
      const raw = readFileSync(f, "utf8");
      for (const [re, why] of [[/\r/, "CR"], [/<\/style/i, "</style"], [/@import/i, "@import"], [/url\(/i, "url("], [/expression\(/i, "expression("]] as const) {
        if (re.test(raw)) bad.push(`${local(f)}: ${why}`);
      }
    }
    expect(bad).toEqual([]);
  });
  it("16진 색은 styles/tokens.css에만(print.css의 #000·#fff 예외 — G-D16)", () => {
    const bad: string[] = [];
    for (const f of files) {
      const l = local(f);
      if (l === "styles/tokens.css") continue;
      for (const m of strip(readFileSync(f, "utf8")).matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
        if (l === "styles/print.css" && /^#(000|fff)$/i.test(m[0])) continue;
        bad.push(`${l}: ${m[0]}`);
      }
    }
    expect(bad).toEqual([]);
  });
  it("prefers-color-scheme는 tokens.css에만, 그것도 'screen and'로만(G-D17)", () => {
    const bad: string[] = [];
    for (const f of files) {
      const css = strip(readFileSync(f, "utf8"));
      for (const m of css.matchAll(/prefers-color-scheme/g)) {
        const before = css.slice(Math.max(0, (m.index ?? 0) - 40), m.index ?? 0);
        if (local(f) !== "styles/tokens.css" || !/screen\s+and\s*\($/.test(before)) bad.push(`${local(f)}: ${before.trim()}prefers-color-scheme`);
      }
    }
    expect(bad).toEqual([]);
  });
  it("!important는 base.css·print.css에서만", () => {
    const bad = files.filter((f) => !["styles/base.css", "styles/print.css"].includes(local(f)) && /!important/.test(strip(readFileSync(f, "utf8")))).map(local);
    expect(bad).toEqual([]);
  });
  it("선택자의 클래스는 전부 cc- 접두(G-D15)", () => {
    const bad: string[] = [];
    for (const f of files) {
      const css = strip(readFileSync(f, "utf8"));
      for (const m of css.matchAll(/([^{}]+)\{/g)) {
        const sel = (m[1] ?? "").trim();
        if (sel.startsWith("@") || /^(from|to|\d+%)/.test(sel)) continue;
        for (const c of sel.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) if (!(c[1] ?? "").startsWith("cc-")) bad.push(`${local(f)}: ${sel} → .${c[1]}`);
      }
    }
    expect(bad).toEqual([]);
  });
  it("user-select:all은 .cc-cmd--kql .cc-cmd__pre · .cc-hash에서만(G-D6)", () => {
    const allowed = new Set([".cc-cmd--kql .cc-cmd__pre", ".cc-hash"]);
    const bad: string[] = [];
    for (const f of files) {
      const css = strip(readFileSync(f, "utf8"));
      for (const m of css.matchAll(/user-select\s*:\s*all/g)) {
        const open = css.lastIndexOf("{", m.index ?? 0);
        const prev = Math.max(css.lastIndexOf("}", open), css.lastIndexOf("{", open - 1));
        for (const sel of css.slice(prev + 1, open).split(",")) if (!allowed.has(sel.trim().replace(/\s+/g, " "))) bad.push(`${local(f)}: ${sel.trim()}`);
      }
    }
    expect(bad).toEqual([]);
  });
  const print = files.find((f) => local(f) === "styles/print.css");
  if (print === undefined) it.todo("print.css 대기 — 생기면 '인쇄 기본 = 마스킹(.cc-mask-short{display:inline})' 검사가 켜진다(G-D14)");
  else {
    it("인쇄 기본은 마스킹: @media print 안에 .cc-mask-short{display:inline}(G-D14)", () => {
      const css = strip(readFileSync(print, "utf8"));
      const after = css.slice(css.indexOf("@media print"));
      expect(css.includes("@media print")).toBe(true);
      expect(/\.cc-mask-short[^{}]*\{\s*display\s*:\s*inline\s*\}/.test(after)).toBe(true);
    });
  }
});
