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
export const BACKUP_VERSION = 1;

export const APP_NAME = "Finanças Pessoais";

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
  "allocation_targets",
  "class_targets",
  "sector_targets",
  "asset_prices",
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
  allocation_targets: BackupRow[];
  class_targets: BackupRow[];
  sector_targets: BackupRow[];
  asset_prices: BackupRow[];
  user_preferences: BackupRow[];
}

export interface BackupPayload {
  version: number;
  app: string;
  exportedAt: string;
  data: BackupData;
}

/** Contagem de registros restaurados por tabela (retorno do RPC). */
export type RestoreSummary = Record<string, number>;

const rowSchema = z.record(z.string(), z.unknown());

const backupSchema = z.object({
  version: z.number().int().positive(),
  app: z.string(),
  exportedAt: z.string(),
  data: z.record(z.string(), rowSchema.array()).refine(
    (data) => BACKUP_TABLE_KEYS.every((key) => Array.isArray(data[key])),
    "Backup incompleto: faltam tabelas do formato.",
  ),
});

/** Monta o payload de backup a partir dos dados brutos (fetch RLS). */
export function buildBackupPayload(data: BackupData): BackupPayload {
  return {
    version: BACKUP_VERSION,
    app: APP_NAME,
    exportedAt: new Date().toISOString(),
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

/** Valida estrutura (Zod) + integridade referencial interna do backup. */
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
  const payload: BackupPayload = {
    version: parsed.data.version,
    app: parsed.data.app,
    exportedAt: parsed.data.exportedAt,
    data: Object.fromEntries(BACKUP_TABLE_KEYS.map((key) => [key, dataByKey[key] ?? []])) as unknown as BackupData,
  };
  if (payload.version !== BACKUP_VERSION) {
    return {
      ok: false,
      errors: [`Versão de backup não suportada: ${payload.version} (esperada: ${BACKUP_VERSION}).`],
    };
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

  const checkRef = (rows: readonly BackupRow[], fkKey: string, allowed: Set<string>, label: string): void => {
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
  checkRef(data.allocation_targets, "asset_id", assetIds, "de meta de alocação");

  return errors;
}
