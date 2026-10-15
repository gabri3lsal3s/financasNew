/**
 * Motor de desduplicação e restauração modular de backup (F22).
 *
 * Funções 100% puras (sem React/Supabase) para:
 *   1. Mapeamento granular de módulos do sistema;
 *   2. Identificação de registros duplicados por chaves naturais e IDs;
 *   3. Aplicação das estratégias de desduplicação (skip, overwrite, keep_both, wipe_all).
 */

import type { BackupData, BackupRow, BackupTableKey } from "./backup";
import { BACKUP_TABLE_KEYS } from "./backup";

export type RestoreModuleKey =
  | "categories"
  | "cards"
  | "transactions"
  | "debts"
  | "budgets"
  | "investments";

export interface RestoreModuleMeta {
  key: RestoreModuleKey;
  label: string;
  description: string;
  iconName: string;
  tables: readonly BackupTableKey[];
}

export const RESTORE_MODULES: readonly RestoreModuleMeta[] = [
  {
    key: "categories",
    label: "Categorias & Preferências",
    description: "Estrutura de categorias de receitas/despesas e configurações da conta.",
    iconName: "FolderTree",
    tables: ["categories", "user_preferences", "insight_feedback", "reminder_states"],
  },
  {
    key: "cards",
    label: "Cartões de Crédito",
    description: "Cartões cadastrados, histórico de faturas pagas e ajustes de competência.",
    iconName: "CreditCard",
    tables: ["credit_cards", "card_payments", "card_competence_overrides"],
  },
  {
    key: "transactions",
    label: "Transações Financeiras",
    description: "Lançamentos de despesas, receitas, parcelamentos e compras no cartão.",
    iconName: "ArrowLeftRight",
    tables: ["expenses", "incomes"],
  },
  {
    key: "debts",
    label: "Dívidas & Empréstimos",
    description: "Contas a pagar, valores a receber e contratos de financiamento.",
    iconName: "Receipt",
    tables: ["debts"],
  },
  {
    key: "budgets",
    label: "Orçamentos & Metas",
    description: "Limites de gastos mensais por categoria e metas de rendimentos.",
    iconName: "Target",
    tables: ["budgets", "income_goals"],
  },
  {
    key: "investments",
    label: "Investimentos & Carteira",
    description: "Ativos, histórico de ordens, proventos, aportes e metas de alocação.",
    iconName: "TrendingUp",
    tables: [
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
    ],
  },
] as const;

export type DeduplicationStrategy = "skip" | "overwrite" | "keep_both" | "wipe_all";

export interface DuplicateCandidate {
  id: string;
  table: BackupTableKey;
  module: RestoreModuleKey;
  identifier: string;
  backupRecord: BackupRow;
  existingRecord?: BackupRow;
}

export interface ModuleDeduplicationSummary {
  module: RestoreModuleKey;
  label: string;
  backupCount: number;
  existingCount: number;
  duplicateCount: number;
  newCount: number;
  candidates: DuplicateCandidate[];
}

export interface DeduplicationAnalysis {
  totalBackupRecords: number;
  totalDuplicates: number;
  totalNewRecords: number;
  byModule: Record<RestoreModuleKey, ModuleDeduplicationSummary>;
}

export interface RestoreExecutionSummary {
  strategy: DeduplicationStrategy;
  selectedModules: RestoreModuleKey[];
  totalToInsert: number;
  totalToUpdate: number;
  totalToSkip: number;
  countsByTable: Record<string, number>;
}

function normalizeStr(val: unknown): string {
  return String(val ?? "").trim().toLowerCase();
}

function normalizeAmountCents(val: unknown): number {
  if (typeof val === "number") return Math.round(val * 100);
  const parsed = Number(val);
  return Number.isNaN(parsed) ? 0 : Math.round(parsed * 100);
}

/**
 * Avalia se um registro de backup é considerado duplicata de um registro existente.
 */
