/**
 * Mapeadores e construtores puros do motor de Aporte Inteligente (§F36).
 * Funções 100% puras sem dependência de UI ou Supabase (AGENTS.md §3).
 */

import { formatCentsAsBRL } from "@/services/masks";
import type { AssetCurrency, GroupTarget, PortfolioAsset } from "@/types";
import { calculateEffectiveAssetTargets } from "./allocation";
import {
  deriveAporteSuggestionReason,
  type AporteReasonKind,
} from "./aporte-reasons";
import {
  simulateConstrainedAporte,
  type AporteAssetInput,
  type AporteOverflowEvent,
  type AporteOverridesMap,
  type AporteStrategy,
  type CeilingAporteSensitivity,
  type ClassTargetInput,
  type ConstrainedAporteResult,
  type PausedAssetDiagnostic,
  type SectorTargetInput,
} from "./aporte";
import { calculatePortfolioDiversification } from "./diversification-metrics";
import type { PortfolioRiskPolicy } from "./portfolio-risk-policy";
import { inferSectorFromTicker } from "./tickers-catalog";
import { FALLBACK_USD_RATE, normalizeClassName } from "./valuation";

/**
 * Gera um identificador único de lote (UUID v4) seguro para persistência e Undo.
 */
export function generateBatchId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface AportePositionRowInput {
  assetId: string;
  ticker: string;
  assetClass: string | null;
  sector?: string | null;
  currency: AssetCurrency;
  valueBRL: number;
  priceBRL: number;
  usdRate?: number;
  isCash: boolean;
}

export interface MappedAporteRoute {
  assetId: string;
  ticker: string;
  assetClass: string | null;
  sector?: string | null;
  targetValueBRL: number;
  currentValueBRL: number;
  gapBRL: number;
  allocatedBRL: number;
  quantity: number;
  priceBRL: number;
  rawScore?: number | null;
  effectiveTargetPct?: number;
  formulaLabel?: string;
  reasonKind?: AporteReasonKind;
  reasonLabel?: string;
  reasonDescription?: string;
  hasQualityConflict?: boolean;
  qualityConflictDetail?: string;
  lastReviewedAt?: string | null;
  reviewFrequencyMonths?: number;
  headroomBRL?: number;
  isConstrainedByCeiling?: boolean;
  ceilingReason?: string;
}

export interface BatchAporteItemInput {
  assetId: string;
  ticker: string;
  quantity: number;
  priceBRL: number;
  allocatedBRL: number;
}

export interface DiversificationImpactSummary {
  currentNef: number | null;
  projectedNef: number | null;
  deltaNefPct: number | null;
  currentNefStocks: number | null;
  projectedNefStocks: number | null;
  topAssetTicker: string | null;
  currentTopAssetSharePct: number | null;
  projectedTopAssetSharePct: number | null;
}

export interface BuildAporteSimulationInput {
  totalPurchasingCents: number;
  positionRows: readonly AportePositionRowInput[];
  rawAssets: readonly PortfolioAsset[];
  rawClassTargets: readonly GroupTarget[];
  rawSectorTargets: readonly GroupTarget[];
  policy?: Partial<PortfolioRiskPolicy>;
  strategy?: AporteStrategy;
  ceilingSensitivity?: CeilingAporteSensitivity;
  overrides?: AporteOverridesMap;
}

export interface AporteSimulationViewModel {
  nonCashRows: AportePositionRowInput[];
  result: ConstrainedAporteResult | null;
  routes: MappedAporteRoute[];
  eligibleRoutes: MappedAporteRoute[];
  pausedAssets: PausedAssetDiagnostic[];
  overflowEvents: AporteOverflowEvent[];
  diversificationImpact: DiversificationImpactSummary | null;
}

/**
 * Converte posição atual, cadastro de ativos e metas de classe/setor
 * em rotas simuladas de rebalanceamento com metadados de convicção e meta efetiva.
 */
