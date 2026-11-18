import { Sparkles, Target, TrendingDown, TrendingUp } from "lucide-react";
import { Badge, Button, MoneyText } from "@/components/ui";
import { numberToCents } from "@/domain/money";
import { formatAssetQuantity } from "@/services/formatting";
import { formatPercent } from "@/services/masks";
import type { AssetDetailMetrics } from "./use-asset-detail-metrics";

export interface AssetAllocationCardProps {
  metrics: AssetDetailMetrics;
  onAporteClick: () => void;
}

export function AssetAllocationCard({ metrics, onAporteClick }: AssetAllocationCardProps) {
  const {
    currentAsset,
    isClosed,
    isCash,
    hasAssetTarget,
    assetTargetPct,
    sectorTargetPct,
    classTargetPct,
    hasDiscountVsPM,
    diffVsPMPct,
    currentPctInPortfolio,
    totalPortfolioValue,
    targetValueBRL,
    gapBRL,
    gapCents,
    suggestedQtyToAbsorb,
  } = metrics;

  if (isClosed || isCash) return null;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-surface p-3.5 sm:p-4 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/80 pb-2.5">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <Target className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <span className="text-xs font-bold uppercase tracking-wider text-foreground">
            Diagnóstico de Alocação &amp; Metas
          </span>
          {hasAssetTarget ? (
            <Badge variant="default" size="xs">Meta: {formatPercent(assetTargetPct ?? 0)}%</Badge>
          ) : sectorTargetPct !== null ? (
            <Badge variant="muted" size="xs">Setor: {formatPercent(sectorTargetPct)}%</Badge>
          ) : classTargetPct !== null ? (
            <Badge variant="muted" size="xs">Classe: {formatPercent(classTargetPct)}%</Badge>
          ) : null}
        </div>

        {hasDiscountVsPM ? (
          <Badge variant="positive" size="xs" className="self-start sm:self-auto gap-1">
            <TrendingDown className="size-3" aria-hidden="true" />
            <span>Desconto de {formatPercent(Math.abs(diffVsPMPct))}% vs PM</span>
          </Badge>
        ) : diffVsPMPct > 0 ? (
          <Badge variant="muted" size="xs" className="self-start sm:self-auto gap-1">
            <TrendingUp className="size-3" aria-hidden="true" />
            <span>+{formatPercent(diffVsPMPct)}% acima do PM</span>
          </Badge>
        ) : null}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 text-xs">
        <div className="flex flex-col min-w-0">
          <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
            % na Carteira
          </span>
          <span className="num font-mono text-sm font-bold text-foreground">
            {formatPercent(currentPctInPortfolio)}%
          </span>
          <span className="text-[11px] text-muted-foreground truncate">
            de <MoneyText cents={numberToCents(totalPortfolioValue)} hideCents tone="default" variant="caption" />
          </span>
        </div>

        <div className="flex flex-col min-w-0">
          <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
            Meta Derivada
          </span>
          <span className="num font-mono text-sm font-bold text-foreground">
            {hasAssetTarget
              ? `${formatPercent(assetTargetPct ?? 0)}%`
              : sectorTargetPct !== null
                ? `${formatPercent(sectorTargetPct)}% (setor)`
                : "Não definida"}
          </span>
          <span className="text-[11px] text-muted-foreground font-mono truncate">
            {hasAssetTarget ? (
              <>Alvo: <MoneyText cents={numberToCents(targetValueBRL)} variant="caption" tone="default" /></>
            ) : (
              "Configure em Rebalancear > Metas"
            )}
          </span>
        </div>

        <div className="flex flex-col min-w-0">
          <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
            Gap Orçamentário
          </span>
          {hasAssetTarget ? (
            gapBRL > 0 ? (
              <>
                <MoneyText cents={gapCents} tone="positive" sign="explicit" className="text-sm font-bold" />
                <span className="text-[11px] text-positive-strong font-medium truncate">
                  {suggestedQtyToAbsorb
                    ? `${formatAssetQuantity(suggestedQtyToAbsorb, currentAsset.asset_class ?? undefined)} cota(s) sugerida(s)`
                    : "Abaixo da meta"}
                </span>
              </>
            ) : (
              <>
                <span className="font-mono text-sm font-bold text-muted-foreground">Equilibrado</span>
                <span className="text-[11px] text-muted-foreground truncate">Meta atingida</span>
              </>
            )
          ) : (
            <>
              <span className="font-mono text-sm font-bold text-muted-foreground">—</span>
              <span className="text-[11px] text-muted-foreground truncate">Sem meta por ativo</span>
            </>
          )}
        </div>

        <div className="flex flex-col justify-end min-w-0 col-span-2 sm:col-span-1">
          <Button
            type="button"
            size="sm"
            variant={gapBRL > 0 || hasDiscountVsPM ? "default" : "outline"}
            onClick={onAporteClick}
            className="gap-1.5 text-xs font-semibold w-full"
          >
            <Sparkles className="size-3.5" aria-hidden="true" />
            <span>Aportar no Wizard</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
