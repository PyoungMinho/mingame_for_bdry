// src/lib/cloudcheck/contract/exceptions-schema.ts — 예외 파일 v1.0 (cloudcheck-exceptions.json, 사용자 로컬 파일)
// G0 동결. 소유: API설계자. 예외는 상태를 바꾸지 않고 라벨만 붙인다(INV-8, R-10). judge()의 입력이 아니다.
// 이 파일은 다음 점검에서 다시 맞춰 보려고 실제 MatchKey(리소스 이름 포함)를 담는다. 마스킹 기본값(R-13)의 예외이며 UI가 그 사실을 고지한다.
import { z } from "zod";
import { RULE_IDS } from "../model/report";

export const EXCEPTIONS_SCHEMA_ID = "cloudcheck.exceptions/1.0" as const;
/** 예외 최대 기간(도구 기준) */
export const EXCEPTION_MAX_DAYS = 90;
const IsoDate = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/);
const dayNumber = (d: string): number => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10))) / 86_400_000;

export const ExceptionEntry = z.object({
  ruleId: z.enum(RULE_IDS),
  resource: z.string().min(1).max(1024),       // MatchKey: <cloud>|<계정·테넌트>|<ResourceType>|<위치 또는 ->|<고유 ID>
  reason: z.string().trim().min(1).max(500),   // 사유 필수
  until: IsoDate,                              // 만료일 필수. 만료 판정은 overlayExceptions(report, file, today)가 한다
  createdAt: IsoDate,
}).strict().superRefine((e, ctx) => {
  const span = dayNumber(e.until) - dayNumber(e.createdAt);
  if (!(span >= 1 && span <= EXCEPTION_MAX_DAYS)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `until은 createdAt 다음 날부터 ${EXCEPTION_MAX_DAYS}일 이내` });
  }
});
export const ExceptionsFile = z.object({
  schema: z.literal(EXCEPTIONS_SCHEMA_ID),
  entries: z.array(ExceptionEntry).max(1000),
}).strict();
export type ExceptionsFile = z.infer<typeof ExceptionsFile>;
export type ExceptionEntry = z.infer<typeof ExceptionEntry>;
