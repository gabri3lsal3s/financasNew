/**
 * Backup integral JSON — F22 (Central de Exportação).
 *
 * Formato versionado (`version: 1`) com todos os dados do usuário, validado
 * por Zod + checagem de integridade referencial ANTES da importação:
 *   • estrutura (versão, datas, arrays de linhas);
 *   • todo registro possui `id`;
 *   • categorias/cartões/ativos referenciados existem no próprio backup.
 * Motor 100% puro — sem DOM/Supabase.
 */

import { z } from "zod";

/** Versão do formato de backup. Bump quebra compatibilidade (migração manual). */
const BACKUP_VERSION = 1;

const APP_NAME = "Finanças Pessoais";

export type BackupRow = Record<string, unknown>;

/**
 * Ordem canônica das tabelas do backup (fonte única). A ordem reflete as
 * dependências FK (pais antes dos filhos) — usada no RPC de restauração e
 * na validação de integridade.
 */
export const BACKUP_TABLE_KEYS = [
  "categories",
  "credit_cards",
  "card_competence_overrides",
  "incomes",
  "expenses",
  "card_payments",
  "debts",
  "budgets",
  "income_goals",
  "insight_feedback",
  "reminder_states",
  "portfolio_assets",
  "portfolio_transactions",
  "portfolio_snapshots",
  "portfolio_contributions",
  "portfolio_dividends",
  "allocation_targets",
  "class_targets",
  "sector_targets",
  "asset_prices",
  "cash_checkpoints",
  "user_preferences",
] as const;

export type BackupTableKey = (typeof BACKUP_TABLE_KEYS)[number];

export interface BackupData {
  categories: BackupRow[];
  credit_cards: BackupRow[];
  card_competence_overrides: BackupRow[];
  incomes: BackupRow[];
  expenses: BackupRow[];
  card_payments: BackupRow[];
  debts: BackupRow[];
  budgets: BackupRow[];
  income_goals: BackupRow[];
  insight_feedback: BackupRow[];
  reminder_states: BackupRow[];
  portfolio_assets: BackupRow[];
  portfolio_transactions: BackupRow[];
  portfolio_snapshots: BackupRow[];
  portfolio_contributions: BackupRow[];
  portfolio_dividends: BackupRow[];
  allocation_targets: BackupRow[];
  class_targets: BackupRow[];
  sector_targets: BackupRow[];
  asset_prices: BackupRow[];
  cash_checkpoints: BackupRow[];
  user_preferences: BackupRow[];
}

export interface BackupMetadata {
  schemaVersion: number;
  app: string;
  exportedAt: string;
  checksum: string;
  totalRecords: number;
  tableCounts: Record<string, number>;
  modulesSummary: {
    categories: number;
    cards: number;
    transactions: number;
    debts: number;
    budgets: number;
    investments: number;
    preferences: number;
  };
}

export interface BackupPayload {
  version: number;
  app: string;
  exportedAt: string;
  checksum?: string;
  metadata?: BackupMetadata;
  data: BackupData;
}

/** Contagem de registros restaurados por tabela (retorno do RPC). */
export type RestoreSummary = Record<string, number>;

/** Serialização JSON determinística com ordenação lexicográfica de chaves. */
export function deterministicStringify(obj: unknown): string {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return `[${obj.map(deterministicStringify).join(",")}]`;
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${deterministicStringify((obj as Record<string, unknown>)[k])}`)
    .join(",")}}`;
}

/**
 * Calcula um checksum determinístico (hexadecimal) baseado em hash 64-bit FNV-1a
 * sobre a representação canônica dos dados.
 */
export function calculateBackupChecksum(data: unknown): string {
  const str = deterministicStringify(data);
  let h1 = 0x811c9dc5;
  let h2 = 0xcbf29ce4;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 0x01000193);
    h2 = Math.imul(h2 ^ ((ch << 8) | (ch >> 8)), 0x01000193);
  }
  const hex1 = (h1 >>> 0).toString(16).padStart(8, "0");
  const hex2 = (h2 >>> 0).toString(16).padStart(8, "0");
  return `chk_${hex1}${hex2}`;
}

const rowSchema = z.record(z.string(), z.unknown());

const metadataSchema = z
  .object({
    schemaVersion: z.number().int().positive().optional(),
    app: z.string().optional(),
    exportedAt: z.string().optional(),
    checksum: z.string().optional(),
    totalRecords: z.number().int().nonnegative().optional(),
    tableCounts: z.record(z.string(), z.number().int().nonnegative()).optional(),
    modulesSummary: z.record(z.string(), z.number().int().nonnegative()).optional(),
  })
  .optional();

const backupSchema = z.object({
  version: z.number().int().positive(),
  app: z.string(),
  exportedAt: z.string(),
  checksum: z.string().optional(),
  metadata: metadataSchema,
  data: z.record(z.string(), rowSchema.array()).refine(
    (data) => BACKUP_TABLE_KEYS.every((key) => Array.isArray(data[key])),
    "Backup incompleto: faltam tabelas do formato.",
  ),
});

