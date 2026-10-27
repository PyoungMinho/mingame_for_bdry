// src/app/cloudcheck/_build/generated.test.ts — 생성물 동기·무결성·격리 검사(번들 층 ②, G5 로컬 몫). 소유: 프론트팀장.
//
// 주의(방향서 §1-2 N): STEP 4 중 _client·lib를 고치면 '동기' 검사가 실패하는 것이 정상이다. 팀원은 자기 경로 테스트
// (npx vitest run <경로>)로 작업하고, 통합 시점(D4·D8·QA 인계 전)에 프론트팀장이 재생성한다. 배포 게이트에서는 반드시 초록이어야 한다.
// 아직 없는 입력(수집기·체험 데이터·E 카탈로그·config·CSS)은 it.todo로 표시한다 — 입력이 생기면 같은 자리의 검사가 자동으로 켜진다.
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";
import { gzipSync } from "node:zlib";
import { beforeAll, describe, expect, it } from "vitest";
import { LINK_HOSTS } from "../../../lib/cloudcheck/model/report";
import { SCRIPT_NOTES } from "../_client/config";
import { engineCatalogMerged, lookup } from "../_client/i18n/index";
import { BLOCK, CLOUDS, DEMO_SETS, SHELL } from "../_client/shell";
import { PAGE } from "../_generated/page";
import { headerCsp, metaCsp } from "../_serve/headers";
import { COLLECTOR_FILES, DEFAULT_VERSION, generate, loadEsbuild, PATHS, renderPageModule, type GenerateResult } from "./generate.mjs";
import { DOWNLOAD_PATH, esc, FAVICON_HREF, renderHtml, STATIC_KEYS, THEME_COLOR } from "./template.mjs";

const KiB = 1024;
/**
 * 예산. 실패 기준은 HTML 원본 900 KiB · gzip 260 KiB(방향서 §2-3 그대로 — 시험이 강제). 나머지는 보고용 목표(디자인 X1: CSS는 esbuild 압축 후 gzip 전 바이트).
 * 보고용 목표는 STEP 5 기획팀장 결정(docs/planning/cloudcheck-qa-decisions.md §7·§8-B, 2026-10-20)으로 D4 실측에 맞춰 갱신: HTML 880 · gzip 230 · JS 720 · CSS 34 · 수집기 48 · 체험 100.
 * 넘칠 때 순서(같은 결정): ① 문구 순증 정지·중복 정리 → ② (조건부) 원본 실패선 960 → ③ 체험 데이터 압축 → ④ Preact(v1.1, PM 승인). gzip 260은 올리지 않는다.
 */
const BUDGET = { htmlTarget: 880 * KiB, htmlFail: 900 * KiB, gzipTarget: 230 * KiB, gzipFail: 260 * KiB, js: 720 * KiB, css: 34 * KiB, collectors: 48 * KiB, demo: 100 * KiB };
/** 번들 금지 토큰(React·zod 번들에 없는 것만 — 실측 2026-10-19). innerHTML·postMessage·location.href·clipboard(Data)·.style.은 React 안에 있어 AST 가드(층 ①)가 맡는다 */
const BUNDLE_BANNED = [
  "localStorage", "sessionStorage", "indexedDB", "cookieStore", "document.cookie", "caches.", "serviceWorker", "SharedWorker", "new Worker",
  "importScripts", "BroadcastChannel", "showSaveFilePicker", "window.name", "replaceState",
  "sendBeacon", "XMLHttpRequest", "WebSocket", "EventSource", "RTCPeerConnection", "fetch(", "import(", "new Image",
  "execCommand", "navigator.clipboard", "ClipboardItem",
  "eval(", "new Function", "insertAdjacentHTML", "outerHTML", "document.write", "createContextualFragment", "srcdoc", "DOMParser",
  "window.open", "location.assign", "location.replace",
] as const;
/** 번들 안 URL 허용 호스트: React 내부(이름공간·오류 안내) + 링크 허용 목록(방향서 §5-2 LINK_HOSTS) */
const URL_HOSTS: ReadonlySet<string> = new Set(["www.w3.org", "reactjs.org", ...LINK_HOSTS]);
/**
 * 번들 입력으로 허용하는 경로(그 밖의 앱 코드·테스트 도구가 섞이면 실패).
 * collector/RELEASES.json은 parse/normalize.ts가 import하는 릴리스 기록(메인 세션 결정 — guards.test.ts의 lib-boundary 예외와 같은 1건)
 */
