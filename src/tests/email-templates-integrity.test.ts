import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Auditoria de E-mails Transacionais & SMTP Resend (Go-Live)", () => {
  const emailTemplatesPath = join(process.cwd(), "docs/platforms/EMAIL_TEMPLATES.md");
  const deploymentPath = join(process.cwd(), "docs/platforms/DEPLOYMENT.md");

  it("verifica se a documentação de templates de e-mail existe e possui conteúdo", () => {
    const content = readFileSync(emailTemplatesPath, "utf8");
    expect(content).toContain("Templates de E-mail Transacionais — Áxis Finance");
    expect(content.length).toBeGreaterThan(1000);
  });

  it("garante a presença dos 4 templates oficiais com as variáveis de substituição do Supabase", () => {
    const content = readFileSync(emailTemplatesPath, "utf8");

    // 1. Confirm signup
    expect(content).toContain("Template 1: Confirmação de Cadastro (`Confirm signup`)");
    expect(content).toContain("Confirme sua conta no Áxis Finance");

    // 2. Reset password
    expect(content).toContain("Template 2: Recuperação de Senha (`Reset password`)");
    expect(content).toContain("Redefina sua senha de acesso - Áxis Finance");

    // 3. Invite user
    expect(content).toContain("Template 3: Convite de Acesso (`Invite user`)");
    expect(content).toContain("Você foi convidado para o Áxis Finance");

    // 4. Change email address
    expect(content).toContain("Template 4: Confirmação de Alteração de E-mail (`Change email address`)");
    expect(content).toContain("Confirme a alteração do seu e-mail - Áxis Finance");

    // Todos devem utilizar a variável obrigatória de confirmação do Supabase
    const confirmationMatches = content.match(/\{\{\s*\.ConfirmationURL\s*\}\}/g);
    expect(confirmationMatches).not.toBeNull();
    expect((confirmationMatches || []).length).toBeGreaterThanOrEqual(4);
  });

  it("valida parâmetros de conexão SMTP do Resend em EMAIL_TEMPLATES.md e DEPLOYMENT.md", () => {
    const templatesDoc = readFileSync(emailTemplatesPath, "utf8");
    const deployDoc = readFileSync(deploymentPath, "utf8");

    // Parâmetros canônicos do Resend
    for (const doc of [templatesDoc, deployDoc]) {
      expect(doc).toContain("smtp.resend.com");
      expect(doc).toContain("resend");
      expect(doc).toContain("Áxis Finance");
      expect(doc).toContain("v=spf1 include:amazonses.com ~all");
      expect(doc).toContain("resend._domainkey");
    }
  });

  it("garante conformidade estrita com a regra de ZERO emojis no produto e nos e-mails", () => {
    const content = readFileSync(emailTemplatesPath, "utf8");
    // Não deve conter emojis comuns
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    expect(emojiRegex.test(content)).toBe(false);
  });
});
