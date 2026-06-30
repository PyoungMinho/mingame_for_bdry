/**
 * 비용 가드 + 메트릭.
 * 방향서 §3.3: 장당 $0.05 이하 유지.
 * COST_GUARD_MAX_PER_IMAGE_USD env로 설정 (기본 0.05).
 */

const MAX_COST_USD =
  parseFloat(process.env.COST_GUARD_MAX_PER_IMAGE_USD ?? "0.05");

/** 비용 초과 시 throw */
export function assertCostGuard(estimatedCostUsd: number): void {
  if (estimatedCostUsd > MAX_COST_USD) {
    throw new Error(
      `COST_GUARD: 예상 원가 $${estimatedCostUsd.toFixed(4)} > 한도 $${MAX_COST_USD} — 생성 차단`
    );
  }
}

/** 장당 실원가 기록 (로깅 + 향후 메트릭 수집) */
export async function recordImageCost(params: {
  jobId: string;
  diaryId: string;
  panelIndex: number;
  costUsd: number;
  provider: string;
}): Promise<void> {
  // TODO(W9): Prometheus/CloudWatch 메트릭 emit
  // 현재는 콘솔 로깅만
  console.info(
    `[Metrics] job=${params.jobId} panel=${params.panelIndex} provider=${params.provider} cost=$${params.costUsd.toFixed(5)}`
  );

  // 임계치 경고 (가드는 assertCostGuard에서 처리)
  if (params.costUsd > MAX_COST_USD * 0.9) {
    console.warn(
      `[Metrics] 비용 경고: $${params.costUsd} ≈ 한도의 90%+ (diaryId=${params.diaryId})`
    );
  }
}

/** 4컷 총 예상 원가 계산 */
export function estimateTotalCost(
  provider: string,
  panelCount: number = 4
): number {
  const perPanelCost: Record<string, number> = {
    "vertex-gemini": 0.039,
    openai: 0.04,
    mock: 0,
  };
  const cost = (perPanelCost[provider] ?? 0.04) * panelCount;
  return cost;
}
