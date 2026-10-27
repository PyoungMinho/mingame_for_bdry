// src/app/cloudcheck/_client/state/screens.ts — 화면 ID · 화면별 필요 데이터 · 띠 선택 · 제목/낭독 문구. 소유: 페이지개발자.
// 근거: 디자인 최종안 §3-1(화면 목록·띠 선택 규칙), §6-0(화면 전환), UX §6-1(제목·낭독 표), §3-5(전이표).
// 규칙: document.title·낭독에 사용자 데이터를 넣지 않는다(디자인 Q12). 점검 제목은 정적 데이터라 허용. 글자는 t()로만 만든다.
import type { Availability } from "../config";
import { CLOUD_AVAILABILITY, isBetaPhase } from "../config";
import { t } from "../i18n/index";
import type { CatalogKey, Cloud, Comparison, DemoSetId, Report } from "../../../../lib/cloudcheck/model/report";

export const SCREEN_IDS = ["start", "prep", "input", "report", "fix", "compare", "demo", "catalog", "about"] as const;
/** history.state에 들어가는 유일한 값(`{ cc: ScreenId }`) */
export type ScreenId = (typeof SCREEN_IDS)[number];

export function isScreenId(v: unknown): v is ScreenId {
  return typeof v === "string" && (SCREEN_IDS as readonly string[]).includes(v);
}

/** 새로고침 복구 안내(A3')를 띄우는 화면: 부팅 때 history.state.cc가 이 중 하나인데 메모리가 비어 있을 때(UX §4-1) */
export const RECOVERABLE_SCREENS: readonly ScreenId[] = ["input", "report", "fix", "compare"];
export const isRecoverableScreen = (v: unknown): boolean => isScreenId(v) && RECOVERABLE_SCREENS.includes(v);

/** 화면이 필요로 하는 데이터가 메모리에 있는가(UX §3-1 '필요한 데이터'). 없으면 V0(popstate·직접 이동 모두) */
export interface DataFacts {
  readonly hasReport: boolean;
  readonly hasFixTarget: boolean;
  readonly hasComparison: boolean;
}
export function screenReady(screen: ScreenId, f: DataFacts): boolean {
  switch (screen) {
    case "report":
      return f.hasReport;
    case "fix":
      return f.hasReport && f.hasFixTarget;
    case "compare":
      return f.hasComparison;
    default:
      return true;
  }
}
export const resolveScreen = (screen: ScreenId, f: DataFacts): ScreenId => (screenReady(screen, f) ? screen : "start");

/** 체험 표식 화면인가: V6, 또는 체험 리포트를 보는 V3·V4 (띠·프레임·낭독 접두가 같은 조건을 쓴다 — 디자인 §3-1) */
export function isDemoScreen(screen: ScreenId, report: Report | null): boolean {
  return screen === "demo" || ((screen === "report" || screen === "fix") && report !== null && report.mode.kind === "demo");
}
/** 띠 선택: 체험이면 체험 띠(베타 띠를 대신한다 — 둘을 쌓지 않는다), 아니면 베타 단계인 동안 베타 띠 */
export function bandKind(screen: ScreenId, report: Report | null, availability: Availability = CLOUD_AVAILABILITY): "beta" | "demo" | null {
  if (isDemoScreen(screen, report)) return "demo";
  return isBetaPhase(availability) ? "beta" : null;
}
/** 고정 맥락 줄이 붙는 화면 */
export const hasContextBar = (screen: ScreenId): boolean => screen === "report" || screen === "fix";
/** `<main translate="no">`: V2~V5(방향서 §2-4 번역 규칙). V0·V1·V6·V7·V8은 번역을 허용한다 */
export const noTranslate = (screen: ScreenId): boolean => screen === "input" || screen === "report" || screen === "fix" || screen === "compare";
/** 화면 폭: 대상 표·스크립트 뷰어가 있는 화면은 넓은 본문(1040) */
export const isWideScreen = (screen: ScreenId): boolean => screen === "prep" || screen === "report";

