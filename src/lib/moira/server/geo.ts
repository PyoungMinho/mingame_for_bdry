// 카카오 로컬 지오코딩 — 주소·장소명 → 좌표 (서버 전용, KAKAO_REST_KEY)
// 키 없으면 null 반환 → 상위(compute)가 demo 폴백으로 처리.
// 주소검색(정확 주소) 실패 시 키워드검색(역·장소명)으로 폴백 → "봉천역" 같은 입력도 해석.

import type { LatLng } from "../route";

const ADDRESS_URL = "https://dapi.kakao.com/v2/local/search/address.json";
const KEYWORD_URL = "https://dapi.kakao.com/v2/local/search/keyword.json";

export function geoConfigured(): boolean {
  return !!process.env.KAKAO_REST_KEY;
}

interface KakaoDoc {
  x: string; // 경도(lng)
  y: string; // 위도(lat)
  address_name?: string;
  place_name?: string;
  road_address_name?: string;
}

async function query(url: string, q: string, key: string): Promise<LatLng | null> {
  const res = await fetch(`${url}?query=${encodeURIComponent(q)}&size=1`, {
    headers: { Authorization: `KakaoAK ${key}` },
    // 카카오 로컬은 캐시 안전 — 동일 주소는 재사용 가능(호출 절감)
    next: { revalidate: 60 * 60 * 24 },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { documents?: KakaoDoc[] };
  const doc = json.documents?.[0];
  if (!doc) return null;
  const lat = parseFloat(doc.y);
  const lng = parseFloat(doc.x);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

/** 주소·장소명 → 좌표. 주소검색 우선, 실패 시 키워드검색 폴백. 키 없거나 못 찾으면 null. */
export async function geocode(input: string): Promise<LatLng | null> {
  const key = process.env.KAKAO_REST_KEY;
  if (!key) return null;
  const q = input.trim();
  if (!q) return null;
  try {
    return (await query(ADDRESS_URL, q, key)) ?? (await query(KEYWORD_URL, q, key));
  } catch {
    return null;
  }
}
