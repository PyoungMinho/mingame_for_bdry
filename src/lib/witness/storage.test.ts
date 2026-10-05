/**
 * 저장 복원 — wt:save:v1 왕복 · 깨진 저장 폐기(meta 보존) · v 불일치 · 화이트리스트 · 체크포인트 · meta 관대 파싱 · 메모리 폴백.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RULES, applyResultToMeta, cancelAccuse, continueAfterSiren, exit, newMeta, newRun, openSet, pickCulprit, present, setSlot, startAccuse, submitAccusation, type RunState } from './engine';
import { STORAGE_KEYS, clearRun, isReplayRun, loadMeta, loadRun, memoryStorage, mergeMeta, openStorage, parseMeta, parseRun, saveMeta, saveRun, serializeRun, type StorageLike } from './storage';
import { RECALL_ELIGIBLE, endInvestigation, gradeCapOf, hint, keepSavedRun, rewind, rewindOption, type Accusation } from './engine';
import { CASE } from './case-data';
import { freeClosure, playPath } from './validate';

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

  it('v 또는 사건 id 가 다르면 status=version 으로 폐기(v 2 는 다시 하기 판 — 받아들인다, 3 부터 version)', () => {
    const s = memoryStorage();
    s.setItem(STORAGE_KEYS.run, JSON.stringify({ ...JSON.parse(JSON.stringify(mid())), v: 3 }));
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

// ═══════════════════════════════ 다시 하기 저장(docs/planning/witness-replay.md d · h-3) ═══════════════════════════════

const PERFECT = ['L3', 'T05', 'L1', 'T03', 'T02', 'L2', 'T04', 'P:L2.h3'];
const SHORT: Accusation = { culprit: CASE.solution.culprit, means: 'E02', opportunity: 'E03b', motive: 'E06' };
function judge(run: RunState, a: Accusation): RunState {
  let r = startAccuse(run).run;
  r = pickCulprit(r, a.culprit).run;
  r = setSlot(setSlot(setSlot(r, 'means', a.means).run, 'opportunity', a.opportunity).run, 'motive', a.motive).run;
  const s = submitAccusation(r);
  expect(s.error).toBeUndefined();
  return s.run;
}
const raw = (r: RunState) => JSON.parse(JSON.stringify(r)) as Record<string, unknown>;
/** 배포된 옛 코드(5a8f53a)의 run 문턱 — v 가 1 이 아니면 'version' 으로 판만 버린다(storage.ts 옛 loadRun 그대로) */
function oldLoadRun(st: StorageLike): { status: string } {
  const r = st.getItem(STORAGE_KEYS.run);
  if (!r) return { status: 'empty' };
  const o = JSON.parse(r) as Record<string, unknown>;
  if (o.v !== 1 || o.caseId !== 'witness-01') {
    st.removeItem(STORAGE_KEYS.run);
    return { status: 'version' };
  }
  return { status: 'ok' };
}

