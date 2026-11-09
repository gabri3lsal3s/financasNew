import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { resolve } from "path";

const root = resolve(__dirname, "../..");
const migrationsDir = resolve(root, "supabase/migrations");

function getMigrations(): { file: string; content: string }[] {
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  return files.map((f) => ({
    file: f,
    content: readFileSync(resolve(migrationsDir, f), "utf8"),
  }));
}

describe("Plano 17 — Suíte Contínua de Auditoria e Integridade de Banco (db-audit-checks)", () => {
  const migrations = getMigrations();

  it("100% das tabelas criadas possuem ENABLE ROW LEVEL SECURITY ativado", () => {
    const createdTables = new Set<string>();
    const rlsEnabledTables = new Set<string>();

    for (const { content } of migrations) {
      for (const m of content.matchAll(/create\s+table(?:\s+if\s+not\s+exists)?\s+(?:public\.)?([a-zA-Z0-9_]+)/gi)) {
        if (m[1]) createdTables.add(m[1].toLowerCase());
      }
      for (const m of content.matchAll(/alter\s+table\s+(?:if\s+exists\s+)?(?:public\.)?([a-zA-Z0-9_]+)\s+enable\s+row\s+level\s+security/gi)) {
        if (m[1]) rlsEnabledTables.add(m[1].toLowerCase());
      }
    }

    expect(createdTables.size).toBeGreaterThanOrEqual(54);
    for (const table of createdTables) {
      expect(
        rlsEnabledTables.has(table),
        `Tabela "${table}" foi criada sem respectivo ENABLE ROW LEVEL SECURITY`,
      ).toBe(true);
    }
  });

  it("tabelas financeiras e patrimoniais críticas possuem FORCE ROW LEVEL SECURITY (G-07)", () => {
    const forcedTables = new Set<string>();
    for (const { content } of migrations) {
      for (const m of content.matchAll(/alter\s+table\s+(?:only\s+)?(?:public\.)?([a-zA-Z0-9_]+)\s+force\s+row\s+level\s+security/gi)) {
        if (m[1]) forcedTables.add(m[1].toLowerCase());
      }
    }

    const criticalTables = [
      "expenses",
      "incomes",
      "credit_cards",
      "debts",
      "portfolio_transactions",
      "portfolio_assets",
    ];

    for (const t of criticalTables) {
      expect(
        forcedTables.has(t),
        `Tabela financeira crítica "${t}" deve possuir FORCE ROW LEVEL SECURITY ativo`,
      ).toBe(true);
    }
  });

  it("tabela public_shares não permite SELECT aberto para 'anon' (Anti-Dump / G-01)", () => {
    // Na migração 99, a policy public_shares_select foi redefinida para 'authenticated'
    const migration99 = migrations.find((m) => m.file.includes("0099"));
    expect(migration99).toBeDefined();

    expect(migration99!.content).toMatch(/drop\s+policy\s+if\s+exists\s+"public_shares_select"\s+on\s+public\.public_shares/i);
    expect(migration99!.content).toMatch(/create\s+policy\s+"public_shares_select"\s+on\s+public\.public_shares\s+for\s+select\s+to\s+authenticated/i);

    // Garante que não concede select público sem filtro de usuário
    expect(migration99!.content).not.toMatch(/create\s+policy\s+"public_shares_select"[^;]+to\s+anon/i);
  });

  it("add_public_trip_expense valida passcode e impõe tetos defensivos anti-DoS (G-02)", () => {
    const migration99 = migrations.find((m) => m.file.includes("0099"));
    expect(migration99).toBeDefined();

    const sql = migration99!.content;
    expect(sql).toMatch(/p_amount_cents\s*>\s*100000000/i);
    expect(sql).toMatch(/length\(trim\(p_description\)\)\s*>\s*140/i);
    expect(sql).toMatch(/count\(\*\)\s+into\s+v_expense_count\s+from\s+public\.trip_expenses/i);
    expect(sql).toMatch(/v_expense_count\s*>=\s*500/i);
    expect(sql).toMatch(/v_trip\.passcode_hash\s+is\s+not\s+null/i);
    expect(sql).toMatch(/INVALID_PASSCODE/i);
  });

  it("get_public_trip_ledger implementa comparação timing-safe com suporte a bcrypt (G-03)", () => {
    const migration99 = migrations.find((m) => m.file.includes("0099"));
    expect(migration99).toBeDefined();

    const sql = migration99!.content;
    expect(sql).toMatch(/crypt\(p_passcode,\s*v_trip\.passcode_hash\)/i);
    expect(sql).toMatch(/set\s+search_path\s*=\s*public,\s*pg_temp/i);
  });

  it("procedimento de Direito ao Esquecimento LGPD contempla viagens, famílias e compartilhamentos (G-05)", () => {
    const migration99 = migrations.find((m) => m.file.includes("0099"));
    expect(migration99).toBeDefined();

    const sql = migration99!.content;
    // Viagens
    expect(sql).toMatch(/delete\s+from\s+public\.trip_settlements/i);
    expect(sql).toMatch(/delete\s+from\s+public\.trip_expense_splits/i);
    expect(sql).toMatch(/delete\s+from\s+public\.trip_expenses/i);
    expect(sql).toMatch(/delete\s+from\s+public\.trip_members/i);
    expect(sql).toMatch(/delete\s+from\s+public\.trips/i);

    // Famílias
    expect(sql).toMatch(/delete\s+from\s+public\.family_settlements/i);
    expect(sql).toMatch(/delete\s+from\s+public\.family_invites/i);
    expect(sql).toMatch(/delete\s+from\s+public\.family_members/i);
    expect(sql).toMatch(/delete\s+from\s+public\.families/i);

    // Compartilhamentos
    expect(sql).toMatch(/delete\s+from\s+public\.public_shares\s+where\s+user_id\s*=\s*v_user_id/i);

    // Raiz
    expect(sql).toMatch(/delete\s+from\s+public\.profiles\s+where\s+id\s*=\s*v_user_id/i);
    expect(sql).toMatch(/delete\s+from\s+auth\.users\s+where\s+id\s*=\s*v_user_id/i);
  });

  it("função public.mask_email mascara endereços sem vazamento de PII (G-04)", () => {
    const migration99 = migrations.find((m) => m.file.includes("0099"));
    expect(migration99).toBeDefined();
    expect(migration99!.content).toMatch(/create\s+or\s+replace\s+function\s+public\.mask_email/i);
    expect(migration99!.content).toMatch(/public\.mask_email\(v_invite\.invited_email\)/i);
  });

  it("política de exclusão em trip_expenses restringe DELETE exclusivamente ao host ou titular pagador/criador (SEC-05)", () => {
    const migration102 = migrations.find((m) => m.file.includes("000102"));
    expect(migration102).toBeDefined();
    const sql = migration102!.content;
    expect(sql).toMatch(/drop\s+policy\s+if\s+exists\s+"trip_expenses_write_policy"/i);
    expect(sql).toMatch(/create\s+policy\s+"trip_expenses_delete_policy"\s+on\s+public\.trip_expenses\s+for\s+delete\s+to\s+authenticated/i);
    expect(sql).toMatch(/public\.is_trip_host\(trip_id,\s*\(select\s+auth\.uid\(\)\)\)/i);
    expect(sql).toMatch(/tm\.id\s+in\s+\(trip_expenses\.paid_by_member_id,\s*trip_expenses\.created_by_member_id\)/i);
  });
});
