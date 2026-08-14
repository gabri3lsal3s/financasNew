import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "@/components/modules/category-icon";
import { MoneyText, type MoneyTextProps } from "@/components/ui/money-text";
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

const kindTone: Record<TransactionRowProps["kind"], MoneyTextProps["tone"]> = {
  income: "positive",
  expense: "negative",
  neutral: "default",
};

const kindSign: Record<TransactionRowProps["kind"], MoneyTextProps["sign"]> = {
  income: "explicit",
  expense: "explicit",
  neutral: "none",
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
        // Superfície consistente (F12): toda linha é um card de superfície
        // (receitas/despesas iguais — antes só as com swipe tinham bg-surface).
        "flex w-full items-center gap-3 rounded-xl bg-surface px-2 transition-colors",
        compact ? "py-1.5" : "py-2.5",
        onClick && "cursor-pointer hover:bg-surface-hover",
        className,
      )}
    >
      {/* F12 — ícone sem fundo (chip transparente): só o ícone da categoria. */}
      <span className="flex size-9 shrink-0 items-center justify-center">
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
      <MoneyText
        cents={kind === "expense" ? -Math.abs(amountCents) : amountCents}
        variant="value"
        tone={kindTone[kind]}
        sign={kindSign[kind]}
        className="shrink-0"
        aria-hidden={masked || undefined}
      />
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
