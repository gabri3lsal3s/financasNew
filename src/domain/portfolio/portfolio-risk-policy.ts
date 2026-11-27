import type { PortfolioAsset } from "@/types";
import {
  resolveCarouselPortfolioValuation,
  type CarouselValuationRow,
} from "./carousel-valuation";
import { calculatePortfolioDiversification } from "./diversification-metrics";
import {
  inferEtfBenchmark,
  inferMacroSector,
  isDiversifiedVehicle,
  parseIssuerFromTicker,
} from "./tickers-catalog";

function formatPtBrNumber(value: number, decimals = 1): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatPtBrBRL(value: number): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Política Centralizada de Risco de Portfólio (Fase 1 / Quality Gate 1)
 *
 * Define limites hierárquicos de concentração, descorrelação estrutural,
 * salvaguardas para emissores de renda fixa privada e proteção contra
 * pulverização ou armadilhas de valor.
 */
export interface PortfolioRiskPolicy {
  /** Teto padrão de concentração em ativo individual (% do patrimônio total). Padrão: 15%. */
  defaultAssetCeilingPct: number;
  /** Teto de concentração para veículos estruturalmente diversificados (ETFs amplos / Tesouro) (% do total). Padrão: 40%. */
  diversifiedAssetCeilingPct: number;
  /** Teto setorial relativo à respectiva classe (% da classe). Padrão: 35%. */
  defaultSectorInClassCeilingPct: number;
  /** Teto setorial global secundário (% do patrimônio total). Padrão: 25%. */
  defaultSectorGlobalCeilingPct: number;
  /** Teto macro-setorial relativo à respectiva classe (% da classe). Padrão: 45%. */
  macroSectorInClassCeilingPct: number;
  /** Teto macro-setorial global secundário (% do patrimônio total). Padrão: 35%. */
  macroSectorGlobalCeilingPct: number;
  /** Teto máximo por emissor privado na classe de Renda Fixa (% da classe). Padrão: 30%. */
  maxPrivateIssuerInFixedIncomePct: number;
  /** Teto máximo por emissor privado na carteira total (% do patrimônio). Padrão: 15%. */
  maxPrivateIssuerPct: number;
  /** Limite prudencial do FGC por instituição emissora privada (R$). Padrão: R$ 250.000,00. */
  maxPrivateIssuerFgcBRL: number;
  /** Nota de corte de convicção fundamentalista (notas <= corte entram em soft lock de qualidade). Padrão: 5. */
  lowScoreThreshold: number;
  /** Ticket financeiro mínimo para abertura de novas posições em lote B3 (anti-pulverização). Padrão: R$ 100,00. */
  minTicketBRL: number;
  /** Teto máximo de sobreposição de ETFs replicando o mesmo benchmark (% do total). Padrão: 30%. */
  benchmarkOverlapCeilingPct: number;
}

export const DEFAULT_PORTFOLIO_RISK_POLICY: PortfolioRiskPolicy = {
  defaultAssetCeilingPct: 15,
  diversifiedAssetCeilingPct: 40,
  defaultSectorInClassCeilingPct: 35,
  defaultSectorGlobalCeilingPct: 25,
  macroSectorInClassCeilingPct: 45,
  macroSectorGlobalCeilingPct: 35,
  maxPrivateIssuerInFixedIncomePct: 30,
  maxPrivateIssuerPct: 15,
  maxPrivateIssuerFgcBRL: 250_000,
  lowScoreThreshold: 5,
  minTicketBRL: 100,
  benchmarkOverlapCeilingPct: 30,
};

export function resolvePortfolioRiskPolicy(
  customPolicy?: Partial<PortfolioRiskPolicy> | null
): PortfolioRiskPolicy {
  if (!customPolicy) return DEFAULT_PORTFOLIO_RISK_POLICY;
  return {
    ...DEFAULT_PORTFOLIO_RISK_POLICY,
    ...customPolicy,
  };
}

export interface StructuralRiskAlert {
  id: string;
  type:
    | "single_asset_concentration"
    | "macro_sector_concentration"
    | "low_diversification_nef"
    | "private_issuer_fgc"
    | "benchmark_overlap";
  priority: number;
  tone: "critical" | "warning" | "positive" | "primary" | "info";
  title: string;
  description: string;
  ctaText?: string;
  ctaAction?: string;
  metadata?: Record<string, unknown>;
}

