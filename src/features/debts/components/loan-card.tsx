import { useState } from "react";
import { CalendarDays, Edit2, Trash2 } from "lucide-react";
import { Badge, Button, Checkbox, ConfirmDialog, MoneyText, Progress } from "@/components/ui";
import { UpgradeDialog } from "@/components/modules";
import { AMORTIZATION_SYSTEM_LABELS, LOAN_TYPE_LABELS, calculateLoanProgress } from "@/domain/loans";
import { buildCheckoutUrl } from "@/domain/subscription/plans";
import { useDeleteLoan, useUserSubscription } from "@/state";
import type { Debt, Loan } from "@/types";
import { EarlyAmortizationDialog } from "./early-amortization-dialog";
import { LoanEditDialog } from "./loan-edit-dialog";
import { LoanScheduleDialog } from "./loan-schedule-dialog";

export interface LoanCardProps {
  loan: Loan;
  debts: Debt[];
}

export function LoanCard({ loan, debts }: LoanCardProps) {
  const [amortizeOpen, setAmortizeOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteDebts, setDeleteDebts] = useState(true);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeContext, setUpgradeContext] = useState<string | undefined>();

  const deleteLoan = useDeleteLoan();
  const subscription = useUserSubscription();
  const isReadOnlyMode = Boolean(subscription?.isReadOnly || subscription?.canWrite === false);

  const contractDebts = debts.filter((d) => d.installment_group_id === loan.installment_group_id);
  const { paidCount, totalCount, progressPercent, pendingAmountCents } = calculateLoanProgress(
    contractDebts,
    loan.total_installments,
  );

  const guardOrRun = (action: () => void, context: string) => {
    if (isReadOnlyMode) {
      setUpgradeContext(context);
      setUpgradeOpen(true);
      return;
    }
    action();
  };

  const handleConfirmDelete = async () => {
    await deleteLoan.mutateAsync({ id: loan.id, deleteDebts });
    setDeleteConfirmOpen(false);
  };

  return (
    <>
      <div className="flex flex-col justify-between gap-3.5 rounded-xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs">
        <div className="flex items-start justify-between gap-2 min-w-0">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 pb-0.5">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {LOAN_TYPE_LABELS[loan.loan_type] ?? "Contrato"}
              </span>
              <span className="text-muted-foreground/40" aria-hidden="true">/</span>
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {AMORTIZATION_SYSTEM_LABELS[loan.amortization_system]} ({loan.interest_rate_monthly}% a.m.)
              </span>
            </div>
            <h4 className="line-clamp-2 break-words text-base font-semibold tracking-tight text-foreground">
              {loan.name}
            </h4>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              sensoryIntent="selection"
              onClick={() => guardOrRun(() => setEditOpen(true), "Editar Contrato de Crédito")}
              className="size-9 sm:size-8 text-muted-foreground hover:text-foreground max-sm:after:absolute max-sm:after:-inset-1.5"
              title="Editar contrato"
              aria-label="Editar contrato"
            >
              <Edit2 className="size-3.5" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              sensoryIntent="selection"
              onClick={() =>
                guardOrRun(() => setDeleteConfirmOpen(true), "Excluir Contrato de Crédito")
              }
              className="size-9 sm:size-8 text-muted-foreground hover:text-critical-strong max-sm:after:absolute max-sm:after:-inset-1.5"
              title="Excluir contrato"
              aria-label="Excluir contrato"
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 min-w-0">
          <div className="flex justify-between text-xs text-muted-foreground gap-2">
            <span>Progresso de quitação</span>
            <span className="font-mono font-medium text-foreground tabular-nums whitespace-nowrap">
              {paidCount} de {totalCount} parcelas ({progressPercent}%)
            </span>
          </div>
          <Progress
            value={progressPercent}
            tone="positive"
            size="md"
            aria-label={`Progresso de quitação: ${progressPercent}%`}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-border/50 pt-3 min-w-0">
          <div className="min-w-0">
            <span className="text-[11px] text-muted-foreground uppercase tracking-wider block">
              Saldo a pagar
            </span>
            <MoneyText cents={pendingAmountCents} variant="value" className="text-base font-bold" />
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setScheduleOpen(true)}
              className="gap-1.5 text-xs min-h-11 sm:min-h-0"
            >
              <CalendarDays className="size-3.5" aria-hidden="true" />
              <span>Cronograma</span>
            </Button>
            {pendingAmountCents > 0 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  guardOrRun(
                    () => setAmortizeOpen(true),
                    "Amortizar Contrato Antecipadamente",
                  )
                }
                className="text-xs min-h-11 sm:min-h-0"
              >
                Amortizar
              </Button>
            ) : (
              <Badge variant="positive" size="sm">
                Quitado
              </Badge>
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
        debts={debts}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title={`Excluir contrato "${loan.name}"?`}
        description={
          deleteDebts
            ? `O contrato e todas as suas ${contractDebts.length} parcelas vinculadas serão excluídos da lista de contas a pagar.`
            : "As parcelas pendentes serão mantidas como avulsas na lista de contas a pagar."
        }
        confirmLabel="Excluir contrato"
        variant="destructive"
        confirmPending={deleteLoan.isPending}
        onConfirm={handleConfirmDelete}
      >
        {contractDebts.length > 0 ? (
          <div className="mt-2 flex items-center gap-2 rounded-xl bg-surface-raised p-3">
            <Checkbox
              id={`delete-debts-${loan.id}`}
              checked={deleteDebts}
              onCheckedChange={setDeleteDebts}
              label={`Excluir também as ${contractDebts.length} parcelas vinculadas`}
            />
          </div>
        ) : null}
      </ConfirmDialog>

      <UpgradeDialog
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        context={upgradeContext}
        onProceedToCheckout={(plan) => {
          setUpgradeOpen(false);
          if (typeof window !== "undefined") {
            window.location.assign(buildCheckoutUrl({ plan }));
          }
        }}
      />
    </>
  );
}
