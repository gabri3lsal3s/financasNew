/**
 * Calculadora de aporte — ESPECIFICAÇÃO §3.11.3.
 *
 * Dois modos:
 *   • `simulateSmartAporte`      — por META INDIVIDUAL de ativo;
 *   • `simulateRebalanceAporte`  — por META DE CLASSE (déficit da classe
 *     distribuído proporcionalmente ao valor atual dos ativos membros).
 *
 * Algoritmo (passos do spec):
 *   1. Defasagem macro por classe: classe com maior déficit relativo
 *      (alvo − atual) ÷ alvo recebe prioridade;
 *   2. Elegibilidade: meta definida, não zerada, gap > 0 e preço disponível;
 *   3. Ordenação: gap financeiro desc, respeitando a prioridade da classe;
 *   4. Distribuição: aloca até cobrir cada gap (limite absoluto = meta
 *      individual ou fração da meta da classe);
 *   5. Travas setoriais (`max_sector_acoes`/`max_sector_fiis`) impedem
 *      alocação que ultrapasse o teto de exposição da classe;
 *   6. Quantidades inteiras: preço × quantidade ≤ valor alocado; o excedente
 *      volta ao pool e vai para o próximo ativo;
 *   7. Sobra (teto/trava/arredondamento) → caixa/reserva;
 *   8. Log de roteamento: por ativo — valor alvo, atual, aporte sugerido,
 *      quantidade e preço; sobra final.
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

export type AporteMode = "asset" | "class";

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
}

export interface ClassTargetInput {
  className: string;
  /** % do patrimônio (0–100). */
  targetPercentage: number;
}

