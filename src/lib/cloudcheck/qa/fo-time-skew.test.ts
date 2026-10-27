// QA FO-05 · CL-05 — 기준 시각보다 늦은 증거(시각 역전)는 '이상 없음·해당 없음'을 만들지 않아야 한다 (테스트 설계서 §4-1, CR-01)
// CC-QA-01(높음, 수정·검증됨 2026-10-20): 수정 전에는 증거 시각 > 기준 시각이면 나이가 음수 → 0일 → '최근'으로 보고 이상 없음이었다.
// 지금 동작(결정 docs/planning/cloudcheck-qa-decisions.md §8-A): ① 2000-01-01 이전 기준 시각 후보는 버린다(asOf null) ② 증거가 기준 시각 + 5분보다 늦으면
// 나이를 쓰는 룰의 음성 결론을 확인 불가로 ③ 알림 as-of-before-evidence 1개(보고서 CSV · 저장소 CSV · Azure 수집기). 아래 [CC-QA-01] 시험은 모두 회귀 시험이다.
import { describe, expect, it, vi } from "vitest";
import type { Report, RuleId } from "../model/report";
import { runCollector } from "../collector/testkit";
import { azureBase, AZ_ST_WEB, AZ_SUB } from "../collector/__scenarios__";
import { out, withScenario } from "../collector/__scenarios__/types";
import { companyJson, monotoneViolations, nameText, okReport, ruleOf, runCsv, runJson } from "./kit";
import type { Json } from "./kit";

vi.setConfig({ testTimeout: 60_000 });

const H = "user,arn,user_creation_time,password_enabled,password_last_used,password_last_changed,password_next_rotation,mfa_active,access_key_1_active,access_key_1_last_rotated,access_key_1_last_used_date,access_key_1_last_used_region,access_key_1_last_used_service,access_key_2_active,access_key_2_last_rotated,access_key_2_last_used_date,access_key_2_last_used_region,access_key_2_last_used_service,cert_1_active,cert_1_last_rotated,cert_2_active,cert_2_last_rotated,additional_credentials_info";
const ROOT = "<root_account>,arn:aws:iam::111122223333:root,2019-04-02T01:00:00+00:00,not_supported,2026-03-02T01:00:00+00:00,not_supported,not_supported,true,false,N/A,N/A,N/A,N/A,false,N/A,N/A,N/A,N/A,false,N/A,false,N/A,N/A";
/** E-01: 키 회전 2025-12-01(실제 322일) · 마지막 사용 2026-10-15 */
const DEV = "dev-kim,arn:aws:iam::111122223333:user/dev-kim,2025-11-20T00:00:00+00:00,true,2026-10-15T00:00:00+00:00,2025-11-20T00:00:00+00:00,N/A,true,true,2025-12-01T00:00:00+00:00,2026-10-15T00:00:00+00:00,ap-northeast-2,s3,false,N/A,N/A,N/A,N/A,false,N/A,false,N/A,";
/** E-03: 2020년 키, 2020-02 이후 미사용, 콘솔 없음 */
const OLD = "old-ci,arn:aws:iam::111122223333:user/old-ci,2020-01-01T00:00:00+00:00,false,N/A,N/A,N/A,false,true,2020-01-01T00:00:00+00:00,2020-02-01T00:00:00+00:00,us-east-1,s3,false,N/A,N/A,N/A,N/A,false,N/A,false,N/A,";
const CSV_DEV = [H, ROOT, DEV, ""].join("\n");
const CSV_OLD = [H, ROOT, OLD, ""].join("\n");
const RIGHT = Date.UTC(2026, 9, 19, 3, 0, 0);

const neg = (s: string): boolean => s === "clear" || s === "na";
/** 그 룰의 대상 중 이름이 user인 것들의 상태 */
const userItems = (r: Report, id: RuleId, user: string): string[] => ruleOf(r, id).items.filter((i) => nameText(i) === user).map((i) => i.status);

