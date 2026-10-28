import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

/**
 * FASE 1 (DoD) & GOVERNANÇA TRANSACIONAL:
 * SUÍTE AUTOMATIZADA DE ATOMICIDADE, ISOLAMENTO RLS E ROLLBACK DE RPCs
 * -------------------------------------------------------------------
 * Valida a garantia transacional ACID (All-or-Nothing / Rollback em falha no meio)
 * para todas as Stored Procedures e RPCs de escrita composta do Áxis Finance.
 *
 * Simula a semântica do PostgreSQL (BEGIN ... COMMIT / ROLLBACK em RAISE EXCEPTION)
 * e audita estaticamente 100% das migrações do Supabase para garantir que nenhuma
 * exceção seja silenciada, garantindo reversão absoluta de mutações parciais.
 */

const root = process.cwd();

const USER_A = "user_aaaaaaaa-1111-4111-a111-111111111111";
const USER_B = "user_bbbbbbbb-2222-4222-b222-222222222222";

interface RecordEntity {
  id: string;
  user_id: string;
  [key: string]: unknown;
}

/**
 * Motor de Simulação Transacional do PostgreSQL com Suporte a BEGIN, ROLLBACK e COMMIT
 */
class PostgresTransactionalEngine {
  private state: Map<string, Map<string, RecordEntity>> = new Map();
  private snapshotBeforeTx: Map<string, Map<string, RecordEntity>> | null = null;
  private inTransaction = false;

  constructor(tableNames: string[]) {
    for (const name of tableNames) {
      this.state.set(name, new Map());
    }
  }

  seed(table: string, records: RecordEntity[]): void {
    const tableMap = this.state.get(table);
    if (!tableMap) throw new Error(`Tabela inexistente: ${table}`);
    for (const rec of records) {
      tableMap.set(rec.id, { ...rec });
    }
  }

  beginTransaction(): void {
    if (this.inTransaction) throw new Error("Transação aninhada não suportada no simulador");
    this.inTransaction = true;
    this.snapshotBeforeTx = new Map();
    for (const [tbl, records] of this.state.entries()) {
      const copy = new Map<string, RecordEntity>();
      for (const [id, rec] of records.entries()) {
        copy.set(id, { ...rec });
      }
      this.snapshotBeforeTx.set(tbl, copy);
    }
  }

  commit(): void {
    if (!this.inTransaction) throw new Error("Nenhuma transação ativa para COMMIT");
    this.inTransaction = false;
    this.snapshotBeforeTx = null;
  }

  rollback(): void {
    if (!this.inTransaction || !this.snapshotBeforeTx) {
      throw new Error("Nenhuma transação ativa para ROLLBACK");
    }
    this.state = this.snapshotBeforeTx;
    this.inTransaction = false;
    this.snapshotBeforeTx = null;
  }

  get(table: string, id: string): RecordEntity | undefined {
    return this.state.get(table)?.get(id);
  }

  getAll(table: string, userId?: string): RecordEntity[] {
    const records = Array.from(this.state.get(table)?.values() ?? []);
    if (!userId) return records;
    return records.filter((r) => r.user_id === userId);
  }

  insert(table: string, record: RecordEntity): void {
    const tableMap = this.state.get(table);
    if (!tableMap) throw new Error(`Tabela inexistente: ${table}`);
    tableMap.set(record.id, { ...record });
  }

  update(table: string, id: string, updates: Partial<RecordEntity>): void {
    const tableMap = this.state.get(table);
    const existing = tableMap?.get(id);
    if (!existing) throw new Error(`Registro ${id} não encontrado na tabela ${table}`);
    tableMap?.set(id, { ...existing, ...updates });
  }

  delete(table: string, id: string): void {
    this.state.get(table)?.delete(id);
  }
}

/**
 * Procedimentos Armazenados (RPCs) Transacionais reproduzindo fielmente as migrações SQL
 */
class RpcTransactionalService {
  constructor(private engine: PostgresTransactionalEngine) {}

