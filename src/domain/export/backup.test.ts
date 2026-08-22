import { describe, expect, it } from "vitest";
import { buildBackupPayload, parseBackupPayload, validateIntegrity } from "./backup";
import type { BackupData } from "./backup";

function emptyData(): BackupData {
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
    user_preferences: [],
  };
}

const CATEGORY = { id: "cat-1", user_id: "u-1", type: "expense", name: "Alimentação", icon: "utensils", color: "#f00", is_reserved: false, is_active: true };
const CARD = { id: "card-1", user_id: "u-1", name: "Nubank", brand: "visa", closing_day: 10, due_day: 18, is_active: true };
const ASSET = { id: "asset-1", user_id: "u-1", ticker: "ITUB4", asset_class: "Ações", currency: "BRL" };

describe("domain/export — backup JSON", () => {
  it("monta payload versionado com buildBackupPayload", () => {
    const payload = buildBackupPayload(emptyData());
    expect(payload.version).toBe(1);
    expect(payload.app).toBeTruthy();
    expect(typeof payload.exportedAt).toBe("string");
    expect(payload.data.expenses).toEqual([]);
  });

  it("aceita backup íntegro com referências válidas", () => {
    const data = emptyData();
    data.categories = [CATEGORY];
    data.credit_cards = [CARD];
    data.portfolio_assets = [ASSET];
    data.expenses = [{ id: "e-1", user_id: "u-1", value: 100, date: "2026-08-01", category_id: "cat-1", card_id: "card-1", payment_method: "credit_card", report_weight: 1, base_amount: 100 }];
    data.card_payments = [{ id: "p-1", user_id: "u-1", card_id: "card-1", competence_month: "2026-08", amount: 100, date: "2026-08-02" }];
    data.portfolio_transactions = [{ id: "t-1", user_id: "u-1", asset_id: "asset-1", type: "buy", date: "2026-08-03", quantity: 10, price: 10, total: 100 }];

    const payload = buildBackupPayload(data);
    const result = parseBackupPayload(payload);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.version).toBe(1);
      expect(result.payload.data.expenses).toHaveLength(1);
    }
  });

  it("rejeita estrutura inválida (não-objeto)", () => {
    const result = parseBackupPayload("não sou json");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.length).toBeGreaterThan(0);
  });

  it("rejeita backup com tabelas faltantes", () => {
    const payload = buildBackupPayload(emptyData()) as unknown as Record<string, unknown>;
    delete (payload.data as Record<string, unknown>).expenses;
    const result = parseBackupPayload(payload);
    expect(result.ok).toBe(false);
  });

  it("rejeita versão não suportada", () => {
    const payload = buildBackupPayload(emptyData());
    const broken = { ...payload, version: 99 } as unknown;
    const result = parseBackupPayload(broken);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toContain("Versão");
  });

  it("detecta referências órfãs (categoria, cartão e ativo)", () => {
    const data = emptyData();
    data.categories = [CATEGORY];
    data.credit_cards = [CARD];
    data.portfolio_assets = [ASSET];
    data.expenses = [
      { id: "e-1", user_id: "u-1", value: 1, date: "2026-08-01", category_id: "cat-inexistente", card_id: "card-inexistente", payment_method: "credit_card", report_weight: 1, base_amount: 1 },
    ];
    data.card_payments = [{ id: "p-1", user_id: "u-1", card_id: "card-inexistente", competence_month: "2026-08", amount: 1, date: "2026-08-01" }];
    data.portfolio_transactions = [{ id: "t-1", user_id: "u-1", asset_id: "asset-inexistente", type: "buy", date: "2026-08-01", quantity: 1, price: 1, total: 1 }];

    const errors = validateIntegrity(data);
    expect(errors.some((e) => e.includes("despesa") && e.includes("cat-inexistente"))).toBe(true);
    expect(errors.some((e) => e.includes("despesa") && e.includes("card-inexistente"))).toBe(true);
    expect(errors.some((e) => e.includes("pagamento"))).toBe(true);
    expect(errors.some((e) => e.includes("transação de ativo"))).toBe(true);
  });

  it("aceita card_id nulo em despesa à vista", () => {
    const data = emptyData();
    data.categories = [CATEGORY];
    data.expenses = [{ id: "e-1", user_id: "u-1", value: 1, date: "2026-08-01", category_id: "cat-1", payment_method: "pix", report_weight: 1, base_amount: 1, card_id: null }];
    const errors = validateIntegrity(data);
    expect(errors).toEqual([]);
  });

  it("limita a lista de erros de integridade", () => {
    const data = emptyData();
    data.categories = [CATEGORY];
    data.expenses = Array.from({ length: 12 }, (_, i) => ({
      id: `e-${i}`,
      user_id: "u-1",
      value: 1,
      date: "2026-08-01",
      category_id: "cat-inexistente",
      payment_method: "pix",
      report_weight: 1,
      base_amount: 1,
    }));
    const errors = validateIntegrity(data);
    expect(errors.length).toBeLessThanOrEqual(8);
  });
});
