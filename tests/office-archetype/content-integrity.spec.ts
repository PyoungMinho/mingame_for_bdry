/**
 * office-archetype 콘텐츠 참조 무결성 테스트 (QA실행자)
 * 계획: OA-DATA-01~16, OA-LINK-01/04
 *
 * 도메인 무지 아키텍처를 회귀로 못 박는다: matchBestId/worstId·slug·icon이 실존 유형/매핑을
 * 가리켜야 상성카드·OG·딥링크가 성립. TypeIcon(ICON_MAP)과 OgIcon(OG_ICON_SHAPES) 두 매퍼가
 * 8아이콘 전부를 커버해 한쪽 누락으로 인한 조용한 폴백(HelpCircle/물음표)이 없어야 한다.
 */
import { describe, it, expect } from "vitest";
import { findMatchType } from "../../src/app/office-archetype/lib/score";
import { isKnownIcon } from "../../src/app/office-archetype/_components/TypeIcon";
import questionsData from "../../src/app/office-archetype/data/questions.json";
import typesData from "../../src/app/office-archetype/data/types.json";
import configData from "../../src/app/office-archetype/data/config.json";
import type { OaType, Question } from "../../src/app/office-archetype/lib/types";

const questions = questionsData.questions as unknown as Question[];
const types = typesData.types as unknown as OaType[];
const config = configData as { questionCount: number; axes: unknown[] };

const typeIds = new Set(types.map((t) => t.id));

describe("OA-DATA 콘텐츠 정합성 — types.json", () => {
  it("OA-DATA-01: types 정확히 8개 & 4상한 각 2유형", () => {
    expect(types).toHaveLength(8);
    const q = new Map<string, number>();
    for (const t of types) {
      const k = `${t.axis.x}:${t.axis.y}`;
      q.set(k, (q.get(k) ?? 0) + 1);
    }
    expect(q.size).toBe(4);
    for (const c of q.values()) expect(c).toBe(2);
  });

  it("OA-DATA-01b: 모든 id가 유일하다(중복 id 없음)", () => {
    expect(typeIds.size).toBe(types.length);
  });

  it("OA-DATA-03: matchBestId 전부 실존 & 자기참조 아님", () => {
    for (const t of types) {
      expect(findMatchType(t, types), `${t.id}.matchBestId=${t.matchBestId}`).toBeDefined();
      expect(typeIds.has(t.matchBestId)).toBe(true);
      expect(t.matchBestId).not.toBe(t.id);
    }
  });

  it("OA-DATA-03b: matchWorstId(있으면) 실존 & 자기참조 아님", () => {
    for (const t of types) {
      if (t.matchWorstId != null) {
        expect(typeIds.has(t.matchWorstId), `${t.id}.matchWorstId=${t.matchWorstId}`).toBe(true);
        expect(t.matchWorstId).not.toBe(t.id);
      }
    }
  });

  it("OA-DATA-07: 8유형 필수 필드 전부 존재·비어있지 않음", () => {
    for (const t of types) {
      const ctx = `type ${t.id}`;
      expect(t.name, ctx).toBeTruthy();
      expect(t.alias, ctx).toBeTruthy();
      expect(t.tagline, ctx).toBeTruthy();
      expect(t.axis?.x, ctx).toBeTruthy();
      expect(t.axis?.y, ctx).toBeTruthy();
      expect(t.icon, ctx).toBeTruthy();
      expect(t.color?.tint, ctx).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(t.color?.solid, ctx).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(t.color?.deep, ctx).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(typeof t.gauge?.strength, ctx).toBe("number");
      expect(typeof t.gauge?.shadow, ctx).toBe("number");
      expect(t.gauge.strength).toBeGreaterThanOrEqual(0);
      expect(t.gauge.strength).toBeLessThanOrEqual(5);
      expect(t.gauge.shadow).toBeGreaterThanOrEqual(0);
      expect(t.gauge.shadow).toBeLessThanOrEqual(5);
      expect(Array.isArray(t.strengths) && t.strengths.length > 0, ctx).toBe(true);
      expect(Array.isArray(t.shadows) && t.shadows.length > 0, ctx).toBe(true);
      for (const s of [...t.strengths, ...t.shadows]) expect(s.trim().length).toBeGreaterThan(0);
      expect(t.matchBestId, ctx).toBeTruthy();
      expect(t.matchBestReason, ctx).toBeTruthy();
    }
  });

  it("OA-DATA-07b: slug(있으면) === id (딥링크 라우팅 계약)", () => {
    for (const t of types) {
      if (t.slug != null) expect(t.slug).toBe(t.id);
    }
  });
});