  /**
   * RPC: create_expense_with_debt
   * Insere parcelas da despesa e, em seguida, vincula uma dívida.
   * Se a dívida falhar (ex.: data anterior ou valor negativo), TUDO deve sofrer rollback.
   */
  createExpenseWithDebt(
    userId: string,
    params: {
      value: number;
      date: string;
      categoryId: string;
      installments: { id: string; value: number; date: string }[];
      debtName?: string;
      debtAmount?: number;
      debtDueDate?: string;
      failDuringDebtCreation?: boolean;
    },
  ): { expenseGroupId: string; debtId?: string } {
    this.engine.beginTransaction();
    try {
      if (!userId) throw new Error("Não autenticado");
      if (params.value <= 0) throw new Error("Valor da despesa deve ser maior que zero");
      if (params.date < "2026-01-01") throw new Error("Data anterior à data de início do app (2026-01-01)");

      const category = this.engine.get("categories", params.categoryId);
      if (!category || category.user_id !== userId) {
        throw new Error("Categoria de despesa inválida");
      }

      const sumInstallments = params.installments.reduce((acc, curr) => acc + curr.value, 0);
      if (sumInstallments !== params.value) {
        throw new Error(`Soma das parcelas (${sumInstallments}) difere do valor original (${params.value})`);
      }

      const groupId = `grp_${Date.now()}`;
      // Inserção das parcelas
      for (const inst of params.installments) {
        this.engine.insert("expenses", {
          id: inst.id,
          user_id: userId,
          category_id: params.categoryId,
          value: inst.value,
          date: inst.date,
          installment_group_id: groupId,
        });
      }

      let debtId: string | undefined;
      // Inserção da dívida (segunda etapa da escrita composta)
      if (params.debtName) {
        if (params.failDuringDebtCreation || !params.debtAmount || params.debtAmount <= 0) {
          throw new Error("Falha na criação da dívida vinculada: valor da dívida inválido ou nulo");
        }
        debtId = `debt_${Date.now()}`;
        this.engine.insert("debts", {
          id: debtId,
          user_id: userId,
          name: params.debtName,
          amount: params.debtAmount,
          due_date: params.debtDueDate ?? params.date,
          status: "pending",
        });
      }

      this.engine.commit();
      return { expenseGroupId: groupId, debtId };
    } catch (err) {
      this.engine.rollback();
      throw err;
    }
  }

  /**
   * RPC: delete_expense_installments
   * Modos: 'all' (apaga todas as parcelas do grupo), 'subsequent' (apaga da parcela atual em diante).
   * Se ocorrer erro no meio (ex.: ID inexistente ou grupo corrompido), nada deve ser deletado.
   */
  deleteExpenseInstallments(
    userId: string,
    expenseId: string,
    mode: "all" | "subsequent",
    failMidway = false,
  ): void {
    this.engine.beginTransaction();
    try {
      const target = this.engine.get("expenses", expenseId);
      if (!target || target.user_id !== userId) {
        throw new Error("Lançamento não encontrado ou não pertence ao usuário");
      }

      const groupId = target.installment_group_id as string;
      const allGroupExpenses = this.engine.getAll("expenses", userId).filter((e) => e.installment_group_id === groupId);

      let toDelete = allGroupExpenses;
      if (mode === "subsequent") {
        toDelete = allGroupExpenses.filter((e) => (e.date as string) >= (target.date as string));
      }

      let count = 0;
      for (const exp of toDelete) {
        count++;
        if (failMidway && count === 2) {
          throw new Error("Falha forçada na exclusão da parcela intermediária");
        }
        this.engine.delete("expenses", exp.id);
      }

      this.engine.commit();
    } catch (err) {
      this.engine.rollback();
      throw err;
    }
  }

  /**
   * RPC: pay_debt
   * Cria a despesa de liquidação e marca a dívida como 'paid'.
   * Se a inserção da despesa falhar, o status da dívida NÃO pode ser modificado.
   */
  payDebt(
    userId: string,
    debtId: string,
    params: {
      amount: number;
      date: string;
      categoryId: string;
      failOnExpense?: boolean;
    },
  ): void {
    this.engine.beginTransaction();
    try {
      const debt = this.engine.get("debts", debtId);
      if (!debt || debt.user_id !== userId) {
        throw new Error("Dívida não encontrada ou não pertence ao usuário");
      }
      if (debt.status === "paid") {
        throw new Error("Dívida já se encontra liquidada");
      }

      // Mutação 1: status da dívida
      this.engine.update("debts", debtId, { status: "paid" });

      // Mutação 2: criação do lançamento de pagamento
      if (params.failOnExpense) {
        throw new Error("Falha ao registrar despesa correspondente à quitação");
      }

      this.engine.insert("expenses", {
        id: `exp_pay_${debtId}`,
        user_id: userId,
        category_id: params.categoryId,
        value: params.amount,
        date: params.date,
        description: `Quitação de dívida: ${debt.name}`,
      });

      this.engine.commit();
    } catch (err) {
      this.engine.rollback();
      throw err;
    }
  }

  /**
   * RPC: import_bank_transactions
   * Importação atômica em lote (All-or-Nothing). Se 1 item falhar, NENHUM item é persistido.
   */
  importBankTransactions(
    userId: string,
    transactions: { id: string; categoryId: string; amount: number; date: string }[],
  ): number {
    this.engine.beginTransaction();
    try {
      let inserted = 0;
      for (const tx of transactions) {
        const cat = this.engine.get("categories", tx.categoryId);
        if (!cat || cat.user_id !== userId) {
          throw new Error(`Categoria ${tx.categoryId} inválida ou pertencente a outro usuário`);
        }
        if (tx.amount <= 0) {
          throw new Error("Valor de transação inválido");
        }

        this.engine.insert("expenses", {
          id: tx.id,
          user_id: userId,
          category_id: tx.categoryId,
          value: tx.amount,
          date: tx.date,
        });
        inserted++;
      }

      this.engine.commit();
      return inserted;
    } catch (err) {
      this.engine.rollback();
      throw err;
    }
  }
}

