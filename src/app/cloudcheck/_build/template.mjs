// src/app/cloudcheck/_build/template.mjs — 단일 HTML 템플릿(순수 함수). 소유: 프론트팀장.
// 머리 순서(방향서 §2-2 + 디자인 X12): <meta charset> → meta CSP → referrer → x-dns-prefetch-control → viewport → <title>
//   → color-scheme · theme-color ×2 · description → <link rel="icon" data:> → <style> 1개
//   → 정적 셸(V0 머리 · 부팅 대체 안내) · <noscript> · #app → 데이터 블록(실행 안 됨) → <script> 1개.
// 규칙
//  - 페이지 자신의 해시는 HTML에 넣지 않는다(파일은 자기 해시를 담을 수 없다 — 디자인 Q1).
//  - 정적 셸 글자는 카탈로그에서 가져온다(단일 원천). 키가 아직 없으면 그 요소를 뺀다(생성기가 '대기'로 알림).
//  - 마크업에는 style 속성·이벤트 속성·src·외부 URL을 두지 않는다. href는 오프라인판 링크(/cloudcheck/download)와 파비콘(data:)뿐.

/** 파비콘: 열쇠 구멍 글리프(UI 스펙 §3-3 그대로). xmlns의 w3.org는 SVG 이름공간 표기이고 요청이 아니다 */
export const FAVICON_HREF =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%2315181D'/%3E%3Ccircle cx='16' cy='12.5' r='4.6' fill='%23fff'/%3E%3Cpath d='M13.7 15.5h4.6l1.9 9.5h-8.4z' fill='%23fff'/%3E%3C/svg%3E";

/** theme-color(디자인 X12): 라이트 --cc-bg · 다크 --cc-bg */
export const THEME_COLOR = Object.freeze({ light: "#FFFFFF", dark: "#0F1115" });

/** 스크립트가 돌지 않아도 동작해야 하는 오프라인판 링크(UX §4-10) */
export const DOWNLOAD_PATH = "/cloudcheck/download";

/** 정적 셸·머리가 쓰는 카탈로그 키 */
export const STATIC_KEYS = Object.freeze([
  "cc.start.title",
  "cc.start.tagline",
  "cc.band.aria",
  "cc.band.beta.tag",
  "cc.band.beta.row",
  "cc.band.beta.more",
  "cc.hdr.home",
  "cc.promise.line",
  "cc.boot.failed",
  "cc.boot.noscript",
  "cc.boot.download",
  "cc.boot.download-note",
]);

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
/** HTML 글자·속성 이스케이프. 이 템플릿의 속성은 모두 큰따옴표라 작은따옴표는 그대로 둔다(CSP의 'none'이 소스 보기에서 그대로 읽힌다) */
export function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ESC[c]);
}

/** 원문을 그대로 끼워 넣는 자리의 불변식(생성기가 먼저 걸러 오지만, 이어 붙이는 곳에서 한 번 더 막는다) */
function assertRaw(name, s, banned) {
  for (const re of banned) {
    if (re.test(s)) throw new Error(`template: ${name}에 넣을 수 없는 문자열 ${re}`);
  }
}

/**
 * @param {object} o
 * @param {string} o.js       후처리 끝난 실행 스크립트
 * @param {string} o.css      압축된 CSS(없으면 "")
 * @param {string} o.metaCsp  _serve/headers.ts metaCsp() 결과
 * @param {(key: string) => string | null} o.text  카탈로그 조회
 * @param {{ static: string, boot: string, app: string }} o.ids  _client/shell.ts SHELL
 * @param {ReadonlyArray<{ id: string, type: "text/plain" | "application/json", content: string }>} o.blocks  데이터 블록
 * @returns {string}
 */
