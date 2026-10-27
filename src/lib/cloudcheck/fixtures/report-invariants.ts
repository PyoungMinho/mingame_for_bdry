// src/lib/cloudcheck/fixtures/report-invariants.ts — Report 불변식 검사기 (테스트 도구, 위반 메시지 배열을 돌려준다)
// 검사하는 것: 5상태와 근거의 일치(이상 없음 = 증명 + 증거 + 기준 시각, 해당 없음 = 증명된 0, 확인 불가 = 사유 + 해소법), 분포 합계, 문별 최악 상태, 정렬, 먼저 볼 3개, 가림.
// 판정 로직과 따로 짠 독립 검사다(엔진 코드를 import하지 않는다). 현재 시각을 읽지 않는다.
import { DOORS, STATUS_ORDER } from "../model/report";
import type { DoorResult, ItemResult, Report, RuleResult, Status } from "../model/report";

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === "object" && x !== null && !Array.isArray(x);

export function countStatuses(statuses: readonly Status[]): Record<Status, number> & { total: number } {
  const d = { total: statuses.length, risk: 0, caution: 0, unknown: 0, clear: 0, na: 0 };
  for (const s of statuses) d[s]++;
  return d;
}

function checkItem(rule: RuleResult, item: ItemResult, out: string[]): void {
  const at = `${rule.ruleId} ${item.id}`;
  if (item.ruleId !== rule.ruleId) out.push(`${at}: ruleId 불일치`);
  if (item.status === "clear" || item.status === "risk" || item.status === "caution") {
    if (!("evidence" in item) || item.evidence.length === 0) out.push(`${at}: ${item.status}인데 증거 없음`);
  }
  if (item.status === "unknown" && item.resolution === undefined) out.push(`${at}: 확인 불가인데 해소법 없음`);
}

function checkRule(rule: RuleResult, out: string[]): void {
  const at = rule.ruleId;
  const dist = countStatuses(rule.items.map((i) => i.status));
  const d = rule.distribution;
  if (d.total !== rule.items.length || d.risk !== dist.risk || d.caution !== dist.caution || d.unknown !== dist.unknown || d.clear !== dist.clear || d.na !== dist.na) {
    out.push(`${at}: 분포가 대상 목록과 다름`);
  }
  for (const item of rule.items) checkItem(rule, item, out);
  const ranks = rule.items.map((i) => STATUS_ORDER.indexOf(i.status));
  for (let i = 1; i < ranks.length; i++) if (ranks[i] < ranks[i - 1]) { out.push(`${at}: 대상이 상태 순으로 정렬되지 않음`); break; }
  const ids = new Set(rule.items.map((i) => i.id));
  if (ids.size !== rule.items.length) out.push(`${at}: 대상 id 중복`);

  switch (rule.status) {
    case "risk":
      if (dist.risk === 0) out.push(`${at}: 위험인데 위험 대상 없음`);
      break;
    case "caution":
      if (dist.caution === 0) out.push(`${at}: 주의인데 주의 대상 없음`);
      if (dist.risk > 0) out.push(`${at}: 주의인데 위험 대상 있음`);
      break;
    case "clear":
      if (!rule.coverage.proven) out.push(`${at}: 이상 없음인데 범위 증명 없음`);
      if (rule.asOf === null) out.push(`${at}: 이상 없음인데 기준 시각 없음`);
      if (rule.items.length === 0) out.push(`${at}: 이상 없음인데 대상 없음`);
      if (dist.risk + dist.caution + dist.unknown > 0) out.push(`${at}: 이상 없음인데 다른 상태 대상 있음`);
      if (rule.coverage.proven && rule.coverage.population !== null && rule.coverage.population < rule.items.length) out.push(`${at}: 모수보다 대상이 많음`);
      break;
    case "na":
      if (!rule.coverage.proven || rule.coverage.population !== 0) out.push(`${at}: 해당 없음인데 증명된 0이 아님`);
      if (rule.asOf === null) out.push(`${at}: 해당 없음인데 기준 시각 없음`);
      if (rule.items.length !== 0) out.push(`${at}: 해당 없음인데 대상 있음`);
      if (rule.why.code !== "no-targets-proven") out.push(`${at}: 해당 없음의 why 코드 ${rule.why.code}`);
      break;
    case "unknown":
      if (rule.gaps.length === 0) out.push(`${at}: 확인 불가인데 사유 없음`);
      if (dist.risk + dist.caution > 0) out.push(`${at}: 확인 불가인데 위험·주의 대상 있음(양성은 유지해야 한다)`);
      if (rule.coverage.proven && rule.coverage.population === 0) out.push(`${at}: 확인 불가인데 증명된 0`);
      break;
  }
}

