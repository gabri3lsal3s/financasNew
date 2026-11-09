/**
 * Motor Puro de Exposição e Decomposição de Carteira (FIIs e Renda Fixa).
 *
 * Princípios de Engenharia Financeira:
 * 1. FIIs: Agrega posições entre Tijolo (ativos reais), Papel/Dívida (CRIs),
 *    FOFs (fundos de fundos), Híbridos e Agro/Infra para revelar o risco setorial real;
 * 2. Renda Fixa: Decomposição bivalente em:
 *    a) Risco de Juros / Indexador: Pós-fixado (CDI/Selic), Inflação (IPCA+) e Prefixado;
 *    b) Risco de Crédito / Emissor: Soberano (Tesouro), Bancário com FGC e Crédito Privado sem FGC;
 *    c) Eficiência Tributária: Percentual alocado em instrumentos isentos de IR (LCI/LCA/CRI/CRA/Debêntures Incentivadas).
 * 3. Função 100% pura — sem dependências de UI, banco ou Supabase.
 */

import type {
  FiiMacroCategory,
  FixedIncomeIssuerType,
  FixedIncomeMetadata,
  FixedIncomeRateType,
  PortfolioAsset,
} from "@/types";
import { todayISO } from "@/domain/debts";
import {
  FII_MACRO_CATEGORY_LABELS,
  FIXED_INCOME_INDEXER_LABELS,
  FIXED_INCOME_ISSUER_LABELS,
  getFiiMacroCategory,
  inferFixedIncomeCategories,
  STOCKS_CYCLING_LABELS,
  STOCKS_CAP_SIZE_LABELS,
  getStocksProfile,
  INTERNATIONAL_REGION_LABELS,
  INTERNATIONAL_VEHICLE_LABELS,
  getInternationalProfile,
  type StocksCyclingProfile,
  type StocksCapSize,
  type InternationalRegion,
  type InternationalVehicle,
} from "./tickers-catalog";
import { isFixedIncomeClass, isTesouroAsset, normalizeClassName } from "./valuation";

export interface ExposureAssetItem {
  assetId: string;
  ticker: string;
  name?: string;
  valueBRL: number;
  pctOfSubportfolio: number;
}

export interface FiiCategoryGroup {
  key: FiiMacroCategory;
  label: string;
  valueBRL: number;
  pct: number;
  count: number;
  assets: ExposureAssetItem[];
}

export interface FiiExposureSegment {
  key: FiiMacroCategory;
  label: string;
  valueBRL: number;
  pct: number;
}

export interface FiiExposureResult {
  totalValueBRL: number;
  totalCostBRL: number;
  unrealizedPnl: number;
  unrealizedPct: number | null;
  totalAssetsCount: number;
  groups: Record<FiiMacroCategory, FiiCategoryGroup>;
  orderedGroups: FiiCategoryGroup[];
  segments: FiiExposureSegment[];
  topCategory: FiiCategoryGroup | null;
  isConcentrated: boolean;
}

export interface FixedIncomeIndexerGroup {
  key: FixedIncomeRateType;
  label: string;
  valueBRL: number;
  pct: number;
  count: number;
  assets: ExposureAssetItem[];
}

export interface FixedIncomeIssuerGroup {
  key: FixedIncomeIssuerType;
  label: string;
  valueBRL: number;
  pct: number;
  count: number;
  assets: ExposureAssetItem[];
}

export interface FixedIncomeExposureSegment {
  key: string;
  label: string;
  valueBRL: number;
  pct: number;
}

export interface FixedIncomeExposureResult {
  totalValueBRL: number;
  totalCostBRL: number;
  unrealizedPnl: number;
  unrealizedPct: number | null;
  totalAssetsCount: number;
  taxExemptValueBRL: number;
  taxExemptPct: number;
  byIndexer: Record<FixedIncomeRateType, FixedIncomeIndexerGroup>;
  orderedIndexers: FixedIncomeIndexerGroup[];
  indexerSegments: FixedIncomeExposureSegment[];
  byIssuer: Record<FixedIncomeIssuerType, FixedIncomeIssuerGroup>;
  orderedIssuers: FixedIncomeIssuerGroup[];
  issuerSegments: FixedIncomeExposureSegment[];
  topIndexer: FixedIncomeIndexerGroup | null;
  topIssuer: FixedIncomeIssuerGroup | null;
}

export interface PositionLikeItem {
  assetId?: string;
  ticker: string;
  assetClass?: string | null;
  sector?: string | null;
  valueBRL: number;
  totalCostBRL?: number;
  averageCost?: number;
  quantity?: number;
}

/**
 * Calcula a decomposição da carteira de Fundos de Investimento Imobiliário.
 */
