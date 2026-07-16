/**
 * 동네고수 — 시간·출제 단일 진실 소스 (방향서 §2 · 리스크 R5)
 *
 * 게임 페이지·아카이브·OG 라우트·ping API는 전부 이 모듈만 import 한다.
 * 규칙(위반 금지):
 *  - KST = 고정 UTC+9 산술. `toLocaleString`/로컬 타임존/Intl 시간대 사용 금지 (한국 DST 없음)
 *  - Math.random 금지 — 출제는 순수 시드 함수(전 유저·전 환경 동일 결과)
 *  - 이 모듈은 지역 "코드"만 안다 (name/centroid 없음 → OG가 import 해도 정답 유출 표면 없음)
 */

import { REGION_CODES, REGION_COUNT } from './region-codes';
import type { Direction8, LatLng } from './types';

export { REGION_CODES, REGION_COUNT } from './region-codes';

/** game #1의 KST 날짜. 배포일 변경 시 이 상수 1개만 수정한다. */
export const EPOCH_KST = '2026-07-16';

/** 근접도 분모 — 대한민국 대각 최대(제주~고성 ≈690km) 상단 (기획서 §2-2) */
export const MAX_DIST_KM = 700;

const DAY_MS = 86_400_000;
const KST_OFFSET_MS = 9 * 3_600_000;

/** EPOCH_KST 달력일의 일련번호(1970-01-01 기준 일수) */
const EPOCH_DAY = (() => {
  const [y, m, d] = EPOCH_KST.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
})();

/** UTC timestamp → 그 시각이 속한 KST 달력일의 일련번호 */
function kstDayNumber(utcMs: number): number {
  return Math.floor((utcMs + KST_OFFSET_MS) / DAY_MS);
}

/**
 * 오늘(KST)의 회차. EPOCH_KST 당일 = 1, 매 KST 자정마다 +1.
 * EPOCH 이전 시각이면 0 이하가 나올 수 있다 — 호출측에서 `>= 1` 가드.
 */
export function getTodayGameNo(now: Date = new Date()): number {
  return kstDayNumber(now.getTime()) - EPOCH_DAY + 1;
}

/** 회차의 KST 날짜 'YYYY-MM-DD' (아카이브·해설 표기용) */
export function getDateForGame(gameNo: number): string {
  return new Date((EPOCH_DAY + gameNo - 1) * DAY_MS).toISOString().slice(0, 10);
}

/** 다음 KST 자정(= 다음 문제 공개 시각)의 Date — 카운트다운은 이 함수만 사용 */
export function getMidnightKST(now: Date = new Date()): Date {
  return new Date((kstDayNumber(now.getTime()) + 1) * DAY_MS - KST_OFFSET_MS);
}

/** 다음 KST 자정까지 남은 ms */
export function msUntilMidnightKST(now: Date = new Date()): number {
  return getMidnightKST(now).getTime() - now.getTime();
}

// ---------------- 결정론 출제 큐 ----------------

const SEED_BASE = 0x646f_6e67; // 'dong'

/** splitmix32 — 순수 시드 PRNG (Math.random 대체) */
function splitmix32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x9e3779b9) | 0;
    let t = a ^ (a >>> 16);
    t = Math.imul(t, 0x21f0aaad);
    t = t ^ (t >>> 15);
    t = Math.imul(t, 0x735a2d97);
    return ((t ^ (t >>> 15)) >>> 0) / 4_294_967_296;
  };
}

/**
 * 같은 시(市) 분구 그룹 키 — KOSTAT 코드 5번째 자리가 0이 아니면 분구.
 * 예: 31011~31014(수원시 4구) → '3101'. 그 외는 코드 자신(그룹 없음).
 */
function cityGroup(code: string): string {
  return code[4] !== '0' ? code.slice(0, 4) : code;
}

const cycleCache = new Map<number, readonly string[]>();

/**
 * cycle(0부터)의 출제 순서 — 전 지역 1바퀴(REGION_COUNT일) 소진 후 재셔플.
 * 시드 셔플 후 결정론 보정 2종(인접 반복 회피):
 *  (a) 직전 사이클 마지막 7개 지역이 새 사이클 첫 7일에 재등장 금지 (사이클 경계 반복 회피)
 *  (b) 같은 시 분구(수원시 장안구↔권선구 등) 이틀 연속 출제 회피
 */
