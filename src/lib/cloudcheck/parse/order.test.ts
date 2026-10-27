// src/lib/cloudcheck/parse/order.test.ts — 판정은 입력을 넣은 순서와 무관하다 (STEP 5 N1, 결정 문서 §4)
// 같은 입력 묶음이면 순서를 바꿔 넣어도 리포트(룰 상태 · 사유 · 대상 MatchKey · 대상 상태 · 분포 · 먼저 볼 3개 · 범위 · 기준 시각 · 알림 …)가 같다.
// 순서를 따라도 되는 것(표시 정보)은 inputs 목록 순서 · 영수증 ID 접두(0: · 1:) · 문 → 입력 번호 · 신원 출처 입력 번호뿐이라 비교에서 뺀다. 입력 정렬(바이트 정규화)은 하지 않는다.
// 동률(같은 runKey · 같은 종류 + 같은 기준 시각)은 입력 위치가 아니라 내용(원본 바이트의 SHA-256이 작은 쪽)으로만 깬다.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { NormalizedInput } from "../contract/normalized";
import { judge } from "../engine/judge";
import { DOORS } from "../model/report";
import type { InputRecognition, InputVia, Report } from "../model/report";
import { sha256Hex } from "./digest";
import { buildInput } from "./normalize";
import { recognize } from "./recognize";
import { awsFile, enc, reportCsv, rgStorageCsv, SELF, TENANT } from "./testdata";
import type { Json } from "./testdata";

const COMPANIES = join(__dirname, "..", "fixtures", "companies");
const companyJson = (name: string): Json => JSON.parse(readFileSync(join(COMPANIES, name), "utf8"));
const companyCsv = (name: string): string => readFileSync(join(COMPANIES, name), "utf8");
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const COLLECTED_MS = Date.UTC(2026, 9, 19, 3, 15, 0);

interface File { readonly name: string; readonly bytes: Uint8Array; readonly rec: InputRecognition }
function file(name: string, content: unknown, o: { via?: InputVia; lastModified?: number | null } = {}): File {
  const bytes = enc(content);
  const rec = recognize({ via: o.via ?? "file", name, bytes, lastModified: o.lastModified ?? null });
  expect(rec.status, `${name} 인식`).toBe("ok");
  return { name, bytes, rec };
}
const digestOf = (f: File): string => sha256Hex(f.bytes);
/** 내용 지문이 가장 작은 파일(= 동률에서 이겨야 하는 쪽) */
const smallest = (fs: readonly File[]): File => fs.reduce((b, c) => (digestOf(c) < digestOf(b) ? c : b));
const largest = (fs: readonly File[]): File => fs.reduce((b, c) => (digestOf(c) > digestOf(b) ? c : b));

function permutations<T>(xs: readonly T[]): T[][] {
  if (xs.length <= 1) return [xs.slice()];
  return xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((rest) => [x, ...rest]));
}

