import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 만원 단위 금액을 한국식으로 표기.
 * 예) 500 → "500만", 10000 → "1억", 11500 → "1억 1,500만", 0 → "0"
 */
export function formatManwon(manwon: number): string {
  if (!manwon) return "0";
  const eok = Math.floor(manwon / 10000);
  const rest = manwon % 10000;
  const parts: string[] = [];
  if (eok > 0) parts.push(`${eok.toLocaleString("ko-KR")}억`);
  if (rest > 0) parts.push(`${rest.toLocaleString("ko-KR")}만`);
  return parts.join(" ");
}

/**
 * 보증금/월세 → "보증금 1,000만 / 월 50" 형태.
 * monthlyRent=0 이면 전세로 간주.
 */
export function formatDepositRent(deposit: number, monthlyRent: number): string {
  if (monthlyRent === 0) return `전세 ${formatManwon(deposit)}`;
  return `${formatManwon(deposit)} / 월 ${monthlyRent.toLocaleString("ko-KR")}`;
}
