import { useId, useState } from "react";
import {
  Button,
  DatePicker,
  FormField,
  Input,
  Modal,
  ModalFooter,
  MoneyInput,
  NumberStepper,
  Select,
  type SelectOption,
} from "@/components/ui";
import { todayISO } from "@/domain/debts";
import type { ReconciliationItem } from "@/domain/reconciliation";
import type { StatementItemPatch } from "./statement-import-helpers";

export interface StatementItemFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "edit" | "add";
  initialItem?: ReconciliationItem | null;
  categoryOptions: SelectOption[];
  defaultCategoryId: string;
  onSubmit: (values: StatementItemPatch) => void;
}

interface StatementItemFormContentProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "edit" | "add";
  initialItem?: ReconciliationItem | null;
  categoryOptions: SelectOption[];
  defaultCategoryId: string;
  onSubmit: (values: StatementItemPatch) => void;
}

function StatementItemFormContent({
  open,
  onOpenChange,
  mode,
  initialItem,
  categoryOptions,
  defaultCategoryId,
  onSubmit,
}: StatementItemFormContentProps) {
  const formId = useId();
  const isEdit = mode === "edit" && Boolean(initialItem);

  const [date, setDate] = useState(() =>
    isEdit && initialItem ? initialItem.transaction.date : todayISO(),
  );
  const [description, setDescription] = useState(() =>
    isEdit && initialItem ? initialItem.transaction.cleanDescription : "",
  );
  const [amountCents, setAmountCents] = useState(() =>
    isEdit && initialItem ? initialItem.transaction.amountCents : 0,
  );
  const [categoryId, setCategoryId] = useState(() =>
    isEdit && initialItem
      ? initialItem.selectedCategoryId || defaultCategoryId
      : defaultCategoryId,
  );
  const [installmentCurrent, setInstallmentCurrent] = useState(() =>
    isEdit && initialItem?.transaction.installment?.current
      ? String(initialItem.transaction.installment.current)
      : "",
  );
  const [installmentTotal, setInstallmentTotal] = useState(() =>
    isEdit && initialItem?.transaction.installment?.total
      ? String(initialItem.transaction.installment.total)
      : "",
  );

  const canSubmit = description.trim().length > 0 && amountCents > 0;

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    const cur = Number.parseInt(installmentCurrent, 10);
    const tot = Number.parseInt(installmentTotal, 10);
    const installment =
      !Number.isNaN(cur) && !Number.isNaN(tot) && cur >= 1 && tot >= 2 && cur <= tot
        ? { current: cur, total: tot }
        : undefined;

    onSubmit({
      date,
      cleanDescription: description.trim(),
      amountCents,
      selectedCategoryId: categoryId || defaultCategoryId,
      installment,
    });
    onOpenChange(false);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Editar Lançamento" : "Adicionar Linha Manual"}
      description={
        isEdit
          ? "Ajuste os campos do lançamento da fatura antes da confirmação."
          : "Inclua uma despesa adicional nesta fatura antes da confirmação."
      }
      size="md"
      showCalculator
      footer={
        <ModalFooter borderless>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form={formId} disabled={!canSubmit}>
            {isEdit ? "Salvar Alterações" : "Adicionar Linha"}
          </Button>
        </ModalFooter>
      }
    >
      <form id={formId} onSubmit={handleFormSubmit} className="space-y-4 pt-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <FormField label="Data" htmlFor={`${formId}-date`}>
            <DatePicker id={`${formId}-date`} value={date} onValueChange={setDate} ariaLabel="Data do lançamento" />
          </FormField>
          <FormField label="Valor" htmlFor={`${formId}-amount`}>
            <MoneyInput
              id={`${formId}-amount`}
              cents={amountCents}
              onCentsChange={setAmountCents}
              aria-label="Valor do lançamento"
            />
          </FormField>
        </div>

        <FormField label="Descrição" htmlFor={`${formId}-desc`}>
          <Input
            id={`${formId}-desc`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={isEdit ? "Descrição da despesa" : "Ex.: Compra Farmácia, Restaurante"}
          />
        </FormField>

        <FormField label="Categoria" htmlFor={`${formId}-category`}>
          <Select
            id={`${formId}-category`}
            value={categoryId}
            onValueChange={setCategoryId}
            options={categoryOptions}
            ariaLabel="Categoria do lançamento"
          />
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <FormField label="Parcela Atual" optional>
            <NumberStepper
              editable
              value={Number.parseInt(installmentCurrent, 10) || 0}
              onValueChange={(val) => setInstallmentCurrent(String(val))}
              rawValue={installmentCurrent}
              onRawValueChange={setInstallmentCurrent}
              min={1}
              max={60}
              placeholder="Ex.: 1"
              ariaLabel="Parcela Atual"
            />
          </FormField>
          <FormField label="Total Parcelas" optional>
            <NumberStepper
              editable
              value={Number.parseInt(installmentTotal, 10) || 0}
              onValueChange={(val) => setInstallmentTotal(String(val))}
              rawValue={installmentTotal}
              onRawValueChange={setInstallmentTotal}
              min={2}
              max={60}
              placeholder={isEdit ? "Ex.: 10" : "Ex.: 6"}
              ariaLabel="Total Parcelas"
            />
          </FormField>
        </div>
      </form>
    </Modal>
  );
}

/** Submodal unificado para editar item conciliado ou incluir linha manual na fatura. */
export function StatementItemFormDialog(props: StatementItemFormDialogProps) {
  if (!props.open) return null;

  return (
    <StatementItemFormContent
      key={`${props.mode}:${props.initialItem?.transaction.id ?? "manual"}`}
      {...props}
    />
  );
}
