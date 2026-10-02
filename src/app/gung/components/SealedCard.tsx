/**
 * §5-7 SealedCard — 핵심 프라이버시 컴포넌트(§10-1 동작 규약).
 *
 * 이 컴포넌트는 "열림 여부"를 소유하지 않는다(props 만). 400ms 홀드 임계값·pointer capture·
 * visibilitychange 즉시 봉인 같은 **타이밍/이벤트 로직은 상위 훅(`lib/useHoldReveal.ts`, 페이지개발자)**이
 * 담당하고, 여기서는 `open` 불리언과 `pressBind`(그대로 꽂는 이벤트 핸들러 묶음)만 받는다.
 * 보안 요구사항(D4: "봉인 상태에서는 비밀 텍스트를 DOM에 렌더하지 않는다")은 이 컴포넌트가 직접 보장한다 —
 * `open=false`면 `renderContent()`를 호출조차 하지 않는다(조건부 렌더).
 *
 * PM 피드백(쪽 나눔 폐지): 예전엔 160자 단위로 "다음 쪽 ›" 넘김이 있었으나 "몇 번째를 보는지 모르겠다"는
 * 불만이 커 전부 없앴다 — 누르는 동안 섹션 전체를 한 장으로 보여준다(§useSealFit).
 *  1) 지금 자리에서 다 보이면 글자를 단계적으로 줄여(최소 14px) 맞춘다 — 화면은 움직이지 않는다.
 *  2) 그래도 안 들어오면 카드를 헤더 바로 밑까지 끌어올려(페이지 스크롤) 자리를 넓힌다.
 *  3) 그래도 넘치면(비밀처럼 원문이 아주 긴 경우) **누른 채로 손가락을 위로 밀면** 아래가 올라온다(§useHoldDrag).
 *     꾹(hold)은 touch-action:none 이라 브라우저 스크롤이 안 되므로 손가락 이동을 직접 스크롤로 옮긴다.
 *     화면 아래(탭바 위)에 「누른 채로 위로 밀면 아래가 보여요」 표시가 떠서 더 있다는 걸 알린다.
 *  손을 떼면(봉인) 스크롤도 연 직전 자리로 되돌린다 — 닫힌 화면은 내용 길이와 무관하게 늘 같다(D3).
 * D3(QA BUG-01)는 그대로 유지: 봉인면엔 쪽 수·칩·길이 단서가 전혀 없다.
 */
import { Hand } from 'lucide-react';
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode, RefObject } from 'react';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { PressBind, SealMode } from './types';

/** 단계적 축소 — 1(기본) → … → 14/17(본문 17px 기준 최소 14px, §10-2 규약) */
export const FIT_STEPS = [1, 0.95, 0.9, 0.85, 14 / 17];
/** 카드와 화면 가장자리(헤더 밑·탭바 위) 사이 숨 쉴 틈 */
const EDGE_GAP_PX = 8;
/** 꾹 누른 채 손가락 1px 이동 → 내용 2px 이동(엄지 이동 거리만으로 긴 비밀 끝까지 닿도록) */
export const DRAG_GAIN = 2;

type Scroller = { scrollBy: (x: number, y: number) => void; scrollTo: (x: number, y: number) => void; getTop: () => number };

/** 실제로 스크롤되는 조상(없으면 창) — 지금 /gung 은 창이 스크롤된다(.gu-frame min-height:100dvh) */
function scrollerOf(el: HTMLElement | null): Scroller {
  for (let p = el?.parentElement ?? null; p; p = p.parentElement) {
    const oy = getComputedStyle(p).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight + 1) {
      const box = p;
      return { scrollBy: (x, y) => box.scrollBy(x, y), scrollTo: (x, y) => box.scrollTo(x, y), getTop: () => box.scrollTop };
    }
  }
  return { scrollBy: (x, y) => window.scrollBy(x, y), scrollTo: (x, y) => window.scrollTo(x, y), getTop: () => window.scrollY };
}

/** 지금 눈에 보이는 세로 띠 — 위는 sticky 헤더 밑, 아래는 sticky 액션바·탭바 위(없으면 화면 끝) */
function visibleBand(from: HTMLElement): { top: number; bottom: number } {
  const vh = window.visualViewport?.height ?? window.innerHeight ?? 0;
  const frame = from.closest('.gu-frame') ?? document;
  const header = frame.querySelector('.gu-header');
  let top = header ? Math.max(0, header.getBoundingClientRect().bottom) : 0;
  let bottom = vh;
  const fromTop = from.getBoundingClientRect().top;
  for (const sel of ['.gu-tabbar', '.gu-actionbar-wrap']) {
    const el = frame.querySelector(sel);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (r.height > 0 && r.top > fromTop && r.top < bottom) bottom = r.top;
  }
  if (top >= bottom) top = 0;
  return { top, bottom };
}

