import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const cronSqlPath = resolve(root, "supabase/quotes-cron.sql");
const deployScriptPath = resolve(root, "scripts/deploy-quotes.mjs");

describe("Tarefa 2.4 — Auditoria de Quotas e Estrutura do Cron de Cotações", () => {
  it("arquivo supabase/quotes-cron.sql existe e possui conteúdo", () => {
    expect(existsSync(cronSqlPath)).toBe(true);
    const content = readFileSync(cronSqlPath, "utf8");
    expect(content.length).toBeGreaterThan(200);
  });

  it("contém diretrizes claras de auditoria de quotas gratuitas e dimensionamento", () => {
    const content = readFileSync(cronSqlPath, "utf8");
    expect(content).toMatch(/AUDITORIA DE QUOTAS/i);
    expect(content).toMatch(/500\.000/); // Cota mensal de Edge Functions Supabase Free
    expect(content).toMatch(/timeout_milliseconds\s*:=\s*60000/);
    expect(content).toMatch(/jsonb_build_object/);
  });

  it("agenda os 4 jobs oficiais EOD/EOM e Proventos com timeouts seguros", () => {
    const content = readFileSync(cronSqlPath, "utf8");
    expect(content).toMatch(/'quotes-eod-close'/);
    expect(content).toMatch(/0 22 \* \* 1-5/);
    expect(content).toMatch(/'quotes-eom-close'/);
    expect(content).toMatch(/30 22 \* \* 1-5/);
    expect(content).toMatch(/'dividends-sync-global'/);
    expect(content).toMatch(/0 10 \* \* \*/);
    expect(content).toMatch(/'dividends-process-user'/);
    expect(content).toMatch(/30 11 \* \* \*/);
  });

  it("aplica hardening rigoroso revogando acesso do schema cron para roles públicas", () => {
    const content = readFileSync(cronSqlPath, "utf8");
    expect(content).toMatch(/revoke\s+all\s+on\s+schema\s+cron\s+from\s+public,\s*anon,\s*authenticated;/i);
    expect(content).toMatch(/revoke\s+all\s+on\s+all\s+tables\s+in\s+schema\s+cron\s+from\s+public,\s*anon,\s*authenticated;/i);
  });

  it("garante idempotência no agendamento desmarcando jobs prévios", () => {
    const content = readFileSync(cronSqlPath, "utf8");
    expect(content).toMatch(/select\s+cron\.unschedule/i);
    expect(content).toMatch(/quotes-cron/i);
    expect(content).toMatch(/cron\.schedule/i);
  });

  it("efetua chamada HTTP segura via pg_net com segredo dedicado de cron e json", () => {
    const content = readFileSync(cronSqlPath, "utf8");
    expect(content).toMatch(/net\.http_post/);
    expect(content).toMatch(/Authorization/i);
    expect(content).toMatch(/Bearer\s+<CRON_SECRET>/i);
    expect(content).not.toMatch(/Bearer\s+<SERVICE_ROLE_KEY>/i);
    expect(content).toMatch(/Content-Type/i);
    expect(content).toMatch(/application\/json/i);
  });

  it("fornece queries de auditoria operacional para cron.job, job_run_details e asset_prices", () => {
    const content = readFileSync(cronSqlPath, "utf8");
    expect(content).toMatch(/cron\.job/);
    expect(content).toMatch(/cron\.job_run_details/);
    expect(content).toMatch(/asset_prices/);
  });

  it("scripts/deploy-quotes.mjs está sincronizado com o cron idempotente", () => {
    expect(existsSync(deployScriptPath)).toBe(true);
    const content = readFileSync(deployScriptPath, "utf8");
    expect(content).toMatch(/cron\.unschedule/);
    expect(content).toMatch(/quotes-cron/);
    expect(content).toMatch(/cron\.job_run_details/);
  });
});