describe("FO-05 전제: 올바른 기준 시각이면 같은 CSV가 주의를 낸다(시험 입력이 의미 있다)", () => {
  it("lastModified가 올바르면(2026-10-19) dev-kim 키(322일)는 AWS-KEY-1 주의다", () => {
    const r = okReport(runCsv(CSV_DEV, { lastModified: RIGHT }));
    expect(ruleOf(r, "AWS-KEY-1").status).toBe("caution");
    expect(userItems(r, "AWS-KEY-1", "dev-kim")).toEqual(["caution"]);
    expect(r.collection.asOf).toEqual({ at: "2026-10-19T03:00:00Z", source: "file-time" });
  });
  it("lastModified가 올바르면 old-ci(2020년 키, 2020-02 이후 미사용)는 KEY-1·KEY-2 모두 주의다", () => {
    const r = okReport(runCsv(CSV_OLD, { lastModified: RIGHT }));
    expect(ruleOf(r, "AWS-KEY-1").status).toBe("caution");
    expect(ruleOf(r, "AWS-KEY-2").status).toBe("caution");
  });
  it("변조한 기준 시각(파일 시각 · 파일 이름)은 리포트에 그대로 실리고, 2000-01-01 이전 후보(0 · 1980 · 1999)는 버려져 기준 시각 없음(null)이 된다", () => {
    expect(okReport(runCsv(CSV_DEV, { lastModified: Date.UTC(2026, 0, 1) })).collection.asOf).toEqual({ at: "2026-01-01T00:00:00Z", source: "file-time" });
    expect(okReport(runCsv(CSV_DEV, { name: "status_reports_2026-01-01T00_00_00Z.csv", lastModified: RIGHT })).collection.asOf).toEqual({ at: "2026-01-01T00:00:00Z", source: "filename" });
    for (const lm of [0, Date.UTC(1980, 0, 1), Date.UTC(1999, 11, 31)]) expect(okReport(runCsv(CSV_OLD, { lastModified: lm })).collection.asOf).toBeNull();
    // 경계: 2000-01-01 00:00:00Z 정각은 받는다(하한 = 2000-01-01)
    expect(okReport(runCsv(CSV_OLD, { lastModified: Date.UTC(2000, 0, 1) })).collection.asOf?.at).toBe("2000-01-01T00:00:00Z");
  });
  it("올바른 기준 시각이면 시각 역전 알림(as-of-before-evidence)이 없다", () => {
    expect(okReport(runCsv(CSV_DEV, { lastModified: RIGHT })).banners.map((b) => b.kind)).not.toContain("as-of-before-evidence");
  });
});

describe("FO-05 ① CSV lastModified가 보고서 안 시각보다 이르다(PC 시계 늦음, E-01)", () => {
  const r = (): Report => okReport(runCsv(CSV_DEV, { lastModified: Date.UTC(2026, 0, 1) }));
  it("[CC-QA-01] AWS-KEY-1: 기준 시각보다 늦은 증거(마지막 사용 2026-10-15)가 있으면 dev-kim 키는 이상 없음이 아니어야 한다", () => {
    expect(userItems(r(), "AWS-KEY-1", "dev-kim").some((s) => s === "clear")).toBe(false);
    expect(neg(ruleOf(r(), "AWS-KEY-1").status)).toBe(false);
  });
  it("[CC-QA-01] AWS-KEY-2: 마지막 사용 시각이 기준 시각보다 늦으면 '45일 안에 사용'을 확정하지 않아야 한다", () => {
    expect(userItems(r(), "AWS-KEY-2", "dev-kim").some((s) => s === "clear")).toBe(false);
    expect(neg(ruleOf(r(), "AWS-KEY-2").status)).toBe(false);
  });
  it("기록: 같은 기기 시계를 쓰는 시간 알림(timeNotices)은 이 경우를 잡지 못한다 — 그래서 파일 안의 증거로 판단하는 알림이 따로 필요하다", async () => {
    const { timeNotices } = await import("../engine/time");
    expect(timeNotices(r(), "2026-01-01T00:05:00Z" as never)).toEqual([]);
  });
  it("[CC-QA-01] 리포트에 시각 역전 알림(as-of-before-evidence)이 1개 선다", () => {
    expect(r().banners.filter((b) => b.kind === "as-of-before-evidence")).toHaveLength(1);
  });
});

