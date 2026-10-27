// @vitest-environment jsdom
// src/app/cloudcheck/_client/state/state.test.tsx — 상태 층 단위 시험(화면 없이): reducer · actions(전이표 T1~T20) · history 관문 · 유실 방지 장치 · 보조 모듈.
// 엔진은 목업 EngineDeps(state/deps.mock.ts). 실제 엔진이 연결되면 같은 시험을 실제 judge() 출력으로 다시 돌린다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExceptionsFile } from "../../../../lib/cloudcheck/contract/exceptions-schema";
import type { InputRecognition, IsoDate, IsoUtc, ItemResult } from "../../../../lib/cloudcheck/model/report";
import { MOCK_REPORTS, REPORT_REAL_D } from "../mocks/reports";
import { createActions, type ActionContext } from "./actions";
import { createMockDeps } from "./deps.mock";
import { addDays, daysBetween, isIsoDate, nowIso, todayLocal } from "./clock";
import { installCompact } from "./compact";
import { installWindowDrop } from "./drop";
import { createHistoryGate, type HistoryGate } from "./history";
import { announce, EMPTY_LIVE } from "./live";
import { cloudOfRec, pastedCsvWithoutAsOf, uncollectableCloud } from "./pipeline";
import { printReport } from "./print";
import { initialState, reducer, type Action, type AppState } from "./reducer";
import { bandKind, documentTitle, isDemoScreen, liveText, resolveScreen, screenReady, type ScreenId } from "./screens";
import { createStore } from "./store";
import { syncUnloadGuard, unloadGuardActive } from "./unload";

const NOW = "2026-10-20T03:12:00Z" as IsoUtc;
const TODAY = "2026-10-20" as IsoDate;

function fakeHistory(opts: { failPush?: boolean } = {}): HistoryGate & { readonly log: ScreenId[]; backs: number } {
  let pushed = false;
  let disabled = false;
  const log: ScreenId[] = [];
  const gate = {
    log,
    backs: 0,
    push(screen: ScreenId): boolean {
      if (disabled) return false;
      if (opts.failPush === true) {
        disabled = true;
        return false;
      }
      pushed = true;
      log.push(screen);
      return true;
    },
    pushed: () => pushed,
    disabled: () => disabled,
    back() {
      gate.backs += 1;
    },
    current: () => null,
    onPop: () => () => undefined,
  };
  return gate;
}

function setup(opts: { availability?: ActionContext["availability"]; failPush?: boolean } = {}) {
  const store = createStore<AppState, Action>(reducer, initialState({ now: NOW, today: TODAY }));
  const history = fakeHistory({ failPush: opts.failPush });
  const deps = createMockDeps();
  const actions = createActions({
    store,
    deps,
    history,
    availability: opts.availability ?? { aws: "beta", azure: "soon" },
    clock: { now: () => NOW, today: () => TODAY },
    scrollY: () => 120,
    frames: async () => undefined,
  });
  return { store, history, deps, actions, get: store.getState };
}

const file = (name: string, content = "{}"): File => new File([content], name, { type: "application/json" });

async function buildRealReport(s: ReturnType<typeof setup>): Promise<void> {
  await s.actions.onFiles([file("result.json")]);
  await s.actions.build();
}

describe("reducer · 화면 전환과 데이터 가드", () => {
  it("필요한 데이터가 없는 화면(V3·V4·V5)은 V0으로 간다", () => {
    const s0 = initialState({ now: NOW, today: TODAY });
    for (const screen of ["report", "fix", "compare"] as const) {
      const s1 = reducer(s0, { type: "show", screen, now: NOW, today: TODAY });
      expect(s1.screen).toBe("start");
    }
    expect(reducer(s0, { type: "show", screen: "catalog", now: NOW, today: TODAY }).screen).toBe("catalog");
  });
  it("show는 navSeq를 올리고, 떠나는 화면의 스크롤 위치를 기억하며, V7·V8의 돌아갈 곳을 정한다", () => {
    let s = initialState({ now: NOW, today: TODAY });
    s = reducer(s, { type: "show", screen: "prep", now: NOW, today: TODAY, scrollY: 77 });
    expect(s.navSeq).toBe(1);
    expect(s.view.scroll.start).toBe(77);
    s = reducer(s, { type: "show", screen: "about", now: NOW, today: TODAY });
    expect(s.returnTo).toBe("prep");
    s = reducer(s, { type: "show", screen: "catalog", now: NOW, today: TODAY });
    expect(s.returnTo).toBe("prep");
  });
  it("report-ready는 새 리포트로 보기 상태를 비우고 예외·본인 응답은 새 점검까지 이어 간다", () => {
    let s = initialState({ now: NOW, today: TODAY });
    s = reducer(s, { type: "self-answer", key: "AZ-MFA-G:step-1", answer: "yes" });
    s = reducer(s, { type: "open-rule", ruleId: "AWS-NET-1" });
    s = reducer(s, { type: "report-ready", report: REPORT_REAL_D, input: null });
    expect(s.view.openRules.size).toBe(0);
    expect(s.selfAnswers["AZ-MFA-G:step-1"]).toBe("yes");
    expect(s.reportSeq).toBe(1);
  });
  it("reset은 데이터를 모두 비우되 화면 전환 번호와 낭독 문구는 이어 간다", () => {
    let s = initialState({ now: NOW, today: TODAY });
    s = reducer(s, { type: "report-ready", report: REPORT_REAL_D, input: null });
    s = reducer(s, { type: "announce", kind: "polite", text: "x" });
    s = reducer(s, { type: "reset", now: NOW, today: TODAY });
    expect(s.report).toBeNull();
    expect(s.live.polite).toBe("x");
  });
  it("toggle-rule · table-more · fix-more", () => {
    let s = initialState({ now: NOW, today: TODAY });
    s = reducer(s, { type: "toggle-rule", ruleId: "AWS-KEY-1" });
    expect(s.view.openRules.has("AWS-KEY-1")).toBe(true);
    s = reducer(s, { type: "toggle-rule", ruleId: "AWS-KEY-1" });
    expect(s.view.openRules.has("AWS-KEY-1")).toBe(false);
    s = reducer(s, { type: "table-more", ruleId: "AWS-KEY-1" });
    expect(s.view.tableShown["AWS-KEY-1"]).toBe(100);
    s = reducer(s, { type: "fix-more" });
    expect(s.view.fixShown).toBe(100);
  });
});

