// @vitest-environment jsdom
/**
 * QA 재검증(2차) — @QA실행자. 수정 라운드(프론트 16건·백엔드 3건) 뒤 새 동작과 지난번 미실행 자동 케이스.
 *  - R2-HIDE: 숨김 중 크롬의 게임 명령 전부 무시(파일·도움말 메뉴는 열림), 숨김 중 [새 문서] → 첫 가짜 시트 탭
 *  - R2-14: BUG-14 단언 반전이 정상 안내("지금은 편집할 수 없습니다.")까지 없애지 않았는지
 *  - R2-20: 부가세 검산 단위 "원"·쉼표, 다른 검산 단위 유지
 *  - R2-09: 닉네임 금칙어 → "편집자NN", 오탐(시바견·보지마 등) 통과
 *  - 지난번 미실행: DIS-06(61초 스냅샷), HIDE-22(J: blur·공유 시트 예외), UI-14(J: 힌트 UI)
 * 제품 코드 무수정. 새로 재현된 결함은 bug()(= it.fails)로 남긴다.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { GameScreen } from '@/app/monthly-close/_screens/GameScreen';
import { ViewStore } from '@/lib/monthly-close/client/viewStore';
import { createStaticController } from '@/lib/monthly-close/client/staticController';
import { mockPlayingView } from '@/lib/monthly-close/client/mockViews';
import type { ActionOutcome, RoomController, RoomControllerState } from '@/lib/monthly-close/client/controller';
import type { PlayingView, RoomView } from '@/lib/monthly-close/protocol';
import type { IndustryId } from '@/lib/monthly-close/constants';
import { COMMON_PACK } from '@/lib/monthly-close/copy/pick';
import { cleanNickname } from '@/lib/monthly-close/server/pipeline';
import { isBannedNickname, screenNickname, defaultNickname } from '@/lib/monthly-close/server/nickname';

const bug = process.env.QA_SHOW_BUGS ? it : it.fails;
void bug;

const OVERLAY_SEL = '.mc-pop, .mc-toast, .mc-memo, .mc-dialog, .mc-coach, [role=alert], [role=menu], [role=dialog]';

function setMobile(on: boolean) {
  vi.stubGlobal('matchMedia', vi.fn((q: string) => ({ matches: on && q.includes('max-width: 1023px'), media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
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

interface Opts { view?: RoomView; mode?: 'room' | 'practice'; roomCode?: string | null; state?: Partial<RoomControllerState> }
function setup(o: Opts = {}) {
  const view = o.view ?? mockPlayingView(0, Date.now());
  const base = createStaticController(view);
  const spies = {
    fire: vi.fn(base.fire), taunt: vi.fn(base.taunt), hint: vi.fn(base.hint), answer: vi.fn(base.answer),
    leave: vi.fn(base.leave), resign: vi.fn(base.resign), rematch: vi.fn(base.rematch), place: vi.fn(base.place),
  };
  const mk = (v: RoomView, st?: Partial<RoomControllerState>): RoomController => ({
    ...base, ...spies, kind: o.mode === 'room' ? 'live' : 'practice', code: o.roomCode ?? null,
    state: { ...base.state, view: v, ...(st ?? o.state ?? {}) },
  });
  const store = new ViewStore('game');
  const onHome = vi.fn();
  const el = (v: RoomView, st?: Partial<RoomControllerState>) => (
    <GameScreen controller={mk(v, st)} store={store} mode={o.mode ?? 'practice'} roomCode={o.roomCode ?? null} initialIndustry={0} onHome={onHome} />
  );
  const r = render(el(view));
  if (store.view === 'disguise') act(() => void gameTab().click());
  return { ...r, spies, store, onHome, rerenderWith: (v: RoomView, st?: Partial<RoomControllerState>) => r.rerender(el(v, st)) };
}
const tabs = () => screen.getAllByRole('tab');
const gameTab = () => tabs().find((t) => t.getAttribute('data-kind') === 'game') as HTMLElement;
const tabOf = (kind: string) => tabs().find((t) => t.getAttribute('data-kind') === kind) as HTMLElement;
const viewOf = (c: HTMLElement) => (c.querySelector('.mc-shell') as HTMLElement).dataset.view;
const statusLine = (c: HTMLElement) => c.querySelector('.mc-status__msg')?.textContent ?? '';
function hideByTab() {
  act(() => void window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', bubbles: true, cancelable: true })));
}
const showGame = () => act(() => void gameTab().click());
/** 크롬(어느 레이어에도 속하지 않는 셸 영역)의 명령 버튼 */
const chromeCmds = (c: HTMLElement) =>
  Array.from(c.querySelectorAll<HTMLElement>('[data-mc-cmd]')).filter((el) => !el.closest('[data-layer]'));
