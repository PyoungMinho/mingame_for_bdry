// 정답지 비교기(diffAnswer)가 빈틈없이 차이를 잡는지 확인한다 — 비교기가 헐거우면 e2e의 통과가 아무것도 보증하지 않는다.
import { describe, expect, it } from "vitest";
import { judge } from "../engine/judge";
import { resolveFixture } from "./micro";
import { diffAnswer, summarizeReport } from "./answers";
import type { AnswerFile } from "./answers";

const report = judge(resolveFixture("micro/AWS-KEY-2/unused-key"));
const actual = summarizeReport(report);

/** 사람이 쓴 것처럼 해당 픽스처의 정답지를 직접 적는다(AWS-KEY-2만 본다: 나머지 룰은 수집하지 않은 문이라 모두 not-collected) */
const key2 = actual.rules["AWS-KEY-2"];
const base: AnswerFile = {
  schema: "cloudcheck.answers/1", set: "B", cloud: "aws", company: "시험", authoredFrom: "시험용 손수 작성(사람이 먼저)",
  rules: Object.fromEntries(Object.entries(actual.rules).map(([id, r]) => [id, { ...r, items: r.items.map((i) => [i[0], i[1], i[2], [...(i[3] ?? [])]]) }])) as unknown as AnswerFile["rules"],
  distribution: actual.distribution, firstLook: actual.firstLook, banners: actual.banners, unlockHints: actual.unlockHints, manual: actual.manual, scope: actual.scope,
  doors: actual.doors as unknown as AnswerFile["doors"],
};
const clone = (): { -readonly [K in keyof AnswerFile]: AnswerFile[K] } & { rules: Record<string, any> } => JSON.parse(JSON.stringify(base)); // eslint-disable-line @typescript-eslint/no-explicit-any

describe("summarizeReport", () => {
  it("룰 · 대상 · 분포 · 먼저 볼 것 · 알림 · 직접 볼 목록 · 범위를 정답지 모양으로 줄여 낸다", () => {
    expect(key2.status).toBe("caution");
    expect(key2.items.map((i) => [i[0], i[1], i[2]]).sort()).toEqual([["caution", "alice", "credential-unused"], ["clear", "build-bot", "credentials-used"]]);
    expect(actual.firstLook.mode).toBe("findings");
    expect(actual.banners).toBeInstanceOf(Array);
    expect(Object.keys(actual.rules)).toHaveLength(10);
  });
  it("정답지를 만드는 함수가 아니다: 이 모듈은 Report → 정답지 변환을 내보내지 않는다", async () => {
    const mod = await import("./answers");
    expect(Object.keys(mod).sort()).toEqual(["diffAnswer", "summarizeReport"]);
  });
});

