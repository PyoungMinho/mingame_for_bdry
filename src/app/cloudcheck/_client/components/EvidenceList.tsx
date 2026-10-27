// src/app/cloudcheck/_client/components/EvidenceList.tsx — '이 점검이 쓴 호출 기록'(접힘, 인쇄 숨김). 대상들의 evidence[]를 receipt.id로 중복 제거해 나열한다. 디자인 최종안 §5-2.
//  - 호출 기록: id · 호출 · 범위(MaskedValue) · 결과 이름 · 기준 시각(UTC) (+ 받은 개수·오류 코드). CSV 출처는 종류 · '열' · 몇 번째 줄. observed(원시 값)는 그리지 않는다(§7-4).
import type { ReactElement } from "react";
import type { EvidenceRef, ItemResult, ReceiptRef } from "../../../../lib/cloudcheck/model/report";
import { fmtTime, t } from "../i18n/index";
import { FoldButton, FoldRegion, useFold } from "./Fold";
import { T } from "./T";
import "./EvidenceList.css";

export interface EvidenceListProps {
  readonly items: readonly ItemResult[];
}

type CsvEvidence = NonNullable<EvidenceRef["csv"]>;

function collect(items: readonly ItemResult[]): { readonly receipts: readonly ReceiptRef[]; readonly csv: readonly CsvEvidence[] } {
  const receipts = new Map<string, ReceiptRef>();
  const csv = new Map<string, CsvEvidence>();
  for (const item of items) {
    for (const ev of item.evidence) {
      if (ev.receipt !== null) {
        if (!receipts.has(ev.receipt.id)) receipts.set(ev.receipt.id, ev.receipt);
      } else if (ev.csv !== null) {
        csv.set(`${ev.csv.kind}|${ev.csv.column}|${ev.csv.row}`, ev.csv);
      }
    }
  }
  return { receipts: [...receipts.values()], csv: [...csv.values()] };
}

export function EvidenceList({ items }: EvidenceListProps): ReactElement | null {
  const first = items[0];
  const fold = useFold(`evidence-${first === undefined ? "none" : first.ruleId}`, false);
  const { receipts, csv } = collect(items);
  const n = receipts.length + csv.length;
  if (n === 0) return null;
  return (
    <div>
      <FoldButton fold={fold} noPrint>
        {t("cc.c.rule.evidence", { n })}
      </FoldButton>
      <FoldRegion fold={fold} print="hide">
        <ul className="cc-ev" role="list">
          {receipts.map((r) => (
            <li key={r.id}>
              <T
                k="cc.c.rule.evidence.line"
                p={{
                  id: <code className="cc-mono">{r.id}</code>,
                  call: <code className="cc-mono">{r.call}</code>,
                  scope: { v: r.scope },
                  result: (
                    <>
                      {t(`cc.c.scope.receipt.${r.result}`)}
                      {r.count === null ? "" : ` · ${t("cc.c.rule.evidence.count", { n: r.count })}`}
                      {r.errorCode === null ? "" : ` · ${r.errorCode}`}
                    </>
                  ),
                  at: fmtTime(r.at, "utc"),
                }}
              />
            </li>
          ))}
          {csv.map((c) => (
            <li key={`${c.kind}|${c.column}|${c.row}`}>
              <T k="cc.c.rule.evidence.csv" p={{ kind: t(`cc.c.rlist.kind.${c.kind}`), column: c.column, row: c.row }} />
            </li>
          ))}
        </ul>
      </FoldRegion>
    </div>
  );
}
