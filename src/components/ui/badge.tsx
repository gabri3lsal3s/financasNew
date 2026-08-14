import type { HTMLAttributes } from "react";
import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 whitespace-nowrap rounded-pill px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "bg-primary/12 text-primary-strong",
        muted: "bg-muted text-muted-foreground",
        positive: "bg-positive/12 text-positive-strong",
        negative: "bg-negative/12 text-negative-strong",
        warning: "bg-warning/15 text-warning-strong",
        critical: "bg-critical/12 text-critical-strong",
        portfolio: "bg-portfolio/12 text-portfolio",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
