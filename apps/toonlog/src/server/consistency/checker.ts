/**
 * 얼굴 임베딩 일관성 검사 스텁.
 * 방향서 아키텍처 #3: 임계치 0.85, 최대 2회 재생성.
 * 실제 구현: W6 얼굴 임베딩 API 연동 예정.
 */
import { FACE_EMBEDDING_THRESHOLD, CONSISTENCY_MAX_RETRY } from "@/lib/constants";

export interface ConsistencyCheckInput {
  /** 기준 이미지 URL (1컷) */
  referenceImageUrl: string;
  /** 검사 대상 이미지 URL */
  targetImageUrl: string;
}

export interface ConsistencyCheckResult {
  /** 0~1 유사도 점수 */
  similarityScore: number;
  /** 임계치 통과 여부 */
  passed: boolean;
}

/**
 * 4컷 간 얼굴 유사도 검사.
 * W6 이전까지는 stub — 항상 통과(개발/데모 목적).
 * 실제 구현 시 이 함수만 교체.
 */
export async function checkFaceConsistency(
  input: ConsistencyCheckInput
): Promise<ConsistencyCheckResult> {
  // TODO(W6): 실제 얼굴 임베딩 API 연동
  // 예: Google Vision API face detection + cosine similarity
  console.info(
    `[Consistency] stub check: ref=${input.referenceImageUrl.slice(-20)} target=${input.targetImageUrl.slice(-20)}`
  );

  // Stub: 항상 통과 (0.92 고정)
  return {
    similarityScore: 0.92,
    passed: true,
  };
}

/**
 * 재시도 래퍼.
 * 실패(passed=false)면 generateFn 재호출 후 재검사.
 * maxRetry = CONSISTENCY_MAX_RETRY (2)
 */
export async function withConsistencyRetry<T extends { imageUrl: string }>(
  referenceImageUrl: string,
  generateFn: () => Promise<T>,
  targetImageUrl: (result: T) => string
): Promise<T> {
  let lastResult = await generateFn();

  for (let attempt = 1; attempt <= CONSISTENCY_MAX_RETRY; attempt++) {
    const target = targetImageUrl(lastResult);
    const check = await checkFaceConsistency({ referenceImageUrl, targetImageUrl: target });

    if (check.passed) {
      return lastResult;
    }

    console.warn(
      `[Consistency] 유사도 ${check.similarityScore} < 임계치 ${FACE_EMBEDDING_THRESHOLD}, 재생성 시도 ${attempt}/${CONSISTENCY_MAX_RETRY}`
    );

    if (attempt < CONSISTENCY_MAX_RETRY) {
      lastResult = await generateFn();
    }
  }

  // 최대 재시도 후 마지막 결과 반환 (soft fail — 완전 실패보다 나음)
  console.warn("[Consistency] 최대 재시도 초과, 마지막 결과 사용");
  return lastResult;
}
