/**
 * 툰일기 컴포넌트 디자인 시스템 — 배럴 export
 * 페이지개발자 import 경로: @/components
 *
 * 예시:
 *   import { Button, Textarea, TabBar, ToastContainer, useToastStore } from "@/components";
 */

// ─── P0 컴포넌트 ───────────────────────────────────────────────────────────

/** Button (5변형: primary / secondary / ghost / danger / icon) */
export { Button } from "./ui/Button";
export type { ButtonProps } from "./ui/Button";

/** TextInput (6상태) */
export { TextInput } from "./ui/TextInput";
export type { TextInputProps } from "./ui/TextInput";

/** Textarea (일기 입력 — 종이 질감, 카운터 n/300, aria-live) */
export { Textarea } from "./ui/Textarea";
export type { TextareaProps } from "./ui/Textarea";

/** BottomSheet */
export { BottomSheet } from "./ui/BottomSheet";
export type { BottomSheetProps } from "./ui/BottomSheet";

/** Chip / Tag (selected 상태 필수) */
export { Chip } from "./ui/Chip";
export type { ChipProps } from "./ui/Chip";

/** Card (기본) + ComicCard (4컷: 2px ink border + shadow-ink) */
export { Card, ComicCard } from "./ui/Card";
export type { CardProps, ComicCardProps } from "./ui/Card";

/** ProgressBar + GeneratingUI (4컷 스켈레톤 + 팁 로테이션) */
export { ProgressBar, GeneratingUI } from "./ui/ProgressBar";
export type { ProgressBarProps, GeneratingUIProps } from "./ui/ProgressBar";

/** Skeleton + ComicCardSkeleton + DiaryListItemSkeleton */
export { Skeleton, ComicCardSkeleton, DiaryListItemSkeleton } from "./ui/Skeleton";
export type { SkeletonProps } from "./ui/Skeleton";

/** AvatarSelector (8종 그리드 + 커스텀 슬라이더) */
export { AvatarSelector } from "./ui/AvatarSelector";
export type { AvatarSelectorProps } from "./ui/AvatarSelector";

/** ArtStyleCard (화풍 선택 카드 4종) */
export { ArtStyleCard } from "./ui/ArtStyleCard";
export type { ArtStyleCardProps } from "./ui/ArtStyleCard";

/** Toast (5타입) + ToastContainer + useToastStore */
export {
  ToastContainer,
  useToastStore,
  toastStore,
} from "./ui/Toast";
export type { ToastItem, ToastType } from "./ui/Toast";

/** TabBar + FAB (4탭, 56px, safe-area, aria-selected) */
export { TabBar } from "./ui/TabBar";
export type { TabBarProps, TabId } from "./ui/TabBar";

/** QuotaChip (잔여 한도, 0일 때 error색+아이콘+텍스트 3중) */
export { QuotaChip, QuotaChipFromInfo } from "./ui/QuotaChip";
export type { QuotaChipProps } from "./ui/QuotaChip";

/** WatermarkOverlay (tier 분기: 무료 큼+QR / 베이직 소형 / 프로 off) */
export { WatermarkOverlay } from "./ui/WatermarkOverlay";
export type { WatermarkOverlayProps } from "./ui/WatermarkOverlay";

/** AIDisclosureBadge (전 티어 필수, 제거 불가 — 법무 의무) */
export { AIDisclosureBadge } from "./ui/AIDisclosureBadge";
export type { AIDisclosureBadgeProps } from "./ui/AIDisclosureBadge";

// ─── P1 컴포넌트 ───────────────────────────────────────────────────────────

/** Toast 단일 컴포넌트 (페이지 내 인라인용, ToastContainer와 별개) */
export { Toast } from "./ui/Toast";
export type { ToastInlineProps } from "./ui/Toast";

/** StreakBadge (연속 기록 배지: 아이콘+숫자+텍스트 3중, 색각 대응) */
export { StreakBadge } from "./ui/StreakBadge";
export type { StreakBadgeProps } from "./ui/StreakBadge";

/** EmptyState (SVG 120px + H3 + Body + CTA) */
export { EmptyState } from "./ui/EmptyState";
export type { EmptyStateProps } from "./ui/EmptyState";

/** SegmentedToggle (2~3 세그먼트) */
export { SegmentedToggle } from "./ui/SegmentedToggle";
export type { SegmentedToggleProps } from "./ui/SegmentedToggle";

/** Toggle (스위치 토글, 다크모드/알림 등) */
export { Toggle } from "./ui/Toggle";
export type { ToggleProps } from "./ui/Toggle";

/** CalendarView + DateCell (7열, 썸네일/오늘/빈 3상태) */
export { CalendarView } from "./ui/CalendarView";
export type { CalendarViewProps } from "./ui/CalendarView";
