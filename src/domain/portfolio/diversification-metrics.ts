import type { PortfolioAsset } from "@/types";
import {
  resolveCarouselPortfolioValuation,
  type CarouselValuationRow,
  type ValuedPortfolioAsset,
} from "./carousel-valuation";
import {
  inferEtfBenchmark,
  parseIssuerFromTicker,
} from "./tickers-catalog";

export interface ConsolidatedRiskVector {
  key: string;
  label: string;
  type: "asset" | "rf_issuer" | "etf_benchmark" | "cash";
  valueBRL: number;
  weightPct: number;
}

export interface ClassDiversificationSummary {
  className: string;
  classValueBRL: number;
  classHHI: number | null;
  classNef: number | null;
  assetCount: number;
}

export interface PortfolioDiversificationSummary {
  totalValueBRL: number;
  cashIncludedInGlobal: boolean;
  globalHHI: number | null;
  globalNef: number | null;
  byClass: Record<string, ClassDiversificationSummary>;
  consolidatedVectors: ConsolidatedRiskVector[];
}

export interface DiversificationCalculationOptions {
  fxRateUSD?: number;
  positionRows?: readonly CarouselValuationRow[];
  cashBRL?: number;
}

/**
 * Normaliza o nome da classe para agrupamento consistente.
 */
function normalizeClass(cls?: string | null): string {
  const c = (cls ?? "").trim().toLowerCase();
  if (c.includes("ação") || c.includes("acoes") || c.includes("ações")) return "Ações";
  if (c.includes("fii")) return "FIIs";
  if (c.includes("renda fixa") || c.includes("pos") || c.includes("pre") || c.includes("ipca")) return "Renda Fixa";
  if (c.includes("internacional") || c.includes("global") || c.includes("us")) return "Internacional";
  if (c.includes("etf") || c.includes("índice") || c.includes("indice")) return "ETFs";
  if (c.includes("bdr")) return "BDRs";
  if (c.includes("cripto") || c.includes("crypto")) return "Cripto";
  return cls?.trim() || "Outros";
}

/**
 * Consolida os ativos da carteira em vetores de risco agregados:
 * 1. Títulos de Renda Fixa privada emitidos pela mesma instituição são agrupados por issuerKey.
 * 2. ETFs que replicam o mesmo benchmark subjacente são agrupados por benchmarkKey.
 * 3. Demais ativos (Ações, FIIs, etc.) permanecem individuais por ticker.
 * 4. Posições com valor <= 0 são ignoradas.
 */
export function buildConsolidatedRiskVectors(
  assets: readonly PortfolioAsset[],
  options?: DiversificationCalculationOptions
): { totalValueBRL: number; cashIncludedInGlobal: boolean; vectors: ConsolidatedRiskVector[]; valuedItems: ValuedPortfolioAsset[] } {
  const valuation = resolveCarouselPortfolioValuation(assets, options);
  const positiveItems = valuation.items.filter((i) => i.valueBRL > 0);
  if (positiveItems.length === 0 && !valuation.cashIncludedInGlobal) {
    return { totalValueBRL: 0, cashIncludedInGlobal: false, vectors: [], valuedItems: [] };
  }

  const vectorMap = new Map<
    string,
    { label: string; type: ConsolidatedRiskVector["type"]; valueBRL: number }
  >();

  for (const item of positiveItems) {
    const asset = item.asset;
    const val = item.valueBRL;
    const normCls = normalizeClass(asset.asset_class);

    // 1. Renda Fixa privada agrupada por emissor
    if (normCls === "Renda Fixa") {
      const issuer = parseIssuerFromTicker(asset.ticker, asset.notes);
      if (!issuer.isSovereign && issuer.issuerKey !== "tesouro_nacional") {
        const vKey = `rf_issuer_${issuer.issuerKey}`;
        const existing = vectorMap.get(vKey) ?? {
          label: issuer.issuerLabel,
          type: "rf_issuer",
          valueBRL: 0,
        };
        existing.valueBRL += val;
        vectorMap.set(vKey, existing);
        continue;
      }
    }

    // 2. ETFs agrupados por benchmark subjacente compartilhado
    if (normCls === "ETFs" || normCls === "Internacional" || normCls === "BDRs") {
      const benchmark = inferEtfBenchmark(asset);
      if (benchmark) {
        const vKey = `etf_benchmark_${benchmark}`;
        const BENCHMARK_LABELS: Record<string, string> = {
          sp500: "ETF S&P 500",
          nasdaq100: "ETF Nasdaq 100",
          all_world: "ETF Global Amplo (All-World)",
          ibovespa: "ETF Ibovespa",
          ibrx100: "ETF IBrX-100",
          smal_cap_br: "ETF Small Caps",
          ifix: "ETF IFIX",
          tesouro_selic: "ETF Tesouro Selic",
          tesouro_ipca: "ETF Tesouro IPCA",
          bitcoin: "ETF Bitcoin",
          ethereum: "ETF Ethereum",
        };
        const existing = vectorMap.get(vKey) ?? {
          label: BENCHMARK_LABELS[benchmark] ?? `ETF ${benchmark}`,
          type: "etf_benchmark",
          valueBRL: 0,
        };
        existing.valueBRL += val;
        vectorMap.set(vKey, existing);
        continue;
      }
    }

    // 3. Ativos individuais
    const vKey = `asset_${asset.id || asset.ticker}`;
    vectorMap.set(vKey, {
      label: asset.ticker,
      type: "asset",
      valueBRL: (vectorMap.get(vKey)?.valueBRL ?? 0) + val,
    });
  }

  if (valuation.cashIncludedInGlobal && valuation.cashBRL > 0) {
    vectorMap.set("cash_global", {
      label: "Caixa",
      type: "cash",
      valueBRL: valuation.cashBRL,
    });
  }

  const totalValueBRL = valuation.patrimonyTotalBRL;
  if (totalValueBRL <= 0) {
    return {
      totalValueBRL: 0,
      cashIncludedInGlobal: valuation.cashIncludedInGlobal,
      vectors: [],
      valuedItems: positiveItems,
    };
  }

  const vectors: ConsolidatedRiskVector[] = Array.from(vectorMap.entries())
    .map(([key, item]) => ({
      key,
      label: item.label,
      type: item.type,
      valueBRL: item.valueBRL,
      weightPct: (item.valueBRL / totalValueBRL) * 100,
    }))
    .sort((a, b) => b.valueBRL - a.valueBRL);

  return {
    totalValueBRL,
    cashIncludedInGlobal: valuation.cashIncludedInGlobal,
    vectors,
    valuedItems: positiveItems,
  };
}

