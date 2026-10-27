// src/app/cloudcheck/_client/mocks/mocks.test.ts — 목업 자체 검사. 소유: 프론트팀장.
// ① 모델 v1 집계 규칙과 맞는지(분포·정렬·worstStatus·firstLook·manualCount) ② 체험 세트 요건(UX §11-3)을 시연하는지
// ③ 목업 카탈로그가 registry 조건(18장·priority 고유·쓰기 명령 자리표시자·링크 허용 호스트)을 지키는지 ④ 데이터 문자열에 금지어가 없는지(디자인 Q2).
import { describe, expect, it } from "vitest";
import { findBanned } from "../../../../lib/cloudcheck/model/banned-words";
import {
  DOORS, LINK_HOSTS, RULE_IDS, STATUS_ORDER,
  type DisplayValue, type MsgParam, type RecognitionStatus, type Report, type RuleResult, type Status,
} from "../../../../lib/cloudcheck/model/report";
import { fileOfKey, hasKey, KEY_RE } from "../i18n/index";
import { addDist, computeFirstLook, distOf, EMPTY_DIST, RULE_META } from "./build";
import { MOCK_CATALOG, MOCK_CATALOG_BY_ID } from "./catalog";
import { MOCK_COMPARISON_OK, MOCK_COMPARISON_REFUSED, MOCK_EXCEPTIONS_FILE_B, MOCK_OVERLAY_B } from "./extras";
import { MOCK_RECOGNITIONS } from "./inputs";
import { HOSTILE_VALUES, REPORT_A, REPORT_AZURE_A, REPORT_B, REPORT_C, REPORT_D, REPORT_HOSTILE, REPORT_REAL_D } from "./reports";

const rank = (s: Status): number => STATUS_ORDER.indexOf(s as (typeof STATUS_ORDER)[number]);
const rulesOf = (r: Report): RuleResult[] => r.doors.flatMap((d) => d.rules);
const byId = (r: Report, id: string): RuleResult | undefined => rulesOf(r).find((x) => x.ruleId === id);
const ALL: readonly [string, Report][] = [
  ["C", REPORT_C], ["D", REPORT_D], ["A", REPORT_A], ["B", REPORT_B], ["Azure A", REPORT_AZURE_A], ["real D", REPORT_REAL_D], ["hostile", REPORT_HOSTILE],
];

/** Report 안의 DisplayValue·MsgParam 문자열을 모두 모은다(렌더 금지어 검사가 읽는 데이터) */
function dataStrings(x: unknown, out: string[] = []): string[] {
  if (typeof x === "string") out.push(x);
  else if (Array.isArray(x)) for (const e of x) dataStrings(e, out);
  else if (x instanceof Map) for (const e of x.values()) dataStrings(e, out);
  else if (typeof x === "object" && x !== null) for (const [k, e] of Object.entries(x)) if (k !== "key" && k !== "code" && k !== "id") dataStrings(e, out);
  return out;
}
function displayValues(x: unknown, out: DisplayValue[] = []): DisplayValue[] {
  if (Array.isArray(x)) for (const e of x) displayValues(e, out);
  else if (typeof x === "object" && x !== null) {
    const o = x as Record<string, unknown>;
    if ((o.kind === "plain" && typeof o.text === "string") || (o.kind === "sensitive" && typeof o.full === "string") || (o.kind === "redacted" && typeof o.why === "string")) out.push(o as DisplayValue);
    else for (const e of Object.values(o)) displayValues(e, out);
  }
  return out;
}