export function calculateFiiExposure(
  positions: readonly PositionLikeItem[],
): FiiExposureResult {
  const fiiPositions = positions.filter((p) => {
    const cls = normalizeClassName(p.assetClass ?? "");
    return cls === "fiis" || cls === "fii";
  });

  let totalValueBRL = 0;
  let totalCostBRL = 0;

  for (const pos of fiiPositions) {
    totalValueBRL += pos.valueBRL;
    totalCostBRL += pos.totalCostBRL ?? (pos.quantity && pos.averageCost ? pos.quantity * pos.averageCost : pos.valueBRL);
  }

  totalValueBRL = Math.round(totalValueBRL * 100) / 100;
  totalCostBRL = Math.round(totalCostBRL * 100) / 100;

  const categories: FiiMacroCategory[] = [
    "tijolo",
    "papel",
    "fof",
    "hibrido",
    "agro_infra",
    "outros",
  ];

  const groups: Record<FiiMacroCategory, FiiCategoryGroup> = {
    tijolo: { key: "tijolo", label: FII_MACRO_CATEGORY_LABELS.tijolo, valueBRL: 0, pct: 0, count: 0, assets: [] },
    papel: { key: "papel", label: FII_MACRO_CATEGORY_LABELS.papel, valueBRL: 0, pct: 0, count: 0, assets: [] },
    fof: { key: "fof", label: FII_MACRO_CATEGORY_LABELS.fof, valueBRL: 0, pct: 0, count: 0, assets: [] },
    hibrido: { key: "hibrido", label: FII_MACRO_CATEGORY_LABELS.hibrido, valueBRL: 0, pct: 0, count: 0, assets: [] },
    agro_infra: { key: "agro_infra", label: FII_MACRO_CATEGORY_LABELS.agro_infra, valueBRL: 0, pct: 0, count: 0, assets: [] },
    outros: { key: "outros", label: FII_MACRO_CATEGORY_LABELS.outros, valueBRL: 0, pct: 0, count: 0, assets: [] },
  };

  for (const pos of fiiPositions) {
    const cat = getFiiMacroCategory(pos.sector, pos.ticker);
    const grp = groups[cat];
    const val = Math.round(pos.valueBRL * 100) / 100;
    const pctOfSub = totalValueBRL > 0 ? Math.round((val / totalValueBRL) * 1000) / 10 : 0;

    grp.valueBRL = Math.round((grp.valueBRL + val) * 100) / 100;
    grp.count += 1;
    grp.assets.push({
      assetId: pos.assetId ?? pos.ticker,
      ticker: pos.ticker,
      valueBRL: val,
      pctOfSubportfolio: pctOfSub,
    });
  }

  // Recalcula os percentuais de cada grupo
  for (const cat of categories) {
    const grp = groups[cat];
    grp.pct = totalValueBRL > 0 ? Math.round((grp.valueBRL / totalValueBRL) * 1000) / 10 : 0;
    grp.assets.sort((a, b) => b.valueBRL - a.valueBRL);
  }

  const orderedGroups = Object.values(groups)
    .filter((g) => g.valueBRL > 0 || g.count > 0)
    .sort((a, b) => b.valueBRL - a.valueBRL);

  const segments: FiiExposureSegment[] = orderedGroups.map((g) => ({
    key: g.key,
    label: g.label,
    valueBRL: g.valueBRL,
    pct: g.pct,
  }));

  const unrealizedPnl = Math.round((totalValueBRL - totalCostBRL) * 100) / 100;
  const unrealizedPct =
    totalCostBRL > 0 ? Math.round(((totalValueBRL - totalCostBRL) / totalCostBRL) * 1000) / 10 : null;

  const topCategory = orderedGroups[0] ?? null;
  const isConcentrated = Boolean(topCategory && topCategory.pct >= 70);

  return {
    totalValueBRL,
    totalCostBRL,
    unrealizedPnl,
    unrealizedPct,
    totalAssetsCount: fiiPositions.length,
    groups,
    orderedGroups,
    segments,
    topCategory,
    isConcentrated,
  };
}

/**
 * Calcula a decomposição da carteira de Renda Fixa (por Indexador e por Emissor).
 */
