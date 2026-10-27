// src/lib/cloudcheck/parse/exceptions.test.ts — 예외 파일: parseExceptions 실패 코드 · 왕복 · 상한 (디자인 X10)
import { describe, expect, it } from "vitest";
import { EXCEPTIONS_SCHEMA_ID, EXCEPTION_MAX_DAYS } from "../contract/exceptions-schema";
import type { ExceptionsFile } from "../contract/exceptions-schema";
import { isRedacted } from "../contract/normalized";
import { RULE_IDS } from "../model/report";
import { parseExceptions, serializeExceptions } from "./exceptions";

const RULE = RULE_IDS[0];
const entry = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  ruleId: RULE, resource: "aws|123456789012|S3Bucket|us-east-1|acme-public-assets", reason: "정적 사이트 공개 버킷(의도됨)", until: "2026-11-30", createdAt: "2026-10-19", ...over,
});
const file = (entries: Array<Record<string, unknown>> = [entry()], over: Record<string, unknown> = {}): string => JSON.stringify({ schema: EXCEPTIONS_SCHEMA_ID, entries, ...over });
const issues = (text: string): string[] => {
  const r = parseExceptions(text);
  if (r.ok) throw new Error("받아들여졌다");
  return r.issues;
};
const okFile = (text: string): ExceptionsFile => {
  const r = parseExceptions(text);
  if (!r.ok) throw new Error(`거부됨: ${r.issues.join(",")}`);
  return r.file;
};
const addDays = (iso: string, days: number): string => new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)) + days)).toISOString().slice(0, 10);

describe("받아들이는 파일", () => {
  it("올바른 파일", () => {
    const f = okFile(file());
    expect(f.schema).toBe(EXCEPTIONS_SCHEMA_ID);
    expect(f.entries).toHaveLength(1);
    expect(f.entries[0]).toEqual(entry());
  });
  it("예외가 없는 파일(entries: [])", () => { expect(okFile(file([])).entries).toEqual([]); });
  it("UTF-8 BOM이 앞에 붙어도 읽는다(메모장·엑셀이 붙인다)", () => { expect(okFile(`\uFEFF${file()}`).entries).toHaveLength(1); });
  it("사유 앞뒤 공백은 잘라서 읽는다", () => { expect(okFile(file([entry({ reason: "  의도된 공개  " })])).entries[0].reason).toBe("의도된 공개"); });
  it("기간 경계: 다음 날(1일)부터 최대 일수(90일)까지", () => {
    expect(okFile(file([entry({ createdAt: "2026-10-19", until: "2026-10-20" })])).entries).toHaveLength(1);
    expect(okFile(file([entry({ createdAt: "2026-10-19", until: addDays("2026-10-19", EXCEPTION_MAX_DAYS) })])).entries).toHaveLength(1);
  });
  it("예외 1000개까지", () => {
    const many = Array.from({ length: 1000 }, (_, i) => entry({ resource: `aws|123456789012|S3Bucket|us-east-1|bucket-${i}` }));
    expect(okFile(file(many)).entries).toHaveLength(1000);
  });
  it("알려진 모든 규칙 번호를 받는다", () => {
    for (const id of RULE_IDS) expect(okFile(file([entry({ ruleId: id })])).entries[0].ruleId).toBe(id);
  });
});

