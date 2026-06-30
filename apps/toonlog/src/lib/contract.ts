/**
 * 툰일기 프론트엔드 ↔ 백엔드 공유 계약 (SSOT for types)
 * 출처: docs/design/design-final.md §6(말풍선/아바타/화풍) + docs/planning/project-direction.md §2(아키텍처)
 *
 * 규칙
 * - 프론트(페이지/컴포넌트개발자)와 백엔드(API/DB설계자)는 모두 이 타입을 향해 구현한다.
 * - 백엔드는 이 계약을 OpenAPI/zod로 확장하되 필드명/의미를 바꾸지 않는다(변경 시 팀장 합의).
 * - 한글 텍스트는 이미지에 미생성 — 말풍선/캡션은 좌표 메타만 백엔드가 반환, 텍스트는 프론트 오버레이.
 */

/* ─────────────────────────── 티어 / 화풍 / 아바타 ─────────────────────────── */

export type Tier = "free" | "basic" | "pro";

/** 화풍 4종 — design-final §6.1 (UI 노출명은 constants.ART_STYLES) */
export type ArtStyleKey =
  | "emotional_line" // 감성 라인
  | "bold_pen" // 대담한 펜선
  | "pop_cartoon" // 팝 카툰
  | "watercolor_touch"; // 수채 터치

/** 아바타 변수 enum — design-final §6.2 (API 계약: 영문 enum 고정) */
export type AvatarHairColor =
  | "black" | "brown" | "blonde" | "red" | "pink" | "blue" | "green" | "white";
export type AvatarTopStyle =
  | "white-top" | "stripe" | "hoodie" | "uniform" | "casual" | "formal" | "sport" | "vintage";
export type AvatarAccessory = "glasses" | "hat" | "earphone" | "none";

export interface AvatarConfig {
  preset?: string; // ui-spec §9.4 preset key (예: SHORT_HAIR_GIRL)
  hairColor: AvatarHairColor;
  topStyle: AvatarTopStyle;
  accessory: AvatarAccessory;
  /** 캐릭터 일관성 시드 고정 — project-direction 아키텍처 #2 */
  seed: number;
}

/* ─────────────────────────── 말풍선 메타 (design-final §6.3) ─────────────────────────── */

export type BalloonType = "speech" | "thought" | "shout" | "whisper";

/** 꼬리 8방위 */
export type TailDirection = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";

/**
 * 말풍선 메타데이터. 백엔드는 좌표/타입/꼬리만 반환(한글 미생성 원칙).
 * x/y/w/h 는 "컷 기준 0~1 정규화" 좌표.
 */
export interface BalloonMeta {
  id: string;
  type: BalloonType;
  tail: TailDirection;
  x: number; // 0~1
  y: number; // 0~1
  w: number; // 0~1
  h: number; // 0~1
  /** 백엔드 빈 값 또는 LLM 제안. 최종 텍스트는 프론트 입력 */
  suggested_text?: string;
}

/* ─────────────────────────── 패널 / 일기 / 만화 ─────────────────────────── */

export type PanelIndex = 1 | 2 | 3 | 4;

export interface Panel {
  index: PanelIndex;
  /** 생성된 컷 이미지 URL (한글 없는 순수 이미지) */
  imageUrl: string;
  /** 무료 티어 미리보기용 512px 다운스케일 URL (있으면 우선 노출) */
  previewUrl?: string;
  /** LLM이 생성한 컷 장면 요약 (alt 텍스트/접근성) */
  caption?: string;
  balloons: BalloonMeta[];
}

export type DiaryStatus =
  | "draft" // 작성 중
  | "queued" // 생성 큐 대기
  | "generating" // 생성 중
  | "completed" // 4컷 완성
  | "failed"; // 실패

export interface Diary {
  id: string;
  userId: string;
  /** 원문 일기 (50~300자) — 서버 저장 시 암호화 */
  text: string;
  artStyle: ArtStyleKey;
  avatar: AvatarConfig;
  status: DiaryStatus;
  panels: Panel[];
  createdAt: string; // ISO8601
  updatedAt: string;
}

/* ─────────────────────────── 생성 잡 / SSE 스트리밍 ─────────────────────────── */

export type JobStage =
  | "queued"
  | "splitting" // LLM 4컷 분절
  | "drawing" // 이미지 생성(멀티턴)
  | "checking" // 얼굴 임베딩 일관성 검사
  | "finalizing"; // 말풍선 메타/썸네일

export interface GenerationJob {
  jobId: string;
  diaryId: string;
  stage: JobStage;
  completedPanels: number; // 0~4
  totalPanels: 4;
}

/**
 * SSE 이벤트 (project-direction 아키텍처 #4: 1컷부터 즉시 노출).
 * 프론트는 discriminated union 으로 처리. 백엔드는 `event:`/`data:` 라인으로 직렬화.
 */
export type ToonlogSSEEvent =
  | { type: "status"; jobId: string; stage: JobStage }
  | { type: "panel"; jobId: string; panel: Panel } // 1컷 완성 즉시 push
  | { type: "progress"; jobId: string; completed: number; total: 4 }
  | { type: "tip"; text: string } // 대기 팁 로테이션(이탈 방어)
  | { type: "done"; jobId: string; diaryId: string; panels: Panel[] }
  | {
      type: "error";
      jobId: string;
      code: GenerationErrorCode;
      message: string;
      retryable: boolean;
    };

export type GenerationErrorCode =
  | "MODERATION_BLOCKED_INPUT"
  | "MODERATION_BLOCKED_OUTPUT"
  | "QUOTA_EXCEEDED"
  | "PROVIDER_ERROR"
  | "CONSISTENCY_FAILED"
  | "TIMEOUT"
  | "UNKNOWN";

/* ─────────────────────────── Quota / 구독 ─────────────────────────── */

export interface QuotaInfo {
  tier: Tier;
  /** 잔여 생성 가능 컷(=만화) 수. 무료=일 1 */
  remaining: number;
  /** 주기 한도 */
  limit: number;
  /** 한도 리셋 시각(ISO) */
  resetAt: string;
  /** 보유 크레딧(크레딧 팩) */
  credits: number;
}

/* ─────────────────────────── API 요청/응답 DTO ─────────────────────────── */

export interface CreateDiaryRequest {
  text: string; // 50~300자
  artStyle: ArtStyleKey;
  avatar: AvatarConfig;
}

export interface CreateDiaryResponse {
  diaryId: string;
  jobId: string;
  /** SSE 구독 경로 */
  streamUrl: string; // 예: /api/diary/:id/stream
}

export interface RegenerateRequest {
  diaryId: string;
  /** 특정 컷만 재생성 시 지정, 없으면 전체 */
  panelIndex?: PanelIndex;
}

/** 공유 카드 비율 — design-final §7 */
export type ShareRatio = "1:1" | "16:9" | "9:16";

export interface ShareCardRequest {
  diaryId: string;
  ratio: ShareRatio;
}

export interface ApiError {
  code: string;
  message: string;
}

/* 표준 응답 래퍼(선택) */
export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiError };
