import { type Dispatch, type SetStateAction } from "react";
import { Link } from "react-router";
import { Landmark, Plus } from "lucide-react";
import { Button, buttonVariants, EmptyState } from "@/components/ui";
import { ReportTable } from "@/components/modules";
import { CHARGE_KIND_LABELS, PAYMENT_METHOD_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import {
  WEEKDAY_LABELS,
  mondayFirstWeekday,
  type CategoryTotal,
  type ChargeKindTotal,
  type PaymentMethodTotal,
  type WeekdayTotal,
} from "@/domain/reports";
import type { Expense } from "@/types";
import type { AggregationTab } from "./financial-tab";

export interface FinancialExpensesBreakdownCardProps {
  aggregationTab: AggregationTab;
  setAggregationTab: Dispatch<SetStateAction<AggregationTab>>;
  byCategory: CategoryTotal[];
  byMethod: PaymentMethodTotal[];
  byWeekday: WeekdayTotal[];
  byChargeKind?: ChargeKindTotal[];
  expenses: Expense[];
  grossExpenseBrutoCents: number;
  currentExpenseCents: number;
  onShowDetail: (title: string, expenseList: Expense[]) => void;
}

const AGGREGATION_OPTIONS: readonly { value: AggregationTab; label: string }[] = [
  { value: "category", label: "Categorias" },
  { value: "method", label: "Formas de Pgto" },
  { value: "weekday", label: "Dias da Semana" },
  { value: "charges", label: "Encargos" },
];

/** Painel de agregações de despesas por Categoria, Forma de Pagamento ou Dia da Semana. */
export function FinancialExpensesBreakdownCard({
  aggregationTab,
  setAggregationTab,
  byCategory,
  byMethod,
  byWeekday,
  byChargeKind = [],
  expenses,
  grossExpenseBrutoCents,
  currentExpenseCents,
  onShowDetail,
}: FinancialExpensesBreakdownCardProps) {
  return (
    <div className="rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">Detalhamento de Despesas</h3>
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth w-full sm:w-auto py-1 -my-1">
          {AGGREGATION_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              type="button"
              variant={aggregationTab === opt.value ? "default" : "outline"}
              size="sm"
              sensoryIntent="selection"
              aria-pressed={aggregationTab === opt.value}
              onClick={() => setAggregationTab(opt.value)}
              className="px-3 text-xs justify-center shrink-0 min-w-fit"
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {expenses.length === 0 ? (
        <EmptyState
          icon={<Landmark className="size-8 text-muted-foreground" aria-hidden="true" />}
          title="Nenhum lançamento no período"
          description="Registre receitas e despesas para gerar o detalhamento de consumo, DRE pessoal e análises por categoria."
          action={
            <Link
              to="/transacoes?novo=transacao"
              className={cn(buttonVariants({ variant: "default", size: "sm" }), "rounded-xl gap-2 cursor-pointer")}
            >
              <Plus className="size-4" aria-hidden="true" />
              <span>Novo Lançamento</span>
            </Link>
          }
        />
      ) : aggregationTab === "category" ? (
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
      ) : aggregationTab === "charges" ? (
        <ReportTable
          title="Por Tipo de Encargo"
          totalBrutoCents={grossExpenseBrutoCents}
          totalPonderadoCents={currentExpenseCents}
          totalCents={grossExpenseBrutoCents}
          rows={byChargeKind.map((c) => ({
            key: c.kind,
            label: CHARGE_KIND_LABELS[c.kind] ?? c.kind,
            brutoCents: c.brutoCents,
            ponderadoCents: c.ponderadoCents,
            valueCents: c.brutoCents,
            percent: grossExpenseBrutoCents > 0 ? (c.brutoCents / grossExpenseBrutoCents) * 100 : 0,
          }))}
          onRowClick={(row) => {
            const chargeExpenses = expenses.filter((e) => (e.charge_kind ?? "regular") === row.key);
            onShowDetail(
              `Encargos: ${typeof row.label === "string" ? row.label : "Tipo"}`,
              chargeExpenses,
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
  );
}
