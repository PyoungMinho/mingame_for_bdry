// QA FO-06 — 생성 속성 + 차등 오라클 (설계서 §4-1)
// fast-check(시드 고정, 룰당 250회)로 무작위 세계를 만들고(비정상 값 약 10%) 실제 수집 JSON으로 바꿔 recognize → buildInput → judge를 돌린다.
// QA가 명세 문장만 보고 짠 참조 판정기(qa/oracle.ts: AWS-NET-1 · AWS-STO-2 · AWS-KEY-4 · AZ-NET-1 · AZ-STO-2)와 엔진의 '대상별 상태'를 비교한다.
// 불일치는 분류한다: 알려진 엔진 버그(CC-QA-…) → 그 ID의 it.fails, 분류되지 않은 불일치 → 일반 시험 실패(새 버그 · 명세 모호 · 참조기 버그 중 하나 — 조사 대상).
// 공통 속성: checkReport 위반 0, 이상 없음 대상의 증거 영수증은 모두 ok · empty · notconfigured.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { checkReport } from "../fixtures/report-invariants";
import type { Report, RuleId } from "../model/report";
import { nameText, ruleOf, runJson } from "./kit";
import type { Json } from "./kit";
import {
  awsNetJson, awsRolesJson, awsStoJson, azNetJson, azNetWorld, azStoJson, azStoWorld, netWorld, refAzNet1, refAzSto2, refKey4, refNet1, refSto2, rolesWorld, stoWorld,
} from "./oracle";
import type { Nsg, Role, Sg, St } from "./oracle";

const RUNS = 250;
interface Mismatch { readonly rule: RuleId; readonly target: string; readonly engine: string; readonly ref: St; readonly bug: string | null; readonly detail: string }
interface Tally { runs: number; compared: number; rejected: number; mismatches: Mismatch[]; common: string[] }

const ANSWER = new Set(["ok", "empty", "notconfigured"]);
/** 공통 속성: checkReport 위반 0 + 이상 없음 대상의 증거 영수증 결과가 모두 답 */
function common(r: Report): string[] {
  const out = checkReport(r);
  for (const x of r.doors.flatMap((d) => d.rules)) for (const i of x.items) if (i.status === "clear") for (const e of i.evidence) if (e.receipt !== null && !ANSWER.has(e.receipt.result)) out.push(`${x.ruleId} ${i.id}: 이상 없음인데 증거 영수증 ${e.receipt.result}`);
  return out;
}
function run<W>(arb: fc.Arbitrary<W>, seed: number, build: (w: W) => Json, compare: (w: W, r: Report, t: Tally) => void): Tally {
  const t: Tally = { runs: 0, compared: 0, rejected: 0, mismatches: [], common: [] };
  for (const w of fc.sample(arb, { seed, numRuns: RUNS })) {
    t.runs++;
    const res = runJson(build(w));
    if (res.kind !== "ok") { t.rejected++; continue; }
    t.common.push(...common(res.report));
    compare(w, res.report, t);
  }
  return t;
}
const itemStatus = (r: Report, rule: RuleId, name: string): string | undefined => ruleOf(r, rule).items.find((i) => nameText(i) === name)?.status;

/* ───────── 분류기: 불일치 원인을 세계의 값에서 찾는다 ───────── */
const ODD_PROTO = (p: string): boolean => !["tcp", "udp", "-1", "icmp", "6", "17", "1", "58", "icmpv6"].includes(p) || p !== p.trim() || /^\d+$/.test(p) && !["6", "17", "1", "58"].includes(p);
function classifyNet1(sg: Sg): string | null {
  const split = sg.rules.some((r) => r.cidrs.length > 1 && !r.cidrs.includes("0.0.0.0/0") && r.cidrs.some((c) => /^(0|64|128)\.0\.0\.0\/[12]$/.test(c)));
  const odd = sg.rules.some((r) => ODD_PROTO(r.protocol) || [r.fromPort, r.toPort].some((x) => x !== null && (x < 0 || x > 65535)) || (r.fromPort !== null && r.toPort !== null && r.fromPort > r.toPort) || r.cidrs.some((c) => c !== c.trim()));
  if (odd) return "CC-QA-03";
  if (split) return "CC-QA-04";
  return null;
}
function classifyKey4(r: Role): string | null {
  for (const s of r.trust ?? []) {
    const e = s.effect.trim().toLowerCase();
    if (!["allow", "deny"].includes(e) || s.effect !== s.effect.trim() || s.effect === "") return "CC-QA-05";
    if (s.actions.some((a) => !/^[A-Za-z0-9-]+:[A-Za-z0-9*?]+$/.test(a) && a !== "*")) return "CC-QA-05";
    if (s.aws.includes("*") && !s.wildcard) return "CC-QA-05";
    if (s.conditionKeys.some((k) => /^(Null|StringNotEquals|StringNotLike|ForAllValues:StringNotLike):sts:ExternalId$/i.test(k))) return "CC-QA-05";
  }
  if (r.trust !== null && r.trust.length === 0) return "CC-QA-05";
  return null;
}
function classifyAzNet1(n: Nsg): string | null {
  const odd = n.rules.some((r) => !["inbound", "outbound"].includes(r.direction.trim().toLowerCase()) || !["allow", "deny"].includes(r.access.trim().toLowerCase())
    || !["tcp", "udp", "*", "any", "icmp", "esp", "ah"].includes(r.protocol.trim().toLowerCase()) || r.ports.length === 0 || r.ports.some((p) => p.trim() === ""));
  if (odd) return "CC-QA-17";
  if (n.rules.some((r) => r.sources.some((s) => /^[A-Za-z]/.test(s) && !["internet", "any", "virtualnetwork", "azureloadbalancer"].includes(s.toLowerCase())) || r.sources.some((s) => /^(0|128)\.0\.0\.0\/1$/.test(s)))) return "CC-QA-04";
  return null;
}

