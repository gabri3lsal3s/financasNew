import { useId, useMemo, useState } from "react";
import { Alert, Button, FormField, Modal, ModalFooter, MoneyInput, RadioGroup, Select, Skeleton } from "@/components/ui";
import { todayLocalIso } from "@/lib/date";
import { getErrorMessage } from "@/services/errors";
import { sensory } from "@/services/sensory";
import {
  useCategories,
  useExpense,
  useMyPublicShares,
  usePayDebt,
  useReceiveDebt,
  useSettleIntegratedReceivable,
  useSyncSplitFromDebtSettle,
} from "@/state";
import type { Debt, SplitSharePayload } from "@/types";
import { DebtPenaltiesFields } from "./debt-penalties-fields";

export interface SettleDialogProps {
  debt: Debt;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function SettleDialogContent({ debt, open, onOpenChange }: SettleDialogProps) {
  const formId = useId();
  const isReceivable = debt.type === "receivable";
  const integrated = isReceivable && debt.expense_id !== null;

  const [withTransaction, setWithTransaction] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [resultCents, setResultCents] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [userEdited, setUserEdited] = useState(false);

  const [showPenalties, setShowPenalties] = useState(() => debt.due_date < todayLocalIso());
  const [fineCents, setFineCents] = useState(0);
  const [interestCents, setInterestCents] = useState(0);
  const [discountCents, setDiscountCents] = useState(0);

  const originalCents = Math.round(debt.amount * 100);
  const effectivePayableCents = Math.max(0, originalCents + fineCents + interestCents - discountCents);

  const expenseCategories = useCategories(isReceivable ? "income" : "expense");
  const linkedExpense = useExpense(integrated ? debt.expense_id : null);
  const { data: splitShares } = useMyPublicShares("split", { enabled: isReceivable && open });

  const linkedSplitShare = useMemo(() => {
    if (!isReceivable || !splitShares) return null;
    return (
      splitShares.find((share) => {
        const p = (share.payload ?? {}) as Partial<SplitSharePayload>;
        return (
          share.debt_id === debt.id ||
          p.debt_id === debt.id ||
          Boolean(debt.expense_id && (share.expense_id === debt.expense_id || p.expense_id === debt.expense_id)) ||
          Boolean(
            debt.installment_group_id &&
              (share.installment_group_id === debt.installment_group_id ||
                p.installment_group_id === debt.installment_group_id),
          )
        );
      }) ?? null
    );
  }, [isReceivable, splitShares, debt.id, debt.expense_id, debt.installment_group_id]);

  const payDebt = usePayDebt();
  const receiveDebt = useReceiveDebt();
  const settleIntegrated = useSettleIntegratedReceivable();
  const syncSplitFromDebtSettle = useSyncSplitFromDebtSettle();
  const pending =
    payDebt.isPending ||
    receiveDebt.isPending ||
    settleIntegrated.isPending ||
    syncSplitFromDebtSettle.isPending;

  const suggestedResultCents =
    linkedExpense.data?.base_amount !== undefined
      ? Math.max(0, Math.round(linkedExpense.data.base_amount * 100) - originalCents)
      : null;

  const effectiveResultCents = userEdited ? resultCents : (suggestedResultCents ?? originalCents);

  const handleConfirm = async () => {
    setError(null);
    try {
      if (integrated) {
        await settleIntegrated.mutateAsync({ debtId: debt.id, result: effectiveResultCents / 100 });
      } else if (isReceivable) {
        await receiveDebt.mutateAsync({
          debtId: debt.id,
          createIncome: withTransaction,
          incomeCategoryId: withTransaction ? categoryId : null,
        });
      } else {
        await payDebt.mutateAsync({
          debtId: debt.id,
          createExpense: withTransaction,
          expenseCategoryId: withTransaction ? categoryId : null,
          fineAmount: fineCents / 100,
          interestAmount: interestCents / 100,
          discountAmount: discountCents / 100,
          totalPaid: effectivePayableCents / 100,
        });
      }

      if (isReceivable && linkedSplitShare) {
        const baseExpCents = linkedExpense.data
          ? Math.round((linkedExpense.data.base_amount ?? linkedExpense.data.value) * 100)
          : originalCents;
        const settledAmountCents = integrated
          ? Math.max(0, baseExpCents - effectiveResultCents)
          : originalCents;
        await syncSplitFromDebtSettle.mutateAsync({
          share: linkedSplitShare,
          debt,
          settledAmountCents,
        });
      }
      sensory.success();
      onOpenChange(false);
    } catch (err) {
      sensory.error();
      setError(getErrorMessage(err));
    }
  };

  const categories = expenseCategories.data ?? [];
  const hasMoneyInput = integrated || (!isReceivable && showPenalties);
  const title = integrated
    ? "Recebimento integrado"
    : isReceivable
      ? "Quitar dívida a receber"
      : "Quitar dívida a pagar";

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={debt.name}
      size="md"
      showCalculator={hasMoneyInput}
      footer={
        <ModalFooter borderless>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form={formId}
            sensoryIntent={false}
            disabled={pending || (withTransaction && categoryId === "")}
            aria-label="Confirmar quitação"
          >
            {pending ? "Quitando…" : (
              <>
                <span className="hidden sm:inline">Confirmar quitação</span>
                <span className="sm:hidden">Quitar</span>
              </>
            )}
          </Button>
        </ModalFooter>
      }
    >
      <form
        id={formId}
        onSubmit={(event) => {
          event.preventDefault();
          if (!pending && !(withTransaction && categoryId === "")) void handleConfirm();
        }}
        className="mt-2 flex flex-col gap-4"
      >
        {error ? <Alert variant="error">{error}</Alert> : null}

        {integrated ? (
          <>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Ao receber, o valor da despesa vinculada é{" "}
              <strong className="text-foreground">reduzido no relatório</strong> automaticamente. Ajuste o
              resultado final se quiser.
            </p>
            <FormField label="Despesa passa a contar como" htmlFor="settle-result">
              <MoneyInput
                id="settle-result"
                cents={effectiveResultCents}
                onCentsChange={(cents) => {
                  setUserEdited(true);
                  setResultCents(cents);
                }}
                aria-label="Resultado da despesa no relatório"
              />
            </FormField>
          </>
        ) : (
          <>
            {!isReceivable ? (
              <DebtPenaltiesFields
                showPenalties={showPenalties}
                onTogglePenalties={() => setShowPenalties((prev) => !prev)}
                fineCents={fineCents}
                onFineCentsChange={setFineCents}
                interestCents={interestCents}
                onInterestCentsChange={setInterestCents}
                discountCents={discountCents}
                onDiscountCentsChange={setDiscountCents}
                effectivePayableCents={effectivePayableCents}
              />
            ) : null}

            <RadioGroup
              value={withTransaction ? "with" : "only"}
              onValueChange={(value) => setWithTransaction(value === "with")}
              name="settle-mode"
              options={[
                { value: "only", label: isReceivable ? "Apenas receber" : "Apenas pagar" },
                { value: "with", label: isReceivable ? "Receber e criar renda" : "Pagar e cadastrar despesa" },
              ]}
            />

            {withTransaction ? (
              <FormField label="Categoria">
                {expenseCategories.isError ? (
                  <div className="flex flex-col gap-2">
                    <Alert variant="error">{getErrorMessage(expenseCategories.error)}</Alert>
                    <div>
                      <Button type="button" variant="outline" size="sm" onClick={() => void expenseCategories.refetch()}>
                        Tentar novamente
                      </Button>
                    </div>
                  </div>
                ) : expenseCategories.isLoading ? (
                  <Skeleton className="h-10 w-full" />
                ) : (
                  <Select
                    value={categoryId}
                    onValueChange={setCategoryId}
                    options={categories.map((c) => ({ value: c.id, label: c.name }))}
                    placeholder="Selecione a categoria"
                    ariaLabel={isReceivable ? "Categoria da renda" : "Categoria da despesa"}
                  />
                )}
              </FormField>
            ) : null}
          </>
        )}
      </form>
    </Modal>
  );
}

/** Quitação de dívida (§3.4) — RPC transacional (D1). */
export function SettleDialog({ debt, open, onOpenChange }: SettleDialogProps) {
  if (!open) return null;
  return <SettleDialogContent key={debt.id} debt={debt} open={open} onOpenChange={onOpenChange} />;
}