describe("실패 코드 — UI가 코드마다 문구를 만든다", () => {
  it("format: JSON이 아니거나 모양이 다르다", () => {
    for (const t of ["", "   ", "not json", "{", "[]", "null", "42", '"str"', "true", '{"entries": []}', file([], { schema: "cloudcheck.exceptions/2.0" }), file([], { extra: 1 }), JSON.stringify({ schema: EXCEPTIONS_SCHEMA_ID }), JSON.stringify({ schema: EXCEPTIONS_SCHEMA_ID, entries: {} })]) {
      expect(issues(t), JSON.stringify(t).slice(0, 60)).toEqual(["format"]);
    }
  });
  it("format: 예외 항목에 모르는 키가 있거나 형식이 틀렸다", () => {
    expect(issues(file([entry({ extra: "x" })]))).toEqual(["format"]);
    expect(issues(file([entry({ resource: "" })]))).toEqual(["format"]);
    expect(issues(file([entry({ resource: "x".repeat(1025) })]))).toEqual(["format"]);
    expect(issues(file([entry({ resource: 1 })]))).toEqual(["format"]);
    expect(issues(file([null as unknown as Record<string, unknown>]))).toEqual(["format"]);
  });
  it("reason: 사유가 비었거나 공백뿐이거나 너무 길다", () => {
    for (const reason of ["", "   ", "\n\t", "가".repeat(501)]) expect(issues(file([entry({ reason })])), JSON.stringify(reason).slice(0, 20)).toEqual(["reason"]);
    expect(okFile(file([entry({ reason: "가".repeat(500) })])).entries).toHaveLength(1);
  });
  it("reason: 문자열이 아니면 형식 오류가 아니라 사유 오류로 안내한다", () => { expect(issues(file([entry({ reason: 5 })]))).toEqual(["reason"]); });
  it("until: 만료일이 없거나 날짜 모양이 아니다", () => {
    for (const until of ["2026-13-01", "2026-00-10", "2026-10-32", "2026/10/31", "내일", "", "2026-10-31T00:00:00Z", 20261031]) expect(issues(file([entry({ until })])), String(until)).toEqual(["until"]);
    const noUntil = entry(); delete noUntil.until;
    expect(issues(file([noUntil]))).toEqual(["until"]);
  });
  it("until: 만든 날(createdAt) 모양이 틀려도 같은 코드", () => { expect(issues(file([entry({ createdAt: "어제" })]))).toEqual(["until"]); });
  it("span: 만료일이 만든 날 다음 날 이후 90일 이내가 아니다", () => {
    expect(issues(file([entry({ createdAt: "2026-10-19", until: "2026-10-19" })]))).toEqual(["span"]);                               // 0일
    expect(issues(file([entry({ createdAt: "2026-10-19", until: "2026-10-18" })]))).toEqual(["span"]);                               // 거꾸로
    expect(issues(file([entry({ createdAt: "2026-10-19", until: addDays("2026-10-19", EXCEPTION_MAX_DAYS + 1) })]))).toEqual(["span"]);
    expect(issues(file([entry({ createdAt: "2026-10-19", until: "2099-12-31" })]))).toEqual(["span"]);                               // 사실상 무기한
  });
  it("rule: 모르는 규칙 번호", () => {
    for (const ruleId of ["XX-NONE-9", "", "aws-mfa-1", 7, null]) expect(issues(file([entry({ ruleId })])), String(ruleId)).toEqual(["rule"]);
  });
  it("too-many: 예외가 1000개를 넘는다", () => {
    const many = Array.from({ length: 1001 }, () => entry());
    expect(issues(file(many))).toEqual(["too-many"]);
  });
  it("too-many: 파일이 상한을 넘으면 읽지 않는다", () => { expect(issues(`{"schema":"${"x".repeat(4_000_001)}"}`)).toEqual(["too-many"]); });
  it("여러 문제가 한 파일에 있으면 코드를 정해진 순서로 모두 돌려준다(format → reason → until → span → rule → too-many)", () => {
    expect(issues(file([entry({ ruleId: "XX", reason: "" })]))).toEqual(["reason", "rule"]);
    expect(issues(file([entry({ until: "내일" }), entry({ reason: " ", ruleId: "XX" })]))).toEqual(["reason", "until", "rule"]);
    expect(issues(file([entry({ createdAt: "2026-10-19", until: "2026-10-19" }), entry({ reason: "" })]))).toEqual(["reason", "span"]);
  });
  it("중첩이 너무 깊으면 format(스택을 쓰지 않는다)", () => {
    expect(issues(`{"schema": "${EXCEPTIONS_SCHEMA_ID}", "entries": [], "x": ${"[".repeat(100)}${"]".repeat(100)}}`)).toEqual(["format"]);
  });
  it("문자열이 아닌 입력도 던지지 않는다", () => {
    for (const bad of [undefined, null, 42, {}, [], Symbol("x")] as unknown[]) {
      const r = parseExceptions(bad as string);
      expect(r.ok).toBe(false);
    }
  });
});

