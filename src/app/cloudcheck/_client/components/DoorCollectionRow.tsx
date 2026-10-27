// src/app/cloudcheck/_client/components/DoorCollectionRow.tsx — 문별 수집 줄: 판정이 아니라 수집 상태(수집됨·일부 수집·수집 안 함). 색 없음. V1(경로별 상수)·V2(인식 결과)·V3(DoorCollection) 공용.
//  - 글자가 의미를 갖고 테두리(실선·일부는 굵은 글자·점선)는 보조다. compact(경로 카드 안)는 아이콘·사유 없이 '현관 수집됨' 한 줄 5열.
import type { ReactElement } from "react";
import type { DoorCollection, DoorId } from "../../../../lib/cloudcheck/model/report";
import { t } from "../i18n/index";
import { cx } from "./cx";
import { DoorIcon } from "./DoorIcon";
import { Msg, T } from "./T";
import "./DoorCollectionRow.css";

export interface DoorCollectionRowItem {
  readonly door: DoorId;
  readonly status: DoorCollection["status"];
  readonly judgeLevel?: DoorCollection["judgeLevel"];
  readonly reason?: DoorCollection["reason"];
}

export interface DoorCollectionRowProps {
  readonly rows: readonly DoorCollectionRowItem[];
  readonly compact?: boolean;
}

function statusText(status: DoorCollection["status"]): string {
  return status === "collected" ? t("cc.c.doorrow.collected") : status === "partial" ? t("cc.c.doorrow.partial") : t("cc.c.doorrow.none");
}

/**
 * 수집 줄에 사유를 붙일지(D4 통합, 프론트팀장). 엔진은 수집 안 함 문(그리고 일부 영역을 수집하지 않은 문)에 사유 코드 'not-collected'를 준다 —
 * 짧은 이름이 '수집 안 함'이라 상태 글자를 되풀이할 뿐이다("수집 안 함 (수집 안 함)", "수집: 수집 안 함 · 수집 안 함", "일부만 수집됨 · 수집 안 함").
 * 그 경우와 사유가 없는 경우는 사유를 뺀다. 정보가 있는 사유(안전망 리포트의 parse-failed, 일부 수집의 denied·truncated·region-missing)는 그대로 보인다.
 * DoorSection 수집 줄과 조회 범위의 문별 수집 줄이 같은 함수를 쓴다. status는 시그니처에 남겨 둔다(사유 규칙이 상태별로 갈릴 때 한 곳에서 바꾼다).
 */
export function shownCollectionReason(status: DoorCollection["status"], reason: DoorCollection["reason"] | undefined): DoorCollection["reason"] {
  if (reason === undefined || reason === null || status === "collected") return null;
  return reason.code === "not-collected" ? null : reason;
}

export function DoorCollectionRow({ rows, compact = false }: DoorCollectionRowProps): ReactElement {
  return (
    <ul className={cx("cc-dcr", compact && "cc-dcr--compact")} role="list">
      {rows.map((r) => {
        const name = t(`cc.door.${r.door}.name`);
        const reason = shownCollectionReason(r.status, r.reason);
        return (
          <li key={r.door} className={cx("cc-dcr__i", r.status === "collected" && "cc-dcr__i--collected", r.status === "partial" && "cc-dcr__i--partial", r.status === "not-collected" && "cc-dcr__i--none")}>
            {compact ? (
              <T k="cc.c.doorrow.item" p={{ door: name, state: statusText(r.status) }} />
            ) : (
              <>
                <DoorIcon door={r.door} size={20} />
                <b>{name}</b>
                <span>{statusText(r.status)}</span>
                {reason !== null ? (
                  <span className="cc-muted">
                    (<Msg m={reason} short />)
                  </span>
                ) : null}
                {r.judgeLevel === "findings-only" ? <span className="cc-small">{t("cc.c.doorrow.findings-only")}</span> : null}
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}
