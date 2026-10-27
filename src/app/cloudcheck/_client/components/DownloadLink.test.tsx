// @vitest-environment jsdom
// DownloadLink — 부속 관문: route는 일반 <a download>, blob은 Blob → 임시 <a download> 클릭 → 다음 틱에 revoke. href 대입은 이 파일만(가드 G-D5).
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DOWNLOAD_ROUTE, DownloadLink, startBlobDownload } from "./DownloadLink";

async function readBlob(b: Blob): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsText(b);
  });
}

describe("DownloadLink route", () => {
  it("오프라인판: /cloudcheck/download 일반 링크(download 속성), 주 버튼 모양은 primary일 때만", () => {
    const { container, rerender } = render(<DownloadLink kind="route" labelKey="cc.boot.download" />);
    const a = container.querySelector("a");
    expect(a?.getAttribute("href")).toBe(DOWNLOAD_ROUTE);
    expect(DOWNLOAD_ROUTE).toBe("/cloudcheck/download");
    expect(a?.hasAttribute("download")).toBe(true);
    expect(a?.textContent).toBe("오프라인판 내려받기");
    expect(a?.classList.contains("cc-btn--primary")).toBe(false);
    rerender(<DownloadLink kind="route" labelKey="cc.boot.download" primary />);
    expect(container.querySelector("a")?.classList.contains("cc-btn--primary")).toBe(true);
    expect(container.querySelector("a")?.hasAttribute("target")).toBe(false); // 새 탭이 아니다
  });
});

describe("DownloadLink blob", () => {
  const created: Blob[] = [];
  const revoked: string[] = [];
  let clicked: { href: string; download: string }[] = [];
  beforeEach(() => {
    vi.useFakeTimers();
    created.length = 0;
    revoked.length = 0;
    clicked = [];
    URL.createObjectURL = vi.fn((b: Blob | MediaSource) => {
      created.push(b as Blob);
      return `blob:test/${created.length}`;
    });
    URL.revokeObjectURL = vi.fn((u: string) => {
      revoked.push(u);
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push({ href: this.getAttribute("href") ?? "", download: this.download });
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("버튼을 누르면 Blob(글자·mime)을 만들어 임시 <a download>를 클릭하고, 다음 틱에 revoke한다 — 성공이면 onResult(true)", async () => {
    const onResult = vi.fn();
    // 수집기와 같은 짝(.sh + octet-stream — text/plain이면 Safari가 .txt를 덧붙인다, STEP 6 최종 리뷰 §2-3). 문자열 바이트는 UTF-8 그대로
    render(<DownloadLink kind="blob" labelKey="cc.boot.download" fileName="cloudcheck-aws.sh" mime="application/octet-stream" bytes={() => "#!/bin/bash\necho 한글\n"} onResult={onResult} primary />);
    const btn = screen.getByRole("button", { name: "오프라인판 내려받기" });
    expect(btn.classList.contains("cc-btn--primary")).toBe(true);
    fireEvent.click(btn);
    expect(clicked).toEqual([{ href: "blob:test/1", download: "cloudcheck-aws.sh" }]);
    expect(created[0]?.type).toBe("application/octet-stream");
    vi.useRealTimers();
    expect(await readBlob(created[0] as Blob)).toBe("#!/bin/bash\necho 한글\n");
    expect(onResult).toHaveBeenCalledWith(true);
    expect(document.querySelector("a[download]")).toBeNull(); // 임시 링크는 치워진다
  });

  it("revokeObjectURL은 클릭 직후가 아니라 다음 틱", () => {
    expect(startBlobDownload("x", "a.txt", "text/plain")).toBe(true);
    expect(revoked).toEqual([]);
    vi.runAllTimers();
    expect(revoked).toEqual(["blob:test/1"]);
  });

  it("바이트(Uint8Array)도 그대로", async () => {
    const bytes = new Uint8Array([104, 105]);
    fireEvent.click(render(<DownloadLink kind="blob" labelKey="cc.boot.download" fileName="x.bin" mime="application/octet-stream" bytes={() => bytes} />).getByRole("button"));
    vi.useRealTimers();
    expect(await readBlob(created[0] as Blob)).toBe("hi");
  });

  it("바이트를 만들다 예외가 나면 onResult(false) — 던지지 않는다", () => {
    const onResult = vi.fn();
    render(
      <DownloadLink
        kind="blob"
        labelKey="cc.boot.download"
        fileName="x"
        mime="text/plain"
        bytes={() => {
          throw new Error("boom");
        }}
        onResult={onResult}
      />,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onResult).toHaveBeenCalledWith(false);
    expect(clicked).toEqual([]);
  });

  it("버튼에는 href가 없다(내려받기 흐름이 location·window.open을 쓰지 않는다)", () => {
    const { container } = render(<DownloadLink kind="blob" labelKey="cc.boot.download" fileName="x" mime="text/plain" bytes={() => ""} />);
    expect(container.querySelector("[href]")).toBeNull();
  });
});
