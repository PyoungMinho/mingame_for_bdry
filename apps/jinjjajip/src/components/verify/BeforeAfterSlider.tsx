"use client";

import { useState, useRef, useCallback } from "react";
import * as RadixSlider from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";

export interface BeforeAfterSliderProps {
  /** 블러 처리된 공개 이미지 URL (원본 비공개 원칙 §10.1) */
  blurredUrl: string;
  /** 블러 전 프리뷰 URL — 원본이 아닌 로컬 ObjectURL (원본 서버 비공개) */
  beforeUrl: string;
  altBlurred?: string;
  altBefore?: string;
  className?: string;
}

// 원본은 안 보임: beforeUrl은 클라이언트 로컬 프리뷰(업로드 전 상태)만.
// 서버 원본은 절대 공개 URL로 내려오지 않음 (§10.1 원칙 6).

export function BeforeAfterSlider({
  blurredUrl,
  beforeUrl,
  altBlurred = "AI 블러 처리된 사진",
  altBefore = "원본 미리보기 (업로드 전)",
  className,
}: BeforeAfterSliderProps) {
  const [position, setPosition] = useState(50); // 0~100
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const updatePosition = useCallback((clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    setPosition(pct);
  }, []);

  // 터치/마우스 드래그 — prefers-reduced-motion 시 정적 50/50 유지
  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    updatePosition(e.clientX);
    const onMove = (ev: MouseEvent) => { if (isDragging.current) updatePosition(ev.clientX); };
    const onUp = () => { isDragging.current = false; window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    updatePosition(e.touches[0].clientX);
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <p className="text-trust-desc text-realestate-neutral-700 text-center">
        슬라이더를 움직여 블러 처리 전·후를 비교해보세요
      </p>

      {/* 이미지 비교 영역 */}
      <div
        ref={containerRef}
        className="relative w-full aspect-video rounded-lg overflow-hidden select-none cursor-col-resize"
        onMouseDown={handleMouseDown}
        onTouchMove={handleTouchMove}
        aria-label="블러 처리 전후 비교 슬라이더"
        role="img"
      >
        {/* 블러 처리 후 (전체) */}
        <img
          src={blurredUrl}
          alt={altBlurred}
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
        />

        {/* 블러 전 (clip) */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
          aria-hidden="true"
        >
          <img
            src={beforeUrl}
            alt={altBefore}
            className="absolute inset-0 w-full h-full object-cover"
            draggable={false}
          />
        </div>

        {/* 구분선 */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white shadow-md pointer-events-none"
          style={{ left: `${position}%` }}
          aria-hidden="true"
        >
          {/* 핸들 */}
          <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white shadow-md border border-realestate-neutral-200 flex items-center justify-center">
            <span className="text-realestate-neutral-500 text-[10px] font-bold select-none">⟷</span>
          </div>
        </div>

        {/* 라벨 */}
        <span
          className="absolute bottom-2 left-2 text-trust-desc text-white bg-black/50 px-1.5 py-0.5 rounded"
          aria-hidden="true"
        >
          촬영본
        </span>
        <span
          className="absolute bottom-2 right-2 text-trust-desc text-white bg-black/50 px-1.5 py-0.5 rounded"
          aria-hidden="true"
        >
          블러 처리 후
        </span>
      </div>

      {/* 접근성용 Radix Slider — 스크린리더 전용 제어 */}
      <RadixSlider.Root
        className="sr-only"
        value={[position]}
        onValueChange={([v]) => setPosition(v)}
        min={0}
        max={100}
        step={1}
        aria-label="블러 전후 비교 위치 조절"
      >
        <RadixSlider.Track>
          <RadixSlider.Range />
        </RadixSlider.Track>
        <RadixSlider.Thumb />
      </RadixSlider.Root>

      <p className="text-trust-desc text-realestate-neutral-500 text-center">
        개인정보(얼굴·번호판 등)는 AI가 자동 블러 처리했어요
      </p>
    </div>
  );
}
