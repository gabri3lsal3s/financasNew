import { Calendar, HandCoins } from "lucide-react";
import { Badge, MoneyText } from "@/components/ui";
import { formatDateBR } from "@/lib/date";
import type { PublicShare, SplitSharePayload } from "@/types";
import { ActiveSplitItemActions } from "./active-split-item-actions";
import type { ActiveSplitItem, GeneratingShareTarget, ManagingSplitTarget } from "./active-splits-types";

export interface ActiveSplitItemCardProps {
  item: ActiveSplitItem;
  isCopied: boolean;
  isSettlePending: boolean;
  onQuickSettle: (item: ActiveSplitItem) => void;
  onManage: (target: ManagingSplitTarget) => void;
  onGenerateShare: (target: GeneratingShareTarget) => void;
  onCopyLink: (share: PublicShare) => void;
  onShareWhatsApp: (share: PublicShare, payload: SplitSharePayload) => void;
}

function formatShortDate(isoDate: string): string {
  const formatted = formatDateBR(isoDate);
  return formatted.length >= 5 ? formatted.slice(0, 5) : isoDate;
}

/** Card individual de um racha de despesa ativo ou arquivado. */
export function ActiveSplitItemCard({
  item,
  isCopied,
  isSettlePending,
  onQuickSettle,
  onManage,
  onGenerateShare,
  onCopyLink,
  onShareWhatsApp,
}: ActiveSplitItemCardProps) {
  const isSettled = item.isSettled;
  const title = item.payload.title || "Racha de Despesa";

  return (
    <div className="flex flex-col justify-between gap-2.5 rounded-xl border border-border/80 bg-surface p-3.5 shadow-xs min-w-0 h-full flex-1">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 min-w-0">
        <div className="min-w-0 space-y-0.5 flex-1">
          <span
            className="text-xs font-semibold text-foreground line-clamp-2 break-words block"
            title={title}
          >
            {title}
          </span>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            {item.dueDate ? (
              <span className="inline-flex items-center gap-1 text-warning-strong font-medium">
                <Calendar className="size-3 shrink-0" aria-hidden="true" />
                <span>Venc. {formatShortDate(item.dueDate)}</span>
              </span>
            ) : (
              <span>{formatShortDate(item.date)}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
          {item.signaledFriends.length > 0 && !isSettled && (
            <Badge size="xs" variant="warning" className="gap-1 max-w-full truncate">
              <HandCoins className="size-3 shrink-0" aria-hidden="true" />
              <span className="truncate">
                {item.signaledFriends.length === 1
                  ? `${item.signaledFriends[0]!.name} avisou`
                  : `${item.signaledFriends.length} avisos`}
              </span>
            </Badge>
          )}
          {item.needsLinkGeneration || !item.share ? (
            <Badge size="xs" variant="warning" className="shrink-0">
              Link pendente
            </Badge>
          ) : (
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
          )}
        </div>
      </div>

      {/* Faixa de métricas financeiras sem borda redundante (M2) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 rounded-lg bg-surface-raised/70 p-2.5 text-[11px] items-center">
        <div className="min-w-0">
          <span className="text-muted-foreground block text-[11px] leading-tight">
            A receber ({item.guestCount} {item.guestCount === 1 ? "cota" : "cotas"})
          </span>
          <MoneyText
            cents={item.receivableExpectedCents}
            tone="portfolio"
            variant="caption"
            className="text-xs font-semibold"
          />
        </div>
        <div className="min-w-0">
          <span className="text-muted-foreground block text-[11px] leading-tight">
            Total despesa
          </span>
          <MoneyText
            cents={item.totalCents}
            tone="default"
            variant="caption"
            className="text-xs font-medium"
          />
        </div>
        <div className="col-span-2 sm:col-span-1 min-w-0">
          {item.settledFriendsCount > 0 && !isSettled ? (
            <>
              <span className="text-positive-strong block text-[11px] leading-tight">
                Recebido ({item.settledFriendsCount}/{item.guestCount})
              </span>
              <MoneyText
                cents={item.totalSettledFromFriendsCents}
                tone="positive"
                variant="caption"
                className="text-xs font-semibold"
              />
            </>
          ) : (
            <>
              <span className="text-muted-foreground block text-[11px] leading-tight">
                Sua cota
              </span>
              <MoneyText
                cents={item.hostShareCents}
                tone="default"
                variant="caption"
                className="text-xs font-medium"
              />
            </>
          )}
        </div>
      </div>

      <ActiveSplitItemActions
        item={item}
        isCopied={isCopied}
        isSettlePending={isSettlePending}
        onQuickSettle={onQuickSettle}
        onManage={onManage}
        onGenerateShare={onGenerateShare}
        onCopyLink={onCopyLink}
        onShareWhatsApp={onShareWhatsApp}
      />
    </div>
  );
}
