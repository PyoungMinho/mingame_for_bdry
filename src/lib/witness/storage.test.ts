/**
 * 저장 복원 — wt:save:v1 왕복 · 깨진 저장 폐기(meta 보존) · v 불일치 · 화이트리스트 · 체크포인트 · meta 관대 파싱 · 메모리 폴백.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RULES, applyResultToMeta, cancelAccuse, continueAfterSiren, exit, newMeta, newRun, openSet, pickCulprit, present, setSlot, startAccuse, submitAccusation, type RunState } from './engine';
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
      { ...base, actions: 14 },
      { ...base, rev: 3 },
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

describe('소리 설정(나중에 더한 필드)', () => {
  it('옛 저장(소리 필드 없음) → 배경음악 보통 · 효과음 보통 · 켬, 다른 설정은 그대로', () => {
    const m = parseMeta(JSON.stringify({ v: 1, plays: 2, endings: ['perfect'], secrets: [], achievements: [], readLines: [], settings: { speed: 'fast', text: 'xl', haptics: false, hubView: 'list' }, coach: [] }));
    expect(m.settings).toMatchObject({ bgm: 2, sfx: 2, muted: false, speed: 'fast', text: 'xl', haptics: false, hubView: 'list' });
    expect(m.plays).toBe(2);
  });

  it('깨진 값은 기본값, 올바른 값은 그대로 · 저장 왕복', () => {
    const bad = parseMeta(JSON.stringify({ v: 1, settings: { bgm: 7, sfx: '3', muted: 'yes' } }));
    expect(bad.settings).toMatchObject({ bgm: 2, sfx: 2, muted: false });
    const s = memoryStorage();
    const m = { ...newMeta(), settings: { ...newMeta().settings, bgm: 0 as const, sfx: 3 as const, muted: true } };
    saveMeta(s, m);
    expect(loadMeta(s).settings).toMatchObject({ bgm: 0, sfx: 3, muted: true });
    for (const lv of [0, 1, 2, 3] as const) expect(parseMeta(JSON.stringify({ v: 1, settings: { bgm: lv, sfx: lv } })).settings).toMatchObject({ bgm: lv, sfx: lv });
  });
});

describe('규칙 개정(행동 12 → 13) 이어하기 호환 — rev 없는 옛 저장 이관', () => {
  /** 옛 규칙(행동 12)으로 진행 중이던 저장을 흉내 낸다: rev 없음, 남은 행동 = 새 규칙의 값 − 1 */
  const legacyOf = (run: RunState): Record<string, unknown> => {
    const raw = JSON.parse(JSON.stringify(run)) as Record<string, unknown>;
    delete raw.rev;
    raw.actions = (raw.actions as number) - 1;
    const cp = raw.checkpoint as Record<string, unknown> | undefined;
    if (cp) {
      delete cp.rev;
      cp.actions = (cp.actions as number) - 1;
    }
    return raw;
  };

  it('진행 중(play) 판은 남은 행동 +1 로 새 규칙에 이관 — 증거·돌파·신뢰·시각은 그대로(쓴 행동 수 보존)', () => {
    const now = openSet(mid(), 'T02').run; // 체크포인트 포함
    expect(now.actions).toBe(8);
    const old = legacyOf(now); // 옛 규칙: 남은 7
    expect(old.actions).toBe(7);
    const back = parseRun(JSON.stringify(old))!;
    expect(back.rev).toBe(2);
    expect(back.actions).toBe(8);
    expect(back.checkpoint?.actions).toBe(now.checkpoint!.actions);
    expect(back.checkpoint?.rev).toBe(2);
    expect(back.evidence).toEqual(now.evidence);
    expect(back.broken).toEqual(now.broken);
    expect(back.trust).toBe(now.trust);
    expect(back.visited).toEqual(now.visited);
    // 쓴 행동 수(= 예산 − 남은)가 이관 전(12 − 7 = 5)과 같다
    expect(RULES.normal.actions - back.actions).toBe(12 - 7);
  });

  it('이관한 판으로 계속 플레이 — 사이렌 뒤 재방문·새 규칙이 그대로 적용된다', () => {
    // 옛 규칙의 마지막 행동 중(남은 0, final 에 대상, phase play) — 이관하면 행동 1, final 비움
    let r = openSet({ ...playPath(['L3', 'T05']), actions: 1 }, 'T01').run;
    expect(r).toMatchObject({ actions: 0, phase: 'play' });
    const old = JSON.parse(JSON.stringify(r)) as Record<string, unknown>;
    delete old.rev;
    delete (old as { checkpoint?: unknown }).checkpoint;
    const back = parseRun(JSON.stringify(old))!;
    expect(back).toMatchObject({ actions: 1, phase: 'play', final: [] });
    r = back;
    // 새 규칙: 남은 1 로 새 증언을 더 열 수 있다
    expect(openSet(r, 'T02').error).toBeUndefined();
  });

  it('이미 사이렌이 울린 옛 판(phase siren)은 행동 그대로 0 — [계속] 은 허브로, 이미 연 곳은 다시 열린다', () => {
    const run = exit({ ...playPath(['L3', 'T05']), actions: 0 }).run;
    expect(run.phase).toBe('siren');
    const old = JSON.parse(JSON.stringify(run)) as Record<string, unknown>;
    delete old.rev;
    const back = parseRun(JSON.stringify(old))!;
    expect(back).toMatchObject({ phase: 'siren', actions: 0, rev: 2, screen: { name: 'siren' } });
    const hub = continueAfterSiren(back);
    expect(hub.error).toBeUndefined();
    expect(hub.run.screen.name).toBe('hub');
    expect(openSet(hub.run, 'T05').error).toBeUndefined(); // 이미 연 증언
    expect(openSet(hub.run, 'T01').error).toBe('siren'); // 새 증언은 막힘
  });

  it('옛 강제 지목 저장(accuse.forced true · 사이렌 뒤)은 읽힌 뒤 취소·경고가 된다', () => {
    let run = playPath(['L2', 'T04', 'T05', 'L3']);
    run = exit({ ...run, actions: 0 }).run;
    const old = JSON.parse(JSON.stringify({ ...run, screen: { name: 'accuse' }, accuse: { stage: 'suspect', forced: true } })) as Record<string, unknown>;
    delete old.rev;
    const back = parseRun(JSON.stringify(old))!;
    expect(back.phase).toBe('siren');
    const c = cancelAccuse(back);
    expect(c.error).toBeUndefined();
    expect(c.run).toMatchObject({ screen: { name: 'hub' } });
    expect(c.run.accuse).toBeUndefined();
  });

  it('끝난 옛 판은 결과 그대로(행동·등급 불변)', () => {
    let r = playPath(['L3', 'T05', 'L1', 'T03', 'T02', 'L2', 'T04', 'P:L2.h3']);
    r = startAccuse(r).run;
    r = pickCulprit(r, CASE.solution.culprit).run;
    r = setSlot(setSlot(setSlot(r, 'means', 'E02').run, 'opportunity', 'E03b').run, 'motive', 'E09').run;
    const end = submitAccusation(r).run;
    const old = JSON.parse(JSON.stringify(end)) as Record<string, unknown>;
    delete old.rev;
    const back = parseRun(JSON.stringify(old))!;
    expect(back.actions).toBe(end.actions);
    expect(back.result).toEqual(JSON.parse(JSON.stringify(end.result)));
  });

  it('새 저장 왕복은 이관하지 않는다(행동 +1 이 두 번 붙지 않는다) · 예산 상한 13', () => {
    const run = mid();
    const back = parseRun(JSON.stringify(run))!;
    expect(back.actions).toBe(run.actions);
    const full = parseRun(JSON.stringify(JSON.parse(JSON.stringify(newRun())))); // 새 판(13)
    expect(full?.actions).toBe(13);
    // 옛 저장이 이미 상한(12) → 13 을 넘지 않는다
    const old = JSON.parse(JSON.stringify(newRun())) as Record<string, unknown>;
    delete old.rev;
    old.actions = 12;
    expect(parseRun(JSON.stringify(old))?.actions).toBe(13);
  });
});
