// 디자인 검수 K-1~K-6 (docs/design/cloudcheck-rule-copy-review.md §7) — 화면에 나가는 문장이 판정과 맞는가.
// 기대값은 디자인팀장이 정한 문구와 룰 명세에서 먼저 썼다. 엔진 출력에서 복사하지 않는다.
import { describe, expect, it } from "vitest";
import { judge } from "../engine/judge";
import { MICRO, resolveFixture } from "../fixtures/micro";
import { renderMsg } from "../fixtures/render";
import type { ItemResult, MsgRef, Report, RuleResult } from "../model/report";
import type { RuleId } from "../model/report";
import { ENGINE_KO } from "./i18n/ko";
import { RULES } from "./registry";

const KO: Readonly<Record<string, string>> = ENGINE_KO;
const specOf = (id: string) => (RULES.find((m) => m.spec.ruleId === id) as (typeof RULES)[number]).spec;
const reportOf = (ref: string): Report => judge(resolveFixture(ref));
const ruleOf = (ref: string): RuleResult => {
  const id = ref.split("/")[1];
  const r = reportOf(ref).doors.flatMap((d) => d.rules).find((x) => x.ruleId === id);
  if (r === undefined) throw new Error(`${ref}: 리포트에 ${id}가 없다`);
  return r;
};
const factTexts = (item: ItemResult): string[] => item.facts.map((f) => renderMsg(f));
const factCodes = (item: ItemResult): string[] => item.facts.map((f) => f.code);
const allFactTexts = (r: RuleResult): string[] => r.items.flatMap(factTexts);
const nOf = (m: MsgRef): number | undefined => {
  const p = m.params?.n;
  return p !== undefined && "n" in p ? p.n : undefined;
};

describe("K-1 · K-2: 해당 없음의 근거 줄은 해당 없음 문장이다", () => {
  const CASES = [
    // [룰, 픽스처, 사유 slug, 근거 줄 문구(디자인 확정), 조건 설명(cond.na, 디자인 확정)]
    ["AWS-NET-1", "micro/AWS-NET-1/empty", "na-no-security-groups", "보안 그룹 0개(확인됨)", "활성 리전을 모두 조회했고 보안 그룹이 0개입니다(확인됨)."],
    ["AZ-NET-1", "micro/AZ-NET-1/empty", "na-no-nsgs", "NSG 0개(확인됨)", "조회한 구독에 NSG가 0개입니다(확인됨)."],
    ["AZ-LOG-1", "micro/AZ-LOG-1/empty", "na-no-subscriptions", "조회 범위 안 구독 0개(확인됨)", "조회 범위 안 구독이 0개입니다(확인됨)."],
  ] as const;

  it.each(CASES)("%s: 대상 0개는 해당 없음이고 근거는 %s 사유다", (id, ref, slug, basisText, condText) => {
    const r = ruleOf(ref);
    expect(r.status).toBe("na");
    if (r.status !== "na") return;
    expect(r.why.code).toBe("no-targets-proven");
    expect(r.basis.code).toBe(`${id}:${slug}`);
    expect(renderMsg(r.basis)).toBe(basisText);
    // 주의 사유(메일 포트 …)나 '내보내지 않는 구독 0개' 같은 거짓 문장이 아니다
    expect(renderMsg(r.basis)).not.toMatch(/열려|내보내지|메일/);
    expect(KO[specOf(id).conditionKeys.na as string]).toBe(condText);
  });
});

describe("해당 없음이 가능한 모든 룰은 해당 없음 문구와 픽스처가 있다 (K-1류 누락 방지)", () => {
  // 대상이 하나로 정해져 있거나(계정 설정 · 계정 전체 trail) 자동 판정이 없는 룰은 모수 0이 없다
  const NEVER_NA: readonly string[] = ["AWS-STO-1", "AWS-LOG-1", "AZ-MFA-G", "AZ-MFA-1"];
  const refs = Object.entries(MICRO).flatMap(([rule, table]) => Object.keys(table).map((name) => [rule, `micro/${rule}/${name}`] as const));

  it("해당 없음으로 판정된 모든 micro 결과의 근거는 '<룰>:na-…' 사유이고 cond.na 문구가 있다", () => {
    const seen = new Map<string, Set<string>>();
    for (const [rule, ref] of refs) {
      const r = ruleOf(ref);
      const set = seen.get(rule) ?? new Set<string>();
      set.add(r.status);
      seen.set(rule, set);
      if (r.status !== "na") continue;
      expect(r.basis.code, ref).toMatch(new RegExp(`^${rule}:na-[a-z0-9-]+$`));
      expect(specOf(rule).conditionKeys.na, `${rule} cond.na`).toBeDefined();
      expect(Object.keys(specOf(rule).reasons), rule).toContain(r.basis.code.split(":")[1]);
    }
    for (const m of RULES) {
      const id = m.spec.ruleId;
      if (NEVER_NA.includes(id)) continue;
      expect([...(seen.get(id) ?? [])], `${id}: 해당 없음 micro 픽스처`).toContain("na");
      expect(specOf(id).conditionKeys.na, `${id}: cond.na`).toBeDefined();
      expect(Object.keys(specOf(id).reasons).some((s) => s.startsWith("na-")), `${id}: na- 사유`).toBe(true);
    }
  });
});

