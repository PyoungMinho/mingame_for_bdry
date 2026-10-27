// src/app/cloudcheck/_client/components/ManualCheckList.tsx — 직접 볼 목록(V3 D8). 확인 불가는 '할 일'이다 — 그 할 일을 손으로 처리하게 만드는 곳. 디자인 최종안 §5-2·UX §10-1.
//  - 화면은 번호 목록 표(체크 칸을 그리지 않는다 — 화면 체크는 '확인 완료'로 읽히고 메모리에만 남는다, Q10). 인쇄에만 5mm 빈 칸(.cc-mc__box)과 메모 열(.cc-mc__memo), 행 10mm 이상.
//  - 열: 번호 · 문 · 무엇을 · 왜 판단하지 못했나 · 어떻게 보나 · 메모(인쇄만). 정렬 = 문 순서 → priority → origin.
//  - '무엇을' 칸 = [점검 제목(있으면)] + [대상 이름(있으면)] + what(D14). why가 null이면 origin별 대체 문장. guide-card 행은 라디오 없이 단계 요약 + 본인 응답 라벨만(입력은 GuideCard 한 곳).
//  - 같은 점검·같은 사유의 확인 불가 대상이 MANUAL_GROUP_MIN(6)개 이상이면 '대상 n개' 한 행 + 접힘(인쇄 펼침)으로 묶는다.
//  - [이 목록만 인쇄]는 인쇄 흐름이 페이지(state/print.ts) 소유라 onPrintList가 있을 때만 그린다. DOM id에는 항목 id·사용자 데이터를 넣지 않는다.
import { Fragment, type ReactElement } from "react";
import { DOORS, type DoorId, type ManualCheckItem, type RuleCatalogEntry, type RuleId } from "../../../../lib/cloudcheck/model/report";
import { t } from "../i18n/index";
import { Chip } from "./Chip";
import { DocLink } from "./DocLink";
import { DOM_ID } from "./dom-ids";
import { FoldButton, FoldRegion, useFold } from "./Fold";
import { selfAnswerKey, type SelfAnswer } from "./GuideCard";
import { MaskedValue } from "./MaskedValue";
import { ruleTitleKey } from "./rule-keys";
import { S_KEY } from "./s-keys";
import { Msg, T } from "./T";
import "./actions.css";
import "./table-card.css";
import "./ManualCheckList.css";

/** 같은 점검·같은 사유 묶음 기준(config.ts MANUAL_GROUP_MIN과 같은 값) */
export const MANUAL_GROUP_MIN = 6;

export interface ManualCheckListProps {
  readonly items: readonly ManualCheckItem[];
  readonly catalog: ReadonlyMap<RuleId, RuleCatalogEntry>;
  /** selfAnswerKey(ruleId, stepId) → 응답 */
  readonly selfAnswers: Readonly<Record<string, SelfAnswer>>;
  /** 페이지가 쓰는 시그니처(GuideCard 입력은 점검 행 안 한 곳이라 여기서는 호출하지 않는다) */
  readonly onSelfAnswer?: (ruleId: RuleId, stepId: string, v: SelfAnswer) => void;
  /** [이 목록만 인쇄] */
  readonly onPrintList?: () => void;
}

const ORIGIN_ORDER: Readonly<Record<ManualCheckItem["origin"], number>> = { "unknown-item": 0, "unknown-rule": 1, "guide-card": 2, "out-of-scope": 3, "auto-notice": 4 };

function doorIndex(d: DoorId | null): number {
  return d === null ? DOORS.length : DOORS.indexOf(d);
}

/** 정렬: 문 순서 → priority → origin (안정 정렬 — 같은 키는 엔진 순서 유지) */
export function sortManual(items: readonly ManualCheckItem[], catalog: ReadonlyMap<RuleId, RuleCatalogEntry>): readonly ManualCheckItem[] {
  const pri = (m: ManualCheckItem): number => (m.ruleId === null ? Number.MAX_SAFE_INTEGER : (catalog.get(m.ruleId)?.priority ?? Number.MAX_SAFE_INTEGER));
  return [...items].sort((a, b) => doorIndex(a.door) - doorIndex(b.door) || pri(a) - pri(b) || ORIGIN_ORDER[a.origin] - ORIGIN_ORDER[b.origin]);
}

interface Row {
  readonly kind: "single" | "group";
  readonly items: readonly ManualCheckItem[];
}

