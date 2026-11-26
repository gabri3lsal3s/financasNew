/**
 * Regras puras e portáveis de Marco Zero, corte de acompanhamento, janela operacional
 * e custódia para o motor unificado de proventos (S1).
 *
 * Restrição de portabilidade (§4.3): sem dependências de `@/`, DOM, rede, relógio global
 * não injetado ou SDKs específicos de runtime, permitindo reutilização em cliente e Deno.
 */

export const DIVIDEND_TRACKING_MIN_DATE = "2000-01-01";
export const OPERATIONAL_DIVIDENDS_LOOKBACK_DAYS = 120;

export interface EffectiveStartInput {
  trackingStartDate: string | null | undefined;
  dividendsStartDate: string | null | undefined;
  accumulatedDividends: number;
  firstProvenCustodyDay: string | null | undefined;
}

export interface DividendLotInput {
  id: string;
  ticker: string;
  currency?: string | null;
  asset_class?: string | null;
  fixed_income_metadata?: unknown;
  quantity: number;
  accumulated_dividends?: number | null;
  dividends_start_date?: string | null;
  created_at?: string | null;
}

export interface DividendCustodyTxInput {
  id: string;
  asset_id: string;
  type: string;
  date: string;
  quantity: number;
}

export interface CalibrationPlanSelection {
  assetId: string;
  selected: boolean;
  targetDate: string | null | undefined;
}

export interface CalibrationPlanSummary {
  selectedCount: number;
  dateCounts: Array<{ date: string; count: number }>;
  firstCoveredDay: string | null;
}

export interface LotCutoffEvaluation {
  assetId: string;
  effectiveStart: string | null;
  eligible: boolean;
  qtyAtCom: number;
}

export interface GroupCutoffEvaluation {
  eligible: boolean;
  hasMixedEligibility: boolean;
  eligibleLotCount: number;
  ineligibleLotCount: number;
  totalLotCount: number;
  totalEligibleQty: number;
  perLot: LotCutoffEvaluation[];
}

function roundQty8(val: number): number {
  return Math.round(val * 100_000_000) / 100_000_000;
}

/**
 * Valida data civil estrita no formato `YYYY-MM-DD` (rejeita datas inválidas como `2026-02-31`).
 */
export function isValidCivilDate(value: string | null | undefined): value is string {
  if (typeof value !== "string") return false;
  const clean = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) return false;
  const parts = clean.split("-").map(Number);
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  if (!year || !month || !day) return false;
  const dt = new Date(Date.UTC(year, month - 1, day));
  return (
    dt.getUTCFullYear() === year &&
    dt.getUTCMonth() === month - 1 &&
    dt.getUTCDate() === day
  );
}

/** Extracts YYYY-MM-DD if strictly valid civil date (handles ISO strings only when exact or UTC offset normalized via injected helper). */
export function normalizeCivilDate(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return isValidCivilDate(trimmed) ? trimmed : null;
  }
  return null;
}

/** Converts timestamp/date string to `YYYY-MM-DD` in `America/Sao_Paulo` using UTC-3 fallback or Intl without external deps. */
export function toSaoPauloCivilDate(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return isValidCivilDate(trimmed) ? trimmed : null;
  }
  const parsed = Date.parse(trimmed);
  if (!Number.isFinite(parsed)) {
    const prefix = trimmed.slice(0, 10);
    return isValidCivilDate(prefix) ? prefix : null;
  }
  try {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const parts = fmt.formatToParts(new Date(parsed));
    const y = parts.find((p) => p.type === "year")?.value;
    const m = parts.find((p) => p.type === "month")?.value;
    const d = parts.find((p) => p.type === "day")?.value;
    if (y && m && d) {
      const iso = `${y}-${m}-${d}`;
      return isValidCivilDate(iso) ? iso : null;
    }
  } catch {
    // Fallback determinístico caso locale ICU esteja indisponível
  }
  const sp = new Date(parsed - 3 * 3600 * 1000);
  const iso = `${sp.getUTCFullYear()}-${String(sp.getUTCMonth() + 1).padStart(2, "0")}-${String(sp.getUTCDate()).padStart(2, "0")}`;
  return isValidCivilDate(iso) ? iso : null;
}

