// @vitest-environment jsdom
/**
 * QA 수정 회귀(프론트, STEP 5 버그 리포트) — QA 재현 테스트(src/lib/monthly-close/qa/)에 없는 항목만 여기 둔다.
 * BUG-01·02 보강(숨김 중 크롬 게임 명령 0), BUG-05 포커스, BUG-07(숨긴 동안 크롬 단서 0), BUG-10(DOM 수),
 * BUG-18(모바일 4열 병합 제목), BUG-19(홈 스크롤바), BUG-20(부가세 단위·쉼표).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { GameScreen } from './GameScreen';
import { formatQuizValue } from './Battle';
import { ViewStore } from '@/lib/monthly-close/client/viewStore';
import { createStaticController } from '@/lib/monthly-close/client/staticController';
import { mockEndedView, mockPlayingView } from '@/lib/monthly-close/client/mockViews';
import type { RoomController, RoomControllerState } from '@/lib/monthly-close/client/controller';
import type { PlayingView, RoomView } from '@/lib/monthly-close/protocol';
import { INDUSTRY_PACKS } from '@/lib/monthly-close/copy/pick';
import { DISGUISE_FIXTURES } from '@/lib/monthly-close/sheet/disguise-fixtures';
import { DisguiseSheet, padRowsFor } from '../_components/disguise/DisguiseSheet';
import { useDisguiseSheet } from '../_components/disguise/useDisguiseSheet';

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

const TAB: KeyboardEventInit = { key: 'Tab', code: 'Tab', bubbles: true, cancelable: true };
const pressTab = () => act(() => void window.dispatchEvent(new KeyboardEvent('keydown', TAB)));
const tabs = () => screen.getAllByRole('tab').map((t) => t.textContent);
const gameTab = () => screen.getAllByRole('tab').find((t) => t.getAttribute('data-kind') === 'game') as HTMLElement;
const viewOf = (c: HTMLElement) => (c.querySelector('.mc-shell') as HTMLElement).dataset.view;

function setup(view: RoomView, o: { mode?: 'room' | 'practice'; state?: Partial<RoomControllerState> } = {}) {
  const base = createStaticController(view);
  const taunt = vi.fn(base.taunt);
  const mk = (v: RoomView): RoomController => ({ ...base, taunt, kind: o.mode === 'room' ? 'live' : 'practice', code: o.mode === 'room' ? '12345' : null, state: { ...base.state, view: v, ...(o.state ?? {}) } });
  const store = new ViewStore('game');
  const onHome = vi.fn();
  const el = (v: RoomView) => (
    <GameScreen controller={mk(v)} store={store} mode={o.mode ?? 'practice'} roomCode={o.mode === 'room' ? '12345' : null} initialIndustry={0} onHome={onHome} />
  );
  const r = render(el(view));
  if (store.view === 'disguise') act(() => void gameTab().click());
  return { ...r, store, onHome, taunt, rerenderWith: (v: RoomView) => r.rerender(el(v)) };
}

describe('BUG-07 숨긴 동안 판이 끝나도 크롬은 그대로, 복귀하면 반영', () => {
  it('결과 탭·버전 기록·[Σ] 숫자·파일명이 숨김 중 바뀌지 않는다', () => {
    const p = mockPlayingView(0, Date.now());
    const t = setup(p, { mode: 'room' });
    const before = { tabs: tabs(), ver: t.container.querySelector('.mc-topbar__ver')?.textContent, sigma: t.container.querySelector('[data-mc-cmd="hint"] .mc-tool__badge')?.textContent, title: document.title };
    pressTab();
    expect(viewOf(t.container)).toBe('disguise');
    const e = mockEndedView(0, Date.now());
    const ended = { ...e, room: { ...e.room, matchSeq: 2, record: { wins: [3, 1] as [number, number], draws: 0 } }, me: { ...e.me, hintsAvailable: 3 } };
    t.rerenderWith(ended);
    expect(tabs()).toEqual(before.tabs);
    expect(t.container.querySelector('.mc-topbar__ver')?.textContent).toBe(before.ver);
    expect(t.container.querySelector('[data-mc-cmd="hint"] .mc-tool__badge')?.textContent).toBe(before.sigma);
    expect(document.title).toBe(before.title);
    // 복귀 → 지금 값
    act(() => void gameTab().click());
    expect(screen.getAllByRole('tab').some((x) => x.getAttribute('data-kind') === 'result')).toBe(true);
    expect(t.container.querySelector('.mc-topbar__ver')?.textContent).toBe('버전 기록 3:1');
    expect(t.container.querySelector('[data-mc-cmd="hint"] .mc-tool__badge')?.textContent).toBe('(3)');
  });
});

describe('BUG-01·02 보강: 숨김 중 크롬은 무해한 동작만', () => {
  it('숨김 중 [파일 > 새 문서] = 숨김 유지 + 숨기기 시트 첫 탭(장식 탭에서 눌러도)', () => {
    const t = setup(mockPlayingView(0, Date.now()), { mode: 'room' });
    pressTab();
    act(() => void (screen.getAllByRole('tab').find((x) => x.getAttribute('data-kind') === 'deco') as HTMLElement).click());
    act(() => void (t.container.querySelector('[data-mc-cmd="menu-file"]') as HTMLElement).click());
    act(() => void (t.container.querySelector('[data-mc-cmd="file:new"]') as HTMLElement).click());
    expect(t.onHome).not.toHaveBeenCalled();
    expect(viewOf(t.container)).toBe('disguise');
    expect(t.container.querySelector('[role="menu"]')).toBeNull();
    expect(screen.getAllByRole('tab').find((x) => x.getAttribute('aria-selected') === 'true')?.getAttribute('data-kind')).toBe('disguise');
  });
  it('연습: 숨김 중 [파일 > 연습 끝내기]도 홈으로 가지 않는다', () => {
    const t = setup(mockPlayingView(0, Date.now()));
    pressTab();
    act(() => void (t.container.querySelector('[data-mc-cmd="menu-file"]') as HTMLElement).click());
    act(() => void (t.container.querySelector('[data-mc-cmd="file:endPractice"]') as HTMLElement).click());
    expect(t.onHome).not.toHaveBeenCalled();
  });
  it('도발 목록이 열린 채 숨겨도(reset이 닫음) 숨김 중 목록 항목 클릭은 캡처 단계에서 버려진다', async () => {
    const t = setup(mockPlayingView(0, Date.now()));
    act(() => void (t.container.querySelector('[data-mc-cmd="taunt"]') as HTMLElement).click());
    const item = t.container.querySelector('[data-mc-cmd^="taunt:"]:not([disabled])') as HTMLElement;
    expect(item).not.toBeNull();
    // 같은 프레임(렌더 전)에 숨김이 일어난 상황: 저장소만 숨김으로 바꾸고 DOM에 남은 항목을 누른다
    t.store.hide('tab');
    await act(async () => item.click());
    expect(t.taunt).not.toHaveBeenCalled();
  });
  it('숨김 중 [Σ]·[의견 남기기]는 눌림 모양이 없다(aria-pressed·aria-expanded)', () => {
    const t = setup(mockPlayingView(0, Date.now()));
    act(() => void (t.container.querySelector('[data-mc-cmd="hint"]') as HTMLElement).click());
    expect(t.container.querySelector('[data-mc-cmd="hint"]')!.getAttribute('aria-pressed')).toBe('true');
    pressTab();
    expect(t.container.querySelector('[data-mc-cmd="hint"]')!.getAttribute('aria-pressed')).toBeNull();
    act(() => void (t.container.querySelector('[data-mc-cmd="taunt"]') as HTMLElement).click());
    expect(t.container.querySelector('[data-mc-cmd="taunt"]')!.getAttribute('aria-expanded')).toBe('false');
  });
  it('모바일: 숨김 중 [⋯]는 메뉴를 열지 않는다(복귀 순간 튀어나옴 0)', () => {
    setMobile(true);
    const t = setup(mockPlayingView(0, Date.now()));
    act(() => void (screen.getAllByRole('tab').find((x) => x.getAttribute('data-kind') === 'disguise') as HTMLElement).click());
    expect(viewOf(t.container)).toBe('disguise');
    fireEvent.click(screen.getByRole('button', { name: '더 보기' }));
    act(() => void gameTab().click());
    expect(t.container.querySelector('[role="menu"]')).toBeNull();
  });
  it('배치 중 범위 시작을 잡은 채 숨기면 복귀 시 범위 선택이 남지 않는다', () => {
    const p = mockPlayingView(0, Date.now());
    const placing = { status: 'placing', room: { ...p.room, version: 3 }, me: { ...p.me, placed: false, ships: [] }, opp: { ...p.opp, placed: false }, events: [], placeDeadlineAt: Date.now() + 90_000 } as unknown as RoomView;
    const t = setup(placing);
    fireEvent.mouseDown(t.container.querySelector('[data-layer="game"] [data-pane="mine"] [data-addr="B2"]') as HTMLElement);
    expect((screen.getByLabelText('이름 상자') as HTMLInputElement).value).toBe('B2');
    pressTab();
    act(() => void gameTab().click());
    expect((screen.getByLabelText('이름 상자') as HTMLInputElement).value).toBe('');
    expect(t.container.querySelector('[data-layer="game"] [data-pane="mine"] [aria-selected="true"]')).toBeNull();
  });
});

describe('BUG-05 입장 대화상자: 양식을 바꾸면 고른 양식에 포커스', () => {
  it('양식 변경 → 닉네임 유지 + 포커스는 고른 라디오', () => {
    const v = mockPlayingView(0, Date.now());
    const t = setup(v, { mode: 'room', state: { entry: { kind: 'needJoin' }, view: null } });
    fireEvent.change(t.container.querySelector('.mc-dialog input') as HTMLInputElement, { target: { value: '박과장' } });
    act(() => void (t.container.querySelectorAll('.mc-dialog [role="radio"]')[1] as HTMLElement).click());
    expect((t.container.querySelector('.mc-dialog input') as HTMLInputElement).value).toBe('박과장');
    expect(document.activeElement?.getAttribute('role')).toBe('radio');
    expect(document.activeElement?.getAttribute('aria-checked')).toBe('true');
  });
});

describe('BUG-10 대전 화면 DOM 수', () => {
  for (const id of [0, 1, 2] as const) {
    it(`업종 ${id}: 셸 안 요소 ≤ 1,400(기준 1,500에 여유 100)`, () => {
      const t = setup(mockPlayingView(id, Date.now()), { mode: 'room' });
      expect(t.container.querySelectorAll('.mc-shell *').length).toBeLessThanOrEqual(1400);
    });
  }
  it('숨기기 시트 빈 줄은 창 높이만큼: 768px → 2줄, 1080px 이상 → 8줄(예전 고정값)', () => {
    const dataH = 28 + 29 * 24;
    expect(padRowsFor(768, dataH)).toBe(2);
    expect(padRowsFor(1080, dataH)).toBe(8);
    expect(padRowsFor(1440, dataH)).toBe(8);
    expect(padRowsFor(0, dataH)).toBe(2);
  });
});

function DsHarness({ kind, mobile }: { kind: 'accounting' | 'sales' | 'hr'; mobile?: boolean }) {
  const k = useDisguiseSheet(DISGUISE_FIXTURES[kind], { seed: 'room-1:abcd', asOf: '2026-11-07' });
  return <DisguiseSheet controller={k} label="손익" filterLeft="보기" filterRight="저장" mobile={mobile} />;
}

describe('BUG-18 모바일 4열 숨기기 시트: A열 시작 병합(1·2행 제목)이 첫 보이는 열에 보인다', () => {
  for (const kind of ['accounting', 'sales'] as const) {
    it(`${kind}: A열이 숨어도 1행 제목·2행 부제가 그려진다`, () => {
      const r = render(<DsHarness kind={kind} mobile />);
      const a1 = r.container.querySelector('[data-addr="A1"]') as HTMLElement | null;
      const a2 = r.container.querySelector('[data-addr="A2"]') as HTMLElement | null;
      expect(a1?.textContent).toBe(DISGUISE_FIXTURES[kind].title);
      expect(a2?.textContent?.length ?? 0).toBeGreaterThan(0);
      // 폭 = 보이는 B~E 열 합(숨긴 A열 폭 0은 빼고), 왼쪽 고정 열 표시는 없음
      expect(a1!.style.width).not.toBe('0px');
      expect(a1!.getAttribute('data-freeze-col')).toBeNull();
      // 병합에 덮인 B1은 따로 그리지 않는다
      expect(r.container.querySelector('[data-addr="B1"]')).toBeNull();
    });
  }
  it('인사(A열 보임)는 그대로', () => {
    const r = render(<DsHarness kind="hr" mobile />);
    expect(r.container.querySelector('[data-addr="A1"]')?.textContent).toBe(DISGUISE_FIXTURES.hr.title);
  });
  it('데스크톱 칸 글자는 span 없이 칸에 바로(요소 수 절감), 스크린리더 이름은 유지', () => {
    const r = render(<DsHarness kind="accounting" />);
    const b3 = r.container.querySelector('[data-addr="B3"]') as HTMLElement;
    expect(b3.textContent).toBe('계정과목');
    expect(b3.querySelector('span')).toBeNull();
    expect(b3.getAttribute('aria-label')).toBe('B3, 계정과목');
  });
});

describe('BUG-20 부가세 검산: 원 단위 + 천 단위 쉼표', () => {
  it('3업종 vat 단위는 "원"(값 = 원 단위 공급가), 나머지 단위는 그대로', () => {
    for (const k of ['accounting', 'sales', 'hr'] as const) expect(INDUSTRY_PACKS[k].quiz.vat.unit).toBe('원');
    expect(INDUSTRY_PACKS.accounting.quiz.sum.unit).toBe('만원');
  });
  it('formatQuizValue', () => {
    expect(formatQuizValue(370000)).toBe('370,000');
    expect(formatQuizValue(20000)).toBe('20,000');
    expect(formatQuizValue(56)).toBe('56');
  });
  it('검산 표에 "370,000"과 "(단위: 원)"이 보인다', () => {
    const v = mockPlayingView(0, Date.now());
    const quiz: PlayingView = {
      ...v,
      game: { ...v.game, phase: 'quiz', clock: { state: 'paused', reason: 'quiz', remainingMs: 20_000 }, quiz: { id: 'q4-1', kind: 'vat', values: [370000], labelSeed: 1, deadlineAt: Date.now() + 10_000, mine: 'open', status: 'open', settleAt: null } },
    };
    const t = setup(quiz);
    const pane = t.container.querySelector('[data-layer="game"] [data-pane="theirs"]') as HTMLElement;
    expect(pane.textContent).toContain('370,000');
    expect(pane.textContent).toContain('(단위: 원)');
    expect(pane.textContent).not.toContain('만원');
    // 값 1개 → B12:D12 병합(좁은 칸에서 잘리지 않게), 머리 B11:D11도 같은 폭
    const b12 = pane.querySelector('[data-addr="B12"]') as HTMLElement;
    expect(b12.textContent).toBe('370,000');
    expect(b12.style.width).toContain('3 * var(--mc-cell-w)');
    expect(pane.querySelector('[data-addr="C12"]')).toBeNull();
    expect((pane.querySelector('[data-addr="B11"]') as HTMLElement).style.width).toContain('3 * var(--mc-cell-w)');
  });
});

describe('BUG-19 홈 문서 스크롤바', () => {
  it('월마감이 떠 있는 문서의 뷰포트 스크롤바(body 우선, html)를 12px 각진 모양으로 덮는다(공유 globals.css 무수정)', () => {
    const css = readFileSync(join(process.cwd(), 'src/app/monthly-close/monthly-close.css'), 'utf8');
    // 크롬은 뷰포트 스크롤바 모양을 <body>에서 먼저 찾는다 → body 선택자가 꼭 있어야 한다(실기 확인: 4px → 12px)
    expect(css).toMatch(/body:has\(\.mc-root\)::-webkit-scrollbar\s*\{[^}]*width:\s*12px/);
    expect(css).toMatch(/html:has\(\.mc-root\)::-webkit-scrollbar,/);
    expect(css).toMatch(/body:has\(\.mc-root\)::-webkit-scrollbar-thumb\s*\{[^}]*border-radius:\s*0/);
  });
});
