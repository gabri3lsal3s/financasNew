/**
 * Motor de Deduplicação Inteligente de Proventos Corporativos vs. Lançamentos Manuais.
 *
 * Compara proventos corporativos capturados (B3 e EUA) com lançamentos manuais do
 * investidor para evitar aprovações redundantes e inflação de Caixa.
 *
 * Critério Canônico:
 *  - Mesmo ticker canônico (normalizando sufixos `.SA` e fracionário `F` da B3);
 *  - Data de pagamento definida e diferença <= 3 dias úteis (ANBIMA/B3);
 *  - Diferença monetária no montante financeiro total <= 0,05 na moeda nativa (arredondamento/IOF).
 *
 * Módulo puro — sem chamadas externas.
 */

import type { CorporateDividend, PortfolioDividend } from "@/types";
import {
  classifyTickerMarket,
  countMarketBusinessDays,
  shiftMarketBusinessDays,
} from "./market-calendar";
import type { DividendInstrumentKind } from "./dividend-engine";

export interface DeduplicationOptions {
  maxBusinessDaysDiff?: number;
  maxAmountDiff?: number;
}

const FRACTIONAL_B3_SUFFIX_RE = /^([A-Z][A-Z0-9]{3}\d{1,2})F$/;
const VALID_ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Normaliza a chave do ticker para conciliação de proventos (PETR4F / B3SA3F / PETR4.SA -> PETR4 / B3SA3),
 * preservando sufixo `F` em ativos negociados em USD.
 */
export function normalizeDividendTickerKey(rawTicker: string, currency?: string | null): string {
  const clean = rawTicker.trim().toUpperCase().replace(/\.SA$/, "");
  if ((currency ?? "").trim().toUpperCase() === "USD") {
    return clean;
  }
  const fracMatch = clean.match(FRACTIONAL_B3_SUFFIX_RE);
  return fracMatch && fracMatch[1] ? fracMatch[1] : clean;
}

/**
 * Calcula a diferença em dias úteis entre duas datas ISO YYYY-MM-DD (com validação contra data inválida).
 */
export function getBusinessDaysDifference(
  date1: string,
  date2: string,
  market: "BR" | "US" = "BR",
): number {
  const d1 = date1.slice(0, 10);
  const d2 = date2.slice(0, 10);
  if (!VALID_ISO_DATE_RE.test(d1) || !VALID_ISO_DATE_RE.test(d2)) {
    return Number.POSITIVE_INFINITY;
  }
  if (d1 === d2) return 0;
  return d1 < d2
    ? countMarketBusinessDays(d1, d2, market)
    : countMarketBusinessDays(d2, d1, market);
}

/**
 * Localiza um lançamento manual em `portfolio_dividends` compatível com o evento
 * corporativo (para deduplicação fuzzy e reconciliação de `settled_dividend_id`).
 */
export function findFuzzyMatchingManualDividend(
  corporateEvent: Pick<CorporateDividend, "ticker" | "payment_date"> & { currency?: string },
  calculatedTotal: number,
  manualDividends: ReadonlyArray<
    Pick<PortfolioDividend, "ticker" | "date" | "amount"> & { id?: string; asset_id?: string | null }
  >,
  assetTickerMap?: ReadonlyMap<string, string>,
  options: DeduplicationOptions = {},
): (Pick<PortfolioDividend, "ticker" | "date" | "amount"> & { id?: string; asset_id?: string | null }) | null {
  if (!corporateEvent.payment_date || !Number.isFinite(calculatedTotal)) return null;

  const maxDays = options.maxBusinessDaysDiff ?? 3;
  const maxDiffCents = Math.round((options.maxAmountDiff ?? 0.05) * 100);

  const corpTicker = normalizeDividendTickerKey(corporateEvent.ticker);
  const corpDate = corporateEvent.payment_date.slice(0, 10);
  if (!VALID_ISO_DATE_RE.test(corpDate)) return null;

  const rawMarket = classifyTickerMarket(corporateEvent.ticker);
  const market: "BR" | "US" =
    rawMarket === "US" || corporateEvent.currency === "USD" ? "US" : "BR";
  const calculatedCents = Math.round(calculatedTotal * 100);

  for (const manual of manualDividends) {
    const rawManualTicker =
      manual.ticker ?? (manual.asset_id ? assetTickerMap?.get(manual.asset_id) : undefined) ?? "";
    const manualTicker = normalizeDividendTickerKey(rawManualTicker);

    if (!manualTicker || manualTicker !== corpTicker) continue;

    const manualDate = manual.date.slice(0, 10);
    if (!VALID_ISO_DATE_RE.test(manualDate)) continue;

    const dayDiff = getBusinessDaysDifference(corpDate, manualDate, market);
    if (dayDiff > maxDays) continue;

    const manualNum = Number(manual.amount);
    if (!Number.isFinite(manualNum)) continue;
    const manualCents = Math.round(manualNum * 100);
    if (Math.abs(calculatedCents - manualCents) <= maxDiffCents) {
      return manual;
    }
  }

  return null;
}