export function renderHtml(o) {
  assertRaw("script", o.js, [/<!--/, /<script/i, /<\/script/i, /\r/, /\0/]);
  assertRaw("style", o.css, [/<\/style/i, /\r/, /\0/]);
  for (const b of o.blocks) {
    assertRaw(`데이터 블록 ${b.id}`, b.content, [/<!--/, /<script/i, /<\/script/i, /\r/, /\0/]);
    if (b.type !== "text/plain" && b.type !== "application/json") throw new Error(`template: 데이터 블록 type ${b.type}`);
  }
  const k = (key) => {
    const v = o.text(key);
    return typeof v === "string" && v !== "" ? v : null;
  };
  const title = k("cc.start.title");
  const tagline = k("cc.start.tagline");
  const out = [];

  out.push("<!doctype html>");
  out.push('<html lang="ko">');
  out.push("<head>");
  out.push('<meta charset="utf-8">');
  out.push(`<meta http-equiv="Content-Security-Policy" content="${esc(o.metaCsp)}">`);
  out.push('<meta name="referrer" content="no-referrer">');
  out.push('<meta http-equiv="x-dns-prefetch-control" content="off">');
  out.push('<meta name="viewport" content="width=device-width, initial-scale=1">');
  out.push(`<title>${title === null ? "" : esc(title)}</title>`);
  out.push('<meta name="color-scheme" content="light dark">');
  out.push(`<meta name="theme-color" media="(prefers-color-scheme: light)" content="${THEME_COLOR.light}">`);
  out.push(`<meta name="theme-color" media="(prefers-color-scheme: dark)" content="${THEME_COLOR.dark}">`);
  if (tagline !== null) out.push(`<meta name="description" content="${esc(tagline)}">`);
  out.push(`<link rel="icon" href="${FAVICON_HREF}">`);
  out.push(`<style>${o.css}</style>`);
  out.push("</head>");
  out.push("<body>");

  // ── 정적 셸: 스크립트 전에 보이는 V0 머리(같은 클래스·같은 글자). 부팅하면 main.tsx가 hidden을 붙인다
  out.push(`<div id="${o.ids.static}">`);
  const tag = k("cc.band.beta.tag");
  const row = k("cc.band.beta.row");
  if (tag !== null && row !== null) {
    const aria = k("cc.band.aria");
    const more = k("cc.band.beta.more");
    out.push(
      `<aside class="cc-band"${aria === null ? "" : ` aria-label="${esc(aria)}"`}>` +
        `<span class="cc-band__tag">${esc(tag)}</span><span class="cc-band__row">${esc(row)}</span>` +
        (more === null ? "" : ` <span class="cc-band__more">${esc(more)}</span>`) +
        "</aside>",
    );
  }
  const brand = k("cc.hdr.home");
  if (brand !== null) out.push(`<header class="cc-hdr"><div class="cc-hdr__in cc-wrap"><span class="cc-hdr__brand">${esc(brand)}</span></div></header>`);
  out.push('<main class="cc-wrap cc-stack">');
  if (title !== null) out.push(`<h1>${esc(title)}</h1>`);
  if (tagline !== null) out.push(`<p>${esc(tagline)}</p>`);
  const promise = k("cc.promise.line");
  if (promise !== null) out.push(`<p class="cc-display">${esc(promise)}</p>`);
  const failed = k("cc.boot.failed");
  const dl = k("cc.boot.download");
  // STEP 5 QA CC-QA-22: file://로 연 오프라인판에서는 /cloudcheck/download가 없는 파일이 된다. 스크립트가 없으니 숨길 수 없어 링크 아래에 글로 알린다
  const dlNote = k("cc.boot.download-note");
  const dlBlock =
    dl === null ? "" : `<p><a class="cc-link" href="${DOWNLOAD_PATH}" download>${esc(dl)}</a></p>` + (dlNote === null ? "" : `<p class="cc-small">${esc(dlNote)}</p>`);
  if (failed !== null) {
    out.push(
      `<div id="${o.ids.boot}" class="cc-boot cc-banner cc-banner--strong" role="note"><p>${esc(failed)}</p>` + dlBlock + "</div>",
    );
  }
  out.push("</main>");
  out.push("</div>");
  const noscript = k("cc.boot.noscript");
  if (noscript !== null) {
    out.push(
      `<noscript><div class="cc-wrap"><div class="cc-banner cc-banner--strong" role="note"><p>${esc(noscript)}</p>` + dlBlock + "</div></div></noscript>",
    );
  }
  out.push(`<div id="${o.ids.app}"></div>`);

  // ── 데이터 블록(실행되지 않음 — CSP 해시 대상 아님)
  for (const b of o.blocks) out.push(`<script type="${b.type}" id="${esc(b.id)}">${b.content}</script>`);

  // ── 실행 스크립트 1개(맨 마지막)
  out.push(`<script>${o.js}</script>`);
  out.push("</body>");
  out.push("</html>");
  return `${out.join("\n")}\n`;
}
