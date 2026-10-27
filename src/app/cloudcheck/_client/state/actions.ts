// src/app/cloudcheck/_client/state/actions.ts — 화면이 부르는 동작(전이표 T1~T20, 파일 읽기, 예외, 비교 …). 소유: 페이지개발자.
// React를 모른다: store(동기 저장소) + deps(엔진 주입) + history(pushState 관문) + clock(시각 한 곳)만 받는다 → 화면 없이 단위 시험한다.
// 근거: UX §3-5 전이표·§5 상태 매트릭스·§6 인터랙션, 디자인 최종안 §6-0.
import type { ExceptionsFile } from "../../../../lib/cloudcheck/contract/exceptions-schema";
import type { Cloud, DemoSetId, InputRecognition, IsoDate, IsoUtc, ItemResult, RuleId } from "../../../../lib/cloudcheck/model/report";
import { canCollect, MAX_FILES, type Availability } from "../config";
import { t } from "../i18n/index";
import { selfAnswerKey } from "../components/GuideCard";
import type { EngineDeps } from "./deps";
import { addException, EXC_FILE_MAX_BYTES, firstIssue, makeEntry, removeException } from "./exceptions";
import type { HistoryGate } from "./history";
import { buildReport, nextFrames, readFiles, readBytes, recognizeDemo, recognizeText, uncollectableCloud } from "./pipeline";
import { printReport, type PrintOptions } from "./print";
import { factsOf, type Action, type AppState, type FocusTarget, type InputTab, type PrepPath, type SelfAnswer } from "./reducer";
import { resolveScreen, type ScreenId } from "./screens";
import type { Store } from "./store";

export interface ActionContext {
  readonly store: Store<AppState, Action>;
  readonly deps: EngineDeps;
  readonly history: HistoryGate;
  readonly availability: Availability;
  readonly clock: { readonly now: () => IsoUtc; readonly today: () => IsoDate };
  /** 지금 스크롤 위치(떠나는 화면에 기억) */
  readonly scrollY: () => number;
  /** 화면이 막 그려지도록 기다린다(기본 두 프레임. 테스트는 즉시 해소로 바꾼다) */
  readonly frames?: (n?: number) => Promise<void>;
}

interface ShowOptions {
  readonly push?: boolean;
  readonly focus?: FocusTarget;
  readonly restoreScroll?: boolean;
}

