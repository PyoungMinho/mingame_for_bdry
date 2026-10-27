// src/app/cloudcheck/_client/state/reducer.ts — 앱 상태(메모리 전용, R-06)와 순수 reducer. 소유: 페이지개발자.
// 근거: UX §3-4(앱 상태), 디자인 최종안 §6-0(상태·모듈 배치). 저장소·URL·쿠키 어디에도 남기지 않는다. history.state에는 화면 ID만 들어간다.
//  - reducer는 순수하다: 현재 시각·엔진 호출·DOM이 없다. 시각(now·today)과 엔진 결과는 controller가 계산해 액션에 실어 보낸다.
//  - NormalizedInput은 보관만 한다(속성 접근·구조 분해·전개·JSON.stringify 금지 — 가드 테스트).
import type { ExceptionsFile } from "../../../../lib/cloudcheck/contract/exceptions-schema";
import type { NormalizedInput } from "../../../../lib/cloudcheck/contract/normalized";
import type { Cloud, Comparison, InputRecognition, IsoDate, IsoUtc, Report, RuleId } from "../../../../lib/cloudcheck/model/report";
import { TABLE_PAGE } from "../config";
import { announce, EMPTY_LIVE, type LiveState } from "./live";
import type { PrintOptions } from "./print";
import { resolveScreen, type DataFacts, type ScreenId } from "./screens";

export type SelfAnswer = "yes" | "no" | "unknown";
export type InputTab = "file" | "paste";
export type PrepPath = "csv" | "collector";
/** 화면 전환 뒤 포커스를 둘 곳: 기본은 h1, V4에서 돌아오면 눌렀던 [고치는 법] 버튼 */
export type FocusTarget = "heading" | "restore";
/** 화면 안 알림(V2): 한 번에 너무 많은 파일 · 폴더 · 글자가 아닌 붙여넣기 */
export type InputNotice = "too-many" | "folder" | "paste-not-text" | null;
export type Busy = "reading" | "building" | null;

/** 목록 행: 안정 키 + 인식 결과(원본). 화면에 보이는 상태는 buildInput(원본들)이 갱신한 것을 쓴다 */
export interface RecItem {
  readonly key: number;
  readonly rec: InputRecognition;
}

/** 화면이 바뀌어도 유지되는 보기 상태(UX §3-4 view). 컴포넌트가 자기 안에 둔 펼침은 화면이 마운트된 동안 유지된다 */
export interface ViewState {
  /** 펼친 점검(ruleId) */
  readonly openRules: ReadonlySet<RuleId>;
  /** 점검별 대상 표에 보이는 행 수(없으면 TABLE_PAGE) */
  readonly tableShown: Readonly<Partial<Record<RuleId, number>>>;
  /** 접힘 상태(Fold id → 열림). <FoldProvider control>이 읽고 쓴다 — V4 → V3 복원, 리포트 안에서 안정적인 id만 */
  readonly foldOpen: Readonly<Record<string, boolean>>;
  /** 열린 예외 폼의 대상 id */
  readonly formItemId: string | null;
  /** 인쇄 옵션 패널이 열려 있는가 */
  readonly printOpen: boolean;
  readonly printOpts: PrintOptions;
  /** 화면 가리기(P1) — 루트 클래스 cc-screen-mask */
  readonly screenMask: boolean;
  readonly prepPath: PrepPath;
  readonly tab: InputTab;
  /** V0 Azure 안내 펼침 */
  readonly azureOpen: boolean;
  /** V4 대상 목록에 보이는 행 수 */
  readonly fixShown: number;
  /** 화면별 스크롤 위치(V3→V4→V3 복원에만 쓴다) */
  readonly scroll: Readonly<Partial<Record<ScreenId, number>>>;
}

export const INITIAL_VIEW: ViewState = {
  openRules: new Set<RuleId>(),
  tableShown: {},
  foldOpen: {},
  formItemId: null,
  printOpen: false,
  printOpts: { scope: "full", unmask: false },
  screenMask: false,
  prepPath: "collector",
  tab: "file",
  azureOpen: false,
  fixShown: TABLE_PAGE,
  scroll: {},
};

