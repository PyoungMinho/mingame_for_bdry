// REDLINE: 타인 비교/외모 점수 UI 금지
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind 클래스 병합 헬퍼 — clsx + tailwind-merge */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** YYYY-MM-DD 문자열로 오늘 날짜 반환 */
export function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

/** 만 나이 계산 — 생년월일(Date) 입력 */
export function calcAge(birthDate: Date): number {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }
  return age;
}

/** 만 16세 이상 여부 */
export function isAgeEligible(birthDate: Date): boolean {
  return calcAge(birthDate) >= 16;
}

/** 가입일 기준 경과 일수 계산 */
export function daysSince(isoDate: string): number {
  const from = new Date(isoDate);
  const now = new Date();
  const diff = now.getTime() - from.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}