export function buildAporteSimulationViewModel({
  totalPurchasingCents,
  positionRows,
  rawAssets,
  rawClassTargets,
  rawSectorTargets,
  policy,
  strategy,
  ceilingSensitivity,
  overrides,
}: BuildAporteSimulationInput): AporteSimulationViewModel {
  const nonCashRows = positionRows.filter((r) => !r.isCash);
  const classes = [
    ...new Set(nonCashRows.map((r) => r.assetClass).filter((c): c is string => c !== null)),
  ];
  const rawAssetMap = new Map(rawAssets.map((a) => [a.id, a]));

  const classTargets: ClassTargetInput[] = rawClassTargets.map((t) => ({
    className: t.name,
    targetPercentage: t.target_percentage,
  }));

  const sectorTargets: SectorTargetInput[] = rawSectorTargets.flatMap((st) => {
    const scopedClass = st.class_name?.trim();
    if (scopedClass) {
      return [{ className: scopedClass, sectorName: st.name, targetPercentage: st.target_percentage }];
    }
    const matchedClasses = classes.filter((cls) =>
      nonCashRows.some((r) => {
        const resolvedSector = r.sector?.trim() || inferSectorFromTicker(r.ticker, cls);
        return r.assetClass === cls && resolvedSector === st.name;
      }),
    );
    if (matchedClasses.length === 0) {
      return [{ className: "Ações", sectorName: st.name, targetPercentage: st.target_percentage }];
    }
    return matchedClasses.map((className) => ({
      className,
      sectorName: st.name,
      targetPercentage: st.target_percentage,
    }));
  });

  const assets: AporteAssetInput[] = nonCashRows.map((row) => {
    const raw = rawAssetMap.get(row.assetId);
    return {
      id: row.assetId,
      ticker: row.ticker,
      name: raw?.notes ?? null,
      assetClass: row.assetClass,
      sector: row.sector ?? raw?.sector ?? inferSectorFromTicker(row.ticker, row.assetClass),
      currency: row.currency,
      currentValueBRL: row.valueBRL,
      priceBRL: row.priceBRL,
      averageCost: raw?.average_price != null ? Number(raw.average_price) : row.priceBRL,
      ceilingPrice: raw?.ceiling_price ?? null,
      score: raw?.score ?? null,
      allocation_status: raw?.allocation_status ?? "active",
      last_reviewed_at: raw?.last_reviewed_at ?? null,
      score_criteria: (raw?.score_criteria as Record<string, unknown> | null) ?? null,
    };
  });

  const effectiveTargetsMap = new Map(
    calculateEffectiveAssetTargets({ assets, classTargets, sectorTargets }).map((item) => [
      item.assetId,
      item,
    ]),
  );

  const result =
    totalPurchasingCents > 0 && assets.length > 0
      ? simulateConstrainedAporte({
          aporte: totalPurchasingCents / 100,
          strategy,
          ceilingSensitivity,
          overrides,
          assets,
          classTargets,
          sectorTargets,
          policy,
        })
      : null;

  const classSummaryMap = new Map(
    (result?.classSummaries ?? []).map((cs) => [normalizeClassName(cs.className), cs]),
  );
  const sectorSummaryMap = new Map(
    (result?.sectorSummaries ?? []).map((ss) => [
      `${normalizeClassName(ss.className)}::${(ss.sectorName ?? "").trim().toLowerCase()}`,
      ss,
    ]),
  );

  const eligibleAssetsBySector = new Map<string, AporteAssetInput[]>();
  const eligibleAssetsByClass = new Map<string, AporteAssetInput[]>();

  for (const asset of assets) {
    if (
      asset.allocation_status === "quarantine" ||
      asset.allocation_status === "exit" ||
      asset.allocation_status === "neutral"
    ) {
      continue;
    }
    const normClass = normalizeClassName(asset.assetClass ?? "");
    const normSector = (asset.sector ?? "").trim().toLowerCase();
    const sectorKey = `${normClass}::${normSector}`;

    const secList = eligibleAssetsBySector.get(sectorKey) ?? [];
    secList.push(asset);
    eligibleAssetsBySector.set(sectorKey, secList);

    const clsList = eligibleAssetsByClass.get(normClass) ?? [];
    clsList.push(asset);
    eligibleAssetsByClass.set(normClass, clsList);
  }

  const routes: MappedAporteRoute[] =
    result?.routes.map((r) => {
      const eff = effectiveTargetsMap.get(r.assetId);
      const raw = rawAssetMap.get(r.assetId);
      const rawScore = eff?.rawScore ?? raw?.score ?? null;

      const normClass = normalizeClassName(r.assetClass ?? "");
      const normSector = (r.sector ?? "").trim().toLowerCase();
      const sectorKey = `${normClass}::${normSector}`;

      const classSum = classSummaryMap.get(normClass);
      const sectorSum = sectorSummaryMap.get(sectorKey);

      const sectorEligible = eligibleAssetsBySector.get(sectorKey) ?? [];
      const classEligible = eligibleAssetsByClass.get(normClass) ?? [];
      const groupEligible = sectorEligible.length > 0 ? sectorEligible : classEligible;

      const scoresInGroup = groupEligible
        .map((a) => a.score)
        .filter((s): s is number => s !== null && s !== undefined);
      const maxScoreInGroup = scoresInGroup.length > 0 ? Math.max(...scoresInGroup) : null;

      const classDeficitRel =
        classSum && classSum.targetValueBRL > 0
          ? Math.max(0, (classSum.targetValueBRL - classSum.currentValueBRL) / classSum.targetValueBRL)
          : 0;

      const sectorDeficitRel =
        sectorSum && sectorSum.targetValueBRL > 0
          ? Math.max(0, (sectorSum.targetValueBRL - sectorSum.currentValueBRL) / sectorSum.targetValueBRL)
          : 0;

      const reason = deriveAporteSuggestionReason({
        ticker: r.ticker,
        rawScore,
        assetClass: r.assetClass,
        sector: r.sector,
        classDeficitRel,
        classGapBRL: classSum?.gapBRL,
        sectorDeficitRel,
        sectorGapBRL: sectorSum?.gapBRL,
        weightInSector: r.weightInSector ?? eff?.weightInSector,
        effectiveTargetPct: eff?.effectiveTargetPct,
        groupEligibleCount: groupEligible.length,
        maxScoreInGroup,
      });

      return {
        assetId: r.assetId,
        ticker: r.ticker,
        assetClass: r.assetClass,
        sector: r.sector,
        targetValueBRL: r.targetValueBRL,
        currentValueBRL: r.currentValueBRL,
        gapBRL: r.gapBRL,
        allocatedBRL: r.allocatedBRL,
        quantity: r.quantity,
        priceBRL: r.priceBRL,
        rawScore,
        effectiveTargetPct: eff?.effectiveTargetPct,
        formulaLabel: eff?.formulaLabel,
        reasonKind: reason.kind,
        reasonLabel: reason.label,
        reasonDescription: reason.shortDescription,
        hasQualityConflict: reason.hasQualityConflict,
        qualityConflictDetail: reason.qualityConflictDetail,
        lastReviewedAt: raw?.last_reviewed_at ?? null,
        reviewFrequencyMonths: raw?.review_frequency_months ?? 6,
        headroomBRL: r.headroomBRL,
        isConstrainedByCeiling: r.isConstrainedByCeiling,
        ceilingReason: r.ceilingReason,
      };
    }) ?? [];

  const rawUsdRate = nonCashRows.find((r) => r.currency === "USD")?.usdRate ?? FALLBACK_USD_RATE;
  let diversificationImpact: DiversificationImpactSummary | null = null;

  if (rawAssets.length > 0) {
    const currentDiv = calculatePortfolioDiversification(rawAssets, { fxRateUSD: rawUsdRate });

    const routeAllocMap = new Map((result?.routes ?? []).map((r) => [r.assetId, r]));
    const projectedAssets: PortfolioAsset[] = rawAssets.map((a) => {
      const alloc = routeAllocMap.get(a.id);
      if (!alloc || alloc.quantity <= 0) return a;
      return {
        ...a,
        quantity: a.quantity + alloc.quantity,
      };
    });

    const projectedDiv = calculatePortfolioDiversification(projectedAssets, { fxRateUSD: rawUsdRate });

    const currentNef = currentDiv.globalNef;
    const projectedNef = projectedDiv.globalNef;
    const deltaNefPct =
      currentNef !== null && projectedNef !== null && currentNef > 0
        ? Math.round(((projectedNef - currentNef) / currentNef) * 1000) / 10
        : null;

    const currentNefStocks = currentDiv.byClass["Ações"]?.classNef ?? null;
    const projectedNefStocks = projectedDiv.byClass["Ações"]?.classNef ?? null;

    const currentTop = currentDiv.consolidatedVectors?.find(
      (v) => !v.key.startsWith("cluster_") && !v.key.startsWith("etf_benchmark_")
    );
    const currentTopShare = currentTop?.weightPct ?? null;
    const currentTopTicker = currentTop?.label ?? null;

    const projectedTop =
      projectedDiv.consolidatedVectors?.find((v) => v.label === currentTopTicker) ??
      projectedDiv.consolidatedVectors?.[0];
    const projectedTopShare = projectedTop?.weightPct ?? null;

    diversificationImpact = {
      currentNef,
      projectedNef,
      deltaNefPct,
      currentNefStocks,
      projectedNefStocks,
      topAssetTicker: currentTopTicker,
      currentTopAssetSharePct: currentTopShare,
      projectedTopAssetSharePct: projectedTopShare,
    };
  }

  return {
    nonCashRows,
    result,
    routes,
    eligibleRoutes: routes.filter((r) => r.quantity > 0),
    pausedAssets: result?.pausedAssets ?? [],
    overflowEvents: result?.overflowEvents ?? [],
    diversificationImpact,
  };
}

