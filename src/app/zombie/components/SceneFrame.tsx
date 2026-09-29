'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { CHAPTERS, LOCATIONS } from '@/lib/zombie/contract';
import type { ChapterId, LocationId, SceneId } from '@/lib/zombie/types';
import { SceneArt } from '../scenes';

export type FrameFx = 'hit' | 'shock' | 'infect' | null;

/**
 * 씬 아트 액자. 스캔라인·비네트·필름그레인은 CSS 로 덧씌우고,
 * 체력 낮음(붉은 맥동)·감염(녹색 번짐)·정신력 낮음(글리치)은 상태에 따라 켜진다.
 * fx 는 결과가 나오는 순간의 1회성 연출(피격 흔들림·충격 글리치·감염 번짐)이며 fxKey 로 재생된다.
 */
export function SceneFrame({
  scene,
  label,
  chapter,
  location,
  hpLow,
  mentalLow,
  infected,
  fx,
  fxKey,
  children,
}: {
  scene: SceneId;
  label: string;
  chapter?: ChapterId;
  location?: LocationId;
  hpLow?: boolean;
  mentalLow?: boolean;
  infected?: boolean;
  fx?: FrameFx;
  fxKey?: string | number;
  children?: ReactNode;
}) {
  const frame = useRef<HTMLElement>(null);

  // 피격·충격 흔들림 — CSS 입장 애니메이션과 충돌하지 않게 Web Animations API 로 액자 전체를 흔든다
  useEffect(() => {
    const el = frame.current;
    if (!el || (fx !== 'hit' && fx !== 'shock') || typeof el.animate !== 'function') return;
    try {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    } catch {
      /* 무시 */
    }
    const amp = fx === 'hit' ? 9 : 5;
    el.animate(
      [
        { transform: 'translate(0, 0)' },
        { transform: `translate(${-amp}px, ${amp / 3}px) rotate(-0.6deg)` },
        { transform: `translate(${amp}px, ${-amp / 3}px) rotate(0.5deg)` },
        { transform: `translate(${-amp / 2}px, 0)` },
        { transform: `translate(${amp / 3}px, 0)` },
        { transform: 'translate(0, 0)' },
      ],
      { duration: 420, easing: 'ease-out' },
    );
  }, [fx, fxKey]);

  return (
    <figure
      ref={frame}
      className="zb-frame"
      data-hp-low={hpLow ? '' : undefined}
      data-mental-low={mentalLow ? '' : undefined}
      data-infected={infected ? '' : undefined}
    >
      <div className="zb-frame-art" key={scene} role="img" aria-label={label}>
        <SceneArt id={scene} />
      </div>
      <div className="zb-frame-fx" aria-hidden />
      {fx && <div className="zb-frame-flash" key={`fx-${fxKey ?? ''}`} data-fx={fx} aria-hidden />}
      <span className="zb-frame-corner" data-c="tl" aria-hidden />
      <span className="zb-frame-corner" data-c="tr" aria-hidden />
      <span className="zb-frame-corner" data-c="bl" aria-hidden />
      <span className="zb-frame-corner" data-c="br" aria-hidden />
      {(chapter || location) && (
        <figcaption className="zb-frame-cap">
          {chapter && (
            <span className="zb-frame-chap">
              CH.{chapter} <b>{CHAPTERS[chapter].name}</b>
            </span>
          )}
          {location && <span className="zb-frame-loc">{LOCATIONS[location].name}</span>}
        </figcaption>
      )}
      {children}
    </figure>
  );
}
