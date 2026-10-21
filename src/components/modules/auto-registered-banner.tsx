import { useEffect, useState } from "react";
import { CheckCircle2, Edit3, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCentsAsCurrency } from "@/services/masks";
import {
  dismissAutoRegisteredBanner,
  revertAutoRegisteredTransaction,
  useAutoRegisteredBanner,
} from "@/services/native";
import { ExpenseDetailDialog } from "@/features/transactions/components/expense-detail-dialog";
import { IncomeDetailDialog } from "@/features/transactions/components/income-detail-dialog";
import type { Expense, Income, PaymentMethod } from "@/types";

export interface AutoRegisteredBannerProps {
  className?: string;
}

/**
 * Banner persistente de Auto-Cadastro de Comprovantes com Edição Rápida e Desfazer (§1.6).
 *
 * Exibido no topo da Home (Visão Geral) logo após a importação e cadastro automático
 * de um comprovante compartilhado, fornecendo feedback claro, ação de edição com campos
 * pré-carregados e janela para desfazer.
 */
export function AutoRegisteredBanner({ className }: AutoRegisteredBannerProps) {
  const item = useAutoRegisteredBanner();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!item) return;
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [item]);

  if (!item) return null;

  const elapsedSeconds = Math.floor((now - item.registeredAt) / 1000);
  const countdown = Math.max(0, 5 - elapsedSeconds);
  const targetName = item.merchant || item.description;
  const formattedAmount = formatCentsAsCurrency(item.amountCents);
  const undoLabel = countdown > 0 ? `Desfazer (${countdown}s)` : "Desfazer";

  const handleUndo = async () => {
    await revertAutoRegisteredTransaction(item);
  };

  const handleEdit = () => {
    setIsEditDialogOpen(true);
  };

  const constructedExpense: Expense = {
    id: item.id,
    user_id: "",
    value: item.amountCents / 100,
    date: item.date,
    category_id: item.categoryId,
    payment_method: (item.paymentMethod as PaymentMethod) || "pix",
    card_id: null,
    installments_total: 1,
    installment_number: 1,
    installment_group_id: null,
    bill_competence: null,
    report_weight: 1,
    base_amount: item.amountCents / 100,
    description: item.description,
    charge_kind: "regular",
    created_at: new Date(item.registeredAt).toISOString(),
  };

  const constructedIncome: Income = {
    id: item.id,
    user_id: "",
    value: item.amountCents / 100,
    date: item.date,
    category_id: item.categoryId,
    receive_type: "pix",
    description: item.description,
    report_weight: 1,
    source_ref: null,
    installments_total: 1,
    installment_number: 1,
    installment_group_id: null,
    created_at: new Date(item.registeredAt).toISOString(),
  };

  return (
    <>
      <div
        role="status"
        aria-live="polite"
        className={cn(
          "w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs transition-all",
          className,
        )}
      >
        <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-positive/10 border border-positive/20 text-positive-strong"
            aria-hidden="true"
          >
            <CheckCircle2 className="size-4.5" />
          </span>
          <div className="flex flex-col min-w-0">
            <p className="text-sm font-semibold text-foreground tracking-tight">
              Pix de {formattedAmount} para {targetName} cadastrado!
            </p>
            <p className="text-xs text-muted-foreground">
              Lançamento efetivado com sucesso. Você pode editar ou reverter a qualquer momento.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <Button
            variant="outline"
            size="sm"
            onClick={handleEdit}
            className="gap-1.5"
          >
            <Edit3 className="size-3.5" aria-hidden="true" />
            <span>Editar Lançamento</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => void handleUndo()}
            className="gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <Undo2 className="size-3.5" aria-hidden="true" />
            <span>{undoLabel}</span>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={dismissAutoRegisteredBanner}
            aria-label="Fechar aviso de lançamento"
            className="size-8 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {item.type === "expense" ? (
        <ExpenseDetailDialog
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          expense={constructedExpense}
          initialEditing={true}
        />
      ) : (
        <IncomeDetailDialog
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          income={constructedIncome}
          initialEditing={true}
        />
      )}
    </>
  );
}
