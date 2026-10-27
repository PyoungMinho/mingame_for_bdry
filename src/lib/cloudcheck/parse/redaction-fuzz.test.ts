// src/lib/cloudcheck/parse/redaction-fuzz.test.ts — R-12 주입 시험: 정상 결과 파일의 문자열 값 하나하나를 비밀 모양으로 바꿔 넣어도
// recognize · buildInput · maskedCopy 어느 출력에도 그 비밀이 남지 않는다(파일이 거부되거나, 값이 지워지거나).
import { describe, expect, it } from "vitest";
import type { InputRecognition } from "../model/report";
import { maskedCopy } from "./mask";
import { buildInput } from "./normalize";
import { awsFile, azureFile, rec, recCsv, reportCsv, rgNsgCsv, rgStorageCsv, TENANT } from "./testdata";
import type { AwsOpts, AzOpts, Json } from "./testdata";

/** 키 ID 모양(AKIA + 영문 대문자·숫자 16자). 표본 키(AKIAIOSFODNN7EXAMPLE)와 다른 값이라 우연히 표본과 섞이지 않는다 */
const SECRET = `${"AKIA"}${"ZZZZZZZZZZZZZZZZ"}`;

type Path = readonly (string | number)[];
function stringLeaves(x: unknown, path: Path = [], out: Path[] = []): Path[] {
  if (typeof x === "string") out.push(path);
  else if (Array.isArray(x)) x.forEach((v, i) => stringLeaves(v, [...path, i], out));
  else if (typeof x === "object" && x !== null) for (const [k, v] of Object.entries(x)) stringLeaves(v, [...path, k], out);
  return out;
}
function withLeaf(file: Json, path: Path, value: string): Json {
  const root = structuredClone(file) as Json;
  let cur: Json = root;
  for (let i = 0; i < path.length - 1; i++) cur = cur[path[i]] as Json;
  cur[path[path.length - 1]] = value;
  return root;
}
const dump = (x: unknown): string => JSON.stringify(x, (_k, v) => (v instanceof Map ? [...v] : v));
const bare = (r: InputRecognition): InputRecognition => ({ ...r, handle: null });

/** 이 인식 결과가 만드는 모든 출력에서 비밀이 보이는 곳 */
function leaksOf(r: InputRecognition): string[] {
  const where: string[] = [];
  if (dump(bare(r)).includes(SECRET)) where.push("recognize");
  const b = buildInput([r]);
  if (dump(b.recognitions.map(bare)).includes(SECRET)) where.push("recognitions");
  if (b.ok) {
    if (dump(b.input).includes(SECRET)) where.push("normalized");
    if (maskedCopy(b.input).includes(SECRET)) where.push("masked");
  }
  return where;
}
const label = (p: Path): string => p.join(".");

function fuzzJson(file: Json, name = "cloudcheck-result.json"): { tried: number; rejected: number; leaks: string[] } {
  let rejected = 0;
  const leaks: string[] = [];
  const paths = stringLeaves(file);
  for (const path of paths) {
    const r = rec(withLeaf(file, path, SECRET), { name });
    if (r.status !== "ok") rejected++;
    for (const where of leaksOf(r)) leaks.push(`${label(path)} → ${where}`);
  }
  return { tried: paths.length, rejected, leaks };
}

describe("정상 JSON 결과 파일의 모든 문자열 값에 비밀을 넣어 본다", () => {
  it("AWS: 어느 값에 넣어도 출력에 남지 않는다", () => {
    const r = fuzzJson(awsFile().file);
    expect(r.tried).toBeGreaterThan(150);
    expect(r.rejected).toBeGreaterThan(0);        // 형식이 정해진 칸은 파일째 거부된다
    expect(r.rejected).toBeLessThan(r.tried);     // 자유 문자열 칸은 받아들이고 지운다
    expect(r.leaks).toEqual([]);
  });
  it("Azure: 어느 값에 넣어도 출력에 남지 않는다", () => {
    const r = fuzzJson(azureFile().file);
    expect(r.tried).toBeGreaterThan(100);
    expect(r.rejected).toBeGreaterThan(0);
    expect(r.rejected).toBeLessThan(r.tried);
    expect(r.leaks).toEqual([]);
  });
  it("AWS 변형(보고서 없음 · 사용자 목록 실패 · 부분 수집)에서도 같다", () => {
    const variants: AwsOpts[] = [{ usersResult: "denied" }, { doors: { mfa: "skipped", key: "skipped" } }, { usersResult: "truncated" }];
    for (const v of variants) expect(fuzzJson(awsFile(v).file).leaks, JSON.stringify(v)).toEqual([]);
  });
  it("Azure 변형(일부 문 건너뜀)에서도 같다", () => {
    const variants: AzOpts[] = [{ doors: { sto: "skipped", log: "skipped" } }, { doors: { net: "skipped" } }];
    for (const v of variants) expect(fuzzJson(azureFile(v).file).leaks, JSON.stringify(v)).toEqual([]);
  });
  it("체험 입력(via: demo)도 같은 길이다", () => {
    const file = awsFile().file;
    let leaks = 0;
    for (const path of stringLeaves(file)) {
      const r = rec(withLeaf(file, path, SECRET), { via: "demo", name: "cloudcheck-demo-A.aws.json" });
      leaks += leaksOf(r).length;
    }
    expect(leaks).toBe(0);
  });
});

