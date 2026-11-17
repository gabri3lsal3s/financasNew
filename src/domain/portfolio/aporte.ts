/**
 * Calculadora de aporte — ESPECIFICAÇÃO §3.11.3 & Arquitetura Hierárquica Classe -> Setor -> Ativo.
 *
 * Princípio Arquitetural:
 *   1. Estabilização Macro por Classe: o aporte é prioritariamente orçado
 *      entre as classes com maior déficit relativo (alvo − atual) ÷ alvo;
 *   2. Orçamentação Meso por Setor: dentro de cada classe, a verba é
 *      prioritariamente distribuída entre os setores com maior defasagem interna;
 *   3. Alocação Micro por Ativo: a verba do setor é distribuída entre os ativos
 *      membros (respeitando metas individuais ou equiponderação 1/N);
 *   4. Suporte Fracionário Diferenciado:
 *      • Ativos em Dólar (USD / Internacional): frações de até 4 casas decimais;
 *      • Criptoativos: frações de alta precisão (até 8 casas decimais);
 *      • Ativos B3 (Ações / FIIs / ETFs nacionais): cotas inteiras (>= 1);
 *      • Renda Fixa / Caixa: aporte financeiro direto (2 casas).
 *   5. Transbordamento de Resíduos: sobras internas do setor atendem o próximo setor,
 *      e sobras da classe retornam ao pool para atender a próxima classe;
 *   6. Rastreabilidade & Diagnóstico: ativos não elegíveis são catalogados com
 *      o motivo exato (sem preço, sem meta, acima da meta, etc).
 *
 * Consistência (DoD): a soma dos aportes NUNCA excede o aporte informado;
 * ativo sem meta não recebe aporte; aporte só para ativos abaixo da meta.
 *
 * Motor puro — sem import de UI/Supabase; valores em reais (2 casas).
 */

import type { AssetAllocationStatus, AssetCurrency } from "@/types";
import { isCashAssetClass, isFixedIncomeClass, isTesouroAsset, normalizeClassName } from "./valuation";
import { inferSectorFromTicker } from "./tickers-catalog";
import { calculateEffectiveAssetTargets } from "./allocation";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type AporteMode = "asset" | "class" | "both";

/**
 * Estratégia de alocação de aporte:
 * - "optimized": (Menos Movimentações) Concentra o aporte nos ativos mais deficitários para evitar micro-compras.
 * - "proportional": Rateia proporcionalmente a verba entre todos os ativos abaixo da meta.
 */
export type AporteStrategy = "optimized" | "proportional";

export type SkippedReason =
  | "no_price"
  | "no_target"
  | "above_target"
  | "price_exceeds_budget"
  | "insufficient_aporte"
  | "quarantine"
  | "neutral"
  | "exit";

export interface SkippedAssetDiagnostic {
  assetId: string;
  ticker: string;
  assetClass: string | null;
  sector?: string | null;
  reason: SkippedReason;
  detail?: string;
}

export interface ClassAporteSummary {
  className: string;
  targetPct: number;
  targetValueBRL: number;
  currentValueBRL: number;
  gapBRL: number;
  budgetAllocatedBRL: number;
  actualAllocatedBRL: number;
}

export interface SectorAporteSummary {
  className: string;
  sectorName: string;
  targetPctInClass: number;
  effectiveTargetPct: number;
  targetValueBRL: number;
  currentValueBRL: number;
  gapBRL: number;
  budgetAllocatedBRL: number;
  actualAllocatedBRL: number;
}

export interface AporteAssetInput {
  id: string;
  ticker: string;
  name?: string | null;
  assetClass: string | null;
  sector?: string | null;
  currency: AssetCurrency;
  /** Valor atual em BRL (já convertido). */
  currentValueBRL: number;
  /** Preço unitário em BRL (já convertido) — 0 = sem preço (não comprável). */
  priceBRL: number;
  /** Custo médio unitário (BRL) para cálculo de desconto frente ao PM. */
  averageCost?: number;
  /** Meta individual (% do patrimônio) — usada apenas no modo unitário legado ("asset"). */
  targetPercentage?: number | null;
  /** Nota de governança fundamentalista (0 a 10). */
  score?: number | null;
  /** Status de alocação operacional (active, neutral, quarantine, exit). */
  allocation_status?: AssetAllocationStatus;
  /** Indica se aceita compra fracionária (override manual). */
  isFractional?: boolean;
}

export type RebalanceMode = "sector_oriented" | "asset_prescriptive";

export interface SectorOpportunityItem {
  assetId: string;
  ticker: string;
  name?: string | null;
  assetClass: string;
  sector: string;
  currentPrice: number;
  averageCost: number;
  /** Variação % frente ao PM (ex: -8.5% = descontado). */
  diffVsAveragePct: number;
  currentWeightPct: number;
  currentValueBRL: number;
  bazinTargetPrice?: number | null;
  marginOfSafetyPct?: number | null;
  /** Cotas sugeridas caso este ativo absorva o orçamento do setor. */
  suggestedQty: number;
  suggestedTotalBRL: number;
}

export interface SectorAporteGroup {
  className: string;
  sectorName: string;
  targetPctInClass: number;
  effectiveTargetPct: number;
  targetValueBRL: number;
  currentValueBRL: number;
  gapBRL: number;
  deficitRel: number;
  budgetAllocatedBRL: number;
  assets: SectorOpportunityItem[];
}

export interface UnifiedAporteOptions {
  mode?: RebalanceMode;
  aporteAmount?: number;
  cashAvailableBRL?: number;
  assets: readonly AporteAssetInput[];
  classTargets: readonly ClassTargetInput[];
  sectorTargets?: readonly SectorTargetInput[];
  strategy?: AporteStrategy;
  totalPortfolioBRL?: number;
}

export interface UnifiedAporteResult {
  mode: RebalanceMode;
  totalAllocatedBRL: number;
  leftoverBRL: number;
  classSummaries: ClassAporteSummary[];
  sectorGroups: SectorAporteGroup[];
  prescriptiveRoutes: AporteRoute[];
  skippedAssets: SkippedAssetDiagnostic[];
}

export interface ClassTargetInput {
  className: string;
  /** % do patrimônio (0–100). */
  targetPercentage: number;
}

export interface SectorTargetInput {
  className: string;
  sectorName: string;
  /** % relativo dentro da classe (0–100). */
  targetPercentage: number;
}

/** Linha do log de roteamento (§3.11.3.8). */
export interface AporteRoute {
  assetId: string;
  ticker: string;
  assetClass: string | null;
  sector: string | null;
  /** Valor alvo em BRL (meta aplicada ao patrimônio investível pós-aporte). */
  targetValueBRL: number;
  /** Valor atual em BRL. */
  currentValueBRL: number;
  /** Gap financeiro (alvo − atual), nunca negativo. */
  gapBRL: number;
  /** Aporte sugerido em BRL (quantidade × preço). */
  allocatedBRL: number;
  /** Quantidade sugerida (inteira ou decimal para cripto/USD). */
  quantity: number;
  /** Preço unitário usado (BRL). */
  priceBRL: number;
  /** Metadados de governança usados na derivação da meta (§Plano 42). */
  rawScore?: number | null;
  effectiveScore?: number;
  effectiveTargetPct?: number;
  classTargetPct?: number;
  sectorTargetPctInClass?: number | null;
  weightInSector?: number;
}

