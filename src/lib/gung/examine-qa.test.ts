/**
 * QA 7판 「조사 따로」 — 살펴보기 엔진 공격 케이스(QA실행자, examine.test.ts 가 다루지 않은 길).
 *
 *  - 방장 단계 되돌리기(↶)로 살펴보기 횟수가 되살아나지 않는다(되돌리기 = 방장 진행 상태만).
 *  - 플레이어 단계 맞추기로 앞뒤로 오가도 본 기록·남은 횟수가 그대로다.
 *  - 이상한 입력(문자열·소수·NaN 라운드, 문자열 아닌 물건 id)은 같은 참조(no-op).
 *  - 손댄 저장: 다른 장소 물건 id 는 횟수에 안 들고 관찰도 안 뜬다 · 형식만 맞는 3개 기록이어도 더 살펴볼 수 없다.
 *  - 사건 버전이 다른 저장(6판 = v2)도 판은 살리고 versionMismatch 로 알린다 — 살펴보기는 v3 데이터로 돈다.
 *  - 라운드 잠금: 플레이어가 조사 2 에 있어도 조사 3 물건·줄은 결과에 없다(미래 라운드 살펴보기 거부).
 */
import { describe, expect, it } from 'vitest';
import { sejaCase as c } from './case-data';
import { applyAction, newHostGame, newPlayerGame, type GameAction, type GameState } from './game';
import { canExamine, examineLeft, myObservations, observationsIn } from './scene';
import { loadGame, memoryStorage, sanitizeGame, serializeGame, STORAGE_KEYS } from './storage';

const T0 = 1_700_000_000_000;
const CODE = '7F3K6';

function run(s: GameState, actions: GameAction[], start = T0, step = 1000): GameState {
  let now = start;
  for (const a of actions) {
    s = applyAction(s, a, { c, now });
    now += step;
  }
  return s;
}
const adv = (k: number): GameAction[] => Array.from({ length: k }, () => ({ type: 'advance' }) as GameAction);
const ex = (round: 1 | 2 | 3, objectId: string): GameAction => ({ type: 'examine', round, objectId });

describe('QA 7판 — 살펴보기 되돌리기·단계 이동', () => {
  it('방장: 조사 1 현장에서 둘 다 본 뒤 고르기로 넘어갔다가 ↶ 되돌려도 기록·횟수는 그대로(다시 볼 수 없다)', () => {
    // 방장 진행: 로비 → 브리핑 → 패 → 자기소개 → 조사 1(현장 보기)
    let s = newHostGame(c, CODE, T0)!;
    for (let i = 0; i < 12 && !(s.phase === 'r1' && s.host?.roundSub === 'scene'); i++) s = run(s, adv(1), T0 + i * 1000);
    expect([s.phase, s.host?.roundSub]).toEqual(['r1', 'scene']);
    s = run(s, [ex(1, 'OB-DG1'), ex(1, 'OB-DG2')]);
    expect(examineLeft(c, s.examined, 1)).toBe(0);
    s = run(s, [{ type: 'advance' }]); // 현장 → 고르기
    expect(s.host?.roundSub).toBe('select');
    const back = run(s, [{ type: 'undo' }]);
    expect(back.host?.roundSub).toBe('scene');
    expect(back.examined).toEqual({ 1: ['OB-DG1', 'OB-DG2'] });
    expect(canExamine(c, back.examined, 1, 'OB-DG3')).toBe(false);
    expect(run(back, [ex(1, 'OB-DG3')])).toBe(back);
  });

  it('플레이어: 단계 맞추기로 조사 2 → 조사 1 → 조사 2 를 오가도 본 기록·남은 횟수 그대로', () => {
    let s = run(newPlayerGame(c, CODE, 2, T0)!, adv(4)); // 조사 1
    s = run(s, [ex(1, 'OB-DG5'), { type: 'pickPlace', round: 1, placeId: 'ng' }, { type: 'syncPhase', phase: 'r2' }, ex(2, 'OB-NY2')]);
    expect(s.examined).toEqual({ 1: ['OB-DG5'], 2: ['OB-NY2'] });
    const there = run(s, [{ type: 'syncPhase', phase: 'r1' }, { type: 'syncPhase', phase: 'r2' }]);
    expect(there.examined).toEqual(s.examined);
    expect(examineLeft(c, there.examined, 2)).toBe(1);
    // 조사 1 은 장소를 정했으니 마감(남은 1번은 사라졌다)
    expect(run(there, [ex(1, 'OB-DG1')])).toBe(there);
  });

  it('미래 라운드 거부 — 조사 2 에선 조사 3 물건을 살펴볼 수 없고, 결과에 조사 3 줄이 없다', () => {
    const s = run(newPlayerGame(c, CODE, 3, T0)!, [...adv(4), { type: 'syncPhase', phase: 'r2' }]);
    expect(s.phase).toBe('r2');
    expect(run(s, [ex(3, 'OB-DG1')])).toBe(s);
    const r3Texts = (c.scenes ?? []).flatMap((sc) => sc.objects.flatMap((o) => o.lines.filter((l) => l.fromRound === 3).map((l) => l.text)));
    expect(r3Texts.length).toBe(5);
    const forged = { 1: ['OB-DG1', 'OB-DG2'], 2: ['OB-NY1'], 3: ['OB-DG3', 'OB-DG4'] };
    const shown = JSON.stringify(myObservations(c, forged, 2));
    for (const t of r3Texts) expect(shown.includes(t)).toBe(false);
  });

  it('이상한 입력은 같은 참조(no-op) — 문자열·소수·NaN·0·4 라운드, 문자열 아닌 물건 id', () => {
    const s = run(newPlayerGame(c, CODE, 4, T0)!, adv(4));
    const bad: unknown[] = [
      { type: 'examine', round: '1', objectId: 'OB-DG1' },
      { type: 'examine', round: 1.5, objectId: 'OB-DG1' },
      { type: 'examine', round: Number.NaN, objectId: 'OB-DG1' },
      { type: 'examine', round: 0, objectId: 'OB-DG1' },
      { type: 'examine', round: 4, objectId: 'OB-DG1' },
      { type: 'examine', round: 1, objectId: 7 },
      { type: 'examine', round: 1, objectId: null },
      { type: 'examine', round: 1, objectId: { id: 'OB-DG1' } },
    ];
    for (const a of bad) expect(applyAction(s, a as GameAction, { c, now: T0 + 5000 }), JSON.stringify(a)).toBe(s);
  });
});

