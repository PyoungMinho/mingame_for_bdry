// src/app/cloudcheck/_client/i18n/index.test.ts — 카탈로그 린트(키 형식·파일 경계·중복·금지어·상수 일치) + 조립 함수 단위 테스트. 소유: 프론트팀장.
// 컴포넌트·페이지개발자가 문구를 채우는 동안 `npx vitest run src/app/cloudcheck/_client`로 바로 확인할 수 있게 _client 안에 둔다.
import { describe, expect, it } from "vitest";
import { LIMITS } from "../../../../lib/cloudcheck/contract/collect-schema";
import { EXCEPTION_MAX_DAYS } from "../../../../lib/cloudcheck/contract/exceptions-schema";
import { ALLOWED_KEYS, findBanned } from "../../../../lib/cloudcheck/model/banned-words";
import type { CatalogKey, DisplayValue, IsoDate, IsoUtc, UnknownReason } from "../../../../lib/cloudcheck/model/report";
import {
  catalogEntries,
  engineCatalogMerged,
  fileOfKey,
  fmtBytes,
  fmtNum,
  fmtTime,
  hasKey,
  isDisplayParam,
  isTimeParam,
  joinText,
  KEY_RE,
  keyOf,
  lookup,
  missingText,
  paramText,
  parseTemplate,
  segments,
  shortKeyOf,
  t,
  type TextParam,
  UNKNOWN_REASONS,
} from "./index";

const MiB = 1024 * 1024;
const FILES = ["components", "screens", "engine"] as const;
const all = FILES.flatMap((f) => catalogEntries(f).map(([k, v]) => ({ file: f, key: k, value: v })));

describe("카탈로그 린트(키 규칙 1·8·9 + 디자인 §8-1)", () => {
  it("키 형식: cc.<세그먼트>(.<세그먼트>)+, 소문자·숫자·하이픈", () => {
    expect(all.filter((e) => !KEY_RE.test(e.key)).map((e) => `${e.file}: ${e.key}`)).toEqual([]);
  });
  it("첫 세그먼트 ↔ 파일(C·S·E 경계)", () => {
    expect(all.filter((e) => fileOfKey(e.key) !== e.file).map((e) => `${e.file}: ${e.key} → ${String(fileOfKey(e.key))}`)).toEqual([]);
  });
  it("파일 사이 중복 키 0", () => {
    const seen = new Map<string, string>();
    const dup: string[] = [];
    for (const e of all) {
      const prev = seen.get(e.key);
      if (prev !== undefined) dup.push(`${e.key}: ${prev} · ${e.file}`);
      seen.set(e.key, e.file);
    }
    expect(dup).toEqual([]);
  });
  it("값: 빈 문자열·앞뒤 공백·CR·짝 안 맞는 중괄호 0, 파라미터 이름은 영문·숫자", () => {
    const bad: string[] = [];
    for (const e of all) {
      if (e.value.trim() === "" || e.value !== e.value.trim() || /\r/.test(e.value)) bad.push(`${e.key}: 공백·빈 값`);
      if (/[{}]/.test(e.value.replace(/\{[A-Za-z][A-Za-z0-9]*\}/g, ""))) bad.push(`${e.key}: 중괄호`);
    }
    expect(bad).toEqual([]);
  });
  it("금지어 0(findBanned 하나, 키 단위 허용은 ALLOWED_KEYS 2개뿐)", () => {
    const hits = all
      .filter((e) => ALLOWED_KEYS[e.key as CatalogKey] === undefined)
      .flatMap((e) => findBanned(e.value).map((h) => `${e.key}: ${h.label} '${h.match}'`));
    expect(hits).toEqual([]);
  });
  it("허용 키는 부정문 면책에 필요한 금지어(인증·보증·준수)만 걸린다", () => {
    for (const key of Object.keys(ALLOWED_KEYS)) {
      const v = lookup(key);
      if (v === undefined) continue; // 아직 카탈로그에 없음(cc.disclaimer.body — C, cc.about.not-certification — S)
      const labels = new Set(findBanned(v).map((h) => h.label));
      for (const l of labels) expect(["인증·보증·보장", "적합·준수"], `${key}: ${l}`).toContain(l);
    }
  });
  if (!engineCatalogMerged()) it.todo("E 카탈로그(rules/i18n/ko.ts) 병합 뒤 E 키도 같은 린트를 탄다");
});

