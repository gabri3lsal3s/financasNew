import { useId, useState } from "react";
import { ArrowRight, Briefcase, User } from "lucide-react";
import {
  Alert,
  Button,
  DatePicker,
  FormField,
  Input,
  Modal,
  ModalFooter,
  MoneyInput,
  Select,
} from "@/components/ui";
import { todayISO } from "@/domain/debts";
import { useMutationGuard } from "@/hooks/use-mutation-guard";
import { INTERNAL_TRANSFER_KIND_LABELS } from "@/lib/labels";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
import { useCreateInternalTransferPair } from "@/state";
import type { InternalTransferKind } from "@/types";

export interface InternalTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultKind?: InternalTransferKind;
  defaultAmountCents?: number;
  defaultDate?: string;
  defaultDescription?: string;
  sourceRef?: string | null;
  onSuccess?: () => void;
}

const TRANSFER_KIND_OPTIONS: Array<{ value: InternalTransferKind; label: string }> = [
  { value: "pro_labore", label: INTERNAL_TRANSFER_KIND_LABELS.pro_labore },
  { value: "capital_injection", label: INTERNAL_TRANSFER_KIND_LABELS.capital_injection },
  { value: "card_reimbursement", label: INTERNAL_TRANSFER_KIND_LABELS.card_reimbursement },
];

/** Modal para registrar transferência interna pareada entre caixa Pessoal (PF) e Meu Negócio (PJ). */
export function InternalTransferDialog({
  open,
  onOpenChange,
  defaultKind = "pro_labore",
  defaultAmountCents = 0,
  defaultDate,
  defaultDescription = "",
  sourceRef = null,
  onSuccess,
}: InternalTransferDialogProps) {
  const formId = useId();
  const { guardAction, upgradeModal, isReadOnlyMode } = useMutationGuard({
    moduleKey: "transactions",
  });
  const createPair = useCreateInternalTransferPair();

  const [kind, setKind] = useState<InternalTransferKind>(defaultKind);
  const [amountCents, setAmountCents] = useState<number>(defaultAmountCents);
  const [date, setDate] = useState<string>(defaultDate ?? todayISO());
  const [description, setDescription] = useState<string>(defaultDescription);
  const [error, setError] = useState<string | null>(null);

  const [prevKey, setPrevKey] = useState(
    `${open}|${defaultKind}|${defaultAmountCents}|${defaultDate ?? ""}|${defaultDescription}|${sourceRef ?? ""}`,
  );
  const nextKey = `${open}|${defaultKind}|${defaultAmountCents}|${defaultDate ?? ""}|${defaultDescription}|${sourceRef ?? ""}`;
  if (nextKey !== prevKey) {
    setPrevKey(nextKey);
    if (open) {
      setKind(defaultKind);
      setAmountCents(defaultAmountCents);
      setDate(defaultDate ?? todayISO());
      setDescription(defaultDescription);
      setError(null);
    }
  }

  const isPfToPj = kind === "capital_injection";
  const fromLabel = isPfToPj ? "Caixa Pessoal (PF)" : "Caixa Meu Negócio (PJ)";
  const toLabel = isPfToPj ? "Caixa Meu Negócio (PJ)" : "Caixa Pessoal (PF)";

  const executeSubmit = async () => {
    setError(null);
    if (amountCents <= 0) {
      triggerSensory("error");
      setError("Informe um valor maior que zero para a transferência.");
      return;
    }
    if (!date) {
      triggerSensory("error");
      setError("Informe a data da transferência.");
      return;
    }
    try {
      await createPair.mutateAsync({
        transferKind: kind,
        amount: amountCents / 100,
        date,
        description: description.trim() || null,
        sourceRef: sourceRef ?? null,
      });
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (isReadOnlyMode) {
      guardAction(() => undefined, "Registrar Transferência PF/PJ");
      return;
    }
    guardAction(() => {
      void executeSubmit();
    }, "Registrar Transferência PF/PJ");
  };

  return (
    <>
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        title="Transferência PF / PJ"
        description="Movimentação pareada nos dois caixas sem inflar receitas nem despesas do DRE."
        size="md"
        showCalculator
        footer={
          <ModalFooter borderless>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createPair.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form={formId}
              sensoryIntent={false}
              disabled={amountCents <= 0 || createPair.isPending}
              loading={createPair.isPending}
            >
              Confirmar transferência
            </Button>
          </ModalFooter>
        }
      >
        <form id={formId} onSubmit={handleSubmit} className="flex flex-col gap-3.5 pt-2">
          {error ? <Alert variant="error">{error}</Alert> : null}

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/80 bg-surface-raised p-3 text-xs">
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              {isPfToPj ? (
                <User className="size-3.5 text-muted-foreground" aria-hidden="true" />
              ) : (
                <Briefcase className="size-3.5 text-portfolio" aria-hidden="true" />
              )}
              <span>Saída: {fromLabel}</span>
            </div>
            <ArrowRight className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              {isPfToPj ? (
                <Briefcase className="size-3.5 text-portfolio" aria-hidden="true" />
              ) : (
                <User className="size-3.5 text-positive-strong" aria-hidden="true" />
              )}
              <span>Entrada: {toLabel}</span>
            </div>
          </div>

          <FormField label="Finalidade da movimentação" htmlFor={`${formId}-kind`}>
            <Select
              id={`${formId}-kind`}
              value={kind}
              onValueChange={(value) => setKind(value as InternalTransferKind)}
              options={TRANSFER_KIND_OPTIONS}
              ariaLabel="Finalidade da movimentação"
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <FormField label="Valor" htmlFor={`${formId}-amount`}>
              <MoneyInput
                id={`${formId}-amount`}
                cents={amountCents}
                onCentsChange={setAmountCents}
                aria-label="Valor da transferência"
              />
            </FormField>

            <FormField label="Data" htmlFor={`${formId}-date`}>
              <DatePicker id={`${formId}-date`} value={date} onValueChange={setDate} />
            </FormField>
          </div>

          <FormField label="Descrição" optional htmlFor={`${formId}-description`}>
            <Input
              id={`${formId}-description`}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={
                isPfToPj
                  ? "Ex.: Capital de giro inicial PF para PJ"
                  : kind === "card_reimbursement"
                    ? "Ex.: Reembolso compras PJ no cartão PF"
                    : "Ex.: Retirada mensal de pró-labore"
              }
            />
          </FormField>
        </form>
      </Modal>
      {upgradeModal}
    </>
  );
}
