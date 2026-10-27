// 정답지 8개(answers/<세트>.<클라우드>.json)의 모양 · 내부 일관성 · 룰 명세와의 일치
// 정답지는 사람이 먼저 쓴다. 이 테스트는 정답지를 "만들지" 않고, 쓴 정답지가 스스로 모순이 없는지 / 룰 명세에 없는 사유를 적지 않았는지만 본다.
// 엔진 출력과의 대조는 e2e.test.ts(JSON → recognize → buildInput → judge)가 한다.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { UNKNOWN_REASON_ORDER } from "../engine/reasons";
import type { UnknownReason } from "../model/report";
import { RULES } from "../rules/registry";
import type { AnswerFile, AnswerRule } from "./answers";

const DIR = join(__dirname, "answers");
const FILES = readdirSync(DIR).filter((f) => f.endsWith(".json")).sort();
const load = (f: string): AnswerFile => JSON.parse(readFileSync(join(DIR, f), "utf8")) as AnswerFile;
const UNKNOWN_CODES = Object.keys(UNKNOWN_REASON_ORDER) as UnknownReason[];
const STATUSES = ["risk", "caution", "unknown", "clear", "na"];
const RANK: Readonly<Record<string, number>> = { risk: 0, caution: 1, unknown: 2, clear: 3, na: 4 };

describe("정답지 목록", () => {
  it("세트 4 × 클라우드 2 = 8개이고 파일 이름이 <세트>.<클라우드>.json이다", () => {
    expect(FILES).toEqual(["A.aws.json", "A.azure.json", "B.aws.json", "B.azure.json", "C.aws.json", "C.azure.json", "D.aws.json", "D.azure.json"]);
  });
});

