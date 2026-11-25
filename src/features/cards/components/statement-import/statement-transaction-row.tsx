import { memo } from "react";
import { Briefcase, Edit3, Trash2 } from "lucide-react";
import {
  Badge,
  Button,
  Checkbox,
  MoneyText,
  type SelectOption,
} from "@/components/ui";
import type { ReconciliationItem } from "@/domain/reconciliation";
import { formatDateBR, monthLabel } from "@/lib/date";
import { formatCentsAsCurrency } from "@/services/masks";
import { CategoryPill } from "./category-pill";
import type { StatementItemPatch } from "./statement-import-types";
import { StatementItemForm } from "./statement-item-form";

export interface StatementTransactionRowProps {
  item: ReconciliationItem;
  categoryOptions: SelectOption[];
  isEditing?: boolean;
  showScopeControls?: boolean;
  isLockedByBillProtection?: boolean;
  isCompetenceMoveApproved?: boolean;
  isOriginOrTargetLocked?: boolean;
  isMicroAdjustmentSuppressed?: boolean;
  isPending?: boolean;
  onToggleItem: (id: string) => void;
  onChangeCategory: (id: string, categoryId: string) => void;
  onStartEdit: (id: string) => void;
  onSaveEdit: (id: string, updated: StatementItemPatch) => void;
  onCancelEdit: () => void;
  onRemove: (id: string) => void;
  onToggleScope?: (id: string) => void;
  onToggleProjectSeries?: (id: string) => void;
  onLinkAndAdjust?: (id: string) => void;
  onUndoLinkAndAdjust?: (id: string) => void;
  onApproveCompetenceMove?: (id: string) => void;
  onToggleSuppressMicroAdjustment?: (expenseId: string) => void;
  onRestoreIgnoredPayment?: (id: string, targetMode: "purchase" | "refund") => void;
}

function resolveRowBadge(item: ReconciliationItem): {
  label: string;
  variant: "muted" | "positive" | "warning";
} | null {
  const tx = item.transaction;
  if (item.ignoredByDefault) return { label: "Pagamento ignorado", variant: "muted" };
  if (item.status === "exact_match") return { label: "Conciliado", variant: "positive" };
  if (item.isInternalDuplicate) return { label: "Duplicata", variant: "warning" };
  if (item.crossCompetenceMatch) return { label: "Outro mês", variant: "warning" };
  if (item.status === "probable_match") {
    return {
      label: item.isLinkedAndAdjusted ? "Vínculo marcado" : "Possível vínculo",
      variant: item.isLinkedAndAdjusted ? "positive" : "warning",
    };
  }
  if (tx.isRefund) return { label: "Estorno", variant: "positive" };
  if (tx.installment && tx.installment.total > 1) {
    return {
      label: `${tx.installment.current}/${tx.installment.total}`,
      variant: "muted",
    };
  }
  return null;
}

/**
 * Linha previsível de lançamento da fatura em 2 andares + no máximo 1 faixa contextual (React.memo).
 */
