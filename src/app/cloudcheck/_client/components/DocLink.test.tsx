// @vitest-environment jsdom
// DocLink — 관문 ②: 외부 링크를 만드는 유일한 통로. LINK_HOSTS만, 새 탭 + rel + 도메인 표기(G-D5).
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LINK_HOSTS, type ExternalLink } from "../../../../lib/cloudcheck/model/report";
import { MOCK_CATALOG } from "../mocks/catalog";
import { DocLink, isAllowedLink } from "./DocLink";
import { unexpectedMissing } from "./__tests__/render";

const link = (host: ExternalLink["host"], p = "/x"): ExternalLink => ({ href: `https://${host}${p}`, host });

describe("DocLink", () => {
  it("허용 호스트: 새 탭 + rel=noopener noreferrer + referrerpolicy + 호스트 글자 + '새 탭에서 열림'", () => {
    const { container } = render(<DocLink link={link("docs.aws.amazon.com", "/IAM/latest/UserGuide/id.html")} labelKey="cc.c.cli.read-head" />);
    const a = container.querySelector("a");
    expect(a?.getAttribute("href")).toBe("https://docs.aws.amazon.com/IAM/latest/UserGuide/id.html");
    expect(a?.getAttribute("target")).toBe("_blank");
    expect(a?.getAttribute("rel")).toBe("noopener noreferrer");
    expect(a?.getAttribute("referrerpolicy")).toBe("no-referrer");
    expect(a?.textContent).toContain("docs.aws.amazon.com");
    expect(container.querySelector(".cc-ext__host")?.textContent).toBe("docs.aws.amazon.com");
    expect(container.querySelector(".cc-vh")?.textContent).toBe("새 탭에서 열림");
    expect(container.querySelector(".cc-ext__i")).not.toBeNull(); // ↗ 아이콘(인쇄에서는 숨김)
    expect(a?.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(unexpectedMissing(container)).toEqual([]);
  });

  it("링크 글자는 카탈로그 키에서(제목) — 사용자 데이터가 아니다", () => {
    render(<DocLink link={link("learn.microsoft.com")} labelKey="cc.c.cli.write-head" />);
    expect(screen.getByRole("link").textContent).toContain("쓰기 명령 · 계정 설정을 바꿉니다");
  });

  it("lang=en은 제목 span에만 붙는다(WCAG 3.1.2)", () => {
    const { container } = render(<DocLink link={link("github.com")} labelKey="cc.c.cli.read-head" lang="en" />);
    expect(container.querySelector(".cc-ext__t")?.getAttribute("lang")).toBe("en");
    expect(container.querySelector("a")?.hasAttribute("lang")).toBe(false);
  });

  it("LINK_HOSTS 전부 링크로 그려지고 호스트 글자가 보인다", () => {
    for (const host of LINK_HOSTS) {
      const { container, unmount } = render(<DocLink link={link(host)} labelKey="cc.c.cli.read-head" />);
      expect(container.querySelector("a")).not.toBeNull();
      expect(container.querySelector("a")?.textContent).toContain(host);
      unmount();
    }
  });

  it("허용 밖 호스트·호스트와 href 불일치·공백/제어/역슬래시가 든 href는 링크 없이 제목 글자만(오류 문구 없음)", () => {
    const bad: ExternalLink[] = [
      { href: "https://evil.example/x", host: "evil.example" as ExternalLink["host"] },
      { href: "https://docs.aws.amazon.com.evil.example/x", host: "docs.aws.amazon.com" },
      { href: "https://github.com\\@evil.example/", host: "github.com" },
      { href: "https://github.com/a b", host: "github.com" },
      { href: "http://github.com/x" as ExternalLink["href"], host: "github.com" },
      { href: "https://github.com/\u0007", host: "github.com" },
    ];
    for (const l of bad) {
      expect(isAllowedLink(l)).toBe(false);
      const { container, unmount } = render(<DocLink link={l} labelKey="cc.c.cli.read-head" />);
      expect(container.querySelector("a")).toBeNull();
      expect(container.textContent).toBe("읽기 명령(조회용 예시)");
      unmount();
    }
  });

  it("목업 카탈로그의 모든 링크(근거·고치는 법 문서·실제 사례)가 허용된다", () => {
    for (const e of MOCK_CATALOG) {
      for (const b of e.basis) expect(isAllowedLink(b.link), e.ruleId).toBe(true);
      if (e.incident !== null) expect(isAllowedLink(e.incident.link), e.ruleId).toBe(true);
      if (e.fix !== null) expect(isAllowedLink(e.fix.change.doc), e.ruleId).toBe(true);
    }
  });
});
