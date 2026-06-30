/**
 * 생성 파이프라인 오케스트레이터.
 * moderateInput → split → (컷별: draw → consistency → moderateImage) → savePanels
 * 각 단계마다 SSE 이벤트 emit.
 * 방향서 아키텍처 #2(reference multi-turn), #3(consistency), #4(SSE), #6(moderation).
 * design-final §10 충돌해소 #6: 자발적 재생성=차감, 시스템 실패=무차감.
 */
import type {
  ToonlogSSEEvent,
  Panel,
  PanelIndex,
  GenerationErrorCode,
} from "@/lib/contract";
import { splitDiaryToScenes } from "@/server/llm/splitter";
import { getImageProvider } from "@/server/image/provider";
import { withConsistencyRetry } from "@/server/consistency/checker";
import { moderateInput, moderateImage } from "@/server/moderation/moderator";
import { assertCostGuard, recordImageCost, estimateTotalCost } from "@/server/metrics/costGuard";

/** DB설계자 의존 — @/lib/db */
import {
  updateDiaryStatus,
  savePanels,
  updateJobStage,
} from "@/lib/db";

export interface GeneratePipelineInput {
  jobId: string;
  diaryId: string;
  userId: string;
  diaryText: string;
  artStyle: import("@/lib/contract").ArtStyleKey;
  avatar: import("@/lib/contract").AvatarConfig;
}

export type SSEEmitter = (event: ToonlogSSEEvent) => void;

const TIPS = [
  "AI가 4컷 만화를 그리는 중이에요. 잠깐만요!",
  "캐릭터 일관성을 유지하며 컷을 이어 그리고 있어요.",
  "완성된 컷부터 순서대로 나타납니다!",
  "말풍선 위치도 자동으로 제안해 드려요.",
];

/**
 * 전체 생성 파이프라인 실행.
 * SSE 이벤트는 emit 콜백으로 프론트에 실시간 전달.
 */
export async function runGenerationPipeline(
  input: GeneratePipelineInput,
  emit: SSEEmitter
): Promise<void> {
  const { jobId, diaryId, diaryText, artStyle, avatar } = input;

  try {
    // ── STEP 0: 비용 가드 사전 체크 ──
    const provider = getImageProvider();
    const estimatedCost = estimateTotalCost(provider.name, 4);
    assertCostGuard(estimatedCost);

    // ── STEP 1: 입력 텍스트 모더레이션 ──
    emit({ type: "status", jobId, stage: "splitting" });
    await updateJobStage(jobId, "splitting");

    const inputMod = await moderateInput(diaryText);
    if (!inputMod.passed) {
      emit({
        type: "error",
        jobId,
        code: "MODERATION_BLOCKED_INPUT",
        message: "일기 내용이 가이드라인에 맞지 않아 생성할 수 없습니다.",
        retryable: false,
      });
      await updateDiaryStatus(diaryId, "failed");
      return;
    }

    // ── STEP 2: LLM 4컷 분절 ──
    // 팁 로테이션 (이탈 방어 — design-final §4 P1)
    emit({ type: "tip", text: TIPS[0] });

    const { scenes } = await splitDiaryToScenes({ diaryText, artStyle, avatar });

    emit({ type: "status", jobId, stage: "drawing" });
    await updateJobStage(jobId, "drawing");

    // ── STEP 3: 컷별 이미지 생성 (reference multi-turn) ──
    const completedPanels: Panel[] = [];
    let referenceImageUrl: string | undefined;

    for (const scene of scenes) {
      const panelIndex = scene.panelIndex as PanelIndex;

      // 팁 로테이션 (2~3컷에서)
      if (panelIndex === 2 || panelIndex === 3) {
        emit({ type: "tip", text: TIPS[panelIndex - 1] });
      }

      // 이미지 생성 + consistency retry 래퍼
      const generated = await withConsistencyRetry(
        referenceImageUrl ?? "",
        async () =>
          provider.generatePanel({
            panelIndex,
            sceneDescription: scene.sceneDescription,
            artStyle,
            avatar,
            referenceImageUrl: referenceImageUrl ?? undefined,
            balloonHints: scene.balloons.map((b) => ({
              x: b.x, y: b.y, w: b.w, h: b.h,
            })),
          }),
        (r) => r.imageUrl
      );

      // 1컷 생성 후 reference로 설정 (방향서 아키텍처 #2)
      if (panelIndex === 1) {
        referenceImageUrl = generated.imageUrl;
      }

      // ── STEP 4: 출력 이미지 모더레이션 ──
      emit({ type: "status", jobId, stage: "checking" });
      const imageMod = await moderateImage(generated.imageUrl);
      if (!imageMod.passed) {
        emit({
          type: "error",
          jobId,
          code: "MODERATION_BLOCKED_OUTPUT",
          message: `${panelIndex}번 컷 이미지가 가이드라인에 맞지 않습니다.`,
          retryable: true,
        });
        // 시스템 실패로 간주 → quota 무차감 (design-final §10 충돌해소 #6)
        await updateDiaryStatus(diaryId, "failed");
        return;
      }

      // 비용 기록
      await recordImageCost({
        jobId,
        diaryId,
        panelIndex,
        costUsd: generated.costUsd,
        provider: provider.name,
      });

      // 패널 객체 조립
      const panel: Panel = {
        index: panelIndex,
        imageUrl: generated.imageUrl,
        previewUrl: generated.previewUrl,
        caption: scene.caption,
        balloons: scene.balloons,
      };

      completedPanels.push(panel);

      // ── 1컷 완성 즉시 SSE push (방향서 아키텍처 #4) ──
      emit({ type: "panel", jobId, panel });
      emit({
        type: "progress",
        jobId,
        completed: completedPanels.length,
        total: 4,
      });

      emit({ type: "status", jobId, stage: "drawing" });
      await updateJobStage(jobId, "drawing");
    }

    // ── STEP 5: 마무리 ──
    emit({ type: "status", jobId, stage: "finalizing" });
    await updateJobStage(jobId, "finalizing");

    await savePanels(diaryId, completedPanels);
    await updateDiaryStatus(diaryId, "completed");

    emit({ type: "tip", text: TIPS[3] });
    emit({ type: "done", jobId, diaryId, panels: completedPanels });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    const code: GenerationErrorCode =
      message.includes("COST_GUARD") ? "PROVIDER_ERROR" : "UNKNOWN";

    console.error(`[Pipeline] 생성 실패 job=${jobId}`, err);

    emit({
      type: "error",
      jobId,
      code,
      message: "생성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
      retryable: true,
    });

    // 시스템 실패 → quota 무차감 처리는 Route Handler에서 refundQuota 호출
    await updateDiaryStatus(diaryId, "failed").catch(() => {});
  }
}

