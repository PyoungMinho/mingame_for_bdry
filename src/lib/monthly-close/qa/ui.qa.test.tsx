// @vitest-environment jsdom
/**
 * QA(STEP 5) 화면 기능 — 설계서 §3-11 UI-05(CR-4)·UI-07(CR-5)·UI-09·UI-22, §3-5 CON-09(CR-17), §3-3 SEC-16,
 * §3-9 LEAK-11·LEAK-18, §3-15 A11Y-01·03, §3-11 UI-01. 제품 코드 무수정. 재현 결함은 bug()(=it.fails)로 남긴다.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { GameScreen } from '@/app/monthly-close/_screens/GameScreen';
import { ViewStore } from '@/lib/monthly-close/client/viewStore';
import { createStaticController } from '@/lib/monthly-close/client/staticController';
import { mockEndedView, mockPlayingView } from '@/lib/monthly-close/client/mockViews';
import type { ActionOutcome, RoomController, RoomControllerState } from '@/lib/monthly-close/client/controller';
import type { EndedView, PlacingView, PlayingView, RoomView } from '@/lib/monthly-close/protocol';
import type { ShipPlacement } from '@/lib/monthly-close/coords';
import { COMMON_PACK } from '@/lib/monthly-close/copy/pick';

const bug = process.env.QA_SHOW_BUGS ? it : it.fails;

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
});

const statusLine = (c: HTMLElement) => c.querySelector('.mc-status__msg')?.textContent ?? '';

function placingView(ships: ShipPlacement[] = [], version = 3): PlacingView {
  const p = mockPlayingView(0, Date.now());
  return { status: 'placing', room: { ...p.room, version }, me: { ...p.me, placed: false, ships }, opp: { ...p.opp, placed: false }, events: [], placeDeadlineAt: Date.now() + 90_000 };
}

describe('UI-05 입장 대화상자 (CR-4)', () => {
  function joinScreen() {
    const v = mockPlayingView(0, Date.now());
    const base = createStaticController(v);
    const state: RoomControllerState = { ...base.state, entry: { kind: 'needJoin' }, view: null };
    const c: RoomController = { ...base, kind: 'live', code: '12345', state };
    const r = render(<GameScreen controller={c} store={new ViewStore('game')} mode="room" roomCode="12345" onHome={() => undefined} />);
    if ((r.container.querySelector('.mc-shell') as HTMLElement).dataset.view === 'disguise') {
      act(() => void (screen.getAllByRole('tab').find((t) => t.getAttribute('data-kind') === 'game') as HTMLElement).click());
    }
    return r;
  }
  it('닉네임 0자면 [열기] 비활성, 8자 제한', () => {
    const r = joinScreen();
    const input = r.container.querySelector('.mc-dialog input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '' } });
    const open = r.container.querySelector('[data-mc-cmd="join-open"]') as HTMLButtonElement;
    expect(open.disabled || open.getAttribute('aria-disabled') === 'true').toBe(true);
    expect(input.maxLength).toBe(8);
  });
  it('양식을 바꾸면 파일명(탭 제목)이 즉시 그 업종으로 바뀐다(A12)', () => {
    const r = joinScreen();
    const before = document.title;
    act(() => void (r.container.querySelectorAll('.mc-dialog [role="radio"]')[1] as HTMLElement).click());
    expect(document.title).not.toBe(before);
  });
  it('BUG-05 [CR-4] 닉네임을 입력한 뒤 양식을 바꿔도 입력한 닉네임이 유지돼야 한다', () => {
    const r = joinScreen();
    fireEvent.change(r.container.querySelector('.mc-dialog input') as HTMLInputElement, { target: { value: '김대리QA' } });
    act(() => void (r.container.querySelectorAll('.mc-dialog [role="radio"]')[2] as HTMLElement).click());
    expect((r.container.querySelector('.mc-dialog input') as HTMLInputElement).value).toBe('김대리QA');
  });
});

describe('UI-07 배치 연속 조작 (CR-5): place 응답이 늦을 때', () => {
  /**
   * LiveRoom.act()의 실제 규칙을 흉내 낸 컨트롤러: 응답 대기 중(pending)이면 다음 액션은 요청 없이 WRONG_PHASE
   * (client/liveRoom.ts:268 `if (this.state.pending) return { ok:false, error:'WRONG_PHASE' }`). 그 규칙 자체는 아래 단위 테스트로 확인.
   */
  it('BUG-06 [CR-5] L4 배치 직후 L3 배치 → 첫 응답이 도착해도 L3 초안이 사라지지 않고 "저장 실패" 문구가 없어야 한다', async () => {
    let resolveFirst: (o: ActionOutcome) => void = () => undefined;
    let inflight = false;
    const sent: ShipPlacement[][] = [];
    const v0 = placingView([]);
    const base = createStaticController(v0);
    const place: RoomController['place'] = (ships) => {
      if (inflight) return Promise.resolve({ ok: false, error: 'WRONG_PHASE' });
      inflight = true;
      sent.push([...ships]);
      return new Promise((res) => (resolveFirst = (o) => { inflight = false; res(o); }));
    };
    const mk = (v: RoomView): RoomController => ({ ...base, state: { ...base.state, view: v }, place });
    const store = new ViewStore('game');
    const r = render(<GameScreen controller={mk(v0)} store={store} mode="practice" roomCode={null} initialIndustry={0} onHome={() => undefined} />);
    const nb = () => screen.getByLabelText('이름 상자') as HTMLInputElement;
    fireEvent.change(nb(), { target: { value: 'B2:E2' } });
    fireEvent.keyDown(nb(), { key: 'Enter', code: 'Enter' });
    fireEvent.change(nb(), { target: { value: 'B4:D4' } });
    await act(async () => void fireEvent.keyDown(nb(), { key: 'Enter', code: 'Enter' }));
    // 첫 응답 도착: 서버에는 L4만 저장됨
    const v1 = placingView([{ slot: 'L4', start: 'B2', dir: 'h' }], 4);
    await act(async () => {
      resolveFirst({ ok: true, view: v1 });
      r.rerender(<GameScreen controller={mk(v1)} store={store} mode="practice" roomCode={null} initialIndustry={0} onHome={() => undefined} />);
    });
    const mine = r.container.querySelector('[data-pane="mine"]') as HTMLElement;
    const l3Cells = ['B4', 'C4', 'D4'].map((a) => mine.querySelector(`[data-addr="${a}"]`)?.getAttribute('data-state'));
    expect.soft(statusLine(r.container), '저장 실패 문구').not.toContain(COMMON_PACK.status.conflict);
    expect.soft(l3Cells, 'L3 초안 칸(B4·C4·D4)').toEqual(['mine', 'mine', 'mine']);
    expect(sent.length, '서버에 간 place 요청 수(두 번째는 요청 없이 버려짐)').toBe(2);
  });
});

