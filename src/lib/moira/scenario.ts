// 모이라 시드 시나리오 엔진 — 0원(API 없이 좌표+근사식으로) 출발지별 재계산.
// 목적: 사용자가 '내 출발지'를 프리셋(강남/봉천/소래포구/한대앞/목감/광명)으로 바꾸면
//       추천 중간지점·이동시간·경로가 실제로 다시 계산돼 바뀌는 데모.
// ⚠️ 실제 대중교통 시간(ODsay)은 P1. 여기는 직선거리 기반 '근사치'다(공평 '순서'는 신뢰 가능).
// 안전장치: 기본값(gangnam)은 기존 검증된 을지로3가 큐레이트 데모를 그대로 반환 → G2 기본 무손상.

import { fairLevel, type MemberTime } from "./fairness";
import type { LatLng, MemberRoute, RoutePlace } from "./route";
import {
  MEMBERS,
  PLACES,
  RECOMMENDED_STATION,
  ROUTE_PLACES,
  type Category,
  type Member,
  type Place,
} from "./mock";

// ──────────────────────────────────────────────────────────
// 1. 출발지 프리셋 (호스트 '내 출발지' 선택지)
// ──────────────────────────────────────────────────────────
export interface OriginPreset {
  id: string;
  label: string; // "봉천역"
  sub: string; // "관악구 · 2호선"
  latLng: LatLng;
  transport: "subway" | "bus"; // 목감사거리는 지하철 없음 → bus
}

export const ORIGIN_PRESETS: OriginPreset[] = [
  { id: "gangnam", label: "강남역", sub: "강남구 · 2호선", latLng: { lat: 37.498, lng: 127.0276 }, transport: "subway" },
  { id: "bongcheon", label: "봉천역", sub: "관악구 · 2호선", latLng: { lat: 37.4824, lng: 126.9419 }, transport: "subway" },
  { id: "soraepogu", label: "소래포구역", sub: "인천 남동구 · 수인분당선", latLng: { lat: 37.4004, lng: 126.7378 }, transport: "subway" },
  { id: "handaeap", label: "한대앞역", sub: "안산 · 4호선/수인분당", latLng: { lat: 37.3096, lng: 126.8523 }, transport: "subway" },
  { id: "mokgam", label: "목감사거리", sub: "시흥 목감 · 버스", latLng: { lat: 37.3739, lng: 126.8757 }, transport: "bus" },
  { id: "gwangmyeong", label: "광명사거리역", sub: "광명 · 7호선", latLng: { lat: 37.4772, lng: 126.8664 }, transport: "subway" },
];

export const DEFAULT_ORIGIN_ID = "gangnam";

/** 입력 텍스트/칩 선택 → 프리셋 id. 라벨을 포함하면 매칭, 아니면 기본(강남). */
export function resolveOriginId(text: string | null | undefined): string {
  if (!text) return DEFAULT_ORIGIN_ID;
  const t = text.trim();
  const hit = ORIGIN_PRESETS.find((p) => t.includes(p.label) || t.includes(p.label.replace(/역$/, "")));
  return hit ? hit.id : DEFAULT_ORIGIN_ID;
}

export function getOriginPreset(originId: string): OriginPreset {
  return ORIGIN_PRESETS.find((p) => p.id === originId) ?? ORIGIN_PRESETS[0];
}

// ──────────────────────────────────────────────────────────
// 2. 후보 만남 허브 (서울·경기 서남 축 포함)
// ──────────────────────────────────────────────────────────
interface HubPlace {
  id: string;
  name: string;
  category: Category;
  walkMin: number;
  blurb: string;
}
interface Hub {
  id: string;
  name: string;
  lines: string[];
  latLng: LatLng;
  places: HubPlace[]; // 3개 (경로지도는 상위 3개 사용)
}

