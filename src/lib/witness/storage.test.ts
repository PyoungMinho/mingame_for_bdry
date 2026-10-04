/**
 * 저장 복원 — wt:save:v1 왕복 · 깨진 저장 폐기(meta 보존) · v 불일치 · 화이트리스트 · 체크포인트 · meta 관대 파싱 · 메모리 폴백.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyResultToMeta, newMeta, newRun, openSet, pickCulprit, present, setSlot, startAccuse, submitAccusation, type RunState } from './engine';
import { STORAGE_KEYS, clearRun, loadMeta, loadRun, memoryStorage, openStorage, parseMeta, parseRun, saveMeta, saveRun, type StorageLike } from './storage';
import { CASE } from './case-data';
import { playPath } from './validate';

const mid = (): RunState => playPath(['L3', 'T05', 'L1', 'T03']);

describe('run 저장·복원', () => {
  it('키는 wt:save:v1 · wt:meta:v1', () => {
    expect(STORAGE_KEYS).toEqual({ run: 'wt:save:v1', meta: 'wt:meta:v1' });
  });

  it('진행 중 상태(체크포인트 포함) 왕복 = 원본과 같다', () => {
    const s = memoryStorage();
    let run = mid();
    run = openSet(run, 'T02').run;
    expect(run.checkpoint).toBeTruthy();
    expect(saveRun(s, run)).toBe(true);
    const back = loadRun(s);
    expect(back.status).toBe('ok');
    expect(back.run).toEqual(JSON.parse(JSON.stringify(run)));
  });

  it('엔딩 결과·지목 초안·힌트 기록도 복원', () => {
    const s = memoryStorage();
    let r = playPath(['L3', 'T05', 'L1', 'T03', 'T02', 'L2', 'T04', 'P:L2.h3']);
    r = startAccuse(r).run;
    r = pickCulprit(r, CASE.solution.culprit).run;
    r = setSlot(r, 'means', 'E02').run;
    saveRun(s, r);
    expect(loadRun(s).run?.accuse).toEqual({ stage: 'slots', culprit: CASE.solution.culprit, means: 'E02', forced: false });
    r = setSlot(setSlot(r, 'opportunity', 'E03b').run, 'motive', 'E09').run;
    const end = submitAccusation(r).run;
    saveRun(s, end);
    const back = loadRun(s).run!;
    expect(back.phase).toBe('ended');
    expect(back.result).toEqual(JSON.parse(JSON.stringify(end.result)));
  });

  it('없는 선택 필드는 기본값(phase play, final [], freePass [])', () => {
    const run = mid();
    const raw = JSON.parse(JSON.stringify(run)) as Record<string, unknown>;
    delete raw.phase;
    delete raw.final;
    delete raw.freePass;
    delete raw.mode;
    const back = parseRun(JSON.stringify(raw))!;
    expect(back).toMatchObject({ phase: 'play', final: [], freePass: [], mode: 'normal' });
  });

  it('모르는 필드는 버린다(화이트리스트)', () => {
    const raw = { ...JSON.parse(JSON.stringify(mid())), spoiler: '범인', extra: 1 };
    const back = parseRun(JSON.stringify(raw))! as unknown as Record<string, unknown>;
    expect(back.spoiler).toBeUndefined();
    expect(back.extra).toBeUndefined();
  });

  it('깨진 저장은 폐기(키 삭제) — JSON 오류 · 없는 id · 범위 밖 값 · 중첩 체크포인트', () => {
    const base = JSON.parse(JSON.stringify(openSet(mid(), 'T02').run));
    const bad: unknown[] = [
      '{not json',
      { ...base, evidence: [...base.evidence, 'E99'] },
      { ...base, broken: ['C77'] },
      { ...base, actions: 13 },
      { ...base, trust: -1 },
      { ...base, hints: 3 },
      { ...base, visited: 'L1' },
      { ...base, screen: { name: 'nowhere' } },
      { ...base, phase: 'ended' },
      { ...base, checkpoint: { ...base.checkpoint, checkpoint: base.checkpoint } },
      { ...base, checkpoint: { ...base.checkpoint, flags: ['F_NOPE'] } },
      { ...base, secrets: ['AI'] },
      null,
      [],
    ];
    for (const b of bad) {
      const s = memoryStorage();
      s.setItem(STORAGE_KEYS.run, typeof b === 'string' ? b : JSON.stringify(b));
      s.setItem(STORAGE_KEYS.meta, JSON.stringify({ ...newMeta(), plays: 2 }));
      const r = loadRun(s);
      expect(r.run).toBeNull();
      expect(['corrupt', 'version']).toContain(r.status);
      expect(s.getItem(STORAGE_KEYS.run)).toBeNull();
      expect(loadMeta(s).plays).toBe(2);
    }
  });

  it('v 또는 사건 id 가 다르면 status=version 으로 폐기', () => {
    const s = memoryStorage();
    s.setItem(STORAGE_KEYS.run, JSON.stringify({ ...JSON.parse(JSON.stringify(mid())), v: 2 }));
    expect(loadRun(s)).toEqual({ status: 'version', run: null });
    s.setItem(STORAGE_KEYS.run, JSON.stringify({ ...JSON.parse(JSON.stringify(mid())), caseId: 'witness-02' }));
    expect(loadRun(s).status).toBe('version');
  });

  it('빈 저장 · 지우기', () => {
    const s = memoryStorage();
    expect(loadRun(s)).toEqual({ status: 'empty', run: null });
    saveRun(s, newRun());
    clearRun(s);
    expect(s.getItem(STORAGE_KEYS.run)).toBeNull();
  });

  it('복원한 상태로 계속 플레이할 수 있다(엔진 규칙 그대로)', () => {
    const s = memoryStorage();
    saveRun(s, mid());
    const back = loadRun(s).run!;
    const after = playPath(['T02', 'L2', 'T04', 'P:L2.h3'], back);
    expect(after.evidence).toContain('E03b');
  });

  it('수사 배제 상태도 되감기용 체크포인트와 함께 복원', () => {
    let r = openSet(mid(), 'T01').run;
    for (let i = 0; i < 5; i++) r = present(r, 'T01.1', ['E01']).run;
    const s = memoryStorage();
    saveRun(s, r);
    const back = loadRun(s).run!;
    expect(back.result?.ending).toBe('excluded');
    expect(back.checkpoint?.opened).not.toContain('T01');
  });
});

describe('meta', () => {
  it('왕복', () => {
    const s = memoryStorage();
    const m = { ...newMeta(), plays: 3, endings: ['perfect', 'wrong-S1'], achievements: ['flawless'], bestGrade: 'A', coach: ['first-dot'] } as ReturnType<typeof newMeta>;
    saveMeta(s, m);
    expect(loadMeta(s)).toEqual(m);
  });

  it('필드 단위로 관대하게 — 깨진 필드만 기본값', () => {
    const m = parseMeta(JSON.stringify({ v: 1, plays: -3, endings: ['perfect', 'nope', 'wrong-S9'], secrets: ['S1', 'AI'], achievements: ['flawless', 'x'], bestGrade: 'Z', settings: { speed: 'warp', text: 'l', haptics: false } }));
    expect(m.plays).toBe(0);
    expect(m.endings).toEqual(['perfect']);
    expect(m.secrets).toEqual(['S1']);
    expect(m.achievements).toEqual(['flawless']);
    expect(m.bestGrade).toBeUndefined();
    expect(m.settings).toMatchObject({ speed: 'normal', text: 'l', haptics: false });
  });

  it('JSON 오류·다른 v → 새 meta', () => {
    expect(parseMeta('{oops')).toEqual(newMeta());
    expect(parseMeta(JSON.stringify({ v: 9, plays: 5 }))).toEqual(newMeta());
  });

  it('엔딩 반영 뒤 lastEnding 까지 왕복', () => {
    const s = memoryStorage();
    let r = playPath(['L3', 'T05', 'L1', 'T03', 'T02', 'L2', 'T04', 'P:L2.h3']);
    r = startAccuse(r).run;
    r = pickCulprit(r, CASE.solution.culprit).run;
    r = setSlot(setSlot(setSlot(r, 'means', 'E02').run, 'opportunity', 'E03b').run, 'motive', 'E09').run;
    const end = submitAccusation(r).run;
    const m = applyResultToMeta(newMeta(), end.result!, 123);
    saveMeta(s, m);
    expect(loadMeta(s)).toEqual(m);
  });
});

describe('저장소 열기 — 막히면 메모리 폴백(절대 throw 안 함)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('localStorage 가 throw 하면 persistent=false', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    });
    const o = openStorage();
    expect(o.persistent).toBe(false);
    expect(saveRun(o.storage, newRun())).toBe(true);
  });

  it('쓰기·읽기 실패도 조용히', () => {
    const broken: StorageLike = {
      getItem: () => {
        throw new Error('x');
      },
      setItem: () => {
        throw new Error('x');
      },
      removeItem: () => {
        throw new Error('x');
      },
    };
    expect(saveRun(broken, newRun())).toBe(false);
    expect(loadRun(broken)).toEqual({ status: 'empty', run: null });
    expect(saveMeta(broken, newMeta())).toBe(false);
    expect(loadMeta(broken)).toEqual(newMeta());
    expect(() => clearRun(broken)).not.toThrow();
  });

  it('localStorage 가 되면 persistent=true', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    expect(openStorage().persistent).toBe(true);
  });
});
