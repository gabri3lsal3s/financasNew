import { useId, useState } from "react";
import {
  Alert,
  Button,
  DatePicker,
  FormField,
  Input,
  Modal,
  ModalFooter,
  MoneyInput,
  MoneyText,
} from "@/components/ui";
import { toISODate } from "@/domain/money";
import { monthLabel } from "@/lib/date";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
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

interface PaymentDialogContentProps extends PaymentDialogProps {
  onOpenRefinance?: () => void;
}

function PaymentDialogContent({
  cardId,
  competenceMonth,
  mode,
  open,
  onOpenChange,
  onOpenRefinance,
  openBalanceCents = 0,
}: PaymentDialogContentProps) {
  const formId = useId();
  const isRefund = mode === "refund";
  const initialCents = !isRefund && openBalanceCents > 0 ? openBalanceCents : 0;
  const [cents, setCents] = useState(initialCents);
  const [date, setDate] = useState(() => toISODate(new Date()));
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isZeroOrPaid = !isRefund && openBalanceCents <= 0;
  const createPayment = useCreateCardPayment();
  const createRefund = useCreateRefund();
  const pending = createPayment.isPending || createRefund.isPending;

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
      if (isRefund) await createRefund.mutateAsync(input);
      else await createPayment.mutateAsync(input);
      triggerSensory("success");
      onOpenChange(false);
    } catch (err) {
      triggerSensory("error");
      setError(getErrorMessage(err));
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={isRefund ? "Registrar estorno" : "Registrar pagamento"}
      description={`Fatura de ${monthLabel(competenceMonth)}`}
      size="md"
      showCalculator
      footer={
        <ModalFooter borderless>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form={formId}
            sensoryIntent={false}
            disabled={cents <= 0 || pending}
            aria-label={isRefund ? "Confirmar estorno" : "Confirmar pagamento"}
          >
            {pending ? (
              "Salvando…"
            ) : isRefund ? (
              <>
                <span className="hidden sm:inline">Confirmar estorno</span>
                <span className="sm:hidden">Estornar</span>
              </>
            ) : (
              <>
                <span className="hidden sm:inline">Confirmar pagamento</span>
                <span className="sm:hidden">Pagar</span>
              </>
            )}
          </Button>
        </ModalFooter>
      }
    >
      <form
        id={formId}
        onSubmit={(event) => {
          event.preventDefault();
          if (cents > 0 && !pending) void handleSubmit();
        }}
        className="mt-2 flex flex-col gap-4"
      >
        {error ? <Alert variant="error">{error}</Alert> : null}

        {isZeroOrPaid ? (
          <Alert variant="info">
            Esta fatura não possui saldo pendente no momento ou já foi quitada.
          </Alert>
        ) : null}

        {!isRefund && openBalanceCents > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground -mb-1">
            <span>
              Total pendente (boleto):{" "}
              <MoneyText cents={openBalanceCents} tone="default" className="text-xs font-semibold" />
            </span>
            {cents !== openBalanceCents ? (
              <button
                type="button"
                onClick={() => {
                  triggerSensory("selection");
                  setCents(openBalanceCents);
                }}
                className="font-medium text-primary-strong hover:underline cursor-pointer rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                Restaurar total
              </button>
            ) : (
              <span className="text-[11px] text-muted-foreground font-medium">
                Valor nominal (100%) pré-preenchido
              </span>
            )}
          </div>
        ) : null}

        <FormField label={isRefund ? "Valor do estorno" : "Valor pago"} htmlFor="payment-amount">
          <MoneyInput id="payment-amount" cents={cents} onCentsChange={setCents} aria-label={isRefund ? "Valor do estorno" : "Valor do pagamento"} />
        </FormField>

        <FormField label="Data" htmlFor="payment-date">
          <DatePicker id="payment-date" value={date} onValueChange={setDate} ariaLabel={isRefund ? "Data do estorno" : "Data do pagamento"} />
        </FormField>

        <FormField label="Observação" htmlFor="payment-note" optional>
          <Input id="payment-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ex.: Parcial" />
        </FormField>

        {!isRefund && onOpenRefinance ? (
          <div className="pt-1 flex justify-start">
            <Button type="button" variant="ghost" size="sm" sensoryIntent="selection" onClick={onOpenRefinance} className="text-xs text-primary-strong px-2">
              Simular / Registrar parcelamento de fatura
            </Button>
          </div>
        ) : null}
      </form>
    </Modal>
  );
}

/** Pagamento ou estorno de fatura (§3.3.3). Estorno gera renda automática [REFUND]. */
export function PaymentDialog(props: PaymentDialogProps) {
  const [refinanceOpen, setRefinanceOpen] = useState(false);

  return (
    <>
      {props.open ? (
        <PaymentDialogContent
          key={`${props.cardId}:${props.competenceMonth}:${props.mode}`}
          {...props}
          onOpenRefinance={() => {
            props.onOpenChange(false);
            setRefinanceOpen(true);
          }}
        />
      ) : null}

      <BillRefinanceDialog
        cardId={props.cardId}
        competenceMonth={props.competenceMonth}
        remainingBalanceCents={props.openBalanceCents ?? 0}
        open={refinanceOpen}
        onOpenChange={setRefinanceOpen}
      />
    </>
  );
}