describe("모델 v1 집계 규칙과 맞는다", () => {
  for (const [name, r] of ALL) {
    it(`${name}: 문 5개 DOORS 순서, 점검은 상태→priority, 대상은 상태→MatchKey`, () => {
      expect(r.doors.map((d) => d.door)).toEqual([...DOORS]);
      for (const d of r.doors) {
        const keys = d.rules.map((x) => [rank(x.status), x.priority] as const);
        expect(keys, d.door).toEqual([...keys].sort((a, b) => a[0] - b[0] || a[1] - b[1]));
        for (const x of d.rules) {
          const ik = x.items.map((i) => `${rank(i.status)}|${i.resource.key}`);
          expect(ik, x.ruleId).toEqual([...ik].sort());
        }
      }
    });
    it(`${name}: 분포(점검·대상·문)·worstStatus·manualCount·firstLook이 내용과 같다`, () => {
      const rules = rulesOf(r);
      expect(r.distribution.rules).toEqual(distOf(rules.map((x) => x.status)));
      expect(r.distribution.items).toEqual(rules.reduce((acc, x) => addDist(acc, x.distribution), EMPTY_DIST));
      for (const d of r.doors) {
        expect(d.distribution).toEqual(distOf(d.rules.map((x) => x.status)));
        expect(d.worstStatus).toBe(STATUS_ORDER.find((s) => d.rules.some((x) => x.status === s)));
        expect(d.manualCount).toBe(r.manualChecklist.filter((m) => m.door === d.door).length);
        for (const x of d.rules) {
          expect(x.door).toBe(d.door);
          expect(x.distribution).toEqual(distOf(x.items.map((i) => i.status)));
        }
      }
      expect(r.firstLook).toEqual(computeFirstLook(rules));
    });
    it(`${name}: 점검이 카탈로그와 맞다(클라우드·문·priority·출시됨), 해당 없음은 모수 0·대상 없음, 이상 없음은 증명된 범위`, () => {
      for (const x of rulesOf(r)) {
        const e = MOCK_CATALOG_BY_ID.get(x.ruleId);
        expect(e, x.ruleId).toBeDefined();
        expect([x.cloud, x.door, x.priority, e?.released]).toEqual([e?.cloud, e?.door, e?.priority, true]);
        expect(x.cloud).toBe(r.identity.cloud);
        if (x.status === "na") expect([x.coverage.population, x.items.length]).toEqual([0, 0]);
        if (x.status === "clear") expect(x.coverage.proven).toBe(true);
        if (e?.allowsClear === false) expect(x.status).not.toBe("clear");
      }
    });
  }
});

