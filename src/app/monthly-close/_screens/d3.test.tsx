// @vitest-environment jsdom
/**
 * D3 통합 회귀: 숨기기 시트 안 Tab = 다음 칸, 모바일 배치(창 1개·탭·메모 줄·확정 줄), 배치 끌어 옮기기,
 * 명령 이동 모드 대상, 닫힌 메모 재표시.
 */
import { useSyncExternalStore } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { PracticeApp } from './PracticeApp';
import { GameScreen } from './GameScreen';
import { ViewStore } from '@/lib/monthly-close/client/viewStore';
import { createStaticController } from '@/lib/monthly-close/client/staticController';
import { mockPlayingView } from '@/lib/monthly-close/client/mockViews';
import { commandItems } from '@/lib/monthly-close/client/useCommandMode';
import { HIDDEN_TAB_GRACE_MS } from '@/lib/monthly-close/client/useHideKeys';
import { keyboardOffsetOf } from '@/lib/monthly-close/client/useViewport';
import { markFreshRoom } from '@/lib/monthly-close/client/identity';
import type { PlacingView } from '@/lib/monthly-close/protocol';
import type { RoomController } from '@/lib/monthly-close/client/controller';

const nameBox = () => screen.getByLabelText('이름 상자') as HTMLInputElement;
const tabKey = (target: EventTarget = window, shiftKey = false, repeat = false) =>
  act(() => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', shiftKey, repeat, bubbles: true, cancelable: true }));
  });
/** 숨긴 직후 Tab 유예(HIDDEN_TAB_GRACE_MS)를 넘긴다 */
let nowSpy: { mockRestore: () => void } | null = null;
const passGrace = () => {
  const t = Date.now() + HIDDEN_TAB_GRACE_MS + 1;
  nowSpy?.mockRestore();
  nowSpy = vi.spyOn(Date, 'now').mockReturnValue(t);
};

