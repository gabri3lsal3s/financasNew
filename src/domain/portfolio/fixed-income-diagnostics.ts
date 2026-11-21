/**
 * Diagnóstico Estrutural de Renda Fixa — §Fase 6 do Plano Mestre.
 *
 * Analisa a carteira de Renda Fixa em 3 dimensões essenciais:
 * 1. Distribuição por Indexador (CDI, IPCA, Pré-fixado, SELIC, Outros);
 * 2. Distribuição por Faixa de Vencimento (Até 1 ano, 1 a 2 anos, 2 a 5 anos, Acima de 5 anos, Liquidez);
 * 3. Concentração por Emissor Privado e Exposição à Garantia do FGC (Teto de R$ 250.000,00).
 *
 * Motor puramente determinístico — sem imports de UI ou Supabase.
 */

import type { FixedIncomeIssuerType, FixedIncomeMetadata, FixedIncomeRateType } from "@/types";
import { isFixedIncomeClass, isTesouroAsset } from "./valuation";
import { parseIssuerFromTicker } from "./tickers-catalog";

export interface FixedIncomePositionInput {
  assetId: string;
  ticker: string;
  name?: string | null;
  assetClass: string | null;
  valueBRL: number;
  isCash?: boolean;
  maturityDate?: string | null;
  fixedIncomeMetadata?: FixedIncomeMetadata | null;
}

export type DiagnosticRateType = FixedIncomeRateType | "igpm" | "outros";

export interface FixedIncomeIndexGroup {
  rateType: DiagnosticRateType;
  label: string;
  totalBRL: number;
  shareInFixedIncomePct: number;
  count: number;
}

export type MaturityBucketKey =
  | "up_to_1y"
  | "1y_to_2y"
  | "2y_to_5y"
  | "above_5y"
  | "liquid_or_none";

export interface FixedIncomeMaturityBucket {
  bucketKey: MaturityBucketKey;
  label: string;
  totalBRL: number;
  shareInFixedIncomePct: number;
  count: number;
}

export interface FixedIncomeDiagnosticIssuerGroup {
  issuerKey: string;
  issuerLabel: string;
  issuerType?: FixedIncomeIssuerType | null;
  totalBRL: number;
  shareInFixedIncomePct: number;
  shareInPortfolioPct: number;
  isFgcExceeded: boolean;
  isConcentratedInRF: boolean;
  count: number;
}

export interface FixedIncomeDiagnosticResult {
  totalFixedIncomeBRL: number;
  totalPortfolioBRL: number;
  shareInPortfolioPct: number;
  taxExemptValueBRL: number;
  taxExemptSharePct: number;
  indexers: FixedIncomeIndexGroup[];
  maturities: FixedIncomeMaturityBucket[];
  issuers: FixedIncomeDiagnosticIssuerGroup[];
  fgcExceededCount: number;
  hasOverdueMaturity: boolean;
}

const INDEXER_LABELS: Record<DiagnosticRateType, string> = {
  cdi: "Pós-fixado (CDI)",
  ipca: "Inflação (IPCA)",
  pre: "Pré-fixado",
  selic: "Pós-fixado (SELIC)",
  igpm: "Inflação (IGP-M)",
  outros: "Outros Indexadores",
};

/**
 * Infere o indexador do título a partir de metadata ou do ticker/nome.
 */
export function inferFixedIncomeRateType(
  ticker: string,
  name?: string | null,
  metadata?: FixedIncomeMetadata | null,
): DiagnosticRateType {
  if (metadata?.rate_type) {
    return metadata.rate_type;
  }
  const clean = `${ticker} ${name ?? ""}`.toUpperCase();
  if (clean.includes("IPCA") || clean.includes("NTN-B") || clean.includes("INFLA")) {
    return "ipca";
  }
  if (clean.includes("SELIC") || clean.includes("LFT")) {
    return "selic";
  }
  if (clean.includes("PRE") || clean.includes("PRÉ") || clean.includes("LTN") || clean.includes("NTN-F")) {
    return "pre";
  }
  if (clean.includes("IGPM") || clean.includes("IGP-M")) {
    return "igpm";
  }
  if (clean.includes("CDI") || clean.includes("CDB") || clean.includes("LCI") || clean.includes("LCA") || clean.includes("LC")) {
    return "cdi";
  }
  return "outros";
}

/**
 * Infere a data canônica de vencimento do título a partir do ticker ou nome.
 * Reconhece formatos de 4 dígitos (ex.: "TESOURO-IPCA-2035", "NTN-B 2032")
 * e de 2 dígitos (ex.: "TESOURO-IPCA-32", "TESOURO-IPCA-35", "PRE-29").
 */
