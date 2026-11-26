import { ArrowRight, CheckCircle2, Clock, Receipt, Undo2 } from "lucide-react";
import { Button, MoneyText, ResponsiveLabel } from "@/components/ui";
import { InvoiceStatusBadge, MonthPicker } from "@/components/modules";
import { shiftMonth, type CompetenceSummary, type InvoiceStatus } from "@/domain/cards";
import { currentMonth, monthLabel } from "@/lib/date";
import { cn } from "@/lib/utils";
import { triggerSensory } from "@/services/sensory";
import type { CreditCard } from "@/types";
import type { CardPaymentDialogMode } from "../hooks/use-cards-page-state";

export interface InvoiceCompetenceToolbarProps {
  effectiveMonth: string;
  onSelectMonth: (month: string) => void;
  selectedCard: CreditCard | null;
  summary: CompetenceSummary | undefined;
  invStatus: InvoiceStatus;
  getMonthStatus: (month: string) => InvoiceStatus;
  previousUnpaidSummaries: CompetenceSummary[];
  onOpenPayment: (mode: CardPaymentDialogMode) => void;
  onOpenBatchPayment: () => void;
  onOpenRollover?: () => void;
  onOpenCharge?: () => void;
}

/**
 * Barra de competência da fatura: seletor de mês, atalhos Anterior/Atual/Próxima,
 * ações de pagamento/estorno, limite disponível e alerta de faturas anteriores.
 */