export interface BuildBatchAportePayloadInput {
  items: readonly BatchAporteItemInput[];
  positionRows: readonly AportePositionRowInput[];
  cashSelectedCents: number;
  positionCashBRL: number;
  date: string;
  batchId?: string;
  quantityOverrides?: Record<string, number>;
  priceOverrides?: Record<string, number>;
  fxRateOverrides?: Record<string, number>;
  notes?: string;
}

export interface BatchAporteExecutionPayload {
  batchId: string;
  items: {
    asset_id: string;
    quantity: number;
    price: number;
    total: number;
  }[];
  date: string;
  totalAmount: number;
  cashUsed: number | undefined;
  notes: string;
}

/**
 * Monta o payload atômico para `execute_portfolio_batch_aporte`, convertendo
 * ordens em USD pela cotação do ativo (ou FALLBACK_USD_RATE) e segregando Caixa.
 * Suporta overrides de quantidade, preço e taxa cambial da edição inline.
 */
export function buildBatchAportePayload({
  items,
  positionRows,
  cashSelectedCents,
  positionCashBRL,
  date,
  batchId,
  quantityOverrides,
  priceOverrides,
  fxRateOverrides,
  notes,
}: BuildBatchAportePayloadInput): BatchAporteExecutionPayload {
  const finalBatchId = batchId && batchId.trim().length > 0 ? batchId.trim() : generateBatchId();

  const mappedItems: {
    asset_id: string;
    quantity: number;
    price: number;
    total: number;
    totalBRL: number;
  }[] = [];

  for (const r of items) {
    const overrideQty = quantityOverrides ? quantityOverrides[r.assetId] : undefined;
    const rawQty = overrideQty !== undefined ? overrideQty : r.quantity;
    const qty = Math.max(0, rawQty);
    if (qty <= 0) continue;

    const row = positionRows.find((p) => p.assetId === r.assetId);
    const isUSD = row?.currency === "USD";
    const overridePrice = priceOverrides ? priceOverrides[r.assetId] : undefined;
    const effectivePriceBRL =
      overridePrice !== undefined && overridePrice > 0
        ? overridePrice
        : r.priceBRL;
    const overrideFx = fxRateOverrides ? fxRateOverrides[r.assetId] : undefined;
    const rate = isUSD ? (overrideFx ?? row?.usdRate ?? FALLBACK_USD_RATE) : 1;
    const priceInCurrency = isUSD ? Math.round((effectivePriceBRL / rate) * 100) / 100 : effectivePriceBRL;
    const totalInCurrency = Math.round(qty * priceInCurrency * 100) / 100;
    const itemAllocatedBRL = Math.round(qty * effectivePriceBRL * 100) / 100;

    mappedItems.push({
      asset_id: r.assetId,
      quantity: qty,
      price: priceInCurrency,
      total: totalInCurrency,
      totalBRL: itemAllocatedBRL,
    });
  }

  const totalAmount = Math.round(mappedItems.reduce((acc, r) => acc + r.totalBRL, 0) * 100) / 100;
  const cashUsedBRL =
    cashSelectedCents > 0
      ? Math.min(cashSelectedCents / 100, totalAmount, Math.max(0, positionCashBRL))
      : 0;
  const roundedCashUsed =
    cashUsedBRL > 0 ? Math.round(cashUsedBRL * 100) / 100 : undefined;

  const defaultNotes = roundedCashUsed
    ? `Aporte composto (${mappedItems.length} ativos · Caixa ${formatCentsAsBRL(Math.round(roundedCashUsed * 100))})`
    : `Aporte inteligente (${mappedItems.length} ativos)`;

  return {
    batchId: finalBatchId,
    items: mappedItems.map(({ asset_id, quantity, price, total }) => ({
      asset_id,
      quantity,
      price,
      total,
    })),
    date,
    totalAmount,
    cashUsed: roundedCashUsed,
    notes: notes ?? defaultNotes,
  };
}
