import { useState } from "react";
import {
  useRecordTripSettlementsMutation,
  useReopenTripSettlementMutation,
  useUpdateTripMutation,
} from "@/state/queries/use-trips";
import { buildTripSettlementWhatsAppMessage } from "@/domain/trips";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import type { SuggestedSettlement, TripExpense, TripMember, TripSettlement } from "@/types/trips";
import { useTripSettlementExtratoSync } from "./use-trip-settlement-extrato-sync";

export interface UseTripSettlementActionsParams {
  tripId: string;
  tripTitle: string;
  publicToken?: string;
  suggestedSettlements: readonly SuggestedSettlement[];
  existingSettlements: TripSettlement[];
  members?: TripMember[];
  expenses?: TripExpense[];
}

export function useTripSettlementActions({
  tripId,
  tripTitle,
  publicToken,
  suggestedSettlements,
  existingSettlements,
  members,
  expenses,
}: UseTripSettlementActionsParams) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [copiedCodeKey, setCopiedCodeKey] = useState<string | null>(null);
  const [qrCodeOpenKey, setQrCodeOpenKey] = useState<string | null>(null);

  const sync = useTripSettlementExtratoSync({ tripId, tripTitle, existingSettlements });
  const currentUserId = sync.session?.user?.id;
  const currentMember = members?.find((m) => m.user_id && m.user_id === currentUserId);

  const recordMutation = useRecordTripSettlementsMutation(tripId);
  const reopenMutation = useReopenTripSettlementMutation(tripId);
  const updateTripMutation = useUpdateTripMutation();

  const handleCopyPixBrCode = async (code: string, keyIdentifier: string) => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
        setCopiedCodeKey(keyIdentifier);
        triggerSensory("action");
        pushToast({
          title: "Pix Copia e Cola com valor copiado!",
          description: "Abra o aplicativo do seu banco para colar e pagar o valor exato.",
        });
        setTimeout(() => setCopiedCodeKey(null), 3000);
      }
    } catch {
      triggerSensory("error");
      pushToast({ title: "Erro ao copiar código Pix", description: "Selecione e copie manualmente.", variant: "destructive" });
    }
  };

  const handleCopyRawPixKey = async (pixKey: string) => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(pixKey);
        setCopiedKey(pixKey);
        triggerSensory("action");
        pushToast({ title: "Chave Pix copiada", description: "Cole no seu aplicativo bancário para efetuar a transferência." });
        setTimeout(() => setCopiedKey(null), 3000);
      }
    } catch {
      triggerSensory("error");
      pushToast({ title: "Erro ao copiar chave", variant: "destructive" });
    }
  };

  const handleMarkSingleSettled = async (settlement: SuggestedSettlement) => {
    const matched = existingSettlements.find(
      (es) => es.from_member_id === settlement.fromMemberId && es.to_member_id === settlement.toMemberId,
    );
    try {
      if (matched) {
        await sync.confirmMutation.mutateAsync(matched.id);
      } else {
        await sync.recordSingleMutation.mutateAsync({
          fromMemberId: settlement.fromMemberId,
          toMemberId: settlement.toMemberId,
          amountCents: settlement.amountCents,
          status: "confirmed",
        });
      }
    } catch {
      // Erro gerenciado na mutation
    }
  };

  const handleReopenSingleSettlement = async (settlementId: string) => {
    try {
      await reopenMutation.mutateAsync(settlementId);
    } catch {
      // Erro gerenciado na mutation
    }
  };

  const handleFinalizeTrip = async () => {
    try {
      await updateTripMutation.mutateAsync({ tripId, input: { status: "completed" } });
    } catch {
      // Erro gerenciado na mutation
    }
  };

  const handleReopenTrip = async () => {
    try {
      await updateTripMutation.mutateAsync({ tripId, input: { status: "active" } });
    } catch {
      // Erro gerenciado na mutation
    }
  };

  const handleRecordAll = async () => {
    const payload = suggestedSettlements.map((s) => ({
      from_member_id: s.fromMemberId,
      to_member_id: s.toMemberId,
      amount_cents: s.amountCents,
    }));
    try {
      await recordMutation.mutateAsync(payload);
    } catch {
      // Erro gerenciado na mutation
    }
  };

  const handleShareWhatsApp = () => {
    const msg = buildTripSettlementWhatsAppMessage({
      tripTitle,
      suggestedSettlements,
      existingSettlements,
      members,
      expenses,
      publicToken,
    });
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, "_blank", "noopener,noreferrer");
  };

  return {
    ...sync,
    currentMember,
    copiedKey,
    copiedCodeKey,
    qrCodeOpenKey,
    setQrCodeOpenKey,
    recordMutationPending: recordMutation.isPending,
    reopenMutationPending: reopenMutation.isPending,
    updateTripMutationPending: updateTripMutation.isPending,
    handleCopyPixBrCode,
    handleCopyRawPixKey,
    handleMarkSingleSettled,
    handleReopenSingleSettlement,
    handleFinalizeTrip,
    handleReopenTrip,
    handleRecordAll,
    handleShareWhatsApp,
  };
}
