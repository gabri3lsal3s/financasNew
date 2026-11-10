import { Calendar, Check } from "lucide-react";
import { Button } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { DebtStatusBadge } from "@/components/modules";
import { debtStatus } from "@/domain/debts";
import { numberToCents } from "@/domain/money";
import { formatDateBR } from "@/lib/date";
import { triggerSensory } from "@/services/sensory";
import type { Debt } from "@/types";

export interface DebtRowProps {
  debt: Debt;
  onSettle: (debt: Debt) => void;
  onUnsettle: (debt: Debt) => void;
  onEdit: (debt: Debt) => void;
}

/**
 * Linha de dívida desacoplada — layout em 2 níveis claro e adaptado para mobile e desktop.
 */
export function DebtRow({ debt, onSettle, onUnsettle, onEdit }: DebtRowProps) {
  const status = debtStatus(debt.due_date, debt.paid_at);
  const isPaid = status === "paid";

  return (
    <div className="group flex flex-col gap-2.5 rounded-2xl border border-border/80 bg-surface/90 p-3.5 sm:p-4 shadow-xs transition-all hover:border-border hover:bg-surface">
      {/* Linha superior: Nome + Badge à esquerda, Valor à direita */}
      <div className="flex items-start justify-between gap-3 min-w-0">
        <button
          type="button"
          aria-label={`Editar ${debt.name}`}
          onClick={() => {
            triggerSensory("action");
            onEdit(debt);
          }}
          className="flex min-w-0 flex-1 items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md cursor-pointer active:scale-[0.99]"
        >
          <span className="truncate text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
            {debt.name}
          </span>
          {!isPaid ? <DebtStatusBadge status={status} /> : null}
        </button>

        <div className="shrink-0 text-right">
          <MoneyText
            cents={numberToCents(debt.amount)}
            variant="value"
            tone={debt.type === "receivable" ? "positive" : "negative"}
            className="text-sm sm:text-base font-bold"
          />
        </div>
      </div>

      {/* Linha inferior: Data de vencimento/quitação à esquerda, Ação à direita */}
      <div className="flex items-center justify-between gap-2 border-t border-border/40 pt-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5 truncate text-[11px] sm:text-xs">
          <Calendar className="size-3.5 shrink-0 text-muted-foreground/70" aria-hidden="true" />
          <span>
            {isPaid
              ? `Quitada em ${formatDateBR(debt.paid_at ?? debt.due_date)}`
              : `Vencimento: ${formatDateBR(debt.due_date)}`}
          </span>
          {debt.expense_id ? (
            <span className="hidden sm:inline text-muted-foreground/60">· vinculada a despesa</span>
          ) : null}
          {debt.installment_group_id ? (
            <span className="hidden sm:inline text-muted-foreground/60">· parcelamento/contrato</span>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center">
          {isPaid ? (
            <Button
              type="button"
              size="xs"
              variant="positive"
              onClick={() => onUnsettle(debt)}
              className="h-7 px-2.5 text-[11px]"
              aria-label={`Quitada (${debt.name}) — clique para desmarcar`}
              title={`Quitada (${debt.name}) — clique para desmarcar`}
            >
              <Check className="size-3.5" aria-hidden="true" />
              <span>Quitada</span>
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              aria-label={`Quitar ${debt.name}`}
              onClick={() => onSettle(debt)}
              className="h-7 px-2.5 text-[11px] sm:h-8 sm:px-3 sm:text-xs"
            >
              <Check className="size-3.5 mr-1" aria-hidden="true" />
              {debt.type === "receivable" ? "Receber" : "Quitar"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
