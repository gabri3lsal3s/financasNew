import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Landmark, TrendingUp } from "lucide-react";
import { getPublicAppUrl } from "@/services/app-url";
import {
  ReportHeader,
  ReportFooter,
  ReportKpiGrid,
  ReportDonutChart,
  ReportStackedBar,
  ReportRiskGauge,
  ReportDividendSparkline,
  ReportWaterfallBar,
  ReportClassTables,
  ReportDocumentLayout,
  ReportPerformanceChart,
  ReportMonthlyMovements,
  ReportStocksBreakdownCard,
  ReportFiiBreakdownCard,
  ReportFixedIncomeBreakdownCard,
  ReportInternationalBreakdownCard,
} from "./index";

describe("Fase 44 — Primitivos Editoriais e Gráficos de Relatórios A4", () => {
  it("renderiza ReportHeader com título, competência e monograma", () => {
    render(
      <ReportHeader
        title="Dossiê Executivo de Investimentos"
        subtitle="Posição Consolidada"
        periodLabel="Agosto de 2026"
        accountHolder="Gabriel Sales"
      />,
    );

    expect(screen.getByText("Dossiê Executivo de Investimentos")).toBeInTheDocument();
    expect(screen.getByText("Posição Consolidada")).toBeInTheDocument();
    expect(screen.getByText("Agosto de 2026")).toBeInTheDocument();
    expect(screen.getByText(/Gabriel Sales/)).toBeInTheDocument();
  });

  it("renderiza ReportFooter com termos de confidencialidade, chancela com link para apresentação e sem QR Code por padrão", () => {
    render(
      <ReportFooter
        accountHolder="Gabriel Sales"
        documentId="DOC-202608-XYZ"
      />,
    );

    expect(screen.getByText(/Documento estritamente confidencial/)).toBeInTheDocument();
    expect(screen.getByText(/DOC-202608-XYZ/)).toBeInTheDocument();
    expect(screen.getByText("Relatório estruturado via Axir · Gestão Financeira Inteligente & Automação | axir.com.br")).toBeInTheDocument();
    
    // QR Code não é renderizado por padrão
    expect(screen.queryByLabelText(/QR Code de validação/i)).not.toBeInTheDocument();

    // Chancela Oficial é link discreto para a página de apresentação
    const chancelaLink = screen.getByRole("link", { name: "Chancela Oficial · axir.com.br" });
    expect(chancelaLink).toBeInTheDocument();
    expect(chancelaLink).toHaveAttribute("href", getPublicAppUrl("/apresentacao"));
    expect(chancelaLink).toHaveAttribute("target", "_blank");

    // Marca no bloco superior também possui link para a página de apresentação
    const brandLink = screen.getByRole("link", { name: "Axir" });
    expect(brandLink).toBeInTheDocument();
    expect(brandLink).toHaveAttribute("href", getPublicAppUrl("/apresentacao"));
  });

  it("permite exibir o micro QR Code no ReportFooter via showQrCode={true}", () => {
    render(
      <ReportFooter
        accountHolder="Gabriel Sales"
        documentId="DOC-202608-XYZ"
        showQrCode={true}
      />,
    );

    expect(screen.getByLabelText(/QR Code de validação do documento DOC-202608-XYZ/i)).toBeInTheDocument();
  });

  it("permite customizar a URL de apresentação, validação e textos no ReportFooter", () => {
    render(
      <ReportFooter
        accountHolder="Gabriel Sales"
        creditText="Relatório Customizado · Contabilidade Alpha | alpha.com"
        chancelaText="Chancela Oficial · alpha.com"
        presentationUrl="https://alpha.com/conheca"
        validationUrl="https://alpha.com/cert/123"
        showQrCode={true}
      />,
    );

    expect(screen.getByText("Relatório Customizado · Contabilidade Alpha | alpha.com")).toBeInTheDocument();
    const chancelaLink = screen.getByRole("link", { name: "Chancela Oficial · alpha.com" });
    expect(chancelaLink).toHaveAttribute("href", "https://alpha.com/conheca");
    expect(screen.getByRole("img", { name: /QR Code de validação do documento/i })).toBeInTheDocument();
  });

  it("renderiza ReportKpiGrid com múltiplos indicadores e ícones", () => {
    render(
      <ReportKpiGrid
        items={[
          { label: "Patrimônio Total", value: "R$ 100.000,00", tone: "primary", icon: Landmark },
          { label: "Proventos 12m", value: "R$ 6.500,00", tone: "positive", icon: TrendingUp },
        ]}
      />,
    );

    expect(screen.getByText("Patrimônio Total")).toBeInTheDocument();
    expect(screen.getByText("R$ 100.000,00")).toBeInTheDocument();
    expect(screen.getByText("Proventos 12m")).toBeInTheDocument();
    expect(screen.getByText("R$ 6.500,00")).toBeInTheDocument();
  });

  it("renderiza ReportDonutChart em SVG com fatias e legenda", () => {
    render(
      <ReportDonutChart
        title="Alocação por Classe"
        segments={[
          { key: "acoes", label: "Ações", value: 40000, pct: 40, color: "#1b6b62" },
          { key: "fiis", label: "FIIs", value: 60000, pct: 60, color: "#dda726" },
        ]}
        centerLabel="Total"
        centerValue="R$ 100k"
      />,
    );

    expect(screen.getByText("Alocação por Classe")).toBeInTheDocument();
    expect(screen.getByText("Ações")).toBeInTheDocument();
    expect(screen.getByText("FIIs")).toBeInTheDocument();
    expect(screen.getByText("40,0%")).toBeInTheDocument();
    expect(screen.getByText("60,0%")).toBeInTheDocument();
  });

  it("renderiza ReportDonutChart sem legenda quando showLegend é false", () => {
    render(
      <ReportDonutChart
        title="Alocação por Classe"
        segments={[
          { key: "acoes", label: "Ações Brasil", value: 40000, pct: 40, color: "#1b6b62" },
          { key: "fiis", label: "Fundos Imobiliários", value: 60000, pct: 60, color: "#dda726" },
        ]}
        centerLabel="Ações Brasil"
        centerValue="R$ 40k"
        showLegend={false}
      />,
    );

    expect(screen.getByText("Ações Brasil")).toBeInTheDocument();
    expect(screen.getByText("R$ 40k")).toBeInTheDocument();
    // Legenda lateral e título não devem ser renderizados
    expect(screen.queryByText("Fundos Imobiliários")).not.toBeInTheDocument();
    expect(screen.queryByText("40,0%")).not.toBeInTheDocument();
  });

  it("renderiza ReportDonutChart com safe zone circular concêntrica e respiro interno", () => {
    const { container } = render(
      <ReportDonutChart
        segments={[{ key: "ativos", label: "Ativos", value: 18215, pct: 100, color: "#1b6b62" }]}
        centerLabel="Ativos"
        centerValue="R$ 18.215,13"
        size={136}
      />,
    );

    const centerContainer = container.querySelector(".inset-\\[10\\%\\]");
    expect(centerContainer).toBeInTheDocument();
    expect(centerContainer).toHaveClass("rounded-full");
    expect(screen.getAllByText("Ativos")).toHaveLength(2);
    expect(screen.getByText("R$ 18.215,13")).toBeInTheDocument();
  });

  it("renderiza ReportStackedBar com distribuição proporcional", () => {
    render(
      <ReportStackedBar
        title="Distribuição da Carteira"
        segments={[
          { key: "rf", label: "Renda Fixa", pct: 30, color: "#2dd4bf" },
          { key: "rv", label: "Renda Variável", pct: 70, color: "#38bdf8" },
        ]}
      />,
    );

    expect(screen.getByText("Distribuição da Carteira")).toBeInTheDocument();
    expect(screen.getByText(/Renda Fixa/)).toBeInTheDocument();
    expect(screen.getByText(/Renda Variável/)).toBeInTheDocument();
    expect(screen.getByText("30,0%")).toBeInTheDocument();
    expect(screen.getByText("70,0%")).toBeInTheDocument();
  });

  it("renderiza ReportRiskGauge com zonas e diagnóstico", () => {
    render(
      <ReportRiskGauge
        topItemName="PETR4"
        topItemPct={18.5}
        warningThresholdPct={15}
        criticalThresholdPct={25}
      />,
    );

    expect(screen.getByText("Termômetro de Concentração & Risco")).toBeInTheDocument();
    expect(screen.getByText(/PETR4/)).toBeInTheDocument();
    expect(screen.getAllByText("18,5%").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Concentração Moderada")).toBeInTheDocument();
  });

  it("renderiza ReportDividendSparkline com 12 meses", () => {
    render(
      <ReportDividendSparkline
        points={[
          { month: "2026-01", label: "Jan", amountCents: 45000 },
          { month: "2026-02", label: "Fev", amountCents: 52000 },
        ]}
        averageMonthlyCents={48500}
      />,
    );

    expect(screen.getByText(/Evolução dos Proventos/)).toBeInTheDocument();
    expect(screen.getByText("Jan")).toBeInTheDocument();
    expect(screen.getByText("Fev")).toBeInTheDocument();
  });

  it("renderiza ReportWaterfallBar para fluxo de DRE", () => {
    render(
      <ReportWaterfallBar
        grossIncomeCents={1000000}
        steps={[
          { key: "inc", label: "Receita Bruta", amountCents: 1000000, pctOfTotal: 100, type: "income" },
          { key: "exp", label: "Despesas", amountCents: 600000, pctOfTotal: 60, type: "expense" },
          { key: "sav", label: "Poupança Líquida", amountCents: 400000, pctOfTotal: 40, type: "savings" },
        ]}
      />,
    );

    expect(screen.getByText(/Fluxo Contábil/)).toBeInTheDocument();
    expect(screen.getByText("Receita Bruta")).toBeInTheDocument();
    expect(screen.getByText("Despesas")).toBeInTheDocument();
    expect(screen.getByText("Poupança Líquida")).toBeInTheDocument();
  });

  it("renderiza ReportClassTables com cabeçalho leve e linha de subtotal contábil no tfoot", () => {
    render(
      <ReportClassTables
        groups={[
          {
            className: "Ações",
            totalCents: 2675306,
            sharePct: 25.3,
            pnlPct: 16.5,
            totalCostCents: 2296000,
            items: [
              {
                ticker: "PSSA3",
                name: "Porto Seguro",
                sector: "Seguros",
                quantity: 81,
                avgPriceCents: 3564,
                currentPriceCents: 4892,
                totalCents: 396252,
                pnlPct: 44.9,
              },
            ],
          },
        ]}
      />,
    );

    expect(screen.getAllByText(/Ações/i).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/\(?25,3% da carteira\)?/)).toBeInTheDocument();
    expect(screen.getByText("PSSA3")).toBeInTheDocument();
    expect(screen.getByText("Seguros")).toBeInTheDocument();
    expect(screen.getByText(/Subtotal Ações/i)).toBeInTheDocument();
  });

  it("renderiza ReportDocumentLayout com modal e ações de impressão", () => {
    render(
      <ReportDocumentLayout
        open={true}
        onOpenChange={() => {}}
        title="Prévia do Dossiê"
      >
        <div>Conteúdo Editorial</div>
      </ReportDocumentLayout>,
    );

    expect(screen.getAllByText("Prévia do Dossiê")[0]).toBeInTheDocument();
    expect(screen.getByText("Imprimir / Salvar PDF")).toBeInTheDocument();
    expect(screen.getAllByText("Conteúdo Editorial")).toHaveLength(1);
    const printSheet = document.body.querySelector(".print-sheet");
    expect(printSheet).toBeInTheDocument();
    expect(printSheet?.querySelector(".print-document")).toBeEmptyDOMElement();
  });

  it("monta children no PrintSheet sob demanda ao imprimir ou receber beforeprint/afterprint", () => {
    render(
      <ReportDocumentLayout
        open={true}
        onOpenChange={() => {}}
        title="Dossiê Sob Demanda"
      >
        <div data-testid="report-body">Conteúdo Pesado</div>
      </ReportDocumentLayout>,
    );

    const printDoc = document.body.querySelector(".print-sheet .print-document");
    expect(printDoc).not.toBeNull();
    expect(printDoc).toBeEmptyDOMElement();
    expect(screen.getAllByTestId("report-body")).toHaveLength(1);

    fireEvent(window, new Event("beforeprint"));
    expect(screen.getAllByTestId("report-body")).toHaveLength(2);
    expect(printDoc).not.toBeEmptyDOMElement();

    fireEvent(window, new Event("afterprint"));
    expect(screen.getAllByTestId("report-body")).toHaveLength(1);
    expect(printDoc).toBeEmptyDOMElement();
  });

  it("renderiza ReportPerformanceChart com rótulos sem colisão e footer explicativo de MTD", () => {
    const series = [
      { month: "2025-12", monthLabel: "12/25", patrimonyBRL: 10000, ratePct: 2.4, isMtd: false },
      { month: "2026-01", monthLabel: "01/26", patrimonyBRL: 10240, ratePct: 1.7, isMtd: false },
      { month: "2026-02", monthLabel: "02/26", patrimonyBRL: 10414, ratePct: 0.3, isMtd: false },
      { month: "2026-03", monthLabel: "03/26", patrimonyBRL: 10122, ratePct: -2.8, isMtd: false },
      { month: "2026-04", monthLabel: "04/26", patrimonyBRL: 10061, ratePct: -0.6, isMtd: false },
      { month: "2026-05", monthLabel: "05/26", patrimonyBRL: 10050, ratePct: -0.1, isMtd: false },
      { month: "2026-06", monthLabel: "06/26", patrimonyBRL: 9889, ratePct: -1.6, isMtd: false },
      { month: "2026-07", monthLabel: "07/26", patrimonyBRL: 9859, ratePct: -0.3, isMtd: false },
      { month: "2026-08", monthLabel: "08/26", patrimonyBRL: 9592, ratePct: -2.7, isMtd: false },
      { month: "2026-09", monthLabel: "09/26", patrimonyBRL: 10205, ratePct: 6.4, isMtd: false },
      { month: "2026-10", monthLabel: "10/26", patrimonyBRL: 10072, ratePct: -1.3, isMtd: false },
      { month: "2026-11", monthLabel: "11/26", patrimonyBRL: 9920, ratePct: -1.5, isMtd: true },
    ];

    render(<ReportPerformanceChart series={series} />);

    // Rótulos do eixo X limpos
    expect(screen.getByText("10/26")).toBeInTheDocument();
    expect(screen.getByText("11/26*")).toBeInTheDocument();
    expect(screen.getByText("MTD")).toBeInTheDocument();

    // Footer explicativo de MTD presente
    expect(
      screen.getByText(/competência corrente parcial em andamento/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/o mês incompleto é automaticamente segregado do cálculo da volatilidade anualizada e do Índice de Sharpe/),
    ).toBeInTheDocument();
  });

  it("renderiza ReportMonthlyMovements com os 4 quadrantes de fluxo e contadores", () => {
    render(
      <ReportMonthlyMovements
        monthBuysBRL={2500}
        monthSellsBRL={800}
        monthDividendsBRL={350}
        monthNetContributionBRL={1700}
        transactionsCount={4}
        dividendsCount={3}
      />,
    );

    expect(screen.getByText("MOVIMENTAÇÕES DA COMPETÊNCIA")).toBeInTheDocument();
    expect(screen.getByText("4 operações · 3 proventos")).toBeInTheDocument();
    expect(screen.getByText("Compras do Mês")).toBeInTheDocument();
    expect(screen.getByText("Vendas do Mês")).toBeInTheDocument();
    expect(screen.getByText("Proventos do Mês")).toBeInTheDocument();
    expect(screen.getByText("Aporte Líquido Injetado")).toBeInTheDocument();
    expect(screen.getByText(/2\.500,00/)).toBeInTheDocument();
    expect(screen.getByText(/800,00/)).toBeInTheDocument();
    expect(screen.getByText(/350,00/)).toBeInTheDocument();
    expect(screen.getByText(/\+\s*R\$[\s\u00a0]*1\.700,00/i)).toBeInTheDocument();
  });

  it("renderiza badges de Nota, 'Sem nota' e Status (Neutro, Quarentena, Saída) inclusive em Renda Fixa", () => {
    render(
      <ReportClassTables
        groups={[
          {
            className: "Renda Fixa",
            totalCents: 1000000,
            sharePct: 50,
            pnlPct: 12.5,
            items: [
              {
                ticker: "CDB Banco Alpha",
                quantity: 1,
                avgPriceCents: 900000,
                currentPriceCents: 1000000,
                totalCents: 1000000,
                pnlPct: 12.5,
                indexType: "110% CDI",
                score: null,
                status: "neutral",
              },
            ],
          },
          {
            className: "Ações",
            totalCents: 1000000,
            sharePct: 50,
            pnlPct: -5,
            items: [
              {
                ticker: "OIBR3",
                quantity: 100,
                avgPriceCents: 200,
                currentPriceCents: 100,
                totalCents: 10000,
                pnlPct: -50,
                score: 2,
                status: "exit",
              },
            ],
          },
        ]}
      />,
    );

    expect(screen.getByText("Sem nota")).toBeInTheDocument();
    expect(screen.getByText("Neutro")).toBeInTheDocument();
    expect(screen.getByText("Nota 2")).toBeInTheDocument();
    expect(screen.getByText("Saída")).toBeInTheDocument();
  });

  it("renderiza os 4 cards de Raio-X via ReportExposureBreakdownCard com alternância de visão, print_all e MoneyText", () => {
    const positions = [
      { assetId: "1", ticker: "BBAS3", assetClass: "Ações", sector: "Bancos", valueBRL: 6000 },
      { assetId: "2", ticker: "VALE3", assetClass: "Ações", sector: "Mineração", valueBRL: 4000 },
      { assetId: "3", ticker: "HGLG11", assetClass: "FIIs", sector: "Logística", valueBRL: 5000 },
      { assetId: "4", ticker: "MXRF11", assetClass: "FIIs", sector: "Papel / CRI", valueBRL: 3000 },
      { assetId: "5", ticker: "LCI BANCO X", assetClass: "Renda Fixa", sector: "Bancário", valueBRL: 8000 },
      { assetId: "6", ticker: "IVV", assetClass: "Internacional", sector: "EUA", valueBRL: 7000 },
    ];

    render(
      <div>
        <ReportStocksBreakdownCard positions={positions} />
        <ReportFiiBreakdownCard positions={positions} />
        <ReportFixedIncomeBreakdownCard positions={positions} />
        <ReportInternationalBreakdownCard positions={positions} mode="print_all" />
      </div>,
    );

    // Stocks interactive switch
    expect(screen.getByText("Perfil Cíclico / Resiliência")).toBeInTheDocument();
    const porteBtn = screen.getByRole("button", { name: /Por Porte/i });
    expect(porteBtn).toHaveClass("min-h-11");
    fireEvent.click(porteBtn);
    expect(screen.getByText("Porte / Capitalização")).toBeInTheDocument();

    // FIIs single view (sem botão de alternância)
    expect(screen.getByText("Estratégia / Categoria")).toBeInTheDocument();

    // Fixed income com callout de eficiência fiscal
    expect(screen.getByText(/Eficiência Fiscal:/)).toBeInTheDocument();
    expect(screen.getByText(/Total Isento:/)).toBeInTheDocument();

    // International em modo print_all renderiza ambos os quadros simultaneamente
    expect(screen.getByText("Região Geográfica")).toBeInTheDocument();
    expect(screen.getByText("Veículo de Custódia (Dólar vs. BDR)")).toBeInTheDocument();
    expect(screen.getByText(/Exposição em Dólar Direto/)).toBeInTheDocument();
  });

  it("exibe estado vazio limpo nos cards de Raio-X quando não há ativos da classe", () => {
    render(<ReportStocksBreakdownCard positions={[]} />);
    expect(
      screen.getByText("Nenhuma ação da B3 em custódia na carteira para decomposição setorial."),
    ).toBeInTheDocument();
  });

  it("não impõe teto artificial de 12% ao CDI e permite inspeção interativa nas barras de rentabilidade", () => {
    const series = [
      { month: "2026-09", monthLabel: "09/26", patrimonyBRL: 10000, ratePct: 1.5, isMtd: false },
      { month: "2026-10", monthLabel: "10/26", patrimonyBRL: 10200, ratePct: 2.0, isMtd: false },
    ];

    render(
      <ReportPerformanceChart
        series={series}
        annualCdiRate={14.25}
        annualSelicRate={10.5}
      />,
    );

    // CDI acima de 12% a.a. é preservado (2 meses compostos de 14,25% a.a. = 2,25 -> "2,3%", sem fallback 10,5% -> "1,7%")
    const cdiCard = screen.getByText("CDI").closest("div")?.parentElement ?? null;
    expect(cdiCard).not.toBeNull();
    if (cdiCard) {
      expect(within(cdiCard).getByText("2,3%")).toBeInTheDocument();
      expect(within(cdiCard).queryByText("1,7%")).not.toBeInTheDocument();
    }

    const firstBar = screen.getByRole("button", { name: /09\/26/i });
    fireEvent.click(firstBar);
    expect(screen.getByText(/R\$\s*10\.000,00/)).toBeInTheDocument();
  });

  it("usa shadow-xs canônico (zero shadow-2xs) nos cards do ReportKpiGrid", () => {
    const { container } = render(
      <ReportKpiGrid
        items={[{ label: "Patrimônio", value: "R$ 50.000,00", tone: "primary" }]}
      />,
    );
    expect(container.querySelector(".shadow-2xs")).toBeNull();
    expect(container.querySelector(".shadow-xs")).not.toBeNull();
  });
});

