import type { PortfolioAsset } from "@/types";
import {
  inferEtfBenchmark,
  inferMacroSector,
  isDiversifiedVehicle,
  parseIssuerFromTicker,
} from "./tickers-catalog";
import { calculatePortfolioDiversification } from "./diversification-metrics";

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
  const fxRate = options?.fxRateUSD && options.fxRateUSD > 0 ? options.fxRateUSD : 5.0;

  // Filtra posições ativas com quantidade e preço positivos
  const activeAssets = assets.filter((a) => (a.quantity ?? 0) > 0 && (a.average_price ?? 0) > 0);
  if (activeAssets.length === 0) return [];

  const getAssetValueBRL = (a: PortfolioAsset): number => {
    const rawVal = (a.quantity ?? 0) * (a.average_price ?? 0);
    return a.currency === "USD" ? rawVal * fxRate : rawVal;
  };

  const totalValueBRL = activeAssets.reduce((sum, a) => sum + getAssetValueBRL(a), 0);
  if (totalValueBRL <= 0) return [];

  const alerts: StructuralRiskAlert[] = [];

  // 1. Hiperconcentração em Ativo Único (>= 25% ou > teto para ativos não-diversificados)
  for (const asset of activeAssets) {
    const assetVal = getAssetValueBRL(asset);
    const weightPct = (assetVal / totalValueBRL) * 100;
    const isDiversified = isDiversifiedVehicle(asset);

    // Se for ativo comum e exceder 25%, ou veículo diversificado excedendo 50%
    const criticalThreshold = isDiversified ? 50 : 25;
    if (weightPct >= criticalThreshold) {
      alerts.push({
        id: `single-asset-${asset.ticker}`,
        type: "single_asset_concentration",
        priority: 1.5,
        tone: "critical",
        title: `Alta concentração em ${asset.ticker}`,
        description: `${asset.ticker} representa ${weightPct.toFixed(1)}% do patrimônio total, acima do limite prudencial de ${criticalThreshold}%.`,
        ctaText: "Simular Rebalanceamento",
        ctaAction: "navigate_aporte",
        metadata: {
          ticker: asset.ticker,
          weightPct,
          thresholdPct: criticalThreshold,
          valueBRL: assetVal,
        },
      });
      break; // Evita poluir com múltiplos se um já for o maior
    }
  }

  // 2. Teto de Emissor Privado FGC (R$ 250k ou 30% da Renda Fixa)
  const rfAssets = activeAssets.filter((a) => {
    const c = (a.asset_class ?? "").toLowerCase();
    return c.includes("renda fixa") || c.includes("pos") || c.includes("pre") || c.includes("ipca");
  });
  const totalRfBRL = rfAssets.reduce((sum, a) => sum + getAssetValueBRL(a), 0);

  const issuerMap = new Map<string, { label: string; valueBRL: number; isSovereign: boolean }>();
  for (const asset of rfAssets) {
    const issuer = parseIssuerFromTicker(asset.ticker, asset.notes);
    const val = getAssetValueBRL(asset);
    const existing = issuerMap.get(issuer.issuerKey) ?? {
      label: issuer.issuerLabel,
      valueBRL: 0,
      isSovereign: issuer.isSovereign,
    };
    existing.valueBRL += val;
    issuerMap.set(issuer.issuerKey, existing);
  }

  for (const [key, item] of issuerMap.entries()) {
    if (item.isSovereign || key === "tesouro_nacional") continue;

    const issuerRfPct = totalRfBRL > 0 ? (item.valueBRL / totalRfBRL) * 100 : 0;
    const exceedsFgc = item.valueBRL > policy.maxPrivateIssuerFgcBRL;
    const exceedsRfCeiling = issuerRfPct > policy.maxPrivateIssuerInFixedIncomePct && rfAssets.length >= 3;

    if (exceedsFgc || exceedsRfCeiling) {
      alerts.push({
        id: `private-issuer-${key}`,
        type: "private_issuer_fgc",
        priority: 2.5,
        tone: "critical",
        title: `Exposição concentrada em ${item.label}`,
        description: exceedsFgc
          ? `Alocação de R$ ${item.valueBRL.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} excede a cobertura do FGC (R$ 250.000,00).`
          : `${item.label} concentra ${issuerRfPct.toFixed(1)}% de toda a Renda Fixa (teto de ${policy.maxPrivateIssuerInFixedIncomePct}%).`,
        ctaText: "Ver Renda Fixa",
        ctaAction: "navigate_fixed_income",
        metadata: {
          issuerKey: key,
          issuerLabel: item.label,
          valueBRL: item.valueBRL,
          issuerRfPct,
          exceedsFgc,
        },
      });
      break;
    }
  }

  // 3. Concentração em Macro-Setor (Bancos + Seguros ou Commodities)
  const stockAssets = activeAssets.filter((a) => {
    const c = (a.asset_class ?? "").toLowerCase();
    return c.includes("ação") || c.includes("acoes") || c.includes("ações");
  });
  const totalStockBRL = stockAssets.reduce((sum, a) => sum + getAssetValueBRL(a), 0);

  if (stockAssets.length >= 4 && totalStockBRL > 0) {
    const macroMap = new Map<string, number>();
    for (const asset of stockAssets) {
      const macro = inferMacroSector(asset);
      if (macro) {
        const val = getAssetValueBRL(asset);
        macroMap.set(macro, (macroMap.get(macro) ?? 0) + val);
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

    for (const [macro, macroVal] of macroMap.entries()) {
      const macroInClassPct = (macroVal / totalStockBRL) * 100;
      const macroGlobalPct = (macroVal / totalValueBRL) * 100;

      if (
        macroInClassPct > policy.macroSectorInClassCeilingPct ||
        macroGlobalPct > policy.macroSectorGlobalCeilingPct
      ) {
        const label = MACRO_LABELS[macro] ?? macro;
        alerts.push({
          id: `macro-sector-${macro}`,
          type: "macro_sector_concentration",
          priority: 5.5,
          tone: "warning",
          title: `Concentração em ${label}`,
          description: `O bloco macro concentra ${macroInClassPct.toFixed(1)}% das Ações (${macroGlobalPct.toFixed(1)}% da carteira), acima dos limites de conforto.`,
          ctaText: "Simular Rebalanceamento",
          ctaAction: "navigate_aporte",
          metadata: {
            macroKey: macro,
            macroInClassPct,
            macroGlobalPct,
            macroValBRL: macroVal,
          },
        });
        break;
      }
    }
  }

  // 4. Baixa Descentralização Real (Nef de Ações < 3.0 com >= 5 ações)
  const diversification = calculatePortfolioDiversification(activeAssets, { fxRateUSD: fxRate });
  const stockSummary = diversification.byClass["Ações"] ?? diversification.byClass["Acoes"];
  if (stockSummary && stockSummary.assetCount >= 5 && stockSummary.classNef !== null && stockSummary.classNef < 3.0) {
    alerts.push({
      id: "low-diversification-nef-stocks",
      type: "low_diversification_nef",
      priority: 6.5,
      tone: "primary",
      title: "Concentração oculta em Ações",
      description: `Apesar de ter ${stockSummary.assetCount} ações, a carteira se comporta como se tivesse apenas ${stockSummary.classNef.toFixed(1)} ativos equivalentes devido à concentração.`,
      ctaText: "Ver Sugestão de Aporte",
      ctaAction: "navigate_aporte",
      metadata: {
        assetCount: stockSummary.assetCount,
        classNef: stockSummary.classNef,
        classHHI: stockSummary.classHHI,
      },
    });
  }

  // 5. Sobreposição Excessiva de Benchmark em ETFs
  const etfMap = new Map<string, { count: number; valueBRL: number }>();
  for (const asset of activeAssets) {
    const benchmark = inferEtfBenchmark(asset);
    if (benchmark) {
      const val = getAssetValueBRL(asset);
      const existing = etfMap.get(benchmark) ?? { count: 0, valueBRL: 0 };
      existing.count += 1;
      existing.valueBRL += val;
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

  for (const [benchmark, data] of etfMap.entries()) {
    const overlapPct = (data.valueBRL / totalValueBRL) * 100;
    if (data.count >= 2 && overlapPct > policy.benchmarkOverlapCeilingPct) {
      const benchLabel = BENCHMARK_LABELS[benchmark] ?? benchmark;
      alerts.push({
        id: `benchmark-overlap-${benchmark}`,
        type: "benchmark_overlap",
        priority: 7.5,
        tone: "info",
        title: `Sobreposição de ETFs em ${benchLabel}`,
        description: `Existem ${data.count} veículos replicando o índice ${benchLabel}, somando ${overlapPct.toFixed(1)}% do patrimônio.`,
        ctaText: "Ver Carteira",
        ctaAction: "navigate_portfolio",
        metadata: {
          benchmark,
          count: data.count,
          overlapPct,
          valueBRL: data.valueBRL,
        },
      });
      break;
    }
  }

  // Ordena alertas por prioridade estrita (menor valor = maior prioridade)
  alerts.sort((a, b) => a.priority - b.priority);
  return alerts;
}
