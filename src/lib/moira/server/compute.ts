// 라이브 실계산 오케스트레이션 (서버 전용)
// 멤버 주소 → 지오코딩 → 허브 프리필터(호출 절감) → ODsay 매트릭스 → 공평 목적함수 → Scenario.
// 키 없음 → {mode:"demo"} · 실패 → {mode:"error"} → 프론트가 시드(buildScenario)로 폴백.
// 공평 가중치는 백엔드 표준(MOIRA_SCORE_ALPHA/BETA/GAMMA, result 라우트와 동일).

import { fairLevel, type MemberTime } from "../fairness";
import type { LatLng, MemberRoute, RoutePlace } from "../route";
import type { Member, Place } from "../mock";
import { HUBS, haversineKm, curveBetween, type Hub, type Scenario } from "../scenario";
import { geocode, geoConfigured } from "./geo";
import { transitTime, odsayConfigured, type TransitResult } from "./odsay";

const A = Number(process.env.MOIRA_SCORE_ALPHA ?? 0.4);
const B = Number(process.env.MOIRA_SCORE_BETA ?? 0.4);
const G = Number(process.env.MOIRA_SCORE_GAMMA ?? 0.2);

const PREFILTER_HUBS = 4; // ODsay 호출 절감: 7개 허브 중 그룹 중심 근접 top-4만 조회

export interface ComputeMember {
  id: string;
  name: string;
  avatar: string;
  address?: string; // 주소·장소명 (지오코딩 대상)
  latLng?: LatLng; // 이미 좌표가 있으면 지오코딩 skip (고정 친구 등)
}

export type ComputeOutcome =
  | { mode: "live"; scenario: Scenario }
  | { mode: "demo" } // 키 미설정 → 프론트 시드 폴백
  | { mode: "error"; message: string }; // 지오코딩/경로 실패 → 프론트 시드 폴백

function stddev(xs: number[]): number {
  if (!xs.length) return 0;
  const m = xs.reduce((s, x) => s + x, 0) / xs.length;
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length);
}
function objectiveEnv(mins: number[]): number {
  const avg = mins.reduce((s, x) => s + x, 0) / mins.length;
  return A * avg + B * Math.max(...mins) + G * stddev(mins);
}
const gapOf = (ts: MemberTime[]) =>
  Math.max(...ts.map((t) => t.minutes)) - Math.min(...ts.map((t) => t.minutes));

export async function computeScenario(members: ComputeMember[]): Promise<ComputeOutcome> {
  if (!odsayConfigured() || !geoConfigured()) return { mode: "demo" };
  if (members.length < 2) return { mode: "error", message: "최소 2명의 출발지가 필요해요." };

  // 1) 좌표 확보 — 주소만 있으면 지오코딩
  const located = await Promise.all(
    members.map(async (m) => {
      if (m.latLng) return { ...m, latLng: m.latLng };
      if (!m.address) return null;
      const ll = await geocode(m.address);
      return ll ? { ...m, latLng: ll } : null;
    }),
  );
  if (located.some((x) => !x)) return { mode: "error", message: "일부 출발지를 찾지 못했어요." };
  const mem = located as (ComputeMember & { latLng: LatLng })[];

  // 2) 허브 프리필터 — 그룹 중심에서 가까운 top-4 (ODsay 호출 절감)
  const centroid: LatLng = {
    lat: mem.reduce((s, m) => s + m.latLng.lat, 0) / mem.length,
    lng: mem.reduce((s, m) => s + m.latLng.lng, 0) / mem.length,
  };
  const hubs = [...HUBS]
    .sort((a, b) => haversineKm(a.latLng, centroid) - haversineKm(b.latLng, centroid))
    .slice(0, PREFILTER_HUBS);

  // 3) ODsay 매트릭스 (멤버 × 허브). 한 허브라도 경로 실패 시 그 허브 제외
  const matrix = await Promise.all(
    hubs.map(async (hub) => {
      const legs = await Promise.all(mem.map((m) => transitTime(m.latLng, hub.latLng)));
      return legs.every(Boolean) ? { hub, legs: legs as TransitResult[] } : null;
    }),
  );
  const valid = matrix.filter(Boolean) as { hub: Hub; legs: TransitResult[] }[];
  if (!valid.length) return { mode: "error", message: "대중교통 경로를 찾지 못했어요." };

  // 4) 가장 공평한 허브
  const best = valid
    .map((v) => ({ ...v, obj: objectiveEnv(v.legs.map((l) => l.minutes)) }))
    .sort((a, b) => a.obj - b.obj)[0];
  const hub = best.hub;

  // 5) 조립 — 멤버 시간(허브 도착) + 장소별 도보 가산
  const hubTimes: MemberTime[] = mem.map((m, i) => ({
    name: m.name,
    minutes: best.legs[i].minutes,
    transfers: best.legs[i].transfers,
  }));

  const places: Place[] = hub.places.map((hp, pi) => ({
    id: hp.id,
    name: hp.name,
    category: hp.category,
    walkMin: hp.walkMin,
    blurb: hp.blurb,
    times: hubTimes.map((t) => ({
      name: t.name,
      minutes: t.minutes + Math.round(hp.walkMin / 2),
      transfers: t.transfers,
    })),
    votes: pi === 0 ? 2 : pi === 1 ? 1 : 0,
  }));

  const ranked = [...places].sort((a, b) => gapOf(a.times) - gapOf(b.times));
  const routePlaces: RoutePlace[] = ranked.slice(0, 3).map((place) => {
    const memberRoutes: MemberRoute[] = mem.map((m, i) => {
      const leg = best.legs[i];
      return {
        id: m.id,
        name: m.name,
        avatar: m.avatar,
        minutes: place.times[i].minutes,
        transfers: leg.transfers,
        transport: leg.mainMode,
        mode: leg.mainMode,
        originLatLng: m.latLng,
        polyline: leg.polyline.length >= 2 ? leg.polyline : curveBetween(m.latLng, hub.latLng, i),
        segments: leg.segments,
      };
    });
    const gap = gapOf(place.times);
    return {
      ...place,
      destinationLatLng: hub.latLng,
      fairScore: Math.max(38, Math.min(96, Math.round(96 - gap * 1.4))),
      memberRoutes,
    };
  });

  const level = fairLevel(gapOf(ranked[0].times));
  const reason =
    level === "good"
      ? `${mem.length}명 모두에게 가장 공평한 중간 지점`
      : level === "mid"
        ? `${mem.length}명에게 비교적 균형 잡힌 중간 지점`
        : `출발지가 멀어 완벽히 공평하긴 어려운 조합 — 그중 가장 균형에 가까운 곳`;

  const outMembers: Member[] = mem.map((m, i) => ({
    id: m.id,
    name: m.name,
    origin: m.address ?? "",
    avatar: m.avatar,
    status: i === 0 ? "host" : "done",
    originLatLng: m.latLng,
  }));

  return {
    mode: "live",
    scenario: {
      originId: "live",
      members: outMembers,
      station: { name: hub.name, lines: hub.lines, reason },
      places,
      routePlaces,
    },
  };
}
