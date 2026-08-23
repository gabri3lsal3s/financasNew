import { useState } from "react";
import { Coins, Trash2 } from "lucide-react";
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Modal,
  SkeletonTable,
} from "@/components/ui";
import { MonthPicker } from "@/components/modules";
import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money";
import { currentMonth, formatDateBR } from "@/lib/date";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import {
  useDeletePortfolioContribution,
  usePortfolioAssets,
  usePortfolioContributions,
} from "@/state";
import type { PortfolioContribution } from "@/types";

export interface ContributionsListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultMonth?: string;
}

export function ContributionsListDialog({
  open,
  onOpenChange,
  defaultMonth,
}: ContributionsListDialogProps) {
  const [month, setMonth] = useState(() => defaultMonth ?? currentMonth());
  const [contributionToDelete, setContributionToDelete] = useState<PortfolioContribution | null>(null);

  const contributionsQuery = usePortfolioContributions();
  const assetsQuery = usePortfolioAssets();
  const deleteContribution = useDeletePortfolioContribution();

  const contributions = contributionsQuery.data ?? [];
  const assets = assetsQuery.data ?? [];
  const tickerByAssetId = new Map(assets.map((a) => [a.id, a.ticker]));

  const filtered = contributions.filter((c) => c.date.startsWith(month));
  const monthTotalCents = filtered.reduce((acc, c) => acc + numberToCents(c.amount), 0);

  const handleDeleteContribution = async () => {
    if (!contributionToDelete) return;
    try {
      await deleteContribution.mutateAsync(contributionToDelete.id);
      triggerSensory("destructive");
      pushToast({
        title: "Aporte removido",
        description: "O lançamento de aporte foi expurgado com sucesso.",
      });
      setContributionToDelete(null);
    } catch (err) {
      pushToast({
        title: "Erro ao excluir aporte",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        title="Gerenciar Aportes do Mês"
        description="Visualize ou remova lançamentos de aporte financeiro que alimentam a Visão Geral e os Insights."
        size="lg"
      >
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex items-center justify-between rounded-xl border border-border/80 bg-surface/60 p-1.5 w-full">
            <MonthPicker value={month} onValueChange={setMonth} aria-label="Mês dos aportes" className="w-full" />
          </div>

          {/* Resumo do mês */}
          <div className="flex items-center justify-between rounded-xl border border-border/80 bg-surface/80 px-4 py-3">
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Total Aportado em {month}:</span>
              <span className="text-base font-semibold text-foreground">
                <MoneyText cents={monthTotalCents} />
              </span>
            </div>
            <Badge variant="muted" className="text-xs">
              {filtered.length} {filtered.length === 1 ? "registro" : "registros"}
            </Badge>
          </div>

          {/* Lista de Aportes */}
          {contributionsQuery.isLoading ? (
            <SkeletonTable rows={3} />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<Coins className="size-6" aria-hidden="true" />}
              title="Nenhum aporte registrado neste mês"
              description="Quando você aplica aportes pelo rebalanceador ou lança compras com aporte ativado, eles aparecem aqui para conferência e auditoria."
              tone="portfolio"
              headingLevel="h3"
            />
          ) : (
            <div className="flex flex-col divide-y divide-border/60 rounded-xl border border-border/80 overflow-hidden bg-surface/60">
              {filtered.map((item) => {
                const ticker = item.asset_id ? tickerByAssetId.get(item.asset_id) ?? "Ativo" : "Geral / Caixa";
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 p-3.5 hover:bg-surface-hover/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-portfolio/10 text-portfolio border border-portfolio/20">
                        <Coins className="size-4" aria-hidden="true" />
                      </span>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-foreground truncate">{ticker}</span>
                          <span className="text-[11px] text-muted-foreground">{formatDateBR(item.date)}</span>
                        </div>
                        {item.notes ? (
                          <span className="text-[11px] text-muted-foreground truncate">{item.notes}</span>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className="text-xs font-semibold text-foreground">
                        <MoneyText cents={numberToCents(item.amount)} />
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setContributionToDelete(item)}
                        className="size-7 p-0 text-muted-foreground hover:text-negative-strong"
                        title="Excluir lançamento de aporte"
                        aria-label={`Excluir aporte de R$ ${item.amount}`}
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={contributionToDelete !== null}
        onOpenChange={(open) => !open && setContributionToDelete(null)}
        title="Excluir lançamento de aporte?"
        description={`O aporte de R$ ${contributionToDelete?.amount.toFixed(2) ?? ""} será removido e o total de investimentos do mês será recalculado na Home e Insights.`}
        confirmLabel="Excluir aporte"
        variant="destructive"
        confirmPending={deleteContribution.isPending}
        onConfirm={handleDeleteContribution}
      />
    </>
  );
}
