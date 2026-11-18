import { Plane } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, Badge } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { CategoryIcon } from "@/components/modules/category-icon";
import { formatDateBR, monthLabel } from "@/lib/date";
import { PAYMENT_METHOD_LABELS } from "@/lib/labels";
import type { Category, Expense } from "@/types";
import { ExpensePriceEvolution, type PriceEvolutionData } from "./expense-price-evolution";

export interface ExpenseDetailViewProps {
  expense: Expense;
  currentCategory?: Category;
  isFamilyActive: boolean;
  isInstallment: boolean;
  isRecurring: boolean;
  priceEvolution: PriceEvolutionData | null;
}

/** Exibição dos dados consolidados da despesa com metadados avançados em Accordion (M9). */
export function ExpenseDetailView({
  expense,
  currentCategory,
  isFamilyActive,
  isInstallment,
  isRecurring,
  priceEvolution,
}: ExpenseDetailViewProps) {
  const reportAmountCents = Math.round(expense.value * expense.report_weight * 100);
  const hasAdvancedMetadata =
    expense.report_weight < 1 || isInstallment || Boolean(expense.bill_competence) || isRecurring || Boolean(priceEvolution);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <MoneyText
          cents={Math.round(expense.value * 100)}
          tone="negative"
          variant="value"
          className="text-3xl font-bold"
        />
        {expense.report_weight < 1 ? (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>Valor no relatório:</span>
            <MoneyText cents={reportAmountCents} tone="default" variant="caption" className="font-semibold text-foreground" />
            <span className="font-mono tabular-nums">({Math.round(expense.report_weight * 100)}%)</span>
          </div>
        ) : null}
        <p className="text-sm font-medium text-foreground">
          {expense.description || currentCategory?.name || "Despesa"}
        </p>
      </div>

      <dl className="flex flex-col gap-2 rounded-xl border border-border/80 bg-surface p-3.5 text-sm shadow-xs">
        <div className="flex items-center justify-between gap-2">
          <dt className="text-xs text-muted-foreground">Categoria</dt>
          <dd className="flex items-center gap-1.5 font-medium text-foreground text-xs">
            {currentCategory ? (
              <>
                <CategoryIcon icon={currentCategory.icon} color={currentCategory.color} className="size-3.5" />
                <span>{currentCategory.name}</span>
              </>
            ) : (
              "Outra"
            )}
          </dd>
        </div>

        {isFamilyActive ? (
          <div className="flex items-center justify-between gap-2">
            <dt className="text-xs text-muted-foreground">Orçamento</dt>
            <dd className="font-medium text-foreground text-xs">
              {expense.is_family ? <Badge variant="muted" size="xs">Familiar</Badge> : "Individual"}
            </dd>
          </div>
        ) : null}

        {expense.trip_id ? (
          <div className="flex items-center justify-between gap-2">
            <dt className="text-xs text-muted-foreground">Viagem</dt>
            <dd className="font-medium text-foreground text-xs">
              <Badge variant="portfolio" size="xs" className="gap-1 font-medium">
                <Plane className="size-3 text-portfolio" aria-hidden="true" />
                <span>Modo Viagem</span>
              </Badge>
            </dd>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-2">
          <dt className="text-xs text-muted-foreground">Data</dt>
          <dd className="font-medium text-foreground text-xs tabular-nums">{formatDateBR(expense.date)}</dd>
        </div>

        <div className="flex items-center justify-between gap-2">
          <dt className="text-xs text-muted-foreground">Pagamento</dt>
          <dd className="font-medium text-foreground text-xs">
            {PAYMENT_METHOD_LABELS[expense.payment_method] ?? expense.payment_method}
          </dd>
        </div>
      </dl>

      {hasAdvancedMetadata ? (
        <Accordion type="single" collapsible defaultValue={priceEvolution?.hasPriceIncrease ? "advanced" : undefined}>
          <AccordionItem value="advanced">
            <AccordionTrigger className="text-xs py-2.5">
              Mais detalhes · Fatura, rateio e histórico
            </AccordionTrigger>
            <AccordionContent className="flex flex-col gap-3">
              <dl className="flex flex-col gap-2 text-xs">
                {expense.report_weight < 1 ? (
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-muted-foreground">Participação no relatório</dt>
                    <dd className="flex items-center gap-1 font-medium text-foreground">
                      <MoneyText cents={reportAmountCents} tone="default" variant="caption" />
                      <span className="font-mono tabular-nums">({Math.round(expense.report_weight * 100)}%)</span>
                    </dd>
                  </div>
                ) : null}
                {isInstallment ? (
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-muted-foreground">Parcela</dt>
                    <dd className="font-medium text-foreground tabular-nums">
                      {expense.installment_number}/{expense.installments_total}
                    </dd>
                  </div>
                ) : null}
                {expense.bill_competence ? (
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-muted-foreground">Fatura</dt>
                    <dd className="font-medium text-foreground">{monthLabel(expense.bill_competence)}</dd>
                  </div>
                ) : null}
                {isRecurring ? (
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-muted-foreground">Série</dt>
                    <dd className="font-medium text-foreground">Lançamento recorrente</dd>
                  </div>
                ) : null}
              </dl>
              {priceEvolution ? <ExpensePriceEvolution evolution={priceEvolution} /> : null}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      ) : null}
    </div>
  );
}
