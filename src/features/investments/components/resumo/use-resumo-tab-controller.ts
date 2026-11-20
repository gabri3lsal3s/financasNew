import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import type { PriceSource } from "@/domain/portfolio";
import { calculatePortfolioConcentration, isCashAssetClass } from "@/domain/portfolio";
import {
  buildAssetAllocationSummaries,
  buildClassAllocationSummaries,
  buildPortfolioPerformanceSummary,
  buildSectorAllocationSummaries,
} from "@/domain/portfolio/resumo-metrics";
import { currentMonth } from "@/lib/date";
import { useCreateDeepLink } from "@/hooks/use-create-deep-link";
import {
  useGroupTargets,
  usePortfolioAssets,
  usePortfolioPosition,
  useSyncQuotes,
} from "@/state";
import type { AssetCurrency, PortfolioAsset, PortfolioTransactionType } from "@/types";
import type { WizardMode } from "../../wizard/wizard-state";
import type { OpenWizardOptions } from "./use-investments-page-controller";
import { useResumoDeepLinks } from "./use-resumo-deep-links";

export interface UseResumoTabControllerParams {
  onOpenWizard?: (
    asset?: PortfolioAsset | null,
    mode?: WizardMode,
    options?: OpenWizardOptions,
  ) => void;
  onOpenCash?: () => void;
  onSelectTab?: (tab: string, params?: Record<string, string | number>) => void;
}