export interface EvaluatePortfolioStructuralRiskOptions {
  fxRateUSD?: number;
  targetsByClass?: Record<string, number>;
  positionRows?: readonly CarouselValuationRow[];
  cashBRL?: number;
  asOf?: string;
}

/**
 * Avalia a carteira atual contra a política de risco e gera alertas estruturais puros.
 * Consumido pelo carrossel de insights de investimentos (Fase 4).
 */
export function evaluatePortfolioStructuralRisk(
  assets: readonly PortfolioAsset[],
  customPolicy?: Partial<PortfolioRiskPolicy> | null,
  options?: EvaluatePortfolioStructuralRiskOptions
): StructuralRiskAlert[] {
  const policy = resolvePortfolioRiskPolicy(customPolicy);
  const valuation = resolveCarouselPortfolioValuation(assets, {
    positionRows: options?.positionRows,
    cashBRL: options?.cashBRL,
    fxRateUSD: options?.fxRateUSD,
  });
  const fxRate = valuation.fxRateUSD;
  const asOf = options?.asOf ?? new Date().toISOString().slice(0, 10);

  const positiveItems = valuation.items.filter((i) => i.valueBRL > 0);
  if (positiveItems.length === 0) return [];

  const totalValueBRL = valuation.patrimonyTotalBRL;
  if (totalValueBRL <= 0) return [];

  const alerts: StructuralRiskAlert[] = [];

  // 1. Hiperconcentração em Ativo Único (usa policy.defaultAssetCeilingPct / policy.diversifiedAssetCeilingPct)
  const assetViolators: Array<{
    asset: PortfolioAsset;
    valueBRL: number;
    weightPct: number;
    thresholdPct: number;
    ratio: number;
    source: "position" | "cost_fallback";
    isEstimate: boolean;
  }> = [];

  for (const item of positiveItems) {
    const asset = item.asset;
    const isDiversified = isDiversifiedVehicle(asset);
    const thresholdPct = isDiversified
      ? policy.diversifiedAssetCeilingPct
      : policy.defaultAssetCeilingPct;
    if (thresholdPct <= 0) continue;

    const weightPct = (item.valueBRL / totalValueBRL) * 100;
    if (weightPct >= thresholdPct) {
      assetViolators.push({
        asset,
        valueBRL: item.valueBRL,
        weightPct,
        thresholdPct,
        ratio: weightPct / thresholdPct,
        source: item.source,
        isEstimate: item.isEstimate,
      });
    }
  }

  assetViolators.sort(
    (a, b) =>
      b.ratio - a.ratio ||
      b.valueBRL - a.valueBRL ||
      a.asset.ticker.localeCompare(b.asset.ticker),
  );

  if (assetViolators.length > 0) {
    const leader = assetViolators[0]!;
    const extraCount = assetViolators.length - 1;
    const relationText =
      Math.abs(leader.weightPct - leader.thresholdPct) < 1e-6
        ? "atingiu o limite prudencial"
        : "está acima do limite prudencial";
    alerts.push({
      id: `single-asset-${leader.asset.ticker}`,
      type: "single_asset_concentration",
      priority: 1.5,
      tone: "critical",
      title:
        extraCount > 0
          ? `Concentração em ${leader.asset.ticker} e +${extraCount}`
          : `Alta concentração em ${leader.asset.ticker}`,
      description: `${leader.asset.ticker} representa ${formatPtBrNumber(leader.weightPct)}% do patrimônio (${relationText} de ${formatPtBrNumber(leader.thresholdPct, 0)}%).`,
      ctaText: "Simular Rebalanceamento",
      ctaAction: "navigate_aporte",
      metadata: {
        asOf,
        totalValueBRL,
        cashBRL: valuation.cashBRL,
        cashIncludedInGlobal: valuation.cashIncludedInGlobal,
        fallbackTickers: valuation.fallbackTickers,
        policy,
        assetId: leader.asset.id,
        ticker: leader.asset.ticker,
        weightPct: leader.weightPct,
        thresholdPct: leader.thresholdPct,
        valueBRL: leader.valueBRL,
        extraCount,
        violators: assetViolators.map((v) => ({
          assetId: v.asset.id,
          ticker: v.asset.ticker,
          valueBRL: v.valueBRL,
          weightPct: v.weightPct,
          thresholdPct: v.thresholdPct,
          source: v.source,
        })),
      },
    });
  }

  // 2. Teto de Emissor Privado FGC (absoluto, na classe RF e global na carteira)
  const rfItems = positiveItems.filter((item) => {
    const c = (item.asset.asset_class ?? "").toLowerCase();
    return c.includes("renda fixa") || c.includes("pos") || c.includes("pre") || c.includes("ipca");
  });
  const totalRfBRL = rfItems.reduce((sum, item) => sum + item.valueBRL, 0);

  const issuerMap = new Map<
    string,
    {
      label: string;
      valueBRL: number;
      isSovereign: boolean;
      constituents: Array<{ assetId: string; ticker: string; valueBRL: number; source: "position" | "cost_fallback" }>;
    }
  >();
  for (const item of rfItems) {
    const issuer = parseIssuerFromTicker(item.asset.ticker, item.asset.notes);
    const existing = issuerMap.get(issuer.issuerKey) ?? {
      label: issuer.issuerLabel,
      valueBRL: 0,
      isSovereign: issuer.isSovereign,
      constituents: [],
    };
    existing.valueBRL += item.valueBRL;
    existing.constituents.push({
      assetId: item.asset.id,
      ticker: item.asset.ticker,
      valueBRL: item.valueBRL,
      source: item.source,
    });
    issuerMap.set(issuer.issuerKey, existing);
  }

  const issuerViolators: Array<{
    key: string;
    label: string;
    valueBRL: number;
    issuerRfPct: number;
    issuerGlobalPct: number;
    exceedsFgc: boolean;
    exceedsRfCeiling: boolean;
    exceedsGlobalCeiling: boolean;
    breachedLimit: "fgc_absolute" | "rf_class" | "global";
    ratio: number;
    constituents: Array<{ assetId: string; ticker: string; valueBRL: number; source: "position" | "cost_fallback" }>;
  }> = [];

  for (const [key, item] of issuerMap.entries()) {
    if (item.isSovereign || key === "tesouro_nacional") continue;

    const issuerRfPct = totalRfBRL > 0 ? (item.valueBRL / totalRfBRL) * 100 : 0;
    const issuerGlobalPct = (item.valueBRL / totalValueBRL) * 100;
    const exceedsFgc = policy.maxPrivateIssuerFgcBRL > 0 && item.valueBRL > policy.maxPrivateIssuerFgcBRL;
    const exceedsRfCeiling =
      policy.maxPrivateIssuerInFixedIncomePct > 0 &&
      rfItems.length >= 3 &&
      issuerRfPct > policy.maxPrivateIssuerInFixedIncomePct;
    const exceedsGlobalCeiling =
      policy.maxPrivateIssuerPct > 0 && issuerGlobalPct > policy.maxPrivateIssuerPct;

    if (exceedsFgc || exceedsRfCeiling || exceedsGlobalCeiling) {
      const fgcRatio = policy.maxPrivateIssuerFgcBRL > 0 ? item.valueBRL / policy.maxPrivateIssuerFgcBRL : 0;
      const rfRatio =
        exceedsRfCeiling && policy.maxPrivateIssuerInFixedIncomePct > 0
          ? issuerRfPct / policy.maxPrivateIssuerInFixedIncomePct
          : 0;
      const globalRatio =
        exceedsGlobalCeiling && policy.maxPrivateIssuerPct > 0
          ? issuerGlobalPct / policy.maxPrivateIssuerPct
          : 0;

      const breachedLimit: "fgc_absolute" | "rf_class" | "global" = exceedsFgc
        ? "fgc_absolute"
        : rfRatio >= globalRatio
          ? "rf_class"
          : "global";
      const ratio = Math.max(exceedsFgc ? fgcRatio : 0, rfRatio, globalRatio);

      issuerViolators.push({
        key,
        label: item.label,
        valueBRL: item.valueBRL,
        issuerRfPct,
        issuerGlobalPct,
        exceedsFgc,
        exceedsRfCeiling,
        exceedsGlobalCeiling,
        breachedLimit,
        ratio,
        constituents: item.constituents,
      });
    }
  }

  issuerViolators.sort(
    (a, b) =>
      Number(b.exceedsFgc) - Number(a.exceedsFgc) ||
      b.ratio - a.ratio ||
      b.valueBRL - a.valueBRL ||
      a.key.localeCompare(b.key),
  );

  if (issuerViolators.length > 0) {
    const leader = issuerViolators[0]!;
    const extraCount = issuerViolators.length - 1;
    let description: string;
    if (leader.breachedLimit === "fgc_absolute") {
      description = `Exposição estimada de R$ ${formatPtBrBRL(leader.valueBRL)} excede o limite prudencial do FGC (R$ ${formatPtBrBRL(policy.maxPrivateIssuerFgcBRL)}).`;
    } else if (leader.breachedLimit === "rf_class") {
      description = `Exposição estimada em ${leader.label} atinge ${formatPtBrNumber(leader.issuerRfPct)}% da Renda Fixa (limite prudencial de ${formatPtBrNumber(policy.maxPrivateIssuerInFixedIncomePct, 0)}%).`;
    } else {
      description = `Exposição estimada em ${leader.label} atinge ${formatPtBrNumber(leader.issuerGlobalPct)}% do patrimônio (limite prudencial de ${formatPtBrNumber(policy.maxPrivateIssuerPct, 0)}%).`;
    }

    alerts.push({
      id: `private-issuer-${leader.key}`,
      type: "private_issuer_fgc",
      priority: 2.5,
      tone: "critical",
      title:
        extraCount > 0
          ? `Exposição em ${leader.label} e +${extraCount}`
          : `Exposição concentrada em ${leader.label}`,
      description,
      ctaText: "Ver Renda Fixa",
      ctaAction: "navigate_fixed_income",
      metadata: {
        asOf,
        totalValueBRL,
        totalRfBRL,
        cashBRL: valuation.cashBRL,
        fallbackTickers: valuation.fallbackTickers,
        policy,
        issuerKey: leader.key,
        issuerLabel: leader.label,
        valueBRL: leader.valueBRL,
        issuerRfPct: leader.issuerRfPct,
        issuerGlobalPct: leader.issuerGlobalPct,
        exceedsFgc: leader.exceedsFgc,
        breachedLimit: leader.breachedLimit,
        constituents: leader.constituents,
        extraCount,
        violators: issuerViolators.map((v) => ({
          issuerKey: v.key,
          issuerLabel: v.label,
          valueBRL: v.valueBRL,
          issuerRfPct: v.issuerRfPct,
          issuerGlobalPct: v.issuerGlobalPct,
          breachedLimit: v.breachedLimit,
        })),
      },
    });
  }

  // 3. Concentração em Macro-Setor (Ações sem caixa; global com caixa)
  const stockItems = positiveItems.filter((item) => {
    const c = (item.asset.asset_class ?? "").toLowerCase();
    return c.includes("ação") || c.includes("acoes") || c.includes("ações");
  });
  const totalStockBRL = stockItems.reduce((sum, item) => sum + item.valueBRL, 0);

  if (stockItems.length >= 4 && totalStockBRL > 0) {
    const macroMap = new Map<
      string,
      { valueBRL: number; constituents: Array<{ assetId: string; ticker: string; valueBRL: number; source: "position" | "cost_fallback" }> }
    >();
    for (const item of stockItems) {
      const macro = inferMacroSector(item.asset);
      if (macro) {
        const cur = macroMap.get(macro) ?? { valueBRL: 0, constituents: [] };
        cur.valueBRL += item.valueBRL;
        cur.constituents.push({
          assetId: item.asset.id,
          ticker: item.asset.ticker,
          valueBRL: item.valueBRL,
          source: item.source,
        });
        macroMap.set(macro, cur);
      }
    }

    const MACRO_LABELS: Record<string, string> = {
      macro_financeiro: "Financeiro (Bancos & Seguros)",
      macro_commodities: "Commodities Cíclicas (Petróleo, Minério & Agro)",
      macro_utilities: "Utilidades Públicas (Energia & Saneamento)",
      macro_real_estate: "Imobiliário & Construção",
      macro_tech: "Tecnologia & Comunicação",
      macro_consumo_saude: "Consumo & Saúde",
    };

    const macroViolators: Array<{
      macroKey: string;
      label: string;
      macroValBRL: number;
      macroInClassPct: number;
      macroGlobalPct: number;
      breachedLimit: "in_class" | "global";
      ratio: number;
      constituents: Array<{ assetId: string; ticker: string; valueBRL: number; source: "position" | "cost_fallback" }>;
    }> = [];

    for (const [macro, entry] of macroMap.entries()) {
      const macroInClassPct = (entry.valueBRL / totalStockBRL) * 100;
      const macroGlobalPct = (entry.valueBRL / totalValueBRL) * 100;

      const exceedsClass =
        policy.macroSectorInClassCeilingPct > 0 &&
        macroInClassPct > policy.macroSectorInClassCeilingPct;
      const exceedsGlobal =
        policy.macroSectorGlobalCeilingPct > 0 &&
        macroGlobalPct > policy.macroSectorGlobalCeilingPct;

      if (exceedsClass || exceedsGlobal) {
        const classRatio = exceedsClass ? macroInClassPct / policy.macroSectorInClassCeilingPct : 0;
        const globalRatio = exceedsGlobal ? macroGlobalPct / policy.macroSectorGlobalCeilingPct : 0;
        macroViolators.push({
          macroKey: macro,
          label: MACRO_LABELS[macro] ?? macro,
          macroValBRL: entry.valueBRL,
          macroInClassPct,
          macroGlobalPct,
          breachedLimit: classRatio >= globalRatio ? "in_class" : "global",
          ratio: Math.max(classRatio, globalRatio),
          constituents: entry.constituents,
        });
      }
    }

    macroViolators.sort(
      (a, b) =>
        b.ratio - a.ratio ||
        b.macroValBRL - a.macroValBRL ||
        a.macroKey.localeCompare(b.macroKey),
    );

    if (macroViolators.length > 0) {
      const leader = macroViolators[0]!;
      const extraCount = macroViolators.length - 1;
      alerts.push({
        id: `macro-sector-${leader.macroKey}`,
        type: "macro_sector_concentration",
        priority: 5.5,
        tone: "warning",
        title:
          extraCount > 0
            ? `Concentração em ${leader.label} e +${extraCount}`
            : `Concentração em ${leader.label}`,
        description: `O bloco macro concentra ${formatPtBrNumber(leader.macroInClassPct)}% das Ações (${formatPtBrNumber(leader.macroGlobalPct)}% da carteira), acima dos limites.`,
        ctaText: "Simular Rebalanceamento",
        ctaAction: "navigate_aporte",
        metadata: {
          asOf,
          totalValueBRL,
          totalStockBRL,
          cashBRL: valuation.cashBRL,
          fallbackTickers: valuation.fallbackTickers,
          policy,
          macroKey: leader.macroKey,
          macroLabel: leader.label,
          macroInClassPct: leader.macroInClassPct,
          macroGlobalPct: leader.macroGlobalPct,
          macroValBRL: leader.macroValBRL,
          breachedLimit: leader.breachedLimit,
          constituents: leader.constituents,
          extraCount,
          violators: macroViolators.map((v) => ({
            macroKey: v.macroKey,
            macroLabel: v.label,
            macroInClassPct: v.macroInClassPct,
            macroGlobalPct: v.macroGlobalPct,
            macroValBRL: v.macroValBRL,
          })),
        },
      });
    }
  }

  // 4. Baixa Descentralização Real (Nef de Ações < 3.0 com >= 5 ações; usa valores de posição e testa bruto)
  const diversification = calculatePortfolioDiversification(assets, {
    fxRateUSD: fxRate,
    positionRows: options?.positionRows,
    cashBRL: options?.cashBRL,
  });
  const stockSummary = diversification.byClass["Ações"] ?? diversification.byClass["Acoes"];
  if (
    stockSummary &&
    stockSummary.assetCount >= 5 &&
    stockSummary.classHHI !== null &&
    stockSummary.classHHI > 0 &&
    stockSummary.classValueBRL > 0
  ) {
    // Calcula HHI/Nef bruto sem arredondamento prévio para evitar erro de borda
    let rawHhi = 0;
    const stockWeights: Array<{ assetId: string; ticker: string; valueBRL: number; weight: number; weightSq: number; source: "position" | "cost_fallback" }> = [];
    for (const item of stockItems) {
      const w = item.valueBRL / stockSummary.classValueBRL;
      const wSq = w * w;
      rawHhi += wSq;
      stockWeights.push({
        assetId: item.asset.id,
        ticker: item.asset.ticker,
        valueBRL: item.valueBRL,
        weight: w,
        weightSq: wSq,
        source: item.source,
      });
    }
    const rawNef = rawHhi > 0 ? 1 / rawHhi : null;

    if (rawNef !== null && rawNef < 3.0) {
      const formattedNef = formatPtBrNumber(rawNef);
      alerts.push({
        id: "low-diversification-nef-stocks",
        type: "low_diversification_nef",
        priority: 6.5,
        tone: "primary",
        title: "Concentração oculta em Ações",
        description: `Apesar de ter ${stockSummary.assetCount} ações, a carteira equivale a ${formattedNef} ações na distribuição atual.`,
        ctaText: "Ver Sugestão de Aporte",
        ctaAction: "navigate_aporte",
        metadata: {
          asOf,
          totalValueBRL,
          classValueBRL: stockSummary.classValueBRL,
          fallbackTickers: valuation.fallbackTickers,
          policy,
          assetCount: stockSummary.assetCount,
          classNef: rawNef,
          classHHI: rawHhi,
          formattedNef,
          constituents: stockWeights.sort((a, b) => b.valueBRL - a.valueBRL),
        },
      });
    }
  }

  // 5. Sobreposição Excessiva de Benchmark em ETFs (omite índice desconhecido)
  const etfMap = new Map<
    string,
    { count: number; valueBRL: number; constituents: Array<{ assetId: string; ticker: string; valueBRL: number; source: "position" | "cost_fallback" }> }
  >();
  for (const item of positiveItems) {
    const benchmark = inferEtfBenchmark(item.asset);
    if (benchmark && benchmark !== "unknown") {
      const existing = etfMap.get(benchmark) ?? { count: 0, valueBRL: 0, constituents: [] };
      existing.count += 1;
      existing.valueBRL += item.valueBRL;
      existing.constituents.push({
        assetId: item.asset.id,
        ticker: item.asset.ticker,
        valueBRL: item.valueBRL,
        source: item.source,
      });
      etfMap.set(benchmark, existing);
    }
  }

  const BENCHMARK_LABELS: Record<string, string> = {
    sp500: "S&P 500",
    nasdaq100: "Nasdaq 100",
    all_world: "Global Amplo (All-World)",
    ibovespa: "Ibovespa",
    ibrx100: "IBrX-100",
    smal_cap_br: "Small Caps Brasil",
    bitcoin: "Bitcoin",
    ethereum: "Ethereum",
  };

  const overlapViolators: Array<{
    benchmark: string;
    label: string;
    count: number;
    valueBRL: number;
    overlapPct: number;
    ratio: number;
    constituents: Array<{ assetId: string; ticker: string; valueBRL: number; source: "position" | "cost_fallback" }>;
  }> = [];

  for (const [benchmark, data] of etfMap.entries()) {
    const overlapPct = (data.valueBRL / totalValueBRL) * 100;
    if (
      policy.benchmarkOverlapCeilingPct > 0 &&
      data.count >= 2 &&
      overlapPct > policy.benchmarkOverlapCeilingPct
    ) {
      overlapViolators.push({
        benchmark,
        label: BENCHMARK_LABELS[benchmark] ?? benchmark,
        count: data.count,
        valueBRL: data.valueBRL,
        overlapPct,
        ratio: overlapPct / policy.benchmarkOverlapCeilingPct,
        constituents: data.constituents,
      });
    }
  }

  overlapViolators.sort(
    (a, b) =>
      b.ratio - a.ratio ||
      b.valueBRL - a.valueBRL ||
      a.benchmark.localeCompare(b.benchmark),
  );

  if (overlapViolators.length > 0) {
    const leader = overlapViolators[0]!;
    const extraCount = overlapViolators.length - 1;
    alerts.push({
      id: `benchmark-overlap-${leader.benchmark}`,
      type: "benchmark_overlap",
      priority: 7.5,
      tone: "info",
      title:
        extraCount > 0
          ? `Exposição em ${leader.label} e +${extraCount}`
          : `Sobreposição de ETFs em ${leader.label}`,
      description: `${leader.count} veículos expostos ao mesmo índice ${leader.label} somam ${formatPtBrNumber(leader.overlapPct)}% do patrimônio.`,
      ctaText: "Ver Carteira",
      ctaAction: "navigate_portfolio",
      metadata: {
        asOf,
        totalValueBRL,
        cashBRL: valuation.cashBRL,
        fallbackTickers: valuation.fallbackTickers,
        policy,
        benchmark: leader.benchmark,
        benchmarkLabel: leader.label,
        count: leader.count,
        overlapPct: leader.overlapPct,
        valueBRL: leader.valueBRL,
        constituents: leader.constituents,
        extraCount,
      },
    });
  }

  // Ordena alertas por prioridade estrita (menor valor = maior prioridade)
  alerts.sort((a, b) => a.priority - b.priority);
  return alerts;
}
