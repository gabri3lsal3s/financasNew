import { useMemo, type ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { MoneyText } from "@/components/ui/money-text";
import { detectScopeConflict, splitMixedExpenseByPercent } from "@/domain/business";
import { formatDateBR, monthLabel } from "@/lib/date";
import { PAYMENT_METHOD_LABELS, RECURRENCE_FREQUENCY_LABELS } from "@/lib/labels";
import { buildRecurrenceOccurrences } from "@/domain/recurrences";
import type { CreditCardScope } from "@/types";
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
  cardScope?: CreditCardScope | null;
  isFamilyModeEnabled?: boolean;
  isBusinessModeEnabled?: boolean;
  tripName?: string;
  tripMemberName?: string;
}

/** Passo 4 — revisão antes de confirmar (parcelas calculadas no cliente, D12). */
export function StepReview({
  state,
  categoryName,
  closingDay,
  cardScope,
  isFamilyModeEnabled,
  isBusinessModeEnabled = false,
  tripName,
  tripMemberName,
}: StepReviewProps) {
  const scopeConflict = useMemo(() => {
    if (!isBusinessModeEnabled) return { hasConflict: false, conflictKind: "none" as const };
    return detectScopeConflict({
      transactionScope: state.scope ?? "personal",
      cardScope,
      description: state.description,
      categoryName,
    });
  }, [isBusinessModeEnabled, cardScope, state.scope, state.description, categoryName]);
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
  const recurrenceRule = recurrenceRuleFromLaunchState(state);
  const recurrenceOccurrences = recurrenceRule ? buildRecurrenceOccurrences(recurrenceRule) : [];
  const recurrencePreview = recurrenceOccurrences.slice(0, 12);

  const isSplitPFPJ = Boolean(isBusinessModeEnabled && isExpense && state.splitPFPJEnabled);
  const isBusiness = (state.scope ?? "personal") === "business";
  const splitPFPJResult = isSplitPFPJ
    ? splitMixedExpenseByPercent({
        totalCents: state.valueCents,
        businessPercent: state.splitPFPJBusinessPercent ?? 50,
      })
    : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-surface p-4 shadow-xs">
        <Row label="Tipo" value={isExpense ? "Despesa" : "Renda"} />
        <Row label="Valor" value={<MoneyText cents={state.valueCents} tone="default" />} />
        {!isBusiness && !isSplitPFPJ ? (
          <Row label="Sua Participação / Rateio" value={reportWeightLabel(effectiveReportWeight(state), state.valueCents)} />
        ) : null}
        {!isExpense && isBusiness && state.taxWithheldCents && state.taxWithheldCents > 0 ? (
          <>
            <Row
              label="Retenção na Fonte (IRRF/ISS)"
              value={<MoneyText cents={state.taxWithheldCents} tone="negative" />}
            />
            <Row
              label="Caixa Líquido a Receber"
              value={<MoneyText cents={state.valueCents - state.taxWithheldCents} tone="positive" />}
            />
          </>
        ) : null}
        <Row label="Categoria" value={categoryName ?? "—"} />
        {tripName ? (
          <Row
            label="Viagem Vinculada"
            value={
              <div className="flex flex-col items-end gap-0.5">
                <Badge variant="muted" size="xs">
                  {tripName}
                </Badge>
                {tripMemberName ? (
                  <span className="text-xs text-muted-foreground">
                    Pagador: <strong className="font-medium text-foreground">{tripMemberName} (Você)</strong>
                  </span>
                ) : null}
              </div>
            }
          />
        ) : null}
        {isBusinessModeEnabled ? (
          <Row
            label="Esfera"
            value={
              isSplitPFPJ ? (
                <Badge variant="warning" size="xs">
                  Uso Misto (Split PF/PJ)
                </Badge>
              ) : state.scope === "business" ? (
                <Badge variant="portfolio" size="xs">
                  Meu Negócio (PJ)
                </Badge>
              ) : (
                "Pessoal (PF)"
              )
            }
          />
        ) : null}
        {isSplitPFPJ && splitPFPJResult ? (
          <Row
            label="Divisão PF / PJ"
            value={
              <div className="flex flex-col items-end gap-0.5 text-xs">
                <span>
                  PF: <strong className="font-semibold text-foreground">R$ {(splitPFPJResult.personalCents / 100).toFixed(2).replace(".", ",")}</strong> ({100 - (state.splitPFPJBusinessPercent ?? 50)}%)
                </span>
                <span>
                  PJ: <strong className="font-semibold text-portfolio">R$ {(splitPFPJResult.businessCents / 100).toFixed(2).replace(".", ",")}</strong> ({state.splitPFPJBusinessPercent ?? 50}%)
                </span>
              </div>
            }
          />
        ) : null}
        {isBusinessModeEnabled && (state.scope === "business" || isSplitPFPJ) && isExpense && state.isTaxDeductible ? (
          <Row
            label="Dedutibilidade"
            value={
              <Badge variant="positive" size="xs">
                Dedutível para IR (fatia PJ)
              </Badge>
            }
          />
        ) : null}
        {isFamilyModeEnabled && (!isBusinessModeEnabled || (!isBusiness && !isSplitPFPJ)) ? (
          <Row
            label="Modo Família"
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
        ) : null}
        <Row label="Data" value={formatDateBR(state.date)} />
        {state.recurring ? (
          <Row
            label="Recorrência"
            value={(() => {
              const rule = recurrenceRule;
              if (!rule) return "—";
              const frequency = RECURRENCE_FREQUENCY_LABELS[rule.frequency];
              const end =
                rule.endDate != null
                  ? `até ${formatDateBR(rule.endDate)}`
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

      {scopeConflict.hasConflict && scopeConflict.warningMessage ? (
        <Alert variant="warning" className="text-xs">
          {scopeConflict.warningMessage}
        </Alert>
      ) : null}

      {installments.length > 1 ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Parcelas</p>
          <ul className="flex flex-col divide-y divide-border/80 overflow-hidden rounded-xl border border-border/80 bg-surface">
            {installments.map((installment, index) => (
              <li key={installment.date} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="text-muted-foreground">
                  {index + 1}/{installments.length} · {formatDateBR(installment.date)}
                  {installment.billCompetence ? ` · fatura ${monthLabel(installment.billCompetence)}` : ""}
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
          <ul className="flex flex-col divide-y divide-border/80 overflow-hidden rounded-xl border border-border/80 bg-surface">
            {recurrencePreview.map((occurrence) => (
              <li key={occurrence.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="text-muted-foreground">
                  {occurrence.occurrenceNumber}/{recurrenceOccurrences.length} · {formatDateBR(occurrence.date)}
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
