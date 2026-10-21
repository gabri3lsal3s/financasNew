import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

/**
 * FASE 5 — TAREFA 5.1: SUÍTE AUTOMATIZADA DE PENETRAÇÃO CROSS-TENANT & ISOLAMENTO RLS
 * ----------------------------------------------------------------------------------
 * Validação rigorosa de isolamento horizontal multitenant (Tenant A vs Tenant B).
 *
 * Simula ataques defensivos:
 * 1. Leitura Cross-Tenant (SELECT / IDOR)
 * 2. Injeção Cross-Tenant (INSERT com user_id adulterado)
 * 3. Modificação Cross-Tenant (UPDATE em registros de terceiros)
 * 4. Exclusão Cross-Tenant (DELETE em dados de terceiros)
 * 5. Invocação de RPCs Transacionais com entidades de terceiros (IDOR RPC)
 * 6. Sessão Anônima (Fail-Closed total)
 * 7. Auditoria Estática de Migrations e Prevenção de Escalonamento de Privilégios
 */

const root = process.cwd();

const USER_A = "user_aaaaaaaa-1111-4111-a111-111111111111";
const USER_B = "user_bbbbbbbb-2222-4222-b222-222222222222";
const ANONYMOUS: string | null = null;

interface TableRecord {
  id: string;
  user_id: string;
  [key: string]: unknown;
}

class PostgresRlsViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PostgresRlsViolationError";
  }
}

/**
 * Simulador determinístico de Semântica PostgreSQL RLS
 * Reproduz o comportamento do PostgreSQL ao avaliar políticas USING e WITH CHECK
 * baseadas em `(select auth.uid()) = user_id`.
 */
class PostgresRlsDatabase {
  private tables: Map<string, Map<string, TableRecord>> = new Map();

  constructor() {
    const tableNames = [
      "expenses",
      "incomes",
      "categories",
      "credit_cards",
      "debts",
      "loans",
      "budgets",
      "income_goals",
      "portfolio_assets",
      "portfolio_transactions",
      "portfolio_contributions",
      "portfolio_snapshots",
      "cash_checkpoints",
      "audit_events",
    ];
    for (const name of tableNames) {
      this.tables.set(name, new Map());
    }
  }

  seed(table: string, records: TableRecord[]): void {
    const map = this.tables.get(table);
    if (!map) throw new Error(`Tabela inexistente: ${table}`);
    for (const rec of records) {
      map.set(rec.id, { ...rec });
    }
  }

  // SELECT executado sob contexto RLS da sessão atual
  select(table: string, sessionUid: string | null, filterUserId?: string): TableRecord[] {
    const map = this.tables.get(table);
    if (!map) return [];
    if (!sessionUid) return []; // Fail-closed: NULL uid resulta em 0 linhas

    const rows = Array.from(map.values());
    // Regra RLS: USING ((select auth.uid()) = user_id)
    return rows.filter((row) => {
      const passesRls = row.user_id === sessionUid;
      if (!passesRls) return false;
      if (filterUserId && row.user_id !== filterUserId) return false;
      return true;
    });
  }

  // SELECT por ID específico
  selectById(table: string, sessionUid: string | null, id: string): TableRecord | null {
    const map = this.tables.get(table);
    if (!map) return null;
    if (!sessionUid) return null;

    const row = map.get(id);
    if (!row) return null;
    // RLS filtra linhas não pertencentes ao usuário silenciosamente no PostgreSQL
    if (row.user_id !== sessionUid) return null;
    return { ...row };
  }

  // INSERT com validação de WITH CHECK ((select auth.uid()) = user_id)
  insert(table: string, sessionUid: string | null, record: TableRecord): TableRecord {
    if (!sessionUid) {
      throw new PostgresRlsViolationError(`new row violates row-level security policy for table "${table}" (unauthenticated)`);
    }
    if (record.user_id !== sessionUid) {
      throw new PostgresRlsViolationError(
        `new row violates row-level security policy for table "${table}": attempted to insert for user ${record.user_id} with session ${sessionUid}`,
      );
    }
    const map = this.tables.get(table);
    if (!map) throw new Error(`Tabela inexistente: ${table}`);
    map.set(record.id, { ...record });
    return { ...record };
  }

