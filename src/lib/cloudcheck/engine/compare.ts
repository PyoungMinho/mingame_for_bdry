// src/lib/cloudcheck/engine/compare.ts — Before/After 재점검 비교 (judge 밖의 순수 함수)
//  - 수집 시각 순으로 자동 정렬한다(reordered). 다른 계정·다른 클라우드는 비교를 거부한다(점검자 휴먼에러 방지).
//  - better·worse는 위험 > 주의 > (이상 없음 = 해당 없음) 순위. 확인 불가로 바뀌면 became-unknown, 확인 불가에서 벗어나면 became-known.
import type { Comparison, CompareSide, Report, RuleChange, Status } from "../model/report";
import { RULES } from "../rules/registry";

const side = (r: Report): CompareSide => ({ cloud: r.identity.cloud, accountLast4: r.identity.accountLast4, alias: r.identity.alias, asOf: r.collection.asOf });

const sameAccount = (a: Report, b: Report): boolean =>
  a.identity.account.kind === "sensitive" && b.identity.account.kind === "sensitive" && a.identity.account.full === b.identity.account.full;

const rank = (s: Status): number => (s === "risk" ? 2 : s === "caution" ? 1 : 0);

export function changeOf(before: Status, after: Status): RuleChange {
  if (before === "unknown" && after === "unknown") return "same";
  if (after === "unknown") return "became-unknown";
  if (before === "unknown") return "became-known";
  const d = rank(after) - rank(before);
  return d < 0 ? "better" : d > 0 ? "worse" : "same";
}

/** 같은 스냅샷인가: 수집 시각이 같고 읽은 입력의 종류·크기·시각이 모두 같음(같은 파일을 두 번 올림) */
function sameSnapshot(a: Report, b: Report): boolean {
  const x = a.collection;
  const y = b.collection;
  if (x.asOf === null || y.asOf === null || x.asOf.at !== y.asOf.at) return false;
  if (x.inputs.length !== y.inputs.length) return false;
  return x.inputs.every((f, i) => {
    const g = y.inputs[i];
    return f.kind === g.kind && f.bytes === g.bytes && (f.asOf === null ? g.asOf === null : g.asOf !== null && f.asOf.at === g.asOf.at);
  });
}

export function compare(a: Report, b: Report): Comparison {
  try {
    if (a.identity.cloud !== b.identity.cloud) return { ok: false, reason: "different-cloud", before: side(a), after: side(b) };
    if (!sameAccount(a, b)) return { ok: false, reason: "different-account", before: side(a), after: side(b) };
    if (sameSnapshot(a, b)) return { ok: false, reason: "same-snapshot", before: side(a), after: side(b) };

    // 수집 시각이 앞선 쪽이 Before. 시각을 모르면 받은 순서 그대로 둔다
    const ta = a.collection.asOf?.at ?? null;
    const tb = b.collection.asOf?.at ?? null;
    const reordered = ta !== null && tb !== null && ta > tb;
    const [before, after] = reordered ? [b, a] : [a, b];

    const find = (r: Report, id: string) => r.doors.flatMap((d) => d.rules).find((x) => x.ruleId === id);
    const rules: Extract<Comparison, { ok: true }>["rules"][number][] = [];
    for (const m of [...RULES].sort((x, y) => x.spec.priority - y.spec.priority)) {
      const rb = find(before, m.spec.ruleId);
      const ra = find(after, m.spec.ruleId);
      if (rb === undefined || ra === undefined) continue;
      rules.push({ ruleId: m.spec.ruleId, before: rb.status, after: ra.status, change: changeOf(rb.status, ra.status), items: { before: rb.distribution, after: ra.distribution } });
    }
    const gb = before.collection.credentialReport?.generatedAt ?? null;
    const ga = after.collection.credentialReport?.generatedAt ?? null;
    return { ok: true, before: side(before), after: side(after), reordered, sameCredentialReport: gb !== null && ga !== null && gb === ga, rules };
  } catch {
    return { ok: false, reason: "different-account", before: side(a), after: side(b) };
  }
}
