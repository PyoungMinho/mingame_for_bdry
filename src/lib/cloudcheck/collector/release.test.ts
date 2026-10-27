// src/lib/cloudcheck/collector/release.test.ts — 해시·릴리스 일치 (G4: 파일 = SHA256SUMS = RELEASES.json, 추가 전용 이력)
// 이 레포 안에서 강제하는 것: ① 파일 바이트의 SHA-256 = SHA256SUMS(GNU 형식, sha256sum -c로 검증 가능) = TextEncoder로 다시 인코딩한 바이트
//   ② 스크립트의 CC_VERSION·CC_SCHEMA = RELEASES.json의 최신 항목, 해시도 같다(스크립트를 고치면 릴리스 절차 없이는 테스트가 실패한다)
//   ③ RELEASES.json은 추가 전용(아래 RELEASE_LEDGER에 못 박은 이력이 앞부분에 그대로 있어야 한다) ④ LF 고정(.gitattributes)
// 페이지 데이터 블록과의 일치(페이지 내장본 = 저장소 파일)는 프론트 생성기 테스트가 이 파일들을 읽어 확인한다.
// 레포 안 3중 일치만으로는 배포 계정 탈취를 막지 못한다 → PDF 인쇄 해시·라이브 해시를 주기적으로 수동 대조한다(방향서 §13).
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { SCHEMA_RE, SUPPORTED } from "../contract/collect-schema";
import { COLLECTOR_DIR, SCRIPT_PATH } from "./testkit";

const FILES = { "cloudcheck-aws": "cloudcheck-aws.sh", "cloudcheck-azure": "cloudcheck-azure.sh" } as const;
const sha = (b: Uint8Array | Buffer): string => createHash("sha256").update(b).digest("hex");
const read = (name: string): Buffer => readFileSync(join(COLLECTOR_DIR, name));

/** 게시된 릴리스의 못 박은 이력(추가 전용). 새 릴리스를 만들면 여기에도 한 줄을 '추가'한다 — 기존 줄을 고치면 이 테스트가 실패한다.
 *  추가 전용은 '첫 공개'(mingame push 또는 저장소 태그 게시)부터 적용한다. 2026-10-19 백엔드팀장 STEP 4 보안 리뷰에서 수집기를 고쳤을 때는
 *  src/lib/cloudcheck 전체가 커밋·push 0건(공개 전)이라 make-release.mjs --reset으로 v1.0.0 해시를 다시 썼다. 첫 push 뒤에는 반드시 CC_VERSION을 올린다. */
const RELEASE_LEDGER: ReadonlyArray<{ readonly name: string; readonly version: string; readonly sha256: string }> = [
  { name: "cloudcheck-aws", version: "1.0.0", sha256: "5547c91e7f8a4b152c8693eca25ca33d68a886f70247ef9a91599c1dd1c3b988" },   // STEP 5 수집기 묶음: CC-QA-07② 고급 선택기 투영 + D-2 LatestDeliveryError 빈 문자열 방어(첫 공개 전이라 v1.0.0 그대로 해시만 다시 씀)
  { name: "cloudcheck-azure", version: "1.0.0", sha256: "8bc7bd2ff9df9d5c20a30d841c2b3051d93f06bb6eec5d6e41356b3151462f8d" },
];

const Release = z.object({
  name: z.enum(["cloudcheck-aws", "cloudcheck-azure"]), version: z.string().regex(/^\d+\.\d+\.\d+$/), file: z.string(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), schema: z.string().regex(SCHEMA_RE),
}).strict();
const Ledger = z.object({ schema: z.literal("cloudcheck.releases/1"), releases: z.array(Release).min(1) }).strict();
const ledger = Ledger.parse(JSON.parse(read("RELEASES.json").toString("utf8")));
const latest = (name: string): z.infer<typeof Release> => [...ledger.releases].filter((r) => r.name === name).slice(-1)[0];

