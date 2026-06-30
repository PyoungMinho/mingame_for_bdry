import type { Locale } from "@/i18n/routing";

/**
 * locale 기반 경로 생성 헬퍼
 * en: prefix 없음 (/models/gpt-4o)
 * ko: /ko prefix (/ko/models/gpt-4o)
 */
export function localePath(locale: Locale | string, path: string): string {
  return locale === "en" ? path : `/${locale}${path}`;
}

/**
 * 비교 페어 슬러그 생성 (알파벳 오름차순 강제)
 * 항상 slug_a_vs_slug_b 형식 반환
 */
export function buildComparePair(slugA: string, slugB: string): string {
  const sorted = [slugA, slugB].sort();
  return `${sorted[0]}_vs_${sorted[1]}`;
}

/**
 * N일 전 포맷 (last_verified_at → "N days ago")
 */
export function daysAgo(dateStr: string): number {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

/**
 * 신선도 경고 레벨
 * 0~7일: normal / 8~30일: warning / 31일+: danger
 */
export function freshnessLevel(
  dateStr: string
): "normal" | "warning" | "danger" {
  const days = daysAgo(dateStr);
  if (days <= 7) return "normal";
  if (days <= 30) return "warning";
  return "danger";
}
