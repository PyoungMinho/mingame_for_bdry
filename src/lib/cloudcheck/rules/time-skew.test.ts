// 기준 시각이 증거보다 이른 경우(CC-QA-01) — 나이 계산의 허용치, 입력 안 다른 행의 시각 역전, 오래됐다는 결론(주의)의 유지
// 기대값은 룰 명세(키 90일 · 미사용 45일 · 유예 7일)와 허용치 규칙(CSV 칸 5분 · 보고서 기준의 실시간 호출 4시간 5분)에서 먼저 썼다.
// 다른 행의 시각이 단서인 사례는 micro 목록(MICRO)에 넣지 않는다: 그 행을 지우는 변이(INV-3 전수)는 단서도 함께 없애기 때문에, 단서가 사라지면 기준 시각이 틀렸다는 것을 알 수 없다.
import { describe, expect, it } from "vitest";
import type { AsOfFact, Instant, Src } from "../contract/normalized";
import { judge } from "../engine/judge";
import { GOOD_ROOT, aliceOk, iamWorld } from "../fixtures/micro/aws-iam";
import { key1, key2 } from "../fixtures/micro/aws-iam-cases";
import { azKey1 } from "../fixtures/micro/azure-cases";
import { inst, withLatestEvidence } from "../fixtures/micro/kit";
import { renderMsg } from "../fixtures/render";
import type { RuleId } from "../model/report";
import { ageMs, inputEvidence, reversedIn, uniqFacts } from "./kit";
import { fact, N } from "./kit";

const asOfAt = (iso: string, source: AsOfFact["source"]): AsOfFact => ({ at: inst(iso), source });
const csvSrc = { input: 0, receipt: null, csv: { kind: "csv-credential-report", row: 3, column: "access_key_1_last_used_date" } } as unknown as Src;
const liveSrc = { input: 0, receipt: "0:r-0001", csv: null } as unknown as Src;
const HOUR = 3_600_000;

describe("ageMs — 증거가 기준 시각보다 늦은 정도의 허용치", () => {
  const T0 = "2026-10-19T02:00:00Z";
  it("정상: 이전 증거의 나이를 ms로 돌려준다", () => {
    expect(ageMs(asOfAt(T0, "credential-report"), inst("2026-10-18T02:00:00Z"), csvSrc)).toBe(24 * HOUR);
    expect(ageMs(asOfAt(T0, "credential-report"), inst(T0), liveSrc)).toBe(0);
  });
  it("CSV 칸 · 수집 시각 기준 · 파일 시각 기준은 5분까지 늦은 것을 시계 차이로 보고 나이 0으로 읽는다", () => {
    for (const source of ["credential-report", "collected-at", "file-time", "filename"] as const) {
      expect(ageMs(asOfAt(T0, source), inst("2026-10-19T02:05:00Z"), csvSrc), source).toBe(0);
      expect(ageMs(asOfAt(T0, source), inst("2026-10-19T02:05:01Z"), csvSrc), source).toBeNull();
    }
  });
  it("보고서 생성 시각 기준에서 실시간 호출(CSV 칸이 아닌 것)은 보고서 캐시(4시간 5분)까지 늦을 수 있다", () => {
    const asOf = asOfAt(T0, "credential-report");
    expect(ageMs(asOf, inst("2026-10-19T06:05:00Z"), liveSrc)).toBe(0);
    expect(ageMs(asOf, inst("2026-10-19T06:05:01Z"), liveSrc)).toBeNull();
    // 같은 시각이라도 CSV 칸이면 5분 허용치다
    expect(ageMs(asOf, inst("2026-10-19T03:00:00Z"), csvSrc)).toBeNull();
  });
  it("수집 시각(collected-at) 기준은 실시간 호출이어도 5분이다(사용자 PC 시계가 기준)", () => {
    const asOf = asOfAt(T0, "collected-at");
    expect(ageMs(asOf, inst("2026-10-19T02:05:00Z"), liveSrc)).toBe(0);
    expect(ageMs(asOf, inst("2026-10-19T02:06:00Z"), liveSrc)).toBeNull();
  });
  it("출처를 모르면(src 생략) 5분 허용치다", () => {
    expect(ageMs(asOfAt(T0, "credential-report"), inst("2026-10-19T02:04:00Z"))).toBe(0);
    expect(ageMs(asOfAt(T0, "credential-report"), inst("2026-10-19T02:30:00Z"))).toBeNull();
  });
});

