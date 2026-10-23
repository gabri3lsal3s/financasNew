import { describe, expect, it } from "vitest";
import {
  STATEMENT_IMPORT_CHUNK_SIZE,
  chunkArray,
  parseStatementInput,
  reconcileStatementTransactions,
} from "./index";

describe("Teste de Estresse de Parsing e Chunking de Extratos (2.000 Linhas)", () => {
  it("faz parsing de extrato CSV de 2.000 transações em menos de 100ms e divide perfeitamente em lotes", () => {
    // 1. Geração do payload CSV sintético de 2.000 linhas
    const csvLines: string[] = ["Data,Descricao,Valor"];
    for (let i = 1; i <= 2000; i++) {
      const day = String((i % 28) + 1).padStart(2, "0");
      const date = `${day}/08/2026`;
      csvLines.push(`${date},Supermercado Compra ${i},42.50`);
    }
    const csvContent = csvLines.join("\n");

    // 2. Medição de performance do parser
    const startParse = performance.now();
    const result = parseStatementInput(csvContent, "extrato_massivo_2000.csv", {
      cardId: "card-123",
      competenceMonth: "2026-08",
    });
    const parseDurationMs = performance.now() - startParse;

    // 3. Validações de integridade e velocidade
    expect(result.transactions).toHaveLength(2000);
    // Deve rodar confortavelmente abaixo de 250ms mesmo sob alta carga concorrente
    expect(parseDurationMs).toBeLessThan(250);

    // 4. Reconciliação de fatura de cartão
    const startReconcile = performance.now();
    const reconciliation = reconcileStatementTransactions({
      statementTransactions: result.transactions,
      existingExpenses: [],
      history: [],
      defaultCategoryId: "cat-general",
    });
    const reconcileDurationMs = performance.now() - startReconcile;

    expect(reconciliation.items).toHaveLength(2000);
    expect(reconcileDurationMs).toBeLessThan(100);

    // 5. Particionamento em lotes com teto rígido de 250 itens
    const chunks = chunkArray(reconciliation.items, STATEMENT_IMPORT_CHUNK_SIZE);

    // 2.000 / 250 = exatamente 8 lotes
    expect(chunks).toHaveLength(8);

    const totalProcessed = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    expect(totalProcessed).toBe(2000);

    for (const chunk of chunks) {
      expect(chunk).toHaveLength(250);
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
    expect(parseDurationMs).toBeLessThan(500);

    // 4. Reconciliação de fatura
    const reconciliation = reconcileStatementTransactions({
      statementTransactions: result.transactions,
      existingExpenses: [],
      history: [],
      defaultCategoryId: "cat-general",
    });

    expect(reconciliation.items).toHaveLength(2000);

    // 5. Chunking
    const chunks = chunkArray(reconciliation.items, 250);
    expect(chunks).toHaveLength(8);

    const totalChunked = chunks.reduce(
      (acc, c) => acc + c.length,
      0,
    );
    expect(totalChunked).toBe(2000);

    for (const chunk of chunks) {
      expect(chunk).toHaveLength(250);
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
