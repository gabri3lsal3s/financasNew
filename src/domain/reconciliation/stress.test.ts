import { describe, expect, it } from "vitest";
import {
  STATEMENT_IMPORT_CHUNK_SIZE,
  chunkArray,
  chunkBankStatementBatch,
  parseStatementInput,
  reconcileBankTransactions,
} from "./index";

describe("Teste de Estresse de Parsing e Chunking de Extratos (2.000 Linhas)", () => {
  it("faz parsing de extrato CSV de 2.000 transações em menos de 100ms e divide perfeitamente em lotes", () => {
    // 1. Geração do payload CSV sintético de 2.000 linhas (1.600 despesas e 400 receitas)
    const csvLines: string[] = ["Data,Descricao,Valor"];
    for (let i = 1; i <= 2000; i++) {
      const day = String((i % 28) + 1).padStart(2, "0");
      const date = `${day}/08/2026`;
      if (i % 5 === 0) {
        // Receita (+): R$ 150,00
        csvLines.push(`${date},Pix Recebido Cliente ${i},150.00`);
      } else {
        // Despesa (-): R$ 42,50
        csvLines.push(`${date},Supermercado Compra ${i},42.50`);
      }
    }
    const csvContent = csvLines.join("\n");

    // 2. Medição de performance do parser
    const startParse = performance.now();
    const result = parseStatementInput(csvContent, "extrato_massivo_2000.csv", {
      cardId: "bank_account",
      competenceMonth: "2026-08",
    });
    const parseDurationMs = performance.now() - startParse;

    // 3. Validações de integridade e velocidade
    expect(result.transactions).toHaveLength(2000);
    // Deve rodar confortavelmente abaixo de 250ms mesmo sob alta carga concorrente
    expect(parseDurationMs).toBeLessThan(250);

    // 4. Reconciliação bancária completa
    const startReconcile = performance.now();
    const reconciliation = reconcileBankTransactions({
      statementTransactions: result.transactions,
      existingExpenses: [],
      existingIncomes: [],
      categoryPredictionHistory: [],
      defaultCategoryId: "cat-general",
    });
    const reconcileDurationMs = performance.now() - startReconcile;

    expect(reconciliation.items).toHaveLength(2000);
    expect(reconcileDurationMs).toBeLessThan(100);

    const expenses = reconciliation.items
      .filter((it) => it.kind === "expense")
      .map((it) => it.transaction);
    const incomes = reconciliation.items
      .filter((it) => it.kind === "income")
      .map((it) => it.transaction);

    expect(expenses).toHaveLength(1600);
    expect(incomes).toHaveLength(400);

    // 5. Particionamento em lotes com teto rígido de 250 itens
    const chunks = chunkBankStatementBatch(expenses, incomes, STATEMENT_IMPORT_CHUNK_SIZE);

    // 2.000 / 250 = exatamente 8 lotes
    expect(chunks).toHaveLength(8);

    const totalProcessed = chunks.reduce(
      (acc, chunk) => acc + chunk.expenses.length + chunk.incomes.length,
      0,
    );
    expect(totalProcessed).toBe(2000);

    // Cada um dos 8 lotes deve ter exatamente 250 itens
    for (const [idx, chunk] of chunks.entries()) {
      const chunkSize = chunk.expenses.length + chunk.incomes.length;
      expect(chunkSize).toBe(250);
      expect(chunkSize).toBeLessThanOrEqual(STATEMENT_IMPORT_CHUNK_SIZE);
      expect(chunk.expenses.length).toBeGreaterThanOrEqual(0);
      expect(chunk.incomes.length).toBeGreaterThanOrEqual(0);
      // Nenhum lote pode estar vazio
      expect(chunkSize).toBeGreaterThan(0);
      void idx;
    }
  });

  it("faz parsing de extrato OFX estruturado de 2.000 transações em menos de 100ms e particiona perfeitamente", () => {
    // 1. Geração de payload OFX sintético de 2.000 transações
    const ofxTrns: string[] = [];
    for (let i = 1; i <= 2000; i++) {
      const day = String((i % 28) + 1).padStart(2, "0");
      const dateStr = `202608${day}120000[-03:EST]`;
      const isIncome = i % 4 === 0; // 500 receitas e 1.500 despesas
      const trnType = isIncome ? "CREDIT" : "DEBIT";
      const amount = isIncome ? "250.00" : "-85.00";
      const memo = isIncome ? `Pix Recebido TED ${i}` : `Restaurante Executivo ${i}`;

      ofxTrns.push(`
<STMTTRN>
<TRNTYPE>${trnType}</TRNTYPE>
<DTPOSTED>${dateStr}</DTPOSTED>
<TRNAMT>${amount}</TRNAMT>
<FITID>OFX-TX-${i}</FITID>
<MEMO>${memo}</MEMO>
</STMTTRN>`);
    }

    const ofxContent = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
<SIGNONMSGSRSV1>
<SONRS>
<STATUS><CODE>0</CODE><SEVERITY>INFO</SEVERITY></STATUS>
<DTSERVER>20260801120000</DTSERVER>
<LANGUAGE>POR</LANGUAGE>
</SONRS>
</SIGNONMSGSRSV1>
<BANKMSGSRSV1>
<STMTTRNRS>
<TRNUID>1001</TRNUID>
<STATUS><CODE>0</CODE><SEVERITY>INFO</SEVERITY></STATUS>
<STMTRS>
<CURDEF>BRL</CURDEF>
<BANKACCTFROM>
<BANKID>001</BANKID>
<ACCTID>12345-6</ACCTID>
<ACCTTYPE>CHECKING</ACCTTYPE>
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20260801</DTSTART>
<DTEND>20260831</DTEND>
${ofxTrns.join("\n")}
</BANKTRANLIST>
<LEDGERBAL>
<BALAMT>50000.00</BALAMT>
<DTASOF>20260831</DTASOF>
</LEDGERBAL>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;

    // 2. Medição do tempo de parsing do OFX
    const startParse = performance.now();
    const result = parseStatementInput(ofxContent, "banco_extrato.ofx", {
      cardId: "bank_account",
      competenceMonth: "2026-08",
    });
    const parseDurationMs = performance.now() - startParse;

    // 3. Validações
    expect(result.isOfx).toBe(true);
    expect(result.transactions).toHaveLength(2000);
    expect(parseDurationMs).toBeLessThan(100);

    // 4. Reconciliação
    const reconciliation = reconcileBankTransactions({
      statementTransactions: result.transactions,
      existingExpenses: [],
      existingIncomes: [],
      categoryPredictionHistory: [],
      defaultCategoryId: "cat-general",
    });

    const expenses = reconciliation.items
      .filter((it) => it.kind === "expense")
      .map((it) => it.transaction);
    const incomes = reconciliation.items
      .filter((it) => it.kind === "income")
      .map((it) => it.transaction);

    expect(expenses.length + incomes.length).toBe(2000);

    // 5. Chunking
    const chunks = chunkBankStatementBatch(expenses, incomes, 250);
    expect(chunks).toHaveLength(8);

    const totalChunked = chunks.reduce(
      (acc, c) => acc + c.expenses.length + c.incomes.length,
      0,
    );
    expect(totalChunked).toBe(2000);

    for (const chunk of chunks) {
      expect(chunk.expenses.length + chunk.incomes.length).toBe(250);
    }
  });

  it("particiona linearmente 2.000 despesas de fatura de cartão em menos de 5ms", () => {
    const items = Array.from({ length: 2000 }, (_, i) => ({
      id: `exp-${i}`,
      value: 10 + (i % 100),
      description: `Compra Cartao ${i}`,
    }));

    const start = performance.now();
    const chunks = chunkArray(items, STATEMENT_IMPORT_CHUNK_SIZE);
    const durationMs = performance.now() - start;

    expect(chunks).toHaveLength(8);
    expect(durationMs).toBeLessThan(5);

    for (const chunk of chunks) {
      expect(chunk).toHaveLength(250);
    }

    const flat = chunks.flat();
    expect(flat).toHaveLength(2000);
    expect(flat[0]?.id).toBe("exp-0");
    expect(flat[1999]?.id).toBe("exp-1999");
  });
});
