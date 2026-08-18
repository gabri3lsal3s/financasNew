import { describe, expect, it } from "vitest";
import { reconcileBankTransactions } from "./bank-reconciliation";
import { sniffColumnMapping } from "./parsers/type-sniffer";
import { buildTransactionsFromRows } from "./parsers";
import type {
  ExistingExpenseForReconciliation,
  ExistingIncomeForReconciliation,
  RawParsedRow,
  StatementTransaction,
} from "./types";

describe("domain/reconciliation - Bank Account Reconciliation", () => {
  const existingExpenses: ExistingExpenseForReconciliation[] = [
    {
      id: "exp-1",
      date: "2026-08-15",
      description: "Supermercado Pao de Acucar",
      valueCents: 18550,
      categoryId: "cat-groceries",
      installmentNumber: null,
      installmentsTotal: null,
    },
    {
      id: "exp-2",
      date: "2026-08-16",
      description: "Padaria do Bairro",
      valueCents: 2500,
      categoryId: "cat-groceries",
      installmentNumber: null,
      installmentsTotal: null,
    },
  ];

  const existingIncomes: ExistingIncomeForReconciliation[] = [
    {
      id: "inc-1",
      date: "2026-08-05",
      description: "Salário Empresa XPTO",
      valueCents: 850000,
      receiveType: "salario",
    },
    {
      id: "inc-2",
      date: "2026-08-10",
      description: "Freelance Consultoria",
      valueCents: 120000,
      receiveType: "pix",
    },
  ];

  const history = [
    { description: "Uber Viagem", categoryId: "cat-transport" },
    { description: "Restaurante Bom Sabor", categoryId: "cat-food" },
  ];

  it("identifica saídas normais e casa com despesas existentes (exact match)", () => {
    const transactions: StatementTransaction[] = [
      {
        id: "tx-1",
        index: 0,
        occurrenceIndex: 0,
        date: "2026-08-15",
        rawDescription: "DEB COMPRA PAO DE ACUCAR SP",
        cleanDescription: "COMPRA PAO DE ACUCAR",
        amountCents: 18550,
        isRefund: false,
        isPayment: false,
        statementHash: "hash-1",
      },
    ];

    const result = reconcileBankTransactions({
      statementTransactions: transactions,
      existingExpenses,
      existingIncomes,
      categoryPredictionHistory: history,
      defaultCategoryId: "cat-others",
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      kind: "expense",
      status: "exact_match",
      matchedExpenseId: "exp-1",
      selected: false,
    });
    expect(result.unmatchedExistingExpenses).toHaveLength(1);
    expect(result.unmatchedExistingExpenses[0]?.id).toBe("exp-2");
  });

  it("identifica entradas de receitas e deduz receiveType preditivo", () => {
    const transactions: StatementTransaction[] = [
      // 1. Salário correspondido
      {
        id: "tx-1",
        index: 0,
        occurrenceIndex: 0,
        date: "2026-08-05",
        rawDescription: "TED 001 0234 XPTO FOLHA PAGTO SALARIO",
        cleanDescription: "XPTO FOLHA PAGTO SALARIO",
        amountCents: 850000,
        isRefund: true, // Entrada/Crédito
        isPayment: false,
        statementHash: "hash-sal",
      },
      // 2. Novo PIX recebido não cadastrado
      {
        id: "tx-2",
        index: 1,
        occurrenceIndex: 0,
        date: "2026-08-18",
        rawDescription: "PIX RECEBIDO JOAO SILVA",
        cleanDescription: "PIX RECEBIDO JOAO SILVA",
        amountCents: 35000,
        isRefund: true,
        isPayment: false,
        statementHash: "hash-pix",
      },
    ];

    const result = reconcileBankTransactions({
      statementTransactions: transactions,
      existingExpenses,
      existingIncomes,
      categoryPredictionHistory: history,
      defaultCategoryId: "cat-others",
    });

    expect(result.items[0]).toMatchObject({
      kind: "income",
      status: "exact_match",
      matchedIncomeId: "inc-1",
      selected: false,
      selectedReceiveType: "salario",
    });

    expect(result.items[1]).toMatchObject({
      kind: "income",
      status: "unmatched_new",
      selected: true,
      selectedReceiveType: "pix",
    });
  });

  it("aplica trava Anti Double-Counting em pagamentos de fatura de cartão", () => {
    const transactions: StatementTransaction[] = [
      {
        id: "tx-1",
        index: 0,
        occurrenceIndex: 0,
        date: "2026-08-10",
        rawDescription: "PAGTO FATURA NUBANK 1234",
        cleanDescription: "PAGTO FATURA NUBANK",
        amountCents: 154020,
        isRefund: false,
        isPayment: true,
        statementHash: "hash-cc",
      },
    ];

    const result = reconcileBankTransactions({
      statementTransactions: transactions,
      existingExpenses,
      existingIncomes,
      categoryPredictionHistory: history,
      defaultCategoryId: "cat-others",
    });

    expect(result.items[0]).toMatchObject({
      kind: "card_payment_ignored",
      ignoredByDefault: true,
      selected: false,
      ignoreReason: expect.stringContaining("cartão de crédito"),
    });
  });

  it("aplica trava Anti Inflação em transferências internas e aportes de investimento", () => {
    const transactions: StatementTransaction[] = [
      {
        id: "tx-1",
        index: 0,
        occurrenceIndex: 0,
        date: "2026-08-12",
        rawDescription: "APLICACAO CDB LIQUIDEZ DIARIA",
        cleanDescription: "APLICACAO CDB LIQUIDEZ DIARIA",
        amountCents: 500000,
        isRefund: false,
        isPayment: false,
        statementHash: "hash-cdb",
      },
      {
        id: "tx-2",
        index: 1,
        occurrenceIndex: 0,
        date: "2026-08-14",
        rawDescription: "TED MESMA TITULARIDADE XP INVESTIMENTOS",
        cleanDescription: "TED MESMA TITULARIDADE XP INVESTIMENTOS",
        amountCents: 200000,
        isRefund: false,
        isPayment: false,
        statementHash: "hash-xp",
      },
    ];

    const result = reconcileBankTransactions({
      statementTransactions: transactions,
      existingExpenses,
      existingIncomes,
      categoryPredictionHistory: history,
      defaultCategoryId: "cat-others",
    });

    expect(result.items[0]?.kind).toBe("transfer_ignored");
    expect(result.items[0]?.selected).toBe(false);
    expect(result.items[1]?.kind).toBe("transfer_ignored");
    expect(result.items[1]?.selected).toBe(false);
  });

  it("reconhece colunas indicadoras D/C em CSVs bancários", () => {
    const rows: RawParsedRow[] = [
      {
        rowIndex: 0,
        rawText: "Data;Historico;Valor;D/C",
        cells: ["Data", "Historico", "Valor", "D/C"],
      },
      {
        rowIndex: 1,
        rawText: "15/08/2026;Restaurante Quilo;45,00;D",
        cells: ["15/08/2026", "Restaurante Quilo", "45,00", "D"],
      },
      {
        rowIndex: 2,
        rawText: "16/08/2026;Pix Recebido Maria;150,00;C",
        cells: ["16/08/2026", "Pix Recebido Maria", "150,00", "C"],
      },
    ];

    const mapping = sniffColumnMapping(rows);
    expect(mapping.hasHeader).toBe(true);
    expect(mapping.dateColIndex).toBe(0);
    expect(mapping.descriptionColIndex).toBe(1);
    expect(mapping.amountColIndex).toBe(2);
    expect(mapping.typeColIndex).toBe(3);

    const txs = buildTransactionsFromRows(rows, mapping, {
      cardId: "account-checking",
      competenceMonth: "2026-08",
    });

    expect(txs).toHaveLength(2);
    expect(txs[0]?.isRefund).toBe(false); // D -> Saída / Despesa
    expect(txs[1]?.isRefund).toBe(true); // C -> Entrada / Receita
  });
});