export interface AporteResult {
  mode: AporteMode;
  strategy: AporteStrategy;
  /** Aporte informado (BRL). */
  aporte: number;
  /** Total alocado aos ativos (≤ aporte). */
  totalAllocated: number;
  /** Sobra para caixa/reserva (aporte − totalAlocado). */
  leftover: number;
  /** Log de roteamento — ativos com aporte sugerido (ordem de prioridade). */
  routes: AporteRoute[];
  /** Sumário macro da distribuição por classe. */
  classSummaries: ClassAporteSummary[];
  /** Sumário intermediário da distribuição por setor. */
  sectorSummaries: SectorAporteSummary[];
  /** Diagnóstico de ativos que não receberam aporte. */
  skippedAssets: SkippedAssetDiagnostic[];
}

// ---------------------------------------------------------------------------
// Utilidades & Precisão Fracionária
// ---------------------------------------------------------------------------

/** Arredonda para 2 casas (moeda BRL). */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

const nonNegative = (value: number): number => (Number.isFinite(value) ? Math.max(0, value) : 0);

const CRYPTO_CLASS_ALIASES = new Set([
  "cripto",
  "criptos",
  "criptomoeda",
  "criptomoedas",
  "crypto",
  "cryptos",
  "cryptocurrency",
]);

/**
 * Determina o número de casas decimais para cálculo da quantidade:
 * - Cripto: 8 casas decimais;
 * - Dólar (USD / Internacional): 4 casas decimais;
 * - B3 / BRL convencional: 0 casas decimais (cotas inteiras).
 */
export function resolveAssetPrecision(asset: Pick<AporteAssetInput, "assetClass" | "ticker" | "currency" | "isFractional">): number {
  if (asset.isFractional !== undefined) {
    if (!asset.isFractional) return 0;
    const normalizedClass = normalizeClassName(asset.assetClass ?? "");
    return CRYPTO_CLASS_ALIASES.has(normalizedClass) ? 8 : 4;
  }

  const normalizedClass = normalizeClassName(asset.assetClass ?? "");
  const upperTicker = asset.ticker.trim().toUpperCase();

  // 1. Criptoativos -> 8 casas
  if (
    CRYPTO_CLASS_ALIASES.has(normalizedClass) ||
    upperTicker === "BTC" ||
    upperTicker === "ETH" ||
    upperTicker === "SOL" ||
    upperTicker === "USDT" ||
    upperTicker === "USDC"
  ) {
    return 8;
  }

  // 2. Tesouro Direto -> Frações de 0,01 título (2 casas decimais - INV-10)
  if (isTesouroAsset(asset.ticker, asset.assetClass)) {
    return 2;
  }

  // 3. Renda Fixa Privada (CDB, LCI, LCA) e Caixa -> Alocação em valor financeiro direto (2 casas decimais - INV-10)
  if (isFixedIncomeClass(asset.assetClass)) {
    return 2;
  }

  // 4. Mercado Nacional B3 (ações, FIIs, ETFs B3, BDRs em BRL) -> Estritamente cotas inteiras (0 casas)
  if (asset.currency === "BRL") {
    return 0;
  }

  // 3. Internacional / Moeda Estrangeira (USD) -> 4 casas
  if (
    asset.currency === "USD" ||
    normalizedClass.includes("internacional") ||
    normalizedClass.includes("global") ||
    normalizedClass.includes("exterior") ||
    normalizedClass.includes("stock") ||
    normalizedClass.includes("reit")
  ) {
    return 4;
  }

  // 4. Mercado Nacional B3 -> Cotas inteiras (0 casas)
  return 0;
}

/** Verifica se um ativo aceita cotas fracionárias (ex: Cripto ou Internacional USD). */
export function isFractionalAsset(
  assetClass: string | null,
  ticker: string,
  explicitFractional?: boolean,
  currency?: AssetCurrency,
): boolean {
  return resolveAssetPrecision({ assetClass, ticker, currency: currency ?? "BRL", isFractional: explicitFractional }) > 0;
}

// ---------------------------------------------------------------------------
// Motor de simulação Hierárquico (Classe -> Setor -> Ativo)
// ---------------------------------------------------------------------------

interface InternalEffectiveAssetTarget {
  targetPct: number;
  targetValueBRL: number;
  gapBRL: number;
  rawScore: number | null;
  effectiveScore: number;
  classTargetPct: number;
  sectorTargetPctInClass: number | null;
  weightInSector: number;
}

interface InternalSectorMacro {
  className: string;
  sectorName: string;
  targetPctInClass: number;
  effectiveTargetPct: number;
  targetValueBRL: number;
  currentValueBRL: number;
  gapBRL: number;
  deficitRel: number;
}

interface InternalClassMacro {
  className: string;
  targetPct: number;
  targetValueBRL: number;
  currentValueBRL: number;
  gapBRL: number;
  deficitRel: number;
}