/** 순서를 따르는 표시 정보를 뺀 리포트 전체 */
function canon(r: Report): string {
  const body = { ...r, collection: { ...r.collection, inputs: null } };
  return JSON.stringify(body, (k, v) => (k === "inputIndex" ? undefined : v)).replace(/"\d+:(r-[0-9a-z]+)"/g, '"$1"');
}
interface Snap {
  /** 순서와 무관해야 하는 것 전부 */
  readonly report: string;
  /** 문마다 쓰인 입력 · 밀려난 입력의 이름 */
  readonly used: Record<string, string>;
  readonly superseded: Record<string, string>;
  /** 신원 출처 입력의 이름 */
  readonly identity: string;
  /** 입력 이름 → 인식 상태(superseded 포함) */
  readonly status: Record<string, string>;
}
function snap(files: readonly File[]): Snap {
  const b = buildInput(files.map((f) => f.rec));
  if (!b.ok) throw new Error("buildInput이 실패했다");
  const input: NormalizedInput = b.input;
  const names = (d: (typeof DOORS)[number], s: string): string => input.inputs.filter((i) => i.doors[d] === s).map((i) => i.name).sort().join("+");
  return {
    report: canon(judge(input)),
    used: Object.fromEntries(DOORS.map((d) => [d, names(d, "used")])),
    superseded: Object.fromEntries(DOORS.map((d) => [d, names(d, "superseded")])),
    identity: input.inputs[input.identity.input].name,
    status: Object.fromEntries(files.map((f, i) => [f.name, b.recognitions[i].status]).sort(([x], [y]) => (x < y ? -1 : 1))),
  };
}
/** 가능한 모든 순서로 넣어 같은 결과인지 확인하고 그 결과를 돌려준다 */
function orderFree(files: readonly File[]): Snap {
  const snaps = permutations(files).map(snap);
  snaps.forEach((s, i) => expect(s, `순서 ${i}`).toEqual(snaps[0]));
  return snaps[0];
}
const reportOf = (...files: File[]): string => snap(files).report;
/** 룰 판정만(룰 상태 · 사유 · 대상 MatchKey · 대상 상태 · 분포 · 먼저 볼 3개). 쓰이지 않은 입력의 알림 같은 묶음 정보는 뺀다 */
function judgments(files: readonly File[]): string {
  const b = buildInput(files.map((f) => f.rec));
  if (!b.ok) throw new Error("buildInput이 실패했다");
  const r = judge(b.input);
  return JSON.stringify({
    rules: r.doors.flatMap((d) => d.rules).map((x) => [x.ruleId, x.status, x.why.code, x.items.map((i) => [i.resource.key, i.status, i.why.code])]),
    distribution: r.distribution, firstLook: r.firstLook,
  });
}

/* ───────── 시험 입력 ───────── */
/** AWS 회사 C 수집기 JSON과 그 변형(보안 그룹 출발지를 바꿔 AWS-NET-1 판정이 달라진다) */
function awsVariant(cidr: string | null, mutate: (f: Json) => void = () => undefined, both = false): Json {
  const f = clone(companyJson("aws-C.json"));
  if (cidr !== null) {
    f.data.securityGroups[0].items[0].ingress[0].cidrs = [cidr];                        // bastion-ssh
    if (both) f.data.securityGroups[0].items[1].ingress[0].cidrs = [cidr];              // rds-open
  }
  mutate(f);
  return f;
}
/** 자격증명 보고서 CSV에서 MFA 없는 첫 사용자(루트 제외)의 mfa_active를 바꾼 변형 */
function csvVariant(flip: boolean): string {
  const lines = companyCsv("aws-C.credential-report.csv").trimEnd().split("\n");
  if (!flip) return lines.join("\n") + "\n";
  const head = lines[0].split(",");
  const mfa = head.indexOf("mfa_active");
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",");
    if (cells[0] !== "<root_account>" && cells[mfa] === "false") { cells[mfa] = "true"; lines[i] = cells.join(","); return lines.join("\n") + "\n"; }
  }
  throw new Error("MFA 없는 사용자가 없다");
}

