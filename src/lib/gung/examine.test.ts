/**
 * 7판 살펴보기 — 엔진 액션('examine')·저장·마감(원고 10-1 · 9-9 「조사 따로」).
 *
 *  - 라운드당 2번(sceneRoute.examine) · 같은 조사에 같은 물건 두 번 금지 · 그 조사 이동 장소의 물건만 · 들어서지 않은 조사 금지.
 *  - 한 번 본 건 되돌릴 수 없다(되돌리기 액션이 없다 — 장소 되돌리기·단계 되돌리기로도 지워지지 않는다).
 *  - 장소를 확정하면(pickPlace) 그 조사의 남은 살펴보기는 마감 — 6초 되돌리기(unpickPlace) 안에선 되살아난다.
 *  - 기록은 이 폰 게임 저장에만(새로고침 유지) · 결과·공유·초대 링크엔 없다 · 자리를 바꾸면 지운다.
 *  - 역할 무관: 같은 판에서 자리(역할)만 다른 플레이어도 같은 규칙.
 */
import { describe, expect, it } from 'vitest';
import { sejaCase as c } from './case-data';
import { applyAction, newHostGame, newPlayerGame, type GameAction, type GameState } from './game';
import { examineLeft, myObservations, observationsIn } from './scene';
import { invitePayload, scenePayload } from './share';
import { loadGame, memoryStorage, sanitizeGame, saveGame, serializeGame, STORAGE_KEYS } from './storage';
import { parseRoomCode } from './room';

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
/** 플레이어 조사 1(로비 → 브리핑 → 패 → 자기소개 → 조사 1) */
const playerR1 = (seat = 3) => run(newPlayerGame(c, CODE, seat, T0)!, adv(4));

describe('살펴보기 — 엔진 액션', () => {
  it('조사 1: 동궁전 물건 2개까지 · 같은 물건 두 번·3번째·내의원 물건·다음 조사는 무시', () => {
    let s = playerR1();
    expect(s.phase).toBe('r1');
    s = run(s, [ex(1, 'OB-DG1')]);
    expect(s.examined).toEqual({ 1: ['OB-DG1'] });
    const same = run(s, [ex(1, 'OB-DG1'), ex(1, 'OB-NY1'), ex(2, 'OB-NY1'), ex(1, 'OB-ZZ1')]);
    expect(same).toBe(s); // 아무것도 바뀌지 않으면 같은 객체(저장·렌더 없음)
    s = run(s, [ex(1, 'OB-DG5')]);
    expect(s.examined).toEqual({ 1: ['OB-DG1', 'OB-DG5'] });
    expect(examineLeft(c, s.examined, 1)).toBe(0);
    expect(run(s, [ex(1, 'OB-DG2')])).toBe(s);
  });

  it('장소를 확정하면 마감 · 6초 되돌리기면 되살아남 · 본 기록은 장소 되돌리기로도 지워지지 않는다', () => {
    let s = run(playerR1(), [ex(1, 'OB-DG3'), { type: 'pickPlace', round: 1, placeId: 'dg' }]);
    expect(s.rounds[1]?.placeId).toBe('dg');
    expect(run(s, [ex(1, 'OB-DG4')])).toBe(s);
    s = run(s, [{ type: 'unpickPlace', round: 1 }]);
    expect(s.rounds[1]).toBeUndefined();
    expect(s.examined).toEqual({ 1: ['OB-DG3'] });
    s = run(s, [ex(1, 'OB-DG4')]);
    expect(s.examined).toEqual({ 1: ['OB-DG3', 'OB-DG4'] });
  });

  it('조사 2 = 내의원 · 조사 3 = 동궁전(다시) — 조사 1 에 본 물건도 다시 고를 수 있고 R1+R3 줄이 뜬다', () => {
    let s = run(playerR1(), [ex(1, 'OB-DG4'), ex(1, 'OB-DG5'), { type: 'pickPlace', round: 1, placeId: 'dg' }, { type: 'advance' }]);
    expect(s.phase).toBe('r2');
    expect(run(s, [ex(2, 'OB-DG1')])).toBe(s);
    s = run(s, [ex(2, 'OB-NY5'), ex(2, 'OB-NY1'), { type: 'pickPlace', round: 2, placeId: 'hw' }, { type: 'advance' }]);
    expect(s.phase).toBe('r3');
    s = run(s, [ex(3, 'OB-DG4'), ex(3, 'OB-DG5')]);
    expect(s.examined).toEqual({ 1: ['OB-DG4', 'OB-DG5'], 2: ['OB-NY5', 'OB-NY1'], 3: ['OB-DG4', 'OB-DG5'] });
    const r3 = observationsIn(c, s.examined, 3);
    expect(r3.map((o) => o.lines.map((l) => l.fromRound))).toEqual([
      [1, 3],
      [1, 3],
    ]);
    expect(myObservations(c, s.examined, 3)).toHaveLength(6);
  });

  it('조사 전(로비·브리핑·패·자기소개)엔 살펴볼 수 없다 · 늦참(조사 2 에서 조사 1 미선택)은 조사 1 도 살펴볼 수 있다', () => {
    let s = newPlayerGame(c, CODE, 2, T0)!;
    for (let i = 0; i < 4; i++) {
      expect(run(s, [ex(1, 'OB-DG1')]), s.phase).toBe(s);
      s = run(s, adv(1));
    }
    s = run(s, adv(1)); // 조사 1 을 고르지 않고 조사 2 로
    expect(s.phase).toBe('r2');
    s = run(s, [ex(1, 'OB-DG2'), ex(2, 'OB-NY3')]);
    expect(s.examined).toEqual({ 1: ['OB-DG2'], 2: ['OB-NY3'] });
  });

  it('방장도 자리 1 플레이어 — 현장 보기 단계(조사 1 첫 하위 단계)부터 살펴본다', () => {
    let h = run(newHostGame(c, CODE, T0)!, adv(4));
    expect([h.phase, h.host?.roundSub]).toEqual(['r1', 'scene']);
    h = run(h, [ex(1, 'OB-DG2'), ex(1, 'OB-DG2'), ex(1, 'OB-DG3')]);
    expect(h.examined).toEqual({ 1: ['OB-DG2', 'OB-DG3'] });
  });

  it('역할 무관 — 같은 판 자리 2~6(역할 다섯 가지) 모두 같은 액션에 같은 기록', () => {
    const logs = [2, 3, 4, 5, 6].map((seat) => JSON.stringify(run(playerR1(seat), [ex(1, 'OB-DG5'), ex(1, 'OB-DG1'), ex(1, 'OB-DG2')]).examined));
    expect(new Set(logs).size).toBe(1);
  });

  it('자리를 바꾸면 그 자리의 기록이 아니므로 지운다', () => {
    const s = run(playerR1(3), [ex(1, 'OB-DG1'), { type: 'changeSeat', seat: 4 }]);
    expect(s.seat).toBe(4);
    expect(s.examined).toBeUndefined();
  });
});

