import { useState } from "react";
import { Alert, Button, Modal, MoneyInput } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { suggestCategory, suggestLimitCents } from "@/domain/budgets";
import { getErrorMessage } from "@/services/errors";
import { useRemoveBudgetLimit, useSetBudgetLimit } from "@/state";
import type { Category } from "@/types";

export interface LimitDialogProps {
  category: Category;
  /** Mês do orçamento (YYYY-MM). */
  month: string;
  /** Limite efetivo (com herança) em centavos. */
  currentLimitCents: number;
  /** O limite atual veio de herança do mês anterior? */
  inherited: boolean;
  /** Renda do mês (centavos) — base da sugestão por % da renda. */
  monthlyIncomeCents: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface LimitDialogContentProps {
  category: Category;
  month: string;
  currentLimitCents: number;
  inherited: boolean;
  monthlyIncomeCents: number;
  onClose: () => void;
}

function LimitDialogContent({
  category,
  month,
  currentLimitCents,
  inherited,
  monthlyIncomeCents,
  onClose,
}: LimitDialogContentProps) {
  const [cents, setCents] = useState(currentLimitCents);
  const [error, setError] = useState<string | null>(null);

  const setLimit = useSetBudgetLimit();
  const removeLimit = useRemoveBudgetLimit();
  const pending = setLimit.isPending || removeLimit.isPending;

  const rule = suggestCategory(category.name);
  const suggestionCents = rule ? suggestLimitCents(monthlyIncomeCents, rule.limitPercent) : 0;

  const handleSave = async () => {
    setError(null);
    if (cents <= 0) return;
    try {
      await setLimit.mutateAsync({ categoryId: category.id, month, limit: cents / 100 });
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleRemove = async () => {
    setError(null);
    try {
      await removeLimit.mutateAsync({ categoryId: category.id, month });
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
        <label htmlFor="limit-amount" className="text-sm font-medium">
          Limite mensal
        </label>
        <MoneyInput autoFocus id="limit-amount" cents={cents} onCentsChange={setCents} aria-label="Limite mensal da categoria" />
      </div>

      {rule && suggestionCents > 0 ? (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface p-3 text-sm">
          <div>
            <p className="font-medium text-foreground">Sugestão ({rule.limitPercent}% da renda)</p>
            <p className="text-xs text-muted-foreground">
              Com base na renda de <MoneyText cents={monthlyIncomeCents} tone="default" className="privacy-mask text-xs" /> deste mês.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCents(suggestionCents)}
          >
            Aplicar <MoneyText cents={suggestionCents} tone="default" className="privacy-mask" />
          </Button>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-2 pt-2">
        {!inherited && currentLimitCents > 0 ? (
          <Button type="button" variant="ghost" className="text-critical hover:text-critical" onClick={() => void handleRemove()}>
            Remover limite
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={cents <= 0 || pending}>
            {pending ? "Salvando…" : "Salvar limite"}
          </Button>
        </div>
      </div>
    </form>
  );
}

/** Edição do limite mensal de uma categoria (§3.5.2) com sugestão inteligente. */
export function LimitDialog({
  category,
  month,
  currentLimitCents,
  inherited,
  monthlyIncomeCents,
  open,
  onOpenChange,
}: LimitDialogProps) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={`Limite — ${category.name}`}
      description={`Mês ${month}${inherited ? " · herdado do mês anterior (ao salvar, vira limite próprio)" : ""}`}
    >
      {open ? (
        <LimitDialogContent
          key={`${category.id}:${month}`}
          category={category}
          month={month}
          currentLimitCents={currentLimitCents}
          inherited={inherited}
          monthlyIncomeCents={monthlyIncomeCents}
          onClose={() => onOpenChange(false)}
        />
      ) : null}
    </Modal>
  );
}