export function useResumoTabController({
  onOpenWizard,
  onOpenCash,
  onSelectTab,
}: UseResumoTabControllerParams = {}) {
  const navigate = useNavigate();
  const position = usePortfolioPosition();
  const assetsQuery = usePortfolioAssets();
  const classTargetsQuery = useGroupTargets("class");
  const sectorTargetsQuery = useGroupTargets("sector");
  const syncQuotes = useSyncQuotes();

  const { open: wizardDeepOpen, setOpen: setWizardDeepOpen } = useCreateDeepLink("investimento");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardInitialAsset, setWizardInitialAsset] = useState<PortfolioAsset | null>(null);
  const [wizardInitialMode, setWizardInitialMode] = useState<WizardMode>("select");
  const [wizardInitialQuantity, setWizardInitialQuantity] = useState<number | string | null>(null);
  const [wizardInitialTotalCents, setWizardInitialTotalCents] = useState<number | null>(null);
  const [snapshotsDialogOpen, setSnapshotsDialogOpen] = useState(false);
  const [executiveReportOpen, setExecutiveReportOpen] = useState(false);
  const [reportSelectedMonth, setReportSelectedMonth] = useState<string | undefined>(undefined);
  const [cashDialogOpen, setCashDialogOpen] = useState(false);
  const [quickTxAsset, setQuickTxAsset] = useState<PortfolioAsset | null>(null);
  const [quickTxType, setQuickTxType] = useState<PortfolioTransactionType>("buy");
  const [assetEditing, setAssetEditing] = useState<PortfolioAsset | null>(null);
  const [scoreEvaluatingAsset, setScoreEvaluatingAsset] = useState<PortfolioAsset | null>(null);
  const [initialCostDialogOpen, setInitialCostDialogOpen] = useState(false);
  const setExplainModalOpen = useCallback((open: boolean) => {
    setInitialCostDialogOpen(open);
  }, []);
  const explainModalOpen = initialCostDialogOpen;
  const [allocationMode, setAllocationMode] = useState<"class" | "sector" | "asset">("class");
  const [breakdownGroup, setBreakdownGroup] = useState<{
    type: "class" | "sector";
    name: string;
    parentClass?: string;
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

  const handleOpenCash = useCallback(() => {
    if (onOpenCash) onOpenCash();
    else setCashDialogOpen(true);
  }, [onOpenCash]);

  const rows = position.rows;
  const deepLinks = useResumoDeepLinks({
    assets: assetsQuery.data,
    assetsLoading: assetsQuery.isLoading,
    rows,
    onSyncQuotes: (list) => syncQuotes.mutate(list),
    onOpenCashModal: handleOpenCash,
    onOpenCashProp: onOpenCash,
    onEditAsset: setAssetEditing,
  });

  const handleWizardOpenChange = (next: boolean) => {
    setWizardOpen(next);
    setWizardDeepOpen(next);
    if (!next) {
      setWizardInitialAsset(null);
      setWizardInitialMode("select");
      setWizardInitialQuantity(null);
      setWizardInitialTotalCents(null);
    }
  };

  const handleOpenWizard = useCallback(
    (asset: PortfolioAsset | null = null, mode: WizardMode = "select", options?: OpenWizardOptions) => {
      if (onOpenWizard) {
        onOpenWizard(asset, mode, options);
      } else {
        setWizardInitialAsset(asset);
        setWizardInitialMode(mode);
        setWizardInitialQuantity(options?.initialQuantity ?? null);
        setWizardInitialTotalCents(options?.initialTotalCents ?? null);
        setWizardOpen(true);
      }
    },
    [onOpenWizard],
  );

  const investmentRows = useMemo(() => rows.filter((r) => !r.isCash), [rows]);
  const cashAsset = useMemo(
    () =>
      (assetsQuery.data ?? []).find(
        (a) => isCashAssetClass(a.asset_class) || a.ticker.toUpperCase() === "CAIXA",
      ) ?? null,
    [assetsQuery.data],
  );

  const classSlices = useMemo(
    () =>
      buildClassAllocationSummaries(rows).map((item) => ({
        ...item,
        onClick: () => setBreakdownGroup({ type: "class", name: item.label }),
      })),
    [rows],
  );
  const sectorSlices = useMemo(
    () =>
      buildSectorAllocationSummaries(rows).map((item) => ({
        ...item,
        onClick: () => setBreakdownGroup({ type: "sector", name: item.label }),
      })),
    [rows],
  );
  const { openDetail } = deepLinks;
  const assetSlices = useMemo(
    () =>
      buildAssetAllocationSummaries(rows).map((item) => ({
        ...item,
        onClick: () => openDetail(item.key),
      })),
    [rows, openDetail],
  );

  const activeSlices = useMemo(
    () =>
      allocationMode === "sector"
        ? sectorSlices
        : allocationMode === "asset"
          ? assetSlices
          : classSlices,
    [allocationMode, sectorSlices, assetSlices, classSlices],
  );

  const concentration = useMemo(
    () =>
      calculatePortfolioConcentration(
        investmentRows.map((r) => ({ assetId: r.assetId, ticker: r.ticker, valueBRL: r.valueBRL })),
      ),
    [investmentRows],
  );

  const performance = useMemo(() => buildPortfolioPerformanceSummary(position), [position]);
  const series = position.monthlySeries ?? [];
  const allSeries = position.allMonthlySeries ?? series;
  const carouselSeries =
    allSeries.length > 12 ? allSeries.slice(-12) : allSeries.length > 0 ? allSeries : series;

  return {
    navigate,
    position,
    assetsQuery,
    classTargetsQuery,
    sectorTargetsQuery,
    syncQuotes,
    month: currentMonth(),
    rows,
    investmentRows,
    cashAsset,
    hasInvestments: rows.length > 0,
    ...deepLinks,
    activeCashDialogOpen: cashDialogOpen || deepLinks.isDeepLinkedCash,
    setCashDialogOpen,
    assetEditing,
    setAssetEditing,
    scoreEvaluatingAsset,
    setScoreEvaluatingAsset,
    explainModalOpen,
    setExplainModalOpen,
    initialCostDialogOpen,
    setInitialCostDialogOpen,
    allocationMode,
    setAllocationMode,
    breakdownGroup,
    setBreakdownGroup,
    calibrateFor,
    setCalibrateFor,
    priceFor,
    setPriceFor,
    snapshotsDialogOpen,
    setSnapshotsDialogOpen,
    executiveReportOpen,
    setExecutiveReportOpen,
    reportSelectedMonth,
    setReportSelectedMonth,
    quickTxAsset,
    setQuickTxAsset,
    quickTxType,
    setQuickTxType,
    isWizardOpen: wizardOpen || wizardDeepOpen,
    wizardInitialAsset,
    wizardInitialMode,
    wizardInitialQuantity,
    wizardInitialTotalCents,
    handleWizardOpenChange,
    handleOpenWizard,
    handleOpenCash,
    activeSlices,
    concentration,
    performance,
    allSeries,
    carouselSeries,
    onOpenWizard,
    onOpenCash,
    onSelectTab,
  };
}
