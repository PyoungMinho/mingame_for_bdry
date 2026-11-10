/**
 * 사건 중복 제거 (컨트롤러 규칙 8). view.events는 최근 EVENTS_KEEP개가 매번 실려 온다.
 * 처리한 마지막 seq를 기억해 그보다 큰 것만 돌려준다.
 *  - 첫 view의 사건은 "이미 본 것"으로 둔다(새로고침 직후 메모·상태줄 재생 방지).
 *  - 빈틈(첫 새 seq > 마지막 + 1)이면 놓친 것은 넘기고 마지막 사건만 돌려준다.
 */

import type { GameEventView } from '../protocol';

export class EventCursor {
  private last: number | null = null;

  /** 새로 처리할 사건(seq 오름차순). 호출할 때마다 커서가 전진한다. */
  take(events: readonly GameEventView[]): GameEventView[] {
    const sorted = [...events].sort((a, b) => a.seq - b.seq);
    if (this.last === null) {
      this.last = sorted.length > 0 ? sorted[sorted.length - 1]!.seq : 0;
      return [];
    }
    const fresh = sorted.filter((e) => e.seq > this.last!);
    if (fresh.length === 0) return [];
    const gap = fresh[0]!.seq > this.last + 1;
    this.last = fresh[fresh.length - 1]!.seq;
    return gap ? [fresh[fresh.length - 1]!] : fresh;
  }

  reset(): void {
    this.last = null;
  }
}
