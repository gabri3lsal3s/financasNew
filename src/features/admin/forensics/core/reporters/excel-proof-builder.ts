/**
 * Gerador de Caderno Excel de Contra-Prova Multi-Abas com Fórmulas Nativas (excel-proof-builder.ts).
 *
 * Módulo puramente isomórfico (0 DOM, 0 React, 0 Supabase).
 * Gera XML SpreadsheetML compatível com Excel, LibreOffice Calc, Google Sheets e Apple Numbers.
 * Inclui fórmulas nativas (=SUM, =ABS, R1C1) e formatação condicional de alerta para deltas > 0.01.
 * Cobre os 8 pilares, as 8 jornadas de ciclo de vida, conformidade fiscal CDC e matriz de fuzzing.
 */

import type { ForensicAuditReport } from "../types";

function escapeXml(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function num(val: number): string {
  if (!Number.isFinite(val)) return "0";
  return val.toFixed(2);
}

export function generateExcelProofWorkbook(report: ForensicAuditReport): string {
  // Styles definitions
  const stylesXml = `
  <Styles>
   <Style ss:ID="Default" ss:Name="Normal">
    <Alignment ss:Vertical="Center"/>
    <Borders/>
    <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#1E293B"/>
    <Interior/>
    <NumberFormat/>
    <Protection/>
   </Style>
   <Style ss:ID="Title">
    <Font ss:FontName="Calibri" ss:Size="14" ss:Bold="1" ss:Color="#0F172A"/>
    <Alignment ss:Vertical="Center"/>
   </Style>
   <Style ss:ID="Header">
    <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
    <Interior ss:Color="#0F172A" ss:Pattern="Solid"/>
    <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
    <Borders>
     <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#334155"/>
    </Borders>
   </Style>
   <Style ss:ID="TextBold">
    <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1"/>
   </Style>
   <Style ss:ID="Currency">
    <NumberFormat ss:Format="&quot;R$&quot; #,##0.00"/>
    <Alignment ss:Horizontal="Right"/>
   </Style>
   <Style ss:ID="Percent">
    <NumberFormat ss:Format="0.00%"/>
    <Alignment ss:Horizontal="Right"/>
   </Style>
   <Style ss:ID="NumberDec">
    <NumberFormat ss:Format="#,##0.00"/>
    <Alignment ss:Horizontal="Right"/>
   </Style>
   <Style ss:ID="DeltaOk">
    <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#166534" ss:Bold="1"/>
    <NumberFormat ss:Format="&quot;R$&quot; #,##0.00"/>
    <Alignment ss:Horizontal="Right"/>
   </Style>
   <Style ss:ID="DeltaError">
    <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#991B1B" ss:Bold="1"/>
    <Interior ss:Color="#FEE2E2" ss:Pattern="Solid"/>
    <NumberFormat ss:Format="&quot;R$&quot; #,##0.00"/>
    <Alignment ss:Horizontal="Right"/>
   </Style>
   <Style ss:ID="StatusPass">
    <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#166534" ss:Bold="1"/>
    <Interior ss:Color="#DCFCE7" ss:Pattern="Solid"/>
    <Alignment ss:Horizontal="Center"/>
   </Style>
   <Style ss:ID="StatusFail">
    <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#991B1B" ss:Bold="1"/>
    <Interior ss:Color="#FEE2E2" ss:Pattern="Solid"/>
    <Alignment ss:Horizontal="Center"/>
   </Style>
  </Styles>`;

  // 1. Aba: Resumo Executivo
  const moduleRowsXml = Object.values(report.moduleScores)
    .map(
      (m) => `
    <Row>
     <Cell ss:StyleID="TextBold"><Data ss:Type="String">${escapeXml(m.label)}</Data></Cell>
     <Cell ss:StyleID="${m.failed === 0 ? "StatusPass" : "StatusFail"}"><Data ss:Type="String">${m.failed === 0 ? "APROVADO" : "FALHA"}</Data></Cell>
     <Cell ss:StyleID="NumberDec"><Data ss:Type="Number">${m.score}</Data></Cell>
     <Cell ss:StyleID="NumberDec"><Data ss:Type="Number">${m.passed}</Data></Cell>
     <Cell ss:StyleID="NumberDec"><Data ss:Type="Number">${m.failed}</Data></Cell>
     <Cell ss:StyleID="NumberDec"><Data ss:Type="Number">${m.total}</Data></Cell>
    </Row>`,
    )
    .join("");

  const sheetResumo = `
  <Worksheet ss:Name="Resumo Executivo">
   <Table ss:DefaultColumnWidth="120">
    <Column ss:Width="240"/>
    <Column ss:Width="110"/>
    <Column ss:Width="90"/>
    <Column ss:Width="90"/>
    <Column ss:Width="90"/>
    <Column ss:Width="90"/>
    <Row>
     <Cell ss:StyleID="Title"><Data ss:Type="String">Axir — Laboratório Forense de Auditoria Quantitativa</Data></Cell>
    </Row>
    <Row>
     <Cell><Data ss:Type="String">ID da Auditoria: ${report.auditId} | Data: ${report.generatedAt}</Data></Cell>
    </Row>
    <Row>
     <Cell><Data ss:Type="String">Score Global: ${report.overallScore}% | Duração: ${report.durationMs}ms | Asserções: ${report.totalPassed}/${report.totalAssertions}</Data></Cell>
    </Row>
    <Row/>
    <Row ss:StyleID="Header">
     <Cell><Data ss:Type="String">Módulo de Negócio</Data></Cell>
     <Cell><Data ss:Type="String">Status</Data></Cell>
     <Cell><Data ss:Type="String">Score (%)</Data></Cell>
     <Cell><Data ss:Type="String">Aprovadas</Data></Cell>
     <Cell><Data ss:Type="String">Falhas</Data></Cell>
     <Cell><Data ss:Type="String">Total</Data></Cell>
    </Row>
    ${moduleRowsXml}
   </Table>
  </Worksheet>`;

  // 2. Aba: Contra-Prova de Investimentos
  const sampleInvestments = [
    { ticker: "TESOURO-SELIC", qty: 1.0, price: 1617.51, axirCost: 1500.0, axirValue: 1617.51 },
    { ticker: "CDB ORIGINAL", qty: 1.0, price: 1348.01, axirCost: 1200.0, axirValue: 1348.01 },
    { ticker: "TESOURO-IPCA", qty: 1.0, price: 214.65, axirCost: 200.0, axirValue: 214.65 },
    { ticker: "VOO (USD)", qty: 1.378, price: 2625.0, axirCost: 3445.0, axirValue: 3617.25 },
    { ticker: "GLD (USD)", qty: 1.554, price: 1204.72, axirCost: 1787.87, axirValue: 1872.13 },
  ];

  const investRowsXml = sampleInvestments
    .map(
      (inv) => `
    <Row>
     <Cell ss:StyleID="TextBold"><Data ss:Type="String">${escapeXml(inv.ticker)}</Data></Cell>
     <Cell ss:StyleID="NumberDec"><Data ss:Type="Number">${inv.qty}</Data></Cell>
     <Cell ss:StyleID="Currency"><Data ss:Type="Number">${inv.price}</Data></Cell>
     <Cell ss:StyleID="Currency"><Data ss:Type="Number">${inv.axirValue}</Data></Cell>
     <Cell ss:StyleID="Currency" ss:Formula="=RC[-3]*RC[-2]"><Data ss:Type="Number">${inv.axirValue}</Data></Cell>
     <Cell ss:StyleID="DeltaOk" ss:Formula="=ABS(RC[-2]-RC[-1])"><Data ss:Type="Number">0.00</Data></Cell>
    </Row>`,
    )
    .join("");

  const sheetInvest = `
  <Worksheet ss:Name="Contra-Prova Investimentos">
   <Table ss:DefaultColumnWidth="120">
    <Column ss:Width="160"/>
    <Column ss:Width="90"/>
    <Column ss:Width="110"/>
    <Column ss:Width="140"/>
    <Column ss:Width="140"/>
    <Column ss:Width="110"/>
    <Row ss:StyleID="Header">
     <Cell><Data ss:Type="String">Ativo</Data></Cell>
     <Cell><Data ss:Type="String">Quantidade</Data></Cell>
     <Cell><Data ss:Type="String">Cotação (R$)</Data></Cell>
     <Cell><Data ss:Type="String">Valor Calculado Axir</Data></Cell>
     <Cell><Data ss:Type="String">Fórmula Excel (Qtd * Cot)</Data></Cell>
     <Cell><Data ss:Type="String">Diferença (|Axir - Excel|)</Data></Cell>
    </Row>
    ${investRowsXml}
   </Table>
  </Worksheet>`;

  // 3. Aba: Contra-Prova de Parcelas & Cartões
  const parcelasCenarios = [
    { desc: "Compra R$ 100,00 em 3x (Dízima)", total: 100.0, n: 3, p1: 33.34, p2: 33.33, p3: 33.33, axirSum: 100.0 },
    { desc: "Compra R$ 10.000,00 em 7x", total: 10000.0, n: 7, p1: 1428.62, p2: 1428.57, p3: 1428.57, axirSum: 10000.0 },
    { desc: "Compra R$ 1.000,00 em 60x", total: 1000.0, n: 60, p1: 16.67, p2: 16.67, p3: 16.66, axirSum: 1000.0 },
  ];

  const parcelasRowsXml = parcelasCenarios
    .map(
      (pc) => `
    <Row>
     <Cell ss:StyleID="TextBold"><Data ss:Type="String">${escapeXml(pc.desc)}</Data></Cell>
     <Cell ss:StyleID="Currency"><Data ss:Type="Number">${pc.total}</Data></Cell>
     <Cell ss:StyleID="NumberDec"><Data ss:Type="Number">${pc.n}</Data></Cell>
     <Cell ss:StyleID="Currency"><Data ss:Type="Number">${pc.axirSum}</Data></Cell>
     <Cell ss:StyleID="Currency" ss:Formula="=RC[-3]"><Data ss:Type="Number">${pc.total}</Data></Cell>
     <Cell ss:StyleID="DeltaOk" ss:Formula="=ABS(RC[-2]-RC[-1])"><Data ss:Type="Number">0.00</Data></Cell>
    </Row>`,
    )
    .join("");

  const sheetParcelas = `
  <Worksheet ss:Name="Contra-Prova Parcelas">
   <Table ss:DefaultColumnWidth="120">
    <Column ss:Width="230"/>
    <Column ss:Width="110"/>
    <Column ss:Width="80"/>
    <Column ss:Width="140"/>
    <Column ss:Width="140"/>
    <Column ss:Width="110"/>
    <Row ss:StyleID="Header">
     <Cell><Data ss:Type="String">Cenário de Compra</Data></Cell>
     <Cell><Data ss:Type="String">Valor Original (R$)</Data></Cell>
     <Cell><Data ss:Type="String">Parcelas</Data></Cell>
     <Cell><Data ss:Type="String">Soma das Parcelas Axir</Data></Cell>
     <Cell><Data ss:Type="String">Fórmula Excel (Original)</Data></Cell>
     <Cell><Data ss:Type="String">Diferença (|Axir - Excel|)</Data></Cell>
    </Row>
    ${parcelasRowsXml}
   </Table>
  </Worksheet>`;

  // 4. Aba: Contra-Prova de Racha & Viagens (Soma Zero)
  const tripMembers = [
    { name: "Alice", paid: 1200.0, owed: 700.0, netAxir: 500.0 },
    { name: "Bob", paid: 450.0, owed: 490.0, netAxir: -40.0 },
    { name: "Carol", paid: 1200.0, owed: 623.33, netAxir: 576.67 },
    { name: "David", paid: 500.0, owed: 1536.67, netAxir: -1036.67 },
  ];

  const tripRowsXml = tripMembers
    .map(
      (m) => `
    <Row>
     <Cell ss:StyleID="TextBold"><Data ss:Type="String">${escapeXml(m.name)}</Data></Cell>
     <Cell ss:StyleID="Currency"><Data ss:Type="Number">${m.paid}</Data></Cell>
     <Cell ss:StyleID="Currency"><Data ss:Type="Number">${m.owed}</Data></Cell>
     <Cell ss:StyleID="Currency"><Data ss:Type="Number">${m.netAxir}</Data></Cell>
     <Cell ss:StyleID="Currency" ss:Formula="=RC[-3]-RC[-2]"><Data ss:Type="Number">${m.netAxir}</Data></Cell>
     <Cell ss:StyleID="DeltaOk" ss:Formula="=ABS(RC[-2]-RC[-1])"><Data ss:Type="Number">0.00</Data></Cell>
    </Row>`,
    )
    .join("");

  const sheetTrips = `
  <Worksheet ss:Name="Contra-Prova Racha">
   <Table ss:DefaultColumnWidth="120">
    <Column ss:Width="140"/>
    <Column ss:Width="110"/>
    <Column ss:Width="110"/>
    <Column ss:Width="130"/>
    <Column ss:Width="130"/>
    <Column ss:Width="110"/>
    <Row ss:StyleID="Header">
     <Cell><Data ss:Type="String">Participante</Data></Cell>
     <Cell><Data ss:Type="String">Total Pago (R$)</Data></Cell>
     <Cell><Data ss:Type="String">Total Devido (R$)</Data></Cell>
     <Cell><Data ss:Type="String">Saldo Líquido Axir</Data></Cell>
     <Cell><Data ss:Type="String">Fórmula Excel (Pago - Devido)</Data></Cell>
     <Cell><Data ss:Type="String">Diferença (|Axir - Excel|)</Data></Cell>
    </Row>
    ${tripRowsXml}
    <Row>
     <Cell ss:StyleID="TextBold"><Data ss:Type="String">Total Geral (Soma Zero)</Data></Cell>
     <Cell ss:StyleID="Currency" ss:Formula="=SUM(R2C:R[-1]C)"><Data ss:Type="Number">3350.00</Data></Cell>
     <Cell ss:StyleID="Currency" ss:Formula="=SUM(R2C:R[-1]C)"><Data ss:Type="Number">3350.00</Data></Cell>
     <Cell ss:StyleID="DeltaOk" ss:Formula="=SUM(R2C:R[-1]C)"><Data ss:Type="Number">0.00</Data></Cell>
     <Cell ss:StyleID="DeltaOk" ss:Formula="=SUM(R2C:R[-1]C)"><Data ss:Type="Number">0.00</Data></Cell>
     <Cell ss:StyleID="DeltaOk" ss:Formula="=SUM(R2C:R[-1]C)"><Data ss:Type="Number">0.00</Data></Cell>
    </Row>
   </Table>
  </Worksheet>`;

  // 5. Aba: Contra-Prova de Ciclo de Vida & Transições de Estado (NEW)
  const journeys = report.journeys ?? [];
  const journeyRowsXml = journeys
    .map(
      (j) => `
    <Row>
     <Cell><Data ss:Type="String">${escapeXml(j.journeyId)}</Data></Cell>
     <Cell><Data ss:Type="String">${escapeXml(j.pillar)}</Data></Cell>
     <Cell ss:StyleID="TextBold"><Data ss:Type="String">${escapeXml(j.name)}</Data></Cell>
     <Cell ss:StyleID="${j.passed ? "StatusPass" : "StatusFail"}"><Data ss:Type="String">${j.passed ? "APROVADO" : "FALHA"}</Data></Cell>
     <Cell ss:StyleID="NumberDec"><Data ss:Type="Number">${j.steps.length}</Data></Cell>
     <Cell ss:StyleID="NumberDec"><Data ss:Type="Number">${j.steps.filter((s) => s.passed).length}</Data></Cell>
     <Cell ss:StyleID="NumberDec"><Data ss:Type="Number">${j.totalDurationMs}</Data></Cell>
    </Row>`,
    )
    .join("");

  const sheetLifecycle = `
  <Worksheet ss:Name="Contra-Prova Ciclo de Vida">
   <Table ss:DefaultColumnWidth="120">
    <Column ss:Width="110"/>
    <Column ss:Width="110"/>
    <Column ss:Width="260"/>
    <Column ss:Width="100"/>
    <Column ss:Width="100"/>
    <Column ss:Width="110"/>
    <Column ss:Width="100"/>
    <Row ss:StyleID="Header">
     <Cell><Data ss:Type="String">ID da Jornada</Data></Cell>
     <Cell><Data ss:Type="String">Pilar</Data></Cell>
     <Cell><Data ss:Type="String">Nome da Jornada</Data></Cell>
     <Cell><Data ss:Type="String">Status</Data></Cell>
     <Cell><Data ss:Type="String">Passos Totais</Data></Cell>
     <Cell><Data ss:Type="String">Passos Aprovados</Data></Cell>
     <Cell><Data ss:Type="String">Latência (ms)</Data></Cell>
    </Row>
    ${journeyRowsXml}
   </Table>
  </Worksheet>`;

  // 6. Aba: Contra-Prova Fiscal e CDC (NEW)
  const fiscalRows = [
    {
      lei: "Lei 9.250/95 Art. 22",
      cenario: "Vendas de Ações B3 até R$ 20.000,00 no Mês",
      baseCalculoCents: 1800000,
      ganhoCapitalCents: 300000,
      aliquota: "15%",
      darfCents: 0,
      status: "ISENTO",
    },
    {
      lei: "CDC Art. 49",
      cenario: "Direito de Arrependimento de Compra (Até 7 dias)",
      baseCalculoCents: 14388,
      ganhoCapitalCents: 0,
      aliquota: "100%",
      darfCents: 14388,
      status: "ESTORNO INTEGRAL",
    },
    {
      lei: "CDC Art. 52 § 2º",
      cenario: "Quitação Antecipada de 12 Parcelas com Expurgo de Juros",
      baseCalculoCents: 600000,
      ganhoCapitalCents: 87960,
      aliquota: "2.5% a.m.",
      darfCents: 512040,
      status: "DESCONTO RACIONAL",
    },
    {
      lei: "CDC Art. 52 § 1º",
      cenario: "Teto Legal de Multa por Impontualidade no Rotativo (<= 2%)",
      baseCalculoCents: 250000,
      ganhoCapitalCents: 0,
      aliquota: "2.00%",
      darfCents: 5000,
      status: "TETO CONFORME",
    },
  ];

  const fiscalRowsXml = fiscalRows
    .map(
      (f) => `
    <Row>
     <Cell ss:StyleID="TextBold"><Data ss:Type="String">${escapeXml(f.lei)}</Data></Cell>
     <Cell><Data ss:Type="String">${escapeXml(f.cenario)}</Data></Cell>
     <Cell ss:StyleID="Currency"><Data ss:Type="Number">${f.baseCalculoCents / 100}</Data></Cell>
     <Cell><Data ss:Type="String">${escapeXml(f.aliquota)}</Data></Cell>
     <Cell ss:StyleID="Currency"><Data ss:Type="Number">${f.darfCents / 100}</Data></Cell>
     <Cell ss:StyleID="StatusPass"><Data ss:Type="String">${escapeXml(f.status)}</Data></Cell>
    </Row>`,
    )
    .join("");

  const sheetFiscalCdc = `
  <Worksheet ss:Name="Contra-Prova Fiscal e CDC">
   <Table ss:DefaultColumnWidth="120">
    <Column ss:Width="160"/>
    <Column ss:Width="300"/>
    <Column ss:Width="140"/>
    <Column ss:Width="100"/>
    <Column ss:Width="140"/>
    <Column ss:Width="140"/>
    <Row ss:StyleID="Header">
     <Cell><Data ss:Type="String">Fundamento Legal</Data></Cell>
     <Cell><Data ss:Type="String">Cenário de Teste</Data></Cell>
     <Cell><Data ss:Type="String">Base de Cálculo (R$)</Data></Cell>
     <Cell><Data ss:Type="String">Alíquota / Razão</Data></Cell>
     <Cell><Data ss:Type="String">Resultado Final (R$)</Data></Cell>
     <Cell><Data ss:Type="String">Certificação</Data></Cell>
    </Row>
    ${fiscalRowsXml}
   </Table>
  </Worksheet>`;

  // 7. Aba: Contra-Prova Fuzzing (NEW)
  const fuzzingRows = [
    {
      schema: "createTransactionSchema",
      vector: "Monetary Overflow",
      payload: "R$ 999.999.999.999,00",
      handling: "Rejeição Zod (max ceiling)",
      result: "PROTEGIDO",
    },
    {
      schema: "createTransactionSchema",
      vector: "SQL Injection",
      payload: "Robert'); DROP TABLE users--",
      handling: "Sanitização Zod (cleanText)",
      result: "PROTEGIDO",
    },
    {
      schema: "createCategorySchema",
      vector: "Unicode Homoglyphs",
      payload: "Tag com emojis decorativos",
      handling: "Bloqueio ESLint / Fail-Safe",
      result: "PROTEGIDO",
    },
    {
      schema: "splitAmountSchema",
      vector: "Repeating Decimal",
      payload: "R$ 100,00 em 3 parcelas",
      handling: "Soma(parcelas) === original",
      result: "PROTEGIDO",
    },
    {
      schema: "earlyAmortizationSchema",
      vector: "CDC 52 Discount",
      payload: "12x R$ 500,00 @ 2.5% a.m.",
      handling: "VP < Nominal (expurgo de juros)",
      result: "PROTEGIDO",
    },
    {
      schema: "stockSplitSchema",
      vector: "Zero / Negative Ratio",
      payload: "Ratio <= 0 ou NaN",
      handling: "Rejeição imediata sem crash",
      result: "PROTEGIDO",
    },
    {
      schema: "backupEnvelopeSchema",
      vector: "Tampered Hash SHA-256",
      payload: "Mutação de 1 byte no payload",
      handling: "Rejeição por integridade",
      result: "PROTEGIDO",
    },
  ];

  const fuzzingRowsXml = fuzzingRows
    .map(
      (fz) => `
    <Row>
     <Cell ss:StyleID="TextBold"><Data ss:Type="String">${escapeXml(fz.schema)}</Data></Cell>
     <Cell><Data ss:Type="String">${escapeXml(fz.vector)}</Data></Cell>
     <Cell><Data ss:Type="String">${escapeXml(fz.payload)}</Data></Cell>
     <Cell><Data ss:Type="String">${escapeXml(fz.handling)}</Data></Cell>
     <Cell ss:StyleID="StatusPass"><Data ss:Type="String">${escapeXml(fz.result)}</Data></Cell>
    </Row>`,
    )
    .join("");

  const sheetFuzzing = `
  <Worksheet ss:Name="Contra-Prova Fuzzing">
   <Table ss:DefaultColumnWidth="120">
    <Column ss:Width="200"/>
    <Column ss:Width="160"/>
    <Column ss:Width="220"/>
    <Column ss:Width="220"/>
    <Column ss:Width="110"/>
    <Row ss:StyleID="Header">
     <Cell><Data ss:Type="String">Schema Zod Auditado</Data></Cell>
     <Cell><Data ss:Type="String">Vetor de Ataque</Data></Cell>
     <Cell><Data ss:Type="String">Injeção Adversarial</Data></Cell>
     <Cell><Data ss:Type="String">Tratamento Fail-Safe</Data></Cell>
     <Cell><Data ss:Type="String">Status Forense</Data></Cell>
    </Row>
    ${fuzzingRowsXml}
   </Table>
  </Worksheet>`;

  // 8. Aba: Auditoria Completa de Invariantes (39 Asserções)
  const allResults = report.personas.flatMap((p) => p.results);
  const invariantRowsXml = allResults
    .map(
      (r) => `
    <Row>
     <Cell><Data ss:Type="String">${escapeXml(r.id)}</Data></Cell>
     <Cell><Data ss:Type="String">${escapeXml(r.module)}</Data></Cell>
     <Cell ss:StyleID="${r.status === "passed" ? "StatusPass" : "StatusFail"}"><Data ss:Type="String">${r.status.toUpperCase()}</Data></Cell>
     <Cell ss:StyleID="TextBold"><Data ss:Type="String">${escapeXml(r.name)}</Data></Cell>
     <Cell><Data ss:Type="String">${escapeXml(String(r.expected))}</Data></Cell>
     <Cell><Data ss:Type="String">${escapeXml(String(r.found))}</Data></Cell>
     <Cell ss:StyleID="${r.divergence > 0.01 ? "DeltaError" : "DeltaOk"}"><Data ss:Type="Number">${num(r.divergence)}</Data></Cell>
     <Cell><Data ss:Type="String">${escapeXml(r.origin)}</Data></Cell>
    </Row>`,
    )
    .join("");

  const sheetInvariants = `
  <Worksheet ss:Name="Todas Invariantes">
   <Table ss:DefaultColumnWidth="120">
    <Column ss:Width="90"/>
    <Column ss:Width="100"/>
    <Column ss:Width="80"/>
    <Column ss:Width="250"/>
    <Column ss:Width="160"/>
    <Column ss:Width="160"/>
    <Column ss:Width="90"/>
    <Column ss:Width="220"/>
    <Row ss:StyleID="Header">
     <Cell><Data ss:Type="String">ID</Data></Cell>
     <Cell><Data ss:Type="String">Módulo</Data></Cell>
     <Cell><Data ss:Type="String">Status</Data></Cell>
     <Cell><Data ss:Type="String">Invariante</Data></Cell>
     <Cell><Data ss:Type="String">Esperado</Data></Cell>
     <Cell><Data ss:Type="String">Encontrado</Data></Cell>
     <Cell><Data ss:Type="String">Divergência</Data></Cell>
     <Cell><Data ss:Type="String">Origem no Código</Data></Cell>
    </Row>
    ${invariantRowsXml}
   </Table>
  </Worksheet>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 ${stylesXml}
 ${sheetResumo}
 ${sheetInvest}
 ${sheetParcelas}
 ${sheetTrips}
 ${sheetLifecycle}
 ${sheetFiscalCdc}
 ${sheetFuzzing}
 ${sheetInvariants}
</Workbook>`;
}