export function simulateAporte(opts: {
  mode: AporteMode;
  strategy?: AporteStrategy;
  aporte: number;
  assets: readonly AporteAssetInput[];
  classTargets: readonly ClassTargetInput[];
  sectorTargets?: readonly SectorTargetInput[];
  totalPortfolioBRL?: number;
}): AporteResult {
  const strategy: AporteStrategy = opts.strategy ?? "proportional";
  const aporte = round2(nonNegative(opts.aporte));
  const skippedAssets: SkippedAssetDiagnostic[] = [];

  if (!(aporte > 0)) {
    return {
      mode: opts.mode,
      strategy,
      aporte,
      totalAllocated: 0,
      leftover: aporte,
      routes: [],
      classSummaries: [],
      sectorSummaries: [],
      skippedAssets: [],
    };
  }

  const investableAssets =
    opts.mode === "asset"
      ? [...opts.assets]
      : opts.assets.filter(
          (a) => !isCashAssetClass(a.assetClass) && a.ticker.trim().toUpperCase() !== "CAIXA",
        );

  const totalAtual = round2(investableAssets.reduce((acc, a) => acc + nonNegative(a.currentValueBRL), 0));
  const basePatrimonio = opts.totalPortfolioBRL && opts.totalPortfolioBRL > 0 ? opts.totalPortfolioBRL : totalAtual;
  const patrimonioAlvo = round2(basePatrimonio + aporte);
  if (!(patrimonioAlvo > 0)) {
    return {
      mode: opts.mode,
      strategy,
      aporte,
      totalAllocated: 0,
      leftover: aporte,
      routes: [],
      classSummaries: [],
      sectorSummaries: [],
      skippedAssets: [],
    };
  }

  // Agrupamento de ativos por Classe e por Setor
  const assetsByClass = new Map<string, AporteAssetInput[]>();
  const assetsByClassAndSector = new Map<string, Map<string, AporteAssetInput[]>>();

  for (const asset of investableAssets) {
    const classKey = asset.assetClass?.trim() || "Outros";
    const sectorKey = asset.sector?.trim() || inferSectorFromTicker(asset.ticker, classKey);

    const classList = assetsByClass.get(classKey) ?? [];
    classList.push(asset);
    assetsByClass.set(classKey, classList);

    let sectorMap = assetsByClassAndSector.get(classKey);
    if (!sectorMap) {
      sectorMap = new Map<string, AporteAssetInput[]>();
      assetsByClassAndSector.set(classKey, sectorMap);
    }
    const sectorList = sectorMap.get(sectorKey) ?? [];
    sectorList.push(asset);
    sectorMap.set(sectorKey, sectorList);
  }

  const classTargetMap = new Map<string, number>();
  for (const ct of opts.classTargets) {
    const norm = normalizeClassName(ct.className);
    if (norm && norm !== "caixa") {
      classTargetMap.set(norm, nonNegative(ct.targetPercentage));
    }
  }

  const sectorTargetMap = new Map<string, Map<string, number>>();
  for (const st of opts.sectorTargets ?? []) {
    const normClass = normalizeClassName(st.className);
    let sMap = sectorTargetMap.get(normClass);
    if (!sMap) {
      sMap = new Map<string, number>();
      sectorTargetMap.set(normClass, sMap);
    }
    sMap.set(st.sectorName.trim().toLowerCase(), nonNegative(st.targetPercentage));
  }

  // -------------------------------------------------------------------------
  // 1. Meta efetiva por ativo (Fonte única: calculateEffectiveAssetTargets)
  // -------------------------------------------------------------------------
  const effectiveAssetMap = new Map<string, InternalEffectiveAssetTarget>();

  if (opts.mode === "asset") {
    // Modo unitário puro (compatibilidade com testes legados por ativo)
    for (const asset of investableAssets) {
      if (
        asset.allocation_status === "quarantine" ||
        asset.allocation_status === "exit" ||
        asset.allocation_status === "neutral"
      ) {
        effectiveAssetMap.set(asset.id, {
          targetPct: 0,
          targetValueBRL: 0,
          gapBRL: 0,
          rawScore: asset.score ?? null,
          effectiveScore: 0,
          classTargetPct: 0,
          sectorTargetPctInClass: null,
          weightInSector: 0,
        });
      } else if (asset.targetPercentage !== null && asset.targetPercentage !== undefined) {
        const targetPct = nonNegative(asset.targetPercentage);
        const targetValueBRL = round2((targetPct / 100) * patrimonioAlvo);
        const gapBRL = targetPct > 0 ? round2(Math.max(0, targetValueBRL - nonNegative(asset.currentValueBRL))) : 0;
        effectiveAssetMap.set(asset.id, {
          targetPct,
          targetValueBRL,
          gapBRL,
          rawScore: asset.score ?? null,
          effectiveScore: asset.score ?? 5,
          classTargetPct: targetPct,
          sectorTargetPctInClass: null,
          weightInSector: 1,
        });
      }
    }
  } else {
    const investableById = new Map(investableAssets.map((a) => [a.id, a]));
    const derivedTargets = calculateEffectiveAssetTargets({
      assets: investableAssets.map((a) => {
        const cls = a.assetClass?.trim() || "Outros";
        return {
          id: a.id,
          ticker: a.ticker,
          assetClass: cls,
          sector: a.sector?.trim() || inferSectorFromTicker(a.ticker, cls),
          score: a.score ?? null,
          allocation_status: a.allocation_status ?? "active",
        };
      }),
      classTargets: opts.classTargets,
      sectorTargets: opts.sectorTargets ?? [],
    });

    for (const eff of derivedTargets) {
      const asset = investableById.get(eff.assetId);
      if (!asset) continue;
      const targetValueBRL = round2((eff.effectiveTargetPct / 100) * patrimonioAlvo);
      const gapBRL =
        eff.effectiveTargetPct > 0 && eff.isEligible
          ? round2(Math.max(0, targetValueBRL - nonNegative(asset.currentValueBRL)))
          : 0;

      effectiveAssetMap.set(eff.assetId, {
        targetPct: eff.effectiveTargetPct,
        targetValueBRL,
        gapBRL,
        rawScore: eff.rawScore,
        effectiveScore: eff.effectiveScore,
        classTargetPct: eff.classTargetPct,
        sectorTargetPctInClass: eff.sectorTargetPctInClass,
        weightInSector: eff.weightInSector,
      });
    }
  }

  // -------------------------------------------------------------------------
  // 2. Diagnóstico prévio de inelegibilidade dos ativos
  // -------------------------------------------------------------------------
  for (const asset of investableAssets) {
    const eff = effectiveAssetMap.get(asset.id);
    const sector = asset.sector?.trim() || inferSectorFromTicker(asset.ticker, asset.assetClass);
    if (asset.allocation_status === "quarantine") {
      skippedAssets.push({
        assetId: asset.id,
        ticker: asset.ticker,
        assetClass: asset.assetClass,
        sector,
        reason: "quarantine",
        detail: "Ativo em quarentena de fundamentos. Novos aportes congelados.",
      });
    } else if (asset.allocation_status === "exit") {
      skippedAssets.push({
        assetId: asset.id,
        ticker: asset.ticker,
        assetClass: asset.assetClass,
        sector,
        reason: "exit",
        detail: "Ativo com tese encerrada (Desinvestimento). Aportes bloqueados.",
      });
    } else if (asset.allocation_status === "neutral") {
      skippedAssets.push({
        assetId: asset.id,
        ticker: asset.ticker,
        assetClass: asset.assetClass,
        sector,
        reason: "neutral",
        detail: "Ativo em status Neutro (mantido em carteira sem novos aportes).",
      });
    } else if (!eff || eff.targetPct <= 0) {
      skippedAssets.push({
        assetId: asset.id,
        ticker: asset.ticker,
        assetClass: asset.assetClass,
        sector,
        reason: "no_target",
        detail: "Sem meta percentual definida ou nota zerada.",
      });
    } else if (asset.priceBRL <= 0) {
      skippedAssets.push({
        assetId: asset.id,
        ticker: asset.ticker,
        assetClass: asset.assetClass,
        sector,
        reason: "no_price",
        detail: "Cotação não disponível (R$ 0,00).",
      });
    } else if (eff.gapBRL <= 0) {
      skippedAssets.push({
        assetId: asset.id,
        ticker: asset.ticker,
        assetClass: asset.assetClass,
        sector,
        reason: "above_target",
        detail: "Posição já atingiu ou superou o percentual-alvo.",
      });
    }
  }

  // -------------------------------------------------------------------------
  // 3. NÍVEL 1 & 2: Estatísticas Macro por Classe e Meso por Setor
  // -------------------------------------------------------------------------
  const classMacros: InternalClassMacro[] = [];
  const sectorMacrosByClass = new Map<string, InternalSectorMacro[]>();

  // União das classes com ativos + classes com meta configurada (Blindagem B3)
  const allClasses = new Set<string>();
  for (const className of assetsByClassAndSector.keys()) {
    allClasses.add(className);
  }
  for (const ct of opts.classTargets) {
    if (ct.targetPercentage > 0) {
      allClasses.add(ct.className);
    }
  }

  for (const className of allClasses) {
    const sectorMap = assetsByClassAndSector.get(className);
    const normClass = normalizeClassName(className);
    let classTargetValueBRL = 0;
    let classTargetPct = classTargetMap.get(normClass) ?? 0;
    let classCurrentValueBRL = 0;
    let sumMemberGapsBRL = 0;

    const sectorMacroList: InternalSectorMacro[] = [];
    const sectorsWithTarget = sectorTargetMap.get(normClass);

    if (sectorMap && sectorMap.size > 0) {
      for (const [sectorName, members] of sectorMap) {
        let sectorTargetValBRL = 0;
        let sectorCurrentValBRL = 0;
        let sectorMemberGapsBRL = 0;

        for (const member of members) {
          sectorCurrentValBRL += nonNegative(member.currentValueBRL);
          const eff = effectiveAssetMap.get(member.id);
          if (eff) {
            sectorTargetValBRL += eff.targetValueBRL;
            if (member.priceBRL > 0) {
              sectorMemberGapsBRL += eff.gapBRL;
            }
          }
        }

        sectorCurrentValBRL = round2(sectorCurrentValBRL);
        sectorMemberGapsBRL = round2(sectorMemberGapsBRL);
        sectorTargetValBRL = round2(sectorTargetValBRL);

        const targetPctInClass = sectorsWithTarget?.get(sectorName.trim().toLowerCase()) ?? 0;
        const effectiveTargetPct = round2((sectorTargetValBRL / patrimonioAlvo) * 100);

        const sectorDeficitRel =
          sectorTargetValBRL > 0
            ? Math.max(0, (sectorTargetValBRL - sectorCurrentValBRL) / sectorTargetValBRL)
            : (sectorCurrentValBRL === 0 && sectorMemberGapsBRL > 0 ? 1 : 0);

        sectorMacroList.push({
          className,
          sectorName,
          targetPctInClass,
          effectiveTargetPct,
          targetValueBRL: sectorTargetValBRL,
          currentValueBRL: sectorCurrentValBRL,
          gapBRL: sectorMemberGapsBRL,
          deficitRel: sectorDeficitRel,
        });

        classCurrentValueBRL += sectorCurrentValBRL;
        classTargetValueBRL += sectorTargetValBRL;
        sumMemberGapsBRL += sectorMemberGapsBRL;
      }
    }

    if (opts.mode === "class" || (opts.mode === "both" && classTargetPct > 0)) {
      classTargetValueBRL = round2((classTargetPct / 100) * patrimonioAlvo);
    } else if (opts.mode === "asset" || !(classTargetPct > 0)) {
      classTargetPct = round2((classTargetValueBRL / patrimonioAlvo) * 100);
    }

    classCurrentValueBRL = round2(classCurrentValueBRL);
    sumMemberGapsBRL = round2(sumMemberGapsBRL);

    let gapBRL: number;
    if (opts.mode === "class" || (opts.mode === "both" && classTargetPct > 0)) {
      const classLevelGap = round2(Math.max(0, classTargetValueBRL - classCurrentValueBRL));
      // Se não há membros na classe, gapBRL = classLevelGap para registrar necessidade (Blindagem B3)
      gapBRL = !sectorMap || sectorMap.size === 0 ? classLevelGap : Math.min(sumMemberGapsBRL, classLevelGap);
    } else {
      gapBRL = sumMemberGapsBRL;
    }

    const deficitRel =
      classTargetValueBRL > 0
        ? Math.max(0, (classTargetValueBRL - classCurrentValueBRL) / classTargetValueBRL)
        : (classCurrentValueBRL === 0 && gapBRL > 0 ? 1 : 0);

    classMacros.push({
      className,
      targetPct: classTargetPct,
      targetValueBRL: classTargetValueBRL,
      currentValueBRL: classCurrentValueBRL,
      gapBRL,
      deficitRel,
    });

    sectorMacrosByClass.set(className, sectorMacroList);
  }

  // Ordena classes por maior defasagem macro
  const sortedClasses = [...classMacros]
    .filter((c) => c.gapBRL > 0)
    .sort((a, b) => {
      if (b.deficitRel !== a.deficitRel) return b.deficitRel - a.deficitRel;
      return b.gapBRL - a.gapBRL;
    });

  // -------------------------------------------------------------------------
  // 4. NÍVEL 3: Execução da Distribuição Proporcional (Classe -> Setor -> Ativos)
  // -------------------------------------------------------------------------
  const classSummaries: ClassAporteSummary[] = [];
  const sectorSummaries: SectorAporteSummary[] = [];
  const allocatedMap = new Map<string, { quantity: number; allocatedBRL: number }>();

  // Helper interno de alocação ponderada a uma lista de ativos
  const allocateBudgetToMembers = (
    members: readonly AporteAssetInput[],
    budget: number,
  ): number => {
    if (!(budget > 0) || members.length === 0) {
      return 0;
    }

    const eligible = members.filter((m) => {
      const eff = effectiveAssetMap.get(m.id);
      if (!eff || !(eff.gapBRL > 0) || !(eff.targetPct > 0) || !(m.priceBRL > 0)) return false;
      const currentAlloc = allocatedMap.get(m.id)?.allocatedBRL ?? 0;
      return eff.gapBRL - currentAlloc > 0;
    });

    if (eligible.length === 0) {
      return 0;
    }

    const sumGaps = eligible.reduce((acc, m) => {
      const eff = effectiveAssetMap.get(m.id)!;
      const currentAlloc = allocatedMap.get(m.id)?.allocatedBRL ?? 0;
      return acc + Math.max(0, eff.gapBRL - currentAlloc);
    }, 0);

    if (!(sumGaps > 0)) {
      return 0;
    }

    let remainingBudget = budget;

    if (strategy === "optimized") {
      // Modo Otimizado (Menos Movimentações):
      // Concentra os recursos no ativo com maior defasagem restante
      const sortedByDeficit = [...eligible].sort((a, b) => {
        const effA = effectiveAssetMap.get(a.id)!;
        const allocA = allocatedMap.get(a.id)?.allocatedBRL ?? 0;
        const remA = Math.max(0, effA.gapBRL - allocA);

        const effB = effectiveAssetMap.get(b.id)!;
        const allocB = allocatedMap.get(b.id)?.allocatedBRL ?? 0;
        const remB = Math.max(0, effB.gapBRL - allocB);

        return remB - remA;
      });

      for (const m of sortedByDeficit) {
        if (!(remainingBudget > 0)) break;
        const eff = effectiveAssetMap.get(m.id)!;
        const currentAlloc = allocatedMap.get(m.id)?.allocatedBRL ?? 0;
        const remainingGap = Math.max(0, eff.gapBRL - currentAlloc);
        if (!(remainingGap > 0)) continue;

        const canAfford = Math.min(remainingGap, remainingBudget);
        const precision = resolveAssetPrecision(m);

        let qty: number;
        let alloc: number;

        if (precision > 0) {
          const multiplier = Math.pow(10, precision);
          qty = Math.floor((canAfford / m.priceBRL) * multiplier) / multiplier;
          alloc = round2(qty * m.priceBRL);
        } else {
          qty = Math.floor(canAfford / m.priceBRL);
          alloc = round2(qty * m.priceBRL);
        }

        if (alloc > remainingBudget) {
          alloc = remainingBudget;
          qty = precision > 0 ? Math.floor((alloc / m.priceBRL) * Math.pow(10, precision)) / Math.pow(10, precision) : Math.floor(alloc / m.priceBRL);
          alloc = round2(qty * m.priceBRL);
        }

        if (alloc > 0 && qty > 0) {
          const existing = allocatedMap.get(m.id) ?? { quantity: 0, allocatedBRL: 0 };
          const newQty = precision > 0 ? Math.round((existing.quantity + qty) * Math.pow(10, precision)) / Math.pow(10, precision) : existing.quantity + qty;
          allocatedMap.set(m.id, {
            quantity: newQty,
            allocatedBRL: round2(existing.allocatedBRL + alloc),
          });
          remainingBudget = Math.max(0, round2(remainingBudget - alloc));
        }
      }
    } else {
      // Pass 1: Proporcional ponderado por déficit restante
      for (const m of eligible) {
        if (!(remainingBudget > 0)) break;
        const eff = effectiveAssetMap.get(m.id)!;
        const currentAlloc = allocatedMap.get(m.id)?.allocatedBRL ?? 0;
        const remainingGap = Math.max(0, eff.gapBRL - currentAlloc);
        if (!(remainingGap > 0)) continue;

        const share = Math.min(remainingGap, remainingBudget, (remainingGap / sumGaps) * budget);
        const precision = resolveAssetPrecision(m);
        const multiplier = Math.pow(10, precision);

        let qty: number;
        let alloc: number;

        if (precision > 0) {
          qty = Math.floor((share / m.priceBRL) * multiplier) / multiplier;
          alloc = round2(qty * m.priceBRL);
        } else {
          qty = Math.floor(share / m.priceBRL);
          alloc = round2(qty * m.priceBRL);
        }

        const cap = Math.min(remainingGap, remainingBudget);
        if (alloc > cap) {
          qty =
            precision > 0
              ? Math.floor((cap / m.priceBRL) * multiplier) / multiplier
              : Math.floor(cap / m.priceBRL);
          alloc = round2(qty * m.priceBRL);
          if (alloc > cap && qty > 0) {
            const step = precision > 0 ? 1 / multiplier : 1;
            qty = Math.max(0, precision > 0 ? Math.round((qty - step) * multiplier) / multiplier : qty - 1);
            alloc = round2(qty * m.priceBRL);
          }
        }

        if (alloc > 0 && qty > 0 && alloc <= remainingBudget) {
          const existing = allocatedMap.get(m.id) ?? { quantity: 0, allocatedBRL: 0 };
          const newQty = precision > 0 ? Math.round((existing.quantity + qty) * multiplier) / multiplier : existing.quantity + qty;
          allocatedMap.set(m.id, {
            quantity: newQty,
            allocatedBRL: round2(existing.allocatedBRL + alloc),
          });
          remainingBudget = Math.max(0, round2(remainingBudget - alloc));
        }
      }

      // Pass 2: Sweep de resíduos dentro dos membros elegíveis
      if (remainingBudget > 0) {
        const sortedForResiduals = [...eligible].sort((a, b) => {
          const remA = Math.max(0, (effectiveAssetMap.get(a.id)?.gapBRL ?? 0) - (allocatedMap.get(a.id)?.allocatedBRL ?? 0));
          const remB = Math.max(0, (effectiveAssetMap.get(b.id)?.gapBRL ?? 0) - (allocatedMap.get(b.id)?.allocatedBRL ?? 0));
          return remB - remA;
        });

        for (const m of sortedForResiduals) {
          if (!(remainingBudget > 0)) break;
          const eff = effectiveAssetMap.get(m.id)!;
          const currentAlloc = allocatedMap.get(m.id)?.allocatedBRL ?? 0;
          const remainingGap = Math.max(0, eff.gapBRL - currentAlloc);
          if (!(remainingGap > 0)) continue;

          const precision = resolveAssetPrecision(m);
          const canAfford = Math.min(remainingGap, remainingBudget);

          let addQty: number;
          let addAlloc: number;

          if (precision > 0) {
            const multiplier = Math.pow(10, precision);
            addQty = Math.floor((canAfford / m.priceBRL) * multiplier) / multiplier;
            addAlloc = round2(addQty * m.priceBRL);
          } else {
            addQty = Math.floor(canAfford / m.priceBRL);
            addAlloc = round2(addQty * m.priceBRL);
          }

          if (addAlloc > remainingBudget) {
            addAlloc = remainingBudget;
            if (precision > 0) {
              const multiplier = Math.pow(10, precision);
              addQty = Math.floor((addAlloc / m.priceBRL) * multiplier) / multiplier;
              addAlloc = round2(addQty * m.priceBRL);
            } else {
              addQty = Math.floor(addAlloc / m.priceBRL);
              addAlloc = round2(addQty * m.priceBRL);
            }
          }

          if (addAlloc > 0 && addQty > 0) {
            const existing = allocatedMap.get(m.id) ?? { quantity: 0, allocatedBRL: 0 };
            const newQty = precision > 0 ? Math.round((existing.quantity + addQty) * Math.pow(10, precision)) / Math.pow(10, precision) : existing.quantity + addQty;
            allocatedMap.set(m.id, {
              quantity: newQty,
              allocatedBRL: round2(existing.allocatedBRL + addAlloc),
            });
            remainingBudget = Math.max(0, round2(remainingBudget - addAlloc));
          }
        }
      }
    }

    return round2(budget - remainingBudget);
  };

  // Cálculo proporcional de orçamento por classe
  const totalClassesGap = sortedClasses.reduce((acc, c) => acc + c.gapBRL, 0);
  let globalRemainingPool = aporte;

  for (const classMacro of sortedClasses) {
    if (!(globalRemainingPool > 0)) break;

    // Orçamento proporcional da classe
    const classTargetBudget =
      totalClassesGap > 0
        ? Math.min(classMacro.gapBRL, round2((classMacro.gapBRL / totalClassesGap) * aporte))
        : Math.min(classMacro.gapBRL, globalRemainingPool);

    const classBudget = Math.min(classTargetBudget, globalRemainingPool);
    let classRemainingBudget = classBudget;
    let actualClassAllocated = 0;

    const sectorMacros = (sectorMacrosByClass.get(classMacro.className) ?? [])
      .filter((s) => s.gapBRL > 0)
      .sort((a, b) => {
        if (b.deficitRel !== a.deficitRel) return b.deficitRel - a.deficitRel;
        return b.gapBRL - a.gapBRL;
      });

    const normClass = normalizeClassName(classMacro.className);
    const hasSectorTargets = Array.from(sectorTargetMap.get(normClass)?.values() ?? []).some((v) => v > 0);

    if (hasSectorTargets && sectorMacros.length > 0) {
      const totalSectorsGap = sectorMacros.reduce((acc, s) => acc + s.gapBRL, 0);

      // Pass 1 nos setores da classe: distribuição proporcional
      for (const sectorMacro of sectorMacros) {
        if (!(classRemainingBudget > 0)) break;

        const sectorTargetBudget =
          totalSectorsGap > 0
            ? Math.min(sectorMacro.gapBRL, round2((sectorMacro.gapBRL / totalSectorsGap) * classBudget))
            : Math.min(sectorMacro.gapBRL, classRemainingBudget);

        const sectorBudget = Math.min(sectorTargetBudget, classRemainingBudget);
        const sectorMembers = assetsByClassAndSector.get(classMacro.className)?.get(sectorMacro.sectorName) ?? [];

        const allocated = allocateBudgetToMembers(sectorMembers, sectorBudget);

        actualClassAllocated = round2(actualClassAllocated + allocated);
        classRemainingBudget = Math.max(0, round2(classRemainingBudget - allocated));

        sectorSummaries.push({
          className: classMacro.className,
          sectorName: sectorMacro.sectorName,
          targetPctInClass: sectorMacro.targetPctInClass,
          effectiveTargetPct: sectorMacro.effectiveTargetPct,
          targetValueBRL: sectorMacro.targetValueBRL,
          currentValueBRL: sectorMacro.currentValueBRL,
          gapBRL: sectorMacro.gapBRL,
          budgetAllocatedBRL: sectorBudget,
          actualAllocatedBRL: allocated,
        });
      }

      // Pass 2 nos setores: se sobrou orçamento da classe, oferta aos setores que ainda possuem gap
      if (classRemainingBudget > 0) {
        for (const sectorMacro of sectorMacros) {
          if (!(classRemainingBudget > 0)) break;
          const sectorMembers = assetsByClassAndSector.get(classMacro.className)?.get(sectorMacro.sectorName) ?? [];
          const allocated = allocateBudgetToMembers(sectorMembers, classRemainingBudget);

          if (allocated > 0) {
            actualClassAllocated = round2(actualClassAllocated + allocated);
            classRemainingBudget = Math.max(0, round2(classRemainingBudget - allocated));

            const sSummary = sectorSummaries.find((s) => s.className === classMacro.className && s.sectorName === sectorMacro.sectorName);
            if (sSummary) {
              sSummary.actualAllocatedBRL = round2(sSummary.actualAllocatedBRL + allocated);
            }
          }
        }
      }
    } else {
      // Sem metas setoriais: distribui diretamente e proporcionalmente nos membros da classe
      const classMembers = assetsByClass.get(classMacro.className) ?? [];
      const allocated = allocateBudgetToMembers(classMembers, classBudget);

      actualClassAllocated = round2(actualClassAllocated + allocated);
    }

    globalRemainingPool = Math.max(0, round2(globalRemainingPool - actualClassAllocated));

    classSummaries.push({
      className: classMacro.className,
      targetPct: classMacro.targetPct,
      targetValueBRL: classMacro.targetValueBRL,
      currentValueBRL: classMacro.currentValueBRL,
      gapBRL: classMacro.gapBRL,
      budgetAllocatedBRL: classBudget,
      actualAllocatedBRL: actualClassAllocated,
    });
  }

  // Pass 2 Global: se sobrou pool após todas as classes (por arredondamentos B3), oferta às classes com gap
  if (globalRemainingPool > 0) {
    for (const classMacro of sortedClasses) {
      if (!(globalRemainingPool > 0)) break;
      const classMembers = assetsByClass.get(classMacro.className) ?? [];
      const allocated = allocateBudgetToMembers(classMembers, globalRemainingPool);

      if (allocated > 0) {
        globalRemainingPool = Math.max(0, round2(globalRemainingPool - allocated));

        const cSummary = classSummaries.find((cs) => cs.className === classMacro.className);
        if (cSummary) {
          cSummary.actualAllocatedBRL = round2(cSummary.actualAllocatedBRL + allocated);
        }
      }
    }
  }

  // Consolidação final das rotas ordenadas por prioridade macro de classe e déficit
  const routes: AporteRoute[] = [];

  for (const classMacro of sortedClasses) {
    const sectorMacros = (sectorMacrosByClass.get(classMacro.className) ?? [])
      .sort((a, b) => {
        if (b.deficitRel !== a.deficitRel) return b.deficitRel - a.deficitRel;
        return b.gapBRL - a.gapBRL;
      });

    const normClass = normalizeClassName(classMacro.className);
    const hasSectorTargets = Array.from(sectorTargetMap.get(normClass)?.values() ?? []).some((v) => v > 0);

    if (hasSectorTargets && sectorMacros.length > 0) {
      for (const sectorMacro of sectorMacros) {
        const sectorMembers = (assetsByClassAndSector.get(classMacro.className)?.get(sectorMacro.sectorName) ?? [])
          .sort((a, b) => {
            const gapA = effectiveAssetMap.get(a.id)?.gapBRL ?? 0;
            const gapB = effectiveAssetMap.get(b.id)?.gapBRL ?? 0;
            return gapB - gapA;
          });

        for (const asset of sectorMembers) {
          const res = allocatedMap.get(asset.id);
          if (!res || !(res.allocatedBRL > 0) || !(res.quantity > 0)) continue;

          const eff = effectiveAssetMap.get(asset.id)!;
          const sector = asset.sector?.trim() || sectorMacro.sectorName || inferSectorFromTicker(asset.ticker, asset.assetClass);

          routes.push({
            assetId: asset.id,
            ticker: asset.ticker,
            assetClass: asset.assetClass,
            sector,
            targetValueBRL: eff.targetValueBRL,
            currentValueBRL: round2(nonNegative(asset.currentValueBRL)),
            gapBRL: eff.gapBRL,
            allocatedBRL: res.allocatedBRL,
            quantity: res.quantity,
            priceBRL: round2(nonNegative(asset.priceBRL)),
            rawScore: eff.rawScore,
            effectiveScore: eff.effectiveScore,
            effectiveTargetPct: eff.targetPct,
            classTargetPct: eff.classTargetPct,
            sectorTargetPctInClass: eff.sectorTargetPctInClass,
            weightInSector: eff.weightInSector,
          });
        }
      }
    } else {
      const classMembers = (assetsByClass.get(classMacro.className) ?? [])
        .sort((a, b) => {
          const gapA = effectiveAssetMap.get(a.id)?.gapBRL ?? 0;
          const gapB = effectiveAssetMap.get(b.id)?.gapBRL ?? 0;
          return gapB - gapA;
        });

      for (const asset of classMembers) {
        const res = allocatedMap.get(asset.id);
        if (!res || !(res.allocatedBRL > 0) || !(res.quantity > 0)) continue;

        const eff = effectiveAssetMap.get(asset.id)!;
        const sector = asset.sector?.trim() || inferSectorFromTicker(asset.ticker, asset.assetClass);

        routes.push({
          assetId: asset.id,
          ticker: asset.ticker,
          assetClass: asset.assetClass,
          sector,
          targetValueBRL: eff.targetValueBRL,
          currentValueBRL: round2(nonNegative(asset.currentValueBRL)),
          gapBRL: eff.gapBRL,
          allocatedBRL: res.allocatedBRL,
          quantity: res.quantity,
          priceBRL: round2(nonNegative(asset.priceBRL)),
          rawScore: eff.rawScore,
          effectiveScore: eff.effectiveScore,
          effectiveTargetPct: eff.targetPct,
          classTargetPct: eff.classTargetPct,
          sectorTargetPctInClass: eff.sectorTargetPctInClass,
          weightInSector: eff.weightInSector,
        });
      }
    }
  }

  // Preenche sumário de classes sem aporte para completude dos gráficos
  for (const macro of classMacros) {
    if (!classSummaries.some((cs) => cs.className === macro.className)) {
      classSummaries.push({
        className: macro.className,
        targetPct: macro.targetPct,
        targetValueBRL: macro.targetValueBRL,
        currentValueBRL: macro.currentValueBRL,
        gapBRL: macro.gapBRL,
        budgetAllocatedBRL: 0,
        actualAllocatedBRL: 0,
      });
    }
  }

  // Adiciona ativos que tinham gap individual mas não receberam aporte (ex: classe sobre-alocada ou saldo insuficiente)
  for (const asset of investableAssets) {
    const isAllocated = (allocatedMap.get(asset.id)?.allocatedBRL ?? 0) > 0;
    const isAlreadySkipped = skippedAssets.some((s) => s.assetId === asset.id);
    if (!isAllocated && !isAlreadySkipped) {
      const sector = asset.sector?.trim() || inferSectorFromTicker(asset.ticker, asset.assetClass);
      const classMacro = classMacros.find((c) => c.className === (asset.assetClass?.trim() || "Outros"));
      const isClassAboveTarget = classMacro && classMacro.targetPct > 0 && classMacro.currentValueBRL >= classMacro.targetValueBRL;

      if (isClassAboveTarget) {
        skippedAssets.push({
          assetId: asset.id,
          ticker: asset.ticker,
          assetClass: asset.assetClass,
          sector,
          reason: "above_target",
          detail: `Classe ${asset.assetClass || "Sem classe"} já atingiu ou superou a meta de alocação.`,
        });
      } else {
        skippedAssets.push({
          assetId: asset.id,
          ticker: asset.ticker,
          assetClass: asset.assetClass,
          sector,
          reason: "price_exceeds_budget",
          detail: "Saldo restante insuficiente para a cota mínima.",
        });
      }
    }
  }

  // Sincroniza os totais reais alocados em classSummaries e sectorSummaries com as rotas finais
  for (const cs of classSummaries) {
    const classRoutes = routes.filter((r) => r.assetClass === cs.className);
    cs.actualAllocatedBRL = round2(classRoutes.reduce((acc, r) => acc + r.allocatedBRL, 0));
  }

  for (const ss of sectorSummaries) {
    const sectorRoutes = routes.filter((r) => r.assetClass === ss.className && r.sector === ss.sectorName);
    ss.actualAllocatedBRL = round2(sectorRoutes.reduce((acc, r) => acc + r.allocatedBRL, 0));
  }

  const totalAllocated = Math.min(aporte, round2(routes.reduce((acc, r) => acc + r.allocatedBRL, 0)));
  const leftover = Math.max(0, round2(aporte - totalAllocated));

  return {
    mode: opts.mode,
    strategy,
    aporte,
    totalAllocated,
    leftover,
    routes,
    classSummaries,
    sectorSummaries,
    skippedAssets,
  };
}

