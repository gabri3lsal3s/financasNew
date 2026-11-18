import { Button, Modal, ModalFooter } from "@/components/ui";
import { CategoryFormDialog } from "@/features/budgets/components";
import type { TripMember } from "@/types/trips";
import { TripExpenseFormFields } from "./trip-expense-form-fields";
import { TripPersonalSyncPanel } from "./trip-personal-sync-panel";
import { TripSplitParticipantsList } from "./trip-split-participants-list";
import { useAddTripExpenseForm } from "./use-add-trip-expense-form";

export interface AddTripExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  members: readonly TripMember[];
  defaultPayerId?: string;
}

export function AddTripExpenseDialog({
  open,
  onOpenChange,
  tripId,
  members,
  defaultPayerId,
}: AddTripExpenseDialogProps) {
  const form = useAddTripExpenseForm({ tripId, members, defaultPayerId, onOpenChange });

  return (
    <>
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        size="lg"
        showCalculator
        title="Adicionar Despesa da Viagem"
        description="Lance gastos compartilhados com o grupo para compensação automática e acerto de contas."
        footer={
          <ModalFooter borderless>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={form.isPending}>
              Cancelar
            </Button>
            <Button
              type="submit"
              form="add-trip-expense-form"
              disabled={form.amountCents <= 0 || !form.description.trim() || !form.effectivePayerId || form.isPending}
              loading={form.isPending}
            >
              Adicionar Despesa
            </Button>
          </ModalFooter>
        }
      >
        <form id="add-trip-expense-form" onSubmit={form.handleSubmit} className="space-y-4">
          <TripExpenseFormFields
            formId="add-trip-expense-form"
            amountCents={form.amountCents}
            onAmountCentsChange={form.setAmountCents}
            description={form.description}
            onDescriptionChange={form.setDescription}
            categoryName={form.categoryName}
            onCategoryNameChange={(val) => {
              if (!val) return;
              form.setSelectedCategoryName(val);
              const matched = form.allExpenseCategories.find((c) => c.name.toLowerCase() === val.toLowerCase());
              if (matched) form.setSelectedPersonalCategoryId(matched.id);
            }}
            categoryOptions={form.tripCategoryOptions}
            canCreateCategory={form.isCurrentUserPayer}
            onCreateCategoryClick={() => form.setIsCreateCategoryOpen(true)}
            payerId={form.effectivePayerId}
            onPayerIdChange={form.setSelectedPayerId}
            payerOptions={members.map((m) => ({ value: m.id, label: m.name + (m.is_host ? " (Você / Organizador)" : "") }))}
            expenseDate={form.expenseDate}
            onExpenseDateChange={form.setExpenseDate}
          />

          {form.isCurrentUserPayer && (
            <TripPersonalSyncPanel
              syncWithPersonal={form.syncWithPersonal}
              onSyncWithPersonalChange={form.setSyncWithPersonal}
              personalCategoryId={form.resolvedPersonalCategoryId}
              onPersonalCategoryIdChange={(val) => {
                if (!val) return;
                form.setSelectedPersonalCategoryId(val);
                const matched = form.allExpenseCategories.find((c) => c.id === val);
                if (matched) form.setSelectedCategoryName(matched.name);
              }}
              personalCategoryOptions={form.allExpenseCategories.map((c) => ({ value: c.id, label: c.name }))}
              onCreateCategoryClick={() => form.setIsCreateCategoryOpen(true)}
              paymentMethod={form.personalPaymentMethod}
              onPaymentMethodChange={form.setPersonalPaymentMethod}
              cardId={form.effectivePersonalCardId}
              onCardIdChange={form.setPersonalCardId}
              availableCards={form.availableCards}
              selectedCard={form.selectedPersonalCard}
              installmentsCount={form.personalInstallmentsCount}
              onInstallmentsCountChange={form.setPersonalInstallmentsCount}
              amountCents={form.amountCents}
              expenseDate={form.expenseDate}
            />
          )}

          <TripSplitParticipantsList
            members={members}
            splitMode={form.splitMode}
            onSplitModeChange={form.setSplitMode}
            selectedMemberIds={form.activeSelectedMemberIds}
            onToggleMember={form.handleToggleMember}
          />
        </form>
      </Modal>

      <CategoryFormDialog
        category={null}
        defaultType="expense"
        open={form.isCreateCategoryOpen}
        onOpenChange={form.setIsCreateCategoryOpen}
        elevated
        onSuccess={(created) => {
          form.setNewlyCreatedCategories((prev) => [...prev, created]);
          form.setSelectedPersonalCategoryId(created.id);
          form.setSelectedCategoryName(created.name);
        }}
      />
    </>
  );
}