describe("screens · 제목 · 낭독 · 띠", () => {
  it("document.title은 사용자 데이터 없이 '화면 이름 · 문단속 5'", () => {
    expect(documentTitle("start", { demoReport: false, fixTitle: null })).toBe("문단속 5");
    expect(documentTitle("prep", { demoReport: false, fixTitle: null })).toBe("수집 준비 · 문단속 5");
    expect(documentTitle("report", { demoReport: true, fixTitle: null })).toBe("체험 리포트 · 문단속 5");
    expect(documentTitle("fix", { demoReport: false, fixTitle: "콘솔 사용자 MFA" })).toBe("고치는 법 · 콘솔 사용자 MFA · 문단속 5");
  });
  it("V3 낭독은 분포 다섯 상태를 모두 읽고, 체험이면 앞에 '체험 모드입니다.'", () => {
    const real = liveText("report", { cloud: "aws", report: REPORT_REAL_D, fixTitle: null, comparison: null }) ?? "";
    for (const w of ["위험", "주의", "확인 불가", "이상 없음", "해당 없음"]) expect(real).toContain(w);
    expect(real.startsWith("체험")).toBe(false);
    const demo = liveText("report", { cloud: "aws", report: MOCK_REPORTS.C, fixTitle: null, comparison: null }) ?? "";
    expect(demo.startsWith("체험 모드입니다.")).toBe(true);
    expect(liveText("catalog", { cloud: null, report: null, fixTitle: null, comparison: null })).toBeNull();
  });
  it("띠 선택: 체험 화면이면 체험 띠(베타 띠를 대신), 그 밖은 베타 단계인 동안 베타 띠", () => {
    expect(bandKind("start", null)).toBe("beta");
    expect(bandKind("demo", null)).toBe("demo");
    expect(bandKind("report", MOCK_REPORTS.A)).toBe("demo");
    expect(bandKind("report", REPORT_REAL_D)).toBe("beta");
    expect(bandKind("start", null, { aws: "open", azure: "soon" })).toBeNull();
    expect(isDemoScreen("catalog", MOCK_REPORTS.A)).toBe(false);
  });
  it("screenReady · resolveScreen", () => {
    const none = { hasReport: false, hasFixTarget: false, hasComparison: false };
    expect(screenReady("fix", { ...none, hasReport: true })).toBe(false);
    expect(resolveScreen("fix", { ...none, hasReport: true, hasFixTarget: true })).toBe("fix");
    expect(resolveScreen("compare", none)).toBe("start");
  });
});

