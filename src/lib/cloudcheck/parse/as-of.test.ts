// src/lib/cloudcheck/parse/as-of.test.ts — 기준 시각 후보 고르기와 증거 시각 (STEP 5 CC-QA-01, parse 쪽)
// parse는 ① 2000년 이전 후보를 버리고(asOf null + asOfRejected) ② 입력 안의 가장 늦은 증거 시각(latestEvidence)을 알려 준다. asOf를 끌어올리지는 않는다.
// 시각 역전(증거 > 기준 + 5분)을 확인 불가로 만드는 일은 룰(rules/kit)이 한다.
import { describe, expect, it } from "vitest";
import type { AsOfFact, Instant } from "../contract/normalized";
import { checkInvariants } from "../contract/normalized-invariants";
import { MIN_PLAUSIBLE_AS_OF_MS, chooseAsOf, latestOf } from "./as-of";
import { buildInput } from "./normalize";
import { REPORT_HEADER, SUB, awsFile, azureFile, rec, recCsv, reportCsv, rgStorageCsv } from "./testdata";
import type { Json } from "./testdata";

const inst = (iso: string): Instant => ({ iso: iso as Instant["iso"], ms: Date.parse(iso) });
const fact = (iso: string, source: AsOfFact["source"]): AsOfFact => ({ at: inst(iso), source });
const ok = (rs: ReturnType<typeof rec>[]) => {
  const b = buildInput(rs);
  if (!b.ok) throw new Error("buildInput 실패");
  expect(checkInvariants(b.input)).toEqual([]);
  return b.input;
};
const MS = (iso: string): number => Date.parse(iso);

describe("chooseAsOf / latestOf", () => {
  it("우선순위대로 믿을 수 있는 첫 후보를 고른다", () => {
    expect(chooseAsOf([fact("2026-10-19T00:00:00Z", "filename"), fact("2026-10-20T00:00:00Z", "file-time")]).asOf?.source).toBe("filename");
    expect(chooseAsOf([null, fact("2026-10-20T00:00:00Z", "file-time")]).asOf?.source).toBe("file-time");
  });
  it("2000-01-01보다 이른 후보는 버리고, 다음 후보가 믿을 만하면 그것을 쓴다", () => {
    const d = chooseAsOf([fact("1999-12-31T23:59:59Z", "filename"), fact("2026-10-20T00:00:00Z", "file-time")]);
    expect(d.asOf?.source).toBe("file-time");
    expect(d.rejected).toBeUndefined();
  });
  it("모든 후보가 믿을 수 없으면 null + 첫 후보를 버린 기록", () => {
    const d = chooseAsOf([fact("1970-01-01T00:00:00Z", "file-time")]);
    expect(d).toEqual({ asOf: null, rejected: { candidate: fact("1970-01-01T00:00:00Z", "file-time"), why: "early-implausible" } });
  });
  it("후보가 없으면 null이고 기록도 없다", () => { expect(chooseAsOf([null, null])).toEqual({ asOf: null }); });
  it("경계: 2000-01-01T00:00:00Z는 믿는다", () => {
    expect(MIN_PLAUSIBLE_AS_OF_MS).toBe(MS("2000-01-01T00:00:00Z"));
    expect(chooseAsOf([fact("2000-01-01T00:00:00Z", "file-time")]).asOf).not.toBeNull();
    expect(chooseAsOf([fact("1999-12-31T23:59:59Z", "file-time")]).asOf).toBeNull();
  });
  it("latestOf: 가장 늦은 시각, 비면 null", () => {
    expect(latestOf([inst("2026-01-01T00:00:00Z"), null, inst("2026-10-15T00:00:00Z"), undefined])?.iso).toBe("2026-10-15T00:00:00Z");
    expect(latestOf([])).toBeNull();
  });
});

