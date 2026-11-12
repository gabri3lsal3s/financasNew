import { PiggyBank, Plus, Target } from "lucide-react";
import { Badge, Button, EmptyState } from "@/components/ui";
import { MonthPicker } from "@/components/modules";
import { incomeGoalStatus } from "@/domain/budgets";
import { CampaignCard, GoalCard } from "@/features/goals";
import type { Category, PublicShare } from "@/types";

export interface BudgetsGoalsTabProps {
  month: string;
  onMonthChange: (month: string) => void;
  activeCampaigns: PublicShare[];
  archivedCampaigns: PublicShare[];
  showArchivedCampaigns: boolean;
  onToggleShowArchivedCampaigns: () => void;
  liveGoalProgress: Map<string, { currentCents: number; percentage?: number; isCompleted?: boolean }>;
  incomeCategories: Category[];
  realizedByCategory: Map<string, number>;
  goalsByCategory: Map<string, number>;
  goalShares: PublicShare[];
  nowMs: number;
  effectiveHighlightId: string | null;
  onOpenNewStandaloneCampaign: () => void;
  onOpenDeposit: (share: PublicShare) => void;
  onManageShare: (share: PublicShare, initialEdit: boolean) => void;
  onManageContributions: (share: PublicShare) => void;
  onOpenComposition: (share: PublicShare) => void;
  onOpenGoal: (category: Category) => void;
  onEditCategory: (category: Category) => void;
  onShareGoal: (category: Category) => void;
  onOpenCreateCategory: () => void;
}

export function BudgetsGoalsTab({
  month,
  onMonthChange,
  activeCampaigns,
  archivedCampaigns,
  showArchivedCampaigns,
  onToggleShowArchivedCampaigns,
  liveGoalProgress,
  incomeCategories,
  realizedByCategory,
  goalsByCategory,
  goalShares,
  nowMs,
  effectiveHighlightId,
  onOpenNewStandaloneCampaign,
  onOpenDeposit,
  onManageShare,
  onManageContributions,
  onOpenComposition,
  onOpenGoal,
  onEditCategory,
  onShareGoal,
  onOpenCreateCategory,
}: BudgetsGoalsTabProps) {
  return (
    <div className="flex flex-col gap-6">
      <MonthPicker value={month} onValueChange={onMonthChange} />

      {/* Banner de Metas & Campanhas Coletivas */}
      <div
        data-tour="shared-goals-banner"
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 rounded-2xl border border-primary/25 bg-primary/5 p-4 shadow-xs"
      >
        <div className="flex items-start gap-3 min-w-0">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary-strong">
            <Target className="size-4.5" aria-hidden="true" />
          </span>
          <div className="text-sm min-w-0">
            <p className="font-semibold text-foreground">Metas Financeiras & Termômetro Coletivo</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Crie metas de economia pessoais ou vaquinhas coletivas com link público transparente e chave Pix opcional.
            </p>
          </div>
        </div>
        <Button
          size="sm"
          onClick={onOpenNewStandaloneCampaign}
          className="shrink-0 self-start sm:self-auto gap-1.5 cursor-pointer"
        >
          <Plus className="size-4" aria-hidden="true" />
          <span>Nova Meta</span>
        </Button>
      </div>

      {/* Seção de Campanhas & Vaquinhas Ativas */}
      {activeCampaigns.length > 0 && (
        <div data-tour="shared-goals-card" className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground">Metas Financeiras</h2>
              <Badge variant="portfolio" size="xs">
                {activeCampaigns.length} ativa{activeCampaigns.length > 1 ? "s" : ""}
              </Badge>
            </div>
          </div>
          <div className="flex flex-col gap-2.5">
            {activeCampaigns.map((share) => (
              <CampaignCard
                key={share.id}
                share={share}
                liveCurrentCents={liveGoalProgress.get(share.id)?.currentCents}
                onOpenDeposit={onOpenDeposit}
                onManageShare={(s) => onManageShare(s, false)}
                onEditShare={(s) => onManageShare(s, true)}
                onManageContributions={onManageContributions}
                onOpenComposition={onOpenComposition}
              />
            ))}
          </div>
        </div>
      )}

      {/* Seção de Campanhas Concluídas/Arquivadas */}
      {archivedCampaigns.length > 0 && (
        <div className="flex flex-col gap-2 pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onToggleShowArchivedCampaigns}
            className="self-center text-xs text-muted-foreground hover:text-foreground"
          >
            {showArchivedCampaigns
              ? "Ocultar metas arquivadas"
              : `Ver ${archivedCampaigns.length} meta${archivedCampaigns.length > 1 ? "s" : ""} arquivada${archivedCampaigns.length > 1 ? "s" : ""}`}
          </Button>
          {showArchivedCampaigns && (
            <div className="flex flex-col gap-2.5 opacity-80">
              {archivedCampaigns.map((share) => (
                <CampaignCard
                  key={share.id}
                  share={share}
                  liveCurrentCents={liveGoalProgress.get(share.id)?.currentCents}
                  onOpenDeposit={onOpenDeposit}
                  onManageShare={(s) => onManageShare(s, false)}
                  onEditShare={(s) => onManageShare(s, true)}
                  onManageContributions={onManageContributions}
                  onOpenComposition={onOpenComposition}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Seção de Metas Mensais por Categoria de Renda */}
      <div className="flex flex-col gap-3 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Metas Mensais por Categoria de Renda</h2>
          <p className="hidden text-xs text-muted-foreground sm:block">
            Expectativa mensal por categoria para comparar com recebimentos.
          </p>
        </div>

        {incomeCategories.length === 0 ? (
          <EmptyState
            icon={<PiggyBank className="size-6" aria-hidden="true" />}
            title="Sem categorias de renda"
            description="Crie categorias de renda para definir metas mensais ou crie uma Meta Coletiva acima."
            action={
              <Button size="sm" onClick={onOpenCreateCategory}>
                <Plus className="size-4" aria-hidden="true" />
                Nova categoria
              </Button>
            }
          />
        ) : (
          <div className="flex flex-col gap-2.5">
            {incomeCategories.map((category) => {
              const realizedCents = realizedByCategory.get(category.id) ?? 0;
              const expectedCents = goalsByCategory.get(category.id) ?? 0;
              const status = incomeGoalStatus(realizedCents, expectedCents);
              const percent = expectedCents > 0 ? Math.min(100, (realizedCents / expectedCents) * 100) : 0;
              const activeShare = goalShares.find(
                (s) =>
                  !s.is_revoked &&
                  (!s.expires_at || new Date(s.expires_at).getTime() > nowMs) &&
                  s.payload?.category_id === category.id,
              );

              return (
                <GoalCard
                  key={category.id}
                  category={category}
                  month={month}
                  realizedCents={realizedCents}
                  expectedCents={expectedCents}
                  status={status}
                  percent={percent}
                  highlightId={effectiveHighlightId}
                  activeShare={activeShare}
                  onOpenGoal={onOpenGoal}
                  onEditCategory={onEditCategory}
                  onShareGoal={onShareGoal}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