describe('QA 7판 — 손댄 저장·사건 버전', () => {
  it('다른 장소 물건 id(조사 1 에 내의원 물건)는 횟수에 안 들고 관찰도 안 뜬다', () => {
    const s = run(newPlayerGame(c, CODE, 2, T0)!, adv(4));
    const raw = JSON.parse(serializeGame(s)!);
    raw.examined = { 1: ['OB-NY1', 'OB-NY3'] };
    const back = sanitizeGame(raw)!;
    expect(back.examined).toEqual({ 1: ['OB-NY1', 'OB-NY3'] }); // 저장 검증은 형식만 — 사건 대조는 엔진이
    expect(examineLeft(c, back.examined, 1)).toBe(2);
    expect(observationsIn(c, back.examined, 1)).toEqual([]);
    const after = run(back, [ex(1, 'OB-DG1'), ex(1, 'OB-DG2')]);
    expect(examineLeft(c, after.examined, 1)).toBe(0);
    expect(observationsIn(c, after.examined, 1).map((o) => o.objectId)).toEqual(['OB-DG1', 'OB-DG2']);
  });

  it('형식만 맞는 3개 기록(상한 3)이어도 더는 살펴볼 수 없다 — 남은 횟수 0, 넷째 거부', () => {
    const s = run(newPlayerGame(c, CODE, 2, T0)!, adv(4));
    const raw = JSON.parse(serializeGame(s)!);
    raw.examined = { 1: ['OB-DG1', 'OB-DG2', 'OB-DG3', 'OB-DG4'] };
    const back = sanitizeGame(raw)!;
    expect(back.examined?.[1]).toHaveLength(3);
    expect(examineLeft(c, back.examined, 1)).toBe(0);
    expect(run(back, [ex(1, 'OB-DG5')])).toBe(back);
  });

  it('6판(v2) 저장도 판은 살리고 versionMismatch 로 알린다 — 살펴보기는 v3 데이터로 돈다', () => {
    const s = run(newPlayerGame(c, CODE, 5, T0)!, adv(4));
    const raw = JSON.parse(serializeGame(s)!);
    raw.caseVersion = 2;
    delete raw.examined;
    const st = memoryStorage();
    st.setItem(STORAGE_KEYS.game, JSON.stringify(raw));
    const got = loadGame(st, T0 + 60_000, { caseId: c.id, caseVersion: c.version });
    expect(c.version).toBe(3);
    expect(got.status).toBe('ok');
    expect(got.versionMismatch).toBe(true);
    const next = run(got.state!, [ex(1, 'OB-DG4')]);
    expect(next.examined).toEqual({ 1: ['OB-DG4'] });
  });
});
