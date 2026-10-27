// QA CL-01 · CL-02 — 수집기 린터 우회 샘플 확장 · endpoint-guard 변이 (설계서 §4-6, G4)
// 기존 lint.test.ts '린터의 린터'에 없는 우회 모양을 실제 수집기 원문의 main 앞에 끼워 넣고, 린터가 위반으로 잡는지 본다(규칙 ID를 함께 확인).
// CL-02: AWS_IGNORE_CONFIGURED_ENDPOINT_URLS=true 삭제 · false · 뒤로 옮김, Azure의 로컬 버전 명령을 az --version으로 → 린트 실패.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { lintCollector } from "../collector/lint";
import type { Cloud, LintRuleId } from "../collector/lint";
import { SCRIPT_PATH } from "../collector/testkit";

const SRC: Record<Cloud, string> = { aws: readFileSync(SCRIPT_PATH.aws, "utf8"), azure: readFileSync(SCRIPT_PATH.azure, "utf8") };
const beforeMain = (line: string) => (s: string): string => s.replace(/\nmain "\$@"\n$/, () => `\n${line}\nmain "$@"\n`);
const marker = (id: string): string => `# @cc:test.${id} 시험용 호출`;

/** [이름, 클라우드, 끼울 줄, 잡아야 할 규칙 후보] — 한 규칙이라도 잡으면 통과 */
const BYPASS: readonly (readonly [string, Cloud, string, readonly LintRuleId[]])[] = [
  ['"$(printf curl)" 명령 이름', "aws", '"$(printf curl)" http://example.com/x', ["L-07", "L-08"]],
  ["${!x} 간접 참조", "aws", 'x=PATH; say "${!x}"', ["L-10"]],
  ["BASH_ENV= 대입", "aws", "BASH_ENV=/tmp/x", ["L-10"]],
  ["exec 3<>/dev/tcp", "aws", "exec 3<>/dev/tcp/203.0.113.1/80", ["L-08", "L-14", "L-07"]],
  ["read </dev/tcp", "aws", "read -r x </dev/tcp/203.0.113.1/80", ["L-08", "L-14"]],
  ["cat /etc/passwd", "aws", "cat /etc/passwd >&2", ["L-14", "L-07"]],
  ["jq -n 'input'", "aws", `jq -n 'input' >"$TMP/x"`, ["L-13"]],
  ["jq 'env.X'", "aws", `jq -n 'env.HOME' >"$TMP/x"`, ["L-13"]],
  ["command -p curl", "aws", "command -p curl http://example.com/x", ["L-07", "L-08"]],
  ["trap 'curl x' EXIT", "aws", "trap 'curl http://example.com/x' EXIT", ["L-07", "L-08"]],
  ["PROMPT_COMMAND=", "aws", "PROMPT_COMMAND='curl x'", ["L-10", "L-08"]],
  ["jq() 재정의", "aws", "jq() { :; }", ["L-10"]],
  ["aws() 재정의", "aws", "aws() { :; }", ["L-10"]],
  [">(…) 프로세스 치환", "aws", 'say x > >(cat)', ["L-14", "L-12"]],
  ["|& 파이프", "aws", "say x |& cat", ["L-12", "L-07"]],
  ["aws configure get", "aws", `${marker("cfg")}\ncall sts:GetCallerIdentity global - - '.' -- aws configure get aws_secret_access_key --output json`, ["L-05", "L-06"]],
  ["aws s3 cp(데이터 평면)", "aws", `${marker("s3cp")}\ncall s3:ListAllMyBuckets global - - '.' -- aws s3 cp s3://amzn-s3-demo-bucket/k - --output json`, ["L-05", "L-06"]],
  ["hash -p", "aws", "hash -p /tmp/x aws", ["L-07", "L-10"]],
  ["enable -f", "aws", "enable -f /tmp/x.so x", ["L-07", "L-10"]],
  ["az rest", "azure", `${marker("rest")}\ncall azure:account.list - - length '.' -- az rest --method get --url https://management.azure.com/x -o json --only-show-errors`, ["L-05", "L-06"]],
  ["az account get-access-token(래퍼 안)", "azure", `${marker("tok")}\ncall azure:account.list - - length '.' -- az account get-access-token -o json --only-show-errors`, ["L-05", "L-06"]],
];

describe("CL-01 린터 우회 샘플(기존 '린터의 린터' 밖)", () => {
  it("대조: 원본 두 수집기는 위반 0", () => {
    expect(lintCollector(SRC.aws, "aws").findings).toEqual([]);
    expect(lintCollector(SRC.azure, "azure").findings).toEqual([]);
  });
  for (const [name, cloud, line, rules] of BYPASS) {
    it(`${cloud}: ${name} → ${rules.join("·")} 위반`, () => {
      const bad = beforeMain(line)(SRC[cloud]);
      expect(bad).not.toBe(SRC[cloud]);
      const f = lintCollector(bad, cloud).findings;
      expect(f.some((x) => rules.includes(x.rule)), `잡힌 것: ${JSON.stringify(f.map((x) => `${x.rule}/${x.code}`))}`).toBe(true);
    });
  }
});

describe("CL-02 endpoint-guard 변이", () => {
  const GUARD = "AWS_IGNORE_CONFIGURED_ENDPOINT_URLS=true";
  it("전제: AWS 수집기 머리에 가드가 있다", () => expect(SRC.aws).toContain(GUARD));
  it("가드 줄 삭제 → 린트 실패", () => {
    const lines = SRC.aws.split("\n");
    const bad = lines.filter((l) => !l.includes(GUARD)).join("\n");
    expect(lintCollector(bad, "aws").findings.length).toBeGreaterThan(0);
  });
  it("값을 false로 → 린트 실패", () => {
    expect(lintCollector(SRC.aws.replace(GUARD, "AWS_IGNORE_CONFIGURED_ENDPOINT_URLS=false"), "aws").findings.length).toBeGreaterThan(0);
  });
  it("가드를 11줄 뒤(첫 호출 이후 쪽)로 옮김 → 린트 실패", () => {
    const lines = SRC.aws.split("\n");
    const i = lines.findIndex((l) => l.includes(GUARD));
    const [g] = lines.splice(i, 1);
    lines.splice(Math.min(i + 11, lines.length - 2), 0, g);
    expect(lintCollector(lines.join("\n"), "aws").findings.length).toBeGreaterThan(0);
  });
  it("Azure 로컬 버전 명령을 az --version으로 → 린트 실패", () => {
    expect(SRC.azure).toContain("az version -o json --only-show-errors");
    expect(lintCollector(SRC.azure.replace("az version -o json --only-show-errors", "az --version"), "azure").findings.length).toBeGreaterThan(0);
  });
});
