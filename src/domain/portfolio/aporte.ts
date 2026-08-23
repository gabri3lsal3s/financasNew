/**
 * Calculadora de aporte — ESPECIFICAÇÃO §3.11.3 & Arquitetura Hierárquica Classe -> Ativo.
 *
 * Princípio Arquitetural:
 *   1. Estabilização Macro por Classe: o aporte é prioritariamente orçado
 *      entre as classes com maior déficit relativo (alvo − atual) ÷ alvo;
 *   2. Alocação Micro por Ativo: a verba destinada a cada classe é distribuída
 *      exclusivamente entre os ativos membros dessa classe;
 *   3. Transbordamento de Resíduos: sobras internas da classe (preço unitário >
 *      saldo restante ou arredondamentos) retornam ao pool para atender a
 *      próxima classe deficitária;
 *   4. Suporte Fracionário: criptoativos permitem precisão decimal (até 8 casas);
 *   5. Rastreabilidade & Diagnóstico: ativos não elegíveis são catalogados com
 *      o motivo exato (sem preço, sem meta, acima da meta, etc).
 *
 * Consistência (DoD): a soma dos aportes NUNCA excede o aporte informado;
 * ativo sem meta não recebe aporte; aporte só para ativos abaixo da meta.
 *
 * Motor puro — sem import de UI/Supabase; valores em reais (2 casas).
 */

import type { AssetCurrency } from "@/types";
import { normalizeClassName } from "./valuation";

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

export interface AporteAssetInput {
  id: string;
  ticker: string;
  assetClass: string | null;
  currency: AssetCurrency;
  /** Valor atual em BRL (já convertido). */
  currentValueBRL: number;
  /** Preço unitário em BRL (já convertido) — 0 = sem preço (não comprável). */
  priceBRL: number;
  /** Meta individual (% do patrimônio) — null = sem meta. */
  targetPercentage: number | null;
  /** Indica se aceita compra fracionária (ex: cripto). */
  isFractional?: boolean;
}

export interface ClassTargetInput {
  className: string;
  /** % do patrimônio (0–100). */
  targetPercentage: number;
}

/** Linha do log de roteamento (§3.11.3.8). */
export interface AporteRoute {
  assetId: string;
  ticker: string;
  assetClass: string | null;
  /** Valor alvo em BRL (meta aplicada ao patrimônio pós-aporte). */
  targetValueBRL: number;
  /** Valor atual em BRL. */
  currentValueBRL: number;
  /** Gap financeiro (alvo − atual), nunca negativo. */
  gapBRL: number;
  /** Aporte sugerido em BRL (quantidade × preço). */
  allocatedBRL: number;
  /** Quantidade sugerida (inteira ou decimal para cripto). */
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
  /** Diagnóstico de ativos que não receberam aporte. */
  skippedAssets: SkippedAssetDiagnostic[];
}

// ---------------------------------------------------------------------------
// Utilidades
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

