// @vitest-environment jsdom
/**
 * §5-7 SealedCard 자동 맞춤(§useSealFit) + 누른 채 밀어 읽기(§useHoldDrag) — 쪽 나눔 폐지 뒤
 * "열린 섹션 전체를 한 장으로" 보여 주는 로직의 단위 테스트.
 * jsdom은 레이아웃을 계산하지 않으므로 종이(.gu-sealed-paper) 위치·높이와 창 스크롤을 흉내 낸다:
 *   - 종이 top = paperTop0 - scrollY (창이 스크롤되면 같이 올라간다)
 *   - 내용 높이 = baseHeight × 현재 --gu-seal-scale (글자를 줄이면 비례해 줄어든다)
 * 실제 브라우저 실측(375×812·320×640·375×667, 터치 꾹 + 밀기)은 QA 실행자가 헤드리스 Chrome CDP 로 따로 했다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { DRAG_GAIN, FIT_STEPS, SealedCard } from './SealedCard';

const FIT_FLOOR = FIT_STEPS[FIT_STEPS.length - 1];
const VH = 812;
let scrollY = 0;
let scrollBy: ReturnType<typeof vi.fn<[number, number], void>>;
let scrollTo: ReturnType<typeof vi.fn<[number, number], void>>;

function rect(top: number, height: number) {
  return { top, bottom: top + height, left: 0, right: 0, width: 0, height, x: 0, y: top, toJSON() {} };
}

/** baseHeight = scale 1 일 때 내용 높이, paperTop0 = 스크롤 0 일 때 종이 위쪽 */
function mockLayout(baseHeight: number, paperTop0: number) {
  const contentH = (paper: HTMLElement | null) => baseHeight * (paper ? parseFloat(paper.style.getPropertyValue('--gu-seal-scale') || '1') : 1);
  Object.defineProperty(window.HTMLElement.prototype, 'scrollHeight', {
    configurable: true,
    get(this: HTMLElement) {
      return this.classList.contains('gu-sealed-paper-measure') ? contentH(this.parentElement) : 0;
    },
  });
  Object.defineProperty(window.HTMLElement.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: function (this: HTMLElement) {
      if (this.classList.contains('gu-sealed-paper')) return rect(paperTop0 - scrollY, contentH(this));
      if (this.classList.contains('gu-sealed-open')) {
        const paper = this.querySelector<HTMLElement>('.gu-sealed-paper');
        return rect(paperTop0 - scrollY, paper ? contentH(paper) : 0);
      }
      if (this.classList.contains('gu-tabbar')) return rect(VH - 60, 60);
      return rect(0, 0);
    },
  });
}

beforeEach(() => {
  scrollY = 0;
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: VH });
  scrollBy = vi.fn((_x: number, y: number) => {
    scrollY += y;
  });
  scrollTo = vi.fn((_x: number, y: number) => {
    scrollY = y;
  });
  Object.defineProperty(window, 'scrollBy', { configurable: true, writable: true, value: scrollBy });
  Object.defineProperty(window, 'scrollTo', { configurable: true, writable: true, value: scrollTo });
  Object.defineProperty(window, 'scrollY', { configurable: true, get: () => scrollY });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const paperScale = () => document.querySelector<HTMLElement>('.gu-sealed-paper')!.style.getPropertyValue('--gu-seal-scale');
const more = () => document.querySelector<HTMLElement>('.gu-sealed-more');
const surface = () => document.querySelector<HTMLElement>('.gu-sealed-surface')!;
/** jsdom 엔 PointerEvent 가 없어 clientY 가 안 실린다 — MouseEvent 로 'pointermove' 를 만들고 터치 속성을 덧붙인다 */
function move(clientY: number) {
  const ev = new MouseEvent('pointermove', { bubbles: true, cancelable: true, clientY, buttons: 1 });
  Object.defineProperty(ev, 'pointerType', { value: 'touch' });
  Object.defineProperty(ev, 'isPrimary', { value: true });
  act(() => {
    surface().dispatchEvent(ev);
  });
}
const card = (open: boolean, mode: 'hold' | 'tap' = 'hold', renderContent = () => <p>글</p>) => <SealedCard open={open} seatLabel="1번 자리의 패" mode={mode} renderContent={renderContent} />;

