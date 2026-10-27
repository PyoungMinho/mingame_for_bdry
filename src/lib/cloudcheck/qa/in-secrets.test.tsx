// @vitest-environment jsdom
// QA IN-06 — 비밀 모양(R-12) (설계서 §4-4, CR-11)
// AKIA/ASIA 키 · PEM · JWT · Azure 스토리지 키(86자+==) · 연결 문자열 · SAS sig= · ghp_ · xoxb- · AIza · sk- 를 사용자 데이터 칸(사용자 · 버킷 · 역할 · 별칭 ·
// 구독 · NSG · 스토리지 계정 이름)과 파일 이름 · 예외 사유에 넣는다.
// 기대: 화면 · 속성 · 제목 · 인쇄 · 마스킹 사본 · 예외 내보내기 어디에도 원문 없음, secrets-detected 개수 = 서로 다른 값 수, checkReport AKIA 0.
// 확인된 버그 CC-QA-12: 예외 파일 사유의 비밀 모양은 화면 값(full)에 원문 그대로 실린다(인쇄는 •••).
import { cleanup, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { overlayExceptions } from "../engine/exceptions";
import { checkReport } from "../fixtures/report-invariants";
import type { IsoDate } from "../model/report";
import { maskedCopy } from "../parse/mask";
import { parseExceptions } from "../parse/exceptions";
import { REAL_DEPS } from "../../../app/cloudcheck/_client/state/deps.real";
import { h1, mount, uploadFiles } from "../../../app/cloudcheck/_client/screens/__tests__/harness";
import { companyJson, okReport, renameBucket, renameRole, renameUser, ruleOf, runJson } from "./kit";
import { FAKE_AZURE_ACCOUNT_KEY, FAKE_JWT_HS256, FAKE_SLACK_BOT_TOKEN, FAKE_STS_KEY_ID, pemHead, sasUrl } from "./fake-secrets";
import type { Json } from "./kit";

// 비밀 모양 값은 qa/fake-secrets.ts가 실행 중에 조립한다(공개 저장소 푸시 보호 대비). AWS 문서 예시 키(akia)만 그대로 쓴다
const AZ_KEY = FAKE_AZURE_ACCOUNT_KEY;   // 86자 + ==
const S = {
  akia: "AKIAIOSFODNN7EXAMPLE",
  asia: FAKE_STS_KEY_ID,
  pem: pemHead("RSA "),
  jwt: FAKE_JWT_HS256,
  azkey: AZ_KEY,
  conn: "DefaultEndpointsProtocol=https;AccountName=stx",
  sas: sasUrl("c?sv=2021-08-06&", "abcdefghijklmnopqrstuvwxyz0123"),
  ghp: `ghp_${"a1B2c3D4e5".repeat(4)}`,
  xoxb: FAKE_SLACK_BOT_TOKEN,
  aiza: `AIza${"Sy0123456789abcdefghijklmnopqrstuvw".slice(0, 35)}`,
  sk: `sk-${"proj0123456789abcdefghij"}`,
} as const;
const ALL = Object.values(S);
/** 파일 전체를 키 파일로 거부하게 만드는 모양(PEM 머리 · 연결 문자열) — 제자리 가림 시험에서는 빼고 따로 본다 */
const FILE_REJECTING = [S.pem, S.conn];

/** AWS C에 비밀 모양 이름을 심는다(조인 유지) */
function awsWithSecrets(): Json {
  const f = companyJson("aws", "C");
  renameUser(f, "dev-kim", S.akia);
  renameUser(f, "ci-runner", S.sas);
  renameUser(f, "admin-lee", S.ghp);
  renameUser(f, "ex-employee", S.azkey);
  renameBucket(f, "amzn-s3-demo-acme-customer-export", S.asia);
  renameBucket(f, "amzn-s3-demo-acme-public-site", S.aiza);
  renameBucket(f, "amzn-s3-demo-acme-logs", S.sk);
  renameRole(f, "vendor-access", S.jwt);
  f.identity.alias.value = S.xoxb;
  return f;
}
function azureWithSecrets(): Json {
  const f = companyJson("azure", "C");
  (f.scope.subscriptions.value as Json[])[0].name = S.jwt;
  (f.scope.subscriptions.value as Json[])[1].name = S.sk;
  return f;
}
const raw = (text: string): string[] => ALL.filter((s) => text.includes(s));

describe("IN-06 엔진 · 마스킹 사본(AWS · Azure)", () => {
  it("AWS: 리포트 · 마스킹 사본에 원문 0, 비밀 감지 배너 있음, checkReport 위반 0", () => {
    const run = runJson(awsWithSecrets(), { name: "cloudcheck-aws-3333-20261019T031500Z.json" });
    if (run.kind !== "ok") throw new Error(run.kind);
    expect(raw(JSON.stringify(run.report))).toEqual([]);
    expect(raw(maskedCopy(run.input))).toEqual([]);
    expect(run.report.banners.some((b) => b.kind === "secrets-detected")).toBe(true);
    expect(checkReport(run.report)).toEqual([]);
    expect(ruleOf(run.report, "AWS-MFA-2").items.filter((i) => i.resource.name.kind === "redacted").length).toBeGreaterThanOrEqual(2);
  });
  it("[CC-QA-19] secrets-detected 개수 = 서로 다른 비밀 값 수(9) (수정 전: 사용자 이름이 든 ARN 칸까지 따로 세어 12)", () => {
    const run = runJson(awsWithSecrets(), { name: "cloudcheck-aws-3333-20261019T031500Z.json" });
    if (run.kind !== "ok") throw new Error(run.kind);
    expect(run.report.banners.find((b) => b.kind === "secrets-detected")).toEqual({ kind: "secrets-detected", count: 9 });
  });
  it("Azure: 구독 이름의 JWT · sk- → 리포트 · 마스킹 사본에 원문 0, secrets-detected = 2(구독 이름은 다른 칸에 다시 나오지 않는다)", () => {
    const run = runJson(azureWithSecrets());
    if (run.kind !== "ok") throw new Error(run.kind);
    expect(raw(JSON.stringify(run.report))).toEqual([]);
    expect(raw(maskedCopy(run.input))).toEqual([]);
    expect(run.report.banners.find((b) => b.kind === "secrets-detected")).toEqual({ kind: "secrets-detected", count: 2 });
  });
  it("PEM 머리 · 연결 문자열이 이름 칸에 있으면 파일 전체를 키 파일(credentials-file)로 거부한다(판정 0 · 값 미표시 — 안전한 방향)", () => {
    for (const v of FILE_REJECTING) {
      const f = companyJson("aws", "C");
      renameUser(f, "ex-employee", v);
      const run = runJson(f);
      expect(run.kind === "rejected" ? run.status : run.kind, v).toBe("credentials-file");
    }
  });
  it("파일 이름 · 별칭의 비밀 모양 → 입력 인식(V2) 값이 redacted", () => {
    const f = companyJson("aws", "A");
    f.identity.alias.value = S.xoxb;
    const run = runJson(f, { name: `${S.akia}.json` });
    if (run.kind !== "ok") throw new Error(run.kind);
    expect(run.recs[0].name).toEqual({ kind: "redacted", why: "secret-pattern" });
    expect(run.recs[0].identityPreview?.alias).toEqual({ kind: "redacted", why: "secret-pattern" });
    expect(raw(JSON.stringify(run.report))).toEqual([]);
  });
});

describe("IN-06 예외 사유의 비밀 모양(E-23)", () => {
  const withReason = (reason: string) => {
    const r = okReport(runJson(companyJson("aws", "C")));
    const item = ruleOf(r, "AWS-STO-2").items[0];
    const parsed = parseExceptions(JSON.stringify({ schema: "cloudcheck.exceptions/1.0", entries: [{ ruleId: "AWS-STO-2", resource: item.resource.key, reason, until: "2026-11-01", createdAt: "2026-10-19" }] }));
    if (!parsed.ok) throw new Error("parse");
    return [...overlayExceptions(r, parsed.file, "2026-10-19" as IsoDate).byItemId.values()][0];
  };
  it("전제: 예외 라벨이 대상에 붙는다(사유가 실린다)", () => {
    expect(withReason("평범한 사유").reason).toMatchObject({ kind: "sensitive", full: "평범한 사유" });
  });
  for (const [k, v] of Object.entries(S).filter(([k]) => ["akia", "jwt", "ghp", "sk"].includes(k))) {
    it(`[CC-QA-12] 사유에 ${k} 모양이 있으면 화면 값은 redacted여야 한다(원문이 full에 실리면 안 된다)`, () => {
      expect(withReason(`vendor key ${v} kept for CDN`).reason).toEqual({ kind: "redacted", why: "secret-pattern" });
    });
  }
});

/* ───────── 실제 화면(V2 → V3 → 모든 점검 펼침 → V4): 글자 · 속성 · 제목에 원문 0 ───────── */
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const CLOCK = { now: () => "2026-10-19T05:00:00Z" as never, today: () => "2026-10-19" as never };
describe("IN-06 실제 화면(실엔진)", () => {
  it("V2 · V3(전부 펼침) · V4 어디에도 비밀 원문이 없다(글자 · 속성 · document.title)", async () => {
    window.history.replaceState(null, "");
    window.print = vi.fn();
    const h = mount({ deps: REAL_DEPS, clock: CLOCK });
    await h.user.click(screen.getByRole("button", { name: "결과 파일이 이미 있어요" }));
    await uploadFiles(h, [new File([JSON.stringify(awsWithSecrets())], `${S.asia}.json`, { type: "application/json" })]);
    await waitFor(() => expect(screen.getAllByRole("table")[0]).toBeInTheDocument());
    const everywhere = (): string => [document.body.textContent ?? "", document.title, ...Array.from(document.querySelectorAll("*")).flatMap((el) => Array.from(el.attributes).map((a) => a.value))].join("\n");
    expect(raw(everywhere())).toEqual([]);
    await h.user.click(screen.getByRole("button", { name: "이 계정으로 리포트 보기" }));
    await waitFor(() => expect(h1().textContent).toBe("리포트"));
    for (const btn of Array.from(document.querySelectorAll<HTMLElement>(".cc-rule__tog"))) await h.user.click(btn);
    expect(raw(everywhere())).toEqual([]);
    expect(document.body.textContent).toContain("비밀");          // 비밀 감지 배너가 보인다(문구 일부)
    await h.user.click(document.getElementById("cc-rule-AWS-MFA-2-fix") as HTMLElement);
    await waitFor(() => expect(h1().textContent).toBe("고치는 법"));
    expect(raw(everywhere())).toEqual([]);
  });
});
