import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Landmark, TrendingUp } from "lucide-react";
import {
  ReportHeader,
  ReportFooter,
  ReportKpiGrid,
  ReportDonutChart,
  ReportStackedBar,
  ReportRiskGauge,
  ReportDividendSparkline,
  ReportWaterfallBar,
  ReportGapPinBar,
  ReportDocumentLayout,
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

  it("renderiza ReportFooter com termos de confidencialidade", () => {
    render(
      <ReportFooter
        accountHolder="Gabriel Sales"
        documentId="DOC-202608-XYZ"
      />,
    );

    expect(screen.getByText(/Documento estritamente confidencial/)).toBeInTheDocument();
    expect(screen.getByText(/DOC-202608-XYZ/)).toBeInTheDocument();
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
    expect(screen.getByText("40.0%")).toBeInTheDocument();
    expect(screen.getByText("60.0%")).toBeInTheDocument();
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
    expect(screen.getByText("30.0%")).toBeInTheDocument();
    expect(screen.getByText("70.0%")).toBeInTheDocument();
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
    expect(screen.getByText("18.5%")).toBeInTheDocument();
    expect(screen.getByText("Atenção (Concentração Moderada)")).toBeInTheDocument();
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

  it("renderiza ReportGapPinBar para comparativo meta vs realizado", () => {
    render(
      <ReportGapPinBar
        items={[
          { key: "acoes", label: "Ações", actualPct: 35, targetPct: 40, gapPct: -5, color: "#1b6b62" },
        ]}
      />,
    );

    expect(screen.getByText("Ações")).toBeInTheDocument();
    expect(screen.getByText("35.0%")).toBeInTheDocument();
    expect(screen.getByText("40.0%")).toBeInTheDocument();
    expect(screen.getByText("-5.0%")).toBeInTheDocument();
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
    expect(screen.getAllByText("Conteúdo Editorial").length).toBeGreaterThanOrEqual(1);
  });
});