const gameOverlays = (c: HTMLElement) => Array.from(c.querySelectorAll(OVERLAY_SEL)).filter((el) => !!el.closest('[data-layer="game"]'));
const visibleOverlays = (c: HTMLElement) =>
  Array.from(c.querySelectorAll(OVERLAY_SEL)).filter((el) => !el.closest('[data-layer="game"]') && !el.closest('[data-layer="disguise"]'));

// ─────────────────────────────────────────────────────────────────────────────

describe('R2-HIDE 숨김 중 크롬의 게임 명령은 전부 무시(파일·도움말 메뉴는 열림)', () => {
  for (const mode of ['room', 'practice'] as const) {
    it(`[${mode}] 숨긴 뒤 크롬의 모든 명령 버튼·메뉴 항목을 눌러도 서버 명령 0·홈 이동 0·복귀 때 팝오버 0·눌림 모양 0`, async () => {
      const t = setup({ mode, roomCode: mode === 'room' ? '12345' : null });
      hideByTab();
      expect(viewOf(t.container)).toBe('disguise');
      const clicked: string[] = [];
      // 1) 크롬의 버튼 전부(메뉴 열기 포함)
      for (const el of chromeCmds(t.container)) {
        const name = el.getAttribute('data-mc-cmd') ?? '';
        if (name.includes(':')) continue;
        clicked.push(name);
        await act(async () => void el.click());
        // 메뉴가 열렸으면 그 안의 항목도 전부(항목마다 다시 연다)
        if (name.startsWith('menu-')) {
          const items = Array.from(t.container.querySelectorAll<HTMLElement>('.mc-menubar [role="menuitem"]')).map((x) => x.getAttribute('data-mc-cmd') ?? '');
          for (const it of items) {
            if (!t.container.querySelector(`[data-mc-cmd="${it}"]`)) await act(async () => void (t.container.querySelector(`[data-mc-cmd="${name}"]`) as HTMLElement).click());
            const b = t.container.querySelector<HTMLElement>(`[data-mc-cmd="${it}"]`);
            if (b) { clicked.push(it); await act(async () => void b.click()); }
          }
        }
      }
      expect(clicked).toEqual(expect.arrayContaining(['menu-file', 'menu-help', 'hint', 'taunt']));
      if (mode === 'room') expect(clicked).toEqual(expect.arrayContaining(['share', 'file:new', 'file:close', 'help:rules']));
      else expect(clicked).toEqual(expect.arrayContaining(['file:endPractice']));
      // 숨김 유지, 숨긴 화면 위에 보이는 오버레이 없음(메뉴는 항목을 눌러 닫힘)
      expect(viewOf(t.container)).toBe('disguise');
      expect(visibleOverlays(t.container).map((e) => e.className)).toEqual([]);
      for (const s of Object.values(t.spies)) expect(s).not.toHaveBeenCalled();
      expect(t.onHome).not.toHaveBeenCalled();
      showGame();
      expect(gameOverlays(t.container).map((e) => e.className)).toEqual([]);
      expect(t.container.querySelector('[data-mc-cmd="hint"]')!.getAttribute('aria-pressed')).toBeNull();
      expect(t.container.querySelector('[data-mc-cmd="taunt"]')!.getAttribute('aria-expanded')).toBe('false');
    });
  }

  it('숨김 중 [파일]·[도움말] 메뉴는 진짜 시트처럼 열린다(항목 표시, 숨김 유지)', () => {
    const t = setup({ mode: 'room', roomCode: '12345' });
    hideByTab();
    act(() => void (t.container.querySelector('[data-mc-cmd="menu-file"]') as HTMLElement).click());
    const fileMenu = t.container.querySelector('.mc-menubar [role="menu"]');
    expect(fileMenu, '파일 메뉴').not.toBeNull();
    expect(Array.from(fileMenu!.querySelectorAll('[role="menuitem"]')).map((x) => x.getAttribute('data-mc-cmd'))).toEqual(['file:new', 'file:close']);
    expect(t.container.querySelector('[data-mc-cmd="menu-file"]')!.getAttribute('aria-expanded')).toBe('true');
    act(() => void (t.container.querySelector('[data-mc-cmd="menu-help"]') as HTMLElement).click());
    const helpMenu = t.container.querySelector('.mc-menubar [role="menu"]');
    expect(helpMenu, '도움말 메뉴').not.toBeNull();
    expect(helpMenu!.querySelectorAll('[role="menuitem"]').length).toBeGreaterThan(0);
    expect(viewOf(t.container)).toBe('disguise');
  });

  it('숨김 중 [파일 > 새 문서] → 첫 가짜 시트 탭(장식 탭에 있었어도)으로 전환, 숨김 유지, 홈 이동 0', () => {
    const t = setup({ mode: 'room', roomCode: '12345' });
    act(() => void tabOf('deco').click());
    expect(viewOf(t.container)).toBe('disguise');
    expect(tabOf('deco').getAttribute('aria-selected')).toBe('true');
    act(() => void (t.container.querySelector('[data-mc-cmd="menu-file"]') as HTMLElement).click());
    act(() => void (t.container.querySelector('[data-mc-cmd="file:new"]') as HTMLElement).click());
    const firstFake = tabs().find((x) => x.getAttribute('data-kind') === 'disguise') as HTMLElement;
    expect(firstFake.getAttribute('aria-selected')).toBe('true');
    expect(tabOf('deco').getAttribute('aria-selected')).not.toBe('true');
    expect(viewOf(t.container)).toBe('disguise');
    expect(t.onHome).not.toHaveBeenCalled();
    expect(t.container.querySelector('.mc-menubar [role="menu"]'), '메뉴 닫힘').toBeNull();
  });

  it('숨김 중 키보드로 크롬 버튼에 클릭이 와도(포커스가 [Σ]에 남은 채 Enter = click) 힌트 모드가 켜지지 않는다', () => {
    const t = setup();
    const hint = t.container.querySelector('[data-mc-cmd="hint"]') as HTMLElement;
    hint.focus();
    hideByTab();
    // 브라우저는 포커스된 버튼의 Enter/Space를 click으로 바꾼다 → 같은 경로
    act(() => void hint.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 0 })));
    showGame();
    expect(t.container.querySelector('[data-mc-cmd="hint"]')!.getAttribute('aria-pressed')).toBeNull();
    expect(t.spies.hint).not.toHaveBeenCalled();
  });

  it('모바일: 숨김 중 [⋯] → 메뉴 0, 복귀 때도 0. 숨김 중 확정 줄 없음', () => {
    setMobile(true);
    const t = setup({ mode: 'room', roomCode: '12345' });
    act(() => void (tabs().find((x) => x.getAttribute('data-kind') === 'disguise') as HTMLElement).click());
    expect(viewOf(t.container)).toBe('disguise');
    expect(t.container.querySelector('.mc-confirmrow')).toBeNull();
    const more = t.container.querySelector('[data-mc-cmd="more"]') as HTMLElement | null;
    if (more) act(() => void more.click());
    expect(visibleOverlays(t.container)).toHaveLength(0);
    showGame();
    expect(gameOverlays(t.container).map((e) => e.className)).toEqual([]);
  });
});

