import { useQueryClient } from "@tanstack/react-query";
import { ConfirmDialog } from "@/components/ui";
import { AttachReceiptDialog } from "@/components/modules/attach-receipt-dialog";
import { SplitExpenseDialog } from "@/components/modules/split-expense-dialog";
import type { ParsedBankTransaction } from "@/domain/notifications";
import type { CreditCard } from "@/types";
import type { CreatedSplitExpense } from "./wizard-types";

export interface LaunchWizardModalsProps {
  confirmClose: boolean;
  onConfirmCloseChange: (open: boolean) => void;
  onConfirmDiscard: () => void;
  attachOpen: boolean;
  onAttachOpenChange: (open: boolean) => void;
  onReceiptParsed: (parsed: ParsedBankTransaction) => void;
  cards: CreditCard[] | undefined;
  createdSplitExpense: CreatedSplitExpense | null;
  onClearCreatedSplit: () => void;
  onSplitFinished: () => void;
  upgradeModal: React.ReactNode;
}

/** Modais auxiliares do LaunchWizard (descarte, anexo de comprovante e racha pós-criação). */
export function LaunchWizardModals({
  confirmClose,
  onConfirmCloseChange,
  onConfirmDiscard,
  attachOpen,
  onAttachOpenChange,
  onReceiptParsed,
  cards,
  createdSplitExpense,
  onClearCreatedSplit,
  onSplitFinished,
  upgradeModal,
}: LaunchWizardModalsProps) {
  const queryClient = useQueryClient();

  return (
    <>
      <ConfirmDialog
        open={confirmClose}
        onOpenChange={onConfirmCloseChange}
        title="Descartar lançamento?"
        description="Você preencheu dados deste lançamento. Ao sair, as informações digitadas serão perdidas."
        confirmLabel="Descartar"
        cancelLabel="Continuar preenchendo"
        variant="destructive"
        onConfirm={onConfirmDiscard}
      />

      <AttachReceiptDialog
        open={attachOpen}
        onOpenChange={onAttachOpenChange}
        onParsed={onReceiptParsed}
        cards={cards}
      />

      {createdSplitExpense ? (
        <SplitExpenseDialog
          open={true}
          fromWizard={true}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              onClearCreatedSplit();
              void queryClient.invalidateQueries({ queryKey: ["my-public-shares"] });
              void queryClient.invalidateQueries({ queryKey: ["public-share"] });
              void queryClient.invalidateQueries({ queryKey: ["public-shares"] });
              void queryClient.invalidateQueries({ queryKey: ["debts"] });
              void queryClient.invalidateQueries({ queryKey: ["expenses"] });
              void queryClient.invalidateQueries({ queryKey: ["overview"] });
              onSplitFinished();
            }
          }}
          expense={{
            id: createdSplitExpense.id,
            value: createdSplitExpense.value,
            description: createdSplitExpense.description ?? null,
            date: createdSplitExpense.date,
            category_id: createdSplitExpense.categoryId || "",
            payment_method: "pix",
            created_at: "",
            installments_total: createdSplitExpense.installmentsCount ?? undefined,
          }}
          initialInstallmentsCount={createdSplitExpense.installmentsCount}
          initialInstallmentsMode={createdSplitExpense.installmentsMode}
          categoryName={createdSplitExpense.categoryName}
          categoryIcon={createdSplitExpense.categoryIcon}
          initialAmountCents={Math.round(createdSplitExpense.value * 100)}
          initialDescription={createdSplitExpense.description || ""}
          initialDate={createdSplitExpense.date}
          initialPeopleCount={createdSplitExpense.peopleCount}
          autoGenerate={false}
        />
      ) : null}

      {upgradeModal}
    </>
  );
}
