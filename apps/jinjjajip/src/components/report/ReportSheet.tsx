"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as RadioGroup from "@radix-ui/react-radio-group";
import * as Label from "@radix-ui/react-label";
import { X, Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReportPayload, ReportReason } from "@/lib/types/domain";

export interface ReportSheetProps {
  listingId: string;
  listingTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (report: ReportPayload) => Promise<void>;
  className?: string;
}

const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: "fake_listing", label: "허위 매물 (실제로 없는 방)" },
  { value: "wrong_photo", label: "사진 불일치 (다른 방 사진)" },
  { value: "wrong_price", label: "가격 상이 (실제와 다른 가격)" },
  { value: "already_taken", label: "이미 거래 완료된 매물" },
  { value: "duplicate", label: "중복 매물" },
  { value: "other", label: "기타" },
];

export function ReportSheet({
  listingId,
  listingTitle,
  open,
  onOpenChange,
  onSubmit,
  className,
}: ReportSheetProps) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [detail, setDetail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const canSubmit = reason !== null && !isSubmitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        listingId,
        reason,
        detail: detail.trim() || undefined,
      });
      setSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleClose() {
    if (!isSubmitting) {
      onOpenChange(false);
      // 닫힌 후 상태 초기화 (애니메이션 후)
      setTimeout(() => {
        setReason(null);
        setDetail("");
        setSubmitted(false);
      }, 300);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleClose}>
      <Dialog.Portal>
        {/* 스크림 */}
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

        {/* 시트: 모바일 하단 75%h / 데스크톱 우측 480px */}
        <Dialog.Content
          className={cn(
            "fixed z-50 bg-white shadow-lg focus:outline-none",
            // 모바일: 하단 바텀시트
            "bottom-0 left-0 right-0 rounded-t-xl max-h-[75vh] overflow-y-auto",
            // 데스크톱: 우측 사이드 시트
            "md:bottom-auto md:top-0 md:right-0 md:left-auto md:h-full md:w-[480px] md:rounded-l-xl md:rounded-r-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:slide-out-to-bottom md:data-[state=closed]:slide-out-to-right",
            "data-[state=open]:slide-in-from-bottom md:data-[state=open]:slide-in-from-right",
            "duration-250",
            className
          )}
          aria-describedby="report-sheet-desc"
        >
          {/* 헤더 */}
          <div className="sticky top-0 bg-white border-b border-realestate-neutral-200 px-card-pad py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flag size={18} className="text-realestate-state-reported" aria-hidden="true" />
              <Dialog.Title className="text-h3 text-realestate-neutral-900">
                신고하기
              </Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <button
                className="p-1.5 rounded-md text-realestate-neutral-500 hover:bg-realestate-neutral-100 focus-visible:ring-2 focus-visible:ring-realestate-brand-primary"
                aria-label="신고 창 닫기"
              >
                <X size={18} />
              </button>
            </Dialog.Close>
          </div>

          <div className="px-card-pad py-section-gap">
            {submitted ? (
              /* 제출 완료 상태 */
              <div className="flex flex-col items-center gap-4 py-8" aria-live="polite">
                <Flag size={40} className="text-realestate-state-reported" aria-hidden="true" />
                <p className="text-body-m text-realestate-neutral-900 font-semibold text-center">
                  신고가 접수되었습니다. 검토 중에도 매물은 계속 볼 수 있어요
                </p>
                {/* notice-and-takedown 안내 (§6.2) */}
                <div className="w-full bg-realestate-amber-warn-bg border border-realestate-amber-warn-border rounded-md p-3">
                  <p className="text-trust-desc text-realestate-amber-warn">
                    신고 검토 후 허위매물로 확인되면 즉시 비공개(Notice-and-Takedown) 처리됩니다.
                    허위 신고 시 서비스 이용이 제한될 수 있어요.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  className="w-full px-4 py-3 rounded-md bg-realestate-brand-primary text-white text-body-s font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-realestate-brand-primary"
                >
                  확인
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-section-gap">
                <p
                  id="report-sheet-desc"
                  className="text-trust-desc text-realestate-neutral-500"
                >
                  <span className="font-medium text-realestate-neutral-700">{listingTitle}</span>{" "}
                  매물의 문제를 신고해주세요.
                </p>

                {/* 신고 유형 RadioGroup */}
                <div>
                  <Label.Root
                    htmlFor="report-reason"
                    className="text-body-s text-realestate-neutral-900 font-semibold mb-2 block"
                  >
                    신고 유형 <span className="text-realestate-state-reported">*</span>
                  </Label.Root>
                  <RadioGroup.Root
                    id="report-reason"
                    value={reason ?? ""}
                    onValueChange={(v) => setReason(v as ReportReason)}
                    className="flex flex-col gap-2"
                    aria-label="신고 유형 선택"
                    aria-required="true"
                  >
                    {REPORT_REASONS.map((r) => (
                      <div key={r.value} className="flex items-center gap-2.5">
                        <RadioGroup.Item
                          value={r.value}
                          id={`reason-${r.value}`}
                          className={cn(
                            "w-4 h-4 rounded-full border border-realestate-neutral-300 bg-white",
                            "data-[state=checked]:border-realestate-brand-primary",
                            "focus-visible:ring-2 focus-visible:ring-realestate-brand-primary focus-visible:ring-offset-1",
                            "flex-shrink-0"
                          )}
                        >
                          <RadioGroup.Indicator className="flex items-center justify-center w-full h-full relative">
                            <div className="w-2 h-2 rounded-full bg-realestate-brand-primary" />
                          </RadioGroup.Indicator>
                        </RadioGroup.Item>
                        <Label.Root
                          htmlFor={`reason-${r.value}`}
                          className="text-body-s text-realestate-neutral-700 cursor-pointer"
                        >
                          {r.label}
                        </Label.Root>
                      </div>
                    ))}
                  </RadioGroup.Root>
                </div>

                {/* 상세 내용 Textarea (선택, 200자) */}
                <div>
                  <Label.Root
                    htmlFor="report-detail"
                    className="text-body-s text-realestate-neutral-900 font-semibold mb-1.5 block"
                  >
                    상세 내용{" "}
                    <span className="text-realestate-neutral-500 font-normal">(선택)</span>
                  </Label.Root>
                  <textarea
                    id="report-detail"
                    value={detail}
                    onChange={(e) => setDetail(e.target.value.slice(0, 200))}
                    placeholder="구체적인 내용을 적어주시면 빠른 검토에 도움이 돼요"
                    rows={4}
                    maxLength={200}
                    className={cn(
                      "w-full border border-realestate-neutral-300 rounded-md px-3 py-2",
                      "text-body-s text-realestate-neutral-900 placeholder:text-realestate-neutral-500",
                      "resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-realestate-brand-primary"
                    )}
                    aria-describedby="detail-count"
                  />
                  <p
                    id="detail-count"
                    className="text-trust-desc text-realestate-neutral-500 text-right mt-0.5"
                    aria-live="polite"
                  >
                    {detail.length}/200
                  </p>
                </div>

                {/* notice-and-takedown 안내 (제출 전) */}
                <div className="bg-realestate-amber-warn-bg border border-realestate-amber-warn-border rounded-md p-3">
                  <p className="text-trust-desc text-realestate-amber-warn">
                    신고 접수 즉시 매물이 비공개 전환됩니다 (Notice-and-Takedown). 허위 신고는 이용 제한의 원인이 될 수 있어요.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className={cn(
                    "w-full px-4 py-3 rounded-md text-white text-body-s font-semibold",
                    "focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-realestate-brand-primary",
                    "transition-opacity",
                    canSubmit
                      ? "bg-realestate-state-reported hover:opacity-90"
                      : "bg-realestate-neutral-300 cursor-not-allowed"
                  )}
                  aria-disabled={!canSubmit}
                >
                  {isSubmitting ? "신고 접수 중…" : "신고 접수하기"}
                </button>
              </form>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
