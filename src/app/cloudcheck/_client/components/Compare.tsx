// src/app/cloudcheck/_client/components/Compare.tsx — 재점검 비교(V5): BeforeAfterTable과 IdentityCompare. 디자인 최종안 §5-2·UX §4-6.
//  - 묶음 순서: 이번에는 확인 불가가 된 점검(+ 강조 줄: 고쳐서 사라진 것이 아니다) → 심각도가 높아진 점검 → 낮아진 점검 → 확인 불가에서 벗어난 점검(+ 줄) → 그대로(접힘).
//  - 대상 칸 = items.before/after 분포에서 값이 다른 상태만 STATUS_ORDER 순 최대 3개('위험 3 → 1'), 없으면 '대상 분포 그대로'. 비율·점수·개선율은 없다('좋아졌어요' 금지).
//  - became-unknown은 변화 칸에 Chip--strong — 위험이 확인 불가로 바뀐 것을 해결로 읽는 오독(녹색 과신)을 막는다(Q11).
//  - IdentityCompare: 두 카드(이전/이번), 다른 필드는 밑줄. 엔진이 같은 계정이라고 판정했을 때만 '같은 계정입니다.'(sameAccount — 끝 4자리만으로 단정하지 않는다)
import { Fragment, type ReactElement } from "react";
import {
  STATUS_ORDER,
  type CompareSide,
  type Comparison,
  type Distribution,
  type RuleCatalogEntry,
  type RuleChange,
  type RuleId,
} from "../../../../lib/cloudcheck/model/report";
import { fmtNum, fmtTime, t } from "../i18n/index";
import { AccountLabel } from "./AccountLabel";
import { Chip } from "./Chip";
import { cx } from "./cx";
import { DoorIcon } from "./DoorIcon";
import { FoldButton, useFold } from "./Fold";
import { CLOUD_NAME } from "./names";
import { doorOfRuleId, ruleTitleKey } from "./rule-keys";
import { S_KEY } from "./s-keys";
import { StatusBadge } from "./StatusBadge";
import "./table-card.css";
import "./Compare.css";

type OkComparison = Extract<Comparison, { ok: true }>;

export interface BeforeAfterTableProps {
  readonly cmp: OkComparison;
  readonly catalog: ReadonlyMap<RuleId, RuleCatalogEntry>;
}

const COL_COUNT = 5;
const GROUP_ORDER: readonly RuleChange[] = ["became-unknown", "worse", "better", "became-known", "same"];

/** '위험 3 → 1 · 주의 0 → 2' — 값이 다른 상태만 STATUS_ORDER 순으로 최대 3개(이름은 상태 글자 그대로, 비율 없음) */
export function itemsDiffText(before: Distribution, after: Distribution): string {
  const parts: string[] = [];
  for (const s of STATUS_ORDER) {
    if (before[s] !== after[s]) parts.push(`${t(`cc.status.${s}`)} ${fmtNum(before[s])} → ${fmtNum(after[s])}`);
    if (parts.length === 3) break;
  }
  return parts.length === 0 ? t("cc.c.cmp.items.same") : parts.join(" · ");
}

function groupTitle(change: RuleChange, n: number): string {
  switch (change) {
    case "became-unknown":
      return t("cc.c.cmp.group.became-unknown");
    case "worse":
      return t("cc.c.cmp.group.worse");
    case "better":
      return t("cc.c.cmp.group.better");
    case "became-known":
      return t("cc.c.cmp.group.became-known");
    case "same":
      return t("cc.c.cmp.group.same", { n });
  }
}

