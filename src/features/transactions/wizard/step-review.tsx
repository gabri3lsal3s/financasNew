import { formatCentsAsBRL } from "@/services/masks/money";
import { PAYMENT_METHOD_LABELS } from "@/lib/labels";
import { buildExpenseInstallments, type LaunchState } from "./wizard-state";

export interface StepReviewProps {
  state: LaunchState;
  categoryName?: string;
  closingDay?: number | null;
}

/** Passo 4 — revisão antes de confirmar (parcelas calculadas no cliente, D12). */
export function StepReview({ state, categoryName, closingDay }: StepReviewProps) {
  const isExpense = state.type === "expense";
  const installments =
    isExpense && state.installments > 1
      ? buildExpenseInstallments({
          totalCents: state.valueCents,
          count: state.installments,
          startDate: state.date,
          closingDay: state.paymentMethod === "credit_card" ? closingDay : null,
        })
      : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <Row label="Tipo" value={isExpense ? "Despesa" : "Renda"} />
        <Row label="Valor" value={formatCentsAsBRL(state.valueCents)} mono />
        <Row label="Categoria" value={categoryName ?? "—"} />
        <Row label="Data" value={state.date} />
        {isExpense ? (
          <>
            <Row label="Pagamento" value={PAYMENT_METHOD_LABELS[state.paymentMethod] ?? state.paymentMethod} />
            {state.installments > 1 ? (
              <Row label="Parcelas" value={`${state.installments}×`} />
            ) : null}
            {state.debtEnabled ? (
              <Row label="Cobrança vinculada" value={formatCentsAsBRL(state.debtAmountCents)} mono />
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
                <span className="num font-medium">{formatCentsAsBRL(Math.round(installment.value * 100))}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? "num font-medium text-foreground" : "font-medium text-foreground"}>{value}</span>
    </div>
  );
}