describe("SHA256SUMS", () => {
  it("GNU 형식('<64hex>  <파일명>') 두 줄이고 sha256sum -c 방식으로 검증된다(shasum -a 256 -c)", () => {
    const text = read("SHA256SUMS").toString("utf8");
    expect(text.endsWith("\n")).toBe(true);
    expect(text.includes("\r")).toBe(false);
    const lines = text.trimEnd().split("\n");
    expect(lines).toHaveLength(2);
    for (const l of lines) expect(l).toMatch(/^[0-9a-f]{64} {2}cloudcheck-(aws|azure)\.sh$/);
    const r = spawnSync("shasum", ["-a", "256", "-c", "SHA256SUMS"], { cwd: COLLECTOR_DIR, encoding: "utf8" });
    expect(r.status, r.stdout + r.stderr).toBe(0);
    expect(r.stdout).toContain("cloudcheck-aws.sh: OK");
    expect(r.stdout).toContain("cloudcheck-azure.sh: OK");
  });
  it("Node crypto로 계산한 파일 바이트의 SHA-256 = SHA256SUMS 줄", () => {
    const sums = new Map(read("SHA256SUMS").toString("utf8").trimEnd().split("\n").map((l) => [l.slice(66), l.slice(0, 64)] as const));
    for (const file of Object.values(FILES)) expect(sums.get(file), file).toBe(sha(read(file)));
  });
  it("TextEncoder로 다시 인코딩한 바이트의 해시 = 파일 해시(Blob 다운로드 바이트가 같음을 보증)", () => {
    for (const file of Object.values(FILES)) {
      const text = read(file).toString("utf8");
      expect(sha(new TextEncoder().encode(text)), file).toBe(sha(read(file)));
    }
  });
});

describe("RELEASES.json", () => {
  it("형식 · (이름, 버전) 고유 · 파일 이름 짝 · 스키마 메이저가 지원 범위", () => {
    expect(new Set(ledger.releases.map((r) => `${r.name}@${r.version}`)).size).toBe(ledger.releases.length);
    for (const r of ledger.releases) {
      expect(r.file, r.name).toBe(FILES[r.name]);
      const m = SCHEMA_RE.exec(r.schema);
      expect(Number(m?.[1])).toBe(SUPPORTED.major);
      expect(Number(m?.[2])).toBeLessThanOrEqual(SUPPORTED.maxMinor);
    }
  });
  it("스크립트의 CC_VERSION·CC_SCHEMA·해시 = 최신 릴리스 항목(스크립트만 고치면 실패한다)", () => {
    for (const [name, file] of Object.entries(FILES)) {
      const text = read(file).toString("utf8");
      const version = /\bCC_VERSION=(\d+\.\d+\.\d+)\b/.exec(text)?.[1];
      const schema = /\bCC_SCHEMA=(cloudcheck\.collect\/\d+\.\d+)\b/.exec(text)?.[1];
      const rel = latest(name);
      expect({ version, schema, sha256: sha(read(file)) }, `${file}을(를) 고쳤다면 CC_VERSION을 올리고 make-release.mjs로 새 릴리스를 만드세요`).toEqual({ version: rel.version, schema: rel.schema, sha256: rel.sha256 });
      expect(new RegExp(`\\bCC_NAME=${name}\\b`).test(text)).toBe(true);
    }
  });
  it("추가 전용: 못 박은 이력이 RELEASES.json 앞부분에 순서·해시까지 그대로 있다", () => {
    const head = ledger.releases.slice(0, RELEASE_LEDGER.length).map((r) => ({ name: r.name, version: r.version, sha256: r.sha256 }));
    expect(head).toEqual([...RELEASE_LEDGER]);
    expect(ledger.releases.length).toBeGreaterThanOrEqual(RELEASE_LEDGER.length);
  });
  it("버전은 단조 증가한다(같은 이름의 뒤 항목이 앞 항목보다 높다)", () => {
    const cmp = (a: string, b: string): number => { const x = a.split(".").map(Number), y = b.split(".").map(Number); return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]; };
    for (const name of Object.keys(FILES)) {
      const vs = ledger.releases.filter((r) => r.name === name).map((r) => r.version);
      vs.slice(1).forEach((v, i) => expect(cmp(v, vs[i]), `${name} ${vs[i]} → ${v}`).toBeGreaterThan(0));
    }
  });
});

describe(".gitattributes — 줄바꿈이 바뀌면 해시가 바뀌므로 LF로 고정", () => {
  it("*.sh · SHA256SUMS · RELEASES.json 이 text eol=lf", () => {
    const t = read(".gitattributes").toString("utf8");
    for (const want of ["*.sh text eol=lf", "SHA256SUMS text eol=lf", "RELEASES.json text eol=lf"]) expect(t).toContain(want);
  });
  it("git이 있으면 실제로 eol: lf가 적용되는지 확인한다", () => {
    const r = spawnSync("git", ["check-attr", "eol", "--", "src/lib/cloudcheck/collector/cloudcheck-aws.sh", "src/lib/cloudcheck/collector/SHA256SUMS", "src/lib/cloudcheck/collector/RELEASES.json"], { cwd: join(COLLECTOR_DIR, "../../../.."), encoding: "utf8" });
    if (r.status !== 0) return;   // git 저장소가 아니거나 git이 없는 환경
    for (const l of r.stdout.trim().split("\n")) expect(l, l).toMatch(/: eol: lf$/);
  });
});