describe("사유의 비밀 모양 (STEP 5 CC-QA-12)", () => {
  // 가짜 비밀 모양 값은 실행 중에 조각을 이어 붙여 만든다(공개 저장소 푸시 보호: 소스 바이트에 완성된 비밀 모양을 남기지 않는다). 값은 예전 리터럴과 글자 하나까지 같다.
  const j = (...parts: readonly string[]): string => parts.join("");
  const SECRETS = { akia: "AKIA" + "ZZZZZZZZZZZZZZZZ", jwt: j("ey", "J", "hbGciOiJIUzI1NiJ9", ".", "ey", "J", "zdWIiOiIxMjM0In0", ".", "abcdefghijk"), ghp: `ghp_${"a1B2c3D4e5".repeat(4)}`, sk: "sk-proj0123456789abcdefghij" };
  it("비밀 모양이 있는 사유는 읽는 단계에서 지운 토큰으로 바뀐다(엔진은 redacted로 그린다) — 원문이 file 안에 남지 않는다", () => {
    for (const [k, v] of Object.entries(SECRETS)) {
      const f = okFile(file([entry({ reason: `vendor key ${v} kept for CDN` })]));
      expect(isRedacted(f.entries[0].reason), k).toBe(true);
      expect(JSON.stringify(f), k).not.toContain(v);
    }
  });
  it("다른 칸과 비밀이 없는 사유는 그대로", () => {
    const f = okFile(file([entry({ reason: "평범한 사유" }), entry({ reason: `key ${SECRETS.akia}`, resource: "aws|123456789012|S3Bucket|us-east-1|b" })]));
    expect(f.entries[0].reason).toBe("평범한 사유");
    expect(f.entries[1].resource).toBe("aws|123456789012|S3Bucket|us-east-1|b");
    expect(f.entries[1].ruleId).toBe(RULE);
  });
  it("같은 사유는 같은 토큰, 다른 사유는 다른 토큰", () => {
    const f = okFile(file([entry({ reason: SECRETS.akia }), entry({ reason: SECRETS.akia }), entry({ reason: SECRETS.jwt })]));
    expect(f.entries[0].reason).toBe(f.entries[1].reason);
    expect(f.entries[2].reason).not.toBe(f.entries[0].reason);
  });
  it("내보낼 때는 내부 표지(NUL이 든 토큰) 대신 안내 글을 쓰고, 비밀은 다시 나가지 않는다 · 다시 읽어도 안정", () => {
    const f = okFile(file([entry({ reason: `old key ${SECRETS.akia}` }), entry({ reason: "정상 사유" })]));
    const text = serializeExceptions(f);
    expect(text).not.toContain(SECRETS.akia);
    expect(text).not.toContain("cc-redacted");
    expect(text).not.toContain("\\u0000");
    expect(JSON.parse(text).entries[0].reason).toBe("(비밀 모양 값이 있어 지웠습니다)");
    const again = okFile(text);
    expect(again.entries.map((e) => e.reason)).toEqual(["(비밀 모양 값이 있어 지웠습니다)", "정상 사유"]);
    expect(serializeExceptions(again)).toBe(text);
  });
});

describe("안전성", () => {
  it("__proto__ 키로 객체 프로토타입을 오염시킬 수 없다", () => {
    const r = parseExceptions('{"schema":"cloudcheck.exceptions/1.0","entries":[],"__proto__":{"polluted":true}}');
    expect(r.ok).toBe(false);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(parseExceptions(file([entry({ __proto__: { polluted: 1 } })])).ok).toBe(true);   // 항목 안의 __proto__는 JSON.stringify가 쓰지 않으므로 그냥 없는 것과 같다
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
  it("오류 결과에 입력 내용이 실리지 않는다(코드 문자열뿐)", () => {
    const secret = "SECRET-RESOURCE-NAME";
    const r = parseExceptions(file([entry({ resource: secret, reason: "" })]));
    expect(r.ok).toBe(false);
    expect(JSON.stringify(r)).not.toContain(secret);
    expect(JSON.stringify(r)).toBe('{"ok":false,"issues":["reason"]}');
  });
  it("garbage를 넣어도 던지지 않는다", () => {
    const junk = ["\u0000", "{\"a\":", "\ud800", "[[[[[[", "{".repeat(5000), "-".repeat(10_000), "\u202E{}", "9".repeat(400)];
    for (const t of junk) expect(() => parseExceptions(t), t.slice(0, 10)).not.toThrow();
  });
});

describe("왕복: parseExceptions(serializeExceptions(f)) 성립", () => {
  it("항목 순서와 값이 보존된다", () => {
    const f = okFile(file([entry(), entry({ ruleId: RULE_IDS[RULE_IDS.length - 1], resource: "azure|00000000-0000-0000-0000-00000000a001|StorageAccount|koreacentral|stwebfiles01", reason: "개발용(한글 · emoji 없음 · \"따옴표\" · 줄바꿈\n포함)", until: "2026-12-31", createdAt: "2026-10-19" })]));
    const text = serializeExceptions(f);
    expect(okFile(text)).toEqual(f);
    expect(text.endsWith("\n")).toBe(true);
    expect(serializeExceptions(okFile(text))).toBe(text);        // 두 번 해도 같은 글자
  });
  it("키 순서가 고정이다(schema → entries, 항목은 ruleId → resource → reason → until → createdAt)", () => {
    const text = serializeExceptions(okFile(file()));
    expect(text.indexOf('"schema"')).toBeLessThan(text.indexOf('"entries"'));
    const order = ["ruleId", "resource", "reason", "until", "createdAt"].map((k) => text.indexOf(`"${k}"`));
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
  it("비어 있는 파일도 왕복", () => {
    const f = okFile(file([]));
    expect(okFile(serializeExceptions(f))).toEqual(f);
  });
  it("1000개 파일도 왕복", () => {
    const many = Array.from({ length: 1000 }, (_, i) => entry({ resource: `aws|123456789012|S3Bucket|us-east-1|bucket-${i}` }));
    const f = okFile(file(many));
    expect(okFile(serializeExceptions(f)).entries).toHaveLength(1000);
  });
  it("직렬화 결과에 모르는 키가 끼어들지 않는다", () => {
    const f = okFile(file());
    const withExtra = { ...f, entries: f.entries.map((e) => ({ ...e, hidden: "x" })) } as unknown as ExceptionsFile;
    expect(serializeExceptions(withExtra)).not.toContain("hidden");
  });
});
