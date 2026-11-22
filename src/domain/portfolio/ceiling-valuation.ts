/**
 * Motor puro de cálculo de Preço Teto, Valuation e Mesa de Consenso Multimodelo.
 * Especificação Técnica: docs/architecture/ESPECIFICACAO_PRECO_TETO_VALUATION.md
 *
 * Invariantes:
 * - Funções puras sem efeitos colaterais e sem dependências de UI/Supabase.
 * - Tratamento defensivo contra divisão por zero, lucros negativos (Graham) e taxas inválidas (Gordon).
 * - Arredondamento monetário financeiro a 2 casas decimais (round2).
 */

import type {
  AssetCeilingMetadata,
  AssetCeilingMethod,
  ConsensusRule,
  ValuationStatusResult,
} from "./ceiling-types";
import { formatCentsAsCurrency } from "@/services/masks";
import { numberToCents } from "@/domain/money";

/** Formata valor monetário com precisão canônica em centavos e suporte a BRL/USD. */
export function formatCeilingCurrency(amount: number, currency: "BRL" | "USD" = "BRL"): string {
  if (!Number.isFinite(amount)) return currency === "USD" ? "$ 0,00" : "R$ 0,00";
  return formatCentsAsCurrency(numberToCents(amount), currency);
}

/** Arredonda número para 2 casas decimais de forma financeira e segura contra imprecisão IEEE-754. */
export function round2(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Método Décio Bazin (Preço Teto por Proventos):
 * P_teto = DPA / Yield_Alvo
 *
 * @param dpa Proventos anuais por ação (líquidos recomendados)
 * @param targetYield Dividend Yield anual mínimo desejado (ex: 0.06 para 6%)
 */
export function calculateBazinCeiling(dpa: number, targetYield: number): number | null {
  if (!Number.isFinite(dpa) || dpa <= 0) return null;
  if (!Number.isFinite(targetYield) || targetYield <= 0) return null;
  return round2(dpa / targetYield);
}

/**
 * Fórmula de Benjamin Graham (Preço Justo por Lucro e Patrimônio):
 * V_Graham = sqrt(22.5 * LPA * VPA)
 * P_teto = V_Graham * (1 - Margem)
 *
 * @param lpa Lucro por Ação dos últimos 12 meses (deve ser > 0)
 * @param vpa Valor Patrimonial por Ação dos últimos 12 meses (deve ser > 0)
 * @param marginOfSafety Margem de segurança em decimal (default 0.20 = 20%)
 */
export function calculateGrahamCeiling(
  lpa: number,
  vpa: number,
  marginOfSafety = 0.2,
): { intrinsicValue: number; price: number } | null {
  if (!Number.isFinite(lpa) || lpa <= 0) return null;
  if (!Number.isFinite(vpa) || vpa <= 0) return null;
  if (!Number.isFinite(marginOfSafety) || marginOfSafety < 0 || marginOfSafety >= 1) return null;

  const product = 22.5 * lpa * vpa;
  if (product <= 0) return null;

  const intrinsicValue = round2(Math.sqrt(product));
  const price = round2(intrinsicValue * (1 - marginOfSafety));
  return { intrinsicValue, price };
}

/**
 * Modelo de Gordon (Dividend Discount Model simplificado com taxa constante de crescimento):
 * P_teto = (DPA * (1 + g)) / (k - g)
 *
 * @param dpa Proventos anuais correntes por ação
 * @param growthRate Taxa de crescimento anual esperada dos proventos (g)
 * @param requiredRate Taxa de retorno anual exigida pelo investidor (k)
 */
export function calculateGordonCeiling(
  dpa: number,
  growthRate: number,
  requiredRate: number,
): number | null {
  if (!Number.isFinite(dpa) || dpa <= 0) return null;
  if (!Number.isFinite(growthRate) || growthRate < 0) return null;
  if (!Number.isFinite(requiredRate) || requiredRate <= 0) return null;
  // Exige que o custo de capital seja estritamente maior que o crescimento (k > g)
  if (requiredRate <= growthRate) return null;

  const nextDpa = dpa * (1 + growthRate);
  const denominator = requiredRate - growthRate;
  return round2(nextDpa / denominator);
}

/**
 * Preço Teto por Múltiplo Alvo (P/L Máximo ou P/VP Máximo):
 * P_teto = Métrica * Múltiplo_Alvo
 *
 * @param metricValue Valor contábil (LPA para P/L ou VPA para P/VP)
 * @param targetMultiple Múltiplo teto aceitável (ex: 10 para P/L 10x, 1.2 para P/VP 1.2x)
 */
export function calculateMultipleCeiling(
  metricValue: number,
  targetMultiple: number,
): number | null {
  if (!Number.isFinite(metricValue) || metricValue <= 0) return null;
  if (!Number.isFinite(targetMultiple) || targetMultiple <= 0) return null;
  return round2(metricValue * targetMultiple);
}

/**
 * Bazin Imobiliário para Fundos Imobiliários (FIIs / REITs):
 * P_teto = (Rendimento_Mensal * 12) / Yield_Alvo
 *
 * @param monthlyDividend Rendimento médio mensal por cota
 * @param targetYield Dividend Yield anual alvo (ex: 0.085 para 8.5%)
 */
export function calculateFiiBazinCeiling(
  monthlyDividend: number,
  targetYield: number,
): number | null {
  if (!Number.isFinite(monthlyDividend) || monthlyDividend <= 0) return null;
  if (!Number.isFinite(targetYield) || targetYield <= 0) return null;
  const annualDividend = monthlyDividend * 12;
  return round2(annualDividend / targetYield);
}

/**
 * Preço Justo de FII por P/VP:
 * P_teto = VPA * MaxPvp
 *
 * @param vpa Valor patrimonial por cota (laudo dos imóveis)
 * @param maxPvp Múltiplo P/VP máximo aceito (default 1.00)
 */
export function calculateFiiPvpCeiling(vpa: number, maxPvp = 1.0): number | null {
  if (!Number.isFinite(vpa) || vpa <= 0) return null;
  if (!Number.isFinite(maxPvp) || maxPvp <= 0) return null;
  return round2(vpa * maxPvp);
}

/**
 * Modelo Híbrido para FIIs:
 * Combina o teto por Yield com uma trava de segurança de P/VP máximo (ex: 1.02),
 * prevenindo comprar fundos com bom yield mas inflados sobre o laudo.
 */
export function calculateFiiHybridCeiling(
  monthlyDividend: number,
  targetYield: number,
  vpa: number,
  maxPvp = 1.02,
): { yieldPrice: number; pvpPrice: number; price: number } | null {
  const yieldPrice = calculateFiiBazinCeiling(monthlyDividend, targetYield);
  const pvpPrice = calculateFiiPvpCeiling(vpa, maxPvp);
  if (yieldPrice === null || pvpPrice === null) return null;

  const price = Math.min(yieldPrice, pvpPrice);
  return { yieldPrice, pvpPrice, price };
}

/**
 * Calcula a Margem de Segurança Dinâmica:
 * Margem (%) = ((Preço_Teto - Preço_Mercado) / Preço_Teto) * 100
 * Diferencial (%) = ((Preço_Mercado - Preço_Teto) / Preço_Teto) * 100
 */
export function calculateMarginOfSafety(
  ceilingPrice: number | null | undefined,
  currentPrice: number | null | undefined,
): { marginOfSafetyPct: number | null; diffVsCeilingPct: number | null } {
  if (
    ceilingPrice == null ||
    !Number.isFinite(ceilingPrice) ||
    ceilingPrice <= 0 ||
    currentPrice == null ||
    !Number.isFinite(currentPrice) ||
    currentPrice <= 0
  ) {
    return { marginOfSafetyPct: null, diffVsCeilingPct: null };
  }

  const marginOfSafetyPct = round2(((ceilingPrice - currentPrice) / ceilingPrice) * 100);
  const diffVsCeilingPct = round2(((currentPrice - ceilingPrice) / ceilingPrice) * 100);
  return { marginOfSafetyPct, diffVsCeilingPct };
}

/**
 * Avalia o status semafórico cognitivo de acordo com a margem de segurança:
 * - Oportunidade: Margem >= 15% (Verde / Positive)
 * - Preço Justo: Margem entre 0% e 15% (Neutro / Muted)
 * - Esticado / Acima do Teto: Margem < 0% (Alerta / Negative)
 */
export function getValuationStatus(
  marginOfSafetyPct: number | null,
  diffVsCeilingPct: number | null,
): ValuationStatusResult {
  if (marginOfSafetyPct === null) {
    return {
      zone: "fair",
      marginOfSafetyPct: null,
      diffVsCeilingPct: null,
      label: "Sem teto definido",
      badgeVariant: "muted",
    };
  }

  if (marginOfSafetyPct >= 15) {
    return {
      zone: "opportunity",
      marginOfSafetyPct,
      diffVsCeilingPct,
      label: `+${marginOfSafetyPct.toFixed(1)}% margem`,
      badgeVariant: "positive",
    };
  }

  if (marginOfSafetyPct >= 0) {
    return {
      zone: "fair",
      marginOfSafetyPct,
      diffVsCeilingPct,
      label: "Preço Justo",
      badgeVariant: "muted",
    };
  }

  const excess = Math.abs(diffVsCeilingPct ?? 0);
  return {
    zone: "stretched",
    marginOfSafetyPct,
    diffVsCeilingPct,
    label: `+${excess.toFixed(1)}% acima do teto`,
    badgeVariant: "negative",
  };
}

/**
 * Resolução da Mesa de Consenso Multimodelo:
 * Consolida múltiplos modelos preenchidos segundo a regra escolhida pelo usuário.
 */
export function resolveConsensusCeiling(
  models: AssetCeilingMetadata["models"] | undefined,
  rule: ConsensusRule = "conservative",
  specificMethod?: AssetCeilingMethod,
): { effectivePrice: number | null; effectiveMethod: AssetCeilingMethod | null } {
  if (!models) return { effectivePrice: null, effectiveMethod: null };

  const validEntries: Array<{ method: AssetCeilingMethod; price: number }> = [];

  if (models.bazin && models.bazin.price > 0) {
    validEntries.push({ method: "bazin", price: models.bazin.price });
  }
  if (models.graham && models.graham.price > 0) {
    validEntries.push({ method: "graham", price: models.graham.price });
  }
  if (models.gordon && models.gordon.price > 0) {
    validEntries.push({ method: "gordon", price: models.gordon.price });
  }
  if (models.multiple && models.multiple.price > 0) {
    validEntries.push({ method: "multiple", price: models.multiple.price });
  }
  if (models.fii_bazin && models.fii_bazin.price > 0) {
    validEntries.push({ method: "bazin", price: models.fii_bazin.price });
  }
  if (models.fii_pvp && models.fii_pvp.price > 0) {
    validEntries.push({ method: "pvp", price: models.fii_pvp.price });
  }
  if (models.fii_hybrid && models.fii_hybrid.price > 0) {
    validEntries.push({ method: "hybrid_fii", price: models.fii_hybrid.price });
  }
  if (models.manual && models.manual.price > 0) {
    validEntries.push({ method: "manual", price: models.manual.price });
  }

  if (validEntries.length === 0) {
    return { effectivePrice: null, effectiveMethod: null };
  }

  if (validEntries.length === 1) {
    return {
      effectivePrice: validEntries[0]!.price,
      effectiveMethod: validEntries[0]!.method,
    };
  }

  if (rule === "specific" && specificMethod) {
    const found = validEntries.find((e) => e.method === specificMethod);
    if (found) {
      return { effectivePrice: found.price, effectiveMethod: specificMethod };
    }
  }

  if (rule === "average") {
    const sum = validEntries.reduce((acc, curr) => acc + curr.price, 0);
    return {
      effectivePrice: round2(sum / validEntries.length),
      effectiveMethod: "average",
    };
  }

  // Default: Regra da Máxima Prudência / Mais Conservador (menor preço teto)
  const sorted = [...validEntries].sort((a, b) => a.price - b.price);
  return {
    effectivePrice: sorted[0]!.price,
    effectiveMethod: "conservative",
  };
}

/**
 * Gera uma tabela de sensibilidade de Preço Teto para diferentes Yields anuais.
 */
export function generateYieldSensitivityTable(
  dpa: number,
  yields = [0.05, 0.06, 0.07, 0.08, 0.09, 0.1],
): Array<{ yieldPct: number; ceilingPrice: number }> {
  if (!Number.isFinite(dpa) || dpa <= 0) return [];
  return yields.map((y) => ({
    yieldPct: round2(y * 100),
    ceilingPrice: round2(dpa / y),
  }));
}
