// src/app/cloudcheck/_client/screens/Report.tsx — V3 리포트. 디자인 최종안 §6-4(D0~D10, 블록 순서 고정), UX §4-4.
//  - 순서(위치 학습 + Before/After 비교): 띠·맥락 줄(App) → D2 h1 + 구역 이동 → D3 조회 범위(접을 수 없음) → D4 알림 → D5 분포 → D6 먼저 볼 3개 → D7 문 5구역 → D8 직접 볼 목록 → D9 동작 → D10 바닥.
//  - 리포트는 목록이다: 문 단위 종합 배지·점수·비율·축하 연출이 없다. 상태 글자는 어디서도 줄이지 않는다.
//  - V4·V7·V8을 다녀와도 App이 이 화면을 마운트한 채 숨겨 두므로 펼침·대상 표 쪽수·열린 폼·눌렀던 버튼이 그대로다.
//  - 예외 표시: 새 항목 → parseExceptions(serializeExceptions(next)) 왕복 검사 → overlayExceptions 재계산 → 라벨은 오버레이 결과로만(상태는 그대로).
import { memo, useCallback, useId, useMemo, useRef, type ReactElement } from "react";
import type { ItemResult, Report, RuleId, RuleResult } from "../../../../lib/cloudcheck/model/report";
import { Disclaimer } from "../components/Disclaimer";
import { DistributionChips } from "../components/DistributionChips";
import { DoorSection, type DoorHandlers, type DoorView } from "../components/DoorSection";
import { DOM_ID } from "../components/dom-ids";
import { DownloadLink } from "../components/DownloadLink";
import { FirstLook } from "../components/FirstLook";
import { JumpNav, type JumpItem } from "../components/Skip";
import { ManualCheckList } from "../components/ManualCheckList";
import { PrintHead, PrintOptions } from "../components/Print";
import { ReportNotices } from "../components/ReportNotices";
import { ScopePanel } from "../components/ScopePanel";
import { StatusLegend } from "../components/StatusLegend";
import { UnknownTone } from "../components/UnknownTone";
import { DOORS } from "../../../../lib/cloudcheck/model/report";
import { DemoGuide } from "./DemoGuide";
import { PAGE_VERSION } from "../config";
import { t } from "../i18n/index";
import { useApp } from "../state/controller";
import { EMPTY_EXCEPTIONS, firstIssue } from "../state/exceptions";
import { printReport } from "../state/print";

// 상태가 자주 바뀌는 낭독(live)·확인 대화상자 때문에 큰 구역이 다시 그려지지 않게, props가 그대로면 건너뛴다
const MemoDoorSection = memo(DoorSection);
const MemoManualCheckList = memo(ManualCheckList);
const MemoScopePanel = memo(ScopePanel);
const MemoFirstLook = memo(FirstLook);
const MemoReportNotices = memo(ReportNotices);

const DIST_ID = "cc-dist-h";
const focusById = (id: string): void => document.getElementById(id)?.focus();
const showManual = (): void => focusById(DOM_ID.manual);
const showScope = (): void => focusById(DOM_ID.scope);
const printList = (): void => printReport({ scope: "list", unmask: false });

export function ReportScreen(): ReactElement | null {
  const { state } = useApp();
  return state.report === null ? null : <ReportView report={state.report} />;
}

