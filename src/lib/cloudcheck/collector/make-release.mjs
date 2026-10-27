// src/lib/cloudcheck/collector/make-release.mjs — SHA256SUMS와 RELEASES.json 갱신 도구 (개발자가 손으로 실행 · 테스트가 아님)
//   node src/lib/cloudcheck/collector/make-release.mjs           # 수집기 파일의 해시를 SHA256SUMS에 쓰고, 새 버전이면 RELEASES.json 끝에 항목을 '추가'한다
//   node src/lib/cloudcheck/collector/make-release.mjs --reset   # 첫 릴리스 게시 전에만: 기존 항목을 현재 해시로 다시 쓴다(개발 중 수정용)
// RELEASES.json은 추가 전용이다. 이미 있는 (이름, 버전)의 해시가 바뀌었는데 --reset이 아니면 실패한다 → 스크립트를 고쳤다면 CC_VERSION을 올려 새 릴리스로 만든다.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const reset = process.argv.includes("--reset");
const FILES = [["cloudcheck-aws", "cloudcheck-aws.sh"], ["cloudcheck-azure", "cloudcheck-azure.sh"]];
const ledgerPath = join(dir, "RELEASES.json");
const ledger = existsSync(ledgerPath) ? JSON.parse(readFileSync(ledgerPath, "utf8")) : { schema: "cloudcheck.releases/1", releases: [] };
if (ledger.schema !== "cloudcheck.releases/1" || !Array.isArray(ledger.releases)) throw new Error("RELEASES.json 형식이 맞지 않는다");

const sums = [];
for (const [name, file] of FILES) {
  const bytes = readFileSync(join(dir, file));
  const sha = createHash("sha256").update(bytes).digest("hex");
  const text = bytes.toString("utf8");
  const version = /\bCC_VERSION=(\d+\.\d+\.\d+)\b/.exec(text)?.[1];
  const schema = /\bCC_SCHEMA=(cloudcheck\.collect\/\d+\.\d+)\b/.exec(text)?.[1];
  if (!version || !schema) throw new Error(`${file}: CC_VERSION 또는 CC_SCHEMA를 찾지 못했다`);
  sums.push(`${sha}  ${file}`);
  const i = ledger.releases.findIndex((r) => r.name === name && r.version === version);
  if (i >= 0) {
    if (ledger.releases[i].sha256 === sha) { console.log(`= ${name} ${version} (변경 없음) ${sha}`); continue; }
    if (!reset) { console.error(`✗ ${name} ${version}: 해시가 이미 게시된 값과 다르다. 스크립트를 고쳤다면 CC_VERSION을 올리고 다시 실행하세요(RELEASES.json은 추가 전용).`); process.exit(1); }
    ledger.releases[i] = { ...ledger.releases[i], sha256: sha, schema };
    console.log(`~ ${name} ${version} 해시를 다시 썼다 ${sha}`);
  } else {
    ledger.releases.push({ name, version, file, sha256: sha, date: new Date().toISOString().slice(0, 10), schema });
    console.log(`+ ${name} ${version} 추가 ${sha}`);
  }
}
writeFileSync(join(dir, "SHA256SUMS"), `${sums.join("\n")}\n`);
writeFileSync(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);
console.log("SHA256SUMS, RELEASES.json 을 썼다");