/** Verifica se um ativo aceita cotas fracionárias (ex: Cripto). */
export function isFractionalAsset(assetClass: string | null, ticker: string, explicitFractional?: boolean): boolean {
  if (explicitFractional !== undefined) return explicitFractional;
  if (!assetClass && !ticker) return false;
  const normalizedClass = normalizeClassName(assetClass ?? "");
  if (CRYPTO_CLASS_ALIASES.has(normalizedClass)) return true;
  const upperTicker = ticker.trim().toUpperCase();
  if (upperTicker.endsWith("USD") || upperTicker.endsWith("BRL") || upperTicker === "BTC" || upperTicker === "ETH") {
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Motor de simulação Hierárquico (Classe -> Ativo)
// ---------------------------------------------------------------------------

interface InternalEffectiveAssetTarget {
  targetPct: number;
  targetValueBRL: number;
  gapBRL: number;
}

interface InternalClassMacro {
  className: string;
  targetPct: number;
  targetValueBRL: number;
  currentValueBRL: number;
  gapBRL: number;
  deficitRel: number;
}

function simulateAporte(opts: {
  mode: AporteMode;
  aporte: number;
  assets: readonly AporteAssetInput[];
  classTargets: readonly ClassTargetInput[];
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
      skippedAssets: [],
    };
  }

  // Agrupamento de ativos por classe
  const assetsByClass = new Map<string, AporteAssetInput[]>();
  for (const asset of opts.assets) {
    const key = asset.assetClass ?? "";
    const list = assetsByClass.get(key) ?? [];
    list.push(asset);
    assetsByClass.set(key, list);
  }

  const classTargetMap = new Map<string, number>();
  for (const ct of opts.classTargets) {
    classTargetMap.set(ct.className, nonNegative(ct.targetPercentage));
  }

  // -------------------------------------------------------------------------
  // 1. Meta efetiva por ativo
  // -------------------------------------------------------------------------
  const effectiveAssetMap = new Map<string, InternalEffectiveAssetTarget>();

  if (opts.mode === "asset") {
    // Modo individual: cada ativo usa sua meta direta
    for (const asset of opts.assets) {
      const targetPct = nonNegative(asset.targetPercentage ?? 0);
      if (targetPct > 0) {
        const targetValueBRL = round2((targetPct / 100) * patrimonioAlvo);
        const gapBRL = round2(Math.max(0, targetValueBRL - nonNegative(asset.currentValueBRL)));
        effectiveAssetMap.set(asset.id, { targetPct, targetValueBRL, gapBRL });
      }
    }
  } else if (opts.mode === "both") {
    // Modo combinado: meta individual prioritária; ativos sem meta individual
    // dividem a meta restante da classe de forma equiponderada (1/N)
    for (const asset of opts.assets) {
      const targetPct = nonNegative(asset.targetPercentage ?? 0);
      if (targetPct > 0) {
        const targetValueBRL = round2((targetPct / 100) * patrimonioAlvo);
        const gapBRL = round2(Math.max(0, targetValueBRL - nonNegative(asset.currentValueBRL)));
        effectiveAssetMap.set(asset.id, { targetPct, targetValueBRL, gapBRL });
      }
    }

    for (const [className, members] of assetsByClass) {
      const classTargetPct = classTargetMap.get(className) ?? 0;
      if (!(classTargetPct > 0)) continue;

      const membersWithoutIndividual = members.filter((a) => !effectiveAssetMap.has(a.id));
      if (membersWithoutIndividual.length === 0) continue;

      const individualPctInClass = members
        .filter((a) => effectiveAssetMap.has(a.id))
        .reduce((acc, a) => acc + nonNegative(a.targetPercentage ?? 0), 0);

      const remainingClassPct = Math.max(0, classTargetPct - individualPctInClass);
      if (!(remainingClassPct > 0)) continue;

      const sharePerMember = remainingClassPct / membersWithoutIndividual.length;
      for (const member of membersWithoutIndividual) {
        const targetPct = round2(sharePerMember);
        const targetValueBRL = round2((targetPct / 100) * patrimonioAlvo);
        const gapBRL = round2(Math.max(0, targetValueBRL - nonNegative(member.currentValueBRL)));
        if (targetPct > 0) {
          effectiveAssetMap.set(member.id, { targetPct, targetValueBRL, gapBRL });
        }
      }
    }
  } else {
    // Modo classe: a meta da classe é distribuída de forma EQUIPONDERADA (1/N)
    // entre os ativos da classe, garantindo que o dinheiro estabilize a classe
    // sem inflar desproporcionalmente ativos que já são grandes.
    for (const [className, members] of assetsByClass) {
      const classTargetPct = classTargetMap.get(className) ?? 0;
      if (members.length === 0 || !(classTargetPct > 0)) continue;

      const sharePerMember = classTargetPct / members.length;
      for (const member of members) {
        const targetPct = round2(sharePerMember);
        const targetValueBRL = round2((targetPct / 100) * patrimonioAlvo);
        const gapBRL = round2(Math.max(0, targetValueBRL - nonNegative(member.currentValueBRL)));
        if (targetPct > 0) {
          effectiveAssetMap.set(member.id, { targetPct, targetValueBRL, gapBRL });
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // 2. Diagnóstico prévio de inelegibilidade dos ativos
  // -------------------------------------------------------------------------
  for (const asset of opts.assets) {
    const eff = effectiveAssetMap.get(asset.id);
    if (!eff || eff.targetPct <= 0) {
      skippedAssets.push({
        assetId: asset.id,
        ticker: asset.ticker,
        assetClass: asset.assetClass,
        reason: "no_target",
        detail: "Sem meta percentual definida.",
      });
    } else if (asset.priceBRL <= 0) {
      skippedAssets.push({
        assetId: asset.id,
        ticker: asset.ticker,
        assetClass: asset.assetClass,
        reason: "no_price",
        detail: "Cotação não disponível (R$ 0,00).",
      });
    } else if (eff.gapBRL <= 0) {
      skippedAssets.push({
        assetId: asset.id,
        ticker: asset.ticker,
        assetClass: asset.assetClass,
        reason: "above_target",
        detail: "Posição já atingiu ou superou o percentual-alvo.",
      });
    }
  }

  // -------------------------------------------------------------------------
  // 3. NÍVEL 1: Estabilização Macro por Classe (Orçamentação por Classe)
  // -------------------------------------------------------------------------
  const classMacros: InternalClassMacro[] = [];

  for (const [className, members] of assetsByClass) {
    let classTargetValueBRL = 0;
    let classTargetPct = classTargetMap.get(className) ?? 0;
    let classCurrentValueBRL = 0;
    let sumMemberGapsBRL = 0;

    for (const member of members) {
      classCurrentValueBRL += nonNegative(member.currentValueBRL);
      const eff = effectiveAssetMap.get(member.id);
      if (eff) {
        classTargetValueBRL += eff.targetValueBRL;
        if (member.priceBRL > 0) {
          sumMemberGapsBRL += eff.gapBRL;
        }
      }
    }

    if (opts.mode === "class" || (opts.mode === "both" && classTargetPct > 0)) {
      classTargetValueBRL = round2((classTargetPct / 100) * patrimonioAlvo);
    } else if (opts.mode === "asset" || !(classTargetPct > 0)) {
      classTargetPct = round2((classTargetValueBRL / patrimonioAlvo) * 100);
    }

    classCurrentValueBRL = round2(classCurrentValueBRL);
    sumMemberGapsBRL = round2(sumMemberGapsBRL);

    // O gap macro da classe respeita a necessidade real dos membros elegíveis
    // limitada pelo déficit geral da classe quando houver meta de classe explícita
    let gapBRL: number;
    if (opts.mode === "class" || (opts.mode === "both" && (classTargetMap.get(className) ?? 0) > 0)) {
      const classLevelGap = round2(Math.max(0, classTargetValueBRL - classCurrentValueBRL));
      gapBRL = Math.min(sumMemberGapsBRL, classLevelGap > 0 ? classLevelGap : sumMemberGapsBRL);
    } else {
      gapBRL = sumMemberGapsBRL;
    }

    const deficitRel = classTargetValueBRL > 0
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
  }

  // Ordena as classes por maior defasagem relativa desc e gap desc
  const sortedClasses = [...classMacros]
    .filter((c) => c.gapBRL > 0)
    .sort((a, b) => {
      if (b.deficitRel !== a.deficitRel) return b.deficitRel - a.deficitRel;
      return b.gapBRL - a.gapBRL;
    });

  // -------------------------------------------------------------------------
  // 4. NÍVEL 2: Distribuição do Orçamento da Classe para seus Ativos
  // -------------------------------------------------------------------------
  const routes: AporteRoute[] = [];
  const classSummaries: ClassAporteSummary[] = [];
  let poolAvailable = aporte;

  for (const macro of sortedClasses) {
    if (!(poolAvailable > 0)) break;

    // Orçamento inicial designado à classe
    const classBudget = Math.min(macro.gapBRL, poolAvailable);
    let classRemainingBudget = classBudget;
    let actualClassAllocated = 0;

    const members = assetsByClass.get(macro.className) ?? [];

    // Ativos elegíveis da classe ordenados por gap decrescente
    const eligibleMembers = members
      .filter((asset) => {
        const eff = effectiveAssetMap.get(asset.id);
        return eff !== undefined && eff.gapBRL > 0 && asset.priceBRL > 0;
      })
      .sort((a, b) => {
        const gapA = effectiveAssetMap.get(a.id)?.gapBRL ?? 0;
        const gapB = effectiveAssetMap.get(b.id)?.gapBRL ?? 0;
        return gapB - gapA;
      });

    for (const asset of eligibleMembers) {
      if (!(classRemainingBudget > 0)) break;
      const eff = effectiveAssetMap.get(asset.id);
      if (!eff) continue;

      const isFractional = isFractionalAsset(asset.assetClass, asset.ticker, asset.isFractional);
      const amountToAllocate = Math.min(eff.gapBRL, classRemainingBudget);

      if (isFractional) {
        // Criptoativos: precisão até 8 casas decimais
        const quantity = Math.floor((amountToAllocate / asset.priceBRL) * 100000000) / 100000000;
        if (quantity <= 0) continue;
        const allocatedBRL = round2(quantity * asset.priceBRL);
        if (!(allocatedBRL > 0)) continue;

        classRemainingBudget = round2(classRemainingBudget - allocatedBRL);
        actualClassAllocated = round2(actualClassAllocated + allocatedBRL);

        routes.push({
          assetId: asset.id,
          ticker: asset.ticker,
          assetClass: asset.assetClass,
          targetValueBRL: eff.targetValueBRL,
          currentValueBRL: round2(nonNegative(asset.currentValueBRL)),
          gapBRL: eff.gapBRL,
          allocatedBRL,
          quantity,
          priceBRL: round2(nonNegative(asset.priceBRL)),
        });
      } else {
        // Ativos tradicionais: cotas inteiras
        const quantity = Math.floor(amountToAllocate / asset.priceBRL);
        if (quantity < 1) {
          // Preço é maior que o montante que a classe pode alocar neste momento
          continue;
        }

        const allocatedBRL = round2(quantity * asset.priceBRL);
        if (!(allocatedBRL > 0)) continue;

        classRemainingBudget = round2(classRemainingBudget - allocatedBRL);
        actualClassAllocated = round2(actualClassAllocated + allocatedBRL);

        routes.push({
          assetId: asset.id,
          ticker: asset.ticker,
          assetClass: asset.assetClass,
          targetValueBRL: eff.targetValueBRL,
          currentValueBRL: round2(nonNegative(asset.currentValueBRL)),
          gapBRL: eff.gapBRL,
          allocatedBRL,
          quantity,
          priceBRL: round2(nonNegative(asset.priceBRL)),
        });
      }
    }

    // Deduz do pool total apenas o que foi REALMENTE alocado em compras
    poolAvailable = round2(poolAvailable - actualClassAllocated);

    classSummaries.push({
      className: macro.className,
      targetPct: macro.targetPct,
      targetValueBRL: macro.targetValueBRL,
      currentValueBRL: macro.currentValueBRL,
      gapBRL: macro.gapBRL,
      budgetAllocatedBRL: classBudget,
      actualAllocatedBRL: actualClassAllocated,
    });
  }

  // Preenche sumário das classes que não receberam orçamento (para completude)
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

  const totalAllocated = round2(routes.reduce((acc, r) => acc + r.allocatedBRL, 0));
  const leftover = round2(aporte - totalAllocated);

  return {
    mode: opts.mode,
    aporte,
    totalAllocated,
    leftover,
    routes,
    classSummaries,
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
}): AporteResult {
  return simulateAporte({
    mode: "class",
    aporte: opts.aporte,
    assets: opts.assets,
    classTargets: opts.classTargets,
  });
}

/**
 * Modo combinado (§3.11.3) — usa meta individual quando disponível e recorre
 * à meta de classe como fallback para ativos sem meta própria.
 * É o modo padrão recomendado para carteiras mistas.
 */
export function simulateCombinedAporte(opts: {
  aporte: number;
  assets: readonly AporteAssetInput[];
  classTargets: readonly ClassTargetInput[];
}): AporteResult {
  return simulateAporte({
    mode: "both",
    aporte: opts.aporte,
    assets: opts.assets,
    classTargets: opts.classTargets,
  });
}

