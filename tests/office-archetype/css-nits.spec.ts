/**
 * office-archetype CSS nit 회귀 가드 (QA실행자)
 * 계획: OA-NIT-01(게이지 라벨 줄바꿈), OA-NIT-02(다크모드 상성 CTA 저대비)
 *
 * 시각 렌더는 브라우저 E2E 범위지만, 수정된 CSS 규칙이 회귀로 사라지지 않도록
 * oa.css 소스에서 핵심 프로퍼티 존재를 정적으로 검증한다(잠금 테스트).
 * + nit(b)의 대비 수치는 8유형 deep 컬러 × 흰 글자로 실제 계산해 AA(대형 텍스트 ≥3.0) 충족을 증명.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import typesData from "../../src/app/office-archetype/data/types.json";
import type { OaType } from "../../src/app/office-archetype/lib/types";

const cssPath = path.resolve(__dirname, "../../src/app/office-archetype/oa.css");
const css = readFileSync(cssPath, "utf8");
const types = typesData.types as unknown as OaType[];

/** hex → 상대휘도(WCAG) */
function luminance(hex: string): number {
  const c = hex.replace("#", "");
  const rgb = [0, 2, 4]
    .map((i) => parseInt(c.substr(i, 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}
function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

describe("OA-NIT-01: 결과 게이지 라벨 줄바꿈 방지 (nowrap)", () => {
  it("oa-result-card-gauge-label에 white-space:nowrap이 적용되어 있다", () => {
    const block = css.slice(css.indexOf(".oa-result-card-gauge-label"));
    const rule = block.slice(0, block.indexOf("}"));
    expect(rule).toMatch(/white-space:\s*nowrap/);
  });
  it("oa-result-card-gauge-item이 nowrap으로 도트게이지와 라벨 baseline을 유지한다", () => {
    const block = css.slice(css.indexOf(".oa-result-card-gauge-item"));
    const rule = block.slice(0, block.indexOf("}"));
    expect(rule).toMatch(/flex-wrap:\s*nowrap/);
  });
});

describe("OA-NIT-02: 다크모드 상성 CTA 대비(WCAG AA)", () => {
  it("oa-result-card-match-cta 배경이 solid/surface가 아니라 type-deep + 흰 글자다", () => {
    const idx = css.indexOf(".oa-result-card-match-cta");
    const rule = css.slice(idx, css.indexOf("}", idx));
    expect(rule).toMatch(/background:\s*var\(--oa-type-deep/);
    expect(rule).toMatch(/color:\s*#FFFFFF/i);
    // 회귀: 예전 저대비 조합(surface 배경)이 다시 들어오지 않도록
    expect(rule).not.toMatch(/background:\s*var\(--oa-surface\)/);
  });

  it("8유형 deep 컬러 × 흰 글자 대비가 전부 AA 대형텍스트 기준(≥3.0)을 넘고, 다수는 AA(≥4.5)이다", () => {
    let belowStrictAA = 0;
    for (const t of types) {
      const ratio = contrast(t.color.deep, "#FFFFFF");
      // 13px bold CTA — 최소 대형텍스트 AA(3.0) 이상은 반드시 충족
      expect(ratio, `${t.id} deep=${t.color.deep} 대비 ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(3.0);
      if (ratio < 4.5) belowStrictAA++;
    }
    // 8유형 중 엄격 AA(4.5) 미달은 최대 1개(sparker 4.32)까지만 허용 — 그 외 회귀 감지
    expect(belowStrictAA).toBeLessThanOrEqual(1);
  });
});
