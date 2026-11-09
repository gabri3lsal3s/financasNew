import { expect, test } from "@playwright/test";

test.describe("Smoke Tests E2E — Sanidade Crítica do App Shell", () => {
  test("1. Acesso à página de login sem tela branca ou erros não tratados de JS", async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on("pageerror", (err) => pageErrors.push(err));

    await page.goto("/entrar");

    // Garante que o elemento root foi montado
    const root = page.locator("#root");
    await expect(root).toBeVisible();

    // Valida que os campos de autenticação estão interativos
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();

    // Zero erros não tratados de runtime
    expect(pageErrors).toHaveLength(0);
  });

  test("2. Navegação em rota pública (Ferramentas/Simuladores) e carregamento sob demanda", async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on("pageerror", (err) => pageErrors.push(err));

    await page.goto("/ferramentas");

    // Verifica montagem da página de ferramentas
    const root = page.locator("#root");
    await expect(root).toBeVisible();

    // Zero erros não tratados no carregamento de chunks dinâmicos
    expect(pageErrors).toHaveLength(0);
  });

  test("3. Interatividade e digitação sem travamento de renderização", async ({ page }) => {
    await page.goto("/entrar");

    const emailInput = page.locator('input[type="email"]');
    await emailInput.fill("teste@axis.finance");
    await expect(emailInput).toHaveValue("teste@axis.finance");
  });

  test("4. Viewport Mobile: Ausência de transbordamento horizontal crítico", async ({ page }) => {
    await page.goto("/entrar");

    // Mede se a largura de rolagem do documento ultrapassa a viewport
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });

    expect(hasHorizontalOverflow).toBe(false);
  });
});