describe('다시 하기 — run 저장', () => {
  it('S1 새 필드(rewinds·attempts·prevAccuse·recall·accuseCp·actCp) 왕복 보존', () => {
    const st = memoryStorage();
    const mem = playPath(['T02', 'T03', 'T04', 'T05'], freeClosure(newRun({ recall: RECALL_ELIGIBLE, recallN: 5 })));
    const end = judge(mem, SHORT);
    const back = rewind(end).run;
    expect(back).toMatchObject({ rewinds: { judged: 1, excluded: 0 }, attempts: 1, recall: { n: 5 } });
    expect(back.prevAccuse && back.checkpoint && back.actCp).toBeTruthy();
    for (const r of [end, back]) {
      expect(saveRun(st, r)).toBe(true);
      const l = loadRun(st);
      expect(l.status).toBe('ok');
      expect(l.run).toEqual(raw(r));
    }
  });

  it('S2 손상 → 판 폐기: 스냅샷 중첩 · recall id 범위 밖·중복·빈 목록 · judged 3 · attempts 4 · 잘못된 prevAccuse', () => {
    const end = judge(playPath(PERFECT), SHORT);
    const base = raw(end);
    const bad: Record<string, unknown>[] = [
      { ...base, accuseCp: { ...(base.accuseCp as object), actCp: base.actCp } },
      { ...base, actCp: { ...(base.actCp as object), checkpoint: base.checkpoint } },
      { ...base, recall: { n: 2, ids: ['E03b'] } },
      { ...base, recall: { n: 2, ids: ['E05', 'E05'] } },
      { ...base, recall: { n: 2, ids: [] } },
      { ...base, recall: { n: 0, ids: ['E05'] } },
      { ...base, rewinds: { judged: 3, excluded: 0 } },
      { ...base, rewinds: { judged: 0 } },
      { ...base, attempts: 4 },
      { ...base, prevAccuse: { culprit: 'AI' } },
      { ...base, prevAccuse: { culprit: 'S1', means: 'E99' } },
      { ...base, prevAccuse: { notCulprit: 'AI' } },
      { ...base, prevAccuse: { culprit: 'S1', miss: ['who'] } },
      { ...base, prevAccuse: { culprit: 'S1', miss: 'motive' } },
      { ...base, result: { ...(base.result as object), attempt: 4 } },
      { ...base, result: { ...(base.result as object), recallRun: 0 } },
    ];
    for (const b of bad) expect(parseRun(JSON.stringify(b)), JSON.stringify(b).slice(0, 80)).toBeNull();
    expect(parseRun(JSON.stringify(base))).not.toBeNull();
  });

  it('S2b 범인 틀린 뒤 prevAccuse(범인 없음 · notCulprit · miss) 왕복', () => {
    const base = raw(judge(playPath(PERFECT), SHORT));
    const pa = { notCulprit: 'S1', means: 'E02', miss: ['means'] };
    expect(parseRun(JSON.stringify({ ...base, prevAccuse: pa }))?.prevAccuse).toEqual(pa);
  });

  it('S3 기억 판·판정 되감기 판만 v:2(코어·스냅샷) — 옛 탭은 판만 버리고 meta 는 그대로', () => {
    const clean = judge(playPath(PERFECT), SHORT);
    expect(isReplayRun(clean)).toBe(false);
    expect(JSON.parse(serializeRun(clean)).v).toBe(1);
    const rewound = rewind(clean).run;
    expect(isReplayRun(rewound)).toBe(true);
    const out = JSON.parse(serializeRun(rewound));
    expect(out.v).toBe(2);
    expect(out.checkpoint.v).toBe(2);
    expect(out.actCp.v).toBe(2);
    const mem = newRun({ recall: RECALL_ELIGIBLE });
    expect(JSON.parse(serializeRun(mem)).v).toBe(2);
    // 수사 배제 되감기만 쓴 판은 옛 탭도 A 상한을 안다(rewound) → v:1 그대로
    let x = openSet(playPath(PERFECT), 'T01').run;
    while (x.phase !== 'ended') x = present(x, 'T01.1', ['E01']).run;
    expect(JSON.parse(serializeRun(rewind(x).run)).v).toBe(1);
    // 옛 탭: 'version' → run 키만 삭제, meta 는 손대지 않는다
    for (const r of [rewound, mem]) {
      const st = memoryStorage();
      const meta = { ...newMeta(), plays: 4 };
      saveMeta(st, meta);
      saveRun(st, r);
      expect(oldLoadRun(st).status).toBe('version');
      expect(st.getItem(STORAGE_KEYS.run)).toBeNull();
      expect(loadMeta(st)).toEqual(meta);
    }
    // 새 탭은 v 1·2 모두 받는다
    const st = memoryStorage();
    saveRun(st, rewound);
    expect(loadRun(st).run).toEqual(raw(rewound));
  });

  it('S4 배포 전 판(rewound:true, 새 필드 없음) 정상 로드 → rewinds {0,1} · 상한 A / rewound:false → 필드 없음', () => {
    const old = { ...raw(playPath(PERFECT)), rewound: true };
    const r = parseRun(JSON.stringify(old))!;
    expect(r).not.toBeNull();
    expect(r.rewinds).toEqual({ judged: 0, excluded: 1 });
    expect(gradeCapOf(r)).toBe('A');
    const clean = parseRun(JSON.stringify(raw(playPath(PERFECT))))!;
    expect(clean.rewinds).toBeUndefined();
    expect(gradeCapOf(clean)).toBeNull();
    // 배포 전 끝난 결과(attempt 없음) → 1 로 읽는다
    const end = raw(judge(playPath(PERFECT), SHORT));
    const res = { ...(end.result as Record<string, unknown>) };
    delete res.attempt;
    expect(parseRun(JSON.stringify({ ...end, result: res }))?.result?.attempt).toBe(1);
  });

  it('S6 되감기 선택지가 있는 끝난 판은 저장 유지 · 이어하기로 끝난 판 그대로(칩·되감기) / 선택지 없으면 삭제 대상', () => {
    const st = memoryStorage();
    const end = judge(playPath(PERFECT), SHORT);
    expect(keepSavedRun(end)).toBe(true);
    saveRun(st, end);
    const back = loadRun(st).run!;
    expect(back.phase).toBe('ended');
    expect(rewindOption(back)).toEqual({ kind: 'accuse', cost: 1, last: false });
    expect(rewind(back).error).toBeUndefined();
    // 시간 초과 ★2 — actCp 가 저장을 건너와도 되감기가 된다
    const star2 = playPath(['L2', 'T04', 'T05']);
    const t = endInvestigation(continueAfterSiren(hint({ ...star2, actions: 1 }).run).run).run;
    saveRun(st, t);
    expect(rewindOption(loadRun(st).run!)).toMatchObject({ kind: 'action' });
    // 소진·완벽 → 지운다
    let r = rewind(end).run;
    r = rewind(judge(r, SHORT)).run;
    const third = judge(r, SHORT);
    expect(keepSavedRun(third)).toBe(false);
  });
});