describe("N1 ① 같은 수집 실행(runKey)의 다른 내용 — 어느 순서로 넣어도 같은 파일이 쓰이고 리포트가 같다", () => {
  const a = file("a.json", awsVariant(null));
  const b = file("b.json", awsVariant("203.0.113.0/24"));
  const c = file("c.json", awsVariant("198.51.100.0/24", undefined, true));
  it("전제: 세 파일은 runKey가 같고(같은 계정 · 같은 collectedAt) 리포트가 서로 다르다", () => {
    const keys = [a, b, c].map((f) => (JSON.parse(new TextDecoder().decode(f.bytes)) as Json).collectedAt);
    expect(new Set(keys).size).toBe(1);
    expect(new Set([reportOf(a), reportOf(b), reportOf(c)]).size).toBe(3);   // 시험이 헛돌지 않는다: 누가 이기느냐에 따라 판정이 달라진다
  });
  it("둘: 두 순서의 결과가 같고, 이긴 쪽은 내용 지문이 작은 파일이다", () => {
    const s = orderFree([a, b]);
    const win = smallest([a, b]);
    expect(Object.values(s.used).every((u) => u === win.name)).toBe(true);
    expect(s.status[win.name]).toBe("ok");
    expect(Object.values(s.status).filter((x) => x === "superseded")).toHaveLength(1);
    expect(judgments([a, b])).toBe(judgments([win]));                             // 이긴 파일 하나만 넣은 것과 같은 판정
  });
  it("셋: 여섯 순서가 모두 같은 결과이고 이긴 쪽은 내용 지문이 가장 작은 파일이다", () => {
    const s = orderFree([a, b, c]);
    const win = smallest([a, b, c]);
    expect(Object.values(s.used).every((u) => u === win.name)).toBe(true);
    expect(Object.values(s.status).filter((x) => x === "superseded")).toHaveLength(2);
    expect(s.identity).toBe(win.name);
  });
  it("완전히 같은 파일 둘: 먼저 넣은 것이 쓰이고 나머지는 superseded이며 판정은 한 파일만 넣은 것과 같다", () => {
    const a2 = file("a-again.json", awsVariant(null));
    expect(snap([a, a2]).report).toBe(snap([a2, a]).report);                      // 같은 내용이라 어느 쪽이 쓰여도 리포트가 같다(어느 파일이 쓰였다는 표시만 입력 순서를 따른다)
    expect(Object.values(snap([a, a2]).status).sort()).toEqual(["ok", "superseded"]);
    expect(snap([a, a2]).used.net).toBe("a.json");                                // 내용이 같으면 먼저 넣은 것
    expect(judgments([a, a2])).toBe(judgments([a]));
  });
});

describe("N1 ② 보고서 CSV 둘 이상 — 기준 시각이 없거나 같으면 내용으로 고른다", () => {
  const x = csvVariant(false), y = csvVariant(true);
  it("전제: 두 CSV는 판정이 다르다", () => {
    expect(reportOf(file("p.csv", x, { via: "paste" }))).not.toBe(reportOf(file("q.csv", y, { via: "paste" })));
  });
  it("붙여넣은 CSV 둘(기준 시각 없음): 순서와 무관하고 내용 지문이 작은 쪽이 쓰인다", () => {
    const p = file("paste-1", x, { via: "paste" }), q = file("paste-2", y, { via: "paste" });
    const s = orderFree([p, q]);
    const win = smallest([p, q]);
    expect(s.used.mfa).toBe(win.name);
    expect(s.used.key).toBe(win.name);
    expect(s.identity).toBe(win.name);
    expect(judgments([p, q])).toBe(judgments([win]));
  });
  it("붙여넣은 CSV 셋: 여섯 순서가 모두 같다", () => {
    const z = x.replace("\n", "\n").trimEnd() + "\n";                                            // 줄 끝만 다른 같은 내용이 아니라 별개 바이트가 되게
    const files = [file("paste-1", x, { via: "paste" }), file("paste-2", y, { via: "paste" }), file("paste-3", z + "\n", { via: "paste" })];
    const s = orderFree(files);
    expect(s.used.mfa).toBe(smallest(files).name);
  });
  it("lastModified가 같은 CSV 둘(파일): 순서와 무관하고 내용 지문이 작은 쪽이 쓰인다", () => {
    const p = file("one.csv", x, { lastModified: COLLECTED_MS }), q = file("two.csv", y, { lastModified: COLLECTED_MS });
    const s = orderFree([p, q]);
    expect(s.used.mfa).toBe(smallest([p, q]).name);
    expect(judgments([p, q])).toBe(judgments([smallest([p, q])]));
  });
  it("기준 시각이 다르면 내용과 무관하게 더 늦은 쪽이 쓰인다(지문이 큰 쪽에 늦은 시각을 줘도)", () => {
    const p = file("early.csv", x, { lastModified: COLLECTED_MS }), q = file("late.csv", y, { lastModified: COLLECTED_MS + 3_600_000 });
    // 지문이 더 큰 내용에 더 늦은 시각을 줘서 '지문으로 고르는 규칙'이 시각 규칙을 이기지 않음을 확인한다
    const [loser, winner] = digestOf(p) < digestOf(q) ? [p, q] : [file("early.csv", y, { lastModified: COLLECTED_MS }), file("late.csv", x, { lastModified: COLLECTED_MS + 3_600_000 })];
    expect(digestOf(winner) > digestOf(loser)).toBe(true);
    const s = orderFree([loser, winner]);
    expect(s.used.mfa).toBe(winner.name);
    expect(s.identity).toBe(winner.name);
  });
});

