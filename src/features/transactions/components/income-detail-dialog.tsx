import { useState } from "react";
import { Copy, Pencil, Share2, Sparkles, Trash2 } from "lucide-react";
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
  useCreateIncome,
  useDeleteIncome,
  useDeleteIncomeGrouped,
  useDeleteRecurrenceOccurrences,
  useUpdateIncome,
  useUpdateIncomeGrouped,
  useUpdateRecurrenceOccurrences,
} from "@/state";

import type { Category, DbInsert, Income, InstallmentDeleteMode, ReceiveType, RecurrenceGroupFields } from "@/types";

import { RECEIVE_TYPE_LABELS } from "@/lib/labels";
import { todayISO } from "@/domain/debts";
import { REPORT_WEIGHT_PRESETS } from "./report-weight-constants";
import { ReportWeightField } from "./report-weight-field";



const RECEIVE_OPTIONS = Object.entries(RECEIVE_TYPE_LABELS).map(([value, label]) => ({ value, label }));

/** Modos de exclusão para rendas parceladas (Fase 32). */
const MODE_OPTIONS = [
  { value: "single", label: "Apenas esta parcela" },
  { value: "all", label: "Todas as parcelas" },
  { value: "subsequent", label: "Esta parcela e as seguintes" },
];

/** Escopo da edição em grupo (Fase 32) — rótulos genéricos (parcela/ocorrência). */
const EDIT_SCOPE_OPTIONS = [
  { value: "single", label: "Apenas este lançamento" },
  { value: "all", label: "Todos do grupo" },
  { value: "subsequent", label: "Este e os seguintes" },
];

/** Modos de exclusão para recorrências (Fase 32). */
const RECURRENCE_MODE_OPTIONS = [
  { value: "single", label: "Apenas esta ocorrência" },
  { value: "all", label: "Todas as ocorrências" },
  { value: "subsequent", label: "Esta ocorrência e as seguintes" },
];

export interface IncomeDetailDialogProps {
  income: Income | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface IncomeEditFormProps {
  income: Income;
  categories: Category[];
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
    receive_type: ReceiveType;
    report_weight: number;
  }) => Promise<void>;
}

function IncomeEditForm({
  income,
  categories,
  isPending,
  grouped,
  isRecurring,
  scope,
  onScopeChange,
  onCancel,
  onSave,
}: IncomeEditFormProps) {
  const [description, setDescription] = useState(income.description || "");
  const [valueCents, setValueCents] = useState(Math.round(income.value * 100));
  const [date, setDate] = useState(income.date);
  const [categoryId, setCategoryId] = useState(income.category_id);
  const [receiveType, setReceiveType] = useState<ReceiveType>(income.receive_type);
  const isPreset = REPORT_WEIGHT_PRESETS.includes(income.report_weight);
  const [weightMode, setWeightMode] = useState<string>(isPreset ? String(income.report_weight) : "custom");
  const [reportCustomAmountCents, setReportCustomAmountCents] = useState(
    Math.round(income.value * income.report_weight * 100),
  );
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (valueCents <= 0) {
      setFormError("O valor da receita deve ser maior que zero.");
      return;
    }
    if (!categoryId) {
      setFormError("Selecione uma categoria.");
      return;
    }
    if (!date) {
      setFormError("Informe a data da receita.");
      return;
    }

    if (weightMode === "custom" && (reportCustomAmountCents < 0 || reportCustomAmountCents > valueCents)) {
      setFormError("O valor no relatório deve ser entre zero e o valor total da receita.");
      return;
    }

    const calculatedWeight =
      weightMode === "custom"
        ? Number((reportCustomAmountCents / valueCents).toFixed(4))
        : Number(weightMode);

    setFormError(null);
    try {
      await onSave({
        description: description.trim(),
        value: valueCents / 100,
        date,
        category_id: categoryId,
        receive_type: receiveType,
        report_weight: calculatedWeight,
      });
    } catch (err) {
      setFormError(getErrorMessage(err));
    }
  };

  const categoryOptions = categories.map((c) => ({
    value: c.id,
    label: c.name,
  }));

  // Parcelada: o valor é editável apenas por lançamento (invariante de soma do
  // parcelamento). Recorrência: sem invariante de soma, valor editável em grupo.
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground sm:col-span-2">
          Descrição
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descrição da receita"
            aria-label="Descrição"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Valor
          <MoneyInput
            cents={valueCents}
            onCentsChange={setValueCents}
            aria-label="Valor da receita"
            disabled={valueDisabled}
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Data
          <DatePicker
            value={date}
            onValueChange={setDate}
            ariaLabel="Data da receita"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Categoria
          <Select
            value={categoryId}
            onValueChange={setCategoryId}
            options={categoryOptions}
            placeholder="Selecione a categoria"
            ariaLabel="Categoria da receita"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Forma de recebimento
          <Select
            value={receiveType}
            onValueChange={(val) => setReceiveType(val as ReceiveType)}
            options={RECEIVE_OPTIONS}
            ariaLabel="Forma de recebimento"
          />
        </label>
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
        customLabel="Valor recebido real considerado no relatório"
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

