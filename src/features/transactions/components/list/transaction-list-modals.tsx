import { Modal } from "@/components/ui";
import { SplitExpenseDialog, SplitPreviewMockupCard, UpgradeDialog } from "@/components/modules";
import { todayISO } from "@/domain/debts";
import type { Expense, Income, SubscriptionPlan } from "@/types";
import { ExpenseDetailDialog } from "../expense-detail-dialog";
import { IncomeDetailDialog } from "../income-detail-dialog";

export interface TransactionListModalsProps {
  activeExpense: Expense | null;
  expenseOpen: boolean;
  onExpenseOpenChange: (open: boolean) => void;
  activeIncome: Income | null;
  incomeOpen: boolean;
  onIncomeOpenChange: (open: boolean) => void;
  showRachaPreview: boolean;
  showRachaSimulation: boolean;
  onCloseRachaParams: () => void;
  upgradeOpen: boolean;
  onUpgradeOpenChange: (open: boolean) => void;
  upgradeContext?: string;
  onProceedToCheckout: (plan: SubscriptionPlan) => void;
}

/** Orquestra os modais de detalhes, demonstração de racha e upgrade da lista de transações. */
export function TransactionListModals({
  activeExpense,
  expenseOpen,
  onExpenseOpenChange,
  activeIncome,
  incomeOpen,
  onIncomeOpenChange,
  showRachaPreview,
  showRachaSimulation,
  onCloseRachaParams,
  upgradeOpen,
  onUpgradeOpenChange,
  upgradeContext,
  onProceedToCheckout,
}: TransactionListModalsProps) {
  return (
    <>
      <ExpenseDetailDialog
        expense={activeExpense}
        open={expenseOpen}
        onOpenChange={onExpenseOpenChange}
      />

      <IncomeDetailDialog
        income={activeIncome}
        open={incomeOpen}
        onOpenChange={onIncomeOpenChange}
      />

      {showRachaPreview && (
        <Modal
          open={true}
          onOpenChange={(next) => {
            if (!next) onCloseRachaParams();
          }}
          title="Demonstração do Racha com Pix"
          description="Visualização didática de como amigos visualizam a cobrança compartilhada e efetuam o pagamento."
          size="md"
        >
          <SplitPreviewMockupCard />
        </Modal>
      )}

      {showRachaSimulation && (
        <SplitExpenseDialog
          open={true}
          isSimulation={true}
          onOpenChange={(next) => {
            if (!next) onCloseRachaParams();
          }}
          initialAmountCents={48000}
          initialDescription="Churrasco de Confraternização"
          initialDate={todayISO()}
          initialPeopleCount={4}
          categoryName="Lazer & Assinaturas"
          autoGenerate={false}
        />
      )}

      <UpgradeDialog
        open={upgradeOpen}
        onOpenChange={onUpgradeOpenChange}
        context={upgradeContext}
        onProceedToCheckout={onProceedToCheckout}
      />
    </>
  );
}
