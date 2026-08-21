import { useState } from "react";
import { Edit2 } from "lucide-react";
import { Alert, Button, Modal, MoneyInput } from "@/components/ui";
import { getErrorMessage } from "@/services/errors";
import { useRemoveIncomeGoal, useSetIncomeGoal } from "@/state";
import type { Category } from "@/types";

export interface IncomeGoalDialogProps {
  category: Category;
  /** Mês da meta (YYYY-MM). */
  month: string;
  /** Meta atual em centavos. */
  currentExpectedCents: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Permite abrir o formulário cadastral da categoria (nome, cor, ícone). */
  onEditCategory?: (category: Category) => void;
}

interface IncomeGoalDialogContentProps {
  category: Category;
  month: string;
  currentExpectedCents: number;
  onClose: () => void;
  onEditCategory?: (category: Category) => void;
}

function IncomeGoalDialogContent({
  category,
  month,
  currentExpectedCents,
  onClose,
  onEditCategory,
}: IncomeGoalDialogContentProps) {
  const [cents, setCents] = useState(currentExpectedCents);
  const [error, setError] = useState<string | null>(null);

  const setGoal = useSetIncomeGoal();
  const removeGoal = useRemoveIncomeGoal();
  const pending = setGoal.isPending || removeGoal.isPending;

  const handleSave = async () => {
    setError(null);
    if (cents <= 0) return;
    try {
      await setGoal.mutateAsync({ categoryId: category.id, month, expected: cents / 100 });
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleRemove = async () => {
    setError(null);
    try {
      await removeGoal.mutateAsync({ categoryId: category.id, month });
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (cents > 0 && !pending) {
          void handleSave();
        }
      }}
      className="mt-4 flex flex-col gap-4"
    >
      {error ? <Alert variant="error">{error}</Alert> : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="goal-amount" className="text-sm font-medium">
          Expectativa de renda mensal
        </label>
        <MoneyInput
          id="goal-amount"
          cents={cents}
          onCentsChange={setCents}
          aria-label="Expectativa de renda mensal da categoria"
          placeholder="Ex.: R$ 5.000,00"
        />
        <p className="text-xs text-muted-foreground">
          Define quanto você planeja receber nesta categoria em {month}.
        </p>
      </div>

      {onEditCategory ? (
        <div className="flex items-center justify-between border-t border-border pt-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground hover:text-foreground gap-1.5 px-0"
            onClick={() => {
              onClose();
              onEditCategory(category);
            }}
          >
            <Edit2 className="size-3.5" aria-hidden="true" />
            <span>Editar detalhes da categoria (nome, cor, ícone)</span>
          </Button>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-2 pt-1">
        {currentExpectedCents > 0 ? (
          <Button
            type="button"
            variant="ghost"
            className="text-critical hover:text-critical"
            onClick={() => void handleRemove()}
          >
            Remover meta
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={cents <= 0 || pending}>
            {pending ? "Salvando…" : "Salvar meta"}
          </Button>
        </div>
      </div>
    </form>
  );
}

/** Edição da meta de renda de uma categoria (§3.5.3). */
export function IncomeGoalDialog({
  category,
  month,
  currentExpectedCents,
  open,
  onOpenChange,
  onEditCategory,
}: IncomeGoalDialogProps) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={`Meta de Renda — ${category.name}`}
      description={`Definição para o mês ${month}`}
      showCalculator
    >
      {open ? (
        <IncomeGoalDialogContent
          key={`${category.id}:${month}`}
          category={category}
          month={month}
          currentExpectedCents={currentExpectedCents}
          onClose={() => onOpenChange(false)}
          onEditCategory={onEditCategory}
        />
      ) : null}
    </Modal>
  );
}
