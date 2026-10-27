// 가짜 회사 8곳(세트 4 × AWS·Azure) + AWS 자격증명 보고서 CSV 4개 — 파일 자체의 건전성 검사
//  ① 빌더 출력 == 저장된 파일(회사 정의를 바꾸고 생성기를 안 돌리면 여기서 실패한다)
//  ② 수집 계약(contract/collect-schema.ts) 통과, 한 줄 JSON, 영수증 연결이 끊기지 않음
//  ③ 문서 표본 값만 쓰고(계정 111122223333, 0으로 채운 GUID, amzn-s3-demo-…) 비밀 모양 · 금지어가 없다
// 판정 결과(정답)는 answers.test.ts · e2e.test.ts가 본다.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AWS_CALLS, AZURE_CALLS } from "../../contract/calls";
import { AwsCollectFile, AzureCollectFile, CollectFile, LIMITS } from "../../contract/collect-schema";
import { findBanned } from "../../model/banned-words";
import { AWS_COMPANIES, AZURE_COMPANIES, COMPANY_FILES, SET_IDS, companyCsvName, companyFileContents, companyJsonName } from "./index";
import type { CompanyFile } from "./index";

const DIR = __dirname;
const read = (f: string): string => readFileSync(join(DIR, f), "utf8");
const JSON_FILES = COMPANY_FILES.filter((f) => f.endsWith(".json"));
const CSV_FILES = COMPANY_FILES.filter((f) => f.endsWith(".csv"));

/** 문자열 값(키 제외)을 모두 모은다 */
function strings(node: unknown, out: string[] = []): string[] {
  if (typeof node === "string") out.push(node);
  else if (Array.isArray(node)) node.forEach((x) => strings(x, out));
  else if (typeof node === "object" && node !== null) Object.values(node).forEach((x) => strings(x, out));
  return out;
}
/** receipt · generateReceipt 참조를 모은다 */
function refs(node: unknown, out: string[] = []): string[] {
  if (Array.isArray(node)) node.forEach((x) => refs(x, out));
  else if (typeof node === "object" && node !== null) {
    for (const [k, v] of Object.entries(node)) {
      if ((k === "receipt" || k === "generateReceipt") && typeof v === "string") out.push(v);
      else refs(v, out);
    }
  }
  return out;
}

describe("파일 목록", () => {
  it("이름 규약: <aws|azure>-<A|B|C|D>.json 8개 + aws-<세트>.credential-report.csv 4개", () => {
    expect([...COMPANY_FILES].sort()).toEqual([
      "aws-A.credential-report.csv", "aws-A.json", "aws-B.credential-report.csv", "aws-B.json", "aws-C.credential-report.csv", "aws-C.json",
      "aws-D.credential-report.csv", "aws-D.json", "azure-A.json", "azure-B.json", "azure-C.json", "azure-D.json",
    ]);
    expect(SET_IDS).toEqual(["A", "B", "C", "D"]);
    expect(companyJsonName("aws", "C")).toBe("aws-C.json");
    expect(companyCsvName("D")).toBe("aws-D.credential-report.csv");
  });
});

describe.each(COMPANY_FILES.map((f) => [f] as const))("%s", (file: CompanyFile) => {
  it("빌더 출력과 저장된 파일이 바이트까지 같다", () => {
    expect(read(file)).toBe(companyFileContents(file));
  });
});