describe('살펴보기 — 저장(새로고침 유지)·누출 없음', () => {
  it('저장 → 읽기로 기록이 그대로(새로고침) — 다시 읽어도 횟수는 줄지 않는다', () => {
    const s = run(playerR1(), [ex(1, 'OB-DG1'), ex(1, 'OB-DG4')]);
    const st = memoryStorage();
    expect(saveGame(st, s)).toBe(true);
    const back = loadGame(st, T0 + 60_000, { caseId: c.id, caseVersion: c.version });
    expect(back.status).toBe('ok');
    expect(back.state?.examined).toEqual({ 1: ['OB-DG1', 'OB-DG4'] });
    expect(examineLeft(c, back.state!.examined, 1)).toBe(0);
  });

  it('깨진 기록은 그 줄만 버리고 판은 살린다 — 조사 키·id 형식·중복·상한', () => {
    const s = run(playerR1(), [ex(1, 'OB-DG1')]);
    const raw = JSON.parse(serializeGame(s)!);
    raw.examined = { 1: ['OB-DG1', 'OB-DG1', '<img>', 7, 'OB-DG2', 'OB-DG3', 'OB-DG4'], 4: ['OB-DG1'], 2: 'x', 3: [] };
    expect(sanitizeGame(raw)?.examined).toEqual({ 1: ['OB-DG1', 'OB-DG2', 'OB-DG3'] });
    raw.examined = 'oops';
    const clean = sanitizeGame(raw);
    expect(clean).not.toBeNull();
    expect(clean!.examined).toBeUndefined();
    delete raw.examined; // 6판 저장(필드 없음)도 그대로 읽힌다
    expect(sanitizeGame(raw)?.examined).toBeUndefined();
  });

  it('기록엔 물건 id 만 — 관찰 본문은 저장하지 않는다(언제나 사건 데이터에서)', () => {
    const s = run(playerR1(), [ex(1, 'OB-DG5'), ex(1, 'OB-DG1')]);
    const json = serializeGame(s)!;
    for (const o of observationsIn(c, s.examined, 1)) for (const l of o.lines) expect(json.includes(l.text.slice(0, 8))).toBe(false);
    expect(JSON.parse(json).examined).toEqual({ 1: ['OB-DG5', 'OB-DG1'] });
    expect(STORAGE_KEYS.game).toBe('gu:game:v1');
  });

  it('초대·큰 화면 공유 문구엔 살펴본 기록이 없다(입력에 자리가 없다)', () => {
    const room = parseRoomCode(CODE)!;
    const json = JSON.stringify([invitePayload({ code: CODE, n: room.n, tag: room.tag, caseVersion: c.version }), scenePayload({ code: CODE })]);
    expect(json).not.toMatch(/OB-[A-Z]{2}\d/);
    for (const sc of c.scenes ?? []) for (const o of sc.objects) for (const l of o.lines) expect(json.includes(l.text.slice(0, 8))).toBe(false);
  });
});
