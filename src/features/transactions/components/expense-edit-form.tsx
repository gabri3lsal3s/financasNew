import { useEffect, useState, type MutableRefObject } from "react";
import { Plane } from "lucide-react";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
  Alert, DatePicker, FormField, Input, MoneyInput, Select, Switch,
} from "@/components/ui";
import { resolveBillCompetence } from "@/domain/competence";
import { getErrorMessage } from "@/services/errors";
import { useFamilyMode } from "@/state";
import type { Category, CreditCard, Expense, InstallmentDeleteMode, PaymentMethod } from "@/types";
import { REPORT_WEIGHT_PRESETS } from "./report-weight-constants";
import { ReportWeightField } from "./report-weight-field";
import { EDIT_SCOPE_OPTIONS, MONTH_KEY_RE, PAYMENT_OPTIONS } from "./transaction-group-constants";

export interface ExpenseEditSavePayload {
  description: string;
  value: number;
  date: string;
  category_id: string;
  payment_method: PaymentMethod;
  card_id: string | null;
  bill_competence: string | null;
  report_weight: number;
  is_family?: boolean;
}

export interface ExpenseEditFormProps {
  expense: Expense;
  categories: Category[];
  cards: CreditCard[];
  isPending: boolean;
  grouped: boolean;
  isRecurring: boolean;
  scope: InstallmentDeleteMode;
  onScopeChange: (scope: InstallmentDeleteMode) => void;
  submitRef: MutableRefObject<(() => void) | null>;
  onSave: (payload: ExpenseEditSavePayload) => Promise<void>;
}