export function isRecordDuplicate(
  table: BackupTableKey,
  backup: BackupRow,
  existing: BackupRow,
): boolean {
  // 1. Identificador único idêntico
  if (backup.id && existing.id && String(backup.id) === String(existing.id)) {
    return true;
  }

  // 2. Chaves naturais semânticas por tabela
  switch (table) {
    case "categories":
      return (
        normalizeStr(backup.name) === normalizeStr(existing.name) &&
        normalizeStr(backup.type) === normalizeStr(existing.type)
      );

    case "credit_cards":
      return normalizeStr(backup.name) === normalizeStr(existing.name);

    case "expenses":
    case "incomes":
      return (
        String(backup.date ?? "").slice(0, 10) === String(existing.date ?? "").slice(0, 10) &&
        normalizeAmountCents(backup.value) === normalizeAmountCents(existing.value) &&
        normalizeStr(backup.description) === normalizeStr(existing.description)
      );

    case "debts":
      return (
        normalizeStr(backup.name) === normalizeStr(existing.name) &&
        String(backup.due_date ?? "").slice(0, 10) === String(existing.due_date ?? "").slice(0, 10) &&
        normalizeAmountCents(backup.amount) === normalizeAmountCents(existing.amount)
      );

    case "budgets":
      return (
        String(backup.month ?? "").slice(0, 7) === String(existing.month ?? "").slice(0, 7) &&
        String(backup.category_id ?? "") === String(existing.category_id ?? "")
      );

    case "income_goals":
      return (
        String(backup.month ?? "").slice(0, 7) === String(existing.month ?? "").slice(0, 7) &&
        String(backup.category_id ?? "") === String(existing.category_id ?? "")
      );

    case "portfolio_assets":
      return normalizeStr(backup.ticker) === normalizeStr(existing.ticker);

    case "portfolio_transactions":
      return (
        String(backup.asset_id ?? "") === String(existing.asset_id ?? "") &&
        String(backup.date ?? "").slice(0, 10) === String(existing.date ?? "").slice(0, 10) &&
        normalizeStr(backup.type) === normalizeStr(existing.type) &&
        Number(backup.quantity ?? 0) === Number(existing.quantity ?? 0) &&
        normalizeAmountCents(backup.price) === normalizeAmountCents(existing.price)
      );

    case "portfolio_snapshots":
      return String(backup.month ?? "").slice(0, 7) === String(existing.month ?? "").slice(0, 7);

    case "portfolio_dividends":
      return (
        String(backup.asset_id ?? "") === String(existing.asset_id ?? "") &&
        String(backup.date ?? "").slice(0, 10) === String(existing.date ?? "").slice(0, 10) &&
        normalizeAmountCents(backup.amount) === normalizeAmountCents(existing.amount)
      );

    case "portfolio_contributions":
      return (
        String(backup.date ?? "").slice(0, 10) === String(existing.date ?? "").slice(0, 10) &&
        normalizeAmountCents(backup.amount) === normalizeAmountCents(existing.amount)
      );

    case "allocation_targets":
      return String(backup.asset_id ?? "") === String(existing.asset_id ?? "");

    case "user_preferences":
      return true; // Preferências do usuário: se já existe, é o mesmo registro

    default:
      return false;
  }
}

function buildRecordIdentifier(table: BackupTableKey, row: BackupRow): string {
  switch (table) {
    case "categories":
      return `${String(row.name || "Sem nome")} (${String(row.type === "income" ? "Receita" : "Despesa")})`;
    case "credit_cards":
      return `${String(row.name || "Sem nome")} (Cartão)`;
    case "expenses":
    case "incomes":
      return `${String(row.description || "Lançamento")} · ${String(row.date || "").slice(0, 10)} · R$ ${Number(row.value ?? 0).toFixed(2)}`;
    case "debts":
      return `${String(row.name || "Dívida")} · Vencimento ${String(row.due_date || "").slice(0, 10)} · R$ ${Number(row.amount ?? 0).toFixed(2)}`;
    case "budgets":
    case "income_goals":
      return `Mês ${String(row.month || "")}`;
    case "portfolio_assets":
      return `${String(row.ticker || "")} (${String(row.asset_class || "Ativo")})`;
    case "portfolio_transactions":
      return `${String(row.type || "").toUpperCase()} · ${String(row.date || "").slice(0, 10)} · Qtd: ${String(row.quantity ?? "")}`;
    default:
      return `${table} #${String(row.id ?? "").slice(0, 8)}`;
  }
}