export interface AppState {
  readonly screen: ScreenId;
  /** 화면 전환마다 +1 — 포커스·제목·스크롤·낭독 효과의 트리거(첫 화면은 0) */
  readonly navSeq: number;
  readonly focus: FocusTarget;
  /** 전환이 V4→V3 복귀일 때만 스크롤을 복원한다 */
  readonly restoreScroll: boolean;
  /** V7·V8 [← 돌아가기]의 돌아갈 곳(이력이 없는 모드에서도 동작) */
  readonly returnTo: ScreenId;
  readonly cloud: Cloud | null;
  readonly demoCloud: Cloud;
  readonly recs: readonly RecItem[];
  readonly nextRecKey: number;
  readonly busy: Busy;
  readonly notice: InputNotice;
  readonly input: NormalizedInput | null;
  readonly report: Report | null;
  /** 리포트가 새로 만들어질 때마다 +1 — V3를 새로 마운트하는 키 */
  readonly reportSeq: number;
  readonly compareBase: Report | null;
  readonly comparison: Comparison | null;
  /** 비교한 '이번' 리포트와 그 입력(T14 [이번 리포트 보기]에서 report가 된다) */
  readonly pendingAfter: { readonly report: Report; readonly input: NormalizedInput } | null;
  readonly fixRuleId: RuleId | null;
  readonly exceptions: ExceptionsFile | null;
  readonly selfAnswers: Readonly<Record<string, SelfAnswer>>;
  /** 예외 파일 불러오기 실패 사유 코드(null = 없음) */
  readonly excImportIssue: string | null;
  readonly view: ViewState;
  /** 부팅 때 history.state가 V2~V5였는데 메모리가 비어 있음 → V0에 복구 안내(A3') */
  readonly recovered: boolean;
  /** 내려받기 실패(cc.app.download.fail)를 보인 화면 내 위치 표시용 — 마지막 실패한 내려받기 종류 */
  readonly downloadFailed: boolean;
  /** 마지막 화면 전환 때의 시각(timeNotices·예외 폼 min/max). controller가 clock에서 읽어 넣는다 */
  readonly now: IsoUtc;
  readonly today: IsoDate;
  /** 라이브 영역(polite·assertive) 문구 */
  readonly live: LiveState;
  /** 리포트 닫기 확인 <dialog>(ConfirmDialog)가 열려 있는가. 이어서 할 일은 controller가 클로저로 들고 있다 */
  readonly confirmOpen: boolean;
}

export const EPOCH: IsoUtc = "1970-01-01T00:00:00Z" as IsoUtc;
export const EPOCH_DAY: IsoDate = "1970-01-01" as IsoDate;

export function initialState(o: { readonly recovered?: boolean; readonly now?: IsoUtc; readonly today?: IsoDate } = {}): AppState {
  return {
    screen: "start",
    navSeq: 0,
    focus: "heading",
    restoreScroll: false,
    returnTo: "start",
    cloud: null,
    demoCloud: "aws",
    recs: [],
    nextRecKey: 1,
    busy: null,
    notice: null,
    input: null,
    report: null,
    reportSeq: 0,
    compareBase: null,
    comparison: null,
    pendingAfter: null,
    fixRuleId: null,
    exceptions: null,
    selfAnswers: {},
    excImportIssue: null,
    view: INITIAL_VIEW,
    recovered: o.recovered === true,
    downloadFailed: false,
    now: o.now ?? EPOCH,
    today: o.today ?? EPOCH_DAY,
    live: EMPTY_LIVE,
    confirmOpen: false,
  };
}

export const factsOf = (s: AppState): DataFacts => ({ hasReport: s.report !== null, hasFixTarget: s.fixRuleId !== null, hasComparison: s.comparison !== null });

