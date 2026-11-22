import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { calculateInstallmentsProgress } from "@/domain/finance/split-math";
import { buildPixTransferCode, type PixKeyType } from "@/domain/pix";
import { useAuth } from "@/hooks/use-auth";
import { useCategories } from "@/state";
import { usePublicShare } from "@/state/queries/use-public-shares";
import type {
  SplitParticipantInstallment,
  SplitParticipantItem,
  SplitSharePayload,
} from "@/types";
import { usePublicSplitActions } from "./use-public-split-actions";
import { usePublicSplitGuestIdentity } from "./use-public-split-guest-identity";

/**
 * Hook de orquestração da página pública de racha (/r/:token).
 * Garante exclusão do anfitrião, cálculo do saldo restante (inclusive parciais) e geração dinâmica de Pix BR Code.
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
  const isHostViewing = Boolean(
    session?.user?.id && share?.user_id && session.user.id === share.user_id,
  );

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

  const guestParticipants = useMemo(
    () => normalizedParticipants.filter((p) => !p.is_host),
    [normalizedParticipants],
  );

  // Limpa identidade obsoleta caso tenha apontado para o anfitrião em versões anteriores
  useEffect(() => {
    if (!guestIdentity.activeParticipantId || normalizedParticipants.length === 0) return;
    const matched = normalizedParticipants.find(
      (p) =>
        p.id === guestIdentity.activeParticipantId ||
        p.name.trim().toLowerCase() === guestIdentity.activeParticipantId?.trim().toLowerCase(),
    );
    if (matched?.is_host || (!matched && guestParticipants.length > 0)) {
      guestIdentity.clearActiveParticipant();
    }
  }, [guestIdentity, normalizedParticipants, guestParticipants.length]);

  const currentParticipant = useMemo(() => {
    if (selectedParticipant && !selectedParticipant.is_host) {
      const refreshed =
        guestParticipants.find(
          (p) => p.id === selectedParticipant.id || p.name === selectedParticipant.name,
        ) ?? selectedParticipant;
      return refreshed;
    }
    if (guestIdentity.activeParticipantId && guestParticipants.length > 0) {
      const matched = guestParticipants.find(
        (p) =>
          p.id === guestIdentity.activeParticipantId ||
          p.name.trim().toLowerCase() === guestIdentity.activeParticipantId?.trim().toLowerCase(),
      );
      if (matched) return matched;
    }
    // Convidado único é auto-selecionado sem atrito; em prévia do anfitrião também pré-seleciona o 1o amigo
    if (guestParticipants.length === 1 || (isHostViewing && guestParticipants.length > 0)) {
      return guestParticipants[0] ?? null;
    }
    return null;
  }, [selectedParticipant, guestIdentity.activeParticipantId, guestParticipants, isHostViewing]);

  const rawInstallments = payload?.participant_installments;
  const participantInstallments: SplitParticipantInstallment[] = useMemo(() => {
    if (!rawInstallments || rawInstallments.length === 0) return [];
    if (currentParticipant?.id) {
      const match = rawInstallments.filter((i) => i.participant_id === currentParticipant.id);
      if (match.length > 0) return match;
    }
    const firstGuest = guestParticipants[0];
    if (firstGuest?.id) {
      const match = rawInstallments.filter((i) => i.participant_id === firstGuest.id);
      if (match.length > 0) return match;
    }
    const hostIds = new Set(normalizedParticipants.filter((p) => p.is_host).map((p) => p.id));
    return rawInstallments.filter((i) => !hostIds.has(i.participant_id));
  }, [rawInstallments, currentParticipant, guestParticipants, normalizedParticipants]);

  const installmentsProgress =
    participantInstallments.length > 1 ? calculateInstallmentsProgress(participantInstallments) : null;

  const selectedInstallment =
    participantInstallments.length > 1
      ? participantInstallments.find((i) => i.id === selectedInstallmentId) ||
        installmentsProgress?.nextPendingInstallment ||
        participantInstallments[0] ||
        null
      : null;

  const participantTotalShareCents = useMemo(() => {
    if (!payload) return 0;
    return (
      currentParticipant?.share_cents ??
      payload.guest_share_cents ??
      (payload.people_count > 0
        ? Math.round(payload.total_cents / payload.people_count)
        : payload.total_cents)
    );
  }, [payload, currentParticipant?.share_cents]);

  const participantSettledCents = useMemo(() => {
    if (participantInstallments.length > 1 && installmentsProgress) {
      return installmentsProgress.settledCents;
    }
    if (!currentParticipant) return 0;
    return Math.max(
      0,
      Number(
        currentParticipant.settled_cents ??
          (currentParticipant.is_settled ? currentParticipant.share_cents : 0),
      ),
    );
  }, [participantInstallments.length, installmentsProgress, currentParticipant]);

  const isCurrentParticipantSettled = useMemo(() => {
    if (!currentParticipant) return false;
    if (participantInstallments.length > 1 && installmentsProgress) {
      return installmentsProgress.pendingCount === 0;
    }
    const remaining = Math.max(0, participantTotalShareCents - participantSettledCents);
    return Boolean(currentParticipant.is_settled || remaining === 0);
  }, [
    currentParticipant,
    participantInstallments.length,
    installmentsProgress,
    participantTotalShareCents,
    participantSettledCents,
  ]);

  const effectiveChargeCents = useMemo(() => {
    if (!payload || isCurrentParticipantSettled) return 0;
    if (participantInstallments.length > 1 && installmentsProgress) {
      if (isPayAllRemaining) return installmentsProgress.remainingCents;
      if (selectedInstallment && !selectedInstallment.is_settled) {
        return selectedInstallment.amount_cents;
      }
      return installmentsProgress.nextPendingInstallment?.amount_cents ?? 0;
    }
    return Math.max(0, participantTotalShareCents - participantSettledCents);
  }, [
    payload,
    isCurrentParticipantSettled,
    participantInstallments.length,
    installmentsProgress,
    isPayAllRemaining,
    selectedInstallment,
    participantTotalShareCents,
    participantSettledCents,
  ]);

  const dynamicPixBrCode = useMemo(() => {
    if (!payload || isCurrentParticipantSettled) return "";
    if (!payload.pix_key) return payload.pix_br_code || "";

    const txSuffix = (token || "RACHA").replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase();
    const instSuffix =
      selectedInstallment && !isPayAllRemaining
        ? `${selectedInstallment.installment_number}/${selectedInstallment.total_installments}`
        : "";
    const txPrefix = selectedInstallment
      ? `RACHA${selectedInstallment.installment_number.toString().padStart(2, "0")}`
      : "RACHA";

    return (
      buildPixTransferCode({
        pixKey: payload.pix_key,
        keyType: payload.pix_key_type as PixKeyType | "auto" | "unknown" | undefined,
        merchantName: payload.host_name || "Anfitriao",
        merchantCity: payload.host_city || "SAO PAULO",
        amountCents: effectiveChargeCents,
        txId: `${txPrefix}${txSuffix}`.slice(0, 25),
        infoAdicional: `${(payload.title || "Racha").slice(0, 15)} ${instSuffix}`.trim(),
        defaultMerchantName: "Anfitriao",
        defaultMerchantCity: "SAO PAULO",
      }) || ""
    );
  }, [
    payload,
    isCurrentParticipantSettled,
    token,
    selectedInstallment,
    isPayAllRemaining,
    effectiveChargeCents,
  ]);

  const actions = usePublicSplitActions({
    token,
    payload,
    categories: categoriesQuery.data ?? [],
    normalizedParticipants,
    currentParticipant,
    selectedParticipant,
    setSelectedParticipant,
    participantInstallments,
    selectedInstallment,
    isPayAllRemaining,
    effectiveChargeCents,
    isHostViewing,
    isCurrentParticipantSettled,
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
        const match = guestParticipants.find((p) => p.id === id || p.name === id) ?? null;
        setSelectedParticipant(match);
        guestIdentity.setActiveParticipantId(id);
      }
    },
    [guestIdentity, guestParticipants],
  );

  return {
    share,
    payload,
    isLoading,
    error,
    isHostViewing,
    categories: categoriesQuery.data ?? [],
    normalizedParticipants,
    guestParticipants,
    currentParticipant,
    participantTotalShareCents,
    participantSettledCents,
    isCurrentParticipantSettled,
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