export function createActions(ctx: ActionContext) {
  const { store, deps, history, availability } = ctx;
  const get = store.getState;
  const dispatch = store.dispatch;
  const frames = ctx.frames ?? nextFrames;
  const stamp = (): { readonly now: IsoUtc; readonly today: IsoDate } => ({ now: ctx.clock.now(), today: ctx.clock.today() });
  const say = (text: string, kind: "polite" | "assertive" = "polite"): void => dispatch({ type: "announce", kind, text });

  let pendingConfirm: (() => void) | null = null;
  let chain: Promise<void> = Promise.resolve();
  let pressed: HTMLElement | null = null;
  let restoreTarget: HTMLElement | null = null;
  let recentFiles = new WeakSet<File>();
  /** 같은 놓기에서 폴더가 먼저 알려진 경우(파일과 함께 놓았을 때 폴더 안내가 사라지지 않게) */
  let folderPending = false;

  /* ───────── 화면 이동 ───────── */
  function show(screen: ScreenId, o: ShowOptions = {}): void {
    const s = get();
    const target = resolveScreen(screen, factsOf(s));
    if (target === s.screen) return;
    if (o.push !== false) history.push(target);
    dispatch({ type: "show", screen: target, ...stamp(), focus: o.focus, restoreScroll: o.restoreScroll, scrollY: ctx.scrollY() });
  }

  /** popstate: 필요한 데이터가 없으면 V0. V4에서 V3로 돌아오면 스크롤·포커스를 복원한다 */
  function popTo(screen: ScreenId | null): void {
    const s = get();
    const target = resolveScreen(screen ?? "start", factsOf(s));
    if (target === s.screen) return;
    const fromFix = s.screen === "fix" && target === "report";
    dispatch({ type: "show", screen: target, ...stamp(), focus: fromFix ? "restore" : "heading", restoreScroll: fromFix, scrollY: ctx.scrollY() });
  }

  /** 앱 안 [← 돌아가기]: 이 문서가 push한 적이 있으면 history.back(), 없으면(또는 이력 없는 모드) 메모리의 돌아갈 곳 */
  function back(): void {
    if (history.pushed() && !history.disabled()) history.back();
    else show(get().returnTo, { push: false });
  }

  function navMenu(to: "start" | "catalog" | "about"): void {
    show(to);
  }

  /* ───────── 확인 대화상자(리포트 닫기) ───────── */
  function askConfirm(then: () => void): void {
    pendingConfirm = then;
    dispatch({ type: "confirm", open: true });
  }
  function confirmStay(): void {
    pendingConfirm = null;
    dispatch({ type: "confirm", open: false });
  }
  function confirmGo(): void {
    const run = pendingConfirm;
    pendingConfirm = null;
    dispatch({ type: "confirm", open: false });
    if (run !== null) run();
  }

  const resetAll = (): void => dispatch({ type: "reset", ...stamp() });
  const hasRealReport = (): boolean => {
    const r = get().report;
    return r !== null && r.mode.kind === "real";
  };
  /** 새 점검을 시작하는 길(T1~T4·T11): 실제 리포트가 있으면 확인, 체험 리포트는 확인 없이 닫는다 */
  function guardNew(run: () => void): void {
    const go = (): void => {
      resetAll();
      run();
    };
    if (hasRealReport()) askConfirm(go);
    else go();
  }

  /* ───────── V0 ───────── */
  function startCollect(cloud: Cloud): void {
    if (!canCollect(cloud, availability)) {
      dispatch({ type: "set-azure-open", open: !get().view.azureOpen });
      return;
    }
    guardNew(() => {
      dispatch({ type: "select-cloud", cloud });
      show("prep");
    });
  }
  function startDemoFlow(): void {
    guardNew(() => show("demo"));
  }
  function haveFile(): void {
    const go = (): void => {
      if (get().report !== null) resetAll();
      dispatch({ type: "select-cloud", cloud: null });
      show("input");
    };
    if (hasRealReport()) askConfirm(go);
    else go();
  }
  const resume = (): void => show("report");
  const toggleAzureNote = (): void => dispatch({ type: "set-azure-open", open: !get().view.azureOpen });
  /** Azure 안내의 [Azure 체험 보기] — 체험 화면으로, 클라우드는 Azure로 */
  function azureDemo(): void {
    guardNew(() => {
      dispatch({ type: "set-demo-cloud", cloud: "azure" });
      show("demo");
    });
  }

  /* ───────── V1 ───────── */
  function changeCloud(): void {
    const s = get();
    const other: Cloud = (s.cloud ?? "aws") === "aws" ? "azure" : "aws";
    if (canCollect(other, availability)) dispatch({ type: "select-cloud", cloud: other });
  }
  const setPrepPath = (path: PrepPath): void => dispatch({ type: "set-prep-path", path });
  const toInput = (): void => show("input");
  function downloaded(ok: boolean): void {
    dispatch({ type: "download-failed", failed: !ok });
    say(ok ? t("cc.app.live.downloaded") : t("cc.app.download.fail"));
  }

  /* ───────── V2 ───────── */
  const setTab = (tab: InputTab): void => dispatch({ type: "set-tab", tab });

  /** 읽기와 만들기는 차례로 한다(두 번 놓아도 순서가 섞이지 않게) */
  function enqueue(job: () => Promise<void>): Promise<void> {
    const run = async (): Promise<void> => {
      try {
        await job();
      } catch {
        // 인식·판정 중 예상 못 한 오류: 읽는 중 표시를 거두고 화면에 남는다(리포트를 만들지 않는다)
        dispatch({ type: "busy", busy: null });
      }
    };
    chain = chain.then(run);
    return chain;
  }

  /**
   * 실제 점검을 열지 않은 클라우드의 실제 입력(STEP 5 기획팀장 결정 §8-A — 지금은 Azure): 리포트를 만들지 않는다는 것을 알린다.
   * 문구는 V0과 같은 기존 키(cc.start.azure-soon.note — 새 키 없음). Azure 말고 다른 클라우드가 준비 중이 되는 일은 지금 없다.
   */
  const refuseCloud = (): void => say(t("cc.start.azure-soon.note"), "assertive");

  function announceRead(recs: readonly InputRecognition[]): void {
    if (recs.some((r) => r.status === "credentials-file")) {
      say(t("cc.recog.credentials-file.title"), "assertive");
      return;
    }
    const ok = recs.filter((r) => r.status === "ok").length;
    if (ok > 0) {
      say(t("cc.app.live.read-n", { n: ok }));
      if (uncollectableCloud(recs, availability) !== null) refuseCloud();
      return;
    }
    const bad = recs.find((r) => r.status !== "ok");
    if (bad !== undefined) say(t(`cc.recog.${bad.status}.title` as `cc.recog.${string}`));
  }

  function onFiles(list: readonly File[]): Promise<void> {
    const files = list.slice(0, MAX_FILES);
    for (const f of files) recentFiles.add(f);
    // 같은 이벤트 안의 창 전체 드롭 처리기가 다시 읽지 않도록 이번 틱 동안만 기억한다
    setTimeout(() => {
      recentFiles = new WeakSet<File>();
    }, 0);
    const over = list.length > MAX_FILES;
    const folderAtCall = folderPending;
    folderPending = false;
    return enqueue(async () => {
      dispatch({ type: "busy", busy: "reading" });
      say(t("cc.app.live.reading"));
      await frames();
      const res = await readFiles(files, deps, get().recs.length);
      dispatch({ type: "recs-add", recs: res.recs });
      dispatch({ type: "busy", busy: null });
      const folder = folderAtCall || res.unreadable > 0;
      if (over) dispatch({ type: "notice", notice: "too-many" });
      else if (folder) dispatch({ type: "notice", notice: "folder" });
      if (over) say(t("cc.input.too-many", { max: MAX_FILES }));
      else if (folder) say(t("cc.input.folder"));
      else announceRead(res.recs);
    });
  }

  function onPasteText(text: string): Promise<void> {
    return enqueue(async () => {
      dispatch({ type: "busy", busy: "reading" });
      say(t("cc.app.live.reading"));
      await frames();
      const n = get().recs.filter((r) => r.rec.via === "paste").length + 1;
      const rec = recognizeText(text, deps, n);
      dispatch({ type: "recs-add", recs: [rec] });
      dispatch({ type: "busy", busy: null });
      announceRead([rec]);
    });
  }
  /** 폴더를 놓았다: 읽지 않고 안내한다(DropZone이 폴더를 files에서 뺀다) */
  function onFolder(): void {
    folderPending = true;
    setTimeout(() => {
      folderPending = false;
    }, 0);
    dispatch({ type: "notice", notice: "folder" });
    say(t("cc.input.folder"));
  }
  function onPasteNonText(): void {
    dispatch({ type: "notice", notice: "paste-not-text" });
    say(t("cc.input.paste-not-text"));
  }
  function removeRec(key: number): void {
    const s = get();
    const index = s.recs.findIndex((r) => r.key === key);
    if (index < 0) return;
    dispatch({ type: "recs-remove", key });
    say(t("cc.app.live.removed", { n: index + 1 }));
  }
  function clearRecs(): void {
    dispatch({ type: "recs-clear" });
    say(t("cc.app.live.cleared"));
  }

  /**
   * [이 계정으로 리포트 보기] / 비교 모드 [비교 보기] (T7·T8).
   * STEP 5 기획팀장 결정 §8-A: canCollect(cloud)가 거짓인 클라우드(지금은 Azure — '준비 중')의 실제 입력으로는 리포트를 만들지 않는다.
   * 화면(V2)도 버튼을 막지만, 여기서 한 번 더 막는다 — 판정 전(인식 결과의 신원·입력 종류)과 판정 뒤(리포트 신원) 두 번. 체험(openDemo)은 이 길을 지나지 않는다.
   */
  function build(): Promise<void> {
    return enqueue(async () => {
      const s = get();
      if (s.busy === "building") return;
      if (uncollectableCloud(s.recs.map((r) => r.rec), availability) !== null) {
        refuseCloud();
        return;
      }
      dispatch({ type: "busy", busy: "building" });
      say(t("cc.app.live.building"));
      await frames();
      const out = buildReport(
        deps,
        get().recs.map((r) => r.rec),
      );
      if (!out.ok) {
        dispatch({ type: "busy", busy: null });
        return;
      }
      if (!canCollect(out.report.identity.cloud, availability)) {
        dispatch({ type: "busy", busy: null });
        refuseCloud();
        return;
      }
      const base = get().compareBase;
      if (base !== null) {
        const comparison = deps.compare(base, out.report);
        dispatch({ type: "compare-ready", comparison, after: { report: out.report, input: out.input } });
        show("compare");
        return;
      }
      dispatch({ type: "report-ready", report: out.report, input: out.input });
      show("report");
    });
  }

  /* ───────── V6 체험 ───────── */
  const setDemoCloud = (cloud: Cloud): void => dispatch({ type: "set-demo-cloud", cloud });
  /**
   * 체험 회사 리포트를 연다. 디자인 결정 D-5(docs/design/cloudcheck-rule-copy-review.md §8-8): 다른 체험 리포트가 이미 있으면 본인 응답·예외 표시를 비운다
   * — 가짜 회사 A의 라벨이 B의 같은 점검에 붙어 '이미 확인함'처럼 읽히지 않게(실제 리포트의 '새 점검' 규칙과 같게). 같은 리포트로 되돌아갈 때(뒤로 가기)는 이 길을 지나지 않아 그대로다.
   */
  function openDemo(set: DemoSetId): Promise<void> {
    return enqueue(async () => {
      const rec = recognizeDemo(deps, get().demoCloud, set);
      if (rec === null) {
        say(t("cc.start.offline.soon"));
        return;
      }
      dispatch({ type: "busy", busy: "building" });
      say(t("cc.app.live.building"));
      await frames();
      const out = buildReport(deps, [rec]);
      if (!out.ok) {
        dispatch({ type: "busy", busy: null });
        say(t("cc.start.offline.soon"));
        return;
      }
      if (get().report !== null) dispatch({ type: "clear-annotations" });
      dispatch({ type: "report-ready", report: out.report, input: null });
      show("report");
    });
  }

  /* ───────── V3 ───────── */
  /** 누른 버튼을 기억한다(V4 → V3 복귀 때 포커스를 돌려줄 곳). App이 click 캡처에서 부른다 */
  const rememberPressed = (el: HTMLElement | null): void => {
    pressed = el;
  };
  const takeRestoreTarget = (): HTMLElement | null => {
    const el = restoreTarget;
    restoreTarget = null;
    return el;
  };
  function openFix(ruleId: RuleId): void {
    restoreTarget = pressed;
    dispatch({ type: "fix-target", ruleId });
    show("fix");
  }
  const toggleRule = (ruleId: RuleId): void => dispatch({ type: "toggle-rule", ruleId });
  const openRule = (ruleId: RuleId): void => dispatch({ type: "open-rule", ruleId });
  const moreTargets = (ruleId: RuleId): void => dispatch({ type: "table-more", ruleId });
  const openForm = (itemId: string | null): void => dispatch({ type: "form", itemId });
  const setFold = (id: string, open: boolean): void => dispatch({ type: "fold", id, open });

  function saveException(item: ItemResult, v: { readonly reason: string; readonly until: IsoDate }): void {
    const s = get();
    const res = addException(deps, s.exceptions, makeEntry(item, v, ctx.clock.today()));
    if (!res.ok) {
      say(t(`cc.report.exc.issue.${firstIssue(res.issues)}`), "assertive");
      return;
    }
    dispatch({ type: "exceptions", file: res.file });
    dispatch({ type: "form", itemId: null });
    say(t("cc.app.live.exception-added"));
  }
  function removeExceptionFor(item: ItemResult): void {
    dispatch({ type: "exceptions", file: removeException(get().exceptions, item) });
    say(t("cc.app.live.exception-removed"));
  }
  /** 예외 파일 불러오기: 글자로 읽어 parseExceptions. 실패하면 사유 한 줄(cc.report.exc.import-fail) */
  async function importExceptions(file: File): Promise<void> {
    if (file.size > EXC_FILE_MAX_BYTES) {
      dispatch({ type: "exceptions", file: get().exceptions, issue: "too-many" });
      say(t("cc.report.exc.import-fail", { reason: t("cc.report.exc.issue.too-many") }));
      return;
    }
    const bytes = await readBytes(file);
    const text = bytes === null ? null : new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    const res: { ok: true; file: ExceptionsFile } | { ok: false; issues: readonly string[] } = text === null ? { ok: false, issues: ["format"] } : deps.parseExceptions(text);
    if (!res.ok) {
      const issue = firstIssue(res.issues);
      dispatch({ type: "exceptions", file: get().exceptions, issue });
      say(t("cc.report.exc.import-fail", { reason: t(`cc.report.exc.issue.${issue}`) }));
      return;
    }
    dispatch({ type: "exceptions", file: res.file });
    say(t("cc.app.live.exception-added"));
  }
  /** 본인 응답은 메모리에만 둔다. 키는 GuideCard·ManualCheckList·DoorSection이 같이 쓰는 selfAnswerKey(점검 ID, 단계 ID) */
  const setSelfAnswer = (ruleId: RuleId, stepId: string, answer: SelfAnswer): void => dispatch({ type: "self-answer", key: selfAnswerKey(ruleId, stepId), answer });

  const togglePrint = (): void => dispatch({ type: "print-toggle" });
  function print(opts: PrintOptions): void {
    dispatch({ type: "print-options", opts });
    printReport(opts);
  }
  const setPrintOptions = (opts: PrintOptions): void => dispatch({ type: "print-options", opts });
  const setScreenMask = (on: boolean): void => dispatch({ type: "screen-mask", on });

  function startCompare(): void {
    dispatch({ type: "compare-base" });
    show("input");
  }
  function newInspection(): void {
    guardNew(() => show("start"));
  }
  const otherCompany = (): void => show("demo");
  function tryReal(): void {
    const cloud = get().report?.identity.cloud ?? "aws";
    resetAll();
    dispatch({ type: "select-cloud", cloud });
    show("prep");
  }

  /* ───────── V4 · V5 ───────── */
  /** V4 [고친 뒤 다시 수집해서 비교하기 →]: 실제 리포트면 재수집 모드(compareBase=report)로 V1, 체험이면 학습용 계정으로 */
  function fixCta(): void {
    const r = get().report;
    if (r === null) return;
    if (r.mode.kind === "demo") {
      tryReal();
      return;
    }
    dispatch({ type: "compare-base" });
    dispatch({ type: "select-cloud", cloud: r.identity.cloud });
    show("prep");
  }
  function backToReport(): void {
    if (get().screen === "fix" && history.pushed() && !history.disabled()) {
      history.back();
      return;
    }
    show("report", { push: false, focus: "restore", restoreScroll: true });
  }
  const moreFixTargets = (): void => dispatch({ type: "fix-more" });
  function acceptAfter(): void {
    dispatch({ type: "compare-accept" });
    show("report");
  }
  function compareAgain(): void {
    dispatch({ type: "compare-cancel" });
    dispatch({ type: "recs-clear" });
    show("input");
  }
  function leaveCompare(): void {
    dispatch({ type: "compare-exit" });
    show("report");
  }

  /* ───────── 창 전체 드롭(Q8) ───────── */
  function windowDrop(files: readonly File[]): void {
    if (files.length === 0 || files.some((f) => recentFiles.has(f))) return;
    const s = get();
    switch (s.screen) {
      case "input":
        void onFiles(files);
        return;
      case "start":
      case "prep":
        show("input");
        void onFiles(files);
        return;
      case "report":
      case "fix":
      case "compare":
        say(t("cc.app.drop.ignored-report"));
        return;
      default:
        say(t("cc.app.drop.ignored"));
    }
  }

  return {
    show, popTo, back, navMenu,
    askConfirm, confirmStay, confirmGo,
    startCollect, startDemoFlow, haveFile, resume, toggleAzureNote, azureDemo,
    changeCloud, setPrepPath, toInput, downloaded,
    setTab, onFiles, onFolder, onPasteText, onPasteNonText, removeRec, clearRecs, build,
    setDemoCloud, openDemo,
    rememberPressed, takeRestoreTarget, openFix, toggleRule, openRule, moreTargets, openForm, setFold,
    saveException, removeExceptionFor, importExceptions, setSelfAnswer,
    togglePrint, print, setPrintOptions, setScreenMask,
    startCompare, newInspection, otherCompany, tryReal,
    fixCta, backToReport, moreFixTargets, acceptAfter, compareAgain, leaveCompare,
    windowDrop, say,
  };
}

export type Actions = ReturnType<typeof createActions>;
