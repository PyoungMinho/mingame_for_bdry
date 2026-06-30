// 모이라 RouteMap 데이터 계약 — docs/design/moira-routemap-design-final.md §4
// 타입 단일 정의점: LatLng, RouteSegment, MemberRoute, RoutePlace

import type { MemberTime } from "./fairness";
import type { Place } from "./mock";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface RouteSegment {
  mode: "subway" | "bus" | "walk" | "car";
  line?: string;       // 호선/버스번호 (예: "2", "143")
  durationMin: number;
  distanceM?: number;  // 도보/차 구간
}

// ── 확정 단일 타입 (§4, §6-B 병합안) ──
export interface MemberRoute extends MemberTime {
  id: string;          // 탭 키·activeMembers 식별자
  avatar: string;      // Avatar 색(hex). 기존 Member.avatar와 동일 소스
  transport: "subway" | "bus" | "walk" | "car" | "mixed"; // 주 이동수단 요약(칩 표기)
  mode: "subway" | "bus" | "walk" | "car"; // 경로선 대시패턴 결정용(mixed면 최장구간 mode)
  segments: RouteSegment[]; // 구간별(환승 구분) — MemberRouteDetail 렌더
  polyline: LatLng[];       // P0: mock 곡선 보간 다점 / P1: ODsay 실경로 다점
  originLatLng: LatLng;     // 출발지 좌표(아바타 마커 위치)
}

export interface RoutePlace extends Place {
  destinationLatLng: LatLng;
  fairScore: number;           // 0~100 (장소 수정 실시간 표시)
  memberRoutes: MemberRoute[];
}

// ── SVG stroke 상수 (색이 아니라 SVG 값 → tailwind.config에 넣지 않음) ──
export const ROUTE_WEIGHT = {
  low: 3,   // 최소 이동시간 멤버
  mid: 5,
  high: 8,  // 최대 손해 멤버
} as const;

export const ROUTE_DIM = 0.22;    // 탭 미선택 경로선 opacity
export const ROUTE_ACTIVE = 1;    // 탭 선택 경로선 opacity

export const ROUTE_DASH = {
  walk: "4 6",
  bus: "12 4",
  subway: "none",
  car: "none",
} as const;

export type RouteWeightKey = keyof typeof ROUTE_WEIGHT;

/**
 * 멤버별 이동시간 목록 → 손해도 순위로 low/mid/high 산출
 * (오래 걸릴수록 high → 굵은 선으로 손해 시각화)
 */
export function routeWeightKey(
  memberMinutes: number,
  allMinutes: number[],
): RouteWeightKey {
  const sorted = [...allMinutes].sort((a, b) => b - a); // 내림차순
  const rank = sorted.indexOf(memberMinutes); // 0 = 가장 오래 걸림
  if (rank === 0) return "high";
  if (rank === sorted.length - 1) return "low";
  return "mid";
}

/**
 * PlaceCandidate — PlaceEditSheet 후보 행 타입
 * (RoutePlace 경량 부분집합, 페이지에서 직접 정의하지 않도록 여기 선언)
 */
export interface PlaceCandidate {
  id: string;
  name: string;
  destinationLatLng: LatLng;
  fairScore: number;
  rank: "A" | "B" | "C";
}
