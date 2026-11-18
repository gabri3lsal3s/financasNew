import { useMemo, useState } from "react";
import { Wallet } from "lucide-react";
import { Button, Modal, ModalFooter } from "@/components/ui";
import { useCategories, useSyncLinkedPersonalExpenseMutation } from "@/state";
import { useUpdateTripExpenseMutation } from "@/state/queries/use-trips";
import { calculateEqualSplits, calculateLinkedExpenseWeight } from "@/domain/trips/trip-math";
import { CategoryFormDialog } from "@/features/budgets/components";
import type { Category } from "@/types";
import type { TripExpense, TripMember } from "@/types/trips";
import { buildTripCategoryOptions } from "./trip-expense-category-options";
import { TripExpenseFormFields } from "./trip-expense-form-fields";
import { TripSplitParticipantsList } from "./trip-split-participants-list";

export interface EditTripExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  expense: TripExpense | null;
  members: readonly TripMember[];
}

function EditTripExpenseForm({
  open,
  onOpenChange,
  tripId,
  expense,
  members,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  expense: TripExpense;
  members: readonly TripMember[];
}) {
  const initialSplitIds = expense.splits?.map((s) => s.member_id) ?? [];
  const initialIsCustom =
    expense.split_type === "custom" || (initialSplitIds.length > 0 && initialSplitIds.length < members.length);

  const [amountCents, setAmountCents] = useState<number>(expense.amount_cents);
  const [description, setDescription] = useState(expense.description);
  const [categoryName, setCategoryName] = useState(expense.category_name || "Alimentação");
  const [expenseDate, setExpenseDate] = useState(expense.expense_date);
  const [selectedPayerId, setSelectedPayerId] = useState(expense.paid_by_member_id);
  const [splitMode, setSplitMode] = useState<"all" | "selected">(initialIsCustom ? "selected" : "all");
  const [customMemberIds, setCustomMemberIds] = useState<string[]>(
    initialSplitIds.length > 0 ? initialSplitIds : members.map((m) => m.id),
  );
  const [isCreateCategoryOpen, setIsCreateCategoryOpen] = useState(false);
  const [newlyCreatedCategories, setNewlyCreatedCategories] = useState<Category[]>([]);

  const categoriesQuery = useCategories();
  const updateExpenseMutation = useUpdateTripExpenseMutation(tripId);
  const syncLinkedPersonalMutation = useSyncLinkedPersonalExpenseMutation(tripId);

  const categoryOptions = useMemo(() => {
    const map = new Map<string, Category>();
    for (const cat of categoriesQuery.data ?? []) {
      if (!cat.type || cat.type === "expense") map.set(cat.id, cat);
    }
    for (const cat of newlyCreatedCategories) {
      if (!map.has(cat.id)) map.set(cat.id, cat);
    }
    return buildTripCategoryOptions(Array.from(map.values()), expense.category_name);
  }, [categoriesQuery.data, newlyCreatedCategories, expense.category_name]);

  const host = members.find((m) => m.is_host);
  const effectivePayerId =
    selectedPayerId && members.some((m) => m.id === selectedPayerId) ? selectedPayerId : host?.id || members[0]?.id || "";
  const activeSelectedMemberIds =
    customMemberIds.length > 0 && customMemberIds.some((id) => members.some((m) => m.id === id))
      ? customMemberIds
      : members.map((m) => m.id);

  const handleToggleMember = (memberId: string) => {
    if (activeSelectedMemberIds.includes(memberId)) {
      if (activeSelectedMemberIds.length === 1) return;
      setCustomMemberIds(activeSelectedMemberIds.filter((id) => id !== memberId));
    } else {
      setCustomMemberIds([...activeSelectedMemberIds, memberId]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amountCents <= 0 || !description.trim() || !effectivePayerId) return;

    const participatingMembers = splitMode === "all" ? members.map((m) => m.id) : activeSelectedMemberIds;
    const calculatedSplits = calculateEqualSplits({
      totalAmountCents: amountCents,
      memberIds: participatingMembers,
      payerMemberId: effectivePayerId,
    });

    try {
      if (expense.linked_personal_expense_id) {
        try {
          const userShareCents = calculatedSplits.find((s) => s.memberId === effectivePayerId)?.shareCents ?? amountCents;
          await syncLinkedPersonalMutation.mutateAsync({
            personalExpenseId: expense.linked_personal_expense_id,
            amountCents,
            description: description.trim(),
            expenseDate,
            reportWeight: calculateLinkedExpenseWeight(amountCents, userShareCents),
            tripId,
          });
        } catch {
          // Mantém resiliência da viagem
        }
      }

      await updateExpenseMutation.mutateAsync({
        expense_id: expense.id,
        paid_by_member_id: effectivePayerId,
        amount_cents: amountCents,
        description: description.trim(),
        category_name: categoryName,
        expense_date: expenseDate,
        split_type: splitMode === "all" ? "equal" : "custom",
        splits: calculatedSplits.map((s) => ({ member_id: s.memberId, share_cents: s.shareCents })),
      });
      onOpenChange(false);
    } catch {
      // Erro gerenciado no hook useUpdateTripExpenseMutation
    }
  };

  const isPending = updateExpenseMutation.isPending || syncLinkedPersonalMutation.isPending;

  return (
    <>
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        size="lg"
        showCalculator
        title="Editar Despesa da Viagem"
        description="Atualize valores, descrição, quem pagou ou a divisão de participantes deste gasto."
        footer={
          <ModalFooter borderless>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button
              type="submit"
              form="edit-trip-expense-form"
              disabled={amountCents <= 0 || !description.trim() || !effectivePayerId || isPending}
              loading={isPending}
            >
              Salvar Alterações
            </Button>
          </ModalFooter>
        }
      >
        <form id="edit-trip-expense-form" onSubmit={handleSubmit} className="space-y-4">
          {expense.linked_personal_expense_id ? (
            <div className="flex items-center gap-2 p-2.5 rounded-xl border border-primary/20 bg-primary/5 text-xs text-primary-strong">
              <Wallet className="size-4 shrink-0" aria-hidden="true" />
              <span>Vinculada ao seu extrato pessoal. As alterações de valor, descrição e data serão sincronizadas automaticamente.</span>
            </div>
          ) : null}

          <TripExpenseFormFields
            formId="edit-trip-expense-form"
            amountCents={amountCents}
            onAmountCentsChange={setAmountCents}
            description={description}
            onDescriptionChange={setDescription}
            categoryName={categoryName}
            onCategoryNameChange={(val) => {
              if (val) setCategoryName(val);
            }}
            categoryOptions={categoryOptions}
            canCreateCategory
            onCreateCategoryClick={() => setIsCreateCategoryOpen(true)}
            payerId={effectivePayerId}
            onPayerIdChange={setSelectedPayerId}
            payerOptions={members.map((m) => ({ value: m.id, label: m.name + (m.is_host ? " (Organizador)" : "") }))}
            expenseDate={expenseDate}
            onExpenseDateChange={setExpenseDate}
          />

          <TripSplitParticipantsList
            members={members}
            splitMode={splitMode}
            onSplitModeChange={setSplitMode}
            selectedMemberIds={activeSelectedMemberIds}
            onToggleMember={handleToggleMember}
          />
        </form>
      </Modal>

      <CategoryFormDialog
        category={null}
        defaultType="expense"
        open={isCreateCategoryOpen}
        onOpenChange={setIsCreateCategoryOpen}
        elevated
        onSuccess={(created) => {
          setNewlyCreatedCategories((prev) => [...prev, created]);
          setCategoryName(created.name);
        }}
      />
    </>
  );
}

export function EditTripExpenseDialog({ open, onOpenChange, tripId, expense, members }: EditTripExpenseDialogProps) {
  if (!expense) return null;
  return <EditTripExpenseForm key={expense.id} open={open} onOpenChange={onOpenChange} tripId={tripId} expense={expense} members={members} />;
}
