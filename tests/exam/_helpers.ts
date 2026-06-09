/**
 * 문제팩토리 테스트 공용 헬퍼
 * - env 격리: ANTHROPIC_API_KEY를 set/restore 하는 withExamKey
 * - 유효 기본 body 팩토리
 */
import type { GenerateRequestBody } from "@/lib/exam/types";

/**
 * ANTHROPIC_API_KEY를 일시적으로 set(또는 삭제)한 뒤 fn 실행, 끝나면 원복.
 * val === undefined 면 키를 delete 한다(=demo).
 * 동기/비동기 fn 모두 지원.
 */
export async function withExamKey<T>(
  val: string | undefined,
  fn: () => T | Promise<T>
): Promise<T> {
  const had = Object.prototype.hasOwnProperty.call(process.env, "ANTHROPIC_API_KEY");
  const prev = process.env.ANTHROPIC_API_KEY;
  if (val === undefined) {
    delete process.env.ANTHROPIC_API_KEY;
  } else {
    process.env.ANTHROPIC_API_KEY = val;
  }
  try {
    return await fn();
  } finally {
    if (had) {
      process.env.ANTHROPIC_API_KEY = prev;
    } else {
      delete process.env.ANTHROPIC_API_KEY;
    }
  }
}

/** 유효한 기본 body. overrides로 일부 필드 교체. */
export function makeBody(
  overrides: Partial<GenerateRequestBody> = {}
): GenerateRequestBody {
  return {
    source: "다음 일차식의 값을 구하시오.",
    subject: "math",
    difficulty: "medium",
    type: "multiple_choice",
    count: 3,
    ...overrides,
  };
}

/** 보기 라벨 → 텍스트 매핑. 정합성 검증에서 "정답이 가리키는 보기" 추출용. */
export function choiceText(
  choices: { label: string; text: string }[] | undefined,
  label: string
): string | undefined {
  return choices?.find((c) => c.label === label)?.text;
}

/** 가짜 라이브 키(실제 호출 안 되는 형식만) */
export const FAKE_LIVE_KEY = "sk-ant-api03-test-fake-key-not-real-000";
