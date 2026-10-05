/**
 * 다시 하기 — 기억 판 경로 검증 중 BFS 를 여러 번 도는 것(witness-replay.md h-1 P2·P3·P4·P9).
 * paths.test.ts 실행 시간을 2배 안으로 지키려고 파일을 나눴다(h-5 4번 — 병렬 실행).
 * 전부 실제 엔진 + freeClosure. 결정적(고정 시드 LCG 12345).
 */
import { describe, expect, it } from 'vitest';
import { CASE } from './case-data';
import { RECALL_ELIGIBLE, newRun, type RunState } from './engine';
import { accuseOptions, analyzeEconomy, memStart, minReach, playPath } from './validate';

const ELIG = [...RECALL_ELIGIBLE];
const ROUTE = CASE.hintRoute; // C05 C08 C10 C03 C04 C11 C13 — 완벽 해결에 필요한 돌파 7개
const OTHER = ['C01', 'C02', 'C06', 'C07', 'C09', 'C12', 'C14', 'C15'];
const HIDDEN_NEED = ['C02', 'C03', 'C04', 'C05', 'C06', 'C08', 'C10', 'C11', 'C13'];

describe('P1 기억 판 행동 경제', () => {
  const MEM_PERFECT = ['T02', 'T03', 'T04', 'T05'];
  const M = analyzeEconomy(13, memStart(ELIG));
  it('P1 analyzeEconomy(13, memStart(ELIG)) — 완벽 4 · 필요 집합 [T02 T03 T04 T05] · 숨은 6 · ★전부 5 · ★3 1 · B 1 · 진행 불가 0', () => {
    expect(M.budget).toBe(13);
    expect(M.minPerfect).toBe(4);
    expect(M.minPerfectSets.map((x) => [...x].sort())).toEqual([MEM_PERFECT]);
    expect(M.minHidden).toBe(6);
    expect(M.minAllStars).toBe(5);
    expect(M.minStar3).toBe(1);
    expect(M.minB).toBe(1);
    expect(M.stuck).toBe(0);
    expect(M.full).toMatchObject({ breaks: 15, evidence: 18, hidden: true, perfect: true });
  });

});

describe('P2 금지 실험(ban) — 기억해도 증언 깨기 퍼즐은 그대로 남는다', () => {
  it('필요 돌파 7개 중 하나만 막아도 완벽 해결 null — 새 판·기억 판 동일', () => {
    expect([...ROUTE].sort()).toEqual(['C03', 'C04', 'C05', 'C08', 'C10', 'C11', 'C13']);
    for (const b of ROUTE) {
      expect(minReach('perfect', 13, newRun(), { ban: [b] }), `new ${b}`).toBeNull();
      expect(minReach('perfect', 13, memStart(ELIG), { ban: [b] }), `mem ${b}`).toBeNull();
    }
  });

  it('나머지 8개는 막아도 기억 판 완벽 4', () => {
    expect([...ROUTE, ...OTHER].sort()).toEqual(CASE.sets.flatMap((s) => s.lines).flatMap((l) => l.breaks ?? []).map((b) => b.id).sort());
    for (const b of OTHER) expect(minReach('perfect', 13, memStart(ELIG), { ban: [b] }), b).toBe(4);
  });

  it('숨은 엔딩은 9개 중 하나만 막아도 null(기억 판), 그 밖 6개는 막아도 숨은 6', () => {
    for (const b of HIDDEN_NEED) expect(minReach('hidden', 13, memStart(ELIG), { ban: [b] }), b).toBeNull();
    for (const b of ['C01', 'C07', 'C09', 'C12', 'C14', 'C15']) expect(minReach('hidden', 13, memStart(ELIG), { ban: [b] }), b).toBe(6);
  });
});

describe('P3 한 장씩 빼기 ×15', () => {
  it('완벽 4~6 · 숨은 6~8 · 진행 불가 0', () => {
    for (const id of ELIG) {
      const ids = ELIG.filter((x) => x !== id);
      const r = analyzeEconomy(13, memStart(ids));
      expect(r.minPerfect, id).not.toBeNull();
      expect(r.minPerfect!, id).toBeGreaterThanOrEqual(4);
      expect(r.minPerfect!, id).toBeLessThanOrEqual(6);
      expect(r.minHidden!, id).toBeGreaterThanOrEqual(6);
      expect(r.minHidden!, id).toBeLessThanOrEqual(8);
      expect(r.stuck, id).toBe(0);
    }
  });
});

describe('P4 고정 시드(LCG 12345) 부분집합 ×32', () => {
  it('진행 불가 0 · 완벽 도달 불가 0', () => {
    let x = 12345;
    const next = () => {
      x = (Math.imul(x, 1103515245) + 12345) >>> 0;
      return x;
    };
    const seen = new Set<string>();
    for (let i = 0; i < 32; i++) {
      const ids = ELIG.filter(() => (next() >>> 16) & 1);
      seen.add(ids.join());
      const r = analyzeEconomy(13, memStart(ids));
      expect(r.stuck, ids.join()).toBe(0);
      expect(r.minPerfect, ids.join()).not.toBeNull();
    }
    expect(seen.size).toBeGreaterThan(20); // 서로 다른 부분집합을 고루 봤다
  });
});

describe('P9 기억 판 도달 상태 전체', () => {
  it('남은 행동 ≥ 안 연 T02~T05 수 이면 완벽 해결에 닿는다', () => {
    const NEED = ['T02', 'T03', 'T04', 'T05'];
    const states: RunState[] = [];
    analyzeEconomy(13, memStart(ELIG), { inspect: (r) => states.push(r) });
    let checked = 0;
    for (const r of states) {
      const rest = NEED.filter((t) => !r.opened.includes(t));
      if (r.actions < rest.length) continue;
      const end = playPath(rest, r);
      expect(accuseOptions(end).perfect, `${r.opened.join(',')} · 행동 ${r.actions}`).toBe(true);
      checked += 1;
    }
    expect(checked).toBeGreaterThan(500);
  });
});
