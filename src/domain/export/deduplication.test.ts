import { describe, expect, it } from "vitest";
import type { BackupData } from "./backup";
import {
  analyzeBackupDuplicates,
  applyDeduplicationStrategy,
  isRecordDuplicate,
  RESTORE_MODULES,
} from "./deduplication";

function makeEmptyData(): BackupData {
  return {
    categories: [],
    credit_cards: [],
    card_competence_overrides: [],
    incomes: [],
    expenses: [],
    card_payments: [],
    debts: [],
    budgets: [],
    income_goals: [],
    insight_feedback: [],
    reminder_states: [],
    portfolio_assets: [],
    portfolio_transactions: [],
    portfolio_snapshots: [],
    portfolio_contributions: [],
    portfolio_dividends: [],
    allocation_targets: [],
    class_targets: [],
    sector_targets: [],
    asset_prices: [],
    cash_checkpoints: [],
    user_preferences: [],
  };
}

describe("domain/export/deduplication — detecção e estratégias", () => {
  it("define os módulos canônicos de restauração", () => {
    expect(RESTORE_MODULES.length).toBe(6);
    const keys = RESTORE_MODULES.map((m) => m.key);
    expect(keys).toEqual([
      "categories",
      "cards",
      "transactions",
      "debts",
      "budgets",
      "investments",
    ]);
  });

  describe("isRecordDuplicate", () => {
    it("detecta duplicata por ID idêntico", () => {
      expect(
        isRecordDuplicate(
          "expenses",
          { id: "e1", value: 100, date: "2026-08-01", description: "Luz" },
          { id: "e1", value: 50, date: "2026-08-02", description: "Água" },
        ),
      ).toBe(true);
    });

    it("detecta despesa duplicada por chave natural (data, valor e descrição)", () => {
      expect(
        isRecordDuplicate(
          "expenses",
          { id: "b1", value: 150.5, date: "2026-08-10T12:00:00Z", description: " Supermercado " },
          { id: "e1", value: "150.50", date: "2026-08-10", description: "supermercado" },
        ),
      ).toBe(true);
    });

    it("diferencia despesas com datas ou valores distintos", () => {
      expect(
        isRecordDuplicate(
          "expenses",
          { id: "b1", value: 150.5, date: "2026-08-10", description: "Supermercado" },
          { id: "e1", value: 150.5, date: "2026-08-11", description: "Supermercado" },
        ),
      ).toBe(false);
    });

    it("detecta categoria duplicada por nome e tipo", () => {
      expect(
        isRecordDuplicate(
          "categories",
          { id: "c1", name: "Moradia", type: "expense" },
          { id: "c2", name: "  moradia ", type: "expense" },
        ),
      ).toBe(true);

      // Tipos diferentes não são duplicatas
      expect(
        isRecordDuplicate(
          "categories",
          { id: "c1", name: "Moradia", type: "expense" },
          { id: "c2", name: "Moradia", type: "income" },
        ),
      ).toBe(false);
    });

    it("detecta ativo duplicado por ticker", () => {
      expect(
        isRecordDuplicate(
          "portfolio_assets",
          { id: "a1", ticker: "petr4" },
          { id: "a2", ticker: "PETR4" },
        ),
      ).toBe(true);
    });
  });

  describe("analyzeBackupDuplicates", () => {
    it("analisa dados identificando contagens de novos e duplicados por módulo", () => {
      const backup = makeEmptyData();
      backup.categories = [
        { id: "c1", name: "Alimentação", type: "expense" },
        { id: "c2", name: "Transporte", type: "expense" },
      ];
      backup.expenses = [
        { id: "e1", date: "2026-08-01", value: 50, description: "Padaria" },
        { id: "e2", date: "2026-08-02", value: 100, description: "Combustível" },
      ];

      const existing = makeEmptyData();
      existing.categories = [{ id: "c-old", name: "alimentação", type: "expense" }];
      existing.expenses = [{ id: "e-old", date: "2026-08-01", value: 50, description: "padaria" }];

      const analysis = analyzeBackupDuplicates(backup, existing);
      expect(analysis.totalBackupRecords).toBe(4);
      expect(analysis.totalDuplicates).toBe(2);
      expect(analysis.totalNewRecords).toBe(2);

      expect(analysis.byModule.categories.duplicateCount).toBe(1);
      expect(analysis.byModule.categories.newCount).toBe(1);
      expect(analysis.byModule.transactions.duplicateCount).toBe(1);
      expect(analysis.byModule.transactions.newCount).toBe(1);
    });
  });

  describe("applyDeduplicationStrategy", () => {
    it("estratégia 'wipe_all' substitui tudo nas tabelas selecionadas", () => {
      const backup = makeEmptyData();
      backup.categories = [{ id: "c1", name: "Alimentação", type: "expense" }];
      const existing = makeEmptyData();
      existing.categories = [{ id: "c-old", name: "Antiga", type: "expense" }];

      const result = applyDeduplicationStrategy({
        backupData: backup,
        existingData: existing,
        selectedModules: new Set(["categories"]),
        strategy: "wipe_all",
      });

      expect(result.finalData.categories).toHaveLength(1);
      expect(result.finalData.categories[0]?.name).toBe("Alimentação");
      expect(result.summary.totalToInsert).toBe(1);
    });

    it("estratégia 'skip' preserva existentes e adiciona apenas novos", () => {
      const backup = makeEmptyData();
      backup.expenses = [
        { id: "b1", date: "2026-08-01", value: 50, description: "Luz" }, // Duplicada
        { id: "b2", date: "2026-08-02", value: 80, description: "Internet" }, // Nova
      ];
      const existing = makeEmptyData();
      existing.expenses = [
        { id: "e1", date: "2026-08-01", value: 50, description: "Luz" },
      ];

      const result = applyDeduplicationStrategy({
        backupData: backup,
        existingData: existing,
        selectedModules: new Set(["transactions"]),
        strategy: "skip",
      });

      expect(result.finalData.expenses).toHaveLength(2);
      expect(result.summary.totalToInsert).toBe(1);
      expect(result.summary.totalToSkip).toBe(1);
      expect(result.finalData.expenses.some((e) => e.description === "Internet")).toBe(true);
      expect(result.finalData.expenses.filter((e) => e.description === "Luz")).toHaveLength(1);
    });

    it("estratégia 'overwrite' atualiza registros duplicados existentes com novos valores", () => {
      const backup = makeEmptyData();
      backup.expenses = [
        { id: "b1", date: "2026-08-01", value: 50, description: "Luz", notes: "Atualizado pelo backup" },
      ];
      const existing = makeEmptyData();
      existing.expenses = [
        { id: "e1", date: "2026-08-01", value: 50, description: "Luz", notes: "Antigo" },
      ];

      const result = applyDeduplicationStrategy({
        backupData: backup,
        existingData: existing,
        selectedModules: new Set(["transactions"]),
        strategy: "overwrite",
      });

      expect(result.finalData.expenses).toHaveLength(1);
      expect(result.finalData.expenses[0]?.notes).toBe("Atualizado pelo backup");
      expect(result.summary.totalToUpdate).toBe(1);
      expect(result.summary.totalToInsert).toBe(0);
    });

    it("estratégia 'keep_both' gera novos IDs e mantém ambos os registros sem colisão", () => {
      const backup = makeEmptyData();
      backup.categories = [{ id: "cat-1", name: "Lazer", type: "expense" }];
      backup.expenses = [
        { id: "exp-1", category_id: "cat-1", date: "2026-08-01", value: 100, description: "Cinema" },
      ];

      const existing = makeEmptyData();
      existing.categories = [{ id: "cat-old", name: "Lazer", type: "expense" }];
      existing.expenses = [
        { id: "exp-old", category_id: "cat-old", date: "2026-08-01", value: 100, description: "Cinema" },
      ];

      const result = applyDeduplicationStrategy({
        backupData: backup,
        existingData: existing,
        selectedModules: new Set(["categories", "transactions"]),
        strategy: "keep_both",
      });

      // Duas categorias Lazer mantidas, com IDs distintos
      expect(result.finalData.categories).toHaveLength(2);
      expect(result.finalData.expenses).toHaveLength(2);

      const newCat = result.finalData.categories.find((c) => c.id !== "cat-old");
      expect(newCat).toBeDefined();
      expect(newCat?.id).not.toBe("cat-1"); // ID remapeado

      // FK de expense remapeada para apontar para a nova categoria
      const newExp = result.finalData.expenses.find((e) => e.id !== "exp-old");
      expect(newExp?.category_id).toBe(newCat?.id);
    });
  });
});
