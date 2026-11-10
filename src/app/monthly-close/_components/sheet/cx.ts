/** 클래스 이름 합치기 (의존성 없는 한 줄짜리). */
export function cx(...parts: ReadonlyArray<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
