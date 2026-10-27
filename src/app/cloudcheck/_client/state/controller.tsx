// src/app/cloudcheck/_client/state/controller.tsx — 상태·동작을 React에 묶는 제공자(AppProvider)와 훅(useApp). 소유: 페이지개발자.
// 구성: 동기 저장소(store) + 동작(actions) + 창 수준 리스너(popstate · 드롭 · 스크롤 · beforeunload) + 화면 전환 4단계 효과.
// 화면 전환(모든 화면, 디자인 §6-0): ① h1(tabindex=-1)로 포커스(V4 → V3 복귀는 눌렀던 버튼) ② document.title ③ 맨 위로 즉시 스크롤(복귀는 복원, 부드러운 스크롤 없음) ④ 라이브 영역 낭독 1회.
import { createContext, useContext, useLayoutEffect, useEffect, useMemo, useState, useSyncExternalStore, type ReactElement, type ReactNode } from "react";
import type { ExceptionOverlay, IsoDate, IsoUtc, Report, RuleCatalogEntry, RuleId, TimeNotice } from "../../../../lib/cloudcheck/model/report";
import { CLOUD_AVAILABILITY, type Availability } from "../config";
import { t } from "../i18n/index";
import { createActions, type Actions } from "./actions";
import { nowIso, todayLocal } from "./clock";
import { installCompact } from "./compact";
import type { EngineDeps } from "./deps";
import { installWindowDrop } from "./drop";
import { createHistoryGate, type HistoryGate } from "./history";
import { initialState, reducer, type Action, type AppState } from "./reducer";
import { documentTitle, isRecoverableScreen, liveText } from "./screens";
import { createStore } from "./store";
import { syncUnloadGuard } from "./unload";

export interface AppEnv {
  readonly deps: EngineDeps;
  readonly availability?: Availability;
  readonly history?: HistoryGate;
  readonly clock?: { readonly now: () => IsoUtc; readonly today: () => IsoDate };
  /** file://로 열렸는가(기본: location.protocol) */
  readonly offline?: boolean;
  /** 읽기·만들기 직전에 화면이 그려지길 기다리는 함수(테스트는 즉시 해소) */
  readonly frames?: (n?: number) => Promise<void>;
  /** 창 수준 리스너(popstate·드롭·스크롤·beforeunload)를 설치할지(기본 true) */
  readonly windowListeners?: boolean;
}

export interface ReportDerived {
  /** timeNotices(report, now) — 체험이면 [] */
  readonly timeNotices: readonly TimeNotice[];
  /** overlayExceptions(report, file, today) — 예외 파일이 없으면 null */
  readonly overlay: ExceptionOverlay | null;
}

export interface AppValue {
  readonly state: AppState;
  readonly actions: Actions;
  readonly deps: EngineDeps;
  readonly availability: Availability;
  readonly offline: boolean;
  /** 점검 id → 카탈로그 항목(released 여부와 무관하게 전부) */
  readonly catalogById: ReadonlyMap<RuleId, RuleCatalogEntry>;
  readonly derived: ReportDerived | null;
}

const AppContext = createContext<AppValue | null>(null);

export function useApp(): AppValue {
  const v = useContext(AppContext);
  if (v === null) throw new Error("useApp must be used inside AppProvider");
  return v;
}

const EMPTY_NOTICES: readonly TimeNotice[] = [];

/**
 * 화면에 보이는(숨김 아닌) h1.
 * 실제 페이지에는 <main>이 둘이다: 정적 셸(#cc-static, 부팅 뒤 hidden — 스크립트 없이도 랜드마크가 있게)의 것이 문서 순서로 먼저, 앱의 것이 뒤.
 * 그래서 첫 <main>만 보면 숨은 정적 셸을 뒤져 null이 되고 포커스가 <body>로 떨어진다(D4 통합에서 실브라우저로 찾은 버그 — jsdom 시험에는 정적 셸이 없다).
 * 숨김 안의 <main>은 건너뛴다.
 */
export function findHeading(): HTMLElement | null {
  for (const main of Array.from(document.querySelectorAll("main"))) {
    if (main.closest("[hidden]") !== null) continue;
    for (const h of Array.from(main.querySelectorAll<HTMLElement>("h1"))) if (h.closest("[hidden]") === null) return h;
  }
  return null;
}

/** 즉시 스크롤(부드러운 스크롤 없음) */
export function setScrollTop(y: number): void {
  document.documentElement.scrollTop = y;
}

