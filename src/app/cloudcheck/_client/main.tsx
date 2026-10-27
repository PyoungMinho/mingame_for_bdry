// src/app/cloudcheck/_client/main.tsx — 부트스트랩(페이지개발자가 프론트팀장 스텁을 인수해 교체). 부팅 계약(템플릿 ↔ main.tsx, _build/generated.test.ts가 jsdom에서 검사):
//  - #app에 flushSync로 렌더한 '같은 작업' 안에서 정적 셸(#cc-static)과 부팅 대체 안내(#cc-boot)에 hidden, <html data-cc-booted> → 화면이 깜빡이거나 밀리지 않는다(CLS).
//  - CSS import 순서(디자인 §4-1): tokens → base → 컴포넌트(App이 끌어온다) → screens → print(맨 끝). esbuild는 import 순서대로 잇는다.
//  - 엔진·파서는 주입한다: D4 통합(프론트팀장)에서 실제 연결(state/deps.real.ts)로 바꿨다. 미연결 자리표시(deps.unwired.ts)는 지웠다.
//    목업(state/deps.mock.ts·mocks/**)은 테스트 전용이라 여기서 import하지 않는다 — _build/generated.test.ts가 번들 입력으로 검사한다(배포 게이트).
import { StrictMode } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import "./styles/tokens.css";
import "./styles/base.css";
import { App } from "./screens/App";
import { ErrorBoundary } from "./screens/ErrorBoundary";
import "./screens/screens.css";
import "./styles/print.css";
import { SHELL } from "./shell";
import { AppProvider } from "./state/controller";
import { REAL_DEPS as ENGINE_DEPS } from "./state/deps.real";

/** 오류로 앱을 내렸을 때: 정적 셸과 부팅 대체 안내(오프라인판 링크 포함)를 되살린다. 빈 화면을 남기지 않는다 */
function restoreStaticShell(): void {
  const staticShell = document.getElementById(SHELL.static);
  if (staticShell !== null) staticShell.hidden = false;
  const bootFallback = document.getElementById(SHELL.boot);
  if (bootFallback !== null) bootFallback.hidden = false;
}

function boot(): void {
  const app = document.getElementById(SHELL.app);
  if (app === null) return;
  const root = createRoot(app);
  flushSync(() => {
    root.render(
      <StrictMode>
        <ErrorBoundary
          onFatal={() => {
            restoreStaticShell();
            // componentDidCatch는 커밋 단계에서 불린다 — 그 안에서 root.unmount()를 바로 부르면 React가 '렌더 중 동기 언마운트'로 다룬다(D4 통합에서 다음 틱으로 미룸).
            // 경계는 이미 null을 그렸으므로 그 사이 화면에는 되살린 정적 셸만 보인다.
            setTimeout(() => root.unmount(), 0);
          }}
        >
          <AppProvider env={{ deps: ENGINE_DEPS }}>
            <App />
          </AppProvider>
        </ErrorBoundary>
      </StrictMode>,
    );
  });
  const staticShell = document.getElementById(SHELL.static);
  if (staticShell !== null) staticShell.hidden = true;
  const bootFallback = document.getElementById(SHELL.boot);
  if (bootFallback !== null) bootFallback.hidden = true;
  document.documentElement.setAttribute("data-cc-booted", "");
}

boot();
