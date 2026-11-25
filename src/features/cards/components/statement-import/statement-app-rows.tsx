import { memo } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import { Badge, Button, MoneyText } from "@/components/ui";
import type {
  AppDuplicateCandidate,
  ExistingExpenseForReconciliation,
} from "@/domain/reconciliation";
import { formatDateBR, monthLabel } from "@/lib/date";

export interface StatementAppOnlyRowProps {
  expense: ExistingExpenseForReconciliation;
  categoryName: string;
  isNearClosing?: boolean;
  prevCompetence?: string;
  nextCompetence?: string;
  isQueuedForDelete?: boolean;
  isLockedByBillProtection?: boolean;
  isPending?: boolean;
  onMoveCompetence?: (expenseId: string, targetCompetence: string) => void;
  onQueueDelete?: (expenseId: string) => void;
  onUndoDelete?: (expenseId: string) => void;
}

/**
 * Linha para despesa existente no app ausente na fatura, com staging reversível de exclusão (D9/D14).
 */
export const StatementAppOnlyRow = memo(function StatementAppOnlyRow({
  expense,
  categoryName,
  isNearClosing,
  prevCompetence,
  nextCompetence,
  isQueuedForDelete = false,
  isLockedByBillProtection = false,
  isPending = false,
  onMoveCompetence,
  onQueueDelete,
  onUndoDelete,
}: StatementAppOnlyRowProps) {
  const displayDesc = expense.description || categoryName || "Despesa";

  return (
    <div
      className={`p-3 sm:p-3.5 transition-colors flex flex-col gap-2.5 ${
        isQueuedForDelete ? "bg-critical/5" : "hover:bg-surface-hover/40"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <p
            className={`text-sm font-medium text-foreground line-clamp-2 break-words ${
              isQueuedForDelete ? "line-through opacity-65" : ""
            }`}
          >
            {displayDesc}
          </p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono text-[11px] tabular-nums">{formatDateBR(expense.date)}</span>
            <span>{categoryName}</span>
            {expense.installmentsTotal != null && expense.installmentsTotal > 1 ? (
              <Badge variant="muted" size="xs" className="font-mono">
                {expense.installmentNumber ?? 1}/{expense.installmentsTotal}
              </Badge>
            ) : null}
            {isQueuedForDelete ? (
              <Badge variant="critical" size="xs">
                Marcado para excluir
              </Badge>
            ) : null}
          </div>
        </div>
        <MoneyText
          cents={expense.valueCents}
          tone="default"
          variant="value"
          className={`shrink-0 ${isQueuedForDelete ? "line-through opacity-65" : ""}`}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/80">
        {isNearClosing && onMoveCompetence && !isQueuedForDelete ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {prevCompetence ? (
              <Button
                type="button"
                variant="outline"
                size="xs"
                sensoryIntent={false}
                disabled={isPending || isLockedByBillProtection}
                onClick={() => onMoveCompetence(expense.id, prevCompetence)}
              >
                Mover para {monthLabel(prevCompetence)}
              </Button>
            ) : null}
            {nextCompetence ? (
              <Button
                type="button"
                variant="outline"
                size="xs"
                sensoryIntent={false}
                disabled={isPending || isLockedByBillProtection}
                onClick={() => onMoveCompetence(expense.id, nextCompetence)}
              >
                Mover para {monthLabel(nextCompetence)}
              </Button>
            ) : null}
          </div>
        ) : (
          <span />
        )}

        {onQueueDelete || onUndoDelete ? (
          isQueuedForDelete ? (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              disabled={isPending}
              onClick={() => onUndoDelete?.(expense.id)}
              className="gap-1 text-foreground"
            >
              <RotateCcw className="size-3" aria-hidden="true" />
              Desfazer
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              sensoryIntent={false}
              disabled={isPending || isLockedByBillProtection}
              onClick={() => onQueueDelete?.(expense.id)}
              className="gap-1 text-critical-strong hover:bg-critical/10"
            >
              <Trash2 className="size-3" aria-hidden="true" />
              Marcar para excluir
            </Button>
          )
        ) : null}
      </div>
    </div>
  );
});

export interface StatementAppDuplicateRowProps {
  candidate: AppDuplicateCandidate;
  categoryName: string;
  isQueuedForDelete?: boolean;
  isLockedByBillProtection?: boolean;
  isPending?: boolean;
  onQueueDelete?: (expenseId: string) => void;
  onUndoDelete?: (expenseId: string) => void;
}

/**
 * Linha para possível duplicata já gravada no app na mesma competência (staging D9/D14).
 */
export const StatementAppDuplicateRow = memo(function StatementAppDuplicateRow({
  candidate,
  categoryName,
  isQueuedForDelete = false,
  isLockedByBillProtection = false,
  isPending = false,
  onQueueDelete,
  onUndoDelete,
}: StatementAppDuplicateRowProps) {
  const { keepExpense, duplicateExpense } = candidate;

  return (
    <div
      className={`p-3 sm:p-3.5 transition-colors flex flex-col gap-2.5 ${
        isQueuedForDelete ? "bg-critical/5" : "bg-warning/5"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <p
            className={`text-sm font-medium text-foreground line-clamp-2 break-words ${
              isQueuedForDelete ? "line-through opacity-65" : ""
            }`}
          >
            {duplicateExpense.description || categoryName || "Despesa duplicada"}
          </p>
          <p className="text-xs text-muted-foreground line-clamp-2 break-words">
            Possível duplicata de{" "}
            <strong className="text-foreground font-medium">
              {keepExpense.description || "lançamento existente"}
            </strong>{" "}
            ({formatDateBR(keepExpense.date)})
          </p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono text-[11px] tabular-nums">
              {formatDateBR(duplicateExpense.date)}
            </span>
            <Badge variant={isQueuedForDelete ? "critical" : "warning"} size="xs">
              {isQueuedForDelete ? "Marcado para excluir" : "Duplicata no app"}
            </Badge>
          </div>
        </div>
        <MoneyText
          cents={duplicateExpense.valueCents}
          tone="default"
          variant="value"
          className={`shrink-0 ${isQueuedForDelete ? "line-through opacity-65" : ""}`}
        />
      </div>

      {onQueueDelete || onUndoDelete ? (
        <div className="flex items-center justify-end pt-2 border-t border-border/80">
          {isQueuedForDelete ? (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              disabled={isPending}
              onClick={() => onUndoDelete?.(duplicateExpense.id)}
              className="gap-1 text-foreground"
            >
              <RotateCcw className="size-3" aria-hidden="true" />
              Desfazer
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              sensoryIntent={false}
              disabled={isPending || isLockedByBillProtection}
              onClick={() => onQueueDelete?.(duplicateExpense.id)}
              className="gap-1 text-critical-strong hover:bg-critical/10"
            >
              <Trash2 className="size-3" aria-hidden="true" />
              Marcar para excluir
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
});
