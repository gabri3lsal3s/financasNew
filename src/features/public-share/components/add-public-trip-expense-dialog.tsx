import { useState } from "react";
import { Button, Modal, ModalFooter } from "@/components/ui";
import { useSubmitPublicTripExpenseMutation } from "@/state/queries/use-trips";
import { usePublicTripGuestIdentity } from "../hooks/use-public-trip-guest-identity";
import { calculateEqualSplits } from "@/domain/trips/trip-math";
import { todayISO } from "@/lib/date";
import type { PublicTripMember } from "@/types/trips";
import { DEFAULT_TRIP_CATEGORY_OPTIONS } from "@/features/trips/components/trip-expense-category-options";
import { TripExpenseFormFields } from "@/features/trips/components/trip-expense-form-fields";
import { TripSplitParticipantsList } from "@/features/trips/components/trip-split-participants-list";

export interface AddPublicTripExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: string;
  members: PublicTripMember[];
  defaultPayerId?: string;
  activeMemberId?: string;
  passcode?: string | null;
  onSuccess?: () => void;
}

export function AddPublicTripExpenseDialog({
  open,
  onOpenChange,
  token,
  members,
  defaultPayerId,
  activeMemberId,
  passcode,
  onSuccess,
}: AddPublicTripExpenseDialogProps) {
  const { activeMemberId: storedActiveMemberId } = usePublicTripGuestIdentity(token);
  const resolvedActiveMemberId = activeMemberId || defaultPayerId || storedActiveMemberId || "";

  const [amountCents, setAmountCents] = useState<number>(0);
  const [description, setDescription] = useState("");
  const [categoryName, setCategoryName] = useState("Alimentação");
  const [expenseDate, setExpenseDate] = useState<string>(() => todayISO());
  const [selectedPayerId, setSelectedPayerId] = useState<string>("");
  const [splitMode, setSplitMode] = useState<"all" | "selected">("all");
  const [customMemberIds, setCustomMemberIds] = useState<string[]>([]);

  const resetForm = () => {
    setAmountCents(0);
    setDescription("");
    setSelectedPayerId("");
    setCustomMemberIds([]);
    setSplitMode("all");
    setCategoryName("Alimentação");
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) resetForm();
    onOpenChange(nextOpen);
  };

  const effectivePayerId =
    selectedPayerId && members.some((m) => m.id === selectedPayerId)
      ? selectedPayerId
      : resolvedActiveMemberId && members.some((m) => m.id === resolvedActiveMemberId)
        ? resolvedActiveMemberId
        : "";

  const activeSelectedMemberIds =
    customMemberIds.length > 0 && customMemberIds.some((id) => members.some((m) => m.id === id))
      ? customMemberIds
      : members.map((m) => m.id);

  const submitMutation = useSubmitPublicTripExpenseMutation(token);

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

    await submitMutation.mutateAsync({
      token,
      paidByMemberId: effectivePayerId,
      amountCents,
      description: description.trim(),
      categoryName,
      expenseDate,
      splitType: splitMode === "all" ? "equal" : "custom",
      splits: calculatedSplits.map((s) => ({ member_id: s.memberId, share_cents: s.shareCents })),
      passcode: passcode ?? null,
    });

    resetForm();
    onOpenChange(false);
    onSuccess?.();
  };

  return (
    <Modal
      open={open}
      onOpenChange={handleOpenChange}
      size="lg"
      showCalculator
      title="Adicionar Despesa da Viagem"
      description="Informe o valor e quem pagou para atualizar o balanço do grupo em tempo real."
      footer={
        <ModalFooter borderless>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={submitMutation.isPending}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="add-public-expense-form"
            disabled={amountCents <= 0 || !description.trim() || !effectivePayerId || submitMutation.isPending}
            loading={submitMutation.isPending}
          >
            Adicionar Despesa
          </Button>
        </ModalFooter>
      }
    >
      <form id="add-public-expense-form" onSubmit={handleSubmit} className="space-y-4">
        <TripExpenseFormFields
          formId="add-public-expense-form"
          amountCents={amountCents}
          onAmountCentsChange={setAmountCents}
          description={description}
          onDescriptionChange={setDescription}
          descriptionPlaceholder="Ex.: Gasolina, Aluguel do barco, Jantar"
          descriptionMaxLength={120}
          categoryName={categoryName}
          onCategoryNameChange={setCategoryName}
          categoryOptions={DEFAULT_TRIP_CATEGORY_OPTIONS}
          payerId={effectivePayerId}
          onPayerIdChange={setSelectedPayerId}
          payerOptions={members.map((m) => ({ value: m.id, label: m.name + (m.is_host ? " (Organizador)" : "") }))}
          payerPlaceholder="Selecione o pagador (Obrigatório)..."
          expenseDate={expenseDate}
          onExpenseDateChange={setExpenseDate}
        />

        <TripSplitParticipantsList
          members={members}
          splitMode={splitMode}
          onSplitModeChange={setSplitMode}
          selectedMemberIds={activeSelectedMemberIds}
          onToggleMember={handleToggleMember}
          selectedModeLabel="Apenas alguns"
        />
      </form>
    </Modal>
  );
}