/**
 * 재생성 파이프라인 (특정 컷 또는 전체 재생성).
 * 자발적 재생성 = quota 차감 (design-final §10 충돌해소 #6).
 * quota 차감은 호출 측(Route Handler)에서 tryConsumeQuota로 처리.
 */
export async function runRegeneratePipeline(
  input: GeneratePipelineInput & { panelIndex?: PanelIndex },
  emit: SSEEmitter
): Promise<void> {
  if (!input.panelIndex) {
    // 전체 재생성 — 기존 파이프라인 재실행
    await runGenerationPipeline(input, emit);
    return;
  }

  // 특정 컷만 재생성 — 해당 컷의 장면/말풍선을 다시 분절해 일관 유지
  const { jobId, diaryId, diaryText, artStyle, avatar, panelIndex } = input;
  try {
    const provider = getImageProvider();
    assertCostGuard(estimateTotalCost(provider.name, 1));

    emit({ type: "status", jobId, stage: "splitting" });
    await updateJobStage(jobId, "splitting");

    const { scenes } = await splitDiaryToScenes({ diaryText, artStyle, avatar });
    const scene =
      scenes.find((s) => s.panelIndex === panelIndex) ?? scenes[0];

    emit({ type: "status", jobId, stage: "drawing" });
    await updateJobStage(jobId, "drawing");

    const generated = await provider.generatePanel({
      panelIndex: panelIndex!,
      sceneDescription: scene.sceneDescription,
      artStyle,
      avatar,
      balloonHints: scene.balloons.map((b) => ({ x: b.x, y: b.y, w: b.w, h: b.h })),
    });

    emit({ type: "status", jobId, stage: "checking" });
    const imageMod = await moderateImage(generated.imageUrl);
    if (!imageMod.passed) {
      emit({
        type: "error",
        jobId,
        code: "MODERATION_BLOCKED_OUTPUT",
        message: `${panelIndex}번 컷 이미지가 가이드라인에 맞지 않습니다.`,
        retryable: true,
      });
      return;
    }

    await recordImageCost({
      jobId,
      diaryId,
      panelIndex: panelIndex!,
      costUsd: generated.costUsd,
      provider: provider.name,
    });

    const panel: Panel = {
      index: panelIndex!,
      imageUrl: generated.imageUrl,
      previewUrl: generated.previewUrl,
      caption: scene.caption,
      balloons: scene.balloons,
    };

    // ── 저장(해당 컷만 upsert) + 상태 마무리 ──
    emit({ type: "status", jobId, stage: "finalizing" });
    await updateJobStage(jobId, "finalizing");
    await savePanels(diaryId, [panel]);
    await updateDiaryStatus(diaryId, "completed");

    emit({ type: "panel", jobId, panel });
    emit({ type: "done", jobId, diaryId, panels: [panel] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    const code: GenerationErrorCode = message.includes("COST_GUARD")
      ? "PROVIDER_ERROR"
      : "UNKNOWN";
    console.error(`[Pipeline] 컷 재생성 실패 job=${jobId}`, err);
    emit({
      type: "error",
      jobId,
      code,
      message: "재생성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
      retryable: true,
    });
    await updateDiaryStatus(diaryId, "failed").catch(() => {});
  }
}
