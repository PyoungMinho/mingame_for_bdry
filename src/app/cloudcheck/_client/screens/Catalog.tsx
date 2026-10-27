// src/app/cloudcheck/_client/screens/Catalog.tsx — V7 판정 규칙. 디자인 최종안 §6-8(I1·I2), UX §4-8. 번역을 허용하는 화면이다.
//  - 펼친 점검 본문의 소제목은 h3(문 그룹 h2 다음 — STEP 5 QA CC-QA-21 제목 수준 건너뜀 해소, 모양은 .cc-rule__sub 그대로).
//  - 룰 데이터(RULE_CATALOG)로 그린다: V3·V4와 같은 원천. 문 5그룹 × 점검 <details>(V7이라 허용), priority 숫자는 보이지 않는다(순위처럼 읽힌다).
//  - 상태별 조건은 conditionKeys에 있는 상태만(그 점검이 낼 수 있는 상태), 기준값에는 공개 기준/도구 기준 칩, released:false는 펼칠 수 없는 한 줄.
import { useId, useState, type ReactElement } from "react";
import { Chip } from "../components/Chip";
import { DocLink } from "../components/DocLink";
import { DoorIcon } from "../components/DoorIcon";
import { StatusBadge } from "../components/StatusBadge";
import { t, fmtNum } from "../i18n/index";
import { DOORS, STATUS_ORDER, type Cloud, type RuleCatalogEntry, type RuleParamView } from "../../../../lib/cloudcheck/model/report";
import { useApp } from "../state/controller";
import { BackButton } from "./shared";

type CloudFilter = "all" | Cloud;

const paramValue = (v: RuleParamView["value"]): string => (typeof v === "number" ? fmtNum(v) : typeof v === "string" ? v : v.map((x) => (typeof x === "number" ? fmtNum(x) : x)).join(", "));