/**
 * Calcula o Índice Herfindahl-Hirschman (HHI) global da carteira.
 * HHI = Soma(w_k^2), onde w_k = valor_vetor / total_geral.
 * Retorna valor entre 0 e 1, ou null se patrimônio <= 0.
 */
export function calculatePortfolioHHI(
  assets: readonly PortfolioAsset[],
  options?: DiversificationCalculationOptions
): number | null {
  const { totalValueBRL, vectors } = buildConsolidatedRiskVectors(assets, options);
  if (totalValueBRL <= 0 || vectors.length === 0) return null;

  let sumSquaredWeights = 0;
  for (const v of vectors) {
    const w = v.valueBRL / totalValueBRL;
    sumSquaredWeights += w * w;
  }

  // Limita estritamente entre 0 e 1 e arredonda para 6 casas decimais
  return Math.min(1, Math.max(0, Math.round(sumSquaredWeights * 1_000_000) / 1_000_000));
}

/**
 * Calcula o Número Efetivo de Ativos (N_ef) a partir do HHI.
 * N_ef = 1 / HHI.
 * Retorna null se HHI for nulo ou <= 0.
 */
export function calculateEffectiveNumberAssets(hhi: number | null): number | null {
  if (hhi === null || hhi <= 0) return null;
  const nef = 1 / hhi;
  return Math.round(nef * 100) / 100;
}

/**
 * Consolida todas as métricas de descentralização:
 * - HHI e Nef global (com agrupamento de risco de emissores privados e benchmarks de ETFs)
 * - HHI e Nef por classe de ativos (subportfólios isolados para evitar máscara de risco)
 * - Lista de vetores de risco consolidados ordenados
 *
 * Resiliente a divisões por zero e valores zerados.
 */
export function calculatePortfolioDiversification(
  assets: readonly PortfolioAsset[],
  options?: DiversificationCalculationOptions
): PortfolioDiversificationSummary {
  const { totalValueBRL, cashIncludedInGlobal, vectors, valuedItems } =
    buildConsolidatedRiskVectors(assets, options);

  const globalHHI = totalValueBRL > 0 && vectors.length > 0 ? calculatePortfolioHHI(assets, options) : null;
  const globalNef = calculateEffectiveNumberAssets(globalHHI);

  // Agrupamento por classe (subportfólios isolados, sem caixa externo)
  const classMap = new Map<string, ValuedPortfolioAsset[]>();
  for (const item of valuedItems) {
    const normCls = normalizeClass(item.asset.asset_class);
    const list = classMap.get(normCls) ?? [];
    list.push(item);
    classMap.set(normCls, list);
  }

  const byClass: Record<string, ClassDiversificationSummary> = {};
  for (const [cls, classItems] of classMap.entries()) {
    const classTotalVal = classItems.reduce((sum, item) => sum + item.valueBRL, 0);
    if (classTotalVal <= 0) continue;

    let classSumSquared = 0;
    for (const item of classItems) {
      const w = item.valueBRL / classTotalVal;
      classSumSquared += w * w;
    }

    const classHHI = Math.min(1, Math.max(0, Math.round(classSumSquared * 1_000_000) / 1_000_000));
    const classNef = calculateEffectiveNumberAssets(classHHI);

    byClass[cls] = {
      className: cls,
      classValueBRL: classTotalVal,
      classHHI,
      classNef,
      assetCount: classItems.length,
    };
  }

  return {
    totalValueBRL,
    cashIncludedInGlobal,
    globalHHI,
    globalNef,
    byClass,
    consolidatedVectors: vectors,
  };
}