export function checkReport(report: Report): string[] {
  const out: string[] = [];
  if (report.doors.length !== DOORS.length || report.doors.some((d, i) => d.door !== DOORS[i])) out.push("문 목록이 DOORS 순서가 아님");
  const rules: RuleResult[] = [];
  for (const door of report.doors) {
    const dr: DoorResult = door;
    for (let i = 1; i < dr.rules.length; i++) {
      const a = dr.rules[i - 1];
      const b = dr.rules[i];
      const ra = STATUS_ORDER.indexOf(a.status);
      const rb = STATUS_ORDER.indexOf(b.status);
      if (rb < ra || (rb === ra && b.priority <= a.priority)) out.push(`${dr.door}: 룰이 상태 → priority 순이 아님(${a.ruleId} → ${b.ruleId})`);
    }
    for (const r of dr.rules) {
      if (r.door !== dr.door) out.push(`${r.ruleId}: 다른 문(${r.door})의 목록에 있음`);
      checkRule(r, out);
      rules.push(r);
    }
    const worst = dr.rules.length === 0 ? "unknown" : STATUS_ORDER[Math.min(...dr.rules.map((r) => STATUS_ORDER.indexOf(r.status)))];
    if (dr.rules.length > 0 && dr.worstStatus !== worst) out.push(`${dr.door}: worstStatus ${dr.worstStatus} ≠ ${worst}`);
    const dd = countStatuses(dr.rules.map((r) => r.status));
    if (dr.distribution.total !== dd.total || dr.distribution.risk !== dd.risk || dr.distribution.caution !== dd.caution || dr.distribution.unknown !== dd.unknown || dr.distribution.clear !== dd.clear || dr.distribution.na !== dd.na) {
      out.push(`${dr.door}: 문 분포가 룰 상태와 다름`);
    }
  }
  const rd = countStatuses(rules.map((r) => r.status));
  const rep = report.distribution.rules;
  if (rep.total !== rd.total || rep.risk !== rd.risk || rep.caution !== rd.caution || rep.unknown !== rd.unknown || rep.clear !== rd.clear || rep.na !== rd.na) out.push("리포트 룰 분포가 룰 상태와 다름");
  const itemSum = countStatuses(rules.flatMap((r) => r.items.map((i) => i.status)));
  const it = report.distribution.items;
  if (it.total !== itemSum.total || it.risk !== itemSum.risk || it.caution !== itemSum.caution || it.unknown !== itemSum.unknown || it.clear !== itemSum.clear || it.na !== itemSum.na) out.push("리포트 대상 분포가 대상 상태와 다름");
  if (new Set(rules.map((r) => r.ruleId)).size !== rules.length) out.push("룰 중복");

  const hasFinding = rules.some((r) => r.status === "risk" || r.status === "caution");
  if (hasFinding && report.firstLook.mode !== "findings") out.push("위험·주의가 있는데 먼저 볼 것이 findings가 아님");
  if (!hasFinding && report.firstLook.mode === "findings") out.push("위험·주의가 없는데 먼저 볼 것이 findings");
  if (report.firstLook.mode === "findings" && (report.firstLook.ruleIds.length === 0 || report.firstLook.ruleIds.length > 3)) out.push("먼저 볼 것은 1~3개");

  // 원문 비밀 모양 가림: AKIA 모양 키는 어떤 문자열에도 나오면 안 된다(표본 키 AKIAIOSFODNN7EXAMPLE도 리포트에는 싣지 않는다)
  const scan = (node: unknown, path: string): void => {
    if (typeof node === "string") {
      if (/AKIA[0-9A-Z]{16}/.test(node)) out.push(`${path}: 액세스 키 모양 문자열`);
      if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(node)) out.push(`${path}: 개인 키 머리`);
      return;
    }
    if (Array.isArray(node)) { node.forEach((x, i) => scan(x, `${path}[${i}]`)); return; }
    if (node instanceof Map) { for (const [k, v] of node) scan(v, `${path}{${String(k)}}`); return; }
    if (!isObj(node)) return;
    for (const [k, v] of Object.entries(node)) scan(v, `${path}.${k}`);
  };
  scan(report, "report");
  return out;
}
