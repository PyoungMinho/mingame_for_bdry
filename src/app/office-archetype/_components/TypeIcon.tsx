"use client";

import {
  HardHat,
  Ruler,
  CheckCheck,
  Sprout,
  PartyPopper,
  Scale,
  Headphones,
  SlidersHorizontal,
  HelpCircle,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";

/**
 * 유형 아이콘 매퍼 — 8색/이름/아이콘은 절대 하드코딩하지 않는다.
 * 이 매퍼는 오직 "OaType.icon(kebab-case 문자열) → lucide 컴포넌트" 변환만 담당하고,
 * 실제 어떤 유형에 어떤 아이콘을 쓸지는 전부 data/types.json이 결정한다.
 *
 * design-final §3-2에 등장하는 8개 아이콘을 기본 매핑에 포함하되, 후속 시리즈가
 * 새 아이콘 키를 쓰면 이 맵에 추가하기만 하면 된다(컴포넌트 로직 변경 불필요).
 * 매핑에 없는 키는 HelpCircle로 안전 폴백(런타임 크래시 방지).
 */
const ICON_MAP: Record<string, LucideIcon> = {
  "hard-hat": HardHat,
  ruler: Ruler,
  "check-check": CheckCheck,
  sprout: Sprout,
  "party-popper": PartyPopper,
  scale: Scale,
  headphones: Headphones,
  "sliders-horizontal": SlidersHorizontal,
};

export interface TypeIconProps extends Omit<LucideProps, "ref"> {
  /** data/types.json의 OaType.icon 값 (kebab-case) */
  icon: string;
}

/** kebab-case 아이콘 키를 받아 해당 lucide 아이콘을 렌더링한다. */
export default function TypeIcon({ icon, ...svgProps }: TypeIconProps) {
  const Icon = ICON_MAP[icon] ?? HelpCircle;
  return <Icon aria-hidden="true" {...svgProps} />;
}

/** icon 키가 매핑에 존재하는지 확인(placeholder 데이터 QA용). */
export function isKnownIcon(icon: string): boolean {
  return icon in ICON_MAP;
}