describe('SealedCard §useSealFit — 쪽 나눔 폐지 뒤 한 장으로', () => {
  it('짧은 섹션 — 그대로(scale 1), 화면도 안 움직이고 「더 있음」 표시 없음', () => {
    mockLayout(300, 200); // 지금 자리 여유 = 812-8-200 = 604
    render(card(true));
    expect(paperScale()).toBe('1');
    expect(scrollBy).not.toHaveBeenCalled();
    expect(more()).toBeNull();
  });

  it('탭바(sticky)가 있으면 그 위까지만 보이는 자리로 친다 — 탭바에 가려지는 줄을 「들어간다」고 착각하지 않는다', () => {
    mockLayout(560, 200); // 탭바 없으면 여유 604 → scale 1. 탭바(752) 있으면 752-8-200=544 → 1(560) X, .95(532) O
    render(
      <div className="gu-frame">
        {card(true)}
        <nav className="gu-tabbar" />
      </div>,
    );
    expect(paperScale()).toBe('0.95');
  });

  it('조금 길면 — 지금 자리에서 맞는 가장 큰 단계(0.9)를 고르고 화면은 그대로', () => {
    mockLayout(650, 200); // 1→650 .95→617.5 .9→585(O)
    render(card(true));
    expect(paperScale()).toBe('0.9');
    expect(scrollBy).not.toHaveBeenCalled();
    expect(more()).toBeNull();
  });

  it('최소(14px)까지 줄여 지금 자리에 맞으면 — 끌어올리지 않는다', () => {
    mockLayout(720, 200); // floor → 592.9 ≤ 604
    render(card(true));
    expect(Number(paperScale())).toBeCloseTo(FIT_FLOOR, 4);
    expect(scrollBy).not.toHaveBeenCalled();
  });

  it('지금 자리엔 최소 글자로도 안 들어오면 — 카드를 필요한 만큼만 끌어올리고(스크롤) 그 자리에서 맞는 가장 큰 글자를 쓴다', () => {
    mockLayout(600, 400); // 지금 여유 404, 끌어올릴 수 있는 몫 392 → 796 안에 scale 1(600) 이 들어간다
    render(card(true));
    expect(paperScale()).toBe('1');
    expect(scrollBy).toHaveBeenCalledTimes(1);
    expect(scrollBy.mock.calls[0][1]).toBe(600 - 404);
    expect(more()).toBeNull();
  });

  it('비밀처럼 아주 길면 — 최소 글자 + 끝까지 끌어올림 + 탭바 위에 「누른 채로 위로 밀면」 표시(hold)', () => {
    mockLayout(3000, 400);
    render(card(true));
    expect(Number(paperScale())).toBeCloseTo(FIT_FLOOR, 4);
    expect(scrollBy.mock.calls[0][1]).toBe(392);
    expect(more()).not.toBeNull();
    expect(more()!.textContent).toMatch(/누른 채로 위로 밀면/);
  });

  it('탭 모드에서 길면 — 같은 표시지만 「누른 채로」는 빼고 안내(손을 떼고 스크롤 가능)', () => {
    mockLayout(3000, 400);
    render(card(true, 'tap'));
    expect(more()).not.toBeNull();
    expect(more()!.textContent).not.toMatch(/누른 채로/);
    expect(more()!.textContent).toMatch(/위로 밀면/);
  });

  it('누른 채로 손가락을 위로 밀면(hold) 내용이 따라 올라간다 — 손가락 이동 × DRAG_GAIN 만큼 스크롤', () => {
    mockLayout(3000, 400);
    render(card(true));
    scrollBy.mockClear();
    move(500); // 기준점
    move(440); // 60px 위로
    move(470); // 30px 되돌림
    expect(scrollBy.mock.calls.map((c) => c[1])).toEqual([60 * DRAG_GAIN, -30 * DRAG_GAIN]);
  });

  it('끝까지 밀어 종이 바닥이 보이면 「더 있음」 표시가 사라진다', () => {
    mockLayout(1000, 400); // floor 823.5 + 끌어올림 392 → 아직 넘침
    render(card(true));
    expect(more()).not.toBeNull();
    move(600);
    move(400); // +400px 스크롤
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });
    expect(more()).toBeNull();
  });

  it('밀어 읽기는 hold 에서만 — tap(브라우저 기본 스크롤)·봉인 상태에선 손가락 이동을 스크롤로 옮기지 않는다', () => {
    mockLayout(3000, 400);
    const { rerender } = render(card(true, 'tap'));
    scrollBy.mockClear();
    move(500);
    move(400);
    expect(scrollBy).not.toHaveBeenCalled();
    rerender(card(false, 'hold'));
    move(500);
    move(400);
    expect(scrollBy).not.toHaveBeenCalled();
  });

  it('손을 떼면(봉인) — 스크롤을 연 직전 자리로 되돌리고, scale 1·표시 없음(닫힌 화면에 내용 길이 흔적이 안 남는다)', () => {
    mockLayout(3000, 400);
    scrollY = 37; // 연 직전 사용자가 조금 내려 둔 자리
    const { rerender } = render(card(true));
    move(500);
    move(300);
    expect(scrollY).toBeGreaterThan(37);
    act(() => {
      rerender(card(false));
    });
    expect(scrollY).toBe(37);
    expect(document.querySelector('.gu-sealed-paper')).toBeNull();
    expect(more()).toBeNull();
  });

  it('봉인 상태(open=false)에서는 renderContent 를 호출하지 않는다 — D4 비노출 그대로', () => {
    const spy = vi.fn(() => <p>비밀</p>);
    mockLayout(100, 200);
    render(card(false, 'hold', spy));
    expect(spy).not.toHaveBeenCalled();
    expect(document.querySelector('.gu-sealed-paper')).toBeNull();
  });

  it('쪽 칩(gu-sealed-pager)·「다음 쪽」은 어디에도 없다 — D3(QA BUG-01) 재확인', () => {
    mockLayout(3000, 400);
    render(card(true));
    expect(document.querySelector('.gu-sealed-pager')).toBeNull();
    expect(document.body.textContent).not.toMatch(/다음 쪽|\d+\s*\/\s*\d+/);
  });

  it('hold 모드 surface 는 data-mode="hold"(touch-action:none 전용 CSS 훅) · tap 은 "tap"', () => {
    mockLayout(100, 200);
    const { rerender } = render(card(false, 'hold'));
    expect(surface()).toHaveAttribute('data-mode', 'hold');
    rerender(card(false, 'tap'));
    expect(surface()).toHaveAttribute('data-mode', 'tap');
  });
});