/** unknown-item을 같은 점검·같은 사유끼리 묶는다(6개 이상일 때만 한 행) */
function toRows(sorted: readonly ManualCheckItem[]): readonly Row[] {
  const groups = new Map<string, ManualCheckItem[]>();
  for (const m of sorted) {
    if (m.origin !== "unknown-item" || m.ruleId === null || m.why === null) continue;
    const k = `${m.ruleId}|${m.why.code}`;
    groups.set(k, [...(groups.get(k) ?? []), m]);
  }
  const rows: Row[] = [];
  const done = new Set<string>();
  for (const m of sorted) {
    if (m.origin === "unknown-item" && m.ruleId !== null && m.why !== null) {
      const k = `${m.ruleId}|${m.why.code}`;
      const g = groups.get(k) ?? [];
      if (g.length >= MANUAL_GROUP_MIN) {
        if (!done.has(k)) {
          done.add(k);
          rows.push({ kind: "group", items: g });
        }
        continue;
      }
    }
    rows.push({ kind: "single", items: [m] });
  }
  return rows;
}

function Perms({ m }: { readonly m: ManualCheckItem }): ReactElement | null {
  const r = m.resolution;
  if (r === null || r.kind !== "permission" || r.permissions.length === 0) return null;
  return (
    <span className="cc-small">
      <T
        k="cc.c.manual.how-perm"
        p={{
          permission: (
            <>
              {r.permissions.map((p, i) => (
                <Fragment key={p}>
                  {i > 0 ? " " : ""}
                  <span className="cc-mc__perm">{p}</span>
                </Fragment>
              ))}
            </>
          ),
        }}
      />
    </span>
  );
}

function titleOf(m: ManualCheckItem, catalog: ReadonlyMap<RuleId, RuleCatalogEntry>): string | null {
  if (m.ruleId === null) return null;
  return t(catalog.get(m.ruleId)?.titleKey ?? ruleTitleKey(m.ruleId));
}