/**
 * Detalhe da receita + edição completa + exclusão. Rendas automáticas
 * (source_ref, ex.: estorno [REFUND]) são somente-leitura (§3.1) — sem
 * ações de edição/exclusão.
 */
export function IncomeDetailDialog({ income, open, onOpenChange }: IncomeDetailDialogProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [mode, setMode] = useState<InstallmentDeleteMode>("single");
  const [editScope, setEditScope] = useState<InstallmentDeleteMode>("single");
  const [error, setError] = useState<string | null>(null);

  const categoriesQuery = useCategories("income");
  const deleteIncome = useDeleteIncome();
  const deleteIncomeGrouped = useDeleteIncomeGrouped();
  const deleteRecurrence = useDeleteRecurrenceOccurrences();
  const updateIncome = useUpdateIncome();
  const updateIncomeGrouped = useUpdateIncomeGrouped();
  const updateRecurrence = useUpdateRecurrenceOccurrences();
  const createIncome = useCreateIncome();

  const categories = categoriesQuery.data ?? [];
  const currentCategory = categories.find((c) => c.id === income?.category_id);
  const isReadOnly = income?.source_ref != null;
  const isInstallment = income != null && (income.installments_total ?? 1) > 1;
  const isRecurring = income?.recurrence_id != null;
  const isGrouped = isInstallment || isRecurring;
  const editPending = updateIncome.isPending || updateIncomeGrouped.isPending || updateRecurrence.isPending;

  /**
   * Exclusão otimista (F30): fecha os diálogos e remove a renda da lista na
   * hora; o hook faz rollback + toast se o servidor rejeitar.
   */
  const handleConfirmDelete = () => {
    if (!income) return;
    setError(null);
    setConfirmOpen(false);
    onOpenChange(false);
    if (isRecurring) {
      void Promise.resolve(deleteRecurrence.mutateAsync({ occurrenceId: income.id, mode })).catch(() => undefined);
    } else if (isGrouped) {
      void Promise.resolve(deleteIncomeGrouped.mutateAsync({ id: income.id, mode })).catch(() => undefined);
    } else {
      void Promise.resolve(deleteIncome.mutateAsync(income.id)).catch(() => undefined);
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
    receive_type: ReceiveType;
    report_weight: number;
  }) => {
    if (!income) return;
    setError(null);
    if (isGrouped) {
      // Fase 32 — edição em grupo (single/all/subsequent).
      const fields: RecurrenceGroupFields = {
        description: payload.description,
        value: payload.value,
        category_id: payload.category_id,
        receive_type: payload.receive_type,
        report_weight: payload.report_weight,
      };
      if (isRecurring) {
        await updateRecurrence.mutateAsync({ occurrenceId: income.id, mode: editScope, fields });
      } else {
        await updateIncomeGrouped.mutateAsync({ id: income.id, mode: editScope, fields });
      }
    } else {
      await updateIncome.mutateAsync({
        id: income.id,
        input: payload,
      });
    }
    setIsEditing(false);
    onOpenChange(false);
  };

  /**
   * Repetição rápida (F21): clona a receita no mês atual com data ajustada
   * para hoje — nova renda com os mesmos campos, novos IDs/audit_events.
   */
  const handleShare = async (): Promise<void> => {
    if (!income) return;
    triggerHaptic("light");
    const text = [
      `Receita: ${income.description || currentCategory?.name || "Receita"}`,
      `Valor: ${formatCentsAsBRL(Math.round(income.value * 100))}`,
      `Data: ${income.date}`,
      `Categoria: ${currentCategory?.name ?? "Outra"}`,
    ].join("\n");
    // Feedback do resultado: share nativo já dá confirmação visual; o fallback
    // de clipboard e a falta de suporte precisam de aviso explícito.
    const result = await shareText("Receita — Finanças Pessoais", text);
    if (result === "copied") {
      pushToast({ title: "Copiado para a área de transferência", variant: "default" });
    } else if (result === "unsupported") {
      pushToast({ title: "Compartilhamento não suportado neste navegador", variant: "default" });
    }
  };

  const handleRepeat = async () => {
    if (!income) return;
    setError(null);
    const date = todayISO();
    try {
      const input = {
        value: income.value,
        date,
        category_id: income.category_id,
        receive_type: income.receive_type,
        description: income.description || null,
        report_weight: income.report_weight,
        source_ref: null,
      } satisfies Omit<DbInsert<Income>, "user_id">;
      await createIncome.mutateAsync(input);
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
        title={isEditing ? "Editar receita" : "Detalhes da receita"}
        size={isEditing ? "xl" : "lg"}
        showCalculator={isEditing}
      >
        {income ? (
          <div className="mt-4 flex flex-col gap-4 min-w-0">
            {error ? <Alert variant="error">{error}</Alert> : null}

            {isEditing ? (
              <IncomeEditForm
                key={income.id}
                income={income}
                categories={categories}
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
                      cents={Math.round(income.value * 100)}
                      tone="positive"
                      variant="value"
                      className="text-3xl font-bold"
                    />
                    {income.report_weight < 1 ? (
                      <span className="text-xs font-mono text-muted-foreground">
                        Valor no relatório: {formatCentsAsBRL(Math.round(income.value * income.report_weight * 100))} ({Math.round(income.report_weight * 100)}%)
                      </span>
                    ) : null}
                    <p className="text-sm font-medium text-foreground">
                      {income.description || currentCategory?.name || "Receita"}
                    </p>
                  </div>
                  {!isReadOnly ? (
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
                  ) : null}
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
                    <dd className="font-medium text-foreground text-xs">{income.date}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-xs text-muted-foreground">Recebimento</dt>
                    <dd className="font-medium text-foreground text-xs">
                      {RECEIVE_TYPE_LABELS[income.receive_type] ?? income.receive_type}
                    </dd>
                  </div>
                  {income.report_weight < 1 ? (
                    <div className="flex items-center justify-between">
                      <dt className="text-xs text-muted-foreground">Valor no relatório</dt>
                      <dd className="font-medium text-foreground text-xs font-mono">
                        {formatCentsAsBRL(Math.round(income.value * income.report_weight * 100))} ({Math.round(income.report_weight * 100)}%)
                      </dd>
                    </div>
                  ) : null}
                  {isReadOnly ? (
                    <div className="flex items-center justify-between">
                      <dt className="text-xs text-muted-foreground">Origem</dt>
                      <dd className="flex items-center gap-1 font-medium text-foreground text-xs">
                        <Sparkles className="size-3 text-positive-strong" aria-hidden="true" />
                        Renda automática — somente leitura
                      </dd>
                    </div>
                  ) : null}
                </dl>

                {!isReadOnly ? (
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
                        disabled={createIncome.isPending}
                      >
                        <Copy className="size-3.5" aria-hidden="true" />
                        {createIncome.isPending ? "Repetindo…" : "Repetir no mês atual"}
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
                ) : null}
              </div>
            )}
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Excluir receita?"
        description="Esta ação não pode ser desfeita."
        confirmLabel={
          deleteIncome.isPending || deleteIncomeGrouped.isPending || deleteRecurrence.isPending ? "Excluindo…" : "Excluir"
        }
        variant="destructive"
        confirmPending={deleteIncome.isPending || deleteIncomeGrouped.isPending || deleteRecurrence.isPending}
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
