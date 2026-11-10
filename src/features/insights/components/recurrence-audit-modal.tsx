import { useState } from "react";
import {
  AlertTriangle,
  Ban,
  Calendar,
  CalendarPlus,
  Check,
  Clock,
  CreditCard,
  Pencil,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { Badge, Button, Modal } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { CategoryIcon } from "@/components/modules/category-icon";
import { ExpenseDetailDialog } from "@/features/transactions/components/expense-detail-dialog";
import { formatDateBR } from "@/lib/date";
import { PAYMENT_METHOD_LABELS, RECURRENCE_LEVEL_LABELS } from "@/lib/labels";
import { RECURRENCE_CADENCE_LABELS, SERVICE_SEGMENT_LABELS } from "@/domain/insights";
import type { ExpenseLike, RecurrenceOccurrence } from "@/domain/insights/recurrences";
import type { FeedbackDecision } from "@/domain/insights/feedback";
import type { Expense, PaymentMethod } from "@/types";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";

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
  if (item.rawExpense) {
    return item.rawExpense;
  }
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

  const isMultiMonth = Boolean(occurrence.intervalMonths && occurrence.intervalMonths > 1);
  const cadenceLabel = occurrence.cadence ? RECURRENCE_CADENCE_LABELS[occurrence.cadence] : undefined;

  const handleApplyDecision = (decision: FeedbackDecision | null, successMsg: string) => {
    triggerSensory("action");
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
    if (onEditExpense) {
      onEditExpense(expense);
    }
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
      >
        <div className="flex flex-col gap-4">
          {/* Header de Badges de Classificação */}
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="default" size="sm">
                {RECURRENCE_LEVEL_LABELS[occurrence.level]}
              </Badge>

              {cadenceLabel && occurrence.cadence !== "monthly" ? (
                <Badge variant="default" size="sm" className="font-semibold">
                  {cadenceLabel}
                </Badge>
              ) : null}

              {occurrence.segment && occurrence.segment !== "other" ? (
                <Badge variant="default" size="sm">
                  {SERVICE_SEGMENT_LABELS[occurrence.segment]}
                </Badge>
              ) : null}

              {isEssential || occurrence.tier === "essential" ? (
                <Badge variant="default" size="sm">
                  Essencial
                </Badge>
              ) : occurrence.tier === "can_cut" ? (
                <Badge variant="positive" size="sm">
                  Pode cortar
                </Badge>
              ) : occurrence.tier === "discretionary" ? (
                <Badge variant="default" size="sm">
                  Discricionário
                </Badge>
              ) : null}

              {occurrence.lifecycle === "lapsed" ? (
                <Badge variant="muted" size="sm">
                  Interrompida
                </Badge>
              ) : occurrence.missingThisMonth ? (
                <Badge variant="warning" size="sm">
                  Pendente no ciclo
                </Badge>
              ) : occurrence.daysUntilNextDue !== undefined ? (
                occurrence.daysUntilNextDue === 0 ? (
                  <Badge variant="warning" size="sm">
                    Vence hoje
                  </Badge>
                ) : occurrence.daysUntilNextDue > 0 && occurrence.daysUntilNextDue <= 7 ? (
                  <Badge variant="warning" size="sm">
                    Em {occurrence.daysUntilNextDue}d
                  </Badge>
                ) : occurrence.typicalDayOfMonth ? (
                  <Badge variant="muted" size="sm">
                    Dia ~{occurrence.typicalDayOfMonth}
                  </Badge>
                ) : null
              ) : null}
            </div>
          </div>

          {/* Régua de Classificação e Memória do Usuário (Plano 13) */}
          <div className="flex flex-col gap-2 rounded-xl border border-border/80 bg-surface-muted/30 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">
                Classificação e Memória do Assistente
              </span>
              <span className="text-[11px] text-muted-foreground">
                Suas decisões calibram projeções e relatórios
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Button
                type="button"
                variant={isEssential || currentFeedbackDecision === "essential" ? "default" : "outline"}
                size="xs"
                onClick={() =>
                  handleApplyDecision(
                    isEssential || currentFeedbackDecision === "essential" ? null : "essential",
                    isEssential || currentFeedbackDecision === "essential"
                      ? "Classificação de essencial removida."
                      : "Gasto fixado como essencial (sem sugestões de corte).",
                  )
                }
                className="gap-1.5 h-8 text-xs cursor-pointer justify-start"
                title="Mantém na lista de custos fixos essenciais e silencia sugestões de corte"
              >
                {isEssential || currentFeedbackDecision === "essential" ? (
                  <Check className="size-3.5 shrink-0" aria-hidden="true" />
                ) : (
                  <ShieldCheck className="size-3.5 shrink-0" aria-hidden="true" />
                )}
                <span className="truncate">
                  {isEssential || currentFeedbackDecision === "essential" ? "É Essencial" : "Essencial"}
                </span>
              </Button>

              <Button
                type="button"
                variant={currentFeedbackDecision === "already_cancelled" ? "default" : "outline"}
                size="xs"
                onClick={() =>
                  handleApplyDecision(
                    currentFeedbackDecision === "already_cancelled" ? null : "already_cancelled",
                    currentFeedbackDecision === "already_cancelled"
                      ? "Item desmarcado de cancelado."
                      : "Marcado como cancelado (celebra economia anual e remove dos custos ativos).",
                  )
                }
                className="gap-1.5 h-8 text-xs cursor-pointer justify-start"
                title="Celebra a economia anual e remove dos custos fixos mensais"
              >
                {currentFeedbackDecision === "already_cancelled" ? (
                  <Check className="size-3.5 shrink-0" aria-hidden="true" />
                ) : (
                  <Sparkles className="size-3.5 shrink-0" aria-hidden="true" />
                )}
                <span className="truncate">Já Cancelei</span>
              </Button>

              <Button
                type="button"
                variant={currentFeedbackDecision === "one_off" ? "default" : "outline"}
                size="xs"
                onClick={() =>
                  handleApplyDecision(
                    currentFeedbackDecision === "one_off" ? null : "one_off",
                    currentFeedbackDecision === "one_off"
                      ? "Marcação de pontual removida."
                      : "Marcado como gasto pontual (não tratado como compromisso fixo).",
                  )
                }
                className="gap-1.5 h-8 text-xs cursor-pointer justify-start"
                title="Silencia o gasto como despesa pontual sem penalizar o classificador"
              >
                {currentFeedbackDecision === "one_off" ? (
                  <Check className="size-3.5 shrink-0" aria-hidden="true" />
                ) : (
                  <Clock className="size-3.5 shrink-0" aria-hidden="true" />
                )}
                <span className="truncate">
                  {currentFeedbackDecision === "one_off" ? "É Pontual" : "Gasto Pontual"}
                </span>
              </Button>

              <Button
                type="button"
                variant={currentFeedbackDecision === "not_subscription" ? "default" : "outline"}
                size="xs"
                onClick={() =>
                  handleApplyDecision(
                    currentFeedbackDecision === "not_subscription" ? null : "not_subscription",
                    currentFeedbackDecision === "not_subscription"
                      ? "Marcação removida."
                      : "Classificado como despesa comum (não é assinatura contínua).",
                  )
                }
                className="gap-1.5 h-8 text-xs cursor-pointer justify-start"
                title="Informa que este estabelecimento não é uma assinatura contínua"
              >
                {currentFeedbackDecision === "not_subscription" ? (
                  <Check className="size-3.5 shrink-0" aria-hidden="true" />
                ) : (
                  <Ban className="size-3.5 shrink-0" aria-hidden="true" />
                )}
                <span className="truncate sm:hidden">Não Assinar</span>
                <span className="truncate hidden sm:inline">Não é Assinatura</span>
              </Button>
            </div>
          </div>

          {/* Grid de Métricas Resumo */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <div className="flex flex-col gap-0.5 rounded-xl border border-border/80 bg-surface p-3 shadow-xs">
              <span className="text-[11px] font-medium text-muted-foreground truncate">
                {isMultiMonth ? "Valor por ciclo" : "Valor médio"}
              </span>
              <div className="flex items-baseline gap-1">
                <MoneyText
                  cents={occurrence.averageCents}
                  tone="default"
                  className="text-base font-semibold"
                />
                <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                  {isMultiMonth ? `/${occurrence.intervalMonths}m` : "/mês"}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-0.5 rounded-xl border border-border/80 bg-surface p-3 shadow-xs">
              <span className="text-[11px] font-medium text-muted-foreground truncate">
                {isMultiMonth ? "Amortizado/mês" : "Custo anual"}
              </span>
              <div className="flex items-baseline gap-1">
                <MoneyText
                  cents={
                    isMultiMonth
                      ? occurrence.monthlyAmortizedCents ?? Math.round(occurrence.averageCents / (occurrence.intervalMonths || 1))
                      : occurrence.averageCents * 12
                  }
                  tone="default"
                  className="text-base font-semibold"
                />
                <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                  {isMultiMonth ? "/mês" : "/ano"}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-0.5 rounded-xl border border-border/80 bg-surface p-3 shadow-xs">
              <span className="text-[11px] font-medium text-muted-foreground truncate">
                {isMultiMonth ? "Custo anual" : "Dia típico"}
              </span>
              {isMultiMonth ? (
                <div className="flex items-baseline gap-1">
                  <MoneyText
                    cents={
                      (occurrence.monthlyAmortizedCents ?? Math.round(occurrence.averageCents / (occurrence.intervalMonths || 1))) * 12
                    }
                    tone="default"
                    className="text-base font-semibold"
                  />
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">/ano</span>
                </div>
              ) : (
                <span className="text-base font-semibold text-foreground tabular-nums">
                  {occurrence.typicalDayOfMonth ? `Dia ~${occurrence.typicalDayOfMonth}` : "Variável"}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-0.5 rounded-xl border border-border/80 bg-surface p-3 shadow-xs">
              <span className="text-[11px] font-medium text-muted-foreground">Confiança</span>
              <span className="text-base font-semibold text-foreground tabular-nums">
                {Math.round(occurrence.confidence * 100)}%
              </span>
            </div>
          </div>

          {/* Ação Proativa: Fixar como Recorrência Formal */}
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

          {/* Destaque Contextual: Alerta de Cobrança Duplicada */}
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

          {/* Destaque Contextual: Comparativo Lado a Lado de Reajuste Detectado */}
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

              <div className="grid grid-cols-2 gap-3 rounded-lg border border-border/60 bg-surface-hover/50 p-3">
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

          {/* Lista de Histórico de Lançamentos (Drill-Down) */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-0.5">
              <h4 className="text-xs font-semibold text-foreground">
                Histórico de lançamentos ({expenses.length})
              </h4>
              <span className="text-[11px] text-muted-foreground">
                Últimos {occurrence.months.length} meses analisados
              </span>
            </div>

            {expenses.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                Nenhum lançamento registrado para esta ocorrência.
              </p>
            ) : (
              <ul
                className="flex flex-col gap-2"
                role="list"
                aria-label="Histórico de transações da recorrência"
              >
                {expenses.map((expense) => {
                  const isDuplicateInMonth =
                    hasDuplicates && expense.month === latestMonth;

                  const paymentMethodLabel = expense.paymentMethod
                    ? (PAYMENT_METHOD_LABELS[expense.paymentMethod as PaymentMethod] ?? expense.paymentMethod)
                    : null;

                  return (
                    <li
                      key={expense.id}
                      className={`flex items-center justify-between gap-3 rounded-xl border p-3 transition-colors ${
                        isDuplicateInMonth
                          ? "border-warning/50 bg-warning/5"
                          : "border-border/80 bg-surface"
                      }`}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-hover text-muted-foreground">
                          {expense.categoryIcon ? (
                            <CategoryIcon icon={expense.categoryIcon} className="size-4" />
                          ) : (
                            <Calendar className="size-4" aria-hidden="true" />
                          )}
                        </div>

                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-xs font-semibold text-foreground tabular-nums">
                              {formatDateBR(expense.date ?? expense.month)}
                            </span>
                            {isDuplicateInMonth ? (
                              <Badge variant="warning" size="xs">
                                Cobrança duplicada
                              </Badge>
                            ) : null}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                            {expense.categoryName ? (
                              <span className="truncate">{expense.categoryName}</span>
                            ) : null}

                            {expense.cardName ? (
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <CreditCard className="size-3" aria-hidden="true" />
                                {expense.cardName}
                              </span>
                            ) : paymentMethodLabel ? (
                              <span>{paymentMethodLabel}</span>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2.5">
                        <MoneyText
                          cents={expense.valueCents}
                          tone="default"
                          className="text-sm font-semibold text-foreground whitespace-nowrap"
                        />

                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => handleEdit(expense)}
                          aria-label={`Editar lançamento de ${formatDateBR(expense.date ?? expense.month)}`}
                          className="h-7 px-2 text-xs"
                        >
                          <Pencil className="size-3.5" aria-hidden="true" />
                          <span className="hidden sm:inline">Editar</span>
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </Modal>

      {/* Modal Integrado de Edição de Despesa */}
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