const INPUT_ALLOW = [
  /^src\/app\/cloudcheck\/_client\//,
  /^src\/lib\/cloudcheck\/(model|contract|parse|engine|rules)\//,
  /^src\/lib\/cloudcheck\/collector\/RELEASES\.json$/,
  /^node_modules\/(react|react-dom|scheduler|zod)\//,
];
/** 운영 번들에 들어가면 안 되는 _client 파일(목업·테스트 도구). 엔진 연결은 state/deps.real.ts 하나다(D4 통합) */
const INPUT_DENY = [/^src\/app\/cloudcheck\/_client\/mocks\//, /^src\/app\/cloudcheck\/_client\/state\/deps\.(mock|unwired)\.ts$/, /__tests__/];

const sha256hex = (s: string | Buffer): string => createHash("sha256").update(s).digest("hex");
const sha256b64 = (s: string): string => createHash("sha256").update(s, "utf8").digest("base64");

/** 실행 스크립트(type 없는 <script>) 본문들 */
function execScripts(html: string): string[] {
  return [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1] ?? "");
}
function styles(html: string): string[] {
  return [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1] ?? "");
}
/** 데이터 블록 id → { type, text } */
function dataBlocks(html: string): Map<string, { type: string; text: string }> {
  const out = new Map<string, { type: string; text: string }>();
  for (const m of html.matchAll(/<script type="([^"]+)" id="([^"]+)">([\s\S]*?)<\/script>/g)) out.set(m[2] ?? "", { type: m[1] ?? "", text: m[3] ?? "" });
  return out;
}
/** 스크립트·스타일 본문을 비운 마크업 */
function markupOnly(html: string): string {
  return html.replace(/(<script\b[^>]*>)[\s\S]*?(<\/script>)/g, "$1$2").replace(/(<style>)[\s\S]*?(<\/style>)/g, "$1$2");
}

let r: GenerateResult;
beforeAll(async () => {
  r = await generate();
}, 60_000);

describe("동기(배포 게이트에서는 반드시 초록)", () => {
  it("커밋된 _generated/page.ts = 지금 소스로 만든 결과", () => {
    const committed = readFileSync(PATHS.generated, "utf8");
    const fresh = renderPageModule(r.page);
    const hint = "재생성 필요: node src/app/cloudcheck/_build/generate.mjs (프론트팀장, 통합 시점). STEP 4 팀원 작업 중 실패는 정상(방향서 §1-2 N).";
    expect({ version: PAGE.version, sha256: PAGE.sha256, scriptHash: PAGE.scriptHash, styleHash: PAGE.styleHash, bytes: PAGE.bytes }, hint).toEqual({
      version: r.page.version, sha256: r.page.sha256, scriptHash: r.page.scriptHash, styleHash: r.page.styleHash, bytes: r.page.bytes,
    });
    expect(fresh === committed, hint).toBe(true);
  });
  it("esbuild 버전이 생성 때와 같다(바뀌면 재생성 = 새 릴리스)", () => {
    expect(PAGE.esbuildVersion).toBe(loadEsbuild().version);
  });
  it("생성은 결정적이다(같은 입력 두 번 = 같은 바이트)", async () => {
    const again = await generate();
    expect(again.page.sha256).toBe(r.page.sha256);
  }, 60_000);
});

