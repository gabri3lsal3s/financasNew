import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { buildPixTransferCode } from "@/domain/pix";
import { calculateInstallmentsProgress } from "@/domain/finance/split-math";
import { useAuth } from "@/hooks/use-auth";
import { useCategories } from "@/state";
import { usePublicShare } from "@/state/queries/use-public-shares";
import type {
  SplitParticipantInstallment,
  SplitParticipantItem,
  SplitSharePayload,
} from "@/types";
import { usePublicSplitGuestIdentity } from "./use-public-split-guest-identity";
import { usePublicSplitActions } from "./use-public-split-actions";

/**
 * Hook de orquestração da página pública de racha (/r/:token).
 */
export function usePublicSplitPage(token: string, rawToken?: string) {
  const [searchParams] = useSearchParams();
  const { session } = useAuth();
  const { data: share, isLoading, error } = usePublicShare(token);
  const categoriesQuery = useCategories("expense", { enabled: Boolean(session?.user) });
  const guestIdentity = usePublicSplitGuestIdentity(token);

  const [selectedParticipant, setSelectedParticipant] = useState<SplitParticipantItem | null>(null);
  const [selectedInstallmentId, setSelectedInstallmentId] = useState<string | null>(null);
  const [isPayAllRemaining, setIsPayAllRemaining] = useState(false);

  const payload = (share?.payload ?? null) as SplitSharePayload | null;

  useEffect(() => {
    if (rawToken && token && rawToken !== token && typeof window !== "undefined") {
      window.history.replaceState(null, "", `/r/${token}${window.location.search}`);
    }
  }, [rawToken, token]);

  useEffect(() => {
    document.title = payload?.title
      ? `${payload.title} — Racha de Despesas | Axir`
      : "Racha de Despesa — Axir";
  }, [payload?.title]);

  const rawParticipants = payload?.participants;
  const normalizedParticipants: SplitParticipantItem[] = useMemo(() => {
    if (!rawParticipants) return [];
    return rawParticipants.map((p, idx) => ({ ...p, id: p.id || `p_${idx + 1}` }));
  }, [rawParticipants]);

  const currentParticipant = useMemo(() => {
    if (selectedParticipant) return selectedParticipant;
    if (guestIdentity.activeParticipantId && normalizedParticipants.length > 0) {
      return (
        normalizedParticipants.find(
          (p) =>
            p.id === guestIdentity.activeParticipantId ||
            p.name.trim().toLowerCase() === guestIdentity.activeParticipantId?.trim().toLowerCase(),
        ) ?? null
      );
    }
    return null;
  }, [selectedParticipant, guestIdentity.activeParticipantId, normalizedParticipants]);

  const rawInstallments = payload?.participant_installments;
  const participantInstallments: SplitParticipantInstallment[] = useMemo(() => {
    if (!rawInstallments || rawInstallments.length === 0) return [];
    if (currentParticipant?.id) {
      const match = rawInstallments.filter((i) => i.participant_id === currentParticipant.id);
      if (match.length > 0) return match;
    }
    const firstGuest = normalizedParticipants.find((p) => !p.is_host);
    if (firstGuest?.id) {
      const match = rawInstallments.filter((i) => i.participant_id === firstGuest.id);
      if (match.length > 0) return match;
    }
    return rawInstallments;
  }, [rawInstallments, currentParticipant, normalizedParticipants]);

  const installmentsProgress =
    participantInstallments.length > 1 ? calculateInstallmentsProgress(participantInstallments) : null;

  const selectedInstallment =
    participantInstallments.length > 1
      ? participantInstallments.find((i) => i.id === selectedInstallmentId) ||
        installmentsProgress?.nextPendingInstallment ||
        participantInstallments[0] ||
        null
      : null;

  const effectiveChargeCents = useMemo(() => {
    if (!payload) return 0;
    const guestShareCents =
      currentParticipant?.share_cents ??
      payload.guest_share_cents ??
      (payload.people_count > 0
        ? Math.round(payload.total_cents / payload.people_count)
        : payload.total_cents);

    if (participantInstallments.length > 1 && installmentsProgress) {
      if (isPayAllRemaining) return installmentsProgress.remainingCents;
      if (selectedInstallment) return selectedInstallment.amount_cents;
    }
    return guestShareCents;
  }, [
    payload,
    currentParticipant?.share_cents,
    participantInstallments.length,
    installmentsProgress,
    isPayAllRemaining,
    selectedInstallment,
  ]);

  const dynamicPixBrCode = useMemo(() => {
    if (!payload || !payload.pix_key) return payload?.pix_br_code || "";
    if (participantInstallments.length <= 1) return payload.pix_br_code;

    const txSuffix = (token || "RACHA").replace(/[^a-zA-Z0-9]/g, "").slice(0, 4).toUpperCase();
    const instSuffix =
      selectedInstallment && !isPayAllRemaining
        ? `${selectedInstallment.installment_number}/${selectedInstallment.total_installments}`
        : "";
    return (
      buildPixTransferCode({
        pixKey: payload.pix_key,
        merchantName: payload.host_name || "Anfitriao",
        merchantCity: payload.host_city || "SAO PAULO",
        amountCents: effectiveChargeCents,
        txId: `RACHA${(selectedInstallment?.installment_number ?? 1).toString().padStart(2, "0")}${txSuffix}`,
        infoAdicional: `${(payload.title || "Racha").slice(0, 15)} ${instSuffix}`.trim(),
        defaultMerchantName: "Anfitriao",
        defaultMerchantCity: "SAO PAULO",
      }) || payload.pix_br_code
    );
  }, [payload, participantInstallments.length, token, selectedInstallment, isPayAllRemaining, effectiveChargeCents]);

  const actions = usePublicSplitActions({
    token,
    payload,
    categories: categoriesQuery.data ?? [],
    normalizedParticipants,
    currentParticipant,
    selectedParticipant,
    setSelectedParticipant,
    selectedInstallment,
    effectiveChargeCents,
    guestIdentity,
  });

  const hasTriggeredActionRef = useRef(false);
  const { handleSaveExpenseClick } = actions;
  useEffect(() => {
    const action = searchParams.get("action");
    if (action === "save" && payload && !isLoading && !hasTriggeredActionRef.current) {
      hasTriggeredActionRef.current = true;
      const timer = setTimeout(() => void handleSaveExpenseClick(), 0);
      return () => clearTimeout(timer);
    }
  }, [searchParams, payload, isLoading, handleSaveExpenseClick]);

  const selectParticipantFromBanner = useCallback(
    (id: string | null) => {
      if (!id) {
        setSelectedParticipant(null);
        guestIdentity.clearActiveParticipant();
      } else {
        const match = normalizedParticipants.find((p) => p.id === id || p.name === id) ?? null;
        setSelectedParticipant(match);
        guestIdentity.setActiveParticipantId(id);
      }
    },
    [guestIdentity, normalizedParticipants],
  );

  return {
    share,
    payload,
    isLoading,
    error,
    categories: categoriesQuery.data ?? [],
    normalizedParticipants,
    currentParticipant,
    participantInstallments,
    selectedInstallment,
    effectiveChargeCents,
    dynamicPixBrCode,
    isPayAllRemaining,
    setIsPayAllRemaining,
    setSelectedInstallmentId,
    selectParticipantFromBanner,
    ...actions,
  };
}
