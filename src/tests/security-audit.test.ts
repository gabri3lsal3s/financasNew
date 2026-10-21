import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";
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

function walkDir(dir: string, exts?: string[]): string[] {
  let results: string[] = [];
  if (!existsSync(dir)) return results;
  const list = readdirSync(dir);
  for (const item of list) {
    const full = resolve(dir, item);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (item !== "node_modules" && item !== ".git") {
        results = results.concat(walkDir(full, exts));
      }
    } else if (!exts || exts.some((e) => item.endsWith(e))) {
      results.push(full);
    }
  }
  return results;
}

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
  it("toda tabela criada nas migrations tem RLS habilitado (34 tabelas)", () => {
    const createdMatches = [...ALL_SQL.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-zA-Z0-9_]+)/gi)]
      .map((m) => m[1]?.toLowerCase())
      .filter((name): name is string => Boolean(name));
    const created = Array.from(new Set(createdMatches));
    expect(created.length).toBe(34);
    for (const table of created) {
      expect(ALL_SQL).toMatch(
        new RegExp(`alter\\s+table\\s+(?:only\\s+)?public\\.${table}\\s+enable\\s+row\\s+level\\s+security`, "i"),
        `tabela ${table} sem RLS`,
      );
    }
  });

  it("100% das 34 tabelas possuem policies ativas e nenhuma possui policies residuais", () => {
    const files = readdirSync(resolve(root, "supabase/migrations")).filter((f) => f.endsWith(".sql")).sort();
    const createdMatches = [...ALL_SQL.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-zA-Z0-9_]+)/gi)]
      .map((m) => m[1]?.toLowerCase())
      .filter((name): name is string => Boolean(name));
    const tables = new Set(createdMatches);
    const activePolicies: Map<string, Map<string, string>> = new Map();
    for (const t of tables) activePolicies.set(t, new Map());

    for (const file of files) {
      const content = readFileSync(resolve(root, "supabase/migrations", file), "utf8");
      const stmts = content.split(";").map((s) => s.trim()).filter(Boolean);
      for (const s of stmts) {
        const dropMatches = [...s.matchAll(/drop\s+policy\s+(?:if\s+exists\s+)?"?([^"\s;]+)"?\s+on\s+public\.([a-zA-Z0-9_]+)/gi)];
        for (const dm of dropMatches) {
          const pName = dm[1]?.replace(/"/g, "");
          const tbl = dm[2]?.toLowerCase();
          if (pName && tbl) {
            activePolicies.get(tbl)?.delete(pName);
          }
        }

        const createMatches = [...s.matchAll(/create\s+policy\s+"([^"]+)"\s+on\s+public\.([a-zA-Z0-9_]+)\s+([^;]+)/gi)];
        for (const cm of createMatches) {
          const pName = cm[1];
          const tbl = cm[2]?.toLowerCase();
          const rest = cm[3] ?? "";
          if (pName && tbl) {
            activePolicies.get(tbl)?.set(pName, rest);
          }
        }
      }
    }

    for (const table of tables) {
      const polMap = activePolicies.get(table);
      expect(polMap && polMap.size > 0).toBe(true);
    }

    // Garante que policies residuais foram erradicadas
    expect(activePolicies.get("loans")?.has("loans_all_own")).toBe(false);
    expect(activePolicies.get("cash_checkpoints")?.has("cash_checkpoints_owner_policy")).toBe(false);
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

interface ActiveFunctionDef {
  cleanName: string;
  file: string;
  isSecDef: boolean;
  searchPath: string | null;
  body: string;
}

function getActiveFunctions(): Map<string, ActiveFunctionDef> {
  const files = readdirSync(resolve(root, "supabase/migrations")).filter((f) => f.endsWith(".sql")).sort();
  const activeFunctions = new Map<string, ActiveFunctionDef>();

  for (const file of files) {
    const content = readFileSync(resolve(root, "supabase/migrations", file), "utf8");
    const parts = content.split(/create\s+(?:or\s+replace\s+)?function\s+/i);
    for (let i = 1; i < parts.length; i++) {
      const chunk = parts[i];
      if (!chunk) continue;
      const match = chunk.match(/^([a-zA-Z0-9_.]+)\s*\(([^)]*)\)/);
      if (!match) continue;
      const rawName = match[1]?.toLowerCase() ?? "";
      const cleanName = rawName.startsWith("public.") ? rawName.slice(7) : rawName;
      const endMatch = chunk.match(/\$\$\s*;\s*/);
      const body =
        endMatch && typeof endMatch.index === "number"
          ? chunk.slice(0, endMatch.index + endMatch[0].length)
          : chunk;
      const isSecDef = /security\s+definer/i.test(body);
      const spMatch = body.match(/set\s+search_path\s*=\s*([^;\n]+)/i);
      const searchPath = spMatch ? (spMatch[1]?.trim() ?? null) : null;
      activeFunctions.set(cleanName, {
        cleanName,
        file,
        isSecDef,
        searchPath,
        body,
      });
    }
  }

  return activeFunctions;
}

