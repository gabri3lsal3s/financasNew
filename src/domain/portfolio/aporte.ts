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

import type { AssetCurrency } from "@/types";
import { normalizeClassName } from "./valuation";
import { inferSectorFromTicker } from "./tickers-catalog";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type AporteMode = "asset" | "class" | "both";

export type SkippedReason =
  | "no_price"
  | "no_target"
  | "above_target"
  | "price_exceeds_budget";

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
  assetClass: string | null;
  sector?: string | null;
  currency: AssetCurrency;
  /** Valor atual em BRL (já convertido). */
  currentValueBRL: number;
  /** Preço unitário em BRL (já convertido) — 0 = sem preço (não comprável). */
  priceBRL: number;
  /** Meta individual (% do patrimônio) — null = sem meta. */
  targetPercentage: number | null;
  /** Indica se aceita compra fracionária (override manual). */
  isFractional?: boolean;
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
  /** Valor alvo em BRL (meta aplicada ao patrimônio pós-aporte). */
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
}

export interface AporteResult {
  mode: AporteMode;
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

  // 2. Internacional / USD -> 4 casas
  if (
    asset.currency === "USD" ||
    normalizedClass.includes("internacional") ||
    normalizedClass.includes("global") ||
    normalizedClass.includes("stock") ||
    normalizedClass.includes("reit")
  ) {
    return 4;
  }