/**
 * Verifica se um provento corporativo (com valor apurado pelo investidor)
 * já foi lançado manualmente na tabela `portfolio_dividends`.
 */
export function isCorporateDividendDeduplicated(
  corporateEvent: Pick<CorporateDividend, "ticker" | "payment_date">,
  calculatedTotal: number,
  manualDividends: ReadonlyArray<
    Pick<PortfolioDividend, "ticker" | "date" | "amount"> & { asset_id?: string | null }
  >,
  assetTickerMap?: ReadonlyMap<string, string>,
  options: DeduplicationOptions = {},
): boolean {
  return (
    findFuzzyMatchingManualDividend(
      corporateEvent,
      calculatedTotal,
      manualDividends,
      assetTickerMap,
      options,
    ) !== null
  );
}

// ---------------------------------------------------------------------------
// Motor de Conciliação Bidirecional 1:1 e N:1 (§3.3)
// ---------------------------------------------------------------------------

export interface ReconciliationEventInput {
  id: string;
  ticker: string;
  currency: "BRL" | "USD";
  instrumentKind?: DividendInstrumentKind;
  comDate: string;
  paymentDate: string | null;
  grossCents: number;
  netCents: number;
  type: string;
  isTypeUncertain: boolean;
  manualReviewRequired: boolean;
  status: "PROVISIONED" | "PENDING_CONFIRMATION" | "SETTLED" | "DISMISSED";
}

export interface ReconciliationManualInput {
  id: string;
  ticker: string;
  currency: "BRL" | "USD";
  date: string;
  monthly: boolean;
  cents: number;
  sourceEventId: string | null;
  alreadyLinked: boolean;
}

export interface ReconciliationLink {
  eventos: readonly string[];
  manual: string;
  erroCentavos: number;
  reason?: "exact_1_to_1" | "tax_hypothesis" | "monthly_estimate" | "ambiguous_tie" | "n_to_1";
}

export interface ReconciliationResult {
  aplicar: readonly ReconciliationLink[];
  sugerir: readonly ReconciliationLink[];
  ambiguousEventIds: readonly string[];
  overSearchCapPartitions: readonly string[];
}

interface CandidateEdge1to1 {
  eventIdx: number;
  manualIdx: number;
  errorCents: number;
  dayDiff: number;
  usesTaxHypothesis: boolean;
  usesMonthlyEstimate: boolean;
}

