import { useState } from "react";
import { Copy, Pencil, Share2, Trash2 } from "lucide-react";
import { Alert, Button, ConfirmDialog, DatePicker, Input, Modal, MoneyInput, Select } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { CategoryIcon } from "@/components/modules/category-icon";
import { formatCentsAsBRL } from "@/services/masks";
import { shareText } from "@/services/export-actions";
import { triggerHaptic } from "@/services/haptics";
import { getErrorMessage } from "@/services/errors";
import { pushToast } from "@/services/toast";
import {
  useCategories,
  useCreditCards,
  useCreateExpense,
  useDeleteExpense,
  useDeleteRecurrenceOccurrences,
  useUpdateExpense,
  useUpdateExpenseGrouped,
  useUpdateRecurrenceOccurrences,
} from "@/state";
import type { RecurrenceGroupFields } from "@/data/rpc";
import { PAYMENT_METHOD_LABELS } from "@/lib/labels";
import { resolveBillCompetence } from "@/domain/competence";
import { todayISO } from "@/domain/debts";
import { CHARGE_KIND_LABELS } from "@/domain/charges";
import { REPORT_WEIGHT_PRESETS } from "./report-weight-constants";
import { ReportWeightField } from "./report-weight-field";
import type { Category, ChargeKind, CreditCard, Expense, InstallmentDeleteMode, PaymentMethod } from "@/types";

