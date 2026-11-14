import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PortfolioSnapshotsDialog } from "./portfolio-snapshots-dialog";
import type { PortfolioMonthlySeriesPoint } from "@/domain/portfolio";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});

function renderWithClient(ui: React.ReactElement) {
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

const mockSeries: PortfolioMonthlySeriesPoint[] = [
  {
    month: "2025-12",
    valueBRL: 80000,
    costBRL: 75000,
    monthDividendsBRL: 300,
    accumulatedDividendsBRL: 3000,
    capitalGainPnl: 5000,
    capitalGainPct: 6.67,
    totalReturnPnl: 8000,
    totalReturnPct: 10.67,
    twrMonthPct: 0.5,
    twrAccumulatedPct: 15.0,
    sharePrice: 115.0,
  },
  {
    month: "2026-08",
    valueBRL: 100000,
    costBRL: 90000,
    monthDividendsBRL: 450,
    accumulatedDividendsBRL: 6000,
    capitalGainPnl: 10000,
    capitalGainPct: 11.11,
    totalReturnPnl: 16000,
    totalReturnPct: 17.78,
    twrMonthPct: 1.2,
    twrAccumulatedPct: 22.0,
    sharePrice: 122.0,
  },
  {
    month: "2026-09",
    valueBRL: 108000,
    costBRL: 95000,
    monthDividendsBRL: 500,
    accumulatedDividendsBRL: 6500,
    capitalGainPnl: 13000,
    capitalGainPct: 13.68,
    totalReturnPnl: 19500,
    totalReturnPct: 20.53,
    twrMonthPct: 2.5,
    twrAccumulatedPct: 25.0,
    sharePrice: 125.0,
  },
];

describe("PortfolioSnapshotsDialog", () => {
  it("renderiza a tabela analítica completa com os pontos ordenados decrescentemente", () => {
    const onOpenChange = vi.fn();
    renderWithClient(
      <PortfolioSnapshotsDialog
        open={true}
        onOpenChange={onOpenChange}
        series={mockSeries}
        currentMonthStr="2026-09"
      />,
    );

    expect(
      screen.getByText("Extrato Analítico de Evolução Patrimonial"),
    ).toBeInTheDocument();

    // KPIs de resumo
    expect(screen.getByText("3 meses")).toBeInTheDocument();
    expect(screen.getAllByText(/108\.000,00/).length).toBeGreaterThan(0);
    expect(screen.getByText("Proventos no Período")).toBeInTheDocument();

    // Colunas da tabela
    expect(screen.getByText("Competência")).toBeInTheDocument();
    expect(screen.getByText("Patrimônio")).toBeInTheDocument();
    expect(screen.getByText("Custo")).toBeInTheDocument();
    expect(screen.getByText("Proventos Mês")).toBeInTheDocument();
    expect(screen.getByText("Proventos Acum.")).toBeInTheDocument();
    expect(screen.getByText("Mês (TWR %)")).toBeInTheDocument();
    expect(screen.getByText("Retorno Total")).toBeInTheDocument();
    expect(screen.getByText("TWR Acum.")).toBeInTheDocument();
    expect(screen.getByText("Cota (R$)")).toBeInTheDocument();
    expect(screen.getByText("Ações")).toBeInTheDocument();

    // Proventos auferidos no respectivo mês exibidos na tabela
    expect(screen.getByText(/R\$[\s\u00a0]500,00$/)).toBeInTheDocument();
    expect(screen.getByText(/R\$[\s\u00a0]450,00$/)).toBeInTheDocument();
    expect(screen.getByText(/R\$[\s\u00a0]300,00$/)).toBeInTheDocument();

    // Mês (TWR %) destacado como performance periódica isolada
    expect(screen.getByText("+2.50%")).toBeInTheDocument();
    expect(screen.getByText("+1.20%")).toBeInTheDocument();
    expect(screen.getByText("+0.50%")).toBeInTheDocument();

    // Linhas de dados formatadas
    expect(screen.getByText("Set/2026")).toBeInTheDocument();
    expect(screen.getByText("Ago/2026")).toBeInTheDocument();
    expect(screen.getByText("Dez/2025")).toBeInTheDocument();

    // Badge atual no mês 2026-09
    expect(screen.getByText("atual")).toBeInTheDocument();
  });

  it("permite filtrar por ano", () => {
    const onOpenChange = vi.fn();
    renderWithClient(
      <PortfolioSnapshotsDialog
        open={true}
        onOpenChange={onOpenChange}
        series={mockSeries}
        currentMonthStr="2026-09"
      />,
    );

    // Botões de filtro por ano
    const btn2025 = screen.getByRole("button", { name: "2025" });
    expect(btn2025).toBeInTheDocument();

    fireEvent.click(btn2025);

    // Agora deve exibir apenas 1 mês (Dez/2025)
    expect(screen.getByText("1 mês")).toBeInTheDocument();
    expect(screen.getByText("Dez/2025")).toBeInTheDocument();
    expect(screen.queryByText("Set/2026")).not.toBeInTheDocument();
    expect(screen.queryByText("Ago/2026")).not.toBeInTheDocument();
  });

  it("permite acionar o diálogo de exclusão de snapshot histórico", async () => {
    const onOpenChange = vi.fn();
    const onDeleteSnapshot = vi.fn();
    renderWithClient(
      <PortfolioSnapshotsDialog
        open={true}
        onOpenChange={onOpenChange}
        series={mockSeries}
        currentMonthStr="2026-09"
        onDeleteSnapshot={onDeleteSnapshot}
      />,
    );

    // Botão de exclusão para o mês Ago/2026
    const deleteBtn = screen.getByRole("button", {
      name: "Excluir snapshot de Ago/2026",
    });
    expect(deleteBtn).toBeInTheDocument();

    fireEvent.click(deleteBtn);

    // Deve abrir o ConfirmDialog
    expect(screen.getByText("Excluir Snapshot Mensal")).toBeInTheDocument();
    expect(
      screen.getByText(/Tem certeza que deseja excluir o snapshot patrimonial de Ago\/2026/),
    ).toBeInTheDocument();

    // Clicar em confirmar
    const confirmBtn = screen.getByRole("button", { name: "Excluir Snapshot" });
    fireEvent.click(confirmBtn);

    expect(onDeleteSnapshot).toHaveBeenCalledWith("2026-08");
  });

  it("renderiza corretamente valores negativos e nulos de proventos e rentabilidade", () => {
    const negativeSeries: PortfolioMonthlySeriesPoint[] = [
      {
        month: "2026-07",
        valueBRL: 70000,
        costBRL: 72000,
        monthDividendsBRL: 0,
        accumulatedDividendsBRL: 2500,
        capitalGainPnl: -2000,
        capitalGainPct: -2.78,
        totalReturnPnl: 500,
        totalReturnPct: 0.69,
        twrMonthPct: -1.75,
        twrAccumulatedPct: 10.0,
        sharePrice: 110.0,
      },
    ];

    renderWithClient(
      <PortfolioSnapshotsDialog
        open={true}
        onOpenChange={vi.fn()}
        series={negativeSeries}
        currentMonthStr="2026-07"
      />,
    );

    // Mês (TWR %) negativo destacado com sinal e formatação
    expect(screen.getByText("-1.75%")).toBeInTheDocument();

    // Proventos zerados no mês exibidos sem erro (resumo e linha da tabela)
    expect(screen.getAllByText(/R\$[\s\u00a0]0,00$/).length).toBe(2);
  });

  it("exibe badge provisório para competência histórica com status provisional", () => {
    const seriesWithProvisional: PortfolioMonthlySeriesPoint[] = [
      {
        month: "2026-08",
        valueBRL: 80000,
        costBRL: 75000,
        monthDividendsBRL: 200,
        accumulatedDividendsBRL: 2000,
        capitalGainPnl: 5000,
        capitalGainPct: 6.67,
        totalReturnPnl: 7000,
        totalReturnPct: 9.33,
        twrMonthPct: 1.0,
        twrAccumulatedPct: 12.0,
        sharePrice: 112.0,
        status: "provisional",
      },
    ];

    renderWithClient(
      <PortfolioSnapshotsDialog
        open={true}
        onOpenChange={vi.fn()}
        series={seriesWithProvisional}
        currentMonthStr="2026-09"
      />,
    );

    expect(screen.getByText("provisório")).toBeInTheDocument();
  });
});

