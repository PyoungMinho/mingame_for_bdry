// QA AN-01 · AN-03 · AN-04 — 정답지 독립 검증 (설계서 §4-2, G3)
// AN-01: QA가 회사 정의·명세만 보고 적은 표(answers-independent.data.ts) = 엔진 출력 = 정답지(fixtures/answers/*.json). 셋 중 하나라도 다르면 실패.
// AN-03: Azure 회사 4곳의 모든 컨테이너 publicAccess ∈ {"None","Blob","Container"}, null 0(백엔드 요청 4)
// AN-04: 정답지 자동 생성 경로 0 — answers.ts가 engine/judge를 import하지 않고, 정답지 JSON을 쓰는 코드가 없다(정적 검사)
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { summarizeReport } from "../fixtures/answers";
import type { AnswerFile } from "../fixtures/answers";
import { demoInputName } from "../contract/normalized";
import { companyJson, okReport, runFiles, SETS } from "./kit";
import type { Json } from "./kit";
import { QA_JUDGMENTS } from "./answers-independent.data";
import type { Row } from "./answers-independent.data";

const ANSWERS = join(__dirname, "..", "fixtures", "answers");
const answerOf = (set: string, cloud: string): AnswerFile => JSON.parse(readFileSync(join(ANSWERS, `${set}.${cloud}.json`), "utf8")) as AnswerFile;
const engineOf = (set: "A" | "B" | "C" | "D", cloud: "aws" | "azure") => summarizeReport(okReport(runFiles([{ content: companyJson(cloud, set), name: demoInputName(set, cloud), via: "demo" }])));
const rowKey = (r: readonly unknown[]): string => JSON.stringify([r[0], r[1], r[2]]);

describe("AN-01 사람 재판정 표 = 엔진 = 정답지", () => {
  it("표본 크기: 대상 행 60개 이상, 8개 표 모두", () => {
    expect(QA_JUDGMENTS.length).toBe(8);
    const rows = QA_JUDGMENTS.flatMap((c) => Object.values(c.rules).flatMap((r) => r.rows));
    expect(rows.length).toBeGreaterThanOrEqual(60);
  });
  for (const c of QA_JUDGMENTS) {
    it(`${c.cloud}-${c.set}${c.seenBeforeWriting ? " (정답지 일부를 먼저 봄)" : ""}`, () => {
      const engine = engineOf(c.set, c.cloud);
      const answer = answerOf(c.set, c.cloud);
      const diffs: string[] = [];
      for (const [id, q] of Object.entries(c.rules)) {
        const e = engine.rules[id];
        const a = answer.rules[id];
        if (e === undefined || a === undefined) { diffs.push(`${id}: 엔진 ${e === undefined ? "없음" : "있음"} / 정답지 ${a === undefined ? "없음" : "있음"}`); continue; }
        const triple = (field: string, qv: unknown, ev: unknown, av: unknown): void => {
          const s = (x: unknown): string => JSON.stringify(x ?? null);
          if (s(qv) !== s(ev) || s(qv) !== s(av)) diffs.push(`${id}.${field}: QA ${s(qv)} / 엔진 ${s(ev)} / 정답지 ${s(av)}`);
        };
        triple("status", q.status, e.status, a.status);
        triple("why", q.why, e.why, a.why);
        if (q.basis !== undefined) triple("basis", q.basis, e.basis, a.basis);
        if (q.gaps !== undefined) triple("gaps", q.gaps, e.gaps, a.gaps);
        const eRows = new Set(e.items.map(rowKey));
        const aRows = new Set(a.items.map(rowKey));
        for (const r of q.rows as readonly Row[]) {
          const k = rowKey(r);
          if (!eRows.has(k) || !aRows.has(k)) diffs.push(`${id} 행 ${k}: 엔진 ${eRows.has(k) ? "있음" : "없음"} / 정답지 ${aRows.has(k) ? "있음" : "없음"}`);
        }
      }
      expect(diffs).toEqual([]);
    });
  }
});

describe("AN-03 Azure 비공개 컨테이너 'None'(백엔드 요청 4)", () => {
  it("Azure 회사 4곳의 모든 컨테이너 publicAccess ∈ {None, Blob, Container}, null 0", () => {
    const bad: string[] = [];
    let n = 0;
    for (const set of SETS) {
      const f = companyJson("azure", set);
      for (const p of f.data.storageAccounts as Json[]) for (const a of p.items ?? []) for (const ct of (a.containers?.value ?? []) as Json[]) {
        n++;
        if (!["None", "Blob", "Container"].includes(ct.publicAccess)) bad.push(`${set} ${a.name}/${ct.name}: ${JSON.stringify(ct.publicAccess)}`);
      }
    }
    expect(bad).toEqual([]);
    expect(n).toBeGreaterThan(10);
  });
});

describe("AN-04 정답지 자동 생성 경로 0(정적 검사)", () => {
  const ROOT = join(__dirname, "..");
  const files = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return n === "qa" || n === "node_modules" ? [] : files(p);
    return /\.(ts|tsx|mjs|js)$/.test(n) ? [p] : [];
  });
  it("fixtures/answers.ts는 engine/judge를 import하지 않는다(Report → 정답지 함수 없음)", () => {
    const src = readFileSync(join(ROOT, "fixtures", "answers.ts"), "utf8");
    const imports = [...src.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
    expect(imports.filter((s) => /engine\//.test(s))).toEqual([]);
    expect(/export function \w*(write|generate|make|build)\w*Answer/i.test(src)).toBe(false);
  });
  /** 주석을 뺀 코드(주석에 '정답지는 쓰지 않는다'처럼 단어만 나오는 것은 무시) */
  const codeOnly = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
  it("src/lib/cloudcheck 안에서 answers/*.json을 쓰는(writeFile) 코드가 없다", () => {
    const hits = files(ROOT).filter((f) => {
      const s = codeOnly(readFileSync(f, "utf8"));
      return /writeFile(Sync)?\s*\(/.test(s) && /answers/.test(s);
    }).map((f) => f.slice(ROOT.length + 1));
    expect(hits).toEqual([]);
  });
  it("검사기 자체 점검: 주석 속 'answers'는 무시하고 코드 속 경로는 잡는다", () => {
    expect(/answers/.test(codeOnly("// 정답지(answers/)는 쓰지 않는다\nwriteFileSync(p, x);"))).toBe(false);
    expect(/answers/.test(codeOnly('writeFileSync(join(dir, "answers", f), x);'))).toBe(true);
  });
});