describe("actions · V0 → V1 (T1~T5)", () => {
  it("[AWS 점검 시작] → V1, cloud=aws, history에 화면 ID가 쌓인다", () => {
    const s = setup();
    s.actions.startCollect("aws");
    expect(s.get().screen).toBe("prep");
    expect(s.get().cloud).toBe("aws");
    expect(s.history.log).toEqual(["prep"]);
  });
  it("Azure가 준비 중이면 이동 없이 같은 자리 안내만 여닫는다(T2)", () => {
    const s = setup();
    s.actions.startCollect("azure");
    expect(s.get().screen).toBe("start");
    expect(s.get().view.azureOpen).toBe(true);
    expect(s.history.log).toEqual([]);
    s.actions.toggleAzureNote();
    expect(s.get().view.azureOpen).toBe(false);
  });
  it("Azure가 열리면(beta) 일반 이동", () => {
    const s = setup({ availability: { aws: "beta", azure: "beta" } });
    s.actions.startCollect("azure");
    expect(s.get().screen).toBe("prep");
    expect(s.get().cloud).toBe("azure");
  });
  it("실제 리포트가 있으면 확인을 거친다: 머무르면 그대로, 닫고 계속하면 초기화 뒤 이동(T1·T3·T4·T11)", async () => {
    const s = setup();
    await buildRealReport(s);
    expect(s.get().screen).toBe("report");
    s.actions.show("start");
    s.actions.startCollect("aws");
    expect(s.get().confirmOpen).toBe(true);
    expect(s.get().screen).toBe("start");
    s.actions.confirmStay();
    expect(s.get().confirmOpen).toBe(false);
    expect(s.get().report).not.toBeNull();
    s.actions.startDemoFlow();
    s.actions.confirmGo();
    expect(s.get().report).toBeNull();
    expect(s.get().screen).toBe("demo");
    s.actions.show("start");
    s.actions.haveFile();
    expect(s.get().screen).toBe("input");
    expect(s.get().cloud).toBeNull();
  });
  it("체험 리포트는 확인 없이 닫힌다", async () => {
    const s = setup();
    document.body.innerHTML = '<script type="application/json" id="cc-demo-aws-C">{}</script>';
    s.actions.startDemoFlow();
    expect(s.get().screen).toBe("demo");
    await s.actions.openDemo("C");
    expect(s.get().report?.mode.kind).toBe("demo");
    s.actions.newInspection();
    expect(s.get().confirmOpen).toBe(false);
    expect(s.get().screen).toBe("start");
    expect(s.get().report).toBeNull();
  });
  it("[리포트로 돌아가기]는 데이터가 있을 때만 V3로 간다", async () => {
    const s = setup();
    s.actions.resume();
    expect(s.get().screen).toBe("start");
    await buildRealReport(s);
    s.actions.show("start");
    s.actions.resume();
    expect(s.get().screen).toBe("report");
  });
  it("같은 화면으로의 이동은 push하지 않는다(화면 ID가 바뀔 때만)", () => {
    const s = setup();
    s.actions.show("catalog");
    s.actions.show("catalog");
    s.actions.navMenu("about");
    expect(s.history.log).toEqual(["catalog", "about"]);
  });
});

describe("actions · V2 입력 (파일 · 붙여넣기 · 상한)", () => {
  it("파일 하나를 읽으면 목록에 한 줄, 낭독은 '파일 1개를 읽었습니다.'", async () => {
    const s = setup();
    await s.actions.onFiles([file("result.json")]);
    expect(s.get().recs).toHaveLength(1);
    expect(s.get().recs[0]?.rec.status).toBe("ok");
    expect(s.get().live.polite).toBe("파일 1개를 읽었습니다.");
    expect(s.get().busy).toBeNull();
  });
  it("크기 상한을 넘으면 읽지 않고 too-large 행을 만든다(file.size 선검사)", async () => {
    const s = setup();
    const big = file("huge.json");
    Object.defineProperty(big, "size", { value: 26 * 1024 * 1024 });
    const spy = vi.spyOn(FileReader.prototype, "readAsArrayBuffer");
    await s.actions.onFiles([big]);
    expect(spy).not.toHaveBeenCalled();
    expect(s.get().recs[0]?.rec.status).toBe("too-large");
    const csv = file("big.csv");
    Object.defineProperty(csv, "size", { value: 21 * 1024 * 1024 });
    await s.actions.onFiles([csv]);
    expect(s.get().recs[1]?.rec.status).toBe("too-large");
    const okCsv = file("small.csv");
    Object.defineProperty(okCsv, "size", { value: 19 * 1024 * 1024 });
    await s.actions.onFiles([okCsv]);
    expect(s.get().recs[2]?.rec.status).not.toBe("too-large");
  });
  it("한 번에 8개까지만 읽고 나머지는 안내한다", async () => {
    const s = setup();
    await s.actions.onFiles(Array.from({ length: 10 }, (_, i) => file(`r${i}.json`)));
    expect(s.get().recs).toHaveLength(8);
    expect(s.get().notice).toBe("too-many");
    expect(s.get().live.polite).toContain("8개까지");
  });
  it("폴더처럼 읽을 수 없는 항목은 건너뛰고 폴더 안내", async () => {
    const s = setup();
    const dir = file("folder");
    Object.defineProperty(dir, "arrayBuffer", { value: () => Promise.reject(new Error("dir")) });
    await s.actions.onFiles([dir]);
    expect(s.get().recs).toHaveLength(0);
    expect(s.get().notice).toBe("folder");
  });
  it("키 파일은 assertive 낭독으로 알린다", async () => {
    const s = setup();
    await s.actions.onFiles([file("credentials.json", "x")]);
    expect(s.get().recs[0]?.rec.status).toBe("credentials-file");
    expect(s.get().live.assertive).not.toBe("");
  });
  it("붙여넣기: 글자는 바로 읽고 입력칸에 남기지 않는다. 글자가 아니면 안내", async () => {
    const s = setup();
    await s.actions.onPasteText('{"a":1}');
    expect(s.get().recs[0]?.rec.via).toBe("paste");
    s.actions.onPasteNonText();
    expect(s.get().notice).toBe("paste-not-text");
  });
  it("빼기·모두 비우기는 낭독한다", async () => {
    const s = setup();
    await s.actions.onFiles([file("a.json"), file("b.json")]);
    const key = s.get().recs[1]?.key ?? -1;
    s.actions.removeRec(key);
    expect(s.get().recs).toHaveLength(1);
    expect(s.get().live.polite).toBe("2번째 파일을 뺐습니다.");
    s.actions.clearRecs();
    expect(s.get().recs).toHaveLength(0);
  });
  it("[이 계정으로 리포트 보기] → 리포트를 만들고 V3 (읽을 수 있는 입력이 없으면 V2에 남는다)", async () => {
    const s = setup();
    await s.actions.onFiles([file("cut.json")]);
    await s.actions.build();
    expect(s.get().screen).toBe("start");
    expect(s.get().report).toBeNull();
    expect(s.get().busy).toBeNull();
    s.actions.show("input");
    await s.actions.clearRecs();
    await s.actions.onFiles([file("result.json")]);
    await s.actions.build();
    expect(s.get().screen).toBe("report");
    expect(s.get().report?.mode.kind).toBe("real");
    expect(s.get().reportSeq).toBe(1);
  });
});

