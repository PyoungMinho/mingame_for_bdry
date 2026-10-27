// src/app/cloudcheck/_client/screens/__tests__/harness.tsx — 화면 RTL 시험 공용 도구(테스트가 아니다: __tests__ 안이라 가드 스캔·번들에서 빠진다). 소유: 페이지개발자.
// 엔진은 목업 EngineDeps(state/deps.mock.ts). 실제 엔진이 연결되면 createMockDeps() 한 줄만 바꿔 같은 시험을 실제 judge() 출력으로 돌린다.
import { act, render, screen, waitFor, within, type RenderResult } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { expect, vi } from "vitest";
import type { DisplayValue, Report } from "../../../../../lib/cloudcheck/model/report";
import { ALLOWED_KEYS, findBanned } from "../../../../../lib/cloudcheck/model/banned-words";
import { engineCatalogMerged, fileOfKey, lookup } from "../../i18n/index";
import { createMockDeps } from "../../state/deps.mock";
import type { EngineDeps } from "../../state/deps";
import { AppProvider, type AppEnv } from "../../state/controller";
import { App } from "../App";

export interface Harness extends RenderResult {
  readonly user: UserEvent;
  readonly deps: EngineDeps;
}

export function mount(env: Partial<AppEnv> = {}): Harness {
  const deps = env.deps ?? createMockDeps();
  const user = userEvent.setup();
  const view = render(
    <AppProvider env={{ frames: async () => undefined, ...env, deps }}>
      <App />
    </AppProvider>,
  );
  return { ...view, user, deps };
}

/** 체험 데이터 블록(내용은 목업 recognize가 보지 않는다) */
export function installDemoBlocks(): void {
  const blocks = (["aws", "azure"] as const).flatMap((c) => (["A", "B", "C", "D"] as const).map((s) => `<script type="application/json" id="cc-demo-${c}-${s}">{}</script>`));
  document.body.insertAdjacentHTML("beforeend", blocks.join(""));
}
export function removeDemoBlocks(): void {
  document.querySelectorAll('script[id^="cc-demo-"]').forEach((el) => el.remove());
}

export const mainEl = (): HTMLElement => document.querySelector("main") as HTMLElement;
/** 보이는(hidden이 아닌) 화면 글자 */
export function visibleText(): string {
  const main = mainEl();
  const parts: string[] = [];
  const walk = (n: Node): void => {
    if (n.nodeType === Node.ELEMENT_NODE) {
      const el = n as HTMLElement;
      if (el.hidden || el.tagName === "SCRIPT") return;
      el.childNodes.forEach(walk);
    } else if (n.nodeType === Node.TEXT_NODE) parts.push(n.textContent ?? "");
  };
  walk(main);
  return parts.join(" ");
}

export const h1 = (): HTMLElement => {
  const main = mainEl();
  const el = Array.from(main.querySelectorAll<HTMLElement>("h1")).find((x) => x.closest("[hidden]") === null);
  if (el === undefined) throw new Error("보이는 h1이 없다");
  return el;
};

/** 파일 입력에 파일을 넣는다(DropZone의 숨은 input) */
export async function uploadFiles(h: Harness, files: File[]): Promise<void> {
  const input = document.querySelector('input[type="file"][multiple]') as HTMLInputElement;
  await h.user.upload(input, files);
}
export const jsonFile = (name: string): File => new File(["{}"], name, { type: "application/json" });

/** V0 → V2 → 파일 하나 → V3. 실제 리포트(REPORT_REAL_D)가 열린다 */
export async function openRealReport(h: Harness, name = "result.json"): Promise<void> {
  await h.user.click(screen.getByRole("button", { name: "결과 파일이 이미 있어요" }));
  await uploadFiles(h, [jsonFile(name)]);
  await waitFor(() => expect(screen.getAllByRole("table").length).toBeGreaterThan(0));
  await h.user.click(screen.getByRole("button", { name: "이 계정으로 리포트 보기" }));
  await waitFor(() => expect(h1().textContent).toBe("리포트"));
}

/** V0 → V6 → 회사 카드. 체험 리포트가 열린다 */
export async function openDemoReport(h: Harness, companyName = "아슬아슬상회"): Promise<void> {
  installDemoBlocks();
  await h.user.click(screen.getByRole("button", { name: "체험 모드로 먼저 보기" }));
  const card = screen.getByRole("heading", { name: companyName }).closest("article") as HTMLElement;
  await h.user.click(within(card).getByRole("button"));
  await waitFor(() => expect(h1().textContent).toBe("체험 리포트"));
}

/** 리포트 안 모든 sensitive 값의 full (속성·제목 누출 검사용) */
export function sensitiveFulls(report: Report): string[] {
  const out = new Set<string>();
  const walk = (v: unknown): void => {
    if (v === null || typeof v !== "object") return;
    if (Array.isArray(v)) {
      v.forEach(walk);
      return;
    }
    if (v instanceof Map) {
      v.forEach(walk);
      return;
    }
    const o = v as Record<string, unknown>;
    if (o.kind === "sensitive" && typeof o.full === "string" && o.full.length >= 3) out.add(o.full);
    Object.values(o).forEach(walk);
  };
  walk(report);
  return [...out];
}

/** 모든 요소의 모든 속성 값 + document.title 에 값이 하나도 없어야 한다(G-D8) */
export function attributeLeaks(values: readonly string[]): string[] {
  const hits: string[] = [];
  const all = [document.title, ...Array.from(document.querySelectorAll("*")).flatMap((el) => Array.from(el.attributes).map((a) => a.value))];
  for (const v of values) for (const a of all) if (a.includes(v)) hits.push(`${v} ⊂ ${a.slice(0, 40)}`);
  return hits;
}

/**
 * 렌더 글자의 ⟦키⟧ 중 화면 카탈로그(C·S) 키. 목업 리포트·목업 카탈로그(mocks/**)의 엔진 코드는 화면 개발용 가짜라서
 * 실제 E 카탈로그(rules/i18n/ko.ts)에 없는 것이 정상이다 → 목업 시험은 C·S 누락만 본다.
 * E 키 누락은 실제 엔진 시험(real-engine.test.tsx · demo-real.test.tsx)이 실제 judge() 출력으로 { engine: true }로 본다(D4 통합, 프론트팀장).
 */
export function missingKeys(text: string, opts: { readonly engine?: boolean } = {}): string[] {
  const found = text.match(/⟦[^⟧]*⟧/g) ?? [];
  const keys = found.map((m) => m.slice(1, -1));
  return opts.engine === true && engineCatalogMerged() ? keys : keys.filter((k) => fileOfKey(k) !== "engine");
}

/** 금지어: 허용 키 2개(면책·인증 아님)의 글자는 뺀 뒤 findBanned 하나로 */
export function bannedHits(text: string): string[] {
  let cleaned = text;
  for (const key of Object.keys(ALLOWED_KEYS)) {
    const v = lookup(key);
    if (v !== undefined) cleaned = cleaned.split(v).join(" ");
  }
  return findBanned(cleaned).map((h) => `${h.label} '${h.match}'`);
}

export { act, screen, waitFor, within, vi };
export type { DisplayValue };