describe("해시 4중 일치(G5)", () => {
  it("문서: sha256(PAGE.html) = PAGE.sha256, 바이트 수 = PAGE.bytes", () => {
    expect(sha256hex(Buffer.from(PAGE.html, "utf8"))).toBe(PAGE.sha256);
    expect(Buffer.byteLength(PAGE.html, "utf8")).toBe(PAGE.bytes);
  });
  it("스크립트·스타일: 다시 계산한 값 = 저장된 값 = meta CSP 안 = 헤더 CSP 안", () => {
    const [script] = execScripts(PAGE.html);
    const [style] = styles(PAGE.html);
    expect(sha256b64(script ?? "")).toBe(PAGE.scriptHash);
    expect(sha256b64(style ?? "")).toBe(PAGE.styleHash);
    const meta = /<meta http-equiv="Content-Security-Policy" content="([^"]+)">/.exec(PAGE.html)?.[1] ?? "";
    expect(meta).toBe(metaCsp(PAGE));
    for (const csp of [meta, headerCsp(PAGE)]) {
      expect(csp).toContain(`script-src 'sha256-${PAGE.scriptHash}'`);
      expect(csp).toContain(`style-src 'sha256-${PAGE.styleHash}'`);
    }
  });
  it("방금 만든 결과도 자기 해시와 맞는다", () => {
    expect(sha256b64(r.js)).toBe(r.page.scriptHash);
    expect(sha256b64(r.css)).toBe(r.page.styleHash);
  });
});

