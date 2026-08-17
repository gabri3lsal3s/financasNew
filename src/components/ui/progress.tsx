import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  /** 0–100. */
  value: number;
  /**
   * "auto" aplica as faixas do DESIGN_SYSTEM §2.3:
   * >= 85% critical · >= 70% warning · senão positive.
   */
  tone?: "auto" | "positive" | "warning" | "critical";
}

const toneBg: Record<NonNullable<ProgressProps["tone"]>, string> = {
  auto: "",
  positive: "bg-positive",
  warning: "bg-warning",
  critical: "bg-critical",
};

function autoTone(value: number): "positive" | "warning" | "critical" {
  if (value >= 85) return "critical";
  if (value >= 70) return "warning";
  return "positive";
}

export function Progress({ value, tone = "auto", className, ...props }: ProgressProps) {
  const clamped = Math.min(100, Math.max(0, value));
  const resolved = tone === "auto" ? autoTone(clamped) : tone;
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}
      {...props}
    >
      <div
        className={cn("h-full rounded-full transition-[width,background-color] duration-300 ease-out", toneBg[resolved])}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
