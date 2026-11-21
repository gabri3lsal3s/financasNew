
import { buildTearSheetModel } from '@/domain/reports';
import { OFFICIAL_WEALTH_TEAR_SHEET_DISCLAIMER } from '@/lib/institutional';
import { TearSheetExecutiveNarrative } from '@/features/reports/components/tear-sheet/TearSheetExecutiveNarrative';
import { TearSheetMovementStrip } from '@/features/reports/components/tear-sheet/TearSheetMovementStrip';
import { TearSheetAllocationSection } from '@/features/reports/components/tear-sheet/TearSheetAllocationSection';
import { TearSheetCustodyAndBreakdowns } from '@/features/reports/components/tear-sheet/TearSheetCustodyAndBreakdowns';
import { TearSheetMethodologyGrid } from '@/features/reports/components/tear-sheet/TearSheetMethodologyGrid';
import { ExecutiveReportDocument } from '@/features/investments/components/executive-report/executive-report-document';
import { SnapshotsEvolutionChart } from '@/features/investments/components/snapshots/snapshots-evolution-chart';
import { SnapshotsLedgerTable } from '@/features/investments/components/snapshots/snapshots-ledger-table';
import { createRoot } from "react-dom/client";
import { Landmark, Scale } from "lucide-react";
import "@/styles/globals.css";
import {
  ReportHeader,
  ReportRunningHeader,
  ReportExecutiveSummary,
  ReportWaterfallBar,
  ReportFooter,
  ReportRiskGauge,
  CardInvoicePrintView,
} from "@/components/modules";
import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money";
import { formatPercent } from "@/services/masks";
import { OFFICIAL_CVM_DISCLAIMER, OFFICIAL_TAX_FACILITATOR_DISCLAIMER } from "@/lib/institutional";
import { FinancialCloseSummary } from "@/features/reports/components/financial-close/FinancialCloseSummary";
import { FinancialDreTable } from "@/features/reports/components/financial-close/FinancialDreTable";
import { FinancialCompositionTables } from "@/features/reports/components/financial-close/FinancialCompositionTables";
import { FinancialPaidInvoicesSection } from "@/features/reports/components/financial-close/FinancialPaidInvoicesSection";
import { ConsolidatedBalanceSection } from "@/features/reports/components/consolidated-wealth/ConsolidatedBalanceSection";
import { TaxBensDireitosSection } from "@/features/reports/components/tax-facilitator/TaxBensDireitosSection";
import { TaxRendimentosSection } from "@/features/reports/components/tax-facilitator/TaxRendimentosSection";
import {
  buildExemptDividendsByAsset,
  buildTaxItemDetails,
} from "@/features/reports/components/tax-facilitator/tax-facilitator-utils";
import { calculateTotalCostBRL } from "@/domain/portfolio";
import { ReportDividendSparkline } from "@/components/modules/reports/report-dividend-sparkline";
import { Badge } from "@/components/ui/badge";
import { sanitizeReportText } from "@/domain/reports";
import { Sparkles, Flame } from "lucide-react";

// Mock Data
const dreMock = {
  grossIncomeCents: 1850000,
  totalExpensesCents: 894000,
  operationalSavingsCents: 956000,
  savingsRatePct: 51.68,
  investedAporteCents: 650000,
  netCashFlowCents: 306000,
};

const categoriesMock = [
  { name: "Moradia & Habitação", totalCents: 345000, pct: 38.59, budgetLimitCents: 350000 },
  { name: "Alimentação & Supermercado", totalCents: 212000, pct: 23.71, budgetLimitCents: 220000 },
  { name: "Transporte & Mobilidade", totalCents: 115000, pct: 12.86, budgetLimitCents: 120000 },
  { name: "Saúde & Cuidados", totalCents: 98000, pct: 10.96, budgetLimitCents: 100000 },
  { name: "Educação & Livros", totalCents: 64000, pct: 7.16, budgetLimitCents: 80000 },
  { name: "Lazer & Cultura", totalCents: 60000, pct: 6.72, budgetLimitCents: 80000 },
];

const paymentMethodsMock = [
  { method: "credit", label: "Cartão de Crédito", totalCents: 528000, pct: 59.06 },
  { method: "pix", label: "Pix / Transferência", totalCents: 286000, pct: 32.0 },
  { method: "slip", label: "Boleto Bancário", totalCents: 80000, pct: 8.94 },
];

const paidInvoicesMock = [
  {
    cardName: "Nubank Mastercard Platinum",
    competenceMonth: "2026-08",
    date: "2026-08-10",
    paidAt: "2026-08-10",
    amountCents: 528000,
  },
];

const fireMonthlyDividendsMock = [
  { month: "2025-09", label: "Set", amountCents: 285000 },
  { month: "2025-10", label: "Out", amountCents: 310000 },
  { month: "2025-11", label: "Nov", amountCents: 295000 },
  { month: "2025-12", label: "Dez", amountCents: 420000 },
  { month: "2026-01", label: "Jan", amountCents: 330000 },
  { month: "2026-02", label: "Fev", amountCents: 345000 },
  { month: "2026-03", label: "Mar", amountCents: 360000 },
  { month: "2026-04", label: "Abr", amountCents: 380000 },
  { month: "2026-05", label: "Mai", amountCents: 410000 },
  { month: "2026-06", label: "Jun", amountCents: 395000 },
  { month: "2026-07", label: "Jul", amountCents: 430000 },
  { month: "2026-08", label: "Ago", amountCents: 450000 },
];

const balanceSheetMock = {
  totalAssetsBRL: 485000,
  totalInvestmentsBRL: 380000,
  totalCostBRL: 320000,
  unrealizedPnlBRL: 60000,
  unrealizedPnlPct: 18.75,
  cashBalanceBRL: 85000,
  receivablesBRL: 20000,
  totalLiabilitiesBRL: 42000,
  debtsPayableBRL: 35000,
  creditCardInvoicesBRL: 7000,
  netWorthBRL: 443000,
  debtToAssetRatioPct: 8.66,
  dre: {
    grossIncomeBRL: 22000,
    totalExpensesBRL: 9800,
    operationalSavingsBRL: 12200,
    savingsRatePct: 55.45,
    investedAporteBRL: 8000,
    netCashFlowBRL: 4200,
  },
};

