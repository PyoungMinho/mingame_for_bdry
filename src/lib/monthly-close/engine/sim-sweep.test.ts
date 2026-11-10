import { describe, expect, it } from 'vitest';
import { simulate, type HumanHintParams } from './simulate';

/**
 * 힌트 민감도 분석(D3 백엔드팀장). 기본 실행에서는 건너뛴다(느림).
 *   MC_SIM_SWEEP=1 MC_SIM_GAMES=10000 npx vitest run src/lib/monthly-close/engine/sim-sweep.test.ts
 * 결과는 docs/backend/monthly-close-sim.md "D3 재측정"에 기록.
 */
const ON = Boolean(process.env.MC_SIM_SWEEP);
const N = Number(process.env.MC_SIM_GAMES ?? 2_000);

const PROFILES: Record<string, Partial<HumanHintParams>> = {
  attentive: { usePerTurn: 0.7, remember: 0.9, follow: 0.85 },
  typical: {},
  casual: { usePerTurn: 0.2, remember: 0.4, follow: 0.4 },
};

describe.skipIf(!ON)('힌트 민감도 (solveProb × 사람 모델)', () => {
  it('표 출력', () => {
    const rows: Record<string, unknown>[] = [];
    for (const solveProb of [0.4, 0.6, 0.8]) {
      const perfect = simulate({ games: N, seed: 20261108, solveProb, alarmOn: true });
      rows.push({ solveProb, model: 'perfect', more: perfect.moreHintsWinRate, n: perfect.moreHintsGames, byDiff: perfect.moreHintsByDiff, use: perfect.hintUseRate, median: perfect.medianRounds, cap: perfect.capRate });
      for (const [name, human] of Object.entries(PROFILES)) {
        const r = simulate({ games: N, seed: 20261108, solveProb, alarmOn: true, hintModel: 'human', human });
        rows.push({ solveProb, model: name, more: r.moreHintsWinRate, n: r.moreHintsGames, byDiff: r.moreHintsByDiff, use: r.hintUseRate, median: r.medianRounds, cap: r.capRate });
      }
    }
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(rows));
    expect(rows.length).toBe(12);
  }, 3_600_000);
});
