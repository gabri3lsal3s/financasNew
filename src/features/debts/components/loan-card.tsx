import { useState } from "react";
import { Button } from "@/components/ui";
import { LOAN_TYPE_LABELS } from "@/domain/loans";
import { useDeleteLoan } from "@/state";
import { EarlyAmortizationDialog } from "./early-amortization-dialog";
import type { Debt, Loan } from "@/types";

export interface LoanCardProps {
  loan: Loan;
  debts: Debt[];
}

export function LoanCard({ loan, debts }: LoanCardProps) {
  const [amortizeOpen, setAmortizeOpen] = useState(false);
  const deleteLoan = useDeleteLoan();

  const contractDebts = debts.filter((d) => d.installment_group_id === loan.installment_group_id);
  const paidCount = contractDebts.filter((d) => d.paid_at !== null).length;
  const totalCount = contractDebts.length || loan.total_installments;
  const progressPercent = totalCount > 0 ? Math.round((paidCount / totalCount) * 100) : 0;

  const pendingAmount = contractDebts
    .filter((d) => d.paid_at === null)
    .reduce((acc, d) => acc + d.amount, 0);

  const handleDelete = async () => {
    if (window.confirm(`Deseja excluir o contrato "${loan.name}"? As parcelas pendentes serão mantidas como avulsas.`)) {
      await deleteLoan.mutateAsync(loan.id);
    }
  };

  return (
    <>
      <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3 shadow-sm hover:border-border/80 transition-colors">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-xs font-medium text-muted-foreground">
              {LOAN_TYPE_LABELS[loan.loan_type] ?? "Contrato de crédito"}
            </span>
            <h4 className="text-base font-semibold text-foreground tracking-tight">{loan.name}</h4>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            className="text-xs text-muted-foreground hover:text-destructive"
          >
            Excluir
          </Button>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progresso de quitação</span>
            <span>
              {paidCount} de {totalCount} parcelas ({progressPercent}%)
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all duration-300 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border/50">
          <div>
            <span className="text-xs text-muted-foreground">Saldo a pagar</span>
            <div className="text-base font-bold text-foreground">
              {pendingAmount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </div>
          </div>
          {pendingAmount > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAmortizeOpen(true)}
              className="text-xs"
            >
              Amortizar com desconto
            </Button>
          ) : (
            <span className="text-xs font-semibold text-success">Quitado</span>
          )}
        </div>
      </div>

      <EarlyAmortizationDialog
        loan={loan}
        debts={debts}
        open={amortizeOpen}
        onOpenChange={setAmortizeOpen}
      />
    </>
  );
}