/** Modo por meta individual de ativo (§3.11.3). */
export function simulateSmartAporte(opts: {
  aporte: number;
  assets: readonly AporteAssetInput[];
  strategy?: AporteStrategy;
}): AporteResult {
  return simulateAporte({
    mode: "asset",
    strategy: opts.strategy,
    aporte: opts.aporte,
    assets: opts.assets,
    classTargets: [],
  });
}

/** Modo por meta de classe (§3.11.3) — ignora metas individuais. */
export function simulateRebalanceAporte(opts: {
  aporte: number;
  assets: readonly AporteAssetInput[];
  classTargets: readonly ClassTargetInput[];
  sectorTargets?: readonly SectorTargetInput[];
  strategy?: AporteStrategy;
}): AporteResult {
  return simulateAporte({
    mode: "class",
    strategy: opts.strategy,
    aporte: opts.aporte,
    assets: opts.assets,
    classTargets: opts.classTargets,
    sectorTargets: opts.sectorTargets,
  });
}

/**
 * Modo combinado (§3.11.3) — hierarquia Classe -> Setor -> Ativo.
 * É o modo padrão recomendado para carteiras mistas.
 */
export function simulateCombinedAporte(opts: {
  aporte: number;
  assets: readonly AporteAssetInput[];
  classTargets: readonly ClassTargetInput[];
  sectorTargets?: readonly SectorTargetInput[];
  strategy?: AporteStrategy;
  totalPortfolioBRL?: number;
}): AporteResult {
  return simulateAporte({
    mode: "both",
    strategy: opts.strategy,
    aporte: opts.aporte,
    assets: opts.assets,
    classTargets: opts.classTargets,
    sectorTargets: opts.sectorTargets,
    totalPortfolioBRL: opts.totalPortfolioBRL,
  });
}

