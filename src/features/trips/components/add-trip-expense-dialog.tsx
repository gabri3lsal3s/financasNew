/**
 * Modal para adicionar despesas diretamente na página da viagem.
 * Permite divisão igualitária com todo o grupo ou seleção customizada de participantes.
 * Cumpre as regras do AGENTS.md (Regras 4, 7, 8, 15, 18 e 20).
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
  Switch,
} from "@/components/ui";
import { Wallet } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useCategories, useCreditCards, useCreateExpense } from "@/state";
import { useAddTripExpenseMutation } from "@/state/queries/use-trips";
import { calculateEqualSplits } from "@/domain/trips/trip-math";
import type { TripMember } from "@/types/trips";

export interface AddTripExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  members: readonly TripMember[];
  defaultPayerId?: string;
}

const CATEGORY_OPTIONS = [
  { value: "Alimentação", label: "Alimentação" },
  { value: "Transporte", label: "Transporte" },
  { value: "Hospedagem", label: "Hospedagem" },
  { value: "Lazer", label: "Lazer" },
  { value: "Compras", label: "Compras" },
  { value: "Geral", label: "Geral" },
];

export function AddTripExpenseDialog({
  open,
  onOpenChange,
  tripId,
  members,
  defaultPayerId,
}: AddTripExpenseDialogProps) {
  const [amountCents, setAmountCents] = useState<number>(0);
  const [description, setDescription] = useState("");
  const [categoryName, setCategoryName] = useState("Alimentação");
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().split("T")[0] ?? "");
  const [selectedPayerId, setSelectedPayerId] = useState("");
  const [splitMode, setSplitMode] = useState<"all" | "selected">("all");
  const [customMemberIds, setCustomMemberIds] = useState<string[]>([]);
  const [syncWithPersonal, setSyncWithPersonal] = useState(false);
  const [personalPaymentMethod, setPersonalPaymentMethod] = useState<"pix" | "money" | "credit_card" | "debit">("pix");
  const [personalCardId, setPersonalCardId] = useState<string>("");

  const { session } = useAuth();
  const categoriesQuery = useCategories();
  const cardsQuery = useCreditCards();
  const createExpense = useCreateExpense();
  const addExpenseMutation = useAddTripExpenseMutation();

  const host = members.find((m) => m.is_host);
  const effectivePayerId =
    selectedPayerId && members.some((m) => m.id === selectedPayerId)
      ? selectedPayerId
      : defaultPayerId && members.some((m) => m.id === defaultPayerId)
      ? defaultPayerId
      : host?.id || members[0]?.id || "";

  const selectedPayer = members.find((m) => m.id === effectivePayerId);
  const isCurrentUserPayer = Boolean(
    session?.user &&
      (selectedPayer?.user_id === session.user.id || (selectedPayer?.is_host && host?.user_id === session.user.id))
  );

  const activeSelectedMemberIds =
    customMemberIds.length > 0 && customMemberIds.some((id) => members.some((m) => m.id === id))
      ? customMemberIds
      : members.map((m) => m.id);

  const payerOptions = members.map((m) => ({
    value: m.id,
    label: m.name + (m.is_host ? " (Você / Organizador)" : ""),
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
      let linkedPersonalId: string | null = null;

      // Integração opcional: lança no extrato bancário pessoal do usuário
      if (syncWithPersonal && isCurrentUserPayer) {
        try {
          const personalCategory =
            (categoriesQuery.data ?? []).find(
              (c) => c.name.toLowerCase() === categoryName.toLowerCase()
            ) || (categoriesQuery.data ?? [])[0];

          const cardToUse =
            personalPaymentMethod === "credit_card"
              ? personalCardId || (cardsQuery.data?.[0]?.id ?? null)
              : null;

          const createdPersonalExpenseId = await createExpense.mutateAsync({
            value: amountCents / 100,
            date: expenseDate,
            categoryId: personalCategory?.id ?? "",
            paymentMethod: personalPaymentMethod === "credit_card" ? "credit" : personalPaymentMethod,
            cardId: cardToUse,
            description: description.trim(),
            reportWeight: 1,
            installments: [
              {
                date: expenseDate,
                value: amountCents / 100,
                billCompetence: null,
              },
            ],
            isFamily: false,
          });

          if (createdPersonalExpenseId && typeof createdPersonalExpenseId === "string") {
            linkedPersonalId = createdPersonalExpenseId;
            const { updateExpense: updateExpenseRepo } = await import("@/data/repositories/expenses");
            await updateExpenseRepo(createdPersonalExpenseId, { trip_id: tripId });
          }
        } catch {
          // Prossegue com o cadastro na viagem mesmo se a chamada pessoal falhar
        }
      }

      await addExpenseMutation.mutateAsync({
        trip_id: tripId,
        paid_by_member_id: effectivePayerId,
        amount_cents: amountCents,
        description: description.trim(),
        category_name: categoryName,
        expense_date: expenseDate,
        split_type: splitMode === "all" ? "equal" : "custom",
        linked_personal_expense_id: linkedPersonalId,
        splits: calculatedSplits.map((s) => ({
          member_id: s.memberId,
          share_cents: s.shareCents,
        })),
      });

      // Limpeza de campos
      setAmountCents(0);
      setDescription("");
      setSelectedPayerId("");
      setCustomMemberIds([]);
      setSplitMode("all");
      setSyncWithPersonal(false);
      onOpenChange(false);
    } catch {
      // Erro gerenciado no hook useAddTripExpenseMutation
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title="Adicionar Despesa da Viagem"
      description="Lance gastos compartilhados com o grupo para compensação automática e acerto de contas."
      footer={
        <ModalFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={addExpenseMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form="add-trip-expense-form"
            disabled={amountCents <= 0 || !description.trim() || !effectivePayerId || addExpenseMutation.isPending}
            loading={addExpenseMutation.isPending}
          >
            Adicionar Despesa
          </Button>
        </ModalFooter>
      }
    >
      <form id="add-trip-expense-form" onSubmit={handleSubmit} className="space-y-4">
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
              onChange={(val) => setExpenseDate(val ?? new Date().toISOString().split("T")[0] ?? "")}
            />
          </div>
        </div>

        {/* Integração Inteligente com o Extrato Pessoal do Usuário */}
        {isCurrentUserPayer && (
          <div className="p-3.5 rounded-xl border border-border/80 bg-surface-raised space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="size-4 text-primary" aria-hidden="true" />
                <div>
                  <span className="text-xs font-semibold text-foreground block">
                    Lançar no meu extrato bancário
                  </span>
                  <span className="text-[11px] text-muted-foreground block">
                    Registra o desembolso real na sua conta ou fatura do cartão
                  </span>
                </div>
              </div>
              <Switch
                id="sync-personal-expense"
                checked={syncWithPersonal}
                onCheckedChange={setSyncWithPersonal}
                aria-label="Lançar no meu extrato bancário"
              />
            </div>

            {syncWithPersonal && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2.5 border-t border-border/60">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-foreground">
                    Forma de Pagamento
                  </label>
                  <Select
                    value={personalPaymentMethod}
                    onValueChange={(val) => setPersonalPaymentMethod(val as typeof personalPaymentMethod)}
                    options={[
                      { value: "pix", label: "Pix" },
                      { value: "credit_card", label: "Cartão de Crédito" },
                      { value: "debit", label: "Cartão de Débito" },
                      { value: "money", label: "Dinheiro / Espécie" },
                    ]}
                  />
                </div>

                {personalPaymentMethod === "credit_card" && (
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-foreground">
                      Cartão de Crédito
                    </label>
                    <Select
                      value={personalCardId || (cardsQuery.data?.[0]?.id ?? "")}
                      onValueChange={setPersonalCardId}
                      options={(cardsQuery.data ?? []).map((c) => ({
                        value: c.id,
                        label: `${c.name} (${c.brand})`,
                      }))}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

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
