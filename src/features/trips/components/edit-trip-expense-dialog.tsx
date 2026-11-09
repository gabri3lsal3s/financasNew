/**
 * Modal para edição de despesa existente na viagem.
 * Respeita as regras de governança do AGENTS.md (Regras 4, 7, 8, 15, 18 e 20).
 */

import { useState } from "react";
import { Wallet } from "lucide-react";
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
import { useUpdateTripExpenseMutation } from "@/state/queries/use-trips";
import { calculateEqualSplits, calculateLinkedExpenseWeight } from "@/domain/trips/trip-math";
import { resolveBillCompetence } from "@/domain/competence";
import type { TripMember, TripExpense } from "@/types/trips";

export interface EditTripExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  expense: TripExpense | null;
  members: readonly TripMember[];
}

const CATEGORY_OPTIONS = [
  { value: "Alimentação", label: "Alimentação" },
  { value: "Transporte", label: "Transporte" },
  { value: "Hospedagem", label: "Hospedagem" },
  { value: "Lazer", label: "Lazer" },
  { value: "Compras", label: "Compras" },
  { value: "Geral", label: "Geral" },
];

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
  const initialSplitIds =
    expense.splits && expense.splits.length > 0
      ? expense.splits.map((s) => s.member_id)
      : [];
  const initialIsCustom =
    expense.split_type === "custom" ||
    (initialSplitIds.length > 0 && initialSplitIds.length < members.length);

  const [amountCents, setAmountCents] = useState<number>(expense.amount_cents);
  const [description, setDescription] = useState(expense.description);
  const [categoryName, setCategoryName] = useState(expense.category_name || "Alimentação");
  const [expenseDate, setExpenseDate] = useState(expense.expense_date);
  const [selectedPayerId, setSelectedPayerId] = useState(expense.paid_by_member_id);
  const [splitMode, setSplitMode] = useState<"all" | "selected">(
    initialIsCustom ? "selected" : "all"
  );
  const [customMemberIds, setCustomMemberIds] = useState<string[]>(
    initialSplitIds.length > 0 ? initialSplitIds : members.map((m) => m.id)
  );

  const updateExpenseMutation = useUpdateTripExpenseMutation(tripId);

  const host = members.find((m) => m.is_host);
  const effectivePayerId =
    selectedPayerId && members.some((m) => m.id === selectedPayerId)
      ? selectedPayerId
      : host?.id || members[0]?.id || "";

  const activeSelectedMemberIds =
    customMemberIds.length > 0 && customMemberIds.some((id) => members.some((m) => m.id === id))
      ? customMemberIds
      : members.map((m) => m.id);

  const payerOptions = members.map((m) => ({
    value: m.id,
    label: m.name + (m.is_host ? " (Organizador)" : ""),
  }));

  const handleToggleMember = (memberId: string) => {
    const currentList = activeSelectedMemberIds;
    if (currentList.includes(memberId)) {
      if (currentList.length === 1) return; // Não permite desmarcar todos
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

    try {
      // Sincroniza com o extrato pessoal caso a despesa esteja vinculada
      if (expense.linked_personal_expense_id) {
        try {
          const userSplit = calculatedSplits.find((s) => s.memberId === effectivePayerId);
          const userShareCents = userSplit?.shareCents ?? amountCents;
          const linkedWeight = calculateLinkedExpenseWeight(amountCents, userShareCents);

          const { getExpense, updateExpense: updateExpenseRepo } = await import("@/data/repositories/expenses");
          const personalExp = typeof getExpense === "function"
            ? await Promise.resolve(getExpense(expense.linked_personal_expense_id)).catch(() => null)
            : null;

          let billCompetence = personalExp?.bill_competence;
          if (personalExp && personalExp.payment_method === "credit_card" && personalExp.card_id) {
            const { listCreditCards } = await import("@/data/repositories/credit-cards");
            if (typeof listCreditCards === "function") {
              const cards = await Promise.resolve(listCreditCards()).catch(() => []);
              const card = cards.find((c) => c.id === personalExp.card_id);
              if (card) {
                billCompetence = resolveBillCompetence(
                  new Date(`${expenseDate}T12:00:00`),
                  card.closing_day
                );
              }
            }
          }

          const updatePayload: Record<string, unknown> = {
            value: amountCents / 100,
            description: description.trim(),
            date: expenseDate,
            report_weight: linkedWeight,
          };
          if (billCompetence !== undefined) {
            updatePayload.bill_competence = billCompetence;
          }

          await updateExpenseRepo(expense.linked_personal_expense_id, updatePayload);
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
        splits: calculatedSplits.map((s) => ({
          member_id: s.memberId,
          share_cents: s.shareCents,
        })),
      });

      onOpenChange(false);
    } catch {
      // Erro gerenciado no hook useUpdateTripExpenseMutation
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title="Editar Despesa da Viagem"
      description="Atualize valores, descrição, quem pagou ou a divisão de participantes deste gasto."
      footer={
        <ModalFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={updateExpenseMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form="edit-trip-expense-form"
            disabled={
              amountCents <= 0 ||
              !description.trim() ||
              !effectivePayerId ||
              updateExpenseMutation.isPending
            }
            loading={updateExpenseMutation.isPending}
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
            <span>
              Vinculada ao seu extrato pessoal. As alterações de valor, descrição e data serão sincronizadas automaticamente.
            </span>
          </div>
        ) : null}

        {/* Campo de Valor */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">
            Valor Pago *
          </label>
          <MoneyInput
            cents={amountCents}
            onCentsChange={(cents) => setAmountCents(cents)}
            placeholder="R$ 0,00"
            className="text-base sm:text-sm font-semibold"
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
              placeholder="Ex.: Almoço no centro, Uber, Combustível"
              maxLength={140}
              className="text-base sm:text-sm"
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
              options={payerOptions}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Data do Gasto
            </label>
            <DatePicker
              value={expenseDate}
              onChange={(val) =>
                setExpenseDate(val ?? new Date().toISOString().split("T")[0] ?? "")
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
              Apenas alguns amigos ({activeSelectedMemberIds.length})
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
                      className="flex items-center gap-2 text-xs p-1.5 rounded-lg hover:bg-surface transition-colors cursor-pointer"
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => handleToggleMember(m.id)}
                      />
                      <span className="text-foreground truncate">{m.name}</span>
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

export function EditTripExpenseDialog({
  open,
  onOpenChange,
  tripId,
  expense,
  members,
}: EditTripExpenseDialogProps) {
  if (!expense) return null;

  return (
    <EditTripExpenseForm
      key={expense.id}
      open={open}
      onOpenChange={onOpenChange}
      tripId={tripId}
      expense={expense}
      members={members}
    />
  );
}