export function BeforeAfterTable({ cmp, catalog }: BeforeAfterTableProps): ReactElement {
  const sameFold = useFold("compare-same", false);
  const sameRegion = sameFold.regionId;
  const rowsOf = (change: RuleChange): OkComparison["rules"] => cmp.rules.filter((r) => r.change === change);
  const renderRows = (change: RuleChange): ReactElement[] =>
    rowsOf(change).map((r) => {
      const entry = catalog.get(r.ruleId);
      const door = entry?.door ?? doorOfRuleId(r.ruleId);
      return (
        <tr key={r.ruleId} role="row" className={cx(change !== "same" && "cc-ba__chg")}>
          <td role="cell" data-label={t("cc.c.cmp.col.rule")}>
            {door === null ? null : <DoorIcon door={door} size={20} />} {t(entry?.titleKey ?? ruleTitleKey(r.ruleId))}
          </td>
          <td role="cell" data-label={t("cc.c.cmp.col.before")}>
            <StatusBadge status={r.before} size="sm" />
          </td>
          <td role="cell" data-label={t("cc.c.cmp.col.after")}>
            <span aria-hidden="true">→</span> <StatusBadge status={r.after} size="sm" />
          </td>
          <td role="cell" data-label={t("cc.c.cmp.col.change")}>
            {change === "became-unknown" ? <Chip variant="strong">{t(`cc.c.cmp.change.${change}`)}</Chip> : t(`cc.c.cmp.change.${change}`)}
          </td>
          <td role="cell" data-label={t("cc.c.cmp.col.items")}>
            {itemsDiffText(r.items.before, r.items.after)}
          </td>
        </tr>
      );
    });
  return (
    <table className="cc-ba cc-ct" role="table">
      <thead role="rowgroup">
        <tr role="row">
          <th scope="col" role="columnheader">
            {t("cc.c.cmp.col.rule")}
          </th>
          <th scope="col" role="columnheader">
            {t("cc.c.cmp.col.before")}
          </th>
          <th scope="col" role="columnheader">
            {t("cc.c.cmp.col.after")}
          </th>
          <th scope="col" role="columnheader">
            {t("cc.c.cmp.col.change")}
          </th>
          <th scope="col" role="columnheader">
            {t("cc.c.cmp.col.items")}
          </th>
        </tr>
      </thead>
      {GROUP_ORDER.map((change) => {
        const n = rowsOf(change).length;
        if (n === 0) return null;
        if (change === "same") {
          return (
            <Fragment key={change}>
              <tbody role="rowgroup">
                <tr role="row">
                  <td role="cell" colSpan={COL_COUNT}>
                    <FoldButton fold={sameFold}>{groupTitle(change, n)}</FoldButton>
                  </td>
                </tr>
              </tbody>
              <tbody role="rowgroup" id={sameRegion} className={cx("cc-fold", sameFold.open && "cc-open")}>
                {renderRows(change)}
              </tbody>
            </Fragment>
          );
        }
        return (
          <tbody key={change} role="rowgroup">
            <tr role="row">
              <th scope="rowgroup" role="rowheader" colSpan={COL_COUNT}>
                {groupTitle(change, n)}
              </th>
            </tr>
            {change === "became-unknown" || change === "became-known" ? (
              <tr role="row">
                <td role="cell" colSpan={COL_COUNT} className="cc-ba__note">
                  {t(change === "became-unknown" ? S_KEY.cmpBecameUnknownNote : S_KEY.cmpBecameKnownNote)}
                </td>
              </tr>
            ) : null}
            {renderRows(change)}
          </tbody>
        );
      })}
    </table>
  );
}

export interface IdentityCompareProps {
  readonly before: CompareSide;
  readonly after: CompareSide;
  /**
   * 엔진 판정으로 같은 계정인가 — 비교 성공이거나 '같은 수집 결과' 거부(엔진은 계정을 먼저 본다). 화면이 가진 것은 끝 4자리·별칭뿐이라
   * 그것만으로 '같은 계정입니다'라고 쓰면, 끝 4자리가 같은 다른 계정(엔진 different-account 거부)에서 거부 문장과 정반대 말을 하게 된다
   * (STEP 7 직전 스모크에서 발견, 프론트팀장). false면 그 문장을 쓰지 않고 계정 칸에 밑줄을 친다.
   */
  readonly sameAccount: boolean;
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function Side({ label, side, other, accountDiffers }: { readonly label: string; readonly side: CompareSide; readonly other: CompareSide; readonly accountDiffers: boolean }): ReactElement {
  const diffLast4 = side.accountLast4 !== other.accountLast4;
  const diffCloud = side.cloud !== other.cloud;
  const diffAlias = !sameJson(side.alias, other.alias);
  const diffAsOf = !sameJson(side.asOf, other.asOf);
  return (
    <section className="cc-idc__side">
      <p className="cc-small">
        <strong>{label}</strong>
      </p>
      <p>
        <span className={cx((diffAlias || diffLast4 || accountDiffers) && "cc-idc__diff")}>
          <AccountLabel alias={side.alias} last4={side.accountLast4} />
        </span>
      </p>
      <p>
        <span className={cx(diffCloud && "cc-idc__diff")}>{CLOUD_NAME[side.cloud]}</span>
        {side.asOf === null ? null : (
          <>
            {" · "}
            <time className={cx(diffAsOf && "cc-idc__diff")} dateTime={side.asOf.at}>
              {fmtTime(side.asOf.at, "full")}
            </time>
          </>
        )}
      </p>
    </section>
  );
}

export function IdentityCompare({ before, after, sameAccount }: IdentityCompareProps): ReactElement {
  const same = sameAccount && before.cloud === after.cloud && before.accountLast4 === after.accountLast4;
  return (
    <div>
      <div className="cc-idc">
        <Side label={t("cc.c.cmp.before")} side={before} other={after} accountDiffers={!sameAccount} />
        <Side label={t("cc.c.cmp.after")} side={after} other={before} accountDiffers={!sameAccount} />
      </div>
      {same ? <p className="cc-hint">{t("cc.c.cmp.match-ok")}</p> : null}
    </div>
  );
}