describe("체험 세트 요건(UX §11-3)", () => {
  it("C 아슬아슬상회: findings로 서로 다른 문의 위험 3개, 위험 행 4개 이상·모두 fix, 위험·주의 섞임, 대상 표 3행 이상", () => {
    expect(REPORT_C.firstLook.mode).toBe("findings");
    const ids = REPORT_C.firstLook.mode === "findings" ? REPORT_C.firstLook.ruleIds : [];
    expect(ids.map((id) => byId(REPORT_C, id)?.status)).toEqual(["risk", "risk", "risk"]);
    expect(new Set(ids.map((id) => RULE_META[id].door)).size).toBe(3);
    const risks = rulesOf(REPORT_C).filter((x) => x.status === "risk");
    expect(risks.length).toBeGreaterThanOrEqual(4);
    for (const x of risks) expect(MOCK_CATALOG_BY_ID.get(x.ruleId)?.fix, x.ruleId).not.toBeNull();
    expect(REPORT_C.distribution.rules.caution).toBeGreaterThan(0);
    expect(Math.max(...rulesOf(REPORT_C).map((x) => x.items.length))).toBeGreaterThanOrEqual(3);
  });
  it("D 반쯤본상회: 권한 하나로 점검 2개 이상, 수집 안 한 문 + 알림, isolated-denial, scope.missing, 사유 5종 이상, 직접 볼 목록 구성", () => {
    expect(REPORT_D.permissions.unlockHints.some((h) => h.unlocks.length >= 2)).toBe(true);
    expect(REPORT_D.banners.map((b) => b.kind)).toEqual(expect.arrayContaining(["doors-skipped", "areas-not-judged"]));
    expect(REPORT_D.doors.find((d) => d.door === "log")?.collection.status).toBe("not-collected");
    expect(rulesOf(REPORT_D).flatMap((x) => x.items).some((i) => i.status === "caution" && i.why.code === "isolated-denial")).toBe(true);
    expect(REPORT_D.scope.missing.length).toBeGreaterThanOrEqual(1);
    const reasons = new Set(rulesOf(REPORT_D).flatMap((x) => [...(x.status === "unknown" ? [x.why.code, ...x.gaps] : []), ...x.items.flatMap((i) => (i.status === "unknown" ? [i.why.code] : []))]));
    expect(reasons.size).toBeGreaterThanOrEqual(5);
    const origins = new Set(REPORT_D.manualChecklist.map((m) => m.origin));
    for (const o of ["unknown-item", "unknown-rule", "out-of-scope", "auto-notice"] as const) expect(origins.has(o), o).toBe(true);
    const sameRuleUnknown = REPORT_D.manualChecklist.filter((m) => m.origin === "unknown-item" && m.ruleId === "AWS-KEY-1").length;
    expect(sameRuleUnknown, "같은 점검·같은 사유 대상 6개 이상 → 직접 볼 목록 묶음 시연").toBeGreaterThanOrEqual(6);
    expect(REPORT_D.doors.find((d) => d.door === "mfa")?.rules.every((x) => x.status === "na"), "해당 없음만 있는 문").toBe(true);
    expect(REPORT_D.firstLook.mode).toBe("findings");
  });
  it("A 반듯상회(AWS): 위험·주의·확인 불가 0 → none-found, 이상 없음 4행·해당 없음 3행 이상, IdP 자동 안내", () => {
    const dist = REPORT_A.distribution.rules;
    expect([dist.risk, dist.caution, dist.unknown]).toEqual([0, 0, 0]);
    expect(dist.clear).toBeGreaterThanOrEqual(4);
    expect(dist.na).toBeGreaterThanOrEqual(3);
    expect(REPORT_A.firstLook).toEqual({ mode: "none-found" });
    expect(REPORT_A.manualChecklist.map((m) => [m.origin, m.what.code, m.why, m.howKey])).toEqual([["auto-notice", "fact:idp-mfa", null, "cc.rule.aws-mfa-2.auto.how"]]);
  });
  it("A 반듯상회(Azure): unlock(가이드) 모드 + guide-card 직접 볼 목록, AZ-MFA-1(미출시)은 없다", () => {
    expect(REPORT_AZURE_A.firstLook).toEqual({ mode: "unlock", groups: [{ resolution: { kind: "guide", permissions: [] }, ruleIds: ["AZ-MFA-G"] }] });
    expect(REPORT_AZURE_A.manualChecklist.some((m) => m.origin === "guide-card" && m.ruleId === "AZ-MFA-G")).toBe(true);
    expect(rulesOf(REPORT_AZURE_A).some((x) => x.ruleId === "AZ-MFA-1")).toBe(false);
    expect(REPORT_AZURE_A.distribution.rules.total).toBe(7);
    expect(REPORT_AZURE_A.scope.subscriptions.length).toBe(2);
  });
  it("B 멈춘시계상회: 주의 6행 이상(모두 questionKey), 위험 0, legacy-hint·intended-public-candidate, 예외 연습용 주의 대상 2개 이상", () => {
    const cautions = rulesOf(REPORT_B).filter((x) => x.status === "caution");
    expect(cautions.length).toBeGreaterThanOrEqual(6);
    for (const x of cautions) expect(MOCK_CATALOG_BY_ID.get(x.ruleId)?.questionKey, x.ruleId).not.toBeNull();
    expect(REPORT_B.distribution.rules.risk).toBe(0);
    const labels = rulesOf(REPORT_B).flatMap((x) => x.items.flatMap((i) => i.labels.map((l) => l.kind)));
    expect(labels).toEqual(expect.arrayContaining(["legacy-hint", "intended-public-candidate"]));
    expect(rulesOf(REPORT_B).flatMap((x) => x.items).filter((i) => i.status === "caution").length).toBeGreaterThanOrEqual(2);
  });
  it("세 첫 화면 모드(findings · unlock · none-found)와 체험·실제 모드가 모두 있다", () => {
    expect(new Set(ALL.map(([, r]) => r.firstLook.mode))).toEqual(new Set(["findings", "unlock", "none-found"]));
    expect(new Set(ALL.map(([, r]) => r.mode.kind))).toEqual(new Set(["demo", "real"]));
  });
  it("실제 모드 D는 알림 8종(밀도 시험 — STEP 5에 as-of-before-evidence 추가), 체험 리포트는 collector-unknown-release 없음", () => {
    expect(REPORT_REAL_D.banners).toHaveLength(8);
    for (const [, r] of ALL.filter(([, x]) => x.mode.kind === "demo")) expect(r.banners.some((b) => b.kind === "collector-unknown-release")).toBe(false);
  });
});

