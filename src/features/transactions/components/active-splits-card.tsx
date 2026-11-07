import { useMemo, useState } from "react";
import {
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  HandCoins,
  MessageCircle,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoneyText } from "@/components/ui/money-text";
import { ManageSplitDialog } from "@/components/modules/manage-split-dialog";
import { useDebts, useMyPublicShares, useSettleIntegratedReceivable } from "@/state";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import { getPublicAppUrl } from "@/services/app-url";
import type { Debt, PublicShare, SplitSharePayload } from "@/types";

function formatShortDate(isoDate: string): string {
  const parts = isoDate.split("-");
  if (parts.length >= 3) {
    const day = parts[2]!.slice(0, 2);
    return `${day}/${parts[1]}`;
  }
  return isoDate;
}

export interface ActiveSplitsCardProps {
  /** Mês em foco (YYYY-MM) para sincronizar visualização */
  month?: string;
  /** Callback opcional quando o usuário quer abrir o modal de racha completo */
  onOpenSplitDialog?: (share: PublicShare) => void;
}

export function ActiveSplitsCard({ month }: ActiveSplitsCardProps) {
  const { data: shares, isLoading: isLoadingShares } = useMyPublicShares("split");
  const { data: debts, isLoading: isLoadingDebts } = useDebts();
  const settleMutation = useSettleIntegratedReceivable();
  const [currentBlock, setCurrentBlock] = useState(0);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [managingItem, setManagingItem] = useState<{
    share: PublicShare;
    linkedDebt: Debt | null;
  } | null>(null);

  // Mapa de dívidas a receber por expense_id e debt_id
  const receivableDebtsByExpense = useMemo(() => {
    const map = new Map<string, Debt>();
    if (!debts) return map;
    for (const debt of debts) {
      if (debt.type === "receivable" && debt.expense_id) {
        map.set(debt.expense_id, debt);
      }
    }
    return map;
  }, [debts]);

  const debtById = useMemo(() => {
    const map = new Map<string, Debt>();
    if (!debts) return map;
    for (const debt of debts) {
      map.set(debt.id, debt);
    }
    return map;
  }, [debts]);

  // Rachas ativos vinculados a despesas
  const activeSplits = useMemo(() => {
    if (!shares || shares.length === 0) return [];

    return shares
      .map((share) => {
        const payload = (share.payload ?? {}) as unknown as SplitSharePayload;
        const expenseId = payload.expense_id;
        const debtId = payload.debt_id;

        // Tenta achar a dívida vinculada diretamente pelo debt_id ou pelo expense_id
        const linkedDebt =
          (debtId ? debtById.get(debtId) : null) ||
          (expenseId ? receivableDebtsByExpense.get(expenseId) : null) ||
          null;

        const isSettled = Boolean(payload.is_completed) || (linkedDebt ? Boolean(linkedDebt.paid_at) : false);
        const totalCents = Number(payload.total_cents ?? 0);
        const guestShareCents = Number(payload.guest_share_cents ?? 0);
        const hostShareCents = Number(payload.host_share_cents ?? 0);
        const peopleCount = Number(payload.people_count ?? 2);
        const guestCount = Math.max(1, peopleCount - 1);
        const receivableExpectedCents = guestShareCents * guestCount;

        const participants = payload.participants ?? [];
        const friends = participants.filter((p) => !p.is_host);
        const settledFriendsCount = friends.filter((p) => p.is_settled).length;
        const signaledFriends = friends.filter((p) => p.has_payment_signal && !p.is_settled);
        const totalSettledFromFriendsCents = friends.reduce(
          (acc, f) => acc + (f.is_settled ? Number(f.settled_cents ?? f.share_cents) : 0),
          0,
        );

        const dueDate =
          linkedDebt?.due_date ||
          ((payload as Record<string, unknown>)?.due_date as string | undefined) ||
          null;
        const createdAt = share.created_at || payload.date || "";

        return {
          share,
          payload,
          linkedDebt,
          dueDate,
          createdAt,
          isSettled,
          isCompleted: Boolean(payload.is_completed),
          totalCents,
          guestShareCents,
          hostShareCents,
          peopleCount,
          guestCount,
          receivableExpectedCents,
          settledFriendsCount,
          signaledFriends,
          totalSettledFromFriendsCents,
          date: payload.date || share.created_at.slice(0, 10),
        };
      })
      .filter((item) => {
        // Se informado mês, prioriza rachas do mês ou pendentes
        if (month && item.date && !item.date.startsWith(month) && item.isSettled) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        // 1. Data de vencimento estipulada mais próxima primeiro
        if (a.dueDate && b.dueDate) {
          if (a.dueDate !== b.dueDate) {
            return a.dueDate.localeCompare(b.dueDate);
          }
        }
        if (a.dueDate && !b.dueDate) return -1;
        if (!a.dueDate && b.dueDate) return 1;

        // 2. Se não houver data de vencimento estipulada (ou empate): do mais antigo para o mais recente
        return a.createdAt.localeCompare(b.createdAt);
      });
  }, [shares, debtById, receivableDebtsByExpense, month]);

  const ITEMS_PER_BLOCK = 2;
  const totalBlocks = Math.max(1, Math.ceil(activeSplits.length / ITEMS_PER_BLOCK));
  const safeBlock = Math.min(currentBlock, totalBlocks - 1);
  const visibleSplits = activeSplits.slice(
    safeBlock * ITEMS_PER_BLOCK,
    (safeBlock + 1) * ITEMS_PER_BLOCK,
  );

  if (isLoadingShares || isLoadingDebts) {
    return null;
  }

  if (activeSplits.length === 0) {
    return null;
  }

  const handleQuickSettle = async (item: (typeof activeSplits)[0]) => {
    if (!item.linkedDebt) {
      pushToast({
        title: "Cobrança vinculada não encontrada",
        description: "Você pode registrar a quitação pela página de Contas a Receber.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Ao dar baixa, a despesa no relatório conta com a cota pessoal do anfitrião
      const hostResultCents = item.hostShareCents;
      await settleMutation.mutateAsync({
        debtId: item.linkedDebt.id,
        result: hostResultCents / 100,
      });

      triggerSensory("success");
      pushToast({
        title: "Racha marcado como recebido!",
        description: "A cobrança foi baixada e sua despesa considera apenas sua cota.",
        variant: "success",
      });
    } catch {
      triggerSensory("destructive");
      pushToast({
        title: "Não foi possível dar baixa no racha",
        variant: "destructive",
      });
    }
  };

  const handleCopyLink = async (share: PublicShare) => {
    const url = getPublicAppUrl(`r/${share.token}`);
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(url);
        setCopiedToken(share.token);
        triggerSensory("action");
        pushToast({
          title: "Link do racha copiado!",
          description: "Envie aos amigos para copiar o Pix.",
          variant: "default",
        });
        setTimeout(() => setCopiedToken(null), 2500);
      } catch {
        // Fallback
      }
    }
  };

  const handleShareWhatsApp = (share: PublicShare, payload: SplitSharePayload) => {
    const url = getPublicAppUrl(`r/${share.token}`);
    const guestFormatted = (payload.guest_share_cents / 100).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
    const cleanTitle = payload.title?.trim() || "Despesa";
    const msg = `Oi! Segue o link para o racha da conta de ${cleanTitle} (${guestFormatted} para cada): ${url}\nVocê pode pagar direto copiando o Pix!`;
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    if (typeof window !== "undefined") {
      window.open(waUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div
      data-tour="active-splits-card"
      className="flex flex-col gap-2 rounded-2xl border border-border/80 bg-surface p-3 sm:p-3.5 shadow-xs min-w-0"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <Users className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex items-center gap-2">
            <h2 className="text-xs font-semibold text-foreground whitespace-nowrap">
              Rachas de Despesa Ativos
            </h2>
            <Badge variant="muted" size="xs">
              {activeSplits.length} {activeSplits.length === 1 ? "ativo" : "ativos"}
            </Badge>
          </div>
        </div>

        {/* Setas para transitar entre os blocos (2 por vez) */}
        {totalBlocks > 1 && (
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <div className="flex items-center rounded-md border border-border/80 bg-surface-hover/50 px-1 py-0.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Bloco anterior de rachas"
                sensoryIntent="selection"
                disabled={safeBlock === 0}
                onClick={() => {
                  triggerSensory("action");
                  setCurrentBlock((prev) => Math.max(0, prev - 1));
                }}
                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer transition-transform active:scale-95 motion-reduce:transform-none"
              >
                <ChevronLeft className="size-3.5" aria-hidden="true" />
              </Button>
              <span className="text-[11px] font-medium text-muted-foreground tabular-nums px-2 select-none whitespace-nowrap">
                {safeBlock + 1} de {totalBlocks}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Próximo bloco de rachas"
                sensoryIntent="selection"
                disabled={safeBlock >= totalBlocks - 1}
                onClick={() => {
                  triggerSensory("action");
                  setCurrentBlock((prev) => Math.min(totalBlocks - 1, prev + 1));
                }}
                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer transition-transform active:scale-95 motion-reduce:transform-none"
              >
                <ChevronRight className="size-3.5" aria-hidden="true" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3 pt-0.5 items-stretch">
        {visibleSplits.map((item) => {
          const isSettled = item.isSettled;
          const isCopied = copiedToken === item.share.token;

          return (
            <div
              key={item.share.id}
              className="flex flex-col justify-between gap-2.5 rounded-xl border border-border/70 bg-surface/80 p-3 sm:p-3.5 shadow-2xs transition-all hover:border-border min-w-0 h-full flex-1"
            >
              {/* Linha superior: Título e Vencimento/Data à esquerda | Badge à direita */}
              <div className="flex items-start justify-between gap-2 min-w-0 min-h-[38px]">
                <div className="min-w-0 space-y-0.5 flex-1">
                  <span
                    className="text-xs font-semibold text-foreground truncate block"
                    title={item.payload.title || "Racha de Despesa"}
                  >
                    {item.payload.title || "Racha de Despesa"}
                  </span>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    {item.dueDate ? (
                      <span className="inline-flex items-center gap-1 text-warning-strong font-medium">
                        <Calendar className="size-3 shrink-0" aria-hidden="true" />
                        <span>Venc. {formatShortDate(item.dueDate)}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <span>{formatShortDate(item.date)}</span>
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {item.signaledFriends.length > 0 && !isSettled && (
                    <Badge size="xs" variant="warning" className="gap-1 animate-pulse">
                      <HandCoins className="size-3" aria-hidden="true" />
                      <span>
                        {item.signaledFriends.length === 1
                          ? `${item.signaledFriends[0]!.name} avisou`
                          : `${item.signaledFriends.length} avisos`}
                      </span>
                    </Badge>
                  )}
                  <Badge
                    size="xs"
                    variant={isSettled ? "positive" : item.settledFriendsCount > 0 ? "default" : "warning"}
                    className="shrink-0"
                  >
                    {isSettled
                      ? "Quitado"
                      : item.settledFriendsCount > 0
                        ? `Parcial (${item.settledFriendsCount}/${item.guestCount})`
                        : "Pendente"}
                  </Badge>
                </div>
              </div>

              {/* Faixa compacta horizontal de métricas financeiras com altura harmonizada */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-2 rounded-lg bg-surface/60 border border-border/40 text-[11px] min-h-[50px] sm:min-h-[46px] items-center">
                <div>
                  <span className="text-muted-foreground block text-[10px] leading-tight">
                    A receber ({item.guestCount} {item.guestCount === 1 ? "cota" : "cotas"})
                  </span>
                  <MoneyText
                    cents={item.receivableExpectedCents}
                    tone="portfolio"
                    className="text-xs font-semibold tabular-nums"
                  />
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] leading-tight">
                    Total despesa
                  </span>
                  <MoneyText
                    cents={item.totalCents}
                    variant="value"
                    className="text-xs font-medium tabular-nums"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  {item.settledFriendsCount > 0 && !isSettled ? (
                    <>
                      <span className="text-positive-strong block text-[10px] leading-tight">
                        Recebido ({item.settledFriendsCount}/{item.guestCount})
                      </span>
                      <MoneyText
                        cents={item.totalSettledFromFriendsCents}
                        tone="positive"
                        className="text-xs font-semibold tabular-nums"
                      />
                    </>
                  ) : (
                    <>
                      <span className="text-muted-foreground block text-[10px] leading-tight">
                        Sua cota
                      </span>
                      <MoneyText
                        cents={item.hostShareCents}
                        variant="value"
                        className="text-xs tabular-nums"
                      />
                    </>
                  )}
                </div>
              </div>

              {/* Botões de Ação no Card com altura fixa e alinhamento simétrico */}
              <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-border/50 min-h-[36px]">
                {!isSettled ? (
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <Button
                      type="button"
                      size="xs"
                      variant="default"
                      disabled={settleMutation.isPending}
                      onClick={() => void handleQuickSettle(item)}
                      className="gap-1 px-2.5 h-7 text-xs font-medium cursor-pointer"
                      aria-label="Dar baixa no racha"
                    >
                      <CheckCircle2 className="size-3 text-positive-strong shrink-0" aria-hidden="true" />
                      <span>Dar Baixa</span>
                    </Button>
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      onClick={() => setManagingItem({ share: item.share, linkedDebt: item.linkedDebt })}
                      className="gap-1 px-2 h-7 text-xs font-medium cursor-pointer"
                      title="Gerenciar e dar baixa individual por pessoa"
                      aria-label="Gerenciar racha"
                    >
                      <SlidersHorizontal className="size-3 text-muted-foreground shrink-0" aria-hidden="true" />
                      <span>Gerenciar</span>
                    </Button>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-between gap-1 min-w-0 h-7">
                    <div className="flex items-center gap-1 text-[11px] text-positive-strong font-medium truncate">
                      <CheckCircle2 className="size-3.5 shrink-0" aria-hidden="true" />
                      <span className="truncate">Reembolso recebido</span>
                    </div>
                    <Button
                      type="button"
                      size="xs"
                      variant="ghost"
                      onClick={() => setManagingItem({ share: item.share, linkedDebt: item.linkedDebt })}
                      className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
                    >
                      Ver detalhes
                    </Button>
                  </div>
                )}

                <div className="flex items-center gap-1 shrink-0 h-7">
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    onClick={() => void handleCopyLink(item.share)}
                    className="px-2 h-7 cursor-pointer"
                    title="Copiar link do Pix"
                    aria-label="Copiar link do racha"
                  >
                    <Copy className="size-3 text-muted-foreground shrink-0" aria-hidden="true" />
                    <span className="text-[11px] sr-only sm:not-sr-only">{isCopied ? "Copiado" : "Link"}</span>
                  </Button>

                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    onClick={() => handleShareWhatsApp(item.share, item.payload)}
                    className="px-2 h-7 cursor-pointer"
                    title="Enviar cobrança via WhatsApp"
                    aria-label="Enviar racha via WhatsApp"
                  >
                    <MessageCircle className="size-3 text-positive-strong shrink-0" aria-hidden="true" />
                  </Button>

                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    onClick={() => {
                      if (typeof window !== "undefined") {
                        window.open(getPublicAppUrl(`r/${item.share.token}`), "_blank", "noopener,noreferrer");
                      }
                    }}
                    className="px-1.5 h-7 text-muted-foreground hover:text-foreground cursor-pointer"
                    title="Abrir página pública"
                    aria-label="Abrir página pública do racha"
                  >
                    <ExternalLink className="size-3 shrink-0" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {managingItem && (
        <ManageSplitDialog
          open={Boolean(managingItem)}
          onOpenChange={(open) => {
            if (!open) setManagingItem(null);
          }}
          share={managingItem.share}
          linkedDebt={managingItem.linkedDebt}
        />
      )}
    </div>
  );
}