describe("OA-DATA 아이콘 매퍼 동기화", () => {
  it("OA-DATA-10a: TypeIcon(ICON_MAP)이 8유형 icon 전부 커버(폴백 미탐)", () => {
    for (const t of types) {
      expect(isKnownIcon(t.icon), `${t.id}.icon=${t.icon} 가 ICON_MAP에 없음(HelpCircle 폴백 위험)`).toBe(
        true,
      );
    }
  });

  it("OA-DATA-10b: OgIcon이 8유형 icon 전부 고유 SVG로 렌더(fallback 물음표 미사용)", async () => {
    // OgIcon은 알 수 없는 키면 FALLBACK_SHAPE(circle+path+line)로 렌더. 8유형이 fallback과
    // 다른 shape 조합을 내는지로 커버 여부를 판정한다.
    const { OgIcon } = await import("../../src/app/office-archetype/og/ogIcons");
    const { renderToStaticMarkup } = await import("react-dom/server");
    // fallback 마크업(존재하지 않는 키)
    const fallbackMarkup = renderToStaticMarkup(
      OgIcon({ icon: "__no_such_icon__", size: 24, color: "#000" }) as never,
    );
    for (const t of types) {
      const markup = renderToStaticMarkup(
        OgIcon({ icon: t.icon, size: 24, color: "#000" }) as never,
      );
      expect(markup, `${t.id}.icon=${t.icon} 가 OG fallback으로 새고 있음`).not.toBe(fallbackMarkup);
    }
  });
});

describe("OA-DATA 콘텐츠 정합성 — questions.json / config", () => {
  it("OA-DATA-12: questions 10개 & config.questionCount 일치", () => {
    expect(questions.length).toBe(10);
    expect(config.questionCount).toBe(10);
    expect(questions.length).toBe(config.questionCount);
  });

  it("OA-DATA-12b: 문항 id 유일 & 각 문항 옵션 id 유일", () => {
    const qids = new Set(questions.map((q) => q.id));
    expect(qids.size).toBe(questions.length);
    for (const q of questions) {
      const oids = new Set(q.options.map((o) => o.id));
      expect(oids.size, `${q.id} 옵션 id 중복`).toBe(q.options.length);
      expect(q.options.length).toBe(4); // 4지선다 고정
    }
  });

  it("OA-DATA-14: 모든 옵션 delta x·y 정수 존재(undefined/NaN 없음)", () => {
    let count = 0;
    for (const q of questions) {
      for (const o of q.options) {
        count++;
        expect(Number.isInteger(o.scores.x), `${q.id}.${o.id}.x`).toBe(true);
        expect(Number.isInteger(o.scores.y), `${q.id}.${o.id}.y`).toBe(true);
      }
    }
    expect(count).toBe(40); // 10문항 × 4옵션
  });

  it("OA-DATA-16: 전 옵션 delta 총합 Σx/Σy 리포트(편향 근본원인)", () => {
    let sumX = 0;
    let sumY = 0;
    for (const q of questions) for (const o of q.options) {
      sumX += o.scores.x ?? 0;
      sumY += o.scores.y ?? 0;
    }
    // eslint-disable-next-line no-console
    console.info(`[OA-DATA-16] Σx=${sumX}, Σy=${sumY} (0에서 멀면 분포 편향 신호)`);
    expect(sumX).toBe(-1);
    expect(sumY).toBe(6);
  });

  it("OA-DATA-axes: config.axes id가 x/y 축 계약과 일치", () => {
    const axisIds = (config.axes as { id: string }[]).map((a) => a.id);
    expect(axisIds).toEqual(["x", "y"]);
  });
});