describe("FO-05 ③ 파일 이름 시각이 내용보다 이르다(E-02)", () => {
  const r = (): Report => okReport(runCsv(CSV_DEV, { name: "status_reports_2026-01-01T00_00_00Z.csv", lastModified: RIGHT }));
  it("[CC-QA-01] AWS-KEY-1: 파일 이름 기준 시각보다 늦은 증거가 있으면 이상 없음이 아니어야 한다", () => {
    expect(neg(ruleOf(r(), "AWS-KEY-1").status)).toBe(false);
  });
  it("[CC-QA-01] AWS-KEY-2: 파일 이름 기준 시각보다 늦은 증거가 있으면 이상 없음이 아니어야 한다", () => {
    expect(neg(ruleOf(r(), "AWS-KEY-2").status)).toBe(false);
  });
  it("[CC-QA-01] 파일 이름 경로도 시각 역전 알림이 1개 선다", () => {
    expect(r().banners.filter((b) => b.kind === "as-of-before-evidence")).toHaveLength(1);
  });
});

describe("FO-05 ② lastModified 0(1970) · 1980-01-01(FAT·ZIP 시각) · 1999-12-31 (E-03)", () => {
  for (const [label, lm] of [["0", 0], ["1980-01-01", Date.UTC(1980, 0, 1)], ["1999-12-31", Date.UTC(1999, 11, 31)]] as const) {
    const r = (): Report => okReport(runCsv(CSV_OLD, { lastModified: lm }));
    it(`[CC-QA-01] lastModified ${label}: 2020년 키는 AWS-KEY-1 이상 없음이 아니어야 한다`, () => {
      expect(neg(ruleOf(r(), "AWS-KEY-1").status)).toBe(false);
    });
    it(`[CC-QA-01] lastModified ${label}: 2020-02 이후 안 쓴 키는 AWS-KEY-2 이상 없음이 아니어야 한다`, () => {
      expect(neg(ruleOf(r(), "AWS-KEY-2").status)).toBe(false);
    });
  }
});

/** Azure 수집 시각을 옮긴다(영수증 시각 · 끝난 시각 포함) */
function azureAt(set: "B", at: string): Json {
  const f = companyJson("azure", set);
  f.collectedAt = at;
  f.run.finishedAt = at;
  for (const r of f.receipts) r.at = at;
  return f;
}

describe("FO-05 ④ Azure collectedAt < keyCreationTime (로컬 CLI 시계 늦음, E-04)", () => {
  it("전제: 원래 시각이면 B의 공유 키 계정 3개가 모두 AZ-KEY-1 주의다", () => {
    const r = okReport(runJson(companyJson("azure", "B")));
    expect(ruleOf(r, "AZ-KEY-1").items.map((i) => i.status)).toEqual(["caution", "caution", "caution"]);
  });
  it("[CC-QA-01] 수집 시각보다 늦게 만든 키가 있는 계정은 AZ-KEY-1 이상 없음(keys-rotated)이 아니어야 한다", () => {
    const r = okReport(runJson(azureAt("B", "2025-01-01T00:00:00Z"), { name: "cloudcheck-azure-0001-20250101T000000Z.json" }));
    expect(ruleOf(r, "AZ-KEY-1").items.filter((i) => i.status === "clear").map(nameText)).toEqual([]);
  });
  it("[CC-QA-01] Azure 수집기 경로도 시각 역전 알림(as-of-before-evidence)이 1개 선다", () => {
    const r = okReport(runJson(azureAt("B", "2025-01-01T00:00:00Z"), { name: "cloudcheck-azure-0001-20250101T000000Z.json" }));
    expect(r.banners.filter((b) => b.kind === "as-of-before-evidence")).toHaveLength(1);
  });
});

