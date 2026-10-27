// 스타일 점검 — 토큰·base·print는 디자인 최종안 §4-2~4-4 코드 그대로(값 변경 금지), 컴포넌트 CSS는 기준안(§4-5)을 나눈 것, 쓰는 클래스는 정의가 있거나 의도된 훅.
// CSS 위생(16진 색·!important·url()·@import·prefers-color-scheme·user-select·cc- 접두)은 _build/guards.test.ts가 모든 .css에 건다 — 여기서는 소유자 쪽 약속과 예산 보고를 한다.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const HERE = __dirname;
const CLIENT = path.join(HERE, "..");
const REPO = path.join(HERE, "../../../../..");
const DOC = path.join(REPO, "docs/design/cloudcheck-design-final.md");
const read = (p: string): string => readFileSync(p, "utf8");
const strip = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, "");

/** 디자인 최종안의 ```css 블록(제목 접두로 찾는다) */
function docBlock(headingPrefix: string): string | null {
  if (!existsSync(DOC)) return null;
  const lines = read(DOC).split("\n");
  const h = lines.findIndex((l) => l.startsWith(headingPrefix));
  if (h < 0) return null;
  let i = h;
  while (i < lines.length && !(lines[i] ?? "").startsWith("```css")) i += 1;
  const start = i + 1;
  let j = start;
  while (j < lines.length && !(lines[j] ?? "").startsWith("```")) j += 1;
  return `${lines.slice(start, j).join("\n")}\n`;
}

describe("styles/ — 디자인 최종안 코드 그대로", () => {
  for (const [file, heading] of [
    ["tokens.css", "### 4-2."],
    ["base.css", "### 4-3."],
    ["print.css", "### 4-4."],
  ] as const) {
    it(`${file} = ${heading} 블록(값 변경 0)`, () => {
      const block = docBlock(heading);
      if (block === null) return; // 문서가 없는 환경에서는 건너뛴다
      expect(read(path.join(CLIENT, "styles", file))).toBe(block);
    });
  }

  it("print.css는 @media print 안에서 마스킹 값이 기본이다(.cc-mask-short{display:inline}) — G-D14", () => {
    const css = strip(read(path.join(CLIENT, "styles/print.css")));
    const after = css.slice(css.indexOf("@media print"));
    expect(/\.cc-mask-short[^{}]*\{\s*display\s*:\s*inline\s*\}/.test(after)).toBe(true);
  });
});

