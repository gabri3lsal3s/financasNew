import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Auditoria de Rate Limits & Agendamento de Cotações (Tarefa 4.3)", () => {
  const rootDir = process.cwd();
  const cronSqlPath = join(rootDir, "supabase/quotes-cron.sql");
  const deploymentPath = join(rootDir, "docs/DEPLOYMENT.md");

  it("verifica se o script supabase/quotes-cron.sql existe e implementa hardening de segurança", () => {
    expect(existsSync(cronSqlPath)).toBe(true);
    const sqlContent = readFileSync(cronSqlPath, "utf8");

    // 1. Hardening de permissões
    expect(sqlContent).toContain("revoke all on schema cron from public, anon, authenticated;");
    expect(sqlContent).toContain("revoke all on all tables in schema cron from public, anon, authenticated;");

    // 2. Idempotência
    expect(sqlContent).toContain("cron.unschedule(jobname)");

    // 3. Invocação HTTP segura via pg_net
    expect(sqlContent).toContain("cron.schedule");
    expect(sqlContent).toContain("net.http_post");
    expect(sqlContent).toContain("Authorization");

    // 4. Queries de auditoria
    expect(sqlContent).toContain("cron.job_run_details");
    expect(sqlContent).toContain("public.asset_prices");
  });

  it("garante que o comando npm run quotes:cron gera SQL preenchido e executável", () => {
    const output = execSync("node scripts/deploy-quotes.mjs cron", {
      cwd: rootDir,
      encoding: "utf8",
    });

    expect(output).toContain("CRON — Edge function de cotações (F1.7) — GERADO");
    expect(output).toContain("select cron.schedule(");
    expect(output).toContain("url := 'https://");
    expect(output).toContain("Authorization', 'Bearer ");
    expect(output).not.toContain("undefined");
    expect(output).not.toContain("<FUNCTION_URL>");
  });

  it("assegura que docs/DEPLOYMENT.md documenta os parâmetros de Rate Limits e proteção contra força bruta", () => {
    const deployDoc = readFileSync(deploymentPath, "utf8");

    // 1. Proteção contra força bruta e lockout temporário
    expect(deployDoc).toContain("Proteção contra Força Bruta");
    expect(deployDoc).toContain("lockout temporário automático");

    // 2. Limites de envio de e-mails para evitar bloqueio de novos clientes
    expect(deployDoc).toContain("Quotas de Envio de E-mails");
    expect(deployDoc).toContain("SMTP Dedicado (Resend)");

    // 3. Teto de cadastros e recuperação de senha
    expect(deployDoc).toContain("Teto de Cadastros e Criação de Contas");
    expect(deployDoc).toContain("Prevenção de Abuso de Recuperação de Senha");

    // 4. pg_cron e pg_net
    expect(deployDoc).toContain("pg_cron");
    expect(deployDoc).toContain("pg_net");
    expect(deployDoc).toContain("quotes:cron");
  });
});