export function calculateFixedIncomeExposure(
  positions: readonly PositionLikeItem[],
  assetsMetadata: readonly PortfolioAsset[] = [],
): FixedIncomeExposureResult {
  const metadataMap = new Map<string, PortfolioAsset>();
  for (const a of assetsMetadata) {
    metadataMap.set(a.id, a);
    metadataMap.set(a.ticker.trim().toUpperCase(), a);
  }

  const rfPositions = positions.filter((p) => {
    return isFixedIncomeClass(p.assetClass) || isTesouroAsset(p.ticker, p.assetClass);
  });

  let totalValueBRL = 0;
  let totalCostBRL = 0;
  let taxExemptValueBRL = 0;

  for (const pos of rfPositions) {
    totalValueBRL += pos.valueBRL;
    totalCostBRL += pos.totalCostBRL ?? (pos.quantity && pos.averageCost ? pos.quantity * pos.averageCost : pos.valueBRL);
  }

  totalValueBRL = Math.round(totalValueBRL * 100) / 100;
  totalCostBRL = Math.round(totalCostBRL * 100) / 100;

  const byIndexer: Record<FixedIncomeRateType, FixedIncomeIndexerGroup> = {
    cdi: { key: "cdi", label: FIXED_INCOME_INDEXER_LABELS.cdi, valueBRL: 0, pct: 0, count: 0, assets: [] },
    selic: { key: "selic", label: FIXED_INCOME_INDEXER_LABELS.selic, valueBRL: 0, pct: 0, count: 0, assets: [] },
    ipca: { key: "ipca", label: FIXED_INCOME_INDEXER_LABELS.ipca, valueBRL: 0, pct: 0, count: 0, assets: [] },
    pre: { key: "pre", label: FIXED_INCOME_INDEXER_LABELS.pre, valueBRL: 0, pct: 0, count: 0, assets: [] },
  };

  const byIssuer: Record<FixedIncomeIssuerType, FixedIncomeIssuerGroup> = {
    tesouro: { key: "tesouro", label: FIXED_INCOME_ISSUER_LABELS.tesouro, valueBRL: 0, pct: 0, count: 0, assets: [] },
    bancario_fgc: { key: "bancario_fgc", label: FIXED_INCOME_ISSUER_LABELS.bancario_fgc, valueBRL: 0, pct: 0, count: 0, assets: [] },
    credito_privado: { key: "credito_privado", label: FIXED_INCOME_ISSUER_LABELS.credito_privado, valueBRL: 0, pct: 0, count: 0, assets: [] },
  };

  for (const pos of rfPositions) {
    const meta = (pos.assetId ? metadataMap.get(pos.assetId) : null) ?? metadataMap.get(pos.ticker.trim().toUpperCase());
    const inferred = inferFixedIncomeCategories({
      ticker: pos.ticker,
      sector: pos.sector,
      fixed_income_metadata: meta?.fixed_income_metadata,
    });

    const val = Math.round(pos.valueBRL * 100) / 100;
    const pctOfSub = totalValueBRL > 0 ? Math.round((val / totalValueBRL) * 1000) / 10 : 0;
    const assetItem: ExposureAssetItem = {
      assetId: pos.assetId ?? pos.ticker,
      ticker: pos.ticker,
      valueBRL: val,
      pctOfSubportfolio: pctOfSub,
    };

    // Indexador
    const idxGroup = byIndexer[inferred.indexer];
    idxGroup.valueBRL = Math.round((idxGroup.valueBRL + val) * 100) / 100;
    idxGroup.count += 1;
    idxGroup.assets.push(assetItem);

    // Emissor
    const issuerGroup = byIssuer[inferred.issuer];
    issuerGroup.valueBRL = Math.round((issuerGroup.valueBRL + val) * 100) / 100;
    issuerGroup.count += 1;
    issuerGroup.assets.push(assetItem);

    // Isenção de IR
    if (inferred.isTaxExempt) {
      taxExemptValueBRL += val;
    }
  }

  // Percentuais por Indexador
  const indexerKeys: FixedIncomeRateType[] = ["cdi", "selic", "ipca", "pre"];
  for (const k of indexerKeys) {
    const grp = byIndexer[k];
    grp.pct = totalValueBRL > 0 ? Math.round((grp.valueBRL / totalValueBRL) * 1000) / 10 : 0;
    grp.assets.sort((a, b) => b.valueBRL - a.valueBRL);
  }

  const orderedIndexers = Object.values(byIndexer)
    .filter((g) => g.valueBRL > 0 || g.count > 0)
    .sort((a, b) => b.valueBRL - a.valueBRL);

  const indexerSegments: FixedIncomeExposureSegment[] = orderedIndexers.map((g) => ({
    key: g.key,
    label: g.label,
    valueBRL: g.valueBRL,
    pct: g.pct,
  }));

  // Percentuais por Emissor
  const issuerKeys: FixedIncomeIssuerType[] = ["tesouro", "bancario_fgc", "credito_privado"];
  for (const k of issuerKeys) {
    const grp = byIssuer[k];
    grp.pct = totalValueBRL > 0 ? Math.round((grp.valueBRL / totalValueBRL) * 1000) / 10 : 0;
    grp.assets.sort((a, b) => b.valueBRL - a.valueBRL);
  }

  const orderedIssuers = Object.values(byIssuer)
    .filter((g) => g.valueBRL > 0 || g.count > 0)
    .sort((a, b) => b.valueBRL - a.valueBRL);

  const issuerSegments: FixedIncomeExposureSegment[] = orderedIssuers.map((g) => ({
    key: g.key,
    label: g.label,
    valueBRL: g.valueBRL,
    pct: g.pct,
  }));

  const unrealizedPnl = Math.round((totalValueBRL - totalCostBRL) * 100) / 100;
  const unrealizedPct =
    totalCostBRL > 0 ? Math.round(((totalValueBRL - totalCostBRL) / totalCostBRL) * 1000) / 10 : null;

  const topIndexer = orderedIndexers[0] ?? null;
  const topIssuer = orderedIssuers[0] ?? null;

  taxExemptValueBRL = Math.round(taxExemptValueBRL * 100) / 100;
  const taxExemptPct =
    totalValueBRL > 0 ? Math.round((taxExemptValueBRL / totalValueBRL) * 1000) / 10 : 0;

  return {
    totalValueBRL,
    totalCostBRL,
    unrealizedPnl,
    unrealizedPct,
    totalAssetsCount: rfPositions.length,
    taxExemptValueBRL,
    taxExemptPct,
    byIndexer,
    orderedIndexers,
    indexerSegments,
    byIssuer,
    orderedIssuers,
    issuerSegments,
    topIndexer,
    topIssuer,
  };
}

