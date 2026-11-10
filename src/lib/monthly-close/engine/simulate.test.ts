import { describe, expect, it } from 'vitest';
import { simulate } from './simulate';

/**
 * G0-3 시뮬: 실제 엔진으로 기본 2,000판씩(MC_SIM_GAMES=10000 이면 1만 판씩. 힌트 없음 / 힌트 있음). 결과는 docs/backend/monthly-close-sim.md에 기록한다.
 * MC_SIM_PRINT=1 이면 JSON을 출력한다.
 */
describe('1만 판 시뮬 (G0-3)', () => {
  const N = Number(process.env.MC_SIM_GAMES ?? 2_000);
  const noHint = simulate({ games: N, seed: 20261107, solveProb: 0, alarmOn: true });
  const withHint = simulate({ games: N, seed: 20261108, solveProb: 0.6, alarmOn: true });
  // D3 백엔드팀장: 사람처럼 늦게·덜 효율적으로 힌트를 쓰는 모델(같은 시드)
  const humanHint = simulate({ games: N, seed: 20261108, solveProb: 0.6, alarmOn: true, hintModel: 'human' });
  // QA 수정(BUG-15·16) 검증: 접속 끊김 30%·시간 초과 5% 잡음. 이 잡음이 있어야 검산 미룸·경보+시간 초과 겹침이 생긴다
  const NOISE = { notReady: 0.3, timeout: 0.05 } as const;
  const noisy = simulate({ games: N, seed: 20261109, solveProb: 0.6, alarmOn: true, noise: NOISE });
  const noisyHuman = simulate({ games: N, seed: 20261109, solveProb: 0.6, alarmOn: true, hintModel: 'human', noise: NOISE });

  if (process.env.MC_SIM_PRINT) {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ N, noHint, withHint, humanHint, noisy, noisyHuman }, null, 2));
  }

  it('힌트 없는 판: 라운드 중앙값이 기획서 시뮬(18)과 비슷하고 선공/후공 편차가 작다', () => {
    expect(noHint.medianRounds).toBeGreaterThanOrEqual(15);
    expect(noHint.medianRounds).toBeLessThanOrEqual(21);
    expect(Math.abs(noHint.firstWin - noHint.secondWin)).toBeLessThan(0.05);
    expect(noHint.capRate).toBeLessThan(0.08);
    expect(noHint.draw).toBeLessThan(0.1);
    expect(noHint.avgHintsPerGame).toBe(0);
  });

  it('힌트 있는 판: 판이 더 짧아지고, 힌트를 더 받은 쪽 승률이 정상 범위(수치 판정은 docs의 시뮬 기록)', () => {
    expect(withHint.medianRounds).toBeLessThanOrEqual(noHint.medianRounds);
    expect(withHint.avgHintsPerGame).toBeGreaterThan(1);
    expect(withHint.moreHintsWinRate).not.toBeNull();
    expect(withHint.moreHintsWinRate as number).toBeLessThanOrEqual(0.75); // G0-3 기준 0.60 대비 실측은 문서에 기록
    expect(Math.abs(withHint.firstWin - withHint.secondWin)).toBeLessThan(0.05);
    expect(withHint.hintUseRate).toBeGreaterThan(0.95);
  });

  it('사람 모델 힌트: 덜 쓰고(사용률 < 완벽 모델) 판 길이·선공 편차는 기준 안', () => {
    expect(humanHint.hintUseRate).toBeLessThan(withHint.hintUseRate);
    expect(humanHint.medianRounds).toBeGreaterThanOrEqual(15);
    expect(humanHint.medianRounds).toBeLessThanOrEqual(22);
    expect(Math.abs(humanHint.firstWin - humanHint.secondWin)).toBeLessThan(0.05);
    expect(humanHint.moreHintsWinRate as number).toBeLessThanOrEqual(0.75);
  });

  it('잡음(접속 끊김·시간 초과): 미뤄진 검산이 합쳐지지 않아 판당 검산 수가 거의 줄지 않고(BUG-15), 2턴 손실 0(BUG-16)', () => {
    for (const st of [noisy, noisyHuman]) {
      expect(st.timeouts).toBeGreaterThan(0);
      expect(st.alarmTimeoutOverlap).toBeGreaterThan(0); // BUG-16 경로를 실제로 탔다
      expect(st.doubleTurnLoss).toBe(0);
      expect(withHint.quizzesPerGame - st.quizzesPerGame).toBeLessThan(0.2);
      expect(st.medianRounds).toBeGreaterThanOrEqual(15);
      expect(st.medianRounds).toBeLessThanOrEqual(22);
      expect(Math.abs(st.firstWin - st.secondWin)).toBeLessThan(0.05);
    }
  });
}, 600_000);
