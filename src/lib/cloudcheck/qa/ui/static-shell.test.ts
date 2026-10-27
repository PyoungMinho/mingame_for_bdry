// QA — CC-QA-22(CR-14): file://로 연 오프라인판에서 부팅 실패 안내 · <noscript>의 '오프라인판 내려받기' 링크는 열리지 않는다(스크립트가 없어 숨길 수 없음).
// 수정(프론트, 2026-10-20): 링크 바로 아래에 "이미 오프라인판이면 이 링크는 열리지 않음" 안내 줄(cc.boot.download-note)을 둔다.
// 커밋된 생성물(PAGE.html = /cloudcheck · /cloudcheck/download · 오프라인판과 같은 바이트)을 글자로 검사한다(브라우저 없이).
import { describe, expect, it } from "vitest";
import { PAGE } from "../../../../app/cloudcheck/_generated/page";
import { t } from "../../../../app/cloudcheck/_client/i18n/index";

const NOTE = t("cc.boot.download-note");
/** HTML 글자로 바꾼 안내(템플릿의 esc와 같은 다섯 글자만 바꾼다) */
const escHtml = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const sections = (): { noscript: string; boot: string } => {
  const html = PAGE.html;
  const ns = /<noscript>([\s\S]*?)<\/noscript>/.exec(html);
  const bi = html.indexOf('id="cc-boot"');
  return { noscript: ns ? ns[1] : "", boot: bi < 0 ? "" : html.slice(bi, html.indexOf("</div>", html.indexOf('href="/cloudcheck/download"', bi)) + 6 + 400) };
};

describe("[CC-QA-22] 정적 셸의 오프라인판 링크 안내", () => {
  it("전제: 안내 문구 키가 있고, 정적 셸 두 곳(부팅 실패 안내 · <noscript>)에 오프라인판 링크가 있다", () => {
    expect(NOTE.length).toBeGreaterThan(10);
    const s = sections();
    expect(s.noscript).toContain('href="/cloudcheck/download"');
    expect(s.boot).toContain('href="/cloudcheck/download"');
  });
  it("[CC-QA-22] 두 곳 모두 링크 뒤에 '파일로 연 오프라인판이면 링크가 열리지 않음' 안내가 있다", () => {
    const s = sections();
    for (const [where, text] of Object.entries(s)) {
      const at = text.indexOf('href="/cloudcheck/download"');
      expect(text.slice(at).includes(NOTE) || text.slice(at).includes(escHtml(NOTE)), where).toBe(true);
    }
  });
});
