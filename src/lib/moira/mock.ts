// 모이라 데모용 목 데이터 — 서울 4인 약속 시나리오
// 강남·노원·사당·홍대에서 출발 → 을지로3가 권역이 가장 공평
import type { MemberTime } from "./fairness";
import type { LatLng, MemberRoute, RoutePlace } from "./route";

export interface Member {
  id: string;
  name: string;
  origin: string; // 출발지
  avatar: string; // 아바타 배경 (브랜드 계열 — 공평성 색과 구분)
  status: "host" | "done" | "waiting";
  originLatLng?: LatLng; // RouteMap용 좌표 (선택 — 기존 코드 무영향)
}

export const MEMBERS: Member[] = [
  {
    id: "me",
    name: "민호",
    origin: "강남구 역삼동",
    avatar: "#6366F1",
    status: "host",
    originLatLng: { lat: 37.5012, lng: 127.0396 }, // 역삼동
  },
  {
    id: "seoyeon",
    name: "서연",
    origin: "노원구 상계동",
    avatar: "#0EA5E9",
    status: "done",
    originLatLng: { lat: 37.6542, lng: 127.0633 }, // 상계동
  },
  {
    id: "jihoon",
    name: "지훈",
    origin: "동작구 사당동",
    avatar: "#14B8A6",
    status: "done",
    originLatLng: { lat: 37.4759, lng: 126.9814 }, // 사당동
  },
  {
    id: "yerin",
    name: "예린",
    origin: "마포구 동교동",
    avatar: "#A855F7",
    status: "waiting",
    originLatLng: { lat: 37.5567, lng: 126.9243 }, // 동교동(홍대 인근)
  },
];

/** 추천 중간역 (헤드라인) */
export const RECOMMENDED_STATION = {
  name: "을지로3가",
  lines: ["2", "3"], // 호선
  reason: "네 명 모두에게 가장 공평한 중간 지점",
};

export type Category = "호프·포차" | "전통시장" | "칼국수" | "카페·전시" | "북카페";

export interface Place {
  id: string;
  name: string;
  category: Category;
  walkMin: number; // 역에서 도보(분)
  blurb: string;
  times: MemberTime[]; // 멤버별 이동시간
  votes: number; // 데모용 현재 득표
}

// times 순서는 MEMBERS 순서(민호·서연·지훈·예린)와 일치
export const PLACES: Place[] = [
  {
    id: "nogari",
    name: "을지로 노가리골목",
    category: "호프·포차",
    walkMin: 2,
    blurb: "노포 감성 야장, 4인 테이블 여유",
    times: [
      { name: "민호", minutes: 22, transfers: 0 },
      { name: "서연", minutes: 28, transfers: 1 },
      { name: "지훈", minutes: 26, transfers: 1 },
      { name: "예린", minutes: 24, transfers: 1 },
    ],
    votes: 2,
  },
  {
    id: "gwangjang",
    name: "광장시장 먹자골목",
    category: "전통시장",
    walkMin: 5,
    blurb: "빈대떡·마약김밥, 가성비 끝판왕",
    times: [
      { name: "민호", minutes: 24, transfers: 0 },
      { name: "서연", minutes: 30, transfers: 1 },
      { name: "지훈", minutes: 27, transfers: 1 },
      { name: "예린", minutes: 25, transfers: 1 },
    ],
    votes: 1,
  },
  {
    id: "ddp",
    name: "DDP 디자인장터",
    category: "카페·전시",
    walkMin: 6,
    blurb: "전시 보고 카페, 사진 맛집",
    times: [
      { name: "민호", minutes: 26, transfers: 0 },
      { name: "서연", minutes: 28, transfers: 1 },
      { name: "지훈", minutes: 31, transfers: 1 },
      { name: "예린", minutes: 29, transfers: 1 },
    ],
    votes: 0,
  },
  {
    id: "myeongdong",
    name: "명동 백년칼국수",
    category: "칼국수",
    walkMin: 8,
    blurb: "줄서는 노포, 진한 사골",
    times: [
      { name: "민호", minutes: 20, transfers: 0 },
      { name: "서연", minutes: 34, transfers: 2 },
      { name: "지훈", minutes: 28, transfers: 1 },
      { name: "예린", minutes: 26, transfers: 1 },
    ],
    votes: 0,
  },
  {
    id: "motif",
    name: "충무로 모티프원",
    category: "북카페",
    walkMin: 4,
    blurb: "조용한 책방 카페, 대화 집중",
    times: [
      { name: "민호", minutes: 23, transfers: 0 },
      { name: "서연", minutes: 31, transfers: 1 },
      { name: "지훈", minutes: 29, transfers: 1 },
      { name: "예린", minutes: 27, transfers: 1 },
    ],
    votes: 0,
  },
];

