import { useMemo } from "react";
import { Modal } from "@/components/ui/modal";
import { MoneyText } from "@/components/ui/money-text";
import { Badge } from "@/components/ui/badge";
import {
  AMORTIZATION_SYSTEM_LABELS,
  calculateLoanSchedule,
  LOAN_TYPE_LABELS,
} from "@/domain/loans";
import { numberToCents } from "@/domain/money";
import type { Debt, Loan } from "@/types";

export interface LoanScheduleDialogProps {
  loan: Loan | null;
  debts: Debt[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Diálogo que exibe o cronograma analítico completo de amortização (Price / SAC).
 * Discrimina Amortização do Principal, Juros da Parcela e Saldo Devedor.
 */
export function LoanScheduleDialog({
  loan,
  debts,
  open,
  onOpenChange,
}: LoanScheduleDialogProps) {
  const scheduleResult = useMemo(() => {
    if (!loan) return null;

    return calculateLoanSchedule({
      principalCents: numberToCents(loan.principal_amount),
      totalInstallments: loan.total_installments,
      monthlyRatePercent: loan.interest_rate_monthly,
      system: loan.amortization_system,
      startDate: loan.start_date,
    });
  }, [loan]);

  if (!loan || !scheduleResult) return null;

  const contractDebts = debts
    .filter((d) => d.installment_group_id === loan.installment_group_id)
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
  const paidMap = new Map<number, boolean>();
  contractDebts.forEach((d, idx) => {
    paidMap.set(idx + 1, d.paid_at !== null);
  });

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={`Cronograma: ${loan.name}`}
      description={`${LOAN_TYPE_LABELS[loan.loan_type]} · ${AMORTIZATION_SYSTEM_LABELS[loan.amortization_system]} (${loan.interest_rate_monthly}% a.m.)`}
      size="2xl"
    >
      <div className="flex flex-col gap-4 pt-1">
        {/* Sumário do Cronograma */}
        <div className="grid grid-cols-1 xs:grid-cols-3 gap-2.5 rounded-xl border border-border/80 bg-surface-hover/30 p-3 text-xs">
          <div className="flex flex-col">
            <span className="text-muted-foreground text-[11px]">Valor Financiado</span>
            <span className="font-mono font-bold text-foreground">
              <MoneyText cents={scheduleResult.principalCents} />
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-muted-foreground text-[11px]">Total de Juros</span>
            <span className="font-mono font-bold text-warning-strong">
              <MoneyText cents={scheduleResult.totalInterestCents} />
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-muted-foreground text-[11px]">Custo Total Contrato</span>
            <span className="font-mono font-bold text-foreground">
              <MoneyText cents={scheduleResult.totalPaidCents} />
            </span>
          </div>
        </div>

        {/* Tabela com Rolagem */}
        <div className="max-h-[380px] overflow-y-auto rounded-xl border border-border/80 bg-surface shadow-xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-10 bg-surface border-b border-border/80 text-[11px] font-semibold uppercase text-muted-foreground tracking-wider">
              <tr>
                <th className="px-3 py-2.5">#</th>
                <th className="px-3 py-2.5">Vencimento</th>
                <th className="px-3 py-2.5 text-right">Parcela</th>
                <th className="px-3 py-2.5 text-right hidden sm:table-cell">Amortização</th>
                <th className="px-3 py-2.5 text-right hidden sm:table-cell">Juros</th>
                <th className="px-3 py-2.5 text-right">Saldo Devedor</th>
                <th className="px-3 py-2.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 font-mono">
              {scheduleResult.schedule.map((item) => {
                const isPaid = paidMap.get(item.installmentNumber) ?? false;

                return (
                  <tr
                    key={item.installmentNumber}
                    className={`hover:bg-surface-hover/50 transition-colors ${isPaid ? "opacity-60 bg-surface-hover/20" : ""}`}
                  >
                    <td className="px-3 py-2 text-foreground font-semibold">
                      {item.installmentNumber}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground font-sans">
                      {item.dueDate}
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-foreground">
                      <MoneyText cents={item.amountCents} />
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground hidden sm:table-cell">
                      <MoneyText cents={item.principalCents} />
                    </td>
                    <td className="px-3 py-2 text-right text-warning-strong hidden sm:table-cell">
                      <MoneyText cents={item.interestCents} />
                    </td>
                    <td className="px-3 py-2 text-right text-foreground">
                      <MoneyText cents={item.remainingBalanceCents} />
                    </td>
                    <td className="px-3 py-2 text-center font-sans">
                      {isPaid ? (
                        <Badge variant="positive" className="text-[10px]">
                          Quitada
                        </Badge>
                      ) : (
                        <Badge variant="muted" className="text-[10px]">
                          A vencer
                        </Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}