describe("domain/reconciliation - Quick-Paste — detecção de renda em linguagem natural", () => {
  const params = { cardId: "account-1", competenceMonth: "2026-08" };

  it("detecta renda em linha tabular com 'Pix Recebido' sem coluna D/C", () => {
    const rows: RawParsedRow[] = [
      {
        rowIndex: 0,
        rawText: "16/08/2026  Pix Recebido Joao Silva  150,00",
        cells: ["16/08/2026", "Pix Recebido Joao Silva", "150,00"],
      },
    ];
    const mapping = sniffColumnMapping(rows);
    const txs = buildTransactionsFromRows(rows, mapping, params);

    expect(txs).toHaveLength(1);
    expect(txs[0]?.isRefund).toBe(true);
    // rawDescription deve preservar texto original da linha
    expect(txs[0]?.rawDescription).toContain("Pix Recebido");
  });

  it("detecta renda em linha tabular com 'salario' sem coluna D/C", () => {
    const rows: RawParsedRow[] = [
      {
        rowIndex: 0,
        rawText: "05/08/2026  Salario Empresa XPTO  8500,00",
        cells: ["05/08/2026", "Salario Empresa XPTO", "8500,00"],
      },
    ];
    const mapping = sniffColumnMapping(rows);
    const txs = buildTransactionsFromRows(rows, mapping, params);

    expect(txs).toHaveLength(1);
    expect(txs[0]?.isRefund).toBe(true);
  });

  it("não confunde despesa comum com renda (sem falso-positivo)", () => {
    const rows: RawParsedRow[] = [
      {
        rowIndex: 0,
        rawText: "17/08/2026  Mercado Extra  125,00",
        cells: ["17/08/2026", "Mercado Extra", "125,00"],
      },
      {
        rowIndex: 1,
        rawText: "17/08/2026  Uber  32,50",
        cells: ["17/08/2026", "Uber", "32,50"],
      },
    ];
    const mapping = sniffColumnMapping(rows);
    const txs = buildTransactionsFromRows(rows, mapping, params);

    expect(txs).toHaveLength(2);
    expect(txs[0]?.isRefund).toBe(false);
    expect(txs[1]?.isRefund).toBe(false);
  });

  it("reconciliador classifica como income via rawDescription com 'pix recebido' (cenário bug antigo)", () => {
    const txs: StatementTransaction[] = [
      {
        id: "tx-nl-1",
        index: 0,
        occurrenceIndex: 0,
        date: "2026-08-18",
        rawDescription: "Pix Recebido Joao Silva 150,00",
        cleanDescription: "Pix Recebido Joao Silva",
        amountCents: 15000,
        isRefund: false,
        isPayment: false,
        statementHash: "hash-nl-1",
      },
    ];

    const result = reconcileBankTransactions({
      statementTransactions: txs,
      existingExpenses: [],
      existingIncomes: [],
      categoryPredictionHistory: [],
      defaultCategoryId: "cat-other",
    });

    expect(result.items[0]?.kind).toBe("income");
    expect(result.items[0]?.selected).toBe(true);
    expect(result.items[0]?.selectedReceiveType).toBe("pix");
  });

  it("reconciliador classifica 'recebi de' como income", () => {
    const txs: StatementTransaction[] = [
      {
        id: "tx-nl-2",
        index: 0,
        occurrenceIndex: 0,
        date: "2026-08-18",
        rawDescription: "recebi de Maria 200 reais",
        cleanDescription: "Maria",
        amountCents: 20000,
        isRefund: false,
        isPayment: false,
        statementHash: "hash-nl-2",
      },
    ];

    const result = reconcileBankTransactions({
      statementTransactions: txs,
      existingExpenses: [],
      existingIncomes: [],
      categoryPredictionHistory: [],
      defaultCategoryId: "cat-other",
    });

    expect(result.items[0]?.kind).toBe("income");
    expect(result.items[0]?.selected).toBe(true);
  });
});
