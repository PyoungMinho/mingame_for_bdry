// src/app/cloudcheck/_client/components/TargetTable.tsx — 점검의 대상 표. 디자인 최종안 §5-2·§7-2.
//  - 열 7개: 상태(StatusBadge sm) · 대상(MaskedValue + 종류) · 위치 · 사실 · 사유 · 표시(라벨·예외) · 동작([예외로 표시]).
//  - 위반 대상이 먼저(엔진 정렬 그대로), 50행 단위 [더 보기]. 넘친 행은 cc-fold cc-po(인쇄에서는 펼침). 이상 없음 행은 cc-tt__row--clear(인쇄 생략) + 생략 줄(cc-print-only 행).
//  - 예외 행은 cc-exc(만료 cc-exc--expired). 예외는 라벨만 붙고 상태·대상은 숨기거나 접지 않는다(INV-8). 예외를 표시할 수 있는 건 위험·주의 대상뿐(canMark — 호출하는 쪽이 정한다).
//  - 600px 미만에서는 카드(cc-ct) — table·row·cell·columnheader role을 마크업에서 명시한다(Safari 낭독, UX §6-12).
//  - DOM id·속성에는 item.id(엔진이 만든 식별자)·사용자 데이터를 넣지 않는다 — 행 번호로만 id를 만든다(G-D8).
import { Fragment, useEffect, useId, useRef, type ReactElement } from "react";
import type { ExceptionOverlay, IsoDate, ItemResult, Label, RuleResult } from "../../../../lib/cloudcheck/model/report";
import { t } from "../i18n/index";
import { ExceptionLabel, LabelChip } from "./Chip";
import { cx } from "./cx";
import { ExceptionForm } from "./ExceptionForm";
import { MaskedValue } from "./MaskedValue";
import { StatusBadge } from "./StatusBadge";
import { Msg } from "./T";
import "./Chip.css";
import "./TargetTable.css";
import "./table-card.css";

/** 대상 표 한 번에 보이는 행 수 */
export const TABLE_PAGE_SIZE = 50;

export interface TargetTableProps {
  readonly rule: RuleResult;
  readonly overlay: ExceptionOverlay | null;
  /** 보이는 행 수(TABLE_PAGE_SIZE의 배수). 나머지 행은 접힌 채 DOM에 있다 */
  readonly shown: number;
  readonly onMore: () => void;
  readonly canMark: (item: ItemResult) => boolean;
  /** 예외 폼이 열린 대상의 item.id */
  readonly editingId: string | null;
  readonly onOpenForm: (id: string) => void;
  readonly onSave: (item: ItemResult, v: { reason: string; until: IsoDate }) => void;
  readonly onRemove: (item: ItemResult) => void;
  readonly today: IsoDate;
  /** 폼 취소(Esc 포함). 없으면 onOpenForm("")으로 닫는다 */
  readonly onCloseForm?: () => void;
}

type ExceptionLabelData = Extract<Label, { kind: "exception" }>;

const COLUMNS = ["status", "target", "location", "facts", "reason", "labels", "action"] as const;
type Column = (typeof COLUMNS)[number];
const COL_COUNT = COLUMNS.length;

function colLabel(c: Column): string {
  return t(`cc.c.table.col.${c}`);
}

function Location({ item }: { readonly item: ItemResult }): ReactElement | null {
  const loc = item.resource.location;
  if (loc === null) return null;
  return loc.kind === "global" ? <>{t("cc.c.loc.global")}</> : <MaskedValue value={loc.value} />;
}

function Resolution({ item }: { readonly item: ItemResult }): ReactElement | null {
  if (item.status !== "unknown") return null;
  const r = item.resolution;
  return <span className="cc-small cc-muted">{t(`cc.c.rule.resolution.${r.kind}`, { permissions: r.permissions.join(", ") })}</span>;
}

