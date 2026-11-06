import { describe, expect, it } from 'vitest';
import { ENDINGS, EVENTS } from './content';
import {
  applyChoice,
  applyHearing,
  applyRecall,
  applyReview,
  currentEvent,
  hearingQuestions,
  isGameState,
  LEDGER_COST,
  newGame,
  openLedger,
} from './engine';
import type { ChoiceKind, EndingId, GameState } from './types';

/** 같은 시드면 같은 결과가 나오는 간단한 난수 */
function rng(seed: number) {
  let x = seed;
  return () => {
    x = (x * 1664525 + 1013904223) >>> 0;
    return x / 2 ** 32;
  };
}

function play(pick: (s: GameState) => { choice?: string; recall?: string | null; hearing?: string | null }): GameState {
  let s = newGame();
  for (let guard = 0; guard < 100 && !s.ending; guard += 1) {
    const ev = currentEvent(s);
    if (!ev) throw new Error('엔딩 없이 사건이 끝남');
    if (ev.type === 'review') s = applyReview(s).state;
    else if (ev.type === 'hearing') s = applyHearing(s, pick(s).hearing ?? null).state;
    else if (ev.type === 'choice') s = applyChoice(s, pick(s).choice ?? ev.choices[0].id).state;
    else s = applyRecall(s, pick(s).recall ?? null).state;
  }
  return s;
}

function byKind(order: ChoiceKind[]) {
  return (s: GameState) => {
    const ev = currentEvent(s);
    if (ev?.type !== 'choice') return { recall: null };
    for (const kind of order) {
      const found = ev.choices.find((c) => c.kind === kind);
      if (found) return { choice: found.id };
    }
    return { choice: ev.choices[0].id };
  };
}

describe('시나리오 무결성', () => {
  it('사건 id가 겹치지 않고 모든 사건에 대사가 있다', () => {
    const ids = EVENTS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const ev of EVENTS) expect(ev.lines.length).toBeGreaterThan(0);
  });

  it('추궁 보기에는 플레이어가 고를 수 있었던 값이 전부 들어 있다', () => {
    for (const ev of EVENTS) {
      if (ev.type !== 'recall') continue;
      const values = EVENTS.flatMap((e) =>
        e.type === 'choice' ? e.choices.filter((c) => c.lie?.id === ev.lieId).map((c) => c.lie?.value) : [],
      );
      expect(values.length).toBeGreaterThan(0);
      for (const value of values) expect(ev.options).toContain(value);
    }
  });
});

describe('거짓말 장부', () => {
  it('거짓말을 고르면 장부에 내용이 남는다', () => {
    const s = applyChoice(applyChoice(newGame(), 'daegu').state, 'school_달구벌고').state;
    expect(s.lies.map((l) => l.value)).toEqual(['달구벌고']);
  });

  it('고른 학교와 같아야 추궁을 넘긴다', () => {
    const base = applyChoice(applyChoice(newGame(), 'daegu').state, 'school_달구벌고').state;
    const at = { ...base, eventIndex: EVENTS.findIndex((e) => e.id === 'daegu_return') };
    expect(applyRecall(at, '달구벌고').recall).toBe('correct');
    expect(applyRecall(at, '팔공고').recall).toBe('wrong');
    expect(applyRecall(at, null).recall).toBe('dodge');
    expect(applyRecall(at, '팔공고').state.nearMisses).toBe(1);
  });

  it('거짓말을 안 했으면 돌아오는 사건도 나오지 않는다', () => {
    const seen = new Set<string>();
    play((s) => {
      const ev = currentEvent(s);
      if (ev) seen.add(ev.id);
      return byKind(['tact', 'honest'])(s);
    });
    for (const id of ['school', 'hiking_return', 'excel_return', 'leave3', 'daegu_return']) {
      expect(seen.has(id)).toBe(false);
    }
  });

  it('할머니는 세 번째에야 인사팀에 걸린다', () => {
    const seen: string[] = [];
    const s = play((state) => {
      const ev = currentEvent(state);
      if (ev?.type === 'choice') {
        seen.push(ev.id);
        const grandma = ev.choices.find((c) => c.grandma);
        if (grandma) return { choice: grandma.id };
        return byKind(['tact'])(state);
      }
      return { recall: null };
    });
    expect(seen).toContain('leave3');
    expect(s.grandma).toBe(3);
  });

  it('장부 비용은 사건당 한 번만 받고, 거짓말이 없으면 받지 않는다', () => {
    expect(openLedger(newGame()).charged).toBe(0);
    const s = applyChoice(applyChoice(newGame(), 'daegu').state, 'school_팔공고').state;
    const first = openLedger(s);
    expect(first.charged).toBe(LEDGER_COST);
    expect(openLedger(first.state).charged).toBe(0);
  });

  it('의심도가 끝까지 차면 그 자리에서 들통난다', () => {
    const s = { ...newGame(), sus: 99 };
    expect(applyChoice(s, 'daegu').state.ending).toBe('caught');
  });

  it('저장본 검사는 이상한 값을 거른다', () => {
    expect(isGameState(newGame())).toBe(true);
    expect(isGameState({ v: 2 })).toBe(false);
    expect(isGameState({ ...newGame(), eventIndex: 9999 })).toBe(false);
  });
});