export function AppProvider({ env, children }: { readonly env: AppEnv; readonly children: ReactNode }): ReactElement {
  const clock = env.clock ?? { now: nowIso, today: todayLocal };
  const availability = env.availability ?? CLOUD_AVAILABILITY;

  const [core] = useState(() => {
    const history = env.history ?? createHistoryGate();
    // 부팅 때 history.state는 읽기만 한다. V2~V5였는데 메모리가 비어 있으면 V0에 복구 안내(A3')
    const bootScreen = history.current();
    const store = createStore<AppState, Action>(reducer, initialState({ recovered: bootScreen !== null && isRecoverableScreen(bootScreen), now: clock.now(), today: clock.today() }));
    const actions = createActions({
      store,
      deps: env.deps,
      history,
      availability,
      clock,
      scrollY: () => window.scrollY,
      frames: env.frames,
    });
    return { store, history, actions };
  });
  const { store, history, actions } = core;
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  const offline = env.offline ?? (typeof window !== "undefined" && window.location.protocol === "file:");
  const deps = env.deps;

  const catalogById = useMemo(() => new Map<RuleId, RuleCatalogEntry>(deps.catalog.map((e) => [e.ruleId, e])), [deps.catalog]);

  /* 리포트에서 파생되는 값(시간 알림 · 예외 오버레이) — 표시 단계에서만 합친다(방향서 §5-3) */
  const report: Report | null = state.report;
  const timeNotices = useMemo(() => (report === null ? EMPTY_NOTICES : deps.timeNotices(report, state.now)), [deps, report, state.now]);
  const overlay = useMemo(() => (report === null || state.exceptions === null ? null : deps.overlayExceptions(report, state.exceptions, state.today)), [deps, report, state.exceptions, state.today]);
  const derived = useMemo<ReportDerived | null>(() => (report === null ? null : { timeNotices, overlay }), [report, timeNotices, overlay]);

  /* 창 수준 리스너 */
  const listen = env.windowListeners !== false;
  useEffect(() => {
    if (!listen) return undefined;
    const offPop = history.onPop((s) => actions.popTo(s));
    const offDrop = installWindowDrop((files) => actions.windowDrop(files));
    const offCompact = installCompact();
    return () => {
      offPop();
      offDrop();
      offCompact();
    };
  }, [listen, history, actions]);

  /* <html> 루트 표식: file://(cc-file) · 화면 가리기(cc-screen-mask, 실제 리포트만) */
  useEffect(() => {
    document.documentElement.classList.toggle("cc-file", offline);
  }, [offline]);
  const real = report !== null && report.mode.kind === "real";
  useEffect(() => {
    document.documentElement.classList.toggle("cc-screen-mask", real && state.view.screenMask);
    return () => document.documentElement.classList.remove("cc-screen-mask");
  }, [real, state.view.screenMask]);

  /* 리포트 유실 방지 장치 1: 실제 리포트가 메모리에 있을 때만 beforeunload */
  useEffect(() => {
    if (!listen) return undefined;
    syncUnloadGuard(real);
    return () => syncUnloadGuard(false);
  }, [listen, real]);

  /* 화면 전환 4단계 */
  const fixTitle = useMemo(() => {
    if (state.fixRuleId === null) return null;
    const entry = catalogById.get(state.fixRuleId);
    return entry === undefined ? null : t(entry.titleKey);
  }, [state.fixRuleId, catalogById]);
  const demoReport = report !== null && report.mode.kind === "demo";
  useLayoutEffect(() => {
    document.title = documentTitle(state.screen, { demoReport, fixTitle });
    if (state.navSeq === 0) return; // 첫 화면: 포커스를 빼앗지 않고 낭독하지 않는다(첫 Tab이 '본문으로 건너뛰기'가 되게)
    const heading = findHeading();
    const restore = state.focus === "restore" ? actions.takeRestoreTarget() : null;
    const target = restore !== null && restore.isConnected && restore.closest("[hidden]") === null ? restore : heading;
    if (target !== null) target.focus({ preventScroll: true });
    setScrollTop(state.restoreScroll ? state.view.scroll.report ?? 0 : 0);
    const text = liveText(state.screen, { cloud: state.cloud, report, fixTitle, comparison: state.comparison });
    if (text !== null) actions.say(text);
    // navSeq가 바뀔 때만(다른 값은 그 시점의 최신을 읽는다)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.navSeq]);

  const value = useMemo<AppValue>(
    () => ({ state, actions, deps, availability, offline, catalogById, derived }),
    [state, actions, deps, availability, offline, catalogById, derived],
  );
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