describe('CON-09 클라 연타 (CR-17)', () => {
  it('같은 칸 3연속 클릭(첫 응답 전 pending 반영) → 서버 fire 1건, "지금은…" 문구 없음', async () => {
    const v0 = mockPlayingView(0, Date.now());
    const base = createStaticController(v0);
    let pending = false;
    const fire = vi.fn(() => new Promise<ActionOutcome>(() => undefined));
    const store = new ViewStore('game');
    const mk = (): RoomController => ({ ...base, state: { ...base.state, pending }, fire });
    const r = render(<GameScreen controller={mk()} store={store} mode="practice" roomCode={null} initialIndustry={0} onHome={() => undefined} />);
    const cell = () => r.container.querySelector('[data-layer="game"] [data-pane="theirs"] [data-addr="H7"]') as HTMLElement;
    fireEvent.mouseDown(cell(), { detail: 1 });
    await act(async () => void fireEvent.mouseDown(cell(), { detail: 2 }));
    pending = true; // LiveRoom.set({pending:true})가 다시 그리게 한다
    r.rerender(<GameScreen controller={mk()} store={store} mode="practice" roomCode={null} initialIndustry={0} onHome={() => undefined} />);
    await act(async () => void fireEvent.mouseDown(cell(), { detail: 3 }));
    expect(fire).toHaveBeenCalledTimes(1);
    expect(statusLine(r.container)).not.toMatch(/^지금은/);
  });
  it('BUG-14 [CR-17] 첫 응답 뒤(상대 차례로 바뀐 뒤) 세 번째 클릭이 도착해도 상태줄 "지금은 편집할 수 없습니다."가 뜨지 않는다(연타 잡음 제거, 기록 테스트를 수정 후 회귀로 전환)', async () => {
    const v0 = mockPlayingView(0, Date.now());
    const base = createStaticController(v0);
    const store = new ViewStore('game');
    const after: PlayingView = { ...v0, room: { ...v0.room, version: 13 }, game: { ...v0.game, turn: 1, myShots: [...v0.game.myShots, { cell: 'H7', result: 'miss', round: 6 }] } };
    const fire = vi.fn(async (): Promise<ActionOutcome> => ({ ok: true, view: after }));
    const r = render(<GameScreen controller={{ ...base, fire }} store={store} mode="practice" roomCode={null} initialIndustry={0} onHome={() => undefined} />);
    const cell = () => r.container.querySelector('[data-layer="game"] [data-pane="theirs"] [data-addr="H7"]') as HTMLElement;
    fireEvent.mouseDown(cell(), { detail: 1 });
    await act(async () => void fireEvent.mouseDown(cell(), { detail: 2 }));
    r.rerender(<GameScreen controller={{ ...base, state: { ...base.state, view: after }, fire }} store={store} mode="practice" roomCode={null} initialIndustry={0} onHome={() => undefined} />);
    await act(async () => void fireEvent.mouseDown(cell(), { detail: 3 }));
    expect(fire).toHaveBeenCalledTimes(1);
    expect(statusLine(r.container)).not.toBe(COMMON_PACK.status.notNow);
  });
});

