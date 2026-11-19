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
  simulateCombinedAporte,
  type AporteAssetInput,
  type ClassTargetInput,
  type SectorTargetInput,
} from "./aporte";
import { inferSectorFromTicker } from "./tickers-catalog";
import { FALLBACK_USD_RATE, normalizeClassName } from "./valuation";

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
}

export interface BatchAporteItemInput {
  assetId: string;
  ticker: string;
  quantity: number;
  priceBRL: number;
  allocatedBRL: number;
}

export interface BuildAporteSimulationInput {
  totalPurchasingCents: number;
  positionRows: readonly AportePositionRowInput[];
  rawAssets: readonly PortfolioAsset[];
  rawClassTargets: readonly GroupTarget[];
  rawSectorTargets: readonly GroupTarget[];
}

export interface AporteSimulationViewModel {
  nonCashRows: AportePositionRowInput[];
  result: ReturnType<typeof simulateCombinedAporte> | null;
  routes: MappedAporteRoute[];
  eligibleRoutes: MappedAporteRoute[];
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
      nonCashRows.some(
        (r) =>
          r.assetClass === cls &&
          (r.sector === st.name || inferSectorFromTicker(r.ticker, cls) === st.name),
      ),
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
      assetClass: row.assetClass,
      sector: row.sector ?? raw?.sector ?? inferSectorFromTicker(row.ticker, row.assetClass),
      currency: row.currency,
      currentValueBRL: row.valueBRL,
      priceBRL: row.priceBRL,
      score: raw?.score ?? null,
      allocation_status: raw?.allocation_status ?? "active",
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
      ? simulateCombinedAporte({
          aporte: totalPurchasingCents / 100,
          assets,
          classTargets,
          sectorTargets,
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
      };
    }) ?? [];

  return {
    nonCashRows,
    result,
    routes,
    eligibleRoutes: routes.filter((r) => r.quantity > 0),
  };
}

export interface BuildBatchAportePayloadInput {
  items: readonly BatchAporteItemInput[];
  positionRows: readonly AportePositionRowInput[];
  cashSelectedCents: number;
  positionCashBRL: number;
  date: string;
}

export interface BatchAporteExecutionPayload {
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
 */
export function buildBatchAportePayload({
  items,
  positionRows,
  cashSelectedCents,
  positionCashBRL,
  date,
}: BuildBatchAportePayloadInput): BatchAporteExecutionPayload {
  const mappedItems = items.map((r) => {
    const row = positionRows.find((p) => p.assetId === r.assetId);
    const isUSD = row?.currency === "USD";
    const rate = isUSD ? (row?.usdRate || FALLBACK_USD_RATE) : 1;
    return {
      asset_id: r.assetId,
      quantity: r.quantity,
      price: isUSD ? Math.round((r.priceBRL / rate) * 100) / 100 : r.priceBRL,
      total: isUSD ? Math.round((r.allocatedBRL / rate) * 100) / 100 : r.allocatedBRL,
    };
  });

  const totalAmount = items.reduce((acc, r) => acc + r.allocatedBRL, 0);
  const cashUsedBRL =
    cashSelectedCents > 0
      ? Math.min(cashSelectedCents / 100, totalAmount, positionCashBRL)
      : 0;
  const roundedCashUsed =
    cashUsedBRL > 0 ? Math.round(cashUsedBRL * 100) / 100 : undefined;

  return {
    items: mappedItems,
    date,
    totalAmount,
    cashUsed: roundedCashUsed,
    notes: roundedCashUsed
      ? `Aporte composto (${items.length} ativos · Caixa ${formatCentsAsBRL(Math.round(roundedCashUsed * 100))})`
      : `Aporte inteligente (${items.length} ativos)`,
  };
}