export function inferMaturityDateFromTicker(
  ticker: string,
  name?: string | null,
): string | null {
  const clean = `${ticker} ${name ?? ""}`.toUpperCase();

  // 1. Quatro dígitos (ano completo >= 2024 e <= 2099)
  const fourDigitMatch = clean.match(/(?:IPCA|PRE|PRÉ|SELIC|TESOURO|NTN|LFT|CDB|LCI|LCA)[^\d]*\b(20[2-9]\d)\b/);
  if (fourDigitMatch?.[1]) {
    return `${fourDigitMatch[1]}-08-15`;
  }

  // 2. Dois dígitos no final ou após o indexador (ex.: "TESOURO-IPCA-32" -> ano 2032)
  const twoDigitMatch = clean.match(/(?:IPCA|PRE|PRÉ|SELIC|TESOURO|NTN|LFT)[^\d]*(\d{2})\b/);
  if (twoDigitMatch?.[1]) {
    const yr = parseInt(twoDigitMatch[1], 10);
    const fullYear = yr < 50 ? 2000 + yr : 1900 + yr;
    return `${fullYear}-08-15`;
  }

  return null;
}

/**
 * Classifica a faixa de vencimento em dias a partir da data de corte.
 */
export function classifyMaturityBucket(
  maturityDate: string | null | undefined,
  refDateISO: string,
): { key: MaturityBucketKey; label: string; isOverdue: boolean } {
  if (!maturityDate || maturityDate.trim() === "") {
    return { key: "liquid_or_none", label: "Liquidez / Sem vencimento", isOverdue: false };
  }

  const matTime = new Date(`${maturityDate.slice(0, 10)}T12:00:00Z`).getTime();
  const refTime = new Date(`${refDateISO.slice(0, 10)}T12:00:00Z`).getTime();

  if (Number.isNaN(matTime) || Number.isNaN(refTime)) {
    return { key: "liquid_or_none", label: "Liquidez / Sem vencimento", isOverdue: false };
  }

  const diffDays = Math.round((matTime - refTime) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { key: "up_to_1y", label: "Vencido / Imediato", isOverdue: true };
  }
  if (diffDays <= 365) {
    return { key: "up_to_1y", label: "Até 1 ano", isOverdue: false };
  }
  if (diffDays <= 730) {
    return { key: "1y_to_2y", label: "1 a 2 anos", isOverdue: false };
  }
  if (diffDays <= 1825) {
    return { key: "2y_to_5y", label: "2 a 5 anos", isOverdue: false };
  }
  return { key: "above_5y", label: "Acima de 5 anos", isOverdue: false };
}

/**
 * Calcula o diagnóstico estrutural e prudencial da carteira de Renda Fixa.
 */