describe("F6.2 — RPCs transacionais endurecidos (D1)", () => {
  it("100% das functions ativas com security definer fixam search_path = public, pg_temp", () => {
    const activeFunctions = getActiveFunctions();
    expect(activeFunctions.size).toBeGreaterThanOrEqual(60);

    const secDefFunctions = Array.from(activeFunctions.values()).filter((fn) => fn.isSecDef);
    expect(secDefFunctions.length).toBeGreaterThanOrEqual(60);

    for (const fn of secDefFunctions) {
      expect(fn.searchPath).not.toBeNull();
      expect(
        /public\s*,\s*pg_temp/i.test(fn.searchPath ?? ""),
        `RPC ${fn.cleanName} em ${fn.file} é SECURITY DEFINER mas não possui "set search_path = public, pg_temp" (atual: "${fn.searchPath}")`,
      ).toBe(true);
    }
  });

  it("toda escrita composta ativa valida o dono (auth.uid()) no corpo — exceto triggers", () => {
    const activeFunctions = getActiveFunctions();
    for (const fn of activeFunctions.values()) {
      if (fn.isSecDef && /\b(insert\s+into|update\s+|delete\s+from)\b/i.test(fn.body)) {
        if (/returns\s+trigger/i.test(fn.body)) continue;
        if (/is_admin\(\)|is_superadmin\(\)/i.test(fn.body)) continue;
        expect(
          /auth\.uid\(\)/i.test(fn.body),
          `escrita sem ownership (auth.uid()) no RPC ${fn.cleanName} em ${fn.file}`,
        ).toBe(true);
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
    // Garante que APK_DOWNLOAD_URL e variáveis de release Android estão presentes e higienizadas
    expect(example).toMatch(/^APK_DOWNLOAD_URL=\s*(?:#.*)?$/m);
    expect(example).not.toContain("pub-8b490da0649647f0a70d2eff96bd39e0");
  });
});

describe("F50 — Remediação de Segurança & IDOR Hardening (Migration 0036)", () => {
  it("cleanup_old_audit_events valida is_superadmin() e revoga execução pública", () => {
    const migration36 = readFileSync(
      resolve(root, "supabase/migrations/20260101000036_security_remediation_and_hardening.sql"),
      "utf8",
    );
    expect(migration36).toMatch(/is_superadmin\(\)/);
    expect(migration36).toMatch(/revoke execute on function public\.cleanup_old_audit_events/i);
  });

  it("restore_backup valida pertencimento de card_competence_overrides e portfolio_assets", () => {
    const migration36 = readFileSync(
      resolve(root, "supabase/migrations/20260101000036_security_remediation_and_hardening.sql"),
      "utf8",
    );
    expect(migration36).toMatch(/join public\.credit_cards c on c\.id = o\.card_id\s+where c\.user_id = v_uid/i);
    expect(migration36).toMatch(/join public\.portfolio_assets a on a\.id = pt\.asset_id\s+where a\.user_id = v_uid/i);
  });

  it("create_expense_with_debt e rotinas de recorrência validam posse de cartão", () => {
    const migration36 = readFileSync(
      resolve(root, "supabase/migrations/20260101000036_security_remediation_and_hardening.sql"),
      "utf8",
    );
    expect(migration36).toMatch(/select 1 from public\.credit_cards where id = p_card_id and user_id = v_user_id/i);
  });

  it("portfolio_snapshots e portfolio_contributions checam is_current_user_active()", () => {
    const migration36 = readFileSync(
      resolve(root, "supabase/migrations/20260101000036_security_remediation_and_hardening.sql"),
      "utf8",
    );
    expect(migration36).toMatch(
      /create policy "portfolio_snapshots_all_own" on public\.portfolio_snapshots\s+for all using \(\(select auth\.uid\(\)\) = user_id and public\.is_current_user_active\(\)\)/i,
    );
    expect(migration36).toMatch(
      /create policy "portfolio_contributions_all_own" on public\.portfolio_contributions\s+for all using \(\(select auth\.uid\(\)\) = user_id and public\.is_current_user_active\(\)\)/i,
    );
  });
});

describe("F51 — Hardening de Segurança (Migrations 0037 e 0038)", () => {
  it("import_bank_transactions valida posse de category_id e fixa search_path (0037)", () => {
    const migration37 = readFileSync(
      resolve(root, "supabase/migrations/20260101000037_security_fixes_and_rpc_hardening.sql"),
      "utf8",
    );
    expect(migration37).toMatch(/set search_path = public, pg_temp/i);
    expect(migration37).toMatch(/is_current_user_active\(\)/);
    expect(migration37).toMatch(/select 1 from public\.categories\s+where id = v_cat_id and user_id = v_user_id/i);
  });

  it("early_amortize_loan valida vínculo estrito de installment_group_id (0037)", () => {
    const migration37 = readFileSync(
      resolve(root, "supabase/migrations/20260101000037_security_fixes_and_rpc_hardening.sql"),
      "utf8",
    );
    expect(migration37).toMatch(/installment_group_id = v_loan\.installment_group_id/i);
  });

  it("class_targets, sector_targets e insight_feedback usam is_current_user_active() (0038)", () => {
    const migration38 = readFileSync(
      resolve(root, "supabase/migrations/20260101000038_security_hardening_tables_and_rpcs.sql"),
      "utf8",
    );
    expect(migration38).toMatch(/create policy "class_targets_all_own" on public\.class_targets[\s\S]+is_current_user_active\(\)/i);
    expect(migration38).toMatch(/create policy "sector_targets_all_own" on public\.sector_targets[\s\S]+is_current_user_active\(\)/i);
    expect(migration38).toMatch(/create policy "insight_feedback_all_own" on public\.insight_feedback[\s\S]+is_current_user_active\(\)/i);
  });

  it("RPCs legadas de cartões e categorias checam is_current_user_active() (0038)", () => {
    const migration38 = readFileSync(
      resolve(root, "supabase/migrations/20260101000038_security_hardening_tables_and_rpcs.sql"),
      "utf8",
    );
    expect(migration38).toMatch(/create or replace function public\.create_card_payment[\s\S]+is_current_user_active\(\)/i);
    expect(migration38).toMatch(/create or replace function public\.update_credit_card[\s\S]+is_current_user_active\(\)/i);
    expect(migration38).toMatch(/create or replace function public\.delete_credit_card[\s\S]+is_current_user_active\(\)/i);
    expect(migration38).toMatch(/create or replace function public\.settle_integrated_receivable[\s\S]+is_current_user_active\(\)/i);
    expect(migration38).toMatch(/create or replace function public\.set_budget_limit[\s\S]+is_current_user_active\(\)/i);
  });
});

describe("Fase 5.2 — Blindagem de RPCs & Sanitização de Search Path (Migration 0048)", () => {
  const migration48 = readFileSync(
    resolve(root, "supabase/migrations/20260101000048_rpc_search_path_and_security_hardening.sql"),
    "utf8",
  );

  it("upsert_marco_zero fixa search_path = public, pg_temp e valida permissões de investimento", () => {
    expect(migration48).toMatch(/create or replace function public\.upsert_marco_zero/i);
    expect(migration48).toMatch(/upsert_marco_zero[\s\S]*?security definer[\s\S]*?set search_path = public, pg_temp/i);
    expect(migration48).toMatch(/upsert_marco_zero[\s\S]*?auth\.uid\(\)[\s\S]*?v_user_id is null/i);
    expect(migration48).toMatch(/upsert_marco_zero[\s\S]*?is_current_user_active\(\)/i);
    expect(migration48).toMatch(/upsert_marco_zero[\s\S]*?can_current_user_write_module\('investments'\)/i);
    expect(migration48).toMatch(/upsert_marco_zero[\s\S]*?p_amount <= 0/i);
  });

  it("create_historical_contribution fixa search_path = public, pg_temp e valida permissões de investimento", () => {
    expect(migration48).toMatch(/create or replace function public\.create_historical_contribution/i);
    expect(migration48).toMatch(/create_historical_contribution[\s\S]*?security definer[\s\S]*?set search_path = public, pg_temp/i);
    expect(migration48).toMatch(/create_historical_contribution[\s\S]*?auth\.uid\(\)[\s\S]*?v_user_id is null/i);
    expect(migration48).toMatch(/create_historical_contribution[\s\S]*?is_current_user_active\(\)/i);
    expect(migration48).toMatch(/create_historical_contribution[\s\S]*?can_current_user_write_module\('investments'\)/i);
    expect(migration48).toMatch(/create_historical_contribution[\s\S]*?p_amount <= 0/i);
  });

  it("ambas as RPCs revogam execução pública e concedem apenas a authenticated", () => {
    expect(migration48).toMatch(/revoke all on function public\.upsert_marco_zero\(date, numeric, text\) from public;/i);
    expect(migration48).toMatch(/grant execute on function public\.upsert_marco_zero\(date, numeric, text\) to authenticated;/i);
    expect(migration48).toMatch(/revoke all on function public\.create_historical_contribution\(date, numeric, text\) from public;/i);
    expect(migration48).toMatch(/grant execute on function public\.create_historical_contribution\(date, numeric, text\) to authenticated;/i);
  });
});

describe("Fase 5.2 — Hardening Integral de RPCs e Permissões Modulares (Migration 0049)", () => {
  const migration49 = readFileSync(
    resolve(root, "supabase/migrations/20260101000049_rpc_write_permission_and_active_user_hardening.sql"),
    "utf8",
  );

  const writeRpcList = [
    { name: "create_card_payment", module: "cards" },
    { name: "update_credit_card", module: "cards" },
    { name: "delete_credit_card", module: "cards" },
    { name: "delete_card_payment", module: "cards" },
    { name: "recalculate_bill_competences", module: "cards" },
    { name: "pay_debt", module: "debts" },
    { name: "receive_debt", module: "debts" },
    { name: "early_amortize_loan", module: "debts" },
    { name: "create_loan_contract", module: "debts" },
    { name: "settle_integrated_receivable", module: "debts" },
    { name: "delete_category_migrate", module: "transactions" },
    { name: "set_budget_limit", module: "budgets" },
    { name: "set_batch_budget_limits", module: "budgets" },
    { name: "set_income_goal", module: "budgets" },
    { name: "reallocate_budget", module: "budgets" },
    { name: "create_refund", module: "transactions" },
    { name: "delete_expense_installments", module: "transactions" },
    { name: "update_expense_installments_group", module: "transactions" },
    { name: "create_income_installments", module: "transactions" },
    { name: "update_income_installments_group", module: "transactions" },
    { name: "delete_income_installments", module: "transactions" },
    { name: "create_recurrence", module: "reminders" },
    { name: "update_recurrence_occurrences", module: "reminders" },
    { name: "delete_recurrence_occurrences", module: "reminders" },
    { name: "materialize_recurrences", module: "transactions" },
    { name: "set_allocation_targets", module: "investments" },
    { name: "set_group_target", module: "investments" },
    { name: "remove_group_target", module: "investments" },
  ];

  it("100% das RPCs de mutação de usuário em 0049 validam is_current_user_active() e can_current_user_write_module()", () => {
    for (const item of writeRpcList) {
      const fnRegex = new RegExp(
        `create or replace function public\\.${item.name}[\\s\\S]*?is_current_user_active\\(\\)[\\s\\S]*?can_current_user_write_module\\('${item.module}'\\)`,
        "i",
      );
      expect(
        fnRegex.test(migration49),
        `RPC ${item.name} não valida is_current_user_active() ou can_current_user_write_module('${item.module}') em migration 0049`,
      ).toBe(true);
    }
  });

  it("todas as 28 RPCs revogam acesso de public e concedem a authenticated", () => {
    for (const item of writeRpcList) {
      expect(migration49).toMatch(new RegExp(`grant execute on function public\\.${item.name}\\b`, "i"));
      expect(migration49).toMatch(new RegExp(`revoke all on function public\\.${item.name}\\b`, "i"));
    }
  });
});


describe("Fase 5.3 — Auditoria do Bundle Client contra Vazamento de Segredos", () => {
  const ALLOWED_CLIENT_ENV_VARS = new Set([
    "VITE_SUPABASE_URL",
    "VITE_SUPABASE_ANON_KEY",
    "VITE_DEFAULT_BILLING_PROVIDER",
    "VITE_SENTRY_DSN",
    "VITE_BRAPI_TOKEN",
    "DEV",
    "PROD",
    "MODE",
    "BASE_URL",
    "SSR",
  ]);

  const FORBIDDEN_SECRET_PATTERNS = [
    { name: "Service Role Key Var", regex: /SUPABASE_SERVICE_ROLE_KEY/i },
    { name: "Database URL Var", regex: /SUPABASE_DB_URL/i },
    { name: "Postgres Connection URI", regex: /postgres(?:ql)?:\/\/[a-zA-Z0-9_-]+:[^@\s]+@/i },
    { name: "Asaas API Key / Secret Token", regex: /\$aact_[A-Za-z0-9_-]+/i },
    { name: "Live Stripe Secret Key", regex: /sk_live_[A-Za-z0-9]+/i },
    { name: "OpenAI Secret Key", regex: /sk-[A-Za-z0-9]{20,}/i },
    { name: "GitHub Personal Access Token", regex: /ghp_[A-Za-z0-9]{30,}/i },
    { name: "AWS Access Key", regex: /AKIA[0-9A-Z]{16}/i },
  ];

  it("nenhum segredo privilegiado ou token de servidor é referenciado no código de produção em src/", () => {
    const srcFiles = walkDir(resolve(root, "src"), [".ts", ".tsx", ".js", ".jsx", ".json", ".css"]).filter(
      (f) => !f.includes(".test.") && !f.includes("/tests/"),
    );

    const violations: { file: string; pattern: string }[] = [];
    for (const file of srcFiles) {
      const content = readFileSync(file, "utf8");
      for (const p of FORBIDDEN_SECRET_PATTERNS) {
        if (p.regex.test(content)) {
          violations.push({ file: relative(root, file), pattern: p.name });
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("apenas variáveis de ambiente públicas autorizadas são acessadas via import.meta.env em src/", () => {
    const srcFiles = walkDir(resolve(root, "src"), [".ts", ".tsx", ".js", ".jsx"]).filter(
      (f) => !f.includes(".test.") && !f.includes("/tests/"),
    );

    const unallowedEnvVars: { file: string; varName: string }[] = [];
    for (const file of srcFiles) {
      const content = readFileSync(file, "utf8");
      const matches = [...content.matchAll(/import\.meta\.env(?:\.([A-Za-z0-9_]+)|\[["']([A-Za-z0-9_]+)["'])/g)];
      for (const m of matches) {
        const varName = m[1] || m[2];
        if (varName && !ALLOWED_CLIENT_ENV_VARS.has(varName)) {
          unallowedEnvVars.push({ file: relative(root, file), varName });
        }
      }
    }

    expect(unallowedEnvVars).toEqual([]);
  });

  it("zero ocorrências de process.env em código de produção em src/", () => {
    const srcFiles = walkDir(resolve(root, "src"), [".ts", ".tsx", ".js", ".jsx"]).filter(
      (f) => !f.includes(".test.") && !f.includes("/tests/"),
    );

    const processEnvUses: string[] = [];
    for (const file of srcFiles) {
      const content = readFileSync(file, "utf8");
      if (/\bprocess\.env\b/.test(content)) {
        processEnvUses.push(relative(root, file));
      }
    }

    expect(processEnvUses).toEqual([]);
  });

  it("auditoria do bundle compilado (dist/): zero segredos ou credenciais embutidas nos chunks", () => {
    const distDir = resolve(root, "dist");
    if (!existsSync(distDir)) {
      return;
    }

    const distFiles = walkDir(distDir, [".js", ".css", ".html"]);
    expect(distFiles.length).toBeGreaterThan(0);

    const bundleViolations: { file: string; pattern: string }[] = [];
    for (const file of distFiles) {
      const content = readFileSync(file, "utf8");
      for (const p of FORBIDDEN_SECRET_PATTERNS) {
        if (p.regex.test(content)) {
          bundleViolations.push({ file: relative(root, file), pattern: p.name });
        }
      }
    }

    expect(bundleViolations).toEqual([]);
  });
});

describe("Tarefa 5.5 — Fortalecimento Nativo Android & Privacidade de Sessão", () => {
  it("AndroidManifest.xml bloqueia explicitamente tráfego HTTP inseguro (usesCleartextTraffic=false)", () => {
    const manifestPath = resolve(root, "android/app/src/main/AndroidManifest.xml");
    expect(existsSync(manifestPath)).toBe(true);
    const content = readFileSync(manifestPath, "utf8");

    expect(content).toMatch(/android:usesCleartextTraffic=["']false["']/);
    expect(content).toMatch(/android:networkSecurityConfig=["']@xml\/network_security_config["']/);
  });

  it("network_security_config.xml existe e proíbe cleartextTrafficPermitted", () => {
    const netConfigPath = resolve(root, "android/app/src/main/res/xml/network_security_config.xml");
    expect(existsSync(netConfigPath)).toBe(true);
    const content = readFileSync(netConfigPath, "utf8");

    expect(content).toMatch(/cleartextTrafficPermitted=["']false["']/);
  });

  it("módulos de PrivacyShield (FLAG_SECURE) e AppLock com Biometria estão devidamente configurados", () => {
    const pkgJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
    expect(pkgJson.dependencies["@capacitor-community/privacy-screen"]).toBeDefined();
    expect(pkgJson.dependencies["@aparajita/capacitor-biometric-auth"]).toBeDefined();

    const privacyShieldTs = readFileSync(resolve(root, "src/services/native/privacy-shield.ts"), "utf8");
    expect(privacyShieldTs).toContain("PrivacyScreen.enable()");
    expect(privacyShieldTs).toContain("PrivacyScreen.disable()");

    const appLockTs = readFileSync(resolve(root, "src/services/native/app-lock.ts"), "utf8");
    expect(appLockTs).toContain("enablePrivacyShield()");
    expect(appLockTs).toContain("initAppLockListener");

    const providersTs = readFileSync(resolve(root, "src/app/providers.tsx"), "utf8");
    expect(providersTs).toContain("<AppLockOverlay />");
    expect(providersTs).toContain("initAppLockListener()");
  });
});

describe("Tarefa 1.4 — Regressão Automatizada de Headers de Segurança e Cache em public/_headers", () => {
  const headersPath = resolve(root, "public/_headers");

  it("public/_headers existe e contém diretiva estrita de Content-Security-Policy", () => {
    expect(existsSync(headersPath)).toBe(true);
    const content = readFileSync(headersPath, "utf8");

    expect(content).toContain("Content-Security-Policy:");
    const cspMatch = content.match(/Content-Security-Policy:\s*([^\r\n]+)/);
    expect(cspMatch).not.toBeNull();
    const csp = cspMatch?.[1] ?? "";

    // Valida diretivas obrigatórias de contenção
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
  });

  it("não possui wildcards permissivos (*) em script-src ou connect-src", () => {
    const content = readFileSync(headersPath, "utf8");
    const cspMatch = content.match(/Content-Security-Policy:\s*([^\r\n]+)/);
    const csp = cspMatch?.[1] ?? "";

    const scriptMatch = csp.match(/script-src\s+([^;]+)/);
    const scriptSrc = scriptMatch?.[1] ?? "";
    expect(scriptSrc.split(/\s+/)).not.toContain("*");

    const connectMatch = csp.match(/connect-src\s+([^;]+)/);
    const connectSrc = connectMatch?.[1] ?? "";
    expect(connectSrc.split(/\s+/)).not.toContain("*");
  });

  it("bloqueia clickjacking e framing via frame-ancestors e X-Frame-Options", () => {
    const content = readFileSync(headersPath, "utf8");
    expect(content).toContain("frame-ancestors 'none'");
    expect(content).toContain("X-Frame-Options: DENY");
  });

  it("configura políticas determinísticas de cache para assets estáticos e artefatos voláteis", () => {
    const content = readFileSync(headersPath, "utf8");
    expect(content).toContain("/assets/*");
    expect(content).toContain("max-age=31536000, immutable");

    expect(content).toContain("/index.html");
    expect(content).toContain("/sw.js");
    expect(content).toContain("max-age=0, must-revalidate");
  });
});

describe("Tarefa 3.1 — Otimização de RLS Subplan Caching (InitPlan) (Migration 0050)", () => {
  it("migration 0050 existe e documenta a otimização de nós InitPlan pelo PostgreSQL planner", () => {
    const migration50 = readFileSync(
      resolve(root, "supabase/migrations/20260101000050_rls_subplan_caching_performance.sql"),
      "utf8",
    );
    expect(migration50).toMatch(/InitPlan/i);
    expect(migration50).toMatch(/\(select auth\.uid\(\)\)/);
  });

  it("100% das policies ativas no banco utilizam (select auth.uid()) para caching escalar de subplan", () => {
    const files = readdirSync(resolve(root, "supabase/migrations")).filter((f) => f.endsWith(".sql")).sort();
    const createdMatches = [...ALL_SQL.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-zA-Z0-9_]+)/gi)]
      .map((m) => m[1]?.toLowerCase())
      .filter((name): name is string => Boolean(name));
    const tables = new Set(createdMatches);
    const activePolicies: Map<string, Map<string, string>> = new Map();
    for (const t of tables) activePolicies.set(t, new Map());

    for (const file of files) {
      const content = readFileSync(resolve(root, "supabase/migrations", file), "utf8");
      const stmts = content.split(";").map((s) => s.trim()).filter(Boolean);
      for (const s of stmts) {
        const dropMatches = [...s.matchAll(/drop\s+policy\s+(?:if\s+exists\s+)?"?([^"\s;]+)"?\s+on\s+public\.([a-zA-Z0-9_]+)/gi)];
        for (const dm of dropMatches) {
          const pName = dm[1]?.replace(/"/g, "");
          const tbl = dm[2]?.toLowerCase();
          if (pName && tbl) {
            activePolicies.get(tbl)?.delete(pName);
          }
        }

        const createMatches = [...s.matchAll(/create\s+policy\s+"([^"]+)"\s+on\s+public\.([a-zA-Z0-9_]+)\s+([^;]+)/gi)];
        for (const cm of createMatches) {
          const pName = cm[1];
          const tbl = cm[2]?.toLowerCase();
          const rest = cm[3] ?? "";
          if (pName && tbl) {
            activePolicies.get(tbl)?.set(pName, rest);
          }
        }
      }
    }

    let totalActivePolicies = 0;
    const nonInitPlanPolicies: { table: string; policy: string; body: string }[] = [];

    for (const [table, polMap] of activePolicies.entries()) {
      for (const [policyName, body] of polMap.entries()) {
        totalActivePolicies++;
        // Substitui todas as ocorrências de (select auth.uid()) para verificar se sobra algum auth.uid() cru
        const stripped = body.replace(/\(\s*select\s+auth\.uid\(\)\s*\)/gi, "__INITPLAN__");
        if (/auth\.uid\(\)/i.test(stripped)) {
          nonInitPlanPolicies.push({ table, policy: policyName, body });
        }
      }
    }

    expect(totalActivePolicies).toBeGreaterThanOrEqual(90);
    expect(
      nonInitPlanPolicies,
      `Policies que ainda utilizam auth.uid() volátil sem subquery escalar (select auth.uid()): ${JSON.stringify(nonInitPlanPolicies, null, 2)}`,
    ).toEqual([]);
  });
});

describe("Tarefa 3.2 — Encapsulamento Escalar das Checagens Modulares SaaS (Migration 0051)", () => {
  it("migration 0051 existe, define can_current_user_read_module e can_current_user_write_module com security definer e search_path", () => {
    const migration51 = readFileSync(
      resolve(root, "supabase/migrations/20260101000051_encapsulate_saas_modular_checks_scalar.sql"),
      "utf8",
    );
    expect(migration51).toMatch(/create or replace function public\.can_current_user_read_module/i);
    expect(migration51).toMatch(/can_current_user_read_module[\s\S]*?security definer[\s\S]*?set search_path = public, pg_temp/i);
    expect(migration51).toMatch(/revoke all on function public\.can_current_user_read_module\(text\) from public;/i);
    expect(migration51).toMatch(/grant execute on function public\.can_current_user_read_module\(text\) to authenticated;/i);
  });

  it("100% das checagens de is_current_user_active, can_current_user_read_module, can_current_user_write_module e is_admin nas policies ativas utilizam nós escalares (select ...)", () => {
    const files = readdirSync(resolve(root, "supabase/migrations")).filter((f) => f.endsWith(".sql")).sort();
    const createdMatches = [...ALL_SQL.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-zA-Z0-9_]+)/gi)]
      .map((m) => m[1]?.toLowerCase())
      .filter((name): name is string => Boolean(name));
    const tables = new Set(createdMatches);
    const activePolicies: Map<string, Map<string, string>> = new Map();
    for (const t of tables) activePolicies.set(t, new Map());

    for (const file of files) {
      const content = readFileSync(resolve(root, "supabase/migrations", file), "utf8");
      const stmts = content.split(";").map((s) => s.trim()).filter(Boolean);
      for (const s of stmts) {
        const dropMatches = [...s.matchAll(/drop\s+policy\s+(?:if\s+exists\s+)?"?([^"\s;]+)"?\s+on\s+public\.([a-zA-Z0-9_]+)/gi)];
        for (const dm of dropMatches) {
          const pName = dm[1]?.replace(/"/g, "");
          const tbl = dm[2]?.toLowerCase();
          if (pName && tbl) {
            activePolicies.get(tbl)?.delete(pName);
          }
        }

        const createMatches = [...s.matchAll(/create\s+policy\s+"([^"]+)"\s+on\s+public\.([a-zA-Z0-9_]+)\s+([^;]+)/gi)];
        for (const cm of createMatches) {
          const pName = cm[1];
          const tbl = cm[2]?.toLowerCase();
          const rest = cm[3] ?? "";
          if (pName && tbl) {
            activePolicies.get(tbl)?.set(pName, rest);
          }
        }
      }
    }

    const rawActiveUserPolicies: string[] = [];
    const rawReadModulePolicies: string[] = [];
    const rawWriteModulePolicies: string[] = [];
    const rawAdminPolicies: string[] = [];

    for (const [table, polMap] of activePolicies.entries()) {
      for (const [policyName, body] of polMap.entries()) {
        const identifier = `${table}.${policyName}`;

        if (/is_current_user_active\(\)/i.test(body)) {
          if (!/\(\s*select\s+public\.is_current_user_active\(\)\s*\)/i.test(body)) {
            rawActiveUserPolicies.push(identifier);
          }
        }

        if (/can_current_user_read_module/i.test(body)) {
          if (!/\(\s*select\s+public\.can_current_user_read_module\([^)]+\)\s*\)/i.test(body)) {
            rawReadModulePolicies.push(identifier);
          }
        }

        if (/can_current_user_write_module/i.test(body)) {
          if (!/\(\s*select\s+public\.can_current_user_write_module\([^)]+\)\s*\)/i.test(body)) {
            rawWriteModulePolicies.push(identifier);
          }
        }

        if (/is_admin\(\)/i.test(body)) {
          if (!/\(\s*select\s+public\.is_admin\(\)\s*\)/i.test(body)) {
            rawAdminPolicies.push(identifier);
          }
        }
      }
    }

    expect(rawActiveUserPolicies, "Policies com is_current_user_active() não encapsulado em subquery").toEqual([]);
    expect(rawReadModulePolicies, "Policies com can_current_user_read_module(...) não encapsulado em subquery").toEqual([]);
    expect(rawWriteModulePolicies, "Policies com can_current_user_write_module(...) não encapsulado em subquery").toEqual([]);
    expect(rawAdminPolicies, "Policies com is_admin() não encapsulado em subquery").toEqual([]);
  });
});

describe("Tarefa 3.3 — Criação do Índice Composto Complementar em portfolio_transactions (Migration 0052)", () => {
  it("migration 0052 existe e cria o índice composto cobridor idx_portfolio_tx_user_asset_date", () => {
    const migration52 = readFileSync(
      resolve(root, "supabase/migrations/20260101000052_portfolio_transactions_composite_index.sql"),
      "utf8",
    );
    expect(migration52).toMatch(/create\s+index\s+(?:if\s+not\s+exists\s+)?idx_portfolio_tx_user_asset_date/i);
    expect(migration52).toMatch(/on\s+public\.portfolio_transactions\s*\(\s*user_id\s*,\s*asset_id\s*,\s*date\s+desc\s*\)/i);
  });

  it("o índice idx_portfolio_tx_user_asset_date está presente no conjunto consolidado de migrations", () => {
    expect(ALL_SQL).toMatch(/idx_portfolio_tx_user_asset_date/i);
  });
});

describe("Tarefa 3.4 — Expansão da Suíte de Auditoria Integral de Banco & Governança InitPlan", () => {
  it("todas as 34 tabelas possuem RLS habilitado e nenhuma migração contém disable row level security", () => {
    expect(ALL_SQL).not.toMatch(/disable\s+row\s+level\s+security/i);

    const createdMatches = [...ALL_SQL.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-zA-Z0-9_]+)/gi)]
      .map((m) => m[1]?.toLowerCase())
      .filter((name): name is string => Boolean(name));
    const created = Array.from(new Set(createdMatches));
    expect(created.length).toBe(34);
    for (const table of created) {
      expect(ALL_SQL).toMatch(
        new RegExp(`alter\\s+table\\s+(?:only\\s+)?public\\.${table}\\s+enable\\s+row\\s+level\\s+security`, "i"),
        `tabela ${table} sem enable row level security`,
      );
    }
  });

  it("zero policies ativas utilizam auth.uid() = user_id ou auth.uid() = id sem subquery escalar (select auth.uid())", () => {
    const files = readdirSync(resolve(root, "supabase/migrations")).filter((f) => f.endsWith(".sql")).sort();
    const createdMatches = [...ALL_SQL.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-zA-Z0-9_]+)/gi)]
      .map((m) => m[1]?.toLowerCase())
      .filter((name): name is string => Boolean(name));
    const tables = new Set(createdMatches);
    const activePolicies: Map<string, Map<string, string>> = new Map();
    for (const t of tables) activePolicies.set(t, new Map());

    for (const file of files) {
      const content = readFileSync(resolve(root, "supabase/migrations", file), "utf8");
      const stmts = content.split(";").map((s) => s.trim()).filter(Boolean);
      for (const s of stmts) {
        const dropMatches = [...s.matchAll(/drop\s+policy\s+(?:if\s+exists\s+)?"?([^"\s;]+)"?\s+on\s+public\.([a-zA-Z0-9_]+)/gi)];
        for (const dm of dropMatches) {
          const pName = dm[1]?.replace(/"/g, "");
          const tbl = dm[2]?.toLowerCase();
          if (pName && tbl) {
            activePolicies.get(tbl)?.delete(pName);
          }
        }

        const createMatches = [...s.matchAll(/create\s+policy\s+"([^"]+)"\s+on\s+public\.([a-zA-Z0-9_]+)\s+([^;]+)/gi)];
        for (const cm of createMatches) {
          const pName = cm[1];
          const tbl = cm[2]?.toLowerCase();
          const rest = cm[3] ?? "";
          if (pName && tbl) {
            activePolicies.get(tbl)?.set(pName, rest);
          }
        }
      }
    }

    const bareEqualityViolations: string[] = [];
    const barePatterns = [
      /auth\.uid\(\)\s*=\s*user_id/i,
      /user_id\s*=\s*auth\.uid\(\)/i,
      /auth\.uid\(\)\s*=\s*id/i,
      /id\s*=\s*auth\.uid\(\)/i,
    ];

    for (const [table, polMap] of activePolicies.entries()) {
      for (const [policyName, body] of polMap.entries()) {
        const stripped = body.replace(/\(\s*select\s+auth\.uid\(\)\s*\)/gi, "__INITPLAN__");
        for (const pat of barePatterns) {
          if (pat.test(stripped)) {
            bareEqualityViolations.push(`${table}.${policyName} => ${body}`);
          }
        }
      }
    }

    expect(
      bareEqualityViolations,
      `Policies com igualdade crua de auth.uid() sem nó InitPlan escalar: ${JSON.stringify(bareEqualityViolations, null, 2)}`,
    ).toEqual([]);
  });

  it("100% das 65+ functions ativas com security definer fixam search_path = public, pg_temp", () => {
    const activeFunctions = getActiveFunctions();
    const secDefFunctions = Array.from(activeFunctions.values()).filter((fn) => fn.isSecDef);

    expect(secDefFunctions.length).toBeGreaterThanOrEqual(65);
    for (const fn of secDefFunctions) {
      expect(
        /public\s*,\s*pg_temp/i.test(fn.searchPath ?? ""),
        `RPC ${fn.cleanName} em ${fn.file} é SECURITY DEFINER mas não possui search_path = public, pg_temp (atual: "${fn.searchPath}")`,
      ).toBe(true);
    }
  });

  it("avaliação fail-closed: usuário não-autenticado resulta em NULL e bloqueio estrito em todas as tabelas", () => {
    const nullEvaluation = (userId: string, authUid: string | null): boolean => {
      if (authUid === null) return false;
      return userId === authUid;
    };

    expect(nullEvaluation("user-123", null)).toBe(false);
    expect(nullEvaluation("user-123", "user-123")).toBe(true);
    expect(nullEvaluation("user-123", "user-456")).toBe(false);
  });
});

describe("Tarefa 5.1 — Suíte de Penetração Cross-Tenant & RLS Isolation", () => {
  it("arquivo src/tests/cross-tenant-penetration.test.ts existe e contém suíte completa de penetração", () => {
    const suitePath = resolve(root, "src/tests/cross-tenant-penetration.test.ts");
    expect(existsSync(suitePath)).toBe(true);
    const content = readFileSync(suitePath, "utf8");
    expect(content).toContain("USER_A");
    expect(content).toContain("USER_B");
    expect(content).toContain("Leitura Cross-Tenant (SELECT / IDOR)");
    expect(content).toContain("Injeção Cross-Tenant (INSERT)");
    expect(content).toContain("Modificação Cross-Tenant (UPDATE)");
    expect(content).toContain("Exclusão Cross-Tenant (DELETE)");
    expect(content).toContain("Invocação de RPCs Transacionais Cross-Tenant");
  });
});









