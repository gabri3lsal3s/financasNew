import {
  CheckCircle2,
  Copy,
  ExternalLink,
  MessageCircle,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui";
import { getPublicAppUrl } from "@/services/app-url";
import type { PublicShare, SplitSharePayload } from "@/types";
import type { ActiveSplitItem, GeneratingShareTarget, ManagingSplitTarget } from "./active-splits-types";

export interface ActiveSplitItemActionsProps {
  item: ActiveSplitItem;
  isCopied: boolean;
  isSettlePending: boolean;
  onQuickSettle: (item: ActiveSplitItem) => void;
  onManage: (target: ManagingSplitTarget) => void;
  onGenerateShare: (target: GeneratingShareTarget) => void;
  onCopyLink: (share: PublicShare) => void;
  onShareWhatsApp: (share: PublicShare, payload: SplitSharePayload) => void;
}

/** Barra de ações de um card individual de racha com quebra fluida no mobile. */
export function ActiveSplitItemActions({
  item,
  isCopied,
  isSettlePending,
  onQuickSettle,
  onManage,
  onGenerateShare,
  onCopyLink,
  onShareWhatsApp,
}: ActiveSplitItemActionsProps) {
  const isSettled = item.isSettled;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/60">
      {!isSettled ? (
        <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
          <Button
            type="button"
            size="sm"
            variant="default"
            sensoryIntent={false}
            disabled={isSettlePending}
            onClick={() => onQuickSettle(item)}
            className="gap-1.5"
            aria-label="Dar baixa no racha"
          >
            <CheckCircle2 className="size-3.5 text-positive-strong shrink-0" aria-hidden="true" />
            <span>Dar Baixa</span>
          </Button>
          {item.share ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              sensoryIntent="selection"
              onClick={() => onManage({ share: item.share!, linkedDebt: item.linkedDebt })}
              className="gap-1.5"
              title="Gerenciar e dar baixa individual por pessoa"
              aria-label="Gerenciar racha"
            >
              <SlidersHorizontal className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
              <span>Gerenciar</span>
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] text-positive-strong font-medium min-w-0">
            <CheckCircle2 className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">Reembolso recebido</span>
          </div>
          {item.share ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              sensoryIntent="selection"
              onClick={() => onManage({ share: item.share!, linkedDebt: item.linkedDebt })}
              className="text-muted-foreground hover:text-foreground shrink-0"
            >
              Ver detalhes
            </Button>
          ) : null}
        </div>
      )}

      {item.share ? (
        !isSettled && !item.share.is_revoked ? (
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              type="button"
              size="sm"
              variant="outline"
              sensoryIntent={false}
              onClick={() => onCopyLink(item.share!)}
              className="gap-1"
              title="Copiar link do Pix"
              aria-label="Copiar link do racha"
            >
              <Copy className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
              <span className="sr-only sm:not-sr-only">{isCopied ? "Copiado" : "Link"}</span>
            </Button>

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onShareWhatsApp(item.share!, item.payload)}
              className="w-8 px-0"
              title="Enviar cobrança via WhatsApp"
              aria-label="Enviar racha via WhatsApp"
            >
              <MessageCircle className="size-3.5 text-positive-strong shrink-0" aria-hidden="true" />
            </Button>

            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.open(getPublicAppUrl(`r/${item.share!.token}`), "_blank", "noopener,noreferrer");
                }
              }}
              className="w-8 px-0 text-muted-foreground hover:text-foreground"
              title="Abrir página pública"
              aria-label="Abrir página pública do racha"
            >
              <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
            </Button>
          </div>
        ) : null
      ) : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          sensoryIntent="selection"
          onClick={() => onGenerateShare(item)}
          className="gap-1.5 border-portfolio/30 text-portfolio-strong hover:bg-portfolio/10 shrink-0"
          aria-label="Gerar link Pix para cobrança"
        >
          <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
          <span>Gerar Link Pix</span>
        </Button>
      )}
    </div>
  );
}
