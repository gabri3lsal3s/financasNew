import { Check, Copy, ExternalLink, Plus, SlidersHorizontal, Users } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import type { PublicShare } from "@/types";

export interface CampaignCardActionsProps {
  share: PublicShare;
  title: string;
  isPubliclyShared: boolean;
  contributionsCount: number;
  copied: boolean;
  onOpenDeposit: (share: PublicShare) => void;
  onOpenComposition?: (share: PublicShare) => void;
  onManageContributions?: (share: PublicShare) => void;
  onCopyLink: () => void;
  onOpenPage: () => void;
}

export function CampaignCardActions({
  share,
  title,
  isPubliclyShared,
  contributionsCount,
  copied,
  onOpenDeposit,
  onOpenComposition,
  onManageContributions,
  onCopyLink,
  onOpenPage,
}: CampaignCardActionsProps) {
  const hasSecondaryActions =
    Boolean(onOpenComposition) || Boolean(onManageContributions) || isPubliclyShared;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-border/50">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="max-sm:min-h-11 gap-1.5 text-xs px-3"
        onClick={() => onOpenDeposit(share)}
        title="Registrar depósito"
      >
        <Plus className="size-3.5" aria-hidden="true" />
        <span>Depósito</span>
      </Button>

      {hasSecondaryActions ? (
        <div
          className="inline-flex flex-wrap items-center gap-1 rounded-xl bg-surface-raised/80 p-1"
          role="group"
          aria-label={`Ações secundárias da meta ${title}`}
        >
          {onOpenComposition ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 max-sm:min-h-11 gap-1.5 px-2.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => onOpenComposition(share)}
              title="Configurar Termômetro Patrimonial"
              aria-label={`Configurar termômetro patrimonial da meta ${title}`}
            >
              <SlidersHorizontal className="size-3.5 text-portfolio" aria-hidden="true" />
              <span className="hidden sm:inline">Termômetro</span>
            </Button>
          ) : null}

          {onManageContributions ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 max-sm:min-h-11 gap-1.5 px-2.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => onManageContributions(share)}
              title="Gerenciar lista de depósitos e participantes"
              aria-label={`Gerenciar participantes da meta ${title}`}
            >
              <Users className="size-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Participantes</span>
              {contributionsCount > 0 ? (
                <Badge variant="muted" size="xs" className="ml-0.5 tabular-nums">
                  {contributionsCount}
                </Badge>
              ) : null}
            </Button>
          ) : null}

          {isPubliclyShared ? (
            <>
              <Button
                type="button"
                size="sm"
                variant={copied ? "default" : "ghost"}
                sensoryIntent={false}
                className="h-8 max-sm:min-h-11 gap-1.5 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                onClick={onCopyLink}
                title="Copiar Link Público do Termômetro"
                aria-label={`Copiar link público da meta ${title}`}
              >
                {copied ? (
                  <Check className="size-3.5 text-positive-strong" aria-hidden="true" />
                ) : (
                  <Copy className="size-3.5" aria-hidden="true" />
                )}
                <span className="hidden sm:inline">{copied ? "Copiado" : "Link"}</span>
              </Button>

              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 max-sm:min-h-11 max-sm:min-w-11 text-muted-foreground hover:text-foreground"
                onClick={onOpenPage}
                title="Abrir Página Pública Web"
                aria-label={`Abrir página pública da meta ${title}`}
              >
                <ExternalLink className="size-3.5" aria-hidden="true" />
              </Button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
