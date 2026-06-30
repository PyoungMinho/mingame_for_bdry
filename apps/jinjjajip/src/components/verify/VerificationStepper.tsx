"use client";

import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type StepStatus = "completed" | "current" | "upcoming" | "error";

export interface VerificationStepperProps {
  currentStep: 1 | 2 | 3 | 4 | 5;
  stepStatuses?: Record<number, StepStatus>;
  estimatedTimes?: string[]; // 인덱스 0~4 (스텝 1~5 순서)
  className?: string;
}

// §5.3 D1: 5단계 확정 (팀장 결정)
const STEP_LABELS = ["인증", "동의", "촬영", "처리", "완료"] as const;
const DEFAULT_TIMES = ["30초", "1분", "2분", "2분", ""];

function resolveStatuses(
  currentStep: number,
  explicit?: Record<number, StepStatus>
): StepStatus[] {
  return STEP_LABELS.map((_, i) => {
    const step = i + 1;
    if (explicit?.[step]) return explicit[step];
    if (step < currentStep) return "completed";
    if (step === currentStep) return "current";
    return "upcoming";
  });
}

export function VerificationStepper({
  currentStep,
  stepStatuses,
  estimatedTimes = DEFAULT_TIMES,
  className,
}: VerificationStepperProps) {
  const statuses = resolveStatuses(currentStep, stepStatuses);

  return (
    <nav
      role="progressbar"
      aria-valuenow={currentStep}
      aria-valuemin={1}
      aria-valuemax={5}
      aria-label={`업로드 진행: ${currentStep}단계 / 5단계`}
      className={cn("flex items-start w-full", className)}
    >
      {STEP_LABELS.map((label, i) => {
        const step = i + 1;
        const status = statuses[i];
        const isLast = i === STEP_LABELS.length - 1;
        const time = estimatedTimes[i];

        const isCompleted = status === "completed";
        const isCurrent = status === "current";
        const isError = status === "error";

        const circleClass = cn(
          "flex items-center justify-center w-8 h-8 rounded-full border-2 text-trust-desc font-semibold shrink-0 transition-colors",
          isCompleted && "bg-realestate-state-complete border-realestate-state-complete text-white",
          isCurrent && "bg-realestate-brand-primary border-realestate-brand-primary text-white",
          isError && "bg-realestate-state-reported border-realestate-state-reported text-white",
          !isCompleted && !isCurrent && !isError &&
            "bg-white border-realestate-neutral-300 text-realestate-neutral-500"
        );

        const labelClass = cn(
          "text-trust-desc mt-1 text-center",
          isCurrent && "text-realestate-brand-primary font-semibold",
          isCompleted && "text-realestate-state-complete",
          isError && "text-realestate-state-reported",
          !isCompleted && !isCurrent && !isError && "text-realestate-neutral-500"
        );

        return (
          <div key={step} className="flex flex-1 flex-col items-center">
            <div className="flex items-center w-full">
              {/* 좌측 연결선 */}
              {i > 0 && (
                <div
                  className={cn(
                    "flex-1 h-0.5",
                    statuses[i - 1] === "completed"
                      ? "bg-realestate-state-complete"
                      : "bg-realestate-neutral-200"
                  )}
                  aria-hidden="true"
                />
              )}

              {/* 원 */}
              <div
                className={circleClass}
                aria-label={`${step}단계 ${label}: ${status === "completed" ? "완료" : status === "current" ? "진행 중" : status === "error" ? "오류" : "대기"}`}
              >
                {isCompleted ? (
                  <CheckCircle2 size={18} strokeWidth={2} aria-hidden="true" />
                ) : (
                  <span aria-hidden="true">{step}</span>
                )}
              </div>

              {/* 우측 연결선 */}
              {!isLast && (
                <div
                  className={cn(
                    "flex-1 h-0.5",
                    isCompleted
                      ? "bg-realestate-state-complete"
                      : "bg-realestate-neutral-200"
                  )}
                  aria-hidden="true"
                />
              )}
            </div>

            {/* 라벨 + 예상 시간 */}
            <div className="flex flex-col items-center">
              <span className={labelClass}>{label}</span>
              {time && (
                <span className="text-[10px] text-realestate-neutral-500 leading-none mt-0.5">
                  ({time})
                </span>
              )}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