describe.each(JSON_FILES.map((f) => [f] as const))("%s — 수집기 결과", (file) => {
  const text = read(file);
  const json: unknown = JSON.parse(text);
  const cloud = file.startsWith("aws") ? "aws" : "azure";

  it("계약 스키마(strict)를 통과한다", () => {
    const r = (cloud === "aws" ? AwsCollectFile : AzureCollectFile).safeParse(json);
    expect(r.success ? "ok" : JSON.stringify(r.error.issues.slice(0, 3))).toBe("ok");
    expect(CollectFile.safeParse(json).success).toBe(true);
  });
  it("실제 수집기 출력처럼 한 줄 JSON + 줄바꿈이고 제어 문자가 없고 크기가 작다", () => {
    expect(text.endsWith("\n")).toBe(true);
    const body = text.slice(0, -1);
    expect(body.includes("\n")).toBe(false);
    for (const c of body) expect(c.codePointAt(0) as number, `제어 문자 ${c.codePointAt(0)}`).toBeGreaterThanOrEqual(0x20);
    expect(text.length).toBeLessThan(20_000);
    expect(new TextEncoder().encode(text).length).toBeLessThan(LIMITS.jsonBytes);
  });
  it("영수증: ID가 r-0001부터 순서대로, 호출은 카탈로그 안, 시각은 단조 증가, 모든 영수증이 정확히 한 번 참조된다", () => {
    const f = json as { collectedAt: string; run: { finishedAt: string }; receipts: { id: string; call: string; at: string }[] };
    f.receipts.forEach((r, i) => expect(r.id).toBe(`r-${String(i + 1).padStart(4, "0")}`));
    const catalog = cloud === "aws" ? AWS_CALLS : AZURE_CALLS;
    for (const r of f.receipts) expect(Object.keys(catalog), r.call).toContain(r.call);
    for (let i = 1; i < f.receipts.length; i++) expect(f.receipts[i].at >= f.receipts[i - 1].at).toBe(true);
    expect(f.receipts[0].at >= f.collectedAt).toBe(true);
    expect(f.run.finishedAt >= f.receipts[f.receipts.length - 1].at).toBe(true);
    const used = refs(json);
    expect(new Set(used).size, "같은 영수증을 두 번 참조").toBe(used.length);
    expect([...used].sort()).toEqual(f.receipts.map((r) => r.id).sort());
  });
  it("영수증 결과와 값이 어긋나지 않는다: 실패 · notconfigured 아래에는 값이 없고, empty 아래에는 빈 목록뿐이다", () => {
    const f = json as { receipts: { id: string; result: string; count: number | null }[] };
    const byId = new Map(f.receipts.map((r) => [r.id, r]));
    const walk = (node: unknown): void => {
      if (Array.isArray(node)) { node.forEach(walk); return; }
      if (typeof node !== "object" || node === null) return;
      const o = node as Record<string, unknown>;
      if (typeof o.receipt === "string" && "value" in o) {
        const r = byId.get(o.receipt);
        expect(r, String(o.receipt)).toBeDefined();
        const res = (r as { result: string }).result;
        if (["denied", "error", "throttled", "unsupported", "notconfigured"].includes(res)) expect(o.value, `${o.receipt} ${res}`).toBeNull();
        if (res === "empty" && Array.isArray(o.value)) expect(o.value).toHaveLength(0);
        if (res === "truncated" && Array.isArray(o.value)) expect(o.value).toHaveLength((r as { count: number }).count);
      }
      Object.values(o).forEach(walk);
    };
    walk((json as { data: unknown }).data);
  });
  it("값은 문서 표본뿐이다: 비밀 모양 0, 금지어 0, IP는 문서용 대역, GUID는 0으로 채움", () => {
    const all = strings(json);
    const SECRET = [/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/, /-----BEGIN [A-Z0-9 ]*(?:PRIVATE KEY|CERTIFICATE)-----/, /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\./, /(?:AccountKey|SharedAccessKey|DefaultEndpointsProtocol)\s*=/i, /[?&]sig=[A-Za-z0-9%+/=]{20,}/, /\bgh[pousr]_[A-Za-z0-9]{30,}\b/, /\bsk-[A-Za-z0-9_-]{20,}/, /[A-Za-z0-9+/]{86}==/];
    for (const s of all) {
      for (const re of SECRET) expect(re.test(s), `${s.slice(0, 60)} ~ ${re}`).toBe(false);
      expect(findBanned(s).map((h) => h.match), s).toEqual([]);
      for (const ip of s.match(/\b\d{1,3}(?:\.\d{1,3}){3}(?:\/\d{1,2})?\b/g) ?? []) {
        expect(/^(203\.0\.113\.|198\.51\.100\.|192\.0\.2\.|0\.0\.0\.0\/0$|10\.)/.test(ip), `문서용 대역 밖의 IP: ${ip}`).toBe(true);
      }
      for (const g of s.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi) ?? []) expect(g.startsWith("00000000-0000-0000-0000-00000000"), `0으로 채우지 않은 GUID: ${g}`).toBe(true);
    }
  });
  if (cloud === "aws") {
    it("AWS 표본: 계정 111122223333, 키는 끝 4자리만, 버킷은 amzn-s3-demo-로 시작", () => {
      const f = json as { identity: { accountId: string }; data: { iamUsers?: { items: { accessKeys: { value: { idSuffix: string }[] | null } }[] | null }; buckets?: { items: { name: string }[] | null } } };
      expect(f.identity.accountId).toBe("111122223333");
      for (const u of f.data.iamUsers?.items ?? []) for (const k of u.accessKeys.value ?? []) expect(k.idSuffix).toMatch(/^[A-Z0-9]{4}$/);
      for (const b of f.data.buckets?.items ?? []) expect(b.name.startsWith("amzn-s3-demo-")).toBe(true);
    });
  } else {
    it("Azure 표본: 테넌트 · 구독은 0으로 채운 GUID, 저장소 이름은 st로 시작하는 소문자·숫자 3~24자", () => {
      const f = json as { identity: { tenantId: string; currentSubscription: string }; data: { storageAccounts?: { subscription: string; items: { name: string }[] | null }[] } };
      expect(f.identity.tenantId).toMatch(/^00000000-0000-0000-0000-0000000000[0-9a-f]{2}$/);
      expect(f.identity.currentSubscription).toMatch(/^00000000-0000-0000-0000-0000000000[0-9a-f]{2}$/);
      for (const e of f.data.storageAccounts ?? []) for (const a of e.items ?? []) expect(a.name).toMatch(/^st[a-z0-9]{1,22}$/);
    });
  }
});