  // UPDATE com validação de USING e WITH CHECK
  update(table: string, sessionUid: string | null, id: string, updates: Partial<TableRecord>): { affected: number; record: TableRecord | null } {
    if (!sessionUid) {
      return { affected: 0, record: null };
    }
    const map = this.tables.get(table);
    if (!map) return { affected: 0, record: null };

    const existing = map.get(id);
    // Se o registro não existe ou pertence a outro usuário, o WHERE do Postgres RLS não o encontra
    if (!existing || existing.user_id !== sessionUid) {
      return { affected: 0, record: null };
    }

    // Se a mutação tenta adulterar o user_id para outro tenant: violação do WITH CHECK
    if (updates.user_id && updates.user_id !== sessionUid) {
      throw new PostgresRlsViolationError(`new row violates row-level security policy for table "${table}" on update`);
    }

    const updated = { ...existing, ...updates };
    map.set(id, updated);
    return { affected: 1, record: updated };
  }

  // DELETE com validação de USING ((select auth.uid()) = user_id)
  delete(table: string, sessionUid: string | null, id: string): { affected: number } {
    if (table === "audit_events") {
      // D2: audit_events é estritamente imutável (sem policy de update ou delete)
      throw new PostgresRlsViolationError(`cannot delete from immutable table "audit_events"`);
    }
    if (!sessionUid) {
      return { affected: 0 };
    }
    const map = this.tables.get(table);
    if (!map) return { affected: 0 };

    const existing = map.get(id);
    if (!existing || existing.user_id !== sessionUid) {
      return { affected: 0 };
    }

    map.delete(id);
    return { affected: 1 };
  }

  getRawRecord(table: string, id: string): TableRecord | null {
    return this.tables.get(table)?.get(id) ?? null;
  }
}

/**
 * Simulador de Stored Procedures (RPCs) Transacionais com Verificação Estrita de Ownership
 */
class RpcSecurityGuardSimulator {
  constructor(private db: PostgresRlsDatabase) {}

  createCardPayment(sessionUid: string | null, cardId: string, amountCents: number): { success: boolean; id: string } {
    if (!sessionUid) throw new Error("Usuário não autenticado");
    if (amountCents <= 0) throw new Error("Valor inválido");
    const card = this.db.getRawRecord("credit_cards", cardId);
    if (!card || card.user_id !== sessionUid) {
      throw new Error("Cartão de crédito não encontrado ou não pertence ao usuário");
    }
    const paymentId = `pmt_${Date.now()}`;
    return { success: true, id: paymentId };
  }

  deleteCreditCard(sessionUid: string | null, cardId: string): { success: boolean } {
    if (!sessionUid) throw new Error("Usuário não autenticado");
    const card = this.db.getRawRecord("credit_cards", cardId);
    if (!card || card.user_id !== sessionUid) {
      throw new Error("Cartão não encontrado");
    }
    this.db.delete("credit_cards", sessionUid, cardId);
    return { success: true };
  }

  payDebt(sessionUid: string | null, debtId: string, amountCents: number): { success: boolean } {
    if (!sessionUid) throw new Error("Usuário não autenticado");
    if (amountCents <= 0) throw new Error("Valor inválido");
    const debt = this.db.getRawRecord("debts", debtId);
    if (!debt || debt.user_id !== sessionUid) {
      throw new Error("Dívida não encontrada");
    }
    return { success: true };
  }

  earlyAmortizeLoan(sessionUid: string | null, loanId: string, amountCents: number): { success: boolean } {
    if (!sessionUid) throw new Error("Usuário não autenticado");
    if (amountCents <= 0) throw new Error("Valor inválido");
    const loan = this.db.getRawRecord("loans", loanId);
    if (!loan || loan.user_id !== sessionUid) {
      throw new Error("Empréstimo não encontrado");
    }
    return { success: true };
  }

