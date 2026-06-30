// REDLINE: 외모/체형 비교 UI 금지. 타인 점수 노출 금지.

"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

// ── Props 인터페이스 ──────────────────────────────────────────────────
export interface BottomSheetProps {
  /** 열림 여부 */
  open: boolean;
  /** 닫기 핸들러 (오버레이 클릭 or 드래그 다운) */
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  /** 시트 aria-label */
  ariaLabel?: string;
}

/**
 * 오름 BottomSheet 컴포넌트
 *
 * TODO (페이지개발자 의존):
 * - 드래그 다운 제스처 (framer-motion drag + dragConstraints)
 * - 포커스 트랩 (@radix-ui/react-focus-scope 또는 직접 구현)
 * - body scroll lock (open=true 시)
 * - Pro Paywall 콘텐츠 연결
 *
 * @see ui-spec.md §3-13
 */
const BottomSheet = React.forwardRef<HTMLDivElement, BottomSheetProps>(
  ({ open, onClose, children, className, ariaLabel, ...props }, ref) => {
    // TODO: body scroll lock
    // TODO: ESC 키 닫기

    return (
      <AnimatePresence>
        {open && (
          <>
            {/* 오버레이 */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="fixed inset-0 z-40"
              style={{ backgroundColor: "rgba(0,0,0,0.48)" }}
              aria-hidden="true"
              onClick={onClose}
            />

            {/* 시트 */}
            <motion.div
              ref={ref}
              role="dialog"
              aria-modal="true"
              aria-label={ariaLabel}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{
                duration: 0.4,
                ease: [0.25, 0.46, 0.45, 0.94], // motion-slow
              }}
              className={cn(
                "fixed bottom-0 left-0 right-0 z-50",
                "max-h-[80dvh] overflow-y-auto",
                "bg-white rounded-t-xl",
                // 다크: primary-700 배경
                "dark:bg-primary-700",
                className
              )}
              {...props}
            >
              {/* 핸들 — 32×4px gray-300 (ui-spec.md §3-13) */}
              <div
                className="flex justify-center pt-2 pb-1"
                aria-hidden="true"
              >
                <div className="w-8 h-1 rounded-full bg-gray-300" />
              </div>

              {/* 콘텐츠 */}
              <div className="px-5 pb-8">
                {/* TODO: 콘텐츠 영역 */}
                {children}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    );
  }
);

BottomSheet.displayName = "BottomSheet";

export { BottomSheet };
