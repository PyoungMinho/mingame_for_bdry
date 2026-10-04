/**
 * 6판 압축 흐름(docs/design/gung-compact-scene-spec.md §2) — 타이머 기본값 · 조사 라운드 하위 단계(현장 → 고르기 → 토론) ·
 * 조용한 현장 타이머 · 진행표(≤ 40분) · 저장 호환 · 안내 문구의 분 숫자가 타이머와 같은지.
 */
import { describe, expect, it } from 'vitest';
import { sejaCase } from './case-data';
import {
  FLOW_FIXED_MINUTES,
  PHASES,
  ROUND_SUBS,
  TIMER_KINDS,
  applyAction,
  flowPlan,
  gateRoundsShown,
  isQuietTimer,
  newHostGame,
  newPlayerGame,
  reachedRound,
  timerKindFor,
  timerMinutes,
  timerMs,
  type GameAction,
  type GameState,
} from './game';
import { publicBoardUpTo } from './deck';
import { GUIDE } from './guide-data';
import { examineObjects, sceneStop } from './scene';
import { genericPayload } from './share';
import { STORAGE_KEYS, loadGame, memoryStorage, saveGame } from './storage';
import { DEFAULT_TIMERS, PLAYER_COUNTS } from './types';

const c = sejaCase;
const T0 = 1_700_000_000_000;
const expected = { caseId: c.id, caseVersion: c.version };

function run(s: GameState, actions: GameAction[], start = T0, step = 1000): GameState {
  let now = start;
  for (const a of actions) {
    s = applyAction(s, a, { c, now });
    now += step;
  }
  return s;
}
const adv = (k: number): GameAction[] => Array.from({ length: k }, () => ({ type: 'advance' }) as GameAction);

describe('6판 타이머 기본값(UX 스펙 §2-3)', () => {
  it('현장 1:00 · 고르기 1:00 · 토론 5:00 · 변론 0:45 · 패 확인 2:00 · 동률 0:30', () => {
    expect(DEFAULT_TIMERS).toEqual({ sceneMs: 60_000, selectMs: 60_000, discussMs: 300_000, defenseMs: 45_000, cardsMs: 120_000, tieMs: 30_000 });
    expect(TIMER_KINDS.map((k) => timerMs(c, k))).toEqual([60_000, 60_000, 300_000, 45_000, 120_000, 30_000]);
    expect(timerMinutes(c, 'discuss')).toBe(5);
  });

  it('조사 라운드 타이머 종류는 하위 단계로 정해진다 · 조용한 타이머는 현장뿐', () => {
    expect(ROUND_SUBS).toEqual(['scene', 'select', 'discuss']);
    expect(timerKindFor('r2', 'scene')).toBe('scene');
    expect(timerKindFor('r2', 'select')).toBe('select');
    expect(timerKindFor('r2', 'discuss')).toBe('discuss');
    expect(timerKindFor('r2', null)).toBe('select');
    expect(TIMER_KINDS.filter(isQuietTimer)).toEqual(['scene']);
  });
});

describe('조사 라운드 = 현장 보기 → 장소 고르기 → 토론(방장 전진 3번)', () => {
  it('세 라운드 모두 같은 모양, 라운드당 7분(현장 1 + 고르기 1 + 토론 5) · 각 하위 단계 타이머가 저절로 돈다', () => {
    let s = run(newHostGame(c, '7F3K6', T0)!, adv(4)); // 대기 → 개요 → 패 → 소개 → 조사 1
    const seen: string[] = [];
    let ms = 0;
    for (let i = 0; i < 9; i++) {
      seen.push(`${s.phase}:${s.host!.roundSub}:${s.host!.timer?.kind}:${s.host!.timer?.running}`);
      ms += s.host!.timer?.totalMs ?? 0;
      s = run(s, adv(1), T0 + (i + 1) * 60_000);
    }
    expect(seen).toEqual([
      'r1:scene:scene:true',
      'r1:select:select:true',
      'r1:discuss:discuss:true',
      'r2:scene:scene:true',
      'r2:select:select:true',
      'r2:discuss:discuss:true',
      'r3:scene:scene:true',
      'r3:select:select:true',
      'r3:discuss:discuss:true',
    ]);
    expect(ms).toBe(3 * 7 * 60_000);
    expect(s.phase).toBe('defense');
  });

  it('현장 보기에 들어선 순간 그 라운드는 「들어선 라운드」다 — 공용 단서·출입 기록·이동 장소(7판)가 그 라운드 기준으로 열린다', () => {
    const s = run(newHostGame(c, '7F3K6', T0)!, adv(7)); // 조사 1 현장·고르기·토론 → 조사 2 현장
    expect([s.phase, s.host!.roundSub]).toEqual(['r2', 'scene']);
    const reached = reachedRound(s.phase);
    expect(reached).toBe(2);
    expect(gateRoundsShown(s)).toEqual([1, 2]);
    expect(publicBoardUpTo(c, 6, reached).map((x) => x.id)).toContain('PB-2');
    expect(sceneStop(c, reached)?.placeName).toBe('내의원'); // 7판: 조사 2 = 모두 내의원으로
    expect(examineObjects(c, reached)).toHaveLength(5);
  });

  it('플레이어 게이트는 그대로 단계 하나씩(하위 단계 없음)', () => {
    let p = newPlayerGame(c, '7F3K6', 3, T0)!;
    p = run(p, adv(5));
    expect(p.phase).toBe('r2');
    expect(p.host).toBeUndefined();
    expect(PHASES).toHaveLength(11); // 단계 목록은 바뀌지 않았다
  });
});