/** 장부를 완벽히 외운 사람의 답 */
const perfectMemory = (s: GameState) => {
  const ev = currentEvent(s);
  if (ev?.type === 'recall') return { recall: s.lies.find((l) => l.id === ev.lieId)?.value };
  if (ev?.type === 'hearing') return { hearing: hearingQuestions(s)[s.hearingStep]?.lie.claim };
  return {};
};

/** 의심도가 낮을 때만 거짓말을 하는 사람 */
const carefulLiar = (limit: number) => (s: GameState) => {
  const ev = currentEvent(s);
  if (ev?.type !== 'choice') return perfectMemory(s);
  const stay = ev.choices.find((c) => !c.ending && c.kind !== 'honest') ?? ev.choices.find((c) => !c.ending);
  if (s.sus < limit) {
    const lie = ev.choices.find((c) => c.lie && c.kind === 'exaggerate') ?? ev.choices.find((c) => c.lie);
    if (lie) return { choice: lie.id };
  }
  const safe = ev.choices.find((c) => c.kind === 'tact' && !c.ending) ?? ev.choices.find((c) => c.kind === 'honest' && !c.ending);
  return { choice: (safe ?? stay ?? ev.choices[0]).id };
};

describe('밸런스', () => {
  it('눈치껏 하면 거짓말 없이도 대표가 될 수 있다', () => {
    const s = play(byKind(['tact', 'honest']));
    expect(s.ending).toBe('ceo_clean');
    expect(s.lies).toHaveLength(0);
  });

  it('솔직하기만 하면 인턴에서 계약이 끝난다', () => {
    expect(play(byKind(['honest'])).ending).toBe('contract_end');
  });

  it('거짓말만 하고 기억도 못 하면 끝까지 못 버틴다', () => {
    const s = play((state) => {
      const ev = currentEvent(state);
      if (ev?.type === 'recall') return { recall: ev.options.find((o) => o !== state.lies.find((l) => l.id === ev.lieId)?.value) };
      return byKind(['exaggerate', 'excuse', 'frame'])(state);
    });
    expect(['caught', 'arrested']).toContain(s.ending);
    expect(s.rank).not.toBe('ceo');
  });

  it('조심해서 거짓말하고 잘 외우면 대표가 된다', () => {
    const s = play(carefulLiar(45));
    expect(s.ending).toBe('ceo_liar');
    expect(s.lies.length).toBeGreaterThanOrEqual(8);
  });

  it('이사회에서 다 인정해도 대표가 될 수 있다', () => {
    const s = play((state) => {
      if (currentEvent(state)?.type === 'hearing') return { hearing: null };
      return carefulLiar(45)(state);
    });
    expect(s.ending).toBe('ceo_confess');
  });

  it('치킨집은 언제든 고를 수 있는 출구다', () => {
    const s = play((state) => {
      const ev = currentEvent(state);
      const exit = ev?.type === 'choice' ? ev.choices.find((c) => c.ending === 'chicken') : undefined;
      return exit ? { choice: exit.id } : carefulLiar(45)(state);
    });
    expect(s.ending).toBe('chicken');
  });

  // 거짓말 없는 대표는 일부러 희귀해서 무작위로는 안 나온다. 위의 '눈치껏' 테스트가 도달을 확인한다.
  it('무작위로 해도 나머지 엔딩은 전부 나온다', () => {
    const seen = new Set<EndingId>();
    const random = rng(42);
    const remember = 0.7;
    for (let i = 0; i < 12000; i += 1) {
      // 판마다 거짓말 성향이 다른 사람을 흉내 낸다
      const lieBias = random();
      const s = play((state) => {
        const ev = currentEvent(state);
        if (ev?.type === 'choice') {
          const pool = ev.choices.filter((c) => !c.ending || random() < 0.5);
          const lies = pool.filter((c) => c.lie);
          const safe = pool.filter((c) => !c.lie);
          const from = random() < lieBias && lies.length ? lies : safe.length ? safe : pool;
          return { choice: from[Math.floor(random() * from.length)].id };
        }
        if (ev?.type === 'recall') return random() < remember ? perfectMemory(state) : { recall: ev.options[0] };
        if (ev?.type === 'hearing') {
          const r = random();
          if (r < 0.5) return perfectMemory(state);
          if (r < 0.8) return { hearing: null };
          return { hearing: '기억 안 나는 내용' };
        }
        return {};
      });
      if (s.ending) seen.add(s.ending);
    }
    const expected = Object.keys(ENDINGS).filter((id) => id !== 'ceo_clean');
    expect([...seen].sort()).toEqual(expected.sort());
  });
});