describe("목업 카탈로그(registry 조건)", () => {
  it("18장 · ID는 RULE_IDS와 같고 priority는 방향서 §6-1과 같으며 고유", () => {
    expect(MOCK_CATALOG.map((e) => e.ruleId).sort()).toEqual([...RULE_IDS].sort());
    for (const e of MOCK_CATALOG) expect(e.priority, e.ruleId).toBe(RULE_META[e.ruleId].priority);
    expect(new Set(MOCK_CATALOG.map((e) => e.priority)).size).toBe(18);
    expect(MOCK_CATALOG.filter((e) => !e.released).map((e) => e.ruleId)).toEqual(["AZ-MFA-1"]);
  });
  it("쓰기 명령은 자리표시자 1개 이상, 읽기 단계에는 쓰기 명령 없음", () => {
    for (const e of MOCK_CATALOG) {
      if (e.fix === null) continue;
      for (const cmd of [...e.fix.change.commands, ...e.fix.revert.commands]) {
        expect(cmd.kind, e.ruleId).toBe("write");
        expect(cmd.segments.some((s) => s.t === "ph"), `${e.ruleId}: ${cmd.segments.map((s) => (s.t === "text" ? s.v : `<${s.key}>`)).join("")}`).toBe(true);
      }
      for (const cmd of e.fix.observe.commands) expect(cmd.kind, e.ruleId).toBe("read");
    }
  });
  it("모든 링크가 LINK_HOSTS 안 https://<host>/…", () => {
    const links = MOCK_CATALOG.flatMap((e) => [
      ...e.basis.map((b) => b.link), ...(e.incident === null ? [] : [e.incident.link]),
      ...(e.fix === null ? [] : [e.fix.change.doc, ...(e.fix.observe.doc === null ? [] : [e.fix.observe.doc]), ...(e.fix.runbook === null ? [] : [e.fix.runbook])]),
      ...(e.guide === null ? [] : e.guide.steps.flatMap((s) => (s.doc === null ? [] : [s.doc]))),
    ]);
    for (const l of links) {
      expect((LINK_HOSTS as readonly string[]).includes(l.host), l.href).toBe(true);
      expect(l.href.startsWith(`https://${l.host}/`), l.href).toBe(true);
    }
  });
  it("모든 문구 키가 E 네임스페이스의 형식에 맞다", () => {
    const keys = MOCK_CATALOG.flatMap((e) => [
      e.titleKey, e.summaryKey, ...Object.values(e.conditionKeys), ...(e.impactKey === null ? [] : [e.impactKey]), ...(e.questionKey === null ? [] : [e.questionKey]),
      ...e.cannotSee, ...e.falsePositiveKeys, ...e.params.map((p) => p.key), ...e.basis.map((b) => b.titleKey),
      ...(e.fix === null ? [] : [e.fix.observe.textKey, e.fix.change.textKey, e.fix.revert.textKey, ...[...e.fix.observe.commands, ...e.fix.change.commands, ...e.fix.revert.commands].flatMap((c) => c.segments.flatMap((s) => (s.t === "ph" ? [s.key] : [])))]),
      ...(e.guide === null ? [] : e.guide.steps.map((s) => s.textKey)),
    ]);
    for (const k of keys) {
      expect(KEY_RE.test(k), k).toBe(true);
      expect(fileOfKey(k), k).toBe("engine");
    }
  });
});

describe("실제 E 카탈로그와 이름 맞춤(D4 통합 — DB설계자 대조 7키)", () => {
  it("직접 볼 목록의 howKey는 실제 E 카탈로그에 있는 키다(cc.rule.<id>.how · cc.rule.<id>.auto.how · cc.rule.common.how-not-collected)", () => {
    const bad = ALL.flatMap(([name, r]) => r.manualChecklist.filter((m) => m.howKey !== null && !hasKey(m.howKey)).map((m) => `${name}: ${m.id} ${String(m.howKey)}`));
    expect(bad).toEqual([]);
  });
  it("실제 RULE_CATALOG처럼 사례(incident)는 18장 모두 null이다(cc.incident.* 키가 없다)", () => {
    expect(MOCK_CATALOG.filter((e) => e.incident !== null).map((e) => e.ruleId)).toEqual([]);
  });
});

