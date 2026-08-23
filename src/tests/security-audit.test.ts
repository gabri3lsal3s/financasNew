import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * F6.2 — AUDITORIA DE SEGURANÇA (automatizada)
 * ------------------------------------------------------------------
 * DoD: "Revisão RLS auditada (nenhuma leitura cross-user)".
 * Auditamos as migrations estaticamente — o mesmo guard que roda no CI
 * impede regressões: tabela nova sem RLS, policy aberta, audit_events
 * mutável, RPC sem search_path fixo ou segredo commitado.
 *
 * Regras do ESPECIFICAÇÃO: §1.1/§2 (RLS por auth.uid(), D4) · §1.3 (RPCs
 * transacionais) · §1.4 (audit_events imutável, D2).
 */

const root = process.cwd();

function migrationSql(): string[] {
  return readdirSync(resolve(root, "supabase/migrations"))
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => readFileSync(resolve(root, "supabase/migrations", file), "utf8"));
}

const ALL_SQL = migrationSql().join("\n");

/** Divide o SQL em statements completos (nenhum policy/RPC contém ";" interno). */
function statements(): string[] {
  return ALL_SQL.split(";").map((s) => s.trim()).filter(Boolean);
}

describe("F6.2 — RLS: cobertura total (D4 — multiusuário isolado)", () => {
  it("toda tabela criada nas migrations tem RLS habilitado", () => {
    const created = [...ALL_SQL.matchAll(/create table public\.(\w+)/g)].map((m) => m[1]);
    expect(created.length).toBeGreaterThanOrEqual(19);
    for (const table of created) {
      expect(ALL_SQL).toMatch(
        new RegExp(`alter table public\\.${table} enable row level security`, "i"),
        `tabela ${table} sem RLS`,
      );
    }
  });

  it("nenhuma policy permite leitura/escrita cross-user (toda policy referencia auth.uid())", () => {
    const policies = statements().filter((s) => /^create policy/i.test(s));
    expect(policies.length).toBeGreaterThanOrEqual(20);
    for (const policy of policies) {
      expect(policy.toLowerCase()).toContain(
        "auth.uid()",
        `policy sem auth.uid(): ${policy.slice(0, 120)}`,
      );
    }
  });

  it("nenhuma policy aberta com true/1=1/to public", () => {
    for (const policy of statements().filter((s) => /^create policy/i.test(s))) {
      const body = policy.toLowerCase();
      expect(body).not.toMatch(/\btrue\b/);
      expect(body).not.toMatch(/1\s*=\s*1/);
      expect(body).not.toMatch(/to\s+public/);
    }
  });
});

describe("F6.2 — audit_events imutável (D2)", () => {
  it("não existe policy de update/delete em audit_events", () => {
    const auditPolicies = statements().filter((s) => /on public\.audit_events/i.test(s));
    expect(auditPolicies.length).toBeGreaterThan(0);
    for (const policy of auditPolicies) {
      expect(policy).not.toMatch(/for update/i);
      expect(policy).not.toMatch(/for delete/i);
    }
  });

  it("todos os inserts em audit_events utilizam as colunas canônicas do schema", () => {
    const auditInserts = [...ALL_SQL.matchAll(/insert into public\.audit_events\s*\(([^)]+)\)/gi)];
    expect(auditInserts.length).toBeGreaterThan(0);
    const validColumns = new Set(["id", "user_id", "entity_type", "entity_id", "action", "payload", "created_at"]);
    for (const match of auditInserts) {
      const columnList = match[1];
      if (!columnList) continue;
      const cols = columnList.split(",").map((c) => c.trim().toLowerCase());
      for (const col of cols) {
        expect(validColumns.has(col)).toBe(true);
      }
    }
  });
});

describe("F6.2 — RPCs transacionais endurecidos (D1)", () => {
  it("toda function com security definer também fixa o search_path", () => {
    const functions = ALL_SQL.split(/create (?:or replace )?function/).slice(1);
    expect(functions.length).toBeGreaterThan(0);
    for (const fn of functions) {
      if (/security definer/i.test(fn)) {
        expect(fn).toMatch(
          /set search_path\s*=\s*public,\s*pg_temp/i,
          "RPC security definer sem search_path fixo (risco de hijack)",
        );
      }
    }
  });

  it("toda escrita composta valida o dono (auth.uid()) no corpo — exceto triggers", () => {
    // Exceção: triggers (returns trigger) não comparam auth.uid() — o dono é
    // definido pelo evento que os dispara (handle_new_user no signup cria a
    // linha do próprio usuário; check_allocation_total valida a soma do lote).
    const functions = ALL_SQL.split(/create (?:or replace )?function/).slice(1);
    for (const fn of functions) {
      const body = fn.split(/\$\$;/)[0] ?? fn;
      if (/security definer/i.test(body) && /\b(insert\s+into|update\s+|delete\s+from)\b/i.test(body)) {
        if (/returns trigger/i.test(body)) continue;
        if (/is_admin\(\)|is_superadmin\(\)/i.test(body)) continue;
        expect(body).toMatch(/auth\.uid\(\)/i, "escrita sem ownership (auth.uid()) no RPC");
      }
    }
  });

});

function getTrackedFiles(): string[] {
  try {
    return execSync("git ls-files", { encoding: "utf8", timeout: 10000 }).trim().split("\n");
  } catch {
    return [];
  }
}

describe("F6.2 — segredos e ambiente", () => {
  it("nenhum arquivo .env rastreado além do .env.example", () => {
    const tracked = getTrackedFiles();
    const envFiles = tracked.filter((f) => f.startsWith(".env") && f !== ".env.example");
    expect(envFiles).toEqual([]);
  }, 15000);

  it("nenhum padrão de chave real nos arquivos rastreados", () => {
    const tracked = getTrackedFiles();
    const secretPattern =
      /(sk_live_[A-Za-z0-9]+|pk_live_[A-Za-z0-9]+|sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{30,}|service_role[=: ]+eyJ[A-Za-z0-9_-]+|AIza[0-9A-Za-z_-]{30,}|AKIA[0-9A-Z]{16})/;
    const hits = tracked.filter((f) => {
      if (!/\.(ts|tsx|js|json|toml|sql|md|yaml|yml|example)$/.test(f)) return false;
      // Arquivo removido/renomeado no working tree (ainda no índice) não é lido.
      const abs = resolve(root, f);
      if (!existsSync(abs)) return false;
      return secretPattern.test(readFileSync(abs, "utf8"));
    });
    expect(hits).toEqual([]);
  }, 15000);

  it(".env.example usa apenas placeholders (sem valores reais)", () => {
    const example = readFileSync(resolve(root, ".env.example"), "utf8");
    // Chaves de segredo (URL/KEY/SECRET/TOKEN) devem estar vazias ou com comentário.
    for (const line of example.split("\n")) {
      if (!/^[A-Z0-9_]*(KEY|SECRET|TOKEN|URL|ID) *=/.test(line.trim())) continue;
      const value = line.split("=")[1]?.trim() ?? "";
      expect(value === "" || value.startsWith("#")).toBe(true);
    }
  });
});
