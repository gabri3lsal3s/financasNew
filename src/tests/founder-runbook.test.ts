import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Auditoria do Manual de Bordo do Fundador (docs/operations/FOUNDER_RUNBOOK.md)", () => {
  const runbookPath = join(process.cwd(), "docs/operations/FOUNDER_RUNBOOK.md");

  it("verifica se o arquivo existe e possui conteúdo substancial", () => {
    expect(existsSync(runbookPath)).toBe(true);
    const content = readFileSync(runbookPath, "utf8");
    expect(content.length).toBeGreaterThan(2000);
    expect(content).toContain("# Runbook Operacional do Fundador — Áxis Finance");
  });

  it("garante a presença das 7 seções operacionais fundamentais", () => {
    const content = readFileSync(runbookPath, "utf8");

    // 1. Primeiro atendimento e Telegram
    expect(content).toContain("## 1. PRIMEIRO ATENDIMENTO A CLIENTES (SUPORTE EM TEMPO REAL)");
    expect(content).toContain("Telegram");
    expect(content).toContain("support-notify");
    expect(content).toContain("/admin");

    // 2. Gestão de planos e trial
    expect(content).toContain("## 2. GESTÃO MANUAL DE PLANOS & AJUSTES DE ACESSO");
    expect(content).toContain("admin_set_user_subscription");
    expect(content).toContain("trial_ends_at");

    // 3. Resolução de faturamento e Asaas
    expect(content).toContain("## 3. RESOLUÇÃO DE PROBLEMAS DE FATURAMENTO (GATEWAY ASAAS)");
    expect(content).toContain("Estornar Cobrança");
    expect(content).toContain("CDC Artigo 49");

    // 4. Privacidade e LGPD
    expect(content).toContain("## 4. PRIVACIDADE, LGPD & EXCLUSÃO MANUAL DE DADOS");
    expect(content).toContain("delete_user_account");
    expect(content).toContain("privacidade@axis.finance");

    // 5. Monitoramento e preflight
    expect(content).toContain("## 5. MONITORAMENTO OPERACIONAL & DIAGNÓSTICO EM PRODUÇÃO");
    expect(content).toContain("npm run preflight");
    expect(content).toContain("Sentry");

    // 6. Resposta a incidentes
    expect(content).toContain("## 6. CONTINGÊNCIAS RÁPIDAS & MATRIZ DE RESPOSTA A INCIDENTES");
    expect(content).toContain("AppErrorBoundary");
    expect(content).toContain("vite:preloadError");

    // 7. Checklist final de go-live
    expect(content).toContain("## 7. DEFINIÇÃO DE PRONTIDÃO (CHECKLIST FINAL DE GO-LIVE)");
  });

  it("garante conformidade estrita com a regra de ZERO emojis no documento", () => {
    const content = readFileSync(runbookPath, "utf8");
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    expect(emojiRegex.test(content)).toBe(false);
  });
});