/**
 * 꾹 열린 섹션 전체가 한 장으로 보이도록 — (1) 글자 단계 축소 → (2) 카드 끌어올리기 → (3) 그래도 넘치면 more=true.
 * 닫히면 scale 1, 스크롤은 연 직전 자리로.
 */
function useSealFit(open: boolean) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [more, setMore] = useState<{ top: number } | null>(null);
  const restoreRef = useRef<{ scroller: Scroller; top: number } | null>(null);
  const widthRef = useRef(0);

  const updateMore = useCallback(() => {
    const paper = paperRef.current;
    if (!paper || typeof window === 'undefined') return;
    const band = visibleBand(paper);
    const bottom = paper.getBoundingClientRect().bottom;
    setMore(bottom > band.bottom - EDGE_GAP_PX + 1 ? { top: band.bottom } : null);
  }, []);

  const measure = useCallback(() => {
    const paper = paperRef.current;
    const measureEl = measureRef.current;
    if (!paper || !measureEl || typeof window === 'undefined') return;
    const band = visibleBand(paper);
    const paperRect = paper.getBoundingClientRect();
    const openEl = paper.parentElement;
    // 카드 밑 꼬리(「손을 떼면 바로 가려져요」 줄·탭 진행바)와 종이 안쪽 여백 — 글자 크기와 무관한 고정 몫
    const tail = openEl ? Math.max(0, openEl.getBoundingClientRect().bottom - paperRect.bottom) : 0;
    paper.style.setProperty('--gu-seal-scale', '1');
    const chrome = Math.max(0, paper.getBoundingClientRect().height - measureEl.scrollHeight);
    const heightAt = (step: number) => {
      paper.style.setProperty('--gu-seal-scale', String(step));
      return measureEl.scrollHeight + chrome + tail;
    };
    const availHere = band.bottom - EDGE_GAP_PX - paperRect.top;
    const liftRoom = Math.max(0, paperRect.top - (band.top + EDGE_GAP_PX));

    let picked = FIT_STEPS[FIT_STEPS.length - 1];
    let lift = 0;
    const fitsHere = FIT_STEPS.find((s) => heightAt(s) <= availHere);
    if (fitsHere !== undefined) {
      picked = fitsHere;
    } else {
      const fitsLifted = FIT_STEPS.find((s) => heightAt(s) <= availHere + liftRoom);
      picked = fitsLifted ?? FIT_STEPS[FIT_STEPS.length - 1];
      lift = Math.min(liftRoom, Math.max(0, heightAt(picked) - availHere));
    }
    paper.style.setProperty('--gu-seal-scale', String(picked));
    setScale(picked);
    if (lift > 0) scrollerOf(surfaceRef.current).scrollBy(0, Math.round(lift));
    updateMore();
  }, [updateMore]);

  useLayoutEffect(() => {
    if (!open) {
      setScale(1);
      setMore(null);
      // 손을 떼면 연 직전 스크롤 자리로 — 끌어올림·밀어 읽기 흔적이 닫힌 화면에 남지 않게(내용 길이 비노출)
      const r = restoreRef.current;
      restoreRef.current = null;
      if (r && r.scroller.getTop() !== r.top) r.scroller.scrollTo(0, r.top);
      return;
    }
    if (typeof window === 'undefined') return;
    const scroller = scrollerOf(surfaceRef.current);
    restoreRef.current = { scroller, top: scroller.getTop() };
    widthRef.current = window.innerWidth;
    measure();
    // 주소창이 접혔다 펴지는 세로 변화엔 다시 맞추지 않는다(읽는 도중 글자가 튀지 않게) — 표시만 갱신
    const onResize = () => {
      if (window.innerWidth !== widthRef.current) {
        widthRef.current = window.innerWidth;
        measure();
      } else updateMore();
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', updateMore, { capture: true, passive: true });
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', updateMore, { capture: true });
    };
  }, [open, measure, updateMore]);

  return { surfaceRef, paperRef, measureRef, scale, more };
}

/** 꾹(hold) 누른 채 손가락을 위아래로 밀면 내용이 따라 움직인다 — touch-action:none 이라 브라우저 스크롤 대신 직접 */
function useHoldDrag(open: boolean, mode: SealMode, surfaceRef: RefObject<HTMLDivElement>) {
  const lastY = useRef<number | null>(null);
  useLayoutEffect(() => {
    lastY.current = null; // 열릴 때마다 기준점 새로(이전 누름의 손가락 위치를 끌고 오지 않게)
  }, [open]);
  return useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (!open || mode !== 'hold' || e.isPrimary === false) return;
      if (e.pointerType === 'mouse' && e.buttons === 0) return;
      const y = e.clientY;
      if (lastY.current === null) {
        lastY.current = y;
        return;
      }
      const dy = lastY.current - y;
      lastY.current = y;
      if (dy !== 0) scrollerOf(surfaceRef.current).scrollBy(0, dy * DRAG_GAIN);
    },
    [open, mode, surfaceRef],
  );
}