const HUBS: Hub[] = [
  {
    id: "euljiro3",
    name: "을지로3가",
    lines: ["2", "3"],
    latLng: { lat: 37.5663, lng: 126.9927 },
    places: [
      { id: "nogari", name: "을지로 노가리골목", category: "호프·포차", walkMin: 2, blurb: "노포 감성 야장, 여유 좌석" },
      { id: "gwangjang", name: "광장시장 먹자골목", category: "전통시장", walkMin: 6, blurb: "빈대떡·마약김밥, 가성비" },
      { id: "euljimyeon", name: "을지면옥 칼국수", category: "칼국수", walkMin: 4, blurb: "슴슴한 평양식, 줄서는 노포" },
    ],
  },
  {
    id: "seoulstn",
    name: "서울역",
    lines: ["1", "4"],
    latLng: { lat: 37.5547, lng: 126.9707 },
    places: [
      { id: "namdaemun", name: "남대문 갈치조림골목", category: "전통시장", walkMin: 7, blurb: "얼큰 갈치조림, 노포 밀집" },
      { id: "seoullo", name: "서울로 루프탑 카페", category: "카페·전시", walkMin: 5, blurb: "고가공원 뷰, 사진 맛집" },
      { id: "jungrim", name: "중림동 손칼국수", category: "칼국수", walkMin: 8, blurb: "진한 사골, 로컬 단골집" },
    ],
  },
  {
    id: "sindorim",
    name: "신도림",
    lines: ["1", "2"],
    latLng: { lat: 37.5088, lng: 126.8912 },
    places: [
      { id: "dcube", name: "디큐브 루프탑", category: "카페·전시", walkMin: 3, blurb: "몰 위 정원 카페, 넓은 좌석" },
      { id: "sindopocha", name: "신도림 포차거리", category: "호프·포차", walkMin: 5, blurb: "퇴근길 야장, 4인 테이블" },
      { id: "dorimcheon", name: "도림천 손칼국수", category: "칼국수", walkMin: 7, blurb: "가마솥 육수, 현지인 맛집" },
    ],
  },
  {
    id: "yeongdeungpo",
    name: "영등포",
    lines: ["1"],
    latLng: { lat: 37.5157, lng: 126.9074 },
    places: [
      { id: "timesquare", name: "타임스퀘어 다이닝", category: "카페·전시", walkMin: 4, blurb: "몰 맛집 총집합, 실내" },
      { id: "sundaetown", name: "영등포 순대타운", category: "전통시장", walkMin: 6, blurb: "얼큰 순댓국, 노포 밀집" },
      { id: "ydppocha", name: "영등포 노포호프", category: "호프·포차", walkMin: 5, blurb: "옛날 통닭·생맥, 야장" },
    ],
  },
  {
    id: "guro",
    name: "구로디지털단지",
    lines: ["2"],
    latLng: { lat: 37.4853, lng: 126.9014 },
    places: [
      { id: "gvalley", name: "G밸리 먹자골목", category: "호프·포차", walkMin: 4, blurb: "직장인 회식 성지, 넓은 홀" },
      { id: "gurosijang", name: "구로시장 먹자", category: "전통시장", walkMin: 7, blurb: "가성비 노포, 골목 먹거리" },
      { id: "digitalbook", name: "디지털단지 북카페", category: "북카페", walkMin: 3, blurb: "조용한 책방 카페, 대화 집중" },
    ],
  },
  {
    id: "sadang",
    name: "사당",
    lines: ["2", "4"],
    latLng: { lat: 37.4765, lng: 126.9816 },
    places: [
      { id: "sadangmeokja", name: "사당 먹자골목", category: "호프·포차", walkMin: 3, blurb: "환승 요지, 늦게까지 야장" },
      { id: "isubrunch", name: "이수 브런치책방", category: "북카페", walkMin: 6, blurb: "조용한 브런치, 대화 좋음" },
      { id: "namseong", name: "남성역 손칼국수", category: "칼국수", walkMin: 8, blurb: "얼큰 바지락, 로컬 노포" },
    ],
  },
  {
    id: "geumjeong",
    name: "금정",
    lines: ["1", "4"],
    latLng: { lat: 37.3719, lng: 126.9435 },
    places: [
      { id: "geumjeongnopo", name: "금정역 노포호프", category: "호프·포차", walkMin: 4, blurb: "환승 요지, 저렴한 야장" },
      { id: "sanbon", name: "산본 로데오 카페", category: "카페·전시", walkMin: 6, blurb: "로데오거리, 젊은 카페" },
      { id: "anyangsijang", name: "안양 중앙시장 먹자", category: "전통시장", walkMin: 9, blurb: "경기 남부 노포, 가성비" },
    ],
  },
];

