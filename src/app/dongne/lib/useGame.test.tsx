// @vitest-environment jsdom
/**
 * 동네고수 useDongneGame — 게임 상태 머신 (QA 플랜 §4 G-01~23)
 *
 * ⚠ 프리런치 마스킹 주의: getTodayGameNo()가 현재(07-16)엔 <1이라 today=null로 게임이 우회된다.
 * vi.setSystemTime 으로 EPOCH 이후(2026-08-15 = gameNo 31)를 시뮬레이션해야 상태 머신이 실행된다.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDongneGame } from './useGame';
import { REGIONS } from './manifest';
import { getRegionCodeForGame, getTodayGameNo } from '@/lib/dongne/queue';
import * as storage from '@/lib/dongne/storage';
import type { GameState, Region } from '@/lib/dongne/types';

// 2026-08-15 KST → gameNo 31 (EPOCH 2026-07-16 기준)
const POST_LAUNCH = new Date('2026-08-15T03:00:00Z');

function todayRegion(): Region {
  const code = getRegionCodeForGame(getTodayGameNo(POST_LAUNCH));
  return REGIONS.find((r) => r.code === code)!;
}
function wrongRegion(exclude: string[]): Region {
  return REGIONS.find((r) => !exclude.includes(r.code))!;
}

beforeEach(() => {
  window.localStorage.clear();
  vi.setSystemTime(POST_LAUNCH);
  global.fetch = vi.fn().mockResolvedValue({ ok: true }) as unknown as typeof fetch;
});
afterEach(() => {
  vi.useRealTimers();
});

async function mount() {
  const rendered = renderHook(() => useDongneGame());
  await act(async () => {
    await Promise.resolve();
  });
  return rendered;
}

describe('§4 정상 진행·종료', () => {
  it('G-01 오답2 + 정답(3회째) → won, guesses.length=3', async () => {
    const { result } = await mount();
    const answer = result.current.today!;
    const wrongs = REGIONS.filter((r) => r.code !== answer.code).slice(0, 2);
    act(() => result.current.submitGuess(wrongs[0]));
    act(() => result.current.submitGuess(wrongs[1]));
    act(() => result.current.submitGuess(answer));
    expect(result.current.status).toBe('won');
    expect(result.current.guesses).toHaveLength(3);
    expect(result.current.guesses[2].correct).toBe(true);
    expect(result.current.guesses[2].proximity).toBe(100);
    expect(result.current.guesses[2].direction).toBeNull();
  });

  it('G-02 오답 6회 → lost, guesses.length=6', async () => {
    const { result } = await mount();
    const answer = result.current.today!;
    const wrongs = REGIONS.filter((r) => r.code !== answer.code).slice(0, 6);
    wrongs.forEach((w) => act(() => result.current.submitGuess(w)));
    expect(result.current.status).toBe('lost');
    expect(result.current.guesses).toHaveLength(6);
    expect(result.current.guesses.every((g) => !g.correct)).toBe(true);
  });

  it('G-03 6회째 정답 → won(lost 아님)', async () => {
    const { result } = await mount();
    const answer = result.current.today!;
    const wrongs = REGIONS.filter((r) => r.code !== answer.code).slice(0, 5);
    wrongs.forEach((w) => act(() => result.current.submitGuess(w)));
    expect(result.current.status).toBe('playing');
    act(() => result.current.submitGuess(answer));
    expect(result.current.status).toBe('won');
    expect(result.current.guesses).toHaveLength(6);
  });

  it('G-04 종료(won) 후 추가 제출은 no-op', async () => {
    const { result } = await mount();
    const answer = result.current.today!;
    act(() => result.current.submitGuess(answer));
    expect(result.current.status).toBe('won');
    const wrong = wrongRegion([answer.code]);
    act(() => result.current.submitGuess(wrong));
    expect(result.current.guesses).toHaveLength(1); // 변화 없음
    expect(result.current.status).toBe('won');
  });

  it('오답 힌트: 거리·방위·근접도 계산되고 근접도 ≤ 99', async () => {
    const { result } = await mount();
    const answer = result.current.today!;
    const wrong = wrongRegion([answer.code]);
    act(() => result.current.submitGuess(wrong));
    const g = result.current.guesses[0];
    expect(g.correct).toBe(false);
    expect(Number.isInteger(g.distanceKm)).toBe(true);
    expect(g.proximity).toBeLessThanOrEqual(99);
    expect(g.direction).not.toBeNull();
  });
});

describe('§4 복원(재방문)', () => {
  it('G-06 진행중(2/6) 저장 후 재방문 시 복원', async () => {
    const gameNo = getTodayGameNo(POST_LAUNCH);
    const saved: GameState = {
      gameNo,
      guesses: [
        { code: REGIONS[0].code, distanceKm: 100, direction: 'N', proximity: 80, correct: false },
        { code: REGIONS[1].code, distanceKm: 60, direction: 'S', proximity: 88, correct: false },
      ],
      status: 'playing',
      updatedAt: Date.now(),
    };
    storage.saveGameState(saved);
    const { result } = await mount();
    expect(result.current.guesses).toHaveLength(2);
    expect(result.current.status).toBe('playing');
  });

  it('G-07 성공 저장 후 재진입 → status=won 즉시 복원', async () => {
    const gameNo = getTodayGameNo(POST_LAUNCH);
    storage.saveGameState({
      gameNo,
      guesses: [{ code: getRegionCodeForGame(gameNo), distanceKm: 0, direction: null, proximity: 100, correct: true }],
      status: 'won',
      updatedAt: Date.now(),
    });
    const { result } = await mount();
    expect(result.current.status).toBe('won');
    expect(result.current.guesses).toHaveLength(1);
  });

  it('G-08 실패 저장 후 재진입 → status=lost 즉시 복원', async () => {
    const gameNo = getTodayGameNo(POST_LAUNCH);
    storage.saveGameState({
      gameNo,
      guesses: REGIONS.slice(0, 6).map((r) => ({ code: r.code, distanceKm: 50, direction: 'E' as const, proximity: 70, correct: false })),
      status: 'lost',
      updatedAt: Date.now(),
    });
    const { result } = await mount();
    expect(result.current.status).toBe('lost');
    expect(result.current.guesses).toHaveLength(6);
  });
});

describe('§4 자정 스냅샷·통계 멱등', () => {
  it('G-09 세션 중 자정 넘겨도 gameNo 불변 (useState 1회 초기화)', async () => {
    const { result, rerender } = await mount();
    const g1 = result.current.gameNo;
    act(() => {
      vi.setSystemTime(new Date('2026-08-16T03:00:00Z')); // 다음 날
    });
    rerender();
    expect(result.current.gameNo).toBe(g1); // 새로고침 전엔 정답 안 바뀜
  });

  it('G-10 완료 시 통계 1회만 반영 (멱등)', async () => {
    const { result } = await mount();
    const answer = result.current.today!;
    act(() => result.current.submitGuess(answer));
    expect(result.current.stats.totalPlays).toBe(1);
    expect(result.current.stats.wins).toBe(1);
    // 저장된 통계도 1회
    expect(storage.loadStats().totalPlays).toBe(1);
  });

  it('G-11 어제 플레이 + 오늘 완료 → currentStreak +1', async () => {
    const gameNo = getTodayGameNo(POST_LAUNCH);
    storage.saveStats({
      totalPlays: 3, wins: 2, currentStreak: 3, maxStreak: 3,
      lastPlayedGameNo: gameNo - 1, histogram: [0, 0, 0, 0, 0, 0, 0],
    });
    const { result } = await mount();
    act(() => result.current.submitGuess(result.current.today!));
    expect(result.current.stats.currentStreak).toBe(4);
    expect(result.current.stats.maxStreak).toBe(4);
  });

  it('G-12 하루 건너뜀 → currentStreak=1 리셋', async () => {
    const gameNo = getTodayGameNo(POST_LAUNCH);
    storage.saveStats({
      totalPlays: 3, wins: 2, currentStreak: 3, maxStreak: 5,
      lastPlayedGameNo: gameNo - 3, histogram: [0, 0, 0, 0, 0, 0, 0],
    });
    const { result } = await mount();
    act(() => result.current.submitGuess(result.current.today!));
    expect(result.current.stats.currentStreak).toBe(1);
    expect(result.current.stats.maxStreak).toBe(5);
  });
});

describe('§4 ping·실루엣 non-blocking', () => {
  it('G-23 pingOnce 는 최초 1회만 fetch, 재호출 스킵', async () => {
    const { result } = await mount();
    act(() => result.current.pingOnce());
    act(() => result.current.pingOnce());
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe('/api/dongne/ping');
  });

  it('G-21 게임 로직은 silhouetteState 와 무관하게 진행 (실루엣 실패해도 non-block)', async () => {
    const { result } = await mount();
    // submitGuess 는 silhouette 를 읽지 않는다 — 로딩/에러와 무관하게 정답 판정 동작
    const answer = result.current.today!;
    act(() => result.current.submitGuess(answer));
    expect(result.current.status).toBe('won');
    expect(typeof result.current.retrySilhouette).toBe('function');
  });
});
