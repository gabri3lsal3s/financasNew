import { describe, expect, it } from "vitest";
import {
  PLAYBOOK_REGISTRY,
  getDismissedPlaybooksSummary,
  isPlaybookVisible,
} from "./registry";

describe("PLAYBOOK_REGISTRY", () => {
  it("contém os 6 módulos previstos com rótulos amigáveis", () => {
    expect(PLAYBOOK_REGISTRY.transactions?.shortLabel).toBe("Lançamentos");
    expect(PLAYBOOK_REGISTRY.business?.shortLabel).toBe("Negócio");
    expect(PLAYBOOK_REGISTRY.family?.shortLabel).toBe("Família");
    expect(PLAYBOOK_REGISTRY.trips?.shortLabel).toBe("Viagens");
    expect(PLAYBOOK_REGISTRY.investments?.shortLabel).toBe("Investimentos");
    expect(PLAYBOOK_REGISTRY.debts?.shortLabel).toBe("Dívidas");
  });
});

describe("isPlaybookVisible", () => {
  it("retorna false quando a chave mestre está desativada", () => {
    expect(isPlaybookVisible("transactions", false, [])).toBe(false);
    expect(isPlaybookVisible("transactions", false, ["family"])).toBe(false);
  });

  it("retorna false quando o módulo específico foi dispensado localmente", () => {
    expect(isPlaybookVisible("transactions", true, ["transactions"])).toBe(false);
    expect(isPlaybookVisible("family", true, ["family", "debts"])).toBe(false);
  });

  it("retorna true quando o módulo não foi dispensado e a chave mestre está ativa", () => {
    expect(isPlaybookVisible("transactions", true, [])).toBe(true);
    expect(isPlaybookVisible("transactions", true, ["family"])).toBe(true);
    expect(isPlaybookVisible("business", true, ["trips"])).toBe(true);
  });
});

describe("getDismissedPlaybooksSummary", () => {
  it("retorna string vazia quando não há dispensas", () => {
    expect(getDismissedPlaybooksSummary([])).toBe("");
  });

  it("formata singular corretamente para 1 guia ocultado", () => {
    expect(getDismissedPlaybooksSummary(["transactions"])).toBe(
      "1 guia individual ocultado (Lançamentos)",
    );
  });

  it("formata corretamente para 2 guias ocultados com conjunção 'e'", () => {
    expect(getDismissedPlaybooksSummary(["transactions", "family"])).toBe(
      "2 guias individuais ocultados (Lançamentos e Família)",
    );
  });

  it("formata lista com vírgulas e conjunção final para 3 ou mais guias", () => {
    expect(
      getDismissedPlaybooksSummary(["transactions", "family", "investments"]),
    ).toBe("3 guias individuais ocultados (Lançamentos, Família e Investimentos)");
  });

  it("usa a própria chave como fallback caso não esteja no registro", () => {
    expect(getDismissedPlaybooksSummary(["desconhecido"])).toBe(
      "1 guia individual ocultado (desconhecido)",
    );
  });
});
