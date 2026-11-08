import { useState } from "react";
import {
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Lock,
  PieChart,
  Plus,
  SlidersHorizontal,
  Sparkles,
  Target,
  Users,
  Wallet,
} from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import { getPublicAppUrl } from "@/services/app-url";
import type { GoalCompositionConfig, GoalContribution, PublicShare } from "@/types";

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

  const payload = share.payload ?? {};
  const composition = payload.composition_config as GoalCompositionConfig | undefined;
  const title = (payload.title as string) || "Meta Coletiva";
  const targetCents = Number(payload.target_cents ?? 0);
  const currentCents =
    liveCurrentCents !== undefined ? liveCurrentCents : Number(payload.current_cents ?? 0);
  const percentage = targetCents > 0 ? Math.round((currentCents / targetCents) * 100) : 0;
  const isCompleted = payload.status === "completed" || percentage >= 100;
  const deadline = payload.deadline as string | undefined;
  const contributions: GoalContribution[] = (payload.contributions as GoalContribution[] | undefined) ?? [];
  const showContributionsPublicly = payload.show_contributions_publicly !== false;

  let daysRemaining: number | null = null;
  if (deadline) {
    const targetDate = new Date(deadline);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = targetDate.getTime() - today.getTime();
    daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  }

  const publicUrl = getPublicAppUrl(`meta/${share.token}`);

  const handleCopyLink = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(publicUrl);
      }
      setCopied(true);
      triggerSensory("action");
      pushToast({
        title: "Link do termômetro copiado!",
        description: "Compartilhe no grupo para acompanharem o progresso.",
        variant: "default",
      });
      setTimeout(() => setCopied(false), 2500);
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
      triggerSensory("action");
      window.open(publicUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div
      onClick={() => {
        triggerSensory("action");
        onManageShare(share);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          triggerSensory("action");
          onManageShare(share);
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Gerenciar meta ${title}`}
      className="group flex flex-col gap-3 rounded-2xl border border-border/80 bg-surface/90 p-3.5 sm:p-4 shadow-xs transition-all hover:border-primary/40 hover:bg-surface cursor-pointer min-w-0 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      {/* Cabeçalho do Card */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 min-w-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <Target className="size-4 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="truncate text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                {title}
              </p>
              <Badge
                variant={isCompleted ? "positive" : "portfolio"}
                size="xs"
                className="gap-1"
              >
                {isCompleted ? (
                  <>
                    <CheckCircle2 className="size-3 text-positive-strong" aria-hidden="true" />
                    <span>Concluída</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="size-3 text-portfolio" aria-hidden="true" />
                    <span>Em Arrecadação</span>
                  </>
                )}
              </Badge>
              {share.is_revoked && (
                <Badge variant="warning" size="xs">
                  Link Desativado
                </Badge>
              )}
              {composition?.includeCheckingAccounts && (
                <Badge variant="muted" size="xs" className="gap-1">
                  <Wallet className="size-3 text-primary" aria-hidden="true" />
                  <span>Conta</span>
                </Badge>
              )}
              {composition?.includeInvestments && (
                <Badge variant="portfolio" size="xs" className="gap-1">
                  <PieChart className="size-3 text-portfolio" aria-hidden="true" />
                  <span>Investimentos</span>
                </Badge>
              )}
              {composition?.allocationCapCents && (
                <Badge variant="warning" size="xs">
                  Teto Alocado
                </Badge>
              )}
              {composition?.isCompletedLocked && isCompleted && (
                <Badge variant="positive" size="xs" className="gap-1">
                  <Lock className="size-2.5" aria-hidden="true" />
                  <span>Congelada</span>
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2.5 text-[11px] text-muted-foreground mt-0.5 flex-wrap">
              {deadline && daysRemaining !== null && (
                <span className="flex items-center gap-1">
                  <Clock className="size-3 text-muted-foreground" aria-hidden="true" />
                  <span>
                    {daysRemaining === 0
                      ? "Encerra hoje!"
                      : `${daysRemaining} dia${daysRemaining > 1 ? "s" : ""} restante${daysRemaining > 1 ? "s" : ""}`}
                  </span>
                </span>
              )}

              <span className="flex items-center gap-1" title={showContributionsPublicly ? "Nomes e valores visíveis no link público" : "Lista de doadores visível apenas para você"}>
                {showContributionsPublicly ? (
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
            </div>
          </div>
        </div>

        {/* Botões de Ação */}
        <div
          className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto flex-wrap"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-1 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              triggerSensory("action");
              onOpenDeposit(share);
            }}
          >
            <Plus className="size-3.5" aria-hidden="true" />
            <span>Depósito</span>
          </Button>

          {onOpenComposition && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                triggerSensory("action");
                onOpenComposition(share);
              }}
              title="Configurar Termômetro Patrimonial"
            >
              <SlidersHorizontal className="size-3.5 text-portfolio" aria-hidden="true" />
              <span className="hidden sm:inline">Termômetro</span>
            </Button>
          )}

          {onManageContributions && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                triggerSensory("action");
                onManageContributions(share);
              }}
              title="Gerenciar lista de depósitos e participantes"
            >
              <Users className="size-3.5" aria-hidden="true" />
              <span>Participantes</span>
              {contributions.length > 0 && (
                <Badge variant="muted" size="xs" className="ml-0.5 px-1 py-0">
                  {contributions.length}
                </Badge>
              )}
            </Button>
          )}

          <Button
            type="button"
            size="sm"
            variant={copied ? "default" : "outline"}
            className="h-8 gap-1 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              void handleCopyLink();
            }}
            title="Copiar Link Público do Termômetro"
          >
            {copied ? (
              <Check className="size-3.5" aria-hidden="true" />
            ) : (
              <Copy className="size-3.5" aria-hidden="true" />
            )}
            <span>{copied ? "Copiado" : "Link"}</span>
          </Button>

          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-8 text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenPage();
            }}
            title="Abrir Página Pública Web"
            aria-label={`Abrir página pública da meta ${title}`}
          >
            <ExternalLink className="size-3.5" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {/* Barra de Progresso e Métricas */}
      <div className="flex flex-col gap-2 pt-1">
        <div className="flex items-baseline justify-between gap-2 text-xs">
          <div className="flex items-baseline gap-1.5 min-w-0">
            <span className="text-muted-foreground">Arrecadado:</span>
            <MoneyText
              cents={currentCents}
              tone={isCompleted ? "positive" : "default"}
              className="font-bold text-foreground"
            />
            <span className="text-muted-foreground">de</span>
            <MoneyText
              cents={targetCents}
              tone="default"
              className="font-medium text-muted-foreground"
            />
          </div>
          <span className="text-xs font-semibold tabular-nums text-foreground shrink-0">
            {percentage}%
          </span>
        </div>

        <div className="h-2 w-full overflow-hidden rounded-full bg-muted/70">
          <div
            className={
              isCompleted
                ? "h-full rounded-full transition-all duration-300 bg-positive"
                : "h-full rounded-full transition-all duration-300 bg-portfolio"
            }
            style={{ width: `${Math.min(100, percentage)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