function ReportView({ report }: { readonly report: Report }): ReactElement {
  const { state, actions, deps, catalogById, derived } = useApp();
  const active = state.screen === "report";
  const demo = report.mode.kind === "demo";
  const real = !demo;
  const overlay = derived === null ? null : derived.overlay;
  const timeNotices = derived === null ? [] : derived.timeNotices;
  const printPanelId = useId();
  const importRef = useRef<HTMLInputElement>(null);

  const rulesById = useMemo(() => new Map<RuleId, RuleResult>(report.doors.flatMap((d) => d.rules).map((r) => [r.ruleId, r])), [report]);

  /* 예외 요약 '대상 없음' 줄: 예외 파일의 항목 중 이 리포트 어느 대상과도 맞지 않은 것의 점검 ID */
  const unmatchedRuleIds = useMemo<RuleId[]>(() => {
    if (overlay === null || state.exceptions === null) return [];
    const file = state.exceptions;
    const ids: RuleId[] = [];
    for (const e of overlay.entries) {
      const entry = file.entries[e.index];
      if (e.state === "unmatched" && entry !== undefined && !ids.includes(entry.ruleId)) ids.push(entry.ruleId);
    }
    return ids;
  }, [overlay, state.exceptions]);

  const showTargets = useCallback(
    (id: RuleId): void => {
      actions.openRule(id);
      focusById(DOM_ID.ruleToggle(id));
    },
    [actions],
  );
  const showPaths = useCallback((): void => actions.navMenu("about"), [actions]);

  const doorView = useMemo<DoorView>(
    () => ({ openRules: state.view.openRules, shownRows: state.view.tableShown, editingItemId: state.view.formItemId, today: state.today, selfAnswers: state.selfAnswers }),
    [state.view.openRules, state.view.tableShown, state.view.formItemId, state.today, state.selfAnswers],
  );
  const doorHandlers = useMemo<DoorHandlers>(
    () => ({
      onToggleRule: actions.toggleRule,
      onFix: actions.openFix,
      onShowManual: showManual,
      onMoreRows: actions.moreTargets,
      // 예외 표시는 위험·주의 대상에만(Q9): 확인 불가에 붙이면 '알면서 모른 척', 이상 없음에는 예외로 할 것이 없다
      canMarkException: (item: ItemResult) => item.status === "risk" || item.status === "caution",
      onOpenExceptionForm: (itemId: string) => actions.openForm(itemId),
      onCloseExceptionForm: () => actions.openForm(null),
      onSaveException: actions.saveException,
      onRemoveException: actions.removeExceptionFor,
      onSelfAnswer: actions.setSelfAnswer,
    }),
    [actions],
  );

  const jump: readonly JumpItem[] = [
    { labelKey: "cc.report.jump.scope", target: () => document.getElementById(DOM_ID.scope) },
    { labelKey: "cc.report.jump.dist", target: () => document.getElementById(DIST_ID) },
    { labelKey: "cc.report.jump.first", target: () => document.getElementById(DOM_ID.first) },
    ...DOORS.map((door): JumpItem => ({ labelKey: `cc.door.${door}.name`, target: () => document.getElementById(DOM_ID.door(door)) })),
    { labelKey: "cc.report.jump.manual", target: () => document.getElementById(DOM_ID.manual) },
  ];

  const unknown = report.distribution.rules.unknown;
  const issue = state.excImportIssue;

  return (
    <div className="cc-report" hidden={!active}>
      {/* D2 — 인쇄 머리 두 벌은 화면에서 숨고(cc-print-only) 첫 쪽에만 나온다.
          반드시 .cc-report의 직계 자식이다: print.css의 '직접 볼 목록만' 규칙(.cc-print-list-only .cc-report>:not(.cc-manual):not(.cc-print-only))이
          직계 자식만 남기므로 <header> 안에 두면 목록만 인쇄에서 머리가 통째로 빠진다(STEP 6 디자인 검수 F1). 화면 간격은 screens.css가 header 여백을 0으로 둔다 */}
      <PrintHead report={report} kind="full" pageVersion={PAGE_VERSION} />
      <PrintHead report={report} kind="list" pageVersion={PAGE_VERSION} />
      <header className="cc-report__head">
        <h1 tabIndex={-1} className="cc-noprint">
          {demo ? t("cc.report.title-demo") : t("cc.report.title")}
        </h1>
        <p className="cc-muted cc-noprint">{t("cc.report.sub")}</p>
        <JumpNav items={jump} />
      </header>

      {/* 체험 안내 패널 ⟨P1⟩ — 체험일 때만, 접을 수 있고 인쇄에는 없다 */}
      {report.mode.kind === "demo" ? (
        <DemoGuide
          set={report.mode.setId}
          report={report}
          onGo={(target) => {
            if (target.openRule !== undefined) actions.openRule(target.openRule);
            focusById(target.id);
          }}
        />
      ) : null}

      {/* D3 조회 범위 — 접을 수 없다(R-03) */}
      <MemoScopePanel report={report} onShowManual={showManual} onShowPaths={showPaths} />

      {/* D4 알림 */}
      <MemoReportNotices banners={report.banners} time={timeNotices} overlay={overlay} unmatchedRuleIds={unmatchedRuleIds} catalog={catalogById} />

      {/* D5 점검 단위 분포(대상 단위 합계는 초록을 부풀리므로 쓰지 않는다) */}
      <section aria-labelledby={DIST_ID} className="cc-stack cc-gap-2">
        <h2 id={DIST_ID} tabIndex={-1}>
          {t("cc.c.dist.heading")}
        </h2>
        <DistributionChips dist={report.distribution.rules} lead />
        <StatusLegend />
        {unknown > 0 ? (
          <UnknownTone as="p">
            {t("cc.c.dist.unresolved", { n: unknown })}{" "}
            <button type="button" className="cc-btn cc-btn--sm" onClick={showManual}>
              {t("cc.c.dist.unresolved-cta")}
            </button>
          </UnknownTone>
        ) : null}
        <Disclaimer />
      </section>

      {/* D6 먼저 볼 3개 */}
      <MemoFirstLook
        firstLook={report.firstLook}
        rules={rulesById}
        catalog={catalogById}
        onFix={actions.openFix}
        onShowTargets={showTargets}
        onShowManual={showManual}
        onShowScope={showScope}
      />

      {/* D7 문 5구역(고정 순서, 엔진 순서를 다시 정렬하지 않는다) */}
      {report.doors.map((door) => (
        <MemoDoorSection key={door.door} door={door} catalog={catalogById} inputs={report.collection.inputs} overlay={overlay} view={doorView} on={doorHandlers} />
      ))}

      {/* D8 직접 볼 목록 */}
      <MemoManualCheckList items={report.manualChecklist} catalog={catalogById} selfAnswers={state.selfAnswers} onSelfAnswer={actions.setSelfAnswer} onPrintList={printList} />

      {/* D9 이 리포트로 할 수 있는 일 */}
      <section aria-labelledby="cc-act-h" className="cc-stack cc-gap-2 cc-noprint">
        <h2 id="cc-act-h">{t("cc.report.actions.heading")}</h2>
        <div className="cc-actions">
          <button type="button" className="cc-btn" aria-expanded={state.view.printOpen} aria-controls={printPanelId} onClick={actions.togglePrint}>
            {t("cc.report.actions.print")}
          </button>
          {real && state.input !== null ? (
            <DownloadLink
              kind="blob"
              labelKey="cc.report.actions.masked-copy"
              fileName="cloudcheck-masked.json"
              mime="application/json"
              bytes={() => (state.input === null ? "" : deps.maskedCopy(state.input))}
              onResult={actions.downloaded}
            />
          ) : null}
          {real ? (
            <>
              <DownloadLink
                kind="blob"
                labelKey="cc.report.actions.exc-export"
                fileName="cloudcheck-exceptions.json"
                mime="application/json"
                bytes={() => deps.serializeExceptions(state.exceptions ?? EMPTY_EXCEPTIONS)}
                onResult={actions.downloaded}
              />
              <button type="button" className="cc-btn" onClick={() => importRef.current?.click()}>
                {t("cc.report.actions.exc-import")}
              </button>
              <input
                ref={importRef}
                type="file"
                accept=".json,application/json"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file !== undefined) void actions.importExceptions(file);
                  e.target.value = "";
                }}
              />
              <button type="button" className="cc-btn" onClick={actions.startCompare}>
                {t("cc.report.actions.compare")}
              </button>
            </>
          ) : (
            <>
              <button type="button" className="cc-btn" onClick={actions.otherCompany}>
                {t("cc.report.actions.other-company")}
              </button>
              <button type="button" className="cc-btn" onClick={actions.tryReal}>
                {t("cc.report.actions.try-real")}
              </button>
            </>
          )}
          {real ? (
            <button type="button" className="cc-btn cc-actions__new" onClick={actions.newInspection}>
              {t("cc.report.actions.new")}
            </button>
          ) : null}
        </div>
        <div id={printPanelId} hidden={!state.view.printOpen}>
          {state.view.printOpen ? <PrintOptions onPrint={actions.print} /> : null}
        </div>
        {real ? <p className="cc-hint">{t("cc.report.masked.note")}</p> : null}
        {real ? <p className="cc-hint">{t("cc.report.exc.export-note")}</p> : null}
        {real && issue !== null ? (
          <UnknownTone as="p">{t("cc.report.exc.import-fail", { reason: t(`cc.report.exc.issue.${firstIssue([issue])}`) })}</UnknownTone>
        ) : null}
        {state.downloadFailed ? (
          <p className="cc-err" role="note">
            {t("cc.app.download.fail")}
          </p>
        ) : null}
        {real ? (
          <label className="cc-opt">
            <input type="checkbox" checked={state.view.screenMask} onChange={(e) => actions.setScreenMask(e.target.checked)} />
            {t("cc.report.actions.screen-mask")}
          </label>
        ) : null}
        {real ? <p>{t("cc.report.loss")}</p> : null}
      </section>

      {/* D10 바닥 */}
      <p className="cc-small">{t("cc.c.grad.line")}</p>
      <div className="cc-print-only">
        <Disclaimer />
      </div>
    </div>
  );
}