export type Action =
  | { readonly type: "show"; readonly screen: ScreenId; readonly now: IsoUtc; readonly today: IsoDate; readonly focus?: FocusTarget; readonly restoreScroll?: boolean; readonly scrollY?: number }
  | { readonly type: "select-cloud"; readonly cloud: Cloud | null }
  | { readonly type: "set-demo-cloud"; readonly cloud: Cloud }
  | { readonly type: "set-tab"; readonly tab: InputTab }
  | { readonly type: "set-prep-path"; readonly path: PrepPath }
  | { readonly type: "set-azure-open"; readonly open: boolean }
  | { readonly type: "busy"; readonly busy: Busy }
  | { readonly type: "notice"; readonly notice: InputNotice }
  | { readonly type: "recs-add"; readonly recs: readonly InputRecognition[] }
  | { readonly type: "recs-remove"; readonly key: number }
  | { readonly type: "recs-clear" }
  | { readonly type: "report-ready"; readonly report: Report; readonly input: NormalizedInput | null }
  | { readonly type: "compare-base" }
  | { readonly type: "compare-ready"; readonly comparison: Comparison; readonly after: { readonly report: Report; readonly input: NormalizedInput } }
  | { readonly type: "compare-accept" }
  | { readonly type: "compare-cancel" }
  | { readonly type: "compare-exit" }
  | { readonly type: "fix-target"; readonly ruleId: RuleId | null }
  | { readonly type: "exceptions"; readonly file: ExceptionsFile | null; readonly issue?: string | null }
  | { readonly type: "self-answer"; readonly key: string; readonly answer: SelfAnswer }
  /** 본인 응답·예외 표시를 비운다(디자인 D-5 — 체험 회사를 바꿀 때) */
  | { readonly type: "clear-annotations" }
  | { readonly type: "toggle-rule"; readonly ruleId: RuleId; readonly open?: boolean }
  | { readonly type: "open-rule"; readonly ruleId: RuleId }
  | { readonly type: "table-more"; readonly ruleId: RuleId }
  | { readonly type: "fold"; readonly id: string; readonly open: boolean }
  | { readonly type: "fix-more" }
  | { readonly type: "form"; readonly itemId: string | null }
  | { readonly type: "print-toggle"; readonly open?: boolean }
  | { readonly type: "print-options"; readonly opts: PrintOptions }
  | { readonly type: "screen-mask"; readonly on: boolean }
  | { readonly type: "download-failed"; readonly failed: boolean }
  | { readonly type: "recovered"; readonly value: boolean }
  | { readonly type: "announce"; readonly kind: "polite" | "assertive"; readonly text: string }
  | { readonly type: "confirm"; readonly open: boolean }
  | { readonly type: "reset"; readonly now: IsoUtc; readonly today: IsoDate };

const without = <T,>(set: ReadonlySet<T>, v: T): ReadonlySet<T> => {
  const next = new Set(set);
  next.delete(v);
  return next;
};
const withValue = <T,>(set: ReadonlySet<T>, v: T): ReadonlySet<T> => new Set(set).add(v);

/** 새 점검: 입력·리포트·비교·예외·본인 응답·보기 상태를 모두 비운다. 화면 전환 상태(navSeq)와 부팅 복구 표시는 이어 간다 */
function resetData(s: AppState, now: IsoUtc, today: IsoDate): AppState {
  return {
    ...initialState({ now, today }),
    screen: s.screen,
    navSeq: s.navSeq,
    returnTo: s.returnTo,
    recovered: false,
    live: s.live,
  };
}

