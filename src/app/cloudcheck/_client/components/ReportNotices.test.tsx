// @vitest-environment jsdom
// ReportNotices — D4 알림 묶음: 엔진 배너 + 시간 알림 + 예외 요약을 디자인 §6-4 표의 순서로. 강한 공지 항상 펼침, 일반은 제목 버튼 + 접힌 본문.
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Banner, ExceptionOverlay, TimeNotice } from "../../../../lib/cloudcheck/model/report";
import { MOCK_CATALOG_BY_ID } from "../mocks/catalog";
import { MOCK_OVERLAY_B, MOCK_TIME_NOTICES, NOTICE_STALE, NOTICE_VERY_STALE } from "../mocks/extras";
import { REPORT_REAL_D } from "../mocks/reports";
import { lookup } from "../i18n/index";
import { buildNotices, ReportNotices } from "./ReportNotices";
import { unexpectedMissing } from "./__tests__/render";

const ALL_BANNERS: Banner[] = [
  { kind: "duplicate-input-ignored", count: 1 },
  { kind: "doors-skipped", doors: ["log"] },
  { kind: "as-of-before-evidence" },
  { kind: "collected-at-approximate" },
  { kind: "csv-scope-unproven" },
  { kind: "collector-unknown-release" },
  { kind: "identity-unconfirmed" },
  { kind: "schema-newer-minor", got: "cloudcheck.collect/1.1", supported: "cloudcheck.collect/1.0" },
  { kind: "areas-not-judged", doors: ["sto", "net"], reason: "field-missing" },
  { kind: "secrets-detected", count: 2 },
];
const ALL_TIME: TimeNotice[] = [{ kind: "guidance-stale", ruleIds: ["AWS-NET-1", "AWS-KEY-2"] }, { kind: "future-timestamp", aheadMinutes: 12 }, NOTICE_STALE, NOTICE_VERY_STALE];

describe("buildNotices — 표시 순서(디자인 §6-4)", () => {
  it("1 secrets → 2 very-stale → 3~11 일반 9종(표 순서, as-of-before-evidence는 collected-at-approximate 다음) → 12 stale → 13 future → 14 guidance → 15 예외 요약", () => {
    const ids = buildNotices({ banners: ALL_BANNERS, time: ALL_TIME, overlay: MOCK_OVERLAY_B, unmatchedRuleIds: ["AWS-NET-1"] }).map((n) => n.id);
    expect(ids).toEqual([
      "notice-secrets-detected",
      "notice-snapshot-age-very-stale",
      "notice-areas-not-judged",
      "notice-schema-newer-minor",
      "notice-identity-unconfirmed",
      "notice-collector-unknown-release",
      "notice-csv-scope-unproven",
      "notice-collected-at-approximate",
      "notice-as-of-before-evidence",
      "notice-doors-skipped",
      "notice-duplicate-input-ignored",
      "notice-snapshot-age-stale",
      "notice-future-timestamp",
      "notice-guidance-stale",
      "notice-exception",
    ]);
  });

  it("엔진이 준 배열 순서와 무관하다(결정적)", () => {
    const a = buildNotices({ banners: ALL_BANNERS, time: ALL_TIME, overlay: null, unmatchedRuleIds: [] }).map((n) => n.id);
    const b = buildNotices({ banners: [...ALL_BANNERS].reverse(), time: [...ALL_TIME].reverse(), overlay: null, unmatchedRuleIds: [] }).map((n) => n.id);
    expect(a).toEqual(b);
  });

  it("예외 요약은 개수가 모두 0이거나 overlay가 없으면 없다", () => {
    const zero: ExceptionOverlay = { byItemId: new Map(), entries: [], counts: { active: 0, expired: 0, unmatched: 0 } };
    expect(buildNotices({ banners: [], time: [], overlay: zero, unmatchedRuleIds: [] })).toHaveLength(0);
    expect(buildNotices({ banners: [], time: [], overlay: null, unmatchedRuleIds: [] })).toHaveLength(0);
  });
});

describe("ReportNotices 렌더", () => {
  it("아무 알림도 없으면 아무것도 그리지 않는다", () => {
    const { container } = render(<ReportNotices banners={[]} time={[]} overlay={null} unmatchedRuleIds={[]} />);
    expect(container.innerHTML).toBe("");
  });

  it("최대 밀도(실제 D + 시간 알림 3 + 예외 요약): 강한 공지 2 → 일반 9(as-of-before-evidence 포함) → 예외 1, 알림 묶음에 이름", () => {
    const { container } = render(<ReportNotices banners={REPORT_REAL_D.banners} time={MOCK_TIME_NOTICES} overlay={MOCK_OVERLAY_B} unmatchedRuleIds={["AWS-NET-1"]} catalog={MOCK_CATALOG_BY_ID} />);
    const section = container.querySelector("section") as HTMLElement;
    expect(section.getAttribute("aria-label")).toBe("알림");
    const cls = Array.from(section.children).map((c) => c.className.replace("cc-banner cc-banner--", ""));
    expect(cls).toEqual(["strong", "strong", "info", "info", "info", "info", "info", "info", "info", "info", "info", "exception"]);
    // 새 알림(STEP 5 CC-QA-01)은 제목·본문이 실제 E 카탈로그 문장으로 그려진다
    expect(section.textContent).toContain(lookup("cc.banner.as-of-before-evidence.title") ?? "⟦없음⟧");
    // 강한 공지는 항상 펼침(토글 버튼 없음) + 접근 이름 '중요한 알림'
    const strong = Array.from(section.querySelectorAll(".cc-banner--strong"));
    expect(strong.every((e) => e.querySelector("button") === null && e.getAttribute("aria-label") === "중요한 알림" && e.getAttribute("role") === "note")).toBe(true);
    // 일반 알림은 제목 버튼 + 접힌 본문(인쇄 펼침)
    const info = Array.from(section.querySelectorAll(".cc-banner--info"));
    for (const b of info) {
      expect(b.querySelector("button[aria-expanded='false']")).not.toBeNull();
      expect(b.querySelector(".cc-fold.cc-po")).not.toBeNull();
    }
    expect(unexpectedMissing(container)).toEqual([]);
  });

  it("예외 요약: 한 줄 문구 + 대상 없음이 있으면 접힘에 점검 제목", () => {
    const { container } = render(<ReportNotices banners={[]} time={[]} overlay={MOCK_OVERLAY_B} unmatchedRuleIds={["AWS-NET-1"]} catalog={MOCK_CATALOG_BY_ID} />);
    const exc = container.querySelector(".cc-banner--exception") as HTMLElement;
    expect(exc.textContent).toContain("예외 1건 적용 · 만료되어 해제 1건 · 대상 없음 1건");
    expect(exc.querySelector(".cc-fold")?.textContent).toContain("대상 없음 1건:");
    const withoutUnmatched = render(<ReportNotices banners={[]} time={[]} overlay={MOCK_OVERLAY_B} unmatchedRuleIds={[]} />);
    expect(withoutUnmatched.container.querySelector(".cc-banner--exception button")).toBeNull();
  });

  it("매우 오래됨(200시간)은 '일' 단위만(분 단위 없음), 시계 차이 알림에 분 수치를 그리지 않는다", () => {
    const { container } = render(<ReportNotices banners={[]} time={[NOTICE_VERY_STALE, { kind: "future-timestamp", aheadMinutes: 12 }]} overlay={null} unmatchedRuleIds={[]} />);
    expect(container.textContent).not.toMatch(/\d+\s?분/);
    expect(container.textContent).not.toContain("12");
  });
});
