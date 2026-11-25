import { useEffect, useState, type MutableRefObject } from "react";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
  Alert, DatePicker, FormField, Input, MoneyInput, Select, Switch,
} from "@/components/ui";
import { getErrorMessage } from "@/services/errors";
import { useSafeBusinessMode } from "@/hooks/use-safe-business-scope";
import { useFamilyMode } from "@/state";
import type { Category, Income, InstallmentDeleteMode, ReceiveType, TransactionScope } from "@/types";
import { REPORT_WEIGHT_PRESETS } from "./report-weight-constants";
import { ReportWeightField } from "./report-weight-field";
import { EDIT_SCOPE_OPTIONS, RECEIVE_OPTIONS } from "./transaction-group-constants";

export interface IncomeEditSavePayload {
  description: string;
  value: number;
  date: string;
  category_id: string;
  receive_type: ReceiveType;
  report_weight: number;
  is_family?: boolean;
  scope?: TransactionScope;
}

export interface IncomeEditFormProps {
  income: Income;
  categories: Category[];
  isPending: boolean;
  grouped: boolean;
  isRecurring: boolean;
  scope: InstallmentDeleteMode;
  onScopeChange: (scope: InstallmentDeleteMode) => void;
  submitRef: MutableRefObject<(() => void) | null>;
  onSave: (payload: IncomeEditSavePayload) => Promise<void>;
}