  // 3. Mercado Nacional B3 -> Cotas inteiras (0 casas)
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
  aporte: number;
  assets: readonly AporteAssetInput[];
  classTargets: readonly ClassTargetInput[];
  sectorTargets?: readonly SectorTargetInput[];
}): AporteResult {
  const aporte = round2(nonNegative(opts.aporte));
  const skippedAssets: SkippedAssetDiagnostic[] = [];

  if (!(aporte > 0)) {
    return {
      mode: opts.mode,
      aporte,
      totalAllocated: 0,
      leftover: aporte,
      routes: [],
      classSummaries: [],
      sectorSummaries: [],
      skippedAssets: [],
    };
  }

  const totalAtual = round2(opts.assets.reduce((acc, a) => acc + nonNegative(a.currentValueBRL), 0));
  const patrimonioAlvo = round2(totalAtual + aporte);
  if (!(patrimonioAlvo > 0)) {
    return {
      mode: opts.mode,
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

  for (const asset of opts.assets) {
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
    classTargetMap.set(normalizeClassName(ct.className), nonNegative(ct.targetPercentage));
  }

  const sectorTargetMap = new Map<string, Map<string, number>>();
  for (const st of opts.sectorTargets ?? []) {
    const normClass = normalizeClassName(st.className);
    let sMap = sectorTargetMap.get(normClass);
    if (!sMap) {
      sMap = new Map<string, number>();
      sectorTargetMap.set(normClass, sMap);
    }
    sMap.set(st.sectorName.trim(), nonNegative(st.targetPercentage));
  }

  // -------------------------------------------------------------------------
  // 1. Meta efetiva por ativo (Hierarquia 3 Níveis: Classe -> Setor -> Ativo)
  // -------------------------------------------------------------------------
  const effectiveAssetMap = new Map<string, InternalEffectiveAssetTarget>();

  if (opts.mode === "asset") {
    // Modo individual: cada ativo usa sua meta direta
    for (const asset of opts.assets) {
      if (asset.targetPercentage !== null && asset.targetPercentage !== undefined) {
        const targetPct = nonNegative(asset.targetPercentage);
        const targetValueBRL = round2((targetPct / 100) * patrimonioAlvo);
        const gapBRL = targetPct > 0 ? round2(Math.max(0, targetValueBRL - nonNegative(asset.currentValueBRL))) : 0;
        effectiveAssetMap.set(asset.id, { targetPct, targetValueBRL, gapBRL });
      }
    }
  } else {
    // Se mode === "both", metas individuais são consideradas prioritariamente (incluindo 0%)
    if (opts.mode === "both") {
      for (const asset of opts.assets) {
        if (asset.targetPercentage !== null && asset.targetPercentage !== undefined) {
          const targetPct = nonNegative(asset.targetPercentage);
          const targetValueBRL = round2((targetPct / 100) * patrimonioAlvo);
          const gapBRL = targetPct > 0 ? round2(Math.max(0, targetValueBRL - nonNegative(asset.currentValueBRL))) : 0;
          effectiveAssetMap.set(asset.id, { targetPct, targetValueBRL, gapBRL });
        }
      }
    }

    for (const [className, sectorMap] of assetsByClassAndSector) {
      const normClass = normalizeClassName(className);
      const classTargetPct = classTargetMap.get(normClass) ?? 0;
      if (!(classTargetPct > 0)) continue;

      const sectorsWithTarget = sectorTargetMap.get(normClass);
      const hasConfiguredSectorTargets = sectorsWithTarget && sectorsWithTarget.size > 0;

      if (hasConfiguredSectorTargets) {
        // Alocação em 3 níveis: distribui a meta da classe para os setores cadastrados
        for (const [sectorName, members] of sectorMap) {
          const sectorTargetInClass = sectorsWithTarget?.get(sectorName);

          // Se o setor foi explicitamente configurado com 0%, zera os membros sem meta individual
          if (sectorTargetInClass === 0) {
            for (const member of members) {
              if (!effectiveAssetMap.has(member.id)) {
                effectiveAssetMap.set(member.id, { targetPct: 0, targetValueBRL: 0, gapBRL: 0 });
              }
            }
            continue;
          }

          if (!sectorTargetInClass || !(sectorTargetInClass > 0)) continue;

          const sectorEffectiveTargetPct = round2((classTargetPct * sectorTargetInClass) / 100);
          if (!(sectorEffectiveTargetPct > 0)) continue;

          const unassignedMembers = members.filter((m) => !effectiveAssetMap.has(m.id));
          if (unassignedMembers.length === 0) continue;

          const assignedInSector = members
            .filter((m) => effectiveAssetMap.has(m.id))
            .reduce((acc, m) => acc + (effectiveAssetMap.get(m.id)?.targetPct ?? 0), 0);

          const remainingSectorPct = Math.max(0, sectorEffectiveTargetPct - assignedInSector);
          if (remainingSectorPct > 0) {
            const sharePerMember = remainingSectorPct / unassignedMembers.length;
            for (const member of unassignedMembers) {
              const targetPct = round2(sharePerMember);
              const targetValueBRL = round2((targetPct / 100) * patrimonioAlvo);
              const gapBRL = round2(Math.max(0, targetValueBRL - nonNegative(member.currentValueBRL)));
              if (targetPct > 0) {
                effectiveAssetMap.set(member.id, { targetPct, targetValueBRL, gapBRL });
              }
            }
          }
        }
      }

      // Fallback para membros da classe que ficaram sem meta (equiponderação do restante da classe)
      const allClassMembers = assetsByClass.get(className) ?? [];
      const remainingUnassigned = allClassMembers.filter((m) => !effectiveAssetMap.has(m.id));
      if (remainingUnassigned.length > 0) {
        const assignedClassPct = allClassMembers
          .filter((m) => effectiveAssetMap.has(m.id))
          .reduce((acc, m) => acc + (effectiveAssetMap.get(m.id)?.targetPct ?? 0), 0);

        const remainingClassPct = Math.max(0, classTargetPct - assignedClassPct);
        if (remainingClassPct > 0) {
          const sharePerMember = remainingClassPct / remainingUnassigned.length;
          for (const member of remainingUnassigned) {
            const targetPct = round2(sharePerMember);
            const targetValueBRL = round2((targetPct / 100) * patrimonioAlvo);
            const gapBRL = round2(Math.max(0, targetValueBRL - nonNegative(member.currentValueBRL)));
            if (targetPct > 0) {
              effectiveAssetMap.set(member.id, { targetPct, targetValueBRL, gapBRL });
            }
          }
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // 2. Diagnóstico prévio de inelegibilidade dos ativos
  // -------------------------------------------------------------------------
  for (const asset of opts.assets) {
    const eff = effectiveAssetMap.get(asset.id);
    const sector = asset.sector?.trim() || inferSectorFromTicker(asset.ticker, asset.assetClass);
    if (!eff || eff.targetPct <= 0) {
      skippedAssets.push({
        assetId: asset.id,
        ticker: asset.ticker,
        assetClass: asset.assetClass,
        sector,
        reason: "no_target",
        detail: "Sem meta percentual definida.",
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

  for (const [className, sectorMap] of assetsByClassAndSector) {
    const normClass = normalizeClassName(className);
    let classTargetValueBRL = 0;
    let classTargetPct = classTargetMap.get(normClass) ?? 0;
    let classCurrentValueBRL = 0;
    let sumMemberGapsBRL = 0;

    const sectorMacroList: InternalSectorMacro[] = [];
    const sectorsWithTarget = sectorTargetMap.get(normClass);

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

      const targetPctInClass = sectorsWithTarget?.get(sectorName) ?? 0;
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
      gapBRL = Math.min(sumMemberGapsBRL, classLevelGap);
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

    // Pass 1: Proporcional ponderado por déficit restante
    for (const m of eligible) {
      const eff = effectiveAssetMap.get(m.id)!;
      const currentAlloc = allocatedMap.get(m.id)?.allocatedBRL ?? 0;
      const remainingGap = Math.max(0, eff.gapBRL - currentAlloc);
      if (!(remainingGap > 0)) continue;

      const share = Math.min(remainingGap, (remainingGap / sumGaps) * budget);
      const precision = resolveAssetPrecision(m);

      let qty: number;
      let alloc: number;

      if (precision > 0) {
        const multiplier = Math.pow(10, precision);
        qty = Math.floor((share / m.priceBRL) * multiplier) / multiplier;
        alloc = round2(qty * m.priceBRL);
      } else {
        qty = Math.floor(share / m.priceBRL);
        alloc = round2(qty * m.priceBRL);
      }

      if (alloc > remainingGap) {
        alloc = remainingGap;
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
        remainingBudget = round2(remainingBudget - alloc);
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

        if (addAlloc > 0 && addQty > 0) {
          const existing = allocatedMap.get(m.id) ?? { quantity: 0, allocatedBRL: 0 };
          const newQty = precision > 0 ? Math.round((existing.quantity + addQty) * Math.pow(10, precision)) / Math.pow(10, precision) : existing.quantity + addQty;
          allocatedMap.set(m.id, {
            quantity: newQty,
            allocatedBRL: round2(existing.allocatedBRL + addAlloc),
          });
          remainingBudget = round2(remainingBudget - addAlloc);
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
    const hasSectorTargets = (sectorTargetMap.get(normClass)?.size ?? 0) > 0;

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
        classRemainingBudget = round2(classRemainingBudget - allocated);

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
            classRemainingBudget = round2(classRemainingBudget - allocated);

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

    globalRemainingPool = round2(globalRemainingPool - actualClassAllocated);

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
        globalRemainingPool = round2(globalRemainingPool - allocated);

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
    const hasSectorTargets = (sectorTargetMap.get(normClass)?.size ?? 0) > 0;

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
  for (const asset of opts.assets) {
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

  const totalAllocated = round2(routes.reduce((acc, r) => acc + r.allocatedBRL, 0));
  const leftover = round2(aporte - totalAllocated);

  return {
    mode: opts.mode,
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
}): AporteResult {
  return simulateAporte({
    mode: "asset",
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
}): AporteResult {
  return simulateAporte({
    mode: "class",
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
}): AporteResult {
  return simulateAporte({
    mode: "both",
    aporte: opts.aporte,
    assets: opts.assets,
    classTargets: opts.classTargets,
    sectorTargets: opts.sectorTargets,
  });
}