describe("K-3: CanonicalUser 주체에 '모든 주체(*)' 사실을 붙이지 않는다", () => {
  it("S3 정식 사용자 ID를 믿는 역할은 전용 사실을 갖고 trust-wildcard 사실은 없다", () => {
    const r = ruleOf("micro/AWS-KEY-4/canonical-user");
    expect(r.status).toBe("caution");
    const item = r.items[0];
    expect(factCodes(item)).toContain("fact:trust-canonical-user");
    expect(factCodes(item)).not.toContain("fact:trust-wildcard");
    expect(factTexts(item)).toContain("S3 정식 사용자 ID(CanonicalUser)를 믿음");
    expect(factTexts(item).join("|")).not.toContain("모든 주체");
  });
  it("Principal이 *인 역할은 그대로 '모든 주체(*)를 믿음'이다", () => {
    const item = ruleOf("micro/AWS-KEY-4/wildcard").items.find((i) => i.status === "risk") as ItemResult;
    expect(factCodes(item)).toContain("fact:trust-wildcard");
    expect(factTexts(item)).toContain("모든 주체(*)를 믿음");
  });
});

describe("K-4: 사용 기록 사실에 내부 표기(slot1 · ?)가 나오지 않는다", () => {
  const stale = (r: RuleResult): ItemResult => r.items.find((i) => i.status === "caution") as ItemResult;

  it("보고서(CSV)만으로 읽은 키: 키 식별은 key-slot 사실이 맡고 사용 기록 문장에는 키 표기가 없다", () => {
    const used = stale(ruleOf("micro/AWS-KEY-2/unused-key-report-only"));
    expect(factCodes(used)).toEqual(expect.arrayContaining(["fact:key-slot", "fact:unused-key-date"]));
    expect(factTexts(used)).toEqual(expect.arrayContaining(["보고서의 키 1번 칸", "액세스 키 마지막 사용 2026-07-01"]));
    const never = stale(ruleOf("micro/AWS-KEY-2/never-used-key-report-only"));
    expect(factCodes(never)).toEqual(expect.arrayContaining(["fact:key-slot", "fact:unused-key-none"]));
    expect(factTexts(never)).toEqual(expect.arrayContaining(["보고서의 키 1번 칸", "액세스 키 사용 기록 없음"]));
    for (const item of [used, never]) {
      expect(factTexts(item).join("|")).not.toMatch(/slot|\?/);
      for (const f of item.facts) expect(Object.keys(f.params ?? {}), f.code).not.toContain("key");
    }
  });
  it("수집기 경로: 키 끝 4자리 사실이 따로 붙는다", () => {
    const used = stale(ruleOf("micro/AWS-KEY-2/unused-key"));
    expect(factCodes(used)).toEqual(expect.arrayContaining(["fact:key-suffix", "fact:unused-key-date"]));
    expect(factTexts(used)).toContain("키 끝 4자리 7QXZ");
  });
});

