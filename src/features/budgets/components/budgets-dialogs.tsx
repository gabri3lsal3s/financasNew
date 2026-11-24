import { Alert, ConfirmDialog } from "@/components/ui";
import { UpgradeDialog } from "@/components/modules";
import { isInheritedLimit, resolveEffectiveLimit } from "@/domain/budgets";
import { buildCheckoutUrl } from "@/domain/subscription/plans";
import {
  AddContributionDialog,
  GoalCompositionDialog,
  ManageContributionsDialog,
  ShareGoalDialog,
} from "@/features/goals";
import { monthLabel } from "@/lib/date";
import { formatCentsAsBRL } from "@/services/masks";
import { BudgetAdjustDialog } from "./budget-adjust-dialog";
import { CategoryFormDialog } from "./category-form-dialog";
import { CategoryKitsModal } from "./category-kits-modal";
import { IncomeGoalDialog } from "./income-goal-dialog";
import { LimitDialog } from "./limit-dialog";
import type { useBudgetsPage } from "./use-budgets-page";

export interface BudgetsDialogsProps {
  state: ReturnType<typeof useBudgetsPage>;
}

/** Conjunto de diálogos operacionais do módulo de Orçamentos e Metas. */
export function BudgetsDialogs({ state }: BudgetsDialogsProps) {
  const {
    month,
    tab,
    limitFor,
    setLimitFor,
    limitsByCategory,
    totalIncomesCents,
    handleEditCategory,
    goalFor,
    setGoalFor,
    goalsByCategory,
    sharingGoalFor,
    setSharingGoalFor,
    realizedByCategory,
    createStandaloneCampaignOpen,
    setCreateStandaloneCampaignOpen,
    editingShare,
    setEditingShare,
    editingShareInitialEdit,
    setEditingShareInitialEdit,
    goalShares,
    depositShare,
    setDepositShare,
    manageContributionsShare,
    setManageContributionsShare,
    compositionShare,
    setCompositionShare,
    handleCompositionSave,
    editingCategory,
    setEditingCategory,
    categoryFormOpen,
    setCategoryFormOpen,
    siblings,
    categoryUsage,
    reallocateOpen,
    setReallocateOpen,
    reallocateError,
    isReallocatePending,
    suggestion,
    fromCategory,
    toCategory,
    applyReallocation,
    upgradeOpen,
    setUpgradeOpen,
    upgradeContext,
    navigate,
    adjustOpen,
    setAdjustOpen,
    adjustCategories,
    kitsModalOpen,
    setKitsModalOpen,
    initialKitId,
    allCategories,
  } = state;

  return (
    <>
      {limitFor ? (
        <LimitDialog
          key={`${limitFor.id}:${month}`}
          category={limitFor}
          month={month}
          currentLimitCents={resolveEffectiveLimit(limitsByCategory.get(limitFor.id) ?? [], month)}
          inherited={isInheritedLimit(limitsByCategory.get(limitFor.id) ?? [], month)}
          monthlyIncomeCents={totalIncomesCents}
          open={limitFor !== null}
          onOpenChange={(next) => !next && setLimitFor(null)}
          onEditCategory={handleEditCategory}
        />
      ) : null}

      {goalFor ? (
        <IncomeGoalDialog
          key={`${goalFor.id}:${month}`}
          category={goalFor}
          month={month}
          currentExpectedCents={goalsByCategory.get(goalFor.id) ?? 0}
          open={goalFor !== null}
          onOpenChange={(next) => !next && setGoalFor(null)}
          onEditCategory={handleEditCategory}
        />
      ) : null}

      {sharingGoalFor ? (
        <ShareGoalDialog
          key={`share:${sharingGoalFor.id}:${month}`}
          category={sharingGoalFor}
          month={month}
          currentExpectedCents={goalsByCategory.get(sharingGoalFor.id) ?? 0}
          currentRealizedCents={realizedByCategory.get(sharingGoalFor.id) ?? 0}
          open={sharingGoalFor !== null}
          onOpenChange={(next) => !next && setSharingGoalFor(null)}
        />
      ) : null}

      {createStandaloneCampaignOpen ? (
        <ShareGoalDialog
          key="share:new-standalone"
          category={null}
          month={month}
          open={createStandaloneCampaignOpen}
          onOpenChange={setCreateStandaloneCampaignOpen}
        />
      ) : null}

      {editingShare ? (
        <ShareGoalDialog
          key={`share:edit:${editingShare.id}:${editingShareInitialEdit ? "edit" : "view"}`}
          category={null}
          existingShare={goalShares.find((s) => s.id === editingShare.id) ?? editingShare}
          month={month}
          open={editingShare !== null}
          initialEditMode={editingShareInitialEdit}
          onOpenChange={(next) => {
            if (!next) {
              setEditingShare(null);
              setEditingShareInitialEdit(false);
            }
          }}
        />
      ) : null}

      {depositShare ? (
        <AddContributionDialog
          key={`deposit:${depositShare.id}`}
          share={depositShare}
          open={depositShare !== null}
          onOpenChange={(next) => !next && setDepositShare(null)}
        />
      ) : null}

      {manageContributionsShare ? (
        <ManageContributionsDialog
          key={`manage-contribs:${manageContributionsShare.id}`}
          share={manageContributionsShare}
          open={manageContributionsShare !== null}
          onOpenChange={(next) => !next && setManageContributionsShare(null)}
        />
      ) : null}

      {compositionShare ? (
        <GoalCompositionDialog
          open={compositionShare !== null}
          onOpenChange={(next) => !next && setCompositionShare(null)}
          config={
            (compositionShare.payload as Record<string, unknown> | undefined)
              ?.composition_config as never
          }
          targetCents={Number(
            (compositionShare.payload as Record<string, unknown> | undefined)?.target_cents ?? 0,
          )}
          goalTitle={
            (compositionShare.payload as Record<string, unknown> | undefined)?.title as string
          }
          isCompleted={
            (compositionShare.payload as Record<string, unknown> | undefined)?.status ===
            "completed"
          }
          onSave={handleCompositionSave}
        />
      ) : null}

      <CategoryFormDialog
        category={editingCategory}
        defaultType={tab === "limits" ? "expense" : "income"}
        open={categoryFormOpen}
        onOpenChange={(next) => {
          setCategoryFormOpen(next);
          if (!next) setEditingCategory(null);
        }}
        siblings={editingCategory ? siblings : undefined}
        usage={editingCategory ? categoryUsage : undefined}
      />

      <ConfirmDialog
        open={reallocateOpen}
        onOpenChange={setReallocateOpen}
        title="Aplicar realocação de limite?"
        description={
          suggestion && fromCategory && toCategory
            ? `Transferir ${formatCentsAsBRL(suggestion.amountCents)} da folga de ${fromCategory.name} para cobrir o limite de ${toCategory.name} (${monthLabel(month)}).`
            : undefined
        }
        confirmLabel={isReallocatePending ? "Aplicando…" : "Aplicar"}
        confirmPending={isReallocatePending}
        onConfirm={() => void applyReallocation()}
      >
        {reallocateError ? (
          <div className="mt-4">
            <Alert variant="error">{reallocateError}</Alert>
          </div>
        ) : null}
      </ConfirmDialog>

      <UpgradeDialog
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        context={upgradeContext}
        onProceedToCheckout={(p) => {
          setUpgradeOpen(false);
          navigate(buildCheckoutUrl({ plan: p }));
        }}
      />

      <BudgetAdjustDialog
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        month={month}
        categories={adjustCategories}
      />

      <CategoryKitsModal
        open={kitsModalOpen}
        onOpenChange={setKitsModalOpen}
        existingCategories={allCategories}
        initialKitId={initialKitId}
      />
    </>
  );
}