function cycleOrder(cycle: number): readonly string[] {
  const cached = cycleCache.get(cycle);
  if (cached) return cached;

  const rng = splitmix32((SEED_BASE ^ Math.imul(cycle + 1, 0x9e3779b9)) >>> 0);
  const order = [...REGION_CODES];
  // Fisher-Yates
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  const prev = cycle > 0 ? cycleOrder(cycle - 1) : null;
  const prevTail: ReadonlySet<string> = prev ? new Set(prev.slice(-7)) : new Set();
  const prevLastGroup = prev ? cityGroup(prev[prev.length - 1]) : null;

  const conflict = (idx: number, code: string): boolean =>
    (idx < 7 && prevTail.has(code)) ||
    (idx === 0 && prevLastGroup !== null && prevLastGroup === cityGroup(code)) ||
    (idx > 0 && cityGroup(order[idx - 1]) === cityGroup(code));

  // 단일 전방 패스 보정(결정론): 충돌 위치의 원소를 뒤쪽의 무충돌 후보와 스왑.
  // 스왑으로 뒤로 밀린 원소는 루프가 그 위치에 도달했을 때 다시 검사된다.
  for (let i = 0; i < order.length; i++) {
    if (!conflict(i, order[i])) continue;
    for (let j = i + 1; j < order.length; j++) {
      if (conflict(i, order[j])) continue;
      [order[i], order[j]] = [order[j], order[i]];
      break;
    }
  }

  cycleCache.set(cycle, order);
  return order;
}

/** gameNo(1부터) → 정답 지역 코드. 전 유저·전 환경 동일(순수 결정론). */
export function getRegionCodeForGame(gameNo: number): string {
  if (!Number.isInteger(gameNo) || gameNo < 1) {
    throw new RangeError(`invalid gameNo: ${gameNo}`);
  }
  const dayIndex = gameNo - 1;
  const cycle = Math.floor(dayIndex / REGION_COUNT);
  return cycleOrder(cycle)[dayIndex % REGION_COUNT];
}

/** 오늘(KST) 정답 지역 코드 (EPOCH 이전이면 RangeError — 호출측 가드) */
export function getTodayRegionCode(now: Date = new Date()): string {
  return getRegionCodeForGame(getTodayGameNo(now));
}

// ---------------- 힌트 계산 (haversine · 8방위 · 근접도) ----------------

const toRad = (deg: number): number => (deg * Math.PI) / 180;

/** 두 지점 간 haversine 거리(km, 반올림 전 원값) */
export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** from→to 초기 방위각(0~360°, 북=0·시계방향) */
export function bearingDeg(from: LatLng, to: LatLng): number {
  const p1 = toRad(from.lat);
  const p2 = toRad(to.lat);
  const dl = toRad(to.lng - from.lng);
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

const DIRECTIONS: readonly Direction8[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

/** 방위각 → 8방위 (각 45° 구간, ±22.5° 경계) */
export function toDirection8(bearing: number): Direction8 {
  return DIRECTIONS[Math.round((((bearing % 360) + 360) % 360) / 45) % 8];
}

/** 8방위 → 텍스트 화살표 (공유 텍스트·온스크린 공용 — 색 아님, 트레이드드레스 무관) */
export const DIRECTION_ARROW: Record<Direction8, string> = {
  N: '↑', NE: '↗', E: '→', SE: '↘', S: '↓', SW: '↙', W: '←', NW: '↖',
};

/** 8방위 → 한글 축약 라벨 */
export const DIRECTION_KO: Record<Direction8, string> = {
  N: '북', NE: '북동', E: '동', SE: '남동', S: '남', SW: '남서', W: '서', NW: '북서',
};

/** 근접도 % = 최대 거리(700km) 대비. 거리 0 → 100. */
export function proximityPct(distanceKm: number): number {
  return Math.round(Math.max(0, 1 - distanceKm / MAX_DIST_KM) * 100);
}

/**
 * 오답 힌트 3종 일괄 계산 (추측 centroid → 정답 centroid).
 * 근접도는 99로 캡 — 100은 정답 전용 값(인접 지역 오답이 100%로 보이는 혼동 방지).
 * 정답(같은 코드)은 이 함수를 쓰지 말고 {distanceKm:0, direction:null, proximity:100}으로 기록.
 */
export function computeHint(
  guess: LatLng,
  answer: LatLng,
): { distanceKm: number; direction: Direction8; proximity: number } {
  const distanceKm = Math.round(haversineKm(guess, answer));
  return {
    distanceKm,
    direction: toDirection8(bearingDeg(guess, answer)),
    proximity: Math.min(99, proximityPct(distanceKm)),
  };
}
