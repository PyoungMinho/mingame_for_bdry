// 모이라 공평성 로직 — design-system/moira/MASTER.md §3
// 색은 '오직 공평도'만 의미한다. 격차(max-min)로 등급을 가른다.

export type FairLevel = "good" | "mid" | "bad";

export interface MemberTime {
  name: string;
  minutes: number;
  transfers?: number;
}

/** 멤버 간 이동시간 격차(분) = 최대 - 최소 */
export function gapOf(members: MemberTime[]): number {
  if (members.length === 0) return 0;
  const xs = members.map((m) => m.minutes);
  return Math.max(...xs) - Math.min(...xs);
}

/** 평균 이동시간(분, 반올림) */
export function avgOf(members: MemberTime[]): number {
  if (members.length === 0) return 0;
  return Math.round(members.reduce((s, m) => s + m.minutes, 0) / members.length);
}

/** 격차 → 공평 등급 */
export function fairLevel(gapMinutes: number): FairLevel {
  if (gapMinutes <= 10) return "good";
  if (gapMinutes <= 20) return "mid";
  return "bad";
}

export interface FairStyle {
  bar: string; // 막대 fill
  barSoft: string; // 막대 연한 fill(비강조 멤버)
  text: string; // 강조 텍스트
  chipBg: string; // 뱃지 배경
  chipText: string; // 뱃지 글자
  ring: string; // 선택 테두리
  label: string; // 한 줄 카피
}

export const FAIR_STYLE: Record<FairLevel, FairStyle> = {
  good: {
    bar: "bg-moira-fair-good",
    barSoft: "bg-emerald-200",
    text: "text-moira-fair-good",
    chipBg: "bg-emerald-50",
    chipText: "text-emerald-700",
    ring: "ring-moira-fair-good",
    label: "가장 공평",
  },
  mid: {
    bar: "bg-moira-fair-mid",
    barSoft: "bg-amber-200",
    text: "text-moira-fair-mid",
    chipBg: "bg-amber-50",
    chipText: "text-amber-700",
    ring: "ring-moira-fair-mid",
    label: "공평한 편",
  },
  bad: {
    bar: "bg-moira-fair-bad",
    barSoft: "bg-rose-200",
    text: "text-moira-fair-bad",
    chipBg: "bg-rose-50",
    chipText: "text-rose-700",
    ring: "ring-moira-fair-bad",
    label: "격차 큼",
  },
};

/** 한 줄 카피: "격차 6분 · 가장 공평" */
export function fairCopy(members: MemberTime[]): string {
  const g = gapOf(members);
  return `격차 ${g}분 · ${FAIR_STYLE[fairLevel(g)].label}`;
}
