// 소스 가드 — 엔진 · 룰은 순수해야 한다 (INV-9). 시계 · 난수 · 환경 · DOM · 네트워크 · 범위 봉인 함수에 닿는 코드가 없다.
// 테스트 파일과 이 폴더의 fixtures/는 검사하지 않는다(fixtures는 입력을 만드는 쪽이라 sealCoverage를 쓴다).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return sources(p);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [p] : [];
  });
}
/** 주석과 문자열 리터럴을 뺀 코드만 검사한다(주석에 규칙 이름을 적는 것은 허용) */
function codeOnly(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1")
    .replace(/`(?:\\.|[^`\\])*`/g, "``")
    .replace(/"(?:\\.|[^"\\\n])*"/g, '""')
    .replace(/'(?:\\.|[^'\\\n])*'/g, "''");
}
const files = [...sources(join(ROOT, "engine")), ...sources(join(ROOT, "rules"))];
const rel = (p: string): string => relative(ROOT, p);

const FORBIDDEN: readonly (readonly [RegExp, string])[] = [
  [/\bDate\.now\b/, "Date.now"],
  [/\bnew Date\(\s*\)/, "new Date()"],
  [/\bDate\(\s*\)/, "Date()"],
  [/\bMath\.random\b/, "Math.random"],
  [/\bperformance\.now\b/, "performance.now"],
  [/\bcrypto\.(getRandomValues|randomUUID)\b/, "crypto 난수"],
  [/\b(setTimeout|setInterval|setImmediate|queueMicrotask|requestAnimationFrame)\b/, "타이머"],
  [/\bfetch\s*\(/, "fetch"],
  [/\bXMLHttpRequest\b|\bWebSocket\b|\bnavigator\b/, "네트워크·브라우저 API"],
  [/\b(window|document|localStorage|sessionStorage|indexedDB)\b/, "DOM·저장소"],
  [/\bprocess\.(env|argv|cwd|hrtime)\b/, "process"],
  [/\bconsole\.\w+/, "console"],
  [/\beval\s*\(|\bnew Function\b/, "eval"],
  [/\bsealCoverage\b|\bnotCollectedCoverage\b/, "범위 봉인 함수 (입력을 만드는 쪽만 쓴다)"],
  [/\bas\s+(FamilyCoverage|CoverageTable)\b/, "범위 표 단언"],
  [/\bas\s+any\b|:\s*any\b|<any>/, "any"],
];

describe("엔진 · 룰 소스 가드", () => {
  it("검사 대상이 충분하다", () => {
    expect(files.length).toBeGreaterThan(40);
  });
  it("검사기 자체 점검: 금지 코드는 잡고, 주석 · 문자열 안의 이름은 무시한다", () => {
    const bad = codeOnly("const t = Date.now();\nconst r = Math.random();\nsealCoverage(x);\nconst y = z as FamilyCoverage;");
    expect(FORBIDDEN.filter(([re]) => re.test(bad)).map(([, label]) => label)).toEqual(["Date.now", "Math.random", "범위 봉인 함수 (입력을 만드는 쪽만 쓴다)", "범위 표 단언"]);
    const fine = codeOnly("// Date.now()를 쓰지 않는다\nconst s = 'Math.random'; /* sealCoverage */ const t = \"console.log\";");
    expect(FORBIDDEN.filter(([re]) => re.test(fine))).toEqual([]);
  });
  it.each(FORBIDDEN)("%s 를 쓰지 않는다 (%s)", (re, label) => {
    const hits = files.filter((f) => re.test(codeOnly(readFileSync(f, "utf8")))).map(rel);
    // RuleModule.evaluate의 any는 타입 경계 하나뿐이다(주석으로 사유를 적었다)
    const allowed = label === "any" ? ["engine/types.ts"] : [];
    expect(hits.filter((h) => !allowed.includes(h)), label).toEqual([]);
  });
  it("계층: 엔진 · 룰은 contract · model만 가져오고 parse · collector · 화면 · fixtures를 가져오지 않는다", () => {
    const bad: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(/from\s+["']([^"']+)["']/g)) {
        const spec = m[1];
        if (/(^|\/)(parse|collector|fixtures)(\/|$)/.test(spec) || /app\//.test(spec) || /_client/.test(spec)) bad.push(`${rel(f)} → ${spec}`);
      }
    }
    expect(bad).toEqual([]);
  });
  it("룰 파일은 engine 폴더에서 타입 · msg · reasons 같은 도구만 가져온다 (판정 함수 judge · aggregate를 부르지 않는다)", () => {
    const bad: string[] = [];
    for (const f of files.filter((x) => rel(x).startsWith("rules/") && !rel(x).endsWith("registry.ts") && !rel(x).endsWith("catalog.ts"))) {
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(/from\s+["'](\.\.\/)+engine\/([a-z-]+)["']/g)) if (!["types", "msg", "reasons"].includes(m[2])) bad.push(`${rel(f)} → engine/${m[2]}`);
    }
    expect(bad).toEqual([]);
  });
  it("contract · parse도 결정적이다: 시계 · 난수 · 타이머 · 네트워크 · DOM · 환경 · console · eval 0 (방향서 §2-4 · 백엔드팀장 STEP 4)", () => {
    // 봉인 함수·범위 표 단언·any 규칙은 엔진·룰 전용이다(contract가 봉인 함수를 정의하고, parse가 그것으로 입력을 만든다)
    const PURITY = FORBIDDEN.slice(0, FORBIDDEN.findIndex(([, label]) => label === "eval") + 1);
    expect(PURITY.map(([, label]) => label)).toContain("Date.now");
    const extra = [...sources(join(ROOT, "contract")), ...sources(join(ROOT, "parse"))];
    expect(extra.length).toBeGreaterThan(20);
    const bad: string[] = [];
    for (const f of extra) { const code = codeOnly(readFileSync(f, "utf8")); for (const [re, label] of PURITY) if (re.test(code)) bad.push(`${rel(f)}: ${label}`); }
    expect(bad).toEqual([]);
  });
  it("엔진은 룰 데이터에서 registry · params · version · ports 외에는 가져오지 않는다", () => {
    const bad: string[] = [];
    for (const f of files.filter((x) => rel(x).startsWith("engine/"))) {
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(/from\s+["']\.\.\/rules\/([a-z0-9/.-]+)["']/g)) if (!["registry", "params", "version"].includes(m[1])) bad.push(`${rel(f)} → rules/${m[1]}`);
    }
    expect(bad).toEqual([]);
  });
});
