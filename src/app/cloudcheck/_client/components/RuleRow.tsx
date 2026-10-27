// src/app/cloudcheck/_client/components/RuleRow.tsx — 점검 행(RuleRow) · 수집하지 않은 문 묶음(NotCollectedGroup) · 해당 없음 접힘(NaFold). 디자인 최종안 §5-2·UX §4-4b.
//  - 구조: <li class="cc-rule cc-st--{status}"> → .cc-rule__sum = <h3><button.cc-tog aria-expanded aria-controls> 안에 [StatusBadge md + 제목 + chevron] + 버튼 밖의 사유 줄·꼬리표·동작 영역.
//    같은 줄의 다른 버튼([고치는 법] 등)은 토글 버튼 밖에 둔다(상호작용 중첩 금지). 접근 이름 = '위험 콘솔 사용자 MFA'.
//  - 본문은 .cc-fold(기본 접힘, DOM에는 항상 있다): 위험·주의·확인 불가는 cc-po(인쇄에서 펼침), 이상 없음·해당 없음은 요약줄만 인쇄.
//  - 이상 없음 행: 꼬리표(확인한 범위 · 기준 시각) + '못 본 것 n' 칩이 반드시 보인다(초록이 맹점 없이 혼자 나타나지 않게). 해당 없음 행: 근거 줄 필수.
//  - 모델 타입과 겹치는 이름은 없다. 점검 제목은 entry.titleKey(데이터에서 온 키). 대상 표는 table prop으로 TargetTable에 넘긴다.
import { useId, type ReactElement, type ReactNode } from "react";
import type { Coverage, Label, RuleCatalogEntry, RuleResult } from "../../../../lib/cloudcheck/model/report";
import { fmtTime, t } from "../i18n/index";
import { Chip, LabelChip } from "./Chip";
import { cx } from "./cx";
import { DocLink } from "./DocLink";
import { DOM_ID } from "./dom-ids";
import { EvidenceList } from "./EvidenceList";
import { controlledFold, FoldButton, FoldRegion, useFold } from "./Fold";
import { ruleTitleKey } from "./rule-keys";
import { StatusBadge } from "./StatusBadge";
import { Msg, T } from "./T";
import { TargetTable, type TargetTableProps } from "./TargetTable";
import "./RuleRow.css";

/**
 * 확인한 범위 글자(cc.c.rule.coverage.*).
 * STEP 5 QA CC-QA-06(G7, 프론트팀장): 범위가 증명되지 않은 점검(coverage.proven = false — 목록 잘림·수집 한도·리전 누락 등, 위험·주의만 해당)에는
 * '계정 전체'·'… 전부'를 쓰지 않는다(어디까지 봤는지 정직하게). 리전·구독 수가 모자라면(covered < total) 그 수가 이미 '일부'를 말하므로 그대로 두고,
 * 그 밖의 미증명은 '일부만(전체를 확인하지 못함)'으로 쓴다. 무엇이 빠졌는지는 문 구역 수집 줄(일부만 수집됨 · 사유)과 대상 표·직접 볼 목록의 확인 불가 대상이 말한다.
 * CSV 행 수·범위 정보 없음은 원래 '전체'를 말하지 않으므로 그대로다.
 */
export function coverageText(c: Coverage): string {
  const short = c.covered !== null && c.total !== null && c.covered < c.total;
  switch (c.kind) {
    case "account-global":
      return c.proven ? t("cc.c.rule.coverage.account-global") : t("cc.c.rule.coverage.unproven");
    case "regions":
      if (short) return t("cc.c.rule.coverage.regions-part", { covered: c.covered ?? 0, total: c.total ?? 0 });
      return c.proven ? t("cc.c.rule.coverage.regions-all", { total: c.total ?? 0 }) : t("cc.c.rule.coverage.unproven");
    case "subscriptions":
      if (short) return t("cc.c.rule.coverage.subscriptions-part", { covered: c.covered ?? 0, total: c.total ?? 0 });
      return c.proven ? t("cc.c.rule.coverage.subscriptions-all", { total: c.total ?? 0 }) : t("cc.c.rule.coverage.unproven");
    case "csv-rows":
      return t("cc.c.rule.coverage.csv-rows", { covered: c.covered ?? 0 });
    case "none":
      return t("cc.c.rule.coverage.none");
  }
}

/**
 * 꼬리표: '확인한 범위: … · 기준 시각: …'. 기준 시각이 없는 행은 원래 꼬리표를 그리지 않지만,
 * 범위가 증명되지 않은 위험·주의 행은 '일부만'을 알리려고 범위만 그린다(CC-QA-06).
 */
