import { Badge } from "@/components/ui";
import { TransactionRow } from "@/components/modules";
import type { ExpensePriceEvolution } from "@/domain/insights";
import type { Category, Expense, Income } from "@/types";
import { PriceIncreaseBadge } from "../price-increase-badge";

export interface ExpenseRowProps {
  expense: Expense;
  category?: Category | null;
  recurrenceLabel?: string;
  isFamilyModeEnabled?: boolean;
  priceEvolution?: ExpensePriceEvolution | null;
  onClick?: () => void;
}

/** Linha de despesa no feed unificado de transações. */
export function ExpenseRow({
  expense,
  category,
  recurrenceLabel,
  isFamilyModeEnabled,
  priceEvolution,
  onClick,
}: ExpenseRowProps) {
  const title = expense.description || category?.name || "Despesa";
  const subtitle =
    recurrenceLabel ??
    (expense.installments_total > 1
      ? `${expense.installment_number}/${expense.installments_total}`
      : category?.name && expense.description
        ? category.name
        : undefined);

  return (
    <TransactionRow
      title={title}
      subtitle={subtitle}
      amountCents={Math.round(expense.value * 100)}
      reportWeight={expense.report_weight}
      kind="expense"
      icon={category?.icon}
      iconColor={category?.color}
      badges={
        <div className="hidden sm:flex items-center gap-1.5 shrink-0 flex-wrap">
          {isFamilyModeEnabled && expense.is_family && (
            <Badge variant="muted" size="xs" className="shrink-0 font-medium">
              Familiar
            </Badge>
          )}
          {Boolean(expense.trip_id) && (
            <Badge variant="default" size="xs" className="shrink-0 font-medium">
              Viagem
            </Badge>
          )}
          {priceEvolution?.hasPriceIncrease && priceEvolution.deltaPreviousPercent != null && (
            <PriceIncreaseBadge
              deltaPercent={priceEvolution.deltaPreviousPercent}
              annualizedImpactCents={(priceEvolution.deltaPreviousCents ?? 0) * 12}
            />
          )}
        </div>
      }
      onClick={onClick}
      variant="flat"
    />
  );
}

export interface IncomeRowProps {
  income: Income;
  category?: Category | null;
  recurrenceLabel?: string;
  isFamilyModeEnabled?: boolean;
  onClick?: () => void;
}

/** Linha de receita no feed unificado de transações. */
export function IncomeRow({
  income,
  category,
  recurrenceLabel,
  isFamilyModeEnabled,
  onClick,
}: IncomeRowProps) {
  const title = income.description || category?.name || "Receita";
  const subtitle =
    recurrenceLabel ?? (category?.name && income.description ? category.name : undefined);

  return (
    <TransactionRow
      title={title}
      subtitle={subtitle}
      amountCents={Math.round(income.value * 100)}
      reportWeight={income.report_weight}
      kind="income"
      icon={category?.icon}
      iconColor={category?.color}
      badges={
        isFamilyModeEnabled && income.is_family ? (
          <Badge variant="muted" size="xs" className="hidden sm:inline-flex shrink-0 font-medium">
            Familiar
          </Badge>
        ) : undefined
      }
      onClick={onClick}
      variant="flat"
    />
  );
}