export interface SealedCardProps {
  /** 열림 여부 — 상위가 제어 */
  open: boolean;
  seatLabel: string;
  mode: SealMode;
  renderContent: () => ReactNode;
  /** 열린 상태 우상단 워터마크(예: "3번 · 22:41") — 캡처 유포 억제(§10-1) */
  watermark?: string;
  pressBind?: PressBind;
  /** 누르는 동안 낙관 둘레 금빛 링 진행도 0..1(§4-4) */
  holdProgress?: number;
  /** 탭 모드 15초 자동 봉인 — 남은 시간 표시용(ms) */
  tapRemainingMs?: number;
  tapTotalMs?: number;
  ariaLabel?: string;
  /** 스크린리더 보조 설명(§11): "주변에 아무도 없을 때 이어폰으로 확인하세요" 등 */
  srHint?: string;
  className?: string;
}

export function SealedCard({
  open,
  seatLabel,
  mode,
  renderContent,
  watermark,
  pressBind,
  holdProgress = 0,
  tapRemainingMs,
  tapTotalMs,
  ariaLabel,
  srHint,
  className,
}: SealedCardProps) {
  const describedId = srHint ? `${seatLabel.replace(/\s+/g, '-')}-gu-hint` : undefined;
  const tapPct = tapTotalMs && tapRemainingMs !== undefined ? Math.max(0, Math.min(1, tapRemainingMs / tapTotalMs)) : undefined;
  const { surfaceRef, paperRef, measureRef, scale, more } = useSealFit(open);
  const onDragMove = useHoldDrag(open, mode, surfaceRef);

  return (
    <div className={['gu-sealed', className ?? ''].filter(Boolean).join(' ')} data-open={open || undefined}>
      <div
        {...pressBind}
        ref={surfaceRef}
        role="button"
        tabIndex={0}
        aria-pressed={open}
        aria-label={ariaLabel ?? `${seatLabel} — 비밀 정보. ${mode === 'hold' ? '길게 누르는 동안 표시' : '탭하면 잠시 표시'}`}
        aria-describedby={describedId}
        className="gu-sealed-surface"
        data-mode={mode}
        onPointerMove={onDragMove}
        onContextMenu={(e) => {
          e.preventDefault();
          pressBind?.onContextMenu?.(e);
        }}
      >
        {!open ? (
          <div className="gu-sealed-closed">
            <span className="gu-sealed-mark" style={{ ['--gu-hold-progress' as string]: holdProgress }} aria-hidden>
              봉
            </span>
            <p className="gu-sealed-hint">
              <Hand aria-hidden size={18} />
              {mode === 'hold' ? '꾹 누르고 있으면 보여요' : '탭하면 보여요'}
            </p>
            <p className="gu-sealed-sub">{seatLabel}</p>
          </div>
        ) : (
          <div className="gu-sealed-open">
            {watermark && (
              <span className="gu-sealed-watermark" aria-hidden>
                {watermark}
              </span>
            )}
            <div className="gu-sealed-paper" ref={paperRef} style={{ ['--gu-seal-scale' as string]: scale } as CSSProperties}>
              <div className="gu-sealed-paper-measure" ref={measureRef}>
                {renderContent()}
              </div>
            </div>
            <p className="gu-sealed-release">{mode === 'hold' ? '✋ 손을 떼면 바로 가려져요' : tapPct !== undefined ? `탭으로 열림 · 남음 ${Math.ceil((tapRemainingMs ?? 0) / 1000)}초` : '다시 탭하면 가려져요'}</p>
            {tapPct !== undefined && (
              <span className="gu-sealed-tapbar" aria-hidden>
                <span className="gu-sealed-tapbar-fill" style={{ width: `${tapPct * 100}%` }} />
              </span>
            )}
            {/* 아래가 화면 밖에 남아 있을 때만 — 탭바 바로 위에 고정. 내용이 DOM 에 다 있으니 스크린리더엔 불필요 */}
            {more && (
              <p className="gu-sealed-more" style={{ top: more.top }} aria-hidden>
                {mode === 'hold' ? '▲ 누른 채로 위로 밀면 아래가 보여요' : '▲ 위로 밀면 아래가 더 있어요'}
              </p>
            )}
          </div>
        )}
      </div>
      {srHint && (
        <span id={describedId} className="gu-sr">
          {srHint}
        </span>
      )}
    </div>
  );
}
