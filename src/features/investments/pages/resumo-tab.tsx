import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  Activity,
  Briefcase,
  CircleDollarSign,
  FileText,
  Info,
  Landmark,
  PieChart,
  Plus,
  RefreshCw,
  Shield,
  TrendingUp,
} from "lucide-react";
import { Badge, Button, ConfirmDialog, EmptyState, ErrorState, Modal, SkeletonKpi } from "@/components/ui";


import { CategoryDonut, CashKpiCard, KpiCard, PositionTable, AllocationDriftCard } from "@/components/modules";
import { MoneyText } from "@/components/ui/money-text";
import {
  calculateAllocationDrift,
  calculatePortfolioConcentration,
  inferSectorFromTicker,
  isCashAssetClass,
  isFixedIncomeClass,
  isPrivateFixedIncomeTicker,
  isTesouroAsset,
} from "@/domain/portfolio";
import { numberToCents } from "@/domain/money";
import { currentMonth } from "@/lib/date";
import { cn } from "@/lib/utils";
import { formatCentsAsBRL } from "@/services/masks/money";
import { getErrorMessage } from "@/services/errors";

import { useCreateDeepLink } from "@/hooks/use-create-deep-link";
import { useHighlightTarget } from "@/hooks/use-highlight-target";
import {
  useAllocationTargets,
  useDeletePortfolioAsset,
  useGroupTargets,
  usePortfolioAssets,
  usePortfolioPosition,
  useSyncQuotes,
} from "@/state";
import {
  AllocationBreakdownDialog,
  AssetDetailSheet,
  AssetEditDialog,
  CalibrateFixedIncomeDialog,
  CashFormDialog,
  InitialPocketCostDialog,
  ManualPriceDialog,
  PortfolioExecutiveReport,
  PortfolioSnapshotsCarousel,
  PortfolioSnapshotsDialog,
} from "../components";
import { InvestmentWizard } from "../wizard";
import type { WizardMode } from "../wizard/wizard-state";
import type { AssetCurrency, PortfolioAsset } from "@/types";
import type { PriceSource } from "@/domain/portfolio";

export interface ResumoTabProps {
  onOpenWizard?: (asset?: PortfolioAsset | null, mode?: WizardMode) => void;
  onOpenCash?: () => void;
  onSelectTab?: (tab: string) => void;
}

/**
 * Resumo da carteira (§F36 e §F41 unificada) — Posição Consolidada + Investment Wizard (Modelo B) + Visão Dedicada:
 * KPIs executivos, gráfico unificado de distribuição da carteira, tabela de posições com Sheet de detalhes,
 * e Investment Wizard (Nova Operação centralizada: Compra, Venda, Provento, Split e Novo Ativo).
 */
