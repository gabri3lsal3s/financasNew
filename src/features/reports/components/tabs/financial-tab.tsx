import { type Dispatch, type SetStateAction } from "react";
import { Link } from "react-router";
import { ArrowRight, Landmark, Printer, Sparkles } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { cn } from "@/lib/utils";
import { formatPercent } from "@/services/masks";
import type { CategoryTotal, ChargeKindTotal, PaymentMethodTotal, WeekdayTotal } from "@/domain/reports";
import type { Expense } from "@/types";
import { FinancialExpensesBreakdownCard } from "./financial-expenses-breakdown-card";
import { FinancialPeriodToolbar } from "./financial-period-toolbar";

export type PeriodMode = "month" | "year" | "custom";
export type AggregationTab = "category" | "method" | "weekday" | "charges";

export interface FinancialTabProps {
  mode: PeriodMode;
  setMode: Dispatch<SetStateAction<PeriodMode>>;
  month: string;
  setMonth: (month: string) => void;
  year: number;
  setYear: (year: number) => void;
  customStart: string;
  setCustomStart: (start: string) => void;
  customEnd: string;
  setCustomEnd: (end: string) => void;
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
  byChargeKind?: ChargeKindTotal[];
  expenses: Expense[];
  onOpenFinancialReport: () => void;
  onShowDetail: (title: string, expenseList: Expense[]) => void;
}

/**
 * Aba "Finanças & DRE" — resumo de receitas/despesas, poupança e tabelas
 * de agregação por categoria, forma de pagamento e dia da semana.
 */
export function FinancialTab(props: FinancialTabProps) {
  const {
    mode, setMode, month, setMonth, year, setYear,
    customStart, setCustomStart, customEnd, setCustomEnd,
    grossIncomeBrutoCents, grossExpenseBrutoCents, grossSavingsBrutoCents,
    grossSavingsRatePercent, currentIncomeCents, currentExpenseCents,
    hasDualMetrics, aggregationTab, setAggregationTab,
    byCategory, byMethod, byWeekday, byChargeKind, expenses,
    onOpenFinancialReport, onShowDetail,
  } = props;

  return (
    <div className="flex flex-col gap-6">
      <FinancialPeriodToolbar
        mode={mode}
        setMode={setMode}
        month={month}
        setMonth={setMonth}
        year={year}
        setYear={setYear}
        customStart={customStart}
        setCustomStart={setCustomStart}
        customEnd={customEnd}
        setCustomEnd={setCustomEnd}
      />

      {/* Card Dossiê Executivo A4 de Finanças & DRE */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Landmark className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
            <h3 className="text-sm sm:text-base font-bold text-foreground">
              Dossiê Executivo de Finanças Pessoais & DRE (A4/PDF)
            </h3>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Demonstração do Resultado do Exercício (DRE Pessoal), fluxo de caixa líquido, taxa de poupança e detalhamento de gastos.
          </p>
        </div>
        <Button
          type="button"
          variant="default"
          onClick={onOpenFinancialReport}
          disabled={expenses.length === 0 && grossIncomeBrutoCents === 0}
          title={
            expenses.length === 0 && grossIncomeBrutoCents === 0
              ? "Não há receitas ou despesas no período para emissão do dossiê."
              : undefined
          }
          className="gap-2 shrink-0 w-full sm:w-auto justify-center"
        >
          <Printer className="size-4" aria-hidden="true" />
          Visualizar & Imprimir Dossiê A4
        </Button>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="rounded-2xl border border-border/80 bg-surface p-4 shadow-xs flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Receitas Totais</span>
          <MoneyText cents={grossIncomeBrutoCents} tone="positive" variant="hero" animated className="text-lg sm:text-xl font-bold font-display" />
          {hasDualMetrics && (
            <span className="text-xs text-muted-foreground">
              Ponderada: <MoneyText cents={currentIncomeCents} tone="positive" className="inline text-xs font-medium" />
            </span>
          )}
        </div>
        <div className="rounded-2xl border border-border/80 bg-surface p-4 shadow-xs flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Despesas Totais</span>
          <MoneyText cents={grossExpenseBrutoCents} tone="negative" variant="hero" animated className="text-lg sm:text-xl font-bold font-display" />
          {hasDualMetrics && (
            <span className="text-xs text-muted-foreground">
              Ponderada: <MoneyText cents={currentExpenseCents} tone="negative" className="inline text-xs font-medium" />
            </span>
          )}
        </div>
        <div className="rounded-2xl border border-border/80 bg-surface p-4 shadow-xs flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Poupança do Período</span>
          <div className="flex items-center justify-between gap-2">
            <MoneyText
              cents={grossSavingsBrutoCents}
              tone={grossSavingsBrutoCents >= 0 ? "positive" : "negative"}
              variant="hero"
              animated
              className="text-lg sm:text-xl font-bold font-display"
            />
            <span className="text-xs font-semibold text-muted-foreground shrink-0 font-mono tabular-nums whitespace-nowrap">
              {grossSavingsRatePercent !== null ? `${formatPercent(grossSavingsRatePercent)}%` : "—"}
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

      <FinancialExpensesBreakdownCard
        aggregationTab={aggregationTab}
        setAggregationTab={setAggregationTab}
        byCategory={byCategory}
        byMethod={byMethod}
        byWeekday={byWeekday}
        byChargeKind={byChargeKind}
        expenses={expenses}
        grossExpenseBrutoCents={grossExpenseBrutoCents}
        currentExpenseCents={currentExpenseCents}
        onShowDetail={onShowDetail}
      />

      {/* Atalho Contextual para o Radar de Insights */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-xl border border-border/80 bg-surface shadow-xs mt-1">
        <div className="flex items-center gap-2.5 min-w-0">
          <Sparkles className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground">Radar de Inteligência & Insights</p>
            <p className="text-[11px] text-muted-foreground">
              Consulte diagnósticos preditivos, assinaturas recorrentes e oportunidades de economia na Central de Insights.
            </p>
          </div>
        </div>
        <Link
          to="/insights"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "text-xs shrink-0 self-start sm:self-auto gap-1.5")}
        >
          <span>Abrir Insights</span>
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