describe("components/*.css", () => {
  const files = readdirSync(HERE).filter((f) => f.endsWith(".css")).sort();

  it("기준안(§4-5)을 나눈 파일들을 이어 붙이면 기준안과 같다 — 추가한 규칙은 아래 목록뿐", () => {
    const block = docBlock("### 4-5.");
    if (block === null) return;
    const all = files.map((f) => strip(read(path.join(HERE, f)))).join("\n");
    // 기준안의 모든 규칙(주석 제외, 공백 정규화)이 나뉜 파일 어딘가에 그대로 있다
    const norm = (s: string): string => s.replace(/\s+/g, " ").trim();
    const rules = strip(block).split("\n").map((l) => l.trim()).filter((l) => l !== "" && !l.startsWith("@media (max-width:599.98px){") && l !== "}");
    const hay = norm(all);
    const missing = rules.filter((r) => !hay.includes(norm(r.replace(".cc-band__more{max-height:4em;", ".cc-band__more{display:block;max-height:4em;"))));
    expect(missing).toEqual([]);
  });

  it("기준안에 없는 추가 규칙은 13개 파일 — Band · RuleRow(모바일 순서 · 요약 행 1열) · cards · DoorCollectionRow(축약형 줄바꿈) · AccountLabel(nowrap) · TargetTable(최소 폭) · table-card(모바일 숨김) · Chip(.cc-chips) · actions(.cc-hrow) + 프론트팀장 D4 통합 ScriptViewer(긴 줄 소프트 줄바꿈) + STEP 5 QA FixSteps(h2 단계 제목 모양) · Banner(강한 공지 안 링크 색) + STEP 6 StickyContextBar(낮은 화면 스티키 해제)", () => {
    const extra: string[] = [];
    for (const f of files) {
      for (const m of read(path.join(HERE, f)).matchAll(/\/\* 추가\((컴포넌트개발자|프론트팀장)[^)]*\)/g)) extra.push(`${f}@${m.index ?? 0}`);
    }
    expect(extra.map((e) => e.split("@")[0]).sort()).toEqual(["AccountLabel.css", "Band.css", "Banner.css", "Chip.css", "DoorCollectionRow.css", "FixSteps.css", "RuleRow.css", "ScriptViewer.css", "StickyContextBar.css", "TargetTable.css", "actions.css", "cards.css", "table-card.css"]);
  });

  // STEP 6 디자인 검수 F2 회귀 방지: 클래스는 여러 컴포넌트가 다시 쓴다('먼저 볼 3개'·요약 행도 .cc-rule__title) → 화면 순서를 바꾸는 order는 부모까지 좁힌 선택자에만
  it("order(화면 순서 바꾸기)는 직계 결합자(>)로 좁힌 선택자에만 — 지금은 토글 버튼 안 제목 하나(F2)", () => {
    const all = [...files.map((f) => path.join(HERE, f)), path.join(CLIENT, "screens/screens.css"), ...readdirSync(path.join(CLIENT, "styles")).map((f) => path.join(CLIENT, "styles", f))];
    const found: string[] = [];
    for (const p of all) {
      const css = strip(read(p));
      for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        if (!/(^|;)\s*order\s*:/.test(m[2] ?? "")) continue;
        for (const sel of (m[1] ?? "").split(",")) found.push(sel.trim());
      }
    }
    expect(found).toEqual([".cc-rule__tog>.cc-rule__title"]);
  });
  it("요약 행(해당 없음·미수집)의 사유·꼬리표는 600px 이상에서도 1열(F4)", () => {
    const css = strip(read(path.join(HERE, "RuleRow.css")));
    expect(css).toContain("@media (min-width:600px){.cc-rule__sum>.cc-rule__why,.cc-rule__sum>.cc-rule__tail{grid-column:1}}");
  });

  it("수집기 원문 줄은 소프트 줄바꿈한다(마지막 .cc-sv__l 규칙 = pre-wrap + overflow-wrap:anywhere — 가로 스크롤만으로 두지 않는다)", () => {
    const css = strip(read(path.join(HERE, "ScriptViewer.css")));
    const rules = [...css.matchAll(/\.cc-sv__l\{([^}]*)\}/g)].map((m) => m[1] ?? "");
    const last = rules[rules.length - 1] ?? "";
    expect(last).toContain("white-space:pre-wrap");
    expect(last).toContain("overflow-wrap:anywhere");
  });

  it("컴포넌트 TSX가 쓰는 cc- 클래스는 CSS에 정의가 있거나, 상태·구조를 표시하는 의도된 훅이다", () => {
    const css = [...files.map((f) => path.join(HERE, f)), ...readdirSync(path.join(CLIENT, "styles")).map((f) => path.join(CLIENT, "styles", f))].map((p) => strip(read(p))).join("\n");
    const defined = new Set([...css.matchAll(/\.(cc-[A-Za-z0-9_-]+)/g)].map((m) => m[1]));
    const HOOKS = new Set(["cc-acct", "cc-ba", "cc-cmd--read", "cc-cmdw", "cc-dcr__i--collected", "cc-ext", "cc-ext__t", "cc-first", "cc-fr", "cc-fr__row", "cc-mv", "cc-sb__t"]);
    const used = new Set<string>();
    for (const f of readdirSync(HERE).filter((x) => /\.tsx$/.test(x) && !/\.test\./.test(x))) {
      const sf = ts.createSourceFile(f, read(path.join(HERE, f)), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const visit = (n: ts.Node): void => {
        const text = ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n) ? n.text : null;
        if (text !== null) {
          const tokens = text.split(/\s+/).filter((t) => t !== "");
          if (tokens.length > 0 && tokens.every((t) => /^cc-[A-Za-z0-9_-]*$/.test(t))) for (const t of tokens) used.add(t);
        }
        ts.forEachChild(n, visit);
      };
      visit(sf);
    }
    // id·name 값(클래스가 아님): 템플릿 접두(cc-door-… · cc-first-…)와 라디오 그룹 이름
    const NOT_CLASS = new Set(["cc-print-scope"]);
    const noRule = [...used].filter((c) => !defined.has(c) && !HOOKS.has(c) && !NOT_CLASS.has(c) && !c.endsWith("-")).sort();
    expect(noRule).toEqual([]);
    expect(used.size).toBeGreaterThan(150);
  });
});

describe("CSS 예산 보고(G-D24, esbuild 압축 후 바이트·gzip 전)", () => {
  it("styles + components 합계를 보고한다(목표 30 KiB, 실패 기준 없음 — 방향서 §2-3)", () => {
    const require = createRequire(path.join(REPO, "package.json"));
    const esbuild = require("esbuild") as { transformSync: (src: string, o: { loader: string; minify: boolean; charset: string }) => { code: string; warnings: unknown[] } };
    const order = ["styles/tokens.css", "styles/base.css", ...readdirSync(HERE).filter((f) => f.endsWith(".css")).sort().map((f) => `components/${f}`), "styles/print.css"];
    const src = order.map((p) => read(path.join(CLIENT, p))).join("\n");
    const r = esbuild.transformSync(src, { loader: "css", minify: true, charset: "utf8" });
    const bytes = Buffer.byteLength(r.code, "utf8");
    // eslint-disable-next-line no-console
    console.info(`[cloudcheck CSS] ${bytes} B = ${(bytes / 1024).toFixed(2)} KiB (목표 30 KiB, 화면 CSS 제외) · 경고 ${r.warnings.length}`);
    expect(r.warnings).toHaveLength(0);
    expect(bytes).toBeLessThan(34 * 1024); // 상한 권고(디자인 §1-2 UI-1: 34KiB)
  });
});
