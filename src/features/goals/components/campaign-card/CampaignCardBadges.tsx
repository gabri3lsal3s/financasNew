import { Archive, CheckCircle2, Lock, PieChart, Share2, Sparkles, Wallet } from "lucide-react";
import { Badge } from "@/components/ui";
import type { GoalCompositionConfig } from "@/types";

export interface CampaignCardBadgesProps {
  isArchived: boolean;
  isCompleted: boolean;
  isPersonalPrivate: boolean;
  isPubliclyShared: boolean;
  isLinkPaused: boolean;
  composition?: GoalCompositionConfig;
}

export function CampaignCardBadges({
  isArchived,
  isCompleted,
  isPersonalPrivate,
  isPubliclyShared,
  isLinkPaused,
  composition,
}: CampaignCardBadgesProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
      {isArchived ? (
        <Badge variant="muted" size="xs" className="max-w-full truncate">
          <Archive className="size-3 text-muted-foreground" aria-hidden="true" />
          <span>Arquivada</span>
        </Badge>
      ) : (
        <Badge variant={isCompleted ? "positive" : "portfolio"} size="xs" className="max-w-full truncate">
          {isCompleted ? (
            <>
              <CheckCircle2 className="size-3 text-positive-strong" aria-hidden="true" />
              <span>Concluída</span>
            </>
          ) : (
            <>
              <Sparkles className="size-3 text-portfolio" aria-hidden="true" />
              <span>{isPubliclyShared ? "Em Arrecadação" : "Em Andamento"}</span>
            </>
          )}
        </Badge>
      )}

      {isPersonalPrivate ? (
        <Badge variant="muted" size="xs" className="max-w-full truncate">
          <Lock className="size-3 text-muted-foreground" aria-hidden="true" />
          <span>Privada</span>
        </Badge>
      ) : isLinkPaused ? (
        <Badge variant="warning" size="xs" className="max-w-full truncate">
          <Lock className="size-3 text-warning-strong" aria-hidden="true" />
          <span>Link Desativado</span>
        </Badge>
      ) : (
        <Badge variant="default" size="xs" className="max-w-full truncate">
          <Share2 className="size-3 text-primary-strong" aria-hidden="true" />
          <span>Link Público</span>
        </Badge>
      )}

      {composition?.includeCheckingAccounts ? (
        <Badge variant="muted" size="xs" className="max-w-full truncate">
          <Wallet className="size-3 text-muted-foreground" aria-hidden="true" />
          <span>Conta</span>
        </Badge>
      ) : null}

      {composition?.includeInvestments ? (
        <Badge variant="portfolio" size="xs" className="max-w-full truncate">
          <PieChart className="size-3 text-portfolio" aria-hidden="true" />
          <span>Investimentos</span>
        </Badge>
      ) : null}

      {composition?.allocationCapCents ? (
        <Badge variant="warning" size="xs" className="max-w-full truncate">
          Teto Alocado
        </Badge>
      ) : null}

      {composition?.isCompletedLocked && isCompleted ? (
        <Badge variant="positive" size="xs" className="max-w-full truncate">
          <Lock className="size-2.5" aria-hidden="true" />
          <span>Congelada</span>
        </Badge>
      ) : null}
    </div>
  );
}
