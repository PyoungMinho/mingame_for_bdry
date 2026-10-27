// src/lib/cloudcheck/fixtures/companies/index.ts — 가짜 회사 8곳(세트 4 × AWS·Azure)의 파일 이름 · 내용 · 정의
// 파일 이름: <클라우드>-<세트>.json (세트는 대문자 A|B|C|D). 내용 = 수집기 결과 형식(contract/collect-schema.ts), 한 줄 JSON + 줄바꿈.
// AWS는 자격증명 보고서 CSV도 함께 만든다: aws-<세트>.credential-report.csv (수집기 JSON 안의 보고서와 같은 내용).
import { awsJson, buildAwsCsv } from "./build-aws";
import { azureJson } from "./build-azure";
import { AWS_COMPANIES } from "./worlds-aws";
import { AZURE_COMPANIES } from "./worlds-azure";

export type SetId = "A" | "B" | "C" | "D";
export const SET_IDS: readonly SetId[] = ["A", "B", "C", "D"];
export type CompanyFile =
  | `aws-${SetId}.json` | `azure-${SetId}.json` | `aws-${SetId}.credential-report.csv`;

export const companyJsonName = (cloud: "aws" | "azure", set: SetId): `${"aws" | "azure"}-${SetId}.json` => `${cloud}-${set}.json`;
export const companyCsvName = (set: SetId): `aws-${SetId}.credential-report.csv` => `aws-${set}.credential-report.csv`;

export const COMPANY_FILES: readonly CompanyFile[] = [
  ...SET_IDS.map((s) => companyJsonName("aws", s)),
  ...SET_IDS.map((s) => companyJsonName("azure", s)),
  ...SET_IDS.map((s) => companyCsvName(s)),
];

/** 파일 하나의 내용(빌더 출력) */
export function companyFileContents(file: CompanyFile): string {
  const m = /^(aws|azure)-([ABCD])(\.credential-report\.csv|\.json)$/.exec(file);
  if (m === null) throw new Error(`회사 파일 이름 형식 오류: ${file}`);
  const set = m[2] as SetId;
  if (m[3] === ".credential-report.csv") return buildAwsCsv(AWS_COMPANIES[set]);
  return m[1] === "aws" ? awsJson(AWS_COMPANIES[set]) : azureJson(AZURE_COMPANIES[set]);
}

export { AWS_COMPANIES, AZURE_COMPANIES };
