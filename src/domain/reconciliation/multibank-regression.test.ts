import { describe, expect, it } from "vitest";
import {
  BUILTIN_STATEMENT_BLUEPRINTS,
  buildSpatialLinesFromRawLines,
  computeStatementFingerprint,
  detectFileKindFromBytes,
  evaluateBimodalPrecondition,
  evaluateStatementExtractionQuality,
  extractOfxMetadata,
  extractStatementSummaryAmounts,
  extractTransactionsFromSpatialLines,
  findBestStatementBlueprint,
  groupTokensIntoLines,
  parseCsvToRows,
  parseOfxToTransactions,
  parseSpreadsheetOrHtmlToRows,
  sniffColumnMapping,
  toSpatialBlueprintHints,
  buildTransactionsFromRows,
  type SpatialPdfToken,
} from "./index";

function writeUint16LE(buf: Uint8Array, offset: number, val: number): void {
  buf[offset] = val & 0xff;
  buf[offset + 1] = (val >>> 8) & 0xff;
}

function writeUint32LE(buf: Uint8Array, offset: number, val: number): void {
  buf[offset] = val & 0xff;
  buf[offset + 1] = (val >>> 8) & 0xff;
  buf[offset + 2] = (val >>> 16) & 0xff;
  buf[offset + 3] = (val >>> 24) & 0xff;
}

async function deflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream("deflate-raw");
  const writer = cs.writable.getWriter();
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  void writer.write(copy).then(() => writer.close());
  const ab = await new Response(cs.readable).arrayBuffer();
  return new Uint8Array(ab);
}

async function buildMinimalXlsxBuffer(files: Record<string, string>): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;
  let count = 0;

  for (const [name, content] of Object.entries(files)) {
    const nameBytes = encoder.encode(name);
    const rawBytes = encoder.encode(content);
    const compressed = await deflateRaw(rawBytes);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    writeUint32LE(localHeader, 0, 0x04034b50);
    writeUint16LE(localHeader, 4, 20);
    writeUint16LE(localHeader, 8, 8);
    writeUint32LE(localHeader, 18, compressed.length);
    writeUint32LE(localHeader, 22, rawBytes.length);
    writeUint16LE(localHeader, 26, nameBytes.length);
    localHeader.set(nameBytes, 30);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    writeUint32LE(centralHeader, 0, 0x02014b50);
    writeUint16LE(centralHeader, 4, 20);
    writeUint16LE(centralHeader, 6, 20);
    writeUint16LE(centralHeader, 10, 8);
    writeUint32LE(centralHeader, 20, compressed.length);
    writeUint32LE(centralHeader, 24, rawBytes.length);
    writeUint16LE(centralHeader, 28, nameBytes.length);
    writeUint32LE(centralHeader, 42, offset);
    centralHeader.set(nameBytes, 46);

    localParts.push(localHeader, compressed);
    centralParts.push(centralHeader);
    offset += localHeader.length + compressed.length;
    count += 1;
  }

  const centralSize = centralParts.reduce((acc, p) => acc + p.length, 0);
  const eocd = new Uint8Array(22);
  writeUint32LE(eocd, 0, 0x06054b50);
  writeUint16LE(eocd, 8, count);
  writeUint16LE(eocd, 10, count);
  writeUint32LE(eocd, 12, centralSize);
  writeUint32LE(eocd, 16, offset);

  const out = new Uint8Array(offset + centralSize + eocd.length);
  let pos = 0;
  for (const part of [...localParts, ...centralParts, eocd]) {
    out.set(part, pos);
    pos += part.length;
  }
  return out.buffer;
}