/** 본인 응답이 있는 guide-card 행의 단계 요약 */
function GuideSteps({ m, catalog, selfAnswers }: { readonly m: ManualCheckItem; readonly catalog: ReadonlyMap<RuleId, RuleCatalogEntry>; readonly selfAnswers: Readonly<Record<string, SelfAnswer>> }): ReactElement | null {
  const ruleId = m.ruleId;
  const guide = ruleId === null ? null : (catalog.get(ruleId)?.guide ?? null);
  if (ruleId === null || guide === null) return null;
  return (
    <ol className="cc-stack cc-gap-2 cc-small" role="list">
      {guide.steps.map((s) => {
        const a = selfAnswers[selfAnswerKey(ruleId, s.id)];
        return (
          <li key={s.id}>
            {t(s.textKey)}
            {s.doc === null ? null : (
              <>
                {" "}
                <DocLink link={s.doc} labelKey={S_KEY.fixDoc} />
              </>
            )}
            {a === undefined ? null : (
              <>
                {" "}
                <Chip>{t("cc.label.self-answer", { answer: t(`cc.c.self.${a}`) })}</Chip>
              </>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function WhatCell({ m, catalog }: { readonly m: ManualCheckItem; readonly catalog: ReadonlyMap<RuleId, RuleCatalogEntry> }): ReactElement {
  const title = titleOf(m, catalog);
  return (
    <>
      {m.origin === "out-of-scope" || m.origin === "guide-card" || m.origin === "auto-notice" ? <Chip>{t(`cc.c.manual.origin.${m.origin}`)}</Chip> : null}
      {title === null ? null : <span className="cc-tt__name">{title}</span>}
      {m.resource === null ? null : (
        <span className="cc-tt__name">
          <MaskedValue value={m.resource.name} />
        </span>
      )}
      <Msg m={m.what} />
    </>
  );
}

function WhyCell({ m }: { readonly m: ManualCheckItem }): ReactElement {
  if (m.why !== null) return <Msg m={m.why} />;
  if (m.origin === "guide-card") return <>{t("cc.c.guide.badge-note")}</>;
  if (m.origin === "auto-notice") return <>{t("cc.c.manual.why.auto-notice")}</>;
  if (m.origin === "out-of-scope") return <>{t("cc.c.manual.why.out-of-scope")}</>;
  return <></>;
}

function HowCell({ m, catalog, selfAnswers }: { readonly m: ManualCheckItem; readonly catalog: ReadonlyMap<RuleId, RuleCatalogEntry>; readonly selfAnswers: Readonly<Record<string, SelfAnswer>> }): ReactElement {
  return (
    <div className="cc-stack cc-gap-2">
      {m.origin === "guide-card" ? <GuideSteps m={m} catalog={catalog} selfAnswers={selfAnswers} /> : m.howKey === null ? null : <p>{t(m.howKey)}</p>}
      <Perms m={m} />
    </div>
  );
}

export function ManualCheckList({ items, catalog, selfAnswers, onPrintList }: ManualCheckListProps): ReactElement {
  const rows = toRows(sortManual(items, catalog));
  return (
    <section className="cc-manual" aria-labelledby={DOM_ID.manual} id="cc-manual">
      <div className="cc-hrow">
        <h2 id={DOM_ID.manual} tabIndex={-1}>
          {t("cc.c.manual.heading")}
        </h2>
        {onPrintList === undefined || rows.length === 0 ? null : (
          <button type="button" className="cc-btn cc-btn--sm cc-noprint" onClick={onPrintList}>
            {t("cc.c.manual.print-list")}
          </button>
        )}
      </div>
      <p>{rows.length === 0 ? t("cc.c.manual.empty") : t("cc.c.manual.lead")}</p>
      {rows.length === 0 ? null : (
        <table className="cc-mc cc-ct" role="table">
          <thead role="rowgroup">
            <tr role="row">
              <th scope="col" role="columnheader">
                {t("cc.c.manual.col.no")}
              </th>
              <th scope="col" role="columnheader">
                {t("cc.c.manual.col.door")}
              </th>
              <th scope="col" role="columnheader">
                {t("cc.c.manual.col.what")}
              </th>
              <th scope="col" role="columnheader">
                {t("cc.c.manual.col.why")}
              </th>
              <th scope="col" role="columnheader">
                {t("cc.c.manual.col.how")}
              </th>
              <th scope="col" role="columnheader" className="cc-mc__memo">
                {t("cc.c.manual.col.memo")}
              </th>
            </tr>
          </thead>
          <tbody role="rowgroup">
            {rows.map((row, i) => (
              <ManualRow key={i} index={i} row={row} catalog={catalog} selfAnswers={selfAnswers} />
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function ManualRow({ index, row, catalog, selfAnswers }: { readonly index: number; readonly row: Row; readonly catalog: ReadonlyMap<RuleId, RuleCatalogEntry>; readonly selfAnswers: Readonly<Record<string, SelfAnswer>> }): ReactElement {
  const first = row.items[0] as ManualCheckItem;
  const group = row.kind === "group";
  const fold = useFold(`manual-group-${index}`, false);
  const door = first.door;
  return (
    <tr role="row">
      <td role="cell" className="cc-mc__no" data-label={t("cc.c.manual.col.no")}>
        <span className="cc-mc__box" aria-hidden="true" />
        {index + 1}
      </td>
      <td role="cell" data-label={t("cc.c.manual.col.door")}>
        {door === null ? null : (
          <>
            {t(`cc.door.${door}.name`)} <span className="cc-muted">{t(`cc.door.${door}.term`)}</span>
          </>
        )}
      </td>
      <td role="cell" data-label={t("cc.c.manual.col.what")}>
        {group ? (
          <>
            {titleOf(first, catalog) === null ? null : <span className="cc-tt__name">{titleOf(first, catalog)}</span>}
            <FoldButton fold={fold} noPrint>
              {t("cc.c.manual.group", { n: row.items.length })}
            </FoldButton>
            <FoldRegion fold={fold} print="expand">
              <ul role="list">
                {row.items.map((m, i) => (
                  <li key={i}>
                    {m.resource === null ? null : <MaskedValue value={m.resource.name} />} <Msg m={m.what} />
                  </li>
                ))}
              </ul>
            </FoldRegion>
          </>
        ) : (
          <WhatCell m={first} catalog={catalog} />
        )}
      </td>
      <td role="cell" data-label={t("cc.c.manual.col.why")}>
        <WhyCell m={first} />
      </td>
      <td role="cell" data-label={t("cc.c.manual.col.how")}>
        <HowCell m={first} catalog={catalog} selfAnswers={selfAnswers} />
      </td>
      <td role="cell" className="cc-mc__memo" />
    </tr>
  );
}