export interface ExpenseDetailDialogProps {
  expense: Expense | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MODE_OPTIONS = [
  { value: "single", label: "Apenas esta parcela" },
  { value: "all", label: "Todas as parcelas" },
  { value: "subsequent", label: "Esta parcela e as seguintes" },
];

/** Modos de exclusão para recorrências (Fase 32) — ocorrências, não parcelas. */
const RECURRENCE_MODE_OPTIONS = [
  { value: "single", label: "Apenas esta ocorrência" },
  { value: "all", label: "Todas as ocorrências" },
  { value: "subsequent", label: "Esta ocorrência e as seguintes" },
];

/** Escopo da edição em grupo (Fase 32) — rótulos genéricos (parcela/ocorrência). */
const EDIT_SCOPE_OPTIONS = [
  { value: "single", label: "Apenas este lançamento" },
  { value: "all", label: "Todos do grupo" },
  { value: "subsequent", label: "Este e os seguintes" },
];

const PAYMENT_OPTIONS = [
  { value: "pix", label: "Pix" },
  { value: "credit_card", label: "Cartão de Crédito" },
  { value: "debit", label: "Cartão de Débito" },
  { value: "cash", label: "Dinheiro" },
  { value: "transfer", label: "Transferência" },
  { value: "other", label: "Outro" },
];

/** Chave de mês válida AAAA-MM (validação da competência editada manualmente). */
const MONTH_KEY_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

interface ExpenseEditFormProps {
  expense: Expense;
  categories: Category[];
  cards: CreditCard[];
  isPending: boolean;
  /** Parcelada ou recorrente — mostra o seletor de escopo (Fase 32). */
  grouped: boolean;
  isRecurring: boolean;
  scope: InstallmentDeleteMode;
  onScopeChange: (scope: InstallmentDeleteMode) => void;
  onCancel: () => void;
  onSave: (payload: {
    description: string;
    value: number;
    date: string;
    category_id: string;
    payment_method: PaymentMethod;
    card_id: string | null;
    bill_competence: string | null;
    report_weight: number;
    charge_kind: ChargeKind;
  }) => Promise<void>;
}

function ExpenseEditForm({
  expense,
  categories,
  cards,
  isPending,
  grouped,
  isRecurring,
  scope,
  onScopeChange,
  onCancel,
  onSave,
}: ExpenseEditFormProps) {
  const [description, setDescription] = useState(expense.description || "");
  const [valueCents, setValueCents] = useState(Math.round(expense.value * 100));
  const [date, setDate] = useState(expense.date);
  const [categoryId, setCategoryId] = useState(expense.category_id);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(expense.payment_method);
  const [chargeKind, setChargeKind] = useState<ChargeKind>(expense.charge_kind || "regular");
  const [cardId, setCardId] = useState<string>(expense.card_id || "");
  const [billCompetence, setBillCompetence] = useState<string>(expense.bill_competence || "");
  // Competência digitada manualmente → data deixa de recalculá-la (override).
  const [competenceTouched, setCompetenceTouched] = useState(false);
  const isPreset = REPORT_WEIGHT_PRESETS.includes(expense.report_weight);
  const [weightMode, setWeightMode] = useState<string>(isPreset ? String(expense.report_weight) : "custom");
  const [reportCustomAmountCents, setReportCustomAmountCents] = useState(
    Math.round(expense.value * expense.report_weight * 100),
  );
  const [formError, setFormError] = useState<string | null>(null);

  /**
   * Data mudou: mantém a competência automática em sincronia com o fechamento
   * do cartão, a menos que o usuário a tenha editado manualmente (override
   * explícito preservado — `competenceTouched`).
   */
  const handleDateChange = (next: string) => {
    setDate(next);
    if (!competenceTouched && paymentMethod === "credit_card" && next) {
      const card = cards.find((c) => c.id === cardId);
      setBillCompetence(
        card ? resolveBillCompetence(new Date(`${next}T12:00:00`), card.closing_day) : next.slice(0, 7),
      );
    }
  };

  const handleSubmit = async () => {
    if (valueCents <= 0) {
      setFormError("O valor da despesa deve ser maior que zero.");
      return;
    }
    if (!categoryId) {
      setFormError("Selecione uma categoria.");
      return;
    }
    if (!date) {
      setFormError("Informe a data da despesa.");
      return;
    }
    if (paymentMethod === "credit_card" && cards.length === 0) {
      setFormError(
        "Nenhum cartão de crédito cadastrado. Cadastre um cartão na página Cartões antes de registrar uma compra no crédito.",
      );
      return;
    }
    if (paymentMethod === "credit_card" && !cardId) {
      setFormError("Selecione o cartão de crédito.");
      return;
    }
    const trimmedCompetence = billCompetence.trim();
    if (paymentMethod === "credit_card" && trimmedCompetence !== "" && !MONTH_KEY_RE.test(trimmedCompetence)) {
      setFormError("Competência da fatura inválida — use o formato AAAA-MM (ex.: 2026-08).");
      return;
    }

    if (weightMode === "custom" && (reportCustomAmountCents < 0 || reportCustomAmountCents > valueCents)) {
      setFormError("O valor no relatório deve ser entre zero e o valor total da despesa.");
      return;
    }

    const calculatedWeight =
      weightMode === "custom"
        ? Number((reportCustomAmountCents / valueCents).toFixed(4))
        : Number(weightMode);

    setFormError(null);
    try {
      const effectiveCard = cards.find((c) => c.id === cardId);
      const effectiveCompetence =
        paymentMethod === "credit_card"
          ? trimmedCompetence ||
            (effectiveCard && date
              ? resolveBillCompetence(new Date(`${date}T12:00:00`), effectiveCard.closing_day)
              : date
                ? date.slice(0, 7)
                : null)
          : null;

      await onSave({
        description: description.trim(),
        value: valueCents / 100,
        date,
        category_id: categoryId,
        payment_method: paymentMethod,
        card_id: paymentMethod === "credit_card" ? cardId || null : null,
        bill_competence: effectiveCompetence,
        report_weight: calculatedWeight,
        charge_kind: chargeKind,
      });
    } catch (err) {
      setFormError(getErrorMessage(err));
    }
  };

  const categoryOptions = categories.map((c) => ({
    value: c.id,
    label: c.name,
  }));

  const cardOptions = cards.map((card) => ({
    value: card.id,
    label: `${card.name} (fechamento dia ${card.closing_day})`,
  }));

  // Parcelada: o valor é editável apenas por lançamento (invariante de soma do
  // parcelamento — mudar o total = excluir e refazer). Recorrência: sem
  // invariante de soma, valor editável em grupo.
  const valueDisabled = grouped && scope !== "single" && !isRecurring;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!isPending) {
          void handleSubmit();
        }
      }}
      className="flex flex-col gap-3.5"
    >
      {formError ? <Alert variant="error">{formError}</Alert> : null}

      {grouped ? (
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Aplicar a
          <Select
            value={scope}
            onValueChange={(value) => onScopeChange(value as InstallmentDeleteMode)}
            options={EDIT_SCOPE_OPTIONS}
            ariaLabel="Escopo da edição"
          />
          {grouped && !isRecurring && scope !== "single" ? (
            <span className="text-[11px] text-muted-foreground">
              O valor é editado por lançamento para preservar o total do parcelamento. Para mudar o total, exclua e refaça.
            </span>
          ) : null}
        </label>
      ) : null}

      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        Descrição
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descrição da despesa"
          aria-label="Descrição"
        />
      </label>

      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        Valor
        <MoneyInput
          cents={valueCents}
          onCentsChange={setValueCents}
          aria-label="Valor da despesa"
          disabled={valueDisabled}
        />
      </label>

      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        Data
        <DatePicker
          value={date}
          onValueChange={handleDateChange}
          ariaLabel="Data da despesa"
        />
      </label>

      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        Categoria
        <Select
          value={categoryId}
          onValueChange={setCategoryId}
          options={categoryOptions}
          placeholder="Selecione a categoria"
          ariaLabel="Categoria da despesa"
        />
      </label>

      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        Forma de pagamento
        <Select
          value={paymentMethod}
          onValueChange={(val) => setPaymentMethod(val as PaymentMethod)}
          options={PAYMENT_OPTIONS}
          ariaLabel="Forma de pagamento"
        />
      </label>

      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        Natureza da despesa
        <Select
          value={chargeKind}
          onValueChange={(val) => setChargeKind(val as ChargeKind)}
          options={Object.entries(CHARGE_KIND_LABELS).map(([k, v]) => ({ value: k, label: v }))}
          ariaLabel="Natureza da despesa"
        />
      </label>

      {paymentMethod === "credit_card" && cards.length > 0 ? (
        <>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Cartão de crédito
            <Select
              value={cardId}
              onValueChange={(val) => {
                setCardId(val);
                // Trocar de cartão re-baselineia a competência (seguindo o
                // fechamento do novo cartão) e libera o recálculo automático.
                setCompetenceTouched(false);
                const selectedCard = cards.find((c) => c.id === val);
                if (selectedCard && date) {
                  setBillCompetence(resolveBillCompetence(new Date(`${date}T12:00:00`), selectedCard.closing_day));
                }
              }}
              options={cardOptions}
              placeholder="Selecione o cartão"
              ariaLabel="Cartão de crédito"
            />
          </label>

          {scope === "single" ? (
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Fatura (Competência)
              <Input
                value={billCompetence}
                onChange={(e) => {
                  setCompetenceTouched(true);
                  setBillCompetence(e.target.value);
                }}
                placeholder="AAAA-MM (ex: 2026-08)"
                aria-label="Competência da fatura"
                inputMode="numeric"
                maxLength={7}
                autoComplete="off"
              />
              <span className="text-[11px] text-muted-foreground">
                Calculada pelo fechamento do cartão; edite para ajustar manualmente.
              </span>
            </label>
          ) : null}
        </>
      ) : null}

      <ReportWeightField
        valueCents={valueCents}
        mode={weightMode}
        onModeChange={(val) => {
          setWeightMode(val);
          if (val === "custom" && reportCustomAmountCents === 0) {
            setReportCustomAmountCents(valueCents);
          }
        }}
        customAmountCents={reportCustomAmountCents}
        onCustomAmountChange={setReportCustomAmountCents}
        customLabel="Valor gasto real considerado no relatório"
        ariaLabelCustom="Valor considerado no relatório"
      />

      <div className="mt-2 flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={isPending}
        >
          {isPending ? "Salvando…" : "Salvar alterações"}
        </Button>
      </div>
    </form>
  );
}

