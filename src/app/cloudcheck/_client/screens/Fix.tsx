// src/app/cloudcheck/_client/screens/Fix.tsx — V4 고치는 법. 디자인 최종안 §6-5(F0~F9), UX §4-5.
//  - 쓰기 명령이 나오는 유일한 화면(R-11). 3단계(먼저 확인 → 바꾸기 → 되돌리기)를 모두 펼쳐 보인다. 복사 버튼은 없다(CliBlock).
//  - 모든 V4에 '대상 계정' 줄(4겹): 셸에서 계정 확인 명령으로 나온 끝 4자리가 같은지 먼저 본다. 체험이면 가짜 계정 안내.
//  - 맥락 줄(F0)과 띠는 App이 그린다. 제목에 사용자 데이터 0(점검 제목은 정적).
import type { ReactElement } from "react";
import type { RuleResult } from "../../../../lib/cloudcheck/model/report";
import { Banner } from "../components/Banner";
import { ImpactChip } from "../components/Chip";
import { DocLink } from "../components/DocLink";
import { AccountCheck, FixSteps } from "../components/FixSteps";
import { MaskedValue } from "../components/MaskedValue";
import { StatusBadge } from "../components/StatusBadge";
import { ACCOUNT_CHECK } from "../config";
import { t } from "../i18n/index";
import { useApp } from "../state/controller";
import { BackButton } from "./shared";

export function FixScreen(): ReactElement | null {
  const { state, actions, catalogById, derived } = useApp();
  const report = state.report;
  const ruleId = state.fixRuleId;
  if (report === null || ruleId === null) return null;
  const rule: RuleResult | undefined = report.doors.flatMap((d) => d.rules).find((r) => r.ruleId === ruleId);
  const entry = catalogById.get(ruleId);
  if (rule === undefined || entry === undefined || entry.fix === null) return null;
  const fix = entry.fix;
  const demo = report.mode.kind === "demo";
  const stale = derived !== null && derived.timeNotices.some((n) => n.kind === "guidance-stale" && n.ruleIds.includes(ruleId));
  const targets = rule.items.filter((i) => i.status === "risk" || i.status === "caution");
  const shown = targets.slice(0, state.view.fixShown);
  const door = `${t(`cc.door.${rule.door}.name`)} · ${t(`cc.door.${rule.door}.term`)}`;

  return (
    <>
      <BackButton labelKey="cc.fix.back" onClick={actions.backToReport} />
      <h1 tabIndex={-1}>{t("cc.fix.title")}</h1>

      <div className="cc-fix__meta">
        <StatusBadge status={rule.status} size="lg" />
        <strong>{t(entry.titleKey)}</strong>
        <span className="cc-muted">{t("cc.fix.meta", { door, n: rule.distribution.total })}</span>
      </div>

      <AccountCheck identity={report.identity} cmd={ACCOUNT_CHECK[report.identity.cloud]} demo={demo} />

      <div className="cc-fix__meta">
        <ImpactChip impact={fix.impact} prodImpact={fix.prodImpact} />
        <span className="cc-small cc-muted">{t("cc.fix.last-verified", { d: entry.lastVerified, n: entry.basis.length })}</span>
      </div>
      {stale ? <Banner variant="info" title={t("cc.fix.stale")} /> : null}

      <FixSteps fix={fix} demo={demo} />

      {targets.length === 0 ? null : (
        <section aria-labelledby="cc-fix-targets-h" className="cc-stack cc-gap-2">
          <h2 id="cc-fix-targets-h">{t("cc.fix.targets")}</h2>
          <ul className="cc-ul cc-fix__targets" role="list">
            {shown.map((item) => (
              <li key={item.id}>
                <MaskedValue value={item.resource.name} />
              </li>
            ))}
          </ul>
          {shown.length < targets.length ? (
            <p>
              <button type="button" className="cc-btn cc-btn--sm" onClick={actions.moreFixTargets}>
                {t("cc.c.table.more", { n: targets.length - shown.length })}
              </button>
            </p>
          ) : null}
          <p className="cc-hint">{t("cc.fix.targets-mask-note")}</p>
        </section>
      )}

      {fix.runbook === null ? null : (
        <p>
          <DocLink link={fix.runbook} labelKey="cc.fix.runbook" />
        </p>
      )}

      <div className="cc-actions">
        <button type="button" className="cc-btn cc-btn--primary" onClick={actions.fixCta}>
          {demo ? t("cc.fix.cta-demo") : t("cc.fix.cta")}
        </button>
      </div>
    </>
  );
}

