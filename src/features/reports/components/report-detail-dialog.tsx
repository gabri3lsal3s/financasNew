import { useState } from "react";
import { ReceiptText, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { MoneyText } from "@/components/ui/money-text";
import { EmptyState } from "@/components/ui/empty-state";
import { TransactionRow } from "@/components/modules/transaction-row";
import { formatCentsAsBRL } from "@/services/masks";
import { shareText } from "@/services/export-actions";
import { triggerHaptic } from "@/services/haptics";
import type { Category, Expense } from "@/types";

export interface ReportDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  expenses: Expense[];
  categories: Category[];
  onSelectExpense?: (expense: Expense) => void;
}

/** Modal de detalhamento de despesas por categoria/forma/dia nos relatórios. */
export function ReportDetailDialog({
  open,
  onOpenChange,
  title,
  subtitle,
  expenses,
  categories,
  onSelectExpense,
}: ReportDetailDialogProps) {
  const [sharing, setSharing] = useState(false);
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  const totalBrutoCents = expenses.reduce((acc, e) => acc + Math.round(e.value * 100), 0);
  const totalPonderadoCents = expenses.reduce(
    (acc, e) => acc + Math.round(e.value * e.report_weight * 100),
    0,
  );
  const hasDualMetrics = totalBrutoCents !== totalPonderadoCents;

  const handleShare = async (): Promise<void> => {
    triggerHaptic("light");
    setSharing(true);
    try {
      const lines = expenses.slice(0, 8).map((e) => {
        const cat = categoryById.get(e.category_id);
        return `- ${e.description || cat?.name || "Despesa"}: ${formatCentsAsBRL(Math.round(e.value * 100))} (${e.date})`;
      });
      const text = [
        `${title}${subtitle ? ` — ${subtitle}` : ""}`,
        `Total: ${formatCentsAsBRL(totalBrutoCents)}`,
        ...(hasDualMetrics ? [`Ponderado: ${formatCentsAsBRL(totalPonderadoCents)}`] : []),
        "",
        ...lines,
        expenses.length > 8 ? `... e mais ${expenses.length - 8} lançamento(s).` : "",
      ].filter(Boolean).join("\n");
      await shareText("Resumo de despesas — Finanças Pessoais", text);
    } finally {
      setSharing(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={subtitle}
      size="xl"
    >
      <div className="flex flex-col gap-4 mt-4">
        {/* Resumo do agrupamento */}
        <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 p-3">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">Lançamentos</span>
            <span className="text-sm font-semibold text-foreground">
              {expenses.length} {expenses.length === 1 ? "despesa" : "despesas"}
            </span>
          </div>
          <div className="flex flex-col items-end text-right">
            <span className="text-sm font-semibold text-foreground">
              {hasDualMetrics ? "Total Bruto: " : "Total: "}
              <MoneyText cents={totalBrutoCents} tone="negative" />
            </span>
            {hasDualMetrics ? (
              <span className="text-xs text-muted-foreground">
                Ponderado: <MoneyText cents={totalPonderadoCents} tone="default" />
              </span>
            ) : null}
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            loading={sharing}
            aria-label="Compartilhar resumo"
            onClick={() => void handleShare()}
            className="gap-1.5 shrink-0"
          >
            <Share2 className="size-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Compartilhar</span>
          </Button>
        </div>

        {/* Lista de despesas */}
        {expenses.length === 0 ? (
          <EmptyState
            icon={<ReceiptText className="size-6" aria-hidden="true" />}
            title="Nenhuma despesa"
            description="Não há despesas registradas para este filtro no período."
          />
        ) : (
          <div className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto pr-1">
            {expenses.map((expense) => {
              const cat = categoryById.get(expense.category_id);
              const itemTitle = expense.description || cat?.name || "Despesa";
              const itemSubtitle =
                expense.installments_total > 1
                  ? `${expense.installment_number}/${expense.installments_total}`
                  : undefined;
              return (
                <TransactionRow
                  key={expense.id}
                  title={itemTitle}
                  date={expense.date}
                  subtitle={itemSubtitle}
                  amountCents={Math.round(expense.value * 100)}
                  reportWeight={expense.report_weight}
                  kind="expense"
                  icon={cat?.icon}
                  iconColor={cat?.color}
                  onClick={onSelectExpense ? () => onSelectExpense(expense) : undefined}
                />
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