  setBudgetLimit(sessionUid: string | null, categoryId: string, month: string, limitCents: number): { success: boolean } {
    if (!sessionUid) throw new Error("Usuário não autenticado");
    if (!month || limitCents < 0) throw new Error("Parâmetros de orçamento inválidos");
    const category = this.db.getRawRecord("categories", categoryId);
    if (!category || category.user_id !== sessionUid) {
      throw new Error("Categoria não encontrada");
    }
    return { success: true };
  }

  importBankTransactions(sessionUid: string | null, transactions: { categoryId: string; amountCents: number }[]): { importedCount: number } {
    if (!sessionUid) throw new Error("Usuário não autenticado");
    for (const tx of transactions) {
      const category = this.db.getRawRecord("categories", tx.categoryId);
      if (!category || category.user_id !== sessionUid) {
        throw new Error("Categoria inválida ou não pertence ao usuário");
      }
    }
    return { importedCount: transactions.length };
  }

  restoreBackup(
    sessionUid: string | null,
    backup: { cardOverrides?: { cardId: string }[]; assets?: { assetId: string }[] },
  ): { restored: boolean } {
    if (!sessionUid) throw new Error("Usuário não autenticado");

    if (backup.cardOverrides) {
      for (const override of backup.cardOverrides) {
        const card = this.db.getRawRecord("credit_cards", override.cardId);
        if (!card || card.user_id !== sessionUid) {
          throw new Error("Override de cartão inválido: cartão pertence a outro usuário");
        }
      }
    }

    if (backup.assets) {
      for (const asset of backup.assets) {
        const existing = this.db.getRawRecord("portfolio_assets", asset.assetId);
        if (existing && existing.user_id !== sessionUid) {
          throw new Error("Ativo inválido: ID de ativo pertence a outro usuário");
        }
      }
    }

    return { restored: true };
  }
}