describe("actions · V3 → V4 → V5 → 재수집 (T9~T14)", () => {
  it("[고치는 법] → V4, ← 리포트로: history.back() (push한 적이 있으면)", async () => {
    const s = setup();
    await buildRealReport(s);
    s.actions.openFix("AWS-NET-1");
    expect(s.get().screen).toBe("fix");
    expect(s.get().fixRuleId).toBe("AWS-NET-1");
    s.actions.backToReport();
    expect(s.history.backs).toBe(1);
  });
  it("popstate로 V4 → V3: 스크롤·포커스를 복원 대상으로 표시한다", async () => {
    const s = setup();
    await buildRealReport(s);
    s.actions.openFix("AWS-NET-1");
    s.actions.popTo("report");
    expect(s.get().screen).toBe("report");
    expect(s.get().focus).toBe("restore");
    expect(s.get().restoreScroll).toBe(true);
    s.actions.popTo(null);
    expect(s.get().screen).toBe("start");
    expect(s.get().focus).toBe("heading");
  });
  it("popstate가 데이터 없는 화면을 가리키면 V0", () => {
    const s = setup();
    s.actions.popTo("compare");
    expect(s.get().screen).toBe("start");
  });
  it("이력 없는 모드(pushState 실패)에서도 이동·돌아가기가 동작한다", async () => {
    const s = setup({ failPush: true });
    s.actions.navMenu("catalog");
    expect(s.get().screen).toBe("catalog");
    expect(s.history.disabled()).toBe(true);
    s.actions.back();
    expect(s.get().screen).toBe("start");
    expect(s.history.backs).toBe(0);
  });
  it("[← 돌아가기]: push한 적이 있으면 history.back()", () => {
    const s = setup();
    s.actions.navMenu("about");
    s.actions.back();
    expect(s.history.backs).toBe(1);
  });
  it("V4 [고친 뒤 다시 수집해서 비교하기 →]: 재수집 모드(compareBase=report)로 V1", async () => {
    const s = setup();
    await buildRealReport(s);
    s.actions.openFix("AWS-NET-1");
    s.actions.fixCta();
    expect(s.get().screen).toBe("prep");
    expect(s.get().compareBase).toBe(s.get().report);
    expect(s.get().cloud).toBe("aws");
  });
  it("재수집 파일을 넣으면 비교 → V5, [이번 리포트 보기] → 새 리포트로 V3", async () => {
    const s = setup();
    await buildRealReport(s);
    const first = s.get().report;
    s.actions.startCompare();
    expect(s.get().screen).toBe("input");
    expect(s.get().compareBase).toBe(first);
    await s.actions.onFiles([file("after.json")]);
    await s.actions.build();
    expect(s.get().screen).toBe("compare");
    expect(s.get().comparison?.ok).toBe(true);
    s.actions.acceptAfter();
    expect(s.get().screen).toBe("report");
    expect(s.get().report).not.toBe(first);
    expect(s.get().compareBase).toBeNull();
  });
  it("다른 계정이면 비교를 거부한다(5겹)", async () => {
    const s = setup();
    await buildRealReport(s);
    s.actions.startCompare();
    await s.actions.onFiles([file("other.json")]);
    // 목업 buildInput은 첫 입력을 기준으로 하므로 다른 계정 하나만 넣으면 그 계정이 기준이 된다 → compare가 거부한다
    await s.actions.build();
    expect(s.get().screen).toBe("compare");
    const c = s.get().comparison;
    expect(c?.ok).toBe(false);
    s.actions.leaveCompare();
    expect(s.get().screen).toBe("report");
    expect(s.get().compareBase).toBeNull();
  });
  it("체험 V4 CTA는 학습용 계정으로 V1(체험 해제)", async () => {
    const s = setup();
    document.body.innerHTML = '<script type="application/json" id="cc-demo-aws-C">{}</script>';
    s.actions.startDemoFlow();
    await s.actions.openDemo("C");
    s.actions.openFix("AWS-MFA-2");
    s.actions.fixCta();
    expect(s.get().screen).toBe("prep");
    expect(s.get().report).toBeNull();
    expect(s.get().compareBase).toBeNull();
  });
  it("체험 데이터가 아직 없으면 준비 중을 알리고 머문다", async () => {
    const s = setup();
    document.body.innerHTML = "";
    s.actions.startDemoFlow();
    await s.actions.openDemo("C");
    expect(s.get().screen).toBe("demo");
    expect(s.get().live.polite).toBe("준비 중");
  });
});