let cache: Record<string, Tally> | null = null;
function all(): Record<string, Tally> {
  if (cache !== null) return cache;
  cache = {
    "AWS-NET-1": run(netWorld, 20261019, awsNetJson, (w, r, t) => {
      for (const sg of w.sgs) {
        const e = itemStatus(r, "AWS-NET-1", sg.id), ref = refNet1(sg, w.enis);
        if (e === undefined) continue;
        t.compared++;
        if (e !== ref) t.mismatches.push({ rule: "AWS-NET-1", target: sg.id, engine: e, ref, bug: classifyNet1(sg), detail: JSON.stringify({ rules: sg.rules, enis: w.enis.filter((x) => x.groups.includes(sg.id)) }) });
      }
    }),
    "AWS-STO-2": run(stoWorld, 20261020, awsStoJson, (w, r, t) => {
      for (const b of w.buckets) {
        const e = itemStatus(r, "AWS-STO-2", b.name), ref = refSto2(b, w.account);
        if (e === undefined) continue;
        t.compared++;
        if (e !== ref) t.mismatches.push({ rule: "AWS-STO-2", target: b.name, engine: e, ref, bug: null, detail: JSON.stringify({ account: w.account, b }) });
      }
    }),
    "AWS-KEY-4": run(rolesWorld, 20261021, awsRolesJson, (w, r, t) => {
      for (const role of w) {
        const e = itemStatus(r, "AWS-KEY-4", role.name), ref = refKey4(role);
        if (e === undefined) continue;
        t.compared++;
        if (e !== ref) t.mismatches.push({ rule: "AWS-KEY-4", target: role.name, engine: e, ref, bug: classifyKey4(role), detail: JSON.stringify(role.trust) });
      }
    }),
    "AZ-NET-1": run(azNetWorld, 20261022, azNetJson, (w, r, t) => {
      for (const n of w) {
        const e = itemStatus(r, "AZ-NET-1", n.name), ref = refAzNet1(n);
        if (e === undefined) continue;
        t.compared++;
        if (e !== ref) t.mismatches.push({ rule: "AZ-NET-1", target: n.name, engine: e, ref, bug: classifyAzNet1(n), detail: JSON.stringify(n) });
      }
    }),
    "AZ-STO-2": run(azStoWorld, 20261023, azStoJson, (w, r, t) => {
      const items = ruleOf(r, "AZ-STO-2").items;
      w.forEach((a, i) => {
        for (const c of a.containers) {
          const e = items.find((x) => (x.resource.key as string).endsWith(`/stqa${i}/${c.name}`))?.status;
          const ref = refAzSto2(c, a);
          if (e === undefined) continue;
          t.compared++;
          if (e !== ref) t.mismatches.push({ rule: "AZ-STO-2", target: `stqa${i}/${c.name}`, engine: e, ref, bug: null, detail: JSON.stringify({ allow: a.allow, c }) });
        }
      });
    }),
  };
  return cache;
}
const show = (ms: readonly Mismatch[]): string[] => ms.slice(0, 12).map((m) => `${m.rule} ${m.target}: 엔진 ${m.engine} / 참조 ${m.ref} — ${m.detail.slice(0, 220)}`);

describe("FO-06 생성 속성 + 차등 오라클(룰당 250회, 시드 고정)", () => {
  for (const rule of ["AWS-NET-1", "AWS-STO-2", "AWS-KEY-4", "AZ-NET-1", "AZ-STO-2"] as const) {
    it(`${rule}: 세계 대부분이 받아들여지고 대상 비교가 충분하다 · 공통 속성 위반 0`, () => {
      const t = all()[rule];
      expect(t.runs).toBe(RUNS);
      expect(t.rejected).toBeLessThan(RUNS * 0.2);
      expect(t.compared).toBeGreaterThan(RUNS);
      expect(t.common).toEqual([]);
    });
    it(`${rule}: 분류되지 않은 불일치 0(새 버그 · 명세 모호 · 참조기 버그 후보)`, () => {
      expect(show(all()[rule].mismatches.filter((m) => m.bug === null))).toEqual([]);
    });
  }
  it("[CC-QA-03] AWS-NET-1: 비정상 프로토콜 · 포트 · 출발지 문자열에서 엔진과 참조(P3: 해석 불가)가 갈리지 않아야 한다", () => {
    expect(show(all()["AWS-NET-1"].mismatches.filter((m) => m.bug === "CC-QA-03"))).toEqual([]);
  });
  it("[CC-QA-04] AWS-NET-1 · AZ-NET-1: 합쳐서 전체인 출발지 · 서비스 태그에서 엔진과 참조(D-1 · D-3 제안 기본값)가 갈리지 않아야 한다", () => {
    expect(show([...all()["AWS-NET-1"].mismatches, ...all()["AZ-NET-1"].mismatches].filter((m) => m.bug === "CC-QA-04"))).toEqual([]);
  });
  it("[CC-QA-05] AWS-KEY-4: 모르는 Effect · 형식 밖 Action · aws ['*'] · 부정형 ExternalId 조건 · 문장 0개에서 엔진과 참조가 갈리지 않아야 한다", () => {
    expect(show(all()["AWS-KEY-4"].mismatches.filter((m) => m.bug === "CC-QA-05"))).toEqual([]);
  });
  it("[CC-QA-17] AZ-NET-1: 모르는 방향 · 허용 · 프로토콜, 빈 포트 칸에서 엔진과 참조가 갈리지 않아야 한다", () => {
    expect(show(all()["AZ-NET-1"].mismatches.filter((m) => m.bug === "CC-QA-17"))).toEqual([]);
  });
});
