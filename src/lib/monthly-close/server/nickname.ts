/**
 * 닉네임 금칙어 (소유: 백엔드. QA BUG-09 / 기획 A-2 "nickname(8자, 금칙어)").
 *
 * - 닉네임은 상대 상태줄·상단바에 그대로 나오므로 서버에서 거른다. 걸리면 거부하지 않고 기본 닉네임("편집자NN")으로 바꾼다
 *   (입장 흐름을 막지 않고, 클라에 새 오류 문구가 필요 없다. 같은 비밀키면 늘 같은 번호).
 * - 목록은 짧고 보수적으로: 욕설·비하·성적 표현의 대표어만. 오탐이 나기 쉬운 말은 부분 일치에서 빼고
 *   닉네임 전체가 그 말일 때만 거른다(BANNED_EXACT). 완벽한 필터가 아니라 대표적인 노출을 막는 장치다.
 * - 비교 전에 공백·숫자·기호를 지운다("시 1 발", "ㅅ.ㅂ" 같은 끼워 넣기). 영문은 소문자로.
 * - 문구 팩(copy/)의 금지어 검사와는 별개다(그쪽은 우리가 쓴 문구, 여기는 사용자가 넣은 이름).
 */

/** 어디에 끼어 있어도 거르는 말(정규화 뒤 부분 일치) */
const BANNED_SUBSTR: readonly string[] = [
  // 욕설
  '시발', '씨발', '씨빨', '씨팔', '시팔', '씨바', 'ㅅㅂ', 'ㅆㅂ', '썅',
  '병신', '븅신', '빙신', 'ㅂㅅ', 'ㅄ',
  '개새끼', '개새기', '개색기', '개세끼', '새끼야', '미친놈', '미친년',
  '좆', '존나', '지랄', '염병', '엠창', '느금', '니애미', '느개비',
  // 비하
  '틀딱', '맘충', '한남충', '김치녀', '짱깨', '쪽바리', '깜둥',
  // 성적 표현
  '섹스', '쎅스', '강간', '성폭', '야동', '딸딸이', '따먹', '창녀',
  // 영문·자판 그대로 친 것(시발 = tlqkf, 병신 = qudtls)
  'fuck', 'shit', 'bitch', 'sibal', 'tlqkf', 'qudtls', 'porn', 'sex',
];

/**
 * 닉네임 전체가 이 말일 때만 거르는 말. 부분 일치로는 일상어·이름과 겹친다
 * (보지마·자지마, 시바견, 등신대, 이름 "애자" 등).
 */
const BANNED_EXACT: readonly string[] = ['보지', '자지', '시바', '등신', '애자', '미친', '새끼'];

/** 비교용 정규화: NFC → 소문자 → 공백·숫자·ASCII 기호·흔한 구분 기호 제거 */
export function normalizeForScreen(name: string): string {
  return name
    .normalize('NFC')
    .toLowerCase()
    .replace(/[\s\d!-/:-@[-`{-~·•ㆍ…‧∙。、，．_]/g, '');
}

/** 금칙어가 들어 있으면 true */
export function isBannedNickname(name: string): boolean {
  const n = normalizeForScreen(name);
  if (!n) return false;
  if (BANNED_EXACT.includes(n)) return true;
  return BANNED_SUBSTR.some((w) => n.includes(w));
}

/** 기본 닉네임(클라 기본값과 같은 모양 "편집자NN", 10~99). 비밀키 해시로 정해서 같은 사람은 늘 같다. */
export function defaultNickname(keyHash: string): string {
  const n = Number.parseInt(keyHash.slice(0, 8), 16);
  return `편집자${10 + ((Number.isFinite(n) ? n : 0) % 90)}`;
}

/** 정리된 닉네임(cleanNickname 통과분)에 금칙어가 있으면 기본 닉네임으로 바꾼다. */
export function screenNickname(cleaned: string, keyHash: string): string {
  return isBannedNickname(cleaned) ? defaultNickname(keyHash) : cleaned;
}
