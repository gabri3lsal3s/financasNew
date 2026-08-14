import type { HTMLAttributes } from "react";
import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const cardVariants = cva(
  "rounded-xl transition-[box-shadow,transform,border-color,background-color] duration-200",
  {
    variants: {
      variant: {
        default: "border border-border bg-surface shadow-sm hover:shadow-md hover:border-border/80",
        glass: "glass-panel shadow-sm hover:shadow-md hover:border-primary/30",
        flat: "border border-border bg-surface shadow-none",
        elevated: "border border-border/80 bg-surface shadow-md hover:shadow-lg hover:-translate-y-0.5",
        interactive:
          "border border-border bg-surface shadow-sm hover:shadow-md hover:border-primary/40 hover:-translate-y-0.5 cursor-pointer active:scale-[0.99]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface CardProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

export function Card({ className, variant, ...props }: CardProps) {
  return <div className={cn(cardVariants({ variant }), className)} {...props} />;
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1 p-5", className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("font-display text-lg font-bold tracking-tight", className)} {...props} />;
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 pt-0", className)} {...props} />;
}
