import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "@/components/modules/category-icon";
import { MoneyText, type MoneyTextProps } from "@/components/ui/money-text";
import { formatCentsAsBRL } from "@/services/masks";
import { usePrivacyMask } from "@/hooks/use-privacy-mask";
import { useDensity } from "@/hooks/use-density";

export interface TransactionRowProps {
  title: string;
  subtitle?: string;
  date?: string;
  /** Valor real/nominal em centavos — exibido com sinal e cor pelo tipo. */
  amountCents: number;
  /** Valor considerado no relatório em centavos (quando houver rateio/peso < 1). */
  weightedAmountCents?: number;
  /** Peso no relatório (0 a 1). */
  reportWeight?: number;
  kind: "income" | "expense" | "neutral";
  icon?: string | null;
  iconColor?: string | null;
  badges?: ReactNode;
  onClick?: () => void;
  className?: string;
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
  weightedAmountCents,
  reportWeight,
  kind,
  icon,
  iconColor,
  badges,
  onClick,
  className,
}: TransactionRowProps) {
  const masked = usePrivacyMask();
  const density = useDensity();
  const compact = density === "compact";

  const effectiveWeightedCents =
    weightedAmountCents !== undefined
      ? weightedAmountCents
      : reportWeight !== undefined
        ? Math.round(amountCents * reportWeight)
        : undefined;

  const hasDifferentWeight =
    effectiveWeightedCents !== undefined &&
    Math.abs(effectiveWeightedCents) !== Math.abs(amountCents);

  const content = (
    <div
      className={cn(
        // Superfície consistente (F12): toda linha é um card de superfície
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
      <div className="flex flex-col items-end shrink-0 text-right">
        <MoneyText
          cents={kind === "expense" ? -Math.abs(amountCents) : amountCents}
          variant="value"
          tone={kindTone[kind]}
          sign={kindSign[kind]}
          aria-hidden={masked || undefined}
        />
        {hasDifferentWeight ? (
          <span
            className="text-[11px] text-muted-foreground font-mono"
            title="Valor considerado no relatório"
          >
            Relat.: {formatCentsAsBRL(effectiveWeightedCents)}
          </span>
        ) : null}
      </div>
    </div>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="w-full text-left focus-visible:outline-none">
        {content}
      </button>
    );
  }

  return content;
}