/**
 * Analisa os dados do backup em comparação com os dados atuais do usuário,
 * identificando duplicados e novos registros por módulo.
 */
export function analyzeBackupDuplicates(
  backupData: BackupData,
  existingData: Partial<BackupData> = {},
): DeduplicationAnalysis {
  let totalBackupRecords = 0;
  let totalDuplicates = 0;
  let totalNewRecords = 0;

  const byModule = {} as Record<RestoreModuleKey, ModuleDeduplicationSummary>;

  for (const moduleMeta of RESTORE_MODULES) {
    let backupCount = 0;
    let existingCount = 0;
    let duplicateCount = 0;
    const candidates: DuplicateCandidate[] = [];

    for (const table of moduleMeta.tables) {
      const backupRows = (backupData[table] ?? []) as BackupRow[];
      const existingRows = (existingData[table] ?? []) as BackupRow[];

      backupCount += backupRows.length;
      existingCount += existingRows.length;

      for (const bRow of backupRows) {
        const matched = existingRows.find((eRow) => isRecordDuplicate(table, bRow, eRow));
        if (matched) {
          duplicateCount++;
          candidates.push({
            id: String(bRow.id ?? Math.random().toString()),
            table,
            module: moduleMeta.key,
            identifier: buildRecordIdentifier(table, bRow),
            backupRecord: bRow,
            existingRecord: matched,
          });
        }
      }
    }

    const newCount = Math.max(0, backupCount - duplicateCount);
    totalBackupRecords += backupCount;
    totalDuplicates += duplicateCount;
    totalNewRecords += newCount;

    byModule[moduleMeta.key] = {
      module: moduleMeta.key,
      label: moduleMeta.label,
      backupCount,
      existingCount,
      duplicateCount,
      newCount,
      candidates,
    };
  }

  return {
    totalBackupRecords,
    totalDuplicates,
    totalNewRecords,
    byModule,
  };
}

/**
 * Gera um ID único pseudo-aleatório seguro no formato UUIDv4 determinístico/aleatório.
 */
function generateNewUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Aplica a seleção de módulos e a estratégia de desduplicação aos dados de backup,
 * preparando os dados finais para restauração.
 */
