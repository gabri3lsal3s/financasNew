import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-shimmer rounded-md bg-[linear-gradient(110deg,var(--color-muted)_35%,var(--color-surface-hover)_50%,var(--color-muted)_65%)] bg-[length:200%_100%]",
        className,
      )}
      {...props}
    />
  );
}