/** Soma dias corridos em calendário UTC puro sobre data `YYYY-MM-DD`. */
export function addCalendarDaysIso(isoDate: string, deltaDays: number): string {
  const [y, m, d] = isoDate.slice(0, 10).split("-").map(Number);
  const dt = new Date(Date.UTC(y ?? 2026, (m ?? 1) - 1, (d ?? 1) + deltaDays));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

export function maxIsoDate(a: string | null | undefined, b: string | null | undefined): string | null {
  const ca = normalizeCivilDate(a);
  const cb = normalizeCivilDate(b);
  if (!ca) return cb;
  if (!cb) return ca;
  return ca >= cb ? ca : cb;
}

export function minIsoDate(a: string | null | undefined, b: string | null | undefined): string | null {
  const ca = normalizeCivilDate(a);
  const cb = normalizeCivilDate(b);
  if (!ca) return cb;
  if (!cb) return ca;
  return ca <= cb ? ca : cb;
}

/** Valida piso/corte de acompanhamento de proventos: entre 2000-01-01 e amanhã em São Paulo. */
export function isValidDividendTrackingDate(
  isoDate: string | null | undefined,
  referenceTodayIso: string,
): boolean {
  const clean = normalizeCivilDate(isoDate);
  if (!clean) return false;
  const maxAllowed = addCalendarDaysIso(referenceTodayIso.slice(0, 10), 1);
  return clean >= DIVIDEND_TRACKING_MIN_DATE && clean <= maxAllowed;
}

/** Valida data real de pagamento para liquidação/confirmação: entre max(2000-01-01, comDate) e hoje em São Paulo. */
export function isValidDividendSettlementDate(
  paymentDate: string | null | undefined,
  comDate: string | null | undefined,
  referenceTodayIso: string,
): boolean {
  const payClean = normalizeCivilDate(paymentDate);
  const todayClean = normalizeCivilDate(referenceTodayIso);
  if (!payClean || !todayClean) return false;
  if (payClean < DIVIDEND_TRACKING_MIN_DATE || payClean > todayClean) return false;
  const comClean = normalizeCivilDate(comDate);
  if (comClean && payClean < comClean) return false;
  return true;
}

/**
 * Normaliza o ticker para agrupamento canônico de proventos.
 * Remove sufixo `.SA`; remove sufixo fracionário B3 (`F` após 4 letras + 1-2 dígitos) apenas quando moeda não é USD.
 */
export function normalizeCanonicalDividendTicker(
  ticker: string,
  currency?: string | null,
): string {
  const upper = ticker.trim().toUpperCase().replace(/\.SA$/, "");
  if ((currency ?? "").trim().toUpperCase() === "USD") {
    return upper;
  }
  return upper.replace(/^([A-Z][A-Z0-9]{3}\d{1,2})F$/, "$1");
}

/** Calcula o piso da janela operacional padrão (hoje - 120 dias corridos). */
export function computeOperationalDiscoveryFloor(
  referenceTodayIso: string,
  lookbackDays = OPERATIONAL_DIVIDENDS_LOOKBACK_DAYS,
): string {
  return addCalendarDaysIso(referenceTodayIso.slice(0, 10), -Math.max(1, lookbackDays));
}

/**
 * Predicado canônico de janela operacional para catálogo corporativo (§3.1.5):
 * `com_date <= hoje && (com_date >= D || (payment_date !== null && payment_date >= D))`.
 */
export function matchesOperationalCatalogWindow(
  event: { com_date: string; payment_date: string | null },
  referenceTodayIso: string,
  lookbackDays = OPERATIONAL_DIVIDENDS_LOOKBACK_DAYS,
): boolean {
  const comClean = normalizeCivilDate(event.com_date);
  const todayClean = normalizeCivilDate(referenceTodayIso);
  if (!comClean || !todayClean || comClean > todayClean) return false;
  const floor = computeOperationalDiscoveryFloor(todayClean, lookbackDays);
  const payClean = normalizeCivilDate(event.payment_date);
  return comClean >= floor || (payClean !== null && payClean >= floor);
}

/**
 * Calcula o primeiro dia (Data COM inclusiva) elegível para acompanhamento de proventos de um lote (§3.1 items 1–3).
 */
export function effectiveStartDate(input: EffectiveStartInput): string | null {
  const tracking = normalizeCivilDate(input.trackingStartDate);
  const validTracking = tracking && tracking >= DIVIDEND_TRACKING_MIN_DATE ? tracking : null;
  const divStart = normalizeCivilDate(input.dividendsStartDate);
  const validDivStart = divStart && divStart >= DIVIDEND_TRACKING_MIN_DATE ? divStart : null;
  const proven = normalizeCivilDate(input.firstProvenCustodyDay);
  const validProven = proven && proven >= DIVIDEND_TRACKING_MIN_DATE ? proven : null;
  const acc = Number(input.accumulatedDividends) || 0;

  if (acc > 0) {
    if (!validDivStart) return null;
    return maxIsoDate(validTracking, validDivStart);
  }

  if (validDivStart) {
    return maxIsoDate(validTracking, validDivStart);
  }

  if (!validProven) return null;
  return maxIsoDate(validTracking, validProven);
}

function isCustodyTxType(type: string): boolean {
  return (
    type === "buy" ||
    type === "subscription" ||
    type === "sell" ||
    type === "split" ||
    type === "reverse_split"
  );
}

function intradayWeight(type: string): number {
  if (type === "split" || type === "reverse_split") return 0;
  if (type === "buy" || type === "subscription") return 1;
  return 2;
}

function sortCustodyTxs(txs: DividendCustodyTxInput[]): DividendCustodyTxInput[] {
  return txs
    .filter((tx) => isCustodyTxType(tx.type))
    .slice()
    .sort((a, b) => {
      const da = a.date.slice(0, 10);
      const db = b.date.slice(0, 10);
      if (da !== db) return da.localeCompare(db);
      const wDiff = intradayWeight(a.type) - intradayWeight(b.type);
      if (wDiff !== 0) return wDiff;
      return a.id.localeCompare(b.id);
    });
}

function applyQtyStep(current: number, tx: DividendCustodyTxInput): number {
  const txQty = Math.max(0, Number(tx.quantity) || 0);
  if (tx.type === "buy" || tx.type === "subscription") {
    return current + txQty;
  }
  if (tx.type === "sell") {
    return Math.max(0, current - txQty);
  }
  if (tx.type === "split") {
    return txQty > 0 ? current * txQty : current;
  }
  if (tx.type === "reverse_split") {
    return txQty > 0 ? current / txQty : current;
  }
  return current;
}

function analyzeLotCustody(
  lot: DividendLotInput,
  allTxs: DividendCustodyTxInput[],
): {
  currentQty: number;
  sortedTxs: DividendCustodyTxInput[];
  baselineQty: number;
  baselineProvenDate: string | null;
  firstLedgerDay: string | null;
  firstProvenCustodyDay: string | null;
  validDividendsStartDate: string | null;
} {
  const currentQty = Math.max(0, Number(lot.quantity) || 0);
  const sortedTxs = sortCustodyTxs(allTxs.filter((tx) => tx.asset_id === lot.id));
  const rawStart = normalizeCivilDate(lot.dividends_start_date);
  const validDividendsStartDate =
    rawStart && rawStart >= DIVIDEND_TRACKING_MIN_DATE ? rawStart : null;
  const createdDayRaw = toSaoPauloCivilDate(lot.created_at ?? null);
  const validCreatedDay =
    createdDayRaw && createdDayRaw >= DIVIDEND_TRACKING_MIN_DATE ? createdDayRaw : null;

  let zeroQty = 0;
  let hadClampedSell = false;
  let firstLedgerDay: string | null = null;

  for (const tx of sortedTxs) {
    const txQty = Math.max(0, Number(tx.quantity) || 0);
    if (tx.type === "sell" && zeroQty + 1e-6 < txQty) {
      hadClampedSell = true;
    }
    zeroQty = applyQtyStep(zeroQty, tx);
    const txDay = normalizeCivilDate(tx.date.slice(0, 10));
    if (!firstLedgerDay && zeroQty > 1e-6 && txDay && txDay >= DIVIDEND_TRACKING_MIN_DATE) {
      firstLedgerDay = txDay;
    }
  }

  let baselineQty = 0;
  if (sortedTxs.length === 0) {
    baselineQty = currentQty;
  } else if (currentQty > zeroQty + 1e-6 || hadClampedSell) {
    let q = currentQty;
    for (let i = sortedTxs.length - 1; i >= 0; i--) {
      const tx = sortedTxs[i]!;
      const txQty = Math.max(0, Number(tx.quantity) || 0);
      if (tx.type === "buy" || tx.type === "subscription") {
        q -= txQty;
      } else if (tx.type === "sell") {
        q += txQty;
      } else if (tx.type === "split") {
        q /= txQty > 0 ? txQty : 1;
      } else if (tx.type === "reverse_split") {
        q *= txQty > 0 ? txQty : 1;
      }
    }
    baselineQty = q > 1e-6 ? roundQty8(q) : 0;
  }

  const baselineProvenDate =
    baselineQty > 1e-6 ? (validDividendsStartDate ?? validCreatedDay ?? null) : null;
  const firstProvenCustodyDay = minIsoDate(firstLedgerDay, baselineProvenDate);

  return {
    currentQty,
    sortedTxs,
    baselineQty,
    baselineProvenDate,
    firstLedgerDay,
    firstProvenCustodyDay,
    validDividendsStartDate,
  };
}

/** Determina o primeiro dia de custódia comprovada de um lote isolado (sem vazamento entre lotes). */
export function resolveFirstProvenCustodyDay(
  lot: DividendLotInput,
  transactions: DividendCustodyTxInput[],
): string | null {
  return analyzeLotCustody(lot, transactions).firstProvenCustodyDay;
}

function normalizeAssetClassLabel(assetClass: string | null | undefined): string {
  if (!assetClass) return "";
  return assetClass
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Indica se um ativo pertence à elegibilidade de proventos e calibração de corte. */
export function isAssetEligibleForDividendCalibration(asset: {
  ticker: string;
  asset_class?: string | null;
  fixed_income_metadata?: unknown;
}): boolean {
  const tickerNorm = asset.ticker.trim().toUpperCase();
  if (!tickerNorm) return false;
  if (
    tickerNorm === "CAIXA" ||
    tickerNorm === "CASH" ||
    tickerNorm.startsWith("CAIXA_") ||
    tickerNorm.startsWith("CASH_")
  ) {
    return false;
  }
  if (asset.fixed_income_metadata != null) return false;
  if (
    tickerNorm.startsWith("TESOURO") ||
    tickerNorm.includes("TESOURO") ||
    tickerNorm === "LFT" ||
    tickerNorm === "NTNB" ||
    tickerNorm === "LTN"
  ) {
    return false;
  }

  const normClass = normalizeAssetClassLabel(asset.asset_class);
  if (!normClass) return true;
  if (
    normClass === "caixa" ||
    normClass === "cash" ||
    normClass === "reserva" ||
    normClass === "conta corrente" ||
    normClass.includes("caixa")
  ) {
    return false;
  }
  if (
    normClass.includes("renda fixa") ||
    normClass.includes("rendafixa") ||
    normClass.includes("tesouro") ||
    normClass.includes("cdb") ||
    normClass.includes("lci") ||
    normClass.includes("lca") ||
    normClass.includes("debenture") ||
    /\b(cri|cra)\b/.test(normClass)
  ) {
    return false;
  }
  if (
    normClass.includes("cripto") ||
    normClass.includes("crypto") ||
    normClass.includes("moeda") ||
    normClass.includes("cambio")
  ) {
    return false;
  }
  return true;
}

/** Indica se um lote possui proventos acumulados anteriores ao extrato sem `dividends_start_date` definido. */
export function isAssetPendingDividendCalibration(asset: {
  ticker: string;
  asset_class?: string | null;
  fixed_income_metadata?: unknown;
  accumulated_dividends?: number | null;
  dividends_start_date?: string | null;
}): boolean {
  if (!isAssetEligibleForDividendCalibration(asset)) return false;
  const acc = Number(asset.accumulated_dividends ?? 0) || 0;
  if (acc <= 0) return false;
  return !normalizeCivilDate(asset.dividends_start_date);
}

/** Calcula a custódia efetiva de um lote considerando Marco Zero, corte individual e prova de baseline (§3.1). */
export function evaluateLotCutoffAtComDate(
  lot: DividendLotInput,
  transactions: DividendCustodyTxInput[],
  comDate: string,
  trackingStartDate: string | null | undefined,
): LotCutoffEvaluation {
  const comClean = normalizeCivilDate(comDate.slice(0, 10));
  const analysis = analyzeLotCustody(lot, transactions);
  const effStart = effectiveStartDate({
    trackingStartDate,
    dividendsStartDate: analysis.validDividendsStartDate,
    accumulatedDividends: Number(lot.accumulated_dividends ?? 0) || 0,
    firstProvenCustodyDay: analysis.firstProvenCustodyDay,
  });

  if (!comClean || !effStart || comClean < effStart) {
    return {
      assetId: lot.id,
      effectiveStart: effStart,
      eligible: false,
      qtyAtCom: 0,
    };
  }

  let qty: number;
  if (analysis.sortedTxs.length === 0) {
    qty =
      analysis.baselineProvenDate && comClean >= analysis.baselineProvenDate
        ? analysis.currentQty
        : 0;
  } else {
    qty =
      analysis.baselineQty > 1e-6 &&
      analysis.baselineProvenDate &&
      comClean >= analysis.baselineProvenDate
        ? analysis.baselineQty
        : 0;
    for (const tx of analysis.sortedTxs) {
      if (tx.date.slice(0, 10) > comClean) break;
      qty = applyQtyStep(qty, tx);
    }
  }

  const rounded = qty > 1e-6 ? roundQty8(qty) : 0;
  return {
    assetId: lot.id,
    effectiveStart: effStart,
    eligible: rounded > 0,
    qtyAtCom: rounded,
  };
}

/**
 * Avalia elegibilidade de um grupo canônico inteiro (`ticker + currency`) para uma Data COM (§3.1),
 * garantindo que grupos com lotes mistos reflitam todos os lotes elegíveis e nunca decidam só pelo ativo principal.
 */
export function evaluateGroupCutoffEligibility(input: {
  canonicalTicker: string;
  currency?: string | null;
  comDate: string;
  trackingStartDate: string | null | undefined;
  lots: DividendLotInput[];
  transactions: DividendCustodyTxInput[];
}): GroupCutoffEvaluation {
  const targetCurrency = (input.currency ?? "BRL").trim().toUpperCase();
  const matchingLots = input.lots.filter((lot) => {
    if (!isAssetEligibleForDividendCalibration(lot)) return false;
    const lotCurrency = (lot.currency ?? "BRL").trim().toUpperCase();
    if (lotCurrency !== targetCurrency) return false;
    return normalizeCanonicalDividendTicker(lot.ticker, lotCurrency) === input.canonicalTicker;
  });

  const perLot = matchingLots.map((lot) =>
    evaluateLotCutoffAtComDate(lot, input.transactions, input.comDate, input.trackingStartDate),
  );

  const eligibleLotCount = perLot.filter((item) => item.eligible).length;
  const ineligibleLotCount = perLot.length - eligibleLotCount;
  const totalEligibleQty = roundQty8(perLot.reduce((acc, item) => acc + item.qtyAtCom, 0));

  return {
    eligible: eligibleLotCount > 0 && totalEligibleQty > 0,
    hasMixedEligibility: eligibleLotCount > 0 && ineligibleLotCount > 0,
    eligibleLotCount,
    ineligibleLotCount,
    totalLotCount: perLot.length,
    totalEligibleQty,
    perLot,
  };
}

/** Resume quantos ativos selecionados receberão cada data e o primeiro dia coberto pela automação. */
export function summarizeCalibrationPlan(
  items: CalibrationPlanSelection[],
  existingTrackingStart: string | null | undefined,
): CalibrationPlanSummary {
  const byDate = new Map<string, number>();
  let earliestLotDate: string | null = null;
  let selectedCount = 0;

  for (const item of items) {
    if (!item.selected) continue;
    selectedCount += 1;
    const clean = normalizeCivilDate(item.targetDate);
    if (!clean) continue;
    byDate.set(clean, (byDate.get(clean) ?? 0) + 1);
    earliestLotDate = minIsoDate(earliestLotDate, clean);
  }

  const dateCounts = Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  const validTracking = normalizeCivilDate(existingTrackingStart);
  const firstCoveredDay = earliestLotDate
    ? maxIsoDate(validTracking, earliestLotDate)
    : validTracking;

  return {
    selectedCount,
    dateCounts,
    firstCoveredDay,
  };
}

// ---------------------------------------------------------------------------
// Fatia S2: Lote principal, Classificação de Instrumento, Prazos e Fontes
// ---------------------------------------------------------------------------

export type DividendInstrumentKind =
  | "fii_fiagro"
  | "fi_infra"
  | "etf"
  | "unit"
  | "acao_br"
  | "bdr"
  | "exterior"
  | "unknown";

export type DividendTrustTier =
  | "official"
  | "community_verified"
  | "enriched_fallback"
  | "raw_fallback";

export type DividendDistributionType =
  | "DIVIDENDO"
  | "JCP"
  | "RENDIMENTO"
  | "SOBRA"
  | "AMORTIZACAO"
  | "OUTROS";

const TRUST_TIER_PRIORITY: Record<DividendTrustTier, number> = {
  official: 4,
  community_verified: 3,
  enriched_fallback: 2,
  raw_fallback: 1,
};

/** Retorna a prioridade numérica de um `trust_tier` para impedir degradação por fonte inferior. */
export function getDividendTrustTierPriority(tier: DividendTrustTier | null | undefined): number {
  if (!tier) return 1;
  return TRUST_TIER_PRIORITY[tier] ?? 1;
}

/**
 * Seleciona o lote principal de um grupo canônico `(ticker, currency)` conforme §3.1.4:
 * prefere lote padrão existente (sem sufixo fracionário `F` em BRL), depois menor `id` estável.
 */
export function selectPrimaryLotForGroup<
  T extends { id: string; ticker: string; currency?: string | null },
>(lots: readonly T[]): T | null {
  if (lots.length === 0) return null;
  const sorted = lots.slice().sort((a, b) => {
    const aCur = (a.currency ?? "BRL").trim().toUpperCase();
    const bCur = (b.currency ?? "BRL").trim().toUpperCase();
    const aClean = a.ticker.trim().toUpperCase().replace(/\.SA$/, "");
    const bClean = b.ticker.trim().toUpperCase().replace(/\.SA$/, "");
    const aFrac = aCur !== "USD" && /^[A-Z][A-Z0-9]{3}\d{1,2}F$/.test(aClean) ? 1 : 0;
    const bFrac = bCur !== "USD" && /^[A-Z][A-Z0-9]{3}\d{1,2}F$/.test(bClean) ? 1 : 0;
    if (aFrac !== bFrac) return aFrac - bFrac;
    return String(a.id).localeCompare(String(b.id));
  });
  return sorted[0] ?? null;
}

/**
 * Classifica o instrumento a partir de uma entrada curada de catálogo (§4.1),
 * sem jamais inferir isenção por sufixo `11`, `asset_class` editável pelo usuário ou `quoteType`.
 */
export function classifyDividendInstrumentFromCatalogEntry(
  entry: { assetClass?: string | null; sector?: string | null; name?: string | null } | null | undefined,
  marketHint?: "BR" | "US",
): DividendInstrumentKind {
  if (!entry) {
    return marketHint === "US" ? "exterior" : "unknown";
  }
  if (entry.assetClass === "FIIs") {
    return entry.sector === "Infraestrutura / FI-Infra" ? "fi_infra" : "fii_fiagro";
  }
  if (entry.assetClass === "ETFs") return "etf";
  if (entry.assetClass === "Internacional") return "exterior";
  if (entry.assetClass === "BDRs") return "bdr";
  if (entry.assetClass === "Ações") {
    return /\bunit\b/i.test(entry.name ?? "") ? "unit" : "acao_br";
  }
  return marketHint === "US" ? "exterior" : "unknown";
}

function diffCalendarDays(fromIso: string, toIso: string): number {
  const a = normalizeCivilDate(fromIso.slice(0, 10));
  const b = normalizeCivilDate(toIso.slice(0, 10));
  if (!a || !b || a >= b) return 0;
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const msA = Date.UTC(ay ?? 2026, (am ?? 1) - 1, ad ?? 1);
  const msB = Date.UTC(by ?? 2026, (bm ?? 1) - 1, bd ?? 1);
  return Math.max(0, Math.round((msB - msA) / 86_400_000));
}

export interface ResolveOpenDividendStatusInput {
  comDate: string;
  paymentDate: string | null | undefined;
  referenceDate: string;
  market: "BR" | "US";
  instrumentKind: DividendInstrumentKind;
  currentStatus?: "PROVISIONED" | "PENDING_CONFIRMATION";
  isManual?: boolean;
  manualReviewRequired?: boolean;
  countBusinessDays: (fromIso: string, toIso: string, market: "BR" | "US") => number;
}

export interface ResolveOpenDividendStatusResult {
  status: "PROVISIONED" | "PENDING_CONFIRMATION";
  promotedByDeadline: boolean;
  regressedToProvisioned: boolean;
  isOver120DaysWithoutPayment: boolean;
  elapsedCount: number;
  threshold: number | null;
}

/**
 * Resolve o estado operacional aberto (`PROVISIONED` vs `PENDING_CONFIRMATION`) segundo §3.2:
 * - Pagamento conhecido futuro provisiona (regredindo abertos automáticos caso fonte corrija data);
 * - Pagamento conhecido <= `referenceDate` vai para conferência (`PENDING_CONFIRMATION`);
 * - Sem data de pagamento: após 15 pregões BR (fundos), 22 pregões US (exterior) ou 35 dias civis (ações BR/outros),
 *   promove para `PENDING_CONFIRMATION` mantendo `payment_date = null` e sem jamais liquidar por prazo.
 */
export function resolveOpenDividendEventStatus(
  input: ResolveOpenDividendStatusInput,
): ResolveOpenDividendStatusResult {
  const comClean = normalizeCivilDate(input.comDate.slice(0, 10));
  const refClean = normalizeCivilDate(input.referenceDate.slice(0, 10));
  const payClean = normalizeCivilDate(input.paymentDate ? input.paymentDate.slice(0, 10) : null);

  if (payClean && refClean) {
    if (payClean <= refClean) {
      return {
        status: "PENDING_CONFIRMATION",
        promotedByDeadline: false,
        regressedToProvisioned: false,
        isOver120DaysWithoutPayment: false,
        elapsedCount: 0,
        threshold: null,
      };
    }
    const regressed =
      !input.isManual &&
      !input.manualReviewRequired &&
      input.currentStatus === "PENDING_CONFIRMATION";
    return {
      status: "PROVISIONED",
      promotedByDeadline: false,
      regressedToProvisioned: regressed,
      isOver120DaysWithoutPayment: false,
      elapsedCount: 0,
      threshold: null,
    };
  }

  if (!comClean || !refClean || refClean <= comClean) {
    return {
      status: "PROVISIONED",
      promotedByDeadline: false,
      regressedToProvisioned: false,
      isOver120DaysWithoutPayment: false,
      elapsedCount: 0,
      threshold: null,
    };
  }

  const calDays = diffCalendarDays(comClean, refClean);
  const isOver120 = calDays > 120;

  let elapsedCount: number;
  let threshold: number;
  if (input.market === "US" || input.instrumentKind === "exterior") {
    elapsedCount = input.countBusinessDays(comClean, refClean, "US");
    threshold = 22;
  } else if (input.instrumentKind === "fii_fiagro" || input.instrumentKind === "fi_infra") {
    elapsedCount = input.countBusinessDays(comClean, refClean, "BR");
    threshold = 15;
  } else {
    elapsedCount = calDays;
    threshold = 35;
  }

  const promotedByDeadline = elapsedCount > threshold;
  return {
    status: promotedByDeadline ? "PENDING_CONFIRMATION" : "PROVISIONED",
    promotedByDeadline,
    regressedToProvisioned: false,
    isOver120DaysWithoutPayment: isOver120,
    elapsedCount,
    threshold,
  };
}

export interface ResolveExternalDistributionInput {
  provider: "brapi" | "yahoo";
  currency: "BRL" | "USD";
  instrumentKind: DividendInstrumentKind;
  rawLabel?: string | null;
  hasOfficialComDate: boolean;
  rate: number;
  comDate: string;
  paymentDate: string | null;
  publicOrdinaryYieldObservation?: {
    type: "RENDIMENTO";
    taxRatePct: 0;
  } | null;
}

export interface ResolveExternalDistributionResult {
  type: DividendDistributionType;
  taxRatePct: number;
  netRate: number;
  trustTier: DividendTrustTier;
  isTypeUncertain: boolean;
  paymentDate: string | null;
}

/**
 * Classifica label explícito de distribuição sem usar sufixo de ticker ou heurística de isenção (§4.1).
 */
export function parseExplicitDistributionLabel(
  rawLabel: string | null | undefined,
): DividendDistributionType | null {
  if (typeof rawLabel !== "string") return null;
  const upper = rawLabel.trim().toUpperCase();
  if (!upper) return null;
  if (upper.includes("JCP") || upper.includes("JUROS")) return "JCP";
  if (upper.includes("RENDIMENTO")) return "RENDIMENTO";
  if (upper.includes("SOBRA")) return "SOBRA";
  if (upper.includes("AMORTIZ")) return "AMORTIZACAO";
  if (upper.includes("DIVIDEND")) return "DIVIDENDO";
  return null;
}

/**
 * Aplica a hierarquia de fontes e natureza da distribuição (§4.1):
 * - Brapi só é `official` com COM comprovada (`lastDatePrior`), label explícito e pagamento consistente;
 * - Yahoo BR isolado (mesmo para FIIs conhecidos como MXRF11/VGIA11) permanece em `raw_fallback` + `isTypeUncertain: true`;
 * - Yahoo BR só alcança `enriched_fallback` com observação pública compatível explícita de rendimento ordinário.
 */
export function resolveExternalDistributionTerms(
  input: ResolveExternalDistributionInput,
): ResolveExternalDistributionResult {
  const validPayment =
    input.paymentDate && input.paymentDate >= input.comDate ? input.paymentDate : null;
  const paymentInconsistent = Boolean(input.paymentDate && !validPayment);

  if (input.provider === "brapi") {
    const parsedType = parseExplicitDistributionLabel(input.rawLabel);
    if (input.hasOfficialComDate && parsedType !== null && !paymentInconsistent) {
      const taxRatePct = parsedType === "JCP" ? 15 : 0;
      const netRate = Math.round(input.rate * (1 - taxRatePct / 100) * 100_000_000) / 100_000_000;
      return {
        type: parsedType,
        taxRatePct,
        netRate,
        trustTier: "official",
        isTypeUncertain: false,
        paymentDate: validPayment,
      };
    }
    const fallbackType = parsedType ?? "DIVIDENDO";
    const taxRatePct = fallbackType === "JCP" ? 15 : 0;
    const netRate = Math.round(input.rate * (1 - taxRatePct / 100) * 100_000_000) / 100_000_000;
    return {
      type: fallbackType,
      taxRatePct,
      netRate,
      trustTier: "raw_fallback",
      isTypeUncertain: true,
      paymentDate: validPayment,
    };
  }

  // Yahoo
  if (input.currency === "USD") {
    const explicitType = parseExplicitDistributionLabel(input.rawLabel) ?? "DIVIDENDO";
    const taxRatePct = 30;
    const netRate = Math.round(input.rate * 0.7 * 100_000_000) / 100_000_000;
    return {
      type: explicitType,
      taxRatePct,
      netRate,
      trustTier: validPayment && input.rawLabel ? "enriched_fallback" : "raw_fallback",
      isTypeUncertain: false,
      paymentDate: validPayment,
    };
  }

  const explicitYahooType = parseExplicitDistributionLabel(input.rawLabel);
  if (explicitYahooType === "AMORTIZACAO") {
    return {
      type: "AMORTIZACAO",
      taxRatePct: 0,
      netRate: Math.round(input.rate * 100_000_000) / 100_000_000,
      trustTier: "raw_fallback",
      isTypeUncertain: true,
      paymentDate: validPayment,
    };
  }

  // Enriquecimento exige observação pública compatível do mesmo evento + instrumento FII/FIAGRO elegível
  if (
    input.publicOrdinaryYieldObservation &&
    input.instrumentKind === "fii_fiagro"
  ) {
    return {
      type: "RENDIMENTO",
      taxRatePct: 0,
      netRate: Math.round(input.rate * 100_000_000) / 100_000_000,
      trustTier: "enriched_fallback",
      isTypeUncertain: false,
      paymentDate: validPayment,
    };
  }

  // ETFs (BOVA11), Units (ENGI11), FI-Infra sem comprovação e Yahoo BR isolado ficam em raw_fallback incerto
  return {
    type: "DIVIDENDO",
    taxRatePct: 0,
    netRate: Math.round(input.rate * 100_000_000) / 100_000_000,
    trustTier: "raw_fallback",
    isTypeUncertain: true,
    paymentDate: validPayment,
  };
}

export interface CorporateCandidateForSimilarity {
  id: string;
  ticker: string;
  currency: "BRL" | "USD";
  com_date: string;
  payment_date: string | null;
  type: DividendDistributionType;
  rate: number;
  is_type_uncertain: boolean;
  trust_tier?: DividendTrustTier | null;
  ex_date?: string | null;
  external_id?: string | null;
}

/**
 * Pesquisa candidato único compatível no catálogo (`±1` pregão, ou `±2` apenas com mesma `ex_date`
 * verificável ou `external_id` idêntico), moeda igual, taxa `±1%`, tipos compatíveis/incertos
 * e pagamento igual ou previamente nulo, sem merge transitivo (§4.1).
 */
export function findCompatibleCorporateCandidate<T extends CorporateCandidateForSimilarity>(
  incoming: Omit<CorporateCandidateForSimilarity, "id">,
  existingCandidates: readonly T[],
  businessDaysBetween: (d1: string, d2: string, market: "BR" | "US") => number,
): T | null {
  const market: "BR" | "US" = incoming.currency === "USD" ? "US" : "BR";
  const incomingCanon = normalizeCanonicalDividendTicker(incoming.ticker, incoming.currency);

  const matches = existingCandidates.filter((cand) => {
    if (cand.currency !== incoming.currency) return false;
    if (normalizeCanonicalDividendTicker(cand.ticker, cand.currency) !== incomingCanon) return false;

    const rateTol = Math.max(0.0001, Math.max(cand.rate, incoming.rate) * 0.01);
    if (Math.abs(cand.rate - incoming.rate) > rateTol) return false;

    // Duas datas de pagamento explícitas distintas preservam parcelas separadas
    if (
      cand.payment_date &&
      incoming.payment_date &&
      cand.payment_date.slice(0, 10) !== incoming.payment_date.slice(0, 10)
    ) {
      return false;
    }

    // Tipos incompatíveis quando ambos são certos e distintos
    if (!cand.is_type_uncertain && !incoming.is_type_uncertain && cand.type !== incoming.type) {
      return false;
    }

    const dCand = cand.com_date.slice(0, 10);
    const dInc = incoming.com_date.slice(0, 10);
    if (dCand === dInc) return true;

    const bDays =
      dCand < dInc
        ? businessDaysBetween(dCand, dInc, market)
        : businessDaysBetween(dInc, dCand, market);

    if (bDays <= 1) return true;
    if (bDays === 2) {
      const sameExDate =
        Boolean(cand.ex_date && incoming.ex_date) &&
        cand.ex_date!.slice(0, 10) === incoming.ex_date!.slice(0, 10);
      const sameExternalId =
        Boolean(cand.external_id && incoming.external_id) &&
        cand.external_id === incoming.external_id;
      return sameExDate || sameExternalId;
    }
    return false;
  });

  // Apenas candidato único pode ser enriquecido mantendo UUID/FKs
  return matches.length === 1 ? matches[0]! : null;
}
