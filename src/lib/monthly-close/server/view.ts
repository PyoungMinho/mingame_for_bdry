/**
 * 서버 쪽 투영 래퍼 (소유: API설계자).
 * 실제 허용 목록 투영은 engine/project.ts(순수 TS — 연습 모드와 공용)에 있다. 여기서는 저장소 행(방 id, 접속 정보)을 붙이기만 한다.
 */

import { BELL_TOPIC_PREFIX, type PresenceView, type RoomView, type Seat } from '../protocol';
import { viewFor } from '../engine/project';
import type { RoomState } from '../engine/types';
import type { StoredPlayer } from './store';

export interface ProjectArgs {
  readonly roomId: string;
  readonly state: RoomState;
  readonly version: number;
  readonly seat: Seat;
  readonly now: number;
  /** 상대 자리의 접속 정보(없으면 null) */
  readonly oppPlayer: StoredPlayer | null;
}

export function projectFor(a: ProjectArgs): RoomView {
  return viewFor(a.state, a.seat, {
    version: a.version,
    serverNow: a.now,
    bellTopic: `${BELL_TOPIC_PREFIX}${a.roomId}`,
    oppLastSeenAt: a.oppPlayer?.lastSeen ?? 0,
    oppHidden: a.oppPlayer?.viewState === 'disguise',
  });
}

export function presenceFor(oppPlayer: StoredPlayer | null): PresenceView | null {
  return oppPlayer ? { oppLastSeenAt: oppPlayer.lastSeen, oppHidden: oppPlayer.viewState === 'disguise' } : null;
}
