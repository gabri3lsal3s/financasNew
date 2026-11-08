/**
 * Diálogo público para adição de despesas na viagem por convidados sem login.
 * Cumpre a Regra 7 (Zero controles nativos) e Regra 18 (Governança de Modais).
 */

import { useState } from "react";
import {
  Modal,
  ModalFooter,
  Button,
  Input,
  MoneyInput,
  Select,
} from "@/components/ui";
import { useSubmitPublicTripExpenseMutation } from "@/state/queries/use-trips";
import { calculateEqualSplits } from "@/domain/trips/trip-math";
import type { PublicTripMember } from "@/types/trips";

export interface AddPublicTripExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: string;
  members: PublicTripMember[];
  defaultPayerId?: string;
  onSuccess?: () => void;
}

const CATEGORY_OPTIONS = [
  { value: "Alimentação", label: "Alimentação" },
  { value: "Transporte", label: "Transporte" },
  { value: "Hospedagem", label: "Hospedagem" },
  { value: "Lazer", label: "Lazer" },
  { value: "Compras", label: "Compras" },
  { value: "Geral", label: "Geral" },
];

export function AddPublicTripExpenseDialog({
  open,
  onOpenChange,
  token,
  members,
  defaultPayerId,
  onSuccess,
}: AddPublicTripExpenseDialogProps) {
  const [amountCents, setAmountCents] = useState<number>(0);
  const [description, setDescription] = useState("");
  const [categoryName, setCategoryName] = useState("Alimentação");
  const [paidByMemberId, setPaidByMemberId] = useState(
    defaultPayerId || members[0]?.id || ""
  );
  const [splitMode, setSplitMode] = useState<"all" | "selected">("all");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(
    members.map((m) => m.id)
  );

  const submitMutation = useSubmitPublicTripExpenseMutation(token);

  const memberOptions = members.map((m) => ({
    value: m.id,
    label: m.name + (m.is_host ? " (Organizador)" : ""),
  }));

  const handleToggleMember = (memberId: string) => {
    setSelectedMemberIds((prev) => {
      if (prev.includes(memberId)) {
        if (prev.length === 1) return prev; // Não permite zerar
        return prev.filter((id) => id !== memberId);
      }
      return [...prev, memberId];
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amountCents <= 0 || !description.trim() || !paidByMemberId) return;

    const participatingMembers =
      splitMode === "all" ? members.map((m) => m.id) : selectedMemberIds;

    const calculatedSplits = calculateEqualSplits({
      totalAmountCents: amountCents,
      memberIds: participatingMembers,
      payerMemberId: paidByMemberId,
    });

    await submitMutation.mutateAsync({
      token,
      paidByMemberId,
      amountCents,
      description: description.trim(),
      categoryName,
      splitType: splitMode === "all" ? "equal" : "custom",
      splits: calculatedSplits.map((s) => ({
        member_id: s.memberId,
        share_cents: s.shareCents,
      })),
    });

    // Reset
    setAmountCents(0);
    setDescription("");
    onOpenChange(false);
    onSuccess?.();
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title="Adicionar Despesa da Viagem"
      description="Informe o valor e quem pagou para atualizar o balanço do grupo."
      footer={
        <ModalFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form="add-public-expense-form"
            disabled={amountCents <= 0 || !description.trim() || submitMutation.isPending}
            loading={submitMutation.isPending}
          >
            Adicionar Despesa
          </Button>
        </ModalFooter>
      }
    >
      <form id="add-public-expense-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">
            Valor Total
          </label>
          <MoneyInput
            cents={amountCents}
            onCentsChange={(c) => setAmountCents(c)}
            placeholder="R$ 0,00"
            className="text-base sm:text-sm"
            required
          />
        </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Descrição
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex.: Gasolina, Aluguel do barco, Jantar"
              maxLength={120}
              className="text-base sm:text-sm"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Quem pagou?
              </label>
              <Select
                value={paidByMemberId}
                onValueChange={setPaidByMemberId}
                options={memberOptions}
                placeholder="Selecione o pagador"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Categoria
              </label>
              <Select
                value={categoryName}
                onValueChange={setCategoryName}
                options={CATEGORY_OPTIONS}
                placeholder="Selecione a categoria"
              />
            </div>
          </div>

          <div className="space-y-2 pt-1 border-t border-border/80">
            <label className="text-xs font-semibold text-foreground">
              Como será a divisão?
            </label>

            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={splitMode === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setSplitMode("all")}
                className="w-full text-xs"
              >
                Todos igualmente ({members.length})
              </Button>
              <Button
                type="button"
                variant={splitMode === "selected" ? "default" : "outline"}
                size="sm"
                onClick={() => setSplitMode("selected")}
                className="w-full text-xs"
              >
                Apenas alguns ({selectedMemberIds.length})
              </Button>
            </div>

            {splitMode === "selected" && (
              <div className="p-3 rounded-xl bg-surface-raised border border-border/80 space-y-2 mt-2">
                <p className="text-[11px] text-muted-foreground">
                  Selecione quem participou desta despesa:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {members.map((m) => {
                    const isSelected = selectedMemberIds.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => handleToggleMember(m.id)}
                        className={`px-2.5 py-1 text-xs rounded-lg border transition-colors ${
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-surface text-muted-foreground border-border hover:bg-surface-hover"
                        }`}
                      >
                        {m.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </form>
    </Modal>
  );
}