describe("actions · 예외 표시 (왕복 검사 · 상태 불변)", () => {
  async function withReport() {
    const s = setup();
    await buildRealReport(s);
    const report = s.get().report;
    if (report === null) throw new Error("report");
    const item = report.doors.flatMap((d) => d.rules).flatMap((r) => r.items).find((i) => i.status === "caution" || i.status === "risk") as ItemResult;
    return { s, report, item };
  }
  it("저장하면 파일에 항목이 생기고 오버레이로만 라벨이 붙는다(상태는 그대로)", async () => {
    const { s, report, item } = await withReport();
    s.actions.saveException(item, { reason: "임시 예외", until: addDays(TODAY, 30) });
    const file = s.get().exceptions;
    expect(file?.entries).toHaveLength(1);
    expect(file?.entries[0]?.resource).toBe(item.resource.key);
    expect(file?.entries[0]?.createdAt).toBe(TODAY);
    const overlay = s.deps.overlayExceptions(report, file ?? null, TODAY);
    expect(overlay.byItemId.get(item.id)?.state).toBe("active");
    expect(s.get().report).toBe(report);
    expect(s.get().live.polite).toBe("예외를 표시했습니다. 상태는 그대로입니다.");
    s.actions.removeExceptionFor(item);
    expect(s.get().exceptions?.entries).toHaveLength(0);
  });
  it("같은 대상에 다시 표시하면 기존 항목을 바꾼다", async () => {
    const { s, item } = await withReport();
    s.actions.saveException(item, { reason: "하나", until: addDays(TODAY, 10) });
    s.actions.saveException(item, { reason: "둘", until: addDays(TODAY, 20) });
    expect(s.get().exceptions?.entries).toHaveLength(1);
    expect(s.get().exceptions?.entries[0]?.reason).toBe("둘");
  });
  it("왕복 검사에 걸리면(만료일이 범위 밖) 파일을 바꾸지 않고 assertive로 알린다", async () => {
    const { s, item } = await withReport();
    s.actions.saveException(item, { reason: "너무 길게", until: addDays(TODAY, 200) });
    expect(s.get().exceptions).toBeNull();
    expect(s.get().live.assertive).toContain("90일");
  });
  it("예외 파일 불러오기: 성공하면 반영, 실패하면 사유 한 줄", async () => {
    const { s } = await withReport();
    const good: ExceptionsFile = { schema: "cloudcheck.exceptions/1.0", entries: [{ ruleId: "AWS-KEY-1", resource: "k", reason: "사유", until: addDays(TODAY, 5), createdAt: TODAY }] };
    await s.actions.importExceptions(new File([JSON.stringify(good)], "e.json"));
    expect(s.get().exceptions?.entries).toHaveLength(1);
    expect(s.get().excImportIssue).toBeNull();
    await s.actions.importExceptions(new File(["{not json"], "bad.json"));
    expect(s.get().excImportIssue).toBe("format");
    expect(s.get().exceptions?.entries).toHaveLength(1);
    expect(s.get().live.polite).toContain("예외 파일을 읽지 못했습니다");
    await s.actions.importExceptions(new File([JSON.stringify({ ...good, entries: [{ ...good.entries[0], until: addDays(TODAY, 400) }] })], "span.json"));
    expect(s.get().excImportIssue).toBe("span");
  });
});

describe("actions · 창 전체 드롭(Q8)", () => {
  it("화면별 처리: V0·V1 → V2로 가서 읽기 / V2 → 읽기 / V3~V5 → 삼키고 안내 / 그 밖 → 삼키고 안내", async () => {
    const s = setup();
    s.actions.windowDrop([file("a.json")]);
    await vi.waitFor(() => expect(s.get().recs).toHaveLength(1));
    expect(s.get().screen).toBe("input");
    s.actions.windowDrop([file("b.json")]);
    await vi.waitFor(() => expect(s.get().recs).toHaveLength(2));
    await buildRealReport(s);
    s.actions.windowDrop([file("c.json")]);
    expect(s.get().live.polite).toContain("리포트를 보는 중에는");
    s.actions.navMenu("catalog");
    s.actions.windowDrop([file("d.json")]);
    expect(s.get().live.polite).toContain("이 화면에서는 파일을 읽지 않습니다");
  });
  it("입력 영역이 이미 읽은 파일은 창 처리기가 다시 읽지 않는다", async () => {
    const s = setup();
    s.actions.show("input");
    const f = file("x.json");
    void s.actions.onFiles([f]);
    s.actions.windowDrop([f]);
    await vi.waitFor(() => expect(s.get().recs).toHaveLength(1));
  });
});

