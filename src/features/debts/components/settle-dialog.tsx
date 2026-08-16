import { useState } from "react";
import { Alert, Button, Modal, MoneyInput, RadioGroup, Select, Skeleton } from "@/components/ui";
import { getErrorMessage } from "@/services/errors";
import { useCategories, useExpense, usePayDebt, useReceiveDebt, useSettleIntegratedReceivable } from "@/state";
import type { Debt } from "@/types";

export interface SettleDialogProps {
  debt: Debt;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SettleDialogContentProps {
  debt: Debt;
  onClose: () => void;
}

function SettleDialogContent({ debt, onClose }: SettleDialogContentProps) {
  const isReceivable = debt.type === "receivable";
  const integrated = isReceivable && debt.expense_id !== null;

  const [withTransaction, setWithTransaction] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [resultCents, setResultCents] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // O usuário editou o resultado? Antes disso, segue a sugestão automática.
  const [userEdited, setUserEdited] = useState(false);

  const expenseCategories = useCategories(isReceivable ? "income" : "expense");
  const linkedExpense = useExpense(integrated ? debt.expense_id : null);

  const payDebt = usePayDebt();
  const receiveDebt = useReceiveDebt();
  const settleIntegrated = useSettleIntegratedReceivable();
  const pending = payDebt.isPending || receiveDebt.isPending || settleIntegrated.isPending;

  // Recebimento integrado: default = valor original da despesa − dívida (nunca negativo).
  const suggestedResultCents =
    linkedExpense.data?.base_amount !== undefined
      ? Math.max(0, Math.round(linkedExpense.data.base_amount * 100) - Math.round(debt.amount * 100))
      : null;

  // Valor efetivo: sugestão automática até o usuário editar (mantém o diálogo
  // responsivo enquanto a despesa vinculada carrega).
  const effectiveResultCents = userEdited ? resultCents : (suggestedResultCents ?? Math.round(debt.amount * 100));

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
        });
      }
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const categories = expenseCategories.data ?? [];

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!pending && !(withTransaction && categoryId === "")) {
          void handleConfirm();
        }
      }}
      className="mt-4 flex flex-col gap-4"
    >
      {error ? <Alert variant="error">{error}</Alert> : null}

      {integrated ? (
        <>
          <p className="text-sm text-muted-foreground">
            Ao receber, o valor da despesa vinculada é <strong>reduzido no relatório</strong> automaticamente. Ajuste o
            resultado final se quiser.
          </p>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="settle-result" className="text-sm font-medium">
              Despesa passa a contar como
            </label>
            <MoneyInput
              autoFocus
              id="settle-result"
              cents={effectiveResultCents}
              onCentsChange={(cents) => {
                setUserEdited(true);
                setResultCents(cents);
              }}
              aria-label="Resultado da despesa no relatório"
            />
          </div>
        </>
      ) : (
        <>
          <RadioGroup
            value={withTransaction ? "with" : "only"}
            onValueChange={(value) => setWithTransaction(value === "with")}
            name="settle-mode"
            options={[
              {
                value: "only",
                label: isReceivable ? "Apenas receber" : "Apenas pagar",
              },
              {
                value: "with",
                label: isReceivable ? "Receber e criar renda" : "Pagar e cadastrar despesa",
              },
            ]}
          />
          {withTransaction ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Categoria</span>
              {expenseCategories.isError ? (
                <div className="flex flex-col gap-2">
                  <Alert variant="error">{getErrorMessage(expenseCategories.error)}</Alert>
                  <div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void expenseCategories.refetch()}
                    >
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
                  options={categories.map((category) => ({ value: category.id, label: category.name }))}
                  placeholder="Selecione a categoria"
                  ariaLabel={isReceivable ? "Categoria da renda" : "Categoria da despesa"}
                />
              )}
            </div>
          ) : null}
        </>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={pending || (withTransaction && categoryId === "")}
        >
          {pending ? "Quitando…" : "Confirmar quitação"}
        </Button>
      </div>
    </form>
  );
}

/** Quitação de dívida (§3.4) — RPC transacional (D1). */
export function SettleDialog({ debt, open, onOpenChange }: SettleDialogProps) {
  const isReceivable = debt.type === "receivable";
  const integrated = isReceivable && debt.expense_id !== null;

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
    >
      {open ? (
        <SettleDialogContent
          key={debt.id}
          debt={debt}
          onClose={() => onOpenChange(false)}
        />
      ) : null}
    </Modal>
  );
}
