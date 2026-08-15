import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAllUserData, restoreBackup } from "./export";
import { BACKUP_TABLE_KEYS } from "@/domain/export";

const tableData: Record<string, unknown[]> = {
  categories: [{ id: "cat-1", name: "Alimentação" }],
  expenses: [{ id: "e-1", value: 10.5 }],
  incomes: [],
  credit_cards: [],
  card_competence_overrides: [],
  card_payments: [],
  debts: [],
  budgets: [],
  income_goals: [],
  insight_feedback: [],
  reminder_states: [],
  portfolio_assets: [],
  portfolio_transactions: [],
  allocation_targets: [],
  class_targets: [],
  sector_targets: [],
  asset_prices: [],
  user_preferences: [],
};

let lastRpc: { fn: string; args: Record<string, unknown> } | null = null;
let failSelect = false;
let failRpc = false;

vi.mock("@/data/client", () => ({
  getSupabase: () => ({
    from: (table: string) => ({
      select: () =>
        failSelect
          ? Promise.resolve({ data: null, error: { message: "falha de rede", code: "XX", details: "", hint: "" } })
          : Promise.resolve({ data: tableData[table] ?? [], error: null }),
    }),
    rpc: (fn: string, args: Record<string, unknown>) => {
      lastRpc = { fn, args };
      return failRpc
        ? Promise.resolve({ data: null, error: { message: "erro do RPC", code: "XX", details: "", hint: "" } })
        : Promise.resolve({ data: { expenses: 1, categories: 1 }, error: null });
    },
  }),
}));

describe("export repository (F22)", () => {
  beforeEach(() => {
    lastRpc = null;
    failSelect = false;
    failRpc = false;
  });

  it("fetchAllUserData lê todas as tabelas canônicas e monta o payload", async () => {
    const payload = await fetchAllUserData();
    expect(payload.version).toBe(1);
    expect(payload.data.expenses).toHaveLength(1);
    expect(payload.data.categories).toHaveLength(1);
    expect(payload.data.incomes).toEqual([]);
  });

  it("fetchAllUserData propaga erro de consulta (Online First — nunca silenciar)", async () => {
    failSelect = true;
    await expect(fetchAllUserData()).rejects.toThrow(/falha de rede/);
  });

  it("restoreBackup chama o RPC restore_backup com o payload completo", async () => {
    const payload = {
      version: 1,
      app: "Finanças Pessoais",
      exportedAt: "2026-08-15T00:00:00.000Z",
      data: Object.fromEntries(BACKUP_TABLE_KEYS.map((k) => [k, []])) as Record<string, never[]>,
    };
    const summary = await restoreBackup(payload as unknown as Parameters<typeof restoreBackup>[0]);
    expect(lastRpc?.fn).toBe("restore_backup");
    expect((lastRpc?.args.p_backup as { version: number }).version).toBe(1);
    expect(summary.expenses).toBe(1);
  });

  it("restoreBackup propaga erro do RPC", async () => {
    failRpc = true;
    const payload = {
      version: 1,
      app: "Finanças Pessoais",
      exportedAt: "2026-08-15T00:00:00.000Z",
      data: Object.fromEntries(BACKUP_TABLE_KEYS.map((k) => [k, []])) as Record<string, never[]>,
    };
    await expect(restoreBackup(payload as unknown as Parameters<typeof restoreBackup>[0])).rejects.toThrow(/erro do RPC/);
  });
});
