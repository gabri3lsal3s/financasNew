import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useCategories, useCreateExpense, useCreateIncome } from "@/state";
import {
  useConfirmTripSettlementMutation,
  useRecordSingleTripSettlementMutation,
} from "@/state/queries/use-trips";
import { formatCentsAsBRL } from "@/services/masks/money";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import { getErrorMessage } from "@/services/errors";
import { todayISO } from "@/lib/date";
import type { SuggestedSettlement, TripSettlement } from "@/types/trips";

export function useTripSettlementExtratoSync({
  tripId,
  tripTitle,
  existingSettlements,
}: {
  tripId: string;
  tripTitle: string;
  existingSettlements: TripSettlement[];
}) {
  const [syncedSettlementKeys, setSyncedSettlementKeys] = useState<Set<string>>(new Set());
  const [payingSettlementKey, setPayingSettlementKey] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");

  const { session } = useAuth();
  const categoriesQuery = useCategories();
  const createIncomeMutation = useCreateIncome();
  const createExpenseMutation = useCreateExpense();
  const confirmMutation = useConfirmTripSettlementMutation(tripId);
  const recordSingleMutation = useRecordSingleTripSettlementMutation(tripId);

  const categories = categoriesQuery.data ?? [];
  const defaultCategory =
    categories.find((c) => /viag|lazer|reemb/i.test(c.name)) || categories[0];
  const effectiveCategoryId = selectedCategoryId || defaultCategory?.id || "";

  const handlePayAndSyncExpense = async (settlement: SuggestedSettlement) => {
    if (!session?.user) return;
    const key = `${settlement.fromMemberId}-${settlement.toMemberId}`;
    const todayIso = todayISO();

    try {
      await createExpenseMutation.mutateAsync({
        value: settlement.amountCents / 100,
        date: todayIso,
        categoryId: effectiveCategoryId || categories[0]?.id || "",
        paymentMethod: "pix",
        cardId: null,
        description: `Acerto da viagem ${tripTitle}: pagamento para ${settlement.toMemberName}`,
        reportWeight: 1.0,
        installments: [{ date: todayIso, value: settlement.amountCents / 100, billCompetence: null }],
        isFamily: false,
      });

      const matched = existingSettlements.find(
        (es) => es.from_member_id === settlement.fromMemberId && es.to_member_id === settlement.toMemberId,
      );
      if (matched) {
        if (matched.status !== "confirmed") await confirmMutation.mutateAsync(matched.id);
      } else {
        await recordSingleMutation.mutateAsync({
          fromMemberId: settlement.fromMemberId,
          toMemberId: settlement.toMemberId,
          amountCents: settlement.amountCents,
          status: "confirmed",
        });
      }

      setSyncedSettlementKeys((prev) => new Set([...prev, key]));
      setPayingSettlementKey(null);
      pushToast({
        title: "Acerto pago e registrado no extrato",
        description: `${formatCentsAsBRL(settlement.amountCents)} para ${settlement.toMemberName} lançado no extrato pessoal.`,
      });
    } catch (err) {
      triggerSensory("error");
      pushToast({
        title: "Erro ao registrar acerto no extrato",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    }
  };

  const handleSyncToIncome = async (key: string, amountCents: number, fromName: string) => {
    if (!session?.user) return;
    const cat = categories.find((c) => /reemb|outr|viag/i.test(c.name)) || categories[0];

    try {
      await createIncomeMutation.mutateAsync({
        value: amountCents / 100,
        date: todayISO(),
        description: `Acerto da viagem ${tripTitle}: reembolso de ${fromName}`,
        category_id: cat?.id ?? "",
        receive_type: "pix",
        report_weight: 0,
        source_ref: null,
      });
      setSyncedSettlementKeys((prev) => new Set([...prev, key]));
      triggerSensory("success");
      pushToast({
        title: "Reembolso registrado no extrato",
        description: `${formatCentsAsBRL(amountCents)} recebido de ${fromName} registrado com sucesso.`,
      });
    } catch (err) {
      triggerSensory("error");
      pushToast({
        title: "Erro ao registrar no extrato",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    }
  };

  return {
    session,
    categories,
    effectiveCategoryId,
    setSelectedCategoryId,
    syncedSettlementKeys,
    payingSettlementKey,
    setPayingSettlementKey,
    confirmOrRecordSinglePending: recordSingleMutation.isPending || confirmMutation.isPending,
    createExpensePending: createExpenseMutation.isPending || recordSingleMutation.isPending,
    createIncomePending: createIncomeMutation.isPending,
    confirmMutation,
    recordSingleMutation,
    handlePayAndSyncExpense,
    handleSyncToIncome,
  };
}