const assetsMock = [
  {
    id: "a1",
    user_id: "u1",
    ticker: "PETR4",
    asset_class: "acoes" as const,
    quantity: 400,
    average_price: 34.2,
    currency: "BRL" as const,
    created_at: "2024-01-15",
  },
  {
    id: "a2",
    user_id: "u1",
    ticker: "VALE3",
    asset_class: "acoes" as const,
    quantity: 200,
    average_price: 62.5,
    currency: "BRL" as const,
    created_at: "2024-02-10",
  },
  {
    id: "a3",
    user_id: "u1",
    ticker: "WEGE3",
    asset_class: "acoes" as const,
    quantity: 300,
    average_price: 48.0,
    currency: "BRL" as const,
    created_at: "2024-03-01",
  },
  {
    id: "a4",
    user_id: "u1",
    ticker: "KNRI11",
    asset_class: "fiis" as const,
    quantity: 120,
    average_price: 158.0,
    currency: "BRL" as const,
    created_at: "2024-01-20",
  },
  {
    id: "a5",
    user_id: "u1",
    ticker: "HGLG11",
    asset_class: "fiis" as const,
    quantity: 150,
    average_price: 162.5,
    currency: "BRL" as const,
    created_at: "2024-02-15",
  },
  {
    id: "a6",
    user_id: "u1",
    ticker: "Tesouro IPCA+ 2035",
    asset_class: "renda_fixa" as const,
    quantity: 15,
    average_price: 3466.67,
    currency: "BRL" as const,
    created_at: "2024-01-05",
  },
];

const dividendsMock = [
  {
    id: "d1",
    asset_id: "a1",
    user_id: "u1",
    amount: 1420.0,
    date: "2025-05-20",
    notes: "Dividendo PETR4",
    created_at: "2025-05-20",
  },
  {
    id: "d2",
    asset_id: "a2",
    user_id: "u1",
    amount: 780.0,
    date: "2025-06-15",
    notes: "JCP VALE3",
    created_at: "2025-06-15",
  },
  {
    id: "d3",
    asset_id: "a4",
    user_id: "u1",
    amount: 1368.0,
    date: "2025-08-15",
    notes: "Rendimento FII KNRI11",
    created_at: "2025-08-15",
  },
  {
    id: "d4",
    asset_id: "a5",
    user_id: "u1",
    amount: 1980.0,
    date: "2025-09-15",
    notes: "Rendimento FII HGLG11",
    created_at: "2025-09-15",
  },
];

const freedomAnalysisMock = {
  monthlyExpensesBRL: 7500,
  monthlyDividendsBRL: 4250,
  liquidReservesBRL: 90000,
  freedomPct: 56.67,
  freedomStage: "half" as const,
  stageLabel: "Segurança & Independência Parcial",
  runwayMonths: 12,
  totalSnowballAssetsCount: 2,
  snowballAssets: [
    {
      ticker: "MXRF11",
      currentPriceBRL: 10.5,
      monthlyIncomeGeneratedBRL: 180.0,
      newSharesPerMonth: 17.14,
      isSnowballReached: true,
      monthsToBuyOneShare: 0.06,
    },
    {
      ticker: "HGLG11",
      currentPriceBRL: 162.0,
      monthlyIncomeGeneratedBRL: 165.0,
      newSharesPerMonth: 1.02,
      isSnowballReached: true,
      monthsToBuyOneShare: 0.98,
    },
    {
      ticker: "KNRI11",
      currentPriceBRL: 158.0,
      monthlyIncomeGeneratedBRL: 144.0,
      newSharesPerMonth: 0.91,
      isSnowballReached: false,
      monthsToBuyOneShare: 1.1,
    },
  ],
};

const cardInvoiceProps = {
  cardName: "Nubank Mastercard Platinum",
  competenceMonth: "2026-08",
  competenceLabel: "Agosto de 2026",
  accountHolder: "Gabriel Sales",
  totalBrutoCents: 485000,
  totalPonderadoCents: 420000,
  pagoCents: 485000,
  saldoAbertoCents: 0,
  saldoPonderadoCents: 0,
  expenses: [
    {
      date: "2026-08-02",
      description: "Supermercado Pão de Açúcar",
      categoryName: "Alimentação & Supermercado",
      valueCents: 142000,
      reportValueCents: 142000,
      installments: "—",
    },
    {
      date: "2026-08-05",
      description: "Amazon Marketplace (Monitor 4K)",
      categoryName: "Educação & Tecnologia",
      valueCents: 120000,
      reportValueCents: 60000,
      installments: "2/5",
    },
    {
      date: "2026-08-11",
      description: "Droga Raia Farmácia",
      categoryName: "Saúde & Cuidados",
      valueCents: 38000,
      reportValueCents: 38000,
      installments: "—",
    },
    {
      date: "2026-08-15",
      description: "Posto Ipiranga Combustível",
      categoryName: "Transporte & Mobilidade",
      valueCents: 45000,
      reportValueCents: 45000,
      installments: "—",
    },
    {
      date: "2026-08-20",
      description: "Airbnb Reserva Feriado",
      categoryName: "Lazer & Cultura",
      valueCents: 140000,
      reportValueCents: 140000,
      installments: "1/3",
    },
  ],
  payments: [
    {
      date: "2026-08-10",
      note: "Pagamento Integral via Débito em Conta",
      amountCents: 485000,
      isRefund: false,
    },
  ],
};