function setMobile(on: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((q: string) => ({ matches: on && q.includes('max-width: 1023px'), media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  );
  window.matchMedia = globalThis.matchMedia as typeof window.matchMedia;
}

afterEach(() => {
  vi.unstubAllGlobals();
  nowSpy?.mockRestore();
  nowSpy = null;
});

describe('숨기기 시트 안 Tab = 다음 칸 (진행자 확인 버그: 숨긴 뒤 Tab이 D4에 멈춤)', () => {
  it('Tab으로 숨기면 포커스가 숨기기 시트 격자로 가고, 다음 Tab은 오른쪽 칸으로 이동한다', () => {
    setMobile(false);
    const { container } = render(<PracticeApp mock="playing" industry={0} />);
    const shell = container.querySelector('.mc-shell') as HTMLElement;
    tabKey();
    expect(shell.dataset.view).toBe('disguise');
    const grid = container.querySelector('[data-layer="disguise"] [role="grid"]') as HTMLElement;
    expect(document.activeElement).toBe(grid);
    const before = nameBox().value;
    expect(before).toMatch(/^[A-J]\d+$/);
    // 숨긴 직후의 연타는 칸을 옮기지 않는다(PM 피드백: "탭기능때문에 칸이 우르르 움직이네")
    tabKey(document.activeElement!);
    tabKey(document.activeElement!);
    tabKey(document.activeElement!, true);
    expect(nameBox().value).toBe(before);
    passGrace();
    // 꾹 눌러 생기는 자동 반복도 옮기지 않는다
    tabKey(document.activeElement!, false, true);
    expect(nameBox().value).toBe(before);
    tabKey(document.activeElement!);
    const after = nameBox().value;
    expect(after).not.toBe(before);
    expect(after.slice(1)).toBe(before.slice(1)); // 같은 행
    expect(after.charCodeAt(0)).toBe(before.charCodeAt(0) + 1); // 오른쪽 칸
    tabKey(document.activeElement!, true);
    expect(nameBox().value).toBe(before);
    expect(shell.dataset.view).toBe('disguise'); // 한 방향
  });

  it('포커스가 격자 밖(이름 상자)에 있어도 Tab은 다음 칸이고 포커스는 격자로 돌아간다', () => {
    setMobile(false);
    const { container } = render(<PracticeApp mock="playing" industry={1} />);
    tabKey();
    const before = nameBox().value;
    act(() => nameBox().focus());
    tabKey(nameBox()); // 유예 안: 삼킴
    expect(nameBox().value).toBe(before);
    passGrace();
    tabKey(nameBox());
    expect(nameBox().value.charCodeAt(0)).toBe(before.charCodeAt(0) + 1);
    expect(document.activeElement).toBe(container.querySelector('[data-layer="disguise"] [role="grid"]'));
    expect((container.querySelector('.mc-shell') as HTMLElement).dataset.view).toBe('disguise');
  });

  it('숨기기는 performance.measure("mc-hide")를 남긴다(전환 시간 측정 경로)', () => {
    setMobile(false);
    performance.clearMeasures?.('mc-hide');
    render(<PracticeApp mock="playing" industry={0} />);
    tabKey();
    expect(performance.getEntriesByName('mc-hide').length).toBeGreaterThan(0);
  });
});

describe('모바일(1024px 미만)', () => {
  it('창 1개 + [내 시트][상대 시트] 탭 + 메모 줄 + 확정 줄, 내 차례면 상대 시트로 자동 전환', () => {
    setMobile(true);
    const { container } = render(<PracticeApp mock="playing" industry={0} />);
    const shell = container.querySelector('.mc-shell') as HTMLElement;
    expect(shell.dataset.mobile).toBe('true');
    expect(container.querySelector('.mc-menubar')).toBeNull(); // 메뉴줄·도구줄 생략
    expect(container.querySelector('.mc-toolbar')).toBeNull();
    expect(container.querySelectorAll('[data-layer="game"] .mc-pane')).toHaveLength(1);
    const tabs = screen.getAllByRole('tab').map((t) => t.textContent);
    expect(tabs.slice(0, 2)).toEqual(['내 시트', '상대 시트']);
    expect(container.querySelector('.mc-memoline')).not.toBeNull();
    // mock 판은 내 차례 → 상대 시트
    expect(container.querySelector('[data-layer="game"] .mc-pane')!.getAttribute('data-pane')).toBe('theirs');
    expect(screen.getAllByRole('tab')[1]!.getAttribute('aria-selected')).toBe('true');
    // 이름 상자는 표시 전용(키보드 안 올라옴), ✕ ✓ 없음
    expect(container.querySelector('input.mc-namebox')).toBeNull();
    expect(container.querySelector('[data-mc-cmd="cancel"]')).toBeNull();
  });

  it('선택 → 확정 2단계: 칸 탭은 선택, [B? 반영]으로 발사', async () => {
    setMobile(true);
    const view = mockPlayingView(0);
    const base = createStaticController(view);
    const fire = vi.fn(base.fire);
    const c: RoomController = { ...base, fire };
    const store = new ViewStore('game');
    const { container } = render(<GameScreen controller={c} store={store} mode="practice" roomCode={null} initialIndustry={0} onHome={() => undefined} />);
    const confirm = () => container.querySelector('.mc-confirmrow .mc-btn') as HTMLButtonElement;
    expect(confirm().getAttribute('aria-disabled')).toBe('true');
    const cell = container.querySelector('[data-layer="game"] [data-addr="H8"]') as HTMLElement;
    fireEvent.mouseDown(cell, { detail: 1 });
    expect(fire).not.toHaveBeenCalled();
    expect(confirm().textContent).toBe('H8 반영');
    expect(confirm().getAttribute('aria-disabled')).toBeNull();
    await act(async () => {
      fireEvent.click(confirm());
    });
    expect(fire).toHaveBeenCalledWith('H8');
  });

  it('숨기기 탭 한 번 = 입력칸 blur + 숨기기, 확정 줄은 숨기기 시트에 없다', () => {
    setMobile(true);
    const { container } = render(<PracticeApp mock="playing" industry={2} />);
    const input = document.createElement('input');
    container.querySelector('[data-layer="game"]')!.appendChild(input);
    act(() => input.focus());
    const dsTab = screen.getAllByRole('tab').find((t) => t.getAttribute('data-kind') === 'disguise')!;
    fireEvent.click(dsTab);
    expect((container.querySelector('.mc-shell') as HTMLElement).dataset.view).toBe('disguise');
    expect(document.activeElement).not.toBe(input);
    expect(container.querySelector('.mc-confirmrow')).toBeNull();
    // 숨기기 시트 모바일 = 4열만(편집 없음)
    expect(container.querySelector('[data-layer="disguise"] .mc-pane')!.getAttribute('data-kind')).toBeTruthy();
    // 복귀는 게임 탭만
    fireEvent.click(screen.getAllByRole('tab')[0]!);
    expect((container.querySelector('.mc-shell') as HTMLElement).dataset.view).toBe('game');
  });

  it('[⋯] 메뉴: 의견 남기기·검토 의견·인수인계서·연습 종료', () => {
    setMobile(true);
    render(<PracticeApp mock="playing" industry={0} />);
    fireEvent.click(screen.getByRole('button', { name: '더 보기' }));
    const items = screen.getAllByRole('menuitem').map((m) => m.textContent);
    expect(items[0]).toBe('의견 남기기');
    expect(items[1]).toMatch(/^검토 의견\(Σ \d\)$/);
    expect(items).toContain('인수인계서');
  });

  it('키보드 높이 계산: 80px 이하는 키보드가 아니다', () => {
    expect(keyboardOffsetOf(800, null)).toBeNull();
    expect(keyboardOffsetOf(800, { height: 760, offsetTop: 0 })).toBeNull();
    expect(keyboardOffsetOf(800, { height: 480, offsetTop: 0 })).toBe(320);
    expect(keyboardOffsetOf(800, { height: 480, offsetTop: 40 })).toBe(280);
  });
});

describe('배치 끌어 옮기기(PC)', () => {
  function placingController(place: RoomController['place']) {
    const p = mockPlayingView(0);
    const view = { ...p, status: 'placing', placeDeadlineAt: Date.now() + 90_000, me: { ...p.me, placed: false } } as unknown as PlacingView;
    const base = createStaticController(view);
    return { ...base, place } as RoomController;
  }

  it('놓인 항목을 끌어 빈자리에 놓으면 그 위치로 저장한다', async () => {
    setMobile(false);
    const place = vi.fn(async () => ({ ok: false as const, error: 'NETWORK' as const }));
    const { container } = render(
      <GameScreen controller={placingController(place)} store={new ViewStore('game')} mode="practice" roomCode={null} initialIndustry={0} onHome={() => undefined} />,
    );
    const left = container.querySelector('[data-pane="mine"]') as HTMLElement;
    // mock 내 항목 L4 = B2~E2(가로). B2를 잡고 B8로
    fireEvent.mouseDown(left.querySelector('[data-addr="B2"]')!, { detail: 1 });
    fireEvent.mouseEnter(left.querySelector('[data-addr="B8"]')!);
    // 미리보기 범위 B8:E8
    expect(left.querySelector('[data-addr="E8"]')!.getAttribute('data-range')).not.toBeNull();
    await act(async () => {
      window.dispatchEvent(new MouseEvent('mouseup'));
    });
    expect(place).toHaveBeenCalled();
    const ships = (place.mock.calls[0] as unknown as [readonly { slot: string; start: string; dir: string }[], boolean])[0];
    expect(ships.find((s) => s.slot === 'L4')).toEqual({ slot: 'L4', start: 'B8', dir: 'h' });
  });

  it('겹치는 자리로 끌면 저장하지 않는다', async () => {
    setMobile(false);
    const place = vi.fn(async () => ({ ok: false as const, error: 'NETWORK' as const }));
    const { container } = render(
      <GameScreen controller={placingController(place)} store={new ViewStore('game')} mode="practice" roomCode={null} initialIndustry={0} onHome={() => undefined} />,
    );
    const left = container.querySelector('[data-pane="mine"]') as HTMLElement;
    fireEvent.mouseDown(left.querySelector('[data-addr="B2"]')!, { detail: 1 });
    fireEvent.mouseEnter(left.querySelector('[data-addr="C4"]')!); // C4~F4는 L3(D4 세로)와 겹침
    await act(async () => {
      window.dispatchEvent(new MouseEvent('mouseup'));
    });
    expect(place).not.toHaveBeenCalled();
  });
});

describe('명령 이동 모드 대상(A6)', () => {
  it('결과 탭 피식 3버튼(laugh:*)은 포함하고, 메뉴 항목·✕✓·숨기기 레이어 버튼은 뺀다', () => {
    document.body.innerHTML = `
      <div id="r">
        <button data-mc-cmd="share"></button>
        <button data-mc-cmd="menu-file"></button>
        <button data-mc-cmd="file:new"></button>
        <button data-mc-cmd="taunt:3"></button>
        <button data-mc-cmd="confirm"></button>
        <button data-mc-cmd="laugh:some"></button>
        <button data-mc-cmd="laugh:none"></button>
        <button data-mc-cmd="save-v8"></button>
        <div data-layer="disguise"><button data-mc-cmd="report"></button></div>
      </div>`;
    const names = commandItems(document.getElementById('r')!).map((e) => e.getAttribute('data-mc-cmd'));
    expect(names).toEqual(['menu-file', 'share', 'save-v8', 'laugh:none', 'laugh:some']);
  });

  it('격자 루트에 data-mc-grid-focus, 비활성 [공유]는 aria-disabled(연습)', () => {
    setMobile(false);
    const { container } = render(<PracticeApp mock="playing" industry={0} />);
    expect(container.querySelector('[data-pane="theirs"] [data-mc-grid-focus]')).not.toBeNull();
    const share = container.querySelector('.mc-topbar [data-mc-cmd="share"]') as HTMLButtonElement;
    expect(share.getAttribute('aria-disabled')).toBe('true');
    expect(share.disabled).toBe(false);
  });
});

describe('닫힌 메모 삼각형 재표시', () => {
  it('메모가 닫힌 뒤 삼각형 칸에 마우스를 올리면 같은 메모가 다시 뜬다', async () => {
    setMobile(false);
    vi.useFakeTimers();
    try {
      const v0 = mockPlayingView(0);
      // 내가 B6을 쏴서 해당 없음이 된 사건 → 상대 시트 B6에 메모
      const v1 = {
        ...v0,
        room: { ...v0.room, version: v0.room.version + 1 },
        game: { ...v0.game, myShots: [...v0.game.myShots, { cell: 'B6' as const, result: 'miss' as const, round: 9 }] },
        events: [...v0.events, { seq: 2, at: Date.now(), round: 9, type: 'fire' as const, by: 0 as const, cell: 'B6' as const, result: 'miss' as const }],
      };
      const store = new ViewStore('game');
      const { container, rerender } = render(
        <GameScreen controller={createStaticController(v0)} store={store} mode="practice" roomCode={null} initialIndustry={0} onHome={() => undefined} />,
      );
      rerender(<GameScreen controller={createStaticController(v1)} store={store} mode="practice" roomCode={null} initialIndustry={0} onHome={() => undefined} />);
      expect(container.querySelector('[data-pane="theirs"] .mc-memo')).not.toBeNull();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(8000);
      });
      expect(container.querySelector('[data-pane="theirs"] .mc-memo')).toBeNull();
      fireEvent.mouseEnter(container.querySelector('[data-pane="theirs"] [data-addr="B6"]')!);
      expect(container.querySelector('[data-pane="theirs"] .mc-memo')).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('방 진입 시 숨김 시작 규칙(A9)과 예외', () => {
  function makeExt(initial: RoomController['state']) {
    let state = initial;
    const ls = new Set<() => void>();
    return {
      get: () => state,
      sub: (l: () => void) => (ls.add(l), () => ls.delete(l)),
      set: (s: RoomController['state']) => {
        state = s;
        ls.forEach((l) => l());
      },
    };
  }
  function Harness({ ext, store }: { ext: ReturnType<typeof makeExt>; store: ViewStore }) {
    const state = useSyncExternalStore(ext.sub, ext.get, ext.get);
    const v = mockPlayingView(0);
    const base = createStaticController(v);
    const controller: RoomController = {
      ...base,
      kind: 'live',
      code: '12345',
      state,
      join: async () => {
        await Promise.resolve();
        ext.set({ ...state, entry: { kind: 'seated', seat: 1 }, view: v });
        return { ok: true, view: v };
      },
    };
    return <GameScreen controller={controller} store={store} mode="room" roomCode="12345" onHome={() => undefined} />;
  }
  const needJoin: RoomController['state'] = { entry: { kind: 'needJoin' }, view: null, connection: 'live', transport: 'poll', pending: false, lastError: null };

  it('입장 대화상자에서 [열기]로 들어온 사람은 숨기기 시트로 떨어지지 않는다(D3 브라우저 확인 버그)', async () => {
    setMobile(false);
    const store = new ViewStore('game');
    const ext = makeExt(needJoin);
    render(<Harness ext={ext} store={store} />);
    const open = screen.getAllByRole('button').find((b) => b.getAttribute('data-mc-cmd') === 'join-open')!;
    // act() 밖에서 브라우저처럼: 외부 저장소 갱신 → 동기 렌더 + effect가 doJoin의 await 뒤 코드보다 먼저 돈다
    const g = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
    const prev = g.IS_REACT_ACT_ENVIRONMENT;
    g.IS_REACT_ACT_ENVIRONMENT = false;
    try {
      open.click();
      await new Promise((r) => setTimeout(r, 20));
    } finally {
      g.IS_REACT_ACT_ENVIRONMENT = prev;
    }
    expect(ext.get().entry.kind).toBe('seated');
    expect(store.view).toBe('game');
  });

  it('자리가 있는 방을 다시 열면 숨김으로 시작, 홈에서 방금 만든 방의 첫 진입만 예외', () => {
    setMobile(false);
    const seated: RoomController['state'] = { ...needJoin, entry: { kind: 'seated', seat: 0 }, view: mockPlayingView(0) };
    const s1 = new ViewStore('game');
    const r1 = render(<Harness ext={makeExt(seated)} store={s1} />);
    expect(s1.view).toBe('disguise');
    r1.unmount();
    markFreshRoom('12345');
    const s2 = new ViewStore('game');
    const r2 = render(<Harness ext={makeExt(seated)} store={s2} />);
    expect(s2.view).toBe('game');
    r2.unmount();
    // 한 번만: 같은 탭에서 새로고침하면 다시 숨김으로 시작
    const s3 = new ViewStore('game');
    render(<Harness ext={makeExt(seated)} store={s3} />);
    expect(s3.view).toBe('disguise');
  });
});
