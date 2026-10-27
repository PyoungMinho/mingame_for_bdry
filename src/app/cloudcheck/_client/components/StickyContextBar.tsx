// src/app/cloudcheck/_client/components/StickyContextBar.tsx — 고정 맥락 줄(V3·V4): 스크린샷 어디서 잘라도 '누구 계정의 언제 상태인지'가 함께 찍히게 하는 장치. 디자인 최종안 §5-2.
//  - 항목: [체험] 회사 이름 · 별칭 ••••끝4자리 · 클라우드 · 기준 시각(+추정) · '확인 불가 n'(StatusBadge sm) · 예외 n · 경과 · 화면 가리기 켜짐.
//  - 전체 계정 ID는 그리지 않는다(D4). 높이 600px 이하에서는 CSS가 스티키를 푼다.
import type { ReactElement } from "react";
import type { AsOf, CatalogKey, IdentityBlock, TimeNotice } from "../../../../lib/cloudcheck/model/report";
import { fmtTime, t } from "../i18n/index";
import { AccountLabel } from "./AccountLabel";
import { CLOUD_NAME } from "./names";
import { StatusBadge } from "./StatusBadge";
import "./StickyContextBar.css";

export interface StickyContextBarProps {
  readonly identity: IdentityBlock;
  readonly asOf: AsOf | null;
  readonly unknownRules: number;
  readonly exceptionsActive: number | null;
  /** 체험이면 가짜 회사 이름 키(cc.demo.set.<id>.name) */
  readonly demoCompanyKey: CatalogKey | null;
  readonly age: Extract<TimeNotice, { kind: "snapshot-age" }> | null;
  readonly screenMasked: boolean;
}

export function StickyContextBar({ identity, asOf, unknownRules, exceptionsActive, demoCompanyKey, age, screenMasked }: StickyContextBarProps): ReactElement {
  const approx = asOf !== null && (asOf.source === "filename" || asOf.source === "file-time");
  return (
    <div className="cc-ctx" role="region" aria-label={t("cc.ctx.aria")}>
      {demoCompanyKey === null ? (
        <AccountLabel alias={identity.alias} last4={identity.accountLast4} />
      ) : (
        // 체험: 별칭 자리에 가짜 회사 이름(UX §11-2 ③). 끝 4자리는 문서 표본 값
        <span className="cc-acct">
          <span className="cc-acct__alias">{t("cc.ctx.demo-company", { company: t(demoCompanyKey) })}</span>
          <span aria-hidden="true" className="cc-acct__l4">{`••••${identity.accountLast4}`}</span>
          <span className="cc-vh">{t("cc.c.acct.last4-sr", { last4: identity.accountLast4 })}</span>
        </span>
      )}
      <span>{CLOUD_NAME[identity.cloud]}</span>
      {asOf === null ? null : (
        <span>
          <time dateTime={asOf.at}>{t("cc.ctx.asof", { t: fmtTime(asOf.at, "short") })}</time>
          {approx ? ` ${t("cc.ctx.asof-approx")}` : ""}
        </span>
      )}
      <StatusBadge status="unknown" size="sm" count={unknownRules} />
      {exceptionsActive === null ? null : <span>{t("cc.ctx.exceptions", { n: exceptionsActive })}</span>}
      {age === null || age.ageHours < 24 ? null : <span>{age.ageHours >= 48 ? t("cc.ctx.age.days", { n: Math.floor(age.ageHours / 24) }) : t("cc.ctx.age.hours", { n: age.ageHours })}</span>}
      {screenMasked ? <span>{t("cc.ctx.screen-mask")}</span> : null}
    </div>
  );
}
