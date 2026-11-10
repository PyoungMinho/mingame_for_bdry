import { describe, expect, it, vi } from 'vitest';
import { NoCryptoError, randomHex } from './identity';
import { EventCursor } from './events';
import { ServerClock } from './serverClock';
import type { GameEventView } from '../protocol';

const ev = (seq: number): GameEventView => ({ seq, at: 0, round: 1, type: 'quizStarted' });

describe('EventCursor', () => {
  it('첫 view의 사건은 이미 본 것', () => {
    const c = new EventCursor();
    expect(c.take([ev(3), ev(4)])).toEqual([]);
    expect(c.take([ev(3), ev(4)])).toEqual([]);
  });
  it('새 seq만 돌려주고 중복은 거른다', () => {
    const c = new EventCursor();
    c.take([ev(1)]);
    expect(c.take([ev(1), ev(2)]).map((e) => e.seq)).toEqual([2]);
    expect(c.take([ev(1), ev(2), ev(3), ev(4)]).map((e) => e.seq)).toEqual([3, 4]);
    expect(c.take([ev(2), ev(3), ev(4)])).toEqual([]);
  });
  it('빈틈이면 마지막 사건만', () => {
    const c = new EventCursor();
    c.take([ev(1)]);
    expect(c.take([ev(5), ev(6), ev(7)]).map((e) => e.seq)).toEqual([7]);
  });
});

describe('ServerClock', () => {
  it('왕복 절반을 보정하고 더 빠른 왕복 표본을 우선한다', () => {
    let local = 1000;
    const clock = new ServerClock(() => local);
    // 서버가 로컬보다 500 앞. 요청 1000→1100(왕복 100) 서버 시각 1600+50
    clock.sample(1550 + 0, 1000, 1100);
    local = 1100;
    expect(clock.now()).toBeCloseTo(1600, 0);
    // 느린 표본은 무시
    clock.sample(9999, 2000, 2800);
    expect(clock.offsetMs).toBeCloseTo(500, 0);
  });
});

describe('identity 난수', () => {
  it('crypto.getRandomValues로만 만든다 — 없으면 Math.random으로 대신하지 않고 던진다', () => {
    expect(randomHex(16)).toMatch(/^[0-9a-f]{32}$/);
    const spy = vi.spyOn(Math, 'random');
    vi.stubGlobal('crypto', undefined);
    try {
      expect(() => randomHex(16)).toThrow(NoCryptoError);
      expect(spy).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
      spy.mockRestore();
    }
  });
});
