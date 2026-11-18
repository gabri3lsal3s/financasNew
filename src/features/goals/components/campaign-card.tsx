import { useEffect, useRef, useState } from "react";
import { Clock, Eye, EyeOff, Target } from "lucide-react";
import { Progress } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { getPublicAppUrl } from "@/services/app-url";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import type { PublicShare } from "@/types";
import { CampaignCardActions } from "./campaign-card/CampaignCardActions";
import { CampaignCardBadges } from "./campaign-card/CampaignCardBadges";
import { parseCampaignMetrics } from "./campaign-card/campaign-card-utils";

export interface CampaignCardProps {
  share: PublicShare;
  liveCurrentCents?: number;
  onOpenDeposit: (share: PublicShare) => void;
  onManageShare: (share: PublicShare) => void;
  onEditShare?: (share: PublicShare) => void;
  onDeleteShare?: (share: PublicShare) => void;
  onManageContributions?: (share: PublicShare) => void;
  onOpenComposition?: (share: PublicShare) => void;
}

export function CampaignCard({
  share,
  liveCurrentCents,
  onOpenDeposit,
  onManageShare,
  onManageContributions,
  onOpenComposition,
}: CampaignCardProps) {
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const metrics = parseCampaignMetrics(share, liveCurrentCents);
  const publicUrl = getPublicAppUrl(`meta/${share.token}`);

  const handleOpenManage = () => {
    triggerSensory("action");
    onManageShare(share);
  };

  const handleCopyLink = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(publicUrl);
      }
      setCopied(true);
      triggerSensory("success");
      pushToast({
        title: "Link do termômetro copiado!",
        description: "Compartilhe no grupo para acompanharem o progresso.",
        variant: "default",
      });
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 2500);
    } catch {
      triggerSensory("destructive");
      pushToast({
        title: "Não foi possível copiar o link",
        variant: "destructive",
      });
    }
  };

  const handleOpenPage = () => {
    if (typeof window !== "undefined") {
      window.open(publicUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-surface p-3.5 sm:p-4 shadow-xs min-w-0">
      <div
        role="button"
        tabIndex={0}
        aria-label={`Gerenciar meta ${metrics.title}`}
        onClick={handleOpenManage}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleOpenManage();
          }
        }}
        className="group flex flex-col gap-3 rounded-xl p-1 -m-1 cursor-pointer transition-colors hover:bg-surface-hover/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-w-0"
      >
        <div className="flex items-start gap-2.5 min-w-0">
          <Target className="size-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex flex-col gap-1.5 min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground line-clamp-2 break-words group-hover:text-primary-strong transition-colors">
              {metrics.title}
            </p>

            <CampaignCardBadges
              isArchived={metrics.isArchived}
              isCompleted={metrics.isCompleted}
              isPersonalPrivate={metrics.isPersonalPrivate}
              isPubliclyShared={metrics.isPubliclyShared}
              isLinkPaused={metrics.isLinkPaused}
              composition={metrics.composition}
            />

            {(metrics.deadline && metrics.daysRemaining !== null) || !metrics.isPersonalPrivate ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                {metrics.deadline && metrics.daysRemaining !== null ? (
                  <span className="flex items-center gap-1">
                    <Clock className="size-3 text-muted-foreground" aria-hidden="true" />
                    <span>
                      {metrics.daysRemaining === 0
                        ? "Encerra hoje!"
                        : `${metrics.daysRemaining} dia${metrics.daysRemaining > 1 ? "s" : ""} restante${metrics.daysRemaining > 1 ? "s" : ""}`}
                    </span>
                  </span>
                ) : null}

                {!metrics.isPersonalPrivate ? (
                  <span
                    className="flex items-center gap-1"
                    title={
                      metrics.showContributionsPublicly
                        ? "Nomes e valores visíveis no link público"
                        : "Lista de doadores visível apenas para você"
                    }
                  >
                    {metrics.showContributionsPublicly ? (
                      <>
                        <Eye className="size-3 text-positive-strong" aria-hidden="true" />
                        <span>Transparência aberta</span>
                      </>
                    ) : (
                      <>
                        <EyeOff className="size-3 text-muted-foreground" aria-hidden="true" />
                        <span>Doações restritas</span>
                      </>
                    )}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-1 min-w-0">
          <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1 text-xs min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 min-w-0">
              <span className="text-muted-foreground shrink-0">Arrecadado:</span>
              <MoneyText
                cents={metrics.currentCents}
                tone={metrics.isCompleted ? "positive" : "default"}
                className="font-bold text-foreground"
              />
              <span className="text-muted-foreground shrink-0">de</span>
              <MoneyText
                cents={metrics.targetCents}
                tone="default"
                className="font-medium text-muted-foreground"
              />
            </div>
            <span className="num text-xs font-semibold tabular-nums text-foreground shrink-0 ml-auto">
              {metrics.percentage}%
            </span>
          </div>

          <Progress
            value={Math.min(100, metrics.percentage)}
            tone={metrics.isCompleted ? "positive" : "portfolio"}
            size="md"
            aria-label={`Progresso de ${metrics.title}: ${metrics.percentage}%`}
          />
        </div>
      </div>

      <CampaignCardActions
        share={share}
        title={metrics.title}
        isPubliclyShared={metrics.isPubliclyShared}
        contributionsCount={metrics.contributions.length}
        copied={copied}
        onOpenDeposit={onOpenDeposit}
        onOpenComposition={onOpenComposition}
        onManageContributions={onManageContributions}
        onCopyLink={() => {
          void handleCopyLink();
        }}
        onOpenPage={handleOpenPage}
      />
    </article>
  );
}