describe("reversedIn — 시각 칸 중 기준 시각을 넘어선 가장 늦은 시각", () => {
  const asOf = asOfAt("2026-10-19T02:00:00Z", "credential-report");
  const at = (iso: string, src: Src | null = csvSrc): { t: Instant; src: Src | null } => ({ t: inst(iso), src });
  it("넘어선 시각이 없으면 null, 기준 시각이 없으면 null", () => {
    expect(reversedIn(asOf, [at("2026-10-01T00:00:00Z"), at("2026-10-19T02:03:00Z")])).toBeNull();
    expect(reversedIn(null, [at("2030-01-01T00:00:00Z")])).toBeNull();
    expect(reversedIn(asOf, [])).toBeNull();
  });
  it("넘어선 시각이 여럿이면 가장 늦은 것을 돌려준다", () => {
    expect(reversedIn(asOf, [at("2026-10-19T03:00:00Z"), at("2026-10-19T05:00:00Z"), at("2026-10-19T04:00:00Z")])?.iso).toBe("2026-10-19T05:00:00Z");
  });
  it("실시간 시각은 4시간 5분까지 넘어서도 역전이 아니다", () => {
    expect(reversedIn(asOf, [at("2026-10-19T06:00:00Z", liveSrc)])).toBeNull();
    expect(reversedIn(asOf, [at("2026-10-19T06:10:00Z", liveSrc)])?.iso).toBe("2026-10-19T06:10:00Z");
  });
});

/* ───────── 입력 안 다른 행의 시각 역전 ───────── */
const itemsOf = (input: Parameters<typeof judge>[0], id: RuleId) => judge(input).doors.flatMap((d) => d.rules).find((r) => r.ruleId === id)!;

describe("다른 사용자 행의 시각 역전도 모든 키의 '최근' 결론을 막는다", () => {
  it("AWS-KEY-1: 한 행의 마지막 사용이 기준 시각보다 늦으면 다른 사용자의 79일 된 키도 이상 없음이 아니라 확인 불가다", () => {
    const r = itemsOf(key1.clockSkewOtherRow(), "AWS-KEY-1");
    expect(r.items.map((i) => [i.status, i.why.code]).sort()).toEqual([["unknown", "stale-evidence"], ["unknown", "stale-evidence"]]);
    expect(r.status).toBe("unknown");
  });
  it("AWS-KEY-1: 시각 역전이 있어도 90일이 넘은 키의 주의는 그대로 남는다(양성 유지)", () => {
    const r = itemsOf(key1.oldKeyWithSkew(), "AWS-KEY-1");
    expect(r.items.map((i) => [i.status, i.why.code]).sort()).toEqual([["caution", "AWS-KEY-1:key-too-old"], ["unknown", "stale-evidence"]]);
    expect(r.status).toBe("caution");
  });
  it("AWS-KEY-2: 한 행의 시각 역전이 다른 사용자의 '45일 안에 사용'도 막는다", () => {
    const r = itemsOf(key2.usedAfterReportOtherRow(), "AWS-KEY-2");
    expect(r.items.map((i) => [i.status, i.why.code]).sort()).toEqual([["unknown", "stale-evidence"], ["unknown", "stale-evidence"]]);
  });
  it("AWS-KEY-2: 오래 안 쓴 키의 주의는 시각 역전과 무관하게 남는다", () => {
    const r = itemsOf(key2.unusedKeyWithSkew(), "AWS-KEY-2");
    expect(r.items.map((i) => [i.status, i.why.code]).sort()).toEqual([["caution", "AWS-KEY-2:credential-unused"], ["unknown", "stale-evidence"]]);
    expect(r.status).toBe("caution");
  });
  it("시각 역전으로 확인 불가가 된 대상에는 어느 시각이 어느 시각보다 늦은지가 사실로 붙는다", () => {
    const r = itemsOf(key1.clockSkewCsv(), "AWS-KEY-1");
    const fact = r.items[0].facts.find((f) => f.code === "fact:evidence-later-than-as-of");
    expect(fact).toBeDefined();
    expect(renderMsg(fact!)).toBe("기준 시각(2026-10-19T02:00:00Z)보다 늦은 기록: 2026-10-19");
  });
});