/** Formulário de edição da despesa com seção avançada recolhível (M9). */
export function ExpenseEditForm({
  expense, categories, cards, isPending, grouped, isRecurring, scope, onScopeChange, submitRef, onSave,
}: ExpenseEditFormProps) {
  const [description, setDescription] = useState(expense.description || "");
  const [valueCents, setValueCents] = useState(Math.round(expense.value * 100));
  const [date, setDate] = useState(expense.date);
  const [categoryId, setCategoryId] = useState(expense.category_id);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(expense.payment_method);
  const [cardId, setCardId] = useState<string>(expense.card_id || "");
  const [billCompetence, setBillCompetence] = useState<string>(expense.bill_competence || "");
  const [isFamily, setIsFamily] = useState(Boolean(expense.is_family));
  const [competenceTouched, setCompetenceTouched] = useState(false);

  const isPreset = REPORT_WEIGHT_PRESETS.includes(expense.report_weight);
  const [weightMode, setWeightMode] = useState<string>(isPreset ? String(expense.report_weight) : "custom");
  const [reportCustomAmountCents, setReportCustomAmountCents] = useState(Math.round(expense.value * expense.report_weight * 100));
  const [formError, setFormError] = useState<string | null>(null);
  const { isFamilyModeEnabled } = useFamilyMode();
  const isFamilyActive = Boolean(isFamilyModeEnabled);

  const handleDateChange = (next: string) => {
    setDate(next);
    if (!competenceTouched && paymentMethod === "credit_card" && next) {
      const card = cards.find((c) => c.id === cardId);
      setBillCompetence(card ? resolveBillCompetence(new Date(`${next}T12:00:00`), card.closing_day) : next.slice(0, 7));
    }
  };

  const handleSubmit = async () => {
    if (valueCents <= 0) { setFormError("O valor da despesa deve ser maior que zero."); return; }
    if (!categoryId) { setFormError("Selecione uma categoria."); return; }
    if (!date) { setFormError("Informe a data da despesa."); return; }
    if (paymentMethod === "credit_card" && cards.length === 0) {
      setFormError("Nenhum cartão de crédito cadastrado. Cadastre um cartão na página Cartões antes de registrar uma compra no crédito.");
      return;
    }
    if (paymentMethod === "credit_card" && !cardId) { setFormError("Selecione o cartão de crédito."); return; }
    const trimmedComp = billCompetence.trim();
    if (paymentMethod === "credit_card" && trimmedComp !== "" && !MONTH_KEY_RE.test(trimmedComp)) {
      setFormError("Competência da fatura inválida — use o formato AAAA-MM (ex.: 2026-08).");
      return;
    }
    if (weightMode === "custom" && (reportCustomAmountCents < 0 || reportCustomAmountCents > valueCents)) {
      setFormError("O valor no relatório deve ser entre zero e o valor total da despesa.");
      return;
    }

    const weight = weightMode === "custom" ? Number((reportCustomAmountCents / valueCents).toFixed(4)) : Number(weightMode);
    setFormError(null);
    try {
      const card = cards.find((c) => c.id === cardId);
      const effectiveCompetence = paymentMethod === "credit_card"
        ? trimmedComp || (card && date ? resolveBillCompetence(new Date(`${date}T12:00:00`), card.closing_day) : date ? date.slice(0, 7) : null)
        : null;
      await onSave({
        description: description.trim(), value: valueCents / 100, date, category_id: categoryId, payment_method: paymentMethod,
        card_id: paymentMethod === "credit_card" ? cardId || null : null, bill_competence: effectiveCompetence,
        report_weight: weight, is_family: isFamilyActive ? isFamily : Boolean(expense.is_family),
      });
    } catch (err) { setFormError(getErrorMessage(err)); }
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
  const cardOptions = cards.map((card) => ({ value: card.id, label: `${card.name} (fechamento dia ${card.closing_day})` }));
  const valueDisabled = grouped && scope !== "single" && !isRecurring;
  const hasAdvancedInitial = !isPreset || expense.report_weight !== 1 || (isFamilyActive && Boolean(expense.is_family));

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (!isPending) void handleSubmit(); }} className="flex flex-col gap-3.5">
      {formError ? <Alert variant="error">{formError}</Alert> : null}

      {expense.trip_id ? (
        <div className="flex items-center gap-2 p-2.5 rounded-xl border border-portfolio/20 bg-portfolio/5 text-xs text-portfolio">
          <Plane className="size-4 shrink-0" aria-hidden="true" />
          <span>Vinculada ao Modo Viagem. As alterações de valor, descrição e data serão sincronizadas automaticamente com os participantes da viagem.</span>
        </div>
      ) : null}

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
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição da despesa" aria-label="Descrição" />
        </FormField>
        <FormField label="Valor">
          <MoneyInput cents={valueCents} onCentsChange={setValueCents} aria-label="Valor da despesa" disabled={valueDisabled} />
        </FormField>
        <FormField label="Data">
          <DatePicker value={date} onValueChange={handleDateChange} ariaLabel="Data da despesa" />
        </FormField>
        <FormField label="Categoria">
          <Select value={categoryId} onValueChange={setCategoryId} options={categoryOptions} placeholder="Selecione a categoria" ariaLabel="Categoria da despesa" />
        </FormField>
        <FormField label="Forma de pagamento">
          <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)} options={PAYMENT_OPTIONS} ariaLabel="Forma de pagamento" />
        </FormField>

        {paymentMethod === "credit_card" && cards.length > 0 ? (
          <>
            <FormField label="Cartão de crédito">
              <Select
                value={cardId}
                onValueChange={(val) => {
                  setCardId(val); setCompetenceTouched(false);
                  const card = cards.find((c) => c.id === val);
                  if (card && date) setBillCompetence(resolveBillCompetence(new Date(`${date}T12:00:00`), card.closing_day));
                }}
                options={cardOptions} placeholder="Selecione o cartão" ariaLabel="Cartão de crédito"
              />
            </FormField>
            {scope === "single" ? (
              <FormField label="Fatura (Competência)" helperText="Calculada pelo fechamento do cartão; edite para ajustar manualmente.">
                <Input
                  value={billCompetence}
                  onChange={(e) => { setCompetenceTouched(true); setBillCompetence(e.target.value); }}
                  placeholder="AAAA-MM (ex: 2026-08)" aria-label="Competência da fatura" inputMode="numeric" maxLength={7} autoComplete="off"
                />
              </FormField>
            ) : null}
          </>
        ) : null}
      </div>

      <Accordion type="single" collapsible defaultValue={hasAdvancedInitial ? "advanced" : undefined}>
        <AccordionItem value="advanced">
          <AccordionTrigger className="text-xs py-2.5">Mais detalhes · Rateio e orçamento</AccordionTrigger>
          <AccordionContent className="flex flex-col gap-3.5">
            <ReportWeightField
              valueCents={valueCents} mode={weightMode}
              onModeChange={(val) => {
                setWeightMode(val);
                if (val === "custom" && reportCustomAmountCents === 0) setReportCustomAmountCents(valueCents);
              }}
              customAmountCents={reportCustomAmountCents} onCustomAmountChange={setReportCustomAmountCents}
              customLabel="Sua cota considerada no relatório" ariaLabelCustom="Sua cota considerada no relatório"
            />
            {isFamilyActive ? (
              <div className="rounded-xl border border-border/80 bg-surface p-3">
                <Switch
                  id="edit-expense-family" checked={isFamily} onCheckedChange={setIsFamily}
                  label="Despesa da Casa / Familiar" description="Visível no Painel Familiar compartilhado"
                />
              </div>
            ) : null}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </form>
  );
}
