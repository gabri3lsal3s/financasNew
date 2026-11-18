import { useMemo, useState } from "react";
import { getPublicShareUrl } from "@/services/app-url";
import { formatCentsAsBRL } from "@/services/masks";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import {
  useDebts,
  useMyPublicShares,
  useSettleIntegratedReceivable,
  useUpdatePublicShare,
} from "@/state";
import type { PublicShare, SplitSharePayload } from "@/types";
import { buildAndSortActiveSplits, buildSettledSplitSharePayload } from "./active-splits-mappers";
import type {
  ActiveSplitItem,
  GeneratingShareTarget,
  ManagingSplitTarget,
} from "./active-splits-types";

const ITEMS_PER_BLOCK = 2;

export function useActiveSplits(month?: string) {
  const { data: shares, isLoading: isLoadingShares } = useMyPublicShares("split");
  const { data: debts, isLoading: isLoadingDebts } = useDebts();
  const settleMutation = useSettleIntegratedReceivable();
  const updateShareMutation = useUpdatePublicShare();

  const [currentBlock, setCurrentBlock] = useState(0);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [userExpanded, setUserExpanded] = useState<boolean | null>(null);
  const [managingItem, setManagingItem] = useState<ManagingSplitTarget | null>(null);
  const [generatingShareFor, setGeneratingShareFor] = useState<GeneratingShareTarget | null>(null);

  const activeSplits = useMemo(
    () => buildAndSortActiveSplits({ shares, debts, month }),
    [shares, debts, month],
  );

  const handleQuickSettle = async (item: ActiveSplitItem) => {
    const hasInstallments =
      (item.payload.participant_installments && item.payload.participant_installments.length > 1) ||
      (item.payload.installments_count ?? 1) > 1;

    if (hasInstallments && item.share) {
      triggerSensory("selection");
      setManagingItem({ share: item.share, linkedDebt: item.linkedDebt });
      return;
    }

    if (!item.linkedDebt) {
      triggerSensory("warning");
      pushToast({
        title: "Cobrança vinculada não encontrada",
        description: "Você pode registrar a quitação pela página de Contas a Receber.",
        variant: "destructive",
      });
      return;
    }

    try {
      await settleMutation.mutateAsync({ debtId: item.linkedDebt.id, result: item.hostShareCents / 100 });

      // Ao finalizar/arquivar o racha, cancela automaticamente a página pública
      if (item.share) {
        const nextPayload = buildSettledSplitSharePayload(item, new Date().toISOString());
        await updateShareMutation.mutateAsync({
          id: item.share.id,
          payload: nextPayload as unknown as Record<string, unknown>,
          isRevoked: true,
        });
      }

      triggerSensory("success");
      pushToast({
        title: "Racha marcado como recebido!",
        description: "A cobrança foi baixada e sua despesa considera apenas sua cota.",
        variant: "success",
      });
    } catch {
      triggerSensory("destructive");
      pushToast({ title: "Não foi possível dar baixa no racha", variant: "destructive" });
    }
  };

  const handleCopyLink = async (share: PublicShare) => {
    const url = getPublicShareUrl(`r/${share.token}`);
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(url);
        setCopiedToken(share.token);
        triggerSensory("selection");
        pushToast({
          title: "Link do racha copiado!",
          description: "Envie aos amigos para copiar o Pix.",
          variant: "default",
        });
        setTimeout(() => setCopiedToken(null), 2500);
      } catch {
        // Fallback silencioso
      }
    }
  };

  const handleShareWhatsApp = (share: PublicShare, payload: SplitSharePayload) => {
    const url = getPublicShareUrl(`r/${share.token}`);
    const guestFormatted = formatCentsAsBRL(payload.guest_share_cents);
    const cleanTitle = payload.title?.trim() || "Despesa";
    const msg = `Oi! Segue o link para o racha da conta de ${cleanTitle} (${guestFormatted} para cada):\n\n${url}\n\nVocê pode pagar direto copiando o Pix!`;
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    if (typeof window !== "undefined") window.open(waUrl, "_blank", "noopener,noreferrer");
  };

  const totalBlocks = Math.max(1, Math.ceil(activeSplits.length / ITEMS_PER_BLOCK));
  const safeBlock = Math.min(currentBlock, totalBlocks - 1);
  const visibleSplits = activeSplits.slice(safeBlock * ITEMS_PER_BLOCK, (safeBlock + 1) * ITEMS_PER_BLOCK);
  const allFinalized = activeSplits.length > 0 && activeSplits.every((item) => item.isSettled);
  const isExpanded = userExpanded !== null ? userExpanded : !allFinalized;

  return {
    isLoading: isLoadingShares || isLoadingDebts,
    activeSplits,
    visibleSplits,
    totalBlocks,
    safeBlock,
    allFinalized,
    isExpanded,
    copiedToken,
    managingItem,
    generatingShareFor,
    isSettlePending: settleMutation.isPending || updateShareMutation.isPending,
    setCurrentBlock,
    setUserExpanded,
    setManagingItem,
    setGeneratingShareFor,
    handleQuickSettle,
    handleCopyLink,
    handleShareWhatsApp,
  };
}
