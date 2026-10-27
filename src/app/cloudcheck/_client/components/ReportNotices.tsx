// src/app/cloudcheck/_client/components/ReportNotices.tsx — V3 알림 묶음(D4). 엔진 배너 + 시간 알림 + 예외 요약을 디자인 §6-4 표의 순서로 끼워 넣는다.
//   1 secrets-detected(강한 공지) → 2 snapshot-age very-stale(강한 공지) → 3~11 일반 알림 9종(areas-not-judged · schema-newer-minor · identity-unconfirmed ·
//   collector-unknown-release · csv-scope-unproven · collected-at-approximate · as-of-before-evidence · doors-skipped · duplicate-input-ignored) → 12~14 stale · future-timestamp · guidance-stale → 15 예외 요약.
//   as-of-before-evidence(STEP 5 CC-QA-01 — 입력 안의 기록이 기준 시각보다 늦다)는 디자인 §8-9 지시대로 collected-at-approximate 바로 다음의 일반 알림이다.
//  - 강한 공지는 항상 펼침, 일반 알림은 '제목 버튼 + 접힌 본문'(인쇄는 펼침), 예외 요약은 한 줄 + 대상 없음 접힘. 문구는 E 카탈로그(cc.banner.* · cc.time.*)와 C(cc.c.exc.*).
//  - 분 단위 수치는 그리지 않는다(future-timestamp의 aheadMinutes — 금지어 정책, Q2). 경과는 '시간·일'만(days = ageHours ÷ 24 내림).
import type { ReactElement } from "react";
import type { Banner as EngineBanner, DoorId, ExceptionOverlay, RuleCatalogEntry, RuleId, TimeNotice } from "../../../../lib/cloudcheck/model/report";
import { t } from "../i18n/index";
import { Banner } from "./Banner";
import { ruleTitleKey } from "./rule-keys";
import { T } from "./T";

export interface ReportNoticesProps {
  readonly banners: readonly EngineBanner[];
  readonly time: readonly TimeNotice[];
  readonly overlay: ExceptionOverlay | null;
  /** 예외 파일에서 이 리포트의 어느 대상과도 맞지 않은 항목의 점검 ID */
  readonly unmatchedRuleIds: readonly RuleId[];
  /** 점검 제목 조회(없으면 cc.rule.<id>.title 규칙으로 만든 키) */
  readonly catalog?: ReadonlyMap<RuleId, RuleCatalogEntry>;
}

export interface Notice {
  /** 표시 순서(디자인 §6-4 표의 순서 번호) */
  readonly order: number;
  readonly id: string;
  readonly node: ReactElement;
}

/** 엔진 배너 종류 → 표시 순서(일반 알림 3~10, 강한 공지 1) */
const BANNER_ORDER: Readonly<Record<EngineBanner["kind"], number>> = {
  "secrets-detected": 1,
  "areas-not-judged": 3,
  "schema-newer-minor": 4,
  "identity-unconfirmed": 5,
  "collector-unknown-release": 6,
  "csv-scope-unproven": 7,
  "collected-at-approximate": 8,
  "as-of-before-evidence": 9,
  "doors-skipped": 10,
  "duplicate-input-ignored": 11,
};
/** 시간 알림·예외 요약의 순서(엔진 배너 다음) */
const ORDER_STALE = 12;
const ORDER_FUTURE = 13;
const ORDER_GUIDANCE = 14;
const ORDER_EXCEPTION = 15;

function doorNames(doors: readonly DoorId[]): string {
  return doors.map((d) => t(`cc.door.${d}.name`)).join(", ");
}

