import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { MoneyText } from "@/components/ui/money-text";
import { PAYMENT_METHOD_LABELS, RECURRENCE_FREQUENCY_LABELS } from "@/lib/labels";
import { buildRecurrenceOccurrences } from "@/domain/recurrences";
import {
  buildExpenseInstallments,
  buildIncomeInstallments,
  effectiveReportWeight,
  recurrenceRuleFromLaunchState,
  reportWeightLabel,
} from "./wizard-state";
import type { LaunchState } from "./wizard-state";

export interface StepReviewProps {
  state: LaunchState;
  categoryName?: string;
  closingDay?: number | null;
  isFamilyModeEnabled?: boolean;
  tripName?: string;
  tripMemberName?: string;
}

/** Passo 4 — revisão antes de confirmar (parcelas calculadas no cliente, D12). */
export function StepReview({ state, categoryName, closingDay, isFamilyModeEnabled, tripName, tripMemberName }: StepReviewProps) {
  const isExpense = state.type === "expense";
  const installments =
    !state.recurring && state.installments > 1
      ? isExpense
        ? buildExpenseInstallments({
            totalCents: state.valueCents,
            count: state.installments,
            startDate: state.date,
            closingDay: state.paymentMethod === "credit_card" ? closingDay : null,
          })
        : buildIncomeInstallments({
            totalCents: state.valueCents,
            count: state.installments,
            startDate: state.date,
          })
      : [];
  // Fase 32 — prévia das ocorrências da recorrência (motor puro, D12).
  const recurrenceRule = recurrenceRuleFromLaunchState(state);
  const recurrenceOccurrences = recurrenceRule ? buildRecurrenceOccurrences(recurrenceRule) : [];
  const recurrencePreview = recurrenceOccurrences.slice(0, 12);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <Row label="Tipo" value={isExpense ? "Despesa" : "Renda"} />
        <Row label="Valor" value={<MoneyText cents={state.valueCents} tone="default" />} />
        <Row label="Sua Participação / Rateio" value={reportWeightLabel(effectiveReportWeight(state), state.valueCents)} />
        <Row label="Categoria" value={categoryName ?? "—"} />
        {tripName && (
          <Row
            label="Viagem Vinculada"
            value={
              <div className="flex flex-col items-end gap-0.5">
                <Badge variant="muted" size="xs">
                  {tripName}
                </Badge>
                {tripMemberName ? (
                  <span className="text-xs text-muted-foreground">
                    Pagador: <strong className="text-foreground font-medium">{tripMemberName} (Você)</strong>
                  </span>
                ) : null}
              </div>
            }
          />
        )}
        {isFamilyModeEnabled && (
          <Row
            label="Orçamento Familiar"
            value={
              state.isFamily ? (
                <Badge variant="muted" size="xs">
                  Painel Familiar
                </Badge>
              ) : (
                "Individual"
              )
            }
          />
        )}
        <Row label="Data" value={state.date} />
        {state.recurring ? (
          <Row
            label="Recorrência"
            value={(() => {
              const rule = recurrenceRule;
              if (!rule) return "—";
              const frequency = RECURRENCE_FREQUENCY_LABELS[rule.frequency];
              const end =
                rule.endDate != null
                  ? `até ${rule.endDate}`
                  : `${rule.occurrencesTotal ?? 0} ocorrências`;
              return `${frequency} · ${end}`;
            })()}
          />
        ) : null}
        {isExpense ? (
          <>
            <Row label="Pagamento" value={PAYMENT_METHOD_LABELS[state.paymentMethod] ?? state.paymentMethod} />
            {state.installments > 1 ? (
              <Row label="Parcelas" value={`${state.installments}×`} />
            ) : null}
            {state.splitEnabled ? (
              <Row
                label="Rachar Despesa"
                value={
                  <Badge variant="muted" size="xs">
                    {state.splitPeopleCount} pessoas · Gerar Pix e cobrança
                  </Badge>
                }
              />
            ) : null}
            {state.debtEnabled ? (
              <Row
                label="Cobrança vinculada"
                value={
                  <span className="flex items-center gap-1.5">
                    <MoneyText cents={state.debtAmountCents} tone="default" />
                    <span className="text-xs text-muted-foreground">
                      ({state.debtType === "receivable" ? "A receber" : "A pagar"})
                    </span>
                  </span>
                }
              />
            ) : null}
          </>
        ) : null}
      </div>

      {installments.length > 1 ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Parcelas</p>
          <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {installments.map((installment, index) => (
              <li key={installment.date} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="text-muted-foreground">
                  {index + 1}/{installments.length} · {installment.date}
                  {installment.billCompetence ? ` · fatura ${installment.billCompetence}` : ""}
                </span>
                <MoneyText cents={Math.round(installment.value * 100)} tone="default" />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {recurrencePreview.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Ocorrências da recorrência</p>
          <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {recurrencePreview.map((occurrence) => (
              <li key={occurrence.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="text-muted-foreground">
                  {occurrence.occurrenceNumber}/{recurrenceOccurrences.length} · {occurrence.date}
                </span>
                <MoneyText cents={occurrence.valueCents} tone="default" />
              </li>
            ))}
          </ul>
          {recurrenceOccurrences.length > recurrencePreview.length ? (
            <p className="text-xs text-muted-foreground">
              +{recurrenceOccurrences.length - recurrencePreview.length} ocorrências serão geradas ao longo do tempo.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
