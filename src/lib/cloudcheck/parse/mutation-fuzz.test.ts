// src/lib/cloudcheck/parse/mutation-fuzz.test.ts — 변이 시험: 정상 수집 파일의 값 하나하나를 망가뜨려도 파서는 던지지 않고,
// '받아들였다(ok)'면 정규화가 반드시 성공하고 불변식(checkInvariants)을 어기지 않는다. 거부(not-cloudcheck 등)는 안전한 결과다.
import { describe, expect, it, vi } from "vitest";
import { checkInvariants } from "../contract/normalized-invariants";
import { maskedCopy } from "./mask";
import { buildInput } from "./normalize";
import type { InputRecognition } from "../model/report";
import { awsFile, azureFile, rec, recCsv, reportCsv, rgNsgCsv, rgStorageCsv } from "./testdata";
import type { Json } from "./testdata";

vi.setConfig({ testTimeout: 300_000 });

type Path = readonly (string | number)[];
function leaves(x: unknown, path: Path = [], out: Path[] = []): Path[] {
  if (Array.isArray(x)) { x.forEach((v, i) => leaves(v, [...path, i], out)); if (x.length === 0) out.push(path); }
  else if (typeof x === "object" && x !== null) { for (const [k, v] of Object.entries(x)) leaves(v, [...path, k], out); }
  else out.push(path);
  return out;
}
function mutate(file: Json, path: Path, how: (old: unknown) => unknown | typeof REMOVE): Json {
  const root = structuredClone(file) as Json;
  let cur: Json = root;
  for (let i = 0; i < path.length - 1; i++) cur = cur[path[i]] as Json;
  const key = path[path.length - 1];
  const next = how(cur[key]);
  if (next === REMOVE) { if (Array.isArray(cur)) cur.splice(Number(key), 1); else delete cur[key]; }
  else cur[key] = next;
  return root;
}
const REMOVE = Symbol("remove");
const MUTATIONS: ReadonlyArray<readonly [string, (old: unknown) => unknown]> = [
  ["null", () => null],
  ["삭제", () => REMOVE],
  ["다른 형식", (o) => (typeof o === "string" ? 7 : typeof o === "number" ? "x" : typeof o === "boolean" ? "true" : [])],
  ["빈 값/뒤집기", (o) => (typeof o === "string" ? "" : typeof o === "number" ? -1 : typeof o === "boolean" ? !o : null)],
  ["아주 큰 값", (o) => (typeof o === "string" ? "z".repeat(300) : typeof o === "number" ? 1e12 : o)],
];

function exercise(file: Json, name: string, extra?: (i: ReturnType<typeof okInput>) => void): { accepted: number; rejected: number; failures: string[] } {
  let accepted = 0, rejected = 0;
  const failures: string[] = [];
  for (const path of leaves(file)) {
    for (const [label, how] of MUTATIONS) {
      const where = `${path.join(".")} · ${label}`;
      try {
        const r = rec(mutate(file, path, how), { name });
        if (r.status !== "ok") { rejected++; continue; }
        accepted++;
        const b = buildInput([r]);
        if (!b.ok) { failures.push(`${where}: 받아들였는데 정규화 실패`); continue; }
        const inv = checkInvariants(b.input);
        if (inv.length > 0) failures.push(`${where}: 불변식 ${inv.slice(0, 2).join(" / ")}`);
        const m = maskedCopy(b.input);
        if (typeof m !== "string" || m.length === 0) failures.push(`${where}: 마스킹 사본 없음`);
        extra?.(okInput(b));
      } catch (e) {
        failures.push(`${where}: 예외 ${(e as Error).message}`);
      }
    }
  }
  return { accepted, rejected, failures };
}
const okInput = (b: ReturnType<typeof buildInput>) => { if (!b.ok) throw new Error("실패"); return b.input; };