describe("상수와 카피 숫자 일치(G-D25, 키 규칙 12)", () => {
  const cases: readonly { key: string; must: readonly string[] }[] = [
    { key: "cc.c.drop.limit", must: [`${LIMITS.jsonBytes / MiB}MB`, `${LIMITS.csvBytes / MiB}MB`] },
    { key: "cc.c.exc.until-help", must: [`${EXCEPTION_MAX_DAYS}일`] },
    { key: "cc.c.exc.err.until", must: [`${EXCEPTION_MAX_DAYS}일`] },
    { key: "cc.report.exc.issue.span", must: [`${EXCEPTION_MAX_DAYS}일`] },
    { key: "cc.input.too-many", must: ["{max}"] },
    { key: "cc.recog.too-large.reason", must: [`${LIMITS.jsonBytes / MiB}MB`, `${LIMITS.csvBytes / MiB}MB`] },
    { key: "cc.recog.too-deep.reason", must: [`${LIMITS.jsonDepth}단계`] },
  ];
  for (const c of cases) {
    if (!hasKey(c.key)) {
      it.todo(`${c.key} 대기 — 생기면 ${c.must.join("·")} 포함 여부를 검사`);
      continue;
    }
    it(`${c.key}에 ${c.must.join("·")}`, () => {
      for (const m of c.must) expect(lookup(c.key)).toContain(m);
    });
  }
});

describe("t() · segments() · 조립", () => {
  it("있는 키는 문장, 없는 키는 ⟦키⟧(조용히 지우지 않는다)", () => {
    expect(t("cc.start.title")).toBe("문단속 5");
    const missing: CatalogKey = "cc.c.does-not-exist";
    expect(t(missing)).toBe(missingText("cc.c.does-not-exist"));
    expect(segments(missing)).toEqual([{ kind: "text", text: "⟦cc.c.does-not-exist⟧" }]);
  });
  it("템플릿 파서: 글자·파라미터 조각 순서 보존, 빠진 파라미터는 {이름}", () => {
    const segs = parseTemplate<TextParam>("점검 {total}개 — 위험 {risk}", { total: 1234 });
    expect(segs).toEqual([
      { kind: "text", text: "점검 " },
      { kind: "param", name: "total", value: 1234 },
      { kind: "text", text: "개 — 위험 " },
      { kind: "param", name: "risk", value: undefined },
    ]);
    expect(joinText(segs)).toBe("점검 1,234개 — 위험 {risk}");
  });
  it("파라미터 글자: 수는 천 단위 쉼표, {t}는 KST 전체, {d}는 날짜 그대로", () => {
    const at = "2026-10-19T03:12:00Z" as IsoUtc;
    const d = "2026-11-18" as IsoDate;
    expect(joinText(parseTemplate<TextParam>("{a} · {b} · {c} · {e}", { a: 12000, b: { t: at }, c: { d }, e: "22/tcp" }))).toBe(
      "12,000 · 2026-10-19 12:12 KST (03:12 UTC) · 2026-11-18 · 22/tcp",
    );
  });
  it("DisplayValue·{v}가 억지로 들어와도 t()는 그리지 않는다(빈 문자열 — 사용자 데이터는 <T>·MaskedValue로만)", () => {
    const dv: DisplayValue = { kind: "sensitive", type: "userName", full: "alice@example.com", masked: "user-001", flags: [] };
    const smuggled = { name: dv, v: { v: dv } } as unknown as Readonly<Record<string, TextParam>>;
    const out = joinText(parseTemplate<TextParam>("대상: {name} {v}", smuggled));
    expect(out).toBe("대상:  ");
    expect(out).not.toContain("alice");
    expect(paramText({ c: "22/tcp" })).toBe("22/tcp");
    expect(paramText({ n: 7 })).toBe("7");
  });
  it("판별 도우미", () => {
    const dv: DisplayValue = { kind: "plain", text: "ap-northeast-2" };
    expect(isDisplayParam({ v: dv })).toBe(true);
    expect(isDisplayParam({ c: "x" })).toBe(false);
    expect(isTimeParam({ t: "2026-10-19T03:12:00Z" })).toBe(true);
    expect(isTimeParam({ n: 1 })).toBe(false);
  });
});