describe("FO-05 ⑤ AWS 수집 JSON collectedAt < 보고서 generatedTime − 5분", () => {
  it("AWS 수집기 경로의 나이는 보고서 생성 시각(서버 시각) 기준이라, 수집 시각이 늦게 찍혀도 이상 없음이 새로 생기지 않는다", () => {
    for (const set of ["A", "B", "C", "D"] as const) {
      const before = okReport(runJson(companyJson("aws", set)));
      const f = companyJson("aws", set);
      f.collectedAt = "2026-01-01T00:00:00Z";
      f.run.finishedAt = "2026-01-01T00:00:00Z";
      for (const r of f.receipts) r.at = "2026-01-01T00:00:00Z";
      const after = okReport(runJson(f, { name: "cloudcheck-aws-3333-20260101T000000Z.json" }));
      expect(monotoneViolations(before, after, set)).toEqual([]);
      if (set === "C") expect(ruleOf(after, "AWS-KEY-1").asOf).toEqual({ at: "2026-10-19T03:12:09Z", source: "credential-report" });
    }
  });
  it("기록(B 남음): AWS 수집기 JSON은 collectedAt이 보고서 생성 시각보다 10개월 일러도 알림이 없다 — 판정은 보고서 시각 기준이라 영향 없음", () => {
    const f = companyJson("aws", "C");
    f.collectedAt = "2026-01-01T00:00:00Z";
    f.run.finishedAt = "2026-01-01T00:00:00Z";
    for (const r of f.receipts) r.at = "2026-01-01T00:00:00Z";
    expect(okReport(runJson(f, { name: "cloudcheck-aws-3333-20260101T000000Z.json" })).banners.map((b) => b.kind)).not.toContain("as-of-before-evidence");
  });
  it.todo("[CC-QA-01 권고 · B] AWS 수집기 JSON: 수집 시각이 보고서 생성 시각보다 5분 넘게 이르면 '기준 시각보다 늦은 기록' 알림 1개(판정 영향은 없음 — 정보 알림)");
});

/* ───────── CL-05: 수집기 shim의 date를 실제보다 이르게(시계 뒤처짐) ───────── */
const azureScenarioOldKeys = (): ReturnType<typeof azureBase> => {
  const base = azureBase();
  const key = `storage account list@${AZ_SUB}`;
  const raw = base[key] as { stdout: string };
  const accounts = JSON.parse(raw.stdout) as Json[];
  const web = accounts.find((a) => a.id === AZ_ST_WEB) as Json;
  web.keyCreationTime = { key1: "2025-06-01T00:00:00.0000000+00:00", key2: "2025-06-01T00:00:00.0000000+00:00" };   // 실제(2026-10-19) 기준 505일
  return withScenario(base, { [key]: out(accounts) }) as ReturnType<typeof azureBase>;
};
function shimReport(cloud: "azure", fakeNow: string): Report {
  const res = runCollector({ cloud, scenario: azureScenarioOldKeys(), args: ["--yes"], fakeNow });
  if (res.status !== 0 || res.outputText === null) throw new Error(`수집기 실패: ${res.status} ${res.stderr.slice(0, 200)}`);
  return okReport(runJson(JSON.parse(res.outputText), { name: res.outputName ?? "cloudcheck-azure.json" }));
}

describe("CL-05 shim fakeNow를 실제보다 이르게 한 Azure 수집 결과", () => {
  it("전제: 올바른 시계(2026-10-19)면 2025-06-01 키를 가진 stwebfiles01은 AZ-KEY-1 주의다", () => {
    const r = shimReport("azure", "2026-10-19T03:12:00Z");
    expect(ruleOf(r, "AZ-KEY-1").items.filter((i) => nameText(i) === "stwebfiles01").map((i) => i.status)).toEqual(["caution"]);
  });
  it("[CC-QA-01] 시계가 늦은 기기(2025-05-01)에서 돌린 결과라도 stwebfiles01은 이상 없음이 아니어야 한다", () => {
    const r = shimReport("azure", "2025-05-01T00:00:00Z");
    expect(ruleOf(r, "AZ-KEY-1").items.filter((i) => nameText(i) === "stwebfiles01").map((i) => i.status)).not.toContain("clear");
  });
});
