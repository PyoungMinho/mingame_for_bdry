// @vitest-environment jsdom
/**
 * STEP 6 리뷰 수정 회귀(화면).
 *  - MC-FE-01: 재대결 판에서 받은 도발이 상태줄·메모로 뜬다(도발 커서가 판마다 초기화). 원 재현: fe-review/vt/rematch-taunt.test.tsx
 *  - MC-FE-03: 피식 응답은 판당 1회(결과 탭 ↔ 게임 탭을 오가도, 새로고침해도)
 *  - 디자인 M2: 검산 오답 메모가 입력 병합(B13:D13)에 붙어 보인다
 *  - BUG-25: 검산 표가 스크롤 상자 밖이면 입력칸이 보이게 내린다(제목 줄은 열 머리글 밑으로 숨기지 않음)
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { GameScreen } from './GameScreen';
import { revealQuizRows } from './Battle';
import { ViewStore } from '@/lib/monthly-close/client/viewStore';
import { createStaticController } from '@/lib/monthly-close/client/staticController';
import { mockEndedView, mockPlayingView } from '@/lib/monthly-close/client/mockViews';
import { mcApi } from '@/lib/monthly-close/client/api';
import type { RoomController } from '@/lib/monthly-close/client/controller';
import type { EndedView, PlayingView, RoomView } from '@/lib/monthly-close/protocol';
import { COMMON_PACK, tauntLine } from '@/lib/monthly-close/copy/pick';

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
  vi.restoreAllMocks();
});

const tabOf = (kind: string) => screen.getAllByRole('tab').find((t) => t.getAttribute('data-kind') === kind) as HTMLElement;
const statusAndMemo = (c: HTMLElement) =>
  (c.querySelector('.mc-status')?.textContent ?? '') + ' | memo=' + [...c.querySelectorAll('[data-layer="game"] .mc-memo')].map((m) => m.textContent).join('/');

function setup(view: RoomView, o: { mode?: 'room' | 'practice'; ctl?: Partial<RoomController> } = {}) {
  const store = new ViewStore('game');
  const mode = o.mode ?? 'room';
  const el = (v: RoomView) => {
    const base = createStaticController(v);
    const c: RoomController = { ...base, ...(o.ctl ?? {}), kind: mode === 'room' ? 'live' : 'practice', code: mode === 'room' ? '12345' : null, state: { ...base.state, view: v } };
    return <GameScreen controller={c} store={store} mode={mode} roomCode={mode === 'room' ? '12345' : null} initialIndustry={0} onHome={() => undefined} />;
  };
  const r = render(el(view));
  if (store.view === 'disguise') act(() => void tabOf('game').click());
  return { ...r, store, rerenderWith: (v: RoomView) => r.rerender(el(v)) };
}

describe('MC-FE-01 재대결 판의 받은 도발', () => {
  function v(version: number, matchSeq: number, logSeqs: number[], tauntId = 0): PlayingView {
    const base = mockPlayingView(0, Date.now());
    return {
      ...base,
      room: { ...base.room, version, matchSeq },
      game: { ...base.game, matchId: `m${matchSeq}`, log: logSeqs.map((seq) => ({ seq, at: Date.now(), round: 3, by: 1 as const, type: 'taunt' as const, tauntId })) },
    };
  }

  it('2판(v8) 순번 1의 도발이 상태줄·메모에 뜬다(1판 마지막 순번 3보다 작아도)', () => {
    const t = setup(v(10, 1, []));
    const idle = statusAndMemo(t.container);
    act(() => t.rerenderWith(v(11, 1, [1])));
    const m1 = statusAndMemo(t.container);
    expect(m1).not.toBe(idle);
    act(() => t.rerenderWith(v(12, 1, [1, 2, 3])));
    act(() => t.rerenderWith(v(13, 2, [])));
    const idle2 = statusAndMemo(t.container);
    act(() => t.rerenderWith(v(14, 2, [1], 5)));
    const m2 = statusAndMemo(t.container);
    expect(m2).not.toBe(idle2);
    expect(m2).toContain(tauntLine(5).text);
  });

  it('첫 마운트(새로고침)는 지금까지의 로그를 이미 본 것으로 처리한다(옛 도발을 다시 띄우지 않음)', () => {
    const t = setup(v(14, 2, [1, 2, 3], 5));
    const before = statusAndMemo(t.container);
    expect(before).not.toContain(tauntLine(5).text);
    act(() => t.rerenderWith(v(15, 2, [1, 2, 3])));
    expect(statusAndMemo(t.container)).toBe(before);
  });
});

describe('MC-FE-03 피식 응답은 판당 1회', () => {
  const endedView = (): EndedView => mockEndedView(0, Date.now());

  it('결과 탭 → 게임 탭 → 결과 탭으로 다시 열어도 눌린 채이고 feedback은 1번만 간다', () => {
    const fb = vi.spyOn(mcApi, 'feedback').mockResolvedValue(undefined as never);
    const t = setup(endedView());
    act(() => void tabOf('result').click());
    act(() => void (t.container.querySelector('[data-mc-cmd="laugh:some"]') as HTMLElement).click());
    act(() => void tabOf('game').click());
    act(() => void tabOf('result').click());
    const again = t.container.querySelector('[data-mc-cmd="laugh:lol"]') as HTMLButtonElement;
    act(() => void again.click());
    const sent = fb.mock.calls.filter((c) => (c[0] as { type: string }).type === 'feedback');
    expect(sent).toHaveLength(1);
    expect(sent[0]![0]).toMatchObject({ type: 'feedback', laugh: 'some' });
    expect(t.container.querySelector('[data-mc-cmd="laugh:some"]')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('같은 판을 새로 연 화면(새로고침)에서도 다시 보내지 않는다, 다음 판은 새로 받는다', () => {
    const fb = vi.spyOn(mcApi, 'feedback').mockResolvedValue(undefined as never);
    const e = endedView();
    const a = setup(e);
    act(() => void tabOf('result').click());
    act(() => void (a.container.querySelector('[data-mc-cmd="laugh:none"]') as HTMLElement).click());
    a.unmount();
    const b = setup(e);
    act(() => void tabOf('result').click());
    act(() => void (b.container.querySelector('[data-mc-cmd="laugh:lol"]') as HTMLElement).click());
    expect(fb.mock.calls.filter((c) => (c[0] as { type: string }).type === 'feedback')).toHaveLength(1);
    b.unmount();
    const next: EndedView = { ...e, room: { ...e.room, matchSeq: 2, version: e.room.version + 5 }, game: { ...e.game, matchId: 'm-next' } };
    const c = setup(next);
    act(() => void tabOf('result').click());
    act(() => void (c.container.querySelector('[data-mc-cmd="laugh:lol"]') as HTMLElement).click());
    expect(fb.mock.calls.filter((x) => (x[0] as { type: string }).type === 'feedback')).toHaveLength(2);
  });
});

describe('디자인 M2 검산 오답 메모', () => {
  it('오답(잠금) 응답이 오면 오답 메모가 입력 병합(B13) 기준으로 뜬다', async () => {
    const p = mockPlayingView(0, Date.now());
    const quizView: PlayingView = {
      ...p,
      game: { ...p.game, phase: 'quiz', clock: { state: 'paused', reason: 'quiz', remainingMs: 20_000 }, quiz: { id: 'q4-1', kind: 'sum', values: [12, 34, 56], labelSeed: 1, deadlineAt: Date.now() + 10_000, mine: 'open', status: 'open', settleAt: null } },
    };
    const lockedView: PlayingView = { ...quizView, me: { ...quizView.me, quizLockUntil: Date.now() + 3_000 } };
    const answer = vi.fn(async () => ({ ok: true as const, view: lockedView }));
    const t = setup(quizView, { mode: 'practice', ctl: { answer } });
    const input = t.container.querySelector('[data-layer="game"] input.mc-cell__input') as HTMLInputElement;
    expect(input.closest('[data-addr]')?.getAttribute('data-addr')).toBe('B13');
    act(() => {
      input.focus();
      fireEvent.change(input, { target: { value: '9' } });
    });
    await act(async () => void input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true })));
    expect(answer).toHaveBeenCalled();
    const memos = [...t.container.querySelectorAll('[data-layer="game"] .mc-memo')].map((m) => m.textContent ?? '');
    expect(memos.some((m) => COMMON_PACK.quizWrong.some((w) => m.includes(w)))).toBe(true);
  });
});

describe('BUG-25 검산 표 보이게 내리기', () => {
  function rig(o: { inputTop: number; headTop: number; boxTop: number; boxH: number }) {
    const box = document.createElement('div');
    box.style.overflowY = 'auto';
    Object.defineProperty(box, 'clientHeight', { value: o.boxH });
    box.getBoundingClientRect = () => ({ top: o.boxTop, bottom: o.boxTop + o.boxH, left: 0, right: 360, width: 360, height: o.boxH, x: 0, y: o.boxTop, toJSON: () => null });
    const grid = document.createElement('div');
    grid.setAttribute('role', 'grid');
    const head = document.createElement('div');
    head.setAttribute('data-addr', 'A10');
    head.getBoundingClientRect = () => ({ top: o.headTop, bottom: o.headTop + 24, left: 0, right: 40, width: 40, height: 24, x: 0, y: o.headTop, toJSON: () => null });
    const input = document.createElement('input');
    input.getBoundingClientRect = () => ({ top: o.inputTop, bottom: o.inputTop + 24, left: 40, right: 160, width: 120, height: 24, x: 40, y: o.inputTop, toJSON: () => null });
    grid.append(head, input);
    box.append(grid);
    document.body.append(box);
    return { box, input };
  }

  it('360×640: 입력칸(532~556) 아래끝이 보이는 끝(511)보다 아래면 그만큼 내린다', () => {
    const { box, input } = rig({ inputTop: 532, headTop: 460, boxTop: 92, boxH: 419 });
    revealQuizRows(input);
    expect(box.scrollTop).toBeGreaterThanOrEqual(49 - 1);
  });

  it('375×548: 제목 줄(10행)이 열 머리글 밑으로 숨지 않는 만큼만 내린다', () => {
    const { box, input } = rig({ inputTop: 532, headTop: 460, boxTop: 92, boxH: 200 });
    revealQuizRows(input);
    // 필요 = 556+4-292 = 268, 여유 = 460-(92+24) = 344 → 268
    expect(box.scrollTop).toBe(268);
    const r2 = rig({ inputTop: 532, headTop: 460, boxTop: 92, boxH: 100 });
    revealQuizRows(r2.input);
    expect(r2.box.scrollTop).toBe(344);
  });

  it('이미 보이면(PC) 아무것도 하지 않는다', () => {
    const { box, input } = rig({ inputTop: 400, headTop: 328, boxTop: 92, boxH: 600 });
    revealQuizRows(input);
    expect(box.scrollTop).toBe(0);
  });
});