export function calculateFixedIncomeDiagnostics(
  rows: readonly FixedIncomePositionInput[],
  totalPortfolioBRL?: number,
  refDateISO: string = new Date().toISOString().slice(0, 10),
): FixedIncomeDiagnosticResult {
  const fiRows = rows.filter(
    (r) =>
      !r.isCash &&
      (isFixedIncomeClass(r.assetClass) ||
        isTesouroAsset(r.ticker, r.assetClass) ||
        r.fixedIncomeMetadata !== undefined),
  );

  const totalFixedIncomeBRL = Math.round(fiRows.reduce((acc, r) => acc + Math.max(0, r.valueBRL), 0) * 100) / 100;
  const portfolioTotal = totalPortfolioBRL && totalPortfolioBRL > 0
    ? totalPortfolioBRL
    : Math.max(totalFixedIncomeBRL, Math.round(rows.reduce((acc, r) => acc + Math.max(0, r.valueBRL), 0) * 100) / 100);

  const shareInPortfolioPct = portfolioTotal > 0 ? (totalFixedIncomeBRL / portfolioTotal) * 100 : 0;

  // 1. Agrupamento por Indexador
  const indexerMap = new Map<DiagnosticRateType, { total: number; count: number }>();
  for (const row of fiRows) {
    const rateType = inferFixedIncomeRateType(row.ticker, row.name, row.fixedIncomeMetadata);
    const existing = indexerMap.get(rateType) ?? { total: 0, count: 0 };
    existing.total += Math.max(0, row.valueBRL);
    existing.count += 1;
    indexerMap.set(rateType, existing);
  }

  const indexers: FixedIncomeIndexGroup[] = (
    ["cdi", "ipca", "pre", "selic", "igpm", "outros"] as DiagnosticRateType[]
  )
    .filter((rt) => (indexerMap.get(rt)?.total ?? 0) > 0)
    .map((rt) => {
      const data = indexerMap.get(rt) ?? { total: 0, count: 0 };
      const total = Math.round(data.total * 100) / 100;
      return {
        rateType: rt,
        label: INDEXER_LABELS[rt],
        totalBRL: total,
        shareInFixedIncomePct: totalFixedIncomeBRL > 0 ? (total / totalFixedIncomeBRL) * 100 : 0,
        count: data.count,
      };
    })
    .sort((a, b) => b.totalBRL - a.totalBRL);

  // 2. Agrupamento por Faixa de Vencimento
  const maturityBuckets: Record<MaturityBucketKey, { total: number; count: number; label: string }> = {
    up_to_1y: { total: 0, count: 0, label: "Até 1 ano" },
    "1y_to_2y": { total: 0, count: 0, label: "1 a 2 anos" },
    "2y_to_5y": { total: 0, count: 0, label: "2 a 5 anos" },
    above_5y: { total: 0, count: 0, label: "Acima de 5 anos" },
    liquid_or_none: { total: 0, count: 0, label: "Liquidez / Sem vencimento" },
  };

  let hasOverdueMaturity = false;

  for (const row of fiRows) {
    const effectiveMaturityDate =
      row.fixedIncomeMetadata?.maturity_date ??
      row.maturityDate ??
      inferMaturityDateFromTicker(row.ticker, row.name);
    const bucket = classifyMaturityBucket(effectiveMaturityDate, refDateISO);
    if (bucket.isOverdue) {
      hasOverdueMaturity = true;
    }
    maturityBuckets[bucket.key].total += Math.max(0, row.valueBRL);
    maturityBuckets[bucket.key].count += 1;
  }

  const maturities: FixedIncomeMaturityBucket[] = (
    ["up_to_1y", "1y_to_2y", "2y_to_5y", "above_5y", "liquid_or_none"] as MaturityBucketKey[]
  )
    .map((key) => {
      const item = maturityBuckets[key];
      const total = Math.round(item.total * 100) / 100;
      return {
        bucketKey: key,
        label: item.label,
        totalBRL: total,
        shareInFixedIncomePct: totalFixedIncomeBRL > 0 ? (total / totalFixedIncomeBRL) * 100 : 0,
        count: item.count,
      };
    })
    .filter((m) => m.totalBRL > 0 || m.count > 0);

  // 3. Agrupamento por Emissor e Garantia FGC
  const issuerMap = new Map<
    string,
    {
      issuerKey: string;
      issuerLabel: string;
      issuerType?: FixedIncomeIssuerType | null;
      total: number;
      count: number;
    }
  >();

  let taxExemptValueBRL = 0;

  for (const row of fiRows) {
    const val = Math.max(0, row.valueBRL);
    const isExempt =
      row.fixedIncomeMetadata?.is_tax_exempt === true ||
      row.ticker.toUpperCase().startsWith("LCI") ||
      row.ticker.toUpperCase().startsWith("LCA") ||
      row.ticker.toUpperCase().startsWith("CRI") ||
      row.ticker.toUpperCase().startsWith("CRA");

    if (isExempt) {
      taxExemptValueBRL += val;
    }

    const { issuerKey, issuerLabel } = parseIssuerFromTicker(row.ticker, row.name);
    const existing = issuerMap.get(issuerKey) ?? {
      issuerKey,
      issuerLabel,
      issuerType: row.fixedIncomeMetadata?.issuer_type ?? null,
      total: 0,
      count: 0,
    };

    existing.total += val;
    existing.count += 1;
    if (!existing.issuerType && row.fixedIncomeMetadata?.issuer_type) {
      existing.issuerType = row.fixedIncomeMetadata.issuer_type;
    }
    issuerMap.set(issuerKey, existing);
  }

  taxExemptValueBRL = Math.round(taxExemptValueBRL * 100) / 100;
  const taxExemptSharePct = totalFixedIncomeBRL > 0 ? (taxExemptValueBRL / totalFixedIncomeBRL) * 100 : 0;

  let fgcExceededCount = 0;

  const issuers: FixedIncomeDiagnosticIssuerGroup[] = Array.from(issuerMap.values())
    .map((item) => {
      const total = Math.round(item.total * 100) / 100;
      const shareInRF = totalFixedIncomeBRL > 0 ? (total / totalFixedIncomeBRL) * 100 : 0;
      const shareInPort = portfolioTotal > 0 ? (total / portfolioTotal) * 100 : 0;
      const isSovereign = item.issuerType === "tesouro" || item.issuerKey.includes("TESOURO");
      const isFgcExceeded = !isSovereign && total > 250_000;
      const isConcentratedInRF = !isSovereign && shareInRF > 30;

      if (isFgcExceeded) {
        fgcExceededCount += 1;
      }

      return {
        issuerKey: item.issuerKey,
        issuerLabel: item.issuerLabel,
        issuerType: item.issuerType,
        totalBRL: total,
        shareInFixedIncomePct: shareInRF,
        shareInPortfolioPct: shareInPort,
        isFgcExceeded,
        isConcentratedInRF,
        count: item.count,
      };
    })
    .sort((a, b) => b.totalBRL - a.totalBRL);

  return {
    totalFixedIncomeBRL,
    totalPortfolioBRL: portfolioTotal,
    shareInPortfolioPct,
    taxExemptValueBRL,
    taxExemptSharePct,
    indexers,
    maturities,
    issuers,
    fgcExceededCount,
    hasOverdueMaturity,
  };
}
