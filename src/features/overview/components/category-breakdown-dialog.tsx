import { useNavigate } from "react-router";
import { ArrowUpRight, ReceiptText, Target, TrendingDown, TrendingUp } from "lucide-react";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MoneyText } from "@/components/ui/money-text";
import { Progress } from "@/components/ui/progress";
import { CategoryIcon } from "@/components/modules/category-icon";
import { formatDateBR, monthLabel } from "@/lib/date";
import { progressTone } from "@/domain/budgets";
import { numberToCents } from "@/domain/money";
import { cn } from "@/lib/utils";
import type { Category, CreditCard, Expense } from "@/types";

export interface CategoryBreakdownDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: Category | null;
  month: string;
  limitCents: number;
  spentWeightedCents: number;
  spentGrossCents: number;
  prevSpentWeightedCents: number;
  expenses: Expense[];
  cards?: CreditCard[];
}

export function CategoryBreakdownDialog({
  open,
  onOpenChange,
  category,
  month,
  limitCents,
  spentWeightedCents,
  spentGrossCents,
  prevSpentWeightedCents,
  expenses,
  cards = [],
}: CategoryBreakdownDialogProps) {
  const navigate = useNavigate();

  if (!category) return null;

  const remainingCents = limitCents - spentWeightedCents;
  const isExceeded = remainingCents < 0;
  const percentUsed = limitCents > 0 ? (spentWeightedCents / limitCents) * 100 : 0;

  // Comparativo com mês anterior
  const diffCents = spentWeightedCents - prevSpentWeightedCents;
  const diffPercent = prevSpentWeightedCents > 0 ? (diffCents / prevSpentWeightedCents) * 100 : null;

  // Ordena despesas da mais recente para a mais antiga
  const sortedExpenses = [...expenses].sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));

  const cardMap = new Map(cards.map((c) => [c.id, c.name]));

  const handleNavigateToTransactions = () => {
    onOpenChange(false);
    navigate(`/transacoes?categoria=${category.id}&mes=${month}`);
  };

  const handleNavigateToBudgets = () => {
    onOpenChange(false);
    navigate(`/orcamentos?categoria=${category.id}&mes=${month}`);
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={category.name}
      size="md"
      description={`Raio-X de ${category.name} em ${monthLabel(month)}`}
      headerActions={
        <div className="flex items-center gap-2">
          <CategoryIcon icon={category.icon} color={category.color} className="size-5 shrink-0" />
        </div>
      }
      footer={
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between w-full gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleNavigateToTransactions}
            className="w-full sm:w-auto gap-1.5 text-xs font-medium cursor-pointer"
          >
            <span>Ver no extrato</span>
            <ArrowUpRight className="size-3.5 text-muted-foreground" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleNavigateToBudgets}
            className="w-full sm:w-auto gap-1.5 text-xs font-medium cursor-pointer"
          >
            <Target className="size-3.5" aria-hidden="true" />
            <span>{limitCents > 0 ? "Ajustar limite" : "Definir orçamento"}</span>
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Card Consolidado da Categoria */}
        <div className="flex flex-col gap-3 rounded-xl bg-surface-hover/40 border border-border/60 p-3.5 sm:p-4">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] font-medium text-muted-foreground">Total considerado no mês</span>
              <div className="flex items-baseline gap-2 flex-wrap">
                <MoneyText
                  cents={spentWeightedCents}
                  tone="default"
                  className="text-2xl font-bold tracking-tight text-foreground"
                />
                {spentGrossCents !== spentWeightedCents ? (
                  <span className="text-xs text-muted-foreground font-normal">
                    (total bruto: <MoneyText cents={spentGrossCents} tone="default" className="text-muted-foreground font-medium" />)
                  </span>
                ) : null}
              </div>
            </div>

            {limitCents > 0 ? (
              <Badge
                variant={percentUsed > 100 ? "critical" : percentUsed >= 85 ? "warning" : "positive"}
                size="xs"
              >
                {Math.round(percentUsed)}% do teto
              </Badge>
            ) : (
              <Badge variant="muted" size="xs">
                Sem teto
              </Badge>
            )}
          </div>

          {/* Barra de Progresso do Orçamento Individual */}
          {limitCents > 0 ? (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs min-w-0">
                <span className="text-muted-foreground">
                  {isExceeded ? (
                    <span className="text-critical-strong font-semibold">
                      Excedido em +<MoneyText cents={Math.abs(remainingCents)} tone="negative" />
                    </span>
                  ) : (
                    <span>
                      Resta <MoneyText cents={remainingCents} tone="default" className="font-semibold text-foreground" />
                    </span>
                  )}
                </span>
                <span className="text-xs text-muted-foreground">
                  de <MoneyText cents={limitCents} tone="default" className="text-muted-foreground" />
                </span>
              </div>
              <Progress
                value={Math.min(percentUsed, 100)}
                tone={progressTone(percentUsed)}
                className="h-1.5"
                aria-label={`Uso do orçamento de ${category.name}: ${Math.round(percentUsed)}%`}
              />
            </div>
          ) : null}

          {/* Comparativo com mês anterior */}
          {prevSpentWeightedCents > 0 && diffPercent !== null ? (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1 border-t border-border/40">
              {diffCents > 0 ? (
                <TrendingUp className="size-3.5 text-warning-strong shrink-0" aria-hidden="true" />
              ) : (
                <TrendingDown className="size-3.5 text-positive-strong shrink-0" aria-hidden="true" />
              )}
              <span>
                {diffCents > 0 ? "+" : ""}
                {Math.round(diffPercent)}% em relação ao mês anterior (
                <MoneyText cents={prevSpentWeightedCents} tone="default" className="text-muted-foreground" />)
              </span>
            </div>
          ) : null}
        </div>

        {/* Lista de Lançamentos do Mês */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs font-semibold text-foreground px-0.5">
            <span className="flex items-center gap-1.5">
              <ReceiptText className="size-3.5 text-muted-foreground" aria-hidden="true" />
              <span>Lançamentos ({sortedExpenses.length})</span>
            </span>
          </div>

          {sortedExpenses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center rounded-xl border border-dashed border-border/80 bg-surface-hover/20">
              <p className="text-xs text-muted-foreground">Nenhum lançamento registrado nesta categoria em {monthLabel(month)}.</p>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-border/40 rounded-xl border border-border/60 bg-surface">
              {sortedExpenses.map((expense) => {
                const isCard = Boolean(expense.card_id);
                const paymentLabel = isCard
                  ? (expense.card_id ? cardMap.get(expense.card_id) ?? "Cartão" : "Cartão")
                  : expense.payment_method === "pix"
                    ? "Pix"
                    : expense.payment_method === "debit"
                      ? "Débito"
                      : "Conta";

                const grossCents = numberToCents(expense.value);
                const weight = expense.report_weight ?? 1;
                const weightedCents = Math.round(grossCents * weight);
                const hasWeight = weight !== 1;

                return (
                  <div
                    key={expense.id}
                    className="flex items-center justify-between gap-3 p-2.5 sm:p-3 text-xs hover:bg-surface-hover/40 transition-colors"
                  >
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="font-medium text-foreground truncate">
                        {expense.description?.trim() || category.name}
                      </span>
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground flex-wrap">
                        <span>{formatDateBR(expense.date)}</span>
                        <span>•</span>
                        <span className="truncate">{paymentLabel}</span>
                        {expense.installments_total > 1 ? (
                          <>
                            <span>•</span>
                            <span className="font-medium text-foreground/80">
                              {expense.installment_number}/{expense.installments_total}
                            </span>
                          </>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-col items-end shrink-0 text-right">
                      {/* Valor Principal Ponderado */}
                      <MoneyText
                        cents={weightedCents}
                        tone="default"
                        className={cn(
                          "font-semibold tabular-nums text-xs sm:text-sm",
                          weight === 0 ? "text-muted-foreground font-normal" : "text-foreground"
                        )}
                      />

                      {/* Detalhe do Valor Bruto e Peso quando houver rateio */}
                      {hasWeight ? (
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-mono">
                          <span>Bruto:</span>
                          <MoneyText cents={grossCents} tone="default" className="text-[11px] text-muted-foreground" />
                          <span>({Math.round(weight * 100)}%)</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </ResponsiveDialog>
  );
}