function engineNotice(b: EngineBanner): Notice {
  const id = `notice-${b.kind}`;
  const order = BANNER_ORDER[b.kind];
  switch (b.kind) {
    case "secrets-detected":
      return {
        order,
        id,
        node: <Banner key={id} variant="strong" ariaLabel={t("cc.c.banner.strong-aria")} title={<T k="cc.banner.secrets-detected.title" p={{ count: b.count }} />} body={<T k="cc.banner.secrets-detected.body" />} />,
      };
    case "areas-not-judged":
      return { order, id, node: <Banner key={id} variant="info" foldId={id} title={<T k="cc.banner.areas-not-judged.title" />} body={<T k="cc.banner.areas-not-judged.body" p={{ doors: doorNames(b.doors) }} />} /> };
    case "schema-newer-minor":
      return { order, id, node: <Banner key={id} variant="info" foldId={id} title={<T k="cc.banner.schema-newer-minor.title" />} body={<T k="cc.banner.schema-newer-minor.body" p={{ got: b.got, supported: b.supported }} />} /> };
    case "identity-unconfirmed":
      return { order, id, node: <Banner key={id} variant="info" foldId={id} title={<T k="cc.banner.identity-unconfirmed.title" />} body={<T k="cc.banner.identity-unconfirmed.body" />} /> };
    case "collector-unknown-release":
      return { order, id, node: <Banner key={id} variant="info" foldId={id} title={<T k="cc.banner.collector-unknown-release.title" />} body={<T k="cc.banner.collector-unknown-release.body" />} /> };
    case "csv-scope-unproven":
      return { order, id, node: <Banner key={id} variant="info" foldId={id} title={<T k="cc.banner.csv-scope-unproven.title" />} body={<T k="cc.banner.csv-scope-unproven.body" />} /> };
    case "collected-at-approximate":
      return { order, id, node: <Banner key={id} variant="info" foldId={id} title={<T k="cc.banner.collected-at-approximate.title" />} body={<T k="cc.banner.collected-at-approximate.body" />} /> };
    case "as-of-before-evidence":
      return { order, id, node: <Banner key={id} variant="info" foldId={id} title={<T k="cc.banner.as-of-before-evidence.title" />} body={<T k="cc.banner.as-of-before-evidence.body" />} /> };
    case "doors-skipped":
      return { order, id, node: <Banner key={id} variant="info" foldId={id} title={<T k="cc.banner.doors-skipped.title" />} body={<T k="cc.banner.doors-skipped.body" p={{ doors: doorNames(b.doors) }} />} /> };
    case "duplicate-input-ignored":
      return { order, id, node: <Banner key={id} variant="info" foldId={id} title={<T k="cc.banner.duplicate-input-ignored.title" />} body={<T k="cc.banner.duplicate-input-ignored.body" p={{ count: b.count }} />} /> };
  }
}

function titles(ids: readonly RuleId[], catalog: ReadonlyMap<RuleId, RuleCatalogEntry> | undefined): string {
  return ids.map((id) => t(catalog?.get(id)?.titleKey ?? ruleTitleKey(id))).join(", ");
}

function timeNotice(n: TimeNotice, catalog: ReadonlyMap<RuleId, RuleCatalogEntry> | undefined): Notice {
  switch (n.kind) {
    case "snapshot-age": {
      const veryStale = n.level === "very-stale";
      const id = `notice-snapshot-age-${n.level}`;
      return veryStale
        ? {
            order: 2,
            id,
            node: <Banner key={id} variant="strong" ariaLabel={t("cc.c.banner.strong-aria")} title={<T k="cc.time.snapshot-age.very-stale.title" p={{ days: Math.floor(n.ageHours / 24) }} />} body={<T k="cc.time.snapshot-age.very-stale.body" />} />,
          }
        : {
            order: ORDER_STALE,
            id,
            node: <Banner key={id} variant="info" foldId={id} title={<T k="cc.time.snapshot-age.stale.title" p={{ hours: n.ageHours }} />} body={<T k="cc.time.snapshot-age.stale.body" />} />,
          };
    }
    case "future-timestamp":
      return { order: ORDER_FUTURE, id: "notice-future-timestamp", node: <Banner key="notice-future-timestamp" variant="info" foldId="notice-future-timestamp" title={<T k="cc.time.future-timestamp.title" />} body={<T k="cc.time.future-timestamp.body" />} /> };
    case "guidance-stale":
      return {
        order: ORDER_GUIDANCE,
        id: "notice-guidance-stale",
        node: <Banner key="notice-guidance-stale" variant="info" foldId="notice-guidance-stale" title={<T k="cc.time.guidance-stale.title" />} body={<T k="cc.time.guidance-stale.body" p={{ rules: titles(n.ruleIds, catalog) }} />} />,
      };
  }
}

/** 표시 순서대로 정렬한 알림(순수 함수 — 순서는 이 함수의 결과로 시험한다) */
export function buildNotices({ banners, time, overlay, unmatchedRuleIds, catalog }: ReportNoticesProps): readonly Notice[] {
  const notices: Notice[] = [...banners.map(engineNotice), ...time.map((n) => timeNotice(n, catalog))];
  if (overlay !== null) {
    const c = overlay.counts;
    if (c.active + c.expired + c.unmatched > 0) {
      notices.push({
        order: ORDER_EXCEPTION,
        id: "notice-exception",
        node: (
          <Banner
            key="notice-exception"
            variant="exception"
            foldId={unmatchedRuleIds.length > 0 ? "notice-exception" : undefined}
            title={<T k="cc.c.exc.summary" p={{ active: c.active, expired: c.expired, unmatched: c.unmatched }} />}
            body={unmatchedRuleIds.length > 0 ? <T k="cc.c.exc.unmatched-line" p={{ n: c.unmatched, rules: titles(unmatchedRuleIds, catalog) }} /> : undefined}
          />
        ),
      });
    }
  }
  // 같은 번호끼리는 들어온 순서 유지(Array.sort는 안정 정렬)
  return [...notices].sort((a, b) => a.order - b.order);
}

export function ReportNotices(props: ReportNoticesProps): ReactElement | null {
  const ordered = buildNotices(props);
  if (ordered.length === 0) return null;
  return <section aria-label={t("cc.c.banner.group-aria")}>{ordered.map((n) => n.node)}</section>;
}
