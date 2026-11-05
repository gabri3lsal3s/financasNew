import { useState } from "react";
import { Edit3, Share2 } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { CategoryIcon } from "@/components/modules/category-icon";
import { HighlightRow } from "@/components/modules/highlight-row";
import { INCOME_GOAL_LABELS, type IncomeGoalStatus } from "@/domain/budgets";
import { triggerSensory } from "@/services/sensory";
import type { Category, PublicShare } from "@/types";

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
  onEditCategory: (category: Category) => void;
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

  return (
    <HighlightRow
      highlightId={highlightId ?? null}
      id={category.id}
      className="rounded-2xl"
    >
      <div className="group flex flex-col gap-3 rounded-2xl border border-border/80 bg-surface/90 p-3.5 sm:p-4 shadow-xs transition-all hover:border-border hover:bg-surface min-w-0">
        <div className="flex items-center justify-between gap-3 min-w-0">
          <div
            role="button"
            tabIndex={0}
            aria-label={`Editar meta de renda de ${category.name}`}
            onClick={() => {
              triggerSensory("action");
              onOpenGoal(category);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                triggerSensory("action");
                onOpenGoal(category);
              }
            }}
            className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg p-0.5"
          >
            <CategoryIcon icon={category.icon} color={category.color} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                {category.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isShared && (
              <Badge
                variant="default"
                size="xs"
                className="gap-1 border border-primary/40 text-primary cursor-pointer hover:bg-primary/20 transition-colors"
                onClick={() => {
                  triggerSensory("action");
                  onShareGoal(category);
                }}
                title="Termômetro público ativo. Toque para gerenciar ou copiar link."
              >
                <Share2 className="size-3" aria-hidden="true" />
                <span>Pública</span>
              </Badge>
            )}

            <Badge
              variant={expectedCents === 0 ? "muted" : status === "deficit" ? "critical" : "positive"}
              size="xs"
            >
              {expectedCents > 0 ? INCOME_GOAL_LABELS[status] : "Sem meta"}
            </Badge>

            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-7 text-muted-foreground hover:text-foreground"
              aria-label={`Compartilhar progresso da meta ${category.name}`}
              title="Compartilhar Progresso da Meta"
              onClick={() => {
                triggerSensory("action");
                onShareGoal(category);
              }}
            >
              <Share2 className="size-3.5" aria-hidden="true" />
            </Button>

            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-7 text-muted-foreground hover:text-foreground"
              aria-label={`Editar cadastro de ${category.name}`}
              title={`Editar cadastro de ${category.name}`}
              onClick={() => {
                triggerSensory("action");
                onEditCategory(category);
              }}
            >
              <Edit3 className="size-3.5" aria-hidden="true" />
            </Button>
          </div>
        </div>

        <div
          role="button"
          tabIndex={0}
          aria-label={`Editar meta de renda de ${category.name}`}
          onClick={() => {
            triggerSensory("action");
            onOpenGoal(category);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              triggerSensory("action");
              onOpenGoal(category);
            }
          }}
          className="cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span>Realizado:</span>
              <MoneyText cents={realizedCents} tone="default" className="font-semibold text-foreground" />
              {expectedCents > 0 ? (
                <>
                  <span>de</span>
                  <MoneyText cents={expectedCents} tone="default" />
                </>
              ) : null}
            </span>
            {expectedCents > 0 ? (
              <span className="num font-medium tabular-nums">{Math.round(percent)}%</span>
            ) : (
              <span className="text-[11px] text-primary hover:underline">Toque para definir</span>
            )}
          </div>

          <div className="relative mt-2 h-2 w-full overflow-hidden rounded-full bg-muted/70">
            <div
              className={`h-full transition-all duration-300 ${
                expectedCents === 0
                  ? "bg-muted"
                  : status === "on_track"
                    ? "bg-positive"
                    : status === "surplus"
                      ? "bg-positive-strong"
                      : "bg-warning"
              }`}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      </div>
    </HighlightRow>
  );
}
