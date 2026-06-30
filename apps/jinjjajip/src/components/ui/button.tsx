"use client";

import { forwardRef } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md text-body-s font-semibold transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-realestate-brand-primary disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        primary: "bg-realestate-brand-primary text-white hover:opacity-90",
        secondary:
          "border border-realestate-neutral-300 bg-white text-realestate-neutral-700 hover:bg-realestate-neutral-100",
        danger: "bg-realestate-state-reported text-white hover:opacity-90",
        ghost: "text-realestate-neutral-700 hover:bg-realestate-neutral-100",
        link: "text-realestate-brand-sub underline-offset-2 hover:underline p-0 h-auto",
      },
      size: {
        sm: "h-8 px-3 text-trust-desc",
        md: "h-10 px-4",
        lg: "h-14 px-6 text-body-m",
        full: "w-full h-14 px-6 text-body-m",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { buttonVariants };
