import { useState } from "react";
import { Edit3, Lock, PieChart, Share2, Wallet } from "lucide-react";
import { Badge, Button, Progress } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { CategoryIcon } from "@/components/modules/category-icon";
import { HighlightRow } from "@/components/modules/highlight-row";
import { INCOME_GOAL_LABELS, type IncomeGoalStatus } from "@/domain/budgets";
import { triggerSensory } from "@/services/sensory";
import type { Category, GoalCompositionConfig, PublicShare } from "@/types";

export interface GoalCardProps {
  category: Category;
  month: string;
  realizedCents: number;
  expectedCents: number;
  status: IncomeGoalStatus;
  percent: number;
  highlightId?: string | null;
  activeShare?: PublicShare | null;
  onOpenGoal: (category: Category) => void;
  onEditCategory?: (category: Category) => void;
  onShareGoal: (category: Category) => void;
}

/**
 * Card executivo de Meta no módulo de Orçamentos & Metas (Opção C unificada).
 * Permite edição rápida da meta, customização da categoria e compartilhamento
 * público do termômetro coletivo com chave Pix BACEN.
 */
export function GoalCard({
  category,
  realizedCents,
  expectedCents,
  status,
  percent,
  highlightId,
  activeShare,
  onOpenGoal,
  onEditCategory,
  onShareGoal,
}: GoalCardProps) {
  const [nowMs] = useState(() => Date.now());
  const isShared = Boolean(
    activeShare &&
      !activeShare.is_revoked &&
      (!activeShare.expires_at || new Date(activeShare.expires_at).getTime() > nowMs),
  );
  const composition = activeShare?.payload?.composition_config as GoalCompositionConfig | undefined;

  const handleOpenGoal = () => {
    triggerSensory("action");
    onOpenGoal(category);
  };

  const handleShareClick = () => {
    triggerSensory("action");
    onShareGoal(category);
  };

  return (
    <HighlightRow highlightId={highlightId ?? null} id={category.id} className="rounded-2xl">
      <article className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-surface p-3.5 sm:p-4 shadow-xs min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2.5 min-w-0">
          <div
            role="button"
            tabIndex={0}
            aria-label={`Editar meta de renda de ${category.name}`}
            onClick={handleOpenGoal}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                handleOpenGoal();
              }
            }}
            className="group flex items-start gap-2.5 min-w-0 flex-1 cursor-pointer rounded-lg p-1 -m-1 transition-colors hover:bg-surface-hover/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <CategoryIcon icon={category.icon} color={category.color} />
            <div className="flex flex-col gap-1.5 min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground line-clamp-2 break-words group-hover:text-primary-strong transition-colors">
                {category.name}
              </p>

              <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                <Badge
                  variant={expectedCents === 0 ? "muted" : status === "deficit" ? "critical" : "positive"}
                  size="xs"
                  className="max-w-full truncate"
                >
                  {expectedCents > 0 ? INCOME_GOAL_LABELS[status] : "Sem meta"}
                </Badge>

                {composition?.includeCheckingAccounts ? (
                  <Badge variant="muted" size="xs" className="max-w-full truncate" title="Integrada com Saldo em Conta">
                    <Wallet className="size-3 text-muted-foreground" aria-hidden="true" />
                    <span>Conta</span>
                  </Badge>
                ) : null}

                {composition?.includeInvestments ? (
                  <Badge variant="portfolio" size="xs" className="max-w-full truncate" title="Integrada com Investimentos">
                    <PieChart className="size-3 text-portfolio" aria-hidden="true" />
                    <span>Ativos</span>
                  </Badge>
                ) : null}

                {composition?.allocationCapCents ? (
                  <Badge variant="warning" size="xs" className="max-w-full truncate" title="Teto de Alocação Exclusivo">
                    Teto
                  </Badge>
                ) : null}

                {composition?.isCompletedLocked && percent >= 100 ? (
                  <Badge variant="positive" size="xs" className="max-w-full truncate" title="Meta Congelada no Marco Conquistado">
                    <Lock className="size-2.5" aria-hidden="true" />
                    <span>Garantida</span>
                  </Badge>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 shrink-0 self-end sm:self-start">
            {isShared ? (
              <button
                type="button"
                onClick={handleShareClick}
                title="Termômetro público ativo. Toque para gerenciar ou copiar link."
                className="relative inline-flex items-center gap-1 whitespace-nowrap rounded-pill bg-primary/12 px-2 py-1 text-[10px] font-medium text-primary-strong transition-colors hover:bg-primary/20 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring max-sm:min-h-11 max-sm:px-3"
              >
                <Share2 className="size-3" aria-hidden="true" />
                <span>Pública</span>
              </button>
            ) : null}

            {onEditCategory ? (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-8 max-sm:min-h-11 max-sm:min-w-11 text-muted-foreground hover:text-foreground"
                aria-label={`Editar cadastro de ${category.name}`}
                title={`Editar cadastro de ${category.name}`}
                onClick={() => onEditCategory(category)}
              >
                <Edit3 className="size-3.5" aria-hidden="true" />
              </Button>
            ) : null}

            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-8 max-sm:min-h-11 max-sm:min-w-11 text-muted-foreground hover:text-foreground"
              aria-label={`Compartilhar progresso da meta ${category.name}`}
              title="Compartilhar Progresso da Meta"
              onClick={() => onShareGoal(category)}
            >
              <Share2 className="size-3.5" aria-hidden="true" />
            </Button>
          </div>
        </div>

        <div
          role="button"
          tabIndex={0}
          aria-label={`Editar meta de renda de ${category.name}`}
          onClick={handleOpenGoal}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              handleOpenGoal();
            }
          }}
          className="flex flex-col gap-2 cursor-pointer rounded-lg p-1 -m-1 transition-colors hover:bg-surface-hover/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-w-0"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1 text-xs text-muted-foreground min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 min-w-0">
              <span className="shrink-0">Realizado:</span>
              <MoneyText cents={realizedCents} tone="default" className="font-semibold text-foreground" />
              {expectedCents > 0 ? (
                <>
                  <span className="shrink-0">de</span>
                  <MoneyText cents={expectedCents} tone="default" />
                </>
              ) : null}
            </div>
            {expectedCents > 0 ? (
              <span className="num font-medium tabular-nums text-foreground shrink-0 ml-auto">
                {Math.round(percent)}%
              </span>
            ) : (
              <span className="text-[11px] font-medium text-primary-strong hover:underline shrink-0 ml-auto">
                Toque para definir
              </span>
            )}
          </div>

          <Progress
            value={expectedCents === 0 ? 0 : percent}
            tone={expectedCents === 0 ? "positive" : status === "deficit" ? "warning" : "positive"}
            size="md"
            aria-label={`Progresso da meta ${category.name}: ${Math.round(percent)}%`}
          />
        </div>
      </article>
    </HighlightRow>
  );
}
