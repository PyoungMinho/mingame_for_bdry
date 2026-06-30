/**
 * generation_jobs 쿼리 헬퍼
 * SSE 스트리밍 단계별 상태 관리.
 */

import type { GenerationJob, JobStage } from "../contract";
import { supabaseServer } from "./client";
import type { GenerationJobRow } from "./types";

function rowToJob(row: GenerationJobRow): GenerationJob {
  return {
    jobId: row.id,
    diaryId: row.diary_id,
    stage: row.stage,
    completedPanels: row.completed_panels,
    totalPanels: 4,
  };
}

/**
 * 생성 잡 생성. diary_id 에 묶인 잡을 만들고 UUID 반환.
 * diaries.status = 'queued' 인 상태에서만 호출.
 */
export async function createJob(diaryId: string): Promise<string> {
  const db = supabaseServer();
  const { data, error } = await db
    .from("generation_jobs")
    .insert({ diary_id: diaryId, stage: "queued", completed_panels: 0 })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`createJob failed: ${error?.message ?? "unknown"}`);
  }
  return data.id;
}

/**
 * 잡 단계 갱신. SSE 단계 변경 시 호출.
 * completedPanels: 1컷 완성될 때마다 +1.
 */
export async function updateJobStage(
  jobId: string,
  stage: JobStage,
  completedPanels?: number
): Promise<void> {
  const db = supabaseServer();
  const update: { stage: JobStage; completed_panels?: number } = { stage };
  if (completedPanels !== undefined) {
    update.completed_panels = completedPanels;
  }
  const { error } = await db
    .from("generation_jobs")
    .update(update)
    .eq("id", jobId);

  if (error) throw new Error(`updateJobStage failed: ${error.message}`);
}

/**
 * 잡 단건 조회. SSE 재연결 시 클라이언트가 현재 상태 확인용.
 */
export async function getJob(jobId: string): Promise<GenerationJob | null> {
  const db = supabaseServer();
  const { data, error } = await db
    .from("generation_jobs")
    .select("*")
    .eq("id", jobId)
    .single();

  if (error || !data) return null;
  return rowToJob(data as GenerationJobRow);
}

/**
 * diaryId 로 가장 최근 잡 조회.
 * 프론트 SSE 훅(useSSEGeneration)이 streamUrl 의 jobId 쿼리 없이 연결할 때
 * stream route 가 활성 잡을 추론하기 위한 fallback.
 */
export async function getLatestJobByDiary(
  diaryId: string
): Promise<GenerationJob | null> {
  const db = supabaseServer();
  const { data, error } = await db
    .from("generation_jobs")
    .select("*")
    .eq("diary_id", diaryId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  return rowToJob(data as GenerationJobRow);
}

/**
 * 잡 실패 기록. error_code 저장 + stage='finalizing' 으로 마무리.
 * diaries.status = 'failed' 로도 같이 갱신해야 함 (updateDiaryStatus 병행 호출).
 */
export async function failJob(jobId: string, errorCode: string): Promise<void> {
  const db = supabaseServer();
  const { error } = await db
    .from("generation_jobs")
    .update({ stage: "finalizing", error_code: errorCode })
    .eq("id", jobId);

  if (error) throw new Error(`failJob failed: ${error.message}`);
}