describe("CSV의 모든 칸에 비밀을 넣어 본다", () => {
  const cells = (text: string): Array<{ row: number; col: number }> => {
    const out: Array<{ row: number; col: number }> = [];
    text.split("\n").forEach((line, row) => { if (line !== "") line.split(",").forEach((_, col) => out.push({ row, col })); });
    return out;
  };
  const inject = (text: string, row: number, col: number): string => text.split("\n").map((line, r) => (r !== row ? line : line.split(",").map((c, k) => (k === col ? SECRET : c)).join(","))).join("\n");
  const fuzzCsv = (text: string): { tried: number; leaks: string[] } => {
    const leaks: string[] = [];
    const all = cells(text);
    for (const { row, col } of all) for (const where of leaksOf(recCsv(inject(text, row, col), "export.csv", 1_792_300_000_000))) leaks.push(`행${row + 1} 열${col + 1} → ${where}`);
    return { tried: all.length, leaks };
  };
  it("자격증명 보고서", () => {
    const r = fuzzCsv(reportCsv());
    expect(r.tried).toBeGreaterThan(60);
    expect(r.leaks).toEqual([]);
  });
  it("Resource Graph 저장소 · NSG", () => {
    const s = fuzzCsv(rgStorageCsv());
    const n = fuzzCsv(rgNsgCsv());
    expect(s.tried).toBeGreaterThan(20);
    expect(n.tried).toBeGreaterThan(20);
    expect([...s.leaks, ...n.leaks]).toEqual([]);
  });
  it("Entra 등록 CSV(수집기 파일과 함께)", () => {
    const text = "userPrincipalName,isAdmin,isMfaCapable,isMfaRegistered\nkim@contoso.com,true,true,true\nlee@contoso.com,false,true,false\n";
    const base = rec(azureFile().file);
    const leaks: string[] = [];
    for (const { row, col } of cells(text)) {
      const csv = recCsv(inject(text, row, col), "registration.csv", 1_792_300_000_000);
      const b = buildInput([base, csv]);
      const outputs = [dump(b.recognitions.map(bare)), b.ok ? dump(b.input) : "", b.ok ? maskedCopy(b.input) : ""];
      outputs.forEach((o, i) => { if (o.includes(SECRET)) leaks.push(`행${row + 1} 열${col + 1} → ${["recognitions", "normalized", "masked"][i]}`); });
    }
    expect(leaks).toEqual([]);
  });
});

describe("파일 이름 · 별칭 · 테넌트 같은 입구", () => {
  it("파일 이름에 비밀이 있어도 인식 결과에 이름이 실리지 않는다", () => {
    const r = rec(awsFile().file, { name: `${SECRET}.json` });
    expect(dump(bare(r))).not.toContain(SECRET);
    const b = buildInput([r]);
    expect(dump(b.recognitions.map(bare))).not.toContain(SECRET);
    if (b.ok) expect(dump(b.input)).not.toContain(SECRET);
  });
  it("CSV 파일 이름도 같다", () => {
    const r = recCsv(reportCsv(), `${SECRET}.csv`);
    expect(dump(bare(r))).not.toContain(SECRET);
    const b = buildInput([r]);
    if (b.ok) expect(dump(b.input)).not.toContain(SECRET);
    expect(dump(b.recognitions.map(bare))).not.toContain(SECRET);
  });
  it("Azure 테넌트 ID 자리에 비밀 모양이 있으면 GUID 형식이 아니라서 거부된다", () => {
    const r = rec(azureFile({ mutate: (f) => { f.identity.tenantId = SECRET; } }).file);
    expect(r.status).not.toBe("ok");
    expect(TENANT).toMatch(/^[0-9a-f-]{36}$/);
  });
});