export function TargetTable({ rule, overlay, shown, onMore, canMark, editingId, onOpenForm, onSave, onRemove, today, onCloseForm }: TargetTableProps): ReactElement {
  const tid = useId();
  const items = rule.items;
  const close = onCloseForm ?? ((): void => onOpenForm(""));
  const clearCount = items.filter((i) => i.status === "clear").length;
  const remaining = Math.max(0, items.length - shown);

  // 폼이 닫히면(취소·저장) 그 행의 버튼으로 포커스를 돌려준다
  const prevEditing = useRef<number | null>(null);
  const editingIndex = editingId === null ? null : items.findIndex((i) => i.id === editingId);
  useEffect(() => {
    const prev = prevEditing.current;
    if (prev !== null && editingIndex === null) {
      const el = document.getElementById(`${tid}-x${prev}`) ?? document.getElementById(`${tid}-d${prev}`);
      if (el !== null) el.focus();
    }
    prevEditing.current = editingIndex !== null && editingIndex >= 0 ? editingIndex : null;
  }, [editingIndex, tid]);

  return (
    <div>
      <table className="cc-tt cc-ct" role="table">
        <caption className="cc-vh">{t("cc.c.rule.targets")}</caption>
        <thead role="rowgroup">
          <tr role="row">
            {COLUMNS.map((c) => (
              <th key={c} scope="col" role="columnheader">
                {colLabel(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody role="rowgroup">
          {items.map((item, index) => {
            const exc: ExceptionLabelData | undefined = overlay?.byItemId.get(item.id);
            const overflow = index >= shown;
            const nameId = `${tid}-n${index}`;
            const openId = `${tid}-x${index}`;
            const delId = `${tid}-d${index}`;
            const labels = item.labels.filter((l): l is Exclude<Label, { kind: "exception" }> => l.kind !== "exception");
            return (
              <Fragment key={item.id}>
                <tr
                  role="row"
                  className={cx(
                    item.status === "clear" && "cc-tt__row--clear",
                    exc !== undefined && "cc-exc",
                    exc?.state === "expired" && "cc-exc--expired",
                    overflow && "cc-fold",
                    overflow && "cc-po",
                  )}
                >
                  <td role="cell" data-label={colLabel("status")}>
                    <StatusBadge status={item.status} size="sm" />
                  </td>
                  <td role="cell" data-label={colLabel("target")}>
                    <span className="cc-tt__name">
                      <MaskedValue value={item.resource.name} id={nameId} />
                    </span>
                    <span className="cc-tt__type">{t(`cc.c.rtype.${item.resource.type}`)}</span>
                  </td>
                  <td role="cell" data-label={colLabel("location")}>
                    <Location item={item} />
                  </td>
                  <td role="cell" data-label={colLabel("facts")}>
                    {item.facts.length === 0 ? null : (
                      <ul className="cc-tt__facts" role="list">
                        {item.facts.map((f, i) => (
                          <li key={i}>
                            <Msg m={f} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td role="cell" data-label={colLabel("reason")}>
                    <Msg m={item.why} /> <Resolution item={item} />
                  </td>
                  <td role="cell" data-label={colLabel("labels")}>
                    {labels.length === 0 && exc === undefined ? null : (
                      <div className="cc-chips">
                        {labels.map((l, i) => (
                          <LabelChip key={i} label={l} />
                        ))}
                        {exc === undefined ? null : <ExceptionLabel label={exc} />}
                      </div>
                    )}
                  </td>
                  <td role="cell" data-label={colLabel("action")}>
                    {exc !== undefined ? (
                      <button type="button" id={delId} className="cc-btn cc-btn--ghost cc-btn--sm cc-noprint" aria-labelledby={`${delId} ${nameId}`} onClick={() => onRemove(item)}>
                        {t("cc.c.exc.remove")}
                      </button>
                    ) : canMark(item) ? (
                      <button type="button" id={openId} className="cc-btn cc-btn--ghost cc-btn--sm cc-noprint" aria-labelledby={`${openId} ${nameId}`} onClick={() => onOpenForm(item.id)}>
                        {t("cc.c.exc.open")}
                      </button>
                    ) : null}
                  </td>
                </tr>
                {editingId === item.id ? (
                  <tr role="row" className="cc-tt__form">
                    <td role="cell" colSpan={COL_COUNT}>
                      <ExceptionForm target={item.resource.name} today={today} onSave={(v) => onSave(item, v)} onCancel={close} />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
          {clearCount === 0 ? null : (
            <tr role="row" className="cc-print-only">
              <td role="cell" colSpan={COL_COUNT}>
                {t("cc.c.table.print-clear-omitted", { n: clearCount })}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {remaining === 0 ? null : (
        <p>
          <button type="button" className="cc-btn cc-btn--sm cc-noprint" onClick={onMore}>
            {t("cc.c.table.more", { n: remaining })}
          </button>
        </p>
      )}
    </div>
  );
}
