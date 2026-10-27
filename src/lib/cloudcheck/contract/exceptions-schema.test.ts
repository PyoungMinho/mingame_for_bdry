// src/lib/cloudcheck/contract/exceptions-schema.test.ts — G0 계약 스모크: 예외 파일 v1.0 (방향서 §4-3, §4-9)
// 예외는 상태를 바꾸지 않고 라벨만 붙인다(INV-8). 이 테스트는 파일 '모양'과 기간 규칙만 본다.
import { describe, expect, it } from "vitest";
import { RULE_IDS } from "../model/report";
import { EXCEPTIONS_SCHEMA_ID, EXCEPTION_MAX_DAYS, ExceptionEntry, ExceptionsFile } from "./exceptions-schema";

type Json = Record<string, unknown>;
const entry = (o: Json = {}): Json => ({
  ruleId: "AWS-STO-2",
  resource: "aws|111122223333|s3-bucket|ap-northeast-2|amzn-s3-demo-assets",
  reason: "정적 웹사이트로 의도한 공개입니다",
  until: "2026-11-18",
  createdAt: "2026-10-19",
  ...o,
});
const file = (entries: Json[] = [entry()], o: Json = {}): Json => ({ schema: EXCEPTIONS_SCHEMA_ID, entries, ...o });

describe("예외 파일 v1.0 — 받아야 함", () => {
  it("정상 예외 파일", () => {
    const r = ExceptionsFile.safeParse(file());
    expect(r.success, r.success ? "" : JSON.stringify(r.error.issues)).toBe(true);
  });
  it("빈 entries도 정상(내보낼 예외가 아직 없는 파일)", () => {
    expect(ExceptionsFile.safeParse(file([])).success).toBe(true);
  });
  it("정확히 90일 · 다음 날(1일)은 경계값으로 받는다", () => {
    expect(ExceptionEntry.safeParse(entry({ createdAt: "2026-10-19", until: "2027-01-17" })).success).toBe(true);
    expect(ExceptionEntry.safeParse(entry({ createdAt: "2026-10-19", until: "2026-10-20" })).success).toBe(true);
  });
  it("사유 앞뒤 공백은 잘라서 받는다", () => {
    const r = ExceptionEntry.safeParse(entry({ reason: "  의도한 공개  " }));
    expect(r.success && r.data.reason).toBe("의도한 공개");
  });
});

describe("예외 파일 v1.0 — 거부해야 함", () => {
  const bad: ReadonlyArray<readonly [string, Json]> = [
    ["공백뿐인 사유", file([entry({ reason: "   " })])],
    ["90일 초과", file([entry({ createdAt: "2026-10-19", until: "2027-01-18" })])],
    ["until이 createdAt보다 앞섬", file([entry({ createdAt: "2026-10-19", until: "2026-10-01" })])],
    ["until이 createdAt과 같은 날", file([entry({ createdAt: "2026-10-19", until: "2026-10-19" })])],
    ["없는 룰 ID", file([entry({ ruleId: "AWS-NET-2" })])],
    ["옛 version 키(schema 대신)", { version: 1, entries: [entry()] }],
    ["schema 값이 다름", file([entry()], { schema: "cloudcheck.exceptions/2.0" })],
    ["until 날짜 형식 오류(13월)", file([entry({ until: "2026-13-01" })])],
    ["until 없음", file([(() => { const e = entry(); delete e.until; return e; })()])],
    ["항목의 추가 필드", file([entry({ note: "추가" })])],
    ["최상위 추가 필드", file([entry()], { extra: true })],
    ["resource가 빈 문자열", file([entry({ resource: "" })])],
    ["사유가 500자 초과", file([entry({ reason: "가".repeat(501) })])],
    ["예외가 1000개 초과", file(Array.from({ length: 1001 }, () => entry()))],
  ];
  it.each(bad)("%s", (_name, f) => {
    expect(ExceptionsFile.safeParse(f).success).toBe(false);
  });
});

describe("예외 파일 v1.0 — 값 검사", () => {
  it("스키마 ID와 최대 기간", () => {
    expect(EXCEPTIONS_SCHEMA_ID).toBe("cloudcheck.exceptions/1.0");
    expect(EXCEPTION_MAX_DAYS).toBe(90);
  });
  it("룰 ID 18개 전부 받는다", () => {
    for (const id of RULE_IDS) expect(ExceptionEntry.safeParse(entry({ ruleId: id })).success, id).toBe(true);
  });
});
