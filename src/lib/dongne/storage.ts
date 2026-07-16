/**
 * 동네고수 — localStorage/sessionStorage 저장·복원 (페이지개발자 소유)
 *
 * design-final §2-C 재방문 플로우 · §4-13 localStorage 불가 안내 · 방향서 §5-1 DAU ping을
 * 뒷받침하는 순수 브라우저 스토리지 계층. 전부 try/catch로 감싸 사파리 프라이빗 모드·
 * 쿠키 차단 환경에서도 예외 없이 "저하된 모드"로 동작한다(§4-13: 새로고침 시 초기화 = 허용 저하).
 *
 * ⚠ 이 모듈은 브라우저 전역(window)에만 접근한다 — 클라이언트 컴포넌트에서만 호출할 것
 * (SSR/서버 컴포넌트에서 import는 안전하지만 함수 호출은 window 부재로 실패한다).
 */

import type { GameState, PlayerStats } from './types';

const KEY_STATE_PREFIX = 'dongne:state:';
const KEY_STATS = 'dongne:stats';
const KEY_ONBOARDED = 'dongne:onboarded';
const KEY_HOMETOWN = 'dongne:hometown';
const KEY_ANON = 'dongne:anon';
const KEY_PING_PREFIX = 'dongne:ping:';

let cachedAvailable: boolean | null = null;
/** localStorage 불가 안내(§4-13)를 세션에 1회만 띄우기 위한 인메모리 플래그 */
let storageNoticeShown = false;
/** 온보딩 dismiss 기록이 저장 불가한 환경에서 세션당 1회만 스트립을 보여주기 위한 폴백 플래그 */
let memOnboarded = false;

/** localStorage 기능 감지 — 결과를 모듈 수명 동안 캐시(반복 try/catch 비용 회피) */
export function isStorageAvailable(): boolean {
  if (cachedAvailable !== null) return cachedAvailable;
  try {
    const testKey = '__dongne_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    cachedAvailable = true;
  } catch {
    cachedAvailable = false;
  }
  return cachedAvailable;
}

function safeGet(key: string): string | null {
  if (!isStorageAvailable()) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): boolean {
  if (!isStorageAvailable()) return false;
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function safeGetJSON<T>(key: string): T | null {
  const raw = safeGet(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function safeSetJSON(key: string, value: unknown): boolean {
  try {
    return safeSet(key, JSON.stringify(value));
  } catch {
    return false;
  }
}

// ---------------- 게임 상태(회차별) ----------------

/** `dongne:state:{gameNo}` 복원 — 재방문 플로우(design-final §2-C) */
export function loadGameState(gameNo: number): GameState | null {
  return safeGetJSON<GameState>(`${KEY_STATE_PREFIX}${gameNo}`);
}

export function saveGameState(state: GameState): boolean {
  return safeSetJSON(`${KEY_STATE_PREFIX}${state.gameNo}`, state);
}

// ---------------- 누적 통계·스트릭 ----------------

export function defaultStats(): PlayerStats {
  return {
    totalPlays: 0,
    wins: 0,
    currentStreak: 0,
    maxStreak: 0,
    lastPlayedGameNo: null,
    histogram: [0, 0, 0, 0, 0, 0, 0],
  };
}

export function loadStats(): PlayerStats {
  return safeGetJSON<PlayerStats>(KEY_STATS) ?? defaultStats();
}

export function saveStats(stats: PlayerStats): boolean {
  return safeSetJSON(KEY_STATS, stats);
}

/**
 * 라운드 완료(성공/실패) 1회를 통계에 반영한다. 같은 gameNo로 재호출해도 중복 집계하지 않는다
 * (재방문 시 결과 카드가 즉시 다시 렌더되며 재계산을 시도할 수 있으므로 idempotent 가드 필수).
 *
 * 스트릭 규칙(design-final §4-8): "플레이하면 이어져요(정답 못 맞혀도 유지)" — 승패와 무관하게
 * 완료만 하면 유지. 단 하루 이상 자정을 건너뛰면(gap>1) 스트릭은 1로 리셋된다.
 */
export function recordCompletedGame(gameNo: number, won: boolean, attempts: number): PlayerStats {
  const stats = loadStats();
  if (stats.lastPlayedGameNo === gameNo) return stats; // 이미 집계됨 — 중복 방지

  const isConsecutive = stats.lastPlayedGameNo !== null && gameNo - stats.lastPlayedGameNo === 1;
  const currentStreak = isConsecutive ? stats.currentStreak + 1 : 1;
  const maxStreak = Math.max(stats.maxStreak, currentStreak);

  const histogram = [...stats.histogram] as PlayerStats['histogram'];
  const idx = won ? attempts - 1 : 6; // 0~5 = 1~6회 성공, 6번째 칸 = 실패
  histogram[idx] = (histogram[idx] ?? 0) + 1;

  const next: PlayerStats = {
    totalPlays: stats.totalPlays + 1,
    wins: stats.wins + (won ? 1 : 0),
    currentStreak,
    maxStreak,
    lastPlayedGameNo: gameNo,
    histogram,
  };
  saveStats(next);
  return next;
}

// ---------------- 온보딩 ----------------

export function isOnboarded(): boolean {
  if (safeGet(KEY_ONBOARDED) === '1') return true;
  return memOnboarded; // localStorage 불가 환경 폴백(§4-2: "localStorage 불가 시 세션당 1회만 노출")
}

export function setOnboarded(): void {
  memOnboarded = true;
  safeSet(KEY_ONBOARDED, '1');
}

// ---------------- "우리 동네" ----------------

export function getHometownCode(): string | null {
  return safeGet(KEY_HOMETOWN);
}

export function setHometownCode(code: string): boolean {
  return safeSet(KEY_HOMETOWN, code);
}

// ---------------- DAU ping(방향서 §5-1) ----------------

function generateAnonId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // 구형 브라우저 폴백 — 암호학적 강도 불필요(익명 방문자 식별자일 뿐)
  const rand = Array.from({ length: 24 }, () => Math.floor(Math.random() * 36).toString(36)).join('');
  return `dn-${rand}`;
}

/** localStorage 익명 anon_id — 없으면 1회 발급 후 영속화(§5-1) */
export function getAnonId(): string {
  const existing = safeGet(KEY_ANON);
  if (existing) return existing;
  const id = generateAnonId();
  safeSet(KEY_ANON, id);
  return id;
}

/** KST 하루 1인 1회만 ping 보내기 위한 플래그(`dongne:ping:{gameNo}`) */
export function hasPingedToday(gameNo: number): boolean {
  return safeGet(`${KEY_PING_PREFIX}${gameNo}`) === '1';
}

export function markPingedToday(gameNo: number): void {
  safeSet(`${KEY_PING_PREFIX}${gameNo}`, '1');
}

// ---------------- 세션 한정 UI 플래그 ----------------

/** localStorage 불가 안내(§4-13) — 세션당 1회만 노출 */
export function shouldShowStorageNotice(): boolean {
  if (storageNoticeShown) return false;
  storageNoticeShown = true;
  return true;
}

function safeSessionGet(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSessionSet(key: string, value: string): void {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // 세션 스토리지도 불가하면 그냥 매 방문 재노출(허용 가능한 저하) — 예외만 삼킨다
  }
}

/** 스트릭 위험 넛지(§4-12) 세션 dismiss */
export function isStreakRiskDismissed(gameNo: number): boolean {
  return safeSessionGet(`dongne:streakRiskDismiss:${gameNo}`) === '1';
}

export function dismissStreakRisk(gameNo: number): void {
  safeSessionSet(`dongne:streakRiskDismiss:${gameNo}`, '1');
}
