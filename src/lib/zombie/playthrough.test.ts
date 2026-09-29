/**
 * 실제 콘텐츠 위에서 무작위 플레이 수천 판 — 엔진 × 콘텐츠 통합 스모크 테스트.
 * 모든 판이 크래시 없이 엔딩에 도달하는지, 엔딩 분포가 한쪽으로 쏠리지 않는지 본다.
 */
import { describe, expect, it } from 'vitest';
import { ENDING_IDS } from './contract';
import { CHAPTER_SOURCES, ENDINGS, NODES } from './content';
import { applyChoice, newRun, resolveEnding, step, visibleChoices } from './engine';
import type { EndingId } from './types';

const hasContent = CHAPTER_SOURCES.every(([, nodes]) => Object.keys(nodes).length > 0);
const RUNS = 3000;
const MAX_STEPS = 80;

describe.skipIf(!hasContent)('무작위 플레이스루', () => {
  it(`${RUNS}판 모두 크래시 없이 엔딩 도달`, () => {
    const counts: Partial<Record<EndingId, number>> = {};
    let totalSteps = 0;
    let longest = 0;
    for (let seed = 1; seed <= RUNS; seed++) {
      let s = newRun(seed, NODES.c1_start);
      let pick = seed * 7919;
      let steps = 0;
      while (!s.ending) {
        const open = visibleChoices(s, NODES[s.nodeId]).filter((c) => c.status === 'open');
        expect(open.length, `열린 선택지 없음 @${s.nodeId}`).toBeGreaterThan(0);
        const [r, nextPick] = step(pick);
        pick = nextPick;
        s = applyChoice(s, NODES, open[Math.floor(r * open.length)].choice.id).state;
        steps++;
        expect(steps, `무한 루프 의심 @${s.nodeId}`).toBeLessThan(MAX_STEPS);
      }
      const resolved = resolveEnding(s, ENDINGS);
      expect(resolved, `엔딩 해석 실패 ${s.ending}`).not.toBeNull();
      expect(resolved!.body.length).toBeGreaterThan(0);
      counts[s.ending] = (counts[s.ending] ?? 0) + 1;
      totalSteps += steps;
      longest = Math.max(longest, steps);
    }
    const table = ENDING_IDS.map((id) => `${id.padEnd(11)} ${String(counts[id] ?? 0).padStart(5)}`).join('\n');
    console.info(`엔딩 분포 (${RUNS}판, 평균 ${(totalSteps / RUNS).toFixed(1)}장면, 최장 ${longest})\n${table}`);
    // 무작위 플레이에서 한 엔딩이 60% 이상이면 분기가 사실상 무의미하다는 신호
    const max = Math.max(...Object.values(counts).map((v) => v ?? 0));
    expect(max / RUNS).toBeLessThan(0.6);
  });
});
