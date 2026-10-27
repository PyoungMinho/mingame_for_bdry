// src/app/cloudcheck/_build/template.d.mts — template.mjs 타입(테스트가 import한다). 소유: 프론트팀장.

export declare const FAVICON_HREF: string;
export declare const THEME_COLOR: { readonly light: string; readonly dark: string };
export declare const DOWNLOAD_PATH: string;
export declare const STATIC_KEYS: readonly string[];
export declare function esc(s: string): string;
export declare function renderHtml(o: {
  readonly js: string;
  readonly css: string;
  readonly metaCsp: string;
  readonly text: (key: string) => string | null;
  readonly ids: { readonly static: string; readonly boot: string; readonly app: string };
  readonly blocks: ReadonlyArray<{ readonly id: string; readonly type: "text/plain" | "application/json"; readonly content: string }>;
}): string;