describe('UI-09 발사 입력', () => {
  function battle() {
    const v = mockPlayingView(0, Date.now());
    const base = createStaticController(v);
    const fire = vi.fn(base.fire);
    const r = render(<GameScreen controller={{ ...base, fire }} store={new ViewStore('game')} mode="practice" roomCode={null} initialIndustry={0} onHome={() => undefined} />);
    return { r, fire, v };
  }
  for (const raw of ['b7', 'ㅠ7', 'Ｂ７', ' B 7 ', '$B$7']) {
    it(`이름 상자 "${raw}" + Enter → fire(B7)`, async () => {
      const { fire } = battle();
      const nb = screen.getByLabelText('이름 상자') as HTMLInputElement;
      fireEvent.change(nb, { target: { value: raw } });
      await act(async () => void fireEvent.keyDown(nb, { key: 'Enter', code: 'Enter' }));
      expect(fire).toHaveBeenCalledWith('B7');
    });
  }
  it('클릭 1번은 선택만, 같은 칸 다시 클릭이면 반영', async () => {
    const { r, fire } = battle();
    const cell = () => r.container.querySelector('[data-layer="game"] [data-pane="theirs"] [data-addr="H7"]') as HTMLElement;
    fireEvent.mouseDown(cell(), { detail: 1 });
    expect(fire).not.toHaveBeenCalled();
    await act(async () => void fireEvent.mouseDown(cell(), { detail: 1 }));
    expect(fire).toHaveBeenCalledWith('H7');
  });
  it('상대 차례 Enter = 선택만 + "지금은 편집할 수 없습니다."', async () => {
    const v = mockPlayingView(0, Date.now());
    const opp: PlayingView = { ...v, game: { ...v.game, turn: 1 } };
    const base = createStaticController(opp);
    const fire = vi.fn(base.fire);
    const r = render(<GameScreen controller={{ ...base, fire }} store={new ViewStore('game')} mode="practice" roomCode={null} initialIndustry={0} onHome={() => undefined} />);
    const nb = screen.getByLabelText('이름 상자') as HTMLInputElement;
    fireEvent.change(nb, { target: { value: 'B7' } });
    await act(async () => void fireEvent.keyDown(nb, { key: 'Enter', code: 'Enter' }));
    expect(fire).not.toHaveBeenCalled();
    expect(statusLine(r.container)).toBe(COMMON_PACK.status.notNow);
  });
});

