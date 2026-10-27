// src/app/cloudcheck/_build/generate.d.mts — generate.mjs 타입(테스트가 import한다). 소유: 프론트팀장.

export interface CollectorRecord {
  readonly file: string;
  readonly bytes: number;
  readonly sha256: string;
}

export interface PageRecord {
  readonly version: string;
  readonly esbuildVersion: string;
  readonly sha256: string;
  readonly scriptHash: string;
  readonly styleHash: string;
  readonly bytes: number;
  readonly collectors: { readonly aws: CollectorRecord | null; readonly azure: CollectorRecord | null };
  readonly html: string;
}

export interface DataBlock {
  readonly id: string;
  readonly type: "text/plain" | "application/json";
  readonly content: string;
}

export interface GenerateResult {
  readonly page: PageRecord;
  /** 후처리 끝난 실행 스크립트(HTML에 들어간 그대로) */
  readonly js: string;
  /** 압축된 CSS(HTML에 들어간 그대로) */
  readonly css: string;
  readonly blocks: readonly DataBlock[];
  /** 번들에 들어간 입력 파일(레포 기준 상대 경로, 정렬) */
  readonly inputs: readonly string[];
  /** 아직 없는 입력(빈 블록·기본값으로 대신한 것) */
  readonly pending: readonly string[];
  readonly sizes: {
    readonly html: number;
    readonly htmlGzip: number;
    readonly js: number;
    readonly css: number;
    readonly collectors: number;
    readonly demo: number;
  };
}

export declare const PATHS: {
  readonly repo: string;
  readonly app: string;
  readonly client: string;
  readonly lib: string;
  readonly entry: string;
  readonly config: string;
  readonly generated: string;
  readonly collectorDir: string;
  readonly sha256sums: string;
  readonly releases: string;
  readonly demoDir: string;
};
export declare const COLLECTOR_FILES: { readonly aws: string; readonly azure: string };
export declare const DEFAULT_VERSION: string;

export declare function generate(): Promise<GenerateResult>;
export declare function renderPageModule(page: PageRecord): string;
export declare function postprocessJs(raw: string): string;
export declare function checkCss(css: string): string;
export declare function bundleOptions(): Readonly<Record<string, unknown>>;
export declare function loadEsbuild(): { readonly version: string };
