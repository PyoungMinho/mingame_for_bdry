import { type LucideIcon, CloudLightning } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ErrorStateProps {
  icon?: LucideIcon;
  /** 주요 오류 메시지 (title과 message 중 하나 사용) */
  title?: string;
  message?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
  secondaryAction?: React.ReactNode;
  className?: string;
}

export function ErrorState({
  icon: Icon = CloudLightning,
  title,
  message,
  description,
  onRetry,
  retryLabel = "다시 시도",
  secondaryAction,
  className,
}: ErrorStateProps) {
  const heading = title ?? message ?? "";
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-16 px-screen-x text-center",
        className
      )}
      role="alert"
      aria-label={heading}
    >
      <Icon
        size={48}
        className="text-realestate-neutral-300"
        strokeWidth={1.5}
        aria-hidden="true"
      />
      {heading && <p className="text-h3 font-serif text-realestate-neutral-900">{heading}</p>}
      {description && (
        <p className="text-body-s text-realestate-neutral-500 max-w-xs">{description}</p>
      )}
      <div className="flex flex-col gap-2 mt-2 w-full max-w-xs">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="w-full px-4 py-3 rounded-md bg-realestate-brand-primary text-white text-body-s font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-realestate-brand-primary"
          >
            {retryLabel}
          </button>
        )}
        {secondaryAction}
      </div>
    </div>
  );
}