// ---------------------------------------------------------------------------
// Raio-X de Ações Brasil (Ciclismo Econômico & Capitalização)
// ---------------------------------------------------------------------------

export interface StocksProfileGroup {
  key: StocksCyclingProfile;
  label: string;
  valueBRL: number;
  pct: number;
  count: number;
  assets: ExposureAssetItem[];
}

export interface StocksCapSizeGroup {
  key: StocksCapSize;
  label: string;
  valueBRL: number;
  pct: number;
  count: number;
  assets: ExposureAssetItem[];
}

export interface StocksExposureSegment {
  key: string;
  label: string;
  valueBRL: number;
  pct: number;
}

export interface StocksExposureResult {
  totalValueBRL: number;
  totalCostBRL: number;
  unrealizedPnl: number;
  unrealizedPct: number | null;
  totalAssetsCount: number;
  byProfile: Record<StocksCyclingProfile, StocksProfileGroup>;
  orderedProfiles: StocksProfileGroup[];
  profileSegments: StocksExposureSegment[];
  byCapSize: Record<StocksCapSize, StocksCapSizeGroup>;
  orderedCapSizes: StocksCapSizeGroup[];
  capSizeSegments: StocksExposureSegment[];
  topProfile: StocksProfileGroup | null;
  isConcentrated: boolean;
}

/**
 * Calcula a decomposição da carteira de Ações Brasil (Ciclismo BESST vs. Commodities vs. Domésticos e Porte).
 */
export function calculateStocksExposure(
  positions: readonly PositionLikeItem[],
): StocksExposureResult {
  const stockPositions = positions.filter((p) => {
    const cls = normalizeClassName(p.assetClass ?? "");
    return cls === "acoes" || cls === "acao" || cls === "stocks";
  });

  let totalValueBRL = 0;
  let totalCostBRL = 0;

  for (const pos of stockPositions) {
    totalValueBRL += pos.valueBRL;
    totalCostBRL += pos.totalCostBRL ?? (pos.quantity && pos.averageCost ? pos.quantity * pos.averageCost : pos.valueBRL);
  }

  totalValueBRL = Math.round(totalValueBRL * 100) / 100;
  totalCostBRL = Math.round(totalCostBRL * 100) / 100;

  const byProfile: Record<StocksCyclingProfile, StocksProfileGroup> = {
    defensivo_besst: { key: "defensivo_besst", label: STOCKS_CYCLING_LABELS.defensivo_besst, valueBRL: 0, pct: 0, count: 0, assets: [] },
    commodities: { key: "commodities", label: STOCKS_CYCLING_LABELS.commodities, valueBRL: 0, pct: 0, count: 0, assets: [] },
    ciclico_domestico: { key: "ciclico_domestico", label: STOCKS_CYCLING_LABELS.ciclico_domestico, valueBRL: 0, pct: 0, count: 0, assets: [] },
    outros_indices: { key: "outros_indices", label: STOCKS_CYCLING_LABELS.outros_indices, valueBRL: 0, pct: 0, count: 0, assets: [] },
  };

  const byCapSize: Record<StocksCapSize, StocksCapSizeGroup> = {
    large_cap: { key: "large_cap", label: STOCKS_CAP_SIZE_LABELS.large_cap, valueBRL: 0, pct: 0, count: 0, assets: [] },
    mid_cap: { key: "mid_cap", label: STOCKS_CAP_SIZE_LABELS.mid_cap, valueBRL: 0, pct: 0, count: 0, assets: [] },
    small_cap: { key: "small_cap", label: STOCKS_CAP_SIZE_LABELS.small_cap, valueBRL: 0, pct: 0, count: 0, assets: [] },
  };

  for (const pos of stockPositions) {
    const { profile, capSize } = getStocksProfile(pos.sector, pos.ticker);
    const val = Math.round(pos.valueBRL * 100) / 100;
    const pctOfSub = totalValueBRL > 0 ? Math.round((val / totalValueBRL) * 1000) / 10 : 0;
    const assetItem: ExposureAssetItem = {
      assetId: pos.assetId ?? pos.ticker,
      ticker: pos.ticker,
      valueBRL: val,
      pctOfSubportfolio: pctOfSub,
    };

    // Perfil
    const profGroup = byProfile[profile];
    profGroup.valueBRL = Math.round((profGroup.valueBRL + val) * 100) / 100;
    profGroup.count += 1;
    profGroup.assets.push(assetItem);

    // Porte
    const capGroup = byCapSize[capSize];
    capGroup.valueBRL = Math.round((capGroup.valueBRL + val) * 100) / 100;
    capGroup.count += 1;
    capGroup.assets.push(assetItem);
  }

  // Percentuais por Perfil
  const profileKeys: StocksCyclingProfile[] = ["defensivo_besst", "commodities", "ciclico_domestico", "outros_indices"];
  for (const k of profileKeys) {
    const grp = byProfile[k];
    grp.pct = totalValueBRL > 0 ? Math.round((grp.valueBRL / totalValueBRL) * 1000) / 10 : 0;
    grp.assets.sort((a, b) => b.valueBRL - a.valueBRL);
  }

  const orderedProfiles = Object.values(byProfile)
    .filter((g) => g.valueBRL > 0 || g.count > 0)
    .sort((a, b) => b.valueBRL - a.valueBRL);

  const profileSegments: StocksExposureSegment[] = orderedProfiles.map((g) => ({
    key: g.key,
    label: g.label,
    valueBRL: g.valueBRL,
    pct: g.pct,
  }));

  // Percentuais por Porte
  const capKeys: StocksCapSize[] = ["large_cap", "mid_cap", "small_cap"];
  for (const k of capKeys) {
    const grp = byCapSize[k];
    grp.pct = totalValueBRL > 0 ? Math.round((grp.valueBRL / totalValueBRL) * 1000) / 10 : 0;
    grp.assets.sort((a, b) => b.valueBRL - a.valueBRL);
  }

  const orderedCapSizes = Object.values(byCapSize)
    .filter((g) => g.valueBRL > 0 || g.count > 0)
    .sort((a, b) => b.valueBRL - a.valueBRL);

  const capSizeSegments: StocksExposureSegment[] = orderedCapSizes.map((g) => ({
    key: g.key,
    label: g.label,
    valueBRL: g.valueBRL,
    pct: g.pct,
  }));

  const unrealizedPnl = Math.round((totalValueBRL - totalCostBRL) * 100) / 100;
  const unrealizedPct =
    totalCostBRL > 0 ? Math.round(((totalValueBRL - totalCostBRL) / totalCostBRL) * 1000) / 10 : null;

  const topProfile = orderedProfiles[0] ?? null;
  const isConcentrated = Boolean(topProfile && topProfile.pct >= 60);

  return {
    totalValueBRL,
    totalCostBRL,
    unrealizedPnl,
    unrealizedPct,
    totalAssetsCount: stockPositions.length,
    byProfile,
    orderedProfiles,
    profileSegments,
    byCapSize,
    orderedCapSizes,
    capSizeSegments,
    topProfile,
    isConcentrated,
  };
}

