import { type Dispatch, type SetStateAction } from "react";
import { Landmark, Printer } from "lucide-react";
import { Button } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { ReportTable } from "@/components/modules";
import { PAYMENT_METHOD_LABELS } from "@/lib/labels";
import {
  WEEKDAY_LABELS,
  mondayFirstWeekday,
  type CategoryTotal,
  type PaymentMethodTotal,
  type WeekdayTotal,
} from "@/domain/reports";
import type { Expense } from "@/types";

export type AggregationTab = "category" | "method" | "weekday";

export interface FinancialTabProps {
  grossIncomeBrutoCents: number;
  grossExpenseBrutoCents: number;
  grossSavingsBrutoCents: number;
  grossSavingsRatePercent: number | null;
  currentIncomeCents: number;
  currentExpenseCents: number;
  hasDualMetrics: boolean;
  aggregationTab: AggregationTab;
  setAggregationTab: Dispatch<SetStateAction<AggregationTab>>;
  byCategory: CategoryTotal[];
  byMethod: PaymentMethodTotal[];
  byWeekday: WeekdayTotal[];
  expenses: Expense[];
  onOpenFinancialReport: () => void;
  onShowDetail: (title: string, expenseList: Expense[]) => void;
}

/**
 * Aba "Finanças & DRE" — resumo de receitas/despesas, poupança e tabelas
 * de agregação por categoria, forma de pagamento e dia da semana.
 */
