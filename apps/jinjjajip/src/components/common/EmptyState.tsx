import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon?: LucideIcon;
  /** 주요 메시지 (title과 message 중 하나 사용) */
  title?: string;
  message?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, message, description, action, className }: EmptyStateProps) {
  const heading = title ?? message ?? "";
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-16 px-screen-x text-center",
        className
      )}
      role="status"
      aria-label={heading}
    >
      {Icon && (
        <Icon
          size={48}
          className="text-realestate-neutral-300"
          strokeWidth={1.5}
          aria-hidden="true"
        />
      )}
      {heading && <p className="text-h3 font-serif text-realestate-neutral-900">{heading}</p>}
      {description && (
        <p className="text-body-s text-realestate-neutral-500 max-w-xs">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
