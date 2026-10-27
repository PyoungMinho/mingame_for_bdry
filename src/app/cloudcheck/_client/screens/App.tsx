// src/app/cloudcheck/_client/screens/App.tsx — 앱 틀(띠 → 머리 → 고정 맥락 줄 → <main> → 바닥)과 화면 전환. 소유: 페이지개발자. 근거: 디자인 최종안 §3-1(전역 요소)·§6-0.
//  - 라이브 영역 둘은 앱 루트 첫머리, 그다음 '본문으로 건너뛰기'(첫 Tab). 정적 셸(템플릿)의 상단 구조와 같다: band → header → main.cc-wrap.cc-stack → h1 …
//  - V3(리포트)은 마운트한 채로 숨긴다: V4·V7·V8을 다녀와도 펼침·대상 표 쪽수·열린 폼·눌렀던 버튼이 그대로다(리포트 유실 방지 장치 5). 새 리포트는 key로 새로 마운트한다.
import { useMemo, useRef, type ReactElement } from "react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { DocLink } from "../components/DocLink";
import { AppHeader } from "../components/AppHeader";
import { Band, DemoFrame } from "../components/Band";
import { FoldProvider, type FoldControl } from "../components/Fold";
import { LiveRegions } from "../components/LiveRegions";
import { SkipButton } from "../components/Skip";
import { StickyContextBar } from "../components/StickyContextBar";
import { PAGE_VERSION, REPO_URL } from "../config";
import { t } from "../i18n/index";
import { useApp } from "../state/controller";
import { bandKind, DEMO_NAME_KEY, hasContextBar, isDemoScreen, isWideScreen, noTranslate, type ScreenId } from "../state/screens";
import { AboutScreen } from "./About";
import { CatalogScreen } from "./Catalog";
import { CompareScreen } from "./Compare";
import { DemoScreen } from "./Demo";
import { FixScreen } from "./Fix";
import { InputScreen } from "./Input";
import { PrepScreen } from "./Prep";
import { ReportScreen } from "./Report";
import { StartScreen } from "./Start";

function CurrentScreen({ screen }: { readonly screen: ScreenId }): ReactElement | null {
  switch (screen) {
    case "start":
      return <StartScreen />;
    case "prep":
      return <PrepScreen />;
    case "input":
      return <InputScreen />;
    case "fix":
      return <FixScreen />;
    case "compare":
      return <CompareScreen />;
    case "demo":
      return <DemoScreen />;
    case "catalog":
      return <CatalogScreen />;
    case "about":
      return <AboutScreen />;
    case "report":
      return null; // 아래에서 마운트한 채 보이는 리포트
  }
}

export function App(): ReactElement {
  const { state, actions, deps, availability, offline, derived } = useApp();
  const mainRef = useRef<HTMLElement>(null);
  const report = state.report;
  const real = report !== null && report.mode.kind === "real";
  const band = bandKind(state.screen, report, availability);
  const wide = isWideScreen(state.screen);

  const foldControl = useMemo<FoldControl>(
    () => ({ isOpen: (id) => state.view.foldOpen[id], setOpen: actions.setFold }),
    [state.view.foldOpen, actions],
  );

  const age = derived === null ? null : derived.timeNotices.find((n): n is Extract<typeof n, { kind: "snapshot-age" }> => n.kind === "snapshot-age") ?? null;
  const ruleset = report === null ? deps.rulesetVersion : report.engine.rulesetVersion;

  return (
    <FoldProvider control={foldControl}>
      <LiveRegions polite={state.live.polite} assertive={state.live.assertive} />
      <SkipButton target={() => mainRef.current} />
      {band === null ? null : <Band kind={band} />}
      <div className={wide ? "cc-wide-hdr" : undefined}>
        <AppHeader current={state.screen} offline={offline} onNav={actions.navMenu} />
      </div>
      {report !== null && hasContextBar(state.screen) ? (
        <StickyContextBar
          identity={report.identity}
          asOf={report.collection.asOf}
          unknownRules={report.distribution.rules.unknown}
          exceptionsActive={derived === null || derived.overlay === null ? null : derived.overlay.counts.active}
          demoCompanyKey={report.mode.kind === "demo" ? DEMO_NAME_KEY[report.mode.setId] : null}
          age={age}
          screenMasked={real && state.view.screenMask}
        />
      ) : null}
      <main
        ref={mainRef}
        tabIndex={-1}
        translate={noTranslate(state.screen) ? "no" : undefined}
        className={wide ? "cc-wrap cc-wrap--wide cc-stack" : "cc-wrap cc-stack"}
        onClickCapture={(e) => actions.rememberPressed((e.target as HTMLElement).closest("button"))}
      >
        <CurrentScreen screen={state.screen} />
        {report === null ? null : <ReportScreen key={state.reportSeq} />}
      </main>
      <footer className={wide ? "cc-foot cc-wrap cc-wrap--wide cc-small" : "cc-foot cc-wrap cc-small"}>
        <p>
          {t("cc.app.footer.made-by")}
          {REPO_URL === null ? null : (
            <>
              {" · "}
              <DocLink link={REPO_URL} labelKey="cc.app.footer.repo" />
            </>
          )}
        </p>
        <p>{t("cc.app.footer.versions", { page: PAGE_VERSION, ruleset })}</p>
        <p>{t("cc.app.footer.lang")}</p>
      </footer>
      <ConfirmDialog open={state.confirmOpen} onStay={actions.confirmStay} onGo={actions.confirmGo} />
      {isDemoScreen(state.screen, report) ? <DemoFrame /> : null}
    </FoldProvider>
  );
}