describe("N1 ③ 수집기 JSON 둘 — runKey는 다르지만 기준 시각이 둘 다 없다(시계가 초기화된 기기: 2000년 이전 collectedAt)", () => {
  const early = (iso: string, cidr: string | null): Json => awsVariant(cidr, (f) => { f.collectedAt = iso; f.run.finishedAt = iso; });
  const a = file("t1.json", early("1999-12-31T23:59:58Z", null));
  const b = file("t2.json", early("1999-12-31T23:59:59Z", "203.0.113.0/24"));
  it("전제: runKey는 다르고 기준 시각은 둘 다 믿지 않아 버려졌으며 둘 다 중복이 아니다", () => {
    const ka = (JSON.parse(new TextDecoder().decode(a.bytes)) as Json).collectedAt, kb = (JSON.parse(new TextDecoder().decode(b.bytes)) as Json).collectedAt;
    expect(ka).not.toBe(kb);
    const s = snap([a, b]);
    expect(Object.values(s.status)).toEqual(["ok", "ok"]);
    const built = buildInput([a.rec, b.rec]);
    if (!built.ok) throw new Error("buildInput이 실패했다");
    expect(built.input.inputs.map((i) => i.asOf)).toEqual([null, null]);
  });
  it("두 순서가 같은 결과이고 문 선택 · 신원 출처 모두 내용 지문이 작은 쪽이다", () => {
    const s = orderFree([a, b]);
    const win = smallest([a, b]);
    expect(Object.values(s.used).every((u) => u === win.name)).toBe(true);
    expect(s.identity).toBe(win.name);
    expect(Object.values(s.superseded).every((u) => u === (win === a ? b : a).name)).toBe(true);
  });
});

describe("N1 ④ 종류가 달라 동률이 아닌 묶음도 순서와 무관하다(수집기 JSON + CSV)", () => {
  it("JSON 하나 + CSV 둘: 모든 순서가 같고 문은 수집기 JSON이 가져간다", () => {
    const j = file("aws.json", awsVariant(null));
    const c1 = file("c1.csv", csvVariant(false), { lastModified: COLLECTED_MS });
    const c2 = file("c2.csv", csvVariant(true), { lastModified: COLLECTED_MS });
    const s = orderFree([j, c1, c2]);
    expect(Object.values(s.used).every((u) => u === "aws.json")).toBe(true);
    expect(s.identity).toBe("aws.json");
  });
});

describe("N1 ⑤ Azure — 같은 수집 실행의 다른 내용 · 같은 시각의 저장소 CSV 둘", () => {
  it("Azure 수집기 JSON 둘(같은 runKey): 순서와 무관하다", () => {
    const base = clone(companyJson("azure-C.json"));
    const alt = clone(base);
    alt.data.storageAccounts[0].items[0].allowBlobPublicAccess = false;
    const a = file("az-a.json", base), b = file("az-b.json", alt);
    expect(reportOf(a)).not.toBe(reportOf(b));
    const s = orderFree([a, b]);
    expect(Object.values(s.used).filter((u) => u !== "").every((u) => u === smallest([a, b]).name)).toBe(true);
  });
  it("Resource Graph 저장소 CSV 둘(같은 lastModified): 순서와 무관하다", () => {
    const row = (name: string, allow: string): string => `cc-rg-storage/1,${TENANT},/subscriptions/00000000-0000-0000-0000-00000000a011/resourceGroups/rg-web/providers/Microsoft.Storage/storageAccounts/${name},00000000-0000-0000-0000-00000000a011,rg-web,${name},StorageV2,koreacentral,${allow},true,2025-01-10T00:00:00.1234567Z,,,`;
    const p = file("rg-1.csv", rgStorageCsv([row("stwebfiles01", "true")]), { lastModified: COLLECTED_MS });
    const q = file("rg-2.csv", rgStorageCsv([row("stwebfiles01", "false")]), { lastModified: COLLECTED_MS });
    const s = orderFree([p, q]);
    expect(s.used.key).toBe(smallest([p, q]).name);
  });
});

