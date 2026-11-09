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
  DatePicker,
  Checkbox,
} from "@/components/ui";
import { useSubmitPublicTripExpenseMutation } from "@/state/queries/use-trips";
import { usePublicTripGuestIdentity } from "../hooks/use-public-trip-guest-identity";
import { calculateEqualSplits } from "@/domain/trips/trip-math";
import type { PublicTripMember } from "@/types/trips";

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
  activeMemberId,
  passcode,
  onSuccess,
}: AddPublicTripExpenseDialogProps) {
  const { activeMemberId: storedActiveMemberId } = usePublicTripGuestIdentity(token);
  const resolvedActiveMemberId = activeMemberId || defaultPayerId || storedActiveMemberId || "";

  const [amountCents, setAmountCents] = useState<number>(0);
  const [description, setDescription] = useState("");
  const [categoryName, setCategoryName] = useState("Alimentação");
  const [expenseDate, setExpenseDate] = useState<string>(
    () => new Date().toISOString().split("T")[0] ?? ""
  );
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
    if (!nextOpen) {
      resetForm();
    }
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

  const memberOptions = members.map((m) => ({
    value: m.id,
    label: m.name + (m.is_host ? " (Organizador)" : ""),
  }));

  const handleToggleMember = (memberId: string) => {
    const currentList = activeSelectedMemberIds;
    if (currentList.includes(memberId)) {
      if (currentList.length === 1) return; // Não permite zerar
      setCustomMemberIds(currentList.filter((id) => id !== memberId));
    } else {
      setCustomMemberIds([...currentList, memberId]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amountCents <= 0 || !description.trim() || !effectivePayerId) return;

    const participatingMembers =
      splitMode === "all" ? members.map((m) => m.id) : activeSelectedMemberIds;

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
      splits: calculatedSplits.map((s) => ({
        member_id: s.memberId,
        share_cents: s.shareCents,
      })),
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
      title="Adicionar Despesa da Viagem"
      description="Informe o valor e quem pagou para atualizar o balanço do grupo em tempo real."
      footer={
        <ModalFooter borderless>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={submitMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form="add-public-expense-form"
            disabled={
              amountCents <= 0 ||
              !description.trim() ||
              !effectivePayerId ||
              submitMutation.isPending
            }
            loading={submitMutation.isPending}
          >
            Adicionar Despesa
          </Button>
        </ModalFooter>
      }
    >
      <form id="add-public-expense-form" onSubmit={handleSubmit} className="space-y-4">
        {/* Campo de Valor */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">
            Valor Pago *
          </label>
          <MoneyInput
            cents={amountCents}
            onCentsChange={(c) => setAmountCents(c)}
            placeholder="R$ 0,00"
            className="text-base sm:text-sm font-semibold"
            aria-label="Valor Pago"
            required
          />
        </div>

        {/* Descrição e Categoria em Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Descrição do Gasto *
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex.: Gasolina, Aluguel do barco, Jantar"
              maxLength={120}
              className="text-base sm:text-sm"
              aria-label="Descrição do Gasto"
              required
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
              ariaLabel="Categoria da despesa"
            />
          </div>
        </div>

        {/* Quem pagou e Data do gasto */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Quem pagou? *
            </label>
            <Select
              value={effectivePayerId}
              onValueChange={setSelectedPayerId}
              options={memberOptions}
              placeholder="Selecione o pagador (Obrigatório)..."
              ariaLabel="Quem pagou"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Data do Gasto
            </label>
            <DatePicker
              value={expenseDate || ""}
              onChange={(val) =>
                setExpenseDate(val || new Date().toISOString().split("T")[0] || "")
              }
            />
          </div>
        </div>

        {/* Modo de Divisão */}
        <div className="space-y-2 pt-2 border-t border-border/80">
          <label className="text-xs font-semibold text-foreground block">
            Como dividir este gasto?
          </label>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setSplitMode("all")}
              className={`p-2.5 rounded-xl text-xs font-medium text-center border transition-all cursor-pointer ${
                splitMode === "all"
                  ? "bg-primary/10 border-primary text-primary"
                  : "bg-surface-raised border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              Todos igualmente ({members.length})
            </button>
            <button
              type="button"
              onClick={() => setSplitMode("selected")}
              className={`p-2.5 rounded-xl text-xs font-medium text-center border transition-all cursor-pointer ${
                splitMode === "selected"
                  ? "bg-primary/10 border-primary text-primary"
                  : "bg-surface-raised border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              Apenas alguns ({activeSelectedMemberIds.length})
            </button>
          </div>

          {splitMode === "selected" && (
            <div className="space-y-2 mt-2 p-3 bg-surface-raised rounded-xl border border-border/80">
              <span className="text-[11px] text-muted-foreground block">
                Selecione quem participou desta despesa:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {members.map((m) => {
                  const isChecked = activeSelectedMemberIds.includes(m.id);
                  return (
                    <label
                      key={m.id}
                      className="flex items-center gap-2 text-xs p-2 rounded-xl bg-surface border border-border/80 hover:bg-surface-hover transition-colors cursor-pointer"
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => handleToggleMember(m.id)}
                      />
                      <span className="text-foreground truncate font-medium">{m.name}</span>
                    </label>
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