describe("입력 인식·예외·비교 목업", () => {
  it("RecognitionStatus 12종이 모두 있고 handle은 ok일 때만", () => {
    const all: RecognitionStatus[] = ["ok", "empty", "wrong-type", "parse-error", "not-cloudcheck", "schema-major", "credentials-file", "too-large", "too-deep", "account-mismatch", "cloud-mismatch", "superseded"];
    expect(new Set(MOCK_RECOGNITIONS.map((x) => x.status))).toEqual(new Set(all));
    for (const x of MOCK_RECOGNITIONS) expect(x.handle !== null, x.status).toBe(x.status === "ok");
  });
  it("예외 오버레이는 REPORT_B의 위험·주의 대상에만 붙고(디자인 Q9) 파일 항목 수와 맞다", () => {
    const items = new Map(rulesOf(REPORT_B).flatMap((x) => x.items.map((i) => [i.id, i] as const)));
    for (const id of MOCK_OVERLAY_B.byItemId.keys()) expect(["risk", "caution"]).toContain(items.get(id)?.status);
    expect(MOCK_OVERLAY_B.entries).toHaveLength(MOCK_EXCEPTIONS_FILE_B.entries.length);
  });
  it("비교: ok는 같은 계정·변화 5종, 거부는 다른 계정", () => {
    expect(MOCK_COMPARISON_OK.ok && new Set(MOCK_COMPARISON_OK.rules.map((x) => x.change))).toEqual(new Set(["became-unknown", "worse", "better", "became-known", "same"]));
    expect(MOCK_COMPARISON_OK.before.accountLast4).toBe(MOCK_COMPARISON_OK.after.accountLast4);
    expect(MOCK_COMPARISON_REFUSED.before.accountLast4).not.toBe(MOCK_COMPARISON_REFUSED.after.accountLast4);
  });
});

describe("데이터 문자열(디자인 Q2 — 렌더 금지어 검사가 데이터도 읽는다)", () => {
  it("체험·실제 목업의 데이터 문자열에 금지어 0(적대 목업 제외)", () => {
    const hits: string[] = [];
    for (const [name, r] of ALL.filter(([nm]) => nm !== "hostile")) {
      for (const s of dataStrings(r)) for (const h of findBanned(s)) hits.push(`${name}: '${s}' → ${h.label}`);
    }
    for (const s of dataStrings([MOCK_RECOGNITIONS, MOCK_EXCEPTIONS_FILE_B, MOCK_OVERLAY_B])) for (const h of findBanned(s)) hits.push(`extras: '${s}' → ${h.label}`);
    expect(hits).toEqual([]);
  });
  it("가짜 계정 ID는 문서 표본 값만(111122223333 · 0으로 채운 GUID · 9999 끝자리)", () => {
    const ids = ALL.flatMap(([, r]) => displayValues(r)).flatMap((dv) => (dv.kind === "sensitive" && (dv.type === "accountId" || dv.type === "tenantId" || dv.type === "subscriptionId") ? [dv.full] : []));
    for (const id of ids) expect(/^(111122223333|00000000-0000-0000-0000-00000000000[0-9])$/.test(id), id).toBe(true);
  });
  it("적대 목업은 적대 값을 모두 담는다(G-D8·R-12 렌더 검사 재료)", () => {
    const names = rulesOf(REPORT_HOSTILE).flatMap((x) => x.items.map((i) => i.resource.name));
    for (const hv of HOSTILE_VALUES) expect(names).toContainEqual(hv);
  });
  it("MsgParam {c}는 사용자 데이터가 아니다(비식별 상수만 — 리전·포트·CIDR·정책 이름)", () => {
    const cs: string[] = [];
    const walkParams = (x: unknown): void => {
      if (Array.isArray(x)) x.forEach(walkParams);
      else if (typeof x === "object" && x !== null) {
        const o = x as Record<string, unknown>;
        if ("params" in o && typeof o.params === "object" && o.params !== null) for (const p of Object.values(o.params as Record<string, MsgParam>)) if ("c" in p) cs.push(p.c);
        Object.values(o).forEach(walkParams);
      }
    };
    ALL.forEach(([, r]) => walkParams(r));
    for (const s of cs) expect(/^[\w ./*,:-]+$/.test(s), s).toBe(true);
  });
});
