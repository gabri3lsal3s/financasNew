import { Badge } from "@/components/ui";
import { TransactionRow } from "@/components/modules";
import type { ExpensePriceEvolution } from "@/domain/insights";
import { useSafeBusinessMode } from "@/hooks/use-safe-business-scope";
import type { Category, Expense, Income } from "@/types";
import { PriceIncreaseBadge } from "../price-increase-badge";

export interface ExpenseRowProps {
  expense: Expense;
  category?: Category | null;
  recurrenceLabel?: string;
  isFamilyModeEnabled?: boolean;
  hasLinkedSplit?: boolean;
  priceEvolution?: ExpensePriceEvolution | null;
  onClick?: () => void;
}

/** Linha de despesa no feed unificado de transações. */
export function ExpenseRow({
  expense,
  category,
  recurrenceLabel,
  isFamilyModeEnabled,
  hasLinkedSplit,
  priceEvolution,
  onClick,
}: ExpenseRowProps) {
  const { isBusinessModeEnabled } = useSafeBusinessMode();
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
      hasLinkedSplit={hasLinkedSplit}
      chargeKind={expense.charge_kind}
      kind="expense"
      icon={category?.icon}
      iconColor={category?.color}
      badges={
        <div className="hidden sm:flex items-center gap-1.5 shrink-0 flex-wrap">
          {isBusinessModeEnabled && expense.scope === "business" && (
            <Badge variant="portfolio" size="xs" className="shrink-0 font-medium">
              PJ
            </Badge>
          )}
          {isBusinessModeEnabled && expense.is_internal_transfer && (
            <Badge variant="muted" size="xs" className="shrink-0 font-medium">
              Transf. interna
            </Badge>
          )}
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
  const { isBusinessModeEnabled } = useSafeBusinessMode();
  const title = income.description || category?.name || "Receita";
  const subtitle =
    recurrenceLabel ?? (category?.name && income.description ? category.name : undefined);

  const showBadges =
    (isBusinessModeEnabled && (income.scope === "business" || income.is_internal_transfer)) ||
    (isFamilyModeEnabled && income.is_family);

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
        showBadges ? (
          <div className="hidden sm:flex items-center gap-1.5 shrink-0 flex-wrap">
            {isBusinessModeEnabled && income.scope === "business" ? (
              <Badge variant="portfolio" size="xs" className="shrink-0 font-medium">
                PJ
              </Badge>
            ) : null}
            {isBusinessModeEnabled && income.is_internal_transfer ? (
              <Badge variant="muted" size="xs" className="shrink-0 font-medium">
                Transf. interna
              </Badge>
            ) : null}
            {isFamilyModeEnabled && income.is_family ? (
              <Badge variant="muted" size="xs" className="shrink-0 font-medium">
                Familiar
              </Badge>
            ) : null}
          </div>
        ) : undefined
      }
      onClick={onClick}
      variant="flat"
    />
  );
}