// ──────────────────────────────────────────────────────────
// 3. 거리·시간 근사 (0원, 직선거리 기반)
// ──────────────────────────────────────────────────────────
function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** 직선거리(km) → 대중교통 근사 이동시간(분)+환승수. 경로 우회 계수 1.3 반영. */
function proxyTime(km: number): { minutes: number; transfers: number } {
  const routeKm = km * 1.3; // 도로/노선 우회
  const minutes = Math.round(5 + routeKm * 1.9); // 승하차·도보 base + 약 32km/h
  const transfers = km < 6 ? 0 : km < 13 ? 1 : 2;
  return { minutes: minutes + transfers * 2, transfers };
}

function stddev(xs: number[]): number {
  if (xs.length === 0) return 0;
  const m = xs.reduce((s, x) => s + x, 0) / xs.length;
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length);
}

/** 공평 목적함수 — 낮을수록 공평 (기획 확정: α·평균 + β·최대 + γ·표준편차) */
function objective(minutes: number[]): number {
  const avg = minutes.reduce((s, x) => s + x, 0) / minutes.length;
  const max = Math.max(...minutes);
  return 0.5 * avg + 0.3 * max + 0.2 * stddev(minutes);
}

// ──────────────────────────────────────────────────────────
// 4. 폴리라인 생성 (출발지→허브 2차 베지어 곡선)
// ──────────────────────────────────────────────────────────
function bezier2(p0: LatLng, p1: LatLng, p2: LatLng, steps = 10): LatLng[] {
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

/** 출발지→목적지 자연스러운 곡선(수직 방향으로 살짝 부풀림). idx로 좌우 교차. */
function curveBetween(o: LatLng, d: LatLng, idx: number): LatLng[] {
  const mid = { lat: (o.lat + d.lat) / 2, lng: (o.lng + d.lng) / 2 };
  const dLat = d.lat - o.lat;
  const dLng = d.lng - o.lng;
  const side = idx % 2 === 0 ? 1 : -1;
  const k = 0.14 * side;
  const control = { lat: mid.lat - dLng * k, lng: mid.lng + dLat * k };
  return bezier2(o, control, d, 10);
}

// ──────────────────────────────────────────────────────────
// 5. 시나리오 빌드
// ──────────────────────────────────────────────────────────
export interface Scenario {
  originId: string;
  members: Member[];
  station: { name: string; lines: string[]; reason: string };
  places: Place[];
  routePlaces: RoutePlace[];
}

/** 기본(강남) = 기존 검증된 큐레이트 데모 그대로. */
function curatedScenario(): Scenario {
  return {
    originId: DEFAULT_ORIGIN_ID,
    members: MEMBERS,
    station: RECOMMENDED_STATION,
    places: PLACES,
    routePlaces: ROUTE_PLACES,
  };
}

export function buildScenario(originId: string): Scenario {
  if (originId === DEFAULT_ORIGIN_ID) return curatedScenario();
  const preset = ORIGIN_PRESETS.find((p) => p.id === originId);
  if (!preset) return curatedScenario();

  // 멤버 좌표: 호스트=프리셋, 친구 3인=기존 고정(노원/사당/홍대)
  const host = { ...MEMBERS[0], origin: preset.label, originLatLng: preset.latLng };
  const friends = MEMBERS.slice(1);
  const members: Member[] = [host, ...friends];
  const originLatLngs = members.map((m) => m.originLatLng as LatLng);

  // 가장 공평한 허브 선정
  const scored = HUBS.map((hub) => {
    const mins = originLatLngs.map((o) => proxyTime(haversineKm(o, hub.latLng)).minutes);
    return { hub, mins, obj: objective(mins) };
  }).sort((a, b) => a.obj - b.obj);
  const best = scored[0];
  const hub = best.hub;

  // 멤버별 허브 도착 시간·환승
  const hubTimes: MemberTime[] = members.map((m, i) => {
    const { minutes, transfers } = proxyTime(haversineKm(originLatLngs[i], hub.latLng));
    return { name: m.name, minutes, transfers };
  });

  // 장소별 이동시간 = 허브시간 + 도보/미세편차(결정적) → 공평 '순서'가 장소마다 살짝 다름
  const places: Place[] = hub.places.map((hp, pi) => {
    const times: MemberTime[] = hubTimes.map((t, i) => ({
      name: t.name,
      minutes: t.minutes + Math.round(hp.walkMin / 2) + (((i * 7 + pi * 3) % 5) - 2),
      transfers: t.transfers,
    }));
    return { id: hp.id, name: hp.name, category: hp.category, walkMin: hp.walkMin, blurb: hp.blurb, times, votes: pi === 0 ? 2 : pi === 1 ? 1 : 0 };
  });

  // 경로지도용 RoutePlace (상위 3개, 공평 순 정렬)
  const gapOfLocal = (ts: MemberTime[]) => Math.max(...ts.map((t) => t.minutes)) - Math.min(...ts.map((t) => t.minutes));
  const rankedPlaces = [...places].sort((a, b) => gapOfLocal(a.times) - gapOfLocal(b.times));

  const routePlaces: RoutePlace[] = rankedPlaces.slice(0, 3).map((place) => {
    const dest = { ...hub.latLng };
    const memberRoutes: MemberRoute[] = members.map((m, i) => {
      const isHost = i === 0;
      const mode: MemberRoute["mode"] = isHost && preset.transport === "bus" ? "bus" : "subway";
      const transport: MemberRoute["transport"] = isHost && preset.transport === "bus" ? "bus" : "subway";
      const t = place.times[i];
      const segs = isHost && preset.transport === "bus"
        ? [{ mode: "bus" as const, line: "간선", durationMin: Math.max(6, t.minutes - 12) }, { mode: "subway" as const, line: hub.lines[0], durationMin: 10 }, { mode: "walk" as const, durationMin: 2, distanceM: 150 }]
        : [{ mode: "walk" as const, durationMin: 4, distanceM: 260 }, { mode: "subway" as const, line: hub.lines[0], durationMin: Math.max(6, t.minutes - 8) }, { mode: "walk" as const, durationMin: 2, distanceM: 150 }];
      return {
        id: m.id,
        name: m.name,
        avatar: m.avatar,
        minutes: t.minutes,
        transfers: t.transfers,
        transport,
        mode,
        originLatLng: originLatLngs[i],
        polyline: curveBetween(originLatLngs[i], dest, i),
        segments: segs,
      };
    });
    const gap = gapOfLocal(place.times);
    const fairScore = Math.max(38, Math.min(96, Math.round(96 - gap * 1.4)));
    return { ...place, destinationLatLng: dest, fairScore, memberRoutes };
  });

  // 추천 카피 — 격차가 크면 정직하게(멀면 완벽 공평은 불가, 그중 최선)
  const bestGap = gapOfLocal(rankedPlaces[0].times);
  const level = fairLevel(bestGap);
  const reason =
    level === "good"
      ? `${members.length}명 모두에게 가장 공평한 중간 지점`
      : level === "mid"
        ? `${members.length}명에게 비교적 균형 잡힌 중간 지점`
        : `출발지가 멀어 완벽히 공평하긴 어려운 조합 — 그중 가장 균형에 가까운 곳`;

  return {
    originId,
    members,
    station: { name: hub.name, lines: hub.lines, reason },
    places,
    routePlaces,
  };
}
