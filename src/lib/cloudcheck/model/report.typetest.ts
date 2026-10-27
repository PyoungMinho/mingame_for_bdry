// src/lib/cloudcheck/model/report.typetest.ts — 판정 결과 모델의 컴파일 단계 불변식(npm run type-check가 검사)
// 각 줄은 '컴파일 오류가 나야 정상'이다. 오류가 사라지면(@ts-expect-error 미사용) type-check가 실패한다.
import type { IsoUtc, RuleStatusDetail, ItemStatusDetail, CliTemplate, BasisRef, RuleId } from "./report";

const asOf = { at: "2026-10-19T03:12:00Z" as IsoUtc, source: "collected-at" } as const;

// @ts-expect-error 이상 없음인데 범위가 증명되지 않음(proven: false)
export const t1: RuleStatusDetail = { status: "clear", why: { code: "AWS-MFA-2:all-mfa" }, asOf, coverage: { kind: "account-global", covered: 1, total: 1, proven: false, population: 4 } };
// @ts-expect-error 이상 없음인데 기준 시각 없음
export const t2: RuleStatusDetail = { status: "clear", why: { code: "AWS-MFA-2:all-mfa" }, asOf: null, coverage: { kind: "account-global", covered: 1, total: 1, proven: true, population: 4 } };
// @ts-expect-error 확인 불가에 룰별 사유(공통 UnknownReason만 허용)
export const t3: RuleStatusDetail = { status: "unknown", why: { code: "AWS-MFA-2:all-mfa" }, gaps: [], asOf: null, coverage: { kind: "none", covered: null, total: null, proven: false, population: null }, resolution: { kind: "rerun", permissions: [] } };
// @ts-expect-error 해당 없음인데 모수가 0이 아님(INV-5)
export const t4: RuleStatusDetail = { status: "na", why: { code: "no-targets-proven" }, basis: { code: "AWS-KEY-1:na-no-active-keys" }, asOf, coverage: { kind: "account-global", covered: 1, total: 1, proven: true, population: 2 } };
// @ts-expect-error 위험 사유에 확인 불가 코드
export const t5: RuleStatusDetail = { status: "risk", why: { code: "denied" }, asOf, coverage: { kind: "account-global", covered: 1, total: 1, proven: true, population: 1 } };
// @ts-expect-error 이상 없음 대상인데 증거 0개
export const t6: ItemStatusDetail = { status: "clear", why: { code: "AWS-STO-2:not-public" }, evidence: [] };
// @ts-expect-error 대상에는 '해당 없음'이 없다
export const t7: ItemStatusDetail = { status: "na", why: { code: "no-targets-proven" }, evidence: [] };
// @ts-expect-error 고치는 법 '먼저 확인' 단계에 쓰기 명령
export const t8: CliTemplate<"read"> = { kind: "write", shell: "aws", segments: [] };
// @ts-expect-error 허용 목록 밖 링크 호스트
export const t9: BasisRef = { titleKey: "cc.basis.x", link: { href: "https://example.com/x", host: "example.com" }, kind: "doc" };
// @ts-expect-error 없는 룰 ID
export const t10: RuleId = "AWS-NET-2";