describe("diffAnswer", () => {
  it("같으면 차이가 없다", () => {
    expect(diffAnswer(base, actual)).toEqual({ diffs: [], tolerated: [] });
  });
  it("룰 상태가 다르면 잡는다", () => {
    const a = clone();
    a.rules["AWS-KEY-2"].status = "clear";
    expect(diffAnswer(a, actual).diffs.map((d) => d.path)).toContain("rules.AWS-KEY-2.status");
  });
  it("대상 상태 · 이름 · 사유가 하나만 달라도 잡고, 대상 순서는 따지지 않는다", () => {
    for (const edit of [(a: ReturnType<typeof clone>) => { a.rules["AWS-KEY-2"].items[0][0] = "clear"; }, (a: ReturnType<typeof clone>) => { a.rules["AWS-KEY-2"].items[0][1] = "mallory"; }, (a: ReturnType<typeof clone>) => { a.rules["AWS-KEY-2"].items[0][2] = "x"; }]) {
      const a = clone();
      edit(a);
      expect(diffAnswer(a, actual).diffs.map((d) => d.path)).toContain("rules.AWS-KEY-2.items");
    }
    const shuffled = clone();
    shuffled.rules["AWS-KEY-2"].items.reverse();
    expect(diffAnswer(shuffled, actual).diffs).toEqual([]);
    const fewer = clone();
    fewer.rules["AWS-KEY-2"].items.pop();
    expect(diffAnswer(fewer, actual).diffs.map((d) => d.path)).toContain("rules.AWS-KEY-2.items");
  });
  it("라벨 · 사유 목록(gaps) · 해소법 · 근거(basis)의 차이도 잡는다", () => {
    const a = clone();
    a.rules["AWS-KEY-2"].items[0][3] = ["legacy-hint:created-before-2023-04"];
    a.rules["AWS-MFA-1"].gaps = ["denied"];
    a.rules["AWS-MFA-1"].resolution = "rerun";
    a.rules["AWS-MFA-1"].basis = "AWS-MFA-1:x";
    const paths = diffAnswer(a, actual).diffs.map((d) => d.path);
    expect(paths).toEqual(expect.arrayContaining(["rules.AWS-KEY-2.items", "rules.AWS-MFA-1.gaps", "rules.AWS-MFA-1.resolution", "rules.AWS-MFA-1.basis"]));
  });
  it("분포 · 먼저 볼 것 · 알림 · 직접 볼 목록 · 범위의 차이를 잡는다", () => {
    const a = clone();
    a.distribution = { ...a.distribution, rules: { ...a.distribution.rules, clear: 99 } };
    a.firstLook = { mode: "none-found" };
    a.banners = ["secrets-detected"];
    a.manual = ["unknown-rule:AWS-NET-1"];
    a.scope = { ...a.scope, missing: 7 };
    expect(diffAnswer(a, actual).diffs.map((d) => d.path)).toEqual(expect.arrayContaining(["distribution", "firstLook", "banners", "manual", "scope"]));
  });
  it("문별 수집 현황(상태 · 판정 수준)이 다르면 잡는다", () => {
    const a = clone();
    expect(Object.keys(a.doors)).toEqual(["mfa", "key", "net", "sto", "log"]);
    a.doors = { ...a.doors, log: ["collected", "full"] };
    const d = diffAnswer(a, actual).diffs.find((x) => x.path === "doors");
    expect(d).toBeDefined();
    const b = clone();
    b.doors = { ...b.doors, mfa: [b.doors.mfa[0], "findings-only"] };
    expect(diffAnswer(b, actual).diffs.map((x) => x.path)).toContain("doors");
  });
  it("룰이 한쪽에만 있으면 잡는다", () => {
    const a = clone();
    delete a.rules["AWS-LOG-1"];
    expect(diffAnswer(a, actual).diffs.map((d) => d.path)).toContain("rules.AWS-LOG-1");
  });
  it("권한 힌트는 권한 이름별로 맞댄다: 빠졌거나 값이 다르면 잡는다", () => {
    const a = clone();
    a.unlockHints = [{ permission: "iam:ListUsers", unlocks: [["AWS-KEY-1", 1]] }];
    expect(diffAnswer(a, actual).diffs.map((d) => d.path)).toContain("unlockHints.iam:ListUsers");
  });
  it("알려진 차이(tolerate)는 허용한 실제 값일 때만 걸러지고, 다른 값이면 여전히 차이다", () => {
    const a = clone();
    a.unlockHints = [{ permission: "iam:ListUsers", unlocks: [["AWS-KEY-1", 1]] }];
    a.tolerate = { "unlockHints.iam:ListUsers": { accept: ["absent"], why: "알려진 파서 차이를 설명하는 충분히 긴 사유 문장", owner: "API설계자" } };
    const ok = diffAnswer(a, actual);
    expect(ok.diffs).toEqual([]);
    expect(ok.tolerated.map((d) => d.path)).toEqual(["unlockHints.iam:ListUsers"]);
    a.tolerate = { "unlockHints.iam:ListUsers": { accept: ["다른 값"], why: "알려진 파서 차이를 설명하는 충분히 긴 사유 문장", owner: "API설계자" } };
    expect(diffAnswer(a, actual).diffs.map((d) => d.path)).toContain("unlockHints.iam:ListUsers");
  });
});
