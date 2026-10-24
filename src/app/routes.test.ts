import { describe, expect, it } from "vitest";
import {
  appRoutes,
  publicLegalRoutes,
  publicLegalLoaders,
  prefetchPageChunks,
} from "./routes";

describe("app/routes", () => {
  it("contém as rotas protegidas principais em appRoutes", () => {
    const paths = appRoutes.map((r) => r.path);
    expect(paths).toContain("/");
    expect(paths).toContain("/transacoes");
    expect(paths).toContain("/cartoes");
    expect(paths).toContain("/relatorios");
    expect(paths).toContain("/investments");
    expect(paths).toContain("/carteira");
  });

  it("registra as rotas públicas legais em publicLegalRoutes", () => {
    const legalPaths = publicLegalRoutes.map((r) => r.path);
    expect(legalPaths).toEqual([
      "/termos",
      "/termos-de-uso",
      "/privacidade",
      "/politica-de-privacidade",
    ]);
  });

  it("carrega as páginas legais sob demanda via publicLegalLoaders", async () => {
    const termsModule = await publicLegalLoaders["/termos"]!();
    expect(termsModule.default).toBeDefined();

    const termsAliasModule = await publicLegalLoaders["/termos-de-uso"]!();
    expect(termsAliasModule.default).toBe(termsModule.default);

    const privacyModule = await publicLegalLoaders["/privacidade"]!();
    expect(privacyModule.default).toBeDefined();

    const privacyAliasModule = await publicLegalLoaders["/politica-de-privacidade"]!();
    expect(privacyAliasModule.default).toBe(privacyModule.default);
  }, 60_000);

  it("permite pré-carregar chunks de páginas públicas sem exceções", () => {
    expect(() => {
      prefetchPageChunks(["/termos", "/privacidade", "/rota-inexistente"]);
    }).not.toThrow();
  });
});