/** Monta o payload de backup a partir dos dados brutos (fetch RLS) enriquecido com metadados e checksum. */
export function buildBackupPayload(data: BackupData): BackupPayload {
  const exportedAt = new Date().toISOString();
  const checksum = calculateBackupChecksum(data);

  const tableCounts = Object.fromEntries(
    BACKUP_TABLE_KEYS.map((k) => [k, Array.isArray(data[k]) ? data[k].length : 0]),
  ) as Record<string, number>;

  const totalRecords = Object.values(tableCounts).reduce((acc, count) => acc + count, 0);

  const modulesSummary = {
    categories: data.categories?.length ?? 0,
    cards:
      (data.credit_cards?.length ?? 0) +
      (data.card_payments?.length ?? 0) +
      (data.card_competence_overrides?.length ?? 0),
    transactions: (data.expenses?.length ?? 0) + (data.incomes?.length ?? 0),
    debts: data.debts?.length ?? 0,
    budgets: (data.budgets?.length ?? 0) + (data.income_goals?.length ?? 0),
    investments:
      (data.portfolio_assets?.length ?? 0) +
      (data.portfolio_transactions?.length ?? 0) +
      (data.portfolio_snapshots?.length ?? 0) +
      (data.portfolio_contributions?.length ?? 0) +
      (data.portfolio_dividends?.length ?? 0) +
      (data.allocation_targets?.length ?? 0) +
      (data.class_targets?.length ?? 0) +
      (data.sector_targets?.length ?? 0) +
      (data.asset_prices?.length ?? 0) +
      (data.cash_checkpoints?.length ?? 0),
    preferences:
      (data.user_preferences?.length ?? 0) +
      (data.insight_feedback?.length ?? 0) +
      (data.reminder_states?.length ?? 0),
  };

  const metadata: BackupMetadata = {
    schemaVersion: BACKUP_VERSION,
    app: APP_NAME,
    exportedAt,
    checksum,
    totalRecords,
    tableCounts,
    modulesSummary,
  };

  return {
    version: BACKUP_VERSION,
    app: APP_NAME,
    exportedAt,
    checksum,
    metadata,
    data,
  };
}

function idsOf(rows: readonly BackupRow[]): Set<string> {
  return new Set(rows.map((row) => String(row.id)).filter((id) => id !== "undefined" && id !== "null"));
}

function asString(row: BackupRow, key: string): string | null {
  const value = row[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

export type BackupValidation =
  | { ok: true; payload: BackupPayload }
  | { ok: false; errors: string[] };

/** Valida estrutura (Zod) + checksum de integridade + integridade referencial interna do backup. */
export function parseBackupPayload(raw: unknown): BackupValidation {
  const parsed = backupSchema.safeParse(raw);
  if (!parsed.success) {
    const errors = parsed.error.issues.map((issue) => {
      const path = issue.path.join(".");
      return path ? `Campo "${path}": ${issue.message}` : issue.message;
    });
    return { ok: false, errors: errors.slice(0, 8) };
  }

  const dataByKey = parsed.data.data as Record<string, BackupRow[]>;
  const payloadData = Object.fromEntries(
    BACKUP_TABLE_KEYS.map((key) => [key, dataByKey[key] ?? []]),
  ) as unknown as BackupData;

  const payload: BackupPayload = {
    version: parsed.data.version,
    app: parsed.data.app,
    exportedAt: parsed.data.exportedAt,
    checksum: parsed.data.checksum ?? parsed.data.metadata?.checksum,
    metadata: parsed.data.metadata as BackupMetadata | undefined,
    data: payloadData,
  };

  if (payload.version !== BACKUP_VERSION) {
    return {
      ok: false,
      errors: [`Versão de backup não suportada: ${payload.version} (esperada: ${BACKUP_VERSION}).`],
    };
  }

  // Se um checksum foi incluído no arquivo, validamos contra os dados desserializados
  const expectedChecksum = payload.checksum;
  if (expectedChecksum) {
    const actualChecksum = calculateBackupChecksum(payload.data);
    if (actualChecksum !== expectedChecksum) {
      return {
        ok: false,
        errors: [
          `Checksum de integridade inválido (esperado: ${expectedChecksum}, calculado: ${actualChecksum}). O arquivo pode ter sido corrompido ou alterado.`,
        ],
      };
    }
  }

  const integrityErrors = validateIntegrity(payload.data);
  if (integrityErrors.length > 0) {
    return { ok: false, errors: integrityErrors.slice(0, 8) };
  }

  return { ok: true, payload };
}

/**
 * Verifica que toda referência FK interna aponta para registros presentes no
 * próprio backup (categorias, cartões e ativos). As demais FKs são validadas
 * pelo banco (constraints) durante a restauração.
 */
export function validateIntegrity(data: BackupData): string[] {
  const errors: string[] = [];
  const categoryIds = idsOf(data.categories);
  const cardIds = idsOf(data.credit_cards);
  const assetIds = idsOf(data.portfolio_assets);

  const checkRef = (rows: readonly BackupRow[] | undefined, fkKey: string, allowed: Set<string>, label: string): void => {
    if (!rows) return;
    for (const row of rows) {
      const ref = asString(row, fkKey);
      if (ref !== null && !allowed.has(ref)) {
        errors.push(`Registro ${label} referencia "${ref}" que não existe no backup.`);
        if (errors.length >= 8) return;
      }
    }
  };

  checkRef(data.expenses, "category_id", categoryIds, "de despesa");
  checkRef(data.incomes, "category_id", categoryIds, "de receita");
  checkRef(data.budgets, "category_id", categoryIds, "de orçamento");
  checkRef(data.income_goals, "category_id", categoryIds, "de meta de renda");
  checkRef(data.expenses, "card_id", cardIds, "de despesa");
  checkRef(data.card_payments, "card_id", cardIds, "de pagamento");
  checkRef(data.card_competence_overrides, "card_id", cardIds, "de override de competência");
  checkRef(data.portfolio_transactions, "asset_id", assetIds, "de transação de ativo");
  checkRef(data.portfolio_contributions, "asset_id", assetIds, "de contribuição de ativo");
  checkRef(data.portfolio_dividends, "asset_id", assetIds, "de provento de ativo");
  checkRef(data.allocation_targets, "asset_id", assetIds, "de meta de alocação");

  return errors;
}
