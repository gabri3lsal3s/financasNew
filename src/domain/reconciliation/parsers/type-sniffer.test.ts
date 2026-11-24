import { describe, expect, it } from "vitest";
import { buildTransactionsFromRows } from "./index";
import { parseAmountToCents, sniffColumnMapping } from "./type-sniffer";
import type { RawParsedRow } from "../types";

describe("type-sniffer — Notação Científica, Milhar BRL vs Decimal US e Coluna Descrição (#4, #21)", () => {
  it("converte notação científica (2.5E+3) corretamente em centavos", () => {
    const sci = parseAmountToCents("2.5E+3");
    expect(sci).not.toBeNull();
    expect(sci?.amountCents).toBe(250000);
    expect(sci?.isNegative).toBe(false);

    const negSci = parseAmountToCents("-1.25e+2");
    expect(negSci?.amountCents).toBe(12500);
    expect(negSci?.isNegative).toBe(true);
  });

  it("trata 1.500 como milhar no contexto BRL e como decimal 1,50 quando preferDotDecimal=true", () => {
    expect(parseAmountToCents("1.500")?.amountCents).toBe(150000);
    expect(parseAmountToCents("R$ 1.500", { preferDotDecimal: true })?.amountCents).toBe(150000);
    expect(parseAmountToCents("1.500", { preferDotDecimal: true })?.amountCents).toBe(150);
    expect(parseAmountToCents("1.200.000", { preferDotDecimal: true })?.amountCents).toBe(120000000);
  });

  it("protege arquivos em padrão americano contra interpretação indevida de 1.500 como milhar", () => {
    const usRows: RawParsedRow[] = [
      { rowIndex: 0, rawText: "Date\tDescription\tAmount", cells: ["Date", "Description", "Amount"] },
      { rowIndex: 1, rawText: "2026-11-10\tCoffee Shop\t12.50", cells: ["2026-11-10", "Coffee Shop", "12.50"] },
      { rowIndex: 2, rawText: "2026-11-11\tParking Meter\t1.500", cells: ["2026-11-11", "Parking Meter", "1.500"] },
    ];

    const mapping = sniffColumnMapping(usRows);
    const txs = buildTransactionsFromRows(usRows, mapping, {
      cardId: "card-us",
      competenceMonth: "2026-11",
    });

    expect(txs).toHaveLength(2);
    expect(txs[0]?.amountCents).toBe(1250);
    expect(txs[1]?.amountCents).toBe(150);
  });

  it("nunca colide descriptionColIndex com dateColIndex em tabelas de 3 colunas mesmo com palavras D/C (#4)", () => {
    const rows: RawParsedRow[] = [
      { rowIndex: 0, rawText: "10/11/2026\tDebito\t50,00", cells: ["10/11/2026", "Debito", "50,00"] },
      { rowIndex: 1, rawText: "11/11/2026\tDebito\t75,00", cells: ["11/11/2026", "Debito", "75,00"] },
      { rowIndex: 2, rawText: "12/11/2026\tCredito\t30,00", cells: ["12/11/2026", "Credito", "30,00"] },
    ];

    const mapping = sniffColumnMapping(rows);
    expect(mapping.dateColIndex).toBe(0);
    expect(mapping.descriptionColIndex).toBe(1);
    expect(mapping.descriptionColIndex).not.toBe(mapping.dateColIndex);
    expect(mapping.typeColIndex).toBeUndefined();
  });
});
