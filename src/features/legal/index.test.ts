import { describe, expect, it } from "vitest";
import * as LegalModule from "./index";
import * as LegalPagesModule from "./pages";
import * as LegalComponentsModule from "./components";

describe("Barrels do módulo legal (src/features/legal)", () => {
  it("exporta as páginas públicas oficiais a partir de legal/pages e legal/index", () => {
    expect(LegalPagesModule.TermsPage).toBeDefined();
    expect(LegalPagesModule.PrivacyPage).toBeDefined();

    expect(LegalModule.TermsPage).toBe(LegalPagesModule.TermsPage);
    expect(LegalModule.PrivacyPage).toBe(LegalPagesModule.PrivacyPage);
  });

  it("exporta os componentes estruturais a partir de legal/components e legal/index", () => {
    expect(LegalComponentsModule.LegalPageShell).toBeDefined();
    expect(LegalModule.LegalPageShell).toBe(LegalComponentsModule.LegalPageShell);
  });
});
