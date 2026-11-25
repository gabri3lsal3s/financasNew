import { useId, useState } from "react";
import { Check, Edit3, Plus, X } from "lucide-react";
import {
  Button,
  Checkbox,
  DatePicker,
  FormField,
  Input,
  MoneyInput,
  SegmentedControl,
  type SelectOption,
} from "@/components/ui";
import { todayISO } from "@/domain/debts";
import { CategoryPill } from "./category-pill";
import type { StatementItemPatch } from "./statement-import-types";

export interface StatementItemFormProps {
  mode: "add" | "edit";
  categoryOptions: SelectOption[];
  initialValues?: Partial<StatementItemPatch>;
  defaultDate?: string;
  showDeductibility?: boolean;
  onSubmit: (patch: StatementItemPatch) => void;
  onCancel: () => void;
}

const ITEM_NATURE_OPTIONS = [
  { value: "purchase", label: "Compra" },
  { value: "refund", label: "Estorno" },
] as const;

/**
 * Formulário inline unificado para adicionar ou editar lançamentos da fatura (D18 + AGENTS.md §4).
 */
export function StatementItemForm({
  mode,
  categoryOptions,
  initialValues,
  defaultDate,
  showDeductibility = false,
  onSubmit,
  onCancel,
}: StatementItemFormProps) {
  const uid = useId();
  const [nature, setNature] = useState<"purchase" | "refund">(
    initialValues?.isRefund ? "refund" : "purchase",
  );
  const [date, setDate] = useState(initialValues?.date || defaultDate || todayISO());
  const [cleanDescription, setCleanDescription] = useState(
    initialValues?.cleanDescription ?? "",
  );
  const [amountCents, setAmountCents] = useState(initialValues?.amountCents ?? 0);
  const [categoryId, setCategoryId] = useState(
    initialValues?.selectedCategoryId || categoryOptions[0]?.value || "",
  );
  const [installmentCurrent, setInstallmentCurrent] = useState(
    initialValues?.installment ? String(initialValues.installment.current) : "",
  );
  const [installmentTotal, setInstallmentTotal] = useState(
    initialValues?.installment ? String(initialValues.installment.total) : "",
  );
  const [isTaxDeductible, setIsTaxDeductible] = useState(
    Boolean(initialValues?.isTaxDeductible),
  );

  const isRefund = nature === "refund";
  const canSubmit = cleanDescription.trim().length > 0 && amountCents > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    const cur = Number.parseInt(installmentCurrent, 10);
    const tot = Number.parseInt(installmentTotal, 10);
    const installment =
      !isRefund && !Number.isNaN(cur) && !Number.isNaN(tot) && cur >= 1 && tot >= 2 && cur <= tot
        ? { current: cur, total: tot }
        : undefined;

    onSubmit({
      date,
      cleanDescription: cleanDescription.trim(),
      amountCents,
      selectedCategoryId: categoryId,
      installment,
      isRefund,
      isTaxDeductible: isRefund ? false : isTaxDeductible,
    });
  };

  return (
    <div className="p-3.5 bg-surface-raised border border-border/80 rounded-xl shadow-xs space-y-3 animate-in fade-in duration-150">
      <div className="flex items-center justify-between pb-2 border-b border-border/80">
        <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          {mode === "add" ? (
            <Plus className="size-4 text-muted-foreground" aria-hidden="true" />
          ) : (
            <Edit3 className="size-4 text-muted-foreground" aria-hidden="true" />
          )}
          {mode === "add" ? "Adicionar lançamento" : "Editar lançamento"}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="size-8 !w-8 !min-w-8 p-0 text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
          aria-label="Fechar formulário"
          title="Fechar"
        >
          <X className="size-4" aria-hidden="true" />
          <span className="sr-only">Fechar</span>
        </Button>
      </div>

      <FormField label="Tipo de lançamento">
        <SegmentedControl
          value={nature}
          onChange={setNature}
          options={ITEM_NATURE_OPTIONS}
          ariaLabel="Tipo de lançamento"
          fullWidth="mobile"
        />
      </FormField>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <FormField label="Data" htmlFor={`${uid}-date`}>
          <DatePicker value={date} onChange={setDate} />
        </FormField>

        <FormField label="Valor" htmlFor={`${uid}-amount`}>
          <MoneyInput
            id={`${uid}-amount`}
            cents={amountCents}
            onCentsChange={setAmountCents}
            placeholder="R$ 0,00"
          />
        </FormField>

        {!isRefund ? (
          <div className="grid grid-cols-2 gap-2">
            <FormField label="Parc. atual" htmlFor={`${uid}-inst-cur`} optional>
              <Input
                id={`${uid}-inst-cur`}
                inputMode="numeric"
                value={installmentCurrent}
                onChange={(e) => setInstallmentCurrent(e.target.value)}
                placeholder="Ex: 1"
                className="h-10 text-base sm:text-sm"
              />
            </FormField>
            <FormField label="Total parc." htmlFor={`${uid}-inst-tot`} optional>
              <Input
                id={`${uid}-inst-tot`}
                inputMode="numeric"
                value={installmentTotal}
                onChange={(e) => setInstallmentTotal(e.target.value)}
                placeholder="Ex: 12"
                className="h-10 text-base sm:text-sm"
              />
            </FormField>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField label="Descrição" htmlFor={`${uid}-desc`}>
          <Input
            id={`${uid}-desc`}
            value={cleanDescription}
            onChange={(e) => setCleanDescription(e.target.value)}
            placeholder={isRefund ? "Ex.: Estorno loja online" : "Ex.: Supermercado Dia"}
            className="h-10 text-base sm:text-sm"
          />
        </FormField>

        <FormField label="Categoria" htmlFor={`${uid}-cat`}>
          <CategoryPill
            value={categoryId}
            options={categoryOptions}
            onChange={setCategoryId}
          />
        </FormField>
      </div>

      {showDeductibility && !isRefund ? (
        <Checkbox
          checked={isTaxDeductible}
          onCheckedChange={setIsTaxDeductible}
          label="Despesa dedutível para a esfera Profissional"
        />
      ) : null}

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/80">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={!canSubmit}
          onClick={handleSubmit}
          className="gap-1.5"
        >
          <Check className="size-3.5" aria-hidden="true" />
          {mode === "add" ? "Adicionar lançamento" : "Salvar alterações"}
        </Button>
      </div>
    </div>
  );
}
