/**
 * 동네고수 — 공용 타입
 * 데이터 계약: scripts/dongne/build-regions.mjs 산출물(manifest.json / silhouettes/{code}.json)과 1:1
 */

export interface LatLng {
  lat: number;
  lng: number;
}

/** manifest.json 항목 1개 = 시군구 1곳 */
export interface Region {
  /** KOSTAT 행정코드(내부 안정 ID) — 정답 판정은 문자열이 아니라 이 코드 일치로만 */
  code: string;
  /** 표시명 (일반구는 "수원시 장안구" 공백 표기) */
  name: string;
  /** 시도 축약 표기 — "(강원)" 배지용 */
  sido: string;
  /** 시도 공식 전체명 (강원특별자치도 등 2026 현재 명칭) */
  sidoFull: string;
  /** 동명 구분 표기 — 동명 지역·특별/광역시 자치구는 "이름(시도)" */
  nameWithSido: string;
  /** 자동완성 별칭 ("강남"→강남구, "수원"→수원시 4구 등) */
  aliases: string[];
  /** pole of inaccessibility — 거리·방위·근접도 힌트의 기준점 */
  centroid: LatLng;
  /** 지리 bbox [minLng, minLat, maxLng, maxLat] (원본 전체 범위) */
  bbox: [number, number, number, number];
}

/** silhouettes/{code}.json — 오늘 회차만 온디맨드 fetch */
export interface Silhouette {
  code: string;
  /** 항상 "0 0 100 100" — 정북 고정·미러 금지·fit-to-frame 88% 사전 정규화 완료 */
  viewBox: string;
  /** 단일 path d (다중 서브패스 가능) — fill-rule="evenodd"로 렌더할 것 */
  d: string;
}

export type Direction8 = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

/** 시도 1회의 기록 (localStorage 저장 단위) */
export interface Guess {
  /** 추측한 지역 코드 (표시명은 manifest 조회) */
  code: string;
  /** 정답 centroid까지 정수 km (정답이면 0) */
  distanceKm: number;
  /** 추측→정답 8방위 (정답이면 null) */
  direction: Direction8 | null;
  /** 근접도 0~99 (정답이면 100) */
  proximity: number;
  correct: boolean;
}

export type GameStatus = 'playing' | 'won' | 'lost';

/** localStorage `dongne:state:{gameNo}` */
export interface GameState {
  gameNo: number;
  guesses: Guess[];
  status: GameStatus;
  updatedAt: number;
}

/** localStorage 누적 통계 */
export interface PlayerStats {
  totalPlays: number;
  wins: number;
  currentStreak: number;
  maxStreak: number;
  lastPlayedGameNo: number | null;
  /** [1회 성공, 2회, 3회, 4회, 5회, 6회, 실패] 히스토그램 */
  histogram: [number, number, number, number, number, number, number];
}