function RenderDRE() {
  const periodLabel = "Agosto de 2026";
  const accountHolder = "Gabriel Sales";
  const effectiveGrossIncomeBruto = dreMock.grossIncomeCents;
  const effectiveTotalExpensesBruto = dreMock.totalExpensesCents;
  const effectiveGrossSavingsBruto = dreMock.operationalSavingsCents;
  const effectiveGrossSavingsRatePct = dreMock.savingsRatePct;

  const waterfallSteps = [
    {
      key: "income",
      label: "Receitas Realizadas",
      amountCents: effectiveGrossIncomeBruto,
      pctOfTotal: 100,
      type: "income" as const,
    },
    {
      key: "expenses",
      label: "Despesas Operacionais",
      amountCents: effectiveTotalExpensesBruto,
      pctOfTotal: (effectiveTotalExpensesBruto / effectiveGrossIncomeBruto) * 100,
      type: "expense" as const,
    },
    {
      key: "savings",
      label: "Poupança Líquida Operacional",
      amountCents: effectiveGrossSavingsBruto,
      pctOfTotal: (effectiveGrossSavingsBruto / effectiveGrossIncomeBruto) * 100,
      type: "savings" as const,
    },
  ];

  return (
    <div className="flex flex-col gap-5 w-full bg-white text-slate-900">
      <ReportHeader
        title="Relatório Executivo de Finanças Pessoais & DRE"
        subtitle="Demonstração do Resultado, Fluxo de Caixa & Composição de Gastos"
        periodLabel={periodLabel}
        appName="Axir"
        icon={Landmark}
        accountHolder={accountHolder}
      />

      <FinancialCloseSummary
        periodLabel={periodLabel}
        dre={dreMock}
        effectiveGrossIncomeBruto={effectiveGrossIncomeBruto}
        effectiveTotalExpensesBruto={effectiveTotalExpensesBruto}
        effectiveGrossSavingsBruto={effectiveGrossSavingsBruto}
        effectiveGrossSavingsRatePct={effectiveGrossSavingsRatePct}
        hasBrutoRef={false}
      />

      <ReportWaterfallBar
        title="Fluxo Contábil & Destinação da Renda (Cascata DRE)"
        grossIncomeCents={effectiveGrossIncomeBruto}
        steps={waterfallSteps}
      />

      <FinancialDreTable
        dre={dreMock}
        incomeCount={3}
        expenseCount={24}
        effectiveGrossIncomeBruto={effectiveGrossIncomeBruto}
        effectiveTotalExpensesBruto={effectiveTotalExpensesBruto}
        effectiveGrossSavingsBruto={effectiveGrossSavingsBruto}
        effectiveGrossSavingsRatePct={effectiveGrossSavingsRatePct}
        hasBrutoRef={false}
      />

      <ReportFooter
        accountHolder={accountHolder}
        reportType="dre"
        currentPage={1}
        totalPages={2}
        disclaimer="Documento estritamente informativo emitido automaticamente com base nos registros financeiros e contábeis inseridos pelo titular da conta."
        showQrCode
        className="hidden print:flex"
      />

      {/* Quebra controlada para a Página 2 */}
      <div className="print-page-break-after border-b border-border/80 my-4" />
      <ReportRunningHeader
        title="Relatório Executivo de Finanças Pessoais & DRE"
        periodLabel={periodLabel}
      />

      <FinancialCompositionTables
        categories={categoriesMock}
        paymentMethods={paymentMethodsMock}
        hasBrutoRef={false}
        hasBudgets={true}
      />

      <FinancialPaidInvoicesSection paidInvoices={paidInvoicesMock} />

      <ReportFooter
        accountHolder={accountHolder}
        reportType="dre"
        currentPage={2}
        totalPages={2}
        disclaimer="Documento estritamente informativo emitido automaticamente com base nos registros financeiros e contábeis inseridos pelo titular da conta."
        showQrCode
      />
    </div>
  );
}

function RenderBalanco() {
  const periodLabel = "Fechamento Consolidado — Agosto de 2026";
  const accountHolder = "Gabriel Sales";
  const totalAssets = balanceSheetMock.totalAssetsBRL;
  const pctOfAssets = (v: number) => (totalAssets > 0 ? (v / totalAssets) * 100 : 0);

  const assetSegments = [
    {
      key: "investments",
      label: "Investimentos em Custódia",
      value: balanceSheetMock.totalInvestmentsBRL,
      pct: pctOfAssets(balanceSheetMock.totalInvestmentsBRL),
      color: "hsl(var(--primary-strong))",
      formattedValue: <MoneyText cents={numberToCents(balanceSheetMock.totalInvestmentsBRL)} />,
    },
    {
      key: "cash",
      label: "Reserva de Caixa (Liquidez)",
      value: balanceSheetMock.cashBalanceBRL,
      pct: pctOfAssets(balanceSheetMock.cashBalanceBRL),
      color: "hsl(var(--cat-7))",
      formattedValue: <MoneyText cents={numberToCents(balanceSheetMock.cashBalanceBRL)} />,
    },
    {
      key: "receivables",
      label: "Contas a Receber",
      value: balanceSheetMock.receivablesBRL,
      pct: pctOfAssets(balanceSheetMock.receivablesBRL),
      color: "hsl(var(--portfolio))",
      formattedValue: <MoneyText cents={numberToCents(balanceSheetMock.receivablesBRL)} />,
    },
  ];

  return (
    <div className="flex flex-col gap-4 w-full bg-white text-slate-900">
      <ReportHeader
        title="Balanço Patrimonial 360° & Visão Consolidada"
        subtitle="Ativos Totais, Passivos Exigíveis, Patrimônio Líquido & Alavancagem"
        periodLabel={periodLabel}
        appName="Axir"
        icon={Scale}
        accountHolder={accountHolder}
      />

      <ReportExecutiveSummary
        title="SÍNTESE PATRIMONIAL & GRAU DE ALAVANCAGEM"
        items={[
          {
            label: "Patrimônio Líquido",
            value: <MoneyText cents={numberToCents(balanceSheetMock.netWorthBRL)} tone="portfolio" />,
            subtext: "Ativos (-) Passivos",
          },
          {
            label: "Ativos Totais",
            value: <MoneyText cents={numberToCents(balanceSheetMock.totalAssetsBRL)} tone="positive" />,
            subtext: "Custódia + Caixa",
          },
          {
            label: "Passivos Exigíveis",
            value: <MoneyText cents={numberToCents(balanceSheetMock.totalLiabilitiesBRL)} tone="negative" />,
            subtext: "Dívidas Totais",
          },
          {
            label: "Grau de Alavancagem",
            value: `${formatPercent(balanceSheetMock.debtToAssetRatioPct)}%`,
            subtext: "Dívida / Ativos",
          },
        ]}
      />

      <ConsolidatedBalanceSection
        balanceSheet={balanceSheetMock}
        assetSegments={assetSegments}
      />

      <ReportFooter
        accountHolder={accountHolder}
        disclaimer={OFFICIAL_CVM_DISCLAIMER}
        reportType="balance"
        currentPage={1}
        totalPages={1}
        showQrCode
      />
    </div>
  );
}

