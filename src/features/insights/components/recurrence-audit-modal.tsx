import { useState } from "react";
import { AlertTriangle, CalendarPlus, TrendingUp } from "lucide-react";
import { Badge, Button, Modal, ModalFooter } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { ExpenseDetailDialog } from "@/features/transactions/components/expense-detail-dialog";
import type { FeedbackDecision } from "@/domain/insights/feedback";
import type { ExpenseLike, RecurrenceOccurrence } from "@/domain/insights/recurrences";
import { pushToast } from "@/services/toast";
import type { Expense, PaymentMethod } from "@/types";
import { RecurrenceClassificationBar } from "./recurrence-audit/RecurrenceClassificationBar";
import { RecurrenceHistoryList } from "./recurrence-audit/RecurrenceHistoryList";
import { RecurrenceMetricsStrip } from "./recurrence-audit/RecurrenceMetricsStrip";

export interface RecurrenceAuditModalProps {
  occurrence: RecurrenceOccurrence | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditExpense?: (expense: Expense) => void;
  onConvert?: (occurrence: RecurrenceOccurrence) => void;
  isEssential?: boolean;
  currentFeedbackDecision?: FeedbackDecision | null;
  onFeedbackDecision?: (key: string, decision: FeedbackDecision | null) => void;
  onToggleEssential?: (key: string, nextEssential: boolean) => void;
}

function toExpense(item: ExpenseLike): Expense {
  if (item.rawExpense) return item.rawExpense;
  return {
    id: item.id,
    user_id: "",
    value: item.valueCents / 100,
    date: item.date ?? `${item.month}-01`,
    category_id: item.categoryId,
    payment_method: (item.paymentMethod as PaymentMethod) || "credit_card",
    card_id: item.cardId ?? null,
    installments_total: 1,
    installment_number: 1,
    installment_group_id: item.installmentGroupId ?? null,
    bill_competence: null,
    report_weight: 1,
    base_amount: item.valueCents / 100,
    description: item.description,
    charge_kind: "regular",
    recurrence_id: item.recurrenceId ?? null,
    created_at: new Date().toISOString(),
  };
}

export function RecurrenceAuditModal({
  occurrence,
  open,
  onOpenChange,
  onEditExpense,
  onConvert,
  isEssential = false,
  currentFeedbackDecision,
  onFeedbackDecision,
  onToggleEssential,
}: RecurrenceAuditModalProps) {
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  if (!occurrence) return null;

  const expenses = occurrence.expenses ?? [];
  const latestMonth = occurrence.months[occurrence.months.length - 1];
  const hasDuplicates =
    Boolean(occurrence.duplicateChargesThisMonth) &&
    (occurrence.duplicateChargesThisMonth ?? 0) >= 2;

  const handleApplyDecision = (decision: FeedbackDecision | null, successMsg: string) => {
    if (onFeedbackDecision) {
      onFeedbackDecision(occurrence.key, decision);
    } else if (onToggleEssential && (decision === "essential" || decision === null)) {
      onToggleEssential(occurrence.key, decision === "essential");
    }
    pushToast({
      title: "Classificação salva",
      description: successMsg,
      variant: "info",
    });
  };

  const handleEdit = (item: ExpenseLike) => {
    const expense = toExpense(item);
    onEditExpense?.(expense);
    setEditingExpense(expense);
  };

  return (
    <>
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        size="lg"
        title={occurrence.name}
        description="Auditoria detalhada e histórico de cobranças"
        footer={
          <ModalFooter borderless>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </ModalFooter>
        }
      >
        <div className="flex flex-col gap-4 py-1">
          <RecurrenceClassificationBar
            occurrence={occurrence}
            isEssential={isEssential}
            currentFeedbackDecision={currentFeedbackDecision}
            onApplyDecision={handleApplyDecision}
          />

          <RecurrenceMetricsStrip occurrence={occurrence} />

          {onConvert ? (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 rounded-xl border border-primary/25 bg-primary/5 p-3 sm:p-3.5">
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-xs font-semibold text-foreground">
                  Planejamento e Automação
                </span>
                <span className="text-[11px] text-muted-foreground leading-relaxed">
                  Fixe esta detecção como um agendamento formal para projeções e lançamentos automáticos.
                </span>
              </div>
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={() => onConvert(occurrence)}
                className="gap-1.5 shrink-0"
              >
                <CalendarPlus className="size-4" aria-hidden="true" />
                <span>Fixar como Recorrência Formal</span>
              </Button>
            </div>
          ) : null}

          {hasDuplicates ? (
            <div className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-3.5 text-xs text-foreground">
              <AlertTriangle className="size-4 shrink-0 text-warning-strong mt-0.5" aria-hidden="true" />
              <div className="flex flex-col gap-1 min-w-0">
                <p className="font-semibold text-warning-strong">Cobrança duplicada detectada</p>
                <p className="text-muted-foreground leading-relaxed">
                  Identificamos {occurrence.duplicateChargesThisMonth} cobranças registradas para este serviço no mesmo ciclo.
                  Examine os lançamentos abaixo para verificar se houve cobrança indevida ou duplicidade no extrato.
                </p>
              </div>
            </div>
          ) : null}

          {occurrence.priceAdjustment ? (
            <div className="flex flex-col gap-2.5 rounded-xl border border-warning/30 bg-surface p-3.5 shadow-xs">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="size-4 text-warning-strong" aria-hidden="true" />
                  <span className="text-xs font-semibold text-foreground">
                    {occurrence.priceAdjustment.label}
                  </span>
                </div>
                <Badge variant="warning" size="sm">
                  +{occurrence.priceAdjustment.percentIncrease}%
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg border border-border/60 bg-surface-hover/50 p-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    Valor histórico anterior
                  </span>
                  <MoneyText
                    cents={occurrence.priceAdjustment.oldCents}
                    tone="default"
                    className="text-base font-semibold"
                  />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] font-medium text-warning-strong">
                    Valor mais recente
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <MoneyText
                      cents={occurrence.priceAdjustment.newCents}
                      tone="default"
                      className="text-base font-semibold text-warning-strong"
                    />
                    <span className="text-[11px] font-medium text-warning-strong">
                      (+{occurrence.priceAdjustment.percentIncrease}%)
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {occurrence.priceAdjustment.isInflationary
                  ? "Aumento entre 10% e 30% em relação aos meses anteriores (típico de reajuste anual de contrato)."
                  : occurrence.priceAdjustment.isPlanChange
                    ? "Aumento expressivo acima de 50% em relação ao histórico (possível alteração de plano ou dependentes)."
                    : occurrence.priceAdjustment.isConsumptionVariation
                      ? "Oscilação no consumo em concessionária de serviço público essencial."
                      : "Variação de valor identificada no lançamento mais recente."}
              </p>
            </div>
          ) : null}

          <RecurrenceHistoryList
            expenses={expenses}
            monthsCount={occurrence.months.length}
            hasDuplicates={hasDuplicates}
            latestMonth={latestMonth}
            onEdit={handleEdit}
          />
        </div>
      </Modal>

      {editingExpense ? (
        <ExpenseDetailDialog
          open={Boolean(editingExpense)}
          onOpenChange={(next) => {
            if (!next) setEditingExpense(null);
          }}
          expense={editingExpense}
          initialEditing={true}
        />
      ) : null}
    </>
  );
}
