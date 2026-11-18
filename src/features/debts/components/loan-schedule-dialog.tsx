import { useMemo } from "react";
import { Badge, Button, Modal, ModalFooter, MoneyText } from "@/components/ui";
import {
  AMORTIZATION_SYSTEM_LABELS,
  calculateLoanSchedule,
  LOAN_TYPE_LABELS,
} from "@/domain/loans";
import { numberToCents } from "@/domain/money";
import { formatDateBR } from "@/lib/date";
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
      footer={
        <ModalFooter borderless>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </ModalFooter>
      }
    >
      <div className="flex flex-col gap-4 pt-1">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 rounded-xl border border-border/80 bg-surface-raised p-3 text-xs">
          <div className="flex flex-col">
            <span className="text-muted-foreground text-[11px]">Valor Financiado</span>
            <MoneyText
              cents={scheduleResult.principalCents}
              tone="default"
              className="text-sm font-bold"
            />
          </div>
          <div className="flex flex-col">
            <span className="text-muted-foreground text-[11px]">Total de Juros</span>
            <MoneyText
              cents={scheduleResult.totalInterestCents}
              tone="default"
              className="text-sm font-bold text-warning-strong"
            />
          </div>
          <div className="flex flex-col">
            <span className="text-muted-foreground text-[11px]">Custo Total Contrato</span>
            <MoneyText
              cents={scheduleResult.totalPaidCents}
              tone="default"
              className="text-sm font-bold"
            />
          </div>
        </div>

        <div className="overflow-x-auto no-scrollbar scroll-smooth rounded-xl border border-border/80 bg-surface shadow-xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-surface border-b border-border/80 text-[11px] font-semibold uppercase text-muted-foreground tracking-wider">
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
            <tbody className="divide-y divide-border/60 font-mono">
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
                    <td className="px-3 py-2 text-muted-foreground font-sans whitespace-nowrap">
                      {formatDateBR(item.dueDate)}
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-foreground">
                      <MoneyText cents={item.amountCents} tone="default" className="text-xs font-bold" />
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground hidden sm:table-cell">
                      <MoneyText
                        cents={item.principalCents}
                        tone="default"
                        className="text-xs text-muted-foreground font-normal"
                      />
                    </td>
                    <td className="px-3 py-2 text-right text-warning-strong hidden sm:table-cell">
                      <MoneyText
                        cents={item.interestCents}
                        tone="default"
                        className="text-xs text-warning-strong font-medium"
                      />
                    </td>
                    <td className="px-3 py-2 text-right text-foreground">
                      <MoneyText
                        cents={item.remainingBalanceCents}
                        tone="default"
                        className="text-xs font-medium"
                      />
                    </td>
                    <td className="px-3 py-2 text-center font-sans">
                      {isPaid ? (
                        <Badge variant="positive" size="xs">
                          Quitada
                        </Badge>
                      ) : (
                        <Badge variant="muted" size="xs">
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