describe("정상 파일의 값을 망가뜨려도 던지지 않고, 받아들인 파일은 불변식을 지킨다", () => {
  it("AWS", () => {
    const r = exercise(awsFile().file, "cloudcheck-aws.json");
    expect(r.accepted).toBeGreaterThan(300);        // 선택 칸·열린 문자열 칸은 받아들인다
    expect(r.rejected).toBeGreaterThan(300);        // 형식이 정해진 칸은 파일째 거부한다
    expect(r.failures).toEqual([]);
  });
  it("Azure", () => {
    const r = exercise(azureFile().file, "cloudcheck-azure.json");
    expect(r.accepted).toBeGreaterThan(200);
    expect(r.rejected).toBeGreaterThan(200);
    expect(r.failures).toEqual([]);
  });
  it("AWS: 사용자 목록이 실패했거나 일부 문만 수집한 변형도 같다", () => {
    for (const opts of [{ usersResult: "denied" as const }, { doors: { mfa: "skipped" as const, key: "skipped" as const } }, { usersResult: "truncated" as const }]) {
      const r = exercise(awsFile(opts).file, "cloudcheck-aws.json");
      expect(r.failures, JSON.stringify(opts)).toEqual([]);
    }
  });
  it("자격증명 보고서 CSV 원문을 망가뜨려도 던지지 않는다(열 삭제 · 행 삭제 · 칸 비우기 · 따옴표 깨기) — 수집 파일 안의 원문", () => {
    const variants = csvVariants(reportCsv());
    expect(variants.length).toBeGreaterThan(200);
    let accepted = 0;
    const failures: string[] = [];
    for (const [n, v] of variants.entries()) {
      try {
        const r = rec(awsFile({ csv: v }).file);
        if (r.status !== "ok") continue;
        accepted++;
        const b = buildInput([r]);
        if (!b.ok) { failures.push(`#${n}: 정규화 실패`); continue; }
        const inv = checkInvariants(b.input);
        if (inv.length > 0) failures.push(`#${n}: ${inv.slice(0, 2).join(" / ")}`);
      } catch (e) { failures.push(`#${n}: 예외 ${(e as Error).message}`); }
    }
    expect(accepted).toBeGreaterThan(100);
    expect(failures).toEqual([]);
  });
  it("CSV 파일 입구도 같다: 자격증명 보고서 · Resource Graph(저장소·NSG) · Entra 등록", () => {
    const entra = "userPrincipalName,isAdmin,isMfaCapable,isMfaRegistered\nkim@contoso.com,true,true,true\nlee@contoso.com,false,true,false\n";
    const base = rec(azureFile().file);
    const cases: ReadonlyArray<readonly [string, string, (r: InputRecognition) => ReturnType<typeof buildInput>]> = [
      ["보고서", reportCsv(), (r) => buildInput([r])],
      ["RG 저장소", rgStorageCsv(), (r) => buildInput([r])],
      ["RG NSG", rgNsgCsv(), (r) => buildInput([r])],
      ["Entra", entra, (r) => buildInput([base, r])],
    ];
    const failures: string[] = [];
    let accepted = 0;
    for (const [name, text, build] of cases) {
      for (const [n, v] of csvVariants(text).entries()) {
        try {
          const r = recCsv(v, "export.csv", 1_792_300_000_000);
          if (r.status !== "ok") continue;
          accepted++;
          const b = build(r);
          if (!b.ok) { if (name !== "Entra") failures.push(`${name} #${n}: 정규화 실패`); continue; }     // Entra는 짝 수집 파일이 있어야 하고, 테넌트가 달라지면 거부될 수 있다
          const inv = checkInvariants(b.input);
          if (inv.length > 0) failures.push(`${name} #${n}: ${inv.slice(0, 2).join(" / ")}`);
          if (maskedCopy(b.input).length === 0) failures.push(`${name} #${n}: 마스킹 사본 없음`);
        } catch (e) { failures.push(`${name} #${n}: 예외 ${(e as Error).message}`); }
      }
    }
    expect(accepted).toBeGreaterThan(150);
    expect(failures).toEqual([]);
  });
});

/** CSV 글자 덩어리를 망가뜨린 변형들: 행 삭제 · 칸 삭제(모호한 행) · 칸 비우기 · 따옴표 깨기 */
function csvVariants(csv: string): string[] {
  const lines = csv.split("\n");
  const out: string[] = [];
  for (let row = 0; row < lines.length; row++) {
    if (lines[row] === "") continue;
    out.push(lines.filter((_, i) => i !== row).join("\n"));
    const width = lines[row].split(",").length;
    for (let col = 0; col < width; col++) {
      const edit = (f: (cells: string[]) => string[]): string => lines.map((l, i) => (i === row ? f(l.split(",")).join(",") : l)).join("\n");
      out.push(edit((c) => c.filter((_, k) => k !== col)));
      out.push(edit((c) => c.map((x, k) => (k === col ? "" : x))));
      out.push(edit((c) => c.map((x, k) => (k === col ? `"${x}` : x))));
    }
  }
  return out;
}