export function applyDeduplicationStrategy({
  backupData,
  existingData = {},
  selectedModules,
  strategy,
}: {
  backupData: BackupData;
  existingData?: Partial<BackupData>;
  selectedModules: ReadonlySet<RestoreModuleKey>;
  strategy: DeduplicationStrategy;
}): {
  finalData: BackupData;
  summary: RestoreExecutionSummary;
} {
  const allowedTables = new Set<BackupTableKey>();
  for (const moduleMeta of RESTORE_MODULES) {
    if (selectedModules.has(moduleMeta.key)) {
      for (const t of moduleMeta.tables) {
        allowedTables.add(t);
      }
    }
  }

  let totalToInsert = 0;
  let totalToUpdate = 0;
  let totalToSkip = 0;
  const countsByTable: Record<string, number> = {};

  // Se a estratégia for "wipe_all", mantemos os registros originais das tabelas selecionadas
  if (strategy === "wipe_all") {
    const finalData = {} as BackupData;
    for (const key of BACKUP_TABLE_KEYS) {
      if (allowedTables.has(key)) {
        const rows = (backupData[key] ?? []) as BackupRow[];
        finalData[key] = rows;
        totalToInsert += rows.length;
        countsByTable[key] = rows.length;
      } else {
        // Tabelas não selecionadas: preserva os dados existentes
        const existingRows = (existingData[key] ?? []) as BackupRow[];
        finalData[key] = existingRows;
        countsByTable[key] = existingRows.length;
      }
    }

    return {
      finalData,
      summary: {
        strategy,
        selectedModules: Array.from(selectedModules),
        totalToInsert,
        totalToUpdate: 0,
        totalToSkip: 0,
        countsByTable,
      },
    };
  }

  // Mapa de remap de IDs para a estratégia "keep_both" (garante integridade de FKs entre pais e filhos)
  const idRemap = new Map<string, string>();

  // Primeiro passo no "keep_both": mapear novos IDs para registros pais duplicados (categorias, cartões, ativos)
  if (strategy === "keep_both") {
    const parentTables: BackupTableKey[] = ["categories", "credit_cards", "portfolio_assets"];
    for (const table of parentTables) {
      if (!allowedTables.has(table)) continue;
      const bRows = (backupData[table] ?? []) as BackupRow[];
      const eRows = (existingData[table] ?? []) as BackupRow[];

      for (const row of bRows) {
        const isDup = eRows.some((e) => isRecordDuplicate(table, row, e));
        if (isDup && row.id) {
          const oldId = String(row.id);
          const newId = generateNewUUID();
          idRemap.set(oldId, newId);
        }
      }
    }
  }

  const finalData = {} as BackupData;

  for (const table of BACKUP_TABLE_KEYS) {
    const existingRows = ((existingData[table] ?? []) as BackupRow[]).map((r) => ({ ...r }));
    if (!allowedTables.has(table)) {
      finalData[table] = existingRows;
      countsByTable[table] = existingRows.length;
      continue;
    }

    const backupRows = (backupData[table] ?? []) as BackupRow[];
    const mergedList: BackupRow[] = [...existingRows];
    let insertedInTable = 0;
    let updatedInTable = 0;
    let skippedInTable = 0;

    for (const bRow of backupRows) {
      const matchIndex = mergedList.findIndex((eRow) => isRecordDuplicate(table, bRow, eRow));

      if (matchIndex === -1) {
        // Não é duplicata: insere como novo
        const newRecord: BackupRow = { ...bRow };
        // Ajusta FKs se os pais foram remapeados
        if (strategy === "keep_both") {
          if (newRecord["category_id"] && idRemap.has(String(newRecord["category_id"]))) {
            newRecord["category_id"] = idRemap.get(String(newRecord["category_id"]));
          }
          if (newRecord["card_id"] && idRemap.has(String(newRecord["card_id"]))) {
            newRecord["card_id"] = idRemap.get(String(newRecord["card_id"]));
          }
          if (newRecord["asset_id"] && idRemap.has(String(newRecord["asset_id"]))) {
            newRecord["asset_id"] = idRemap.get(String(newRecord["asset_id"]));
          }
        }
        mergedList.push(newRecord);
        insertedInTable++;
      } else {
        // É duplicata
        if (strategy === "skip") {
          skippedInTable++;
        } else if (strategy === "overwrite") {
          // Substitui o registro existente mantendo o ID do existente se apropriado
          const existingId = mergedList[matchIndex]?.id ?? bRow.id;
          mergedList[matchIndex] = { ...bRow, id: existingId };
          updatedInTable++;
        } else if (strategy === "keep_both") {
          // Cria uma nova linha com novo ID
          const oldId = String(bRow.id ?? "");
          const newId = idRemap.get(oldId) ?? generateNewUUID();
          const clone: BackupRow = { ...bRow, id: newId };
          if (clone["category_id"] && idRemap.has(String(clone["category_id"]))) {
            clone["category_id"] = idRemap.get(String(clone["category_id"]));
          }
          if (clone["card_id"] && idRemap.has(String(clone["card_id"]))) {
            clone["card_id"] = idRemap.get(String(clone["card_id"]));
          }
          if (clone["asset_id"] && idRemap.has(String(clone["asset_id"]))) {
            clone["asset_id"] = idRemap.get(String(clone["asset_id"]));
          }
          mergedList.push(clone);
          insertedInTable++;
        }
      }
    }

    finalData[table] = mergedList;
    countsByTable[table] = mergedList.length;
    totalToInsert += insertedInTable;
    totalToUpdate += updatedInTable;
    totalToSkip += skippedInTable;
  }

  return {
    finalData,
    summary: {
      strategy,
      selectedModules: Array.from(selectedModules),
      totalToInsert,
      totalToUpdate,
      totalToSkip,
      countsByTable,
    },
  };
}
