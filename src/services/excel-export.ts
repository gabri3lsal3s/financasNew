/**
 * Serviço de Exportação de Caderno Excel Multi-Abas (.xml / .xls) (§F42).
 *
 * Gera planilhas multi-abas profissionais compatíveis com Microsoft Excel,
 * LibreOffice Calc, Google Sheets e Apple Numbers, sem adicionar dependências
 * externas pesadas ao bundle.
 *
 * Suporta:
 * - Múltiplas abas nomeadas;
 * - Tipagem estrita de células (Number, String, Currency, Percent);
 * - Cabeçalhos estilizados com cor institucional;
 * - 5 abas consolidadas: Resumo Patrimonial, Custódia, Proventos, DRE e Dívidas.
 */

export interface ExcelPositionRow {
  ticker: string;
  name?: string | null;
  assetClass: string;
  sector?: string | null;
  currency: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  totalValueBRL: number;
  unrealizedPnlBRL: number;
  unrealizedPnlPct: number;
  yearDividendsBRL: number;
  yocPct: number;
}

export interface ExcelDividendRow {
  date: string;
  ticker: string;
  assetClass: string;
  amountBRL: number;
  notes?: string | null;
}

export interface ExcelDREMonthRow {
  month: string;
  grossIncomeBRL: number;
  totalExpensesBRL: number;
  operationalSavingsBRL: number;
  savingsRatePct: number;
  investedAporteBRL: number;
  netCashFlowBRL: number;
}

export interface ExcelDebtRow {
  description: string;
  type: "payable" | "receivable";
  remainingAmountBRL: number;
  totalAmountBRL: number;
  installmentsProgress?: string | null;
  dueDate?: string | null;
}

export interface ExcelRedemptionRow {
  ticker: string;
  name?: string | null;
  assetClass: string;
  sector?: string | null;
  redemptionDate: string;
  quantity: number;
  appliedCostBRL: number;
  redeemedValueBRL: number;
  realizedPnlBRL: number;
  finalReturnPct: number | null;
}

export interface ExcelClassTargetRow {
  assetClass: string;
  currentBRL: number;
  currentPct: number;
  targetPct: number;
  gapBRL: number;
  status: string;
}

export interface ExcelWorkbookData {
  appName?: string;
  generatedAt?: string;
  summary: {
    totalPatrimonyBRL: number;
    totalInvestedCostBRL: number;
    unrealizedPnlBRL: number;
    unrealizedPnlPct: number;
    cashBalanceBRL: number;
    yearDividendsBRL: number;
    freedomPct: number;
    savingsRatePct: number;
  };
  positions: readonly ExcelPositionRow[];
  dividends: readonly ExcelDividendRow[];
  dreMonthly: readonly ExcelDREMonthRow[];
  debts: readonly ExcelDebtRow[];
  redemptions?: readonly ExcelRedemptionRow[];
  classTargets?: readonly ExcelClassTargetRow[];
}

export function sanitizeSpreadsheetText(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/^[-=+@\t\r]/.test(str)) {
    if (/^[-+]?\d+(?:[.,]\d+)?$/.test(str.trim())) {
      return str;
    }
    return `'${str}`;
  }
  return str;
}