/* ───────── 제목 · 낭독 ───────── */
const H1_KEY = {
  start: "cc.start.title",
  prep: "cc.prep.title",
  input: "cc.input.title",
  report: "cc.report.title",
  fix: "cc.fix.title",
  compare: "cc.compare.title",
  demo: "cc.demo.title",
  catalog: "cc.catalog.title",
  about: "cc.about.title",
} as const satisfies Record<ScreenId, string>;

/** 화면 h1 글자(체험 리포트는 '체험 리포트') */
export function headingText(screen: ScreenId, demoReport: boolean): string {
  if (screen === "report" && demoReport) return t("cc.report.title-demo");
  return t(H1_KEY[screen]);
}

/**
 * document.title (UX §6-1): V0 "문단속 5" / 그 밖 "<화면 이름> · 문단속 5" / V4 "고치는 법 · <점검 제목> · 문단속 5".
 * 사용자 데이터(별칭·계정 ID·파일 이름·리소스 이름)는 넣지 않는다. 점검 제목(fixTitle)은 정적 카탈로그 글자다.
 */
export function documentTitle(screen: ScreenId, o: { readonly demoReport: boolean; readonly fixTitle: string | null }): string {
  const brand = t("cc.start.title");
  if (screen === "start") return brand;
  if (screen === "fix" && o.fixTitle !== null) return `${t("cc.fix.title")} · ${o.fixTitle} · ${brand}`;
  return `${headingText(screen, o.demoReport)} · ${brand}`;
}

export interface LiveContext {
  readonly cloud: Cloud | null;
  readonly report: Report | null;
  readonly fixTitle: string | null;
  readonly comparison: Comparison | null;
}
/** 바뀐 점검 수(V5 낭독·요약). 'same'이 아닌 것의 개수 */
export function changedCount(c: Extract<Comparison, { ok: true }>): number {
  return c.rules.filter((r) => r.change !== "same").length;
}

/**
 * 화면 이동 낭독(polite, 포커스 이동 뒤 한 번). 체험 상태의 V3·V4는 앞에 "체험 모드입니다."를 붙인다. V7·V8은 낭독하지 않는다(UX §6-1).
 * 문장은 전부 카탈로그에서 온다("완료" 같은 말 없음). 사용자 데이터는 들어가지 않는다.
 */
export function liveText(screen: ScreenId, c: LiveContext): string | null {
  let body: string | null;
  switch (screen) {
    case "start":
      body = t("cc.app.live.screen", { screen: t("cc.start.title") });
      break;
    case "prep":
      body = t("cc.app.live.prep", { cloud: t(c.cloud === "azure" ? "cc.app.cloud.azure" : "cc.app.cloud.aws") });
      break;
    case "input":
      body = t("cc.app.live.screen", { screen: t("cc.input.title") });
      break;
    case "report": {
      if (c.report === null) return null;
      const d = c.report.distribution.rules;
      body = t("cc.app.live.report", { total: d.total, risk: d.risk, caution: d.caution, unknown: d.unknown, clear: d.clear, na: d.na });
      break;
    }
    case "fix":
      body = t("cc.app.live.fix", { title: c.fixTitle ?? "" });
      break;
    case "compare":
      if (c.comparison === null) return null;
      body = c.comparison.ok ? t("cc.app.live.compare", { n: changedCount(c.comparison) }) : t("cc.app.live.compare-refused");
      break;
    case "demo":
      body = t("cc.app.live.screen", { screen: t("cc.demo.title") });
      break;
    default:
      return null;
  }
  const demoPrefix = (screen === "report" || screen === "fix") && c.report !== null && c.report.mode.kind === "demo";
  return demoPrefix ? `${t("cc.app.live.demo")} ${body}` : body;
}

/** 체험 회사 이름 키(맥락 줄·인쇄 머리의 '가짜 회사'). 세트 글자(A~D)는 화면에 쓰지 않는다 */
export const DEMO_NAME_KEY: Readonly<Record<DemoSetId, CatalogKey>> = {
  A: "cc.demo.set.a.name",
  B: "cc.demo.set.b.name",
  C: "cc.demo.set.c.name",
  D: "cc.demo.set.d.name",
};