describe('다시 하기 — meta(found·best·lastEnding)', () => {
  const le = { ending: 'short', grade: 'B', stars: 3, evidence: 9, wrong: 0, hints: 0, actionsLeft: 2, playMs: 1, missed: ['E05', 'E09', 'E03b'], unbrokenStars: 4, hiddenTeaser: false, newAchievements: [], at: 1, pendingView: false };

  it('S5 found 없음 + lastEnding → 백필 · 잘못된 id 제거 · 16개 → 15 · v 1 유지 · found 를 지운 meta 재로드 → 복원', () => {
    const m = parseMeta(JSON.stringify({ v: 1, plays: 1, lastEnding: le }));
    expect(m.found).toEqual(RECALL_ELIGIBLE.filter((id) => !['E05', 'E09'].includes(id)));
    const junk = parseMeta(JSON.stringify({ v: 1, found: ['E05', 'E03b', 'E14', 'X', 7, 'E05', ...RECALL_ELIGIBLE] }));
    expect(junk.found).toEqual([...RECALL_ELIGIBLE]);
    expect(junk.found).toHaveLength(15);
    expect(parseMeta(JSON.stringify({ v: 1, found: 'nope' })).found).toEqual([]);
    expect(parseMeta(JSON.stringify({ v: 1 })).found).toBeUndefined();
    // 저장해도 v 1 그대로
    const st = memoryStorage();
    saveMeta(st, m);
    expect(JSON.parse(st.getItem(STORAGE_KEYS.meta)!).v).toBe(1);
    // 옛 탭이 found 를 지우고 저장해도 다음 로드에 lastEnding 으로 복원(멱등)
    const wiped = JSON.parse(st.getItem(STORAGE_KEYS.meta)!) as Record<string, unknown>;
    delete wiped.found;
    st.setItem(STORAGE_KEYS.meta, JSON.stringify(wiped));
    expect(loadMeta(st).found).toEqual(m.found);
    expect(parseMeta(JSON.stringify(loadMeta(st)))).toEqual(loadMeta(st));
  });

  it('best 범위 실패 → undefined, 다른 필드 불변 · lastEnding 칩 필드 왕복(깨진 칩 필드만 버림)', () => {
    const good = { used: 8, ms: 1000, grade: 'A', at: 5 };
    expect(parseMeta(JSON.stringify({ v: 1, plays: 2, best: good }))).toMatchObject({ plays: 2, best: good });
    for (const b of [{ ...good, used: 14 }, { ...good, used: -1 }, { ...good, grade: 'Z' }, { ...good, ms: -3 }, 'x']) {
      const m = parseMeta(JSON.stringify({ v: 1, plays: 2, best: b }));
      expect(m.best).toBeUndefined();
      expect(m.plays).toBe(2);
    }
    expect(parseMeta(JSON.stringify({ v: 1, lastEnding: { ...le, recallRun: 3, rewinds: 2 } })).lastEnding).toMatchObject({ recallRun: 3, rewinds: 2 });
    const broken = parseMeta(JSON.stringify({ v: 1, lastEnding: { ...le, recallRun: 0, rewinds: 'x' } })).lastEnding!;
    expect(broken.ending).toBe('short');
    expect(broken.recallRun).toBeUndefined();
    expect(broken.rewinds).toBeUndefined();
  });

  it('엔딩 반영(되감기·기억 판) → lastEnding 칩·found·best 저장 왕복', () => {
    const st = memoryStorage();
    const end = judge(playPath(PERFECT), SHORT);
    const res = judge(rewind(end).run, { ...SHORT, motive: 'E09' }).result!;
    expect(res).toMatchObject({ ending: 'perfect', grade: 'A', rewinds: 1, attempt: 2 });
    let m = applyResultToMeta(newMeta(), end.result!, 1);
    m = applyResultToMeta(m, res, 2);
    expect(m).toMatchObject({ plays: 1, lastEnding: { ending: 'perfect', rewinds: 1 } });
    expect(m.best).toBeUndefined();
    saveMeta(st, m);
    expect(loadMeta(st)).toEqual(m);
  });
});