/** Formulário de edição da receita com seção avançada recolhível (M9). */
export function IncomeEditForm({
  income, categories, isPending, grouped, isRecurring, scope, onScopeChange, submitRef, onSave,
}: IncomeEditFormProps) {
  const [description, setDescription] = useState(income.description || "");
  const [valueCents, setValueCents] = useState(Math.round(income.value * 100));
  const [date, setDate] = useState(income.date);
  const [categoryId, setCategoryId] = useState(income.category_id);
  const [receiveType, setReceiveType] = useState<ReceiveType>(income.receive_type);
  const [isFamily, setIsFamily] = useState(Boolean(income.is_family));
  const [scopeState, setScopeState] = useState<TransactionScope>(income.scope ?? "personal");

  const isPreset = REPORT_WEIGHT_PRESETS.includes(income.report_weight);
  const [weightMode, setWeightMode] = useState<string>(isPreset ? String(income.report_weight) : "custom");
  const [reportCustomAmountCents, setReportCustomAmountCents] = useState(
    Math.round(income.value * income.report_weight * 100),
  );
  const [formError, setFormError] = useState<string | null>(null);
  const { isFamilyModeEnabled } = useFamilyMode();
  const isFamilyActive = Boolean(isFamilyModeEnabled);
  const { isBusinessModeEnabled } = useSafeBusinessMode();

  const handleSubmit = async () => {
    if (valueCents <= 0) { setFormError("O valor da receita deve ser maior que zero."); return; }
    if (!categoryId) { setFormError("Selecione uma categoria."); return; }
    if (!date) { setFormError("Informe a data da receita."); return; }
    if (weightMode === "custom" && (reportCustomAmountCents < 0 || reportCustomAmountCents > valueCents)) {
      setFormError("O valor no relatório deve ser entre zero e o valor total da receita.");
      return;
    }

    const calculatedWeight =
      weightMode === "custom" ? Number((reportCustomAmountCents / valueCents).toFixed(4)) : Number(weightMode);

    setFormError(null);
    try {
      await onSave({
        description: description.trim(),
        value: valueCents / 100,
        date,
        category_id: categoryId,
        receive_type: receiveType,
        report_weight: calculatedWeight,
        is_family: isFamilyActive ? isFamily : Boolean(income.is_family),
        ...(isBusinessModeEnabled && !grouped ? { scope: scopeState } : {}),
      });
    } catch (err) {
      setFormError(getErrorMessage(err));
    }
  };

  useEffect(() => {
    submitRef.current = () => {
      if (!isPending) void handleSubmit();
    };
    return () => {
      submitRef.current = null;
    };
  });

  const categoryOptions = categories.map((c) => ({ value: c.id, label: c.name }));
  const valueDisabled = grouped && scope !== "single" && !isRecurring;
  const hasAdvancedInitial =
    !isPreset ||
    income.report_weight !== 1 ||
    (isFamilyActive && Boolean(income.is_family)) ||
    (isBusinessModeEnabled && !grouped && income.scope === "business");

  return (
    <form
      onSubmit={(event) => { event.preventDefault(); if (!isPending) void handleSubmit(); }}
      className="flex flex-col gap-3.5"
    >
      {formError ? <Alert variant="error">{formError}</Alert> : null}

      {grouped ? (
        <FormField
          label="Aplicar a"
          helperText={!isRecurring && scope !== "single" ? "O valor é editado por lançamento para preservar o total do parcelamento. Para mudar o total, exclua e refaça." : undefined}
        >
          <Select value={scope} onValueChange={(v) => onScopeChange(v as InstallmentDeleteMode)} options={EDIT_SCOPE_OPTIONS} ariaLabel="Escopo da edição" />
        </FormField>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <FormField label="Descrição" className="sm:col-span-2">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição da receita" aria-label="Descrição" />
        </FormField>
        <FormField label="Valor">
          <MoneyInput cents={valueCents} onCentsChange={setValueCents} aria-label="Valor da receita" disabled={valueDisabled} />
        </FormField>
        <FormField label="Data">
          <DatePicker value={date} onValueChange={setDate} ariaLabel="Data da receita" />
        </FormField>
        <FormField label="Categoria">
          <Select value={categoryId} onValueChange={setCategoryId} options={categoryOptions} placeholder="Selecione a categoria" ariaLabel="Categoria da receita" />
        </FormField>
        <FormField label="Forma de recebimento">
          <Select value={receiveType} onValueChange={(v) => setReceiveType(v as ReceiveType)} options={RECEIVE_OPTIONS} ariaLabel="Forma de recebimento" />
        </FormField>
      </div>

      <Accordion type="single" collapsible defaultValue={hasAdvancedInitial ? "advanced" : undefined}>
        <AccordionItem value="advanced">
          <AccordionTrigger className="text-xs py-2.5">Mais detalhes · Rateio e orçamento</AccordionTrigger>
          <AccordionContent className="flex flex-col gap-3.5">
            <ReportWeightField
              valueCents={valueCents}
              mode={weightMode}
              onModeChange={(val) => {
                setWeightMode(val);
                if (val === "custom" && reportCustomAmountCents === 0) setReportCustomAmountCents(valueCents);
              }}
              customAmountCents={reportCustomAmountCents}
              onCustomAmountChange={setReportCustomAmountCents}
              customLabel="Sua cota considerada no relatório"
              ariaLabelCustom="Sua cota considerada no relatório"
            />
            {isBusinessModeEnabled && !grouped ? (
              <div className="rounded-xl border border-border/80 bg-surface p-3">
                <FormField label="Esfera do lançamento">
                  <Select
                    value={scopeState}
                    onValueChange={(value) => {
                      const next = value as TransactionScope;
                      setScopeState(next);
                      if (next === "business") setIsFamily(false);
                    }}
                    options={[
                      { value: "personal", label: "Pessoal" },
                      { value: "business", label: "Profissional" },
                    ]}
                    ariaLabel="Esfera do lançamento"
                  />
                </FormField>
              </div>
            ) : null}
            {isFamilyActive && (!isBusinessModeEnabled || scopeState !== "business") ? (
              <div className="rounded-xl border border-border/80 bg-surface p-3">
                <Switch
                  id="edit-income-family"
                  checked={isFamily}
                  onCheckedChange={setIsFamily}
                  label="Receita da Casa / Familiar"
                  description="Visível no Painel Familiar compartilhado"
                />
              </div>
            ) : null}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </form>
  );
}