describe('진행표 — 「게임 진행이 어떻게 되는지」(UX 스펙 §2-4)', () => {
  it('조사 21분(7×3) · 4~6인 모두 30~40분', () => {
    for (const n of PLAYER_COUNTS) {
      const { steps, total } = flowPlan(c, n);
      expect(steps.map((x) => x.key)).toEqual(['briefing', 'cards', 'intro', 'rounds', 'defense', 'finale']);
      expect(steps.find((x) => x.key === 'rounds')!.minutes).toBe(21);
      expect(steps.find((x) => x.key === 'cards')!.minutes).toBe(2);
      expect(total, `${n}인`).toBeGreaterThanOrEqual(30);
      expect(total, `${n}인`).toBeLessThanOrEqual(40);
    }
    expect(flowPlan(c, 6).total).toBe(FLOW_FIXED_MINUTES.briefing + 2 + FLOW_FIXED_MINUTES.intro + 21 + 5 + FLOW_FIXED_MINUTES.finale);
  });

  it('안내 문구의 숫자 = 타이머 값 · 홈/공유 「약 N분」 = 진행표 합계(±3분)', () => {
    expect(GUIDE.selectTimerStart).toContain(`고르기 ${timerMinutes(c, 'select')}분`);
    expect(GUIDE.defenseCue).toContain(`${DEFAULT_TIMERS.defenseMs / 1000}초`);
    const m = /약 (\d+)분/.exec(GUIDE.homeMinutes);
    expect(m).not.toBeNull();
    for (const n of PLAYER_COUNTS) expect(Math.abs(Number(m![1]) - flowPlan(c, n).total), `${n}인`).toBeLessThanOrEqual(3);
    expect(genericPayload().kakao.content.description).toContain(GUIDE.homeMinutes);
    expect(GUIDE.selectCue).not.toMatch(/\d분/); // 고르기 타이머는 저절로 돈다 — 「시작하시오」 안내가 남아 있으면 안 된다
  });
});

describe('저장 호환 — roundSub·타이머에 scene 이 늘었다(v 그대로, 깨진 저장 폐기 규칙 그대로)', () => {
  it('현장 보기 중인 방장 상태(되돌리기 스택 포함)가 그대로 왕복한다', () => {
    const st = memoryStorage();
    const s = run(newHostGame(c, '7F3K6', T0)!, adv(5)); // r1 고르기 — 스택엔 현장 스냅샷
    expect(s.host!.history.at(-1)!.host.roundSub).toBe('scene');
    const atScene = run(s, [{ type: 'undo' }]);
    for (const x of [s, atScene]) {
      expect(saveGame(st, x)).toBe(true);
      expect(loadGame(st, x.updatedAt + 1, expected)).toEqual({ status: 'ok', state: x, versionMismatch: false });
    }
  });

  it('6판 이전 저장(고르기·토론만, 옛 타이머 길이)도 그대로 읽힌다 — 마이그레이션 없음 · 사건 버전이 다르면 배너 플래그', () => {
    const st = memoryStorage();
    const fresh = run(newHostGame(c, '7F3K6', T0)!, adv(5));
    const old = {
      ...fresh,
      caseVersion: 1,
      host: { ...fresh.host!, roundSub: 'select', timer: { kind: 'select', totalMs: 120_000, running: true, endsAt: T0 + 120_000, remainingMs: 120_000 }, history: [] },
    };
    st.setItem(STORAGE_KEYS.game, JSON.stringify(old));
    const r = loadGame(st, T0 + 1000, expected);
    expect(r.status).toBe('ok');
    expect(r.versionMismatch).toBe(true);
    expect(r.state!.host!.timer).toMatchObject({ kind: 'select', totalMs: 120_000 });
  });

  it('목록 밖 roundSub·타이머 종류는 여전히 깨진 저장 → 폐기', () => {
    const fresh = run(newHostGame(c, '7F3K6', T0)!, adv(4));
    for (const host of [
      { ...fresh.host!, roundSub: 'map' },
      { ...fresh.host!, timer: { ...fresh.host!.timer!, kind: 'quiet' } },
    ]) {
      const st = memoryStorage();
      st.setItem(STORAGE_KEYS.game, JSON.stringify({ ...fresh, host }));
      expect(loadGame(st, T0 + 1000, expected).status).toBe('invalid');
      expect(st.getItem(STORAGE_KEYS.game)).toBeNull();
    }
  });
});
