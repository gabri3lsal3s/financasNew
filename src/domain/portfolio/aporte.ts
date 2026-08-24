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
    classTargetMap.set(ct.className, nonNegative(ct.targetPercentage));
  }

  const sectorTargetMap = new Map<string, Map<string, number>>();
  for (const st of opts.sectorTargets ?? []) {
    let sMap = sectorTargetMap.get(st.className);
    if (!sMap) {
      sMap = new Map<string, number>();
      sectorTargetMap.set(st.className, sMap);
    }
    sMap.set(st.sectorName, nonNegative(st.targetPercentage));
  }

  // -------------------------------------------------------------------------
  // 1. Meta efetiva por ativo (Hierarquia 3 Níveis: Classe -> Setor -> Ativo)
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
  } else {
    // Se mode === "both", metas individuais são consideradas prioritariamente
    if (opts.mode === "both") {
      for (const asset of opts.assets) {
        const targetPct = nonNegative(asset.targetPercentage ?? 0);
        if (targetPct > 0) {
          const targetValueBRL = round2((targetPct / 100) * patrimonioAlvo);
          const gapBRL = round2(Math.max(0, targetValueBRL - nonNegative(asset.currentValueBRL)));
          effectiveAssetMap.set(asset.id, { targetPct, targetValueBRL, gapBRL });
        }
      }
    }

    for (const [className, sectorMap] of assetsByClassAndSector) {
      const classTargetPct = classTargetMap.get(className) ?? 0;
      if (!(classTargetPct > 0)) continue;

      const sectorsWithTarget = sectorTargetMap.get(className);
      const hasConfiguredSectorTargets = sectorsWithTarget && sectorsWithTarget.size > 0;

      if (hasConfiguredSectorTargets) {
        // Alocação em 3 níveis: distribui a meta da classe para os setores cadastrados
        for (const [sectorName, members] of sectorMap) {
          const sectorTargetInClass = sectorsWithTarget?.get(sectorName) ?? 0;
          if (!(sectorTargetInClass > 0)) continue;

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
    let classTargetValueBRL = 0;
    let classTargetPct = classTargetMap.get(className) ?? 0;
    let classCurrentValueBRL = 0;
    let sumMemberGapsBRL = 0;

    const sectorMacroList: InternalSectorMacro[] = [];
    const sectorsWithTarget = sectorTargetMap.get(className);

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
    if (opts.mode === "class" || (opts.mode === "both" && (classTargetMap.get(className) ?? 0) > 0)) {
      const classLevelGap = round2(Math.max(0, classTargetValueBRL - classCurrentValueBRL));
      gapBRL = Math.min(sumMemberGapsBRL, classLevelGap > 0 ? classLevelGap : sumMemberGapsBRL);
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
  // 4. NÍVEL 3: Execução da Distribuição (Classe -> Setor -> Ativos)
  // -------------------------------------------------------------------------
  const routes: AporteRoute[] = [];
  const classSummaries: ClassAporteSummary[] = [];
  const sectorSummaries: SectorAporteSummary[] = [];
  let poolAvailable = aporte;

  for (const classMacro of sortedClasses) {
    if (!(poolAvailable > 0)) break;

    const classBudget = Math.min(classMacro.gapBRL, poolAvailable);
    let classRemainingBudget = classBudget;
    let actualClassAllocated = 0;

    const sectorMacros = (sectorMacrosByClass.get(classMacro.className) ?? [])
      .filter((s) => s.gapBRL > 0)
      .sort((a, b) => {
        if (b.deficitRel !== a.deficitRel) return b.deficitRel - a.deficitRel;
        return b.gapBRL - a.gapBRL;
      });

    // Se houver setores com metas cadastrados, orça setor por setor; senão distribui na classe
    const hasSectorTargets = (sectorTargetMap.get(classMacro.className)?.size ?? 0) > 0;

    if (hasSectorTargets && sectorMacros.length > 0) {
      for (const sectorMacro of sectorMacros) {
        if (!(classRemainingBudget > 0)) break;

        const sectorBudget = Math.min(sectorMacro.gapBRL, classRemainingBudget);
        let sectorRemainingBudget = sectorBudget;
        let actualSectorAllocated = 0;

        const sectorMembers = (assetsByClassAndSector.get(classMacro.className)?.get(sectorMacro.sectorName) ?? [])
          .filter((asset) => {
            const eff = effectiveAssetMap.get(asset.id);
            return eff !== undefined && eff.gapBRL > 0 && asset.priceBRL > 0;
          })
          .sort((a, b) => {
            const gapA = effectiveAssetMap.get(a.id)?.gapBRL ?? 0;
            const gapB = effectiveAssetMap.get(b.id)?.gapBRL ?? 0;
            return gapB - gapA;
          });

        for (const asset of sectorMembers) {
          if (!(sectorRemainingBudget > 0)) break;
          const eff = effectiveAssetMap.get(asset.id);
          if (!eff) continue;

          const precision = resolveAssetPrecision(asset);
          const amountToAllocate = Math.min(eff.gapBRL, sectorRemainingBudget);

          if (precision > 0) {
            // Ativos Fracionários: USD (4 casas) ou Cripto (8 casas)
            const multiplier = Math.pow(10, precision);
            const quantity = Math.floor((amountToAllocate / asset.priceBRL) * multiplier) / multiplier;
            if (quantity <= 0) continue;

            const allocatedBRL = round2(quantity * asset.priceBRL);
            if (!(allocatedBRL > 0)) continue;

            sectorRemainingBudget = round2(sectorRemainingBudget - allocatedBRL);
            classRemainingBudget = round2(classRemainingBudget - allocatedBRL);
            actualSectorAllocated = round2(actualSectorAllocated + allocatedBRL);
            actualClassAllocated = round2(actualClassAllocated + allocatedBRL);

            routes.push({
              assetId: asset.id,
              ticker: asset.ticker,
              assetClass: asset.assetClass,
              sector: sectorMacro.sectorName,
              targetValueBRL: eff.targetValueBRL,
              currentValueBRL: round2(nonNegative(asset.currentValueBRL)),
              gapBRL: eff.gapBRL,
              allocatedBRL,
              quantity,
              priceBRL: round2(nonNegative(asset.priceBRL)),
            });
          } else {
            // Ativos Nacionais B3: Cotas inteiras (>= 1)
            const quantity = Math.floor(amountToAllocate / asset.priceBRL);
            if (quantity < 1) continue;

            const allocatedBRL = round2(quantity * asset.priceBRL);
            if (!(allocatedBRL > 0)) continue;

            sectorRemainingBudget = round2(sectorRemainingBudget - allocatedBRL);
            classRemainingBudget = round2(classRemainingBudget - allocatedBRL);
            actualSectorAllocated = round2(actualSectorAllocated + allocatedBRL);
            actualClassAllocated = round2(actualClassAllocated + allocatedBRL);

            routes.push({
              assetId: asset.id,
              ticker: asset.ticker,
              assetClass: asset.assetClass,
              sector: sectorMacro.sectorName,
              targetValueBRL: eff.targetValueBRL,
              currentValueBRL: round2(nonNegative(asset.currentValueBRL)),
              gapBRL: eff.gapBRL,
              allocatedBRL,
              quantity,
              priceBRL: round2(nonNegative(asset.priceBRL)),
            });
          }
        }

        sectorSummaries.push({
          className: classMacro.className,
          sectorName: sectorMacro.sectorName,
          targetPctInClass: sectorMacro.targetPctInClass,
          effectiveTargetPct: sectorMacro.effectiveTargetPct,
          targetValueBRL: sectorMacro.targetValueBRL,
          currentValueBRL: sectorMacro.currentValueBRL,
          gapBRL: sectorMacro.gapBRL,
          budgetAllocatedBRL: sectorBudget,
          actualAllocatedBRL: actualSectorAllocated,
        });
      }
    } else {
      // Sem metas setoriais: distribui diretamente nos membros da classe
      const classMembers = (assetsByClass.get(classMacro.className) ?? [])
        .filter((asset) => {
          const eff = effectiveAssetMap.get(asset.id);
          return eff !== undefined && eff.gapBRL > 0 && asset.priceBRL > 0;
        })
        .sort((a, b) => {
          const gapA = effectiveAssetMap.get(a.id)?.gapBRL ?? 0;
          const gapB = effectiveAssetMap.get(b.id)?.gapBRL ?? 0;
          return gapB - gapA;
        });

      for (const asset of classMembers) {
        if (!(classRemainingBudget > 0)) break;
        const eff = effectiveAssetMap.get(asset.id);
        if (!eff) continue;

        const precision = resolveAssetPrecision(asset);
        const amountToAllocate = Math.min(eff.gapBRL, classRemainingBudget);
        const sector = asset.sector?.trim() || inferSectorFromTicker(asset.ticker, asset.assetClass);

        if (precision > 0) {
          const multiplier = Math.pow(10, precision);
          const quantity = Math.floor((amountToAllocate / asset.priceBRL) * multiplier) / multiplier;
          if (quantity <= 0) continue;

          const allocatedBRL = round2(quantity * asset.priceBRL);
          if (!(allocatedBRL > 0)) continue;

          classRemainingBudget = round2(classRemainingBudget - allocatedBRL);
          actualClassAllocated = round2(actualClassAllocated + allocatedBRL);

          routes.push({
            assetId: asset.id,
            ticker: asset.ticker,
            assetClass: asset.assetClass,
            sector,
            targetValueBRL: eff.targetValueBRL,
            currentValueBRL: round2(nonNegative(asset.currentValueBRL)),
            gapBRL: eff.gapBRL,
            allocatedBRL,
            quantity,
            priceBRL: round2(nonNegative(asset.priceBRL)),
          });
        } else {
          const quantity = Math.floor(amountToAllocate / asset.priceBRL);
          if (quantity < 1) continue;

          const allocatedBRL = round2(quantity * asset.priceBRL);
          if (!(allocatedBRL > 0)) continue;

          classRemainingBudget = round2(classRemainingBudget - allocatedBRL);
          actualClassAllocated = round2(actualClassAllocated + allocatedBRL);

          routes.push({
            assetId: asset.id,
            ticker: asset.ticker,
            assetClass: asset.assetClass,
            sector,
            targetValueBRL: eff.targetValueBRL,
            currentValueBRL: round2(nonNegative(asset.currentValueBRL)),
            gapBRL: eff.gapBRL,
            allocatedBRL,
            quantity,
            priceBRL: round2(nonNegative(asset.priceBRL)),
          });
        }
      }
    }

    poolAvailable = round2(poolAvailable - actualClassAllocated);

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
