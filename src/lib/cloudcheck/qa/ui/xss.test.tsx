// @vitest-environment jsdom
// QA IN-01 — XSS(실엔진, 전 필드) (설계서 §4-4, G6 · G-D8)
// 사용자 데이터가 들어가는 문자열 칸(사용자 · 그룹 · 역할 · 버킷 · trail · SG · 별칭 · 주체 이름 · 파일 이름 · 구독 · NSG · 규칙 · 스토리지 계정 · 컨테이너 · 진단 설정 이름 · 예외 사유)에
// <img onerror> · </script><script> · "><svg onload> · javascript: · </style><style> · {{constructor.constructor}} 페이로드를 넣는다.
// 기대: V2 · V3(전부 펼침) · V4 · V5(비교) · 인쇄 DOM에서 페이로드로 생긴 요소 0, 글자로만 보임, 모든 속성 값 · document.title에 원문 없음,
//       마스킹 사본 · 예외 내보내기에는 JSON 문자열로만 들어간다.
import { cleanup, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { maskedCopy } from "../../parse/mask";
import { parseExceptions, serializeExceptions } from "../../parse/exceptions";
import { REAL_DEPS } from "../../../../app/cloudcheck/_client/state/deps.real";
import { h1, mount, uploadFiles } from "../../../../app/cloudcheck/_client/screens/__tests__/harness";
import { companyJson, okReport, renameBucket, renameGroup, renameRole, renameUser, ruleOf, runJson } from "../kit";
import type { Json } from "../kit";

const P = [
  "<img src=x onerror=alert(1)>",
  "</script><script>alert(1)</script>",
  '"><svg onload=alert(1)>',
  "javascript:alert(1)",
  "</style><style>*{display:none}",
  "{{constructor.constructor('alert(1)')()}}",
] as const;

function awsXss(): Json {
  const f = companyJson("aws", "C");
  renameUser(f, "dev-kim", P[0]);
  renameUser(f, "ci-runner", P[1]);
  renameUser(f, "admin-lee", P[2]);
  renameUser(f, "ex-employee", P[3]);
  renameGroup(f, "engineers", P[4]);
  renameRole(f, "vendor-access", P[5]);
  renameBucket(f, "amzn-s3-demo-acme-customer-export", P[0]);
  renameBucket(f, "amzn-s3-demo-acme-public-site", P[2]);
  renameBucket(f, "amzn-s3-demo-acme-logs", P[3]);
  const t = f.data.trails.value[0];
  for (const r of f.receipts as Json[]) if (r.resource === t.trailArn) r.resource = t.trailArn.replace("main-trail", "x");
  t.trailArn = t.trailArn.replace("main-trail", "x");
  t.name = P[1];
  for (const p of f.data.securityGroups as Json[]) for (const [i, s] of (p.items ?? []).entries()) s.groupName = P[(i + 4) % P.length];
  f.identity.alias.value = P[2];
  f.identity.principalName = P[5];
  return f;
}
function azureXss(): Json {
  const f = companyJson("azure", "C");
  (f.scope.subscriptions.value as Json[])[0].name = P[1];
  (f.scope.subscriptions.value as Json[])[1].name = P[5];
  const nsgs = (f.data.nsgs as Json[]).flatMap((p) => p.items ?? []);
  nsgs.forEach((n: Json, i: number) => { n.name = P[i % 3 === 0 ? 0 : i % 3 === 1 ? 2 : 4]; for (const r of n.rules) r.name = P[3]; });
  const accts = (f.data.storageAccounts as Json[]).flatMap((p) => p.items ?? []);
  accts.forEach((a: Json, i: number) => {
    a.name = i === 0 ? P[2] : P[3];          // 3~24자 상한 안
    for (const c of a.containers?.value ?? []) c.name = P[4];
    for (const d of a.blobDiagnostics?.value ?? []) d.name = P[5];
  });
  return f;
}

/** 페이로드가 만든 요소·속성 */
const injected = (): string[] => {
  const bad = [...document.querySelectorAll("img, iframe, frame, object, embed, script, style, link, svg[onload], [onerror], [onload], [onclick]")].map((e) => e.outerHTML.slice(0, 60));
  const hrefs = [...document.querySelectorAll("[href], [src], [action], [formaction]")].map((e) => e.getAttribute("href") ?? e.getAttribute("src") ?? "").filter((v) => /^\s*javascript:/i.test(v));
  return [...bad, ...hrefs];
};
/** 모든 속성 값 · document.title에 페이로드 원문(일부)이 있는가 */
const attrLeaks = (): string[] => {
  const all = [document.title, ...[...document.querySelectorAll("*")].flatMap((el) => [...el.attributes].map((a) => a.value))];
  return P.filter((p) => all.some((v) => v.includes(p) || v.includes(p.slice(0, 12))));
};
const shown = (): number => P.filter((p) => (document.body.textContent ?? "").includes(p)).length;

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const CLOCK = { now: () => "2026-10-19T05:00:00Z" as never, today: () => "2026-10-19" as never };

describe("IN-01 엔진 쪽: 페이로드가 든 입력도 정상 판정, 마스킹 사본 · 예외 내보내기에는 JSON 문자열로만", () => {
  it("AWS · Azure 판정이 원본과 같은 상태이고, 마스킹 사본은 올바른 JSON(이름 가명화)", () => {
    for (const [f, base] of [[awsXss(), companyJson("aws", "C")], [azureXss(), companyJson("azure", "C")]] as const) {
      const run = runJson(f);
      if (run.kind !== "ok") throw new Error(run.kind);
      const st = (r: ReturnType<typeof okReport>) => r.doors.flatMap((d) => d.rules.map((x) => `${x.ruleId}:${x.status}`)).join(",");
      expect(st(run.report)).toBe(st(okReport(runJson(base))));
      const m = maskedCopy(run.input);
      expect(() => JSON.parse(m)).not.toThrow();
      expect(P.filter((p) => m.includes(p))).toEqual([]);
    }
  });
  it("예외 내보내기: 실제 이름(페이로드)이 MatchKey에 JSON 문자열로 들어가고 다시 읽힌다", () => {
    const r = okReport(runJson(awsXss()));
    const item = ruleOf(r, "AWS-STO-2").items[0];
    const text = serializeExceptions({ schema: "cloudcheck.exceptions/1.0", entries: [{ ruleId: "AWS-STO-2", resource: item.resource.key, reason: P[0], until: "2026-11-01", createdAt: "2026-10-19" }] });
    const parsed = parseExceptions(text);
    expect(parsed.ok && parsed.file.entries[0].reason).toBe(P[0]);
    expect(text).toContain(JSON.stringify(P[0]).slice(1, -1));
  });
});

async function toReport(h: ReturnType<typeof mount>, file: File): Promise<void> {
  await h.user.click(screen.getByRole("button", { name: "결과 파일이 이미 있어요" }));
  await uploadFiles(h, [file]);
  await waitFor(() => expect(screen.getAllByRole("table")[0]).toBeInTheDocument());
  expect(injected()).toEqual([]);
  expect(attrLeaks()).toEqual([]);
  await h.user.click(screen.getByRole("button", { name: "이 계정으로 리포트 보기" }));
  await waitFor(() => expect(h1().textContent).toBe("리포트"));
}

describe("IN-01 화면(실엔진): 요소 0 · 글자로만 · 속성·제목 0", () => {
  it("AWS: V2(파일 이름 페이로드) → V3 전부 펼침 → V4 → V5(비교) → V7", async () => {
    window.history.replaceState(null, "");
    window.print = vi.fn();
    const h = mount({ deps: REAL_DEPS, clock: CLOCK });
    await toReport(h, new File([JSON.stringify(awsXss())], `${P[0]}.json`, { type: "application/json" }));
    for (const btn of [...document.querySelectorAll<HTMLElement>(".cc-rule__tog")]) await h.user.click(btn);
    expect(injected()).toEqual([]);
    expect(attrLeaks()).toEqual([]);
    expect(shown()).toBeGreaterThanOrEqual(5);          // 글자로는 보인다(지워지지 않음)
    // V4
    await h.user.click(document.getElementById("cc-rule-AWS-MFA-2-fix") as HTMLElement);
    await waitFor(() => expect(h1().textContent).toBe("고치는 법"));
    expect(injected()).toEqual([]);
    expect(attrLeaks()).toEqual([]);
    await h.user.click(screen.getByRole("button", { name: "← 리포트로" }));
    await waitFor(() => expect(h1().textContent).toBe("리포트"));
    // V5 비교: 같은 계정의 다음 수집(시각만 다름)
    await h.user.click(screen.getByRole("button", { name: "다시 수집한 파일과 비교" }));
    const after = awsXss();
    after.collectedAt = "2026-10-26T03:15:00Z"; after.run.finishedAt = "2026-10-26T03:15:00Z";
    await uploadFiles(h, [new File([JSON.stringify(after)], `${P[2]}.json`, { type: "application/json" })]);
    await waitFor(() => expect(screen.getAllByRole("table")[0]).toBeInTheDocument());
    await h.user.click(screen.getByRole("button", { name: "비교 보기" }));
    await waitFor(() => expect(h1().textContent).toBe("재점검 비교"));
    expect(injected()).toEqual([]);
    expect(attrLeaks()).toEqual([]);
    // V7
    await h.user.click(screen.getByRole("button", { name: "판정 규칙" }));
    await waitFor(() => expect(h1().textContent).toBe("판정 규칙"));
    expect(injected()).toEqual([]);
  });
  it("Azure: V2 → V3 전부 펼침 · 인쇄 클래스(cc-print-unmask 포함)에서도 요소 0", async () => {
    window.history.replaceState(null, "");
    window.print = vi.fn();
    // Azure 실제 점검은 운영 기본값에서 '준비 중'(결정 §8-A) — 실제 Azure 리포트를 그리는 이 시험은 공개 상태를 주입한다
    const h = mount({ deps: REAL_DEPS, clock: CLOCK, availability: { aws: "beta", azure: "beta" } });
    await toReport(h, new File([JSON.stringify(azureXss())], "cloudcheck-azure-0001-20261019T031500Z.json", { type: "application/json" }));
    for (const btn of [...document.querySelectorAll<HTMLElement>(".cc-rule__tog")]) await h.user.click(btn);
    document.documentElement.classList.add("cc-print-unmask");
    expect(injected()).toEqual([]);
    expect(attrLeaks()).toEqual([]);
    expect(shown()).toBeGreaterThanOrEqual(4);
  });
  it("예외 사유 페이로드: 예외 파일을 불러와도 사유는 글자로만 보인다", async () => {
    window.history.replaceState(null, "");
    window.print = vi.fn();
    const r = okReport(runJson(awsXss()));
    const key = ruleOf(r, "AWS-STO-2").items[0].resource.key;
    const h = mount({ deps: REAL_DEPS, clock: CLOCK });
    await toReport(h, new File([JSON.stringify(awsXss())], "cloudcheck-aws-3333-20261019T031500Z.json", { type: "application/json" }));
    await h.user.click(screen.getByRole("button", { name: "예외 파일 불러오기" }));
    const inputs = [...document.querySelectorAll<HTMLInputElement>('input[type="file"]')];
    const exc = serializeExceptions({ schema: "cloudcheck.exceptions/1.0", entries: [{ ruleId: "AWS-STO-2", resource: key, reason: `${P[0]} ${P[2]}`, until: "2026-11-01", createdAt: "2026-10-19" }] });
    await h.user.upload(inputs[inputs.length - 1], new File([exc], "cloudcheck-exceptions.json", { type: "application/json" }));
    await waitFor(() => expect(document.body.textContent).toMatch(/예외 1건 적용/));
    for (const btn of [...document.querySelectorAll<HTMLElement>(".cc-rule__tog")]) await h.user.click(btn);
    expect(injected()).toEqual([]);
    expect(attrLeaks()).toEqual([]);
  });
});