function RenderIRPF() {
  const accountHolder = "Gabriel Sales";
  const calendarYear = 2025;
  const currentYear = 2026;
  const usdRate = 5.25;

  const nonCashAssets = assetsMock;
  const taxItems = nonCashAssets.map((asset) => buildTaxItemDetails(asset, usdRate));
  const totalCostAllAssetsBRL = calculateTotalCostBRL(nonCashAssets, usdRate);
  const rendimentosPorAtivo = buildExemptDividendsByAsset(nonCashAssets, dividendsMock, calendarYear);
  const totalRendimentosBRL = rendimentosPorAtivo.reduce((acc, r) => acc + r.amountBRL, 0);

  return (
    <div className="flex flex-col gap-4 w-full bg-white text-slate-900">
      <ReportHeader
        title={`Facilitador de Declaração de IRPF — Ano-Base ${calendarYear}`}
        subtitle="Bens & Direitos (Discriminação Pronta) e Rendimentos Isentos & Exclusivos"
        periodLabel={`Exercício ${currentYear}`}
        appName="Axir"
        icon={Landmark}
        accountHolder={accountHolder}
      />

      <TaxBensDireitosSection
        items={taxItems}
        totalCostAllAssetsBRL={totalCostAllAssetsBRL}
        calendarYear={calendarYear}
        copiedKey={null}
        onCopy={() => {}}
      />

      <TaxRendimentosSection
        items={rendimentosPorAtivo}
        totalRendimentosBRL={totalRendimentosBRL}
        calendarYear={calendarYear}
      />

      <ReportFooter
        accountHolder={accountHolder}
        disclaimer={OFFICIAL_TAX_FACILITATOR_DISCLAIMER}
        reportType="irpf"
        currentPage={1}
        totalPages={1}
        showQrCode
      />
    </div>
  );
}