export function reducer(s: AppState, a: Action): AppState {
  switch (a.type) {
    case "show": {
      const target = resolveScreen(a.screen, factsOf(s));
      const leaving = s.screen;
      // 떠나는 화면의 스크롤 위치를 기억한다(V3 → V4 → V3 복원)
      const scroll = a.scrollY !== undefined ? { ...s.view.scroll, [leaving]: a.scrollY } : s.view.scroll;
      const returnTo = (target === "catalog" || target === "about") && leaving !== "catalog" && leaving !== "about" ? leaving : s.returnTo;
      return {
        ...s,
        screen: target,
        navSeq: s.navSeq + 1,
        focus: a.focus ?? "heading",
        restoreScroll: a.restoreScroll === true && target === "report",
        returnTo,
        now: a.now,
        today: a.today,
        recovered: target === "start" ? s.recovered : false,
        view: { ...s.view, scroll },
        notice: target === "input" ? s.notice : null,
      };
    }
    case "select-cloud":
      return { ...s, cloud: a.cloud };
    case "set-demo-cloud":
      return { ...s, demoCloud: a.cloud };
    case "set-tab":
      return { ...s, view: { ...s.view, tab: a.tab } };
    case "set-prep-path":
      return { ...s, view: { ...s.view, prepPath: a.path } };
    case "set-azure-open":
      return { ...s, view: { ...s.view, azureOpen: a.open } };
    case "busy":
      return { ...s, busy: a.busy };
    case "notice":
      return { ...s, notice: a.notice };
    case "recs-add": {
      let key = s.nextRecKey;
      const added = a.recs.map((rec) => ({ key: key++, rec }));
      return { ...s, recs: [...s.recs, ...added], nextRecKey: key, notice: null };
    }
    case "recs-remove":
      return { ...s, recs: s.recs.filter((r) => r.key !== a.key), notice: null };
    case "recs-clear":
      return { ...s, recs: [], notice: null };
    case "report-ready":
      return {
        ...s,
        report: a.report,
        input: a.input,
        reportSeq: s.reportSeq + 1,
        comparison: null,
        pendingAfter: null,
        compareBase: null,
        fixRuleId: null,
        busy: null,
        notice: null,
        downloadFailed: false,
        // 새 리포트는 펼침·대상 표 쪽수·열린 폼을 처음부터(예외·본인 응답은 새 점검까지 이어 간다)
        view: { ...s.view, openRules: new Set<RuleId>(), tableShown: {}, foldOpen: {}, formItemId: null, printOpen: false, scroll: {}, fixShown: TABLE_PAGE },
      };
    case "compare-base":
      return { ...s, compareBase: s.report, comparison: null, pendingAfter: null, recs: [], notice: null };
    case "compare-ready":
      return { ...s, comparison: a.comparison, pendingAfter: a.after, busy: null, notice: null };
    case "compare-accept": {
      if (s.pendingAfter === null) return s;
      return {
        ...s,
        report: s.pendingAfter.report,
        input: s.pendingAfter.input,
        reportSeq: s.reportSeq + 1,
        compareBase: null,
        comparison: null,
        pendingAfter: null,
        fixRuleId: null,
        view: { ...s.view, openRules: new Set<RuleId>(), tableShown: {}, foldOpen: {}, formItemId: null, printOpen: false, scroll: {}, fixShown: TABLE_PAGE },
      };
    }
    case "compare-cancel":
      return { ...s, comparison: null, pendingAfter: null };
    case "compare-exit":
      return { ...s, comparison: null, pendingAfter: null, compareBase: null };
    case "fix-target":
      return { ...s, fixRuleId: a.ruleId, view: { ...s.view, fixShown: TABLE_PAGE } };
    case "exceptions":
      return { ...s, exceptions: a.file, excImportIssue: a.issue === undefined ? null : a.issue };
    case "self-answer":
      return { ...s, selfAnswers: { ...s.selfAnswers, [a.key]: a.answer } };
    case "clear-annotations":
      return { ...s, selfAnswers: {}, exceptions: null, excImportIssue: null };
    case "toggle-rule": {
      const open = a.open ?? !s.view.openRules.has(a.ruleId);
      return { ...s, view: { ...s.view, openRules: open ? withValue(s.view.openRules, a.ruleId) : without(s.view.openRules, a.ruleId) } };
    }
    case "open-rule":
      return s.view.openRules.has(a.ruleId) ? s : { ...s, view: { ...s.view, openRules: withValue(s.view.openRules, a.ruleId) } };
    case "fold":
      return s.view.foldOpen[a.id] === a.open ? s : { ...s, view: { ...s.view, foldOpen: { ...s.view.foldOpen, [a.id]: a.open } } };
    case "table-more": {
      const shown = s.view.tableShown[a.ruleId] ?? TABLE_PAGE;
      return { ...s, view: { ...s.view, tableShown: { ...s.view.tableShown, [a.ruleId]: shown + TABLE_PAGE } } };
    }
    case "fix-more":
      return { ...s, view: { ...s.view, fixShown: s.view.fixShown + TABLE_PAGE } };
    case "form":
      return { ...s, view: { ...s.view, formItemId: a.itemId } };
    case "print-toggle":
      return { ...s, view: { ...s.view, printOpen: a.open ?? !s.view.printOpen } };
    case "print-options":
      return { ...s, view: { ...s.view, printOpts: a.opts } };
    case "screen-mask":
      return { ...s, view: { ...s.view, screenMask: a.on } };
    case "download-failed":
      return { ...s, downloadFailed: a.failed };
    case "recovered":
      return { ...s, recovered: a.value };
    case "announce":
      return { ...s, live: announce(s.live, a.kind, a.text) };
    case "confirm":
      return { ...s, confirmOpen: a.open };
    case "reset":
      return resetData(s, a.now, a.today);
  }
}
