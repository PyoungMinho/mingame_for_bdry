// @vitest-environment jsdom
// @vitest-environment-options {"url": "file:///tmp/cloudcheck-offline.html"}
// file://로 열린 오프라인판에서는 오프라인판 내려받기를 그리지 않는다(이미 파일이다).
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DownloadLink } from "./DownloadLink";

describe("DownloadLink route — file://", () => {
  it("현재 문서가 file:이면 아무것도 그리지 않는다", () => {
    expect(window.location.protocol).toBe("file:");
    const { container } = render(<DownloadLink kind="route" labelKey="cc.boot.download" />);
    expect(container.innerHTML).toBe("");
  });
});
