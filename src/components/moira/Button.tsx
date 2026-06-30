"use client";

import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "kakao" | "outline" | "ghost";
type Size = "lg" | "md" | "sm";

const VARIANT: Record<Variant, string> = {
  primary:
    "bg-moira-brand text-white hover:bg-moira-brand-dark active:bg-moira-brand-dark shadow-[0_6px_16px_rgba(79,70,229,0.28)]",
  kakao:
    "bg-moira-kakao text-moira-kakao-ink hover:brightness-95 active:brightness-90 shadow-[0_6px_16px_rgba(254,229,0,0.45)]",
  outline:
    "bg-moira-surface text-moira-ink border border-moira-border hover:bg-slate-50 active:bg-slate-100",
  ghost: "bg-transparent text-moira-brand hover:bg-moira-brand-tint active:bg-indigo-100",
};

const SIZE: Record<Size, string> = {
  lg: "h-[52px] px-5 text-[16px] rounded-xl",
  md: "h-11 min-h-[44px] px-4 text-[15px] rounded-xl",
  sm: "h-9 min-h-[36px] px-3 text-[14px] rounded-lg",
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export function Button({
  variant = "primary",
  size = "lg",
  block = true,
  leftIcon,
  rightIcon,
  className,
  children,
  disabled,
  ...rest
}: Props) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 font-bold cursor-pointer select-none",
        "transition-all duration-150 ease-[cubic-bezier(.4,0,.2,1)] active:scale-[.985]",
        "disabled:opacity-40 disabled:pointer-events-none",
        block && "w-full",
        SIZE[size],
        VARIANT[variant],
        className,
      )}
      disabled={disabled}
      {...rest}
    >
      {leftIcon}
      {children}
      {rightIcon}
    </button>
  );
}