describe.each(FILES.map((f) => [f] as const))("%s", (file) => {
  const a = load(file);
  const cloud = a.cloud;
  const released = RULES.filter((m) => m.spec.cloud === cloud && m.spec.released);

  it("머리: 스키마 · 세트 · 클라우드 · 회사 이름 · 작성 근거", () => {
    expect(a.schema).toBe("cloudcheck.answers/1");
    expect(file).toBe(`${a.set}.${a.cloud}.json`);
    expect(a.company).toBe({ A: "반듯상회", B: "멈춘시계상회", C: "아슬아슬상회", D: "반쯤본상회" }[a.set]);
    expect(a.authoredFrom).toContain("사람이 먼저");
    expect(a.authoredFrom).toContain("엔진 출력에서 복사하지 않았다");
  });

  it("출시된 룰 전부에 답이 있고, 없는 룰의 답은 없다", () => {
    expect(Object.keys(a.rules).sort()).toEqual(released.map((m) => m.spec.ruleId).sort());
  });

  it("룰마다: 상태가 룰의 최고 상태를 넘지 않고, 사유 코드가 룰 명세(spec.reasons)에 있다", () => {
    for (const m of released) {
      const spec = m.spec;
      const r: AnswerRule = a.rules[spec.ruleId];
      const slugs = Object.keys(spec.reasons);
      const tag = `${spec.ruleId}`;
      expect(STATUSES, tag).toContain(r.status);
      if (spec.maxStatus === "caution") expect(r.status, tag).not.toBe("risk");
      if (spec.maxStatus === "unknown") expect(r.status, tag).toBe("unknown");
      if (!spec.allowsClear) expect(r.status, tag).not.toBe("clear");
      switch (r.status) {
        case "risk": case "caution": case "clear": {
          const [rule, slug] = r.why.split(":");
          if (r.why === "isolated-denial") expect(r.status, tag).toBe("caution");
          else { expect(rule, tag).toBe(spec.ruleId); expect(slugs, `${tag} ${r.why}`).toContain(slug); }
          break;
        }
        case "na":
          expect(r.why, tag).toBe("no-targets-proven");
          expect(r.basis?.startsWith(`${spec.ruleId}:`), tag).toBe(true);
          expect(slugs, tag).toContain((r.basis as string).split(":")[1]);
          expect(r.items, tag).toEqual([]);
          break;
        case "unknown":
          expect(UNKNOWN_CODES, tag).toContain(r.why);
          expect(r.gaps?.[0], tag).toBe(r.why);
          expect(r.resolution, tag).toMatch(/^(rerun|path|portal|guide|permission:.+)$/);
          break;
      }
      if (r.status !== "unknown") { expect(r.gaps, tag).toBeUndefined(); expect(r.resolution, tag).toBeUndefined(); }
      // 사유 정렬(UNKNOWN_REASON_ORDER)과 중복 없음
      if (r.gaps !== undefined) {
        const order = r.gaps.map((g) => UNKNOWN_REASON_ORDER[g as UnknownReason]);
        expect(order, tag).toEqual([...order].sort((x, y) => x - y));
        expect(new Set(r.gaps).size, tag).toBe(r.gaps.length);
      }
      // 대상 사유
      for (const it of r.items) {
        expect(["risk", "caution", "unknown", "clear"], `${tag} ${it[1]}`).toContain(it[0]);
        if (it[0] === "unknown") expect(UNKNOWN_CODES, `${tag} ${it[1]} ${it[2]}`).toContain(it[2]);
        else if (it[2] === "isolated-denial") expect(spec.isolatedDenial, tag).not.toBeNull();
        else expect(slugs, `${tag} ${it[1]} ${it[2]}`).toContain(it[2]);
        if (spec.maxStatus === "caution") expect(it[0], `${tag} ${it[1]}`).not.toBe("risk");
      }
      // 룰 상태와 대상 상태의 관계
      const has = (s: string): boolean => r.items.some((i) => i[0] === s);
      if (r.status === "risk") expect(has("risk"), tag).toBe(true);
      if (r.status === "caution") { expect(has("caution"), tag).toBe(true); expect(has("risk"), tag).toBe(false); }
      if (r.status === "clear") expect(r.items.every((i) => i[0] === "clear") && r.items.length > 0, tag).toBe(true);
      if (r.status === "unknown") expect(has("risk") || has("caution"), tag).toBe(false);
      // 이상 없음 · 해당 없음 룰에는 확인 불가 대상이 없다
      if (r.status === "clear" || r.status === "na") expect(has("unknown"), tag).toBe(false);
    }
  });

  it("분포가 룰 · 대상 목록과 맞는다", () => {
    const rules = { risk: 0, caution: 0, unknown: 0, clear: 0, na: 0 };
    const items = { risk: 0, caution: 0, unknown: 0, clear: 0, na: 0 };
    for (const r of Object.values(a.rules)) {
      rules[r.status as keyof typeof rules]++;
      for (const i of r.items) items[i[0] as keyof typeof items]++;
    }
    expect(a.distribution.rules).toEqual(rules);
    expect(a.distribution.items).toEqual(items);
  });

  it("먼저 볼 것: 독립적으로 다시 계산한 값과 같다 (위험·주의 우선, 모자라면 확인 불가를 priority 순으로, 3개까지)", () => {
    const prio = (id: string): number => RULES.find((m) => m.spec.ruleId === id)!.spec.priority;
    const entries = Object.entries(a.rules);
    const positives = entries.filter(([, r]) => r.status === "risk" || r.status === "caution").sort(([x, rx], [y, ry]) => RANK[rx.status] - RANK[ry.status] || prio(x) - prio(y));
    const unknowns = entries.filter(([, r]) => r.status === "unknown").sort(([x], [y]) => prio(x) - prio(y));
    if (positives.length > 0) {
      expect(a.firstLook).toEqual({ mode: "findings", ruleIds: [...positives, ...unknowns].slice(0, 3).map(([id]) => id) });
    } else if (unknowns.length > 0) {
      expect(a.firstLook.mode).toBe("unlock");
      const flat = (a.firstLook.groups ?? []).flatMap((g) => g.ruleIds).sort();
      expect(flat).toEqual(unknowns.map(([id]) => id).sort());
    } else {
      expect(a.firstLook).toEqual({ mode: "none-found" });
    }
  });

  it("직접 볼 목록 · 알림 · 권한 힌트 · 범위의 형식", () => {
    for (const m of a.manual) expect(m).toMatch(/^(auto-notice|unknown-item|unknown-rule|guide-card|out-of-scope):[A-Za-z0-9-]+$/);
    for (const b of a.banners) expect(["secrets-detected", "areas-not-judged", "schema-newer-minor", "identity-unconfirmed", "collector-unknown-release", "csv-scope-unproven", "collected-at-approximate", "as-of-before-evidence", "doors-skipped", "duplicate-input-ignored"]).toContain(b);
    for (const h of a.unlockHints) {
      expect(h.permission.length).toBeGreaterThan(0);
      for (const [rule, n] of h.unlocks) { expect(Object.keys(a.rules)).toContain(rule); expect(n).toBeGreaterThan(0); }
      // 권한 힌트에 실린 룰은 정답지에서 확인 불가 대상이 있거나 확인 불가 룰이다
      for (const [rule] of h.unlocks) {
        const r = a.rules[rule];
        expect(r.status === "unknown" || r.status === "caution" || r.status === "risk", `${h.permission} ${rule}`).toBe(true);
      }
    }
    // 힌트는 합계(룰별 대상 수 합) 큰 순
    const totals = a.unlockHints.map((h) => h.unlocks.reduce((s, [, n]) => s + n, 0));
    expect(totals).toEqual([...totals].sort((x, y) => y - x));
    expect(a.scope.missing).toBeGreaterThanOrEqual(0);
    expect(typeof a.scope.proven).toBe("boolean");
  });

  it("문별 수집 현황: 상태와 판정 수준이 짝이 맞고, 수집 안 한 문은 점검 · 직접 볼 목록과 모순이 없다", () => {
    const DOOR_IDS = ["mfa", "key", "net", "sto", "log"] as const;
    expect(Object.keys(a.doors)).toEqual([...DOOR_IDS]);
    for (const door of DOOR_IDS) {
      const [status, level] = a.doors[door];
      expect(["collected", "partial", "not-collected"], door).toContain(status);
      expect(status === "not-collected", `${door}: 수집 안 함 ↔ 수준 none`).toBe(level === "none");
      if (status !== "not-collected") expect(["full", "findings-only"], door).toContain(level);
      const doorRules = RULES.filter((m) => m.spec.cloud === cloud && m.spec.released && m.spec.door === door);
      const hasAuto = doorRules.some((m) => m.spec.kind !== "guide");
      if (status === "not-collected") {
        // 수집하지 않은 문의 자동 판정 점검은 모두 확인 불가(수집 안 함)이고, 영역 하나로 직접 볼 목록에 오른다. 가이드 룰만 있는 문은 영역 항목 없이 가이드 카드뿐이다
        for (const m of doorRules) {
          const r = a.rules[m.spec.ruleId];
          if (m.spec.kind === "guide") { expect(r.why, m.spec.ruleId).toBe("guide-only"); continue; }
          expect([r.status, r.why, r.gaps], m.spec.ruleId).toEqual(["unknown", "not-collected", ["not-collected"]]);
        }
        expect(a.manual.includes(`out-of-scope:${door}`), `${door}: out-of-scope 항목`).toBe(hasAuto);
      } else {
        expect(a.manual.includes(`out-of-scope:${door}`), `${door}: 수집한 문에는 영역 항목이 없다`).toBe(false);
        for (const m of doorRules) expect(a.rules[m.spec.ruleId].why, m.spec.ruleId).not.toBe("not-collected");
      }
    }
  });

  it("건너뛴 문이 있으면 알림(doors-skipped)이 있고, 수집 안 한 문이 없으면 알림이 없다 (Azure 현관은 수집기가 다루지 않는 문이라 예외)", () => {
    const uncollected = (["mfa", "key", "net", "sto", "log"] as const).filter((d) => a.doors[d][0] === "not-collected" && !(cloud === "azure" && d === "mfa"));
    expect(a.banners.includes("doors-skipped"), "doors-skipped 알림").toBe(uncollected.length > 0);
  });

  it("권한으로 푸는 확인 불가 룰의 해소법은 그 룰을 올려 둔 권한 힌트와 같은 집합이다 (해소법과 권한 안내가 어긋나지 않는다)", () => {
    for (const [id, r] of Object.entries(a.rules)) {
      if (r.status !== "unknown" || r.resolution === undefined || !r.resolution.startsWith("permission:")) continue;
      const listed = r.resolution.slice("permission:".length).split(",");
      const hinted = a.unlockHints.filter((h) => h.unlocks.some(([rule]) => rule === id)).map((h) => h.permission);
      expect([...listed].sort(), id).toEqual([...hinted].sort());
    }
  });

  it("정답을 고친 이유(notes)는 비어 있지 않은 문장이다", () => {
    for (const n of a.notes ?? []) expect(n.trim().length).toBeGreaterThan(20);
  });

  it("알려진 차이(tolerate)에는 사유와 담당이 적혀 있다", () => {
    for (const [path, t] of Object.entries(a.tolerate ?? {})) {
      expect(path.length).toBeGreaterThan(0);
      expect(t.why.length, path).toBeGreaterThan(20);
      expect(t.owner, path).toMatch(/\S/);
      expect(t.accept.length, path).toBeGreaterThan(0);
    }
  });
});

