// src/lib/cloudcheck/collector/__scenarios__/types.ts — shim 시나리오 작성 도우미
// 값은 문서 표본만 쓴다: 계정 ID 111122223333 등, 키는 AKIAIOSFODNN7EXAMPLE 외 0, GUID는 0으로 채운 값, 버킷은 amzn-s3-demo-…, 이메일은 example.com.
import type { Scenario, ShimEntry } from "../testkit";

/** 성공 응답: AWS·Azure CLI가 JSON을 들여쓰기해 내는 모양(jq 입력 검증용으로 일부러 줄바꿈이 있다) */
export const out = (x: unknown): ShimEntry => ({ stdout: `${JSON.stringify(x, null, 4)}\n`, rc: 0 });
/** AWS CLI 오류: stderr에 'An error occurred (코드) when calling…' + 메시지 원문(ARN·이메일 포함 가능 — 수집기는 코드만 취한다) */
export const awsFail = (code: string, op: string, message = "User: arn:aws:sts::111122223333:assumed-role/SecurityAuditRole/kim@example.com is not authorized", rc = 254): ShimEntry =>
  ({ stderr: `\nAn error occurred (${code}) when calling the ${op} operation: ${message}\n`, rc });
/** Azure CLI 오류 형식 한 가지: 'ERROR: (코드) 메시지' + 'Code: 코드' 줄 */
export const azFail = (code: string, message = "The client 'kim@example.com' with object id '00000000-0000-0000-0000-0000000000aa' does not have authorization", rc = 1): ShimEntry =>
  ({ stderr: `ERROR: (${code}) ${message}\nCode: ${code}\nMessage: ${message}\n`, rc });

export interface ScenarioCase {
  readonly id: string;
  readonly title: string;
  readonly scenario: Scenario;
  readonly args: readonly string[];
  /** PATH에서 뺄 도구(jq 없음·aws 없음 시나리오) */
  readonly withoutTools?: readonly string[];
}

export const b64 = (s: string): string => Buffer.from(s, "utf8").toString("base64");
/** 시나리오 일부를 바꾼 사본 */
export const withScenario = (base: Scenario, patch: Record<string, ShimEntry | readonly ShimEntry[] | null>): Scenario => {
  const o: Record<string, ShimEntry | readonly ShimEntry[]> = { ...base };
  for (const [k, v] of Object.entries(patch)) { if (v === null) delete o[k]; else o[k] = v; }
  return o;
};