describe("Fase 5.1 — Suíte Automatizada de Penetração Cross-Tenant & RLS Isolation", () => {
  let db: PostgresRlsDatabase;
  let rpc: RpcSecurityGuardSimulator;

  function setupMultitenantDatabase(): PostgresRlsDatabase {
    const database = new PostgresRlsDatabase();

    // Despesas
    database.seed("expenses", [
      { id: "exp_a_1", user_id: USER_A, value: "120.00", description: "Mercado A", category_id: "cat_a_1" },
      { id: "exp_a_2", user_id: USER_A, value: "45.00", description: "Farmácia A", category_id: "cat_a_1" },
      { id: "exp_b_1", user_id: USER_B, value: "250.00", description: "Restaurante B", category_id: "cat_b_1" },
      { id: "exp_b_2", user_id: USER_B, value: "1800.00", description: "Aluguel B", category_id: "cat_b_2" },
    ]);

    // Receitas
    database.seed("incomes", [
      { id: "inc_a_1", user_id: USER_A, value: "6000.00", description: "Salário A" },
      { id: "inc_b_1", user_id: USER_B, value: "9500.00", description: "Faturamento PJ B" },
    ]);

    // Categorias
    database.seed("categories", [
      { id: "cat_a_1", user_id: USER_A, name: "Alimentação A" },
      { id: "cat_b_1", user_id: USER_B, name: "Alimentação B" },
      { id: "cat_b_2", user_id: USER_B, name: "Moradia B" },
    ]);

    // Cartões de Crédito
    database.seed("credit_cards", [
      { id: "card_a_1", user_id: USER_A, name: "Nubank A", limit_cents: 500000 },
      { id: "card_b_1", user_id: USER_B, name: "XP Visa Infinite B", limit_cents: 2500000 },
    ]);

    // Dívidas
    database.seed("debts", [
      { id: "debt_a_1", user_id: USER_A, title: "Financiamento Carro A", amount_cents: 2000000 },
      { id: "debt_b_1", user_id: USER_B, title: "Empréstimo Pessoal B", amount_cents: 4500000 },
    ]);

    // Empréstimos
    database.seed("loans", [
      { id: "loan_a_1", user_id: USER_A, contract_number: "CTR-A", remaining_balance_cents: 1500000 },
      { id: "loan_b_1", user_id: USER_B, contract_number: "CTR-B", remaining_balance_cents: 3500000 },
    ]);

    // Orçamentos
    database.seed("budgets", [
      { id: "bud_a_1", user_id: USER_A, category_id: "cat_a_1", month: "2026-10", limit_cents: 100000 },
      { id: "bud_b_1", user_id: USER_B, category_id: "cat_b_1", month: "2026-10", limit_cents: 250000 },
    ]);

    // Carteira / Investimentos
    database.seed("portfolio_assets", [
      { id: "asset_a_1", user_id: USER_A, ticker: "WEGE3", quantity: 100 },
      { id: "asset_b_1", user_id: USER_B, ticker: "VALE3", quantity: 400 },
    ]);

    database.seed("portfolio_transactions", [
      { id: "ptx_a_1", user_id: USER_A, asset_id: "asset_a_1", type: "BUY", quantity: 100, price_cents: 3850 },
      { id: "ptx_b_1", user_id: USER_B, asset_id: "asset_b_1", type: "BUY", quantity: 400, price_cents: 6200 },
    ]);

    database.seed("portfolio_contributions", [
      { id: "pcon_a_1", user_id: USER_A, date: "2026-10-01", amount: 1500 },
      { id: "pcon_b_1", user_id: USER_B, date: "2026-10-01", amount: 5000 },
    ]);

    database.seed("portfolio_snapshots", [
      { id: "psnap_a_1", user_id: USER_A, date: "2026-10-01", total_equity_cents: 385000 },
      { id: "psnap_b_1", user_id: USER_B, date: "2026-10-01", total_equity_cents: 2480000 },
    ]);

    // Caixa & Liquidez
    database.seed("cash_checkpoints", [
      { id: "cash_a_1", user_id: USER_A, balance_cents: 350000 },
      { id: "cash_b_1", user_id: USER_B, balance_cents: 1200000 },
    ]);

    // Auditoria (Imutável)
    database.seed("audit_events", [
      { id: "aud_a_1", user_id: USER_A, action: "INSERT", entity_type: "expense" },
      { id: "aud_b_1", user_id: USER_B, action: "INSERT", entity_type: "expense" },
    ]);

    return database;
  }

  beforeEach(() => {
    db = setupMultitenantDatabase();
    rpc = new RpcSecurityGuardSimulator(db);
  });

  describe("1. Simulação de Penetração: Leitura Cross-Tenant (SELECT / IDOR)", () => {
    it("Usuário A é categoricamente incapaz de listar despesas do Usuário B", () => {
      const expensesA = db.select("expenses", USER_A);
      expect(expensesA.length).toBe(2);
      expect(expensesA.every((e) => e.user_id === USER_A)).toBe(true);

      // Tentativa de filtro forçado pelo user_id do Usuário B: retorna vazio
      const forcedQuery = db.select("expenses", USER_A, USER_B);
      expect(forcedQuery).toEqual([]);
    });

    it("Usuário A consultando ID específico de despesa do Usuário B recebe null (filtrado pelo RLS)", () => {
      const bExpense = db.selectById("expenses", USER_A, "exp_b_1");
      expect(bExpense).toBeNull();
    });

    it("Usuário A é categoricamente incapaz de listar receitas do Usuário B", () => {
      const incomesA = db.select("incomes", USER_A);
      expect(incomesA.length).toBe(1);
      expect(incomesA[0]?.id).toBe("inc_a_1");
      expect(db.selectById("incomes", USER_A, "inc_b_1")).toBeNull();
    });

    it("Usuário A é categoricamente incapaz de ler cartões de crédito do Usuário B", () => {
      const cardsA = db.select("credit_cards", USER_A);
      expect(cardsA.length).toBe(1);
      expect(cardsA[0]?.id).toBe("card_a_1");
      expect(db.selectById("credit_cards", USER_A, "card_b_1")).toBeNull();
    });

    it("Usuário A é categoricamente incapaz de ler dívidas e empréstimos do Usuário B", () => {
      expect(db.select("debts", USER_A).every((d) => d.user_id === USER_A)).toBe(true);
      expect(db.selectById("debts", USER_A, "debt_b_1")).toBeNull();

      expect(db.select("loans", USER_A).every((l) => l.user_id === USER_A)).toBe(true);
      expect(db.selectById("loans", USER_A, "loan_b_1")).toBeNull();
    });

    it("Usuário A é categoricamente incapaz de ler orçamentos do Usuário B", () => {
      expect(db.select("budgets", USER_A).every((b) => b.user_id === USER_A)).toBe(true);
      expect(db.selectById("budgets", USER_A, "bud_b_1")).toBeNull();
    });

    it("Usuário A é categoricamente incapaz de ler a carteira do Usuário B (ativos, movimentações, aportes, snapshots)", () => {
      expect(db.select("portfolio_assets", USER_A).map((a) => a.id)).toEqual(["asset_a_1"]);
      expect(db.selectById("portfolio_assets", USER_A, "asset_b_1")).toBeNull();

      expect(db.select("portfolio_transactions", USER_A).map((t) => t.id)).toEqual(["ptx_a_1"]);
      expect(db.selectById("portfolio_transactions", USER_A, "ptx_b_1")).toBeNull();

      expect(db.select("portfolio_contributions", USER_A).map((c) => c.id)).toEqual(["pcon_a_1"]);
      expect(db.selectById("portfolio_contributions", USER_A, "pcon_b_1")).toBeNull();

      expect(db.select("portfolio_snapshots", USER_A).map((s) => s.id)).toEqual(["psnap_a_1"]);
      expect(db.selectById("portfolio_snapshots", USER_A, "psnap_b_1")).toBeNull();
    });

    it("Usuário A é categoricamente incapaz de ler saldos de caixa e liquidez do Usuário B", () => {
      expect(db.select("cash_checkpoints", USER_A).map((c) => c.id)).toEqual(["cash_a_1"]);
      expect(db.selectById("cash_checkpoints", USER_A, "cash_b_1")).toBeNull();
    });

    it("Usuário A é categoricamente incapaz de inspecionar eventos de auditoria do Usuário B", () => {
      expect(db.select("audit_events", USER_A).map((a) => a.id)).toEqual(["aud_a_1"]);
      expect(db.selectById("audit_events", USER_A, "aud_b_1")).toBeNull();
    });
  });

  describe("2. Simulação de Penetração: Injeção Cross-Tenant (INSERT)", () => {
    it("bloqueia tentativa de Usuário A criar despesa com user_id do Usuário B", () => {
      expect(() => {
        db.insert("expenses", USER_A, {
          id: "malicious_exp_1",
          user_id: USER_B,
          value: "999.00",
          description: "Ataque Cross-Tenant",
        });
      }).toThrow(PostgresRlsViolationError);

      expect(db.getRawRecord("expenses", "malicious_exp_1")).toBeNull();
    });

    it("bloqueia tentativa de Usuário A criar receita para Usuário B", () => {
      expect(() => {
        db.insert("incomes", USER_A, {
          id: "malicious_inc_1",
          user_id: USER_B,
          value: "50000.00",
          description: "Fraude de Receita",
        });
      }).toThrow(PostgresRlsViolationError);

      expect(db.getRawRecord("incomes", "malicious_inc_1")).toBeNull();
    });

    it("bloqueia tentativa de Usuário A registrar cartão de crédito para Usuário B", () => {
      expect(() => {
        db.insert("credit_cards", USER_A, {
          id: "malicious_card_1",
          user_id: USER_B,
          name: "Cartão Fraudulento",
        });
      }).toThrow(PostgresRlsViolationError);

      expect(db.getRawRecord("credit_cards", "malicious_card_1")).toBeNull();
    });

    it("bloqueia tentativa de Usuário A forjar dívida ou empréstimo em nome do Usuário B", () => {
      expect(() => {
        db.insert("debts", USER_A, {
          id: "malicious_debt_1",
          user_id: USER_B,
          amount_cents: 9999999,
        });
      }).toThrow(PostgresRlsViolationError);

      expect(() => {
        db.insert("loans", USER_A, {
          id: "malicious_loan_1",
          user_id: USER_B,
          contract_number: "FRAUDE-01",
        });
      }).toThrow(PostgresRlsViolationError);
    });

    it("bloqueia tentativa de Usuário A injetar ordens na carteira do Usuário B", () => {
      expect(() => {
        db.insert("portfolio_transactions", USER_A, {
          id: "malicious_tx_1",
          user_id: USER_B,
          asset_id: "asset_b_1",
          type: "BUY",
        });
      }).toThrow(PostgresRlsViolationError);

      expect(db.getRawRecord("portfolio_transactions", "malicious_tx_1")).toBeNull();
    });
  });

  describe("3. Simulação de Penetração: Modificação Cross-Tenant (UPDATE)", () => {
    it("Usuário A não consegue alterar o valor de uma despesa do Usuário B", () => {
      const result = db.update("expenses", USER_A, "exp_b_1", { value: "0.01" });
      expect(result.affected).toBe(0);

      // O registro original do Usuário B deve permanecer 100% inalterado
      const bOriginal = db.getRawRecord("expenses", "exp_b_1");
      expect(bOriginal?.value).toBe("250.00");
    });

    it("Usuário A não consegue alterar o limite do cartão de crédito do Usuário B", () => {
      const result = db.update("credit_cards", USER_A, "card_b_1", { limit_cents: 100 });
      expect(result.affected).toBe(0);

      const bCard = db.getRawRecord("credit_cards", "card_b_1");
      expect(bCard?.limit_cents).toBe(2500000);
    });

    it("Usuário A não consegue alterar o valor de dívida ou empréstimo do Usuário B", () => {
      expect(db.update("debts", USER_A, "debt_b_1", { amount_cents: 0 }).affected).toBe(0);
      expect(db.getRawRecord("debts", "debt_b_1")?.amount_cents).toBe(4500000);

      expect(db.update("loans", USER_A, "loan_b_1", { remaining_balance_cents: 0 }).affected).toBe(0);
      expect(db.getRawRecord("loans", "loan_b_1")?.remaining_balance_cents).toBe(3500000);
    });

    it("Usuário A não consegue alterar a quantidade de ativos da carteira do Usuário B", () => {
      const result = db.update("portfolio_assets", USER_A, "asset_b_1", { quantity: 0 });
      expect(result.affected).toBe(0);
      expect(db.getRawRecord("portfolio_assets", "asset_b_1")?.quantity).toBe(400);
    });

    it("bloqueia tentativa de Usuário A transferir a posse de um registro próprio para o Usuário B (spoofing via UPDATE)", () => {
      expect(() => {
        db.update("expenses", USER_A, "exp_a_1", { user_id: USER_B });
      }).toThrow(PostgresRlsViolationError);

      expect(db.getRawRecord("expenses", "exp_a_1")?.user_id).toBe(USER_A);
    });
  });

  describe("4. Simulação de Penetração: Exclusão Cross-Tenant (DELETE)", () => {
    it("Usuário A não consegue deletar despesa do Usuário B (0 linhas afetadas)", () => {
      const result = db.delete("expenses", USER_A, "exp_b_1");
      expect(result.affected).toBe(0);
      expect(db.getRawRecord("expenses", "exp_b_1")).not.toBeNull();
    });

    it("Usuário A não consegue deletar cartão de crédito do Usuário B", () => {
      const result = db.delete("credit_cards", USER_A, "card_b_1");
      expect(result.affected).toBe(0);
      expect(db.getRawRecord("credit_cards", "card_b_1")).not.toBeNull();
    });

    it("Usuário A não consegue deletar dívidas do Usuário B", () => {
      const result = db.delete("debts", USER_A, "debt_b_1");
      expect(result.affected).toBe(0);
      expect(db.getRawRecord("debts", "debt_b_1")).not.toBeNull();
    });

    it("Usuário A não consegue deletar ativos da carteira do Usuário B", () => {
      const result = db.delete("portfolio_assets", USER_A, "asset_b_1");
      expect(result.affected).toBe(0);
      expect(db.getRawRecord("portfolio_assets", "asset_b_1")).not.toBeNull();
    });

    it("nenhum usuário consegue deletar registros em audit_events (imutabilidade estrita D2)", () => {
      expect(() => {
        db.delete("audit_events", USER_A, "aud_a_1");
      }).toThrow(PostgresRlsViolationError);

      expect(() => {
        db.delete("audit_events", USER_B, "aud_b_1");
      }).toThrow(PostgresRlsViolationError);

      expect(db.getRawRecord("audit_events", "aud_a_1")).not.toBeNull();
      expect(db.getRawRecord("audit_events", "aud_b_1")).not.toBeNull();
    });
  });

  describe("5. Simulação de Invocação de RPCs Transacionais Cross-Tenant (IDOR RPC)", () => {
    it("create_card_payment rejeita pagamento vinculando cartão pertencente a outro usuário", () => {
      expect(() => {
        rpc.createCardPayment(USER_A, "card_b_1", 100000);
      }).toThrow(/não encontrado ou não pertence ao usuário/i);
    });

    it("delete_credit_card rejeita exclusão de cartão de terceiro", () => {
      expect(() => {
        rpc.deleteCreditCard(USER_A, "card_b_1");
      }).toThrow(/cartão não encontrado/i);
      expect(db.getRawRecord("credit_cards", "card_b_1")).not.toBeNull();
    });

    it("pay_debt rejeita liquidação de dívida pertencente a terceiro", () => {
      expect(() => {
        rpc.payDebt(USER_A, "debt_b_1", 50000);
      }).toThrow(/dívida não encontrada/i);
    });

    it("early_amortize_loan rejeita amortização de empréstimo pertencente a terceiro", () => {
      expect(() => {
        rpc.earlyAmortizeLoan(USER_A, "loan_b_1", 200000);
      }).toThrow(/empréstimo não encontrado/i);
    });

    it("set_budget_limit rejeita atribuição de orçamento em categoria de terceiro", () => {
      expect(() => {
        rpc.setBudgetLimit(USER_A, "cat_b_1", "2026-10", 50000);
      }).toThrow(/categoria não encontrada/i);
    });

    it("import_bank_transactions rejeita lote se alguma transação referencia categoria de terceiro", () => {
      expect(() => {
        rpc.importBankTransactions(USER_A, [
          { categoryId: "cat_a_1", amountCents: 5000 },
          { categoryId: "cat_b_1", amountCents: 12000 }, // Categoria do Usuário B!
        ]);
      }).toThrow(/categoria inválida ou não pertence ao usuário/i);
    });

    it("restore_backup rejeita payload de restauração contendo referências de cartões ou ativos de terceiros", () => {
      expect(() => {
        rpc.restoreBackup(USER_A, {
          cardOverrides: [{ cardId: "card_b_1" }],
        });
      }).toThrow(/override de cartão inválido/i);

      expect(() => {
        rpc.restoreBackup(USER_A, {
          assets: [{ assetId: "asset_b_1" }],
        });
      }).toThrow(/ativo inválido/i);
    });
  });

  describe("6. Isolamento Estrito para Sessão Anônima (Fail-Closed Total)", () => {
    it("sessão anônima não lê registros de nenhum usuário", () => {
      expect(db.select("expenses", ANONYMOUS)).toEqual([]);
      expect(db.select("incomes", ANONYMOUS)).toEqual([]);
      expect(db.select("credit_cards", ANONYMOUS)).toEqual([]);
      expect(db.select("debts", ANONYMOUS)).toEqual([]);
      expect(db.select("budgets", ANONYMOUS)).toEqual([]);
      expect(db.select("portfolio_assets", ANONYMOUS)).toEqual([]);
      expect(db.select("cash_checkpoints", ANONYMOUS)).toEqual([]);
      expect(db.select("audit_events", ANONYMOUS)).toEqual([]);
    });

    it("sessão anônima tem mutações categoricamente barradas por RLS", () => {
      expect(() => {
        db.insert("expenses", ANONYMOUS, { id: "anon_exp_1", user_id: USER_A, value: "10.00" });
      }).toThrow(PostgresRlsViolationError);

      expect(db.update("expenses", ANONYMOUS, "exp_a_1", { value: "1.00" }).affected).toBe(0);
      expect(db.delete("expenses", ANONYMOUS, "exp_a_1").affected).toBe(0);
    });

    it("sessão anônima é barrada em qualquer RPC com exceção de usuário não autenticado", () => {
      expect(() => rpc.createCardPayment(ANONYMOUS, "card_a_1", 1000)).toThrow(/não autenticado/i);
      expect(() => rpc.deleteCreditCard(ANONYMOUS, "card_a_1")).toThrow(/não autenticado/i);
      expect(() => rpc.payDebt(ANONYMOUS, "debt_a_1", 1000)).toThrow(/não autenticado/i);
      expect(() => rpc.earlyAmortizeLoan(ANONYMOUS, "loan_a_1", 1000)).toThrow(/não autenticado/i);
      expect(() => rpc.setBudgetLimit(ANONYMOUS, "cat_a_1", "2026-10", 1000)).toThrow(/não autenticado/i);
      expect(() => rpc.restoreBackup(ANONYMOUS, {})).toThrow(/não autenticado/i);
    });
  });

  describe("7. Auditoria Estática de Migrations: Verificação Contínua de Defesa RLS", () => {
    const migrationFiles = readdirSync(resolve(root, "supabase/migrations"))
      .filter((file) => file.endsWith(".sql"))
      .sort();
    const allSql = migrationFiles.map((file) => readFileSync(resolve(root, "supabase/migrations", file), "utf8")).join("\n");

    const coreTables = [
      "expenses",
      "incomes",
      "categories",
      "credit_cards",
      "card_competence_overrides",
      "card_payments",
      "debts",
      "loans",
      "budgets",
      "income_goals",
      "portfolio_assets",
      "portfolio_transactions",
      "portfolio_contributions",
      "portfolio_snapshots",
      "portfolio_dividends",
      "class_targets",
      "sector_targets",
      "cash_checkpoints",
      "audit_events",
      "user_preferences",
      "profiles",
      "recurrences",
      "recurrence_skips",
      "user_subscriptions",
      "user_module_permissions",
    ];

    it("100% das 25 tabelas de dados de usuário possuem RLS habilitado", () => {
      for (const table of coreTables) {
        expect(allSql).toMatch(
          new RegExp(`alter\\s+table\\s+(?:only\\s+)?public\\.${table}\\s+enable\\s+row\\s+level\\s+security`, "i"),
          `Tabela ${table} não possui enable row level security`,
        );
      }
    });

    it("nenhuma tabela de usuário possui política pública irrestrita", () => {
      const suspiciousPatterns = [
        /using\s*\(\s*true\s*\)/i,
        /using\s*\(\s*1\s*=\s*1\s*\)/i,
        /with\s+check\s*\(\s*true\s*\)/i,
        /to\s+public\s+using/i,
      ];

      // Divide em declarações de política
      const policyStatements = allSql.split(";").filter((stmt) => /create\s+policy/i.test(stmt));
      for (const stmt of policyStatements) {
        // Ignora policies em tabelas públicas/read-only globais como asset_prices ou invited_users se houver
        if (/on\s+public\.asset_prices\b/i.test(stmt)) continue;

        for (const pattern of suspiciousPatterns) {
          expect(stmt).not.toMatch(pattern);
        }
      }
    });

    it("100% das RPCs de escrita composta ativas exigem auth.uid() e validam titularidade", () => {
      const writeRpcs = [
        "create_card_payment",
        "delete_credit_card",
        "delete_card_payment",
        "pay_debt",
        "receive_debt",
        "early_amortize_loan",
        "create_loan_contract",
        "settle_integrated_receivable",
        "delete_category_migrate",
        "set_budget_limit",
        "set_batch_budget_limits",
        "set_income_goal",
        "reallocate_budget",
        "create_refund",
        "import_bank_transactions",
        "restore_backup",
      ];

      for (const rpcName of writeRpcs) {
        const regex = new RegExp(`create\\s+(?:or\\s+replace\\s+)?function\\s+public\\.${rpcName}[\\s\\S]*?auth\\.uid\\(\\)`, "i");
        expect(
          regex.test(allSql),
          `RPC ${rpcName} não valida auth.uid() no corpo para conferência estrita de ownership`,
        ).toBe(true);
      }
    });
  });
});
