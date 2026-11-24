import { describe, expect, it } from "vitest";
import { detectScopeConflict } from "./scope-conflict";

describe("scope-conflict (Prevenção de Confusão Patrimonial PF x PJ)", () => {
  it("detecta despesa de negócio realizada em cartão estritamente pessoal (elegível para reembolso)", () => {
    const result = detectScopeConflict({
      transactionScope: "business",
      cardScope: "personal",
      description: "AWS Cloud Services",
    });

    expect(result.hasConflict).toBe(true);
    expect(result.conflictKind).toBe("business_on_personal_card");
    expect(result.suggestedAction).toBe("request_reimbursement");
    expect(result.warningMessage).toContain("reembolsado");
  });

  it("detecta despesa pessoal realizada em cartão corporativo (alerta de retirada/pró-labore)", () => {
    const result = detectScopeConflict({
      transactionScope: "personal",
      cardScope: "business",
      description: "Almoço de domingo em família",
    });

    expect(result.hasConflict).toBe(true);
    expect(result.conflictKind).toBe("personal_on_business_card");
    expect(result.suggestedAction).toBe("record_as_pro_labore");
    expect(result.warningMessage).toContain("cartão corporativo");
  });

  it("detecta despesa flagrantemente doméstica lançada sob o escopo empresarial", () => {
    const result = detectScopeConflict({
      transactionScope: "business",
      cardScope: "business",
      description: "Supermercado Pão de Açúcar Semanal",
    });

    expect(result.hasConflict).toBe(true);
    expect(result.conflictKind).toBe("domestic_expense_in_business_scope");
    expect(result.suggestedAction).toBe("switch_to_personal");
  });

  it("não detecta conflito quando a transação e o cartão são consistentes", () => {
    const bizOnBiz = detectScopeConflict({
      transactionScope: "business",
      cardScope: "business",
      description: "Hospedagem Supabase Pro",
      categoryName: "Tecnologia",
    });
    expect(bizOnBiz.hasConflict).toBe(false);
    expect(bizOnBiz.conflictKind).toBe("none");

    const personalOnPersonal = detectScopeConflict({
      transactionScope: "personal",
      cardScope: "personal",
      description: "Cinema com amigos",
    });
    expect(personalOnPersonal.hasConflict).toBe(false);
    expect(personalOnPersonal.conflictKind).toBe("none");
  });

  it("não gera conflito em cartões com escopo misto ('mixed')", () => {
    const mixed = detectScopeConflict({
      transactionScope: "business",
      cardScope: "mixed",
      description: "Livro técnico de TypeScript",
    });
    expect(mixed.hasConflict).toBe(false);
    expect(mixed.conflictKind).toBe("none");
  });
});