function RenderFIRE() {
  const accountHolder = "Gabriel Sales";
  const periodLabel = "Exercício Anual 2026";
  const yearDividendsBRL = 48600;

  const STAGES = [
    { key: "quarter", label: "1º Quarto", targetPct: 25, sub: "Início" },
    { key: "half", label: "Segurança", targetPct: 50, sub: "Metade" },
    { key: "three_quarters", label: "Independência", targetPct: 75, sub: "Avançado" },
    { key: "freedom", label: "Total (FIRE)", targetPct: 100, sub: "Concluído" },
  ];

  return (
    <div className="flex flex-col gap-4 w-full bg-white text-slate-900">
      <ReportHeader
        title="Dossiê de Proventos & Liberdade Financeira (FIRE)"
        subtitle="Fluxo de Dividendos, Estágio de Independência & Efeito Bola de Neve"
        periodLabel={periodLabel}
        appName="Axir"
        icon={Flame}
        accountHolder={accountHolder}
      />

      <ReportExecutiveSummary
        title="SÍNTESE DE PROVENTOS & INDEPENDÊNCIA FINANCEIRA"
        items={[
          {
            label: "Cobertura Atual",
            value: `${formatPercent(freedomAnalysisMock.freedomPct)}%`,
            subtext: "Proventos / Despesas",
          },
          {
            label: "Média Mensal",
            value: <MoneyText cents={numberToCents(freedomAnalysisMock.monthlyDividendsBRL)} tone="positive" />,
            subtext: "Renda Passiva",
          },
          {
            label: "Proventos Anuais",
            value: <MoneyText cents={numberToCents(yearDividendsBRL)} tone="positive" />,
            subtext: "Acumulado no Ano",
          },
          {
            label: "Reserva de Emergência",
            value: `${freedomAnalysisMock.runwayMonths} meses`,
            subtext: "Sobrevida Líquida",
          },
        ]}
      />

      {/* Régua FIRE dos 5 marcos uniformes */}
      <section aria-label="Estágio de Independência Financeira" className="break-inside-avoid flex flex-col gap-2 rounded-xl border border-border/80 p-3 sm:p-4 bg-muted/10">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-foreground">
            Estágio de Independência Financeira (FIRE)
          </span>
          <span className="text-xs font-semibold text-primary font-mono num">
            {formatPercent(freedomAnalysisMock.freedomPct)}% atingido
          </span>
        </div>

        <div className="relative pt-1 pb-2">
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${Math.min(freedomAnalysisMock.freedomPct, 100)}%` }}
            />
          </div>

          <div className="grid grid-cols-4 pt-2 text-[10px] text-muted-foreground">
            {STAGES.map((s) => (
              <div key={s.key} className="text-center flex flex-col items-center">
                <span className="font-bold text-foreground whitespace-nowrap">{s.label}</span>
                <span className="text-[9px] font-mono">{s.targetPct}%</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sparkline de Dividendos */}
      <ReportDividendSparkline
        points={fireMonthlyDividendsMock}
        referenceYear={2026}
        averageMonthlyCents={numberToCents(freedomAnalysisMock.monthlyDividendsBRL)}
        projectedAnnualCents={numberToCents(freedomAnalysisMock.monthlyDividendsBRL * 12)}
      />

      {/* Efeito Bola de Neve */}
      <section aria-label="Efeito Bola de Neve" className="break-inside-avoid flex flex-col gap-2.5 pt-1">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/80 pb-1.5">
          <div className="flex items-center gap-2">
            <Sparkles className="size-3.5 text-muted-foreground" aria-hidden="true" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Ativos no Efeito Bola de Neve (Reinvestimento Próprio)
            </h3>
          </div>
          <span className="text-[11px] text-muted-foreground font-mono num">
            {freedomAnalysisMock.totalSnowballAssetsCount}{" "}
            {freedomAnalysisMock.totalSnowballAssetsCount === 1
              ? "ativo autossustentável"
              : "ativos autossustentáveis"}
          </span>
        </div>

        <div className="w-full min-w-0 overflow-x-auto no-scrollbar scroll-smooth rounded-xl border border-border/80 print:overflow-visible">
          <table className="w-full min-w-[540px] sm:min-w-0 text-left text-xs border-collapse table-fixed">
            <colgroup>
              <col style={{ width: "20%" }} />
              <col style={{ width: "18%" }} />
              <col style={{ width: "22%" }} />
              <col style={{ width: "20%" }} />
              <col style={{ width: "20%" }} />
            </colgroup>
            <thead>
              <tr className="border-b border-border/70 bg-muted/40 text-muted-foreground font-bold text-[10px] uppercase tracking-wider">
                <th className="py-2 px-3">Ticker</th>
                <th className="py-2 px-3 text-right">Preço (R$)</th>
                <th className="py-2 px-3 text-right">Renda Mensal (R$)</th>
                <th className="py-2 px-3 text-right">Cotas / Mês</th>
                <th className="py-2 px-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {freedomAnalysisMock.snowballAssets.map((sb) => (
                <tr key={sb.ticker} className="hover:bg-muted/20 break-inside-avoid even:bg-muted/20 print:even:bg-muted/20">
                  <td className="py-1.5 px-3 font-semibold text-foreground whitespace-nowrap">
                    {sanitizeReportText(sb.ticker)}
                  </td>
                  <td className="py-1.5 px-3 text-right num font-mono whitespace-nowrap">
                    <MoneyText cents={numberToCents(sb.currentPriceBRL)} hideCurrency />
                  </td>
                  <td className="py-1.5 px-3 text-right num font-mono text-positive-strong font-bold whitespace-nowrap">
                    <MoneyText cents={numberToCents(sb.monthlyIncomeGeneratedBRL)} hideCurrency />
                  </td>
                  <td className="py-1.5 px-3 text-right num font-mono font-bold text-foreground whitespace-nowrap">
                    {sb.newSharesPerMonth.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
                    {sb.newSharesPerMonth === 1 ? "cota" : "cotas"}
                  </td>
                  <td className="py-1.5 px-3 text-center whitespace-nowrap">
                    <Badge variant={sb.isSnowballReached ? "positive" : "muted"} size="xs">
                      {sb.isSnowballReached
                        ? "Bola de Neve Ativa"
                        : `${Math.ceil(sb.monthsToBuyOneShare)} ${Math.ceil(sb.monthsToBuyOneShare) === 1 ? "mês" : "meses"} p/ 1 cota`}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <ReportFooter
        accountHolder={accountHolder}
        disclaimer={OFFICIAL_CVM_DISCLAIMER}
        reportType="fire"
        currentPage={1}
        totalPages={1}
        showQrCode
      />
    </div>
  );
}

function RenderFatura() {
  return (
    <div className="flex flex-col gap-4 w-full bg-white text-slate-900">
      <CardInvoicePrintView {...cardInvoiceProps} />
    </div>
  );
}


// ==========================================
// 6. DOSSIÊ EXECUTIVO DA POSIÇÃO VIGENTE (INVESTIMENTOS)
// ==========================================
const mockTearSheetRows = [
  {
    ticker: 'ITUB4',
    name: 'Itaú Unibanco PN',
    assetClass: 'Ações Brasil',
    sector: 'Financeiro',
    quantity: 400,
    priceBRL: 36.50,
    valueBRL: 14600,
    costBRL: 12200,
    allocationPct: 15.2,
    targetPct: 15.0,
    currency: 'BRL',
    unrealizedPnlBRL: 2400,
    unrealizedPnlPct: 19.67,
    isCash: false,
    assetOrigin: 'active' as const,
  },
  {
    ticker: 'VALE3',
    name: 'Vale ON',
    assetClass: 'Ações Brasil',
    sector: 'Materiais Básicos',
    quantity: 150,
    priceBRL: 58.20,
    valueBRL: 8730,
    costBRL: 9400,
    allocationPct: 9.1,
    targetPct: 10.0,
    currency: 'BRL',
    unrealizedPnlBRL: -670,
    unrealizedPnlPct: -7.13,
    isCash: false,
    assetOrigin: 'active' as const,
  },
  {
    ticker: 'HGLG11',
    name: 'CSHG Logística FII',
    assetClass: 'Fundos Imobiliários',
    sector: 'Logística',
    quantity: 120,
    priceBRL: 162.40,
    valueBRL: 19488,
    costBRL: 18100,
    allocationPct: 20.3,
    targetPct: 20.0,
    currency: 'BRL',
    unrealizedPnlBRL: 1388,
    unrealizedPnlPct: 7.67,
    isCash: false,
    assetOrigin: 'active' as const,
  },
  {
    ticker: 'KNCR11',
    name: 'Kinea Rendimentos Imobiliários',
    assetClass: 'Fundos Imobiliários',
    sector: 'Papel / CRI',
    quantity: 180,
    priceBRL: 102.10,
    valueBRL: 18378,
    costBRL: 18000,
    allocationPct: 19.1,
    targetPct: 20.0,
    currency: 'BRL',
    unrealizedPnlBRL: 378,
    unrealizedPnlPct: 2.10,
    isCash: false,
    assetOrigin: 'active' as const,
  },
  {
    ticker: 'TESOURO-IPCA-32',
    name: 'Tesouro IPCA+ 2032',
    assetClass: 'Renda Fixa',
    sector: 'Títulos Públicos',
    quantity: 5,
    priceBRL: 3840.50,
    valueBRL: 19202.50,
    costBRL: 18500,
    allocationPct: 20.0,
    targetPct: 20.0,
    currency: 'BRL',
    unrealizedPnlBRL: 702.50,
    unrealizedPnlPct: 3.80,
    isCash: false,
    assetOrigin: 'active' as const,
    indexType: 'IPCA + 6,24% a.a.',
    maturityDate: '2032-08-15',
  },
  {
    ticker: 'IVVB11',
    name: 'iShares S&P 500 Fundo de Índice',
    assetClass: 'Internacional Global',
    sector: 'Internacional Global',
    quantity: 45,
    priceBRL: 348.00,
    valueBRL: 15660,
    costBRL: 13800,
    allocationPct: 16.3,
    targetPct: 15.0,
    currency: 'BRL',
    unrealizedPnlBRL: 1860,
    unrealizedPnlPct: 13.48,
    isCash: false,
    assetOrigin: 'active' as const,
  },
];

const mockAllocationAnalysis = {
  alignmentScore: 88,
  classes: [
    { classKey: 'stock_br', label: 'Ações Brasil', currentPct: 24.3, targetPct: 25.0, driftPct: -0.7, currentValueBRL: 23330 },
    { classKey: 'fii', label: 'Fundos Imobiliários', currentPct: 39.4, targetPct: 40.0, driftPct: -0.6, currentValueBRL: 37866 },
    { classKey: 'fixed_income', label: 'Renda Fixa & Pós', currentPct: 20.0, targetPct: 20.0, driftPct: 0.0, currentValueBRL: 19202.50 },
    { classKey: 'stock_intl', label: 'Internacional', currentPct: 16.3, targetPct: 15.0, driftPct: 1.3, currentValueBRL: 15660 },
  ],
  totalPortfolioBRL: 96058.50,
  cashBRL: 10318.93,
  deficitClass: 'stock_br',
  surplusClass: 'stock_intl',
  topDeficitClass: { assetClass: 'Ações Brasil', gapBRL: 684.63 },
};

const mockConcentrationRisk = {
  top5Pct: 58.4,
  hhiIndex: 1240,
  riskTier: 'healthy' as const,
  largestAssetTicker: 'HGLG11',
  largestAssetPct: 20.3,
  warningCount: 0,
};

const mockTwr = {
  status: 'ok' as const,
  accumulatedRatePct: 18.42,
  annualizedRatePct: 11.25,
  monthsElapsed: 24,
  monthlyPoints: [],
};

const mockIrr = {
  rate: 0.128,
  annualizedRatePct: 12.8,
  periodReturnPct: 12.8,
  isReliable: true,
};

const mockSeriesPoints = [
  {
    month: '2025-11',
    valueBRL: 72400.00,
    costBRL: 68000.00,
    netContributionBRL: 2000.00,
    monthDividendsBRL: 310.00,
    accumulatedDividendsBRL: 310.00,
    capitalGainPnl: 4400.00,
    capitalGainPct: 6.47,
    totalReturnPnl: 4710.00,
    totalReturnPct: 6.93,
    twrMonthPct: 1.45,
    twrAccumulatedPct: 1.45,
    sharePrice: 101.45,
    status: 'closed' as const,
  },
  {
    month: '2025-12',
    valueBRL: 76800.00,
    costBRL: 70000.00,
    netContributionBRL: 2000.00,
    monthDividendsBRL: 345.00,
    accumulatedDividendsBRL: 655.00,
    capitalGainPnl: 6800.00,
    capitalGainPct: 9.71,
    totalReturnPnl: 7455.00,
    totalReturnPct: 10.65,
    twrMonthPct: 2.10,
    twrAccumulatedPct: 3.58,
    sharePrice: 103.58,
    status: 'closed' as const,
  },
  {
    month: '2026-01',
    valueBRL: 79200.00,
    costBRL: 72000.00,
    netContributionBRL: 2000.00,
    monthDividendsBRL: 360.00,
    accumulatedDividendsBRL: 1015.00,
    capitalGainPnl: 7200.00,
    capitalGainPct: 10.00,
    totalReturnPnl: 8215.00,
    totalReturnPct: 11.41,
    twrMonthPct: 0.85,
    twrAccumulatedPct: 4.46,
    sharePrice: 104.46,
    status: 'closed' as const,
  },
  {
    month: '2026-02',
    valueBRL: 81900.00,
    costBRL: 74000.00,
    netContributionBRL: 2000.00,
    monthDividendsBRL: 380.00,
    accumulatedDividendsBRL: 1395.00,
    capitalGainPnl: 7900.00,
    capitalGainPct: 10.68,
    totalReturnPnl: 9295.00,
    totalReturnPct: 12.56,
    twrMonthPct: 1.20,
    twrAccumulatedPct: 5.71,
    sharePrice: 105.71,
    status: 'closed' as const,
  },
  {
    month: '2026-03',
    valueBRL: 85400.00,
    costBRL: 76000.00,
    netContributionBRL: 2000.00,
    monthDividendsBRL: 395.00,
    accumulatedDividendsBRL: 1790.00,
    capitalGainPnl: 9400.00,
    capitalGainPct: 12.37,
    totalReturnPnl: 11190.00,
    totalReturnPct: 14.72,
    twrMonthPct: 1.75,
    twrAccumulatedPct: 7.56,
    sharePrice: 107.56,
    status: 'closed' as const,
  },
  {
    month: '2026-04',
    valueBRL: 88100.00,
    costBRL: 78000.00,
    netContributionBRL: 2000.00,
    monthDividendsBRL: 410.00,
    accumulatedDividendsBRL: 2200.00,
    capitalGainPnl: 10100.00,
    capitalGainPct: 12.95,
    totalReturnPnl: 12300.00,
    totalReturnPct: 15.77,
    twrMonthPct: 0.95,
    twrAccumulatedPct: 8.58,
    sharePrice: 108.58,
    status: 'closed' as const,
  },
  {
    month: '2026-05',
    valueBRL: 91500.00,
    costBRL: 80000.00,
    netContributionBRL: 2000.00,
    monthDividendsBRL: 425.00,
    accumulatedDividendsBRL: 2625.00,
    capitalGainPnl: 11500.00,
    capitalGainPct: 14.38,
    totalReturnPnl: 14125.00,
    totalReturnPct: 17.66,
    twrMonthPct: 1.60,
    twrAccumulatedPct: 10.32,
    sharePrice: 110.32,
    status: 'closed' as const,
  },
  {
    month: '2026-06',
    valueBRL: 94800.00,
    costBRL: 82000.00,
    netContributionBRL: 2000.00,
    monthDividendsBRL: 440.00,
    accumulatedDividendsBRL: 3065.00,
    capitalGainPnl: 12800.00,
    capitalGainPct: 15.61,
    totalReturnPnl: 15865.00,
    totalReturnPct: 19.35,
    twrMonthPct: 1.40,
    twrAccumulatedPct: 11.86,
    sharePrice: 111.86,
    status: 'closed' as const,
  },
  {
    month: '2026-07',
    valueBRL: 98200.00,
    costBRL: 84000.00,
    netContributionBRL: 2000.00,
    monthDividendsBRL: 450.00,
    accumulatedDividendsBRL: 3515.00,
    capitalGainPnl: 14200.00,
    capitalGainPct: 16.90,
    totalReturnPnl: 17715.00,
    totalReturnPct: 21.09,
    twrMonthPct: 1.35,
    twrAccumulatedPct: 13.37,
    sharePrice: 113.37,
    status: 'closed' as const,
  },
  {
    month: '2026-08',
    valueBRL: 101400.00,
    costBRL: 86000.00,
    netContributionBRL: 2000.00,
    monthDividendsBRL: 465.00,
    accumulatedDividendsBRL: 3980.00,
    capitalGainPnl: 15400.00,
    capitalGainPct: 17.91,
    totalReturnPnl: 19380.00,
    totalReturnPct: 22.53,
    twrMonthPct: 1.15,
    twrAccumulatedPct: 14.67,
    sharePrice: 114.67,
    status: 'closed' as const,
  },
  {
    month: '2026-09',
    valueBRL: 103900.00,
    costBRL: 88000.00,
    netContributionBRL: 2000.00,
    monthDividendsBRL: 475.00,
    accumulatedDividendsBRL: 4455.00,
    capitalGainPnl: 15900.00,
    capitalGainPct: 18.07,
    totalReturnPnl: 20355.00,
    totalReturnPct: 23.13,
    twrMonthPct: 0.90,
    twrAccumulatedPct: 15.70,
    sharePrice: 115.70,
    status: 'closed' as const,
  },
  {
    month: '2026-10',
    valueBRL: 106377.43,
    costBRL: 90000.00,
    netContributionBRL: 1500.00,
    monthDividendsBRL: 482.30,
    accumulatedDividendsBRL: 4890.00,
    capitalGainPnl: 16377.43,
    capitalGainPct: 18.20,
    totalReturnPnl: 21267.43,
    totalReturnPct: 23.63,
    twrMonthPct: 1.84,
    twrAccumulatedPct: 18.42,
    sharePrice: 118.42,
    status: 'closed' as const,
  },
];

function RenderTearSheet() {
  const periodLabel = 'Posição Atual Consolidada (Nov/2026)';
  const accountHolder = 'Gabriel Sales';
  const appName = 'Axir';
  const totalBRL = 106377.43;
  const totalCostBRL = 90000;
  const cashBRL = 10318.93;

  const model = buildTearSheetModel({
    rows: mockTearSheetRows,
    totalBRL,
    totalCostBRL,
    cashBRL,
    allocationAnalysis: mockAllocationAnalysis,
    concentrationRisk: mockConcentrationRisk,
    portfolioTwr: mockTwr,
    monthlySeries: mockSeriesPoints,
    allTimeEconomicPnlBRL: 21267.43,
    realizedPnlBRL: 4890.00,
  });

  return (
    <div className='flex flex-col gap-5 print:gap-2.5 w-full bg-white text-slate-900'>
      <ReportHeader
        title='Dossiê Executivo da Posição Vigente Consolidada'
        subtitle='Posição Patrimonial Consolidada & Diagnóstico de Metas'
        periodLabel={periodLabel}
        appName={appName}
        icon={Landmark}
        accountHolder={accountHolder}
      />
      <TearSheetExecutiveNarrative
        model={model}
        totalBRL={totalBRL}
        totalCostBRL={totalCostBRL}
        cashBRL={cashBRL}
        allocationAnalysis={mockAllocationAnalysis}
        portfolioTwr={mockTwr}
        allTimeEconomicPnlBRL={21267.43}
      />
      <TearSheetMovementStrip
        monthSummary={{
          month: '2026-11',
          monthLabel: 'Novembro/2026',
          buysBRL: 1500,
          sellsBRL: 0,
          dividendsBRL: 482.30,
          netFlowBRL: 1500,
        }}
      />
      <TearSheetAllocationSection
        alignmentScore={mockAllocationAnalysis.alignmentScore}
        stackedSegments={model.stackedSegments}
        allocationRows={model.allocationRows}
      />
      <ReportRiskGauge
        topItemName={sanitizeReportText(model.topDominance.ticker)}
        topItemPct={model.topDominance.pct}
        warningThresholdPct={15}
        criticalThresholdPct={25}
      />
      <ReportFooter
        accountHolder={accountHolder}
        disclaimer={OFFICIAL_WEALTH_TEAR_SHEET_DISCLAIMER}
        reportType='dossier'
        currentPage={1}
        totalPages={7}
        showQrCode
        className="hidden print:flex"
      />
      <TearSheetCustodyAndBreakdowns
        model={model}
        totalBRL={totalBRL}
        periodLabel={periodLabel}
        accountHolder={accountHolder}
        assetsMetadata={[]}
      />
      <TearSheetMethodologyGrid
        portfolioTwr={mockTwr}
        portfolioIrr={mockIrr}
        totalReturnPct={model.totalReturnPct}
        historicalPnlBRL={21267.43}
      />
      <ReportFooter
        accountHolder={accountHolder}
        disclaimer={OFFICIAL_WEALTH_TEAR_SHEET_DISCLAIMER}
        reportType='dossier'
        currentPage={7}
        totalPages={7}
        showQrCode
      />
    </div>
  );
}

// ==========================================
// 7. RELATÓRIO EXECUTIVO MENSAL DA CARTEIRA (INVESTIMENTOS)
// ==========================================
const mockClassGroups = [
  {
    className: 'Ações Brasil',
    color: '#0D9488',
    totalCents: numberToCents(23330),
    totalCostCents: numberToCents(21600),
    sharePct: (23330 / 106377.43) * 100, // 21,9%
    pnlPct: ((23330 - 21600) / 21600) * 100,
    subtotalPriceVarPct: ((23330 - 21600) / 21600) * 100,
    items: [
      {
        ticker: 'ITUB4',
        name: 'Itaú Unibanco PN',
        sector: 'Financeiro',
        quantity: 400,
        avgPriceCents: numberToCents(12200 / 400),
        currentPriceCents: numberToCents(36.50),
        totalCents: numberToCents(14600),
        pricePnlPct: 19.67,
        pnlPct: 19.67,
      },
      {
        ticker: 'VALE3',
        name: 'Vale ON',
        sector: 'Materiais Básicos',
        quantity: 150,
        avgPriceCents: numberToCents(9400 / 150),
        currentPriceCents: numberToCents(58.20),
        totalCents: numberToCents(8730),
        pricePnlPct: -7.13,
        pnlPct: -7.13,
      },
    ],
  },
  {
    className: 'Fundos Imobiliários',
    color: '#10B981',
    totalCents: numberToCents(37866),
    totalCostCents: numberToCents(36100),
    sharePct: (37866 / 106377.43) * 100, // 35,6%
    pnlPct: ((37866 - 36100) / 36100) * 100,
    subtotalPriceVarPct: ((37866 - 36100) / 36100) * 100,
    items: [
      {
        ticker: 'HGLG11',
        name: 'CSHG Logística FII',
        sector: 'Logística',
        quantity: 120,
        avgPriceCents: numberToCents(18100 / 120),
        currentPriceCents: numberToCents(162.40),
        totalCents: numberToCents(19488),
        pricePnlPct: 7.67,
        pnlPct: 7.67,
      },
      {
        ticker: 'KNCR11',
        name: 'Kinea Rendimentos Imobiliários',
        sector: 'Recebíveis',
        quantity: 180,
        avgPriceCents: numberToCents(18000 / 180),
        currentPriceCents: numberToCents(102.10),
        totalCents: numberToCents(18378),
        pricePnlPct: 2.10,
        pnlPct: 2.10,
      },
    ],
  },
  {
    className: 'Renda Fixa & Títulos Públicos',
    color: '#6366F1',
    totalCents: numberToCents(19202.50),
    totalCostCents: numberToCents(18500),
    sharePct: (19202.50 / 106377.43) * 100, // 18,1%
    pnlPct: ((19202.50 - 18500) / 18500) * 100,
    subtotalPriceVarPct: ((19202.50 - 18500) / 18500) * 100,
    items: [
      {
        ticker: 'TESOURO-IPCA-32',
        name: 'Tesouro IPCA+ 2032 (IPCA + 6,24% a.a. · Venc. Ago/2032)',
        sector: 'Tesouro Direto',
        quantity: 5,
        avgPriceCents: numberToCents(18500 / 5),
        currentPriceCents: numberToCents(3840.50),
        totalCents: numberToCents(19202.50),
        pricePnlPct: 3.80,
        pnlPct: 3.80,
        indexType: 'IPCA + 6,24% a.a.',
        maturityDate: '2032-08-15',
      },
    ],
  },
  {
    className: 'Internacional & ETFs Globais',
    color: '#3B82F6',
    totalCents: numberToCents(15660),
    totalCostCents: numberToCents(13800),
    sharePct: (15660 / 106377.43) * 100, // 14,7%
    pnlPct: ((15660 - 13800) / 13800) * 100,
    subtotalPriceVarPct: ((15660 - 13800) / 13800) * 100,
    items: [
      {
        ticker: 'IVVB11',
        name: 'iShares S&P 500 ETF',
        sector: 'Índice Global',
        quantity: 45,
        avgPriceCents: numberToCents(13800 / 45),
        currentPriceCents: numberToCents(348.00),
        totalCents: numberToCents(15660),
        pricePnlPct: 13.48,
        pnlPct: 13.48,
        currency: 'BRL',
      },
    ],
  },
];

function RenderCarteiraMensal() {
  const periodLabel = 'Outubro de 2026';
  const accountHolder = 'Gabriel Sales';
  const appName = 'Axir';

  return (
    <div className='flex flex-col gap-5 w-full bg-white text-slate-900'>
      <ExecutiveReportDocument
        periodLabel={periodLabel}
        appName={appName}
        accountHolder={accountHolder}
        effectiveTotalBRL={106377.43}
        effectiveCostBRL={90000.00}
        effectiveCashBRL={10318.93}
        investmentCount={6}
        classGroups={mockClassGroups}
        pqs={8.2}
        monthlyData={{
          monthlyStatement: {
            monthRatePct: 1.84,
            monthNetPnlBRL: 1954.20,
            monthDividendsBRL: 482.30,
            monthBuysBRL: 1500.00,
            monthSellsBRL: 0,
            monthNetContributionBRL: 1500.00,
            netAporteBRL: 1500.00,
          },
          monthDividendsTotalBRL: 482.30,
          positions: [],
        } as unknown as NonNullable<React.ComponentProps<typeof ExecutiveReportDocument>["monthlyData"]>}
        onOpenClosing={() => {}}
      />
    </div>
  );
}

// ==========================================
// 8. EXTRATO ANALÍTICO DE SNAPSHOTS PATRIMONIAIS (INVESTIMENTOS)
// ==========================================
function RenderExtratoSnapshots() {
  const periodLabel = 'Histórico Consolidado (2025 - 2026)';
  const accountHolder = 'Gabriel Sales';

  const summary = {
    totalMonths: mockSeriesPoints.length,
    latestValueBRL: 106377.43,
    latestCostBRL: 90000.00,
    periodDividendsBRL: 4890.00,
    totalHistoricalDividendsBRL: 6120.00,
    latestTwrPct: 18.42,
  };

  return (
    <div className='flex flex-col gap-5 print:gap-2.5 w-full bg-white text-slate-900'>
      <ReportHeader
        title='Extrato Analítico de Snapshots Patrimoniais'
        subtitle='Histórico Mensal Consolidado · Evolução Patrimonial, Retorno Pessoal & TWR'
        periodLabel={periodLabel}
        appName='Axir'
        icon={Landmark}
        accountHolder={accountHolder}
      />
      <SnapshotsEvolutionChart
        series={mockSeriesPoints}
        summary={summary}
      />
      <SnapshotsLedgerTable
        points={mockSeriesPoints}
        currentMonthStr='2026-10'
        onCloseModal={() => {}}
        onCalibrate={() => {}}
        onRestore={() => {}}
        onDelete={() => {}}
      />
      <ReportFooter
        accountHolder={accountHolder}
        disclaimer={OFFICIAL_CVM_DISCLAIMER}
        reportType='ledger'
        currentPage={1}
        totalPages={1}
        showQrCode
      />
    </div>
  );
}

function App() {
  const params = new URLSearchParams(window.location.search);
  const report = params.get('report') || 'dre';

  return (
    <div className='w-full flex justify-center items-start py-6 px-4 print:p-0 print:m-0 print:block'>
      <div className='print-document bg-white w-full max-w-[210mm] p-8 shadow-xl rounded-xl border border-slate-200 print:p-0 print:shadow-none print:border-none print:max-w-none print:w-full'>
        {report === 'dre' && <RenderDRE />}
        {report === 'balanco' && <RenderBalanco />}
        {report === 'irpf' && <RenderIRPF />}
        {report === 'fire' && <RenderFIRE />}
        {report === 'fatura' && <RenderFatura />}
        {report === 'dossie_posicao' && <RenderTearSheet />}
        {report === 'carteira_mensal' && <RenderCarteiraMensal />}
        {report === 'extrato_snapshots' && <RenderExtratoSnapshots />}
      </div>
    </div>
  );
}

const rootElement = document.getElementById('sample-root');
if (rootElement) {
  createRoot(rootElement).render(<App />);
}
