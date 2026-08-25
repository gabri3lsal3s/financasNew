import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  /**
   * Tonalidade do ícone (F12 — polimento): padrão é a marca (primary); use
   * "default" para neutro discreto ou a semântica do contexto
   * (positive/negative/warning) quando o estado vazio carregar esse sentido.
   * O ícone é exibido SEM fundo — apenas a cor tonal.
   */
  tone?: "default" | "primary" | "positive" | "negative" | "warning" | "portfolio";
  /**
   * Nível do heading (F14 — a11y): `h3` quando o empty state vive dentro de
   * uma seção com h2 (padrão); `h2` quando é o primeiro conteúdo direto sob
   * o h1 da página (sem seção intermediária — ordem de headings válida).
   */
  headingLevel?: "h2" | "h3";
}

const toneIcon: Record<NonNullable<EmptyStateProps["tone"]>, string> = {
  default: "text-muted-foreground",
  primary: "text-primary-strong",
  positive: "text-positive-strong",
  negative: "text-negative-strong",
  warning: "text-warning-strong",
  portfolio: "text-portfolio",
};

export function EmptyState({ icon, title, description, action, className, tone = "default", headingLevel = "h3" }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-surface px-6 py-12 text-center",
        className,
      )}
    >
      {icon ? (
        <div className={cn("flex size-12 items-center justify-center", toneIcon[tone])}>
          {icon}
        </div>
      ) : null}
      {headingLevel === "h2" ? (
        <h2 className="font-display text-lg font-bold text-foreground">{title}</h2>
      ) : (
        <h3 className="font-display text-lg font-bold text-foreground">{title}</h3>
      )}
      {description ? <p className="max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
