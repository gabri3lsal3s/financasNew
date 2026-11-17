import { useState } from "react";
import { useNavigate } from "react-router";
import { Coins, CalendarClock, Clock, Loader2, ShieldAlert, TrendingDown } from "lucide-react";
import { DashboardAlertsCarousel, type DashboardAlertItem } from "@/components/modules/dashboard-alerts-carousel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MoneyText } from "@/components/ui/money-text";
import { useCorporateDividends, useApproveDividendsBatch, useAssetGovernanceInsights } from "@/state";
import { PendingDividendsDialog } from "./pending-dividends-dialog";
import { cn } from "@/lib/utils";

export interface PortfolioInsightsCarouselProps {
  className?: string;
}

export function PortfolioInsightsCarousel({ className }: PortfolioInsightsCarouselProps) {
  const navigate = useNavigate();
  const { available, projected, totalAvailableAmount, totalProjectedAmount, isLoading: isDividendsLoading } =
    useCorporateDividends();
  const {
    overdueReviewsCount,
    quarantinedCount,
    discountOpportunitiesCount,
    isLoading: isGovernanceLoading,
  } = useAssetGovernanceInsights();

  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const approveMutation = useApproveDividendsBatch();

  const handleApproveAll = async () => {
    if (available.length === 0) return;
    const items = available.map((d) => ({
      asset_id: d.assetId,
      ticker: d.ticker,
      date: d.paymentDate,
      amount: d.totalAmount,
      notes: `Provento automático (${d.type}) apurado na B3`,
      corporate_dividend_id: d.corporateDividendId,
    }));

    await approveMutation.mutateAsync({
      dividends: items,
      sync_cash: true,
    });
  };

  const hasDividends = available.length > 0 || projected.length > 0;
  const hasGovernance = overdueReviewsCount > 0 || quarantinedCount > 0 || discountOpportunitiesCount > 0;

  if ((isDividendsLoading && isGovernanceLoading) || (!hasDividends && !hasGovernance)) {
    return null;
  }

  const items: (DashboardAlertItem | null | undefined | false)[] = [
    // Slide 1: Proventos Disponíveis na Corretora (Aprovação em lote de 1 clique)
    available.length > 0 && {
      id: "available-dividends-alert",
      priority: 1,
      content: (
        <div
          role="alert"
          className={cn(
            "w-full h-full min-h-[104px] sm:min-h-[72px] flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 rounded-2xl border border-border/80 bg-surface p-3.5 sm:p-4 shadow-xs transition-all",
            className,
          )}
        >
          <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-xl border bg-positive/10 border-positive/20 text-positive-strong"
              aria-hidden="true"
            >
              <Coins className="size-4.5" />
            </span>
            <div className="flex flex-col min-w-0 flex-1 gap-0.5">
              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                <h4 className="text-xs sm:text-sm font-semibold tracking-tight text-foreground truncate">
                  Proventos Creditados na Corretora
                </h4>
                <Badge size="xs" variant="muted">
                  {available.length} {available.length === 1 ? "provento" : "proventos"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground truncate sm:line-clamp-1">
                {available.length} {available.length === 1 ? "provento da B3 recebido soma" : "proventos da B3 recebidos somam"}{" "}
                <MoneyText
                  cents={Math.round(totalAvailableAmount * 100)}
                  className="font-medium text-foreground tabular-nums inline"
                />{" "}
                disponíveis para reinvestimento.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-center mt-auto sm:mt-0 shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsDetailsOpen(true)}
            >
              Ver detalhes
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              disabled={approveMutation.isPending}
              onClick={handleApproveAll}
            >
              {approveMutation.isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1.5" />
                  Creditando...
                </>
              ) : (
                "Aprovar no Caixa"
              )}
            </Button>
          </div>
        </div>
      ),
    },

    // Slide 2: Proventos Futuros / Previstos
    projected.length > 0 && {
      id: "projected-dividends-alert",
      priority: 2,
      content: (
        <div
          role="alert"
          className={cn(
            "w-full h-full min-h-[104px] sm:min-h-[72px] flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 rounded-2xl border border-border/80 bg-surface p-3.5 sm:p-4 shadow-xs transition-all",
            className,
          )}
        >
          <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-xl border bg-primary/10 border-primary/20 text-primary-strong"
              aria-hidden="true"
            >
              <CalendarClock className="size-4.5" />
            </span>
            <div className="flex flex-col min-w-0 flex-1 gap-0.5">
              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                <h4 className="text-xs sm:text-sm font-semibold tracking-tight text-foreground truncate">
                  Proventos Previstos no Mês
                </h4>
                <Badge size="xs" variant="muted">
                  {projected.length} futuros
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground truncate sm:line-clamp-1">
                {projected.length} {projected.length === 1 ? "provento programado soma" : "proventos programados somam"}{" "}
                <MoneyText
                  cents={Math.round(totalProjectedAmount * 100)}
                  className="font-medium text-foreground tabular-nums inline"
                />{" "}
                com liquidação futura garantida pela B3.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-center mt-auto sm:mt-0 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsDetailsOpen(true)}
            >
              Ver projeção
            </Button>
          </div>
        </div>
      ),
    },

    // Slide 3: Revisão Periódica de Teses Expirada (Salvaguarda S6)
    overdueReviewsCount > 0 && {
      id: "overdue-governance-alert",
      priority: 3,
      content: (
        <div
          role="alert"
          className={cn(
            "w-full h-full min-h-[104px] sm:min-h-[72px] flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 rounded-2xl border border-border/80 bg-surface p-3.5 sm:p-4 shadow-xs transition-all",
            className,
          )}
        >
          <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-xl border bg-warning/15 border-warning/20 text-warning-strong"
              aria-hidden="true"
            >
              <Clock className="size-4.5" />
            </span>
            <div className="flex flex-col min-w-0 flex-1 gap-0.5">
              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                <h4 className="text-xs sm:text-sm font-semibold tracking-tight text-foreground truncate">
                  Revisão de Teses Pendente
                </h4>
                <Badge size="xs" variant="warning">
                  {overdueReviewsCount} {overdueReviewsCount === 1 ? "ativo" : "ativos"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground truncate sm:line-clamp-1">
                {overdueReviewsCount === 1
                  ? "Existe 1 tese de investimento com prazo expirado"
                  : `Existem ${overdueReviewsCount} teses de investimento com prazo expirado`}
                . Reavalie notas e critérios de governança.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-center mt-auto sm:mt-0 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate("/investimentos?tab=metas&subtab=assets")}
            >
              Revisar Metas
            </Button>
          </div>
        </div>
      ),
    },

    // Slide 4: Ativos em Quarentena (Salvaguardas S3 e S6)
    quarantinedCount > 0 && {
      id: "quarantine-governance-alert",
      priority: 4,
      content: (
        <div
          role="alert"
          className={cn(
            "w-full h-full min-h-[104px] sm:min-h-[72px] flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 rounded-2xl border border-border/80 bg-surface p-3.5 sm:p-4 shadow-xs transition-all",
            className,
          )}
        >
          <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-xl border bg-warning/15 border-warning/20 text-warning-strong"
              aria-hidden="true"
            >
              <ShieldAlert className="size-4.5" />
            </span>
            <div className="flex flex-col min-w-0 flex-1 gap-0.5">
              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                <h4 className="text-xs sm:text-sm font-semibold tracking-tight text-foreground truncate">
                  Ativos em Quarentena
                </h4>
                <Badge size="xs" variant="warning">
                  {quarantinedCount} em observação
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground truncate sm:line-clamp-1">
                {quarantinedCount === 1
                  ? "1 ativo está com aporte bloqueado"
                  : `${quarantinedCount} ativos estão com aportes bloqueados`}
                {" "}aguardando auditoria de fundamentos.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-center mt-auto sm:mt-0 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate("/investimentos?tab=metas&subtab=assets")}
            >
              Auditar Carteira
            </Button>
          </div>
        </div>
      ),
    },

    // Slide 5: Oportunidade de Aporte em Desconto (Salvaguarda S6)
    discountOpportunitiesCount > 0 && {
      id: "discount-opportunity-alert",
      priority: 5,
      content: (
        <div
          role="alert"
          className={cn(
            "w-full h-full min-h-[104px] sm:min-h-[72px] flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 rounded-2xl border border-border/80 bg-surface p-3.5 sm:p-4 shadow-xs transition-all",
            className,
          )}
        >
          <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-xl border bg-positive/10 border-positive/20 text-positive-strong"
              aria-hidden="true"
            >
              <TrendingDown className="size-4.5" />
            </span>
            <div className="flex flex-col min-w-0 flex-1 gap-0.5">
              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                <h4 className="text-xs sm:text-sm font-semibold tracking-tight text-foreground truncate">
                  Oportunidade em Desconto
                </h4>
                <Badge size="xs" variant="positive">
                  {discountOpportunitiesCount} {discountOpportunitiesCount === 1 ? "ativo" : "ativos"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground truncate sm:line-clamp-1">
                Ativos de alta convicção (Nota ≥ 8) cotados abaixo do seu preço médio histórico.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-center mt-auto sm:mt-0 shrink-0">
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => navigate("/investimentos?tab=aporte")}
            >
              Simular Aporte
            </Button>
          </div>
        </div>
      ),
    },
  ];

  return (
    <>
      <DashboardAlertsCarousel items={items} className={className} />
      {isDetailsOpen && (
        <PendingDividendsDialog
          open={isDetailsOpen}
          onOpenChange={setIsDetailsOpen}
          availableDividends={available}
          projectedDividends={projected}
        />
      )}
    </>
  );
}
