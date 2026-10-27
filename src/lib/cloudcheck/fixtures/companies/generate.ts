// src/lib/cloudcheck/fixtures/companies/generate.ts — 가짜 회사 데이터 파일 생성기
// 실행: npx vite-node src/lib/cloudcheck/fixtures/companies/generate.ts
// 빌더(build-aws.ts · build-azure.ts)의 출력을 companies/ 아래 파일로 쓴다. 정답지(answers/)는 쓰지 않는다 — 정답은 사람이 따로 먼저 쓴다.
// companies.test.ts가 "빌더 출력 == 저장된 파일"을 검사하므로, 회사 정의(worlds-*.ts)를 바꾸면 이 생성기를 다시 돌려야 한다.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { COMPANY_FILES, companyFileContents } from "./index";

const dir = dirname(fileURLToPath(import.meta.url));
mkdirSync(dir, { recursive: true });
for (const f of COMPANY_FILES) {
  writeFileSync(join(dir, f), companyFileContents(f), "utf8");
  console.log("wrote", f);
}
