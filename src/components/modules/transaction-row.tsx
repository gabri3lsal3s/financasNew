import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "@/components/modules/category-icon";
import { formatCentsAsBRL } from "@/services/masks/money";
import { triggerHaptic } from "@/services/haptics";
import { usePrivacyMask } from "@/hooks/use-privacy-mask";
import { useDensity } from "@/hooks/use-density";
import { useSwipeAction } from "@/hooks/use-swipe-action";

export interface TransactionRowProps {
  title: string;
  subtitle?: string;
  date?: string;
  /** Valor em centavos — exibido com sinal e cor pelo tipo. */
  amountCents: number;
  kind: "income" | "expense" | "neutral";
  icon?: string | null;
  iconColor?: string | null;
  badges?: ReactNode;
  onClick?: () => void;
  className?: string;
  /** Ações rápidas reveladas por swipe (F8 — Decisão 2). */
  swipeActions?: ReactNode;
}

const kindValue: Record<TransactionRowProps["kind"], string> = {
  income: "text-positive-strong",
  expense: "text-negative-strong",
  neutral: "text-foreground",
};

const kindSign: Record<TransactionRowProps["kind"], string> = {
  income: "+",
  expense: "−",
  neutral: "",
};

/** Linha de lançamento (receita/despesa) — módulo de domínio reutilizável. */
export function TransactionRow({
  title,
  subtitle,
  date,
  amountCents,
  kind,
  icon,
  iconColor,
  badges,
  onClick,
  className,
  swipeActions,
}: TransactionRowProps) {
  const masked = usePrivacyMask();
  const density = useDensity();
  const compact = density === "compact";
  const swipe = useSwipeAction({ onOpen: () => triggerHaptic("light") });
  const hasSwipe = swipeActions !== undefined;

  const content = (
    <div
      className={cn(
        "flex w-full items-center gap-3 rounded-xl px-2 transition-colors",
        compact ? "py-1.5" : "py-2.5",
        onClick && "cursor-pointer hover:bg-surface-hover",
        className,
      )}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
        <CategoryIcon icon={icon} color={iconColor} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{title}</p>
        {(subtitle || date) && (
          <p className="truncate text-xs text-muted-foreground">{[date, subtitle].filter(Boolean).join(" · ")}</p>
        )}
      </div>
      {badges ? <div className="flex shrink-0 items-center gap-1.5">{badges}</div> : null}
      {/* Máscara global via .num (globals.css) — aria-hidden preserva a privacidade p/ leitores de tela. */}
      <span
        className={cn("num shrink-0 text-sm font-semibold", kindValue[kind])}
        aria-hidden={masked || undefined}
      >
        {`${kindSign[kind]}${formatCentsAsBRL(amountCents)}`}
      </span>
    </div>
  );

  const row = onClick ? (
    <button type="button" onClick={onClick} className="w-full text-left focus-visible:outline-none">
      {content}
    </button>
  ) : (
    content
  );

  if (!hasSwipe) return row;

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Camada de ações revelada atrás da linha (à direita). Fechada: inert
          (não-focável e fora da árvore acessível) — sem violação aria-hidden. */}
      <div className="absolute inset-y-0 right-0 flex w-24 items-stretch" inert={!swipe.open || undefined}>
        {swipeActions}
      </div>
      <div
        {...swipe.pointerHandlers}
        style={{ transform: `translateX(${swipe.offset}px)`, transition: swipe.dragging ? "none" : "transform 0.2s ease-out" }}
        className={cn("relative touch-pan-y rounded-xl bg-surface", !swipe.open && "shadow-none")}
      >
        {row}
      </div>
    </div>
  );
}