describe.each(CSV_FILES.map((f) => [f] as const))("%s — 자격증명 보고서 CSV", (file) => {
  const set = /aws-([ABCD])\./.exec(file)?.[1] as "A" | "B" | "C" | "D";
  const text = read(file);
  const rows = text.trimEnd().split("\n");

  it("머리글 23열 + 루트 행 + 사용자 행, 모든 행이 23칸이다", () => {
    expect(rows[0].split(",")).toHaveLength(23);
    expect(rows[0].startsWith("user,arn,user_creation_time,password_enabled,")).toBe(true);
    expect(rows[0].endsWith(",additional_credentials_info")).toBe(true);
    for (const r of rows) expect(r.split(","), r.slice(0, 40)).toHaveLength(23);
    expect(rows[1].startsWith("<root_account>,arn:aws:iam::111122223333:root,")).toBe(true);
    expect(rows.length - 2).toBe(AWS_COMPANIES[set].users.length);
  });
  it("루트 행의 비밀번호 칸: 일반 계정은 not_supported(AWS 문서 예시), Organizations 멤버는 false", () => {
    expect(rows[1].split(",")[3]).toBe(set === "D" ? "false" : "not_supported");
  });
  it("수집기 JSON 안의 보고서와 같은 내용이다", () => {
    const json = JSON.parse(read(`aws-${set}.json`)) as { data: { credentialReport: { value: { csv: string; generatedTime: string; format: string } } } };
    expect(json.data.credentialReport.value.csv).toBe(text);
    expect(json.data.credentialReport.value.format).toBe("text/csv");
  });
  it("값이 비어 있지 않고(N/A · no_information 표기를 쓴다) 비밀 모양이 없다", () => {
    for (const r of rows.slice(1)) for (const cell of r.split(",")) expect(cell.length, r.slice(0, 30)).toBeGreaterThan(0);
    expect(/AKIA|ASIA|PRIVATE KEY/.test(text)).toBe(false);
  });
});

describe("회사 정의", () => {
  it("세트마다 AWS · Azure 이름이 같고 한글 상호다", () => {
    for (const s of SET_IDS) {
      expect(AWS_COMPANIES[s].name).toBe(AZURE_COMPANIES[s].name);
      expect(AWS_COMPANIES[s].setId).toBe(s);
      expect(AZURE_COMPANIES[s].setId).toBe(s);
    }
    expect(SET_IDS.map((s) => AWS_COMPANIES[s].name)).toEqual(["반듯상회", "멈춘시계상회", "아슬아슬상회", "반쯤본상회"]);
  });
  it("기준 시각이 모두 같다(체험 데이터의 기준 시각은 고정)", () => {
    expect(new Set([...SET_IDS.map((s) => AWS_COMPANIES[s].collectedAt), ...SET_IDS.map((s) => AZURE_COMPANIES[s].collectedAt)])).toEqual(new Set(["2026-10-19T03:15:00Z"]));
  });
});
