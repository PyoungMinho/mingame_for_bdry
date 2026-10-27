// QA IN-10 — 자격증명 보고서 CSV 함정 (설계서 §4-4, CR-09)
// 따옴표 안 쉼표·줄바꿈 사용자 이름, CRLF·CR만·BOM, 엑셀 재저장(날짜 '2026-10-15 0:00' 꼴), 열 순서 뒤섞음, 같은 열 이름 두 번, 다른 계정 ARN 행 섞임, 칸 수가 다른 행.
// 기대: 날짜를 못 읽으면 이상 없음 0, 모호한 행 = csv-row-ambiguous(범위 미증명), 다른 계정 행 → 그 출처 범위 미증명(CC-QA-10, 2026-10-20 수정·검증됨 — 회귀 시험).
import { describe, expect, it } from "vitest";
import type { Report } from "../model/report";
import { companyCsv, csvRows, csvText, label, nameText, okReport, ruleOf, rulesOf, runCsv } from "./kit";

const B = companyCsv("B");
const judgments = (r: Report): string => JSON.stringify(rulesOf(r).map((x) => [x.ruleId, x.status, x.items.map((i) => [nameText(i), i.status]).sort()]));
const NEG = (s: string): boolean => s === "clear" || s === "na";

describe("IN-10 CSV 모양(같은 판정이어야 하는 변형)", () => {
  const base = okReport(runCsv(B));
  it("CRLF · CR만 · UTF-8 BOM으로 바꿔도 판정이 같다", () => {
    expect(judgments(okReport(runCsv(B.replace(/\n/g, "\r\n"))))).toBe(judgments(base));
    expect(judgments(okReport(runCsv(B.replace(/\n/g, "\r"))))).toBe(judgments(base));
    expect(judgments(okReport(runCsv(`﻿${B}`)))).toBe(judgments(base));
  });
  it("모든 칸을 따옴표로 감싸도(엑셀 재저장의 따옴표 변경) 판정이 같다", () => {
    const quoted = csvRows(B).map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    expect(judgments(okReport(runCsv(`${quoted}\n`)))).toBe(judgments(base));
  });
  it("열 순서를 뒤집어도(이름으로 매핑) 판정이 같다", () => {
    const rows = csvRows(B).map((r) => [...r].reverse());
    expect(judgments(okReport(runCsv(csvText(rows))))).toBe(judgments(base));
  });
  it("따옴표 안 쉼표 · 줄바꿈이 든 사용자 이름은 한 사용자로 읽고 정상 판정한다", () => {
    for (const odd of ["park, ops", "park\nops", 'park "ops"']) {
      const q = `"${odd.replace(/"/g, '""')}"`;
      const r = okReport(runCsv(B.replace("\npark-ops,", `\n${q},`)));
      expect(ruleOf(r, "AWS-MFA-2").items.find((i) => nameText(i) === odd.replace(/\n/g, "�"))?.status ?? ruleOf(r, "AWS-MFA-2").items.find((i) => nameText(i).startsWith("park"))?.status, odd).toBe("clear");
      expect(ruleOf(r, "AWS-MFA-2").status, odd).toBe("clear");
    }
  });
});

describe("IN-10 CSV 함정(이상 없음이 생기면 안 되는 변형)", () => {
  it("엑셀 재저장 날짜('2026-10-15 0:00' 꼴)면 날짜를 쓰는 룰(KEY-1 · KEY-2 · MFA-1)은 이상 없음·해당 없음이 아니다", () => {
    const excel = B.replace(/(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):\d{2}\+00:00/g, (_, d: string, h: string, m: string) => `${d} ${Number(h)}:${m}`);
    expect(excel).not.toMatch(/T\d{2}:\d{2}:\d{2}\+00:00/);
    const r = okReport(runCsv(excel));
    for (const id of ["AWS-KEY-1", "AWS-KEY-2", "AWS-MFA-1"] as const) expect(NEG(ruleOf(r, id).status), `${id} ${label(ruleOf(r, id))}`).toBe(false);
  });
  it("칸 수가 머리글과 다른 행이 있으면 그 출처 범위는 증명되지 않고(csv-row-ambiguous) 사용자 룰은 이상 없음이 아니다", () => {
    const r = okReport(runCsv(B.replace("\nintern-2021,", "\nintern-2021,EXTRA,")));
    expect(r.collection.inputs[0].scopeProven).toBe(false);
    expect(label(ruleOf(r, "AWS-MFA-2"))).toBe("unknown(csv-row-ambiguous)");
  });
  it("[CC-QA-10] 다른 계정(999988887777)의 행이 섞이면 그 출처 범위는 증명되지 않아야 한다(E-20)", () => {
    const rows = csvRows(companyCsv("A"));
    const other = csvRows(companyCsv("C")).slice(2).map((r) => r.map((c) => c.replace("arn:aws:iam::111122223333:", "arn:aws:iam::999988887777:")));
    const r = okReport(runCsv(csvText([...rows, ...other])));
    expect(r.collection.inputs[0].scopeProven).toBe(false);
  });
  it("[CC-QA-10] 다른 계정 행의 사용자를 이 계정 사용자로 판정하지 않아야 한다(E-20, 수정 전: MFA-2 위험으로 들어갔다)", () => {
    const rows = csvRows(companyCsv("A"));
    const other = csvRows(companyCsv("C")).slice(2).map((r) => r.map((c) => c.replace("arn:aws:iam::111122223333:", "arn:aws:iam::999988887777:")));
    const r = okReport(runCsv(csvText([...rows, ...other])));
    expect(ruleOf(r, "AWS-MFA-2").items.map(nameText)).not.toContain("dev-kim");
  });
  it("[CC-QA-10] 같은 열 이름이 두 번 있으면(값이 엇갈려도 첫 열만 읽는다) 그 출처는 모호하다 — MFA-2가 이상 없음이 아니어야 한다", () => {
    const rows = csvRows(B);
    const mi = rows[0].indexOf("mfa_active");
    const dup = rows.map((r, i) => [...r, i === 0 ? "mfa_active" : r[mi] === "true" ? "false" : r[mi]]);
    const r = okReport(runCsv(csvText(dup)));
    expect(ruleOf(r, "AWS-MFA-2").status).not.toBe("clear");
  });
  it("[CC-QA-10] 같은 열 이름 두 번(값이 엇갈림)인 출처는 모호한 출처로 범위가 증명되지 않고, 사용자 룰은 확인 불가(csv-row-ambiguous)", () => {
    const rows = csvRows(B);
    const mi = rows[0].indexOf("mfa_active");
    const dup = rows.map((r, i) => [...r, i === 0 ? "mfa_active" : r[mi] === "true" ? "false" : r[mi]]);
    const r = okReport(runCsv(csvText(dup)));
    expect(r.collection.inputs[0].scopeProven).toBe(false);
    expect(label(ruleOf(r, "AWS-MFA-2"))).toBe("unknown(csv-row-ambiguous)");
  });
});
