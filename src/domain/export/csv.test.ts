import { describe, expect, it } from "vitest";
import {
  csvWithBom,
  escapeCsvField,
  formatCsvDate,
  formatCsvDecimal,
  formatCsvFloat,
  serializeCardInvoiceCsv,
  serializeDebtsCsv,
  serializeExpensesCsv,
  serializeIncomesCsv,
  serializeInvoicesCsv,
  serializePortfolioActivitiesCsv,
  serializePositionsCsv,
  serializeUnifiedTransactionsCsv,
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
        dividends: 100,
        totalReturnPnl: 675,
        totalReturnPct: 19.57,
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
        dividends: 0,
        totalReturnPnl: 0,
        totalReturnPct: null,
        pct: 60,
      },
    ]);
    expect(csv).toContain("ITUB4;Ações;BRL;100;34,50;40,25;4025,00;575,00;100,00;19,57;40,25");
    expect(csv).toContain("Caixa;;BRL;6.000;1,00;1,00;6000,00;0,00;0,00;;60");
  });

  it("protege contra CSV/Formula Injection (DDE) prefixando com apóstrofo", () => {
    expect(escapeCsvField("=cmd|' /C calc'!A0")).toBe("'=cmd|' /C calc'!A0");
    expect(escapeCsvField("@SUM(1+1)*cmd|' /C calc'!A0")).toBe("'@SUM(1+1)*cmd|' /C calc'!A0");
    expect(escapeCsvField("+cmd|' /C calc'!A0")).toBe("'+cmd|' /C calc'!A0");
    expect(escapeCsvField("-cmd|' /C calc'!A0")).toBe("'-cmd|' /C calc'!A0");
    expect(escapeCsvField("\tmalicious")).toBe("'\tmalicious");

    // Números legítimos com sinal negativo/positivo não devem ser corrompidos
    expect(escapeCsvField("-15,50")).toBe("-15,50");
    expect(escapeCsvField("+100")).toBe("+100");

    // Espaços antes de gatilhos de injeção são detectados e tratados
    expect(escapeCsvField("  =cmd|' /C calc'!A0")).toBe("'  =cmd|' /C calc'!A0");
    expect(escapeCsvField("  +cmd")).toBe("'  +cmd");
    expect(escapeCsvField("  -cmd")).toBe("'  -cmd");
    expect(escapeCsvField("  @malicious")).toBe("'  @malicious");
    expect(escapeCsvField("  |pipeCommand")).toBe("'  |pipeCommand");
  });

  it("trata valores nulos ou indefinidos em toCsv sem emitir 'null' ou 'undefined'", () => {
    const csv = toCsv(["A", "B", "C"], [[null, undefined, "texto"]]);
    expect(csv).toBe("A;B;C\r\n;;texto\r\n");
  });

  it("trata -0 e números não finitos em formatCsvDecimal", () => {
    expect(formatCsvDecimal(-0)).toBe("0,00");
    expect(formatCsvDecimal(0)).toBe("0,00");
    expect(formatCsvDecimal(Number.NaN)).toBe("0,00");
    expect(formatCsvDecimal(Number.POSITIVE_INFINITY)).toBe("0,00");
  });

  it("serializa transações unificadas com data, tipo, detalhes e valores", () => {
    const csv = serializeUnifiedTransactionsCsv([
      {
        date: "2026-10-05",
        type: "income",
        description: "Salário Mensal",
        categoryName: "Trabalho",
        valueCents: 850000,
        reportValueCents: 850000,
        detailsOrMethod: "Pix",
        cardName: null,
        installments: "—",
        recurrenceLabel: "Mensal",
      },
      {
        date: "2026-10-12",
        type: "expense",
        description: "Supermercado Pão de Açúcar",
        categoryName: "Alimentação",
        valueCents: 45030,
        reportValueCents: 45030,
        detailsOrMethod: "Cartão de Crédito",
        cardName: "Nubank Ultravioleta",
        installments: "1/3",
      },
    ]);

    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("Data;Tipo;Descrição;Categoria;Valor (R$);Valor p/ relatório (R$);Forma / Detalhes;Cartão;Parcelas;Recorrência");
    expect(csv).toContain("05/10/2026;Receita;Salário Mensal;Trabalho;8500,00;8500,00;Pix;;—;Mensal");
    expect(csv).toContain("12/10/2026;Despesa;Supermercado Pão de Açúcar;Alimentação;450,30;450,30;Cartão de Crédito;Nubank Ultravioleta;1/3;");
  });

  it("serializa dívidas e contas a pagar e receber", () => {
    const csv = serializeDebtsCsv([
      {
        name: "Empréstimo Família",
        type: "payable",
        status: "Pendente",
        amountCents: 150000,
        dueDate: "2026-11-15",
        paidAt: null,
        notes: "Sem juros",
      },
      {
        name: "Venda notebook usado",
        type: "receivable",
        status: "Quitada",
        amountCents: 200000,
        dueDate: "2026-10-01",
        paidAt: "2026-10-02",
        notes: "Recebido via TED",
      },
    ]);

    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("Nome / Descrição;Tipo;Status;Valor (R$);Vencimento;Data de quitação;Observações");
    expect(csv).toContain("Empréstimo Família;A Pagar;Pendente;1500,00;15/11/2026;;Sem juros");
    expect(csv).toContain("Venda notebook usado;A Receber;Quitada;2000,00;01/10/2026;02/10/2026;Recebido via TED");
  });

  it("serializa movimentações de carteira com tipo, ticker, preços e quantidades", () => {
    const csv = serializePortfolioActivitiesCsv([
      {
        date: "2026-08-15",
        type: "Compra / Aporte",
        ticker: "PETR4",
        assetClass: "Ações",
        quantity: 100,
        price: 38.5,
        total: 3850,
        notes: "Ordem executada na B3",
      },
      {
        date: "2026-08-16",
        type: "Provento",
        ticker: "MXRF11",
        assetClass: "FIIs",
        quantity: null,
        price: null,
        total: 45.8,
        notes: "Rendimento mensal",
      },
    ]);

    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("Data;Tipo;Ticker / Ativo;Classe;Quantidade;Preço unitário (R$);Valor total (R$);Observações");
    expect(csv).toContain("15/08/2026;Compra / Aporte;PETR4;Ações;100;38,50;3850,00;Ordem executada na B3");
    expect(csv).toContain("16/08/2026;Provento;MXRF11;FIIs;;;45,80;Rendimento mensal");
  });
});