export function InvoiceCompetenceToolbar({
  effectiveMonth,
  onSelectMonth,
  selectedCard,
  summary,
  invStatus,
  getMonthStatus,
  previousUnpaidSummaries,
  onOpenPayment,
  onOpenBatchPayment,
  onOpenRollover,
  onOpenCharge,
}: InvoiceCompetenceToolbarProps) {
  const currMonth = currentMonth();
  const prevMonth = shiftMonth(currMonth, -1);
  const nextMonth = shiftMonth(currMonth, 1);

  const quickMonths = [
    { month: prevMonth, label: "Anterior" },
    { month: currMonth, label: "Atual" },
    { month: nextMonth, label: "Próxima" },
  ] as const;

  const availableLimitCents =
    selectedCard && selectedCard.credit_limit !== null && selectedCard.credit_limit !== undefined && selectedCard.credit_limit > 0
      ? Math.max(0, Math.round(selectedCard.credit_limit * 100) - (summary?.saldoBrutoCents ?? 0))
      : null;

  return (
    <>
      <MonthPicker value={effectiveMonth} onValueChange={onSelectMonth} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Seletor rápido em cards (mobile) */}
        <div className="grid grid-cols-3 gap-2 sm:hidden w-full" role="tablist" aria-label="Seletor rápido de faturas">
          {quickMonths.map((item) => {
            const active = effectiveMonth === item.month;
            return (
              <button
                key={item.month}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  triggerSensory("selection");
                  onSelectMonth(item.month);
                }}
                className={cn(
                  "flex flex-col items-center justify-center min-h-11 p-2 rounded-xl border transition-colors text-center cursor-pointer",
                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  active
                    ? "bg-surface-hover border-primary/50 shadow-xs ring-1 ring-primary/30"
                    : "bg-surface border-border/80 hover:bg-surface-hover/60 text-muted-foreground",
                )}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {item.label}
                </span>
                <span className="text-xs font-semibold text-foreground capitalize mt-0.5">
                  {monthLabel(item.month).split(" ")[0]}
                </span>
                <div className="mt-1">
                  <InvoiceStatusBadge status={getMonthStatus(item.month)} size="xs" />
                </div>
              </button>
            );
          })}
        </div>

        {/* Atalhos rápidos em pills (tablet e desktop) */}
        <div role="group" aria-label="Seletor rápido de faturas" className="hidden sm:flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {quickMonths.map((item) => {
            const active = effectiveMonth === item.month;
            return (
              <Button
                key={item.month}
                type="button"
                size="sm"
                variant={active ? "default" : "outline"}
                onClick={() => onSelectMonth(item.month)}
                className={cn(
                  "shrink-0 gap-1.5 rounded-xl transition-all",
                  active ? "shadow-xs font-semibold" : "text-muted-foreground hover:text-foreground",
                )}
                aria-pressed={active}
                sensoryIntent="selection"
              >
                <span>{item.label}</span>
                <span className="text-[11px] opacity-75 capitalize">
                  ({monthLabel(item.month).split(" ")[0]})
                </span>
              </Button>
            );
          })}
        </div>

        {/* Ações principais da fatura */}
        {selectedCard ? (
          <div
            className={cn(
              onOpenCharge ? "grid grid-cols-3 sm:flex" : "grid grid-cols-2 sm:flex",
              "sm:items-center gap-2 w-full sm:w-auto",
            )}
          >
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label="Estorno"
              title="Registrar estorno"
              onClick={() => onOpenPayment("refund")}
              className="gap-1.5 justify-center max-sm:min-h-11 max-sm:min-w-11"
            >
              <Undo2 className="size-3.5 shrink-0" aria-hidden="true" />
              <ResponsiveLabel short="Estorno" full="Estorno" iconOnlyBelow380 />
            </Button>
            {onOpenCharge ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label="Lançar encargo"
                title="Lançar encargo"
                onClick={onOpenCharge}
                className="gap-1.5 justify-center max-sm:min-h-11 max-sm:min-w-11"
              >
                <Receipt className="size-3.5 shrink-0" aria-hidden="true" />
                <ResponsiveLabel short="Encargo" full="Encargo" iconOnlyBelow380 />
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              aria-label="Registrar pagamento"
              title="Registrar pagamento"
              onClick={() => onOpenPayment("payment")}
              className="gap-1.5 justify-center shadow-xs max-sm:min-h-11 max-sm:min-w-11"
            >
              <CheckCircle2 className="size-3.5 shrink-0" aria-hidden="true" />
              <ResponsiveLabel short="Pagar" full="Registrar pagamento" iconOnlyBelow380 />
            </Button>
          </div>
        ) : null}
      </div>

      {/* Status da fatura e limite disponível */}
      {selectedCard ? (
        <div className="flex flex-wrap items-center justify-between gap-2.5 px-0.5 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="font-medium">Status da fatura:</span>
            <InvoiceStatusBadge status={invStatus} size="sm" />
          </div>
          {availableLimitCents !== null && (
            <div className="flex items-center gap-1.5">
              <span>Limite disponível:</span>
              <span className="font-semibold text-foreground">
                <MoneyText cents={availableLimitCents} tone="default" />
              </span>
            </div>
          )}
        </div>
      ) : null}

      {/* Aviso de fatura vencida com opção de rolar saldo para o próximo mês */}
      {selectedCard && invStatus === "overdue" && (summary?.saldoBrutoCents ?? 0) > 0 && onOpenRollover ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-critical/35 bg-critical/5 text-xs text-foreground">
          <div className="flex items-center gap-2.5 min-w-0">
            <Clock className="size-4 shrink-0 text-critical-strong" aria-hidden="true" />
            <span>
              Esta fatura venceu com saldo em aberto de{" "}
              <MoneyText cents={summary!.saldoBrutoCents} tone="default" className="font-semibold" />.
              Se já pagou, registre o pagamento; caso contrário, role o saldo para o próximo mês.
            </span>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onOpenRollover}
            className="shrink-0 gap-1.5 self-start sm:self-auto border-critical/40 hover:bg-critical/10"
          >
            <span>Rolar para próxima fatura</span>
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Button>
        </div>
      ) : null}

      {/* Aviso inteligente de faturas anteriores em aberto */}
      {selectedCard && previousUnpaidSummaries.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-warning/40 bg-warning/5 text-xs text-foreground">
          <div className="flex items-center gap-2.5 min-w-0">
            <Clock className="size-4 shrink-0 text-warning-strong" aria-hidden="true" />
            <span>
              Identificamos <strong>{previousUnpaidSummaries.length} fatura(s) anterior(es)</strong> com saldo pendente de{" "}
              <MoneyText
                cents={previousUnpaidSummaries.reduce((a, b) => a + b.saldoCents, 0)}
                tone="default"
                className="font-semibold"
              />
              .
            </span>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onOpenBatchPayment}
            className="shrink-0 gap-1.5 self-start sm:self-auto border-warning/50 hover:bg-warning/10"
          >
            <CheckCircle2 className="size-3.5" aria-hidden="true" />
            <span>Quitar faturas anteriores</span>
          </Button>
        </div>
      )}
    </>
  );
}