function Tail({ rule }: { readonly rule: RuleResult }): ReactElement | null {
  if (rule.status === "unknown") return null;
  if (rule.asOf === null) {
    if (rule.coverage.proven) return null;
    return (
      <p className="cc-rule__tail">
        <T k="cc.c.rule.tail-scope" p={{ coverage: coverageText(rule.coverage) }} />
      </p>
    );
  }
  return (
    <p className="cc-rule__tail">
      <T k="cc.c.rule.tail" p={{ coverage: coverageText(rule.coverage), asof: <time dateTime={rule.asOf.at}>{fmtTime(rule.asOf.at, "short")}</time> }} />
    </p>
  );
}

export interface RuleRowProps {
  readonly rule: RuleResult;
  readonly entry: RuleCatalogEntry;
  readonly open: boolean;
  readonly onToggle: () => void;
  readonly onFix?: () => void;
  readonly onShowManual?: () => void;
  readonly table: TargetTableProps;
  /** 대상 표 자리에 들어갈 본문(AZ-MFA-G의 GuideCard). 있으면 대상 표를 그리지 않는다 */
  readonly guide?: ReactNode;
}

export function RuleRow({ rule, entry, open, onToggle, onFix, onShowManual, table, guide }: RuleRowProps): ReactElement {
  const uid = useId();
  const bodyId = `${uid}-body`;
  const titleId = `${uid}-title`;
  const fixId = DOM_ID.ruleFix(rule.ruleId);
  const fold = controlledFold(open, onToggle, bodyId);
  const status = rule.status;
  const expandInPrint = status === "risk" || status === "caution" || status === "unknown";
  const canFix = (status === "risk" || status === "caution") && entry.fix !== null && onFix !== undefined;
  const labels = rule.labels.filter((l): l is Exclude<Label, { kind: "exception" }> => l.kind !== "exception");

  return (
    <li id={DOM_ID.rule(rule.ruleId)} className={cx("cc-rule", `cc-st--${status}`, status === "unknown" && "cc-hatch")}>
      <div className="cc-rule__sum">
        <h3>
          <FoldButton fold={fold} className="cc-rule__tog" id={DOM_ID.ruleToggle(rule.ruleId)}>
            <StatusBadge status={status} size="md" />
            <span id={titleId} className="cc-rule__title">
              {t(entry.titleKey)}
            </span>
          </FoldButton>
        </h3>
        <p className="cc-rule__why">{status === "na" ? <T k="cc.c.rule.na-basis" p={{ basis: <Msg m={rule.basis} /> }} /> : <Msg m={rule.why} />}</p>
        <Tail rule={rule} />
        <div className="cc-rule__act">
          {status === "na" ? null : <Chip>{t("cc.c.chip.targets", { n: rule.distribution.total })}</Chip>}
          {status === "clear" ? <Chip variant="strong">{t("cc.c.chip.cannot-see", { n: entry.cannotSee.length })}</Chip> : null}
          {labels.map((l, i) => (
            <LabelChip key={i} label={l} />
          ))}
          {canFix ? (
            <button type="button" id={fixId} className="cc-btn cc-btn--sm" aria-labelledby={`${fixId} ${titleId}`} onClick={onFix}>
              {t("cc.c.rule.fix")}
            </button>
          ) : null}
          {status === "unknown" && onShowManual !== undefined ? (
            <button type="button" className="cc-btn cc-btn--sm" id={`${uid}-manual`} aria-labelledby={`${uid}-manual ${titleId}`} onClick={onShowManual}>
              {t("cc.c.rule.manual")}
            </button>
          ) : null}
        </div>
      </div>
      <FoldRegion fold={fold} print={expandInPrint ? "expand" : undefined} className="cc-rule__body">
        {entry.impactKey === null ? null : (
          <div>
            <h4 className="cc-rule__sub">{t("cc.c.rule.impact")}</h4>
            <p>{t(entry.impactKey)}</p>
          </div>
        )}
        {status === "caution" && entry.questionKey !== null ? (
          <div>
            <h4 className="cc-rule__sub">{t("cc.c.rule.question")}</h4>
            <p>{t(entry.questionKey)}</p>
          </div>
        ) : null}
        {rule.status === "unknown" ? (
          <>
            <div>
              <h4 className="cc-rule__sub">{t("cc.c.rule.gaps")}</h4>
              <ul role="list">
                {rule.gaps.map((g) => (
                  <li key={g}>
                    <Msg m={{ code: g }} short />
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="cc-rule__sub">{t("cc.c.rule.resolution")}</h4>
              <p>{t(`cc.c.rule.resolution.${rule.resolution.kind}`, { permissions: rule.resolution.permissions.join(", ") })}</p>
            </div>
          </>
        ) : null}
        {entry.allowsClear ? null : (
          <div>
            <Chip>{t("cc.c.chip.no-clear")}</Chip>
          </div>
        )}
        {guide !== undefined ? guide : rule.items.length > 0 ? <TargetTable {...table} /> : null}
        {entry.cannotSee.length === 0 ? null : (
          <div>
            <h4 className="cc-rule__sub">{t("cc.c.rule.cannot")}</h4>
            <ul role="list">
              {entry.cannotSee.map((k) => (
                <li key={k}>{t(k)}</li>
              ))}
            </ul>
          </div>
        )}
        {entry.basis.length === 0 ? null : (
          <div>
            <h4 className="cc-rule__sub">{t("cc.c.rule.basis")}</h4>
            <ul role="list">
              {entry.basis.map((b) => (
                <li key={b.titleKey}>
                  <DocLink link={b.link} labelKey={b.titleKey} />
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="cc-small cc-muted">
          <T k="cc.c.rule.last-verified" p={{ d: { d: entry.lastVerified } }} />
        </p>
        {guide === undefined ? <EvidenceList items={rule.items} /> : null}
      </FoldRegion>
    </li>
  );
}

/** 점검 제목만 있는 요약줄(수집하지 않은 문의 점검·카탈로그에 없는 점검) — 토글·본문 없음 */
export function RuleSummaryRow({ rule, entry }: { readonly rule: RuleResult; readonly entry?: RuleCatalogEntry }): ReactElement {
  return (
    <li className={cx("cc-rule", `cc-st--${rule.status}`, rule.status === "unknown" && "cc-hatch")}>
      <div className="cc-rule__sum">
        <h3 className="cc-rule__title">
          <StatusBadge status={rule.status} size="md" /> {t(entry?.titleKey ?? ruleTitleKey(rule.ruleId))}
        </h3>
        <p className="cc-rule__why">{rule.status === "na" ? <T k="cc.c.rule.na-basis" p={{ basis: <Msg m={rule.basis} /> }} /> : <Msg m={rule.why} />}</p>
        <Tail rule={rule} />
      </div>
    </li>
  );
}

export interface RuleGroupProps {
  readonly rules: readonly RuleResult[];
  /** 점검 제목 조회(없으면 cc.rule.<id>.title 규칙으로 만든 키) */
  readonly catalog?: ReadonlyMap<RuleResult["ruleId"], RuleCatalogEntry>;
}

/** 수집하지 않은 문의 점검들을 한 줄로 묶는다: '확인 불가 · 수집하지 않아 판단하지 못한 점검 n개' + 펼치면 요약줄들(인쇄는 요약줄만) */
export function NotCollectedGroup({ rules, catalog }: RuleGroupProps): ReactElement {
  const fold = useFold(`not-collected-${rules[0]?.ruleId ?? "none"}`, false);
  return (
    <div className="cc-ncg">
      <FoldButton fold={fold}>
        <StatusBadge status="unknown" size="md" />
        <span>{t("cc.c.dsec.not-collected-group", { n: rules.length })}</span>
      </FoldButton>
      <FoldRegion fold={fold} print="expand">
        <ul role="list">
          {rules.map((r) => (
            <RuleSummaryRow key={r.ruleId} rule={r} entry={catalog?.get(r.ruleId)} />
          ))}
        </ul>
      </FoldRegion>
    </div>
  );
}

/** 해당 없음 점검들: 문 구역 끝의 '해당 없음 n개' 한 줄(펼치면 근거 줄이 있는 행들, 인쇄는 펼침) */
export function NaFold({ rules, catalog }: RuleGroupProps): ReactElement {
  const fold = useFold(`na-fold-${rules[0]?.ruleId ?? "none"}`, false);
  return (
    <div className="cc-ncg">
      <FoldButton fold={fold}>
        <span>{t("cc.c.dsec.na-fold", { n: rules.length })}</span>
      </FoldButton>
      <FoldRegion fold={fold} print="expand">
        <ul role="list">
          {rules.map((r) => (
            <RuleSummaryRow key={r.ruleId} rule={r} entry={catalog?.get(r.ruleId)} />
          ))}
        </ul>
      </FoldRegion>
    </div>
  );
}