describe("인라인 스크립트·스타일 위생", () => {
  it("실행 스크립트 1개 · 스타일 1개", () => {
    expect(execScripts(PAGE.html)).toHaveLength(1);
    expect(styles(PAGE.html)).toHaveLength(1);
  });
  it("스크립트에 '<!--'·'<script'·'</script'·CR·NUL 0, 컴파일된다", () => {
    const [js = ""] = execScripts(PAGE.html);
    for (const re of [/<!--/, /<script/i, /<\/script/i, /\r/, /\0/]) expect(re.test(js), String(re)).toBe(false);
    expect(() => new vm.Script(js)).not.toThrow();
  });
  it("CSS에 '</style'·CR·NUL·@import·url( 0", () => {
    const [css = ""] = styles(PAGE.html);
    for (const re of [/<\/style/i, /\r/, /\0/, /@import/i, /url\(/i]) expect(re.test(css), String(re)).toBe(false);
  });
  it("React 라이선스 고지가 스크립트 끝에 남는다(legalComments: eof)", () => {
    const [js = ""] = execScripts(PAGE.html);
    expect(js).toContain("/*! Bundled license information:");
    expect(js).toContain("@license React");
  });
});

describe("HTML 구조(템플릿 순서 — 방향서 §2-2, 디자인 X12·G-D27)", () => {
  it("머리 순서: charset → meta CSP → referrer → dns-prefetch → viewport → title → color-scheme → theme-color → icon → style", () => {
    const h = PAGE.html;
    expect(h.startsWith('<!doctype html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n<meta http-equiv="Content-Security-Policy" ')).toBe(true);
    const order = [
      '<meta charset="utf-8">',
      '<meta http-equiv="Content-Security-Policy"',
      '<meta name="referrer" content="no-referrer">',
      '<meta http-equiv="x-dns-prefetch-control" content="off">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      "<title>",
      '<meta name="color-scheme" content="light dark">',
      `<meta name="theme-color" media="(prefers-color-scheme: light)" content="${THEME_COLOR.light}">`,
      `<meta name="theme-color" media="(prefers-color-scheme: dark)" content="${THEME_COLOR.dark}">`,
      `<link rel="icon" href="${FAVICON_HREF}">`,
      "<style>",
      "</head>",
      `<div id="${SHELL.static}">`,
      "<noscript>",
      `<div id="${SHELL.app}"></div>`,
      `<script type="text/plain" id="${BLOCK.collector("aws")}">`,
      "<script>",
      "</body>",
    ];
    let at = -1;
    for (const piece of order) {
      const i = h.indexOf(piece, at + 1);
      expect(i, `순서: ${piece}`).toBeGreaterThan(at);
      at = i;
    }
    expect(h.endsWith("</script>\n</body>\n</html>\n")).toBe(true);
  });
  it("<title> = cc.start.title, description = cc.start.tagline(카탈로그가 단일 원천)", () => {
    expect(PAGE.html).toContain(`<title>${esc(lookup("cc.start.title") ?? "")}</title>`);
    expect(PAGE.html).toContain(`<meta name="description" content="${esc(lookup("cc.start.tagline") ?? "")}">`);
  });
  it("정적 셸 키가 모두 카탈로그에 있고 그 글자가 정적 HTML에 들어간다", () => {
    const missing = STATIC_KEYS.filter((k) => lookup(k) === undefined);
    expect(missing, "정적 셸 키는 프론트팀장이 카탈로그에 넣어 두었다. 지웠다면 되살리거나 template.mjs와 함께 바꾼다").toEqual([]);
    const markup = markupOnly(PAGE.html);
    for (const k of STATIC_KEYS) expect(markup, k).toContain(esc(lookup(k) ?? ""));
  });
  it("부팅 대체 안내(.cc-boot)와 <noscript>에 스크립트 없이 동작하는 오프라인판 링크", () => {
    expect(PAGE.html).toMatch(new RegExp(`<div id="${SHELL.boot}" class="cc-boot cc-banner cc-banner--strong" role="note">`));
    expect(PAGE.html.split(`href="${DOWNLOAD_PATH}" download`).length - 1).toBe(2);
  });
  it("페이지 자신의 해시를 HTML에 적지 않는다(디자인 Q1)", () => {
    expect(PAGE.html.includes(PAGE.sha256)).toBe(false);
  });
});

describe("템플릿 단위(커밋된 생성물과 무관 — 재생성 전에도 검사)", () => {
  // STEP 5 QA CC-QA-22: file://로 연 오프라인판에서 /cloudcheck/download는 없는 파일이 된다. 정적 셸은 스크립트 없이 숨길 수 없으므로 링크 바로 아래에 글로 알린다
  it("[CC-QA-22] 부팅 대체 안내와 <noscript>의 오프라인판 링크 바로 뒤에 '이미 파일로 연 오프라인판' 안내 줄이 있다", () => {
    const html = renderHtml({ js: "void 0;", css: "", metaCsp: "default-src 'none'", text: (k) => lookup(k) ?? null, ids: SHELL, blocks: [] });
    const note = lookup("cc.boot.download-note") ?? "";
    expect(note).not.toBe("");
    const pair = `<a class="cc-link" href="${DOWNLOAD_PATH}" download>${esc(lookup("cc.boot.download") ?? "")}</a></p><p class="cc-small">${esc(note)}</p>`;
    expect(html.split(pair).length - 1).toBe(2);
    expect(STATIC_KEYS).toContain("cc.boot.download-note");
  });
});

describe("마크업 금지(스크립트·스타일 본문 제외)", () => {
  const markup = markupOnly(PAGE.html);
  const withoutIcon = markup.replace(`<link rel="icon" href="${FAVICON_HREF}">`, "");
  it("외부 URL·style 속성·이벤트 속성·src= 0", () => {
    expect(withoutIcon).not.toMatch(/https?:/i); // 'http-equiv' 속성 이름은 URL이 아니다
    expect(withoutIcon).not.toMatch(/="\/\//); // 프로토콜 상대 URL
    expect(withoutIcon).not.toMatch(/\sstyle=/i);
    expect(withoutIcon).not.toMatch(/\son[a-z]+=/i);
    expect(withoutIcon).not.toMatch(/\ssrc=/i);
    expect(withoutIcon).not.toMatch(/<(img|iframe|frame|object|embed|base|form|video|audio|source|svg|math)\b/i);
  });
  it("<link>는 파비콘 1개, href는 파비콘(data:)과 오프라인판 링크뿐", () => {
    expect(markup.match(/<link\b/g)).toHaveLength(1);
    const hrefs = [...markup.matchAll(/\shref="([^"]*)"/g)].map((m) => m[1]);
    expect(new Set(hrefs)).toEqual(new Set([FAVICON_HREF, DOWNLOAD_PATH]));
    expect(FAVICON_HREF.startsWith("data:image/svg+xml,")).toBe(true);
    expect([...FAVICON_HREF.matchAll(/https?:\/\/([^/'"]+)/g)].map((m) => m[1])).toEqual(["www.w3.org"]);
  });
  it("레포 절대경로·폴더 이름이 없다", () => {
    // 'file:///'(절대 파일 URL)만 막는다. AWS CLI의 파일 인자 문법 'file://<경로>'(AWS-KEY-4 고치는 법의 --policy-document)는 명령 내용이다
    for (const s of ["/Users/", "team_makes", "무제 폴더", "file:///"]) {
      expect(PAGE.html.includes(s), s).toBe(false);
      expect(readFileSync(PATHS.generated, "utf8").includes(s), `page.ts: ${s}`).toBe(false);
    }
  });
});

describe("번들(층 ②)", () => {
  const [js = ""] = execScripts(PAGE.html);
  it("금지 토큰 0", () => {
    const hits = BUNDLE_BANNED.filter((tok) => js.includes(tok));
    expect(hits).toEqual([]);
  });
  it("pushState는 번들 안에 최대 1곳(state/history.ts 관문 — 방향서 §2-4)", () => {
    expect(js.split("pushState").length - 1).toBeLessThanOrEqual(1);
  });
  it("URL 호스트가 허용 목록 안, http:는 w3.org 이름공간만", () => {
    const urls = [...js.matchAll(/https?:\/\/[^\s"'`)\\<>]+/g)].map((m) => m[0]);
    for (const u of urls) {
      const host = new URL(u).host;
      expect(URL_HOSTS.has(host), u).toBe(true);
      if (u.startsWith("http:")) expect(host, u).toBe("www.w3.org");
    }
  });
  it("번들 입력이 _client · lib 5폴더(+ RELEASES.json 1건) · react·react-dom·scheduler·zod 안에만 있다", () => {
    const outside = r.inputs.filter((p) => !INPUT_ALLOW.some((re) => re.test(p)) || /\.test\.|\.typetest\./.test(p));
    expect(outside).toEqual([]);
  });
  it("배포 게이트: 실제 엔진(state/deps.real.ts)이 연결돼 있고 목업·미연결 자리표시는 번들에 없다", () => {
    expect(r.inputs.filter((p) => INPUT_DENY.some((re) => re.test(p)))).toEqual([]);
    for (const p of ["src/app/cloudcheck/_client/state/deps.real.ts", "src/lib/cloudcheck/engine/judge.ts", "src/lib/cloudcheck/parse/recognize.ts", "src/lib/cloudcheck/rules/catalog.ts", "src/lib/cloudcheck/rules/i18n/ko.ts"]) {
      expect(r.inputs, p).toContain(p);
    }
  });
});

describe("크기 예산(방향서 §2-3 — 실패 기준은 HTML 원본·gzip만)", () => {
  it("HTML 원본 900 KiB 이하 · gzip 260 KiB 이하", () => {
    expect(PAGE.bytes).toBeLessThanOrEqual(BUDGET.htmlFail);
    expect(gzipSync(Buffer.from(PAGE.html, "utf8"), { level: 9 }).length).toBeLessThanOrEqual(BUDGET.gzipFail);
  });
  it("보고: 목표 대비 실측(G-D24 CSS 포함)", () => {
    const s = r.sizes;
    const row = (name: string, n: number, target: number): string => `${name.padEnd(10)} ${(n / KiB).toFixed(1).padStart(7)} KiB / 목표 ${(target / KiB).toFixed(0)} KiB${n > target ? "  ← 목표 초과" : ""}`;
    console.info(
      ["[cloudcheck 예산]", row("HTML", s.html, BUDGET.htmlTarget), row("HTML gzip", s.htmlGzip, BUDGET.gzipTarget), row("JS", s.js, BUDGET.js), row("CSS", s.css, BUDGET.css), row("수집기", s.collectors, BUDGET.collectors), row("체험", s.demo, BUDGET.demo)].join("\n"),
    );
    expect(s.html).toBe(r.page.bytes);
  });
});

describe("데이터 블록", () => {
  const blocks = dataBlocks(PAGE.html);
  it("블록 id·type이 계약(_client/shell.ts)과 같고 순서가 고정이다", () => {
    const ids = [...blocks.keys()];
    expect(ids).toEqual([
      ...CLOUDS.map((c) => BLOCK.collector(c)),
      BLOCK.collectors,
      BLOCK.releases,
      ...CLOUDS.flatMap((c) => DEMO_SETS.map((s) => BLOCK.demo(c, s))),
    ]);
    for (const c of CLOUDS) expect(blocks.get(BLOCK.collector(c))?.type).toBe("text/plain");
    for (const id of ids.filter((x) => !x.startsWith("cc-collector-"))) expect(blocks.get(id)?.type, id).toBe("application/json");
  });
  it("JSON 블록은 '<' 없이(\\u003c) 파싱된다", () => {
    for (const [id, b] of blocks) {
      if (b.type !== "application/json") continue;
      expect(b.text.includes("<"), id).toBe(false);
      expect(() => JSON.parse(b.text), id).not.toThrow();
    }
  });
  it("수집기 메타 블록 = PAGE.collectors", () => {
    expect(JSON.parse(blocks.get(BLOCK.collectors)?.text ?? "null")).toEqual(PAGE.collectors);
  });

  for (const cloud of CLOUDS) {
    const file = path.join(PATHS.collectorDir, COLLECTOR_FILES[cloud]);
    if (!existsSync(file)) {
      it.todo(`수집기 원문 대기: ${path.relative(PATHS.repo, file)}(API설계자) — 지금은 빈 블록`);
      continue;
    }
    it(`수집기 블록 = 파일 바이트 = PAGE.collectors.${cloud} = SHA256SUMS(${COLLECTOR_FILES[cloud]})`, () => {
      const buf = readFileSync(file);
      expect(blocks.get(BLOCK.collector(cloud))?.text).toBe(buf.toString("utf8"));
      expect(PAGE.collectors[cloud]).toEqual({ file: COLLECTOR_FILES[cloud], bytes: buf.length, sha256: sha256hex(buf) });
      if (existsSync(PATHS.sha256sums)) {
        const line = readFileSync(PATHS.sha256sums, "utf8").split("\n").find((l) => l.trim().endsWith(COLLECTOR_FILES[cloud]));
        expect(line?.split(/\s+/)[0], "SHA256SUMS").toBe(sha256hex(buf));
      }
    });
  }
  if (!existsSync(PATHS.sha256sums)) it.todo("SHA256SUMS 대기(API설계자) — 생기면 수집기 해시와 대조");
  it("V1 원문 읽기 안내(config.ts SCRIPT_NOTES)의 글자가 수집기 원문에 실제로 있다 — 없으면 안내가 화면에서 빠진다(D4 통합)", () => {
    for (const cloud of CLOUDS) {
      const text = blocks.get(BLOCK.collector(cloud))?.text ?? "";
      expect(text.includes(SCRIPT_NOTES[cloud].token), `${cloud}: ${SCRIPT_NOTES[cloud].token}`).toBe(true);
    }
  });

  if (!existsSync(PATHS.releases)) it.todo("RELEASES.json 대기(API설계자) — 지금은 null 블록");
  else {
    it("릴리스 블록 = collector/RELEASES.json", () => {
      expect(JSON.parse(blocks.get(BLOCK.releases)?.text ?? "null")).toEqual(JSON.parse(readFileSync(PATHS.releases, "utf8")));
    });
  }

  const demoMissing: string[] = [];
  for (const cloud of CLOUDS) {
    for (const set of DEMO_SETS) {
      const file = path.join(PATHS.demoDir, `${cloud}-${set}.json`);
      if (!existsSync(file)) {
        demoMissing.push(`${cloud}-${set}`);
        continue;
      }
      it(`체험 블록 ${cloud}-${set} = fixtures/companies/${cloud}-${set}.json`, () => {
        expect(JSON.parse(blocks.get(BLOCK.demo(cloud, set))?.text ?? "null")).toEqual(JSON.parse(readFileSync(file, "utf8")));
      });
    }
  }
  if (demoMissing.length > 0) it.todo(`체험 데이터 대기(DB설계자, fixtures/companies/<cloud>-<set>.json): ${demoMissing.join(", ")} — 지금은 null 블록`);
});

describe("입력 대기 표시", () => {
  if (!existsSync(PATHS.config)) it.todo(`config.ts 대기(페이지개발자) — 페이지 버전 기본값 ${DEFAULT_VERSION}`);
  else {
    it("페이지 버전 = config.ts의 PAGE_VERSION, 스크립트에도 같은 값", () => {
      const m = /export\s+const\s+PAGE_VERSION\s*(?::\s*string\s*)?=\s*"([^"]+)"/.exec(readFileSync(PATHS.config, "utf8"));
      expect(m?.[1], '`export const PAGE_VERSION = "x.y.z";` 형태여야 생성기가 읽는다').toBe(PAGE.version);
      expect(execScripts(PAGE.html)[0]).toContain(`"${PAGE.version}"`);
    });
  }
  if (!engineCatalogMerged()) it.todo("E 카탈로그(rules/i18n/ko.ts, DB설계자) 미병합 — 생기면 프론트팀장이 i18n/index.ts에 병합");
  it("대기 중인 입력 목록(정보)", () => {
    if (r.pending.length > 0) console.info(`[cloudcheck 대기 입력 ${r.pending.length}건]\n${r.pending.map((p) => `  - ${p}`).join("\n")}`);
    expect(Array.isArray(r.pending)).toBe(true);
  });
});

/* ───────── 부팅 계약(템플릿 ↔ main.tsx): 커밋된 HTML을 jsdom에서 그대로 실행 ─────────
 * jsdom은 CSP·Trusted Types를 강제하지 않는다(그 확인은 STEP 5 실브라우저). 여기서는 '스크립트 없이 보이는 것'과 '부팅 뒤 상태'만 본다.
 * @types/jsdom이 없어 createRequire + 이 파일 안의 최소 타입으로 불러온다(레포 전역 타입 선언을 만들지 않는다). */
interface JsdomWindow { readonly document: Document; close(): void }
interface JsdomModule {
  readonly JSDOM: new (html: string, opts?: { runScripts?: "dangerously"; pretendToBeVisual?: boolean; url?: string; virtualConsole?: unknown }) => { readonly window: JsdomWindow };
  readonly VirtualConsole: new () => { on(event: "error" | "jsdomError" | "warn", cb: (e: unknown) => void): unknown };
}
const { JSDOM, VirtualConsole } = createRequire(import.meta.url)("jsdom") as JsdomModule;

describe("부팅 계약(템플릿 ↔ main.tsx) — 커밋된 HTML을 jsdom에서 실행", () => {
  it("스크립트 없이: 정적 셸(V0 머리)이 보이고 #app은 비어 있다(점진적 향상)", () => {
    const dom = new JSDOM(PAGE.html);
    const d = dom.window.document;
    expect(d.documentElement.lang).toBe("ko");
    expect(d.getElementById(SHELL.static)?.hidden).toBe(false);
    expect(d.querySelector("h1")?.textContent).toBe(lookup("cc.start.title"));
    expect(d.getElementById(SHELL.app)?.childElementCount).toBe(0);
    dom.window.close();
  });
  it("스크립트가 돌면: #app 렌더 + 정적 셸·부팅 대체 안내 hidden + <html data-cc-booted>, 콘솔 오류 0", async () => {
    const errors: string[] = [];
    const vc = new VirtualConsole();
    vc.on("error", (e) => errors.push(String(e)));
    vc.on("jsdomError", (e) => errors.push(String(e)));
    const dom = new JSDOM(PAGE.html, { runScripts: "dangerously", pretendToBeVisual: true, url: "https://project-orsrw.vercel.app/cloudcheck", virtualConsole: vc });
    await new Promise((resolve) => setTimeout(resolve, 30));
    const d = dom.window.document;
    expect(errors).toEqual([]);
    expect(d.documentElement.hasAttribute("data-cc-booted")).toBe(true);
    expect(d.getElementById(SHELL.static)?.hidden).toBe(true);
    expect(d.getElementById(SHELL.boot)?.hidden).toBe(true);
    expect(d.getElementById(SHELL.app)?.childElementCount).toBeGreaterThan(0);
    expect(d.getElementById(SHELL.app)?.textContent ?? "").not.toContain("⟦");
    dom.window.close();
  });
  // D4 통합: 실제 HTML에는 <main>이 둘(숨은 정적 셸 것이 먼저)이라, 첫 <main>만 보던 findHeading이 포커스를 <body>에 떨어뜨렸다(실브라우저에서 발견).
  // 화면 RTL 시험에는 정적 셸이 없어 못 잡으므로, 커밋된 HTML 그대로 화면을 옮겨 포커스 위치를 본다(G-D28).
  it("화면을 옮기면 포커스가 새 화면의 h1로 간다(숨은 정적 셸의 <main>을 건너뛴다)", async () => {
    const dom = new JSDOM(PAGE.html, { runScripts: "dangerously", pretendToBeVisual: true, url: "https://project-orsrw.vercel.app/cloudcheck" });
    await new Promise((resolve) => setTimeout(resolve, 30));
    const d = dom.window.document;
    expect(d.querySelectorAll("main").length).toBe(2);
    const demoLabel = lookup("cc.start.cta.demo") ?? "";
    const btn = Array.from(d.querySelectorAll("button")).find((b) => b.textContent === demoLabel);
    expect(btn, demoLabel).toBeDefined();
    btn?.click();
    await new Promise((resolve) => setTimeout(resolve, 30));
    const active = d.activeElement;
    expect(active?.tagName).toBe("H1");
    expect(active?.textContent).toBe(lookup("cc.demo.title"));
    expect(active?.closest(`#${SHELL.app}`)).not.toBeNull();
    dom.window.close();
  });
});

describe("CSS 번들(디자인 G-D6·G5)", () => {
  const printCss = path.join(PATHS.client, "styles/print.css");
  if (!existsSync(printCss)) {
    it.todo("print.css 대기 — 생기면 '번들 CSS의 마지막 @media print가 print.css 것' 검사가 켜진다");
  } else {
    it("번들 CSS의 마지막 @media print 블록이 print.css의 것(main.tsx에서 맨 마지막 import)", () => {
      const css = styles(PAGE.html)[0] ?? "";
      const last = css.lastIndexOf("@media print");
      expect(last).toBeGreaterThanOrEqual(0);
      expect(css.slice(last)).toContain(".cc-print-unmask");
    });
  }
  // STEP 6 디자인 검수 F3 회귀 방지: 같은 명시도라 번들 순서가 이긴다 — 낮은 화면 해제(.cc-ctx{position:static})가 마지막 스티키 선언보다 뒤에 있어야 한다
  it("높이 600px 이하에서 맥락 줄 스티키 해제 규칙이 번들 CSS에서 마지막 .cc-ctx 스티키 선언보다 뒤에 온다(F3)", () => {
    const css = r.css;
    const sticky = css.lastIndexOf(".cc-ctx{position:sticky");
    expect(sticky).toBeGreaterThanOrEqual(0);
    const releases = [...css.matchAll(/@media \(max-height:600px\)\{[^@]*?\.cc-ctx\{position:static\}/g)].map((m) => m.index ?? -1);
    expect(releases.length).toBeGreaterThan(0);
    expect(Math.max(...releases)).toBeGreaterThan(sticky);
  });
  it("user-select:all은 .cc-cmd--kql .cc-cmd__pre · .cc-hash 두 선택자에서만(G-D6)", () => {
    const css = styles(PAGE.html)[0] ?? "";
    const allowed = new Set([".cc-cmd--kql .cc-cmd__pre", ".cc-hash"]);
    for (const m of css.matchAll(/user-select:\s*all/g)) {
      const open = css.lastIndexOf("{", m.index ?? 0);
      const prevClose = Math.max(css.lastIndexOf("}", open), css.lastIndexOf("{", open - 1));
      const selector = css.slice(prevClose + 1, open).trim();
      for (const sel of selector.split(",")) expect(allowed.has(sel.trim()), sel).toBe(true);
    }
  });
});
