// 적대 입력: 사용자가 마음대로 쓸 수 있는 문자열(사용자 · 역할 · 보안 그룹 · 구독 이름 …)에 위험한 내용이 들어 있어도
// 엔진이 값을 정리해 싣고, 화면이 그릴 수 있는 형태(DisplayValue)로만 내보내는지 본다. 데모 파일에는 싣지 않고 이 시험 안에서만 만든다.
// parse 모듈이 없으면 건너뛴다(fixtures/e2e.test.ts와 같은 조건).
import { describe, expect, it } from "vitest";
import { demoInputName } from "../../contract/normalized";
import { judge } from "../../engine/judge";
import type { DisplayValue, InputRecognition, Report } from "../../model/report";
import { checkReport } from "../report-invariants";
import { awsJson } from "./build-aws";
import type { AwsCompany } from "./build-aws";
import { azureJson } from "./build-azure";
import type { AzureCompany } from "./build-azure";
import { AWS_C } from "./worlds-aws";
import { AZURE_C } from "./worlds-azure";

interface ParseApi {
  recognize(src: { via: "file" | "paste" | "demo"; name: string; bytes: Uint8Array; lastModified: number | null }): InputRecognition;
  buildInput(recs: readonly InputRecognition[]): { ok: true; input: Parameters<typeof judge>[0] } | { ok: false };
}
async function loadParse(): Promise<ParseApi | null> {
  try {
    const base = "../../parse/";
    const r = (await import(/* @vite-ignore */ `${base}recognize`)) as { recognize?: unknown };
    const n = (await import(/* @vite-ignore */ `${base}normalize`)) as { buildInput?: unknown };
    if (typeof r.recognize !== "function" || typeof n.buildInput !== "function") return null;
    return { recognize: r.recognize as ParseApi["recognize"], buildInput: n.buildInput as ParseApi["buildInput"] };
  } catch {
    return null;
  }
}
const api = await loadParse();

const RLO = String.fromCharCode(0x202e);
const ZWSP = String.fromCharCode(0x200b);
const NUL = String.fromCharCode(0);
const LINESEP = String.fromCharCode(0x2028);
const KEY_LIKE = "AKIAIOSFODNN7EXAMPLE";          // 표본 키 ID: 파일 안에 있으면 지워져야 한다

function run(set: "C", cloud: "aws", json: string): Report;
function run(set: "C", cloud: "azure", json: string): Report;
function run(set: "C", cloud: "aws" | "azure", json: string): Report {
  const p = api as ParseApi;
  const rec = p.recognize({ via: "demo", name: demoInputName(set, cloud), bytes: new TextEncoder().encode(json), lastModified: null });
  expect(rec.status).toBe("ok");
  const built = p.buildInput([rec]);
  if (!built.ok) throw new Error("buildInput 실패");
  return judge(built.input);
}

// 정규식 리터럴에 이스케이프를 직접 쓰지 않고 코드 포인트 범위로 조립한다(도구 경로에서 이스케이프가 실제 문자로 풀리는 것을 피한다)
const RANGES: readonly (readonly [number, number])[] = [[0x0000, 0x001f], [0x007f, 0x009f], [0x2028, 0x2029], [0x200b, 0x200f], [0x2060, 0x2060], [0xfeff, 0xfeff], [0x202a, 0x202e], [0x2066, 0x2069], [0x061c, 0x061c]];
const hex4 = (c: number): string => String.fromCharCode(92) + "u" + c.toString(16).padStart(4, "0");
const BAD_CHARS = new RegExp(`[${RANGES.map(([a, b]) => (a === b ? hex4(a) : `${hex4(a)}-${hex4(b)}`)).join("")}]`);

function displayValues(node: unknown, out: DisplayValue[] = []): DisplayValue[] {
  if (Array.isArray(node)) node.forEach((x) => displayValues(x, out));
  else if (typeof node === "object" && node !== null) {
    const o = node as Record<string, unknown>;
    if (o.kind === "sensitive" || o.kind === "plain" || o.kind === "redacted") out.push(o as unknown as DisplayValue);
    for (const v of Object.values(o)) displayValues(v, out);
  }
  return out;
}