describe('R2-14 BUG-14 단언 반전이 정상 안내를 가리지 않는다', () => {
  it('상대 차례에 새 칸을 한 번(detail 1) 누르면 여전히 "지금은 편집할 수 없습니다."', async () => {
    const v = mockPlayingView(0, Date.now());
    const opp: PlayingView = { ...v, game: { ...v.game, turn: 1 } };
    const t = setup({ view: opp });
    const cell = t.container.querySelector('[data-layer="game"] [data-pane="theirs"] [data-addr="D4"]') as HTMLElement;
    await act(async () => void fireEvent.mouseDown(cell, { detail: 1 }));
    expect(statusLine(t.container)).toBe(COMMON_PACK.status.notNow);
    expect(t.spies.fire).not.toHaveBeenCalled();
  });

  it('내가 쏜 직후(상대 차례) 다른 칸을 한 번 누르면 안내가 뜬다(연타 무시는 같은 칸·detail≥2만)', async () => {
    const v0 = mockPlayingView(0, Date.now());
    const after: PlayingView = { ...v0, room: { ...v0.room, version: 13 }, game: { ...v0.game, turn: 1, myShots: [...v0.game.myShots, { cell: 'H7', result: 'miss', round: 6 }] } };
    const base = createStaticController(v0);
    const fire = vi.fn(async (): Promise<ActionOutcome> => ({ ok: true, view: after }));
    const store = new ViewStore('game');
    const r = render(<GameScreen controller={{ ...base, fire }} store={store} mode="practice" roomCode={null} initialIndustry={0} onHome={() => undefined} />);
    const at = (a: string) => r.container.querySelector(`[data-layer="game"] [data-pane="theirs"] [data-addr="${a}"]`) as HTMLElement;
    fireEvent.mouseDown(at('H7'), { detail: 1 });
    await act(async () => void fireEvent.mouseDown(at('H7'), { detail: 2 }));
    r.rerender(<GameScreen controller={{ ...base, state: { ...base.state, view: after }, fire }} store={store} mode="practice" roomCode={null} initialIndustry={0} onHome={() => undefined} />);
    await act(async () => void fireEvent.mouseDown(at('D4'), { detail: 1 }));
    expect(fire).toHaveBeenCalledTimes(1);
    expect(statusLine(r.container)).toBe(COMMON_PACK.status.notNow);
  });

  it('BUG-14 시나리오의 세 번째 클릭 뒤 상태줄은 엉뚱한 실패 문구(충돌·잘못된 단계)도 아니다', async () => {
    const v0 = mockPlayingView(0, Date.now());
    const after: PlayingView = { ...v0, room: { ...v0.room, version: 13 }, game: { ...v0.game, turn: 1, myShots: [...v0.game.myShots, { cell: 'H7', result: 'miss', round: 6 }] } };
    const base = createStaticController(v0);
    const fire = vi.fn(async (): Promise<ActionOutcome> => ({ ok: true, view: after }));
    const store = new ViewStore('game');
    const r = render(<GameScreen controller={{ ...base, fire }} store={store} mode="practice" roomCode={null} initialIndustry={0} onHome={() => undefined} />);
    const cell = () => r.container.querySelector('[data-layer="game"] [data-pane="theirs"] [data-addr="H7"]') as HTMLElement;
    fireEvent.mouseDown(cell(), { detail: 1 });
    await act(async () => void fireEvent.mouseDown(cell(), { detail: 2 }));
    r.rerender(<GameScreen controller={{ ...base, state: { ...base.state, view: after }, fire }} store={store} mode="practice" roomCode={null} initialIndustry={0} onHome={() => undefined} />);
    await act(async () => void fireEvent.mouseDown(cell(), { detail: 3 }));
    const s = statusLine(r.container);
    for (const k of ['notNow', 'conflict', 'wrongPhase', 'notYourTurn', 'alreadyDone'] as const) expect(s).not.toBe(COMMON_PACK.status[k]);
  });
});

