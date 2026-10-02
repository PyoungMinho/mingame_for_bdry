/**
 * `src/app/gung/components` 공개 API — §5 전부. 프레젠테이션 전용(상태 로직·`src/lib/gung` 엔진 import 없음).
 * 화면 조립(screens/)·상태(lib/useGame.ts 등)는 @페이지개발자 담당.
 */

// 앱 프레임
export { GuFrame, type GuFrameProps } from './GuFrame';
export { GuHeader, type GuHeaderProps } from './GuHeader';
export { PhaseRail, type PhaseRailProps } from './PhaseRail';
export { BottomTabs, type BottomTabsProps, type GuTabKey } from './BottomTabs';
export { ActionBar, type ActionBarProps } from './ActionBar';
export { GuButton, type GuButtonProps, type GuButtonVariant } from './GuButton';

// 프라이버시 · 내 패 · 단서
export { SealedCard, type SealedCardProps } from './SealedCard';
export { RoleCard, MemoryBlock, type RoleCardProps } from './RoleCard';
export { SectionChips, type SectionChipsProps } from './SectionChips';
export { ClueCard, type ClueCardProps } from './ClueCard';
export { DisclosureToggle, type DisclosureToggleProps } from './DisclosureToggle';
export { RoundTagText, splitRoundTags, type RoundTagTextProps, type RoundTagPart } from './RoundTagText';
export { circledNum } from './numbering';

// 장소 · 자리
export { PlaceGrid, type PlaceGridProps } from './PlaceGrid';
export { SeatRing, type SeatRingProps } from './SeatRing';
export { SeatGrid, type SeatGridProps } from './SeatGrid';

// 타이머 · 지목
export { IncenseTimer, type IncenseTimerProps } from './IncenseTimer';
export { CountdownOverlay, type CountdownOverlayProps, type CountdownWord } from './CountdownOverlay';
export { VoteStepper, type VoteStepperProps } from './VoteStepper';
export { TallyBars, type TallyBarsProps, type TallyRow } from './TallyBars';

// 진상 · 결과
export { RevealScroll, type RevealScrollProps } from './RevealScroll';
export { SealStamp, type SealStampProps, type SealStampText } from './SealStamp';
export { ScoreRow, type ScoreRowProps, type ScoreMission } from './ScoreRow';

// 방 코드 · 입력
export { RoomCode, type RoomCodeProps } from './RoomCode';
export { CodeInput, type CodeInputProps } from './CodeInput';

// 오버레이 · 피드백
export { BottomSheet, type BottomSheetProps } from './BottomSheet';
export { Toast, type ToastProps } from './Toast';
export { Banner, type BannerProps } from './Banner';
export { HostCue, type HostCueProps } from './HostCue';
export { GateTimelineBar, type GateTimelineBarProps, type GateTimelineView } from './GateTimelineBar';
export { TermList, type TermListProps, TimeTable, type TimeTableProps } from './Glossary';

// 공유 · 결과 이미지
export { ShareActions, type ShareActionsProps } from './ShareActions';
export { ResultImageModal, type ResultImageModalProps } from './ResultImageModal';

// 아이콘
export { RoleIcon, type RoleIconProps, PlaceIcon, type PlaceIconProps } from './icons';

// 공유 프레젠테이션 타입
export * from './types';
