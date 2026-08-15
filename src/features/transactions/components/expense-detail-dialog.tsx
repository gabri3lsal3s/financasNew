import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Alert, Button, ConfirmDialog, DatePicker, Input, Modal, MoneyInput, Select } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { CategoryIcon } from "@/components/modules/category-icon";
import { getErrorMessage } from "@/services/errors";
import { useCategories, useCreditCards, useDeleteExpense, useUpdateExpense } from "@/state";
import { PAYMENT_METHOD_LABELS } from "@/lib/labels";
import type { Category, CreditCard, Expense, InstallmentDeleteMode, PaymentMethod } from "@/types";

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

const PAYMENT_OPTIONS = [
  { value: "pix", label: "Pix" },
  { value: "credit_card", label: "Cartão de Crédito" },
  { value: "debit", label: "Cartão de Débito" },
  { value: "cash", label: "Dinheiro" },
  { value: "transfer", label: "Transferência" },
  { value: "other", label: "Outro" },
];

import { resolveBillCompetence } from "@/domain/competence";

interface ExpenseEditFormProps {
  expense: Expense;
  categories: Category[];
  cards: CreditCard[];
  isPending: boolean;
  onCancel: () => void;
  onSave: (payload: {
    description: string;
    value: number;
    date: string;
    category_id: string;
    payment_method: PaymentMethod;
    card_id: string | null;
    bill_competence: string | null;
  }) => Promise<void>;
}

function ExpenseEditForm({
  expense,
  categories,
  cards,
  isPending,
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
  const [formError, setFormError] = useState<string | null>(null);

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
    if (paymentMethod === "credit_card" && !cardId && cards.length > 0) {
      setFormError("Selecione o cartão de crédito.");
      return;
    }

    setFormError(null);
    try {
      const effectiveCard = cards.find((c) => c.id === cardId);
      const effectiveCompetence =
        paymentMethod === "credit_card"
          ? billCompetence.trim() ||
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

  return (
    <div className="flex flex-col gap-3.5">
      {formError ? <Alert variant="error">{formError}</Alert> : null}

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
        />
      </label>

      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        Data
        <DatePicker
          value={date}
          onValueChange={setDate}
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

      {paymentMethod === "credit_card" && cards.length > 0 ? (
        <>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Cartão de crédito
            <Select
              value={cardId}
              onValueChange={(val) => {
                setCardId(val);
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

          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Fatura (Competência)
            <Input
              value={billCompetence}
              onChange={(e) => setBillCompetence(e.target.value)}
              placeholder="AAAA-MM (ex: 2026-08)"
              aria-label="Competência da fatura"
            />
          </label>
        </>
      ) : null}

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
          type="button"
          size="sm"
          disabled={isPending}
          onClick={() => void handleSubmit()}
        >
          {isPending ? "Salvando…" : "Salvar alterações"}
        </Button>
      </div>
    </div>
  );
}

/** Detalhe da despesa + edição completa com troca de categoria + exclusão em 3 modos. */
export function ExpenseDetailDialog({ expense, open, onOpenChange }: ExpenseDetailDialogProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [mode, setMode] = useState<InstallmentDeleteMode>("single");
  const [error, setError] = useState<string | null>(null);

  const categoriesQuery = useCategories("expense");
  const cardsQuery = useCreditCards();
  const deleteExpense = useDeleteExpense();
  const updateExpense = useUpdateExpense();

  const categories = categoriesQuery.data ?? [];
  const cards = cardsQuery.data ?? [];
  const currentCategory = categories.find((c) => c.id === expense?.category_id);

  const isInstallment = expense != null && expense.installments_total > 1;

  const handleConfirmDelete = async () => {
    if (!expense) return;
    setError(null);
    try {
      await deleteExpense.mutateAsync({ expenseId: expense.id, mode });
      setConfirmOpen(false);
      onOpenChange(false);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleSaveEdit = async (payload: {
    description: string;
    value: number;
    date: string;
    category_id: string;
    payment_method: PaymentMethod;
    card_id: string | null;
    bill_competence: string | null;
  }) => {
    if (!expense) return;
    setError(null);
    await updateExpense.mutateAsync({
      id: expense.id,
      input: payload,
    });
    setIsEditing(false);
    onOpenChange(false);
  };

  return (
    <>
      <Modal
        open={open}
        onOpenChange={(next) => {
          setError(null);
          setIsEditing(false);
          onOpenChange(next);
        }}
        title={isEditing ? "Editar despesa" : "Detalhes da despesa"}
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
                isPending={updateExpense.isPending}
                onCancel={() => {
                  setIsEditing(false);
                  setError(null);
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

                <div className="flex items-center justify-between pt-2 border-t border-border/60">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs font-medium text-critical transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => setConfirmOpen(true)}
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                    Excluir despesa
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
          isInstallment
            ? "A exclusão remove também as dívidas pendentes vinculadas. Dívidas quitadas não são alteradas."
            : "Esta ação não pode ser desfeita. Dívidas pendentes vinculadas também serão removidas."
        }
        confirmLabel={deleteExpense.isPending ? "Excluindo…" : "Excluir"}
        variant="destructive"
        confirmPending={deleteExpense.isPending}
        onConfirm={() => void handleConfirmDelete()}
      >
        {isInstallment ? (
          <div className="mt-4 flex flex-col gap-1.5">
            <span className="text-sm font-medium">O que excluir?</span>
            <Select value={mode} onValueChange={(value) => setMode(value as InstallmentDeleteMode)} options={MODE_OPTIONS} ariaLabel="Modo de exclusão" />
          </div>
        ) : null}
      </ConfirmDialog>
    </>
  );
}
