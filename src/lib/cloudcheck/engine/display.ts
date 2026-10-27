// src/lib/cloudcheck/engine/display.ts — 사용자 문자열 정리·마스킹 → DisplayValue (R-12, R-13)
//  - parse가 비밀 패턴으로 지운 값(REDACTED_PREFIX)은 정리보다 먼저 확인해 redacted로 그린다.
//  - 제어 문자·보이지 않는 서식 문자 → U+FFFD로 치환(control-chars-replaced), 양방향 제어 문자 → U+FFFD(bidi-replaced), 256자(코드 포인트) 상한(truncated).
//  - 짝 없는 서로게이트(잘못된 인코딩)는 값을 싣지 않고 redacted(invalid-encoding).
//  - 마스킹 기본안 v1: *Id 계열 = "••••" + 끝 4자리 / 이름 계열 = "<유형>-<3자리 순번>"(리포트 안에서 결정적) / fileName = "file-<순번>" / freeText = "•••".
// 순수 함수 + 리포트 하나당 하나의 Display 인스턴스(순번 표). 현재 시각·난수를 쓰지 않는다.
// 주의: 이 파일에는 백슬래시-u 이스케이프를 직접 쓰지 않는다(도구 경로에서 실제 문자로 풀려 정규식 리터럴이 깨진다). 코드 포인트로 조립한다.
import { BIDI_RANGES as CANON_BIDI, INVISIBLE_RANGES, MAX_FULL_LENGTH as CANON_MAX, REPLACEMENT as CANON_REPLACEMENT, cleanText, hasLoneSurrogate as canonHasLone, stripLoneSurrogates } from "../contract/clean-text";
import { isRedacted } from "../contract/normalized";
import type { DisplayValue, ResourceType, SensitiveType, ValueFlag } from "../model/report";
import type { Raw } from "./types";

// 정리 규칙(제어·보이지 않는 문자·양방향 문자·길이 상한)의 정본은 contract/clean-text.ts다. 입력 인식(parse/display.ts)과 같은 함수를 쓴다(STEP 5 CC-QA-09).
export const MAX_FULL_LENGTH = CANON_MAX;
export const REPLACEMENT = CANON_REPLACEMENT;
const MASK_DOTS = "••••";

/** 양방향 제어 문자: ALM, LRM, RLM, LRE·RLE·PDF·LRO·RLO, LRI·RLI·FSI·PDI (정본 그대로) */
export const BIDI_RANGES = CANON_BIDI;
/** 제어·보이지 않는 서식 문자(양방향 제외): C0, DEL·C1, 줄/문단 구분, Default_Ignorable 전부, Cf 일부 (정본 그대로) */
export const CONTROL_RANGES = INVISIBLE_RANGES;

/** 짝 없는 서로게이트가 있는가 */
export const hasLoneSurrogate = canonHasLone;

export interface Sanitized { readonly text: string; readonly flags: readonly ValueFlag[] }

/** 제어·양방향 문자 치환 + 길이 상한. 호출자가 redacted·잘못된 인코딩을 먼저 걸렀다고 가정한다 */
export function sanitize(input: string): Sanitized {
  return cleanText(input);
}

const PREFIX_BY_TYPE: Readonly<Record<SensitiveType, string>> = {
  accountId: "account", tenantId: "tenant", subscriptionId: "sub", subscriptionName: "sub", alias: "alias",
  userName: "user", upn: "upn", roleName: "role", groupName: "group", resourceName: "resource",
  arn: "arn", principal: "principal", fileName: "file", freeText: "text",
};
/** resourceName의 가명 접두는 ResourceType에서 온다(예: bucket-012, sg-004, container-001) */
export const PREFIX_BY_RESOURCE: Readonly<Partial<Record<ResourceType, string>>> = {
  "s3-bucket": "bucket", "security-group": "sg", "blob-container": "container", "storage-account": "storage", nsg: "nsg", nic: "nic",
  eni: "eni", trail: "trail", "iam-role": "role", "iam-user": "user", "access-key": "user", subscription: "sub", "entra-user": "user",
  region: "region", "aws-account": "account", root: "root", "entra-tenant": "tenant",
};
const ID_TYPES: ReadonlySet<SensitiveType> = new Set<SensitiveType>(["accountId", "tenantId", "subscriptionId"]);

const lastChars = (s: string, n: number): string => Array.from(s).slice(-n).join("");

export interface Display {
  /** 비식별 상수(리전, 포트, CIDR, 정책 이름 …). 입력에서 온 문자열이면 정리만 한다 */
  plain(text: string): DisplayValue;
  /** 사용자 데이터. resourceType은 resourceName의 가명 접두를 정한다 */
  sens(raw: Raw, resourceType?: ResourceType): DisplayValue;
  /** MsgParam.c용: 정리한 문자열 */
  constant(text: string): string;
  /** 지금까지 배정한 가명 수(테스트용) */
  readonly pseudonymCount: () => number;
}

export function createDisplay(): Display {
  const table = new Map<string, Map<string, number>>();
  let total = 0;
  const pseudonym = (prefix: string, key: string): string => {
    let m = table.get(prefix);
    if (m === undefined) { m = new Map<string, number>(); table.set(prefix, m); }
    let n = m.get(key);
    if (n === undefined) { n = m.size + 1; m.set(key, n); total++; }
    return `${prefix}-${String(n).padStart(3, "0")}`;
  };

  const plain = (text: string): DisplayValue => {
    if (isRedacted(text)) return { kind: "redacted", why: "secret-pattern" };
    if (hasLoneSurrogate(text)) return { kind: "redacted", why: "invalid-encoding" };
    return { kind: "plain", text: sanitize(text).text };
  };

  const sens = (raw: Raw, resourceType?: ResourceType): DisplayValue => {
    if (isRedacted(raw.value)) return { kind: "redacted", why: "secret-pattern" };
    if (hasLoneSurrogate(raw.value)) return { kind: "redacted", why: "invalid-encoding" };
    const { text, flags } = sanitize(raw.value);
    let masked: string;
    if (ID_TYPES.has(raw.type)) masked = MASK_DOTS + lastChars(text, 4);
    else if (raw.type === "freeText") masked = "•••";
    else {
      const prefix = raw.prefix
        ?? (raw.type === "resourceName" && resourceType !== undefined ? PREFIX_BY_RESOURCE[resourceType] : undefined)
        ?? PREFIX_BY_TYPE[raw.type];
      // 순번 키는 정리 전 원값이다: 정리 후 같은 모양이 되는 서로 다른 이름이 한 가명으로 합쳐지지 않게
      masked = pseudonym(prefix, raw.value);
    }
    return { kind: "sensitive", type: raw.type, full: text, masked, flags };
  };

  const constant = (text: string): string => (isRedacted(text) ? "•••" : sanitize(stripLoneSurrogates(text)).text);

  return { plain, sens, constant, pseudonymCount: () => total };
}

/** 끝 4자리(계정 ID 등). 짧으면 그대로 */
export const last4Of = (s: string): string => lastChars(s, 4);
