import { describe, expect, it } from "vitest";
import { buildTransactionsFromRows } from "./index";
import {
  alignInstallmentDateToCompetence,
  isValidCalendarDate,
  normalizeDateToISO,
  parseAmountToCents,
  resolveDateForStatementCycle,
  sniffColumnMapping,
} from "./type-sniffer";
import type { RawParsedRow } from "../contracts";

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

describe("Guardas P0 Onda 1 — Calendário (G1), Ciclo DD/MM (G2), Datas D13 e Compra vs Entrada (G3)", () => {
  it("G1: valida rigorosamente datas de calendário sem roll-over silencioso do Date()", () => {
    expect(isValidCalendarDate(2026, 2, 31)).toBe(false);
    expect(isValidCalendarDate(2026, 2, 29)).toBe(false);
    expect(isValidCalendarDate(2028, 2, 29)).toBe(true);

    expect(normalizeDateToISO("31/02/2026")).toBeNull();
    expect(normalizeDateToISO("29/02/2026")).toBeNull();
    expect(normalizeDateToISO("29/02/2028")).toBe("2028-02-29");
    expect(normalizeDateToISO("12.50")).toBeNull();
  });

  it("G2: resolve DD/MM ancorado no ciclo de fechamento, incluindo borda de parcela 12/12 no ano anterior", () => {
    // Virada Dez -> Jan: compra em 28/12 dentro da fatura de janeiro 2027 -> 2026-12-28
    expect(
      resolveDateForStatementCycle("28/12", {
        competenceMonth: "2027-01",
        closingDay: 5,
      }),
    ).toBe("2026-12-28");

    // Compra em 02/01 dentro da fatura de dezembro 2026 (closingDay=31 + margem 5d -> até 05/01/2027) -> 2027-01-02
    expect(
      resolveDateForStatementCycle("02/01", {
        competenceMonth: "2026-12",
        closingDay: 31,
      }),
    ).toBe("2027-01-02");

    // Compra em 15/01 numa fatura 2026-12 passa do corte -> recua para 2026-01-15
    expect(
      resolveDateForStatementCycle("15/01", {
        competenceMonth: "2026-12",
        closingDay: 10,
      }),
    ).toBe("2026-01-15");

    // Borda critica 12/12: fatura 2026-11 com fechamento dia 25 e parcela 12/12 de compra feita em 15/12/2025
    expect(
      resolveDateForStatementCycle("15/12", {
        competenceMonth: "2026-11",
        closingDay: 25,
      }),
    ).toBe("2025-12-15");

    // Borda equivalente no meio do ano: 15/05 numa fatura 2026-04 (closingDay=20) recua para 2025-05-15
    expect(
      resolveDateForStatementCycle("15/05", {
        competenceMonth: "2026-04",
        closingDay: 20,
      }),
    ).toBe("2025-05-15");
  });

  it("D13: alinha datas de parcelas na competência respeitando APP_START_DATE (2026-01-01) sem destruir compras antigas", () => {
    // Parcela 12/12 de 15/12/2025 na fatura 2026-11 -> alinha para 2026-11-15 (sem travar em 2026-01-01)
    expect(
      alignInstallmentDateToCompetence("2025-12-15", "2026-11", { current: 12, total: 12 }),
    ).toEqual({
      effectiveDate: "2026-11-15",
      originalDate: "2025-12-15",
    });

    // Parcela 4/10 comprada em 15/08/2026 na fatura 2026-11 -> 2026-11-15
    expect(
      alignInstallmentDateToCompetence("2026-08-15", "2026-11", { current: 4, total: 10 }),
    ).toMatchObject({
      effectiveDate: "2026-11-15",
      originalDate: "2026-08-15",
    });

    // Compra à vista (1/1 ou sem parcela) preserva data real
    expect(
      alignInstallmentDateToCompetence("2026-10-28", "2026-11", { current: 1, total: 1 }),
    ).toMatchObject({
      effectiveDate: "2026-10-28",
    });
  });

  it("G3: nunca marca estabelecimento com palavra DEPOSITO/CREDITO positivo como estorno automático", () => {
    const parsed = buildTransactionsFromRows(
      [
        {
          rowIndex: 0,
          rawText: "10/11/2026\tDEPOSITO DE BEBIDAS CENTRAL\t120,00",
          cells: ["10/11/2026", "DEPOSITO DE BEBIDAS CENTRAL", "120,00"],
        },
        {
          rowIndex: 1,
          rawText: "12/11/2026\tDEPOSITO EXTRA\t45,00",
          cells: ["12/11/2026", "DEPOSITO EXTRA", "45,00"],
        },
      ],
      {
        dateColIndex: 0,
        descriptionColIndex: 1,
        amountColIndex: 2,
        hasHeader: false,
        startRowIndex: 0,
      },
      {
        cardId: "card-1",
        competenceMonth: "2026-11",
      },
    );

    expect(parsed).toHaveLength(2);
    expect(parsed[0]?.isRefund).toBe(false);
    expect(parsed[1]?.isRefund).toBe(false);
  });
});
