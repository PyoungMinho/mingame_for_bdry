// src/lib/cloudcheck/parse/display.ts — 입력 인식 단계의 DisplayValue 만들기 (방향서 §5-2 R-12·R-13)
// 엔진의 engine/display(리포트 안, 리포트 단위 순번)와는 별개다: recognize는 입력 1개만 보므로 순번을 알 수 없다.
// 규칙은 같다: full은 정리한 값(제어·양방향·zero-width 문자를 U+FFFD로 바꾸고 256자 상한), masked는 유형별 가림 형식.
import { MAX_FULL_LENGTH, cleanText as cleanTextCanonical, hasLoneSurrogate } from "../contract/clean-text";
import type { DisplayValue, SensitiveType, ValueFlag } from "../model/report";

/**
 * 제어·보이지 않는 문자·양방향 문자를 바꾸고 길이를 자른다. 바뀐 종류를 flags로 알린다.
 * 정리 규칙의 정본은 contract/clean-text.ts다 — 리포트(engine/display.ts)도 같은 함수를 쓴다(CC-QA-09: 두 벌이 갈라져 있던 것을 하나로)
 */
export function cleanText(raw: string, max = MAX_FULL_LENGTH): { text: string; flags: ValueFlag[] } {
  return cleanTextCanonical(raw, max);
}

const NAME_PREFIX: Readonly<Partial<Record<SensitiveType, string>>> = {
  userName: "user", roleName: "role", groupName: "group", resourceName: "resource", alias: "alias", subscriptionName: "subscription", upn: "upn", principal: "principal", arn: "arn",
};
const ID_TYPES: ReadonlySet<SensitiveType> = new Set(["accountId", "tenantId", "subscriptionId"]);

/** masked 형식 v1(방향서 K): *Id 계열 = "••••" + 끝 4자리 / 이름 계열 = "<유형>-<3자리 순번>" / 파일 이름 = "file-<순번>" / 자유 텍스트 = "•••" */
export function maskedFor(type: SensitiveType, full: string, ordinal: number): string {
  if (ID_TYPES.has(type)) return `••••${full.slice(-4)}`;
  if (type === "fileName") return `file-${String(ordinal).padStart(3, "0")}`;
  if (type === "freeText") return "•••";
  return `${NAME_PREFIX[type] ?? "name"}-${String(ordinal).padStart(3, "0")}`;
}

export const redacted = (why: "secret-pattern" | "invalid-encoding"): DisplayValue => ({ kind: "redacted", why });
/** 짝 없는 서로게이트(잘못된 인코딩)가 있으면 값을 싣지 않는다(리포트와 같은 규칙) */
export const plain = (text: string): DisplayValue => (hasLoneSurrogate(text) ? redacted("invalid-encoding") : { kind: "plain", text: cleanText(text).text });
export function sensitive(type: SensitiveType, raw: string, ordinal = 1): DisplayValue {
  if (hasLoneSurrogate(raw)) return redacted("invalid-encoding");
  const { text, flags } = cleanText(raw);
  return { kind: "sensitive", type, full: text, masked: maskedFor(type, text, ordinal), flags };
}