describe("keyOf(엔진 코드 → 키, 키 규칙 7·11)", () => {
  it("확인 불가 공통 사유 21종 → cc.reason.unknown.<코드>", () => {
    expect(UNKNOWN_REASONS).toHaveLength(21);
    expect(new Set(UNKNOWN_REASONS).size).toBe(21);
    for (const r of UNKNOWN_REASONS) {
      expect(keyOf(r)).toBe(`cc.reason.unknown.${r}`);
      expect(shortKeyOf(r as UnknownReason)).toBe(`cc.reason.short.${r}`);
    }
  });
  it("룰 사유·사실·INV-7·해당 없음", () => {
    expect(keyOf("AWS-MFA-2:console-no-mfa")).toBe("cc.reason.aws-mfa-2.console-no-mfa");
    expect(keyOf("AZ-STO-1:allow-blob-public-unset")).toBe("cc.reason.az-sto-1.allow-blob-public-unset");
    expect(keyOf("fact:key-suffix")).toBe("cc.fact.key-suffix");
    expect(keyOf("isolated-denial")).toBe("cc.reason.isolated-denial");
    expect(keyOf("no-targets-proven")).toBe("cc.reason.no-targets-proven");
  });
  it("만든 키는 형식에 맞고 E 네임스페이스다", () => {
    const codes = [...UNKNOWN_REASONS, "AWS-NET-1:exposed-with-public-ip", "fact:port-cidr", "isolated-denial", "no-targets-proven"] as const;
    for (const c of codes) {
      expect(KEY_RE.test(keyOf(c)), c).toBe(true);
      expect(fileOfKey(keyOf(c)), c).toBe("engine");
    }
  });
});

describe("표기(UX §6-10 — Intl 미사용, 같은 입력 = 같은 글자)", () => {
  it("fmtTime: full · short · utc, 날짜 넘김, 소수 초·+00:00, 형식 밖은 그대로", () => {
    const at = "2026-10-19T03:12:00Z" as IsoUtc;
    expect(fmtTime(at, "full")).toBe("2026-10-19 12:12 KST (03:12 UTC)");
    expect(fmtTime(at, "short")).toBe("10-19 12:12 KST");
    expect(fmtTime(at, "utc")).toBe("2026-10-19 03:12 UTC");
    expect(fmtTime("2026-12-31T20:30:59.123456789+00:00" as IsoUtc, "full")).toBe("2027-01-01 05:30 KST (20:30 UTC)");
    expect(fmtTime("2026-10-19 03:12" as IsoUtc, "full")).toBe("2026-10-19 03:12");
  });
  it("fmtTime은 실행 환경의 시간대와 무관하다", () => {
    const prev = process.env.TZ;
    process.env.TZ = "America/Los_Angeles";
    try {
      expect(fmtTime("2026-03-08T10:00:00Z" as IsoUtc, "full")).toBe("2026-03-08 19:00 KST (10:00 UTC)");
    } finally {
      if (prev === undefined) delete process.env.TZ;
      else process.env.TZ = prev;
    }
  });
  it("fmtNum · fmtBytes", () => {
    expect([0, 999, 1000, 1234567, -1234, 12.5].map(fmtNum)).toEqual(["0", "999", "1,000", "1,234,567", "-1,234", "12.5"]);
    expect(fmtBytes(1536)).toBe("1.5 KB");
    expect(fmtBytes(LIMITS.jsonBytes)).toBe("25.0 MB");
    expect(fmtBytes(0)).toBe("0.0 KB");
  });
});