/** 확정 약속 메타(데모) */
export const APPOINTMENT = {
  placeId: "nogari",
  date: "6월 14일 (토)",
  time: "오후 7:00",
  address: "서울 중구 을지로13길 일대",
};

// ──────────────────────────────────────────────────────────────────
// RouteMap 전용 — ROUTE_PLACES (기존 PLACES 무손상, 가산)
// destinationLatLng: 을지로3가역 인근
// polyline: 2차 베지어 보간 8~12점 (실경로 같은 곡선감)
// ──────────────────────────────────────────────────────────────────

/** 2차 베지어 보간 — t=0..1 사이 n개 점 생성 */
function bezier2(
  p0: LatLng,
  p1: LatLng, // 제어점
  p2: LatLng,
  steps = 10,
): LatLng[] {
  const pts: LatLng[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    pts.push({
      lat: mt * mt * p0.lat + 2 * mt * t * p1.lat + t * t * p2.lat,
      lng: mt * mt * p0.lng + 2 * mt * t * p1.lng + t * t * p2.lng,
    });
  }
  return pts;
}

const DEST_EULJI: LatLng = { lat: 37.5663, lng: 126.9927 }; // 을지로3가역

// 민호(강남 역삼) → 을지로3가: 2호선 곡선
const POLY_MINHO = bezier2(
  { lat: 37.5012, lng: 127.0396 },
  { lat: 37.5210, lng: 127.0280 }, // 제어점: 서초-강남 중간
  DEST_EULJI,
  10,
);

// 서연(노원 상계) → 을지로3가: 4호선+환승 곡선
const POLY_SEOYEON = bezier2(
  { lat: 37.6542, lng: 127.0633 },
  { lat: 37.6150, lng: 127.0120 }, // 제어점: 창동 방면
  DEST_EULJI,
  11,
);

// 지훈(동작 사당) → 을지로3가: 4호선 직행 곡선
const POLY_JIHOON = bezier2(
  { lat: 37.4759, lng: 126.9814 },
  { lat: 37.5140, lng: 126.9770 }, // 제어점: 이수 방면
  DEST_EULJI,
  10,
);

// 예린(마포 동교동) → 을지로3가: 2호선 곡선
const POLY_YERIN = bezier2(
  { lat: 37.5567, lng: 126.9243 },
  { lat: 37.5610, lng: 126.9530 }, // 제어점: 홍대-신촌 중간
  DEST_EULJI,
  9,
);