export interface ClassCapInput {
  className: string;
  /** Teto de exposição em % do patrimônio; null = sem trava. */
  cap: number | null;
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
  /** Aporte sugerido em BRL (quantidade inteira × preço). */
  allocatedBRL: number;
  /** Quantidade inteira sugerida. */
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
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

/** Arredonda para 2 casas (moeda BRL). */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

const nonNegative = (value: number): number => (Number.isFinite(value) ? Math.max(0, value) : 0);

// ---------------------------------------------------------------------------
// Travas setoriais — mapeamento max_sector_* → classes presentes
// ---------------------------------------------------------------------------

/** Aliases normalizados (sem acento) das classes sujeitas às travas. */
const ACCOES_CLASS_ALIASES = new Set(["acoes", "açoes", "acao", "ação", "açao", "renda variavel", "renda variável"]);
const FIIS_CLASS_ALIASES = new Set(["fii", "fiis", "fundo imobiliario", "fundos imobiliarios", "fundo imobiliário", "fundos imobiliários"]);

/**
 * Mapeia as travas setoriais (`max_sector_acoes`/`max_sector_fiis`) para as
 * classes efetivamente presentes na carteira (§3.11.3.5). Classes que não
 * correspondem a Ações/FIIs ficam sem trava (cap null). A comparação é
 * insensível a caixa/acento (DRY com `normalizeClassName`).
 */
export function classCapsFromSectorCaps(
  classes: readonly (string | null)[],
  maxSectorAcoes: number | null,
  maxSectorFiis: number | null,
): ClassCapInput[] {
  const seen = new Set<string>();
  const result: ClassCapInput[] = [];
  for (const className of classes) {
    if (!className) continue;
    const normalized = normalizeClassName(className);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    let cap: number | null = null;
    if (ACCOES_CLASS_ALIASES.has(normalized) && maxSectorAcoes !== null && maxSectorAcoes !== undefined) {
      cap = maxSectorAcoes;
    } else if (FIIS_CLASS_ALIASES.has(normalized) && maxSectorFiis !== null && maxSectorFiis !== undefined) {
      cap = maxSectorFiis;
    }
    result.push({ className, cap });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Motor de simulação
// ---------------------------------------------------------------------------

interface EffectiveTarget {
  targetPct: number;
  targetValueBRL: number;
  gapBRL: number;
}

function simulateAporte(opts: {
  mode: AporteMode;
  aporte: number;
  assets: readonly AporteAssetInput[];
  classTargets: readonly ClassTargetInput[];
  classCaps: readonly ClassCapInput[];
}): AporteResult {
  const aporte = round2(nonNegative(opts.aporte));
  if (!(aporte > 0)) {
    return { mode: opts.mode, aporte, totalAllocated: 0, leftover: aporte, routes: [] };
  }

  const totalAtual = round2(opts.assets.reduce((acc, a) => acc + nonNegative(a.currentValueBRL), 0));
  const patrimonioAlvo = round2(totalAtual + aporte);
  if (!(patrimonioAlvo > 0)) {
    return { mode: opts.mode, aporte, totalAllocated: 0, leftover: aporte, routes: [] };
  }

  // 1. Meta efetiva por ativo (alvo = % do patrimônio pós-aporte).
  const effective = new Map<string, EffectiveTarget>();

  if (opts.mode === "asset") {
    for (const asset of opts.assets) {
      const targetPct = nonNegative(asset.targetPercentage ?? 0);
      if (targetPct > 0) {
        const targetValueBRL = round2((targetPct / 100) * patrimonioAlvo);
        const gapBRL = round2(Math.max(0, targetValueBRL - nonNegative(asset.currentValueBRL)));
        effective.set(asset.id, { targetPct, targetValueBRL, gapBRL });
      }
    }
  } else {
    // Modo classe: o déficit da classe é distribuído PROPORCIONALMENTE ao
    // valor atual dos membros (meta efetiva = fração da meta da classe).
    const byClass = new Map<string, AporteAssetInput[]>();
    for (const asset of opts.assets) {
      const key = asset.assetClass ?? "";
      const list = byClass.get(key) ?? [];
      list.push(asset);
      byClass.set(key, list);
    }
    for (const classTarget of opts.classTargets) {
      const members = byClass.get(classTarget.className) ?? [];
      const classTargetPct = nonNegative(classTarget.targetPercentage);
      if (members.length === 0 || !(classTargetPct > 0)) continue;
      const classValue = members.reduce((acc, m) => acc + nonNegative(m.currentValueBRL), 0);
      for (const member of members) {
        const share =
          classValue > 0 && member.currentValueBRL > 0
            ? nonNegative(member.currentValueBRL) / classValue
            : 1 / members.length;
        const targetPct = round2(classTargetPct * share);
        const targetValueBRL = round2((targetPct / 100) * patrimonioAlvo);
        const gapBRL = round2(Math.max(0, targetValueBRL - nonNegative(member.currentValueBRL)));
        if (targetPct > 0) effective.set(member.id, { targetPct, targetValueBRL, gapBRL });
      }
    }
  }

  // 2–3. Defasagem macro por classe + ordenação.
  const classByKey = new Map<string, AporteAssetInput[]>();
  for (const asset of opts.assets) {
    const key = asset.assetClass ?? "";
    const list = classByKey.get(key) ?? [];
    list.push(asset);
    classByKey.set(key, list);
  }

  const classDeficitRel = new Map<string, number>();
  const classCurrentByClass = new Map<string, number>();
  for (const [key, members] of classByKey) {
    let classTargetValue = 0;
    let classCurrent = 0;
    for (const member of members) {
      const eff = effective.get(member.id);
      if (eff) {
        classTargetValue += eff.targetValueBRL;
        classCurrent += nonNegative(member.currentValueBRL);
      }
    }
    classDeficitRel.set(key, classTargetValue > 0 ? Math.max(0, (classTargetValue - classCurrent) / classTargetValue) : 0);
    classCurrentByClass.set(key, round2(classCurrent));
  }

  const capByClass = new Map<string, number | null>();
  for (const cap of opts.classCaps) capByClass.set(cap.className, cap.cap);

  const eligible = opts.assets
    .filter((asset) => {
      const eff = effective.get(asset.id);
      return eff !== undefined && eff.gapBRL > 0 && asset.priceBRL > 0;
    })
    .sort((a, b) => {
      const pa = classDeficitRel.get(a.assetClass ?? "") ?? 0;
      const pb = classDeficitRel.get(b.assetClass ?? "") ?? 0;
      if (pb !== pa) return pb - pa;
      const gapA = effective.get(a.id)?.gapBRL ?? 0;
      const gapB = effective.get(b.id)?.gapBRL ?? 0;
      return gapB - gapA;
    });

  // 4–7. Distribuição com quantidades inteiras, travas e sobra.
  const routes: AporteRoute[] = [];
  const classAllocated = new Map<string, number>();
  let remaining = aporte;

  for (const asset of eligible) {
    if (!(remaining > 0)) break;
    const eff = effective.get(asset.id);
    if (!eff) continue;

    const cap = capByClass.get(asset.assetClass ?? "") ?? null;
    let maxForClass = Infinity;
    if (cap !== null && cap !== undefined && cap > 0) {
      const classCurrent = classCurrentByClass.get(asset.assetClass ?? "") ?? 0;
      const allocated = classAllocated.get(asset.assetClass ?? "") ?? 0;
      maxForClass = round2((cap / 100) * patrimonioAlvo - classCurrent - allocated);
    }

    const amount = Math.min(eff.gapBRL, remaining, maxForClass);
    if (!(amount > 0)) continue;

    const quantity = Math.floor(amount / asset.priceBRL);
    if (quantity < 1) continue;

    const allocatedBRL = round2(quantity * asset.priceBRL);
    if (!(allocatedBRL > 0)) continue;

    remaining = round2(remaining - allocatedBRL);
    classAllocated.set(asset.assetClass ?? "", (classAllocated.get(asset.assetClass ?? "") ?? 0) + allocatedBRL);
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

  return {
    mode: opts.mode,
    aporte,
    totalAllocated: round2(aporte - remaining),
    leftover: round2(remaining),
    routes,
  };
}

/** Modo por meta individual de ativo (§3.11.3). */
export function simulateSmartAporte(opts: {
  aporte: number;
  assets: readonly AporteAssetInput[];
  classCaps?: readonly ClassCapInput[];
}): AporteResult {
  return simulateAporte({
    mode: "asset",
    aporte: opts.aporte,
    assets: opts.assets,
    classTargets: [],
    classCaps: opts.classCaps ?? [],
  });
}

/** Modo por meta de classe (§3.11.3) — ignora metas individuais. */
export function simulateRebalanceAporte(opts: {
  aporte: number;
  assets: readonly AporteAssetInput[];
  classTargets: readonly ClassTargetInput[];
  classCaps?: readonly ClassCapInput[];
}): AporteResult {
  return simulateAporte({
    mode: "class",
    aporte: opts.aporte,
    assets: opts.assets,
    classTargets: opts.classTargets,
    classCaps: opts.classCaps ?? [],
  });
}
