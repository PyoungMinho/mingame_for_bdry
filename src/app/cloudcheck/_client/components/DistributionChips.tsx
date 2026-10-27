// src/app/cloudcheck/_client/components/DistributionChips.tsx — 점검 단위 분포 칩 5개(STATUS_ORDER 고정). 막대·도넛·비율 금지(점수처럼 읽힌다).
//  - md = 리포트 분포(0도 표시, --zero), sm = 문 머리(hideZero). lead면 '점검 {total}개'를 앞에 붙인다.
//  - 칩마다 모양 + 상태 글자 + 개수. 상태 글자를 줄이지 않는다(G-D3). distribution.items(대상 단위)는 쓰지 않는다(D1) — 호출하는 쪽이 rules를 넘긴다.
import type { ReactElement } from "react";
import { STATUS_ORDER, type Distribution } from "../../../../lib/cloudcheck/model/report";
import { fmtNum, t } from "../i18n/index";
import { cx } from "./cx";
import { StatusIcon } from "./StatusIcon";
import "./StatusBadge.css"; // .cc-sb,.cc-dc 공통 선언 — 반드시 아래 DistributionChips.css보다 먼저
import "./DistributionChips.css";

export interface DistributionChipsProps {
  readonly dist: Distribution;
  readonly size?: "md" | "sm";
  readonly hideZero?: boolean;
  readonly lead?: boolean;
}

export function DistributionChips({ dist, size = "md", hideZero = false, lead = false }: DistributionChipsProps): ReactElement {
  return (
    <>
      {lead ? <p className="cc-dist__lead">{t("cc.c.dist.lead", { total: dist.total })}</p> : null}
      <ul className="cc-dist" role="list">
        {STATUS_ORDER.filter((s) => !(hideZero && dist[s] === 0)).map((status) => (
          <li key={status} className={cx("cc-dc", `cc-st--${status}`, size === "sm" && "cc-dc--sm", dist[status] === 0 && "cc-dc--zero")}>
            <StatusIcon status={status} size={size === "sm" ? 16 : 20} />
            {t(`cc.status.${status}`)} <span className="cc-dc__n">{fmtNum(dist[status])}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
