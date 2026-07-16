// @vitest-environment jsdom
/**
 * 동네고수 storage.ts — 스트릭·멱등·히스토그램·폴백 (QA 플랜 §4 상태머신의 스토리지 계층)
 * G-10 멱등 · G-11 스트릭 연속 · G-12 끊김 · G-13 패배 유지 · G-14 히스토그램 · G-15/16 저장불가 폴백
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  defaultStats,
  loadStats,
  saveStats,
  recordCompletedGame,
  loadGameState,
  saveGameState,
  isOnboarded,
  setOnboarded,
  getHometownCode,
  setHometownCode,
  getAnonId,
  hasPingedToday,
  markPingedToday,
} from './storage';
import type { GameState } from './types';

beforeEach(() => {
  window.localStorage.clear();
});

describe('§4 통계·스트릭 (recordCompletedGame)', () => {
  it('G-10 같은 gameNo 재호출 시 중복 집계 없음 (멱등)', () => {
    const first = recordCompletedGame(5, true, 3);
    expect(first.totalPlays).toBe(1);
    const second = recordCompletedGame(5, true, 3); // 재방문 재계산 시도
    expect(second.totalPlays).toBe(1);
    expect(second.histogram).toEqual(first.histogram);
    expect(loadStats().totalPlays).toBe(1);
  });

  it('G-11 연속 회차(gap=1) → currentStreak +1, maxStreak 갱신', () => {
    recordCompletedGame(5, true, 3);
    expect(loadStats().currentStreak).toBe(1);
    const next = recordCompletedGame(6, true, 2);
    expect(next.currentStreak).toBe(2);
    expect(next.maxStreak).toBe(2);
  });

  it('G-12 하루 건너뜀(gap>1) → currentStreak=1 리셋 (maxStreak 보존)', () => {
    recordCompletedGame(5, true, 3);
    recordCompletedGame(6, true, 3); // streak 2
    const skipped = recordCompletedGame(8, true, 3); // gap 2 → reset
    expect(skipped.currentStreak).toBe(1);
    expect(skipped.maxStreak).toBe(2); // 이전 최고 보존
  });

  it('G-13 정답 못 맞혀도(패배) 스트릭 유지 (§4-8)', () => {
    recordCompletedGame(5, false, 6); // 패배
    expect(loadStats().currentStreak).toBe(1);
    const next = recordCompletedGame(6, false, 6); // 연속 패배도 유지
    expect(next.currentStreak).toBe(2);
    expect(next.wins).toBe(0);
    expect(next.totalPlays).toBe(2);
  });

  it('G-14 히스토그램: 성공은 idx=attempts-1, 실패는 idx=6', () => {
    recordCompletedGame(1, true, 1); // idx 0
    recordCompletedGame(2, true, 6); // idx 5
    recordCompletedGame(3, false, 6); // idx 6
    const s = loadStats();
    expect(s.histogram[0]).toBe(1);
    expect(s.histogram[5]).toBe(1);
    expect(s.histogram[6]).toBe(1);
    expect(s.histogram).toHaveLength(7);
  });

  it('defaultStats 초기값 정합', () => {
    expect(defaultStats()).toEqual({
      totalPlays: 0,
      wins: 0,
      currentStreak: 0,
      maxStreak: 0,
      lastPlayedGameNo: null,
      histogram: [0, 0, 0, 0, 0, 0, 0],
    });
  });
});

describe('§4 게임 상태 저장·복원', () => {
  it('saveGameState → loadGameState 왕복 (재방문 복원)', () => {
    const state: GameState = {
      gameNo: 42,
      guesses: [{ code: '11010', distanceKm: 100, direction: 'N', proximity: 80, correct: false }],
      status: 'playing',
      updatedAt: 123456,
    };
    expect(saveGameState(state)).toBe(true);
    expect(loadGameState(42)).toEqual(state);
  });

  it('미저장 회차는 null 반환', () => {
    expect(loadGameState(999)).toBeNull();
  });

  it('손상된 JSON은 크래시 없이 null', () => {
    window.localStorage.setItem('dongne:state:7', '{corrupt');
    expect(loadGameState(7)).toBeNull();
  });
});

describe('§4 온보딩·우리동네·anon·ping 플래그', () => {
  it('setOnboarded 후 isOnboarded=true', () => {
    setOnboarded();
    expect(isOnboarded()).toBe(true);
    expect(window.localStorage.getItem('dongne:onboarded')).toBe('1');
  });

  it('hometown code 저장/조회', () => {
    expect(getHometownCode()).toBeNull();
    setHometownCode('11010');
    expect(getHometownCode()).toBe('11010');
  });

  it('getAnonId 는 1회 발급 후 동일 값 영속', () => {
    const id1 = getAnonId();
    const id2 = getAnonId();
    expect(id1).toBe(id2);
    expect(id1).toMatch(/^[A-Za-z0-9-]{8,64}$/);
  });

  it('ping 플래그: markPingedToday 후 hasPingedToday=true', () => {
    expect(hasPingedToday(1)).toBe(false);
    markPingedToday(1);
    expect(hasPingedToday(1)).toBe(true);
  });
});

describe('§4 localStorage 불가 폴백 (G-15/G-16)', () => {
  it('G-15/G-16 setItem 이 throw 해도 예외 없이 저하 모드로 동작 (스트릭 누적 불가, 크래시 없음)', async () => {
    vi.resetModules(); // cachedAvailable 초기화용 프레시 모듈
    const throwingStorage = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException('QuotaExceeded');
      },
      removeItem: () => {
        throw new DOMException('QuotaExceeded');
      },
      clear: () => {},
      key: () => null,
      length: 0,
    };
    const spy = vi.spyOn(window, 'localStorage', 'get').mockReturnValue(throwingStorage as unknown as Storage);
    try {
      const fresh = await import('./storage');
      expect(fresh.isStorageAvailable()).toBe(false);
      // 완료 기록해도 throw 없이 default 기반 반환(누적 불가 = 허용 저하)
      const s1 = fresh.recordCompletedGame(5, true, 3);
      expect(s1.currentStreak).toBe(1);
      const s2 = fresh.recordCompletedGame(6, true, 3);
      expect(s2.currentStreak).toBe(1); // 저장 불가 → 매번 default → 항상 1 (OBS-4 수용 저하)
      expect(fresh.loadStats()).toEqual(fresh.defaultStats());
    } finally {
      spy.mockRestore();
      vi.resetModules();
    }
  });
});