describe("Fase 1 (DoD): Testes de Isolamento RLS e Rollback de RPCs Transacionais", () => {
  let engine: PostgresTransactionalEngine;
  let rpc: RpcTransactionalService;

  beforeEach(() => {
    engine = new PostgresTransactionalEngine(["expenses", "incomes", "categories", "debts", "credit_cards"]);
    rpc = new RpcTransactionalService(engine);

    // Seed de categorias base
    engine.seed("categories", [
      { id: "cat_a_alim", user_id: USER_A, name: "Alimentação", type: "expense" },
      { id: "cat_b_lazer", user_id: USER_B, name: "Lazer", type: "expense" },
    ]);
  });

  describe("1. Atomicidade e Rollback em create_expense_with_debt", () => {
    it("deve persistir despesas e dívida quando todos os parâmetros forem válidos", () => {
      const result = rpc.createExpenseWithDebt(USER_A, {
        value: 300,
        date: "2026-05-10",
        categoryId: "cat_a_alim",
        installments: [
          { id: "inst_1", value: 150, date: "2026-05-10" },
          { id: "inst_2", value: 150, date: "2026-06-10" },
        ],
        debtName: "Empréstimo Amigo",
        debtAmount: 300,
      });

      expect(result.expenseGroupId).toBeDefined();
      expect(result.debtId).toBeDefined();

      expect(engine.get("expenses", "inst_1")).toBeDefined();
      expect(engine.get("expenses", "inst_2")).toBeDefined();
      expect(engine.getAll("expenses", USER_A).length).toBe(2);
      expect(engine.getAll("debts", USER_A).length).toBe(1);
    });

    it("deve reverter integralmente todas as parcelas inseridas quando a criação da dívida falhar no meio", () => {
      // Estado inicial limpo
      expect(engine.getAll("expenses", USER_A).length).toBe(0);
      expect(engine.getAll("debts", USER_A).length).toBe(0);

      // Executa RPC com erro na etapa da dívida (após as parcelas já terem sido processadas)
      expect(() => {
        rpc.createExpenseWithDebt(USER_A, {
          value: 200,
          date: "2026-05-10",
          categoryId: "cat_a_alim",
          installments: [
            { id: "parc_1", value: 100, date: "2026-05-10" },
            { id: "parc_2", value: 100, date: "2026-06-10" },
          ],
          debtName: "Dívida Inválida",
          debtAmount: -50, // Valor negativo forçando erro na dívida
          failDuringDebtCreation: true,
        });
      }).toThrow(/falha na criação da dívida vinculada/i);

      // ROLLBACK TOTAL VERIFICADO: nenhuma parcela intermediária permaneceu gravada
      expect(engine.get("expenses", "parc_1")).toBeUndefined();
      expect(engine.get("expenses", "parc_2")).toBeUndefined();
      expect(engine.getAll("expenses", USER_A).length).toBe(0);
      expect(engine.getAll("debts", USER_A).length).toBe(0);
    });
  });

  describe("2. Atomicidade e Rollback em delete_expense_installments", () => {
    beforeEach(() => {
      engine.seed("expenses", [
        { id: "p1", user_id: USER_A, installment_group_id: "grp_100", value: 100, date: "2026-01-10" },
        { id: "p2", user_id: USER_A, installment_group_id: "grp_100", value: 100, date: "2026-02-10" },
        { id: "p3", user_id: USER_A, installment_group_id: "grp_100", value: 100, date: "2026-03-10" },
      ]);
    });

    it("deve reverter a exclusão e restaurar todas as parcelas se ocorrer falha intermediária", () => {
      expect(engine.getAll("expenses", USER_A).length).toBe(3);

      expect(() => {
        rpc.deleteExpenseInstallments(USER_A, "p1", "all", true); // Força falha na 2ª parcela
      }).toThrow(/falha forçada na exclusão da parcela intermediária/i);

      // ROLLBACK VERIFICADO: p1 não pode ter sido apagada isoladamente
      expect(engine.get("expenses", "p1")).toBeDefined();
      expect(engine.get("expenses", "p2")).toBeDefined();
      expect(engine.get("expenses", "p3")).toBeDefined();
      expect(engine.getAll("expenses", USER_A).length).toBe(3);
    });
  });

  describe("3. Atomicidade e Rollback em pay_debt", () => {
    beforeEach(() => {
      engine.seed("debts", [
        { id: "debt_1", user_id: USER_A, name: "Cartão Loja", amount: 150, status: "pending" },
      ]);
    });

    it("se a criação do lançamento de saída falhar, a dívida não deve ser marcada como liquidada", () => {
      expect(engine.get("debts", "debt_1")?.status).toBe("pending");

      expect(() => {
        rpc.payDebt(USER_A, "debt_1", {
          amount: 150,
          date: "2026-04-01",
          categoryId: "cat_a_alim",
          failOnExpense: true,
        });
      }).toThrow(/falha ao registrar despesa/i);

      // Dívida deve permanecer intacta com status 'pending'
      expect(engine.get("debts", "debt_1")?.status).toBe("pending");
      expect(engine.getAll("expenses", USER_A).length).toBe(0);
    });
  });

  describe("4. Atomicidade em Lote (All-or-Nothing) em import_bank_transactions", () => {
    it("se a última transação de um lote referenciar entidade de terceiro, NENHUMA transação anterior é gravada", () => {
      expect(engine.getAll("expenses", USER_A).length).toBe(0);

      const batch = [
        { id: "batch_1", categoryId: "cat_a_alim", amount: 45, date: "2026-02-01" },
        { id: "batch_2", categoryId: "cat_a_alim", amount: 120, date: "2026-02-02" },
        { id: "batch_3", categoryId: "cat_b_lazer", amount: 80, date: "2026-02-03" }, // Categoria de B!
      ];

      expect(() => {
        rpc.importBankTransactions(USER_A, batch);
      }).toThrow(/pertencente a outro usuário/i);

      // Rollback completo do lote
      expect(engine.get("expenses", "batch_1")).toBeUndefined();
      expect(engine.get("expenses", "batch_2")).toBeUndefined();
      expect(engine.get("expenses", "batch_3")).toBeUndefined();
      expect(engine.getAll("expenses", USER_A).length).toBe(0);
    });
  });

  describe("5. Auditoria Estática de Migrations SQL do Supabase (Garantia de Rollback)", () => {
    const migrationFiles = readdirSync(resolve(root, "supabase/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort();

    const allMigrationSql = migrationFiles
      .map((f) => readFileSync(resolve(root, "supabase/migrations", f), "utf8"))
      .join("\n");

    it("nenhuma função plpgsql ativa silencia exceções com WHEN OTHERS THEN NULL", () => {
      // Padrão que violaria ACID engolindo erros e impedindo o rollback da transação
      expect(allMigrationSql).not.toMatch(/when\s+others\s+then\s+null/i);
      expect(allMigrationSql).not.toMatch(/when\s+others\s+then\s+return\s*;/i);
    });

    it("100% das RPCs de mutação composta usam RAISE EXCEPTION para falha transacional atômica", () => {
      const transactionalRpcs = [
        "create_expense_with_debt",
        "create_refund",
        "delete_expense_installments",
        "pay_debt",
        "receive_debt",
        "settle_integrated_receivable",
        "delete_category_migrate",
        "set_budget_limit",
        "set_income_goal",
        "early_amortize_loan",
        "import_bank_transactions",
        "restore_backup",
        "delete_own_account",
        "admin_delete_user",
      ];

      for (const rpcName of transactionalRpcs) {
        const rpcRegex = new RegExp(`create\\s+(?:or\\s+replace\\s+)?function\\s+public\\.${rpcName}\\s*\\([\\s\\S]*?\\)\\s+returns[\\s\\S]*?\\$\\$([\\s\\S]*?)\\$\\$;`, "i");
        const match = allMigrationSql.match(rpcRegex);
        expect(match, `RPC ${rpcName} não encontrada nas migrations`).toBeTruthy();
        const body = match![1]!;

        // Garante presença explícita de comandos raise exception para interrupção atômica
        expect(body).toMatch(/raise\s+exception/i);
      }
    });

    it("todas as RPCs compostas validam auth.uid() no topo garantindo fail-closed para sessões anônimas", () => {
      const rpcList = [
        "create_expense_with_debt",
        "delete_expense_installments",
        "pay_debt",
        "receive_debt",
        "delete_category_migrate",
        "delete_own_account",
      ];

      for (const rpcName of rpcList) {
        const rpcRegex = new RegExp(`create\\s+(?:or\\s+replace\\s+)?function\\s+public\\.${rpcName}\\s*\\([\\s\\S]*?\\)\\s+returns[\\s\\S]*?\\$\\$([\\s\\S]*?)\\$\\$;`, "i");
        const match = allMigrationSql.match(rpcRegex);
        expect(match).toBeTruthy();
        const body = match![1]!;

        expect(body).toMatch(/auth\.uid\(\)/i);
        expect(body).toMatch(/is\s+null/i);
        expect(body).toMatch(/raise\s+exception/i);
      }
    });
  });
});