function CatalogEntryView({ entry }: { readonly entry: RuleCatalogEntry }): ReactElement {
  const title = t(entry.titleKey);
  const cloudName = t(entry.cloud === "aws" ? "cc.app.cloud.aws" : "cc.app.cloud.azure");
  const head = (
    <>
      <strong>{title}</strong>
      <code className="cc-cat__id">{entry.ruleId}</code>
      <span className="cc-small cc-muted">{cloudName}</span>
      <span className="cc-small">{t(`cc.catalog.max.${entry.maxStatus}`)}</span>
    </>
  );
  if (!entry.released) {
    return (
      <li className="cc-cat cc-cat--off">
        <div className="cc-cat__sum">{head}</div>
        <p className="cc-cat__body cc-small">{t("cc.catalog.unreleased")}</p>
      </li>
    );
  }
  const states = STATUS_ORDER.filter((s) => entry.conditionKeys[s] !== undefined);
  return (
    <li>
      <details className="cc-cat">
        <summary className="cc-cat__sum">{head}</summary>
        <div className="cc-cat__body cc-stack cc-gap-2">
          {entry.allowsClear ? null : <p><Chip variant="strong">{t("cc.c.chip.no-clear")}</Chip></p>}
          <div>
            <h3 className="cc-rule__sub">{t("cc.catalog.field.summary")}</h3>
            <p>{t(entry.summaryKey)}</p>
          </div>
          <div>
            <h3 className="cc-rule__sub">{t("cc.catalog.field.conditions")}</h3>
            <dl className="cc-cat__dl">
              {states.map((s) => {
                const key = entry.conditionKeys[s];
                return key === undefined ? null : (
                  <div key={s}>
                    <dt>
                      <StatusBadge status={s} size="sm" />
                    </dt>
                    <dd>{t(key)}</dd>
                  </div>
                );
              })}
            </dl>
          </div>
          {entry.permissions.length === 0 ? null : (
            <div>
              <h3 className="cc-rule__sub">{t("cc.catalog.field.permissions")}</h3>
              <p>
                {entry.permissions.map((p) => (
                  <code key={p} className="cc-pm">
                    {p}
                  </code>
                ))}
              </p>
            </div>
          )}
          <div>
            <h3 className="cc-rule__sub">{t("cc.catalog.field.paths")}</h3>
            <p>{entry.paths.map((p) => t(`cc.catalog.path.${p}`)).join(" · ")}</p>
          </div>
          {entry.params.length === 0 ? null : (
            <div>
              <h3 className="cc-rule__sub">{t("cc.catalog.field.params")}</h3>
              <ul className="cc-ul" role="list">
                {entry.params.map((p) => (
                  <li key={p.key}>
                    {t(p.key)}: <code className="cc-mono">{paramValue(p.value)}</code> <Chip variant="hint">{t(`cc.catalog.param.${p.basis}`)}</Chip>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {entry.cannotSee.length === 0 ? null : (
            <div>
              <h3 className="cc-rule__sub">{t("cc.catalog.field.cannot")}</h3>
              <ul className="cc-ul" role="list">
                {entry.cannotSee.map((k) => (
                  <li key={k}>{t(k)}</li>
                ))}
              </ul>
            </div>
          )}
          {entry.falsePositiveKeys.length === 0 ? null : (
            <div>
              <h3 className="cc-rule__sub">{t("cc.catalog.field.false-positive")}</h3>
              <ul className="cc-ul" role="list">
                {entry.falsePositiveKeys.map((k) => (
                  <li key={k}>{t(k)}</li>
                ))}
              </ul>
            </div>
          )}
          {entry.basis.length === 0 ? null : (
            <div>
              <h3 className="cc-rule__sub">{t("cc.catalog.field.basis")}</h3>
              <ul className="cc-ul" role="list">
                {entry.basis.map((b) => (
                  <li key={b.titleKey}>
                    <DocLink link={b.link} labelKey={b.titleKey} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="cc-small cc-muted">
            {t("cc.catalog.field.verified")}: <time dateTime={entry.lastVerified}>{entry.lastVerified}</time>
          </p>
        </div>
      </details>
    </li>
  );
}

export function CatalogScreen(): ReactElement {
  const { actions, deps } = useApp();
  const [filter, setFilter] = useState<CloudFilter>("all");
  const name = useId();
  const released = deps.catalog.filter((e) => e.released);
  const count = { total: released.length, aws: released.filter((e) => e.cloud === "aws").length, azure: released.filter((e) => e.cloud === "azure").length };
  const shown = deps.catalog.filter((e) => filter === "all" || e.cloud === filter).sort((a, b) => a.priority - b.priority);
  const options: readonly { readonly value: CloudFilter; readonly label: string }[] = [
    { value: "all", label: t("cc.catalog.cloud.all") },
    { value: "aws", label: t("cc.app.cloud.aws") },
    { value: "azure", label: t("cc.app.cloud.azure") },
  ];
  return (
    <>
      <BackButton labelKey="cc.app.back" onClick={actions.back} />
      <h1 tabIndex={-1}>{t("cc.catalog.title")}</h1>
      <p>{t("cc.catalog.sub")}</p>

      <div className="cc-stack cc-gap-2">
        <fieldset className="cc-actions">
          <legend className="cc-lab">{t("cc.catalog.cloud.legend")}</legend>
          {options.map((o) => (
            <label key={o.value} className="cc-opt">
              <input type="radio" name={name} value={o.value} checked={filter === o.value} onChange={() => setFilter(o.value)} />
              {o.label}
            </label>
          ))}
        </fieldset>
        <p>{t("cc.catalog.count", { total: count.total, aws: count.aws, azure: count.azure })}</p>
        <p className="cc-small cc-muted">{t("cc.catalog.order")}</p>
      </div>

      {DOORS.map((door) => {
        const list = shown.filter((e) => e.door === door);
        if (list.length === 0) return null;
        return (
          <section key={door} aria-labelledby={`cc-cat-${door}-h`} className="cc-stack cc-gap-2">
            <h2 id={`cc-cat-${door}-h`} className="cc-door__h">
              <DoorIcon door={door} size={24} />
              {t(`cc.door.${door}.name`)}
              <span className="cc-door__term">{t(`cc.door.${door}.term`)}</span>
            </h2>
            <ul className="cc-cat__list" role="list">
              {list.map((e) => (
                <CatalogEntryView key={e.ruleId} entry={e} />
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}