/** Detalhe da despesa + edição completa com troca de categoria + exclusão em 3 modos. */
export function ExpenseDetailDialog({ expense, open, onOpenChange }: ExpenseDetailDialogProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [mode, setMode] = useState<InstallmentDeleteMode>("single");
  const [editScope, setEditScope] = useState<InstallmentDeleteMode>("single");
  const [error, setError] = useState<string | null>(null);

  const categoriesQuery = useCategories("expense");
  const cardsQuery = useCreditCards();
  const deleteExpense = useDeleteExpense();
  const deleteRecurrence = useDeleteRecurrenceOccurrences();
  const updateExpense = useUpdateExpense();
  const updateExpenseGrouped = useUpdateExpenseGrouped();
  const updateRecurrence = useUpdateRecurrenceOccurrences();
  const createExpense = useCreateExpense();

  const categories = categoriesQuery.data ?? [];
  const cards = cardsQuery.data ?? [];
  const currentCategory = categories.find((c) => c.id === expense?.category_id);

  const isInstallment = expense != null && expense.installments_total > 1;
  const isRecurring = expense?.recurrence_id != null;
  const isGrouped = isInstallment || isRecurring;
  const editPending = updateExpense.isPending || updateExpenseGrouped.isPending || updateRecurrence.isPending;

  /**
   * Exclusão otimista (F30): fecha os diálogos e remove o item da lista na
   * hora; o hook faz rollback + toast se o servidor rejeitar.
   */
  const handleConfirmDelete = () => {
    if (!expense) return;
    setError(null);
    setConfirmOpen(false);
    onOpenChange(false);
    if (isRecurring) {
      void Promise.resolve(deleteRecurrence.mutateAsync({ occurrenceId: expense.id, mode })).catch(() => undefined);
    } else {
      void Promise.resolve(deleteExpense.mutateAsync({ expenseId: expense.id, mode })).catch(() => undefined);
    }
  };

  /**
   * Edição otimista (F30): o cache já reflete os dados novos em `onMutate`;
   * o modal permanece aberto até a confirmação do servidor — em falha o
   * formulário mostra o erro com os dados preservados (nada se perde) e o
   * hook faz rollback + toast. Sucesso → fecha.
   */
  const handleSaveEdit = async (payload: {
    description: string;
    value: number;
    date: string;
    category_id: string;
    payment_method: PaymentMethod;
    card_id: string | null;
    bill_competence: string | null;
    report_weight: number;
    charge_kind: ChargeKind;
  }) => {
    if (!expense) return;
    setError(null);
    if (isGrouped) {
      // Fase 32 — edição em grupo (single/all/subsequent): competência é
      // enviada apenas no escopo single; em grupo o RPC preserva/limpa.
      const fields: RecurrenceGroupFields = {
        description: payload.description,
        value: payload.value,
        category_id: payload.category_id,
        payment_method: payload.payment_method,
        card_id: payload.card_id,
        report_weight: payload.report_weight,
        ...(editScope === "single" ? { bill_competence: payload.bill_competence } : {}),
      };
      if (isRecurring) {
        await updateRecurrence.mutateAsync({ occurrenceId: expense.id, mode: editScope, fields });
      } else {
        await updateExpenseGrouped.mutateAsync({ id: expense.id, mode: editScope, fields });
      }
    } else {
      await updateExpense.mutateAsync({
        id: expense.id,
        input: payload,
      });
    }
    setIsEditing(false);
    onOpenChange(false);
  };

  /**
   * Repetição rápida (F21): clona o lançamento no mês atual com data ajustada
   * para hoje — nova despesa única (1 parcela) com os mesmos campos, novos
   * IDs e audit_events no envio (invariantes financeiras preservadas).
   */
  const handleShare = async (): Promise<void> => {
    if (!expense) return;
    triggerHaptic("light");
    const text = [
      `Despesa: ${expense.description || currentCategory?.name || "Despesa"}`,
      `Valor: ${formatCentsAsBRL(Math.round(expense.value * 100))}`,
      `Data: ${expense.date}`,
      `Categoria: ${currentCategory?.name ?? "Outra"}`,
      `Pagamento: ${PAYMENT_METHOD_LABELS[expense.payment_method] ?? expense.payment_method}`,
    ].join("\n");
    // Feedback do resultado: share nativo já dá confirmação visual; o fallback
    // de clipboard e a falta de suporte precisam de aviso explícito.
    const result = await shareText("Despesa — Finanças Pessoais", text);
    if (result === "copied") {
      pushToast({ title: "Copiado para a área de transferência", variant: "default" });
    } else if (result === "unsupported") {
      pushToast({ title: "Compartilhamento não suportado neste navegador", variant: "default" });
    }
  };

  const handleRepeat = async () => {
    if (!expense) return;
    setError(null);
    const selectedCard = cards.find((card) => card.id === expense.card_id);
    const date = todayISO();
    try {
      await createExpense.mutateAsync({
        value: expense.value,
        date,
        categoryId: expense.category_id,
        paymentMethod: expense.payment_method,
        cardId: expense.payment_method === "credit_card" ? expense.card_id : null,
        description: expense.description || null,
        reportWeight: expense.report_weight,
        installments: [
          {
            date,
            value: expense.value,
            billCompetence:
              expense.payment_method === "credit_card"
                ? resolveBillCompetence(new Date(`${date}T12:00:00`), selectedCard?.closing_day ?? 10)
                : null,
          },
        ],
        debtAmount: null,
        debtDueDate: null,
      });
      onOpenChange(false);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <>
      <Modal
        open={open}
        onOpenChange={(next) => {
          setError(null);
          setIsEditing(false);
          setConfirmOpen(false);
          setEditScope("single");
          onOpenChange(next);
        }}
        title={isEditing ? "Editar despesa" : "Detalhes da despesa"}
        showCalculator={isEditing}
      >
        {expense ? (
          <div className="mt-4 flex flex-col gap-4 min-w-0">
            {error ? <Alert variant="error">{error}</Alert> : null}

            {isEditing ? (
              <ExpenseEditForm
                key={expense.id}
                expense={expense}
                categories={categories}
                cards={cards}
                isPending={editPending}
                grouped={isGrouped}
                isRecurring={isRecurring}
                scope={editScope}
                onScopeChange={setEditScope}
                onCancel={() => {
                  setIsEditing(false);
                  setError(null);
                  setEditScope("single");
                }}
                onSave={handleSaveEdit}
              />
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <MoneyText
                      cents={Math.round(expense.value * 100)}
                      tone="negative"
                      variant="value"
                      className="text-3xl font-bold"
                    />
                    {expense.report_weight < 1 ? (
                      <span className="text-xs font-mono text-muted-foreground">
                        Valor no relatório: {formatCentsAsBRL(Math.round(expense.value * expense.report_weight * 100))} ({Math.round(expense.report_weight * 100)}%)
                      </span>
                    ) : null}
                    <p className="text-sm font-medium text-foreground">
                      {expense.description || currentCategory?.name || "Despesa"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => setIsEditing(true)}
                  >
                    <Pencil className="size-3.5" aria-hidden="true" />
                    Editar
                  </Button>
                </div>

                <dl className="flex flex-col gap-2 rounded-xl border border-border/80 bg-surface/60 p-3.5 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="text-xs text-muted-foreground">Categoria</dt>
                    <dd className="flex items-center gap-1.5 font-medium text-foreground text-xs">
                      {currentCategory ? (
                        <>
                          <CategoryIcon icon={currentCategory.icon} color={currentCategory.color} className="size-3.5" />
                          <span>{currentCategory.name}</span>
                        </>
                      ) : (
                        "Outra"
                      )}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-xs text-muted-foreground">Data</dt>
                    <dd className="font-medium text-foreground text-xs">{expense.date}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-xs text-muted-foreground">Pagamento</dt>
                    <dd className="font-medium text-foreground text-xs">
                      {PAYMENT_METHOD_LABELS[expense.payment_method] ?? expense.payment_method}
                    </dd>
                  </div>
                  {expense.charge_kind && expense.charge_kind !== "regular" ? (
                    <div className="flex items-center justify-between">
                      <dt className="text-xs text-muted-foreground">Natureza</dt>
                      <dd className="font-medium text-warning text-xs">
                        {CHARGE_KIND_LABELS[expense.charge_kind]}
                      </dd>
                    </div>
                  ) : null}
                  {expense.report_weight < 1 ? (
                    <div className="flex items-center justify-between">
                      <dt className="text-xs text-muted-foreground">Valor no relatório</dt>
                      <dd className="font-medium text-foreground text-xs font-mono">
                        {formatCentsAsBRL(Math.round(expense.value * expense.report_weight * 100))} ({Math.round(expense.report_weight * 100)}%)
                      </dd>
                    </div>
                  ) : null}
                  {isInstallment ? (
                    <div className="flex items-center justify-between">
                      <dt className="text-xs text-muted-foreground">Parcela</dt>
                      <dd className="font-medium text-foreground text-xs">
                        {expense.installment_number}/{expense.installments_total}
                      </dd>
                    </div>
                  ) : null}
                  {expense.bill_competence ? (
                    <div className="flex items-center justify-between">
                      <dt className="text-xs text-muted-foreground">Fatura</dt>
                      <dd className="font-medium text-foreground text-xs">{expense.bill_competence}</dd>
                    </div>
                  ) : null}
                </dl>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/60">
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="shrink-0"
                      onClick={() => void handleShare()}
                    >
                      <Share2 className="size-3.5" aria-hidden="true" />
                      Compartilhar
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="shrink-0"
                      onClick={() => void handleRepeat()}
                      disabled={createExpense.isPending}
                    >
                      <Copy className="size-3.5" aria-hidden="true" />
                      {createExpense.isPending ? "Repetindo…" : "Repetir no mês atual"}
                    </Button>
                  </div>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs font-medium text-critical transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => setConfirmOpen(true)}
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                    Excluir
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Excluir despesa?"
        description={
          isGrouped
            ? "A exclusão remove também as dívidas pendentes vinculadas. Dívidas quitadas não são alteradas."
            : "Esta ação não pode ser desfeita. Dívidas pendentes vinculadas também serão removidas."
        }
        confirmLabel={deleteExpense.isPending || deleteRecurrence.isPending ? "Excluindo…" : "Excluir"}
        variant="destructive"
        confirmPending={deleteExpense.isPending || deleteRecurrence.isPending}
        onConfirm={() => void handleConfirmDelete()}
      >
        {isGrouped ? (
          <div className="mt-4 flex flex-col gap-1.5">
            <span className="text-sm font-medium">O que excluir?</span>
            <Select
              value={mode}
              onValueChange={(value) => setMode(value as InstallmentDeleteMode)}
              options={isRecurring ? RECURRENCE_MODE_OPTIONS : MODE_OPTIONS}
              ariaLabel="Modo de exclusão"
            />
          </div>
        ) : null}
      </ConfirmDialog>
    </>
  );
}
