import { describe, expect, it } from "vitest";
import {
  csvWithBom,
  escapeCsvField,
  formatCsvDate,
  formatCsvDecimal,
  formatCsvFloat,
  serializeCardInvoiceCsv,
  serializeExpensesCsv,
  serializeIncomesCsv,
  serializeInvoicesCsv,
  serializePositionsCsv,
  toCsv,
} from "./csv";

describe("domain/export — CSV", () => {
  it("escapa campos com delimitador, aspas e quebras de linha", () => {
    expect(escapeCsvField("simples")).toBe("simples");
    expect(escapeCsvField('com "aspas"')).toBe('"com ""aspas"""');
    expect(escapeCsvField("com;vírgula")).toBe('"com;vírgula"');
    expect(escapeCsvField("com\nquebra")).toBe('"com\nquebra"');
  });

  it("monta CSV com delimitador ponto-e-vírgula e CRLF", () => {
    const csv = toCsv(["A", "B"], [[1, "x"], [2, "y"]]);
    expect(csv).toBe("A;B\r\n1;x\r\n2;y\r\n");
  });

  it("prefixa BOM UTF-8", () => {
    expect(csvWithBom("A;B\r\n")).toBe("\uFEFFA;B\r\n");
  });

  it("formata decimais pt-BR (vírgula) SEM separador de milhar (Excel lê como número)", () => {
    expect(formatCsvDecimal(123456)).toBe("1234,56");
    expect(formatCsvDecimal(1234567)).toBe("12345,67");
    expect(formatCsvDecimal(-500)).toBe("-5,00");
    expect(formatCsvFloat(0.5, 8)).toBe("0,5");
    expect(formatCsvFloat(1234.567, 2)).toBe("1.234,57");
    expect(formatCsvDate("2026-08-15")).toBe("15/08/2026");
  });

  it("serializa despesas com valor real e valor de relatório", () => {
    const csv = serializeExpensesCsv([
      {
        date: "2026-08-10",
        description: "Supermercado",
        categoryName: "Alimentação",
        valueCents: 25050,
        reportValueCents: 25050,
        paymentMethodLabel: "Débito",
        cardName: null,
        installments: "—",
      },
      {
        date: "2026-08-12",
        description: "Celular; novo",
        categoryName: "Eletrônicos",
        valueCents: 100000,
        reportValueCents: 80000,
        paymentMethodLabel: "Cartão de crédito",
        cardName: "Nubank",
        installments: "1/10",
      },
    ]);

    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("Data;Descrição;Categoria;Valor (R$);Valor p/ relatório (R$);Forma de pagamento;Cartão;Parcelas");
    expect(csv).toContain("10/08/2026;Supermercado;Alimentação;250,50;250,50;Débito;;—");
    expect(csv).toContain('12/08/2026;"Celular; novo";Eletrônicos;1000,00;800,00;Cartão de crédito;Nubank;1/10');
  });

  it("serializa receitas", () => {
    const csv = serializeIncomesCsv([
      {
        date: "2026-08-05",
        description: "Salário",
        categoryName: "Trabalho",
        valueCents: 500000,
        reportValueCents: 500000,
        receiveTypeLabel: "Pix",
      },
    ]);
    expect(csv).toContain("05/08/2026;Salário;Trabalho;5000,00;5000,00;Pix");
  });

  it("serializa a fatura do cartão com apenas os gastos da competência", () => {
    const csv = serializeCardInvoiceCsv([
      {
        date: "2026-08-03",
        description: "Mercado; semana",
        categoryName: "Alimentação",
        valueCents: 18050,
        reportValueCents: 18050,
        installments: "—",
      },
      {
        date: "2026-08-15",
        description: "Celular",
        categoryName: "Eletrônicos",
        valueCents: 100000,
        reportValueCents: 80000,
        installments: "1/10",
      },
    ]);
    expect(csv.startsWith("\uFEFFData;Descrição;Categoria;Valor (R$);Valor p/ relatório (R$);Parcelas\r\n")).toBe(true);
    expect(csv).toContain("03/08/2026;\"Mercado; semana\";Alimentação;180,50;180,50;—\r\n");
    expect(csv).toContain("15/08/2026;Celular;Eletrônicos;1000,00;800,00;1/10\r\n");
  });

  it("serializa a fatura vazia apenas com o cabeçalho (BOM incluído)", () => {
    const csv = serializeCardInvoiceCsv([]);
    expect(csv).toBe("\uFEFFData;Descrição;Categoria;Valor (R$);Valor p/ relatório (R$);Parcelas\r\n");
  });

  it("serializa faturas com pagamento e estorno", () => {
    const csv = serializeInvoicesCsv([
      { competenceMonth: "2026-08", cardName: "Nubank", amountCents: 45000, date: "2026-08-02", note: null, isRefund: false },
      { competenceMonth: "2026-07", cardName: "Inter", amountCents: 12050, date: "2026-07-03", note: "Estorno loja", isRefund: true },
    ]);
    expect(csv).toContain("2026-08;Nubank;450,00;02/08/2026;;Pagamento");
    expect(csv).toContain("2026-07;Inter;120,50;03/07/2026;Estorno loja;Estorno");
  });

  it("serializa posições com percentuais formatados", () => {
    const csv = serializePositionsCsv([
      {
        ticker: "ITUB4",
        assetClass: "Ações",
        currency: "BRL",
        quantity: 100,
        averageCost: 34.5,
        priceBRL: 40.25,
        valueBRL: 4025,
        unrealizedPnl: 575,
        unrealizedPct: 16.67,
        pct: 40.25,
      },
      {
        ticker: "Caixa",
        assetClass: null,
        currency: "BRL",
        quantity: 6000,
        averageCost: 1,
        priceBRL: 1,
        valueBRL: 6000,
        unrealizedPnl: 0,
        unrealizedPct: null,
        pct: 60,
      },
    ]);
    expect(csv).toContain("ITUB4;Ações;BRL;100;34,50;40,25;4025,00;575,00;16,67;40,25");
    expect(csv).toContain("Caixa;;BRL;6.000;1,00;1,00;6000,00;0,00;;60");
  });
});
