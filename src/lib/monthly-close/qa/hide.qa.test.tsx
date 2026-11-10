// @vitest-environment jsdom
/**
 * QA(STEP 5) 숨기기 오라클 — docs/qa/monthly-close-test-plan.md §3-7 HIDE-01~07·10·12~17·19~21·23·26·27·32 (jsdom).
 * 제품 코드를 고치지 않는다. 재현된 결함은 it.fails + BUG ID로 남긴다(고쳐지면 it.fails가 실패 → it로 바꿀 것).
 * jsdom은 CSS를 계산하지 않으므로 "보임"은 구조로 판정한다: `.mc-shell[data-view=disguise] .mc-layer--game {display:none}`
 * (monthly-close.css:241)이므로 게임 레이어 안 = 숨김 중 안 보임, 그 밖(크롬·탭 줄·상태줄) = 보임.
 */
import { StrictMode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { GameScreen } from '@/app/monthly-close/_screens/GameScreen';
import { ViewStore } from '@/lib/monthly-close/client/viewStore';
import { createStaticController } from '@/lib/monthly-close/client/staticController';
import { mockEndedView, mockPlayingView } from '@/lib/monthly-close/client/mockViews';
import type { RoomController, RoomControllerState } from '@/lib/monthly-close/client/controller';
import type { EndedView, PlayingView, RoomView } from '@/lib/monthly-close/protocol';
import { hideKeyKind } from '@/lib/monthly-close/client/useHideKeys';
import { parseCell } from '@/lib/monthly-close/coords';

/** 재현된 결함: 기본은 bug(스위트 통과 유지). QA_SHOW_BUGS=1이면 일반 it으로 돌려 실패 메시지를 본다(수정 검증용). */
const bug = process.env.QA_SHOW_BUGS ? it : it.fails;

const OVERLAY_SEL = '.mc-pop, .mc-toast, .mc-memo, .mc-dialog, .mc-coach, [role=alert], [role=menu], [role=dialog]';

function setMobile(on: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((q: string) => ({ matches: on && q.includes('max-width: 1023px'), media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  );
  window.matchMedia = globalThis.matchMedia as typeof window.matchMedia;
}

beforeEach(() => {
  setMobile(false);
  sessionStorage.clear();
  localStorage.clear();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

interface Opts {
  view?: RoomView;
  mode?: 'room' | 'practice';
  roomCode?: string | null;
  state?: Partial<RoomControllerState>;
  coachLine?: number | null;
  strict?: boolean;
}

function setup(o: Opts = {}) {
  const view = o.view ?? mockPlayingView(0, Date.now());
  const base = createStaticController(view);
  const spies = {
    fire: vi.fn(base.fire),
    taunt: vi.fn(base.taunt),
    hint: vi.fn(base.hint),
    leave: vi.fn(base.leave),
    resign: vi.fn(base.resign),
    rematch: vi.fn(base.rematch),
    reportView: vi.fn(),
    reportAlarm: vi.fn(),
  };
  const mk = (v: RoomView, st?: Partial<RoomControllerState>): RoomController => ({
    ...base,
    ...spies,
    kind: o.mode === 'room' ? 'live' : 'practice',
    code: o.roomCode ?? null,
    state: { ...base.state, view: v, ...(st ?? o.state ?? {}) },
  });
  const store = new ViewStore('game');
  const onHome = vi.fn();
  const el = (v: RoomView, st?: Partial<RoomControllerState>) => {
    const node = (
      <GameScreen
        controller={mk(v, st)}
        store={store}
        mode={o.mode ?? 'practice'}
        roomCode={o.roomCode ?? null}
        initialIndustry={0}
        coachLine={o.coachLine}
        onHome={onHome}
      />
    );
    return o.strict ? <StrictMode>{node}</StrictMode> : node;
  };
  const r = render(el(view));
  // 방 모드는 "다시 열기 = 숨김으로 시작"(A9)이므로 게임 탭 복귀로 맞춘다
  if (store.view === 'disguise') act(() => void gameTab().click());
  const shell = () => r.container.querySelector('.mc-shell') as HTMLElement;
  return {
    ...r,
    spies,
    store,
    onHome,
    shell,
    rerenderWith: (v: RoomView, st?: Partial<RoomControllerState>) => r.rerender(el(v, st)),
  };
}

const gameTab = () => screen.getAllByRole('tab').find((t) => t.getAttribute('data-kind') === 'game') as HTMLElement;
const tabOf = (kind: string) => screen.getAllByRole('tab').find((t) => t.getAttribute('data-kind') === kind) as HTMLElement;
const viewOf = (c: HTMLElement) => (c.querySelector('.mc-shell') as HTMLElement).dataset.view;
function key(target: EventTarget, init: KeyboardEventInit) {
  let ev!: KeyboardEvent;
  act(() => {
    ev = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(ev);
  });
  return ev;
}
const TAB: KeyboardEventInit = { key: 'Tab', code: 'Tab' };
const STAB: KeyboardEventInit = { key: 'Tab', code: 'Tab', shiftKey: true };
const ESC: KeyboardEventInit = { key: 'Escape', code: 'Escape' };
const showGame = () => act(() => void gameTab().click());
/** 숨김 상태에서 보이는(게임 레이어 밖·숨기기 레이어 밖) 오버레이 */
function visibleOverlays(root: HTMLElement): Element[] {
  return Array.from(root.querySelectorAll(OVERLAY_SEL)).filter((el) => !el.closest('[data-layer="game"]') && !el.closest('[data-layer="disguise"]'));
}
/** 게임 레이어 안에서 열린 오버레이(복귀하면 보일 것) */
function gameOverlays(root: HTMLElement): Element[] {
  return Array.from(root.querySelectorAll(OVERLAY_SEL)).filter((el) => !!el.closest('[data-layer="game"]'));
}

function quizView(): PlayingView {
  const v = mockPlayingView(0, Date.now());
  return {
    ...v,
    game: {
      ...v.game,
      phase: 'quiz',
      clock: { state: 'paused', reason: 'quiz', remainingMs: 20_000 },
      quiz: { id: 'q4-1', kind: 'sum', values: [12, 34, 56], labelSeed: 1, deadlineAt: Date.now() + 10_000, mine: 'open', status: 'open', settleAt: null },
    },
  };
}
function alarmView(issuedAt = Date.now()): PlayingView {
  const v = mockPlayingView(0, Date.now());
  return { ...v, room: { ...v.room, version: v.room.version + 1 }, game: { ...v.game, alarm: { issuedAt, reported: false } } };
}

// ─────────────────────────────────────────────────────────────────────────────

describe('HIDE-17 숨김 중 크롬 조작 (CR-1·CR-7 재현)', () => {
  it('BUG-01 [CR-1] 숨긴 뒤 도구줄 [의견 남기기]를 누르면 도발 목록이 숨기기 시트 위에 뜨면 안 된다', () => {
    const t = setup();
    key(window, TAB);
    expect(viewOf(t.container)).toBe('disguise');
    act(() => void (t.container.querySelector('[data-mc-cmd="taunt"]') as HTMLElement).click());
    expect(visibleOverlays(t.container)).toHaveLength(0);
  });

  it('BUG-01 [CR-1] 숨긴 상태에서 도발 목록 항목을 누르면 도발이 전송되면 안 된다', async () => {
    const t = setup();
    key(window, TAB);
    act(() => void (t.container.querySelector('[data-mc-cmd="taunt"]') as HTMLElement).click());
    const item = t.container.querySelector('[data-mc-cmd^="taunt:"]:not([disabled])') as HTMLElement | null;
    if (item) await act(async () => item.click());
    expect(t.spies.taunt).not.toHaveBeenCalled();
  });

  it('BUG-01 [CR-1] 숨긴 뒤 [Σ]를 누르면 힌트 모드가 켜지면 안 된다(복귀했을 때 힌트 모드가 남아 있음)', () => {
    const t = setup();
    key(window, TAB);
    act(() => void (t.container.querySelector('[data-mc-cmd="hint"]') as HTMLElement).click());
    showGame();
    expect(t.container.querySelector('[data-mc-cmd="hint"]')!.getAttribute('aria-pressed')).toBeNull();
  });

  it('BUG-02 [CR-7] 숨긴 상태에서 [파일 > 새 문서]를 눌러도 홈(게임 안내 화면)으로 가면 안 된다', () => {
    const t = setup({ mode: 'room', roomCode: '12345' });
    key(window, TAB);
    act(() => void (t.container.querySelector('[data-mc-cmd="menu-file"]') as HTMLElement).click());
    act(() => void (t.container.querySelector('[data-mc-cmd="file:new"]') as HTMLElement).click());
    expect(t.onHome).not.toHaveBeenCalled();
  });

  it('BUG-02 [CR-7] 숨긴 상태에서 [도움말 > 인수인계서]를 누르면 복귀 순간 규칙 팝오버가 튀어나오면 안 된다', () => {
    const t = setup({ mode: 'room', roomCode: '12345' });
    key(window, TAB);
    act(() => void (t.container.querySelector('[data-mc-cmd="menu-help"]') as HTMLElement).click());
    act(() => void (t.container.querySelector('[data-mc-cmd^="help:"]') as HTMLElement).click());
    showGame();
    expect(gameOverlays(t.container)).toHaveLength(0);
  });

  it('BUG-02 [CR-7] 대전 중 숨긴 상태에서 [파일 > 문서 닫기]를 누르면 복귀 순간 기권 확인 팝오버가 튀어나오면 안 된다', () => {
    const t = setup({ mode: 'room', roomCode: '12345' });
    key(window, TAB);
    act(() => void (t.container.querySelector('[data-mc-cmd="menu-file"]') as HTMLElement).click());
    act(() => void (t.container.querySelector('[data-mc-cmd="file:close"]') as HTMLElement).click());
    showGame();
    expect(gameOverlays(t.container)).toHaveLength(0);
  });

  it('BUG-02 [CR-7] 숨긴 상태에서 상단 [공유]를 누르면 복귀 순간 공유 패널이 튀어나오면 안 된다', () => {
    const t = setup({ mode: 'room', roomCode: '12345' });
    key(window, TAB);
    act(() => void (t.container.querySelector('.mc-topbar [data-mc-cmd="share"]') as HTMLElement).click());
    showGame();
    expect(gameOverlays(t.container)).toHaveLength(0);
  });

  it('숨김 중 메뉴 드롭다운 자체는 셸 크롬(파일·도움말 항목)으로만 뜬다 — 게임 문구 0', () => {
    const t = setup({ mode: 'room', roomCode: '12345' });
    key(window, TAB);
    act(() => void (t.container.querySelector('[data-mc-cmd="menu-file"]') as HTMLElement).click());
    const menu = t.container.querySelector('.mc-menubar [role="menu"]') as HTMLElement;
    expect(menu.textContent).toMatch(/새 문서|문서 닫기/);
    expect(menu.textContent).not.toMatch(/좌표|게임|발사|함선|도발/);
  });
});

describe('HIDE-01·02 Tab·Shift+Tab = 즉시 숨김(단계별), 포커스는 숨기기 시트 격자로만', () => {
  const placing = (): RoomView => {
    const p = mockPlayingView(0, Date.now());
    return { ...p, status: 'placing', placeDeadlineAt: Date.now() + 90_000, me: { ...p.me, placed: false } } as unknown as RoomView;
  };
  const waiting = (): RoomView => {
    const p = mockPlayingView(0, Date.now());
    return { status: 'waiting', room: p.room, me: { ...p.me, placed: false, ships: [] }, opp: null, events: [] };
  };
  const cases: [string, () => RoomView][] = [
    ['대기', waiting],
    ['배치', placing],
    ['대전', () => mockPlayingView(0, Date.now())],
    ['결과', () => mockEndedView(0, Date.now())],
  ];
  for (const [name, mk] of cases) {
    for (const [kname, k] of [['Tab', TAB], ['Shift+Tab', STAB]] as const) {
      it(`${name}: ${kname} → 숨김, activeElement는 숨기기 격자`, () => {
        const t = setup({ view: mk() });
        const ev = key(window, k);
        expect(viewOf(t.container)).toBe('disguise');
        expect(ev.defaultPrevented).toBe(true);
        expect(document.activeElement?.closest('[data-layer="disguise"]')).not.toBeNull();
      });
    }
  }
  it('결과 탭을 연 상태에서도 Tab → 숨김', () => {
    const t = setup({ view: mockEndedView(0, Date.now()) });
    act(() => void tabOf('result').click());
    key(window, TAB);
    expect(viewOf(t.container)).toBe('disguise');
  });
});

describe('HIDE-03 ESC 한 번에 숨김(접기 단계 없음), 복귀하면 모두 닫혀 있음(A1)', () => {
  const opens: [string, (c: HTMLElement) => void][] = [
    ['파일 드롭다운', (c) => (c.querySelector('[data-mc-cmd="menu-file"]') as HTMLElement).click()],
    ['규칙 팝오버', (c) => { (c.querySelector('[data-mc-cmd="menu-help"]') as HTMLElement).click(); }],
    ['기권 확인 팝오버', (c) => (c.querySelector('[data-mc-cmd="menu-file"]') as HTMLElement).click()],
    ['공유 패널', (c) => (c.querySelector('.mc-topbar [data-mc-cmd="share"]') as HTMLElement).click()],
    ['힌트 고르기', (c) => (c.querySelector('[data-mc-cmd="hint"]') as HTMLElement).click()],
    ['도발 목록', (c) => (c.querySelector('[data-mc-cmd="taunt"]') as HTMLElement).click()],
  ];
  for (const [name, open] of opens) {
    it(`${name} 열림 → ESC 1회 → 숨김, 복귀 시 열린 것 0`, () => {
      const t = setup({ mode: 'room', roomCode: '12345' });
      act(() => open(t.container));
      if (name === '규칙 팝오버') act(() => void (t.container.querySelector('[data-mc-cmd^="help:"]') as HTMLElement).click());
      if (name === '기권 확인 팝오버') act(() => void (t.container.querySelector('[data-mc-cmd="file:close"]') as HTMLElement).click());
      key(document.activeElement ?? window, ESC);
      expect(viewOf(t.container)).toBe('disguise');
      expect(visibleOverlays(t.container)).toHaveLength(0);
      showGame();
      expect(gameOverlays(t.container)).toHaveLength(0);
      expect(t.container.querySelector('[role="menu"]')).toBeNull();
      expect(t.container.querySelector('[data-mc-cmd="hint"]')!.getAttribute('aria-pressed')).toBeNull();
    });
  }
  it('HIDE-32 명령 이동 모드(/) 중 ESC·Tab → 숨김 + 모드 종료(복귀 후 ←/→가 버튼 이동을 하지 않음)', () => {
    const t = setup({ mode: 'room', roomCode: '12345' });
    key(window, { key: '/', code: 'Slash' });
    const focused = document.activeElement as HTMLElement;
    expect(focused.getAttribute('data-mc-cmd')).toBe('menu-file');
    key(focused, ESC);
    expect(viewOf(t.container)).toBe('disguise');
    showGame();
    const before = document.activeElement;
    key(window, { key: 'ArrowRight', code: 'ArrowRight' });
    expect(document.activeElement).toBe(before);
    // Tab 경로
    key(window, { key: '/', code: 'Slash' });
    key(document.activeElement!, TAB);
    expect(viewOf(t.container)).toBe('disguise');
  });
});

describe('HIDE-04 보조키 동반 Tab/ESC는 숨기지 않음', () => {
  for (const mod of ['ctrlKey', 'altKey', 'metaKey'] as const) {
    for (const [n, k] of [['Tab', TAB], ['ESC', ESC]] as const) {
      it(`${mod} + ${n}`, () => {
        const t = setup();
        key(window, { ...k, [mod]: true });
        expect(viewOf(t.container)).toBe('game');
      });
    }
  }
  it('순수 함수 hideKeyKind', () => {
    expect(hideKeyKind({ code: 'Tab', ctrlKey: false, altKey: false, metaKey: false, shiftKey: false })).toBe('tab');
    expect(hideKeyKind({ code: 'Tab', ctrlKey: true, altKey: false, metaKey: false, shiftKey: false })).toBeNull();
    expect(hideKeyKind({ code: 'Escape', ctrlKey: false, altKey: false, metaKey: true, shiftKey: false })).toBeNull();
  });
});

describe('HIDE-05·06·07 한 방향 · 복귀 경로 · 창 이탈', () => {
  it('HIDE-05 숨김 상태에서 Tab×20, Shift+Tab×20, ESC×20, blur/focus×10 → 계속 숨김. 게임 탭 클릭만 복귀', () => {
    const t = setup();
    key(window, TAB);
    for (let i = 0; i < 20; i++) key(document.activeElement ?? window, TAB);
    for (let i = 0; i < 20; i++) key(document.activeElement ?? window, STAB);
    for (let i = 0; i < 20; i++) key(document.activeElement ?? window, ESC);
    for (let i = 0; i < 10; i++) act(() => { window.dispatchEvent(new Event('blur')); window.dispatchEvent(new Event('focus')); });
    expect(viewOf(t.container)).toBe('disguise');
    expect(t.store.getSnapshot().version).toBe(1);
    showGame();
    expect(viewOf(t.container)).toBe('game');
  });
  it('HIDE-06 숨기기·장식·[+] = 숨김 유지(시트만 바뀜), 결과 탭·게임 탭 = 게임', () => {
    const t = setup({ view: mockEndedView(0, Date.now()) });
    key(window, TAB);
    act(() => void tabOf('deco').click());
    expect(viewOf(t.container)).toBe('disguise');
    act(() => void tabOf('disguise').click());
    expect(viewOf(t.container)).toBe('disguise');
    act(() => void (t.container.querySelector('[data-mc-tab="add"]') as HTMLElement).click());
    expect(viewOf(t.container)).toBe('disguise');
    act(() => void tabOf('result').click());
    expect(viewOf(t.container)).toBe('game');
    key(window, TAB);
    showGame();
    expect(viewOf(t.container)).toBe('game');
  });
  for (const [name, fire] of [
    ['window blur', () => window.dispatchEvent(new Event('blur'))],
    ['visibilitychange hidden', () => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    }],
    ['pagehide', () => window.dispatchEvent(new Event('pagehide'))],
  ] as const) {
    it(`HIDE-07 ${name} → 숨김, 돌아와도 숨김 유지`, () => {
      const t = setup();
      act(() => fire());
      expect(viewOf(t.container)).toBe('disguise');
      act(() => {
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
        document.dispatchEvent(new Event('visibilitychange'));
        window.dispatchEvent(new Event('focus'));
        window.dispatchEvent(new Event('pageshow'));
      });
      expect(viewOf(t.container)).toBe('disguise');
    });
  }
});

describe('HIDE-10 입장 대화상자(needJoin)', () => {
  const needJoin = { entry: { kind: 'needJoin' as const }, view: null };
  it('Tab·Shift+Tab = 입력 이동(숨기지 않음), ESC = 숨김, 게임 탭 → 대화상자 다시', () => {
    const t = setup({ mode: 'room', roomCode: '12345', state: needJoin });
    const nick = t.container.querySelector('.mc-dialog input') as HTMLInputElement;
    expect(nick).not.toBeNull();
    act(() => nick.focus());
    const ev = key(nick, TAB);
    expect(viewOf(t.container)).toBe('game');
    expect(ev.defaultPrevented).toBe(false);
    key(nick, STAB);
    expect(viewOf(t.container)).toBe('game');
    key(nick, ESC);
    expect(viewOf(t.container)).toBe('disguise');
    expect(visibleOverlays(t.container)).toHaveLength(0);
    showGame();
    expect(t.container.querySelector('[data-layer="game"] .mc-dialog')).not.toBeNull();
  });
  it('blur = 숨김', () => {
    const t = setup({ mode: 'room', roomCode: '12345', state: needJoin });
    act(() => void window.dispatchEvent(new Event('blur')));
    expect(viewOf(t.container)).toBe('disguise');
  });
});

describe('HIDE-13·14·15 입력 중 Tab · 한글 조합 · 숨긴 레이어 포커스', () => {
  it('HIDE-13 이름 상자 "B7" 입력 중 Tab → 숨김, 발사 0, 포커스는 게임 레이어 밖. 복귀 후 Enter로만 발사', async () => {
    const t = setup();
    const nb = screen.getByLabelText('이름 상자') as HTMLInputElement;
    act(() => nb.focus());
    fireEvent.change(nb, { target: { value: 'B7' } });
    key(nb, TAB);
    expect(viewOf(t.container)).toBe('disguise');
    expect(t.spies.fire).not.toHaveBeenCalled();
    expect(document.activeElement?.closest('[data-layer="game"]')).toBeNull();
    showGame();
    expect(t.spies.fire).not.toHaveBeenCalled();
    const nb2 = screen.getByLabelText('이름 상자') as HTMLInputElement;
    await act(async () => void fireEvent.keyDown(nb2, { key: 'Enter', code: 'Enter' }));
    // 숨기면서 이름 상자 글자가 남아 있으면 Enter로 발사된다(디자인 의도). 비워졌으면 발사 0 — 어느 쪽이든 Tab은 발사하지 않았다
    expect(t.spies.fire.mock.calls.length).toBeLessThanOrEqual(1);
  });
  it('HIDE-14 조합 중(isComposing·key Process) code Tab/Escape → 숨김', () => {
    for (const code of ['Tab', 'Escape']) {
      const t = setup();
      const nb = screen.getByLabelText('이름 상자') as HTMLInputElement;
      act(() => nb.focus());
      key(nb, { key: 'Process', code, isComposing: true });
      expect(viewOf(t.container)).toBe('disguise');
      t.unmount();
    }
  });
  it('HIDE-14 자모 → A~H 변환: ㅠ7=B7, ㅁ1~ㅗ8', () => {
    expect(parseCell('ㅠ7')).toBe('B7');
    const jamo = ['ㅁ', 'ㅠ', 'ㅊ', 'ㅇ', 'ㄷ', 'ㄹ', 'ㅎ', 'ㅗ'];
    jamo.forEach((j, i) => expect(parseCell(`${j}${i + 1}`)).toBe(`${'ABCDEFGH'[i]}${i + 1}`));
    expect(parseCell('Ｂ７')).toBe('B7');
    expect(parseCell(' b 7 ')).toBe('B7');
    expect(parseCell('$B$7')).toBe('B7');
  });
  it('HIDE-15 게임 칸에 포커스 → 숨김 → Tab 반복해도 activeElement가 게임 레이어로 가지 않음', () => {
    const t = setup();
    const grid = t.container.querySelector('[data-layer="game"] [data-pane="theirs"] [data-mc-grid-focus]') as HTMLElement;
    act(() => grid.focus());
    key(grid, TAB);
    for (let i = 0; i < 10; i++) {
      key(document.activeElement ?? window, i % 2 ? STAB : TAB);
      expect(document.activeElement?.closest('[data-layer="game"]')).toBeNull();
    }
  });
});

describe('HIDE-16 오버레이 누수(V10): 각 오버레이를 연 채 Tab/ESC/blur → 보이는 오버레이 0', () => {
  type Mk = () => { t: ReturnType<typeof setup>; ready: () => boolean };
  const memoCase: Mk = () => {
    const v0 = mockPlayingView(0, Date.now());
    const t = setup({ view: v0 });
    const v1 = { ...v0, room: { ...v0.room, version: v0.room.version + 1 }, game: { ...v0.game, myShots: [...v0.game.myShots, { cell: 'B6' as const, result: 'miss' as const, round: 9 }] }, events: [...v0.events, { seq: 2, at: Date.now(), round: 9, type: 'fire' as const, by: 0 as const, cell: 'B6' as const, result: 'miss' as const }] };
    t.rerenderWith(v1);
    return { t, ready: () => !!t.container.querySelector('.mc-memo') };
  };
  const cases: [string, Mk][] = [
    ['메모', memoCase],
    ['경보 토스트', () => { const t = setup({ view: alarmView() }); return { t, ready: () => !!t.container.querySelector('.mc-toast--alarm') }; }],
    ['문서 생성 토스트(결과)', () => { const t = setup({ view: mockEndedView(0, Date.now()) }); return { t, ready: () => !!t.container.querySelector('.mc-toast') }; }],
    ['재대결 요청 토스트', () => { const e = mockEndedView(0, Date.now()); const t = setup({ view: { ...e, rematch: { requested: [false, true], expiresAt: Date.now() + 60_000 } } as EndedView }); return { t, ready: () => !!t.container.querySelector('.mc-toast [data-mc-cmd="rematch"]') }; }],
    ['저장 토스트(Ctrl+S)', () => { const t = setup(); key(window, { key: 's', code: 'KeyS', ctrlKey: true }); return { t, ready: () => !!t.container.querySelector('.mc-toast') }; }],
    ['파일 드롭다운', () => { const t = setup(); act(() => void (t.container.querySelector('[data-mc-cmd="menu-file"]') as HTMLElement).click()); return { t, ready: () => !!t.container.querySelector('[role="menu"]') }; }],
    ['공유 패널', () => { const t = setup({ mode: 'room', roomCode: '12345' }); act(() => void (t.container.querySelector('.mc-topbar [data-mc-cmd="share"]') as HTMLElement).click()); return { t, ready: () => !!t.container.querySelector('.mc-pop') }; }],
    ['규칙 팝오버', () => { const t = setup(); act(() => void (t.container.querySelector('[data-mc-cmd="menu-help"]') as HTMLElement).click()); act(() => void (t.container.querySelector('[data-mc-cmd^="help:"]') as HTMLElement).click()); return { t, ready: () => !!t.container.querySelector('.mc-pop') }; }],
    ['도발 목록', () => { const t = setup(); act(() => void (t.container.querySelector('[data-mc-cmd="taunt"]') as HTMLElement).click()); return { t, ready: () => !!t.container.querySelector('[role="menu"]') }; }],
    ['입장 대화상자', () => { const t = setup({ mode: 'room', roomCode: '12345', state: { entry: { kind: 'needJoin' }, view: null } }); return { t, ready: () => !!t.container.querySelector('.mc-dialog') }; }],
    ['예외 대화상자 E3', () => { const t = setup({ mode: 'room', roomCode: '12345', state: { entry: { kind: 'notFound' }, view: null } }); return { t, ready: () => !!t.container.querySelector('.mc-dialog') }; }],
    ['연습 코치', () => { const t = setup({ coachLine: 0 }); return { t, ready: () => !!t.container.querySelector('.mc-coach') }; }],
  ];
  for (const [name, mk] of cases) {
    for (const [how, act_] of [
      ['Tab', () => key(window, TAB)],
      ['ESC', () => key(window, ESC)],
      ['blur', () => act(() => void window.dispatchEvent(new Event('blur')))],
    ] as const) {
      if (name === '입장 대화상자' && how === 'Tab') continue; // 대화상자에서 Tab은 입력 이동(HIDE-10)
      it(`${name} + ${how}`, () => {
        const { t, ready } = mk();
        expect(ready()).toBe(true);
        act_();
        expect(viewOf(t.container)).toBe('disguise');
        expect(visibleOverlays(t.container)).toEqual([]);
        t.unmount();
      });
    }
  }
  it('모바일 [⋯] 메뉴 + 숨기기 탭 → 보이는 오버레이 0', () => {
    setMobile(true);
    const t = setup();
    fireEvent.click(screen.getByRole('button', { name: '더 보기' }));
    expect(t.container.querySelector('[role="menu"]')).not.toBeNull();
    act(() => void tabOf('disguise').click());
    expect(viewOf(t.container)).toBe('disguise');
    expect(visibleOverlays(t.container)).toEqual([]);
  });
  it('CSS: 숨김 시 게임 레이어 display:none 규칙이 있다(구조 판정의 전제)', () => {
    const css = readFileSync(join(process.cwd(), 'src/app/monthly-close/monthly-close.css'), 'utf8');
    expect(css).toMatch(/\.mc-shell\[data-view='disguise'\] \.mc-layer--game\s*\{\s*display:\s*none;/);
  });
});

describe('HIDE-19·20·21 검산·경보와 숨기기', () => {
  it('HIDE-19 검산 입력 "12" 상태에서 Tab → 숨김 → 복귀(마감 전) 값 보존', () => {
    const t = setup({ view: quizView() });
    const input = t.container.querySelector('[data-layer="game"] input.mc-cell__input') as HTMLInputElement;
    act(() => input.focus());
    fireEvent.change(input, { target: { value: '12' } });
    key(input, TAB);
    expect(viewOf(t.container)).toBe('disguise');
    showGame();
    expect((t.container.querySelector('[data-layer="game"] input.mc-cell__input') as HTMLInputElement).value).toBe('12');
  });
  it('HIDE-20 숨긴 상태에서 경보가 담긴 view 도착 → reportAlarm(issuedAt, 0)', () => {
    const t = setup();
    key(window, TAB);
    const at = Date.now() - 50;
    t.rerenderWith(alarmView(at));
    expect(t.spies.reportAlarm).toHaveBeenCalledWith(at, 0);
  });
  for (const [how, doHide] of [
    ['토스트 클릭', (c: HTMLElement) => act(() => void (c.querySelector('.mc-toast--alarm') as HTMLElement).click())],
    ['숨기기 탭', () => act(() => void tabOf('disguise').click())],
    ['장식 탭', () => act(() => void tabOf('deco').click())],
    ['Tab', () => key(window, TAB)],
  ] as const) {
    it(`HIDE-21 경보 토스트 표시 → ${how} = 숨기기로 인정, 보고 ms = 표시→전환`, () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(1_800_000_000_000);
      const t = setup();
      const at = Date.now();
      t.rerenderWith(alarmView(at));
      vi.setSystemTime(1_800_000_000_000 + 700);
      doHide(t.container);
      expect(viewOf(t.container)).toBe('disguise');
      expect(t.spies.reportAlarm).toHaveBeenCalledTimes(1);
      expect(t.spies.reportAlarm.mock.calls[0]).toEqual([at, 700]);
    });
  }
});

describe('HIDE-23 탭 제목', () => {
  it('숨기기 전후 동일, 외부 코드가 바꾸면 복원, "(1)"·"내 차례"·"문제팩토리" 0', async () => {
    const t = setup({ mode: 'room', roomCode: '12345' });
    const title = document.title;
    expect(title).toMatch(/v7/);
    key(window, TAB);
    expect(document.title).toBe(title);
    showGame();
    act(() => void (document.title = '(1) 내 차례 | 문제팩토리'));
    await act(async () => await new Promise((r) => setTimeout(r, 0)));
    expect(document.title).toBe(title);
    void t;
  });
  it('BUG-08 [CR-16] <title> 요소가 교체되면(클라 이동 시 head 갱신) 감시가 끊겨 바뀐 제목이 복원되지 않는다', async () => {
    setup({ mode: 'room', roomCode: '12345' });
    const title = document.title;
    const old = document.querySelector('title')!;
    const neo = document.createElement('title');
    act(() => void old.replaceWith(neo));
    await act(async () => await new Promise((r) => setTimeout(r, 0)));
    act(() => void (neo.textContent = '문제팩토리'));
    await act(async () => await new Promise((r) => setTimeout(r, 0)));
    expect(document.title).toBe(title);
  });
});

describe('HIDE-26 Ctrl/Cmd+S', () => {
  it('게임 화면: 기본 동작 막음 + 게임 레이어에 "저장됨" 토스트', () => {
    const t = setup();
    for (const mod of ['ctrlKey', 'metaKey'] as const) {
      const ev = key(window, { key: 's', code: 'KeyS', [mod]: true });
      expect(ev.defaultPrevented).toBe(true);
    }
    expect(t.container.querySelector('[data-layer="game"] .mc-toast')).not.toBeNull();
  });
  it('BUG-04 [CR-2] 숨김 상태에서 Ctrl+S → 지금 보이는 레이어(숨기기 시트)에 "저장됨" 토스트가 떠야 한다', () => {
    const t = setup();
    key(window, TAB);
    const ev = key(window, { key: 's', code: 'KeyS', ctrlKey: true });
    expect(ev.defaultPrevented).toBe(true);
    const toast = Array.from(t.container.querySelectorAll('.mc-toast')).find((x) => !x.closest('[data-layer="game"]'));
    expect(toast).toBeTruthy();
  });
  it('숨김 상태 Ctrl+S: 저장 창은 막힌다(preventDefault)', () => {
    setup();
    key(window, TAB);
    expect(key(window, { key: 's', code: 'KeyS', metaKey: true }).defaultPrevented).toBe(true);
  });
});

describe('HIDE-27 StrictMode', () => {
  it('마운트→해제→마운트 후 Tab 1회 = hide 1회, mc-hide measure 1개, reportView 1회', () => {
    performance.clearMeasures?.('mc-hide');
    const t = setup({ strict: true });
    key(window, TAB);
    expect(t.store.getSnapshot().version).toBe(1);
    expect(performance.getEntriesByName('mc-hide')).toHaveLength(1);
    expect(t.spies.reportView.mock.calls.filter((c) => c[0] === 'disguise')).toHaveLength(1);
    // HIDE-29: 복귀 보고 'game' 1건(전환은 보고를 기다리지 않는다 — 속성은 hide() 안에서 동기로 바뀜)
    showGame();
    expect(t.spies.reportView.mock.calls.map((c) => c[0])).toEqual(['disguise', 'game']);
  });
});

describe('HIDE-18 네이티브 UI 0 (소스 스캔)', () => {
  it('월마감 클라 소스에 title 속성·<dialog>·alert/confirm·<select>·Notification·Audio·vibrate 0', () => {
    const { readdirSync, statSync } = require('node:fs') as typeof import('node:fs');
    const roots = ['src/app/monthly-close', 'src/lib/monthly-close/client', 'src/lib/monthly-close/sheet'];
    const files: string[] = [];
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(tsx?|css)$/.test(f) && !/\.test\.tsx?$/.test(f)) files.push(p);
      }
    };
    roots.forEach((r) => walk(join(process.cwd(), r)));
    const hits: string[] = [];
    const pats: [string, RegExp][] = [
      ['title=', /\stitle=\{|\stitle="/],
      ['<dialog', /<dialog[\s>]/],
      ['alert(', /\b(window\.)?alert\(/],
      ['confirm(', /\bwindow\.confirm\(|(?<![.\w])confirm\(/],
      ['<select', /<select[\s>]/],
      ['Notification', /\bNotification\b/],
      ['Audio', /new Audio\(|AudioContext|speechSynthesis/],
      ['vibrate', /\.vibrate\(/],
    ];
    for (const f of files) {
      // 주석은 뺀다("<dialog> 금지" 같은 설명문)
      const s = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
      for (const [n, re] of pats) if (re.test(s)) hits.push(`${f.replace(process.cwd(), '')}: ${n}`);
    }
    // title= 은 Popover/InlineDialog의 prop 이름(title={...})으로 쓰여 DOM title 속성이 아닐 수 있다 → DOM 스캔으로 확정
    const domTitle = hits.filter((h) => !h.endsWith('title='));
    expect(domTitle, domTitle.join('\n')).toEqual([]);
  });
  it('전 단계 DOM에 [title] 속성·dialog·select 0', () => {
    for (const v of [mockPlayingView(0, Date.now()), mockEndedView(0, Date.now()), quizView(), alarmView()]) {
      const t = setup({ view: v, mode: 'room', roomCode: '12345' });
      act(() => void (t.container.querySelector('.mc-topbar [data-mc-cmd="share"]') as HTMLElement).click());
      act(() => void (t.container.querySelector('[data-mc-cmd="menu-file"]') as HTMLElement).click());
      expect(t.container.querySelectorAll('[title], dialog, select').length).toBe(0);
      key(window, TAB);
      expect(t.container.querySelectorAll('[title], dialog, select').length).toBe(0);
      t.unmount();
    }
  });
});