// ---------------------------------------------------------------------------
// Raio-X da Carteira Internacional (Geografia & Veículo de Custódia)
// ---------------------------------------------------------------------------

export interface InternationalRegionGroup {
  key: InternationalRegion;
  label: string;
  valueBRL: number;
  pct: number;
  count: number;
  assets: ExposureAssetItem[];
}

export interface InternationalVehicleGroup {
  key: InternationalVehicle;
  label: string;
  valueBRL: number;
  pct: number;
  count: number;
  assets: ExposureAssetItem[];
}

export interface InternationalExposureSegment {
  key: string;
  label: string;
  valueBRL: number;
  pct: number;
}

export interface InternationalExposureResult {
  totalValueBRL: number;
  totalCostBRL: number;
  unrealizedPnl: number;
  unrealizedPct: number | null;
  totalAssetsCount: number;
  usdDirectValueBRL: number;
  usdDirectPct: number;
  byRegion: Record<InternationalRegion, InternationalRegionGroup>;
  orderedRegions: InternationalRegionGroup[];
  regionSegments: InternationalExposureSegment[];
  byVehicle: Record<InternationalVehicle, InternationalVehicleGroup>;
  orderedVehicles: InternationalVehicleGroup[];
  vehicleSegments: InternationalExposureSegment[];
  topRegion: InternationalRegionGroup | null;
  isConcentrated: boolean;
}

/**
 * Calcula a decomposição da Carteira Internacional (Geografia, Setor Global e Veículo USD vs BDR).
 */