describe('두 탭 meta 병합(A1)', () => {
  it('쌓이는 값은 잃지 않는다 · settings 는 이 탭 · lastEnding 은 늦은 쪽 · best 는 행동 적은 쪽', () => {
    const le = (at: number, pendingView: boolean) => ({ ending: 'short' as const, grade: 'B' as const, stars: 3, evidence: 9, wrong: 0, hints: 0, actionsLeft: 1, playMs: 1, missed: [], unbrokenStars: 0, hiddenTeaser: false, newAchievements: [], at, pendingView });
    const stored = { ...newMeta(), plays: 5, endings: ['perfect' as const], achievements: ['flawless' as never], readLines: ['a'], coach: ['x'], bestGrade: 'S' as const, found: ['E05'], best: { used: 8, ms: 9, grade: 'S' as const, at: 1 }, lastEnding: le(10, true) };
    const mine = { ...newMeta(), plays: 3, endings: ['short' as const], readLines: ['b'], coach: ['y'], bestGrade: 'B' as const, settings: { ...newMeta().settings, text: 'xl' as const }, found: ['E06'], best: { used: 10, ms: 1, grade: 'S' as const, at: 2 }, lastEnding: le(10, false) };
    const m = mergeMeta(stored, mine);
    expect(m.plays).toBe(5);
    expect([...m.endings].sort()).toEqual(['perfect', 'short']);
    expect(m.achievements).toEqual(['flawless']);
    expect([...m.readLines].sort()).toEqual(['a', 'b']);
    expect([...m.coach].sort()).toEqual(['x', 'y']);
    expect(m.bestGrade).toBe('S');
    expect(m.settings.text).toBe('xl');
    expect(m.found).toEqual(expect.arrayContaining(['E05', 'E06']));
    expect(m.best?.used).toBe(8);
    expect(m.lastEnding?.pendingView).toBe(false); // 같은 시각이면 이 탭(엔딩을 떠난 표시가 먹는다)
    expect(mergeMeta(stored, { ...mine, lastEnding: le(5, false) }).lastEnding?.at).toBe(10);
  });
});
