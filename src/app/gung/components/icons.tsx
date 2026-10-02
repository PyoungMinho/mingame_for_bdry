/**
 * §5-21 아이콘 매핑 — lucide-react 고정 세트(^0.381, 이번 범위에서 존재 확인).
 * 커스텀 실루엣 SVG는 §14 Phase 2 항목("역할/장소 커스텀 실루엣 SVG")이라 이번 범위에서 만들지 않는다.
 */
import {
  BedDouble,
  BookOpen,
  CookingPot,
  Crown,
  DoorClosed,
  Flame,
  FlaskConical,
  Flower2,
  KeyRound,
  Landmark,
  MapPin,
  Pill,
  ScrollText,
  Sword,
  Trees,
  UserRound,
  Warehouse,
  Waves,
  type LucideIcon,
} from 'lucide-react';
import type { PlaceIconKey, RoleIconKey } from './types';

const ROLE_ICON: Record<RoleIconKey, LucideIcon> = {
  crown: Crown,
  flower: Flower2,
  scroll: ScrollText,
  pill: Pill,
  key: KeyRound,
  sword: Sword,
  person: UserRound,
};

const PLACE_ICON: Record<PlaceIconKey, LucideIcon> = {
  bed: BedDouble,
  pot: CookingPot,
  flask: FlaskConical,
  trees: Trees,
  hall: Landmark,
  door: DoorClosed,
  flame: Flame,
  waves: Waves,
  book: BookOpen,
  warehouse: Warehouse,
  pin: MapPin,
};

export interface RoleIconProps {
  iconKey: RoleIconKey;
  size?: number;
  className?: string;
}

/** 역할 실루엣·문양 아이콘(§5-21). 이름은 항상 옆에 병기한다(§11 접근성) — 아이콘 단독 사용 금지. */
export function RoleIcon({ iconKey, size = 20, className }: RoleIconProps) {
  const Icon = ROLE_ICON[iconKey] ?? UserRound;
  return <Icon aria-hidden focusable={false} size={size} strokeWidth={1.75} className={className ? `gu-icon ${className}` : 'gu-icon'} />;
}

export interface PlaceIconProps {
  iconKey: PlaceIconKey;
  size?: number;
  className?: string;
}

export function PlaceIcon({ iconKey, size = 20, className }: PlaceIconProps) {
  const Icon = PLACE_ICON[iconKey] ?? MapPin;
  return <Icon aria-hidden focusable={false} size={size} strokeWidth={1.75} className={className ? `gu-icon ${className}` : 'gu-icon'} />;
}
