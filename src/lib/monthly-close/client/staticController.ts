/**
 * mock 컨트롤러: 고정 RoomView를 돌려주는 정지 컨트롤러 (D1~D2 화면 개발용, 연습 `?mock=` 미리보기).
 * 모든 동작은 {ok:true, view}를 돌려주되 아무것도 바꾸지 않는다.
 */

import type { RoomView } from '../protocol';
import type { ActionOutcome, RoomController } from './controller';

export function createStaticController(view: RoomView, opts: { readonly now?: () => number } = {}): RoomController {
  const out = (): Promise<ActionOutcome> => Promise.resolve({ ok: true, view });
  const now = opts.now ?? (() => Date.now());
  return {
    kind: 'practice',
    code: null,
    state: { entry: { kind: 'seated', seat: 0 }, view, connection: 'local', transport: 'local', pending: false, lastError: null },
    practice: null,
    now,
    join: out,
    place: out,
    fire: out,
    answer: out,
    hint: out,
    taunt: out,
    rematch: out,
    resign: out,
    claimAbsent: out,
    leave: out,
    reportView: () => undefined,
    reportAlarm: () => undefined,
    refresh: () => undefined,
  };
}
