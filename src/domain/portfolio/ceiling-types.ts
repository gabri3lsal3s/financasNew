/**
 * Contratos de tipos para Preço Teto, Valuation e Mesa de Consenso Multimodelo.
 * Especificação Técnica: docs/architecture/ESPECIFICACAO_PRECO_TETO_VALUATION.md
 */

export type AssetCeilingMethod =
  | "manual"
  | "bazin"
  | "graham"
  | "gordon"
  | "multiple"
  | "pvp"
  | "hybrid_fii"
  | "conservative"
  | "average";

export type ConsensusRule = "conservative" | "average" | "specific";

export interface BazinModelData {
  /** Proventos médios anuais por ação (moeda nativa) */
  dpa: number;
  /** Yield mínimo exigido em decimal (ex: 0.06 para 6%) */
  targetYield: number;
  /** Preço teto resultante calculado */
  price: number;
}

export interface GrahamModelData {
  /** Lucro por Ação (últimos 12 meses) */
  lpa: number;
  /** Valor Patrimonial por Ação (últimos 12 meses) */
  vpa: number;
  /** Margem de segurança em decimal (ex: 0.20 para 20%) */
  marginOfSafety: number;
  /** Valor intrínseco de Graham sem margem */
  intrinsicValue: number;
  /** Preço teto com margem aplicada */
  price: number;
}

export interface GordonModelData {
  /** Proventos correntes anuais por ação */
  dpa: number;
  /** Taxa de crescimento anual projetada dos proventos em decimal (ex: 0.02 para 2%) */
  growthRate: number;
  /** Taxa de retorno exigida em decimal (ex: 0.09 para 9%) */
  requiredRate: number;
  /** Preço teto resultante calculado */
  price: number;
}

export interface MultipleModelData {
  metricType: "pe" | "pvp";
  /** Valor contábil do múltiplo (LPA se pe, VPA se pvp) */
  metricValue: number;
  /** Múltiplo máximo aceito (ex: 10 para P/L de 10x) */
  targetMultiple: number;
  /** Preço teto resultante */
  price: number;
}

export interface FiiBazinModelData {
  /** Rendimento mensal médio por cota */
  monthlyDividend: number;
  /** Yield anual alvo em decimal (ex: 0.085 para 8.5%) */
  targetYield: number;
  /** Preço teto resultante */
  price: number;
}

export interface FiiPvpModelData {
  /** Valor patrimonial da cota do fundo (laudo) */
  vpa: number;
  /** Múltiplo P/VP máximo aceito (ex: 1.00 ou 1.02) */
  maxPvp: number;
  /** Preço teto resultante */
  price: number;
}

export interface FiiHybridModelData {
  monthlyDividend: number;
  targetYield: number;
  vpa: number;
  maxPvp: number;
  yieldPrice: number;
  pvpPrice: number;
  /** Preço teto menor entre o teto de yield e o teto de P/VP */
  price: number;
}

export interface ManualModelData {
  price: number;
  notes?: string;
}

export interface AssetCeilingMetadata {
  selectionRule?: ConsensusRule;
  selectedMethod?: AssetCeilingMethod;
  calculatedAt?: string;
  models?: {
    bazin?: BazinModelData;
    graham?: GrahamModelData;
    gordon?: GordonModelData;
    multiple?: MultipleModelData;
    fii_bazin?: FiiBazinModelData;
    fii_pvp?: FiiPvpModelData;
    fii_hybrid?: FiiHybridModelData;
    manual?: ManualModelData;
  };
}

export type ValuationZone = "opportunity" | "fair" | "stretched";

export interface ValuationStatusResult {
  zone: ValuationZone;
  /** Margem de segurança percentual: (Teto - Preço) / Teto * 100 */
  marginOfSafetyPct: number | null;
  /** Diferencial frente ao teto: (Preço - Teto) / Teto * 100 */
  diffVsCeilingPct: number | null;
  label: string;
  badgeVariant: "positive" | "muted" | "negative";
}
