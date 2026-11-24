import type { ColumnMapping, RawParsedRow } from "@/domain/reconciliation/types";
import { normalizeDateToISO, parseAmountToCents } from "@/domain/reconciliation/parsers/type-sniffer";

export const STATEMENT_MAPPING_CACHE_KEY = "axir_statement_column_mapping_cache";

interface CachedMappingEntry {
  signature: string;
  mapping: ColumnMapping;
  savedAt: string;
}

// Cache em memória para acesso síncrono e testes sem dependência de window
const inMemoryCache = new Map<string, ColumnMapping>();

/**
 * Normaliza e gera assinatura determinística dos cabeçalhos de coluna de um extrato.
 */
export function computeHeaderSignature(headerCells: string[]): string {
  if (!headerCells || headerCells.length === 0) return "";
  return headerCells
    .map((c) =>
      c
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9$]/g, "")
    )
    .filter(Boolean)
    .join("|");
}

function readStorageMap(): Record<string, CachedMappingEntry> {
  if (typeof window === "undefined" || !window.localStorage) {
    const memObj: Record<string, CachedMappingEntry> = {};
    for (const [k, v] of inMemoryCache.entries()) {
      memObj[k] = { signature: k, mapping: v, savedAt: new Date().toISOString() };
    }
    return memObj;
  }

  try {
    const raw = window.localStorage.getItem(STATEMENT_MAPPING_CACHE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, CachedMappingEntry>;
  } catch {
    return {};
  }
}

function writeStorageMap(map: Record<string, CachedMappingEntry>): void {
  for (const [k, v] of Object.entries(map)) {
    inMemoryCache.set(k, v.mapping);
  }

  if (typeof window === "undefined" || !window.localStorage) return;

  try {
    window.localStorage.setItem(STATEMENT_MAPPING_CACHE_KEY, JSON.stringify(map));
  } catch {
    // QuotaExceeded ou ambiente bloqueado: mantém em memória sem quebrar a execução
  }
}

/**
 * Validação Defensiva do Mapeamento:
 * Avalia se os índices em cache continuam válidos no arquivo atual.
 * Exige que os índices estejam dentro dos limites de colunas e que >= 50% das linhas amostradas
 * contenham data e valor válidos nos índices propostos.
 */
export function validateMappingAgainstSample(
  mapping: ColumnMapping,
  sampleRows: RawParsedRow[],
): boolean {
  if (!sampleRows || sampleRows.length === 0) return true;

  const dataRows = sampleRows.slice(mapping.startRowIndex, mapping.startRowIndex + 10);
  if (dataRows.length === 0) return true;

  let validCount = 0;
  for (const row of dataRows) {
    const numCols = row.cells.length;
    // 1. Verificação de limites de colunas
    if (
      mapping.dateColIndex >= numCols ||
      mapping.descriptionColIndex >= numCols ||
      (mapping.amountColIndex !== undefined && mapping.amountColIndex >= numCols)
    ) {
      return false;
    }

    const rawDate = row.cells[mapping.dateColIndex] ?? "";
    const rawAmt = row.cells[mapping.amountColIndex] ?? "";

    const hasDate = Boolean(normalizeDateToISO(rawDate));
    const hasAmt = Boolean(parseAmountToCents(rawAmt));

    if (hasDate && hasAmt) {
      validCount++;
    }
  }

  const ratio = validCount / dataRows.length;
  // Exige ao menos 50% de linhas de dados válidas para aprovar o cache
  return ratio >= 0.5;
}

/**
 * Recupera o mapeamento em cache para os cabeçalhos informados,
 * aplicando fallback defensivo caso as colunas tenham mudado.
 */
export function getCachedColumnMapping(
  headerCells: string[],
  sampleRows?: RawParsedRow[],
): ColumnMapping | null {
  const signature = computeHeaderSignature(headerCells);
  if (!signature) return null;

  const storageMap = readStorageMap();
  const entry = storageMap[signature];
  const cachedMapping = entry?.mapping ?? inMemoryCache.get(signature);

  if (!cachedMapping) {
    return null;
  }

  // Fallback Defensivo se linhas de amostra foram fornecidas
  if (sampleRows && sampleRows.length > 0) {
    const isValid = validateMappingAgainstSample(cachedMapping, sampleRows);
    if (!isValid) {
      // Invalida cache corrompido ou desatualizado
      invalidateCachedColumnMapping(headerCells);
      return null;
    }
  }

  return cachedMapping;
}

/**
 * Salva o mapeamento de colunas validado pelo usuário para reuso futuro.
 */
export function setCachedColumnMapping(
  headerCells: string[],
  mapping: ColumnMapping,
): void {
  if (!mapping.hasHeader) return;
  const signature = computeHeaderSignature(headerCells);
  if (!signature) return;

  inMemoryCache.set(signature, mapping);

  const storageMap = readStorageMap();
  storageMap[signature] = {
    signature,
    mapping,
    savedAt: new Date().toISOString(),
  };
  writeStorageMap(storageMap);
}

/**
 * Invalida o mapeamento de um cabeçalho específico.
 */
export function invalidateCachedColumnMapping(headerCells: string[]): void {
  const signature = computeHeaderSignature(headerCells);
  if (!signature) return;

  inMemoryCache.delete(signature);

  const storageMap = readStorageMap();
  if (storageMap[signature]) {
    delete storageMap[signature];
    writeStorageMap(storageMap);
  }
}

/**
 * Limpa todo o cache de mapeamento de colunas (para testes ou redefinição de fábrica).
 */
export function clearAllColumnMappingCache(): void {
  inMemoryCache.clear();
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.removeItem(STATEMENT_MAPPING_CACHE_KEY);
    } catch {
      // Ignora erro de storage
    }
  }
}