describe("Fase 5 — Suíte de Regressão Multibancos e Multi-Formatos (Plano v2.3)", () => {
  it("1. Nomad (3 páginas): exatamente 11 compras = R$ 1.528,54, cartões 2107/7756 e zero ruído", () => {
    const nomadLines = [
      "Nomad Cartao de Credito",
      "Resumo da fatura - Novembro de 2026",
      "Despesas e creditos do mes: R$ 1.528,54",
      "Valor da fatura: R$ 1.528,54",
      "Opcoes de parcelamento da fatura",
      "1x de R$ 1.623,04 Total a pagar: R$ 1.623,04 CET 425,72% a.a.",
      "Taxas taxa ao mes 14,90% a.m.",
      "--- PAGE 2 ---",
      "Extrato Referente ao mes de Novembro/2026",
      "Cartao **** **** **** 2107 - Titular",
      "Data Descricao Valor",
      "10/10 MERCADO CENTRAL 540,00",
      "10/10 POSTO AVENIDA 333,00",
      "14/10 FARMACIA POPULAR 150,00",
      "17/10 CAFETERIA EXPRESS 11,89",
      "18/10 RESTAURANTE SABOR 260,70",
      "18/10 PADARIA ESTRELA 40,70",
      "--- PAGE 3 ---",
      "Cartao •••• •••• •••• 7756 - Virtual",
      "25/10 STREAMING PLUS 27,15",
      "31/10 TRANSPORTE URBANO 8,80",
      "01/11 LIVRARIA MODERNA 83,00",
      "02/11 ASSINATURA CLOUD 16,00",
      "03/11 SUPERMERCADO DIA 57,30",
      "Autenticacao Mecanica",
      "23793.38128 60000.000003 00000.000400 1 84340000152854",
      "Vencimento 15/11/2026 Valor do Documento 1.528,54 Nosso Numero 47692302",
    ];

    const rawText = nomadLines.join("\n");
    const fp = computeStatementFingerprint({ rawText, fileKind: "pdf_text", fileName: "Nomad_2026-11.pdf" });
    const matched = findBestStatementBlueprint({
      fingerprint: fp,
      builtinBlueprints: BUILTIN_STATEMENT_BLUEPRINTS,
      fileKind: "pdf_text",
    });
    expect(matched?.blueprint.issuerKey).toBe("nomad");

    const summary = extractStatementSummaryAmounts(rawText);
    expect(summary.cycleNetTargetCents).toBe(152854);
    expect(summary.invoiceTotalCents).toBe(152854);

    const spatialLines = buildSpatialLinesFromRawLines(nomadLines);
    const extracted = extractTransactionsFromSpatialLines(spatialLines, {
      cardId: "card-nomad",
      competenceMonth: "2026-11",
      blueprintHints: toSpatialBlueprintHints(matched!.blueprint),
    });

    expect(extracted.transactions).toHaveLength(11);
    expect(extracted.detectedCardLast4s).toEqual(expect.arrayContaining(["2107", "7756"]));

    const gate = evaluateStatementExtractionQuality({
      transactions: extracted.transactions,
      officialTotalCents: summary.invoiceTotalCents,
      cycleNetTargetCents: summary.cycleNetTargetCents,
    });
    expect(gate.passed).toBe(true);
    expect(gate.score).toBe(100);
    expect(gate.cycleNetCents).toBe(152854);
    expect(gate.diffCents).toBe(0);
  });

  it("2. Rico / XP: boleto na capa (paused_boleto sem break) + cabeçalho mascarado e compras na pág. 2", () => {
    const ricoLines = [
      "Rico Investimentos - Cartao Visa Infinite",
      "Valor da fatura: R$ 685,40",
      "Recibo do Sacado",
      "34191.79001 01043.510047 91020.150008 4 89000000068540",
      "Vencimento 10/11/2026 Valor do Documento 685,40",
      "Data do Documento 01/11/2026 Nosso Numero 99887766",
      "--- PAGE 2 ---",
      "Lancamentos Compras e Saques",
      "Cartao XXXX XXXX XXXX 4821",
      "05/11 SUPERMERCADO ZONA SUL 435,40",
      "08/11 DROGARIA RAIA 150,00",
      "09/11 POSTO SHELL 100,00",
    ];

    const rawText = ricoLines.join("\n");
    const fp = computeStatementFingerprint({ rawText, fileKind: "pdf_text" });
    const matched = findBestStatementBlueprint({ fingerprint: fp, fileKind: "pdf_text" });
    expect(matched?.blueprint.issuerKey).toBe("rico");

    const extracted = extractTransactionsFromSpatialLines(buildSpatialLinesFromRawLines(ricoLines), {
      cardId: "card-rico",
      competenceMonth: "2026-11",
      blueprintHints: toSpatialBlueprintHints(matched!.blueprint),
    });

    expect(extracted.transactions).toHaveLength(3);
    expect(extracted.detectedCardLast4s).toContain("4821");
    const gate = evaluateStatementExtractionQuality({
      transactions: extracted.transactions,
      officialTotalCents: 68540,
    });
    expect(gate.passed).toBe(true);
    expect(gate.cycleNetCents).toBe(68540);
  });

  it("3. Nubank: datas DD MMM (OUT/NOV), estorno e pagamento anterior ignorado no ciclo", () => {
    const nubankLines = [
      "Nu Pagamentos S.A. - Nubank",
      "Valor da fatura: R$ 310,00",
      "Transacoes de 10 OUT a 10 NOV",
      "12 OUT Pagamento em 12 OUT -1.200,00",
      "15 OUT Amazon Brasil 01/03 250,00",
      "20 OUT Uber Trip 85,00",
      "22 OUT Estorno Uber Trip -25,00",
    ];

    const rawText = nubankLines.join("\n");
    const fp = computeStatementFingerprint({ rawText, fileKind: "pdf_text" });
    const matched = findBestStatementBlueprint({ fingerprint: fp, fileKind: "pdf_text" });
    expect(matched?.blueprint.issuerKey).toBe("nubank");

    const extracted = extractTransactionsFromSpatialLines(buildSpatialLinesFromRawLines(nubankLines), {
      cardId: "card-nu",
      competenceMonth: "2026-11",
      blueprintHints: toSpatialBlueprintHints(matched!.blueprint),
    });

    const purchases = extracted.transactions.filter((t) => !t.isPayment && !t.isRefund);
    const payments = extracted.transactions.filter((t) => t.isPayment);
    const refunds = extracted.transactions.filter((t) => t.isRefund);

    expect(purchases).toHaveLength(2);
    expect(payments).toHaveLength(1);
    expect(refunds).toHaveLength(1);

    const gate = evaluateStatementExtractionQuality({
      transactions: extracted.transactions,
      officialTotalCents: 31000,
    });
    expect(gate.passed).toBe(true);
    expect(gate.cycleNetCents).toBe(31000);
  });

  it("4. Itaú: 'Pagamentos Validos Normais' quitado + 'Pagamento por Pix' em compra (Pix no Crédito) preservado", () => {
    const itauLines = [
      "Itaucard Mastercard Black",
      "Total desta fatura: R$ 490,00",
      "Lancamentos Compras e Saques",
      "02/11 PAGAMENTOS VALIDOS NORMAIS -2.300,00",
      "05/11 PAGAMENTO POR PIX PADARIA CENTRAL 90,00",
      "10/11 LOJA DEPARTAMENTO 02/04 400,00",
    ];

    const rawText = itauLines.join("\n");
    const fp = computeStatementFingerprint({ rawText, fileKind: "pdf_text" });
    const matched = findBestStatementBlueprint({ fingerprint: fp, fileKind: "pdf_text" });
    expect(matched?.blueprint.issuerKey).toBe("itau");

    const extracted = extractTransactionsFromSpatialLines(buildSpatialLinesFromRawLines(itauLines), {
      cardId: "card-itau",
      competenceMonth: "2026-11",
      blueprintHints: toSpatialBlueprintHints(matched!.blueprint),
    });

    const payTx = extracted.transactions.find((t) => /pagamentos validos normais/i.test(t.rawDescription));
    const pixPurchase = extracted.transactions.find((t) => /padaria central/i.test(t.rawDescription));

    expect(payTx?.isPayment).toBe(true);
    expect(pixPurchase?.isPayment).toBe(false);
    expect(pixPurchase?.isRefund).toBe(false);
    expect(pixPurchase?.amountCents).toBe(9000);

    const gate = evaluateStatementExtractionQuality({
      transactions: extracted.transactions,
      officialTotalCents: 49000,
    });
    expect(gate.passed).toBe(true);
    expect(gate.cycleNetCents).toBe(49000);
  });

  it("5. Bradesco (2 colunas / bimodal): separa coluna esquerda e direita sem colidir valores", () => {
    const pageWidth = 600;
    const tok = (str: string, x: number, y: number): SpatialPdfToken => ({
      str,
      x,
      y,
      width: str.length * 5,
      height: 10,
      fontSize: 9,
    });

    const tokens: SpatialPdfToken[] = [
      // Coluna esquerda (x < 300)
      tok("10/11", 30, 700),
      tok("PADARIA ESQUERDA", 80, 700),
      tok("45,00", 240, 700),
      tok("11/11", 30, 680),
      tok("MERCADO ESQUERDA", 80, 680),
      tok("155,00", 240, 680),
      // Coluna direita (x >= 300)
      tok("12/11", 330, 700),
      tok("FARMACIA DIREITA", 380, 700),
      tok("80,00", 540, 700),
      tok("13/11", 330, 680),
      tok("POSTO DIREITA", 380, 680),
      tok("120,00", 540, 680),
    ];

    expect(evaluateBimodalPrecondition(tokens, pageWidth)).toBe(true);
    const lines = groupTokensIntoLines(tokens, pageWidth, true);
    const extracted = extractTransactionsFromSpatialLines(lines, {
      cardId: "card-bradesco",
      competenceMonth: "2026-11",
    });

    expect(extracted.transactions).toHaveLength(4);
    expect(extracted.transactions.map((t) => t.amountCents)).toEqual([4500, 15500, 8000, 12000]);

    const gate = evaluateStatementExtractionQuality({
      transactions: extracted.transactions,
      officialTotalCents: 40000,
    });
    expect(gate.passed).toBe(true);
    expect(gate.cycleNetCents).toBe(40000);
  });

  it("6. CSV brasileiro (sep=; + aspas com quebra de linha RFC-4180 + decimais com vírgula)", () => {
    const csv = [
      "sep=;",
      "Data;Estabelecimento;Valor",
      '10/11/2026;"Restaurante Silva, Filhos\nUnidade Centro";120,50',
      '12/11/2026;"Mercado Bom Preco, Loja 2";279,50',
    ].join("\n");

    const rows = parseCsvToRows(csv);
    const mapping = sniffColumnMapping(rows);
    const txs = buildTransactionsFromRows(rows, mapping, {
      cardId: "card-csv",
      competenceMonth: "2026-11",
    });

    expect(txs).toHaveLength(2);
    expect(txs[0]?.amountCents).toBe(12050);
    expect(txs[1]?.amountCents).toBe(27950);
    expect(txs[0]?.cleanDescription).toMatch(/Restaurante Silva/i);
  });

  it("7. OFX (-1.234,56 sem erro 1000x + TRNTYPE=OTHER + SALDO ANTERIOR descartado + <LEDGERBAL> informativo)", () => {
    const ofx = `
OFXHEADER:100
<OFX>
  <SIGNONMSGSRSV1><SONRS><FI><ORG>Banco Exemplo</FI></SONRS></SIGNONMSGSRSV1>
  <CREDITCARDMSGSRSV1><CCSTMTTRNRS><CCSTMTRS>
    <CCACCTFROM><ACCTID>5162000011119090</ACCTID></CCACCTFROM>
    <BANKTRANLIST>
      <STMTTRN><TRNTYPE>OTHER<DTPOSTED>20261101<TRNAMT>900,00<MEMO>SALDO ANTERIOR</STMTTRN>
      <STMTTRN><TRNTYPE>OTHER<DTPOSTED>20261102<TRNAMT>-900,00<MEMO>PAGAMENTO FATURA RECEBIDO</STMTTRN>
      <STMTTRN><TRNTYPE>OTHER<DTPOSTED>20261110<TRNAMT>1.234,56<MEMO>ELETRONICOS BRASIL</STMTTRN>
      <STMTTRN><TRNTYPE>OTHER<DTPOSTED>20261112<TRNAMT>65,44<MEMO>PADARIA CENTRAL</STMTTRN>
    </BANKTRANLIST>
    <LEDGERBAL><BALAMT>-2.500,00</BALAMT></LEDGERBAL>
  </CCSTMTRS></CCSTMTTRNRS></CREDITCARDMSGSRSV1>
</OFX>`;

    expect(detectFileKindFromBytes(new TextEncoder().encode(ofx), "extrato.txt")).toBe("ofx");
    const txs = parseOfxToTransactions(ofx, { cardId: "card-ofx", competenceMonth: "2026-11" });
    const meta = extractOfxMetadata(ofx);

    expect(meta.org).toBe("Banco Exemplo");
    expect(meta.acctLast4).toBe("9090");
    expect(meta.ledgerBalanceCents).toBe(250000);

    // SALDO ANTERIOR descartado; restam pagamento + 2 compras
    expect(txs).toHaveLength(3);
    const purchases = txs.filter((t) => !t.isPayment && !t.isRefund);
    expect(purchases).toHaveLength(2);
    expect(purchases[0]?.amountCents).toBe(123456);
    expect(purchases[1]?.amountCents).toBe(6544);

    // Mesmo com <LEDGERBAL> diferente da soma do ciclo, OFX estruturado NUNCA reprova no Quality Gate
    const gate = evaluateStatementExtractionQuality({
      transactions: txs,
      officialTotalCents: meta.ledgerBalanceCents,
      isOfx: true,
    });
    expect(gate.passed).toBe(true);
    expect(gate.score).toBe(100);
  });

  it("8. XLSX multi-aba com floats IEEE-754, inteiros intactos, t='d' e data+hora hh:mm:00", async () => {
    const xlsxBuffer = await buildMinimalXlsxBuffer({
      "xl/sharedStrings.xml": `<?xml version="1.0" encoding="UTF-8"?>
        <sst count="6" uniqueCount="6">
          <si><t>Capa</t></si>
          <si><t>Data</t></si>
          <si><t>Estabelecimento</t></si>
          <si><t>Valor</t></si>
          <si><t>Loja IEEE</t></si>
          <si><t>Cafe ISO</t></si>
        </sst>`,
      "xl/styles.xml": `<?xml version="1.0" encoding="UTF-8"?>
        <styleSheet>
          <numFmts count="1">
            <numFmt numFmtId="164" formatCode="dd/mm/yyyy hh:mm:00" />
          </numFmts>
          <cellXfs count="2">
            <xf numFmtId="0" />
            <xf numFmtId="164" />
          </cellXfs>
        </styleSheet>`,
      "xl/worksheets/sheet1.xml": `<?xml version="1.0" encoding="UTF-8"?>
        <worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c></row></sheetData></worksheet>`,
      "xl/worksheets/sheet2.xml": `<?xml version="1.0" encoding="UTF-8"?>
        <worksheet><sheetData>
          <row r="1">
            <c r="A1" t="s"><v>1</v></c>
            <c r="B1" t="s"><v>2</v></c>
            <c r="C1" t="s"><v>3</v></c>
          </row>
          <row r="2">
            <c r="A2" s="1"><v>46341.5</v></c>
            <c r="B2" t="s"><v>4</v></c>
            <c r="C2"><v>140.49999999999997</v></c>
          </row>
          <row r="3">
            <c r="A3" t="d"><v>2026-11-16T09:15:00Z</v></c>
            <c r="B3" t="s"><v>5</v></c>
            <c r="C3"><v>2.5E+2</v></c>
          </row>
        </sheetData></worksheet>`,
    });

    expect(detectFileKindFromBytes(new Uint8Array(xlsxBuffer), "fatura_sem_ext")).toBe("xlsx");
    const rows = await parseSpreadsheetOrHtmlToRows(xlsxBuffer);
    const mapping = sniffColumnMapping(rows);
    const txs = buildTransactionsFromRows(rows, mapping, {
      cardId: "card-xlsx",
      competenceMonth: "2026-11",
    });

    expect(txs).toHaveLength(2);
    expect(txs[0]?.date).toBe("2026-11-15");
    expect(txs[0]?.amountCents).toBe(14050);
    expect(txs[1]?.date).toBe("2026-11-16");
    expect(txs[1]?.amountCents).toBe(25000);
  });

  it("9. Equação Contábil Dupla: fatura com saldo anterior e pagamento parcial aprova sem falso conflito", () => {
    const lines = [
      "Fatura Cartao Credito",
      "Saldo anterior: R$ 1.000,00",
      "Pagamentos efetuados: R$ 600,00",
      "Valor da fatura: R$ 1.250,00",
      "Lancamentos",
      "02/11 PAGAMENTO RECEBIDO -600,00",
      "10/11 SUPERMERCADO CENTRAL 500,00",
      "12/11 FARMACIA POPULAR 350,00",
    ];

    const rawText = lines.join("\n");
    const summary = extractStatementSummaryAmounts(rawText);
    expect(summary.previousBalanceCents).toBe(100000);
    expect(summary.paymentsCents).toBe(60000);
    expect(summary.invoiceTotalCents).toBe(125000);

    const extracted = extractTransactionsFromSpatialLines(buildSpatialLinesFromRawLines(lines), {
      cardId: "card-carry",
      competenceMonth: "2026-11",
    });

    const gate = evaluateStatementExtractionQuality({
      transactions: extracted.transactions,
      officialTotalCents: summary.invoiceTotalCents,
      previousBalanceCents: summary.previousBalanceCents,
      paymentsCents: summary.paymentsCents,
    });

    expect(gate.checksumEquation).toBe("statement_balance");
    expect(gate.cycleNetCents).toBe(85000);
    expect(gate.statementBalanceCents).toBe(125000);
    expect(gate.diffCents).toBe(0);
    expect(gate.passed).toBe(true);
    expect(gate.score).toBe(100);
  });
});
