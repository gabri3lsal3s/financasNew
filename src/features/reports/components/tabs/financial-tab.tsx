import { type Dispatch, type SetStateAction } from "react";
import { Link } from "react-router";
import { ArrowRight, Landmark, Printer, Sparkles } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui";
import { DatePicker } from "@/components/ui/date-picker";
import { MoneyText } from "@/components/ui/money-text";
import { MonthPicker, YearPicker, ReportTable } from "@/components/modules";
import { PAYMENT_METHOD_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import {
  WEEKDAY_LABELS,
  mondayFirstWeekday,
  type CategoryTotal,
  type PaymentMethodTotal,
  type WeekdayTotal,
} from "@/domain/reports";
import type { Expense } from "@/types";

export type PeriodMode = "month" | "year" | "custom";
export type AggregationTab = "category" | "method" | "weekday";

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
  expenses: Expense[];
  onOpenFinancialReport: () => void;
  onShowDetail: (title: string, expenseList: Expense[]) => void;
}

/**
 * Aba "Finanças & DRE" — resumo de receitas/despesas, poupança e tabelas
 * de agregação por categoria, forma de pagamento e dia da semana.
 */
export function FinancialTab({
  mode,
  setMode,
  month,
  setMonth,
  year,
  setYear,
  customStart,
  setCustomStart,
  customEnd,
  setCustomEnd,
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
      {/* Linha do seletor de data — full-width, padrão das outras páginas */}
      {mode === "month" ? (
        <MonthPicker value={month} onValueChange={setMonth} />
      ) : mode === "year" ? (
        <YearPicker value={year} onValueChange={setYear} />
      ) : (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5 w-full py-1">
          <DatePicker value={customStart} onValueChange={setCustomStart} placeholder="Início" className="w-full sm:w-auto" />
          <span className="text-xs text-muted-foreground text-center">até</span>
          <DatePicker value={customEnd} onValueChange={setCustomEnd} placeholder="Fim" className="w-full sm:w-auto" />
        </div>
      )}

      {/* Linha de controles: descrição + alternador de periodicidade em pills (padrão Orçamentos) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground sm:text-sm">
          Acompanhe o fluxo de caixa, DRE pessoal e taxas de poupança da competência.
        </p>

        {/* Alternância de Periodicidade estilo pills (padrão Orçamentos) */}
        <div
          role="group"
          aria-label="Periodicidade do relatório"
          className="flex items-center gap-1.5 self-start sm:self-auto overflow-x-auto no-scrollbar scroll-smooth"
        >
          <Button
            type="button"
            size="sm"
            variant={mode === "month" ? "default" : "outline"}
            onClick={() => setMode("month")}
            className={cn(
              "shrink-0 gap-1.5 text-xs h-8 px-3.5 rounded-pill transition-all",
              mode === "month"
                ? "shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground",
            )}
            aria-pressed={mode === "month"}
            sensoryIntent="selection"
          >
            <span>Mensal</span>
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "year" ? "default" : "outline"}
            onClick={() => setMode("year")}
            className={cn(
              "shrink-0 gap-1.5 text-xs h-8 px-3.5 rounded-pill transition-all",
              mode === "year"
                ? "shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground",
            )}
            aria-pressed={mode === "year"}
            sensoryIntent="selection"
          >
            <span>Anual</span>
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "custom" ? "default" : "outline"}
            onClick={() => setMode("custom")}
            className={cn(
              "shrink-0 gap-1.5 text-xs h-8 px-3.5 rounded-pill transition-all",
              mode === "custom"
                ? "shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground",
            )}
            aria-pressed={mode === "custom"}
            sensoryIntent="selection"
          >
            <span>Personalizado</span>
          </Button>
        </div>
      </div>
      {/* Card Dossiê Executivo A4 de Finanças & DRE */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-border/80 bg-surface/90 p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Landmark className="size-5 text-muted-foreground shrink-0" aria-hidden="true" />
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
              sensoryIntent="selection"
              onClick={() => {
                setAggregationTab("category");
              }}
              className="px-2 sm:px-3 text-xs justify-center"
            >
              Categorias
            </Button>
            <Button
              type="button"
              variant={aggregationTab === "method" ? "default" : "outline"}
              size="sm"
              sensoryIntent="selection"
              onClick={() => {
                setAggregationTab("method");
              }}
              className="px-2 sm:px-3 text-xs justify-center"
            >
              Formas de Pgto
            </Button>
            <Button
              type="button"
              variant={aggregationTab === "weekday" ? "default" : "outline"}
              size="sm"
              sensoryIntent="selection"
              onClick={() => {
                setAggregationTab("weekday");
              }}
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

      {/* Atalho Contextual para o Radar de Insights */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-xl border border-border/80 bg-surface shadow-xs mt-1">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-hover text-muted-foreground border border-border/60">
            <Sparkles className="size-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground">Radar de Inteligência & Insights</p>
            <p className="text-[11px] text-muted-foreground">Consulte diagnósticos preditivos, assinaturas recorrentes e oportunidades de economia na Central de Insights.</p>
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
