import { useEffect, useState } from "react";
import { CheckCircle2, Edit3, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MoneyText } from "@/components/ui/money-text";
import { ExpenseDetailDialog } from "@/features/transactions/components/expense-detail-dialog";
import { IncomeDetailDialog } from "@/features/transactions/components/income-detail-dialog";
import { cn } from "@/lib/utils";
import {
  dismissAutoRegisteredBanner,
  revertAutoRegisteredTransaction,
  useAutoRegisteredBanner,
} from "@/services/native";
import type { Expense, Income, PaymentMethod, ReceiveType } from "@/types";

export interface AutoRegisteredBannerProps {
  className?: string;
}

/**
 * Banner persistente de Auto-Cadastro de Comprovantes com Edição Rápida e Desfazer (§1.6).
 */
export function AutoRegisteredBanner({ className }: AutoRegisteredBannerProps) {
  const item = useAutoRegisteredBanner();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!item) return;
    if (Date.now() - item.registeredAt >= 5000) return;
    const interval = setInterval(() => {
      const nextNow = Date.now();
      setNow(nextNow);
      if (nextNow - item.registeredAt >= 5000) {
        clearInterval(interval);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [item]);

  if (!item) return null;

  const elapsedSeconds = Math.floor((now - item.registeredAt) / 1000);
  const countdown = Math.max(0, 5 - elapsedSeconds);
  const targetName = item.merchant || item.description;
  const undoLabel = countdown > 0 ? `Desfazer (${countdown}s)` : "Desfazer";

  const constructedExpense: Expense = {
    id: item.id,
    user_id: "",
    value: item.amountCents / 100,
    date: item.date,
    category_id: item.categoryId,
    payment_method: (item.paymentMethod as PaymentMethod) || "pix",
    card_id: item.cardId ?? null,
    installments_total: item.installments ?? 1,
    installment_number: 1,
    installment_group_id: null,
    bill_competence: null,
    report_weight: 1,
    base_amount: item.amountCents / 100,
    description: item.description,
    charge_kind: "regular",
    created_at: new Date(item.registeredAt).toISOString(),
  };

  const receiveType: ReceiveType =
    item.paymentMethod === "transfer" ? "transfer" : item.paymentMethod === "cash" ? "cash" : "pix";

  const constructedIncome: Income = {
    id: item.id,
    user_id: "",
    value: item.amountCents / 100,
    date: item.date,
    category_id: item.categoryId,
    receive_type: receiveType,
    description: item.description,
    report_weight: 1,
    source_ref: null,
    installments_total: item.installments ?? 1,
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
              {item.bannerTitle || (
                <>
                  Pix de <MoneyText cents={item.amountCents} className="font-semibold" /> para{" "}
                  {targetName} cadastrado!
                </>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              Lançamento efetivado com sucesso. Você pode editar ou reverter a qualquer momento.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0 self-stretch sm:self-center justify-end">
          <Button variant="outline" size="sm" onClick={() => setIsEditDialogOpen(true)} className="gap-1.5">
            <Edit3 className="size-3.5" aria-hidden="true" />
            <span>Editar Lançamento</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => void revertAutoRegisteredTransaction(item)}
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
            className="relative size-8 text-muted-foreground hover:text-foreground max-sm:after:absolute max-sm:after:-inset-2"
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
