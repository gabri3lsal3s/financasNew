import { useState } from "react";
import { CalendarDays, Edit2, Trash2 } from "lucide-react";
import { Button, ConfirmDialog } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { AMORTIZATION_SYSTEM_LABELS, LOAN_TYPE_LABELS } from "@/domain/loans";
import { numberToCents } from "@/domain/money";
import { useDeleteLoan } from "@/state";
import { EarlyAmortizationDialog } from "./early-amortization-dialog";
import { LoanEditDialog } from "./loan-edit-dialog";
import { LoanScheduleDialog } from "./loan-schedule-dialog";
import type { Debt, Loan } from "@/types";

export interface LoanCardProps {
  loan: Loan;
  debts: Debt[];
}

export function LoanCard({ loan, debts }: LoanCardProps) {
  const [amortizeOpen, setAmortizeOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const deleteLoan = useDeleteLoan();

  const contractDebts = debts.filter((d) => d.installment_group_id === loan.installment_group_id);
  const paidCount = contractDebts.filter((d) => d.paid_at !== null).length;
  const totalCount = contractDebts.length || loan.total_installments;
  const progressPercent = totalCount > 0 ? Math.round((paidCount / totalCount) * 100) : 0;

  const pendingAmount = contractDebts
    .filter((d) => d.paid_at === null)
    .reduce((acc, d) => acc + d.amount, 0);

  const handleConfirmDelete = async () => {
    await deleteLoan.mutateAsync(loan.id);
    setDeleteConfirmOpen(false);
  };

  return (
    <>
      <div className="flex flex-col justify-between gap-3.5 rounded-2xl border border-border/80 bg-surface/90 p-5 shadow-xs transition-all hover:border-border">
        <div className="flex items-start justify-between gap-2 min-w-0">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 pb-0.5">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {LOAN_TYPE_LABELS[loan.loan_type] ?? "Contrato"}
              </span>
              <span className="text-muted-foreground/60">•</span>
              <span className="text-[11px] text-muted-foreground">
                {AMORTIZATION_SYSTEM_LABELS[loan.amortization_system]} ({loan.interest_rate_monthly}% a.m.)
              </span>
            </div>
            <h4 className="truncate text-base font-semibold tracking-tight text-foreground">{loan.name}</h4>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setEditOpen(true)}
              className="size-8 p-0 text-muted-foreground hover:text-foreground"
              title="Editar contrato"
              aria-label="Editar contrato"
            >
              <Edit2 className="size-3.5" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setDeleteConfirmOpen(true)}
              className="size-8 p-0 text-muted-foreground hover:text-critical"
              title="Excluir contrato"
              aria-label="Excluir contrato"
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 min-w-0">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progresso de quitação</span>
            <span>
              {paidCount} de {totalCount} parcelas ({progressPercent}%)
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-hover/80 border border-border/40">
            <div
              className="h-full bg-primary transition-all duration-300 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-3 min-w-0">
          <div className="min-w-0">
            <span className="text-[11px] text-muted-foreground uppercase tracking-wider">Saldo a pagar</span>
            <div className="text-base font-bold text-foreground">
              <MoneyText cents={numberToCents(pendingAmount)} variant="value" />
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setScheduleOpen(true)}
              className="gap-1 text-xs"
            >
              <CalendarDays className="size-3.5" aria-hidden="true" />
              <span>Cronograma</span>
            </Button>
            {pendingAmount > 0 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAmortizeOpen(true)}
                className="text-xs"
              >
                Amortizar
              </Button>
            ) : (
              <span className="text-xs font-semibold text-positive-strong">Quitado</span>
            )}
          </div>
        </div>
      </div>

      <EarlyAmortizationDialog
        loan={loan}
        debts={debts}
        open={amortizeOpen}
        onOpenChange={setAmortizeOpen}
      />

      <LoanScheduleDialog
        loan={loan}
        debts={debts}
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
      />

      <LoanEditDialog
        loan={loan}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title={`Excluir contrato "${loan.name}"?`}
        description="As parcelas pendentes serão mantidas como avulsas na lista de contas a pagar."
        confirmLabel="Excluir contrato"
        variant="destructive"
        confirmPending={deleteLoan.isPending}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}

