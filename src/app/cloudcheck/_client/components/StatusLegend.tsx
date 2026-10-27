// src/app/cloudcheck/_client/components/StatusLegend.tsx — 상태 범례: 5상태 도형 + 상태 글자 + 한 줄 뜻(STATUS_ORDER 순). 툴팁에 숨기지 않는다(WCAG 1.4.13).
import type { ReactElement } from "react";
import { STATUS_ORDER } from "../../../../lib/cloudcheck/model/report";
import { t } from "../i18n/index";
import { StatusIcon } from "./StatusIcon";
import "./StatusLegend.css";

// STEP 5 QA CC-QA-21(프론트팀장): <dl>에 role을 주면 dl의 '용어·설명' 의미가 덮여 dt·dd가 목록 밖이 된다(axe dlitem) →
// 접근 이름(범례)은 감싸는 group에 주고 <dl>은 그대로 둔다.
export function StatusLegend(): ReactElement {
  return (
    <div role="group" aria-label={t("cc.status.legend.aria")}>
      <dl className="cc-legend">
        {STATUS_ORDER.map((status) => (
          <div key={status}>
            <dt>
              <StatusIcon status={status} size={24} /> {t(`cc.status.${status}`)}
            </dt>
            <dd>{t(`cc.status.desc.${status}`)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