/* ───────── parse가 알려 준 입력 안 가장 늦은 증거 시각(InputFacts.latestEvidence) ───────── */
describe("입력 안 가장 늦은 증거 시각(latestEvidence)도 시각 역전의 증거다", () => {
  it("inputEvidence — 값이 있으면 한 건, 없거나 null이면 빈 목록(출처는 CSV 칸과 같은 5분 허용치를 쓰도록 null)", () => {
    const base = key1.pass();
    expect(inputEvidence({ input: base, inputIndex: 0 })).toEqual([]);
    const withNull = { ...base, inputs: base.inputs.map((f) => ({ ...f, latestEvidence: null })) };
    expect(inputEvidence({ input: withNull, inputIndex: 0 })).toEqual([]);
    const some = withLatestEvidence(base, "2026-10-19T03:30:00Z");
    const got = inputEvidence({ input: some, inputIndex: 0 });
    expect(got.map((x) => x.t.iso)).toEqual(["2026-10-19T03:30:00Z"]);
    expect(got.every((x) => x.src === null)).toBe(true);
    expect(inputEvidence({ input: some, inputIndex: 9 })).toEqual([]);
  });
  it("AWS-KEY-1: 룰이 읽는 칸에 역전이 없어도 입력의 가장 늦은 증거 시각이 기준 시각보다 늦으면 확인 불가이고 어느 시각인지 사실로 남는다", () => {
    const r = itemsOf(key1.latestEvidenceLater(), "AWS-KEY-1");
    expect(r.items.map((i) => [i.status, i.why.code])).toEqual([["unknown", "stale-evidence"]]);
    const fact = r.items[0].facts.find((f) => f.code === "fact:evidence-later-than-as-of");
    expect(fact && renderMsg(fact)).toBe("기준 시각(2026-10-19T02:00:00Z)보다 늦은 기록: 2026-10-19");
  });
  it("AWS-KEY-1 · KEY-2: 허용치(5분) 안이면 시계 차이로 보고 영향이 없다", () => {
    const r = itemsOf(key1.latestEvidenceWithinTolerance(), "AWS-KEY-1");
    expect(r.items.map((i) => [i.status, i.why.code])).toEqual([["clear", "AWS-KEY-1:key-recent"]]);
    const k2 = itemsOf(withLatestEvidence(key2.pass(), "2026-10-19T02:58:00Z"), "AWS-KEY-2");
    expect(k2.items.every((i) => i.status !== "unknown")).toBe(true);
  });
  it("AWS-KEY-2: 룰이 읽는 칸에 역전이 없어도 입력의 가장 늦은 증거 시각이 기준 시각보다 늦으면 '최근에 썼다'를 확정하지 못한다", () => {
    const r = itemsOf(key2.latestEvidenceLater(), "AWS-KEY-2");
    expect(r.items.map((i) => [i.status, i.why.code])).toEqual([["unknown", "stale-evidence"]]);
  });
  it("AWS-KEY-2: 오래 안 쓴 키의 주의는 입력의 늦은 증거 시각과 무관하게 남는다(양성 유지)", () => {
    const r = itemsOf(withLatestEvidence(key2.unusedKey(), "2026-10-19T05:30:00Z"), "AWS-KEY-2");
    expect(r.items.map((i) => [i.status, i.why.code])).toContainEqual(["caution", "AWS-KEY-2:credential-unused"]);
    expect(r.status).toBe("caution");
  });
  it("AZ-KEY-1: 입력의 가장 늦은 증거 시각이 수집 시각보다 늦으면 90일 안 회전도 확정하지 못한다", () => {
    const r = itemsOf(azKey1.latestEvidenceLater(), "AZ-KEY-1");
    expect(r.items.map((i) => [i.status, i.why.code])).toEqual([["unknown", "stale-evidence"]]);
    const ok = itemsOf(withLatestEvidence(azKey1.pass(), "2026-10-19T03:03:00Z"), "AZ-KEY-1");
    expect(ok.items.every((i) => i.status === "clear")).toBe(true);
  });
  it("AZ-KEY-1: 오래된 키의 주의는 입력의 늦은 증거 시각과 무관하게 남는다(양성 유지)", () => {
    const r = itemsOf(withLatestEvidence(azKey1.oldKey(), "2026-10-19T05:30:00Z"), "AZ-KEY-1");
    expect(r.items.map((i) => [i.status, i.why.code])).toContainEqual(["caution", "AZ-KEY-1:key-not-rotated"]);
  });
});

describe("같은 원인의 사실은 한 번만 보인다", () => {
  it("uniqFacts — 코드와 값이 같은 사실만 합치고 순서는 지킨다", () => {
    const a = fact("key-age-days", { n: N(3) });
    const b = fact("key-age-days", { n: N(4) });
    expect(uniqFacts([a, b, fact("key-age-days", { n: N(3) }), b])).toEqual([a, b]);
    expect(uniqFacts([])).toEqual([]);
  });
  it("AWS-KEY-2: 콘솔 로그인(실시간 값, 캐시 4시간 5분을 넘음)과 키 사용(CSV 칸)이 모두 기준 시각보다 늦은 같은 날짜여도 시각 역전 사실은 한 줄이다", () => {
    const input = iamWorld({
      root: GOOD_ROOT, reportAt: "2026-10-19T02:00:00Z",
      users: [{ ...aliceOk, passwordLastUsed: "2026-10-19T08:00:00Z", keys: [{ suffix: "7QXZ", createdAt: "2026-08-01T00:00:00Z", lastUsed: "2026-10-19T03:30:00Z", reportOnly: true }] }],
    }).build();
    const r = itemsOf(input, "AWS-KEY-2");
    expect(r.items.map((i) => [i.status, i.why.code])).toEqual([["unknown", "stale-evidence"]]);
    expect(r.items[0].facts.filter((f) => f.code === "fact:evidence-later-than-as-of")).toHaveLength(1);
  });
});