export function calculateInternationalExposure(
  positions: readonly PositionLikeItem[],
): InternationalExposureResult {
  const intlPositions = positions.filter((p) => {
    const cls = normalizeClassName(p.assetClass ?? "");
    return cls === "internacional" || cls === "bdrs" || cls === "bdr";
  });

  let totalValueBRL = 0;
  let totalCostBRL = 0;
  let usdDirectValueBRL = 0;

  for (const pos of intlPositions) {
    totalValueBRL += pos.valueBRL;
    totalCostBRL += pos.totalCostBRL ?? (pos.quantity && pos.averageCost ? pos.quantity * pos.averageCost : pos.valueBRL);
  }

  totalValueBRL = Math.round(totalValueBRL * 100) / 100;
  totalCostBRL = Math.round(totalCostBRL * 100) / 100;

  const byRegion: Record<InternationalRegion, InternationalRegionGroup> = {
    eua: { key: "eua", label: INTERNATIONAL_REGION_LABELS.eua, valueBRL: 0, pct: 0, count: 0, assets: [] },
    desenvolvidos_ex_us: { key: "desenvolvidos_ex_us", label: INTERNATIONAL_REGION_LABELS.desenvolvidos_ex_us, valueBRL: 0, pct: 0, count: 0, assets: [] },
    emergentes: { key: "emergentes", label: INTERNATIONAL_REGION_LABELS.emergentes, valueBRL: 0, pct: 0, count: 0, assets: [] },
    global: { key: "global", label: INTERNATIONAL_REGION_LABELS.global, valueBRL: 0, pct: 0, count: 0, assets: [] },
  };

  const byVehicle: Record<InternationalVehicle, InternationalVehicleGroup> = {
    moeda_forte_usd: { key: "moeda_forte_usd", label: INTERNATIONAL_VEHICLE_LABELS.moeda_forte_usd, valueBRL: 0, pct: 0, count: 0, assets: [] },
    bdr_brl: { key: "bdr_brl", label: INTERNATIONAL_VEHICLE_LABELS.bdr_brl, valueBRL: 0, pct: 0, count: 0, assets: [] },
  };

  for (const pos of intlPositions) {
    const { region, vehicle } = getInternationalProfile({
      ticker: pos.ticker,
      sector: pos.sector,
    });

    const val = Math.round(pos.valueBRL * 100) / 100;
    const pctOfSub = totalValueBRL > 0 ? Math.round((val / totalValueBRL) * 1000) / 10 : 0;
    const assetItem: ExposureAssetItem = {
      assetId: pos.assetId ?? pos.ticker,
      ticker: pos.ticker,
      valueBRL: val,
      pctOfSubportfolio: pctOfSub,
    };

    // Região
    const regGroup = byRegion[region];
    regGroup.valueBRL = Math.round((regGroup.valueBRL + val) * 100) / 100;
    regGroup.count += 1;
    regGroup.assets.push(assetItem);

    // Veículo
    const vehGroup = byVehicle[vehicle];
    vehGroup.valueBRL = Math.round((vehGroup.valueBRL + val) * 100) / 100;
    vehGroup.count += 1;
    vehGroup.assets.push(assetItem);

    if (vehicle === "moeda_forte_usd") {
      usdDirectValueBRL += val;
    }
  }

  // Percentuais por Região
  const regionKeys: InternationalRegion[] = ["eua", "desenvolvidos_ex_us", "emergentes", "global"];
  for (const k of regionKeys) {
    const grp = byRegion[k];
    grp.pct = totalValueBRL > 0 ? Math.round((grp.valueBRL / totalValueBRL) * 1000) / 10 : 0;
    grp.assets.sort((a, b) => b.valueBRL - a.valueBRL);
  }

  const orderedRegions = Object.values(byRegion)
    .filter((g) => g.valueBRL > 0 || g.count > 0)
    .sort((a, b) => b.valueBRL - a.valueBRL);

  const regionSegments: InternationalExposureSegment[] = orderedRegions.map((g) => ({
    key: g.key,
    label: g.label,
    valueBRL: g.valueBRL,
    pct: g.pct,
  }));

  // Percentuais por Veículo
  const vehicleKeys: InternationalVehicle[] = ["moeda_forte_usd", "bdr_brl"];
  for (const k of vehicleKeys) {
    const grp = byVehicle[k];
    grp.pct = totalValueBRL > 0 ? Math.round((grp.valueBRL / totalValueBRL) * 1000) / 10 : 0;
    grp.assets.sort((a, b) => b.valueBRL - a.valueBRL);
  }

  const orderedVehicles = Object.values(byVehicle)
    .filter((g) => g.valueBRL > 0 || g.count > 0)
    .sort((a, b) => b.valueBRL - a.valueBRL);

  const vehicleSegments: InternationalExposureSegment[] = orderedVehicles.map((g) => ({
    key: g.key,
    label: g.label,
    valueBRL: g.valueBRL,
    pct: g.pct,
  }));

  const unrealizedPnl = Math.round((totalValueBRL - totalCostBRL) * 100) / 100;
  const unrealizedPct =
    totalCostBRL > 0 ? Math.round(((totalValueBRL - totalCostBRL) / totalCostBRL) * 1000) / 10 : null;

  const topRegion = orderedRegions[0] ?? null;
  const isConcentrated = Boolean(topRegion && topRegion.pct >= 70);

  usdDirectValueBRL = Math.round(usdDirectValueBRL * 100) / 100;
  const usdDirectPct =
    totalValueBRL > 0 ? Math.round((usdDirectValueBRL / totalValueBRL) * 1000) / 10 : 0;

  return {
    totalValueBRL,
    totalCostBRL,
    unrealizedPnl,
    unrealizedPct,
    totalAssetsCount: intlPositions.length,
    usdDirectValueBRL,
    usdDirectPct,
    byRegion,
    orderedRegions,
    regionSegments,
    byVehicle,
    orderedVehicles,
    vehicleSegments,
    topRegion,
    isConcentrated,
  };
}

// ---------------------------------------------------------------------------
// Detecção de Safra Efetiva por Classe (Cohort / Inception Timing)
// ---------------------------------------------------------------------------

export interface AssetForInceptionDetection {
  id?: string;
  ticker: string;
  assetClass?: string | null;
  createdAt?: string;
  fixedIncomeMetadata?: FixedIncomeMetadata | null;
}

export interface TransactionForInceptionDetection {
  assetId?: string;
  ticker?: string;
  date: string;
  type?: string;
}

