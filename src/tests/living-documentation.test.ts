import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

describe("Auditoria de Documentação Viva e Congruência do Repositório", () => {
  const rootDir = process.cwd();

  it("garante que docs/PROJECT_STRUCTURE.md contempla os artefatos de produção e go-live", () => {
    const projectStructurePath = path.join(rootDir, "docs/PROJECT_STRUCTURE.md");
    expect(fs.existsSync(projectStructurePath)).toBe(true);

    const content = fs.readFileSync(projectStructurePath, "utf-8");

    // Documentação
    expect(content).toContain("FOUNDER_RUNBOOK.md");

    // Scripts
    expect(content).toContain("preflight-check.ts");

    // Migrations e Edge Functions
    expect(content).toContain("0060_support_tickets.sql");
    expect(content).toContain("support-notify/index.ts");
    expect(content).toContain("asaas-webhook/index.ts");
    expect(content).toContain("_shared/asaas-webhook-logic.ts");

    // Layout e Módulos
    expect(content).toContain("app-error-boundary");
    expect(content).toContain("support/");
    expect(content).toContain("support-chat-dialog");

    // Data
    expect(content).toContain("support-tickets.ts");

    // Tabela de decisão
    expect(content).toContain("Diagnóstico pré-voo automatizado");
    expect(content).toContain("Manual de operação do fundador");
    expect(content).toContain("Chat nativo de suporte ao cliente");
    expect(content).toContain("Barreira global de contenção de erros de renderização");
  });

  it("garante que docs/ROADMAP.md registra a versão v2.77 e a Fase 98", () => {
    const roadmapPath = path.join(rootDir, "docs/ROADMAP.md");
    expect(fs.existsSync(roadmapPath)).toBe(true);

    const content = fs.readFileSync(roadmapPath, "utf-8");

    // Versão canônica v2.77
    expect(content).toContain("**v2.77**");
    expect(content).toContain("Conclusão Integral do Plano de Finalização para Produção e Primeiros Clientes");

    // Fase 98
    expect(content).toContain("### Fase 98 — Finalização para Produção, Atendimento Nativo via Telegram & Go-Live Operacional");
    expect(content).toContain("Go-Live de Produção & Prontidão Operacional");
  });

  it("valida a existência física dos arquivos citados na documentação viva", () => {
    const requiredFiles = [
      "docs/FOUNDER_RUNBOOK.md",
      "scripts/preflight-check.ts",
      "supabase/migrations/20260101000060_support_tickets.sql",
      "src/components/layout/app-error-boundary.tsx",
      "src/components/modules/support/support-chat-dialog.tsx",
      "src/data/repositories/support-tickets.ts",
      "supabase/functions/support-notify/index.ts",
      "supabase/functions/asaas-webhook/index.ts",
      "supabase/functions/_shared/asaas-webhook-logic.ts",
    ];

    for (const relPath of requiredFiles) {
      const fullPath = path.join(rootDir, relPath);
      expect(fs.existsSync(fullPath)).toBe(true);
    }
  });
});
