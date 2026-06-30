"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { X, MapPin, ChevronRight } from "lucide-react";
import { Button } from "./Button";
import { FairnessScoreBadge } from "./FairnessScoreBadge";
import type { PlaceCandidate } from "@/lib/moira/route";

export interface PlaceEditSheetProps {
  candidates: PlaceCandidate[];
  /** 현재 선택된 장소의 공평성 점수 */
  currentScore: number;
  onSelect: (candidate: PlaceCandidate) => void;
  onCustomPin: () => void;
  isOpen: boolean;
  onClose: () => void;
}

const RANK_LABEL: Record<"A" | "B" | "C", string> = {
  A: "1순위",
  B: "2순위",
  C: "3순위",
};

const RANK_STYLE: Record<"A" | "B" | "C", string> = {
  A: "bg-moira-brand text-white",
  B: "bg-slate-200 text-slate-700",
  C: "bg-slate-100 text-slate-500",
};

/**
 * 장소 수정 바텀시트 — z-50
 * - 열릴 때 부모(StickyBottomBar)를 숨김(상태는 부모가 관리).
 * - 후보 행 min-h-[52px]: 터치타겟 기준 준수.
 * - 이모지 0 / lucide 아이콘만.
 */
export function PlaceEditSheet({
  candidates,
  currentScore,
  onSelect,
  onCustomPin,
  isOpen,
  onClose,
}: PlaceEditSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  // 열릴 때 포커스 트랩 (접근성)
  useEffect(() => {
    if (isOpen) {
      sheetRef.current?.focus();
    }
  }, [isOpen]);

  // ESC 닫기
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* 딤 오버레이 */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
        aria-hidden
        onClick={onClose}
      />

      {/* 바텀시트 — z-50 */}
      <div
        ref={sheetRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="장소 바꿔보기"
        className={cn(
          "fixed bottom-0 left-1/2 z-50 w-full max-w-[480px] -translate-x-1/2",
          "rounded-t-2xl bg-moira-surface shadow-[0_-4px_24px_rgba(15,23,42,0.12)]",
          "outline-none",
        )}
      >
        {/* 핸들바 */}
        <div className="flex justify-center pt-3 pb-1" aria-hidden>
          <span className="h-1 w-10 rounded-full bg-slate-200" />
        </div>

        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-moira-border">
          <h2 className="text-[16px] font-extrabold text-moira-ink">장소 바꿔보기</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="flex h-8 w-8 items-center justify-center rounded-full text-moira-muted hover:bg-slate-100 cursor-pointer"
          >
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>

        {/* 현재 점수 */}
        <div className="flex items-center gap-2 px-5 pt-3 pb-1">
          <span className="text-[12px] font-semibold text-moira-muted">현재 공평성</span>
          <FairnessScoreBadge prev={currentScore} current={currentScore} animated={false} />
        </div>

        {/* 후보 목록 */}
        <ul className="px-5 py-2 space-y-2">
          {candidates.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(c);
                  onClose();
                }}
                className={cn(
                  // 터치타겟 ≥52px
                  "flex w-full min-h-[52px] items-center gap-3 rounded-xl px-3.5 py-3",
                  "cursor-pointer text-left transition-colors hover:bg-slate-50 active:bg-slate-100",
                  "ring-1 ring-moira-border",
                )}
              >
                {/* 순위 배지 */}
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold",
                    RANK_STYLE[c.rank],
                  )}
                  aria-label={RANK_LABEL[c.rank]}
                >
                  {c.rank}
                </span>

                {/* 장소명 */}
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-bold text-moira-ink truncate">{c.name}</p>
                  <p className="text-[12px] text-moira-muted">{RANK_LABEL[c.rank]}</p>
                </div>

                {/* 점수 변동 미리보기 */}
                <FairnessScoreBadge
                  prev={currentScore}
                  current={c.fairScore}
                  animated={false}
                />

                <ChevronRight size={16} strokeWidth={2.5} className="text-moira-muted shrink-0" />
              </button>
            </li>
          ))}
        </ul>

        {/* 직접 핀 진입 */}
        <div className="px-5 pt-1 pb-4">
          <Button
            variant="outline"
            size="md"
            onClick={() => {
              onCustomPin();
              onClose();
            }}
            leftIcon={<MapPin size={17} strokeWidth={2.5} />}
          >
            직접 장소 핀 찍기
          </Button>
        </div>

        {/* Safe Area */}
        <div className="pb-safe" />
      </div>
    </>
  );
}
