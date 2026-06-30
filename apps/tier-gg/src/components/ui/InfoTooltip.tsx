'use client';

import * as React from 'react';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface InfoTooltipProps {
  content: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
  iconSize?: number;
  className?: string;
}

const TOOLTIP_ID_PREFIX = 'info-tooltip-';
const VIEWPORT_PADDING = 8;
const TOOLTIP_OFFSET = 6;
const MAX_TOOLTIP_WIDTH = 280;

interface TooltipPosition {
  top: number;
  left: number;
}

function computePosition(
  triggerRect: DOMRect,
  tooltipWidth: number,
  tooltipHeight: number,
  preferredSide: InfoTooltipProps['side'],
): TooltipPosition {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // 각 side별 top/left 계산
  function calcForSide(s: NonNullable<InfoTooltipProps['side']>): TooltipPosition {
    let top = 0;
    let left = 0;

    switch (s) {
      case 'top':
        top = triggerRect.top - tooltipHeight - TOOLTIP_OFFSET;
        left = triggerRect.left + triggerRect.width / 2 - tooltipWidth / 2;
        break;
      case 'bottom':
        top = triggerRect.bottom + TOOLTIP_OFFSET;
        left = triggerRect.left + triggerRect.width / 2 - tooltipWidth / 2;
        break;
      case 'left':
        top = triggerRect.top + triggerRect.height / 2 - tooltipHeight / 2;
        left = triggerRect.left - tooltipWidth - TOOLTIP_OFFSET;
        break;
      case 'right':
        top = triggerRect.top + triggerRect.height / 2 - tooltipHeight / 2;
        left = triggerRect.right + TOOLTIP_OFFSET;
        break;
    }

    return { top, left };
  }

  function fits(s: NonNullable<InfoTooltipProps['side']>): boolean {
    const { top, left } = calcForSide(s);
    return (
      top >= VIEWPORT_PADDING &&
      left >= VIEWPORT_PADDING &&
      top + tooltipHeight <= vh - VIEWPORT_PADDING &&
      left + tooltipWidth <= vw - VIEWPORT_PADDING
    );
  }

  // 선호 side → flip pair → 나머지 side 순서로 시도
  const flipMap: Record<NonNullable<InfoTooltipProps['side']>, NonNullable<InfoTooltipProps['side']>> = {
    top: 'bottom',
    bottom: 'top',
    left: 'right',
    right: 'left',
  };
  const allSides: NonNullable<InfoTooltipProps['side']>[] = ['top', 'bottom', 'left', 'right'];
  const preferred = preferredSide ?? 'top';
  const flipped = flipMap[preferred];
  const orderedSides = [
    preferred,
    flipped,
    ...allSides.filter((s) => s !== preferred && s !== flipped),
  ];

  let chosen: NonNullable<InfoTooltipProps['side']> | null = null;
  for (const s of orderedSides) {
    if (fits(s)) {
      chosen = s;
      break;
    }
  }

  // 어떤 side도 안 맞으면 선호 side로 계산 후 clamp
  const { top: rawTop, left: rawLeft } = calcForSide(chosen ?? preferred);

  const clampedLeft = Math.max(
    VIEWPORT_PADDING,
    Math.min(rawLeft, vw - tooltipWidth - VIEWPORT_PADDING),
  );
  const clampedTop = Math.max(
    VIEWPORT_PADDING,
    Math.min(rawTop, vh - tooltipHeight - VIEWPORT_PADDING),
  );

  return { top: clampedTop, left: clampedLeft };
}

export function InfoTooltip({
  content,
  side = 'top',
  iconSize = 12,
  className,
}: InfoTooltipProps) {
  const [visible, setVisible] = React.useState(false);
  const [tooltipStyle, setTooltipStyle] = React.useState<React.CSSProperties>({});
  const id = React.useId();
  const tooltipId = `${TOOLTIP_ID_PREFIX}${id.replace(/:/g, '')}`;
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const tooltipRef = React.useRef<HTMLSpanElement>(null);
  const isTouchRef = React.useRef(false);

  // 툴팁 위치 계산 함수 (DOM 측정 후 state 업데이트)
  const updatePosition = React.useCallback(() => {
    if (!buttonRef.current || !tooltipRef.current) return;
    const triggerRect = buttonRef.current.getBoundingClientRect();
    const tooltipEl = tooltipRef.current;
    const tooltipWidth = Math.min(tooltipEl.offsetWidth || MAX_TOOLTIP_WIDTH, MAX_TOOLTIP_WIDTH);
    const tooltipHeight = tooltipEl.offsetHeight || 40;

    const { top, left } = computePosition(triggerRect, tooltipWidth, tooltipHeight, side);
    setTooltipStyle({ top, left });
  }, [side]);

  // visible 상태 변화 시 위치 계산
  React.useLayoutEffect(() => {
    if (visible) {
      // 첫 렌더 시에는 숨긴 상태에서 크기를 측정한 뒤 위치를 계산
      updatePosition();
    }
  }, [visible, updatePosition]);

  // resize / scroll 시 재계산 또는 숨김
  React.useEffect(() => {
    if (!visible) return;
    function handleResize() {
      updatePosition();
    }
    function handleScroll() {
      updatePosition();
    }
    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true, capture: true });
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll, { capture: true });
    };
  }, [visible, updatePosition]);

  // 바깥 클릭 시 닫힘 (모바일 tap-outside)
  React.useEffect(() => {
    if (!visible) return;
    function handlePointerDown(e: PointerEvent) {
      if (
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node) &&
        tooltipRef.current &&
        !tooltipRef.current.contains(e.target as Node)
      ) {
        setVisible(false);
      }
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [visible]);

  // 데스크톱: hover 핸들러
  function handleMouseEnter() {
    if (isTouchRef.current) return;
    setVisible(true);
  }
  function handleMouseLeave() {
    if (isTouchRef.current) return;
    setVisible(false);
  }

  // 키보드 a11y: focus/blur
  function handleFocus() {
    setVisible(true);
  }
  function handleBlur() {
    setVisible(false);
  }

  // 모바일: touch tap 토글
  function handleTouchStart() {
    isTouchRef.current = true;
  }
  function handleClick(e: React.MouseEvent) {
    if (!isTouchRef.current) return;
    e.stopPropagation();
    setVisible((prev) => !prev);
  }

  return (
    <span
      className={cn('relative inline-flex items-center', className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-label="More info"
        aria-describedby={visible ? tooltipId : undefined}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onClick={handleClick}
        className="inline-flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-accent)] rounded-sm"
      >
        <Info size={iconSize} aria-hidden="true" />
      </button>

      {visible && (
        <span
          ref={tooltipRef}
          id={tooltipId}
          role="tooltip"
          style={{
            position: 'fixed',
            zIndex: 9999,
            pointerEvents: 'none',
            width: 'max-content',
            maxWidth: MAX_TOOLTIP_WIDTH,
            ...tooltipStyle,
          }}
        >
          <span
            className={cn(
              'block rounded-md px-3 py-2 text-xs leading-snug',
              'bg-[var(--color-bg-inverted,#1a1a1a)] text-[var(--color-text-inverted,#f5f5f5)]',
              'dark:bg-[#2a2a2a] dark:text-[#f0f0f0]',
              'drop-shadow-md',
              'w-max whitespace-pre-line',
            )}
            style={{ maxWidth: MAX_TOOLTIP_WIDTH }}
          >
            {content}
          </span>
        </span>
      )}
    </span>
  );
}
