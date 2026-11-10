// @vitest-environment jsdom
/**
 * useMcRoom: 수명(마운트 시작·해제 정리), 탭 복귀 즉시 sync, StrictMode 이중 마운트, 자동 leave 없음.
 */
import { StrictMode } from 'react';
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoomController } from './controller';
import { useMcRoom } from './useMcRoom';
import { mockPlayingView } from './mockViews';

const T = 1_760_000_000_000;
let calls: { url: string; body: Record<string, unknown> | null }[] = [];

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T);
  calls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      calls.push({ url, body: typeof init.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : null });
      const body = url.endsWith('/sync') ? { ok: true, serverNow: Date.now(), presence: null, changed: true, view: mockPlayingView(0, T) } : null;
      return { status: body ? 200 : 204, json: async () => body };
    }),
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function flush() {
  for (let i = 0; i < 12; i++) await Promise.resolve();
}

let latest: RoomController | null = null;
function Probe({ code }: { code: string }) {
  latest = useMcRoom(code, () => 'game');
  return <span data-entry={latest.state.entry.kind}>{latest.state.view?.room.version ?? '-'}</span>;
}

const syncs = () => calls.filter((c) => c.url.endsWith('/sync'));

describe('useMcRoom', () => {
  it('마운트하면 sync를 시작하고 화면 데이터를 반영한다', async () => {
    const { container, unmount } = render(<Probe code="48291" />);
    await act(flush);
    expect(container.querySelector('span')!.getAttribute('data-entry')).toBe('seated');
    expect(container.textContent).toBe('12');
    expect(syncs()[0]!.url).toBe('/api/monthly-close/rooms/48291/sync');
    unmount();
  });

  it('탭이 다시 보이면 즉시 sync, 해제 뒤에는 폴링·leave 없음', async () => {
    const { unmount } = render(<Probe code="48291" />);
    await act(flush);
    const n = syncs().length;
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await flush();
    });
    expect(syncs().length).toBe(n + 1);
    unmount();
    const m = calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(calls.length).toBe(m);
    expect(calls.some((c) => c.body?.type === 'leave')).toBe(false);
  });

  it('StrictMode 이중 마운트에서도 폴링이 계속된다', async () => {
    const { unmount } = render(
      <StrictMode>
        <Probe code="48291" />
      </StrictMode>,
    );
    await act(flush);
    const n = syncs().length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_100);
      await flush();
    });
    expect(syncs().length).toBeGreaterThan(n);
    unmount();
  });

  it('컨트롤러 메서드 참조는 렌더 사이에 안정적이다', async () => {
    const { rerender, unmount } = render(<Probe code="48291" />);
    await act(flush);
    const a = latest!;
    rerender(<Probe code="48291" />);
    expect(latest!.fire).toBe(a.fire);
    expect(latest!.reportView).toBe(a.reportView);
    unmount();
  });
});