export function ResumoTab({ onOpenWizard, onOpenCash, onSelectTab }: ResumoTabProps = {}) {
  const navigate = useNavigate();
  const position = usePortfolioPosition();

  const assetsQuery = usePortfolioAssets();
  const classTargetsQuery = useGroupTargets("class");
  const sectorTargetsQuery = useGroupTargets("sector");
  const deleteAsset = useDeletePortfolioAsset();
  const syncQuotes = useSyncQuotes();
  const autoSyncedRef = useRef(false);

  // FAB contextual mobile (?novo=investimento) e abertura do Wizard (modo standalone/fallback)
  const { open: wizardDeepOpen, setOpen: setWizardDeepOpen } = useCreateDeepLink("investimento");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardInitialAsset, setWizardInitialAsset] = useState<PortfolioAsset | null>(null);
  const [wizardInitialMode, setWizardInitialMode] = useState<WizardMode>("select");
  const [snapshotsDialogOpen, setSnapshotsDialogOpen] = useState(false);
  const [executiveReportOpen, setExecutiveReportOpen] = useState(false);

  const isWizardOpen = wizardOpen || wizardDeepOpen;
  const handleWizardOpenChange = (next: boolean) => {
    setWizardOpen(next);
    setWizardDeepOpen(next);
    if (!next) {
      setWizardInitialAsset(null);
      setWizardInitialMode("select");
    }
  };

  const handleOpenWizard = (asset: PortfolioAsset | null = null, mode: WizardMode = "select") => {
    if (onOpenWizard) {
      onOpenWizard(asset, mode);
    } else {
      setWizardInitialAsset(asset);
      setWizardInitialMode(mode);
      setWizardOpen(true);
    }
  };

  const handleOpenCash = () => {
    if (onOpenCash) {
      onOpenCash();
    } else {
      setCashDialogOpen(true);
    }
  };

  const [searchParams] = useSearchParams();
  const { highlightId } = useHighlightTarget("q");
  const targetTicker = searchParams.get("ticker");

  const [detailAsset, setDetailAsset] = useState<PortfolioAsset | null>(null);
  const [dismissedHighlight, setDismissedHighlight] = useState(false);
  const [assetEditing, setAssetEditing] = useState<PortfolioAsset | null>(null);

  const [cashDialogOpen, setCashDialogOpen] = useState(false);
  const [explainModalOpen, setExplainModalOpen] = useState(false);
  const [initialCostDialogOpen, setInitialCostDialogOpen] = useState(false);
  const [assetToDelete, setAssetToDelete] = useState<PortfolioAsset | null>(null);
  const [allocationMode, setAllocationMode] = useState<"class" | "sector" | "asset">("class");
  const [breakdownGroup, setBreakdownGroup] = useState<{
    type: "class" | "sector";
    name: string;
  } | null>(null);
  const [calibrateFor, setCalibrateFor] = useState<{ asset: PortfolioAsset; valueCents: number } | null>(null);
  const [priceFor, setPriceFor] = useState<{
    id: string;
    ticker: string;
    currency: AssetCurrency;
    priceQuote?: number;
    priceBRL: number;
    usdRate?: number;
    source: PriceSource;
    pricingMode?: string;
  } | null>(null);
  const rows = position.rows;
  const investmentRows = rows.filter((r) => !r.isCash);
  const cashAsset = (assetsQuery.data ?? []).find(
    (a) => isCashAssetClass(a.asset_class) || a.ticker.toUpperCase() === "CAIXA",
  );
  const hasInvestments = rows.length > 0;

  // Auto-sincronização inicial para ativos que ainda não possuem cotação em cache
  useEffect(() => {
    if (autoSyncedRef.current || assetsQuery.isLoading || !assetsQuery.data) return;
    const assetsWithoutQuote = (assetsQuery.data ?? []).filter((a) => {
      if (isCashAssetClass(a.asset_class)) return false;
      if (isFixedIncomeClass(a.asset_class) && !isTesouroAsset(a.ticker, a.asset_class)) return false;
      if (isPrivateFixedIncomeTicker(a.ticker)) return false;
      if (a.quantity <= 0) return false;
      const row = rows.find((r) => r.assetId === a.id);
      return !row || (row.source === "fallback" && row.priceBRL <= 0);
    });

    if (assetsWithoutQuote.length > 0) {
      autoSyncedRef.current = true;
      syncQuotes.mutate(assetsWithoutQuote);
    }
  }, [assetsQuery.data, assetsQuery.isLoading, rows, syncQuotes]);

  const deepLinkedAsset = useMemo(() => {
    if (dismissedHighlight || (!highlightId && !targetTicker)) return null;
    return (
      (assetsQuery.data ?? []).find(
        (a) => a.id === highlightId || (targetTicker && a.ticker.toUpperCase() === targetTicker.toUpperCase()),
      ) ?? null
    );
  }, [dismissedHighlight, highlightId, targetTicker, assetsQuery.data]);

  const isDeepLinkedCash = Boolean(
    deepLinkedAsset &&
      (isCashAssetClass(deepLinkedAsset.asset_class) || deepLinkedAsset.ticker.toUpperCase() === "CAIXA"),
  );

  const activeDetailAsset = detailAsset ?? (!isDeepLinkedCash ? deepLinkedAsset : null);
  const activeCashDialogOpen = cashDialogOpen || isDeepLinkedCash;

  const assetById = (assetId: string): PortfolioAsset | undefined =>
    (assetsQuery.data ?? []).find((a) => a.id === assetId);

  const openDetail = (assetId: string) => {
    const asset = assetById(assetId);
    if (asset) {
      if (isCashAssetClass(asset.asset_class) || asset.ticker.toUpperCase() === "CAIXA") {
        handleOpenCash();
      } else {
        setDetailAsset(asset);
        setDismissedHighlight(false);
      }
    }
  };

  const openWizardForAsset = (assetId: string, mode: WizardMode = "buy") => {
    const asset = assetById(assetId);
    if (asset) {
      if (isCashAssetClass(asset.asset_class) || asset.ticker.toUpperCase() === "CAIXA") {
        handleOpenCash();
      } else {
        handleOpenWizard(asset, mode);
      }
    }
  };

  const openEdit = (assetId: string) => {
    const asset = assetById(assetId);
    if (asset) {
      if (isCashAssetClass(asset.asset_class) || asset.ticker.toUpperCase() === "CAIXA") {
        handleOpenCash();
      } else {
        setAssetEditing(asset);
      }
    }
  };

  const openDelete = (assetId: string) => {
    const asset = assetById(assetId);
    if (asset) setAssetToDelete(asset);
  };

  const month = currentMonth();

  // Agrupamento por classe de ativos
  const classMap = new Map<string, number>();
  for (const row of rows) {
    const label = row.assetClass?.trim() || (row.isCash ? "Caixa" : "Sem classe");
    const cents = Math.round(row.valueBRL * 100);
    classMap.set(label, (classMap.get(label) ?? 0) + cents);
  }
  const classSlices = Array.from(classMap.entries())
    .map(([label, valueCents]) => ({
      key: label,
      label,
      valueCents,
      subtitle: `${rows.filter((r) => (r.assetClass?.trim() || (r.isCash ? "Caixa" : "Sem classe")) === label).length} ativo(s)`,
      onClick: () => setBreakdownGroup({ type: "class", name: label }),
    }))
    .filter((s) => s.valueCents > 0)
    .sort((a, b) => b.valueCents - a.valueCents);

  // Agrupamento por setor / segmento
  const sectorMap = new Map<string, number>();
  for (const row of rows) {
    const label = row.sector?.trim() || inferSectorFromTicker(row.ticker, row.assetClass);
    const cents = Math.round(row.valueBRL * 100);
    sectorMap.set(label, (sectorMap.get(label) ?? 0) + cents);
  }
  const sectorSlices = Array.from(sectorMap.entries())
    .map(([label, valueCents]) => ({
      key: label,
      label,
      valueCents,
      subtitle: `${rows.filter((r) => (r.sector?.trim() || inferSectorFromTicker(r.ticker, r.assetClass)) === label).length} ativo(s)`,
      onClick: () => setBreakdownGroup({ type: "sector", name: label }),
    }))
    .filter((s) => s.valueCents > 0)
    .sort((a, b) => b.valueCents - a.valueCents);

  // Fatias individuais de cada ativo com clique interativo para ver detalhes
  const assetSlices = rows
    .filter((row) => row.valueBRL > 0)
    .sort((a, b) => b.valueBRL - a.valueBRL)
    .map((row) => ({
      key: row.assetId,
      label: row.ticker,
      valueCents: Math.round(row.valueBRL * 100),
      subtitle: row.sector ?? row.assetClass ?? (row.isCash ? "Caixa" : "Sem classe"),
      onClick: () => openDetail(row.assetId),
    }));

  const activeSlices =
    allocationMode === "sector"
      ? sectorSlices
      : allocationMode === "asset"
        ? assetSlices
        : classSlices;

  const series = position.monthlySeries ?? [];
  const allSeries = position.allMonthlySeries ?? series;
  const carouselSeries =
    allSeries.length > 12 ? allSeries.slice(-12) : allSeries.length > 0 ? allSeries : series;
  const totalReturnPnlBRL = position.totalReturnPnlBRL ?? position.unrealizedPnlBRL ?? 0;
  const totalReturnCents = numberToCents(totalReturnPnlBRL);
  const totalReturnPct = position.totalReturnPct ?? position.unrealizedPct ?? null;
  const unrealizedPnlBRL = position.unrealizedPnlBRL ?? 0;
  const capitalGainPct = position.unrealizedPct ?? null;

  // Termômetro de Concentração
  const concentration = calculatePortfolioConcentration(
    investmentRows.map((r) => ({
      assetId: r.assetId,
      ticker: r.ticker,
      valueBRL: r.valueBRL,
    })),
  );

  const targetsQuery = useAllocationTargets();
  const targets = targetsQuery.data ?? [];

  const driftItems = targets.map((t) => {
    const row = position.rows.find((r) => r.assetId === t.asset_id);
    const valCents = Math.round((row?.valueBRL ?? 0) * 100);
    return {
      id: t.id,
      name: row?.ticker ?? t.asset_id,
      currentValueCents: valCents,
      targetPercent: Number(t.target_percentage),
    };
  });

  const allocationDrift = calculateAllocationDrift({
    totalPortfolioCents: Math.round(position.totalBRL * 100),
    items: driftItems,
  });

  // ---------------------------------------------------------------------------
  // Métricas da TIR / Fluxo do Bolso (XIRR)
  // ---------------------------------------------------------------------------
  const portfolioIrr = position.portfolioIrr;
  const isIrrReady = Boolean(
    portfolioIrr?.isEligible && portfolioIrr.annualizedRatePct !== null,
  );
  const irrRate = portfolioIrr?.annualizedRatePct ?? (portfolioIrr?.status === "insufficient_history" && (portfolioIrr.periodRatePct ?? 0) <= 200 ? portfolioIrr.periodRatePct : null);
  const irrTone = isIrrReady ? ((irrRate ?? 0) >= 0 ? "positive" : "negative") : "default";

  const irrLabel = isIrrReady
    ? `${(portfolioIrr?.annualizedRatePct ?? 0) >= 0 ? "+" : ""}${(portfolioIrr?.annualizedRatePct ?? 0).toFixed(1)}% a.a.`
    : portfolioIrr?.status === "insufficient_history" && portfolioIrr.periodRatePct !== null && Math.abs(portfolioIrr.periodRatePct) <= 200
      ? `${portfolioIrr.periodRatePct >= 0 ? "+" : ""}${portfolioIrr.periodRatePct.toFixed(1)}% no período`
      : "Em formação";

  const irrHint =
    portfolioIrr?.status === "insufficient_capital_coverage"
      ? "Aguardando histórico de aportes"
      : portfolioIrr?.status === "insufficient_history"
        ? `Histórico de ${portfolioIrr.daysElapsed}d (mín. 30d)`
        : isIrrReady
          ? `Ponderada no tempo (${portfolioIrr?.daysElapsed}d)`
          : "Requer histórico de aportes";

  // ---------------------------------------------------------------------------
  // Métrica Primária Adaptativa: Rentabilidade da Carteira (TWR com fallback para Custódia)
  // ---------------------------------------------------------------------------
  const portfolioTwr = position.portfolioTwr;
  const isTwrReady = Boolean(portfolioTwr && portfolioTwr.status === "ok");
  const twrRate = portfolioTwr?.accumulatedRatePct ?? null;
  const twrTone = isTwrReady ? ((twrRate ?? 0) >= 0 ? "positive" : "negative") : "default";

  const isTwrActive = isTwrReady && twrRate !== null;
  const isCustodyActive = !isTwrActive && totalReturnPct !== null && totalReturnPct !== undefined;

  const rentabilidadeLabel = isTwrActive ? (
    <div className="flex items-center gap-1.5 min-w-0">
      <span className="truncate">Rentabilidade</span>
      <Badge variant="portfolio" size="xs" className="shrink-0 font-normal">
        TWR · Cotas
      </Badge>
      <Info className="size-3 text-muted-foreground shrink-0" aria-hidden="true" />
    </div>
  ) : isCustodyActive ? (
    <div className="flex items-center gap-1.5 min-w-0">
      <span className="truncate">Rentabilidade</span>
      <Badge variant="muted" size="xs" className="shrink-0 font-normal">
        Custódia Aberta
      </Badge>
      <Info className="size-3 text-muted-foreground shrink-0" aria-hidden="true" />
    </div>
  ) : (
    <div className="flex items-center gap-1.5 min-w-0">
      <span className="truncate">Rentabilidade</span>
      <Info className="size-3 text-muted-foreground shrink-0" aria-hidden="true" />
    </div>
  );

  const twrLabel = isTwrActive
    ? `${(twrRate ?? 0) >= 0 ? "+" : ""}${(twrRate ?? 0).toFixed(1)}%`
    : "Em formação";

  const rentabilidadeValue = isTwrActive
    ? twrLabel
    : isCustodyActive
      ? `${totalReturnPct >= 0 ? "+" : ""}${totalReturnPct.toFixed(1)}%`
      : "Em formação";

  const rentabilidadeTone = isTwrActive
    ? ((twrRate ?? 0) >= 0 ? "positive" : "negative")
    : isCustodyActive
      ? (totalReturnPnlBRL >= 0 ? "positive" : "negative")
      : "default";

  const rentabilidadeHint = isTwrActive
    ? (portfolioTwr?.annualizedRatePct !== null && portfolioTwr?.annualizedRatePct !== undefined
        ? `${portfolioTwr.annualizedRatePct >= 0 ? "+" : ""}${portfolioTwr.annualizedRatePct.toFixed(1)}% a.a. (${portfolioTwr.monthsElapsed}m)`
        : `Por cotas (${portfolioTwr?.monthsElapsed ?? 0}m)`)
    : isCustodyActive
      ? `${totalReturnPnlBRL >= 0 ? "+" : ""}${formatCentsAsBRL(totalReturnCents)} s/ custo`
      : "Cadastre seus ativos";

  return (
    <div className="flex flex-col gap-6">
      {position.error ? (
        <ErrorState message={getErrorMessage(position.error)} onRetry={position.refetch} />
      ) : null}

      {/* Grid de KPIs da Carteira — 1 col mobile, 2 em tablet, 4 no desktop amplo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {position.isLoading ? (
          <>
            <SkeletonKpi className="col-span-1" />
            <SkeletonKpi className="col-span-1" />
            <SkeletonKpi className="col-span-1" />
            <SkeletonKpi className="col-span-1" />
          </>
        ) : (
          <>
            {/* 1. Patrimônio Total */}
            <KpiCard
              label="Patrimônio Total"
              cents={numberToCents(position.totalBRL)}
              hint={
                <span
                  className={cn(
                    "inline-flex items-center gap-1 font-mono text-[11px] font-medium truncate max-w-full",
                    totalReturnPnlBRL > 0
                      ? "text-positive-strong"
                      : totalReturnPnlBRL < 0
                        ? "text-negative-strong"
                        : "text-foreground",
                  )}
                  title={`Retorno Contábil da Custódia Aberta: ${(totalReturnPnlBRL ?? 0) >= 0 ? "+" : ""}${formatCentsAsBRL(numberToCents(totalReturnPnlBRL ?? 0))}${totalReturnPct != null ? ` (${totalReturnPct >= 0 ? "+" : ""}${totalReturnPct.toFixed(1)}%)` : ""} | Cotação: ${(unrealizedPnlBRL ?? 0) >= 0 ? "+" : ""}${formatCentsAsBRL(numberToCents(unrealizedPnlBRL ?? 0))}${capitalGainPct != null ? ` (${capitalGainPct >= 0 ? "+" : ""}${capitalGainPct.toFixed(1)}%)` : ""} | Proventos Ativos: +${formatCentsAsBRL(numberToCents(position.totalDividendsBRL ?? 0))}`}
                >
                  <span className="text-muted-foreground font-normal">Retorno contábil:</span>
                  <span className="tabular-nums font-semibold">
                    {totalReturnPct != null
                      ? `${totalReturnPct >= 0 ? "+" : ""}${totalReturnPct.toFixed(1)}%`
                      : "0,0%"}
                  </span>
                </span>
              }
              onClick={() => setExplainModalOpen(true)}
            />

            {/* 2. Rentabilidade da Carteira (Adaptativa: TWR ou Custódia Aberta) */}
            <KpiCard
              label={rentabilidadeLabel}
              value={rentabilidadeValue}
              tone={rentabilidadeTone}
              hint={rentabilidadeHint}
              onClick={() => setExplainModalOpen(true)}
            />

            {/* 3. Resultado Histórico em R$ (P&L Total) */}
            <KpiCard
              label={
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="truncate">Resultado Histórico</span>
                  <Info className="size-3 text-muted-foreground shrink-0" aria-hidden="true" />
                </div>
              }
              cents={numberToCents(position.allTimeEconomicPnlBRL ?? totalReturnPnlBRL)}
              tone={(position.allTimeEconomicPnlBRL ?? totalReturnPnlBRL) >= 0 ? "positive" : "negative"}
              hint={
                <span
                  className="text-[11px] font-mono text-muted-foreground truncate"
                  title={`P&L Histórico Total: ${formatCentsAsBRL(numberToCents(position.allTimeEconomicPnlBRL ?? totalReturnPnlBRL))} | Passado Realizado: ${formatCentsAsBRL(numberToCents(position.realizedPnlBRL ?? 0))} | Aberto: ${formatCentsAsBRL(numberToCents(totalReturnPnlBRL))} | Proventos Totais: ${formatCentsAsBRL(numberToCents(position.totalDividendsBRL ?? 0))}`}
                >
                  P&L Total ({(position.realizedPnlBRL ?? 0) >= 0 ? "+" : ""}{formatCentsAsBRL(numberToCents(position.realizedPnlBRL ?? 0))} pass.)
                </span>
              }
              onClick={() => setExplainModalOpen(true)}
            />

            {/* 4. Retorno do Bolso (TIR / XIRR) */}
            <KpiCard
              label={
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="truncate">TIR (Fluxo do Bolso)</span>
                  <Info className="size-3 text-muted-foreground shrink-0" aria-hidden="true" />
                </div>
              }
              value={irrLabel}
              tone={irrTone}
              hint={irrHint}
              onClick={() => setExplainModalOpen(true)}
            />
          </>
        )}
      </div>

      {/* Card Exclusivo de Caixa & Liquidez da Carteira */}
      <CashKpiCard
        variant="banner"
        cashBRL={position.cashBRL}
        cashPct={position.totalBRL > 0 ? (position.cashBRL / position.totalBRL) * 100 : 0}
        hasCashAsset={Boolean(cashAsset)}
        isLoading={position.isLoading}
        onEdit={handleOpenCash}
        onDelete={() => {
          if (cashAsset) setAssetToDelete(cashAsset);
        }}
        onAporte={() => (onSelectTab ? onSelectTab("aporte") : navigate("/carteira?tab=aporte"))}
      />

      {/* Alerta de Concentração Elevada */}
      {concentration.isConcentrated && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-negative/30 bg-negative/5 p-4 text-xs text-foreground shadow-xs">
          <Shield className="size-4 shrink-0 text-negative-strong mt-0.5" aria-hidden="true" />
          <div className="flex flex-col gap-1">
            <span className="font-semibold text-negative-strong">Alerta de Concentração na Carteira</span>
            <span className="text-muted-foreground">
              Seu maior ativo ({concentration.concentratedAssets[0]?.ticker}) representa{" "}
              <strong className="font-mono text-foreground">
                {concentration.concentratedAssets[0]?.pct.toFixed(1)}%
              </strong>{" "}
              do patrimônio investido. Considere diversificar nos próximos aportes.
            </span>
          </div>
        </div>
      )}

      {/* Estado Vazio de Investimentos */}
      {!position.isLoading && !hasInvestments && (
        <EmptyState
          icon={<TrendingUp className="size-6" />}
          title="Nenhum ativo cadastrado"
          headingLevel="h2"
          description="Adicione seus investimentos ou registre seu saldo em caixa para iniciar o acompanhamento patrimonial."
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => handleOpenWizard(null, "select")}
              >
                <Plus aria-hidden="true" className="size-4" />
                Nova Operação
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={handleOpenCash}>
                Cadastrar Saldo em Caixa
              </Button>
            </div>
          }
        />
      )}

      {/* Conteúdo com Ativos Cadastrados */}
      {!position.isLoading && hasInvestments && (
        <>
          {/* Card de Diagnóstico de Desvio de Alocação */}
          {allocationDrift.hasTargets && (
            <AllocationDriftCard
              analysis={allocationDrift}
              onSimulateAporte={() => (onSelectTab ? onSelectTab("aporte") : navigate("/carteira?tab=aporte"))}
            />
          )}

          {/* Seção Gráfica: Alocação Visual */}
          <section aria-label="Alocação da Carteira" className="rounded-2xl border border-border/80 bg-surface/90 p-4 sm:p-5 shadow-xs transition-all hover:border-border min-w-0 overflow-hidden">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <PieChart className="size-4 text-portfolio shrink-0" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-foreground">Distribuição Patrimonial</h2>
              </div>

              <div className="flex items-center gap-1.5 self-end sm:self-auto">
                <div className="inline-flex rounded-lg border border-border/80 bg-surface p-0.5">
                  <button
                    type="button"
                    onClick={() => setAllocationMode("class")}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                      allocationMode === "class"
                        ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Por Classe
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllocationMode("sector")}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                      allocationMode === "sector"
                        ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Por Setor
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllocationMode("asset")}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                      allocationMode === "asset"
                        ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Por Ativo
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center">
              <CategoryDonut
                slices={activeSlices}
                totalCents={numberToCents(position.totalBRL)}
                className="w-full max-w-full"
              />
            </div>
          </section>

          {/* Seção de Custódia e Posição Atual */}
          <section aria-label="Posições da Carteira" className="rounded-2xl border border-border/80 bg-surface/90 p-4 sm:p-5 shadow-xs transition-all hover:border-border min-w-0 overflow-hidden">
            <div className="mb-4 flex items-center justify-between gap-2 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <TrendingUp className="size-4 text-portfolio shrink-0" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-foreground truncate">Posição Consolidada</h2>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setExecutiveReportOpen(true)}
                  className="size-8 p-0 sm:w-auto sm:h-8 sm:px-3 text-xs gap-1.5 shrink-0"
                  title="Visualizar e Imprimir Relatório Executivo da Carteira"
                  aria-label="Relatório Executivo"
                >
                  <FileText aria-hidden="true" className="size-3.5" />
                  <span className="hidden md:inline">Relatório</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => syncQuotes.mutate(assetsQuery.data ?? [])}
                  disabled={syncQuotes.isPending}
                  className="size-8 p-0 sm:w-auto sm:h-8 sm:px-3 text-xs gap-1.5 shrink-0"
                  title="Atualizar cotações de mercado via API"
                  aria-label="Atualizar cotações"
                >
                  <RefreshCw
                    aria-hidden="true"
                    className={`size-3.5 ${syncQuotes.isPending ? "animate-spin" : ""}`}
                  />
                  <span className="hidden md:inline">{syncQuotes.isPending ? "Atualizando…" : "Atualizar"}</span>
                </Button>
              </div>
            </div>

            <PositionTable
              rows={investmentRows}
              sortable
              highlightId={highlightId}
              onListTransactions={openDetail}
              onEditAsset={openEdit}
              onCalibrateAsset={(assetId, _ticker, currentValueCents) => {
                const asset = assetById(assetId);
                if (asset) {
                  setCalibrateFor({ asset, valueCents: currentValueCents });
                }
              }}
              onSetManualPrice={(assetId, ticker, currency, priceBRL, source, priceQuote, pricingMode, usdRate) => {
                setPriceFor({ id: assetId, ticker, currency, priceQuote, priceBRL, usdRate, source, pricingMode });
              }}
              onDeleteAsset={openDelete}
            />
          </section>

          {/* Seção de Evolução Patrimonial (Carrossel Horizontal de Snapshots) */}
          <PortfolioSnapshotsCarousel
            series={carouselSeries}
            totalMonthsCount={allSeries.length}
            currentMonthStr={month}
            onOpenAnalyticsDialog={() => setSnapshotsDialogOpen(true)}
          />
        </>
      )}


      {/* Investment Wizard Unificado (quando renderizado standalone) */}
      {!onOpenWizard ? (
        <InvestmentWizard
          open={isWizardOpen}
          onOpenChange={handleWizardOpenChange}
          initialAsset={wizardInitialAsset}
          initialMode={wizardInitialMode}
        />
      ) : null}

      {/* Asset Detail Sheet (Visão Dedicada) */}
      <AssetDetailSheet
        open={activeDetailAsset !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDetailAsset(null);
            setDismissedHighlight(true);
          }
        }}
        asset={activeDetailAsset}
        onAction={(action, asset) => {
          setDetailAsset(null);
          setDismissedHighlight(true);
          const mode: WizardMode =
            action === "sell" || action === "dividend" || action === "split" ? action : "buy";
          openWizardForAsset(asset.id, mode);
        }}
      />

      {/* Diálogo de Edição Cadastral */}
      {assetEditing ? (
        <AssetEditDialog
          open={assetEditing !== null}
          onOpenChange={(open) => !open && setAssetEditing(null)}
          asset={assetEditing}
        />
      ) : null}

      {/* CashFormDialog (quando renderizado standalone) */}
      {!onOpenCash ? (
        <CashFormDialog
          open={activeCashDialogOpen}
          onOpenChange={(open) => {
            setCashDialogOpen(open);
            if (!open) setDismissedHighlight(true);
          }}
          asset={cashAsset ?? null}
        />
      ) : null}

      {calibrateFor ? (
        <CalibrateFixedIncomeDialog
          key={calibrateFor.asset.id}
          open={calibrateFor !== null}
          onOpenChange={(next) => !next && setCalibrateFor(null)}
          asset={calibrateFor.asset}
          currentEstimatedValueCents={calibrateFor.valueCents}
        />
      ) : null}

      {priceFor ? (
        <ManualPriceDialog
          key={priceFor.id}
          open={priceFor !== null}
          onOpenChange={(next) => !next && setPriceFor(null)}
          asset={priceFor}
        />
      ) : null}


      {/* Confirmação de Exclusão */}
      <ConfirmDialog
        open={assetToDelete !== null}
        onOpenChange={(next) => !next && setAssetToDelete(null)}
        title={assetToDelete ? `Excluir ${assetToDelete.ticker}?` : "Excluir ativo?"}
        description="O ativo e suas metas de alocação serão removidos da carteira. A posição é recalculada automaticamente."
        confirmLabel="Excluir"
        variant="destructive"
        confirmPending={deleteAsset.isPending}
        onConfirm={() => {
          if (!assetToDelete) return;
          const assetId = assetToDelete.id;
          void Promise.resolve(deleteAsset.mutateAsync(assetId)).finally(() => setAssetToDelete(null));
        }}
      />

      {/* Raio-X Analítico de Classe e Setor via Donut */}
      <AllocationBreakdownDialog
        open={breakdownGroup !== null}
        onOpenChange={(open) => {
          if (!open) setBreakdownGroup(null);
        }}
        type={breakdownGroup?.type ?? "class"}
        groupName={breakdownGroup?.name ?? null}
        rows={rows}
        totalPortfolioBRL={position.totalBRL}
        targetPercent={
          breakdownGroup?.type === "class"
            ? classTargetsQuery.data?.find((t) => t.name === breakdownGroup.name)?.target_percentage ?? null
            : breakdownGroup?.name
              ? sectorTargetsQuery.data?.find((t) => t.name === breakdownGroup.name)?.target_percentage ?? null
              : null
        }
        onSelectAsset={(assetId) => openDetail(assetId)}
        onNavigateToTargets={onSelectTab ? () => onSelectTab("targets") : undefined}
      />

      {/* Modal Didático: Entenda os Modelos de Rentabilidade */}
      <Modal
        open={explainModalOpen}
        onOpenChange={setExplainModalOpen}
        title="Modelos de Rentabilidade da Carteira"
        description="Entenda como cada método avalia seu patrimônio com transparência e sem armadilhas matemáticas."
        size="lg"
      >
        <div className="flex flex-col gap-3.5 text-xs mt-2">
          {/* Calibragem de Dados Anteriores ao App (Marcos Históricos) */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0">
              <Info className="size-4 text-primary shrink-0 mt-0.5" aria-hidden="true" />
              <div className="flex flex-col gap-0.5 text-[11px] leading-relaxed text-muted-foreground min-w-0">
                <span className="font-semibold text-foreground">Calibragem de Dados Anteriores ao App</span>
                <p>
                  Se você investia antes de começar no app, cadastre seus Marcos Históricos ou importe seu extrato no assistente para que a TIR e o TWR considerem os aportes e lucros passados com precisão matemática.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant={position.hasMarcoZeroContribution ? "outline" : "default"}
              size="sm"
              onClick={() => {
                setExplainModalOpen(false);
                setInitialCostDialogOpen(true);
              }}
              className="gap-1.5 shrink-0 w-full sm:w-auto text-xs"
            >
              <span>{position.hasMarcoZeroContribution ? "Gerenciar Marcos Históricos" : "Cadastrar Marcos Históricos"}</span>
            </Button>
          </div>

          {/* Ponto 1: Card 1 do Dashboard — Patrimônio Total & Retorno Contábil */}
          <div className="rounded-xl border border-border/80 bg-surface/40 p-3.5 flex flex-col justify-between gap-2.5">
            <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-1.5 flex-wrap">
              <span className="font-semibold text-foreground text-sm flex items-center gap-1.5 min-w-0">
                <Briefcase className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                <span className="truncate">1. Patrimônio Total & Retorno Contábil</span>
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <Badge variant={totalReturnPnlBRL >= 0 ? "positive" : "negative"} size="xs" className="font-mono font-bold">
                  {totalReturnPct !== null ? `${totalReturnPct >= 0 ? "+" : ""}${totalReturnPct.toFixed(1)}%` : "—"}
                </Badge>
                <span className="font-mono text-xs font-semibold text-foreground">
                  (<MoneyText cents={totalReturnCents} tone="auto" sign="explicit" />)
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[9.5px] font-bold text-muted-foreground tracking-wider uppercase">
                Ganho Estático das Posições Ativas
              </span>
              <p className="text-muted-foreground leading-relaxed m-0 text-xs">
                O valor de mercado sob custódia hoje somado ao caixa. Reflete o ganho estático das posições abertas frente ao custo de aquisição mais proventos ativos. Não considera o tempo decorrido nem ativos já encerrados.
              </p>
            </div>
            <div className="pt-1.5 border-t border-border/40 flex items-center justify-between">
              <Badge variant="muted" size="xs" className="text-[9.5px] font-medium text-muted-foreground">
                Recomendado para: Posições em custódia ativa
              </Badge>
            </div>
          </div>

          {/* Ponto 2: Card 2 do Dashboard — Rentabilidade da Carteira (TWR — Padrão CVM/ANBIMA) */}
          <div className="rounded-xl border border-border/80 bg-surface/40 p-3.5 flex flex-col justify-between gap-2.5">
            <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-1.5 flex-wrap">
              <span className="font-semibold text-foreground text-sm flex items-center gap-1.5 min-w-0">
                <TrendingUp className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                <span className="truncate">2. Rentabilidade da Carteira (TWR · Cotas)</span>
              </span>
              <Badge variant={twrTone === "positive" ? "positive" : twrTone === "negative" ? "negative" : "muted"} size="xs" className="font-mono font-bold shrink-0">
                {twrLabel} {portfolioTwr?.annualizedRatePct !== null && portfolioTwr?.annualizedRatePct !== undefined ? `(${portfolioTwr.annualizedRatePct >= 0 ? "+" : ""}${portfolioTwr.annualizedRatePct.toFixed(1)}% a.a.)` : ""}
              </Badge>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[9.5px] font-bold text-muted-foreground tracking-wider uppercase">
                Métrica Oficial da Carteira
              </span>
              <p className="text-muted-foreground leading-relaxed m-0 text-xs">
                Apura o retorno real das suas decisões de investimento utilizando o método oficial de cotização de fundos. Isola o timing de aportes e resgates, mostrando o mérito da alocação e protegendo os lucros de ativos passados já encerrados na cota histórica.
              </p>
            </div>
            <div className="pt-1.5 border-t border-border/40 flex items-center justify-between">
              <Badge variant="muted" size="xs" className="text-[9.5px] font-medium text-muted-foreground">
                Recomendado para: Comparação com CDI e Ibovespa
              </Badge>
            </div>
          </div>

          {/* Ponto 3: Card 3 do Dashboard — Resultado Histórico (P&L Total em R$) */}
          <div className="rounded-xl border border-border/80 bg-surface/40 p-3.5 flex flex-col justify-between gap-2.5">
            <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-1.5 flex-wrap">
              <span className="font-semibold text-foreground text-sm flex items-center gap-1.5 min-w-0">
                <CircleDollarSign className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                <span className="truncate">3. Resultado Histórico (P&L Total em R$)</span>
              </span>
              <Badge variant={(position.allTimeEconomicPnlBRL ?? totalReturnPnlBRL) >= 0 ? "positive" : "negative"} size="xs" className="font-mono font-bold shrink-0">
                <MoneyText cents={numberToCents(position.allTimeEconomicPnlBRL ?? totalReturnPnlBRL)} tone={(position.allTimeEconomicPnlBRL ?? totalReturnPnlBRL) >= 0 ? "positive" : "negative"} sign="explicit" />
              </Badge>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[9.5px] font-bold text-muted-foreground tracking-wider uppercase">
                Riqueza Efetiva Produzida
              </span>
              <p className="text-muted-foreground leading-relaxed m-0 text-xs">
                Consolida todo o lucro líquido gerado pela sua carteira desde o início. Soma o lucro realizado de ativos já vencidos/vendidos no passado, a valorização das posições abertas de hoje e todos os proventos recebidos na história.
              </p>
            </div>
            <div className="pt-1.5 border-t border-border/40 flex items-center justify-between">
              <Badge variant="muted" size="xs" className="text-[9.5px] font-medium text-muted-foreground">
                Recomendado para: Dimensão financeira total e caixa
              </Badge>
            </div>
          </div>

          {/* Ponto 4: Card 4 do Dashboard — Retorno do Bolso (TIR / XIRR) */}
          <div className="rounded-xl border border-border/80 bg-surface/40 p-3.5 flex flex-col justify-between gap-2.5">
            <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-1.5 flex-wrap">
              <span className="font-semibold text-foreground text-sm flex items-center gap-1.5 min-w-0">
                <Activity className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                <span className="truncate">4. Retorno do Bolso (TIR / XIRR)</span>
              </span>
              <Badge variant={irrTone === "positive" ? "positive" : irrTone === "negative" ? "negative" : "muted"} size="xs" className="font-mono font-bold shrink-0">
                {irrLabel}
              </Badge>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[9.5px] font-bold text-muted-foreground tracking-wider uppercase">
                Retorno do Seu Fluxo Pessoal
              </span>
              <p className="text-muted-foreground leading-relaxed m-0 text-xs">
                Taxa anualizada (% a.a.) do dinheiro real que saiu da sua conta bancária para a corretora frente ao patrimônio atual. Pondera o volume pelo tempo: fases em que você tinha mais capital aplicado exercem peso proporcionalmente maior na taxa.
              </p>
            </div>
            <div className="pt-1.5 border-t border-border/40 flex items-center justify-between">
              <Badge variant="muted" size="xs" className="text-[9.5px] font-medium text-muted-foreground">
                Recomendado para: Eficiência do timing de aportes
              </Badge>
            </div>
          </div>

          {/* Ponto 5: Comparação com Benchmarks & Disclaimers */}
          <div className="rounded-xl border border-border/80 bg-surface/40 p-3.5 flex flex-col justify-between gap-2.5">
            <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-1.5 flex-wrap">
              <span className="font-semibold text-foreground text-sm flex items-center gap-1.5 min-w-0">
                <Landmark className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                <span className="truncate">5. Comparação com Benchmarks e Referências de Mercado</span>
              </span>
              <Badge variant="muted" size="xs" className="font-mono font-bold shrink-0">
                CDI · Ibov · IPCA
              </Badge>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[9.5px] font-bold text-muted-foreground tracking-wider uppercase">
                Diretrizes de Comparabilidade e Disclaimers
              </span>
              <p className="text-muted-foreground leading-relaxed m-0 text-xs">
                Para comparar sua carteira com CDI, Ibovespa ou fundos de mercado, utilize sempre o TWR (% a.a.), pois os indexadores são calculados por rentabilidade de cotas e não sofrem o impacto do fluxo de aportes e retiradas. A TIR (% a.a.) apura o retorno financeiro ponderado do seu fluxo de caixa pessoal, não sendo diretamente comparável a benchmarks passivos. Rentabilidade passada não representa garantia de retorno futuro.
              </p>
            </div>
            <div className="pt-1.5 border-t border-border/40 flex items-center justify-between">
              <Badge variant="muted" size="xs" className="text-[9.5px] font-medium text-muted-foreground">
                Recomendado para: Comparação justa e alinhamento metodológico
              </Badge>
            </div>
          </div>
        </div>
      </Modal>

      <InitialPocketCostDialog
        open={initialCostDialogOpen}
        onOpenChange={setInitialCostDialogOpen}
        defaultCostBRL={position.totalCostBRL}
      />

      {/* Relatório Executivo da Carteira */}
      <PortfolioExecutiveReport
        open={executiveReportOpen}
        onOpenChange={setExecutiveReportOpen}
        rows={position.rows}
        totalBRL={position.totalBRL}
        cashBRL={position.cashBRL}
        yearDividendsBRL={position.totalDividendsBRL}
        portfolioIrr={position.portfolioIrr}
        portfolioTwr={position.portfolioTwr}
        totalReturnPct={position.totalReturnPct}
        totalReturnPnlBRL={position.totalReturnPnlBRL}
        allTimeEconomicPnlBRL={position.allTimeEconomicPnlBRL}
      />

      {/* Extrato Analítico Completo de Snapshots Mensais */}
      <PortfolioSnapshotsDialog
        open={snapshotsDialogOpen}
        onOpenChange={setSnapshotsDialogOpen}
        series={allSeries}
        currentMonthStr={month}
      />
    </div>
  );
}