describe('R2-20 부가세 검산 단위·쉼표 (BUG-20)', () => {
  function quizView(industry: IndustryId, kind: 'sum' | 'vat' | 'diff', values: number[]): PlayingView {
    const v = mockPlayingView(industry, Date.now());
    return {
      ...v,
      game: {
        ...v.game, phase: 'quiz', clock: { state: 'paused', reason: 'quiz', remainingMs: 20_000 },
        quiz: { id: 'q4-1', kind, values, labelSeed: 1, deadlineAt: Date.now() + 10_000, mine: 'open', status: 'open', settleAt: null },
      },
    };
  }
  const rightText = (c: HTMLElement) => (c.querySelector('[data-layer="game"] [data-pane="theirs"]') as HTMLElement).textContent ?? '';
  for (const ind of [0, 1, 2] as const) {
    it(`업종 ${ind}: 부가세 370000 → "370,000" + "(단위: 원)", "만원" 없음`, () => {
      const t = setup({ view: quizView(ind, 'vat', [370_000]) });
      const txt = rightText(t.container);
      expect(txt).toContain('370,000');
      expect(txt).toContain('(단위: 원)');
      expect(txt).not.toContain('만원');
      expect(txt).not.toContain('370000');
    });
  }
  it('합계(회계)는 "(단위: 만원)" 그대로 — 단위 변경이 부가세에만', () => {
    const t = setup({ view: quizView(0, 'sum', [12, 34, 56]) });
    expect(rightText(t.container)).toContain('(단위: 만원)');
  });
  it('부가세 정답 37000은 "37,000"·"37,000원"으로 쳐도 같은 값으로 제출된다', async () => {
    const t = setup({ view: quizView(0, 'vat', [370_000]) });
    const input = t.container.querySelector('[data-layer="game"] input.mc-cell__input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '37,000원' } });
    await act(async () => void fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' }));
    expect(t.spies.answer).toHaveBeenCalledWith('q4-1', 37_000);
  });
});

describe('R2-09 닉네임 금칙어 (BUG-09)', () => {
  const key = 'a'.repeat(64);
  it.each(['시발놈', '병신', '개새끼', 'ㅅㅂ', '씨발', '시 1 발', 'ㅅ.ㅂ', 'FUCK', 'tlqkf', '보지', '시바'])('"%s" → 편집자NN', (n) => {
    expect(screenNickname(cleanNickname(n)!, key)).toMatch(/^편집자\d{2}$/);
  });
  it.each(['시바견', '보지마', '자지마', '등신대', '이애자', '김대리', '편집자35', '미친존재감'])('오탐 없음: "%s" 그대로', (n) => {
    expect(screenNickname(cleanNickname(n)!, key)).toBe(n);
  });
  it('보이지 않는 문자 끼워 넣기("시<ZWSP>발")는 cleanNickname이 먼저 지워 걸린다', () => {
    expect(screenNickname(cleanNickname('시​발')!, key)).toMatch(/^편집자\d{2}$/);
  });
  it('기본 닉네임은 10~99, 같은 키 같은 번호', () => {
    expect(defaultNickname(key)).toBe(defaultNickname(key));
    for (const k of ['0'.repeat(64), 'f'.repeat(64), '7fffffff' + '0'.repeat(56)]) expect(defaultNickname(k)).toMatch(/^편집자([1-9]\d)$/);
  });
  it('기록(한계, 결함 아님): 전각 영문·자모 분리 표기는 통과한다', () => {
    expect([isBannedNickname('ｆｕｃｋ'), isBannedNickname('ㅅㅣㅂㅏㄹ')]).toEqual([false, false]);
  });
});

describe('DIS-06 숨기기 시트 61초 간격 스냅샷', () => {
  it('61초 뒤 바뀐 칸 = 0 또는 저장 시각·날짜 칸뿐', () => {
    vi.useFakeTimers({ now: new Date('2026-11-09T09:58:30+09:00') });
    const t = setup({ mode: 'room', roomCode: '12345' });
    hideByTab();
    const snap = () => {
      const layer = t.container.querySelector('[data-layer="disguise"]') as HTMLElement;
      const m = new Map<string, string>();
      layer.querySelectorAll('[data-addr]').forEach((e, i) => m.set(e.getAttribute('data-addr') ?? `#${i}`, (e.getAttribute('aria-label') ?? '') + '|' + (e.textContent ?? '')));
      m.set('#filter', (layer.querySelector('.mc-filterrow, [data-filter-row]')?.textContent ?? ''));
      return m;
    };
    const a = snap();
    expect(a.size).toBeGreaterThan(50);
    act(() => void vi.advanceTimersByTime(61_000));
    const b = snap();
    const changed = [...a.keys()].filter((k) => a.get(k) !== b.get(k)).map((k) => `${k}: ${a.get(k)} → ${b.get(k)}`);
    for (const c of changed) expect(c).toMatch(/\d{1,2}:\d{2}|\d{4}-\d{2}-\d{2}/);
    expect(changed.length).toBeLessThanOrEqual(2);
  });
});

describe('HIDE-22 (J) 창 이탈 오탐·공유 시트 예외', () => {
  function setVisibility(v: 'hidden' | 'visible') {
    Object.defineProperty(document, 'visibilityState', { value: v, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  }
  afterEach(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  });
  it('주소창 클릭에 해당하는 blur 1번 → 숨김(안전 쪽)', () => {
    const t = setup();
    act(() => void window.dispatchEvent(new Event('blur')));
    expect(viewOf(t.container)).toBe('disguise');
  });
  it('공유 시트 예외: blur + visibilitychange(hidden) 짝 → 숨기지 않음, 돌아와 다시 blur → 숨김', () => {
    const t = setup();
    act(() => {
      t.store.graceNextLeave();
      window.dispatchEvent(new Event('blur'));
      setVisibility('hidden');
    });
    expect(viewOf(t.container)).toBe('game');
    act(() => setVisibility('visible'));
    act(() => void window.dispatchEvent(new Event('blur')));
    expect(viewOf(t.container)).toBe('disguise');
  });
  it('공유 시트 예외 뒤 같은 종류 신호가 또 오면(blur 2번) 두 번째에 숨는다', () => {
    const t = setup();
    act(() => {
      t.store.graceNextLeave();
      window.dispatchEvent(new Event('blur'));
    });
    expect(viewOf(t.container)).toBe('game');
    act(() => void window.dispatchEvent(new Event('blur')));
    expect(viewOf(t.container)).toBe('disguise');
  });
  it('예외 뒤 pagehide는 짝으로 소비하지 않는다(숨김)', () => {
    const t = setup();
    act(() => {
      t.store.graceNextLeave();
      window.dispatchEvent(new Event('blur'));
      window.dispatchEvent(new Event('pagehide'));
    });
    expect(viewOf(t.container)).toBe('disguise');
  });
});

describe('A11Y-02 (J) 키보드만으로 한 판 — 2차에서 새로 재현된 결함', () => {
  const kd = (target: EventTarget, init: KeyboardEventInit) =>
    act(() => void target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })));
  const SLASH: KeyboardEventInit = { key: '/', code: 'Slash' };
  const RIGHT: KeyboardEventInit = { key: 'ArrowRight', code: 'ArrowRight' };
  const ENTER: KeyboardEventInit = { key: 'Enter', code: 'Enter' };
  const grid = (c: HTMLElement, pane: 'mine' | 'theirs') => c.querySelector(`[data-layer="game"] [data-pane="${pane}"] [role="grid"]`) as HTMLElement;

  function quizOpenView(): PlayingView {
    const v = mockPlayingView(0, Date.now());
    return { ...v, game: { ...v.game, phase: 'quiz', clock: { state: 'paused', reason: 'quiz', remainingMs: 20_000 }, quiz: { id: 'q4-1', kind: 'sum', values: [12, 34, 56], labelSeed: 1, deadlineAt: Date.now() + 10_000, mine: 'open', status: 'open', settleAt: null } } };
  }

  it('BUG-22 검산이 뜨면 키보드만으로(/ 모드 이동 또는 격자에서 숫자 입력) 검산 입력칸에 들어갈 수 있어야 한다', () => {
    const t = setup({ view: quizOpenView() });
    const input = t.container.querySelector('[data-layer="game"] input.mc-cell__input') as HTMLInputElement;
    expect(input).not.toBeNull();
    const seen: Element[] = [];
    kd(window, SLASH);
    for (let i = 0; i < 10; i++) { seen.push(document.activeElement as Element); kd(window, RIGHT); }
    kd(window, SLASH);
    const g = grid(t.container, 'theirs');
    g.focus();
    kd(g, { key: '1', code: 'Digit1' });
    seen.push(document.activeElement as Element);
    expect(seen.includes(input)).toBe(true);
  });

  it('BUG-23 힌트 고르기 모드에서 키보드(방향키 + Enter)로 범위를 골라 확정할 수 있어야 한다', async () => {
    const t = setup();
    act(() => void (t.container.querySelector('[data-mc-cmd="hint"]') as HTMLElement).click());
    expect(t.container.querySelector('[data-mc-cmd="hint"]')!.getAttribute('aria-pressed')).toBe('true');
    const g = grid(t.container, 'theirs');
    g.focus();
    kd(g, RIGHT);
    kd(g, RIGHT);
    await act(async () => void g.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...ENTER })));
    expect(t.spies.hint).toHaveBeenCalled();
  });

  it('BUG-24 배치 화면에서 내 시트 격자에 글자(B)를 치면 대전처럼 이름 상자로 이동해 범위를 이어서 칠 수 있어야 한다', () => {
    const p = mockPlayingView(0, Date.now());
    const placing: RoomView = { status: 'placing', room: { ...p.room, version: 3 }, me: { ...p.me, placed: false, ships: [] }, opp: { ...p.opp, placed: false }, events: [], placeDeadlineAt: Date.now() + 90_000 };
    const t = setup({ view: placing });
    const g = grid(t.container, 'mine');
    g.focus();
    kd(g, { key: 'b', code: 'KeyB' });
    expect(document.activeElement?.getAttribute('aria-label')).toBe('이름 상자');
  });

  it('(대조) 대전 화면에서는 상대 시트 격자에 글자를 치면 이름 상자로 이동한다 — 키보드 발사 경로는 정상', () => {
    const t = setup();
    const g = grid(t.container, 'theirs');
    g.focus();
    kd(g, { key: 'b', code: 'KeyB' });
    expect(document.activeElement?.getAttribute('aria-label')).toBe('이름 상자');
  });
});