function addDaysIsoLocal(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.slice(0, 10).split("-").map(Number);
  const dt = new Date(Date.UTC(y ?? 2026, (m ?? 1) - 1, (d ?? 1) + days));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

function resolveTypicalWindowEnd(
  comDate: string,
  instrumentKind: DividendInstrumentKind | undefined,
  market: "BR" | "US",
): string {
  if (market === "US" || instrumentKind === "exterior") {
    return shiftMarketBusinessDays(comDate, 22, "US");
  }
  if (instrumentKind === "fii_fiagro" || instrumentKind === "fi_infra") {
    return shiftMarketBusinessDays(comDate, 15, "BR");
  }
  return addDaysIsoLocal(comDate, 35);
}

function buildValueHypotheses(ev: ReconciliationEventInput): Array<{ cents: number; isHypothesis: boolean }> {
  const candidates: Array<{ cents: number; isHypothesis: boolean }> = [];
  const seen = new Set<number>();

  const push = (val: number, isHyp: boolean) => {
    const rounded = Math.round(val);
    if (rounded <= 0 || seen.has(rounded)) return;
    seen.add(rounded);
    candidates.push({ cents: rounded, isHypothesis: isHyp });
  };

  push(ev.netCents, false);
  if (ev.grossCents > 0) {
    push(ev.grossCents, ev.grossCents !== ev.netCents);
    if (ev.currency === "BRL" && (ev.type === "JCP" || ev.isTypeUncertain)) {
      push(Math.round(ev.grossCents * 0.85), true);
    } else if (ev.currency === "USD") {
      push(Math.round(ev.grossCents * 0.7), true);
    }
  }
  return candidates;
}

function evaluateEdge1to1(
  ev: ReconciliationEventInput,
  eventIdx: number,
  manual: ReconciliationManualInput,
  manualIdx: number,
  market: "BR" | "US",
): CandidateEdge1to1 | null {
  const manDate = manual.date.slice(0, 10);
  if (!VALID_ISO_DATE_RE.test(manDate) || !VALID_ISO_DATE_RE.test(ev.comDate.slice(0, 10))) {
    return null;
  }

  let dayDiff: number;
  let usesMonthlyEstimate = false;

  if (ev.paymentDate) {
    const payDate = ev.paymentDate.slice(0, 10);
    if (!VALID_ISO_DATE_RE.test(payDate)) return null;
    if (manual.monthly) {
      if (payDate.slice(0, 7) !== manDate.slice(0, 7)) return null;
      usesMonthlyEstimate = true;
      dayDiff = 0;
    } else {
      dayDiff = getBusinessDaysDifference(payDate, manDate, market);
      if (dayDiff > 5) return null;
    }
  } else {
    const comClean = ev.comDate.slice(0, 10);
    const windowEnd = resolveTypicalWindowEnd(comClean, ev.instrumentKind, market);
    if (manual.monthly) {
      const mMonth = manDate.slice(0, 7);
      if (mMonth < comClean.slice(0, 7) || mMonth > windowEnd.slice(0, 7)) {
        return null;
      }
      usesMonthlyEstimate = true;
      dayDiff = 0;
    } else {
      if (manDate < comClean || manDate > windowEnd) return null;
      dayDiff = getBusinessDaysDifference(comClean, manDate, market);
    }
  }

  const hypotheses = buildValueHypotheses(ev);
  let bestHyp: { errorCents: number; isHypothesis: boolean } | null = null;
  for (const h of hypotheses) {
    const tol = Math.max(10, Math.floor(0.015 * h.cents));
    const err = Math.abs(manual.cents - h.cents);
    if (err <= tol) {
      if (
        !bestHyp ||
        err < bestHyp.errorCents ||
        (err === bestHyp.errorCents && !h.isHypothesis && bestHyp.isHypothesis)
      ) {
        bestHyp = { errorCents: err, isHypothesis: h.isHypothesis };
      }
    }
  }

  if (!bestHyp) return null;

  return {
    eventIdx,
    manualIdx,
    errorCents: bestHyp.errorCents,
    dayDiff,
    usesTaxHypothesis: bestHyp.isHypothesis,
    usesMonthlyEstimate,
  };
}

interface MatchingSolution {
  edges: CandidateEdge1to1[];
  cardinality: number;
  totalErrorCents: number;
  totalDayDiff: number;
  taxHypCount: number;
}

function compareSolutions(a: MatchingSolution, b: MatchingSolution): number {
  if (a.cardinality !== b.cardinality) return b.cardinality - a.cardinality;
  if (a.totalErrorCents !== b.totalErrorCents) return a.totalErrorCents - b.totalErrorCents;
  if (a.totalDayDiff !== b.totalDayDiff) return a.totalDayDiff - b.totalDayDiff;
  return a.taxHypCount - b.taxHypCount;
}

function solveComponent1to1(
  compEventIdxs: number[],
  edgesByEvent: Map<number, CandidateEdge1to1[]>,
): { best: MatchingSolution | null; hasTie: boolean; tiedSolutions: MatchingSolution[] } {
  const sortedEvents = compEventIdxs.slice().sort((a, b) => a - b);
  let bestList: MatchingSolution[] = [];
  const usedManuals = new Set<number>();
  const currentEdges: CandidateEdge1to1[] = [];

  const backtrack = (
    pos: number,
    card: number,
    errSum: number,
    daySum: number,
    taxSum: number,
  ) => {
    const remainingMax = sortedEvents.length - pos;
    if (bestList.length > 0 && card + remainingMax < bestList[0]!.cardinality) {
      return;
    }
    if (pos === sortedEvents.length) {
      if (card === 0) return;
      const sol: MatchingSolution = {
        edges: currentEdges.slice(),
        cardinality: card,
        totalErrorCents: errSum,
        totalDayDiff: daySum,
        taxHypCount: taxSum,
      };
      if (bestList.length === 0) {
        bestList = [sol];
        return;
      }
      const cmp = compareSolutions(sol, bestList[0]!);
      if (cmp < 0) {
        bestList = [sol];
      } else if (cmp === 0) {
        bestList.push(sol);
      }
      return;
    }

    const evIdx = sortedEvents[pos]!;
    const adj = edgesByEvent.get(evIdx) ?? [];
    for (const edge of adj) {
      if (usedManuals.has(edge.manualIdx)) continue;
      usedManuals.add(edge.manualIdx);
      currentEdges.push(edge);
      backtrack(
        pos + 1,
        card + 1,
        errSum + edge.errorCents,
        daySum + edge.dayDiff,
        taxSum + (edge.usesTaxHypothesis ? 1 : 0),
      );
      currentEdges.pop();
      usedManuals.delete(edge.manualIdx);
    }
    backtrack(pos + 1, card, errSum, daySum, taxSum);
  };

  backtrack(0, 0, 0, 0, 0);
  if (bestList.length === 0) return { best: null, hasTie: false, tiedSolutions: [] };
  return { best: bestList[0]!, hasTie: bestList.length > 1, tiedSolutions: bestList };
}

/**
 * Concilia eventos abertos com lançamentos manuais do titular em dois passos (§3.3):
 * 1) Matching bipartido ótimo 1:1 por componente conexo (cardinalidade > erro > distância > hipótese fiscal);
 * 2) N:1 (subconjuntos de 2..4 eventos até 12 remanescentes por grupo) apenas como sugestão.
 */
export function reconcileCorporateWithManualDividends(
  eventosDoTitular: readonly ReconciliationEventInput[],
  extratoDoTitular: readonly ReconciliationManualInput[],
): ReconciliationResult {
  const aplicar: ReconciliationLink[] = [];
  const sugerir: ReconciliationLink[] = [];
  const ambiguousEventIds: string[] = [];
  const overSearchCapPartitions: string[] = [];

  type Partition = {
    market: "BR" | "US";
    events: ReconciliationEventInput[];
    manuals: ReconciliationManualInput[];
  };
  const partitions = new Map<string, Partition>();

  for (const ev of eventosDoTitular) {
    if (
      ev.status === "SETTLED" ||
      ev.status === "DISMISSED" ||
      ev.manualReviewRequired ||
      ev.netCents <= 0
    ) {
      continue;
    }
    const canon = normalizeDividendTickerKey(ev.ticker, ev.currency);
    if (!canon) continue;
    const key = `${ev.currency}:${canon}`;
    const part = partitions.get(key) ?? {
      market: ev.currency === "USD" ? "US" : "BR",
      events: [],
      manuals: [],
    };
    part.events.push(ev);
    partitions.set(key, part);
  }

  for (const man of extratoDoTitular) {
    if (man.sourceEventId || man.alreadyLinked || man.cents <= 0) continue;
    const canon = normalizeDividendTickerKey(man.ticker, man.currency);
    if (!canon) continue;
    const key = `${man.currency}:${canon}`;
    const part = partitions.get(key);
    if (!part) continue;
    part.manuals.push(man);
  }

  for (const [partKey, part] of Array.from(partitions.entries()).sort(([a], [b]) => a.localeCompare(b))) {
    const events = part.events.slice().sort((a, b) => a.id.localeCompare(b.id));
    const manuals = part.manuals.slice().sort((a, b) => a.id.localeCompare(b.id));
    if (events.length === 0 || manuals.length === 0) continue;

    const edgesByEvent = new Map<number, CandidateEdge1to1[]>();
    const edgesByManual = new Map<number, CandidateEdge1to1[]>();

    for (let ei = 0; ei < events.length; ei++) {
      for (let mi = 0; mi < manuals.length; mi++) {
        const edge = evaluateEdge1to1(events[ei]!, ei, manuals[mi]!, mi, part.market);
        if (!edge) continue;
        const eList = edgesByEvent.get(ei) ?? [];
        eList.push(edge);
        edgesByEvent.set(ei, eList);
        const mList = edgesByManual.get(mi) ?? [];
        mList.push(edge);
        edgesByManual.set(mi, mList);
      }
    }

    // Descobre componentes conexos no grafo bipartido
    const visitedEvents = new Set<number>();
    const visitedManuals = new Set<number>();
    const resolvedEventIdxs = new Set<number>();
    const resolvedManualIdxs = new Set<number>();
    const ambiguousComponentEventIdxs = new Set<number>();

    for (let ei = 0; ei < events.length; ei++) {
      if (visitedEvents.has(ei) || !edgesByEvent.has(ei)) continue;
      const compEvents: number[] = [];
      const queue: Array<{ kind: "e" | "m"; idx: number }> = [{ kind: "e", idx: ei }];
      visitedEvents.add(ei);

      while (queue.length > 0) {
        const cur = queue.shift()!;
        if (cur.kind === "e") {
          compEvents.push(cur.idx);
          for (const edge of edgesByEvent.get(cur.idx) ?? []) {
            if (!visitedManuals.has(edge.manualIdx)) {
              visitedManuals.add(edge.manualIdx);
              queue.push({ kind: "m", idx: edge.manualIdx });
            }
          }
        } else {
          for (const edge of edgesByManual.get(cur.idx) ?? []) {
            if (!visitedEvents.has(edge.eventIdx)) {
              visitedEvents.add(edge.eventIdx);
              queue.push({ kind: "e", idx: edge.eventIdx });
            }
          }
        }
      }

      if (compEvents.length > 10) {
        // Fallback determinístico em componentes muito grandes: não automatiza sem revisão
        for (const ce of compEvents) {
          ambiguousComponentEventIdxs.add(ce);
          ambiguousEventIds.push(events[ce]!.id);
        }
        continue;
      }

      const { best, hasTie, tiedSolutions } = solveComponent1to1(compEvents, edgesByEvent);
      if (!best) continue;

      if (hasTie) {
        for (const ce of compEvents) {
          ambiguousComponentEventIdxs.add(ce);
          ambiguousEventIds.push(events[ce]!.id);
        }
        const seenPairs = new Set<string>();
        for (const sol of tiedSolutions) {
          for (const edge of sol.edges) {
            const pairKey = `${events[edge.eventIdx]!.id}:${manuals[edge.manualIdx]!.id}`;
            if (seenPairs.has(pairKey)) continue;
            seenPairs.add(pairKey);
            sugerir.push({
              eventos: [events[edge.eventIdx]!.id],
              manual: manuals[edge.manualIdx]!.id,
              erroCentavos: edge.errorCents,
              reason: "ambiguous_tie",
            });
          }
        }
        continue;
      }

      for (const edge of best.edges) {
        resolvedEventIdxs.add(edge.eventIdx);
        resolvedManualIdxs.add(edge.manualIdx);
        const link: ReconciliationLink = {
          eventos: [events[edge.eventIdx]!.id],
          manual: manuals[edge.manualIdx]!.id,
          erroCentavos: edge.errorCents,
          reason: edge.usesMonthlyEstimate
            ? "monthly_estimate"
            : edge.usesTaxHypothesis
              ? "tax_hypothesis"
              : "exact_1_to_1",
        };
        if (edge.usesTaxHypothesis || edge.usesMonthlyEstimate) {
          sugerir.push(link);
        } else {
          aplicar.push(link);
        }
      }
    }

    // 2) N:1 apenas após retirar 1:1 resolvidos e componentes ambíguos (subconjuntos 2..4 até 12 eventos)
    const remainingEvents = events.filter(
      (_, idx) => !resolvedEventIdxs.has(idx) && !ambiguousComponentEventIdxs.has(idx),
    );
    const remainingManuals = manuals.filter((_, idx) => !resolvedManualIdxs.has(idx));

    if (remainingEvents.length > 12) {
      overSearchCapPartitions.push(partKey);
      continue;
    }
    if (remainingEvents.length < 2 || remainingManuals.length === 0) continue;

    for (const man of remainingManuals) {
      const manDate = man.date.slice(0, 10);
      if (!VALID_ISO_DATE_RE.test(manDate)) continue;
      const manMonth = manDate.slice(0, 7);

      const eligibleEvents = remainingEvents.filter((ev) => {
        const refDate = (ev.paymentDate ?? ev.comDate).slice(0, 10);
        if (!VALID_ISO_DATE_RE.test(refDate)) return false;
        if (man.monthly) {
          return refDate.slice(0, 7) === manMonth;
        }
        return getBusinessDaysDifference(refDate, manDate, part.market) <= 5;
      });
      if (eligibleEvents.length < 2) continue;

      const matchingSubsets: Array<{ ids: string[]; err: number }> = [];
      const n = eligibleEvents.length;

      const searchSubsets = (start: number, picked: ReconciliationEventInput[], sumCents: number) => {
        if (picked.length >= 2) {
          const tol = Math.max(10, Math.floor(0.01 * sumCents));
          const err = Math.abs(man.cents - sumCents);
          if (err <= tol) {
            matchingSubsets.push({ ids: picked.map((p) => p.id), err });
          }
        }
        if (picked.length === 4) return;
        for (let i = start; i < n; i++) {
          const ev = eligibleEvents[i]!;
          picked.push(ev);
          searchSubsets(i + 1, picked, sumCents + ev.netCents);
          picked.pop();
        }
      };

      searchSubsets(0, [], 0);
      if (matchingSubsets.length === 1) {
        sugerir.push({
          eventos: matchingSubsets[0]!.ids,
          manual: man.id,
          erroCentavos: matchingSubsets[0]!.err,
          reason: "n_to_1",
        });
      }
    }
  }

  return {
    aplicar,
    sugerir,
    ambiguousEventIds,
    overSearchCapPartitions,
  };
}
