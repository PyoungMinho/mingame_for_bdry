// ODsay 대중교통 길찾기 — 좌표→좌표 실경로 (서버 전용, ODSAY_API_KEY)
// searchPubTransPathT: 소요시간·환승·경유정류장. 키 없거나 경로 없으면 null.
// 폴리라인 = passStopList(경유 정류장 좌표) 꺾은선 → 그래픽 API 미사용 = 추가 호출 0
// (기획 확정: docs/planning/moira-routemap-techreview.md §2-1).

import type { LatLng } from "../route";

const ENDPOINT = "https://api.odsay.com/v1/api/searchPubTransPathT";

export function odsayConfigured(): boolean {
  return !!process.env.ODSAY_API_KEY;
}

export type TransitMode = "subway" | "bus" | "walk";

export interface TransitSegment {
  mode: TransitMode;
  line?: string; // 노선명(2호선 / 143번 등)
  durationMin: number;
  distanceM?: number;
}

export interface TransitResult {
  minutes: number;
  transfers: number;
  polyline: LatLng[]; // 출발 → 경유정류장 → 도착
  segments: TransitSegment[];
  mainMode: TransitMode; // 최장 비도보 구간(칩 표기용)
}

// ODsay 응답(부분) — 필요한 필드만 느슨하게 정의
interface OdsayStation { x?: number | string; y?: number | string }
interface OdsayLane { name?: string; busNo?: string; subwayCode?: number }
interface OdsaySubPath {
  trafficType: number; // 1=지하철 2=버스 3=도보
  sectionTime?: number;
  distance?: number;
  lane?: OdsayLane[];
  passStopList?: { stations?: OdsayStation[] };
}
interface OdsayPath {
  info?: { totalTime?: number; busTransitCount?: number; subwayTransitCount?: number };
  subPath?: OdsaySubPath[];
}
interface OdsayResponse {
  result?: { path?: OdsayPath[] };
  error?: unknown;
}

function num(v: number | string | undefined): number | null {
  if (v === undefined) return null;
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : null;
}

function modeOf(trafficType: number): TransitMode {
  return trafficType === 1 ? "subway" : trafficType === 2 ? "bus" : "walk";
}

function laneLabel(sp: OdsaySubPath): string | undefined {
  const lane = sp.lane?.[0];
  if (!lane) return undefined;
  if (sp.trafficType === 1) return lane.name; // 지하철 노선명
  if (sp.trafficType === 2) return lane.busNo ?? lane.name; // 버스 번호
  return undefined;
}

/** 좌표 A→B 실제 대중교통 경로. 키 없음/무경로/오류 시 null(상위가 폴백). */
export async function transitTime(from: LatLng, to: LatLng): Promise<TransitResult | null> {
  const key = process.env.ODSAY_API_KEY;
  if (!key) return null;
  const url =
    `${ENDPOINT}?SX=${from.lng}&SY=${from.lat}&EX=${to.lng}&EY=${to.lat}` +
    `&OPT=0&SearchType=0&apiKey=${encodeURIComponent(key)}`;
  let json: OdsayResponse;
  try {
    const res = await fetch(url, { next: { revalidate: 60 * 30 } });
    if (!res.ok) return null;
    json = (await res.json()) as OdsayResponse;
  } catch {
    return null;
  }
  if (json.error || !json.result?.path?.length) return null;

  const path = json.result.path[0];
  const info = path.info ?? {};
  const minutes = Math.round(info.totalTime ?? 0);
  if (minutes <= 0) return null;
  const transfers = Math.max(
    0,
    (info.busTransitCount ?? 0) + (info.subwayTransitCount ?? 0) - 1,
  );

  const subPaths = path.subPath ?? [];
  const segments: TransitSegment[] = [];
  const polyline: LatLng[] = [from];

  for (const sp of subPaths) {
    const mode = modeOf(sp.trafficType);
    if ((sp.sectionTime ?? 0) > 0 || mode !== "walk") {
      segments.push({
        mode,
        line: laneLabel(sp),
        durationMin: Math.round(sp.sectionTime ?? 0),
        distanceM: sp.distance,
      });
    }
    // 경유 정류장 좌표를 이어 폴리라인 구성(꺾은선)
    for (const st of sp.passStopList?.stations ?? []) {
      const lat = num(st.y);
      const lng = num(st.x);
      if (lat !== null && lng !== null) polyline.push({ lat, lng });
    }
  }
  polyline.push(to);

  // 주 이동수단 = 최장 비도보 구간
  const mainMode: TransitMode =
    segments
      .filter((s) => s.mode !== "walk")
      .sort((a, b) => b.durationMin - a.durationMin)[0]?.mode ?? "walk";

  return {
    minutes,
    transfers,
    polyline: polyline.length >= 2 ? polyline : [from, to],
    segments: segments.length ? segments : [{ mode: mainMode, durationMin: minutes }],
    mainMode,
  };
}
