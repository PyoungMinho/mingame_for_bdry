// src/app/cloudcheck/_client/components/FirstLook.tsx — 먼저 볼 3개(D6). firstLook.mode 세 가지를 한 컴포넌트가 분기한다. 번호 장식 없음(순위처럼 읽힌다), 축하 연출 없음.
//  - findings: 위험·주의(모자라면 확인 불가로 채운 것) 최대 3행. [고치는 법](fix가 있고 위험·주의일 때) + [대상 n개 보기](확인 불가는 [직접 볼 목록에서 보기]).
//  - unlock: 많이 푸는 해소법 순 최대 3묶음. 묶음마다 cc.c.first.unlock.<kind> + 점검 제목 나열.
//  - none-found: info 배너(확인한 범위에서 위험·주의를 찾지 못했습니다) + 못 보는 것 7가지는 여전히 직접 확인 + 졸업 경로. 축하 아님.
//  - [대상 n개 보기]는 해당 점검 행을 펼치고 포커스를 주는 동작(화면 이동 아님, pushState 없음) — 동작은 페이지가 정한다.
import type { ReactElement } from "react";
import type { FirstLook as FirstLookData, RuleCatalogEntry, RuleId, RuleResult } from "../../../../lib/cloudcheck/model/report";
import { t } from "../i18n/index";
import { Banner } from "./Banner";
import { cx } from "./cx";
import { DOM_ID } from "./dom-ids";
import { ruleTitleKey } from "./rule-keys";
import { StatusBadge } from "./StatusBadge";
import { Msg } from "./T";
import "./FirstLook.css";

export interface FirstLookProps {
  readonly firstLook: FirstLookData;
  readonly rules: ReadonlyMap<RuleId, RuleResult>;
  readonly catalog: ReadonlyMap<RuleId, RuleCatalogEntry>;
  readonly onFix: (id: RuleId) => void;
  readonly onShowTargets: (id: RuleId) => void;
  readonly onShowManual: () => void;
  /** none-found의 [조회 범위로 이동]. 없으면 버튼을 그리지 않는다 */
  readonly onShowScope?: () => void;
}

function Finding({ id, rule, entry, onFix, onShowTargets, onShowManual }: { readonly id: RuleId; readonly rule: RuleResult; readonly entry: RuleCatalogEntry | undefined } & Pick<FirstLookProps, "onFix" | "onShowTargets" | "onShowManual">): ReactElement {
  const titleId = `cc-first-${id}-title`;
  const fixId = DOM_ID.firstFix(id);
  const targetsId = `cc-first-${id}-targets`;
  const canFix = (rule.status === "risk" || rule.status === "caution") && entry?.fix !== null && entry?.fix !== undefined;
  return (
    <li className={cx("cc-pl__i", `cc-st--${rule.status}`, rule.status === "unknown" && "cc-hatch")}>
      <h3 className="cc-rule__title" id={titleId}>
        <StatusBadge status={rule.status} size="md" /> {t(entry?.titleKey ?? ruleTitleKey(id))}
      </h3>
      <p className="cc-rule__why">
        <Msg m={rule.why} />
      </p>
      <div className="cc-pl__act">
        {canFix ? (
          <button type="button" id={fixId} className="cc-btn cc-btn--sm" aria-labelledby={`${fixId} ${titleId}`} onClick={() => onFix(id)}>
            {t("cc.c.first.fix")}
          </button>
        ) : null}
        {rule.status === "unknown" ? (
          <button type="button" id={targetsId} className="cc-btn cc-btn--sm" aria-labelledby={`${targetsId} ${titleId}`} onClick={onShowManual}>
            {t("cc.c.first.manual")}
          </button>
        ) : (
          <button type="button" id={targetsId} className="cc-btn cc-btn--sm" aria-labelledby={`${targetsId} ${titleId}`} onClick={() => onShowTargets(id)}>
            {t("cc.c.first.targets", { n: rule.distribution.total })}
          </button>
        )}
      </div>
    </li>
  );
}

export function FirstLook({ firstLook, rules, catalog, onFix, onShowTargets, onShowManual, onShowScope }: FirstLookProps): ReactElement {
  if (firstLook.mode === "none-found") {
    return (
      <section className="cc-first" aria-labelledby={DOM_ID.first}>
        <Banner
          variant="info"
          title={
            <h2 id={DOM_ID.first} tabIndex={-1}>
              {t("cc.c.first.none")}
            </h2>
          }
          body={
            <div className="cc-stack cc-gap-2">
              <p>{t("cc.c.first.none-body")}</p>
              {onShowScope === undefined ? null : (
                <p>
                  <button type="button" className="cc-btn cc-btn--sm" onClick={onShowScope}>
                    {t("cc.c.first.none-cta")}
                  </button>
                </p>
              )}
              <p className="cc-small">{t("cc.c.grad.line")}</p>
            </div>
          }
        />
      </section>
    );
  }

  if (firstLook.mode === "unlock") {
    return (
      <section className="cc-first" aria-labelledby={DOM_ID.first}>
        <h2 id={DOM_ID.first} tabIndex={-1}>
          {t("cc.c.first.unlock")}
        </h2>
        <ol className="cc-pl" role="list">
          {firstLook.groups.map((g, i) => (
            <li key={i} className="cc-pl__i cc-st--unknown cc-hatch">
              <p>
                <strong>{t(`cc.c.first.unlock.${g.resolution.kind}`, { n: g.ruleIds.length, permission: g.resolution.permissions.join(", ") })}</strong>
              </p>
              <p className="cc-rule__why">{g.ruleIds.map((id) => t(catalog.get(id)?.titleKey ?? ruleTitleKey(id))).join(" · ")}</p>
            </li>
          ))}
        </ol>
      </section>
    );
  }

  const ids = firstLook.ruleIds.filter((id) => rules.has(id));
  return (
    <section className="cc-first" aria-labelledby={DOM_ID.first}>
      <h2 id={DOM_ID.first} tabIndex={-1}>
        {t("cc.c.first.findings", { n: ids.length })}
      </h2>
      <ol className="cc-pl" role="list">
        {ids.map((id) => {
          const rule = rules.get(id);
          return rule === undefined ? null : <Finding key={id} id={id} rule={rule} entry={catalog.get(id)} onFix={onFix} onShowTargets={onShowTargets} onShowManual={onShowManual} />;
        })}
      </ol>
    </section>
  );
}
