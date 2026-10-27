// src/lib/cloudcheck/engine/exceptions.ts — 예외 표시 오버레이 (상태 불변: INV-8, R-10)
// 예외 파일은 judge의 입력이 아니다. 리포트의 대상(ruleId + MatchKey)에 라벨만 덧씌우고, 상태·분포·정렬은 건드리지 않는다.
//  - 만료 기준은 사용자 기기의 오늘 날짜(today)이고 until까지 유효하다. 지나면 '만료되어 해제됨' 라벨이 된다.
//  - 현재 리포트에 대상이 없으면 'unmatched'(대상 없음).
import type { ExceptionsFile } from "../contract/exceptions-schema";
import type { ExceptionOverlay, IsoDate, Label, Report } from "../model/report";
import { createDisplay } from "./display";

type ExceptionLabel = Extract<Label, { kind: "exception" }>;
const EMPTY: ExceptionOverlay = { byItemId: new Map<string, ExceptionLabel>(), entries: [], counts: { active: 0, expired: 0, unmatched: 0 } };

export function overlayExceptions(report: Report, file: ExceptionsFile | null, today: IsoDate): ExceptionOverlay {
  if (file === null) return EMPTY;
  try {
    // (ruleId, MatchKey) → 대상 id들
    const index = new Map<string, string[]>();
    for (const door of report.doors) for (const rule of door.rules) for (const item of rule.items) {
      const k = `${item.ruleId}\n${item.resource.key}`;
      const list = index.get(k) ?? [];
      list.push(item.id);
      index.set(k, list);
    }
    const display = createDisplay();
    const best = new Map<string, { label: ExceptionLabel; index: number }>();
    const entries: ExceptionOverlay["entries"][number][] = [];
    const counts = { active: 0, expired: 0, unmatched: 0 };
    file.entries.forEach((e, i) => {
      const ids = index.get(`${e.ruleId}\n${e.resource}`);
      if (ids === undefined) { entries.push({ index: i, state: "unmatched" }); counts.unmatched++; return; }
      const state: "active" | "expired" = e.until >= today ? "active" : "expired";
      entries.push({ index: i, state });
      counts[state]++;
      const label: ExceptionLabel = {
        kind: "exception", state, reason: display.sens({ type: "freeText", value: e.reason }),
        until: e.until as IsoDate, createdAt: e.createdAt as IsoDate,
      };
      for (const id of ids) {
        const cur = best.get(id);
        // 같은 대상에 예외가 여럿이면 유효한 것 > 만료된 것, 같으면 만료일이 늦은 것, 같으면 앞선 항목
        const better = cur === undefined
          || (state === "active" && cur.label.state === "expired")
          || (state === cur.label.state && label.until > cur.label.until);
        if (better) best.set(id, { label, index: i });
      }
    });
    const byItemId = new Map<string, ExceptionLabel>();
    for (const [id, v] of best) byItemId.set(id, v.label);
    return { byItemId, entries, counts };
  } catch {
    return EMPTY;
  }
}