/**
 * Motor Canônico Unificado de Sugestões de Aporte & Cascata Hierárquica — FASE 10.
 *
 * Single Source of Truth para o Painel de Aportes e Wizard de Investimentos:
 *   1. Modo Orientação Setorial: Orça o capital necessário por Classe e Setor defasados
 *      e enriquece os ativos com métricas de oportunidade (% vs Preço Médio, margem de
 *      segurança), permitindo ao investidor direcionar o orçamento do setor no ativo descontado.
 *   2. Modo Prescritivo por Ativo: Calcula cotas diretas e precisas por ticker.
 *   3. Cascata Hierárquica Suave (Graceful Fallback):
 *      • Classes (100% obrigatório) -> Setores (opcional) -> Ativos (opcional).
 *      • Se faltar meta de ativo, orça pelo setor; se faltar setor, orça pela classe.
 *   4. Blindagem B2 (Aporte/Caixa Zero): Quando não há aporte ou caixa, calcula cotas
 *      ideais com base no gap da meta em vez de zerar sugestões.
 *   5. Blindagem B3 (Classes sem ativos): Alerta suave para classes carentes sem travar o motor.
 *   6. Blindagem B5 (Ativos sem preço): Isola em skippedAssets sem bloquear os demais.
 */
export function getAporteSuggestions(opts: UnifiedAporteOptions): UnifiedAporteResult {
  const mode: RebalanceMode = opts.mode ?? "sector_oriented";
  const strategy: AporteStrategy = opts.strategy ?? "optimized";
  const aporteAmount = opts.aporteAmount && opts.aporteAmount > 0 ? round2(opts.aporteAmount) : 0;
  const cashAvailableBRL = opts.cashAvailableBRL && opts.cashAvailableBRL > 0 ? round2(opts.cashAvailableBRL) : 0;

  const investableAssets = opts.assets.filter(
    (a) => !isCashAssetClass(a.assetClass) && a.ticker.trim().toUpperCase() !== "CAIXA",
  );
  const totalAtual = round2(investableAssets.reduce((acc, a) => acc + nonNegative(a.currentValueBRL), 0));
  const portfolioBase = opts.totalPortfolioBRL && opts.totalPortfolioBRL > 0 ? opts.totalPortfolioBRL : totalAtual;

  // Agrupamento por classe e setor
  const assetsByClass = new Map<string, AporteAssetInput[]>();
  const assetsByClassAndSector = new Map<string, Map<string, AporteAssetInput[]>>();

  for (const asset of investableAssets) {
    const cls = asset.assetClass || "Ações";
    const sec = asset.sector?.trim() || inferSectorFromTicker(asset.ticker, cls);

    let classList = assetsByClass.get(cls);
    if (!classList) {
      classList = [];
      assetsByClass.set(cls, classList);
    }
    classList.push(asset);

    let secMap = assetsByClassAndSector.get(cls);
    if (!secMap) {
      secMap = new Map();
      assetsByClassAndSector.set(cls, secMap);
    }
    let secList = secMap.get(sec);
    if (!secList) {
      secList = [];
      secMap.set(sec, secList);
    }
    secList.push(asset);
  }

  // Executa simulação combinada com valor efetivo
  // Se aporteAmount = 0, usa cashAvailableBRL ou uma referência nominal de 5% da carteira (ou R$ 1.000)
  const isZeroAporte = aporteAmount === 0;
  const effectiveSimAporte = !isZeroAporte
    ? aporteAmount
    : cashAvailableBRL > 0
      ? cashAvailableBRL
      : Math.max(100, round2(portfolioBase > 0 ? portfolioBase * 0.05 : 1000));

  const simResult = simulateCombinedAporte({
    aporte: effectiveSimAporte,
    assets: investableAssets,
    classTargets: opts.classTargets,
    sectorTargets: opts.sectorTargets,
    strategy,
    totalPortfolioBRL: portfolioBase,
  });

  const skippedAssets: SkippedAssetDiagnostic[] = [...simResult.skippedAssets];

  // Blindagem B3: Detectar classes com meta definida mas sem ativos cadastrados
  for (const ct of opts.classTargets) {
    if (ct.targetPercentage > 0) {
      const norm = normalizeClassName(ct.className);
      const hasAssets =
        assetsByClass.has(ct.className) ||
        Array.from(assetsByClass.keys()).some((k) => normalizeClassName(k) === norm);

      if (!hasAssets) {
        skippedAssets.push({
          assetId: `unassigned_class_${ct.className}`,
          ticker: ct.className,
          assetClass: ct.className,
          reason: "no_target",
          detail: `Classe com meta de ${ct.targetPercentage}% mas sem ativos cadastrados no momento.`,
        });
      }
    }
  }

  // Construção dos Grupos Setoriais
  const sectorGroups: SectorAporteGroup[] = [];

  // Mapear resumos existentes de simulateCombinedAporte
  const summaryBySectorKey = new Map<string, SectorAporteSummary>();
  for (const s of simResult.sectorSummaries) {
    summaryBySectorKey.set(`${normalizeClassName(s.className)}::${s.sectorName.trim()}`, s);
  }

  for (const [className, sectorMap] of assetsByClassAndSector) {
    const normClass = normalizeClassName(className);
    const classSummary = simResult.classSummaries.find((cs) => normalizeClassName(cs.className) === normClass);
    const classDeficitRel = classSummary && classSummary.targetValueBRL > 0
      ? Math.max(0, (classSummary.targetValueBRL - classSummary.currentValueBRL) / classSummary.targetValueBRL)
      : 0;

    for (const [sectorName, members] of sectorMap) {
      const key = `${normClass}::${sectorName.trim()}`;
      const existingSummary = summaryBySectorKey.get(key);

      const sectorCurrentValBRL = round2(members.reduce((acc, m) => acc + nonNegative(m.currentValueBRL), 0));
      let sectorTargetValBRL = existingSummary?.targetValueBRL ?? 0;
      let sectorGapBRL = existingSummary?.gapBRL ?? 0;
      let budgetAllocatedBRL = !isZeroAporte
        ? (existingSummary?.budgetAllocatedBRL ?? 0)
        : round2(existingSummary?.gapBRL ?? 0);

      // Cascata: se não havia meta setorial configurada e o summary ficou zero, infere da classe
      if (!(sectorTargetValBRL > 0) && classSummary && classSummary.targetValueBRL > 0) {
        const sectorCount = sectorMap.size;
        sectorTargetValBRL = round2(classSummary.targetValueBRL / Math.max(1, sectorCount));
        sectorGapBRL = round2(Math.max(0, sectorTargetValBRL - sectorCurrentValBRL));
        if (isZeroAporte) {
          budgetAllocatedBRL = sectorGapBRL;
        } else if (classSummary.budgetAllocatedBRL > 0) {
          budgetAllocatedBRL = round2(classSummary.budgetAllocatedBRL / Math.max(1, sectorCount));
        }
      }

      // Blindagem B2: se aporteAmount é 0 e cashAvailableBRL é 0, o gap deve refletir a defasagem até a meta do patrimônio base
      if (isZeroAporte && cashAvailableBRL <= 0) {
        const classTargetPct = opts.classTargets.find((ct) => normalizeClassName(ct.className) === normClass)?.targetPercentage ?? 0;
        const sectorCount = Math.max(1, sectorMap.size);
        const effectiveSectorTargetVal = round2(((classTargetPct / 100) * portfolioBase) / sectorCount);
        sectorTargetValBRL = effectiveSectorTargetVal;
        sectorGapBRL = round2(Math.max(0, effectiveSectorTargetVal - sectorCurrentValBRL));
        budgetAllocatedBRL = sectorGapBRL;
      }

      const deficitRel =
        sectorTargetValBRL > 0
          ? Math.max(0, (sectorTargetValBRL - sectorCurrentValBRL) / sectorTargetValBRL)
          : classDeficitRel;

      const opportunityItems: SectorOpportunityItem[] = [];

      for (const member of members) {
        if (
          member.allocation_status === "quarantine" ||
          member.allocation_status === "exit" ||
          member.allocation_status === "neutral"
        ) {
          continue;
        }
        const currentPrice = member.priceBRL;
        const averageCost =
          member.averageCost && member.averageCost > 0
            ? member.averageCost
            : currentPrice > 0
              ? currentPrice
              : 0;

        const diffVsAveragePct =
          averageCost > 0 && currentPrice > 0
            ? Math.round(((currentPrice - averageCost) / averageCost) * 1000) / 10
            : 0;

        const currentWeightPct =
          portfolioBase > 0 ? Math.round((nonNegative(member.currentValueBRL) / portfolioBase) * 1000) / 10 : 0;

        // Cálculo de absorção do orçamento do setor
        let usableBudget = budgetAllocatedBRL > 0 ? budgetAllocatedBRL : sectorGapBRL;
        if (cashAvailableBRL > 0) {
          usableBudget = Math.min(usableBudget, cashAvailableBRL);
        }
        if (usableBudget <= 0 && sectorGapBRL > 0) {
          usableBudget = sectorGapBRL;
        }

        let suggestedQty = 0;
        if (currentPrice > 0 && usableBudget > 0) {
          const precision = resolveAssetPrecision(member);
          if (precision > 0) {
            const factor = 10 ** precision;
            suggestedQty = Math.floor((usableBudget / currentPrice) * factor) / factor;
          } else {
            suggestedQty = Math.max(1, Math.floor(usableBudget / currentPrice));
          }
        }

        const suggestedTotalBRL = round2(suggestedQty * currentPrice);

        opportunityItems.push({
          assetId: member.id,
          ticker: member.ticker,
          name: member.name ?? member.ticker,
          assetClass: className,
          sector: sectorName,
          currentPrice,
          averageCost,
          diffVsAveragePct,
          currentWeightPct,
          currentValueBRL: round2(member.currentValueBRL),
          bazinTargetPrice: null,
          marginOfSafetyPct: null,
          suggestedQty,
          suggestedTotalBRL,
        });
      }

      // Ordenação de ativos dentro do setor:
      // 1. Ativos com desconto frente ao PM (diffVsAveragePct < 0), mais descontados primeiro
      // 2. Demais ativos ordenados pelo menor peso na carteira
      opportunityItems.sort((a, b) => {
        const aDiscount = a.diffVsAveragePct < 0;
        const bDiscount = b.diffVsAveragePct < 0;
        if (aDiscount && bDiscount) {
          return a.diffVsAveragePct - b.diffVsAveragePct; // Mais negativo primeiro
        }
        if (aDiscount) return -1;
        if (bDiscount) return 1;
        return a.currentWeightPct - b.currentWeightPct;
      });

      sectorGroups.push({
        className,
        sectorName,
        targetPctInClass: existingSummary?.targetPctInClass ?? 0,
        effectiveTargetPct: existingSummary?.effectiveTargetPct ?? 0,
        targetValueBRL: sectorTargetValBRL,
        currentValueBRL: sectorCurrentValBRL,
        gapBRL: sectorGapBRL,
        deficitRel,
        budgetAllocatedBRL,
        assets: opportunityItems,
      });
    }
  }

  // Ordena os setores pelo maior déficit relativo
  sectorGroups.sort((a, b) => {
    if (Math.abs(b.deficitRel - a.deficitRel) > 0.001) {
      return b.deficitRel - a.deficitRel;
    }
    return b.gapBRL - a.gapBRL;
  });

  return {
    mode,
    totalAllocatedBRL: !isZeroAporte ? simResult.totalAllocated : 0,
    leftoverBRL: !isZeroAporte ? simResult.leftover : 0,
    classSummaries: simResult.classSummaries,
    sectorGroups,
    prescriptiveRoutes: simResult.routes,
    skippedAssets,
  };
}
