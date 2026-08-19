import { useState } from "react";
import { Alert, Button, DatePicker, Input, Modal, MoneyInput } from "@/components/ui";
import { getErrorMessage } from "@/services/errors";
import { toISODate } from "@/domain/money";
import { useCreateCardPayment, useCreateRefund } from "@/state";
import { BillRefinanceDialog } from "./bill-refinance-dialog";

export interface PaymentDialogProps {
  cardId: string;
  /** Competência da fatura (YYYY-MM) — pré-selecionada. */
  competenceMonth: string;
  mode: "payment" | "refund";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  openBalanceCents?: number;
}

interface PaymentDialogContentProps {
  cardId: string;
  competenceMonth: string;
  mode: "payment" | "refund";
  onClose: () => void;
  onOpenRefinance?: () => void;
}

function PaymentDialogContent({
  cardId,
  competenceMonth,
  mode,
  onClose,
  onOpenRefinance,
}: PaymentDialogContentProps) {
  const [cents, setCents] = useState(0);
  const [date, setDate] = useState(toISODate(new Date()));
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createPayment = useCreateCardPayment();
  const createRefund = useCreateRefund();
  const pending = createPayment.isPending || createRefund.isPending;

  const isRefund = mode === "refund";

  const handleSubmit = async () => {
    setError(null);
    const input = {
      cardId,
      competenceMonth,
      amount: cents / 100,
      date,
      note: note.trim() || null,
    };
    try {
      if (isRefund) {
        await createRefund.mutateAsync(input);
      } else {
        await createPayment.mutateAsync(input);
      }
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (cents > 0 && !pending) {
          void handleSubmit();
        }
      }}
      className="mt-4 flex flex-col gap-4"
    >
      {error ? <Alert variant="error">{error}</Alert> : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="payment-amount" className="text-sm font-medium">
          {isRefund ? "Valor do estorno" : "Valor pago"}
        </label>
        <MoneyInput
          id="payment-amount"
          cents={cents}
          onCentsChange={setCents}
          aria-label={isRefund ? "Valor do estorno" : "Valor do pagamento"}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Data</span>
        <DatePicker value={date} onValueChange={setDate} ariaLabel={isRefund ? "Data do estorno" : "Data do pagamento"} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="payment-note" className="text-sm font-medium">
          Observação (opcional)
        </label>
        <Input id="payment-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ex.: Parcial" />
      </div>

      {!isRefund && onOpenRefinance ? (
        <div className="pt-1 flex justify-start">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onOpenRefinance}
            className="text-xs text-primary"
          >
            Simular / Registrar parcelamento de fatura
          </Button>
        </div>
      ) : null}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={cents <= 0 || pending}>
          {pending ? "Salvando…" : isRefund ? "Confirmar estorno" : "Confirmar pagamento"}
        </Button>
      </div>
    </form>
  );
}

/** Pagamento ou estorno de fatura (§3.3.3). Estorno gera renda automática [REFUND]. */
export function PaymentDialog({
  cardId,
  competenceMonth,
  mode,
  open,
  onOpenChange,
  openBalanceCents = 0,
}: PaymentDialogProps) {
  const isRefund = mode === "refund";
  const [refinanceOpen, setRefinanceOpen] = useState(false);

  return (
    <>
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        title={isRefund ? "Registrar estorno" : "Registrar pagamento"}
        description={`Fatura de ${competenceMonth}`}
        showCalculator
      >
        {open ? (
          <PaymentDialogContent
            key={`${cardId}:${competenceMonth}:${mode}`}
            cardId={cardId}
            competenceMonth={competenceMonth}
            mode={mode}
            onClose={() => onOpenChange(false)}
            onOpenRefinance={() => {
              onOpenChange(false);
              setRefinanceOpen(true);
            }}
          />
        ) : null}
      </Modal>

      <BillRefinanceDialog
        cardId={cardId}
        competenceMonth={competenceMonth}
        remainingBalanceCents={openBalanceCents}
        open={refinanceOpen}
        onOpenChange={setRefinanceOpen}
      />
    </>
  );
}