export interface ClassInceptionItem {
  firstDate: string | null;
  monthsActive: number;
  isMaturing: boolean;
}

export type ClassInceptionMap = Record<
  "stocks" | "fiis" | "fixed_income" | "international" | "total",
  ClassInceptionItem
>;

/**
 * Calcula a quantidade de competências mensais decorridas entre uma data inicial e final.
 * Padrão financeiro (CVM/ANBIMA): conta as competências de calendário envolvidas (ex: Jan a Nov = 11 meses).
 */
export function calculateMonthsElapsed(startDateStr: string, endDateStr?: string): number {
  if (!startDateStr) return 1;
  const startYear = parseInt(startDateStr.slice(0, 4), 10);
  const startMonth = parseInt(startDateStr.slice(5, 7), 10);

  const cleanEnd = endDateStr ?? todayISO();
  const endYear = parseInt(cleanEnd.slice(0, 4), 10);
  const endMonth = parseInt(cleanEnd.slice(5, 7), 10);

  if (Number.isNaN(startYear) || Number.isNaN(startMonth) || Number.isNaN(endYear) || Number.isNaN(endMonth)) {
    return 1;
  }

  const months = (endYear - startYear) * 12 + (endMonth - startMonth) + 1;
  return Math.max(1, months);
}

/**
 * Detecta a data efetiva de primeiro aporte e o número de meses de existência de cada classe de ativo,
 * evitando comparações injustas de safras heterogêneas (Cohort Mismatch) contra benchmarks de longo prazo.
 */
export function detectClassInceptions(
  assets: readonly AssetForInceptionDetection[],
  transactions: readonly TransactionForInceptionDetection[] = [],
  referenceDateStr?: string,
  marcoZeroMonth?: string | null,
): ClassInceptionMap {
  const earliestByClass: Record<
    "stocks" | "fiis" | "fixed_income" | "international" | "total",
    string | null
  > = {
    stocks: null,
    fiis: null,
    fixed_income: null,
    international: null,
    total: null,
  };

  const updateEarliest = (
    key: "stocks" | "fiis" | "fixed_income" | "international",
    dateCandidate: string | null | undefined,
  ) => {
    if (!dateCandidate) return;
    const cleanDate = dateCandidate.slice(0, 10);
    if (!earliestByClass[key] || cleanDate < earliestByClass[key]!) {
      earliestByClass[key] = cleanDate;
    }
    if (!earliestByClass.total || cleanDate < earliestByClass.total) {
      earliestByClass.total = cleanDate;
    }
  };

  // Mapeia transações por asset_id e por ticker
  const txDatesByAssetId = new Map<string, string[]>();
  const txDatesByTicker = new Map<string, string[]>();

  for (const tx of transactions) {
    if (!tx.date) continue;
    const d = tx.date.slice(0, 10);
    if (tx.assetId) {
      const arr = txDatesByAssetId.get(tx.assetId) ?? [];
      arr.push(d);
      txDatesByAssetId.set(tx.assetId, arr);
    }
    if (tx.ticker) {
      const t = tx.ticker.trim().toUpperCase();
      const arr = txDatesByTicker.get(t) ?? [];
      arr.push(d);
      txDatesByTicker.set(t, arr);
    }
  }

  for (const asset of assets) {
    const cls = normalizeClassName(asset.assetClass ?? "");
    let classKey: "stocks" | "fiis" | "fixed_income" | "international" | null = null;

    if (cls === "acoes" || cls === "acao" || cls === "stocks") {
      classKey = "stocks";
    } else if (cls === "fiis" || cls === "fii") {
      classKey = "fiis";
    } else if (isFixedIncomeClass(asset.assetClass ?? "") || isTesouroAsset(asset.ticker, asset.assetClass)) {
      classKey = "fixed_income";
    } else if (cls === "internacional" || cls === "bdrs" || cls === "bdr" || cls === "etfs" || cls === "etf") {
      classKey = "international";
    }

    if (!classKey) continue;

    // 1. Procura menor data nas transações
    const txDatesForAsset = [
      ...(asset.id ? (txDatesByAssetId.get(asset.id) ?? []) : []),
      ...(txDatesByTicker.get(asset.ticker.trim().toUpperCase()) ?? []),
    ].sort();

    if (txDatesForAsset.length > 0 && txDatesForAsset[0]) {
      updateEarliest(classKey, txDatesForAsset[0]);
    }

    // 2. Para Renda Fixa: verifica datas de metadados de contratação/calibração
    if (classKey === "fixed_income" && asset.fixedIncomeMetadata) {
      const meta = asset.fixedIncomeMetadata;
      if (meta.initial_investment_date) {
        updateEarliest(classKey, meta.initial_investment_date);
      } else if (meta.base_date) {
        updateEarliest(classKey, meta.base_date);
      }
    }

    // 3. Fallback de data de criação
    if (asset.createdAt) {
      updateEarliest(classKey, asset.createdAt);
    }
  }

  // Se o marco zero da carteira foi fornecido (mês de entrada no app),
  // nenhuma classe pode ter data anterior ao marco zero no escopo auditado deste app
  const marcoZeroDate = marcoZeroMonth ? `${marcoZeroMonth.slice(0, 7)}-01` : null;
  if (marcoZeroDate) {
    const keys: Array<"stocks" | "fiis" | "fixed_income" | "international" | "total"> = [
      "stocks",
      "fiis",
      "fixed_income",
      "international",
      "total",
    ];
    for (const k of keys) {
      if (earliestByClass[k] && earliestByClass[k]! < marcoZeroDate) {
        earliestByClass[k] = marcoZeroDate;
      }
    }
  }

  const result: ClassInceptionMap = {
    stocks: {
      firstDate: earliestByClass.stocks,
      monthsActive: earliestByClass.stocks ? calculateMonthsElapsed(earliestByClass.stocks, referenceDateStr) : 1,
      isMaturing: earliestByClass.stocks ? calculateMonthsElapsed(earliestByClass.stocks, referenceDateStr) < 3 : true,
    },
    fiis: {
      firstDate: earliestByClass.fiis,
      monthsActive: earliestByClass.fiis ? calculateMonthsElapsed(earliestByClass.fiis, referenceDateStr) : 1,
      isMaturing: earliestByClass.fiis ? calculateMonthsElapsed(earliestByClass.fiis, referenceDateStr) < 3 : true,
    },
    fixed_income: {
      firstDate: earliestByClass.fixed_income,
      monthsActive: earliestByClass.fixed_income ? calculateMonthsElapsed(earliestByClass.fixed_income, referenceDateStr) : 1,
      isMaturing: earliestByClass.fixed_income ? calculateMonthsElapsed(earliestByClass.fixed_income, referenceDateStr) < 3 : true,
    },
    international: {
      firstDate: earliestByClass.international,
      monthsActive: earliestByClass.international ? calculateMonthsElapsed(earliestByClass.international, referenceDateStr) : 1,
      isMaturing: earliestByClass.international ? calculateMonthsElapsed(earliestByClass.international, referenceDateStr) < 3 : true,
    },
    total: {
      firstDate: earliestByClass.total,
      monthsActive: earliestByClass.total ? calculateMonthsElapsed(earliestByClass.total, referenceDateStr) : 1,
      isMaturing: earliestByClass.total ? calculateMonthsElapsed(earliestByClass.total, referenceDateStr) < 3 : true,
    },
  };

  return result;
}

