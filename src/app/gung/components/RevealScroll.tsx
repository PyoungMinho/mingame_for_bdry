'use client';

/**
 * §5-19 RevealScroll — 두루마리(상·하 나무축) 사이 한지 타임라인. beat 모드: index까지만 렌더 +
 * 새 항목 자동 스크롤. all 모드: 전부 한 번에(P9 "전체 한 번에 보기"). 본문 탭 = 다음(onNext).
 * 진상의 "범인은…"/도장/판결 같은 전용 비트는 이 컴포넌트가 아니라 화면 레이어가 SealStamp 등으로 구성한다.
 */
import { useEffect, useRef } from 'react';
import type { NightBeat } from './types';

export interface RevealScrollProps {
  beats: NightBeat[];
  /** 'beat' 모드에서 지금까지 공개된 비트 수(0-based 마지막 인덱스) */
  index: number;
  onNext?: () => void;
  mode: 'beat' | 'all';
  className?: string;
}

export function RevealScroll({ beats, index, onNext, mode, className }: RevealScrollProps) {
  const lastRef = useRef<HTMLLIElement>(null);
  // 본문 탭 = 다음 — 더블탭으로 비트 2개가 넘어가지 않게 600ms 재입력 무시(§10-2)
  const tapRef = useRef(0);
  const next = onNext
    ? () => {
        const now = Date.now();
        if (now - tapRef.current < 600) return;
        tapRef.current = now;
        onNext();
      }
    : undefined;
  const visible = mode === 'all' ? beats : beats.slice(0, index + 1);

  useEffect(() => {
    lastRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [visible.length]);

  return (
    <div className={['gu-scroll', className ?? ''].filter(Boolean).join(' ')}>
      <span className="gu-scroll-axle gu-scroll-axle--top" aria-hidden />
      <div
        className="gu-scroll-paper"
        role={next ? 'button' : undefined}
        tabIndex={next ? 0 : undefined}
        onClick={next}
        onKeyDown={
          next
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  next();
                }
              }
            : undefined
        }
        aria-label={next ? '진상 두루마리 — 탭하면 다음' : undefined}
      >
        <ol className="gu-scroll-list">
          {visible.map((b, i) => {
            const isLast = i === visible.length - 1;
            return (
              <li key={i} ref={isLast ? lastRef : undefined} className="gu-scroll-beat" data-new={mode === 'beat' && isLast ? '' : undefined}>
                <span className="gu-scroll-time gu-display">{b.time}</span>
                <p className="gu-scroll-text">{b.text}</p>
              </li>
            );
          })}
        </ol>
      </div>
      <span className="gu-scroll-axle gu-scroll-axle--bottom" aria-hidden />
    </div>
  );
}
