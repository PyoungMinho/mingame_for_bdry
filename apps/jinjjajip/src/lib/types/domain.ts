/**
 * 진짜집 도메인 타입 계약 — 프론트엔드·백엔드 공통 단일 진실의 원천(SSOT).
 *
 * 출처:
 *  - docs/design/real-estate-design-final.md §6.2(컴포넌트 Props), §10.2(백엔드 데이터 계약)
 *  - docs/planning/real-estate-direction.md (점수 재설계: 100점 만점 배점·컷오프)
 *
 * 규칙(절대 준수):
 *  - earned/score 의 `null` 은 "검증 대기(pending)"이며 0점과 절대 구분한다.
 *  - 신뢰 등급(badgeAchieved)·총점·정렬값은 서버 사전계산 결과를 사용. 프론트 재계산/정렬 금지.
 *  - computeGrade/clampScore 등 순수 함수는 서버 스코어 엔진과 테스트 공용. 프론트는 표시에 backend 값 우선.
 */

/** 신뢰 등급 3종 (색+형태 이중 코드) */
export type TrustGrade = "gold" | "silver" | "unverified";

/** 매물 전체 상태 (화면 분기) */
export type ListingStatus =
  | "verified"
  | "pending"
  | "processing"
  | "reported"
  | "taken_down";

/** 점수 항목 단위 상태 */
export type ScoreItemStatus = "verified" | "pending" | "processing" | "reported";

/** 5대 점수 항목 키 */
export type ScoreItemKey = "photo" | "exif" | "community" | "owner" | "transaction";

/**
 * 항목별 만점 배점 (합계 100) — real-estate-direction.md 재설계본.
 *  photo       35  실거주 세입자 사진
 *  exif        20  EXIF·생활흔적
 *  community   20  커뮤니티 신뢰(신고 이력)
 *  owner       15  소유자·등록자 검증
 *  transaction 10  거래 정황 플래그(간접)
 */
export const SCORE_WEIGHTS: Record<ScoreItemKey, number> = {
  photo: 35,
  exif: 20,
  community: 20,
  owner: 15,
  transaction: 10,
};

export const SCORE_TOTAL = 100;

/** 등급 컷오프 — Gold ≥80 / Silver 55~79 / Unverified <55 (direction.md, Silver 하향 60→55) */
export const GRADE_CUTOFFS = { gold: 80, silver: 55 } as const;

/** 항목 한국어 라벨 (UI 표시·접근성용) */
export const SCORE_ITEM_LABELS: Record<ScoreItemKey, string> = {
  photo: "실거주 세입자 사진",
  exif: "EXIF·생활 흔적",
  community: "커뮤니티 신뢰",
  owner: "소유자·등록자 검증",
  transaction: "거래 정황",
};

/** ScoreBreakdown 한 항목 (design §6.2) */
export interface ScoreBreakdownItem {
  key: ScoreItemKey;
  /** null = pending (0점 아님). 검증 완료 시 0~max 정수 */
  earned: number | null;
  max: number;
  status: ScoreItemStatus;
  /** 항목 신선도 표기용 */
  verifiedAt?: string | null;
  /** 신고 시 예상 감점(음수) */
  deltaIfReported?: number;
}

/** 총점 묶음 (design §10.2 + §4.4 "N점~" 규칙) */
export interface TrustScore {
  /** 현재까지 확정 점수(하한값일 수 있음) */
  score: number;
  /** pending 항목이 있어 "N점~" 하한 표기가 필요한가 */
  isLowerBound: boolean;
  /** pending 전부 만점 가정 시 도달 가능한 최대 점수 */
  maxPossible: number;
  /** 서버 사전계산 등급 — 프론트 표시 권위값 */
  badgeAchieved: TrustGrade;
  breakdown: ScoreBreakdownItem[];
}

/** 검색 카드용 매물 요약 (design §6.2 ListingCardProps) — reported/taken_down 은 리스트 제외 */
export interface ListingSummary {
  id: string;
  title: string;
  address: string;
  /** 보증금 (단위: 만원) */
  deposit: number;
  /** 월세 (단위: 만원, 전세면 0) */
  monthlyRent: number;
  trustScore: number;
  trustGrade: TrustGrade;
  naturalLabel: string;
  thumbnailUrl?: string | null;
  scoreBreakdown: ScoreBreakdownItem[];
  status: "verified" | "pending" | "processing";
  /** 서버 신뢰순 정렬을 위한 사전계산 키 (프론트는 그대로 사용, 재정렬 금지) */
  sortRank?: number;
}