function escapeXml(text: string | number | null | undefined): string {
  if (text === null || text === undefined) return "";
  const sanitized = sanitizeSpreadsheetText(text);
  return sanitized
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatNumberRaw(num: number): string {
  return (isNaN(num) || !isFinite(num) ? 0 : num).toFixed(2);
}

function formatQuantityRaw(num: number): string {
  return (isNaN(num) || !isFinite(num) ? 0 : num).toFixed(4);
}

/**
 * Serializa a estrutura de dados para o padrão XML Spreadsheet 2003 do Excel.
 */
export function generateMultiSheetExcelXml(data: ExcelWorkbookData): string {
  const generatedAt = data.generatedAt ?? new Date().toLocaleDateString("pt-BR");
  const appName = data.appName ?? "Finanças Pessoais & Investimentos";

  const xmlHeader = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Title>${escapeXml(appName)} - Caderno de Relatórios</Title>
  <Created>${new Date().toISOString()}</Created>
 </DocumentProperties>
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#000000"/>
  </Style>
  <Style ss:ID="Title">
   <Font ss:FontName="Calibri" ss:Size="14" ss:Bold="1" ss:Color="#0F3D39"/>
  </Style>
  <Style ss:ID="Subtitle">
   <Font ss:FontName="Calibri" ss:Size="10" ss:Italic="1" ss:Color="#666666"/>
  </Style>
  <Style ss:ID="Header">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#0F3D39" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0B2B28"/>
   </Borders>
  </Style>
  <Style ss:ID="Currency">
   <Alignment ss:Horizontal="Right"/>
   <NumberFormat ss:Format="&quot;R$&quot; #,##0.00"/>
  </Style>
  <Style ss:ID="Percent">
   <Alignment ss:Horizontal="Right"/>
   <NumberFormat ss:Format="0.0%"/>
  </Style>
  <Style ss:ID="Quantity">
   <Alignment ss:Horizontal="Right"/>
   <NumberFormat ss:Format="#,##0.0000"/>
  </Style>
  <Style ss:ID="TextBold">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1"/>
  </Style>
 </Styles>`;

  // 1. Aba: Resumo Executivo
  const sheet1 = `
 <Worksheet ss:Name="Resumo Executivo">
  <Table ss:DefaultColumnWidth="140">
   <Column ss:Width="220"/>
   <Column ss:Width="160"/>
   <Row ss:Height="24">
    <Cell ss:StyleID="Title"><Data ss:Type="String">${escapeXml(appName)} - Resumo Patrimonial</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="Subtitle"><Data ss:Type="String">Posição consolidada emitida em ${escapeXml(generatedAt)}</Data></Cell>
   </Row>
   <Row/>
   <Row ss:StyleID="Header">
    <Cell><Data ss:Type="String">Indicador Executivo</Data></Cell>
    <Cell><Data ss:Type="String">Valor</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="TextBold"><Data ss:Type="String">Patrimônio Total de Investimentos</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${formatNumberRaw(data.summary.totalPatrimonyBRL)}</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="TextBold"><Data ss:Type="String">Capital Total Investido (Custo)</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${formatNumberRaw(data.summary.totalInvestedCostBRL)}</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="TextBold"><Data ss:Type="String">Lucro / Prejuízo Não Realizado (R$)</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${formatNumberRaw(data.summary.unrealizedPnlBRL)}</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="TextBold"><Data ss:Type="String">Rentabilidade da Carteira (%)</Data></Cell>
    <Cell ss:StyleID="Percent"><Data ss:Type="Number">${(data.summary.unrealizedPnlPct / 100).toFixed(4)}</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="TextBold"><Data ss:Type="String">Saldo Disponível em Caixa</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${formatNumberRaw(data.summary.cashBalanceBRL)}</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="TextBold"><Data ss:Type="String">Proventos Recebidos no Ano</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${formatNumberRaw(data.summary.yearDividendsBRL)}</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="TextBold"><Data ss:Type="String">Índice de Liberdade Financeira</Data></Cell>
    <Cell ss:StyleID="Percent"><Data ss:Type="Number">${(data.summary.freedomPct / 100).toFixed(4)}</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="TextBold"><Data ss:Type="String">Taxa Média de Poupança</Data></Cell>
    <Cell ss:StyleID="Percent"><Data ss:Type="Number">${(data.summary.savingsRatePct / 100).toFixed(4)}</Data></Cell>
   </Row>
  </Table>
 </Worksheet>`;

  // 2. Aba: Custódia & Ativos
  const positionRowsXml = data.positions
    .map(
      (p) => `
   <Row>
    <Cell ss:StyleID="TextBold"><Data ss:Type="String">${escapeXml(p.ticker)}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(p.name ?? p.ticker)}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(p.assetClass)}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(p.sector ?? "Geral")}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(p.currency)}</Data></Cell>
    <Cell ss:StyleID="Quantity"><Data ss:Type="Number">${formatQuantityRaw(p.quantity)}</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${formatNumberRaw(p.averagePrice)}</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${formatNumberRaw(p.currentPrice)}</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${formatNumberRaw(p.totalValueBRL)}</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${formatNumberRaw(p.unrealizedPnlBRL)}</Data></Cell>
    <Cell ss:StyleID="Percent"><Data ss:Type="Number">${(p.unrealizedPnlPct / 100).toFixed(4)}</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${formatNumberRaw(p.yearDividendsBRL)}</Data></Cell>
    <Cell ss:StyleID="Percent"><Data ss:Type="Number">${(p.yocPct / 100).toFixed(4)}</Data></Cell>
   </Row>`,
    )
    .join("");

  const sheet2 = `
 <Worksheet ss:Name="Custódia e Ativos">
  <Table ss:DefaultColumnWidth="100">
   <Column ss:Width="70"/>
   <Column ss:Width="160"/>
   <Column ss:Width="110"/>
   <Column ss:Width="130"/>
   <Column ss:Width="60"/>
   <Column ss:Width="90"/>
   <Column ss:Width="100"/>
   <Column ss:Width="100"/>
   <Column ss:Width="120"/>
   <Column ss:Width="110"/>
   <Column ss:Width="80"/>
   <Column ss:Width="110"/>
   <Column ss:Width="80"/>
   <Row ss:StyleID="Header">
    <Cell><Data ss:Type="String">Ticker</Data></Cell>
    <Cell><Data ss:Type="String">Nome / Descrição</Data></Cell>
    <Cell><Data ss:Type="String">Classe</Data></Cell>
    <Cell><Data ss:Type="String">Setor</Data></Cell>
    <Cell><Data ss:Type="String">Moeda</Data></Cell>
    <Cell><Data ss:Type="String">Quantidade</Data></Cell>
    <Cell><Data ss:Type="String">Preço Médio</Data></Cell>
    <Cell><Data ss:Type="String">Cotação Atual</Data></Cell>
    <Cell><Data ss:Type="String">Valor Total (R$)</Data></Cell>
    <Cell><Data ss:Type="String">Lucro / Prejuízo (R$)</Data></Cell>
    <Cell><Data ss:Type="String">PnL (%)</Data></Cell>
    <Cell><Data ss:Type="String">Proventos no Ano</Data></Cell>
    <Cell><Data ss:Type="String">YoC (%)</Data></Cell>
   </Row>${positionRowsXml}
  </Table>
 </Worksheet>`;

  // 3. Aba: Extrato de Proventos
  const dividendRowsXml = data.dividends
    .map(
      (d) => `
   <Row>
    <Cell><Data ss:Type="String">${escapeXml(d.date)}</Data></Cell>
    <Cell ss:StyleID="TextBold"><Data ss:Type="String">${escapeXml(d.ticker)}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(d.assetClass)}</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${formatNumberRaw(d.amountBRL)}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(d.notes ?? "")}</Data></Cell>
   </Row>`,
    )
    .join("");

  const sheet3 = `
 <Worksheet ss:Name="Extrato de Proventos">
  <Table ss:DefaultColumnWidth="110">
   <Column ss:Width="90"/>
   <Column ss:Width="80"/>
   <Column ss:Width="110"/>
   <Column ss:Width="120"/>
   <Column ss:Width="200"/>
   <Row ss:StyleID="Header">
    <Cell><Data ss:Type="String">Data</Data></Cell>
    <Cell><Data ss:Type="String">Ticker</Data></Cell>
    <Cell><Data ss:Type="String">Classe</Data></Cell>
    <Cell><Data ss:Type="String">Valor Recebido (R$)</Data></Cell>
    <Cell><Data ss:Type="String">Observações</Data></Cell>
   </Row>${dividendRowsXml}
  </Table>
 </Worksheet>`;

  // 4. Aba: DRE Financeiro Pessoal
  const dreRowsXml = data.dreMonthly
    .map(
      (dre) => `
   <Row>
    <Cell ss:StyleID="TextBold"><Data ss:Type="String">${escapeXml(dre.month)}</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${formatNumberRaw(dre.grossIncomeBRL)}</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${formatNumberRaw(dre.totalExpensesBRL)}</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${formatNumberRaw(dre.operationalSavingsBRL)}</Data></Cell>
    <Cell ss:StyleID="Percent"><Data ss:Type="Number">${(dre.savingsRatePct / 100).toFixed(4)}</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${formatNumberRaw(dre.investedAporteBRL)}</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${formatNumberRaw(dre.netCashFlowBRL)}</Data></Cell>
   </Row>`,
    )
    .join("");

  const sheet4 = `
 <Worksheet ss:Name="DRE Financeiro">
  <Table ss:DefaultColumnWidth="120">
   <Column ss:Width="90"/>
   <Column ss:Width="120"/>
   <Column ss:Width="120"/>
   <Column ss:Width="130"/>
   <Column ss:Width="100"/>
   <Column ss:Width="130"/>
   <Column ss:Width="120"/>
   <Row ss:StyleID="Header">
    <Cell><Data ss:Type="String">Competência</Data></Cell>
    <Cell><Data ss:Type="String">Receitas Brutas</Data></Cell>
    <Cell><Data ss:Type="String">Despesas Totais</Data></Cell>
    <Cell><Data ss:Type="String">Poupança Gerada</Data></Cell>
    <Cell><Data ss:Type="String">Taxa Poupança</Data></Cell>
    <Cell><Data ss:Type="String">Aportes Investimentos</Data></Cell>
    <Cell><Data ss:Type="String">Fluxo Líquido Caixa</Data></Cell>
   </Row>${dreRowsXml}
  </Table>
 </Worksheet>`;

  // 5. Aba: Dívidas & Passivos
  const debtRowsXml = data.debts
    .map(
      (d) => `
   <Row>
    <Cell ss:StyleID="TextBold"><Data ss:Type="String">${escapeXml(d.description)}</Data></Cell>
    <Cell><Data ss:Type="String">${d.type === "payable" ? "Dívida a Pagar" : "Conta a Receber"}</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${formatNumberRaw(d.remainingAmountBRL)}</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${formatNumberRaw(d.totalAmountBRL)}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(d.installmentsProgress ?? "—")}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(d.dueDate ?? "—")}</Data></Cell>
   </Row>`,
    )
    .join("");

  const sheet5 = `
 <Worksheet ss:Name="Dívidas e Passivos">
  <Table ss:DefaultColumnWidth="120">
   <Column ss:Width="200"/>
   <Column ss:Width="120"/>
   <Column ss:Width="130"/>
   <Column ss:Width="130"/>
   <Column ss:Width="100"/>
   <Column ss:Width="100"/>
   <Row ss:StyleID="Header">
    <Cell><Data ss:Type="String">Descrição</Data></Cell>
    <Cell><Data ss:Type="String">Tipo</Data></Cell>
    <Cell><Data ss:Type="String">Saldo Restante (R$)</Data></Cell>
    <Cell><Data ss:Type="String">Valor Original (R$)</Data></Cell>
    <Cell><Data ss:Type="String">Parcelas</Data></Cell>
    <Cell><Data ss:Type="String">Vencimento</Data></Cell>
   </Row>${debtRowsXml}
  </Table>
 </Worksheet>`;


  // 6. Aba: Resgates e Vendas (se houver no período)
  let sheet6 = "";
  if (data.redemptions && data.redemptions.length > 0) {
    const redemptionRowsXml = data.redemptions
      .map(
        (r) => `
   <Row>
    <Cell ss:StyleID="TextBold"><Data ss:Type="String">${escapeXml(r.ticker)}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(r.name ?? r.ticker)}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(r.assetClass)}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(r.sector ?? "—")}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(r.redemptionDate)}</Data></Cell>
    <Cell ss:StyleID="Quantity"><Data ss:Type="Number">${formatQuantityRaw(r.quantity)}</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${formatNumberRaw(r.appliedCostBRL)}</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${formatNumberRaw(r.redeemedValueBRL)}</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${formatNumberRaw(r.realizedPnlBRL)}</Data></Cell>
    <Cell ss:StyleID="Percent"><Data ss:Type="Number">${r.finalReturnPct !== null ? (r.finalReturnPct / 100).toFixed(4) : "0.0000"}</Data></Cell>
   </Row>`,
      )
      .join("");

    sheet6 = `
 <Worksheet ss:Name="Resgates e Vendas">
  <Table ss:DefaultColumnWidth="110">
   <Column ss:Width="80"/>
   <Column ss:Width="160"/>
   <Column ss:Width="110"/>
   <Column ss:Width="130"/>
   <Column ss:Width="90"/>
   <Column ss:Width="90"/>
   <Column ss:Width="110"/>
   <Column ss:Width="110"/>
   <Column ss:Width="110"/>
   <Column ss:Width="90"/>
   <Row ss:StyleID="Header">
    <Cell><Data ss:Type="String">Ticker</Data></Cell>
    <Cell><Data ss:Type="String">Nome / Descrição</Data></Cell>
    <Cell><Data ss:Type="String">Classe</Data></Cell>
    <Cell><Data ss:Type="String">Setor</Data></Cell>
    <Cell><Data ss:Type="String">Data Resgate</Data></Cell>
    <Cell><Data ss:Type="String">Quantidade</Data></Cell>
    <Cell><Data ss:Type="String">Valor Aplicado (R$)</Data></Cell>
    <Cell><Data ss:Type="String">Valor Resgatado (R$)</Data></Cell>
    <Cell><Data ss:Type="String">Resultado (R$)</Data></Cell>
    <Cell><Data ss:Type="String">Rentab. Final (%)</Data></Cell>
   </Row>${redemptionRowsXml}
   </Table>
 </Worksheet>`;
  }

  // 7. Aba: Metas & Rebalanceamento (se fornecido)
  let sheet7 = "";
  if (data.classTargets && data.classTargets.length > 0) {
    const targetRowsXml = data.classTargets
      .map(
        (t) => `
   <Row>
    <Cell ss:StyleID="TextBold"><Data ss:Type="String">${escapeXml(t.assetClass)}</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${formatNumberRaw(t.currentBRL)}</Data></Cell>
    <Cell ss:StyleID="Percent"><Data ss:Type="Number">${(t.currentPct / 100).toFixed(4)}</Data></Cell>
    <Cell ss:StyleID="Percent"><Data ss:Type="Number">${(t.targetPct / 100).toFixed(4)}</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${formatNumberRaw(t.gapBRL)}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(t.status)}</Data></Cell>
   </Row>`,
      )
      .join("");

    sheet7 = `
 <Worksheet ss:Name="Metas e Rebalanceamento">
  <Table ss:DefaultColumnWidth="120">
   <Column ss:Width="130"/>
   <Column ss:Width="130"/>
   <Column ss:Width="100"/>
   <Column ss:Width="110"/>
   <Column ss:Width="130"/>
   <Column ss:Width="130"/>
   <Row ss:StyleID="Header">
    <Cell><Data ss:Type="String">Classe de Ativo</Data></Cell>
    <Cell><Data ss:Type="String">Posição Atual (R$)</Data></Cell>
    <Cell><Data ss:Type="String">% Atual</Data></Cell>
    <Cell><Data ss:Type="String">% Meta (Alvo)</Data></Cell>
    <Cell><Data ss:Type="String">Desvio / Gap (R$)</Data></Cell>
    <Cell><Data ss:Type="String">Status</Data></Cell>
   </Row>${targetRowsXml}
  </Table>
 </Worksheet>`;
  }

  return `${xmlHeader}${sheet1}${sheet2}${sheet3}${sheet4}${sheet5}${sheet6}${sheet7}\n</Workbook>`;
}

/**
 * Dispara o download nativo do arquivo Excel multi-abas no navegador.
 */
export function exportMultiSheetExcel(filename: string, data: ExcelWorkbookData): void {
  const xmlContent = generateMultiSheetExcelXml(data);
  const blob = new Blob([xmlContent], {
    type: "application/vnd.ms-excel;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename.endsWith(".xls") || filename.endsWith(".xlsx") ? filename : `${filename}.xls`;
  anchor.rel = "noopener";
  anchor.click();
  URL.revokeObjectURL(url);
}
