import { useId, useMemo, useState } from "react";
import {
  Alert,
  Button,
  FormField,
  Input,
  Modal,
  ModalFooter,
  MoneyInput,
  MoneyText,
} from "@/components/ui";
import { RESERVED_CHARGES_CATEGORY_NAME } from "@/domain/budgets";
import { shiftMonth } from "@/domain/cards";
import { monthLabel } from "@/lib/date";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
import {
  useCategories,
  useRolloverCardBill,
  type RolloverCardBillParams,
} from "@/state";

export interface BillRolloverDialogProps {
  cardId: string;
  cardName: string;
  competenceMonth: string; // YYYY-MM (fatura vencida)
  openBalanceCents: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function BillRolloverContent({
  cardId,
  cardName,
  competenceMonth,
  openBalanceCents,
  open,
  onOpenChange,
}: BillRolloverDialogProps) {
  const formId = useId();
  const nextMonth = shiftMonth(competenceMonth, 1);

  const [interestCents, setInterestCents] = useState(0);
  const [fineCents, setFineCents] = useState(0);
  const [taxCents, setTaxCents] = useState(0);
  const [feeCents, setFeeCents] = useState(0);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const expenseCategories = useCategories("expense");
  const rolloverMutation = useRolloverCardBill();
  const pending = rolloverMutation.isPending;

  const categories = useMemo(() => expenseCategories.data ?? [], [expenseCategories.data]);
  const defaultChargeCategoryId = useMemo(() => {
    if (categories.length === 0) return "";
    const reserved = categories.find(
      (c) => c.is_reserved && c.name === RESERVED_CHARGES_CATEGORY_NAME,
    );
    if (reserved) return reserved.id;
    const byName = categories.find((c) => c.name.toLowerCase().includes("tarifas e encargos"));
    if (byName) return byName.id;
    const match = categories.find((c) => /juros|tarifa|banc|cart|finan/i.test(c.name));
    return match ? match.id : (categories[0]?.id ?? "");
  }, [categories]);

  const totalChargesCents = interestCents + fineCents + taxCents + feeCents;
  const totalNextBillImpactCents = openBalanceCents + totalChargesCents;

  const handleConfirm = async () => {
    if (openBalanceCents <= 0 || pending) return;
    setError(null);

    const charges: NonNullable<RolloverCardBillParams["charges"]> = [];
    if (interestCents > 0) {
      charges.push({
        charge_kind: "interest",
        amount: interestCents / 100,
        description: "Juros de Rotativo",
        category_id: defaultChargeCategoryId || undefined,
      });
    }
    if (fineCents > 0) {
      charges.push({
        charge_kind: "fine",
        amount: fineCents / 100,
        description: "Multa por Atraso",
        category_id: defaultChargeCategoryId || undefined,
      });
    }
    if (taxCents > 0) {
      charges.push({
        charge_kind: "tax",
        amount: taxCents / 100,
        description: "IOF de Rotativo",
        category_id: defaultChargeCategoryId || undefined,
      });
    }
    if (feeCents > 0) {
      charges.push({
        charge_kind: "bank_fee",
        amount: feeCents / 100,
        description: "Tarifa Bancária",
        category_id: defaultChargeCategoryId || undefined,
      });
    }

    try {
      await rolloverMutation.mutateAsync({
        cardId,
        fromCompetenceMonth: competenceMonth,
        toCompetenceMonth: nextMonth,
        principalAmount: openBalanceCents / 100,
        charges,
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
      title="Rolar saldo para a próxima fatura"
      description={`${cardName} · ${monthLabel(competenceMonth)} para ${monthLabel(nextMonth)}`}
      size="md"
      showCalculator
      footer={
        <ModalFooter borderless>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form={formId}
            sensoryIntent={false}
            disabled={openBalanceCents <= 0 || pending}
          >
            {pending ? "Confirmando…" : "Confirmar rolagem"}
          </Button>
        </ModalFooter>
      }
    >
      <form
        id={formId}
        onSubmit={(e) => {
          e.preventDefault();
          void handleConfirm();
        }}
        className="mt-2 flex flex-col gap-4"
      >
        {error ? <Alert variant="error">{error}</Alert> : null}

        <div className="rounded-xl border border-border/80 bg-surface-raised p-3.5 flex flex-col gap-1.5 text-xs text-muted-foreground">
          <div className="flex items-center justify-between font-medium text-foreground">
            <span>Saldo residual a transferir:</span>
            <MoneyText cents={openBalanceCents} tone="default" className="text-xs font-semibold" />
          </div>
          <p className="leading-relaxed">
            O saldo não pago de <strong className="text-foreground">{monthLabel(competenceMonth)}</strong>{" "}
            será transferido para <strong className="text-foreground">{monthLabel(nextMonth)}</strong>{" "}
            sem duplicar compras no orçamento. Apenas os juros e encargos confirmados abaixo entram nas despesas do próximo mês.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <FormField label="Juros do rotativo" htmlFor="rollover-interest" optional>
            <MoneyInput
              id="rollover-interest"
              cents={interestCents}
              onCentsChange={setInterestCents}
              aria-label="Juros do rotativo"
            />
          </FormField>

          <FormField label="Multa por atraso" htmlFor="rollover-fine" optional>
            <MoneyInput
              id="rollover-fine"
              cents={fineCents}
              onCentsChange={setFineCents}
              aria-label="Multa por atraso"
            />
          </FormField>

          <FormField label="IOF / Tributos" htmlFor="rollover-tax" optional>
            <MoneyInput
              id="rollover-tax"
              cents={taxCents}
              onCentsChange={setTaxCents}
              aria-label="IOF e tributos"
            />
          </FormField>

          <FormField label="Tarifa / Encargos" htmlFor="rollover-fee" optional>
            <MoneyInput
              id="rollover-fee"
              cents={feeCents}
              onCentsChange={setFeeCents}
              aria-label="Tarifas e encargos"
            />
          </FormField>
        </div>

        <FormField label="Observação" htmlFor="rollover-note" optional>
          <Input
            id="rollover-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ex.: Rotativo informado pelo banco"
          />
        </FormField>

        <div className="rounded-xl border border-border/80 bg-surface p-3 flex flex-col gap-1.5 text-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Principal transferido:</span>
            <MoneyText cents={openBalanceCents} tone="default" className="text-xs font-medium" />
          </div>
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Juros e encargos ({RESERVED_CHARGES_CATEGORY_NAME}):</span>
            <MoneyText cents={totalChargesCents} tone="default" className="text-xs font-semibold text-warning-strong" />
          </div>
          <div className="flex items-center justify-between text-foreground font-semibold pt-1.5 border-t border-border/80">
            <span>Impacto total em {monthLabel(nextMonth)}:</span>
            <MoneyText cents={totalNextBillImpactCents} tone="default" className="text-xs font-bold" />
          </div>
        </div>
      </form>
    </Modal>
  );
}

/** Diálogo para rolar saldo de fatura vencida para a competência seguinte com confirmação de juros. */
export function BillRolloverDialog(props: BillRolloverDialogProps) {
  if (!props.open) return null;
  return (
    <BillRolloverContent
      key={`${props.cardId}:${props.competenceMonth}`}
      {...props}
    />
  );
}
