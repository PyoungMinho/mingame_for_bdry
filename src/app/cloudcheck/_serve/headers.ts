// src/app/cloudcheck/_serve/headers.ts — 응답 헤더·CSP 조립(순수 함수). 방향서 §2-2 최종 문자열의 단일 원천.
// 소유: 프론트팀장. 쓰는 곳: 두 라우트(응답 헤더), _build/generate.mjs(meta CSP — esbuild로 묶어 빌드 때 실행), 테스트.
// 규칙
//  1) 이 파일은 아무것도 import하지 않는다(생성기가 단독으로 묶어 실행한다).
//  2) meta CSP = 헤더 CSP에서 frame-ancestors만 뺀 문자열(meta에서는 frame-ancestors가 무시된다).
//  3) Trusted Types 2지시어는 조건부 채택(방향서 §1-1 #9). STEP 5에서 실패하면 TRUSTED_TYPES만 false로 바꾸고 재생성한다.
//  4) X-Robots-Tag는 베타 기간에만(G9에서 BETA_NOINDEX = false). HTML 바이트와 무관하게 헤더로만 단다.

/** CSP 해시 쌍. 값은 sha256의 base64(접두어 'sha256-' 없이) */
export interface CspHashes {
  readonly scriptHash: string;
  readonly styleHash: string;
}

/** 라우트가 내보내는 페이지 생성물의 최소 모양(_generated/page.ts의 PAGE) */
export interface ServedPage extends CspHashes {
  readonly version: string;
}

/** 베타 기간 noindex. G9(공개 링크)에서 false로 바꾼다 */
export const BETA_NOINDEX: boolean = true;

/** Trusted Types 지시어 조건부 채택 스위치(방향서 §1-1 #9) */
export const TRUSTED_TYPES: boolean = true;

export const PERMISSIONS_POLICY =
  "camera=(), microphone=(), geolocation=(), payment=(), usb=(), clipboard-read=(), clipboard-write=(), display-capture=(), browsing-topics=()";

export const CACHE_CONTROL = "public, max-age=0, must-revalidate";

const BASE64_SHA256 = /^[A-Za-z0-9+/]{43}=$/;
const VERSION_RE = /^[0-9A-Za-z][0-9A-Za-z.-]{0,39}$/;

function assertHashes(h: CspHashes): void {
  if (!BASE64_SHA256.test(h.scriptHash) || !BASE64_SHA256.test(h.styleHash)) {
    throw new Error("cloudcheck: CSP 해시 형식이 아닙니다(sha256 base64 44자). _generated/page.ts를 재생성하세요.");
  }
}

/** CSP 지시어 목록(순서 고정 — 방향서 §2-2) */
export function cspDirectives(h: CspHashes): readonly string[] {
  assertHashes(h);
  const list = [
    "default-src 'none'",
    `script-src 'sha256-${h.scriptHash}'`,
    `style-src 'sha256-${h.styleHash}'`,
    "img-src data:",
    "connect-src 'none'",
    "media-src 'none'",
    "object-src 'none'",
    "frame-src 'none'",
    "child-src 'none'",
    "worker-src 'none'",
    "manifest-src 'none'",
    "form-action 'none'",
    "base-uri 'none'",
  ];
  if (TRUSTED_TYPES) list.push("require-trusted-types-for 'script'", "trusted-types 'none'");
  return list;
}

/** HTML 안 `<meta http-equiv="Content-Security-Policy">` 값(frame-ancestors 없음) */
export function metaCsp(h: CspHashes): string {
  return cspDirectives(h).join("; ");
}

/** 응답 헤더 Content-Security-Policy 값 */
export function headerCsp(h: CspHashes): string {
  return `${metaCsp(h)}; frame-ancestors 'none'`;
}

/** /cloudcheck/download 의 첨부 파일 이름 */
export function downloadFileName(version: string): string {
  if (!VERSION_RE.test(version)) {
    throw new Error("cloudcheck: 페이지 버전 형식이 아닙니다([0-9A-Za-z.-], 40자 이하).");
  }
  return `cloudcheck-${version}.html`;
}

/** /cloudcheck 응답 헤더(삽입 순서 = 방향서 §2-2 표기 순서) */
export function pageHeaders(page: CspHashes, opts: { readonly noindex: boolean } = { noindex: BETA_NOINDEX }): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Security-Policy": headerCsp(page),
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Permissions-Policy": PERMISSIONS_POLICY,
    "X-DNS-Prefetch-Control": "off",
  };
  if (opts.noindex) h["X-Robots-Tag"] = "noindex";
  h["Cache-Control"] = CACHE_CONTROL;
  return h;
}

/** /cloudcheck/download 응답 헤더 = /cloudcheck 헤더 + Content-Disposition */
export function downloadHeaders(page: ServedPage, opts: { readonly noindex: boolean } = { noindex: BETA_NOINDEX }): Record<string, string> {
  return { ...pageHeaders(page, opts), "Content-Disposition": `attachment; filename="${downloadFileName(page.version)}"` };
}
