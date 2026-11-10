import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Copy, Minus, Pencil, Plane, Share2, Trash2, TrendingDown, TrendingUp, Users } from "lucide-react";
import { Alert, Badge, Button, ConfirmDialog, DatePicker, FormField, Input, Modal, ModalFooter, MoneyInput, RadioGroup, Select, Switch } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { CategoryIcon } from "@/components/modules/category-icon";
import { SplitExpenseDialog } from "@/components/modules/split-expense-dialog";
import { formatCentsAsBRL } from "@/services/masks";
import { shareText } from "@/services/export-actions";
import { getErrorMessage } from "@/services/errors";
import { pushToast } from "@/services/toast";
import { cn } from "@/lib/utils";
import {
  useCategories,
  useCreditCards,
  useCreateExpense,
  useDeleteExpense,
  useDeleteRecurrenceOccurrences,
  useExpenses,
  useFamilyMode,
  useMyFamily,
  useUpdateExpense,
  useUpdateExpenseGrouped,
  useUpdateRecurrenceOccurrences,
} from "@/state";
import {
  TRIP_QUERY_KEYS,
  useTripDetails,
  useDeleteTripExpenseLinkedMutation,
  useUpdateTripExpenseLinkedMutation,
} from "@/state/queries/use-trips";
import { useMutationGuard } from "@/hooks/use-mutation-guard";

import type { Category, CreditCard, Expense, InstallmentDeleteMode, PaymentMethod, RecurrenceGroupFields } from "@/types";

import { PAYMENT_METHOD_LABELS } from "@/lib/labels";
import { resolveBillCompetence } from "@/domain/competence";
import { todayISO } from "@/domain/debts";
import { shiftMonth } from "@/lib/date";
import { evaluateExpensePriceEvolution } from "@/domain/insights";
import { REPORT_WEIGHT_PRESETS } from "./report-weight-constants";
import { ReportWeightField } from "./report-weight-field";



export interface ExpenseDetailDialogProps {
  expense: Expense | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialEditing?: boolean;
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
    is_family?: boolean;
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
  const [cardId, setCardId] = useState<string>(expense.card_id || "");
  const [billCompetence, setBillCompetence] = useState<string>(expense.bill_competence || "");
  const [isFamily, setIsFamily] = useState(Boolean(expense.is_family));
  // Competência digitada manualmente → data deixa de recalculá-la (override).
  const [competenceTouched, setCompetenceTouched] = useState(false);
  const isPreset = REPORT_WEIGHT_PRESETS.includes(expense.report_weight);
  const [weightMode, setWeightMode] = useState<string>(isPreset ? String(expense.report_weight) : "custom");
  const [reportCustomAmountCents, setReportCustomAmountCents] = useState(
    Math.round(expense.value * expense.report_weight * 100),
  );
  const [formError, setFormError] = useState<string | null>(null);
  const { isFamilyModeEnabled } = useFamilyMode();
  const isFamilyActive = Boolean(isFamilyModeEnabled);

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
        is_family: isFamilyActive ? isFamily : Boolean(expense.is_family),
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

      {expense.trip_id ? (
        <div className="flex items-center gap-2 p-2.5 rounded-xl border border-portfolio/20 bg-portfolio/5 text-xs text-portfolio">
          <Plane className="size-4 shrink-0" aria-hidden="true" />
          <span>
            Vinculada ao Modo Viagem. As alterações de valor, descrição e data serão sincronizadas automaticamente com os participantes da viagem.
          </span>
        </div>
      ) : null}