describe("G3 배포 기준: 정답지 100% 일치(백엔드팀장 STEP 4)", () => {
  it("어느 정답지에도 알려진 차이(tolerate)가 없다 — 차이를 허용한 채로는 배포 게이트를 통과하지 않는다", () => {
    const open = FILES.flatMap((f) => Object.keys(load(f).tolerate ?? {}).map((p) => `${f}: ${p}`));
    expect(open).toEqual([]);
  });
});

describe("정답지 사이의 약속 (UX 11-3 요건 중 정답지로 확인되는 것)", () => {
  const A = Object.fromEntries(FILES.map((f) => [f.replace(".json", ""), load(f)])) as Record<string, AnswerFile>;
  const count = (a: AnswerFile, s: string): number => Object.values(a.rules).filter((r) => r.status === s).length;

  it("A(AWS)는 위험 · 주의 · 확인 불가가 0개이고 이상 없음 4개 이상 · 해당 없음 3개 이상 · none-found", () => {
    const a = A["A.aws"];
    expect([count(a, "risk"), count(a, "caution"), count(a, "unknown")]).toEqual([0, 0, 0]);
    expect(count(a, "clear")).toBeGreaterThanOrEqual(4);
    expect(count(a, "na")).toBeGreaterThanOrEqual(3);
    expect(a.firstLook.mode).toBe("none-found");
    expect(a.manual).toContain("auto-notice:AWS-MFA-2");
  });
  it("A(Azure)는 대부분 이상 없음 + Entra MFA 가이드 카드(확인 불가)이고 먼저 볼 것은 unlock이다", () => {
    const a = A["A.azure"];
    expect(count(a, "clear")).toBeGreaterThanOrEqual(4);
    expect(a.rules["AZ-MFA-G"].status).toBe("unknown");
    expect(a.firstLook.mode).toBe("unlock");
    expect(a.manual).toContain("guide-card:AZ-MFA-G");
  });
  it("B는 위험 0개, 주의 6개 이상(대상 기준), 룰마다 주의 대상이 예외 연습용으로 2개 이상이다", () => {
    for (const k of ["B.aws", "B.azure"]) {
      const a = A[k];
      expect(a.distribution.rules.risk).toBe(0);
      expect(a.distribution.items.caution).toBeGreaterThanOrEqual(6);
      expect(a.distribution.items.risk).toBe(0);
    }
    const labels = Object.values(A["B.aws"].rules).flatMap((r) => r.items.flatMap((i) => i[3] ?? []));
    expect(labels.some((l) => l.startsWith("legacy-hint"))).toBe(true);
    expect(labels.some((l) => l.startsWith("intended-public-candidate"))).toBe(true);
  });
  it("C는 먼저 볼 것에 위험이 앞서고(AWS는 서로 다른 문의 위험 3개), 위험 대상 4개 이상이 주의와 섞여 있다", () => {
    for (const k of ["C.aws", "C.azure"]) {
      const a = A[k];
      expect(a.firstLook.mode).toBe("findings");
      const ids = a.firstLook.ruleIds ?? [];
      const doors = ids.map((id) => RULES.find((m) => m.spec.ruleId === id)!.spec.door);
      expect(new Set(doors).size).toBe(3);
      const riskCount = Object.values(a.rules).filter((r) => r.status === "risk").length;
      expect(ids.filter((id) => a.rules[id].status === "risk")).toHaveLength(Math.min(3, riskCount));      // 위험 룰이 3개까지 앞을 채운다
      ids.forEach((id, i) => { if (i < Math.min(3, riskCount)) expect(a.rules[id].status, id).toBe("risk"); });
      if (k === "C.aws") for (const id of ids) expect(a.rules[id].status).toBe("risk");
      expect(a.distribution.items.risk).toBeGreaterThanOrEqual(4);
      expect(a.distribution.items.caution).toBeGreaterThan(0);
    }
  });
  it("D는 권한 힌트 · 알림 · 부분 거부(isolated-denial) · 빠진 범위 · 확인 불가 사유 5종 이상 · 직접 볼 대상을 모두 보인다", () => {
    for (const k of ["D.aws", "D.azure"]) {
      const a = A[k];
      expect(a.unlockHints.length).toBeGreaterThanOrEqual(1);
      expect(a.unlockHints.some((h) => h.unlocks.length >= 2)).toBe(true);
      expect(a.banners.some((b) => b === "areas-not-judged" || b === "doors-skipped")).toBe(true);
      expect(Object.values(a.rules).some((r) => r.items.some((i) => i[2] === "isolated-denial"))).toBe(true);
      expect(a.scope.missing).toBeGreaterThanOrEqual(1);
      const reasons = new Set<string>();
      for (const r of Object.values(a.rules)) { (r.gaps ?? []).forEach((g) => reasons.add(g)); for (const i of r.items) if (i[0] === "unknown") reasons.add(i[2]); }
      expect(reasons.size).toBeGreaterThanOrEqual(5);
      expect(a.manual.some((m) => m.startsWith("unknown-item:"))).toBe(true);
    }
    expect(A["D.aws"].manual).toContain("auto-notice:AWS-MFA-2");
    expect(A["D.azure"].manual).toContain("guide-card:AZ-MFA-G");
    expect(A["D.aws"].firstLook.mode).toBe("findings");     // INV-7 주의가 있어 unlock이 아니라 findings
  });
});