describe("CSV 입력의 기준 시각 (recognize → buildInput)", () => {
  const csv = reportCsv();
  it("정상 파일 시각은 그대로(file-time), 파일 이름 시각이 있으면 이름이 우선(filename)", () => {
    expect(ok([recCsv(csv, "r.csv", MS("2026-10-19T09:30:00Z"))]).inputs[0].asOf).toEqual(fact("2026-10-19T09:30:00Z", "file-time"));
    expect(ok([recCsv(csv, "status_reports_2026-10-19T09_00_00Z.csv", MS("2026-10-19T09:30:00Z"))]).inputs[0].asOf).toEqual(fact("2026-10-19T09:00:00Z", "filename"));
  });
  it("파일 수정 시각이 0(1970) · 1980(FAT·ZIP) · 1999이면 기준 시각이 없다(null) + 버린 기록", () => {
    for (const lm of [0, MS("1980-01-01T00:00:00Z"), MS("1999-12-31T00:00:00Z")]) {
      const i = ok([recCsv(csv, "r.csv", lm)]);
      expect(i.inputs[0].asOf, String(lm)).toBeNull();
      expect(i.inputs[0].asOfRejected, String(lm)).toMatchObject({ why: "early-implausible", candidate: { source: "file-time", at: { ms: lm } } });
      expect(i.doors.mfa).toMatchObject({ state: "selected", asOf: null });
    }
  });
  it("수정 시각이 0이어도 파일 이름 시각이 믿을 만하면 이름을 쓴다(버린 기록 없음)", () => {
    const i = ok([recCsv(csv, "status_reports_2026-10-19T09_00_00Z.csv", 0)]);
    expect(i.inputs[0].asOf?.source).toBe("filename");
    expect(i.inputs[0].asOfRejected).toBeUndefined();
  });
  it("후보가 아예 없으면(수정 시각 null · 이름 시각 없음) null이고 버린 기록도 없다", () => {
    const i = ok([recCsv(csv, "r.csv", null)]);
    expect(i.inputs[0].asOf).toBeNull();
    expect(i.inputs[0].asOfRejected).toBeUndefined();
  });
  it("인식 결과의 기준 시각도 같다(미리보기에 1970이 나오지 않는다)", () => {
    expect(recCsv(csv, "r.csv", 0).asOf).toBeNull();
    expect(recCsv(csv, "r.csv", MS("2026-10-19T09:30:00Z")).asOf).toEqual({ at: "2026-10-19T09:30:00Z", source: "file-time" });
  });
});

