// src/app/cloudcheck/_serve/serve.test.ts — 두 라우트의 헤더 스냅샷·본문 일치(G5 로컬 몫). 소유: 프론트팀장.
// 서버 없이 GET()을 직접 불러 헤더 맵과 본문 바이트를 본다. 기대값은 방향서 §2-2 최종 문자열을 그대로 옮긴 것이다.
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { PAGE } from "../_generated/page";
import * as dl from "../download/route";
import * as page from "../route";
import {
  BETA_NOINDEX,
  cspDirectives,
  downloadFileName,
  downloadHeaders,
  headerCsp,
  metaCsp,
  pageHeaders,
  TRUSTED_TYPES,
} from "./headers";

/** 방향서 §2-2 최종 문자열(<JS>·<CSS>만 PAGE의 해시로 바꿈) */
function expectedHeaders(js: string, css: string): Record<string, string> {
  return {
    "content-type": "text/html; charset=utf-8",
    "content-security-policy":
      `default-src 'none'; script-src 'sha256-${js}'; style-src 'sha256-${css}'; img-src data:; connect-src 'none'; media-src 'none'; ` +
      "object-src 'none'; frame-src 'none'; child-src 'none'; worker-src 'none'; manifest-src 'none'; form-action 'none'; base-uri 'none'; " +
      "require-trusted-types-for 'script'; trusted-types 'none'; frame-ancestors 'none'",
    "cross-origin-opener-policy": "same-origin",
    "cross-origin-resource-policy": "same-origin",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "permissions-policy":
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), clipboard-read=(), clipboard-write=(), display-capture=(), browsing-topics=()",
    "x-dns-prefetch-control": "off",
    "x-robots-tag": "noindex",
    "cache-control": "public, max-age=0, must-revalidate",
  };
}

const headerMap = (res: Response): Record<string, string> => Object.fromEntries(res.headers.entries());
const sha256hex = (b: Uint8Array): string => createHash("sha256").update(b).digest("hex");

describe("라우트 설정", () => {
  it("두 라우트 모두 force-dynamic · nodejs 런타임(방향서 §2-2)", () => {
    expect(page.dynamic).toBe("force-dynamic");
    expect(dl.dynamic).toBe("force-dynamic");
    expect(page.runtime).toBe("nodejs");
    expect(dl.runtime).toBe("nodejs");
  });
  it("베타 스위치: noindex 켜짐, Trusted Types 2지시어 켜짐(G9·STEP 5 결정 전까지)", () => {
    expect(BETA_NOINDEX).toBe(true);
    expect(TRUSTED_TYPES).toBe(true);
  });
});

describe("/cloudcheck 응답", () => {
  it("200 + 헤더가 방향서 §2-2 최종 문자열과 정확히 같다(더하거나 빠진 헤더 없음)", () => {
    const res = page.GET();
    expect(res.status).toBe(200);
    expect(headerMap(res)).toEqual(expectedHeaders(PAGE.scriptHash, PAGE.styleHash));
  });
  it("본문 = PAGE.html, sha256·바이트 수가 PAGE와 같다", async () => {
    const body = new Uint8Array(await page.GET().arrayBuffer());
    expect(body.byteLength).toBe(PAGE.bytes);
    expect(sha256hex(body)).toBe(PAGE.sha256);
    expect(new TextDecoder().decode(body)).toBe(PAGE.html);
  });
});

describe("/cloudcheck/download 응답", () => {
  it("헤더 = /cloudcheck 헤더 + Content-Disposition(첨부, 페이지 버전 파일 이름)", () => {
    const res = dl.GET();
    expect(res.status).toBe(200);
    expect(headerMap(res)).toEqual({
      ...expectedHeaders(PAGE.scriptHash, PAGE.styleHash),
      "content-disposition": `attachment; filename="cloudcheck-${PAGE.version}.html"`,
    });
  });
  it("본문 바이트가 /cloudcheck와 같다(오프라인판 = 이 페이지)", async () => {
    const a = new Uint8Array(await page.GET().arrayBuffer());
    const b = new Uint8Array(await dl.GET().arrayBuffer());
    expect(sha256hex(b)).toBe(sha256hex(a));
    expect(b.byteLength).toBe(a.byteLength);
  });
});

describe("CSP: 헤더와 meta가 같은 함수에서 나온다", () => {
  it("HTML 안 meta CSP = metaCsp(PAGE), 헤더 CSP = meta CSP + frame-ancestors", () => {
    const m = /<meta http-equiv="Content-Security-Policy" content="([^"]+)">/.exec(PAGE.html);
    expect(m?.[1]).toBe(metaCsp(PAGE));
    expect(headerCsp(PAGE)).toBe(`${metaCsp(PAGE)}; frame-ancestors 'none'`);
    expect(metaCsp(PAGE)).not.toContain("frame-ancestors");
  });
  it("지시어 순서와 개수가 고정이고, unsafe-*·blob:·font-src·'self'가 없다", () => {
    const d = cspDirectives(PAGE);
    expect(d.map((x) => x.split(" ")[0])).toEqual([
      "default-src", "script-src", "style-src", "img-src", "connect-src", "media-src", "object-src", "frame-src",
      "child-src", "worker-src", "manifest-src", "form-action", "base-uri", "require-trusted-types-for", "trusted-types",
    ]);
    const all = headerCsp(PAGE);
    for (const bad of ["unsafe-inline", "unsafe-eval", "unsafe-hashes", "blob:", "font-src", "'self'", "http:", "https:"]) {
      expect(all).not.toContain(bad);
    }
  });
  it("해시 형식이 아니면 던진다(빈 생성물로 서빙하지 않음)", () => {
    expect(() => cspDirectives({ scriptHash: "x", styleHash: PAGE.styleHash })).toThrow();
    expect(() => pageHeaders({ scriptHash: PAGE.scriptHash, styleHash: "'unsafe-inline'" })).toThrow();
  });
});

describe("헤더 조립 함수", () => {
  it("noindex를 끄면 X-Robots-Tag만 빠진다(G9 전환)", () => {
    const on = pageHeaders(PAGE, { noindex: true });
    const off = pageHeaders(PAGE, { noindex: false });
    expect(on["X-Robots-Tag"]).toBe("noindex");
    expect(off["X-Robots-Tag"]).toBeUndefined();
    const { "X-Robots-Tag": _dropped, ...rest } = on;
    expect(off).toEqual(rest);
  });
  it("다운로드 파일 이름은 페이지 버전만 허용 문자로(헤더 주입 차단)", () => {
    expect(downloadFileName("0.1.0-beta.1")).toBe("cloudcheck-0.1.0-beta.1.html");
    for (const bad of ["", "../x", "a b", 'x"y', "x;y", "x\r\ny", "가"]) expect(() => downloadFileName(bad)).toThrow();
    expect(downloadHeaders(PAGE)["Content-Disposition"]).toBe(`attachment; filename="cloudcheck-${PAGE.version}.html"`);
  });
});
