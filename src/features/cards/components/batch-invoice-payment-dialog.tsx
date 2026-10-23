import { useState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Alert, Button, Checkbox, DatePicker, Input, Modal, ModalFooter, MoneyText } from "@/components/ui";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
import { toISODate } from "@/domain/money";
import { invoiceDueDate, type CompetenceSummary } from "@/domain/cards";
import { useBatchCreateCardPayments } from "@/state";
import type { CreditCard } from "@/types";

export interface BatchInvoicePaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: CreditCard;
  unpaidSummaries: readonly CompetenceSummary[];
}

export function BatchInvoicePaymentDialog({
  open,
  onOpenChange,
  card,
  unpaidSummaries,
}: BatchInvoicePaymentDialogProps) {
  // Inicialmente todas as faturas anteriores com saldo aberto vêm marcadas
  const [selectedMonths, setSelectedMonths] = useState<Set<string>>(
    () => new Set(unpaidSummaries.map((s) => s.month)),
  );
  const [paymentDate, setPaymentDate] = useState(() => toISODate(new Date()));
  const [note, setNote] = useState("Quitação de faturas anteriores");
  const [error, setError] = useState<string | null>(null);

  const batchMutation = useBatchCreateCardPayments();

  const handleToggleMonth = (month: string) => {
    setSelectedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(month)) {
        next.delete(month);
      } else {
        next.add(month);
      }
      return next;
    });
  };

  const handleSelectAll = (select: boolean) => {
    if (select) {
      setSelectedMonths(new Set(unpaidSummaries.map((s) => s.month)));
    } else {
      setSelectedMonths(new Set());
    }
  };

  const selectedSummaries = unpaidSummaries.filter((s) => selectedMonths.has(s.month));
  const totalCents = selectedSummaries.reduce((acc, s) => acc + s.saldoCents, 0);

  const handleSubmit = async () => {
    if (selectedSummaries.length === 0) return;
    setError(null);

    const payload = selectedSummaries.map((s) => ({
      cardId: card.id,
      competenceMonth: s.month,
      amount: s.saldoCents / 100,
      date: paymentDate,
      note: note.trim() || null,
    }));

    try {
      await batchMutation.mutateAsync(payload);
      triggerSensory("success");
      onOpenChange(false);
    } catch (err) {
      triggerSensory("destructive");
      setError(getErrorMessage(err));
    }
  };

  const isAllSelected = selectedMonths.size === unpaidSummaries.length && unpaidSummaries.length > 0;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={`Quitar Faturas Anteriores — ${card.name}`}
      description="Regularize o histórico de faturas passadas já quitadas na vida real, zerando pendências acumuladas."
      size="lg"
    >
      <div className="flex flex-col gap-4 pt-2">
        {error && (
          <Alert variant="error">
            <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </Alert>
        )}

        <div className="flex items-center justify-between text-xs text-muted-foreground pb-1 border-b border-border/60">
          <Checkbox
            id="select-all-invoices"
            checked={isAllSelected}
            onCheckedChange={handleSelectAll}
            label={isAllSelected ? "Desmarcar todas" : "Selecionar todas"}
          />
          <span>
            {selectedMonths.size} de {unpaidSummaries.length} selecionada(s)
          </span>
        </div>

        <div className="flex max-h-60 flex-col gap-2 overflow-y-auto pr-1">
          {unpaidSummaries.map((s) => {
            const isChecked = selectedMonths.has(s.month);
            const dueDate = invoiceDueDate(s.month, card.due_day);
            const [y, m] = s.month.split("-");
            const labelMonth = `${m}/${y}`;

            return (
              <div
                key={s.month}
                onClick={() => handleToggleMonth(s.month)}
                className="flex cursor-pointer items-center justify-between rounded-lg border border-border/70 bg-surface p-3 transition-colors hover:bg-surface-hover"
              >
                <div className="flex items-center gap-3">
                  <Checkbox
                    id={`invoice-${s.month}`}
                    checked={isChecked}
                    onCheckedChange={() => handleToggleMonth(s.month)}
                    aria-label={`Fatura ${labelMonth}`}
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-foreground">
                      Fatura {labelMonth}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Venceu em {dueDate.slice(8, 10)}/{dueDate.slice(5, 7)}/{dueDate.slice(0, 4)}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-sm font-semibold tabular-nums text-foreground">
                    <MoneyText cents={s.saldoCents} tone="default" />
                  </div>
                  <span className="text-[10px] text-muted-foreground">Saldo pendente</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2 border-t border-border/60">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-foreground">
              Data da quitação
            </span>
            <DatePicker
              value={paymentDate}
              onChange={setPaymentDate}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="batch-payment-note" className="text-xs font-semibold text-foreground">
              Anotação <span className="text-muted-foreground font-normal">(opcional)</span>
            </label>
            <Input
              id="batch-payment-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex.: Quitação de faturas anteriores"
            />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-surface-hover/70 p-3 mt-1">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">Total a regularizar:</span>
            <span className="text-base font-bold text-foreground tabular-nums">
              <MoneyText cents={totalCents} tone="default" />
            </span>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            {selectedMonths.size} fatura(s) selecionada(s)
          </div>
        </div>

        <ModalFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={batchMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={handleSubmit}
            disabled={selectedSummaries.length === 0 || batchMutation.isPending}
          >
            {batchMutation.isPending ? (
              "Quitando faturas..."
            ) : (
              <>
                <CheckCircle2 className="size-4 mr-1.5" aria-hidden="true" />
                Quitar {selectedSummaries.length} fatura(s)
              </>
            )}
          </Button>
        </ModalFooter>
      </div>
    </Modal>
  );
}