describe("K-5: 원시 값을 문장에 넣지 않고 값마다 따로 둔다", () => {
  it("AZ-STO-2 컨테이너 접근 수준: Private · Blob · Container", () => {
    const pass = ruleOf("micro/AZ-STO-2/pass");
    expect(pass.items.flatMap(factTexts)).toContain("컨테이너 접근 수준: Private");
    const pub = ruleOf("micro/AZ-STO-2/public-container");
    expect(pub.items.flatMap(factTexts)).toEqual(expect.arrayContaining(["컨테이너 접근 수준: Blob", "컨테이너 접근 수준: Private"]));
    const blocked = ruleOf("micro/AZ-STO-2/account-blocks");
    expect(blocked.items.flatMap(factTexts)).toContain("컨테이너 접근 수준: Container");
    for (const r of [pass, pub, blocked]) expect(r.items.flatMap(factCodes)).not.toContain("fact:container-access");
  });
  it("AZ-LOG-1 내보내는 곳: 작업 영역 · 스토리지 계정", () => {
    expect(allFactTexts(ruleOf("micro/AZ-LOG-1/pass"))).toEqual(["내보내는 곳: Log Analytics 작업 영역"]);
    expect(allFactTexts(ruleOf("micro/AZ-LOG-1/all-logs-group"))).toEqual(["내보내는 곳: 스토리지 계정"]);
    expect(allFactTexts(ruleOf("micro/AZ-LOG-1/both-destinations"))).toEqual(["내보내는 곳: Log Analytics 작업 영역", "내보내는 곳: 스토리지 계정"]);
    for (const ref of ["pass", "all-logs-group", "both-destinations"]) expect(ruleOf(`micro/AZ-LOG-1/${ref}`).items.flatMap(factCodes)).not.toContain("fact:export-destination");
  });
  it("AWS-STO-2 ACL 켜짐 이유: 객체 소유권 값마다 문장이 따로 있고, 모르는 값은 그대로 보이지 않는다 (디자인 §8-6: '사용 중'이 아니라 '켜짐')", () => {
    const text = (name: string): string[] => ruleOf(`micro/AWS-STO-2/${name}`).items.flatMap(factTexts).filter((t) => t.includes("ACL"));
    expect(text("acl-enabled")).toEqual(["ACL 켜짐(객체 소유권: Object writer)"]);
    expect(text("acl-enabled-preferred")).toEqual(["ACL 켜짐(객체 소유권: Bucket owner preferred)"]);
    expect(text("acl-enabled-unset")).toEqual(["객체 소유권 설정 없음(ACL이 켜진 것으로 봄)"]);
    expect(text("acl-enabled-other")).toEqual(["객체 소유권 값을 해석하지 못함(ACL이 켜진 것으로 봄)"]);
    for (const name of ["acl-enabled", "acl-enabled-preferred", "acl-enabled-unset", "acl-enabled-other"]) {
      const codes = ruleOf(`micro/AWS-STO-2/${name}`).items.flatMap(factCodes);
      expect(codes, name).not.toContain("fact:acl-in-use");
      expect(JSON.stringify(reportOf(`micro/AWS-STO-2/${name}`)), name).not.toContain("SomethingNew");
    }
  });
});

describe("K-6: 룰 수준 주의 사유의 개수는 대상 표의 주의 개수와 같다", () => {
  const MIXED = [
    ["AWS-NET-1", "micro/AWS-NET-1/mixed-caution", "열린 인바운드 규칙을 확인해야 하는 보안 그룹 3개"],
    ["AZ-NET-1", "micro/AZ-NET-1/mixed-caution", "열린 인바운드 규칙을 확인해야 하는 NSG 3개"],
  ] as const;

  it.each(MIXED)("%s: 주의 범주가 셋이면 공통 사유로 주의 전체 개수를 말한다", (id, ref, text) => {
    const r = ruleOf(ref);
    expect(r.status).toBe("caution");
    expect(r.items.filter((i) => i.status === "caution")).toHaveLength(3);
    expect(r.why.code).toBe(`${id}:open-review`);
    expect(nOf(r.why)).toBe(3);
    expect(renderMsg(r.why)).toBe(text);
  });

  const SINGLE = [
    ["AWS-NET-1", "micro/AWS-NET-1/unattached", "exposed-unattached"],
    ["AWS-NET-1", "micro/AWS-NET-1/other-port", "open-other-port"],
    ["AWS-NET-1", "micro/AWS-NET-1/mail-port", "open-mail-port"],
    ["AZ-NET-1", "micro/AZ-NET-1/unattached", "exposed-unattached"],
    ["AZ-NET-1", "micro/AZ-NET-1/mail-port", "open-mail-port"],
  ] as const;
  it.each(SINGLE)("%s: 범주가 하나면 그 범주의 사유를 그대로 쓴다 (%s → %s)", (id, ref, slug) => {
    const r = ruleOf(ref);
    expect(r.status).toBe("caution");
    expect(r.why.code).toBe(`${id}:${slug}`);
    expect(nOf(r.why)).toBe(r.items.filter((i) => i.status === "caution").length);
  });

  it("모든 micro 픽스처에서: 위험·주의 룰 사유의 {n}은 같은 상태 대상 수(고립된 거부 제외)와 같다", () => {
    const bad: string[] = [];
    for (const [rule, table] of Object.entries(MICRO) as [RuleId, Record<string, unknown>][]) {
      for (const name of Object.keys(table)) {
        const ref = `micro/${rule}/${name}`;
        const r = ruleOf(ref);
        if (r.status !== "risk" && r.status !== "caution") continue;
        const n = nOf(r.why);
        if (n === undefined) continue;
        const same = r.items.filter((i) => i.status === r.status && i.why.code !== "isolated-denial").length;
        if (n !== same) bad.push(`${ref}: 사유 개수 ${n} ≠ 표의 ${r.status} ${same}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
