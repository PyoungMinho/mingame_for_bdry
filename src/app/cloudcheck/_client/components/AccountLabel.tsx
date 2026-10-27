// src/app/cloudcheck/_client/components/AccountLabel.tsx — 신원 표기의 유일한 형태: 별칭 + ••••끝4자리(디자인 D4). 전체 계정 ID(identity.account)는 어디서도 그리지 않는다.
//  - 별칭은 MaskedValue(화면 전체·인쇄 마스킹 alias-001), 없으면 '별칭 없음'. 끝 4자리 표시는 aria-hidden, 스크린리더에는 숨은 글자 '끝 네 자리 1234'(마스킹 점을 '점 점 점 점'으로 읽지 않게).
import type { ReactElement } from "react";
import type { DisplayValue } from "../../../../lib/cloudcheck/model/report";
import { t } from "../i18n/index";
import { MaskedValue } from "./MaskedValue";
import "./AccountLabel.css";

export interface AccountLabelProps {
  readonly alias: DisplayValue | null;
  readonly last4: string;
}

export function AccountLabel({ alias, last4 }: AccountLabelProps): ReactElement {
  return (
    <span className="cc-acct">
      <span className="cc-acct__alias">{alias === null ? t("cc.ctx.no-alias") : <MaskedValue value={alias} />}</span>
      <span aria-hidden="true" className="cc-acct__l4">{`••••${last4}`}</span>
      <span className="cc-vh">{t("cc.c.acct.last4-sr", { last4 })}</span>
    </span>
  );
}