export const StatementTransactionRow = memo(function StatementTransactionRow({
  item,
  categoryOptions,
  isEditing = false,
  showScopeControls = false,
  isLockedByBillProtection = false,
  isCompetenceMoveApproved = false,
  isOriginOrTargetLocked = false,
  isMicroAdjustmentSuppressed = false,
  isPending = false,
  onToggleItem,
  onChangeCategory,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onRemove,
  onToggleScope,
  onToggleProjectSeries,
  onLinkAndAdjust,
  onUndoLinkAndAdjust,
  onApproveCompetenceMove,
  onToggleSuppressMicroAdjustment,
  onRestoreIgnoredPayment,
}: StatementTransactionRowProps) {
  const tx = item.transaction;

  if (isEditing) {
    return (
      <div className="p-2.5 sm:p-3">
        <StatementItemForm
          mode="edit"
          categoryOptions={categoryOptions}
          showDeductibility={showScopeControls && item.scope === "business"}
          initialValues={{
            date: tx.date,
            cleanDescription: tx.cleanDescription,
            amountCents: tx.amountCents,
            selectedCategoryId: item.selectedCategoryId,
            installment: tx.installment,
            isRefund: tx.isRefund,
            isTaxDeductible: item.isTaxDeductible,
          }}
          onSubmit={(updated) => onSaveEdit(tx.id, updated)}
          onCancel={onCancelEdit}
        />
      </div>
    );
  }

  const badge = resolveRowBadge(item);
  const diffCents =
    item.matchedExpenseValueCents !== undefined
      ? Math.abs(tx.amountCents - item.matchedExpenseValueCents)
      : 0;
  const isStrongMicroAdjustment =
    item.status === "probable_match" &&
    Boolean(item.matchedExpenseId) &&
    diffCents > 0 &&
    diffCents <= 5 &&
    item.score >= 65 &&
    item.hasStrongSemanticSignal === true;

  const missingFutures = item.seriesAnalysis?.missingFutureInstallments.length ?? 0;
  const showSeriesStrip =
    !item.ignoredByDefault &&
    item.status === "unmatched_new" &&
    !item.crossCompetenceMatch &&
    !tx.isRefund &&
    item.seriesAnalysis !== null &&
    item.seriesAnalysis !== undefined &&
    item.seriesAnalysis.state !== "state_4_already_projected" &&
    missingFutures > 0;

  return (
    <div
      className={`p-3 sm:p-3.5 transition-colors ${
        item.ignoredByDefault || item.status === "exact_match"
          ? "opacity-75 bg-surface"
          : "hover:bg-surface-hover/40"
      }`}
    >
      {/* Andar 1: Checkbox + Nome (sem truncate cego) + Valor */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          <div className="pt-0.5">
            <Checkbox
              checked={item.selected}
              disabled={isPending || item.ignoredByDefault || item.status === "exact_match"}
              onCheckedChange={() => onToggleItem(tx.id)}
              aria-label={`Selecionar ${tx.cleanDescription}`}
            />
          </div>
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="text-sm font-medium text-foreground line-clamp-2 break-words">
              {tx.cleanDescription}
            </p>
            {item.status === "probable_match" && item.matchedExpenseDescription ? (
              <p className="text-xs text-muted-foreground line-clamp-1 break-words">
                Parecido com {item.matchedExpenseDescription} no aplicativo
              </p>
            ) : null}
          </div>
        </div>

        <MoneyText
          cents={tx.isRefund ? -tx.amountCents : tx.amountCents}
          tone={tx.isRefund ? "positive" : "default"}
          sign={tx.isRefund ? "explicit" : "none"}
          variant="value"
          className="shrink-0"
        />
      </div>

      {/* Andar 2: Data + Máx 1 Badge + Categoria + Controles */}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 pl-6">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
            {formatDateBR(tx.date)}
          </span>
          {badge ? (
            <Badge variant={badge.variant} size="xs">
              {badge.label}
            </Badge>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {!item.ignoredByDefault ? (
            <CategoryPill
              value={item.selectedCategoryId}
              options={categoryOptions}
              onChange={(catId) => onChangeCategory(tx.id, catId)}
              disabled={isPending || item.status === "exact_match"}
            />
          ) : null}

          {showScopeControls && !item.ignoredByDefault && onToggleScope ? (
            <Button
              type="button"
              variant={item.scope === "business" ? "secondary" : "ghost"}
              size="xs"
              disabled={isPending || item.status === "exact_match"}
              onClick={() => onToggleScope(tx.id)}
              className="gap-1 px-2"
              title="Alternar escopo Pessoal (PF) / Meu Negócio (PJ)"
            >
              <Briefcase className="size-3" aria-hidden="true" />
              <span>{item.scope === "business" ? "PJ" : "PF"}</span>
            </Button>
          ) : null}

          {!item.ignoredByDefault && item.status !== "exact_match" ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isPending}
                onClick={() => onStartEdit(tx.id)}
                className="size-8 !w-8 !min-w-8 p-0 shrink-0 text-muted-foreground hover:text-foreground"
                aria-label={`Editar ${tx.cleanDescription}`}
                title="Editar lançamento"
              >
                <Edit3 className="size-3.5" aria-hidden="true" />
                <span className="sr-only">Editar</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isPending}
                onClick={() => onRemove(tx.id)}
                className="size-8 !w-8 !min-w-8 p-0 shrink-0 text-muted-foreground hover:text-critical-strong"
                aria-label={`Remover ${tx.cleanDescription}`}
                title="Remover da lista"
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
                <span className="sr-only">Remover</span>
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {/* Faixa contextual opcional (máx 1 linha) */}
      {item.ignoredByDefault && tx.isPayment && onRestoreIgnoredPayment ? (
        <div className="mt-2 pl-6 flex flex-wrap items-center gap-2 pt-2 border-t border-border/80">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={isPending}
            onClick={() => onRestoreIgnoredPayment(tx.id, "purchase")}
          >
            Restaurar como compra
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={isPending}
            onClick={() => onRestoreIgnoredPayment(tx.id, "refund")}
          >
            Restaurar como estorno
          </Button>
        </div>
      ) : item.status === "probable_match" && item.matchedExpenseId ? (
        <div className="mt-2 pl-6 pt-2 border-t border-border/80 flex flex-wrap items-center justify-between gap-2">
          {isStrongMicroAdjustment && onToggleSuppressMicroAdjustment ? (
            <Checkbox
              checked={!isMicroAdjustmentSuppressed && !isLockedByBillProtection}
              disabled={isPending || isLockedByBillProtection}
              onCheckedChange={() => onToggleSuppressMicroAdjustment(item.matchedExpenseId!)}
              label={`Ajustar valor no app de ${formatCentsAsCurrency(
                item.matchedExpenseValueCents ?? tx.amountCents,
              )} para ${formatCentsAsCurrency(tx.amountCents)}`}
            />
          ) : item.isLinkedAndAdjusted && onUndoLinkAndAdjust ? (
            <div className="flex items-center justify-between gap-2 w-full text-xs text-muted-foreground">
              <span>Vínculo e ajuste marcados para aplicar ao salvar</span>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                disabled={isPending}
                onClick={() => onUndoLinkAndAdjust(tx.id)}
              >
                Desfazer
              </Button>
            </div>
          ) : onLinkAndAdjust ? (
            <Button
              type="button"
              variant="outline"
              size="xs"
              sensoryIntent={false}
              disabled={isPending || isLockedByBillProtection}
              onClick={() => onLinkAndAdjust(tx.id)}
            >
              Vincular e ajustar valor
            </Button>
          ) : null}
        </div>
      ) : item.crossCompetenceMatch && onApproveCompetenceMove ? (
        <div className="mt-2 pl-6 pt-2 border-t border-border/80">
          <Checkbox
            checked={isCompetenceMoveApproved && !isOriginOrTargetLocked}
            disabled={isPending || isOriginOrTargetLocked}
            onCheckedChange={() => onApproveCompetenceMove(tx.id)}
            label={`Mover despesa de ${monthLabel(
              item.crossCompetenceMatch.currentBillCompetence,
            )} para esta fatura`}
          />
        </div>
      ) : showSeriesStrip && onToggleProjectSeries ? (
        <div className="mt-2 pl-6 pt-2 border-t border-border/80">
          <Checkbox
            checked={item.projectSeries ?? true}
            disabled={isPending || !item.selected}
            onCheckedChange={() => onToggleProjectSeries(tx.id)}
            label={`Projetar ${missingFutures} ${
              missingFutures === 1 ? "parcela futura" : "parcelas futuras"
            } (${(tx.installment?.current ?? 1) + 1}..${tx.installment?.total})`}
          />
        </div>
      ) : null}
    </div>
  );
});