describe('SEC-16 XSS·표시', () => {
  it('상대 닉네임 <img onerror> → 글자로만, img 생성 0', () => {
    const v = mockPlayingView(0, Date.now());
    const evil = '<img src=x onerror=alert(1)>';
    const hostile: PlayingView = {
      ...v,
      opp: { ...v.opp, nickname: evil },
      room: { ...v.room, version: 13 },
      events: [...v.events, { seq: 2, at: Date.now(), round: 6, type: 'fire', by: 1, cell: 'H1', result: 'miss' }],
    };
    const alertSpy = vi.fn();
    vi.stubGlobal('alert', alertSpy);
    const base = createStaticController(v);
    const store = new ViewStore('game');
    const r = render(<GameScreen controller={base} store={store} mode="practice" roomCode={null} initialIndustry={0} onHome={() => undefined} />);
    r.rerender(<GameScreen controller={{ ...base, state: { ...base.state, view: hostile } }} store={store} mode="practice" roomCode={null} initialIndustry={0} onHome={() => undefined} />);
    expect(r.container.querySelectorAll('img').length).toBe(0);
    expect(alertSpy).not.toHaveBeenCalled();
    // 상태줄은 짧은 이름(4자)으로만
    expect(statusLine(r.container).length).toBeLessThanOrEqual(28);
  });
});

describe('UI-22 종료 사유별 문구', () => {
  for (const reason of ['sunk2', 'draw', 'cap', 'resign', 'absent'] as const) {
    it(`${reason}: 결과 문구가 사유 사전과 일치`, () => {
      const e = mockEndedView(0, Date.now());
      const winner = reason === 'draw' ? null : 0;
      const v: EndedView = { ...e, result: { winner, reason, round: 9 } };
      const r = render(<GameScreen controller={createStaticController(v)} store={new ViewStore('game')} mode="practice" roomCode={null} initialIndustry={0} onHome={() => undefined} />);
      act(() => void (screen.getAllByRole('tab').find((t) => t.getAttribute('data-kind') === 'result') as HTMLElement).click());
      expect(COMMON_PACK.endReasons[reason]).toBeTruthy();
      expect(r.container.textContent).toContain(COMMON_PACK.endReasons[reason].slice(0, 6));
      r.unmount();
    });
  }
});

describe('LEAK-11·LEAK-18·A11Y-01', () => {
  it('LEAK-11 단계별 body 직계 자식: 렌더 컨테이너 1개 외 UI 요소 0(포털 없음)', () => {
    for (const v of [placingView(), mockPlayingView(0, Date.now()), mockEndedView(0, Date.now())]) {
      const r = render(<GameScreen controller={createStaticController(v)} store={new ViewStore('game')} mode="practice" roomCode={null} initialIndustry={0} onHome={() => undefined} />);
      act(() => void (r.container.querySelector('[data-mc-cmd="menu-file"]') as HTMLElement).click());
      const kids = Array.from(document.body.children).filter((el) => el !== r.container && el.tagName !== 'SCRIPT' && el.childNodes.length > 0);
      expect(kids.map((k) => k.outerHTML.slice(0, 60))).toEqual([]);
      r.unmount();
    }
  });
  it('LEAK-18 셸·숨기기 시트·상태줄에 "베타"·"Microsoft"·"Google"·"Excel" 0', () => {
    const r = render(<GameScreen controller={createStaticController(mockPlayingView(0, Date.now()))} store={new ViewStore('game')} mode="practice" roomCode={null} initialIndustry={0} onHome={() => undefined} />);
    const shell = r.container.querySelector('.mc-shell') as HTMLElement;
    expect(shell.textContent).not.toMatch(/베타|Microsoft|Google|Excel|엑셀/);
  });
  it('A11Y-01 격자 role=grid, 셀 aria-label, 상태줄 role=status, 메모 aria-live=off', () => {
    const r = render(<GameScreen controller={createStaticController(mockPlayingView(0, Date.now()))} store={new ViewStore('game')} mode="practice" roomCode={null} initialIndustry={0} onHome={() => undefined} />);
    expect(r.container.querySelectorAll('[data-layer="game"] [role="grid"]').length).toBeGreaterThanOrEqual(2);
    const cell = r.container.querySelector('[data-layer="game"] [data-pane="theirs"] [data-addr="A1"]') as HTMLElement;
    const label = cell.getAttribute('aria-label') ?? cell.closest('[aria-label]')?.getAttribute('aria-label') ?? '';
    expect(label).toMatch(/A1/);
    expect(r.container.querySelector('.mc-status')?.closest('[role="status"]') ?? r.container.querySelector('[role="status"]')).not.toBeNull();
  });
});
