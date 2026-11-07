import { describe, expect, it } from "vitest";
import {
  extractReceiptItems,
  formatReceiptItemsObservation,
} from "./receipt-item-extractor";

describe("receipt-item-extractor (Plano 10 — Tarefa 4.3 & 4.4)", () => {
  it("extrai itens de comprovante adicional com cálculo de 2 linhas", () => {
    const raw = `
      EMPRESA TESTE
      38 CERVEJA LONGNECK UN
      1,000 x R$ 6,000 => R$ 6,000
      139 GATORADE UN
      1,000 x R$ 4,500 => R$ 4,500
      Total R$ 10,50
    `;

    const items = extractReceiptItems(raw);
    expect(items.length).toBe(2);
    expect(items[0]?.description).toBe("CERVEJA LONGNECK");
    expect(items[0]?.quantity).toBe(1);
    expect(items[0]?.totalPriceCents).toBe(600);
    expect(items[1]?.description).toBe("GATORADE");
    expect(items[1]?.totalPriceCents).toBe(450);
  });

  it("extrai itens de cupom ECF clássico", () => {
    const raw = `
      001 21259003 DESOD SANIT PINH-SANIFECT -35G
      1X1,09 717,00% 1,09
      002 57192502 QUEIJO MUSSARELA-GIROLANDA -KG
      1X17,49 717,00% 17,49
      TOTAL R$ 18,58
    `;

    const items = extractReceiptItems(raw);
    expect(items.length).toBe(2);
    expect(items[0]?.description).toContain("DESOD SANIT");
    expect(items[0]?.totalPriceCents).toBe(109);
    expect(items[1]?.description).toContain("QUEIJO MUSSARELA");
    expect(items[1]?.totalPriceCents).toBe(1749);
  });

  it("extrai itens de NFC-e em linha única", () => {
    const raw = `
      3834 BOLAS COURO 2UN 1990 3980
      5501 PULVERIZADOR 3UN 786 2397
      Valor a Pagar R$: 270,00
    `;

    const items = extractReceiptItems(raw);
    expect(items.length).toBe(2);
    expect(items[0]?.description).toContain("BOLAS COURO");
    expect(items[0]?.quantity).toBe(2);
    expect(items[0]?.totalPriceCents).toBe(3980);
    expect(items[1]?.description).toContain("PULVERIZADOR");
    expect(items[1]?.quantity).toBe(3);
    expect(items[1]?.totalPriceCents).toBe(2397);
  });

  it("formata a lista de itens limpa para as observações da transação", () => {
    const items = [
      {
        description: "Bolas Couro",
        quantity: 2,
        unitPriceCents: 1990,
        totalPriceCents: 3980,
      },
      {
        description: "Pulverizador",
        quantity: 1,
        unitPriceCents: 2397,
        totalPriceCents: 2397,
      },
    ];

    const obs = formatReceiptItemsObservation(items);
    expect(obs).toContain("Itens do Cupom:");
    expect(obs).toContain("2x Bolas Couro (R$ 39,80)");
    expect(obs).toContain("1x Pulverizador (R$ 23,97)");
  });
});