/** 매물 상세 (RSC 렌더) */
export interface ListingDetail extends Omit<ListingSummary, "status"> {
  status: ListingStatus;
  /** 공개 가능한(블러 통과) 사진 URL만 */
  photoUrls: string[];
  description?: string;
  areaM2?: number;
  floor?: string;
  buildingType: "oneroom" | "officetel";
  region: "gwanak" | "mapo";
  trust: TrustScore;
  /** 등록 중개사 표시명 (검증 상태 포함) */
  agent?: { name: string; verified: boolean } | null;
  updatedAt: string;
}

/** 업로드 결과 (PhotoUploader onUploadComplete) */
export interface UploadResult {
  uploadId: string;
  listingId: string;
  acceptedCount: number;
  rejectedCount: number;
  /** 서버 파이프라인 처리 시작 신호. 점수 확정은 Realtime/폴링으로 후속 */
  status: "processing" | "error";
  /**
   * 파이프라인 완료 판별 플래그. 폴링 응답(GET /api/uploads/[uploadId])에서만 채워진다.
   * status 는 'processing'|'error' 두 값만 유지하므로(done 은 status 에 넣지 않음),
   * 프론트는 `result.done === true` 로 완료를 판별한다.
   */
  done?: boolean;
  message?: string;
  /** 처리 완료 후 채워짐(낙관적 표시 금지 — 서버 확정 시에만) */
  scoreDelta?: number | null;
  badgeAchieved?: TrustGrade | null;
}

/** 신고 유형 */
export type ReportReason =
  | "fake_listing" // 허위 매물
  | "wrong_photo" // 사진 불일치
  | "wrong_price" // 가격 상이
  | "already_taken" // 이미 거래 완료
  | "duplicate" // 중복 매물
  | "other";

export interface ReportPayload {
  listingId: string;
  reason: ReportReason;
  detail?: string; // 최대 200자
  evidencePhotoId?: string;
}

/** 검색 쿼리 (서버가 정렬/필터 수행) */
export interface ListingSearchQuery {
  region?: "gwanak" | "mapo";
  buildingType?: "oneroom" | "officetel";
  minGrade?: TrustGrade;
  depositMax?: number;
  rentMax?: number;
  /** 기본 정렬 = 신뢰순(trust). 서버 결정 */
  sort?: "trust" | "recent" | "price_low";
  cursor?: string;
  limit?: number;
}

export interface Paginated<T> {
  items: T[];
  nextCursor?: string | null;
  total?: number;
}

// ──────────────────────────────────────────────────────────
// 순수 함수 (서버 스코어 엔진 + 테스트 공용). 프론트 표시는 서버값 우선.
// ──────────────────────────────────────────────────────────

export function clampScore(score: number): number {
  if (Number.isNaN(score)) return 0;
  return Math.max(0, Math.min(SCORE_TOTAL, Math.round(score)));
}

/** 점수 → 등급. 컷오프 단일 출처. */
export function computeGrade(score: number): TrustGrade {
  const s = clampScore(score);
  if (s >= GRADE_CUTOFFS.gold) return "gold";
  if (s >= GRADE_CUTOFFS.silver) return "silver";
  return "unverified";
}

/**
 * breakdown → TrustScore 집계.
 *  - pending(earned=null) 항목은 현재 점수에서 제외하되 maxPossible 에는 포함 → isLowerBound=true.
 *  - 신고 감점(deltaIfReported)은 status==="reported" 인 항목에만 반영.
 */
export function aggregateTrustScore(breakdown: ScoreBreakdownItem[]): TrustScore {
  let score = 0;
  let maxPossible = 0;
  let hasPending = false;

  for (const item of breakdown) {
    maxPossible += item.max;
    if (item.earned === null || item.status === "pending" || item.status === "processing") {
      hasPending = true;
      continue;
    }
    let earned = item.earned;
    if (item.status === "reported" && item.deltaIfReported) {
      earned = Math.max(0, earned + item.deltaIfReported);
    }
    score += earned;
  }

  const clamped = clampScore(score);
  return {
    score: clamped,
    isLowerBound: hasPending,
    maxPossible: clampScore(maxPossible),
    badgeAchieved: computeGrade(clamped),
    breakdown,
  };
}
