import { describe, expect, it } from "vitest";
import {
  appRoutes,
  publicLegalRoutes,
  publicLegalLoaders,
  publicToolsRoutes,
  publicToolsLoaders,
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
    expect(paths).toContain("/familia");
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

  it("registra as rotas públicas dos simuladores em publicToolsRoutes", () => {
    const toolsPaths = publicToolsRoutes.map((r) => r.path);
    expect(toolsPaths).toEqual([
      "/ferramentas",
      "/ferramentas/simulador-dividas",
      "/ferramentas/rebalanceamento",
      "/ferramentas/juros-compostos",
    ]);
  });

  it("carrega os simuladores públicos sob demanda via publicToolsLoaders", async () => {
    const hubModule = await publicToolsLoaders["/ferramentas"]!();
    expect(hubModule.default).toBeDefined();

    const debtsModule = await publicToolsLoaders["/ferramentas/simulador-dividas"]!();
    expect(debtsModule.default).toBeDefined();

    const rebalanceModule = await publicToolsLoaders["/ferramentas/rebalanceamento"]!();
    expect(rebalanceModule.default).toBeDefined();

    const compoundModule = await publicToolsLoaders["/ferramentas/juros-compostos"]!();
    expect(compoundModule.default).toBeDefined();
  }, 60_000);

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