describe.skipIf(api === null)("적대 문자열이 들어 있는 입력", () => {
  const hostileAws: AwsCompany = {
    ...AWS_C,
    users: AWS_C.users.map((u, i) => (i === 0 ? { ...u, name: "<img src=x onerror=alert(1)>" } : i === 1 ? { ...u, name: `ci${RLO}runner${ZWSP}${NUL}` } : i === 2 ? { ...u, name: KEY_LIKE } : u)),
    roles: [
      { name: `evil${LINESEP}role`, createdAt: "2022-08-08T00:00:00Z", trust: [{ wildcard: true }] },
      // 신뢰하는 주체 ARN이 아주 길다(스키마 상한 2048자 안): 화면에 가는 값은 256자(코드 포인트)로 잘린다
      { name: "long-principal", createdAt: "2022-08-09T00:00:00Z", trust: [{ aws: [`arn:aws:iam::999988887777:role/${"r".repeat(300)}`] }] },
      ...(AWS_C.roles ?? []),
    ],
    sgs: { ...AWS_C.sgs, "ap-northeast-2": [{ id: "sg-0c0ffee1", name: "</script><script>alert(1)</script>" + "x".repeat(200), vpcId: "vpc-0bb1", ingress: [{ protocol: "tcp", from: 22, to: 22 }] }, ...AWS_C.sgs["ap-northeast-2"].slice(1)] },
  };
  const hostileAzure: AzureCompany = {
    ...AZURE_C,
    subscriptions: AZURE_C.subscriptions.map((s, i) => (i === 0 ? { ...s, name: `<img src=x onerror=alert(1)>${RLO}${ZWSP}${"가".repeat(200)}` } : s)),
  };

  it("AWS: 판정이 끝나고 불변식을 지키며, 화면에 갈 문자열에는 제어 · 양방향 문자가 남지 않는다", () => {
    const report = run("C", "aws", awsJson(hostileAws));
    expect(checkReport(report)).toEqual([]);
    const values = displayValues(report);
    expect(values.length).toBeGreaterThan(50);
    for (const v of values) {
      if (v.kind === "plain") expect(BAD_CHARS.test(v.text), v.text.slice(0, 40)).toBe(false);
      if (v.kind === "sensitive") { expect(BAD_CHARS.test(v.full), v.full.slice(0, 40)).toBe(false); expect(BAD_CHARS.test(v.masked)).toBe(false); expect(Array.from(v.full).length).toBeLessThanOrEqual(256); }
    }
  });
  it("AWS: 표본 키 ID 모양 문자열은 지워지고(redacted) 알림이 뜬다. 원문은 리포트 어디에도 없다", () => {
    const report = run("C", "aws", awsJson(hostileAws));
    expect(JSON.stringify(report)).not.toContain(KEY_LIKE);
    expect(report.banners.some((b) => b.kind === "secrets-detected")).toBe(true);
    expect(displayValues(report).some((v) => v.kind === "redacted" && v.why === "secret-pattern")).toBe(true);
  });
  it("AWS: 이상한 문자가 든 이름의 대상에는 '이상한 문자' 라벨이 붙고, 표시 플래그가 남는다", () => {
    const report = run("C", "aws", awsJson(hostileAws));
    const labeled = report.doors.flatMap((d) => d.rules).flatMap((r) => r.items).filter((i) => i.labels.some((l) => l.kind === "unusual-characters"));
    expect(labeled.length).toBeGreaterThanOrEqual(1);
    const flagged = displayValues(report).filter((v) => v.kind === "sensitive" && v.flags.length > 0);
    expect(flagged.length).toBeGreaterThanOrEqual(1);
    expect(flagged.some((v) => v.kind === "sensitive" && v.flags.includes("truncated"))).toBe(true);
  });
  it("AWS: 위험한 이름이 있어도 판정은 그대로다 (같은 사실의 정상 이름 입력과 룰 상태가 같다)", () => {
    const hostile = run("C", "aws", awsJson(hostileAws));
    const plain = run("C", "aws", awsJson(AWS_C));
    const st = (r: Report): Record<string, string> => Object.fromEntries(r.doors.flatMap((d) => d.rules).map((x) => [x.ruleId, x.status]));
    expect(st(hostile)).toEqual(st(plain));
  });
  it("Azure: 구독 이름에 마크업 · 양방향 문자 · 아주 긴 이름이 있어도 정리해서 싣는다", () => {
    const report = run("C", "azure", azureJson(hostileAzure));
    expect(checkReport(report)).toEqual([]);
    for (const v of displayValues(report)) {
      if (v.kind === "sensitive") { expect(BAD_CHARS.test(v.full)).toBe(false); expect(Array.from(v.full).length).toBeLessThanOrEqual(256); }
    }
    const weird = displayValues(report).find((v) => v.kind === "sensitive" && v.type === "subscriptionName" && v.flags.includes("bidi-replaced") && v.flags.includes("control-chars-replaced"));
    expect(weird).toBeDefined();
    expect(JSON.stringify(report)).not.toContain(RLO);
  });
});