describe('이사회', () => {
  const atHearing = (lies: GameState['lies']): GameState => ({
    ...newGame(),
    rank: 'exec',
    perf: 90,
    sus: 40,
    lies,
    eventIndex: EVENTS.findIndex((e) => e.id === 'hearing'),
  });
  const told = (claim: string, id = claim) => ({ id, label: '고향', claim, rank: 'intern' as const, year: 1 });

  it('질문은 최대 5개이고 보기에는 내가 한 말이 들어 있다', () => {
    const lies = Array.from({ length: 9 }, (_, i) => told(`말${i}`));
    const qs = hearingQuestions(atHearing(lies));
    expect(qs).toHaveLength(5);
    for (const q of qs) {
      expect(q.options).toContain(q.lie.claim);
      expect(new Set(q.options).size).toBe(q.options.length);
      expect(q.options.length).toBe(3);
    }
  });

  it('학교 거짓말의 오답 보기는 내가 안 고른 다른 학교다', () => {
    const q = hearingQuestions(atHearing([{ ...told('대구 달구벌고 출신', 'school'), value: '달구벌고' }]))[0];
    expect(q.options).toContain('대구 수성제일고 출신');
    expect(q.options).toContain('대구 팔공고 출신');
  });

  it('이사회에서는 장부를 열 수 없다', () => {
    expect(openLedger(atHearing([told('말')])).charged).toBe(0);
  });

  it('맞히면 그대로고 틀리면 크게 늘고, 끝나면 표결로 넘어간다', () => {
    const s = atHearing([told('말')]);
    expect(applyHearing(s, '다른 말').delta.sus).toBe(18);
    const done = applyHearing(s, '말');
    expect(done.delta.sus).toBe(0);
    expect(currentEvent(done.state)?.id).toBe('review_final');
  });

  it('임원이 들통나면 구속이다', () => {
    const s = { ...atHearing([told('말')]), sus: 95 };
    expect(applyHearing(s, '다른 말').state.ending).toBe('arrested');
  });

  it('회계를 건드렸으면 임원 전이라도 구속이다', () => {
    const s: GameState = { ...newGame(), sus: 99, flags: ['fraud'] };
    expect(applyChoice(s, 'daegu').state.ending).toBe('arrested');
  });
});
