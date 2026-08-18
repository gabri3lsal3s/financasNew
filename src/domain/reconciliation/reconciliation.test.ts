import { describe, expect, it } from "vitest";
import {
  calculateMatchScore,
  cleanDescription,
  extractInstallmentInfo,
  generateStatementHash,
  normalizeDateToISO,
  parseAmountToCents,
  parseCsvToRows,
  parseOfxToTransactions,
  parseStatementInput,
  parseTextToRows,
  reconcileStatementTransactions,
  sniffColumnMapping,
} from "./index";
import type { PredictionEntry } from "@/domain/predictions";
import type { ExistingExpenseForReconciliation, StatementTransaction } from "./types";

describe("domain/reconciliation", () => {
  describe("cleanDescription", () => {
    it("remove prefixos de adquirentes e intermediadores comuns", () => {
      expect(cleanDescription("PAG*PadariaEstrela")).toBe("PadariaEstrela");
      expect(cleanDescription("MP*MERCADOLIVRE")).toBe("MERCADOLIVRE");
      expect(cleanDescription("IFOOD *RESTAURANTE")).toBe("RESTAURANTE");
      expect(cleanDescription("UBER *TRIP")).toBe("TRIP");
      expect(cleanDescription("AMZN*PRIME")).toBe("PRIME");
      expect(cleanDescription("GOOGLE*YOUTUBE")).toBe("YOUTUBE");
    });

    it("remove sufixos de cidades", () => {
      expect(cleanDescription("FARMACIA SAO PAULO - SAO PAULO BR")).toBe("FARMACIA SAO PAULO");
      expect(cleanDescription("POSTO IPIRANGA - RIO DE JANEIRO")).toBe("POSTO IPIRANGA");
    });

    it("remove marcadores de parcelas embutidas", () => {
      expect(cleanDescription("MAGAZINE LUIZA (02/10)")).toBe("MAGAZINE LUIZA");
      expect(cleanDescription("CASAS BAHIA PARC 03/06")).toBe("CASAS BAHIA");
      expect(cleanDescription("RENNER 04 DE 05")).toBe("RENNER");
    });
  });

  describe("extractInstallmentInfo", () => {
    it("extrai parcelas em múltiplos formatos válidos", () => {
      expect(extractInstallmentInfo("LOJA ABC (02/10)")).toEqual({ current: 2, total: 10 });
      expect(extractInstallmentInfo("COMPRA XYZ PARC 03/12")).toEqual({ current: 3, total: 12 });
      expect(extractInstallmentInfo("MERCADO LIVRE 04 DE 06")).toEqual({ current: 4, total: 6 });
      expect(extractInstallmentInfo("ITEM 01/03")).toEqual({ current: 1, total: 3 });
    });

    it("ignora compras à vista ou valores fora do limite 1–60", () => {
      expect(extractInstallmentInfo("PADARIA ESTRELA")).toBeUndefined();
      expect(extractInstallmentInfo("COMPRA (01/01)")).toBeUndefined(); // Total 1 não é parcelamento
      expect(extractInstallmentInfo("COMPRA (10/80)")).toBeUndefined(); // > 60
      expect(extractInstallmentInfo("COMPRA (15/10)")).toBeUndefined(); // Current > total
    });
  });

  describe("hash determinístico ordinal", () => {
    it("gera o mesmo hash para parâmetros idênticos", () => {
      const h1 = generateStatementHash({
        cardId: "c1",
        competenceMonth: "2026-08",
        date: "2026-08-15",
        amountCents: 2500,
        cleanDescription: "Uber",
        occurrenceIndex: 0,
      });

      const h2 = generateStatementHash({
        cardId: "c1",
        competenceMonth: "2026-08",
        date: "2026-08-15",
        amountCents: 2500,
        cleanDescription: "Uber",
        occurrenceIndex: 0,
      });

      expect(h1).toBe(h2);
    });

    it("desambigua compras idênticas no mesmo dia via occurrenceIndex", () => {
      const h1 = generateStatementHash({
        cardId: "c1",
        competenceMonth: "2026-08",
        date: "2026-08-15",
        amountCents: 1000,
        cleanDescription: "Cafe",
        occurrenceIndex: 0,
      });

      const h2 = generateStatementHash({
        cardId: "c1",
        competenceMonth: "2026-08",
        date: "2026-08-15",
        amountCents: 1000,
        cleanDescription: "Cafe",
        occurrenceIndex: 1,
      });

      expect(h1).not.toBe(h2);
    });
  });

  describe("type-sniffer e parsing de valores e datas", () => {
    it("converte formatos de data para ISO YYYY-MM-DD", () => {
      expect(normalizeDateToISO("2026-08-15")).toBe("2026-08-15");
      expect(normalizeDateToISO("15/08/2026")).toBe("2026-08-15");
      expect(normalizeDateToISO("15-08-2026")).toBe("2026-08-15");
      expect(normalizeDateToISO("15/08/26")).toBe("2026-08-15");
      expect(normalizeDateToISO("15/08", 2026)).toBe("2026-08-15");
    });

    it("converte valores monetários para centavos inteiros", () => {
      expect(parseAmountToCents("R$ 1.250,75")).toEqual({ amountCents: 125075, isNegative: false });
      expect(parseAmountToCents("-50,00")).toEqual({ amountCents: 5000, isNegative: true });
      expect(parseAmountToCents("123.45")).toEqual({ amountCents: 12345, isNegative: false });
      expect(parseAmountToCents("(30,00)")).toEqual({ amountCents: 3000, isNegative: true });
    });

    it("identifica colunas por amostragem em CSV sem cabeçalho", () => {
      const csv = `
15/08/2026;Supermercado ABC;150,00
16/08/2026;Posto Shell;80,50
17/08/2026;Padaria Central;25,00
`;
      const rows = parseCsvToRows(csv);
      const mapping = sniffColumnMapping(rows);

      expect(mapping.dateColIndex).toBe(0);
      expect(mapping.descriptionColIndex).toBe(1);
      expect(mapping.amountColIndex).toBe(2);
      expect(mapping.hasHeader).toBe(false);
    });
  });

  describe("OFX Parser", () => {
    it("processa extrato bancário OFX com tags padrão", () => {
      const ofx = `
OFXHEADER:100
DATA:OFXSGML
<OFX>
<CREDITCARDMSGSRSV1>
<CCSTMTTRNRS>
<CCSTMTRS>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260815120000[-3:BRT]
<TRNAMT>-150.00
<MEMO>PAG*SUPERMERCADO DIA (01/03)
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260816120000[-3:BRT]
<TRNAMT>-45.90
<MEMO>UBER *TRIP SAO PAULO
</STMTTRN>
</BANKTRANLIST>
</CCSTMTRS>
</CCSTMTTRNRS>
</CREDITCARDMSGSRSV1>
</OFX>
`;
      const result = parseOfxToTransactions(ofx, { cardId: "card-1", competenceMonth: "2026-08" });

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        date: "2026-08-15",
        cleanDescription: "SUPERMERCADO DIA",
        amountCents: 15000,
        installment: { current: 1, total: 3 },
      });
      expect(result[1]).toMatchObject({
        date: "2026-08-16",
        cleanDescription: "TRIP SAO PAULO",
        amountCents: 4590,
      });
    });
  });

  describe("Text Parser (Quick-Paste)", () => {
    it("processa linhas copiadas por tabulação ou múltiplos espaços", () => {
      const text = `
15/08/2026\tRestaurante Quilo\t55,00
16/08/2026\tFarmacia Droga Raia\t32,40
`;
      const rows = parseTextToRows(text);
      expect(rows).toHaveLength(2);
      expect(rows[0]?.cells).toEqual(["15/08/2026", "Restaurante Quilo", "55,00"]);
    });
  });

  describe("Scoring e Reconciliação", () => {
    const existing: ExistingExpenseForReconciliation[] = [
      {
        id: "exp-1",
        date: "2026-08-15",
        description: "Supermercado Dia",
        valueCents: 15000,
        categoryId: "cat-groceries",
        installmentNumber: null,
        installmentsTotal: null,
      },
    ];

    const history: PredictionEntry[] = [
      {
        id: "h-1",
        kind: "expense",
        description: "Uber Trip",
        categoryId: "cat-transport",
        categoryName: "Transporte",
        paymentMethod: "credit_card",
        cardId: "card-1",
        receiveType: null,
        value: 45.9,
        date: "2026-08-10",
      },
    ];

    it("pontua match exato quando valor, data e texto coincidem", () => {
      const stmt: StatementTransaction = {
        id: "stmt-1",
        index: 0,
        occurrenceIndex: 0,
        date: "2026-08-15",
        rawDescription: "PAG*Supermercado Dia",
        cleanDescription: "Supermercado Dia",
        amountCents: 15000,
        isRefund: false,
        isPayment: false,
        statementHash: "hash-1",
      };

      const score = calculateMatchScore(stmt, existing[0]!);
      expect(score).toBe(100); // 50 (valor) + 25 (data) + 25 (texto)
    });

    it("retorna score 0 se o valor em centavos for diferente", () => {
      const stmt: StatementTransaction = {
        id: "stmt-1",
        index: 0,
        occurrenceIndex: 0,
        date: "2026-08-15",
        rawDescription: "Supermercado Dia",
        cleanDescription: "Supermercado Dia",
        amountCents: 15001, // 1 centavo de diferença
        isRefund: false,
        isPayment: false,
        statementHash: "hash-1",
      };

      const score = calculateMatchScore(stmt, existing[0]!);
      expect(score).toBe(0);
    });

    it("classifica itens corretamente na reconciliação completa com predição de categorias", () => {
      const statements: StatementTransaction[] = [
        {
          id: "stmt-1",
          index: 0,
          occurrenceIndex: 0,
          date: "2026-08-15",
          rawDescription: "PAG*Supermercado Dia",
          cleanDescription: "Supermercado Dia",
          amountCents: 15000,
          isRefund: false,
          isPayment: false,
          statementHash: "hash-1",
        },
        {
          id: "stmt-2",
          index: 1,
          occurrenceIndex: 0,
          date: "2026-08-16",
          rawDescription: "Uber Trip",
          cleanDescription: "Uber Trip",
          amountCents: 4590,
          isRefund: false,
          isPayment: false,
          statementHash: "hash-2",
        },
      ];

      const reconciled = reconcileStatementTransactions({
        statementTransactions: statements,
        existingExpenses: existing,
        history,
        defaultCategoryId: "cat-outros",
      });

      expect(reconciled).toHaveLength(2);

      // 1. Deve ser exact_match e desmarcado por padrão
      expect(reconciled[0]?.status).toBe("exact_match");
      expect(reconciled[0]?.matchedExpenseId).toBe("exp-1");
      expect(reconciled[0]?.selected).toBe(false);

      // 2. Deve ser unmatched_new com categoria predita 'cat-transport' e marcado
      expect(reconciled[1]?.status).toBe("unmatched_new");
      expect(reconciled[1]?.suggestedCategoryId).toBe("cat-transport");
      expect(reconciled[1]?.selected).toBe(true);
    });

    it("desmarca por padrão itens que casam como sugestão provável (probable_match)", () => {
      const existingExpense: ExistingExpenseForReconciliation = {
        id: "exp-old",
        date: "2026-08-01",
        description: "Assinatura Antiga",
        valueCents: 9699,
        categoryId: "cat-sub",
        installmentNumber: null,
        installmentsTotal: null,
      };

      const stmt: StatementTransaction = {
        id: "stmt-match-diff-date",
        index: 0,
        occurrenceIndex: 0,
        date: "2026-08-07", // Diferença de 6 dias
        rawDescription: "Google AI Pro",
        cleanDescription: "Google AI Pro",
        amountCents: 9699, // Mesmo valor
        isRefund: false,
        isPayment: false,
        statementHash: "hash-diff",
      };

      const reconciled = reconcileStatementTransactions({
        statementTransactions: [stmt],
        existingExpenses: [existingExpense],
        history: [],
        defaultCategoryId: "cat-outros",
      });

      expect(reconciled[0]?.status).toBe("probable_match");
      expect(reconciled[0]?.matchedExpenseId).toBe("exp-old");
      // CRÍTICO: Não deve vir selecionado por padrão para evitar despesas duplicadas
      expect(reconciled[0]?.selected).toBe(false);
    });

    it("classifica como exact_match quando valor e data coincidem exatamente, mesmo com texto divergente", () => {
      const stmt: StatementTransaction = {
        id: "stmt-exact",
        index: 0,
        occurrenceIndex: 0,
        date: "2026-08-15",
        rawDescription: "GABRIEL I S SALES",
        cleanDescription: "GABRIEL I S SALES",
        amountCents: 15000,
        isRefund: false,
        isPayment: false,
        statementHash: "hash-exact",
      };

      const score = calculateMatchScore(stmt, existing[0]!);
      expect(score).toBe(85); // 50 (valor) + 35 (data)

      const reconciled = reconcileStatementTransactions({
        statementTransactions: [stmt],
        existingExpenses: existing,
        history: [],
        defaultCategoryId: "cat-outros",
      });

      expect(reconciled[0]?.status).toBe("exact_match");
      expect(reconciled[0]?.selected).toBe(false);
    });
  });

  describe("type-sniffer com coluna de titular", () => {
    it("ignora coluna de titular constante e seleciona o estabelecimento real", () => {
      const csv = `
Titular;Data;Estabelecimento;Valor
GABRIEL I S SALES;06/08/2026;Gasolina;100,00
GABRIEL I S SALES;07/08/2026;Saúde Drogaria;25,00
GABRIEL I S SALES;07/08/2026;Google AI Pro;96,99
GABRIEL I S SALES;10/08/2026;Seguro Corolla;222,34
`;
      const rows = parseCsvToRows(csv);
      const mapping = sniffColumnMapping(rows);

      expect(mapping.hasHeader).toBe(true);
      expect(mapping.dateColIndex).toBe(1);
      expect(mapping.descriptionColIndex).toBe(2); // Deve ser Estabelecimento (col 2), NÃO Titular (col 0)
      expect(mapping.amountColIndex).toBe(3);
    });
  });

  describe("parseStatementInput (Hub Universal)", () => {
    it("faz parsing completo de arquivo CSV para transações normalizadas", () => {
      const csv = `Data;Estabelecimento;Valor
15/08/2026;Padaria Bella Vista;42,50
16/08/2026;Posto Ipiranga;120,00`;

      const result = parseStatementInput(csv, "fatura.csv", {
        cardId: "card-123",
        competenceMonth: "2026-08",
      });

      expect(result.isOfx).toBe(false);
      expect(result.transactions).toHaveLength(2);
      expect(result.transactions[0]?.date).toBe("2026-08-15");
      expect(result.transactions[0]?.cleanDescription).toBe("Padaria Bella Vista");
      expect(result.transactions[0]?.amountCents).toBe(4250);
    });
  });
});
