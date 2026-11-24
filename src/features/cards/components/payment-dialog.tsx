import { useId, useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
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
  Select,
} from "@/components/ui";
import { RESERVED_CHARGES_CATEGORY_NAME } from "@/domain/budgets";
import { toISODate } from "@/domain/money";
import { monthLabel } from "@/lib/date";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
import {
  useCategories,
  useCreateCardPayment,
  useCreateRefund,
  usePayCardBillWithCharges,
  type CardBillChargeItem,
} from "@/state";
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

  // Seção de encargos (juros, multa, IOF, tarifas)
  const [showCharges, setShowCharges] = useState(false);
  const [interestCents, setInterestCents] = useState(0);
  const [fineCents, setFineCents] = useState(0);
  const [taxCents, setTaxCents] = useState(0);
  const [feeCents, setFeeCents] = useState(0);
  const [chargeCompetenceMode, setChargeCompetenceMode] = useState<"current" | "next">("current");

  const totalChargesCents = interestCents + fineCents + taxCents + feeCents;

  const expenseCategories = useCategories("expense");
  const categories = useMemo(() => expenseCategories.data ?? [], [expenseCategories.data]);

  const defaultChargeCategoryId = useMemo(() => {
    if (categories.length === 0) return "";
    const reserved = categories.find((c) => c.is_reserved && c.name === RESERVED_CHARGES_CATEGORY_NAME);
    if (reserved) return reserved.id;
    const byName = categories.find((c) => c.name.toLowerCase().includes("tarifas e encargos"));
    if (byName) return byName.id;
    const match = categories.find((c) => /juros|tarifa|banc|cart|finan/i.test(c.name));
    return match ? match.id : (categories[0]?.id ?? "");
  }, [categories]);

  const effectiveChargeCategoryId = defaultChargeCategoryId;

  const isZeroOrPaid = !isRefund && openBalanceCents <= 0;
  const createPayment = useCreateCardPayment();
  const createRefund = useCreateRefund();
  const payWithCharges = usePayCardBillWithCharges();
  const pending = createPayment.isPending || createRefund.isPending || payWithCharges.isPending;

  const handleSubmit = async () => {
    setError(null);
    try {
      if (isRefund) {
        await createRefund.mutateAsync({
          cardId,
          competenceMonth,
          amount: cents / 100,
          date,
          note: note.trim() || null,
        });
        triggerSensory("success");
        onOpenChange(false);
        return;
      }

      if (showCharges && totalChargesCents > 0) {
        if (!effectiveChargeCategoryId) {
          triggerSensory("error");
          setError("Selecione uma categoria para os encargos da fatura.");
          return;
        }

        const chargesList: CardBillChargeItem[] = [];
        if (interestCents > 0) {
          chargesList.push({
            charge_kind: "interest",
            amount: interestCents / 100,
            description: "Juros",
            category_id: effectiveChargeCategoryId || undefined,
          });
        }
        if (fineCents > 0) {
          chargesList.push({
            charge_kind: "fine",
            amount: fineCents / 100,
            description: "Multa",
            category_id: effectiveChargeCategoryId || undefined,
          });
        }
        if (taxCents > 0) {
          chargesList.push({
            charge_kind: "tax",
            amount: taxCents / 100,
            description: "IOF",
            category_id: effectiveChargeCategoryId || undefined,
          });
        }
        if (feeCents > 0) {
          chargesList.push({
            charge_kind: "bank_fee",
            amount: feeCents / 100,
            description: "Tarifa",
            category_id: effectiveChargeCategoryId || undefined,
          });
        }

        await payWithCharges.mutateAsync({
          cardId,
          competenceMonth,
          nominalAmount: cents / 100,
          charges: chargesList,
          chargeCompetenceMode,
          paymentDate: date,
          note: note.trim() || null,
        });
        triggerSensory("success");
        onOpenChange(false);
        return;
      }

      await createPayment.mutateAsync({
        cardId,
        competenceMonth,
        amount: cents / 100,
        date,
        note: note.trim() || null,
      });
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

        {!isRefund ? (
          <div className="flex flex-col gap-2.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              sensoryIntent="selection"
              onClick={() => setShowCharges((prev) => !prev)}
              className="text-xs text-muted-foreground hover:text-foreground justify-between w-full border border-dashed border-border/80 px-3 py-2 h-auto"
            >
              <span>Incluir encargos nesta fatura (juros, multa, IOF, tarifas)</span>
              {showCharges ? <ChevronUp className="size-4 shrink-0" /> : <ChevronDown className="size-4 shrink-0" />}
            </Button>

            {showCharges ? (
              <div className="rounded-xl border border-border/80 bg-surface-raised p-3.5 flex flex-col gap-3">
                <div className="text-xs font-semibold text-foreground">
                  Detalhamento de encargos
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField label="Juros" htmlFor="charge-interest" optional>
                    <MoneyInput
                      id="charge-interest"
                      cents={interestCents}
                      onCentsChange={setInterestCents}
                      aria-label="Juros de fatura"
                    />
                  </FormField>

                  <FormField label="Multa por atraso" htmlFor="charge-fine" optional>
                    <MoneyInput
                      id="charge-fine"
                      cents={fineCents}
                      onCentsChange={setFineCents}
                      aria-label="Multa de fatura"
                    />
                  </FormField>

                  <FormField label="IOF / Tributos" htmlFor="charge-tax" optional>
                    <MoneyInput
                      id="charge-tax"
                      cents={taxCents}
                      onCentsChange={setTaxCents}
                      aria-label="IOF e tributos"
                    />
                  </FormField>

                  <FormField label="Tarifa / Encargos" htmlFor="charge-fee" optional>
                    <MoneyInput
                      id="charge-fee"
                      cents={feeCents}
                      onCentsChange={setFeeCents}
                      aria-label="Tarifas e encargos"
                    />
                  </FormField>
                </div>

                {totalChargesCents > 0 ? (
                  <>
                    <div className="pt-2 border-t border-border/60">
                      <FormField label="Destino dos encargos" htmlFor="charge-competence-mode">
                        <Select
                          id="charge-competence-mode"
                          value={chargeCompetenceMode}
                          onValueChange={(val) => setChargeCompetenceMode(val as "current" | "next")}
                          options={[
                            { value: "current", label: "Lançar nesta fatura (pago agora)" },
                            { value: "next", label: "Lançar na próxima fatura" },
                          ]}
                          ariaLabel="Destino dos encargos"
                        />
                      </FormField>
                    </div>

                    <div className="rounded-lg border border-border/80 bg-surface p-2.5 flex flex-col gap-1.5 text-xs">
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>Valor nominal da fatura:</span>
                        <MoneyText cents={cents} tone="default" className="text-xs font-medium" />
                      </div>
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>Total de encargos:</span>
                        <MoneyText cents={totalChargesCents} tone="default" className="text-xs font-semibold text-warning-strong" />
                      </div>
                      <div className="flex items-center justify-between text-foreground font-semibold pt-1.5 border-t border-border/80">
                        <span>Total a debitar hoje do caixa:</span>
                        <MoneyText
                          cents={chargeCompetenceMode === "current" ? cents + totalChargesCents : cents}
                          tone="default"
                          className="text-xs font-bold"
                        />
                      </div>
                      {chargeCompetenceMode === "next" ? (
                        <p className="text-[11px] text-muted-foreground pt-0.5">
                          Os encargos serão incluídos automaticamente na fatura do mês seguinte.
                        </p>
                      ) : null}
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

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