describe("make-release.mjs — 추가 전용 도구", () => {
  const sandbox = (): string => {
    const d = mkdtempSync(join(tmpdir(), "cc-rel-"));
    for (const f of ["cloudcheck-aws.sh", "cloudcheck-azure.sh", "RELEASES.json", "SHA256SUMS", "make-release.mjs"]) copyFileSync(join(COLLECTOR_DIR, f), join(d, f));
    return d;
  };
  const run = (d: string, ...args: string[]) => spawnSync(process.execPath, [join(d, "make-release.mjs"), ...args], { encoding: "utf8" });
  it("변경이 없으면 아무것도 바꾸지 않는다", () => {
    const d = sandbox();
    try {
      const before = [readFileSync(join(d, "RELEASES.json"), "utf8"), readFileSync(join(d, "SHA256SUMS"), "utf8")];
      const r = run(d);
      expect(r.status, r.stderr).toBe(0);
      expect([readFileSync(join(d, "RELEASES.json"), "utf8"), readFileSync(join(d, "SHA256SUMS"), "utf8")]).toEqual(before);
    } finally { rmSync(d, { recursive: true, force: true }); }
  });
  it("버전을 올리지 않고 스크립트를 고치면 거부한다(이미 게시된 해시는 바꿀 수 없다)", () => {
    const d = sandbox();
    try {
      writeFileSync(join(d, "cloudcheck-aws.sh"), `${readFileSync(join(d, "cloudcheck-aws.sh"), "utf8")}# 몰래 고침\n`);
      const r = run(d);
      expect(r.status).toBe(1);
      expect(r.stderr).toContain("CC_VERSION을 올리고");
      expect(JSON.parse(readFileSync(join(d, "RELEASES.json"), "utf8")).releases).toHaveLength(ledger.releases.length);
    } finally { rmSync(d, { recursive: true, force: true }); }
  });
  it("버전을 올리면 새 항목이 끝에 추가되고 이전 항목은 그대로다", () => {
    const d = sandbox();
    try {
      writeFileSync(join(d, "cloudcheck-aws.sh"), readFileSync(join(d, "cloudcheck-aws.sh"), "utf8").replace("CC_VERSION=1.0.0", "CC_VERSION=1.0.1"));
      const r = run(d);
      expect(r.status, r.stderr).toBe(0);
      const rel = JSON.parse(readFileSync(join(d, "RELEASES.json"), "utf8")).releases as z.infer<typeof Release>[];
      expect(rel.slice(0, ledger.releases.length)).toEqual(ledger.releases);
      expect(rel[rel.length - 1]).toMatchObject({ name: "cloudcheck-aws", version: "1.0.1" });
      expect(readFileSync(join(d, "SHA256SUMS"), "utf8")).toContain(sha(readFileSync(join(d, "cloudcheck-aws.sh"))));
    } finally { rmSync(d, { recursive: true, force: true }); }
  });
  it("--reset은 같은 (이름, 버전)의 해시만 다시 쓴다(첫 게시 전 개발용)", () => {
    const d = sandbox();
    try {
      writeFileSync(join(d, "cloudcheck-azure.sh"), `${readFileSync(join(d, "cloudcheck-azure.sh"), "utf8")}# 개발 중 수정\n`);
      const r = run(d, "--reset");
      expect(r.status, r.stderr).toBe(0);
      const rel = JSON.parse(readFileSync(join(d, "RELEASES.json"), "utf8")).releases as z.infer<typeof Release>[];
      expect(rel).toHaveLength(ledger.releases.length);
      expect(rel.find((x) => x.name === "cloudcheck-azure")?.sha256).toBe(sha(readFileSync(join(d, "cloudcheck-azure.sh"))));
      expect(rel.find((x) => x.name === "cloudcheck-aws")).toEqual(ledger.releases.find((x) => x.name === "cloudcheck-aws"));
    } finally { rmSync(d, { recursive: true, force: true }); }
  });
  it("두 수집기 파일은 서로 다른 해시를 가진다", () => {
    expect(sha(read(FILES["cloudcheck-aws"]))).not.toBe(sha(read(FILES["cloudcheck-azure"])));
    expect(SCRIPT_PATH.aws.endsWith("cloudcheck-aws.sh")).toBe(true);
  });
});
