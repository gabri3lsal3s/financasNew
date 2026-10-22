import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { CategoryIcon } from "@/components/modules/category-icon";
import { MoneyText, type MoneyTextProps } from "@/components/ui/money-text";
import { usePrivacyMask } from "@/hooks/use-privacy-mask";

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
  /**
   * Variante visual da linha:
   * - "card": caixa individual com fundo bg-surface e cantos arredondados (padrão).
   * - "flat": fundo transparente sem cantos arredondados, para uso dentro de cards agrupadores com divide-y.
   */
  variant?: "card" | "flat";
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
  variant = "card",
}: TransactionRowProps) {
  const masked = usePrivacyMask();

  const effectiveWeightedCents =
    weightedAmountCents !== undefined
      ? weightedAmountCents
      : reportWeight !== undefined
        ? Math.round(amountCents * reportWeight)
        : undefined;

  const hasDifferentWeight =
    effectiveWeightedCents !== undefined &&
    Math.abs(effectiveWeightedCents) !== Math.abs(amountCents);

  const effectiveWeight =
    reportWeight !== undefined && reportWeight !== null
      ? reportWeight
      : weightedAmountCents !== undefined && amountCents !== 0
        ? Math.abs(weightedAmountCents) / Math.abs(amountCents)
        : undefined;

  const hasSplitWeight =
    effectiveWeight !== undefined && effectiveWeight >= 0 && effectiveWeight < 1;

  const splitLabel =
    hasSplitWeight && effectiveWeight !== undefined
      ? Math.round(effectiveWeight * 100) === 0
        ? "0% reembolso"
        : `${Math.round(effectiveWeight * 100)}% rateio`
      : null;

  const content = (
    <div
      className={cn(
        "flex w-full items-center gap-3 transition-colors",
        variant === "card"
          ? "rounded-xl bg-surface px-2 py-2.5 sm:py-2"
          : "bg-transparent px-3 sm:px-4 py-2.5 sm:py-2",
        onClick && (variant === "card" ? "cursor-pointer hover:bg-surface-hover" : "cursor-pointer hover:bg-surface-hover/60"),
        className,
      )}
    >
      {/* F12 — ícone sem fundo (chip transparente): só o ícone da categoria. */}
      <span className="flex size-9 shrink-0 items-center justify-center">
        <CategoryIcon icon={icon} color={iconColor} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{title}</p>
          {hasSplitWeight && splitLabel ? (
            <Badge
              variant="muted"
              size="xs"
              className="shrink-0 font-medium"
              title={
                Math.round((effectiveWeight ?? 0) * 100) === 0
                  ? "Despesa 100% reembolsada/estornada (R$ 0 no relatório)"
                  : `Rateio ativo: ${Math.round((effectiveWeight ?? 0) * 100)}% da despesa entra no relatório`
              }
            >
              {splitLabel}
            </Badge>
          ) : null}
        </div>
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
        {hasDifferentWeight && effectiveWeightedCents !== undefined ? (
          <span
            className="text-[11px] text-muted-foreground font-mono inline-flex items-center gap-1"
            title="Valor nominal bruto cobrado integralmente; no relatório é considerado apenas o valor ponderado."
          >
            <span>Relat.:</span>
            <MoneyText cents={effectiveWeightedCents} tone="default" className="text-[11px] text-muted-foreground" />
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
