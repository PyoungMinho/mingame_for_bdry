// src/lib/cloudcheck/contract/clean-text.ts — 사용자 문자열 정리의 정본 (STEP 5 CC-QA-09)
// 입력 인식(parse/display.ts, V2)과 리포트(engine/display.ts, V3)가 같은 함수를 쓴다: 두 벌이 갈라져 'admin' + U+3164가 'admin'과 똑같이 보이던 문제를 막는다.
// 엔진은 parse를 가져올 수 없으므로(계층 시험) 두 층이 모두 읽을 수 있는 contract에 둔다. 순수 함수다(현재 시각·난수·DOM 없음).
// 치환 대상(U+FFFD로 바꾸고 플래그):
//   · 양방향 제어 문자 → "bidi-replaced"
//   · 그 밖의 제어·보이지 않는 서식 문자 → "control-chars-replaced": C0·DEL·C1, 줄/문단 구분, Default_Ignorable_Code_Point 전부
//     (소프트 하이픈·결합 그래핌 결합자·한글 채움·폭 없는 공백·단어 결합자·이형 선택자·BOM·태그 문자 …)와 Cf(서식) 일부
// 짝 없는 서로게이트는 값을 싣지 않는다(호출자가 hasLoneSurrogate로 먼저 걸러 redacted(invalid-encoding)로 그린다).
// 주의: 이 파일에는 백슬래시-u 이스케이프를 쓰지 않는다(도구 경로에서 실제 문자로 풀릴 수 있다). 코드 포인트 숫자로 적는다.
import type { ValueFlag } from "../model/report";

export const MAX_FULL_LENGTH = 256;
export const REPLACEMENT = String.fromCharCode(0xfffd);

export type CodePointRange = readonly [number, number];
/** 양방향 제어 문자: ALM, LRM·RLM, LRE·RLE·PDF·LRO·RLO, LRI·RLI·FSI·PDI */
export const BIDI_RANGES: readonly CodePointRange[] = [[0x061c, 0x061c], [0x200e, 0x200f], [0x202a, 0x202e], [0x2066, 0x2069]];
/** 제어·보이지 않는 서식 문자(양방향 제외). 오름차순·겹침 없음 */
export const INVISIBLE_RANGES: readonly CodePointRange[] = [
  [0x0000, 0x001f], [0x007f, 0x009f],            // C0, DEL·C1
  [0x00ad, 0x00ad],                              // 소프트 하이픈
  [0x034f, 0x034f],                              // 결합 그래핌 결합자
  [0x0600, 0x0605], [0x06dd, 0x06dd], [0x070f, 0x070f], [0x0890, 0x0891], [0x08e2, 0x08e2],   // 아랍·시리아 서식 문자(Cf)
  [0x115f, 0x1160],                              // 한글 초성·중성 채움
  [0x17b4, 0x17b5],                              // 크메르 고유 모음
  [0x180b, 0x180f],                              // 몽골 이형 선택자·모음 구분자
  [0x200b, 0x200d],                              // 폭 없는 공백·결합자
  [0x2028, 0x2029],                              // 줄·문단 구분
  [0x2060, 0x2065],                              // 단어 결합자·보이지 않는 연산자(2065는 미배정 Default_Ignorable)
  [0x206a, 0x206f],                              // 폐지된 서식 문자
  [0x3164, 0x3164],                              // 한글 채움
  [0xfe00, 0xfe0f],                              // 이형 선택자
  [0xfeff, 0xfeff],                              // BOM·폭 없는 비분리 공백
  [0xffa0, 0xffa0],                              // 반각 한글 채움
  [0xfff0, 0xfffb],                              // 예약(Default_Ignorable)·주석 앵커(Cf). U+FFFC·U+FFFD(치환 문자)는 아니다
  [0x110bd, 0x110bd], [0x110cd, 0x110cd],        // 카이티 숫자 기호(Cf)
  [0x13430, 0x1343f],                            // 이집트 상형문자 서식 제어(Cf)
  [0x1bca0, 0x1bca3], [0x1d173, 0x1d17a],        // 속기·악보 서식 제어
  [0xe0000, 0xe0fff],                            // 태그 문자 · 이형 선택자 보충 · 미배정 Default_Ignorable
];

/** 오름차순·겹침 없는 구간 목록에서 cp를 이분 탐색한다 */
function inRanges(cp: number, ranges: readonly CodePointRange[]): boolean {
  let lo = 0, hi = ranges.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const r = ranges[mid];
    if (cp < r[0]) hi = mid - 1;
    else if (cp > r[1]) lo = mid + 1;
    else return true;
  }
  return false;
}
const BIDI_SORTED: readonly CodePointRange[] = [...BIDI_RANGES].sort((a, b) => a[0] - b[0]);
export const isBidiCodePoint = (cp: number): boolean => cp >= 0x061c && inRanges(cp, BIDI_SORTED);
export const isInvisibleCodePoint = (cp: number): boolean => cp < 0xa0 ? (cp < 0x20 || cp >= 0x7f) : inRanges(cp, INVISIBLE_RANGES);

/** 짝 없는 서로게이트가 있는가(lookbehind 없이 코드 유닛을 직접 훑는다: 구형 브라우저 호환) */
export function hasLoneSurrogate(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const d = s.charCodeAt(i + 1);
      if (d >= 0xdc00 && d <= 0xdfff) { i++; continue; }
      return true;
    }
    if (c >= 0xdc00 && c <= 0xdfff) return true;
  }
  return false;
}
/** 짝 없는 서로게이트만 U+FFFD로 바꾼다(MsgParam.c처럼 값을 버리지 않는 자리용) */
export function stripLoneSurrogates(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const d = s.charCodeAt(i + 1);
      if (d >= 0xdc00 && d <= 0xdfff) { out += s[i] + s[i + 1]; i++; } else out += REPLACEMENT;
    } else if (c >= 0xdc00 && c <= 0xdfff) out += REPLACEMENT;
    else out += s[i];
  }
  return out;
}

export interface CleanedText { readonly text: string; readonly flags: ValueFlag[] }
const FLAG_ORDER: Readonly<Record<ValueFlag, number>> = { truncated: 0, "control-chars-replaced": 1, "bidi-replaced": 2 };

/**
 * 제어·보이지 않는 문자와 양방향 제어 문자를 U+FFFD로 바꾸고 max 코드 포인트(기본 256)에서 자른다. 바뀐 종류를 flags로 알린다
 * (자름 → 제어 → 양방향 순). 표시되는 글자만 본다: 잘려 나간 뒤쪽의 문자는 플래그를 켜지 않는다. 같은 입력이면 항상 같은 결과이고 두 번 적용해도 같다
 */
export function cleanText(raw: string, max: number = MAX_FULL_LENGTH): CleanedText {
  let out = "";
  let count = 0;
  let control = false, bidi = false, truncated = false;
  for (const ch of raw) {
    if (count >= max) { truncated = true; break; }
    const cp = ch.codePointAt(0) as number;
    if (isBidiCodePoint(cp)) { out += REPLACEMENT; bidi = true; }
    else if (isInvisibleCodePoint(cp)) { out += REPLACEMENT; control = true; }
    else out += ch;
    count++;
  }
  const flags: ValueFlag[] = [];
  if (truncated) flags.push("truncated");
  if (control) flags.push("control-chars-replaced");
  if (bidi) flags.push("bidi-replaced");
  return { text: out, flags: flags.sort((a, b) => FLAG_ORDER[a] - FLAG_ORDER[b]) };
}
