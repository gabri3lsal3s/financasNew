import { useState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import {
  Alert,
  Button,
  Checkbox,
  DatePicker,
  FormField,
  Input,
  Modal,
  ModalFooter,
  MoneyText,
} from "@/components/ui";
import { invoiceDueDate, type CompetenceSummary } from "@/domain/cards";
import { toISODate } from "@/domain/money";
import { formatDateBR } from "@/lib/date";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
import { useBatchCreateCardPayments } from "@/state";
import type { CreditCard } from "@/types";

export interface BatchInvoicePaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: CreditCard;
  unpaidSummaries: readonly CompetenceSummary[];
}

function BatchInvoicePaymentContent({
  open,
  onOpenChange,
  card,
  unpaidSummaries,
}: BatchInvoicePaymentDialogProps) {
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
      if (next.has(month)) next.delete(month);
      else next.add(month);
      return next;
    });
  };

  const handleSelectAll = (select: boolean) => {
    setSelectedMonths(select ? new Set(unpaidSummaries.map((s) => s.month)) : new Set());
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
      triggerSensory("error");
      setError(getErrorMessage(err));
    }
  };

  const isAllSelected =
    selectedMonths.size === unpaidSummaries.length && unpaidSummaries.length > 0;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={`Quitar Faturas Anteriores — ${card.name}`}
      description="Regularize o histórico de faturas passadas já quitadas na vida real, zerando pendências acumuladas."
      size="lg"
      footer={
        <ModalFooter borderless>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={batchMutation.isPending}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="default"
            sensoryIntent={false}
            onClick={() => void handleSubmit()}
            disabled={selectedSummaries.length === 0 || batchMutation.isPending}
            aria-label={`Quitar ${selectedSummaries.length} fatura(s)`}
          >
            {batchMutation.isPending ? (
              "Quitando…"
            ) : (
              <>
                <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
                <span className="hidden sm:inline">Quitar {selectedSummaries.length} fatura(s)</span>
                <span className="sm:hidden">Quitar ({selectedSummaries.length})</span>
              </>
            )}
          </Button>
        </ModalFooter>
      }
    >
      <div className="flex flex-col gap-4 pt-2">
        {error ? (
          <Alert variant="error">
            <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </Alert>
        ) : null}

        <div className="flex items-center justify-between text-xs text-muted-foreground pb-2 border-b border-border/80">
          <Checkbox
            id="select-all-invoices"
            checked={isAllSelected}
            onCheckedChange={handleSelectAll}
            label={isAllSelected ? "Desmarcar todas" : "Selecionar todas"}
          />
          <span>{selectedMonths.size} de {unpaidSummaries.length} selecionada(s)</span>
        </div>

        <div className="flex flex-col gap-2">
          {unpaidSummaries.map((s) => {
            const isChecked = selectedMonths.has(s.month);
            const dueDate = invoiceDueDate(s.month, card.due_day);
            const [y, m] = s.month.split("-");
            const labelMonth = `${m}/${y}`;
            const checkboxId = `invoice-${s.month}`;

            return (
              <div
                key={s.month}
                className="flex items-center gap-3 rounded-xl border border-border/80 bg-surface p-3 transition-colors hover:bg-surface-hover"
              >
                <Checkbox
                  id={checkboxId}
                  checked={isChecked}
                  onCheckedChange={() => handleToggleMonth(s.month)}
                  aria-label={`Fatura ${labelMonth}`}
                />
                <label
                  htmlFor={checkboxId}
                  className="flex flex-1 min-w-0 cursor-pointer items-center justify-between gap-3 select-none"
                >
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium text-foreground">Fatura {labelMonth}</span>
                    <span className="text-[11px] text-muted-foreground">
                      Venceu em {formatDateBR(dueDate)}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <MoneyText cents={s.saldoCents} tone="default" className="text-sm font-semibold" />
                    <span className="block text-[10px] text-muted-foreground">Saldo pendente</span>
                  </div>
                </label>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2 border-t border-border/80">
          <FormField label="Data da quitação" htmlFor="batch-payment-date">
            <DatePicker id="batch-payment-date" value={paymentDate} onValueChange={setPaymentDate} ariaLabel="Data da quitação" />
          </FormField>
          <FormField label="Anotação" htmlFor="batch-payment-note" optional>
            <Input
              id="batch-payment-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex.: Quitação de faturas anteriores"
            />
          </FormField>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-border/80 bg-surface-raised p-3">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">Total a regularizar:</span>
            <MoneyText cents={totalCents} tone="default" className="text-base font-bold" />
          </div>
          <div className="text-right text-xs text-muted-foreground">
            {selectedMonths.size} fatura(s) selecionada(s)
          </div>
        </div>
      </div>
    </Modal>
  );
}

export function BatchInvoicePaymentDialog(props: BatchInvoicePaymentDialogProps) {
  if (!props.open) return null;
  return <BatchInvoicePaymentContent key={props.card.id} {...props} />;
}
