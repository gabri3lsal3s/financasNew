import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Auditoria de Prontidão Cloudflare Pages & Borda (Tarefa 4.2)", () => {
  const rootDir = process.cwd();
  const headersPath = join(rootDir, "public/_headers");
  const deploymentPath = join(rootDir, "docs/DEPLOYMENT.md");

  it("verifica a presença e integridade das regras em public/_headers", () => {
    const headersContent = readFileSync(headersPath, "utf8");

    // HSTS Estrito
    expect(headersContent).toContain("Strict-Transport-Security: max-age=31536000; includeSubDomains; preload");

    // Prevenção de Clickjacking e XSS
    expect(headersContent).toContain("X-Frame-Options: DENY");
    expect(headersContent).toContain("X-Content-Type-Options: nosniff");
    expect(headersContent).toContain("frame-ancestors 'none'");

    // CSP sem wildcards permissivos
    expect(headersContent).toContain("default-src 'self'");
    expect(headersContent).toContain("object-src 'none'");

    // Políticas de Cache
    expect(headersContent).toContain("/assets/*");
    expect(headersContent).toContain("Cache-Control: public, max-age=31536000, immutable");

    expect(headersContent).toContain("/index.html");
    expect(headersContent).toContain("Cache-Control: public, max-age=0, must-revalidate");
  });

  it("assegura que o roteiro operacional no DEPLOYMENT.md cobre todas as etapas da Tarefa 4.2", () => {
    const deployContent = readFileSync(deploymentPath, "utf8");

    // 1. Vinculação de Domínio Customizado
    expect(deployContent).toContain("3.4 Vinculação de Domínio Customizado no Cloudflare Pages");
    expect(deployContent).toContain("Custom Domains");

    // 2. SSL/TLS Full (Strict)
    expect(deployContent).toContain("3.5 Criptografia SSL/TLS em Modo Full (Strict)");
    expect(deployContent).toContain("Full (strict)");
    expect(deployContent).toContain("Always Use HTTPS");

    // 3. Sincronização de URLs no Supabase
    expect(deployContent).toContain("3.6 Sincronização de URLs no Supabase (`URL Configuration`)");
    expect(deployContent).toContain("Site URL");
    expect(deployContent).toContain("Redirect URLs");

    // 4. Auditoria de Entrega dos Cabeçalhos
    expect(deployContent).toContain("3.7 Auditoria de Entrega dos Cabeçalhos de Borda");
    expect(deployContent).toContain("strict-transport-security");
    expect(deployContent).toContain("max-age=31536000, immutable");
  });
});