describe("history 관문 · 유실 방지 장치", () => {
  beforeEach(() => {
    window.history.replaceState(null, "");
  });
  it("pushState는 { cc: 화면 ID }, '' 둘뿐이고 URL은 바뀌지 않는다", () => {
    const spy = vi.spyOn(window.history, "pushState");
    const before = window.location.href;
    const gate = createHistoryGate();
    expect(gate.push("report")).toBe(true);
    expect(spy).toHaveBeenCalledWith({ cc: "report" }, "");
    expect(window.location.href).toBe(before);
    expect(gate.pushed()).toBe(true);
    expect(gate.current()).toBe("report");
    spy.mockRestore();
  });
  it("pushState가 예외를 던지면 이력 없는 모드로 바뀌고 이후 push하지 않는다", () => {
    const spy = vi.spyOn(window.history, "pushState").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    const gate = createHistoryGate();
    expect(gate.push("input")).toBe(false);
    expect(gate.disabled()).toBe(true);
    expect(gate.push("report")).toBe(false);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
  it("popstate는 화면 ID만 읽는다(모르는 값은 null)", () => {
    const gate = createHistoryGate();
    const seen: (ScreenId | null)[] = [];
    const off = gate.onPop((s) => seen.push(s));
    window.dispatchEvent(new PopStateEvent("popstate", { state: { cc: "fix" } }));
    window.dispatchEvent(new PopStateEvent("popstate", { state: { cc: "nope" } }));
    window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
    off();
    window.dispatchEvent(new PopStateEvent("popstate", { state: { cc: "start" } }));
    expect(seen).toEqual(["fix", null, null]);
  });
  it("beforeunload는 실제 리포트가 있을 때만 걸고, 없어지면 뗀다", () => {
    syncUnloadGuard(true);
    expect(unloadGuardActive()).toBe(true);
    const e = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
    syncUnloadGuard(false);
    expect(unloadGuardActive()).toBe(false);
    const e2 = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(e2);
    expect(e2.defaultPrevented).toBe(false);
  });
  it("창 전체 드롭: 파일이면 항상 preventDefault, 글자 드래그는 막지 않는다", () => {
    const got: File[][] = [];
    const off = installWindowDrop((f) => got.push(f));
    const mk = (type: string, types: string[], files: File[]): Event => {
      const e = new Event(type, { cancelable: true });
      Object.defineProperty(e, "dataTransfer", { value: { types, files } });
      return e;
    };
    const over = mk("dragover", ["Files"], []);
    window.dispatchEvent(over);
    expect(over.defaultPrevented).toBe(true);
    const f = file("a.json");
    const drop = mk("drop", ["Files"], [f]);
    window.dispatchEvent(drop);
    expect(drop.defaultPrevented).toBe(true);
    expect(got).toEqual([[f]]);
    const text = mk("drop", ["text/plain"], []);
    window.dispatchEvent(text);
    expect(text.defaultPrevented).toBe(false);
    off();
  });
});

describe("보조 모듈", () => {
  afterEach(() => {
    vi.useRealTimers();
    document.documentElement.className = "";
  });
  it("printReport: 루트 클래스는 print() 동안만, 끝나면 반드시 뗀다(마스킹 기본)", () => {
    const seen: string[] = [];
    window.print = vi.fn(() => {
      seen.push(document.documentElement.className);
    });
    printReport({ scope: "list", unmask: true });
    expect(seen[0]).toContain("cc-print-list-only");
    expect(seen[0]).toContain("cc-print-unmask");
    expect(document.documentElement.classList.contains("cc-print-unmask")).toBe(false);
    expect(document.documentElement.classList.contains("cc-print-list-only")).toBe(false);
    printReport({ scope: "full", unmask: false });
    expect(seen[1]).toBe("");
  });
  it("printReport: print()가 예외를 던져도 클래스를 뗀다", () => {
    window.print = vi.fn(() => {
      throw new Error("blocked");
    });
    expect(() => printReport({ scope: "full", unmask: true })).toThrow();
    expect(document.documentElement.classList.contains("cc-print-unmask")).toBe(false);
  });
  it("cc-compact: 24px 넘으면 붙고 16px 아래로 오면 뗀다(8px 이력)", () => {
    const off = installCompact();
    const scroll = (y: number): void => {
      Object.defineProperty(window, "scrollY", { value: y, configurable: true });
      window.dispatchEvent(new Event("scroll"));
    };
    const has = (): boolean => document.documentElement.classList.contains("cc-compact");
    scroll(30);
    expect(has()).toBe(true);
    scroll(20);
    expect(has()).toBe(true);
    scroll(10);
    expect(has()).toBe(false);
    off();
  });
  it("live: 같은 문구를 연달아 알려도 내용이 달라진다", () => {
    let l = announce(EMPTY_LIVE, "polite", "읽는 중입니다.");
    const a = l.polite;
    l = announce(l, "polite", "읽는 중입니다.");
    expect(l.polite).not.toBe(a);
    expect(l.polite.trim()).toBe("읽는 중입니다.");
    expect(l.assertive).toBe("");
  });
  it("clock: nowIso는 초 단위 Z, todayLocal·addDays·daysBetween·isIsoDate", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-19T03:12:34.567Z"));
    expect(nowIso()).toBe("2026-10-19T03:12:34Z");
    expect(todayLocal()).toMatch(/^2026-10-(19|20)$/);
    expect(addDays("2026-10-31" as IsoDate, 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31" as IsoDate, 1)).toBe("2027-01-01");
    expect(daysBetween("2026-10-19", "2026-11-18")).toBe(30);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-10-19")).toBe(true);
  });
  it("store: 구독자에게 알리고, 같은 상태면 알리지 않는다", () => {
    const store = createStore<number, "inc" | "noop">((n, a) => (a === "inc" ? n + 1 : n), 0);
    const cb = vi.fn();
    const off = store.subscribe(cb);
    store.dispatch("inc");
    store.dispatch("noop");
    expect(store.getState()).toBe(1);
    expect(cb).toHaveBeenCalledTimes(1);
    off();
    store.dispatch("inc");
    expect(cb).toHaveBeenCalledTimes(1);
  });
  it("InputRecognition 목록 키는 안정적이다(제거해도 다른 행의 키가 바뀌지 않는다)", () => {
    const ok = {} as InputRecognition;
    let s = initialState({ now: NOW, today: TODAY });
    s = reducer(s, { type: "recs-add", recs: [ok, ok, ok] });
    const keys = s.recs.map((r) => r.key);
    s = reducer(s, { type: "recs-remove", key: keys[1] ?? -1 });
    expect(s.recs.map((r) => r.key)).toEqual([keys[0], keys[2]]);
    s = reducer(s, { type: "recs-add", recs: [ok] });
    expect(s.recs[2]?.key).toBe(keys[2] === undefined ? -1 : keys[2] + 1);
  });
});

// STEP 5 기획팀장 결정(docs/planning/cloudcheck-qa-decisions.md §8-A): canCollect(cloud)가 거짓인 동안 V2의 실제 입력으로는 리포트를 만들지 않는다(지금은 Azure)
describe("공개 전 클라우드의 실제 입력 차단(Azure 준비 중)", () => {
  const NOTE = "Azure 실제 점검은 준비 중입니다(실제 계정 검증 전). 가짜 데이터로 먼저 살펴볼 수 있습니다.";
  const SOON = { aws: "beta", azure: "soon" } as const;
  const OPEN = { aws: "beta", azure: "beta" } as const;
  const base = (over: Partial<InputRecognition>): InputRecognition =>
    ({ via: "file", name: { kind: "plain", text: "x" }, bytes: 1, status: "ok", kind: "collector-json", detail: null, identityPreview: null, asOf: null, doors: [], handle: null, ...over }) as InputRecognition;
  const azureJson = base({ identityPreview: { cloud: "azure", accountLast4: "a001", alias: null } });
  const awsJson = base({ identityPreview: { cloud: "aws", accountLast4: "9012", alias: null } });

  it("cloudOfRec: 신원 미리보기 → 입력 종류 순(Resource Graph·Entra CSV는 Azure, 자격증명 보고서는 AWS, 수집기 JSON만으로는 모름)", () => {
    expect(cloudOfRec(azureJson)).toBe("azure");
    expect(cloudOfRec(base({ kind: "csv-rg-storage" }))).toBe("azure");
    expect(cloudOfRec(base({ kind: "csv-rg-nsg" }))).toBe("azure");
    expect(cloudOfRec(base({ kind: "csv-entra-registration" }))).toBe("azure");
    expect(cloudOfRec(base({ kind: "csv-credential-report" }))).toBe("aws");
    expect(cloudOfRec(base({}))).toBeNull();
  });
  it("uncollectableCloud: 읽은(ok) 실제 Azure 입력만 막는다 — 체험·읽지 못한 행·AWS·Azure를 연 상태는 막지 않는다", () => {
    expect(uncollectableCloud([azureJson], SOON)).toBe("azure");
    expect(uncollectableCloud([awsJson, azureJson], SOON)).toBe("azure");
    expect(uncollectableCloud([base({ kind: "csv-rg-storage" })], SOON)).toBe("azure");
    expect(uncollectableCloud([awsJson], SOON)).toBeNull();
    expect(uncollectableCloud([{ ...azureJson, via: "demo" }], SOON)).toBeNull();
    expect(uncollectableCloud([{ ...azureJson, status: "parse-error" }], SOON)).toBeNull();
    expect(uncollectableCloud([azureJson], OPEN)).toBeNull();
  });
  it("build()는 화면 버튼과 별도로 한 번 더 막는다: Azure 실제 입력이면 리포트 없음 + 즉시 알림(기존 문구), 화면은 V2 그대로", async () => {
    const s = setup({ availability: SOON });
    s.actions.haveFile();
    await s.actions.onFiles([file("result-azure.json")]);
    expect(s.get().recs[0]?.rec.identityPreview?.cloud).toBe("azure");
    expect(s.get().live.assertive).toBe(NOTE); // 읽자마자 알린다
    await s.actions.build();
    expect(s.get().report).toBeNull();
    expect(s.get().screen).toBe("input");
    expect(s.get().busy).toBeNull();
    expect(s.get().live.assertive.trim()).toBe(NOTE);
  });
  it("Azure를 연 공개 상태면 같은 입력으로 리포트가 만들어진다, AWS는 기본값에서도 그대로", async () => {
    const open = setup({ availability: OPEN });
    open.actions.haveFile();
    await open.actions.onFiles([file("result-azure.json")]);
    await open.actions.build();
    expect(open.get().report?.identity.cloud).toBe("azure");
    expect(open.get().screen).toBe("report");
    const aws = setup({ availability: SOON });
    await buildRealReport(aws);
    expect(aws.get().report?.identity.cloud).toBe("aws");
  });
  it("체험(openDemo)은 이 길을 지나지 않는다 — Azure 체험 리포트는 기본값에서도 열린다", async () => {
    const s = setup({ availability: SOON });
    const el = document.createElement("script");
    el.type = "application/json";
    el.id = "cc-demo-azure-A";
    el.textContent = "{}";
    document.body.appendChild(el);
    try {
      s.actions.setDemoCloud("azure");
      await s.actions.openDemo("A");
      expect(s.get().report?.mode).toEqual({ kind: "demo", setId: "A" });
      expect(s.get().screen).toBe("report");
    } finally {
      el.remove();
    }
  });
});

// 디자인 결정 D-5(docs/design/cloudcheck-rule-copy-review.md §8-8): 체험 회사를 바꾸면 본인 응답·예외 표시를 비운다(실제 리포트의 '새 점검' 규칙과 같게)
describe("체험 회사를 바꾸면 본인 응답·예외 표시를 비운다(D-5)", () => {
  const blocks = (ids: readonly string[]): HTMLScriptElement[] =>
    ids.map((id) => {
      const el = document.createElement("script");
      el.type = "application/json";
      el.id = id;
      el.textContent = "{}";
      document.body.appendChild(el);
      return el;
    });
  const EXC: ExceptionsFile = { schema: "cloudcheck.exceptions/1.0", entries: [{ ruleId: "AWS-KEY-1", resource: "aws|iam-user|x", reason: "연습", until: "2026-11-01" as IsoDate, createdAt: TODAY }] };

  it("A에서 남긴 본인 응답·예외 → [다른 회사 보기] → B를 열면 비어 있다", async () => {
    const els = blocks(["cc-demo-aws-A", "cc-demo-aws-B"]);
    try {
      const s = setup();
      await s.actions.openDemo("A");
      s.actions.setSelfAnswer("AZ-MFA-G", "s1", "yes");
      s.store.dispatch({ type: "exceptions", file: EXC });
      expect(Object.keys(s.get().selfAnswers)).toHaveLength(1);
      expect(s.get().exceptions).not.toBeNull();
      s.actions.otherCompany();
      expect(s.get().screen).toBe("demo");
      await s.actions.openDemo("B");
      expect(s.get().report?.mode).toEqual({ kind: "demo", setId: "B" });
      expect(s.get().selfAnswers).toEqual({});
      expect(s.get().exceptions).toBeNull();
    } finally {
      for (const el of els) el.remove();
    }
  });
  it("뒤로 가기로 같은 체험 리포트에 돌아오면(새로 열지 않음) 그대로 남아 있다", async () => {
    const els = blocks(["cc-demo-aws-A"]);
    try {
      const s = setup();
      await s.actions.openDemo("A");
      s.actions.setSelfAnswer("AZ-MFA-G", "s1", "no");
      s.store.dispatch({ type: "exceptions", file: EXC });
      s.actions.otherCompany();
      s.actions.popTo("report");
      expect(s.get().screen).toBe("report");
      expect(Object.keys(s.get().selfAnswers)).toHaveLength(1);
      expect(s.get().exceptions).not.toBeNull();
    } finally {
      for (const el of els) el.remove();
    }
  });
});

// 디자인 결정 D-6(rule-copy-review §8-8): 붙여 넣은 CSV는 기준 시각이 없다 → V2 그 줄 아래 안내
describe("붙여 넣은 CSV의 기준 시각 안내(D-6) — 판별", () => {
  const r = (over: Partial<InputRecognition>): InputRecognition =>
    ({ via: "paste", name: { kind: "plain", text: "paste-1" }, bytes: 1, status: "ok", kind: "csv-credential-report", detail: null, identityPreview: null, asOf: null, doors: [], handle: null, ...over }) as InputRecognition;
  it("붙여 넣은 CSV(보고서·Resource Graph·Entra) + 기준 시각 없음이면 true", () => {
    for (const kind of ["csv-credential-report", "csv-rg-storage", "csv-rg-nsg", "csv-entra-registration"] as const) expect(pastedCsvWithoutAsOf(r({ kind })), kind).toBe(true);
  });
  it("파일로 넣은 CSV · 수집기 JSON · 기준 시각이 있는 경우 · 읽지 못한 줄은 false", () => {
    expect(pastedCsvWithoutAsOf(r({ via: "file" }))).toBe(false);
    expect(pastedCsvWithoutAsOf(r({ kind: "collector-json" }))).toBe(false);
    expect(pastedCsvWithoutAsOf(r({ asOf: { at: NOW, source: "filename" } }))).toBe(false);
    expect(pastedCsvWithoutAsOf(r({ status: "parse-error" }))).toBe(false);
    expect(pastedCsvWithoutAsOf(r({ kind: null }))).toBe(false);
  });
});
