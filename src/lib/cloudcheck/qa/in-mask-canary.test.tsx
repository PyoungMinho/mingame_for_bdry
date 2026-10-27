// @vitest-environment jsdom
// QA IN-12 — 마스킹 사본 · 인쇄 카나리아(R-13) (설계서 §4-4)
// 회사 8곳의 모든 사용자 데이터 칸(이름 · 별칭 · ARN 마지막 마디 · 구독 이름 · 리소스 그룹 · 파일 이름 · CIDR · 계정 번호 · GUID · 키 끝 4자리 · sg/eni/vpc ID)에
// 고유 토큰(cnry… · 고유 숫자 · 고유 GUID · 고유 공인 대역)을 심는다.
// 기대: ① 판정은 심기 전과 같다(토큰이 판정에 영향 없음) ② maskedCopy 출력에 토큰 0 ③ 자기 계정 = 111122223333, 외부 계정은 444455556666…(관계 유지)
//       ④ 실제 화면(V3)을 인쇄 기준으로 보면(.cc-mask-full을 뺀 DOM 글자 · 속성 · 제목) 토큰 0.
import { cleanup, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { maskedCopy } from "../parse/mask";
import { REAL_DEPS } from "../../../app/cloudcheck/_client/state/deps.real";
import { h1, mount, uploadFiles } from "../../../app/cloudcheck/_client/screens/__tests__/harness";
import { collectorName, companyJson, okReport, rulesOf, runJson, SETS } from "./kit";
import type { CloudId, Json, SetId } from "./kit";

interface Planted { readonly file: Json; readonly name: string; readonly tokens: string[]; readonly keyTokens: string[]; readonly selfToken: string; readonly externalTokens: string[] }

/** 원값 → 토큰 표를 만들어 JSON 원문 전체에 바꿔 넣는다(조인 유지). 일반 낱말(web · default 등)은 필드 단위로만 바꾼다 */
function plant(cloud: CloudId, set: SetId): Planted {
  const f = companyJson(cloud, set);
  const pairs = new Map<string, string>();
  const tokens: string[] = [];
  const keyTokens: string[] = [];
  let n = 0;
  const tok = (prefix: string): string => { n++; const t = `cnry${prefix}${set}${n}`; tokens.push(t); return t; };
  const add = (orig: unknown, make: () => string): void => { if (typeof orig === "string" && orig !== "" && !pairs.has(orig)) { const t = make(); pairs.set(orig, t); } };
  const hex = (k: number): string => `0ca4a1${set.charCodeAt(0).toString(16)}${String(k).padStart(9, "0")}`;       // 17자 16진수
  let selfToken = "";
  const externalTokens: string[] = [];
  if (cloud === "aws") {
    selfToken = `2468135790${(set.charCodeAt(0) - 55).toString().padStart(2, "0")}`;
    pairs.set(f.identity.accountId, selfToken);
    tokens.push(selfToken);
    const accts = new Set<string>(JSON.stringify(f.data).match(/\b\d{12}\b/g) ?? []);
    let e = 0;
    for (const a of accts) if (a !== f.identity.accountId) { e++; const t = `1357924680${e}${set.charCodeAt(0) - 64}`; pairs.set(a, t); tokens.push(t); externalTokens.push(t); }
    add(f.identity.alias.value, () => tok("alias"));
    add(f.identity.principalName, () => tok("p"));
    for (const u of f.data.iamUsers.items ?? []) { add(u.userName, () => tok("u")); for (const k of u.accessKeys?.value ?? []) { const t = `Q${set}${String(n++).padStart(2, "0")}`.slice(0, 4); pairs.set(k.idSuffix, t); tokens.push(t); keyTokens.push(t); } }
    for (const g of f.data.iamGroups ?? []) add(g.groupName, () => tok("g"));
    for (const r of f.data.iamRoles?.value ?? []) if (!String(r.path).startsWith("/aws-service-role/")) add(r.roleName, () => tok("r"));
    for (const b of f.data.buckets?.items ?? []) add(b.name, () => tok("b"));
    for (const t of f.data.trails?.value ?? []) add(t.name, () => tok("t"));
    let k = 0;
    for (const p of f.data.securityGroups ?? []) for (const s of p.items ?? []) {
      add(s.groupId, () => { const t = `sg-${hex(++k)}`; tokens.push(t); return t; });
      if (s.vpcId) add(s.vpcId, () => { const t = `vpc-${hex(++k)}`; tokens.push(t); return t; });
      s.groupName = tok("sgname");
      for (const r of s.ingress) r.cidrs = r.cidrs.map((c: string) => (c === "0.0.0.0/0" ? c : (() => { const t = `11.${20 + (n % 200)}.${set.charCodeAt(0)}.0/24`; n++; tokens.push(t.replace("/24", "")); return t; })()));
    }
    for (const p of f.data.networkInterfaces ?? []) for (const x of p.items ?? []) add(x.eniId, () => { const t = `eni-${hex(++k)}`; tokens.push(t); return t; });
  } else {
    const guid = (k: number): string => { const t = `c4a1c4a1-c4a1-4c4a-8c4a-${set.charCodeAt(0).toString(16).padStart(4, "0")}${String(k).padStart(8, "0")}`; tokens.push(t); return t; };
    let k = 0;
    add(f.identity.tenantId, () => guid(++k));
    for (const s of f.scope.subscriptions.value ?? []) { add(s.id, () => guid(++k)); add(s.tenantId, () => guid(++k)); add(s.name, () => tok("sub")); }
    const text = JSON.stringify(f.data);
    for (const m of text.matchAll(/resourceGroups\/([^/"]+)/gi)) add(m[1], () => tok("rg"));
    for (const m of text.matchAll(/(?:networkInterfaces|publicIPAddresses|virtualNetworks|subnets)\/([^/"]+)/g)) add(m[1], () => tok("res"));
    for (const p of f.data.storageAccounts ?? []) for (const a of p.items ?? []) {
      add(a.name, () => { const t = `cnrysa${set.toLowerCase()}${++n}`; tokens.push(t); return t; });
      for (const c of a.containers?.value ?? []) if (c.name !== "$web") c.name = tok("ct");
      for (const d of a.blobDiagnostics?.value ?? []) d.name = tok("dg");
    }
    for (const p of f.data.activityLogExports ?? []) for (const d of p.items ?? []) d.name = tok("dg");
    for (const p of f.data.nsgs ?? []) for (const x of p.items ?? []) {
      add(x.name, () => tok("nsg"));
      for (const r of x.rules) { r.name = tok("rule"); r.sourcePrefixes = r.sourcePrefixes.map((s: string) => (/^\d+\.\d+\.\d+\.\d+/.test(s) ? (() => { const t = `11.${30 + (n++ % 200)}.${set.charCodeAt(0)}.0`; tokens.push(t); return `${t}/24`; })() : s)); }
    }
  }
  let text = JSON.stringify(f);
  for (const [orig, t] of [...pairs.entries()].sort((a, b) => b[0].length - a[0].length)) text = text.split(orig).join(t);
  // Azure ID 안 이름은 대소문자를 섞어 쓸 수 있다 → 소문자 원값도 바꾼다
  if (cloud === "azure") for (const [orig, t] of pairs) text = text.split(orig.toLowerCase()).join(t.toLowerCase());
  const name = `cnryfile${cloud}${set}.json`;
  tokens.push(name.replace(".json", ""));
  return { file: JSON.parse(text), name, tokens: [...new Set(tokens)], keyTokens, selfToken, externalTokens };
}

const statusesOf = (j: Json): string => JSON.stringify(rulesOf(okReport(runJson(j))).map((x) => [x.ruleId, x.status, x.items.map((i) => i.status).sort()]));
const leaks = (text: string, tokens: readonly string[]): string[] => tokens.filter((t) => text.includes(t) || text.includes(t.toLowerCase()));

describe("IN-12 마스킹 사본 카나리아 — 회사 8곳", () => {
  for (const cloud of ["aws", "azure"] as const) for (const set of SETS) {
    it(`${cloud}-${set}: 판정 불변 · maskedCopy 토큰 0 · 계정 관계 유지`, () => {
      const p = plant(cloud, set);
      expect(p.tokens.length).toBeGreaterThan(cloud === "aws" ? 8 : 8);
      expect(statusesOf(p.file)).toBe(statusesOf(companyJson(cloud, set)));
      const run = runJson(p.file, { name: p.name });
      if (run.kind !== "ok") throw new Error(run.kind);
      const masked = maskedCopy(run.input);
      expect(leaks(masked, p.tokens)).toEqual([]);
      const m = JSON.parse(masked);
      if (cloud === "aws") {
        expect(m.identity.accountId).toBe("111122223333");
        for (const t of p.externalTokens) expect(masked).not.toContain(t);
        if (p.externalTokens.length > 0) expect(masked).toContain("444455556666");
      }
    });
  }
  it("검사기 자체 점검: 토큰을 심은 입력의 Report(화면 원본 값 full)에는 토큰이 실제로 들어 있다", () => {
    const p = plant("aws", "C");
    const r = okReport(runJson(p.file, { name: p.name }));
    expect(leaks(JSON.stringify(r), p.tokens).length).toBeGreaterThan(5);
  });
});

/* ───────── 인쇄 기준 화면(V3): .cc-mask-full을 뺀 DOM에 토큰 0 ───────── */
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const CLOCK = { now: () => "2026-10-19T05:00:00Z" as never, today: () => "2026-10-19" as never };
const AZURE_OPEN = { aws: "beta", azure: "beta" } as const;
describe("IN-12 인쇄 기준 DOM(실엔진 V3, 모든 점검 펼침)", () => {
  for (const [cloud, set] of [["aws", "C"], ["azure", "C"], ["aws", "D"]] as const) {
    it(`${cloud}-${set}: 화면 원본 값(.cc-mask-full)을 뺀 글자·속성·제목에 토큰 0`, async () => {
      window.history.replaceState(null, "");
      window.print = vi.fn();
      const p = plant(cloud, set);
      // Azure 실제 점검은 운영 기본값에서 '준비 중'이라 V2가 막는다(결정 §8-A) — 실제 Azure 리포트를 보는 이 시험은 공개 상태를 주입해 연다
      const h = mount({ deps: REAL_DEPS, clock: CLOCK, ...(cloud === "azure" ? { availability: AZURE_OPEN } : {}) });
      await h.user.click(screen.getByRole("button", { name: "결과 파일이 이미 있어요" }));
      await uploadFiles(h, [new File([JSON.stringify(p.file)], p.name, { type: "application/json" })]);
      await waitFor(() => expect(screen.getAllByRole("table")[0]).toBeInTheDocument());
      await h.user.click(screen.getByRole("button", { name: "이 계정으로 리포트 보기" }));
      await waitFor(() => expect(h1().textContent).toBe("리포트"));
      for (const btn of Array.from(document.querySelectorAll<HTMLElement>(".cc-rule__tog"))) await h.user.click(btn);
      const full = document.body.textContent ?? "";
      expect(leaks(full, p.tokens).length).toBeGreaterThan(0);          // 화면(원본 값)에는 있다 — 검사가 헛돌지 않는다
      const clone = document.body.cloneNode(true) as HTMLElement;
      clone.querySelectorAll(".cc-mask-full").forEach((el) => el.remove());
      const printed = [clone.textContent ?? "", document.title, ...Array.from(document.querySelectorAll("*")).flatMap((el) => Array.from(el.attributes).map((a) => a.value))].join("\n");
      // 키 끝 4자리는 화면·인쇄(마스킹 기본 포함)에 "키 끝 4자리 XXXX"로 나온다 — 결정 N2(docs/planning/cloudcheck-qa-decisions.md §5)로 명세 확정. 그래서 허용 목록에 둔다
      expect(leaks(printed, p.tokens.filter((t) => !p.keyTokens.includes(t)))).toEqual([]);
      if (p.keyTokens.length > 0) expect(p.keyTokens.some((t) => (clone.textContent ?? "").includes(t))).toBe(true);
    });
  }
});

describe("CC-QA-N2 결정(명세 확정): 액세스 키 끝 4자리 — 화면·인쇄는 원값 4자리, 마스킹 사본은 가명 K001(같은 키 = 같은 가명)", () => {
  /** 마스킹 사본(정규화된 사실의 JSON) 안의 키 끝 4자리 칸 값 전부 */
  const suffixes = (masked: string): string[] => [...masked.matchAll(/"idSuffix":\s*"([^"]*)"/g)].map((m) => m[1]);
  for (const set of ["B", "C"] as const) {
    it(`aws-${set}: maskedCopy에 원래 끝 4자리가 0개, 키 칸은 모두 K + 세 자리, 서로 다른 키 수 = 서로 다른 가명 수, 두 번 만들어도 같다`, () => {
      const p = plant("aws", set);
      expect(p.keyTokens.length).toBeGreaterThan(0);
      const run = runJson(p.file, { name: p.name });
      if (run.kind !== "ok") throw new Error(run.kind);
      const masked = maskedCopy(run.input);
      expect(p.keyTokens.filter((t) => masked.includes(t))).toEqual([]);
      expect(maskedCopy(run.input)).toBe(masked);
      const got = suffixes(masked);
      expect(got.length).toBeGreaterThanOrEqual(p.keyTokens.length);
      for (const a of got) expect(a).toMatch(/^K\d{3}$/);
      expect(new Set(got).size).toBe(new Set(p.keyTokens).size);
    });
  }
  it("같은 끝 4자리가 두 사용자에게 나오면 마스킹 사본에서도 같은 가명 하나다(가명은 값마다 — 칸마다가 아니다)", () => {
    const f = companyJson("aws", "C");
    const keys = (f.data.iamUsers.items as Json[]).flatMap((u) => (u.accessKeys?.value ?? []) as Json[]);
    const distinctBefore = new Set(keys.map((k) => k.idSuffix)).size;
    keys[keys.length - 1].idSuffix = keys[0].idSuffix;                     // 마지막 키를 첫 키와 같은 끝 4자리로
    const distinctAfter = new Set(keys.map((k) => k.idSuffix)).size;
    expect(distinctAfter).toBe(distinctBefore - 1);
    const run = runJson(f);
    if (run.kind !== "ok") throw new Error(`이 모양을 정규화가 거부했다: ${run.kind}`);
    expect(new Set(suffixes(maskedCopy(run.input))).size).toBe(distinctAfter);
  });
});
void collectorName;
