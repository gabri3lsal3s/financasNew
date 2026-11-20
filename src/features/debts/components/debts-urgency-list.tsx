import { useMemo } from "react";
import { AlertCircle, Check, ChevronDown, ChevronUp, HandCoins, Plus } from "lucide-react";
import { Badge, Button, EmptyState, Skeleton } from "@/components/ui";
import { HighlightRow, KpiCard, KpiGrid } from "@/components/modules";
import { CalculationMemoryModal } from "@/components/modules/calculation-memory";
import { buildDebtsSummaryBreakdown } from "@/domain/calculation-memory";
import { debtStatus, type DebtsSummary } from "@/domain/debts";
import { monthLabel } from "@/lib/date";
import type { Debt } from "@/types";
import { DebtRow } from "./debt-row";

export interface DebtsUrgencyListProps {
  type: "payable" | "receivable";
  list: Debt[];
  totalDebtsCount: number;
  debtsSummary: DebtsSummary;
  isLoading: boolean;
  today: string;
  thisMonth: string;
  highlightId: string | null;
  showPaid: boolean;
  onToggleShowPaid: () => void;
  onCreateNew: () => void;
  onSettle: (debt: Debt) => void;
  onUnsettle: (debt: Debt) => void;
  onEdit: (debt: Debt) => void;
}

