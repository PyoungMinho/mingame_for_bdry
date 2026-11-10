/**
 * PracticeSession → RoomController 어댑터 (React 없음, 테스트 가능).
 * 메서드 참조는 한 번만 만들어 고정하고(규칙 1), state·practice만 getter로 돌려준다.
 */

import type { CellAddr, HintTarget, ShipPlacement } from '../coords';
import type { JoinBody, TauntId, ViewState } from '../protocol';
import type { ActionOutcome, RoomController, RoomControllerState } from './controller';
import { PracticeSession } from './practiceSession';

export interface PracticeController extends RoomController {
  readonly kind: 'practice';
  /** 박대리가 응수한 도발(seq가 바뀔 때마다 메모로 보인다). 문장 = copy.practice.taunts[index] */
  readonly partnerTaunt: { readonly seq: number; readonly index: number } | null;
}

export interface PracticeControllerHandle {
  readonly session: PracticeSession;
  /** 현재 컨트롤러(state가 최신). 세션이 바뀔 때마다 새 객체 */
  readonly get: () => PracticeController;
  readonly subscribe: (l: () => void) => () => void;
}

export function createPracticeController(session: PracticeSession): PracticeControllerHandle {
  const wrap = (fn: () => ActionOutcome): Promise<ActionOutcome> => Promise.resolve(fn());
  const methods = {
    now: () => session.now(),
    join: (_b: JoinBody) => wrap(() => session.noop()),
    place: (_s: readonly ShipPlacement[], _c: boolean) => wrap(() => session.noop()),
    fire: (cell: CellAddr) => wrap(() => session.fire(cell)),
    answer: (quizId: string, value: number) => wrap(() => session.answer(quizId, value)),
    hint: (t: HintTarget) => wrap(() => session.hint(t)),
    taunt: (id: TauntId) => wrap(() => session.taunt(id)),
    rematch: () => wrap(() => session.noop()),
    resign: () => wrap(() => session.noop()),
    claimAbsent: () => wrap(() => session.noop()),
    leave: () => wrap(() => session.noop()),
    reportView: (v: ViewState) => session.reportView(v),
    reportAlarm: (issuedAt: number, ms: number) => session.reportAlarm(issuedAt, ms),
    refresh: () => session.tick(),
  };

  let cachedVersion = -1;
  let cached: PracticeController | null = null;
  const get = (): PracticeController => {
    const view = session.getView();
    const practice = session.getPractice();
    const taunt = session.getPartnerTaunt();
    if (cached && cachedVersion === view.room.version && cached.practice?.coachLine === practice.coachLine && cached.practice?.cut === practice.cut) {
      return cached;
    }
    const state: RoomControllerState = {
      entry: { kind: 'seated', seat: 0 },
      view,
      connection: 'local',
      transport: 'local',
      pending: false,
      lastError: null,
    };
    cachedVersion = view.room.version;
    cached = { kind: 'practice', code: null, state, practice, partnerTaunt: taunt, ...methods };
    return cached;
  };
  return { session, get, subscribe: session.subscribe };
}