export function FinancialTab({
  grossIncomeBrutoCents,
  grossExpenseBrutoCents,
  grossSavingsBrutoCents,
  grossSavingsRatePercent,
  currentIncomeCents,
  currentExpenseCents,
  hasDualMetrics,
  aggregationTab,
  setAggregationTab,
  byCategory,
  byMethod,
  byWeekday,
  expenses,
  onOpenFinancialReport,
  onShowDetail,
}: FinancialTabProps) {
  return (
    <div className="flex flex-col gap-6">
      {/* Card Dossiê Executivo A4 de Finanças & DRE */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-border/80 bg-surface/90 p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Landmark className="size-5 text-primary-strong shrink-0" aria-hidden="true" />
            <h3 className="text-sm sm:text-base font-bold text-foreground">Dossiê Executivo de Finanças Pessoais & DRE (A4/PDF)</h3>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Demonstração do Resultado do Exercício (DRE Pessoal), fluxo de caixa líquido, taxa de poupança e detalhamento de gastos.
          </p>
        </div>
        <Button
          type="button"
          variant="default"
          onClick={onOpenFinancialReport}
          className="gap-2 shrink-0 w-full sm:w-auto justify-center"
        >
          <Printer className="size-4" aria-hidden="true" />
          Visualizar & Imprimir Dossiê A4
        </Button>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="rounded-2xl border border-border/80 bg-surface/90 p-4 shadow-xs flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Receitas Totais</span>
          <MoneyText cents={grossIncomeBrutoCents} tone="positive" animated className="text-lg sm:text-xl font-bold font-display" />
          {hasDualMetrics && (
            <span className="text-xs text-muted-foreground">
              Ponderada: <MoneyText cents={currentIncomeCents} tone="positive" className="inline text-xs font-medium" />
            </span>
          )}
        </div>
        <div className="rounded-2xl border border-border/80 bg-surface/90 p-4 shadow-xs flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Despesas Totais</span>
          <MoneyText cents={grossExpenseBrutoCents} tone="negative" animated className="text-lg sm:text-xl font-bold font-display" />
          {hasDualMetrics && (
            <span className="text-xs text-muted-foreground">
              Ponderada: <MoneyText cents={currentExpenseCents} tone="negative" className="inline text-xs font-medium" />
            </span>
          )}
        </div>
        <div className="rounded-2xl border border-border/80 bg-surface/90 p-4 shadow-xs flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Poupança do Período</span>
          <div className="flex items-center justify-between gap-2">
            <MoneyText
              cents={grossSavingsBrutoCents}
              tone={grossSavingsBrutoCents >= 0 ? "positive" : "negative"}
              animated
              className="text-lg sm:text-xl font-bold font-display"
            />
            <span className="text-xs font-semibold text-muted-foreground shrink-0">
              {grossSavingsRatePercent !== null ? `${grossSavingsRatePercent.toFixed(1)}%` : "—"}
            </span>
          </div>
          {hasDualMetrics && (
            <span className="text-xs text-muted-foreground">
              Ponderado:{" "}
              <MoneyText
                cents={currentIncomeCents - currentExpenseCents}
                tone={currentIncomeCents >= currentExpenseCents ? "positive" : "negative"}
                className="inline text-xs font-medium"
              />
            </span>
          )}
        </div>
      </div>

      {/* Agregações */}
      <div className="rounded-2xl border border-border/80 bg-surface/90 p-4 shadow-xs flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-foreground">Detalhamento de Despesas</h3>
          <div className="grid grid-cols-3 sm:flex gap-1.5 w-full sm:w-auto">
            <Button
              type="button"
              variant={aggregationTab === "category" ? "default" : "outline"}
              size="sm"
              onClick={() => setAggregationTab("category")}
              className="px-2 sm:px-3 text-xs justify-center"
            >
              Categorias
            </Button>
            <Button
              type="button"
              variant={aggregationTab === "method" ? "default" : "outline"}
              size="sm"
              onClick={() => setAggregationTab("method")}
              className="px-2 sm:px-3 text-xs justify-center"
            >
              Formas de Pgto
            </Button>
            <Button
              type="button"
              variant={aggregationTab === "weekday" ? "default" : "outline"}
              size="sm"
              onClick={() => setAggregationTab("weekday")}
              className="px-2 sm:px-3 text-xs justify-center"
            >
              Dias da Semana
            </Button>
          </div>
        </div>

        {aggregationTab === "category" ? (
          <ReportTable
            title="Por Categoria"
            totalBrutoCents={grossExpenseBrutoCents}
            totalPonderadoCents={currentExpenseCents}
            totalCents={grossExpenseBrutoCents}
            rows={byCategory.map((c) => ({
              key: c.categoryId,
              label: c.name,
              brutoCents: c.brutoCents,
              ponderadoCents: c.ponderadoCents,
              valueCents: c.brutoCents,
              percent: grossExpenseBrutoCents > 0 ? (c.brutoCents / grossExpenseBrutoCents) * 100 : 0,
            }))}
            onRowClick={(row) => {
              const catExpenses = expenses.filter((e) => e.category_id === row.key);
              onShowDetail(
                `Despesas: ${typeof row.label === "string" ? row.label : "Categoria"}`,
                catExpenses,
              );
            }}
          />
        ) : aggregationTab === "method" ? (
          <ReportTable
            title="Por Forma de Pagamento"
            totalBrutoCents={grossExpenseBrutoCents}
            totalPonderadoCents={currentExpenseCents}
            totalCents={grossExpenseBrutoCents}
            rows={byMethod.map((m) => ({
              key: m.method,
              label: PAYMENT_METHOD_LABELS[m.method as keyof typeof PAYMENT_METHOD_LABELS] ?? m.method,
              brutoCents: m.brutoCents,
              ponderadoCents: m.ponderadoCents,
              valueCents: m.brutoCents,
              percent: grossExpenseBrutoCents > 0 ? (m.brutoCents / grossExpenseBrutoCents) * 100 : 0,
            }))}
            onRowClick={(row) => {
              const methodExpenses = expenses.filter((e) => (e.payment_method ?? "other") === row.key);
              onShowDetail(
                `Despesas: ${typeof row.label === "string" ? row.label : "Forma de Pagamento"}`,
                methodExpenses,
              );
            }}
          />
        ) : (
          <ReportTable
            title="Por Dia da Semana"
            totalBrutoCents={grossExpenseBrutoCents}
            totalPonderadoCents={currentExpenseCents}
            totalCents={grossExpenseBrutoCents}
            rows={byWeekday.map((w) => ({
              key: String(w.weekday),
              label: WEEKDAY_LABELS[w.weekday],
              brutoCents: w.brutoCents,
              ponderadoCents: w.ponderadoCents,
              valueCents: w.brutoCents,
              percent: grossExpenseBrutoCents > 0 ? (w.brutoCents / grossExpenseBrutoCents) * 100 : 0,
            }))}
            onRowClick={(row) => {
              const weekdayNum = parseInt(row.key, 10);
              const weekdayExpenses = expenses.filter((e) => mondayFirstWeekday(e.date) === weekdayNum);
              onShowDetail(`Despesas: ${WEEKDAY_LABELS[weekdayNum] ?? "Dia"}`, weekdayExpenses);
            }}
          />
        )}
      </div>
    </div>
  );
}