export interface PositionCalculationRow {
  assetClass: string | null;
  valueBRL: number;
  pct: number;
  unrealizedPnl: number;
  dividends?: number;
  totalCostBRL?: number;
  totalCost?: number;
}

export interface CalculatedClassGroup<T extends PositionCalculationRow> {
  className: string;
  rows: T[];
  totalValueBRL: number;
  totalPct: number;
  totalPnl: number;
  totalCostBRL: number;
  totalDividends: number;
  totalReturnPnl: number;
  totalReturnPct: number | null;
  unrealizedPct: number | null;
  count: number;
}

/**
 * Agrupa linhas de posições patrimoniais por classe de ativo e calcula métricas financeiras agregadas
 * (Valor BRL, PnL Não Realizado, Custo Total, Proventos, Retorno Total e Percentuais).
 * Regra AGENTS.md §3: Todo cálculo de negócio vive em src/domain/ como função pura.
 */
export function calculatePositionClassGroups<T extends PositionCalculationRow>(
  rows: readonly T[],
  sortFn?: (rows: T[]) => T[],
): CalculatedClassGroup<T>[] {
  const groupsMap = new Map<string, T[]>();
  for (const row of rows) {
    const cls = row.assetClass || "Outros";
    const list = groupsMap.get(cls) ?? [];
    list.push(row);
    groupsMap.set(cls, list);
  }

  const groups: CalculatedClassGroup<T>[] = [];
  for (const [className, groupRows] of groupsMap.entries()) {
    const totalValueBRL = groupRows.reduce((sum, r) => sum + r.valueBRL, 0);
    const totalPct = groupRows.reduce((sum, r) => sum + r.pct, 0);
    const totalPnl = groupRows.reduce((sum, r) => sum + r.unrealizedPnl, 0);
    const totalDividends = groupRows.reduce((sum, r) => sum + (r.dividends ?? 0), 0);
    const totalCostBRL = groupRows.reduce((sum, r) => {
      const cost = r.totalCostBRL ?? r.totalCost ?? (r.valueBRL - r.unrealizedPnl);
      return sum + Math.max(0, cost);
    }, 0);
    const unrealizedPct = totalCostBRL > 0 ? (totalPnl / totalCostBRL) * 100 : null;
    const totalReturnPnl = Math.round((totalPnl + totalDividends) * 100) / 100;
    const totalReturnPct = totalCostBRL > 0 ? (totalReturnPnl / totalCostBRL) * 100 : null;

    groups.push({
      className,
      rows: sortFn ? sortFn(groupRows) : groupRows,
      totalValueBRL,
      totalPct,
      totalPnl,
      totalCostBRL,
      totalDividends,
      totalReturnPnl,
      totalReturnPct,
      unrealizedPct,
      count: groupRows.length,
    });
  }

  return groups;
}