const MEMBER_ROUTES_NOGARI: MemberRoute[] = [
  {
    id: "me",
    name: "민호",
    avatar: "#6366F1",
    minutes: 22,
    transfers: 0,
    transport: "subway",
    mode: "subway",
    originLatLng: { lat: 37.5012, lng: 127.0396 },
    polyline: POLY_MINHO,
    segments: [
      { mode: "walk", durationMin: 3, distanceM: 200 },
      { mode: "subway", line: "2", durationMin: 17 },
      { mode: "walk", durationMin: 2, distanceM: 150 },
    ],
  },
  {
    id: "seoyeon",
    name: "서연",
    avatar: "#0EA5E9",
    minutes: 28,
    transfers: 1,
    transport: "subway",
    mode: "subway",
    originLatLng: { lat: 37.6542, lng: 127.0633 },
    polyline: POLY_SEOYEON,
    segments: [
      { mode: "walk", durationMin: 4, distanceM: 280 },
      { mode: "subway", line: "4", durationMin: 18 },
      { mode: "subway", line: "2", durationMin: 4 },
      { mode: "walk", durationMin: 2, distanceM: 150 },
    ],
  },
  {
    id: "jihoon",
    name: "지훈",
    avatar: "#14B8A6",
    minutes: 26,
    transfers: 1,
    transport: "subway",
    mode: "subway",
    originLatLng: { lat: 37.4759, lng: 126.9814 },
    polyline: POLY_JIHOON,
    segments: [
      { mode: "walk", durationMin: 5, distanceM: 350 },
      { mode: "subway", line: "4", durationMin: 19 },
      { mode: "walk", durationMin: 2, distanceM: 150 },
    ],
  },
  {
    id: "yerin",
    name: "예린",
    avatar: "#A855F7",
    minutes: 24,
    transfers: 1,
    transport: "subway",
    mode: "subway",
    originLatLng: { lat: 37.5567, lng: 126.9243 },
    polyline: POLY_YERIN,
    segments: [
      { mode: "walk", durationMin: 6, distanceM: 400 },
      { mode: "subway", line: "2", durationMin: 16 },
      { mode: "walk", durationMin: 2, distanceM: 150 },
    ],
  },
];

export const ROUTE_PLACES: RoutePlace[] = [
  {
    id: "nogari",
    name: "을지로 노가리골목",
    category: "호프·포차",
    walkMin: 2,
    blurb: "노포 감성 야장, 4인 테이블 여유",
    times: [
      { name: "민호", minutes: 22, transfers: 0 },
      { name: "서연", minutes: 28, transfers: 1 },
      { name: "지훈", minutes: 26, transfers: 1 },
      { name: "예린", minutes: 24, transfers: 1 },
    ],
    votes: 2,
    destinationLatLng: DEST_EULJI,
    fairScore: 82,
    memberRoutes: MEMBER_ROUTES_NOGARI,
  },
  {
    id: "gwangjang",
    name: "광장시장 먹자골목",
    category: "전통시장",
    walkMin: 5,
    blurb: "빈대떡·마약김밥, 가성비 끝판왕",
    times: [
      { name: "민호", minutes: 24, transfers: 0 },
      { name: "서연", minutes: 30, transfers: 1 },
      { name: "지훈", minutes: 27, transfers: 1 },
      { name: "예린", minutes: 25, transfers: 1 },
    ],
    votes: 1,
    destinationLatLng: { lat: 37.5700, lng: 127.0095 }, // 광장시장
    fairScore: 74,
    memberRoutes: MEMBER_ROUTES_NOGARI.map((r) => ({
      ...r,
      minutes: r.minutes + 2,
    })),
  },
  {
    id: "ddp",
    name: "DDP 디자인장터",
    category: "카페·전시",
    walkMin: 6,
    blurb: "전시 보고 카페, 사진 맛집",
    times: [
      { name: "민호", minutes: 26, transfers: 0 },
      { name: "서연", minutes: 28, transfers: 1 },
      { name: "지훈", minutes: 31, transfers: 1 },
      { name: "예린", minutes: 29, transfers: 1 },
    ],
    votes: 0,
    destinationLatLng: { lat: 37.5675, lng: 127.0094 }, // DDP
    fairScore: 68,
    memberRoutes: MEMBER_ROUTES_NOGARI.map((r) => ({
      ...r,
      minutes: r.minutes + 3,
    })),
  },
];
