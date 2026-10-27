// 경계값 — 기준일 '초과'를 어떻게 읽는지, 정확히 기준일일 때와 1초 지났을 때가 갈리는 곳을 고정한다.
// 읽는 규칙: 기준 시각(수집 시각 또는 보고서 생성 시각)과 비교해 "N일을 넘었다" = 경과 시간이 N×24시간보다 엄격히 크다.
//  - 정확히 N일이면 아직 넘지 않았다(키 나이 · 미사용 · 공유 키 회전은 이상 없음, 루트 최근 로그인은 아직 '최근'이라 주의).
import { describe, expect, it } from "vitest";
import { judge } from "../engine/judge";
import { azWorld, SUB } from "../fixtures/micro/azure-world";
import { GOOD_ROOT, iamWorld } from "../fixtures/micro/aws-iam";
import type { KeySpec, UserSpec } from "../fixtures/micro/aws-iam";
import type { Report, RuleResult } from "../model/report";

const DAY = 86_400_000;
const stamp = (ms: number): string => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
/** 자격증명 보고서 생성 시각(micro 기본값): 보고서 기반 룰의 기준 시각 */
const REPORT = Date.UTC(2026, 9, 19, 2, 58, 30);
/** 수집 시각(문의 기준 시각) */
const COLLECTED = Date.UTC(2026, 9, 19, 3, 0, 0);
const ruleOf = (r: Report, id: string): RuleResult => r.doors.flatMap((d) => d.rules).find((x) => x.ruleId === id) as RuleResult;
const status = (r: Report, id: string): string => ruleOf(r, id).status;

const keyUser = (key: Partial<KeySpec> & { createdAt: string }, o: Partial<UserSpec> = {}): UserSpec => ({
  name: "frank", password: false, mfa: false, keys: [{ suffix: "F1F1", lastUsed: stamp(REPORT - DAY), ...key }], ...o,
});

describe("AWS-KEY-1 키 나이 90일", () => {
  const run = (ageMs: number): string => status(judge(iamWorld({ root: GOOD_ROOT, users: [keyUser({ createdAt: stamp(REPORT - ageMs) })] }).build()), "AWS-KEY-1");
  it("정확히 90일은 아직 넘지 않았다 → 이상 없음", () => expect(run(90 * DAY)).toBe("clear"));
  it("90일 + 1초 → 주의", () => expect(run(90 * DAY + 1000)).toBe("caution"));
  it("89일 23시간 59분 59초 → 이상 없음", () => expect(run(90 * DAY - 1000)).toBe("clear"));
});

describe("AWS-KEY-2 미사용 45일 · 유예 7일", () => {
  const used = (agoMs: number): string => status(judge(iamWorld({ root: GOOD_ROOT, users: [keyUser({ createdAt: stamp(REPORT - 200 * DAY), lastUsed: stamp(REPORT - agoMs) })] }).build()), "AWS-KEY-2");
  it("마지막 사용이 정확히 45일 전이면 아직 넘지 않았다 → 이상 없음", () => expect(used(45 * DAY)).toBe("clear"));
  it("45일 + 1초 전 → 주의", () => expect(used(45 * DAY + 1000)).toBe("caution"));

  const never = (ageMs: number): string => status(judge(iamWorld({ root: GOOD_ROOT, users: [keyUser({ createdAt: stamp(REPORT - ageMs), lastUsed: null })] }).build()), "AWS-KEY-2");
  it("한 번도 안 쓴 키는 만든 지 정확히 7일이면 유예 안 → 이상 없음", () => expect(never(7 * DAY)).toBe("clear"));
  it("7일 + 1초 → 주의", () => expect(never(7 * DAY + 1000)).toBe("caution"));

  const console_ = (agoMs: number): string => status(judge(iamWorld({ root: GOOD_ROOT, users: [{ name: "gina", password: true, passwordLastUsed: stamp(REPORT - agoMs), mfa: true, keys: [] }] }).build()), "AWS-KEY-2");
  it("콘솔 마지막 로그인이 정확히 45일 전이면 이상 없음, 1초 더 지나면 주의", () => {
    expect(console_(45 * DAY)).toBe("clear");
    expect(console_(45 * DAY + 1000)).toBe("caution");
  });
});

describe("AWS-MFA-1 루트 최근 로그인 90일", () => {
  const login = (agoMs: number): string => status(judge(iamWorld({ root: { ...GOOD_ROOT, passwordLastUsed: stamp(REPORT - agoMs) }, users: [] }).build()), "AWS-MFA-1");
  it("정확히 90일 전 로그인은 아직 '최근'이다 → 주의", () => expect(login(90 * DAY)).toBe("caution"));
  it("90일 + 1초 전 → 이상 없음", () => expect(login(90 * DAY + 1000)).toBe("clear"));
});

describe("AZ-KEY-1 공유 키 회전 90일", () => {
  const rotated = (ageMs: number): string => status(judge(azWorld({ doors: ["key"], accounts: [{ name: "stedge01", allowPublic: false, sharedKey: true, key1: stamp(COLLECTED - ageMs), key2: stamp(COLLECTED - DAY) }] }).build()), "AZ-KEY-1");
  it("정확히 90일 전에 만든 키는 아직 넘지 않았다 → 이상 없음", () => expect(rotated(90 * DAY)).toBe("clear"));
  it("90일 + 1초 → 주의", () => expect(rotated(90 * DAY + 1000)).toBe("caution"));
  it("두 키 중 하나만 넘어도 주의, 둘 다 기준 안이면 이상 없음", () => {
    const r = judge(azWorld({ doors: ["key"], accounts: [{ name: "stedge01", allowPublic: false, sharedKey: true, key1: stamp(COLLECTED - DAY), key2: stamp(COLLECTED - 91 * DAY) }] }).build());
    expect(status(r, "AZ-KEY-1")).toBe("caution");
  });
  it("공유 키를 막았으면 키가 아무리 오래돼도 이상 없음", () => {
    expect(status(judge(azWorld({ doors: ["key"], accounts: [{ name: "stedge01", allowPublic: false, sharedKey: false, key1: stamp(COLLECTED - 900 * DAY), key2: null }] }).build()), "AZ-KEY-1")).toBe("clear");
  });
  it("구독 ID 상수가 micro와 같다", () => expect(SUB).toMatch(/^00000000-0000-0000-0000-/));
});