/** Lista contas a pagar ou receber agrupadas por urgência (atrasadas, mês atual, futuras, quitadas). */
export function DebtsUrgencyList({
  type,
  list,
  totalDebtsCount,
  debtsSummary,
  isLoading,
  today,
  thisMonth,
  highlightId,
  showPaid,
  onToggleShowPaid,
  onCreateNew,
  onSettle,
  onUnsettle,
  onEdit,
}: DebtsUrgencyListProps) {
  const overdueOrToday: Debt[] = [];
  const thisMonthList: Debt[] = [];
  const futureList: Debt[] = [];
  const paidList: Debt[] = [];

  for (const debt of list) {
    const status = debtStatus(debt.due_date, debt.paid_at, today);
    if (status === "paid") {
      paidList.push(debt);
    } else if (status === "overdue" || status === "due_today") {
      overdueOrToday.push(debt);
    } else if (debt.due_date.slice(0, 7) === thisMonth) {
      thisMonthList.push(debt);
    } else {
      futureList.push(debt);
    }
  }

  overdueOrToday.sort((a, b) => a.due_date.localeCompare(b.due_date));
  thisMonthList.sort((a, b) => a.due_date.localeCompare(b.due_date));
  futureList.sort((a, b) => a.due_date.localeCompare(b.due_date));
  paidList.sort((a, b) => (b.paid_at ?? b.due_date).localeCompare(a.paid_at ?? a.due_date));

  const hasPending = overdueOrToday.length > 0 || thisMonthList.length > 0 || futureList.length > 0;
  const isPaidVisible =
    showPaid || !hasPending || Boolean(highlightId && paidList.some((d) => d.id === highlightId));

  const renderGroupRows = (items: Debt[]) => (
    <div className="flex flex-col gap-2.5">
      {items.map((debt) => (
        <HighlightRow key={debt.id} highlightId={highlightId} id={debt.id}>
          <DebtRow debt={debt} onSettle={onSettle} onUnsettle={onUnsettle} onEdit={onEdit} />
        </HighlightRow>
      ))}
    </div>
  );

  const debtsBreakdown = useMemo(() => {
    return buildDebtsSummaryBreakdown({
      payablePendingCents: debtsSummary.payablePendingCents,
      receivablePendingCents: debtsSummary.receivablePendingCents,
      netPendingCents: debtsSummary.netPendingCents,
      pendingCount: debtsSummary.pendingCount,
      paidCount: debtsSummary.paidCount,
    });
  }, [
    debtsSummary.netPendingCents,
    debtsSummary.paidCount,
    debtsSummary.payablePendingCents,
    debtsSummary.pendingCount,
    debtsSummary.receivablePendingCents,
  ]);

  return (
    <div
      data-tour={type === "payable" ? "debts-payable-section" : "debts-receivable-section"}
      className="flex flex-col gap-6"
    >
      {!isLoading && totalDebtsCount > 0 && (
        <KpiGrid columns={3}>
          <KpiCard
            label="A pagar"
            cents={debtsSummary.payablePendingCents}
            tone="negative"
            action={<CalculationMemoryModal breakdown={debtsBreakdown} />}
          />
          <KpiCard
            label="A receber"
            cents={debtsSummary.receivablePendingCents}
            tone="positive"
            action={<CalculationMemoryModal breakdown={debtsBreakdown} />}
          />
          <KpiCard
            label="Saldo pendente"
            cents={debtsSummary.netPendingCents}
            tone={debtsSummary.netPendingCents >= 0 ? "positive" : "negative"}
            action={<CalculationMemoryModal breakdown={debtsBreakdown} />}
          />
        </KpiGrid>
      )}

      {isLoading ? (
        <div className="flex flex-col gap-3" aria-hidden="true">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-border/80 bg-surface shadow-xs"
            >
              <div className="flex items-center gap-3">
                <Skeleton className="size-9 rounded-xl shrink-0" />
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-4 w-32 sm:w-44" />
                  <Skeleton className="h-3 w-24 sm:w-32" />
                </div>
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-0 border-border/80">
                <div className="flex flex-col items-start sm:items-end gap-1">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-8 w-20 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={<HandCoins className="size-6" aria-hidden="true" />}
          title={type === "payable" ? "Nenhuma conta a pagar" : "Nenhuma conta a receber"}
          description={
            type === "payable"
              ? "Cadastre contas a pagar para acompanhar vencimentos e quitações."
              : "Cadastre contas a receber para acompanhar valores a receber."
          }
          action={
            <Button onClick={onCreateNew} className="gap-1.5">
              <Plus className="size-4" aria-hidden="true" />
              {type === "payable" ? "Nova conta a pagar" : "Nova conta a receber"}
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-6">
          {overdueOrToday.length > 0 && (
            <section aria-label="Contas atrasadas e vencendo hoje" className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="size-3.5 shrink-0 text-critical-strong" aria-hidden="true" />
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-critical-strong">
                    Atrasadas & Vencendo Hoje
                  </h2>
                </div>
                <Badge variant="critical" size="xs">
                  {overdueOrToday.length}
                </Badge>
              </div>
              {renderGroupRows(overdueOrToday)}
            </section>
          )}

          {thisMonthList.length > 0 && (
            <section aria-label="Contas do mês atual" className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Vencimento em {monthLabel(thisMonth)}
                </h2>
                <span className="text-xs text-muted-foreground font-mono font-medium tabular-nums">
                  {thisMonthList.length} {thisMonthList.length === 1 ? "conta" : "contas"}
                </span>
              </div>
              {renderGroupRows(thisMonthList)}
            </section>
          )}

          {futureList.length > 0 && (
            <section aria-label="Próximos vencimentos" className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Próximos Vencimentos
                </h2>
                <span className="text-xs text-muted-foreground font-mono font-medium tabular-nums">
                  {futureList.length} {futureList.length === 1 ? "conta" : "contas"}
                </span>
              </div>
              {renderGroupRows(futureList)}
            </section>
          )}

          {paidList.length > 0 && (
            <section aria-label="Histórico de quitadas" className="flex flex-col gap-2.5 pt-1">
              {hasPending ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  sensoryIntent="selection"
                  onClick={onToggleShowPaid}
                  className="flex items-center justify-between h-auto min-h-11 sm:min-h-9 py-2.5 px-3.5 text-xs text-muted-foreground hover:text-foreground border border-dashed border-border/80 rounded-xl bg-surface transition-colors"
                  aria-expanded={isPaidVisible}
                >
                  <span className="flex items-center gap-2 font-medium">
                    <Check className="size-3.5 text-positive-strong" aria-hidden="true" />
                    Quitadas ({paidList.length})
                  </span>
                  {isPaidVisible ? (
                    <ChevronUp className="size-3.5" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="size-3.5" aria-hidden="true" />
                  )}
                </Button>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Quitadas ({paidList.length})
                  </h2>
                </div>
              )}

              {isPaidVisible && renderGroupRows(paidList)}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