      {grouped ? (
        <FormField
          label="Aplicar a"
          helperText={
            !isRecurring && scope !== "single"
              ? "O valor é editado por lançamento para preservar o total do parcelamento. Para mudar o total, exclua e refaça."
              : undefined
          }
        >
          <Select
            value={scope}
            onValueChange={(value) => onScopeChange(value as InstallmentDeleteMode)}
            options={EDIT_SCOPE_OPTIONS}
            ariaLabel="Escopo da edição"
          />
        </FormField>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <FormField label="Descrição" className="sm:col-span-2">
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descrição da despesa"
            aria-label="Descrição"
          />
        </FormField>

        <FormField label="Valor">
          <MoneyInput
            cents={valueCents}
            onCentsChange={setValueCents}
            aria-label="Valor da despesa"
            disabled={valueDisabled}
          />
        </FormField>

        <FormField label="Data">
          <DatePicker
            value={date}
            onValueChange={handleDateChange}
            ariaLabel="Data da despesa"
          />
        </FormField>

        <FormField label="Categoria">
          <Select
            value={categoryId}
            onValueChange={setCategoryId}
            options={categoryOptions}
            placeholder="Selecione a categoria"
            ariaLabel="Categoria da despesa"
          />
        </FormField>

        <FormField label="Forma de pagamento">
          <Select
            value={paymentMethod}
            onValueChange={(val) => setPaymentMethod(val as PaymentMethod)}
            options={PAYMENT_OPTIONS}
            ariaLabel="Forma de pagamento"
          />
        </FormField>

        {paymentMethod === "credit_card" && cards.length > 0 ? (
          <>
            <FormField label="Cartão de crédito">
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
            </FormField>

            {scope === "single" ? (
              <FormField
                label="Fatura (Competência)"
                helperText="Calculada pelo fechamento do cartão; edite para ajustar manualmente."
              >
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
              </FormField>
            ) : null}
          </>
        ) : null}
      </div>

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
        customLabel="Sua cota considerada no relatório"
        ariaLabelCustom="Sua cota considerada no relatório"
      />

      {isFamilyActive && (
        <div className="rounded-xl border border-border/80 bg-surface p-3">
          <Switch
            id="edit-expense-family"
            checked={isFamily}
            onCheckedChange={setIsFamily}
            label="Despesa da Casa / Familiar"
            description="Visível no Painel Familiar compartilhado"
          />
        </div>
      )}

      <ModalFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={isPending}
        >
          {isPending ? "Salvando…" : "Salvar alterações"}
        </Button>
      </ModalFooter>
    </form>
  );
}

type TripDeleteMode = "both" | "personal_only";

function useSafeQueryClient() {
  try {
    return useQueryClient();
  } catch {
    return null;
  }
}

/** Detalhe da despesa + edição completa com troca de categoria + exclusão em 3 modos. */
export function ExpenseDetailDialog({
  expense,
  open,
  onOpenChange,
  initialEditing = false,
}: ExpenseDetailDialogProps) {
  const [isEditing, setIsEditing] = useState(initialEditing);
  const [prevOpen, setPrevOpen] = useState(open);

  const { guardAction, upgradeModal, isReadOnlyMode } = useMutationGuard({ moduleKey: "transactions" });

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [splitOpen, setSplitOpen] = useState(false);
  const [mode, setMode] = useState<InstallmentDeleteMode>("single");
  const [editScope, setEditScope] = useState<InstallmentDeleteMode>("single");
  const [tripDeleteMode, setTripDeleteMode] = useState<TripDeleteMode>("both");
  const [error, setError] = useState<string | null>(null);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setIsEditing(isReadOnlyMode ? false : initialEditing);
    }
  }

  const categoriesQuery = useCategories("expense");
  const cardsQuery = useCreditCards();
  const navigate = useNavigate();
  const queryClient = useSafeQueryClient();
  const { isFamilyModeEnabled } = useFamilyMode();
  const { data: myFamilyData } = useMyFamily();
  const isFamilyActive = Boolean(isFamilyModeEnabled);
  const deleteExpense = useDeleteExpense();
  const deleteRecurrence = useDeleteRecurrenceOccurrences();
  const updateExpense = useUpdateExpense();
  const updateExpenseGrouped = useUpdateExpenseGrouped();
  const updateRecurrence = useUpdateRecurrenceOccurrences();
  const createExpense = useCreateExpense();
  const deleteTripExpenseLinked = useDeleteTripExpenseLinkedMutation(expense?.trip_id ?? "");
  const updateTripExpenseLinked = useUpdateTripExpenseLinkedMutation(expense?.trip_id ?? "");

  const categories = categoriesQuery.data ?? [];
  const cards = cardsQuery.data ?? [];
  const currentCategory = categories.find((c) => c.id === expense?.category_id);
  const expenseMonth = expense ? expense.date.slice(0, 7) : "";
  const isDetailOpen = open && Boolean(expense);
  const tripDetailsQuery = useTripDetails(isDetailOpen && Boolean(expense?.trip_id) ? expense?.trip_id : null);
  const tripName = tripDetailsQuery.data?.trip?.title;
  const expensesQuery = useExpenses(expenseMonth, { enabled: isDetailOpen });
  const prevMonth1Query = useExpenses(shiftMonth(expenseMonth, -1), { enabled: isDetailOpen && Boolean(expenseMonth) });
  const prevMonth2Query = useExpenses(shiftMonth(expenseMonth, -2), { enabled: isDetailOpen && Boolean(expenseMonth) });
  const prevMonth3Query = useExpenses(shiftMonth(expenseMonth, -3), { enabled: isDetailOpen && Boolean(expenseMonth) });

  const priceEvolution = useMemo(() => {
    if (!expense) return null;
    const allExpenses = [
      ...(expensesQuery.data ?? []),
      ...(prevMonth1Query.data ?? []),
      ...(prevMonth2Query.data ?? []),
      ...(prevMonth3Query.data ?? []),
    ];
    return evaluateExpensePriceEvolution(expense, allExpenses);
  }, [expense, expensesQuery.data, prevMonth1Query.data, prevMonth2Query.data, prevMonth3Query.data]);

  const isInstallment = expense != null && expense.installments_total > 1;
  const isRecurring = expense?.recurrence_id != null;
  const isGrouped = isInstallment || isRecurring;
  const editPending = updateExpense.isPending || updateExpenseGrouped.isPending || updateRecurrence.isPending;

  /**
   * Exclusão otimista (F30): fecha os diálogos e remove o item da lista na
   * hora; o hook faz rollback + toast se o servidor rejeitar.
   */
  const handleConfirmDelete = async () => {
    if (!expense) return;
    setError(null);
    setConfirmOpen(false);
    onOpenChange(false);
    try {
      if (expense.trip_id && tripDeleteMode === "both") {
        const result = await deleteTripExpenseLinked.mutateAsync({
          personalExpenseId: expense.id,
          deletePersonal: true,
        });

        // Se a despesa não estava vinculada em trip_expenses (ex.: desvinculada antes),
        // garante a exclusão da despesa pessoal pelo fluxo padrão.
        if (!result) {
          if (isRecurring) {
            await deleteRecurrence.mutateAsync({ occurrenceId: expense.id, mode });
          } else {
            await deleteExpense.mutateAsync({ expenseId: expense.id, mode });
          }
          queryClient?.invalidateQueries({ queryKey: TRIP_QUERY_KEYS.detail(expense.trip_id) });
        }

        pushToast({
          title: "Despesa excluída do extrato e da viagem",
          variant: "success",
        });
      } else if (expense.trip_id && tripDeleteMode === "personal_only") {
        if (isRecurring) {
          await deleteRecurrence.mutateAsync({ occurrenceId: expense.id, mode });
        } else {
          await deleteExpense.mutateAsync({ expenseId: expense.id, mode });
        }
        queryClient?.invalidateQueries({ queryKey: TRIP_QUERY_KEYS.detail(expense.trip_id) });
        pushToast({
          title: "Despesa excluída do extrato pessoal",
          description: "O lançamento foi mantido na viagem.",
          variant: "success",
        });
      } else {
        if (isRecurring) {
          await deleteRecurrence.mutateAsync({ occurrenceId: expense.id, mode });
          pushToast({
            title: mode === "single" ? "Ocorrência excluída com sucesso" : "Recorrências excluídas com sucesso",
            variant: "success",
          });
        } else {
          await deleteExpense.mutateAsync({ expenseId: expense.id, mode });
          pushToast({
            title: isInstallment && mode !== "single" ? "Parcelas excluídas com sucesso" : "Despesa excluída com sucesso",
            variant: "success",
          });
        }
      }
    } catch {
      // Falha tratada no onError da mutation com rollback automático e toast de erro
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
    is_family?: boolean;
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
        is_family: payload.is_family,
        ...(editScope === "single" ? { bill_competence: payload.bill_competence } : {}),
      };
      const resolvedFamilyId = payload.is_family ? (myFamilyData?.family?.id ?? null) : null;
      if (isRecurring) {
        await updateRecurrence.mutateAsync({
          occurrenceId: expense.id,
          mode: editScope,
          fields: { ...fields, family_id: resolvedFamilyId },
        });
      } else {
        await updateExpenseGrouped.mutateAsync({
          id: expense.id,
          mode: editScope,
          fields: { ...fields, family_id: resolvedFamilyId },
        });
      }
    } else {
      const resolvedFamilyId = payload.is_family ? (myFamilyData?.family?.id ?? null) : null;
      await updateExpense.mutateAsync({
        id: expense.id,
        input: {
          ...payload,
          family_id: resolvedFamilyId,
          charge_kind: expense.charge_kind ?? "regular",
        },
      });
    }

    if (expense.trip_id) {
      const matchingCategory = categories.find((c) => c.id === payload.category_id);
      try {
        await updateTripExpenseLinked.mutateAsync({
          personalExpenseId: expense.id,
          value: payload.value,
          description: payload.description,
          date: payload.date,
          categoryName: matchingCategory?.name,
        });
      } catch {
        // Mantém resiliência da despesa pessoal
      }
    }

    const familyChanged = isFamilyActive && payload.is_family !== undefined && payload.is_family !== expense.is_family;
    if (familyChanged) {
      pushToast({
        title: "Despesa atualizada com sucesso",
        description: payload.is_family
          ? "Esta despesa foi marcada como Familiar e agora pertence à visão Familiar."
          : "Esta despesa foi marcada como Individual e agora pertence à visão Pessoal.",
        variant: "success",
      });
    } else if (expense.trip_id) {
      pushToast({
        title: "Despesa atualizada no extrato e na viagem",
        description: "Os valores e a divisão na viagem foram sincronizados.",
        variant: "success",
      });
    } else {
      pushToast({
        title: "Despesa atualizada com sucesso",
        variant: "success",
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
          setTripDeleteMode("both");
          onOpenChange(next);
        }}
        title={isEditing ? "Editar despesa" : "Detalhes da despesa"}
        size={isEditing ? "xl" : "lg"}
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
                    onClick={() => guardAction(() => setIsEditing(true), "Editar Despesa")}
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
                  {isFamilyActive && (
                    <div className="flex items-center justify-between">
                      <dt className="text-xs text-muted-foreground">Orçamento</dt>
                      <dd className="font-medium text-foreground text-xs">
                        {expense.is_family ? (
                          <Badge variant="muted" size="xs">
                            Familiar
                          </Badge>
                        ) : (
                          "Individual"
                        )}
                      </dd>
                    </div>
                  )}
                  {expense.trip_id && (
                    <div className="flex items-center justify-between">
                      <dt className="text-xs text-muted-foreground">Viagem</dt>
                      <dd className="font-medium text-foreground text-xs">
                        <Badge variant="portfolio" size="xs" className="gap-1 font-medium">
                          <Plane className="size-3 text-portfolio" aria-hidden="true" />
                          <span>Modo Viagem</span>
                        </Badge>
                      </dd>
                    </div>
                  )}
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

                {priceEvolution && (
                  <div className="flex flex-col gap-2 rounded-xl border border-border/80 bg-surface/60 p-3.5 text-xs shadow-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-semibold text-foreground">
                        {priceEvolution.hasPriceIncrease ? (
                          <TrendingUp className="size-3.5 text-warning-strong" aria-hidden="true" />
                        ) : priceEvolution.deltaPreviousCents !== null && priceEvolution.deltaPreviousCents < 0 ? (
                          <TrendingDown className="size-3.5 text-positive-strong" aria-hidden="true" />
                        ) : (
                          <Minus className="size-3.5 text-muted-foreground" aria-hidden="true" />
                        )}
                        <span>Evolução do Gasto</span>
                      </div>
                      {priceEvolution.hasPriceIncrease && priceEvolution.deltaPreviousPercent !== null && (
                        <Badge variant="warning" size="xs">
                          Reajuste +{priceEvolution.deltaPreviousPercent}%
                        </Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
                      <div className="flex flex-col gap-0.5 rounded-lg border border-border/60 bg-surface p-2">
                        <span className="text-muted-foreground">vs Mês Anterior</span>
                        <div className="flex items-center gap-1 font-semibold tabular-nums">
                          <MoneyText
                            cents={priceEvolution.deltaPreviousCents ?? 0}
                            tone={(priceEvolution.deltaPreviousCents ?? 0) > 0 ? "negative" : (priceEvolution.deltaPreviousCents ?? 0) < 0 ? "positive" : "default"}
                            sign="explicit"
                          />
                          {priceEvolution.deltaPreviousPercent !== null && (
                            <span className="text-muted-foreground">
                              ({priceEvolution.deltaPreviousPercent > 0 ? `+${priceEvolution.deltaPreviousPercent}%` : `${priceEvolution.deltaPreviousPercent}%`})
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-0.5 rounded-lg border border-border/60 bg-surface p-2">
                        <span className="text-muted-foreground">vs Média Histórica</span>
                        <div className="flex items-center gap-1 font-semibold tabular-nums">
                          <MoneyText
                            cents={priceEvolution.deltaMedianCents ?? 0}
                            tone={(priceEvolution.deltaMedianCents ?? 0) > 0 ? "negative" : (priceEvolution.deltaMedianCents ?? 0) < 0 ? "positive" : "default"}
                            sign="explicit"
                          />
                          {priceEvolution.deltaMedianPercent !== null && (
                            <span className="text-muted-foreground">
                              ({priceEvolution.deltaMedianPercent > 0 ? `+${priceEvolution.deltaMedianPercent}%` : `${priceEvolution.deltaMedianPercent}%`})
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-0.5 rounded-lg border border-border/60 bg-surface p-2">
                        <span className="text-muted-foreground">
                          1º Registro{priceEvolution.firstOccurrenceDate ? ` (${priceEvolution.firstOccurrenceDate.slice(0, 7)})` : ""}
                        </span>
                        <div className="flex items-center gap-1 font-semibold tabular-nums">
                          <MoneyText cents={priceEvolution.firstOccurrenceCents ?? 0} tone="default" />
                          {priceEvolution.deltaFirstPercent !== null && (
                            <span className="text-muted-foreground">
                              ({priceEvolution.deltaFirstPercent >= 0 ? `+${priceEvolution.deltaFirstPercent}%` : `${priceEvolution.deltaFirstPercent}%`})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pt-3.5 border-t border-border/80 mt-2">
                  <div className="grid grid-cols-3 gap-2 w-full sm:flex sm:w-auto sm:items-center">
                    {expense.trip_id ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1.5 px-2 sm:px-3 text-xs justify-center border-portfolio/40 text-portfolio hover:bg-portfolio/10"
                        onClick={() => {
                          onOpenChange(false);
                          navigate(`/viagens/${expense.trip_id}`);
                        }}
                        title="Ver esta despesa no Modo Viagem"
                        aria-label="Ver na Viagem"
                      >
                        <Plane className="size-3.5 shrink-0" aria-hidden="true" />
                        <span className="hidden sm:inline">Na Viagem</span>
                        <span className="sm:hidden">Viagem</span>
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1.5 px-2 sm:px-3 text-xs justify-center"
                        onClick={() => guardAction(() => setSplitOpen(true), "Rachar Despesa")}
                        title="Rachar despesa"
                        aria-label="Rachar"
                      >
                        <Users className="size-3.5 shrink-0" aria-hidden="true" />
                        <span className="hidden sm:inline">Rachar</span>
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5 px-2 sm:px-3 text-xs justify-center"
                      onClick={() => void handleShare()}
                      title="Compartilhar comprovante"
                      aria-label="Compartilhar"
                    >
                      <Share2 className="size-3.5 shrink-0" aria-hidden="true" />
                      <span className="hidden sm:inline">Compartilhar</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5 px-2 sm:px-3 text-xs justify-center"
                      onClick={() => guardAction(() => void handleRepeat(), "Duplicar Despesa")}
                      disabled={createExpense.isPending}
                      title="Repetir no mês atual"
                      aria-label="Repetir no mês atual"
                    >
                      <Copy className="size-3.5 shrink-0" aria-hidden="true" />
                      <span className="hidden sm:inline">{createExpense.isPending ? "Repetindo…" : "Repetir"}</span>
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full sm:w-auto text-critical hover:bg-critical/10 hover:text-critical gap-1.5"
                    onClick={() => guardAction(() => setConfirmOpen(true), "Excluir Despesa")}
                  >
                    <Trash2 className="size-3.5 shrink-0" aria-hidden="true" />
                    <span>Excluir</span>
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </Modal>

      {splitOpen && expense ? (
        <SplitExpenseDialog
          open={splitOpen}
          onOpenChange={setSplitOpen}
          expense={expense}
          categoryName={categories.find((c) => c.id === expense.category_id)?.name}
          categoryIcon={categories.find((c) => c.id === expense.category_id)?.icon ?? undefined}
        />
      ) : null}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(next) => {
          setConfirmOpen(next);
          if (next) {
            setTripDeleteMode("both");
          }
        }}
        title={expense?.trip_id ? "Excluir despesa vinculada?" : "Excluir despesa?"}
        description={
          expense?.trip_id
            ? "Esta despesa está vinculada ao Modo Viagem. Escolha como deseja prosseguir com a exclusão:"
            : isGrouped
              ? "A exclusão remove também as dívidas pendentes vinculadas. Dívidas quitadas não são alteradas."
              : "Esta ação não pode ser desfeita. Dívidas pendentes vinculadas também serão removidas."
        }
        confirmLabel={
          deleteExpense.isPending || deleteRecurrence.isPending || deleteTripExpenseLinked.isPending
            ? "Excluindo…"
            : "Excluir"
        }
        variant="destructive"
        confirmPending={
          deleteExpense.isPending || deleteRecurrence.isPending || deleteTripExpenseLinked.isPending
        }
        onConfirm={() => void handleConfirmDelete()}
      >
        {expense?.trip_id ? (
          <div className="flex flex-col gap-3">
            <Alert variant="warning">
              Esta despesa está vinculada ao Modo Viagem{tripName ? ` (${tripName})` : ""}.
            </Alert>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-foreground">Como deseja prosseguir?</span>
              <RadioGroup
                variant="cards"
                value={tripDeleteMode}
                onValueChange={(val) => setTripDeleteMode(val as TripDeleteMode)}
                name="trip-delete-mode"
                options={[
                  {
                    value: "both",
                    label: "Excluir do extrato e da viagem",
                    description:
                      "Apaga o lançamento do seu extrato pessoal e remove a despesa do livro da viagem.",
                  },
                  {
                    value: "personal_only",
                    label: "Excluir apenas do extrato pessoal",
                    description:
                      "Remove o lançamento do seu extrato e mantém a despesa registrada na viagem.",
                  },
                ]}
              />
            </div>
          </div>
        ) : null}

        {isGrouped ? (
          <div className={cn("flex flex-col gap-1.5", expense?.trip_id ? "mt-3 pt-3 border-t border-border/80" : "mt-4")}>
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

      {upgradeModal}
    </>
  );
}