describe("latestEvidence — 입력 안의 가장 늦은 증거 시각 (asOf를 끌어올리지 않는다)", () => {
  it("보고서 CSV: 생성·회전·마지막 사용 중 가장 늦은 것. 파일 시각이 그보다 이르면 asOf는 그대로 두고 역전을 알 수 있게 한다", () => {
    const i = ok([recCsv(reportCsv(), "r.csv", MS("2026-01-01T00:00:00Z"))]);
    expect(i.inputs[0].latestEvidence?.iso).toBe("2026-10-18T09:00:00Z");                  // jane.doe의 password_last_used
    expect(i.inputs[0].asOf?.at.iso).toBe("2026-01-01T00:00:00Z");                         // 끌어올리지 않는다
    expect(i.inputs[0].latestEvidence!.ms).toBeGreaterThan(i.inputs[0].asOf!.at.ms + 5 * 60 * 1000);
    expect(i.inputs[0].asOfRejected).toBeUndefined();
  });
  it("password_next_rotation(미래 날짜)은 증거가 아니다 · 모호한 행(다른 계정)의 시각도 뺀다", () => {
    const header = REPORT_HEADER.split(",");
    const row = (user: string, acct: string, nextRotation: string, lastUsed: string): string => {
      const cells = header.map((h) => (h === "user" ? user : h === "arn" ? `arn:aws:iam::${acct}:user/${user}` : h === "password_next_rotation" ? nextRotation : h === "password_last_used" ? lastUsed : h === "user_creation_time" ? "2020-01-01T00:00:00+00:00" : h === "password_enabled" ? "true" : h === "mfa_active" ? "true" : "N/A"));
      return cells.join(",");
    };
    const root = reportCsv().split("\n")[1];
    const text = [REPORT_HEADER, root, row("a", "111122223333", "2031-01-01T00:00:00+00:00", "2026-03-01T00:00:00+00:00"), row("b", "999988887777", "N/A", "2029-01-01T00:00:00+00:00"), ""].join("\n");
    const i = ok([recCsv(text, "r.csv", MS("2026-10-19T00:00:00Z"))]);
    expect(i.inputs[0].latestEvidence?.iso).toBe("2026-07-01T00:10:00Z");                  // 루트의 마지막 사용(2026-07-01)이 가장 늦다. 2031(다음 회전)·2029(다른 계정 행)는 뺀다
  });
  it("시각 칸이 전부 N/A이면 latestEvidence는 없다(null이 아니라 생략)", () => {
    const header = REPORT_HEADER.split(",");
    const cells = header.map((h) => (h === "user" ? "<root_account>" : h === "arn" ? "arn:aws:iam::111122223333:root" : h === "mfa_active" ? "true" : "N/A")).join(",");
    const i = ok([recCsv([REPORT_HEADER, cells, ""].join("\n"), "r.csv", MS("2026-10-19T00:00:00Z"))]);
    expect("latestEvidence" in i.inputs[0]).toBe(false);
  });
  it("Resource Graph 저장소 CSV: 키 생성 시각 · NSG CSV는 없음", () => {
    const row = `cc-rg-storage/1,${"00000000-0000-0000-0000-00000000a001"},/subscriptions/${SUB}/resourceGroups/rg/providers/Microsoft.Storage/storageAccounts/st1,${SUB},rg,st1,StorageV2,koreacentral,,true,2025-01-10T00:00:00.1234567Z,2026-03-02T00:00:00Z,,`;
    const i = ok([recCsv(rgStorageCsv([row]), "s.csv", MS("2026-10-19T00:00:00Z"))]);
    expect(i.inputs[0].latestEvidence?.iso).toBe("2026-03-02T00:00:00Z");
  });
  it("Azure 수집기: 저장소 키 생성 시각 중 가장 늦은 것. 수집 시각이 그보다 이르면(시계 늦음) asOf는 그대로 두고 역전을 알 수 있게 한다", () => {
    const f = azureFile({ mutate: (x: Json) => { x.collectedAt = "2025-01-01T00:00:00Z"; x.run.finishedAt = "2025-01-01T00:00:00Z"; for (const r of x.receipts) r.at = "2025-01-01T00:00:00Z"; } }).file;
    const i = ok([rec(f)]);
    expect(i.inputs[0].latestEvidence?.iso).toBe("2025-01-10T00:00:00Z");
    expect(i.inputs[0].asOf?.at.iso).toBe("2025-01-01T00:00:00Z");
  });
  it("AWS 수집기는 계산하지 않는다(서버 시각인 보고서 생성 시각이 기준)", () => {
    const i = ok([rec(awsFile().file)]);
    expect("latestEvidence" in i.inputs[0]).toBe(false);
  });
});

describe("수집기 입력의 기준 시각 — 2000년 이전이면 버린다", () => {
  it("Azure · AWS 수집 시각이 1999년이면 asOf null + 버린 기록, 나머지(영수증·실행 키)는 그대로", () => {
    for (const make of [() => azureFile({ mutate: (x: Json) => { x.collectedAt = "1999-12-31T00:00:00Z"; } }).file, () => awsFile({ mutate: (x: Json) => { x.collectedAt = "1999-12-31T00:00:00Z"; } }).file]) {
      const r = rec(make());
      expect(r.status).toBe("ok");
      expect(r.asOf).toBeNull();
      const i = ok([r]);
      expect(i.inputs[0].asOf).toBeNull();
      expect(i.inputs[0].asOfRejected).toMatchObject({ why: "early-implausible", candidate: { source: "collected-at" } });
      expect(i.inputs[0].runKey).toContain("1999-12-31T00:00:00Z");
      expect(i.receipts.size).toBeGreaterThan(0);
    }
  });
  it("정상 수집 시각은 영향이 없다", () => {
    const i = ok([rec(awsFile().file)]);
    expect(i.inputs[0].asOf).toEqual(fact("2026-10-19T03:12:00Z", "collected-at"));
    expect("asOfRejected" in i.inputs[0]).toBe(false);
  });
});