describe('UI-14 (J) 힌트 UI', () => {
  const formula = (c: HTMLElement) => ({
    name: (screen.getByLabelText('이름 상자') as HTMLInputElement).value,
    text: ((c.querySelector('[aria-label="수식 입력줄"]') as HTMLInputElement | HTMLElement | null) as HTMLInputElement | null)?.value
      ?? (c.querySelector('[aria-label="수식 입력줄"]')?.textContent ?? ''),
  });
  const colHead = (c: HTMLElement, i: number) =>
    c.querySelectorAll<HTMLElement>('[data-layer="game"] [data-pane="theirs"] [role="columnheader"]')[i] as HTMLElement;
  const rowHead = (c: HTMLElement, i: number) =>
    c.querySelectorAll<HTMLElement>('[data-layer="game"] [data-pane="theirs"] [role="rowheader"]')[i] as HTMLElement;

  it('[Σ] → 열 머리글 E → 미리보기 E1:E8 · =COUNTIF(E1:E8,">0") → ✓ → hint({col:E}), 수식줄 비움', async () => {
    const t = setup();
    act(() => void (t.container.querySelector('[data-mc-cmd="hint"]') as HTMLElement).click());
    expect(t.container.querySelector('[data-mc-cmd="hint"]')!.getAttribute('aria-pressed')).toBe('true');
    const heads = t.container.querySelectorAll('[data-layer="game"] [data-pane="theirs"] [role="columnheader"]');
    const e = Array.from(heads).find((h) => h.textContent?.trim() === 'E') as HTMLElement;
    act(() => void e.click());
    expect(formula(t.container)).toEqual({ name: 'E1:E8', text: '=COUNTIF(E1:E8,">0")' });
    await act(async () => void (t.container.querySelector('[data-mc-cmd="confirm"]') as HTMLElement).click());
    expect(t.spies.hint).toHaveBeenCalledWith({ kind: 'col', col: 'E' });
    expect(t.container.querySelector('[data-mc-cmd="hint"]')!.getAttribute('aria-pressed')).toBeNull();
    expect(formula(t.container).name).toBe('');
  });

  it('행 번호 3 → 미리보기 A3:H3, 칸 H8 → 3×3 F6:H8 / 칸 A1 → A1:C3 (판 안으로 밀어 넣음, O10)', () => {
    const t = setup();
    act(() => void (t.container.querySelector('[data-mc-cmd="hint"]') as HTMLElement).click());
    const r3 = Array.from(t.container.querySelectorAll<HTMLElement>('[data-layer="game"] [data-pane="theirs"] [role="rowheader"]')).find((h) => h.textContent?.trim() === '3') as HTMLElement;
    act(() => void r3.click());
    expect(formula(t.container).name).toBe('A3:H3');
    const h8 = t.container.querySelector('[data-layer="game"] [data-pane="theirs"] [data-addr="H8"]') as HTMLElement;
    act(() => void fireEvent.mouseDown(h8, { detail: 1 }));
    expect(formula(t.container).name).toBe('F6:H8');
    const a1 = t.container.querySelector('[data-layer="game"] [data-pane="theirs"] [data-addr="A1"]') as HTMLElement;
    act(() => void fireEvent.mouseDown(a1, { detail: 1 }));
    expect(formula(t.container).name).toBe('A1:C3');
    void colHead; void rowHead;
  });

  it('상대 차례에도 [Σ] 사용 가능(힌트 모드 켜짐)', () => {
    const v = mockPlayingView(0, Date.now());
    const t = setup({ view: { ...v, game: { ...v.game, turn: 1 } } });
    act(() => void (t.container.querySelector('[data-mc-cmd="hint"]') as HTMLElement).click());
    expect(t.container.querySelector('[data-mc-cmd="hint"]')!.getAttribute('aria-pressed')).toBe('true');
  });

  it('검산 중·경보 중 [Σ] → 힌트 모드 없음 + 이유 문구, 힌트 0개면 "남은 힌트 없음" 류', () => {
    const v = mockPlayingView(0, Date.now());
    const quiz: PlayingView = { ...v, game: { ...v.game, phase: 'quiz', clock: { state: 'paused', reason: 'quiz', remainingMs: 20_000 }, quiz: { id: 'q', kind: 'sum', values: [1, 2, 3], labelSeed: 1, deadlineAt: Date.now() + 9000, mine: 'open', status: 'open', settleAt: null } } };
    const alarm: PlayingView = { ...v, game: { ...v.game, alarm: { issuedAt: Date.now(), reported: true } } };
    const none: PlayingView = { ...v, me: { ...v.me, hintsAvailable: 0 } };
    for (const [vv, want] of [[quiz, COMMON_PACK.status.wrongPhase], [alarm, COMMON_PACK.status.wrongPhase], [none, COMMON_PACK.status.hintNone]] as const) {
      const t = setup({ view: vv });
      act(() => void (t.container.querySelector('[data-mc-cmd="hint"]') as HTMLElement).click());
      expect(t.container.querySelector('[data-mc-cmd="hint"]')!.getAttribute('aria-pressed')).toBeNull();
      expect(statusLine(t.container)).toBe(want);
      t.unmount();
    }
  });

  it('결과: 열 힌트 = 9행, 행 힌트 = I열, 3×3 = 검토 의견 표 / 상대의 힌트는 내 변경 내역에 범위만(값 없음)', () => {
    const v = mockPlayingView(0, Date.now());
    const withHints: PlayingView = {
      ...v,
      me: { ...v.me, hintsEarned: 2, hintsAvailable: 0, hints: [
        { target: { kind: 'col', col: 'B' }, value: 2, round: 4, at: Date.now() - 1000 },
        { target: { kind: 'block', cell: 'D4' }, value: 1, round: 5, at: Date.now() - 500 },
      ] },
    };
    const t = setup({ view: withHints });
    const theirs = t.container.querySelector('[data-layer="game"] [data-pane="theirs"]') as HTMLElement;
    const rowOf = (el: Element) => el.closest('[role="row"]');
    // 9행(0기준 8)의 B열 칸 = 2
    const rows = theirs.querySelectorAll('[role="row"]');
    const row9 = Array.from(rows).find((r) => r.querySelector('[role="rowheader"]')?.textContent?.trim() === '9');
    expect(row9?.textContent).toContain('2');
    expect(theirs.textContent).toContain('C3:E5');
    void rowOf;
    const mine = t.container.querySelector('[data-layer="game"] [data-pane="mine"]') as HTMLElement;
    expect(mine.textContent).toContain('E1:E8');
  });
});
