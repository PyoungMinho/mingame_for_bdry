// src/app/cloudcheck/_client/shell.ts — 템플릿(_build/template.mjs) ↔ 클라이언트 계약. 소유: 프론트팀장.
// 정적 셸·루트·데이터 블록의 id와, 데이터 블록을 읽는 함수만 둔다. 템플릿은 이 파일을 빌드 때 그대로 묶어 같은 id를 쓴다(단일 원천).
// 데이터 블록은 실행되지 않는 <script type="text/plain|application/json">이다(CSP 해시·JS 예산 밖, 방향서 §2-3).
//  - 읽기는 textContent로만 한다(innerHTML 금지, R-12). JSON 블록의 '<'는 생성기가 <로 바꿔 넣었다(JSON.parse 결과는 같다).
//  - 체험 블록 텍스트는 수집기 결과 파일 JSON 그대로다 → TextEncoder로 바이트를 만들어 recognize({ via: "demo", … })에 넘긴다.
import type { Cloud, DemoSetId } from "../../../lib/cloudcheck/model/report";

/** 정적 HTML 요소 id */
export const SHELL = {
  /** 정적 V0 머리(스크립트 전에 보이는 글자). 부팅하면 hidden */
  static: "cc-static",
  /** 부팅 대체 안내(.cc-boot). 부팅하면 hidden */
  boot: "cc-boot",
  /** React 루트 */
  app: "app",
} as const;

export const CLOUDS: readonly Cloud[] = ["aws", "azure"];
export const DEMO_SETS: readonly DemoSetId[] = ["A", "B", "C", "D"];

/** 데이터 블록 id */
export const BLOCK = {
  /** 수집기 원문(text/plain). 파일이 아직 없으면 빈 블록 */
  collector: (cloud: Cloud): string => `cc-collector-${cloud}`,
  /** 수집기 원문 메타(application/json): Record<Cloud, CollectorMeta | null> */
  collectors: "cc-collectors",
  /** 알려진 수집기 릴리스(application/json): collector/RELEASES.json 내용 또는 null */
  releases: "cc-releases",
  /** 체험 데이터(application/json): 수집기 결과 파일 JSON 또는 null(아직 없음) */
  demo: (cloud: Cloud, set: DemoSetId): string => `cc-demo-${cloud}-${set}`,
} as const;

/** 수집기 원문의 빌드 때 계산 값(V1 해시 표시용. 이 페이지 자신의 해시는 담지 않는다 — 디자인 Q1) */
export interface CollectorMeta {
  readonly file: string;     // "cloudcheck-aws.sh"
  readonly bytes: number;    // UTF-8 바이트 수(= 내려받는 Blob 바이트 수)
  readonly sha256: string;   // 64자 소문자 16진
}

function blockText(id: string): string | null {
  if (typeof document === "undefined") return null;
  const el = document.getElementById(id);
  return el === null ? null : el.textContent;
}

function blockJson(id: string): unknown {
  const text = blockText(id);
  if (text === null || text === "") return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function isCollectorMeta(v: unknown): v is CollectorMeta {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return typeof o.file === "string" && typeof o.bytes === "number" && typeof o.sha256 === "string" && /^[0-9a-f]{64}$/.test(o.sha256);
}

/** 수집기 원문. 아직 없으면 null */
export function readCollectorSource(cloud: Cloud): string | null {
  const text = blockText(BLOCK.collector(cloud));
  return text === null || text === "" ? null : text;
}

/** 수집기 원문 메타. 아직 없으면 null */
export function readCollectorMeta(cloud: Cloud): CollectorMeta | null {
  const all = blockJson(BLOCK.collectors);
  if (typeof all !== "object" || all === null) return null;
  const v = (all as Record<string, unknown>)[cloud];
  return isCollectorMeta(v) ? v : null;
}

/** 알려진 수집기 릴리스 목록(모양은 collector/RELEASES.json — API설계자 소유). 아직 없으면 null */
export function readReleases(): unknown {
  return blockJson(BLOCK.releases);
}

/** 체험 데이터 원문(JSON 텍스트). 아직 없거나 null이면 null */
export function readDemoText(cloud: Cloud, set: DemoSetId): string | null {
  const text = blockText(BLOCK.demo(cloud, set));
  if (text === null) return null;
  const trimmed = text.trim();
  return trimmed === "" || trimmed === "null" ? null : text;
}
