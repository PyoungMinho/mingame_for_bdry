// @vitest-environment jsdom
// src/app/cloudcheck/_client/screens/__tests__/error-boundary.test.tsx — 오류 경계(ErrorBoundary): 자식이 던지면 아무것도 그리지 않고 onFatal을 한 번 부른다. 소유: 프론트팀장(D4 통합).
// main.tsx는 onFatal에서 정적 셸(V0 머리 + 부팅 대체 안내 + 오프라인판 링크)을 되살리고 다음 틱에 루트를 내린다 — 실브라우저 확인은 STEP 5.
import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "../ErrorBoundary";

function Boom(): never {
  throw new Error("boom: 사용자 데이터가 섞일 수 있는 메시지");
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ErrorBoundary", () => {
  it("자식이 던지면 빈 화면(null) + onFatal 1회, 오류 내용을 화면에 쓰지 않는다", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined); // React가 잡힌 오류를 콘솔에 남기는 것(개발 빌드)만 조용히
    const onFatal = vi.fn();
    const { container } = render(
      <ErrorBoundary onFatal={onFatal}>
        <p>before</p>
        <Boom />
      </ErrorBoundary>,
    );
    expect(onFatal).toHaveBeenCalledTimes(1);
    expect(container.textContent).toBe("");
    expect(document.body.textContent).not.toContain("boom");
  });
  it("던지지 않으면 자식을 그대로 그리고 onFatal을 부르지 않는다", () => {
    const onFatal = vi.fn();
    const { container } = render(
      <ErrorBoundary onFatal={onFatal}>
        <p>ok</p>
      </ErrorBoundary>,
    );
    expect(container.textContent).toBe("ok");
    expect(onFatal).not.toHaveBeenCalled();
  });
});
