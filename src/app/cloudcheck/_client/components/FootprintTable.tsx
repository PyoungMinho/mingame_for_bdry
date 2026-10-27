// src/app/cloudcheck/_client/components/FootprintTable.tsx — 예상 호출 목록(V1): 수집기가 부르는 API를 contract/calls.ts의 AWS_CALLS·AZURE_CALLS에서 그대로 보인다. 디자인 최종안 §5-2.
//  - 열: 호출(cli) · 권한(null이면 '권한 없음') · 쓰는 곳(신원·범위·문 이름) · 호출 단위 · 구분(조회 / 보고서 생성 요청). 쓰기가 아닌 호출(readOnly:false)은 1건뿐 — 행에 굵은 표시(cc-fp__w).
//  - 600px 미만은 카드(cc-ct). 인쇄 숨김(V1 전용).
import type { ReactElement } from "react";
import { AWS_CALLS, AZURE_CALLS, type CallMeta, type CallPhase } from "../../../../lib/cloudcheck/contract/calls";
import type { Cloud } from "../../../../lib/cloudcheck/model/report";
import { t } from "../i18n/index";
import { cx } from "./cx";
import "./table-card.css";
import "./FootprintTable.css";

export interface FootprintTableProps {
  readonly cloud: Cloud;
}

function phaseText(p: CallPhase): string {
  return p === "identity" || p === "scope" ? t(`cc.c.fp.phase.${p}`) : t(`cc.door.${p}.name`);
}

export function FootprintTable({ cloud }: FootprintTableProps): ReactElement {
  const calls: readonly (readonly [string, CallMeta])[] = Object.entries(cloud === "aws" ? AWS_CALLS : AZURE_CALLS);
  return (
    <table className="cc-fp cc-ct" role="table">
      <thead role="rowgroup">
        <tr role="row">
          <th scope="col" role="columnheader">
            {t("cc.c.fp.col.call")}
          </th>
          <th scope="col" role="columnheader">
            {t("cc.c.fp.col.permission")}
          </th>
          <th scope="col" role="columnheader">
            {t("cc.c.fp.col.phases")}
          </th>
          <th scope="col" role="columnheader">
            {t("cc.c.fp.col.unit")}
          </th>
          <th scope="col" role="columnheader">
            {t("cc.c.fp.col.kind")}
          </th>
        </tr>
      </thead>
      <tbody role="rowgroup">
        {calls.map(([id, meta]) => (
          <tr key={id} role="row" className={cx(!meta.readOnly && "cc-fp__w")}>
            <td role="cell" data-label={t("cc.c.fp.col.call")}>
              {meta.cli}
            </td>
            <td role="cell" data-label={t("cc.c.fp.col.permission")}>
              {meta.permission === null ? t("cc.c.fp.no-permission") : meta.permission}
            </td>
            <td role="cell" data-label={t("cc.c.fp.col.phases")}>
              {meta.phases.map(phaseText).join(", ")}
            </td>
            <td role="cell" data-label={t("cc.c.fp.col.unit")}>
              {t(`cc.c.fp.unit.${meta.unit}`)}
            </td>
            <td role="cell" data-label={t("cc.c.fp.col.kind")}>
              {t(meta.readOnly ? "cc.c.fp.kind.read" : "cc.c.fp.kind.generate")}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
