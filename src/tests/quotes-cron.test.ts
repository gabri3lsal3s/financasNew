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
    expect(content).toMatch(/asset_prices/);
    expect(content).toMatch(/user_id\s+null/i);
  });

  it("documenta opções de agendamento recomendadas para dias úteis e 24/7", () => {
    const content = readFileSync(cronSqlPath, "utf8");
    // Opção dias úteis pregão B3
    expect(content).toMatch(/0 11,14,17,20 \* \* 1-5/);
    // Opção a cada 6 horas
    expect(content).toMatch(/0 \*\/6 \* \* \*/);
    // Opção a cada 4 horas em dias úteis
    expect(content).toMatch(/0 \*\/4 \* \* 1-5/);
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

  it("efetua chamada HTTP segura via pg_net com service role e json", () => {
    const content = readFileSync(cronSqlPath, "utf8");
    expect(content).toMatch(/net\.http_post/);
    expect(content).toMatch(/Authorization/i);
    expect(content).toMatch(/Bearer\s+<SERVICE_ROLE_KEY>/i);
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