describe("N1 ⑥ 무작위 묶음 — 고정 시드로 뽑은 부분집합의 모든 순서가 같은 리포트를 낸다", () => {
  const pool: File[] = [
    file("j0.json", awsVariant(null)),
    file("j1.json", awsVariant("203.0.113.0/24")),
    file("j2.json", awsVariant("198.51.100.0/24", (f) => { f.collectedAt = "1999-12-31T23:59:59Z"; f.run.finishedAt = "1999-12-31T23:59:59Z"; })),
    file("j3.json", awsVariant(null, (f) => { f.collectedAt = "2026-10-19T04:00:00Z"; f.run.finishedAt = "2026-10-19T04:00:00Z"; })),
    file("c0.csv", csvVariant(false), { lastModified: COLLECTED_MS }),
    file("c1.csv", csvVariant(true), { lastModified: COLLECTED_MS }),
    file("c2.csv", csvVariant(true), { via: "paste" }),
    file("c3.csv", csvVariant(false), { via: "paste" }),
  ];
  let seed = 20261020;
  const rand = (n: number): number => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % n; };
  it("크기 2~4 부분집합 30개", () => {
    for (let t = 0; t < 30; t++) {
      const size = 2 + rand(3);
      const picked: File[] = [];
      while (picked.length < size) { const f = pool[rand(pool.length)]; if (!picked.includes(f)) picked.push(f); }
      const perms = permutations(picked);
      const first = snap(perms[0]);
      for (const p of perms.slice(1, 8)) expect(snap(p), `부분집합 ${t}: ${picked.map((f) => f.name).join(",")}`).toEqual(first);
    }
  });
});

describe("N1 ⑦ 지문은 입력의 위치가 아니라 바이트에서만 나온다", () => {
  it("같은 파일을 다시 인식해도 같은 내용이면 같은 쪽이 이긴다", () => {
    const a1 = file("a.json", awsVariant(null)), b1 = file("b.json", awsVariant("203.0.113.0/24"));
    const a2 = file("a.json", awsVariant(null)), b2 = file("b.json", awsVariant("203.0.113.0/24"));
    expect(snap([a1, b1])).toEqual(snap([b2, a2]));
    expect(largest([a1, b1]).name).not.toBe(smallest([a1, b1]).name);
  });
});

describe("N1 ⑧ 비밀 모양 이름의 토큰 번호도 입력 순서와 무관하다(MatchKey에 토큰이 들어간다)", () => {
  const S1 = "AKIAIOSFODNN7EXAMPLE", S2 = `ghp_${"b".repeat(36)}`;
  it("수집기 JSON의 버킷 이름과 CSV의 사용자 이름에 서로 다른 비밀 모양 값이 있어도 어느 순서로 넣든 리포트(대상 MatchKey 포함)가 같다", () => {
    const json = file("aws-net-sto-log.json", awsFile({ doors: { mfa: "skipped", key: "skipped" }, mutate: (f) => {
      const old = f.data.buckets.items[0].name as string;
      f.data.buckets.items[0].name = S1;
      for (const r of f.receipts as Json[]) if (r.resource === old) r.resource = S1;
    } }).file);
    const csv = file("report.csv", reportCsv([`${S2},arn:aws:iam::${SELF}:user/${S2},2025-01-01T00:00:00+00:00,false,N/A,N/A,N/A,false,false,N/A,N/A,N/A,N/A,false,N/A,N/A,N/A,N/A,false,N/A,false,N/A`]), { lastModified: COLLECTED_MS });
    const s = orderFree([json, csv]);
    expect(s.report).not.toContain(S1);                                           // 시험 입력이 실제로 지워졌고
    expect(s.report).not.toContain(S2);
    expect(s.report).toContain("\\u0000cc-redacted:");                              // 토큰이 MatchKey에 들어 있다(그래서 번호가 순서를 따르면 어긋난다)
  });
});
