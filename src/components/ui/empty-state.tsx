import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  /**
   * Tonalidade do círculo do ícone (F12 — polimento): padrão é a marca
   * (primary); use "default" para neutro discreto ou a semântica do contexto
   * (positive/negative/warning) quando o estado vazio carregar esse sentido.
   */
  tone?: "default" | "primary" | "positive" | "negative" | "warning";
}

const toneCircle: Record<NonNullable<EmptyStateProps["tone"]>, string> = {
  default: "bg-muted text-muted-foreground",
  primary: "bg-primary/10 text-primary-strong ring-1 ring-primary/20",
  positive: "bg-positive/10 text-positive-strong ring-1 ring-positive/20",
  negative: "bg-negative/10 text-negative-strong ring-1 ring-negative/20",
  warning: "bg-warning/12 text-warning-strong ring-1 ring-warning/25",
};

export function EmptyState({ icon, title, description, action, className, tone = "primary" }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-surface px-6 py-12 text-center",
        className,
      )}
    >
      {icon ? (
        <div className={cn("flex size-12 items-center justify-center rounded-full", toneCircle[tone])}>
          {icon}
        </div>
      ) : null}
      <h3 className="font-display text-lg font-bold text-foreground">{title}</h3>
      {description ? <p className="max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
