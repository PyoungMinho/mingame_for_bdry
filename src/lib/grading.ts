// REDLINE: 타인 비교/외모 점수 UI 금지
/**
 * 단답형 채점 핵심 로직 (순수 함수 — UI/React 비의존, 단위 테스트 대상).
 *
 * 배경: 학생이 의미상 정답을 입력해도 표기 차이(소수점 trailing 0, 공백,
 * 대소문자)로 오답 처리되던 버그(QA: 단답형 즉시채점 동치성)를 막기 위해
 * `study/page.tsx`의 인라인 비교를 이 모듈로 분리했다.
 */

/**
 * 단답형 텍스트 정규화 — 공백·대소문자·마침표/쉼표 차이를 무시한다.
 * 숫자가 아닌 정답(용어·단어)의 관대한 비교에 사용.
 */
export function normAnswer(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[.,]/g, "");
}

/**
 * 순수 숫자 문자열이면 number, 아니면 null을 반환한다.
 * - 천단위 콤마(1,000)와 앞뒤 공백을 허용한다.
 * - 기호·단위·수식("3x", "5m/s²", "-")은 숫자로 보지 않는다(null).
 */
export function parseNumeric(s: string): number | null {
  const t = s.trim().replace(/,/g, "").replace(/\s+/g, "");
  // 정수/소수(.67, 6, 6.00, -3.0, +2) 만 허용
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/**
 * 단답형 정답 일치 여부.
 * 1) 양쪽이 모두 숫자면 수치로 비교한다 → "1.5" === "1.50" === "1.5 " 모두 정답.
 * 2) 그 외에는 정규화 텍스트로 비교한다 → "decide" === " Decide ".
 */
export function answersMatch(correct: string, user: string): boolean {
  if (typeof correct !== "string" || typeof user !== "string") return false;
  const cn = parseNumeric(correct);
  const un = parseNumeric(user);
  if (cn !== null && un !== null) return cn === un;
  return normAnswer(correct) === normAnswer(user);
}
