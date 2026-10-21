import { describe, expect, it } from "vitest";
import { cleanDescription } from "./clean";

describe("reconciliation/clean — Higienização de Linhas de Extrato Bancário", () => {
  it("remove prefixos de adquirentes e maquininhas", () => {
    expect(cleanDescription("PAG*Padaria Estrela")).toBe("Padaria Estrela");
    expect(cleanDescription("MP*Mercado Livre")).toBe("Mercado Livre");
    expect(cleanDescription("IFOOD *RESTAURANTE")).toBe("RESTAURANTE");
  });

  it("remove códigos de parcelamento", () => {
    expect(cleanDescription("Lojas Americanas (01/03)")).toBe("Lojas Americanas");
    expect(cleanDescription("Magazine Luiza PARC 02/05")).toBe("Magazine Luiza");
    expect(cleanDescription("Casas Bahia em 10x")).toBe("Casas Bahia");
  });

  it("remove identificadores de terminais POS, NSU e horários", () => {
    expect(cleanDescription("Restaurante Fogão POS 12345 13:45")).toBe("Restaurante Fogão");
    expect(cleanDescription("Farmacia Central NSU 987654")).toBe("Farmacia Central");
  });

  it("remove sufixos de cidades padrão", () => {
    expect(cleanDescription("Supermercado Dia - SAO PAULO BR")).toBe("Supermercado Dia");
  });

  it("lida com strings vazias e textos já limpos", () => {
    expect(cleanDescription("")).toBe("");
    expect(cleanDescription("Padaria Estrela")).toBe("Padaria Estrela");
  });
});
