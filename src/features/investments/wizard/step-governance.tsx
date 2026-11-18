import { useMemo } from "react";
import { Shield } from "lucide-react";
import { Alert } from "@/components/ui";
import { calculateEffectiveAssetTargets } from "@/domain/portfolio";
import { isCashAssetClass, normalizeClassName } from "@/domain/portfolio/valuation";
import { formatPercent } from "@/services/masks";
import type { GroupTarget, PortfolioAsset } from "@/types";
import { AssetGovernanceForm } from "../components/shared-forms";
import type { InvestmentWizardState } from "./wizard-state";

export interface StepGovernanceProps {
  state: InvestmentWizardState;
  onChange: (patch: Partial<InvestmentWizardState>) => void;
  existingAssets: readonly PortfolioAsset[];
  classTargets: readonly GroupTarget[];
  sectorTargets: readonly GroupTarget[];
}

export function StepGovernance({
  state,
  onChange,
  existingAssets,
  classTargets,
  sectorTargets,
}: StepGovernanceProps) {
  const isCash = state.isCash || isCashAssetClass(state.assetClass);

  const classTargetInputs = useMemo(
    () => classTargets.map((ct) => ({ className: ct.name, targetPercentage: ct.target_percentage })),
    [classTargets],
  );

  const sectorTargetInputs = useMemo(
    () =>
      sectorTargets
        .filter((st) => Boolean(st.class_name && st.class_name.trim().length > 0))
        .map((st) => ({
          className: st.class_name as string,
          sectorName: st.name,
          targetPercentage: st.target_percentage,
        })),
    [sectorTargets],
  );

  const normalizedClassKey = normalizeClassName(state.assetClass);
  const configuredClassTarget = useMemo(
    () => classTargetInputs.find((ct) => normalizeClassName(ct.className) === normalizedClassKey) ?? null,
    [classTargetInputs, normalizedClassKey],
  );

  const effectiveTargetPreview = useMemo(() => {
    if (isCash) return null;
    const simulatedAsset = {
      id: "__wizard_new_asset__",
      ticker: state.ticker.trim().toUpperCase() || "NOVO",
      assetClass: state.assetClass,
      sector: state.sector.trim() || null,
      score: state.score,
      allocation_status: state.allocationStatus,
    };

    const results = calculateEffectiveAssetTargets({
      assets: [
        ...existingAssets.map((asset) => ({
          id: asset.id,
          ticker: asset.ticker,
          assetClass: asset.asset_class,
          sector: asset.sector,
          score: asset.score ?? null,
          allocation_status: asset.allocation_status ?? "active",
        })),
        simulatedAsset,
      ],
      classTargets: classTargetInputs,
      sectorTargets: sectorTargetInputs,
    });

    return results.find((item) => item.assetId === "__wizard_new_asset__") ?? null;
  }, [isCash, state.ticker, state.assetClass, state.sector, state.score, state.allocationStatus, existingAssets, classTargetInputs, sectorTargetInputs]);

  if (isCash) {
    return (
      <div className="flex flex-col gap-4 rounded-2xl border border-border/80 bg-surface p-4 shadow-xs">
        <div className="flex items-start gap-2.5">
          <Shield className="size-4 shrink-0 mt-0.5 text-muted-foreground" aria-hidden="true" />
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold text-foreground">
              Caixa / Liquidez fora das metas de alocação
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              O saldo em Caixa não recebe Nota de Convicção nem Meta % na governança de 3 níveis. Ele funciona como liquidez disponível e pode ser somado ao seu dinheiro do bolso no Simulador de Aporte Composto.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const effectiveTargetSlot =
    configuredClassTarget && configuredClassTarget.targetPercentage > 0 && effectiveTargetPreview ? (
      <div className="flex flex-col gap-1.5 rounded-2xl border border-border/80 bg-surface-raised/60 p-3.5 text-xs">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-semibold text-foreground">Meta Efetiva Derivada na Carteira</span>
          <span className="font-mono text-sm font-bold text-primary-strong tabular-nums whitespace-nowrap">
            {formatPercent(effectiveTargetPreview.effectiveTargetPct)}%
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground">{effectiveTargetPreview.formulaLabel}</p>
      </div>
    ) : (
      <Alert variant="info">
        A classe {state.assetClass} ainda não possui meta % configurada em Rebalancear &gt; Metas. Assim que você definir a meta da classe, este ativo herdará automaticamente sua participação proporcional à nota.
      </Alert>
    );

  return (
    <AssetGovernanceForm
      idPrefix="wizard-gov"
      interactionMode="wizard"
      collapsibleDetails
      assetClass={state.assetClass}
      score={state.score}
      onScoreChange={(score) => onChange({ score })}
      allocationStatus={state.allocationStatus}
      onAllocationStatusChange={(allocationStatus) => onChange({ allocationStatus })}
      scoreCriteria={state.scoreCriteria ?? {}}
      onToggleCriterion={(key) => {
        const next = { ...(state.scoreCriteria ?? {}) };
        if (next[key] === 1) {
          delete next[key];
        } else {
          next[key] = 1;
        }
        onChange({ scoreCriteria: next });
      }}
      thesisSummary={state.thesisSummary}
      onThesisSummaryChange={(thesisSummary) => onChange({ thesisSummary })}
      reviewFrequencyMonths={state.reviewFrequencyMonths}
      onReviewFrequencyMonthsChange={(reviewFrequencyMonths) => onChange({ reviewFrequencyMonths })}
      effectiveTargetSlot={effectiveTargetSlot}
    />
  );
}
