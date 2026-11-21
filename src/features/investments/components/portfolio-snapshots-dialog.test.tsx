import { fireEvent, render, screen, within } from "@testing-library/react";
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
  it("renderiza a tabela analítica completa com os pontos ordenados decrescentemente e folha de impressão", () => {
    renderWithClient(
      <PortfolioSnapshotsDialog
        open={true}
        onOpenChange={vi.fn()}
        series={mockSeries}
        currentMonthStr="2026-09"
      />,
    );

    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getAllByText("Extrato Analítico de Evolução Patrimonial").length).toBeGreaterThanOrEqual(1);
    expect(dialog.getByText("Imprimir / Salvar PDF")).toBeInTheDocument();

    expect(dialog.getByText("3 meses")).toBeInTheDocument();
    expect(dialog.getAllByText(/108\.000,00/).length).toBeGreaterThan(0);
    expect(dialog.getByText("Proventos")).toBeInTheDocument();

    expect(dialog.getByRole("columnheader", { name: "Competência" })).toBeInTheDocument();
    expect(dialog.getByRole("columnheader", { name: "Patrimônio" })).toBeInTheDocument();
    expect(dialog.getByRole("columnheader", { name: "Custo" })).toBeInTheDocument();
    expect(dialog.getByRole("columnheader", { name: "Proventos Mês" })).toBeInTheDocument();
    expect(dialog.getByRole("columnheader", { name: "Proventos Acum." })).toBeInTheDocument();
    expect(dialog.getByRole("columnheader", { name: "TWR Mês" })).toBeInTheDocument();
    expect(dialog.getByRole("columnheader", { name: "Ret. Total" })).toBeInTheDocument();
    expect(dialog.getByRole("columnheader", { name: "TWR Acum." })).toBeInTheDocument();
    expect(dialog.getByRole("columnheader", { name: "Cota (R$)" })).toBeInTheDocument();
    expect(dialog.getByRole("columnheader", { name: "Ações" })).toBeInTheDocument();

    expect(dialog.getByText(/^500,00$/)).toBeInTheDocument();
    expect(dialog.getByText(/^450,00$/)).toBeInTheDocument();
    expect(dialog.getByText(/^300,00$/)).toBeInTheDocument();

    expect(dialog.getByText(/\+2[.,]50%/)).toBeInTheDocument();
    expect(dialog.getByText(/\+1[.,]20%/)).toBeInTheDocument();
    expect(dialog.getByText(/\+0[.,]50%/)).toBeInTheDocument();

    expect(dialog.getByText("Set/2026")).toBeInTheDocument();
    expect(dialog.getByText("Ago/2026")).toBeInTheDocument();
    expect(dialog.getByText("Dez/2025")).toBeInTheDocument();
    expect(dialog.getByText("atual")).toBeInTheDocument();

    // Garante que a folha de impressão (.print-sheet) monta o documento sob demanda durante a impressão (correção do bug de PDF em branco)
    const printSheet = document.body.querySelector(".print-sheet");
    expect(printSheet).not.toBeNull();
    fireEvent(window, new Event("beforeprint"));
    expect(within(printSheet as HTMLElement).getByText("Extrato Analítico de Evolução Patrimonial")).toBeInTheDocument();
    expect(within(printSheet as HTMLElement).getByText("Set/2026")).toBeInTheDocument();
    fireEvent(window, new Event("afterprint"));
  });

  it("permite filtrar por ano", () => {
    renderWithClient(
      <PortfolioSnapshotsDialog
        open={true}
        onOpenChange={vi.fn()}
        series={mockSeries}
        currentMonthStr="2026-09"
      />,
    );

    const dialog = within(screen.getByRole("dialog"));
    const btn2025 = dialog.getByRole("button", { name: "2025" });
    fireEvent.click(btn2025);

    expect(dialog.getByText("1 mês")).toBeInTheDocument();
    expect(dialog.getByText("Dez/2025")).toBeInTheDocument();
    expect(dialog.queryByText("Set/2026")).not.toBeInTheDocument();
    expect(dialog.queryByText("Ago/2026")).not.toBeInTheDocument();
  });

  it("permite acionar o diálogo de exclusão de snapshot histórico", () => {
    const onDeleteSnapshot = vi.fn();
    renderWithClient(
      <PortfolioSnapshotsDialog
        open={true}
        onOpenChange={vi.fn()}
        series={mockSeries}
        currentMonthStr="2026-09"
        onDeleteSnapshot={onDeleteSnapshot}
      />,
    );

    const deleteBtn = screen.getByRole("button", { name: "Excluir snapshot de Ago/2026" });
    fireEvent.click(deleteBtn);

    expect(screen.getByText("Excluir Snapshot Mensal")).toBeInTheDocument();
    expect(
      screen.getByText(/Tem certeza que deseja excluir o snapshot patrimonial de Ago\/2026/),
    ).toBeInTheDocument();

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

    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByText(/-1[.,]75%/)).toBeInTheDocument();
    // Proventos no período no card de KPI exibe R$ 0,00 e a célula da tabela com hideCurrency exibe 0,00
    expect(dialog.getByText(/R\$[\s\u00a0]0,00$/)).toBeInTheDocument();
    expect(dialog.getByText(/^0,00$/)).toBeInTheDocument();
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

    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByText("provisório")).toBeInTheDocument();
  });

  it("exibe badge calibrado e botão de restaurar para snapshot com calibração manual", () => {
    const seriesWithCalibrated: PortfolioMonthlySeriesPoint[] = [
      {
        month: "2026-08",
        valueBRL: 95000,
        costBRL: 85000,
        autoTotalValue: 90000,
        autoTotalCost: 80000,
        isManuallyCalibrated: true,
        monthDividendsBRL: 200,
        accumulatedDividendsBRL: 2000,
        capitalGainPnl: 10000,
        capitalGainPct: 11.76,
        totalReturnPnl: 12000,
        totalReturnPct: 14.12,
        twrMonthPct: 2.0,
        twrAccumulatedPct: 15.0,
        sharePrice: 115.0,
        status: "closed",
      },
    ];

    renderWithClient(
      <PortfolioSnapshotsDialog
        open={true}
        onOpenChange={vi.fn()}
        series={seriesWithCalibrated}
        currentMonthStr="2026-09"
      />,
    );

    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByText("calibrado")).toBeInTheDocument();

    const restoreBtn = dialog.getByRole("button", {
      name: "Restaurar fechamento oficial de Ago/2026",
    });
    expect(restoreBtn).toBeInTheDocument();
    expect(
      dialog.getByRole("button", { name: "Calibrar snapshot de Ago/2026" }),
    ).toBeInTheDocument();

    fireEvent.click(restoreBtn);
    expect(screen.getByText("Restaurar Fechamento Oficial")).toBeInTheDocument();
    expect(
      screen.getByText(/Deseja desfazer a calibração manual de Ago\/2026 e restaurar o valor gravado originalmente no fechamento oficial/),
    ).toBeInTheDocument();
  });

  it("permite abrir o diálogo de Adicionar Mês pelo botão no cabeçalho", () => {
    renderWithClient(
      <PortfolioSnapshotsDialog
        open={true}
        onOpenChange={vi.fn()}
        series={mockSeries}
        currentMonthStr="2026-09"
      />,
    );

    const dialog = within(screen.getByRole("dialog"));
    const addMonthBtn = dialog.getByRole("button", { name: /Adicionar Mês/i });
    expect(addMonthBtn).toBeInTheDocument();

    fireEvent.click(addMonthBtn);
    expect(screen.getByText("Adicionar Fechamento Mensal")).toBeInTheDocument();
    expect(screen.getByText("Mês de Competência")).toBeInTheDocument();
    expect(screen.getByText("Ano de Competência")).toBeInTheDocument();
  });

  it("renderiza ação de preencher e omite exclusão para meses sem snapshot", () => {
    const seriesWithGap: PortfolioMonthlySeriesPoint[] = [
      {
        month: "2026-08",
        valueBRL: 80000,
        costBRL: 75000,
        monthDividendsBRL: 0,
        accumulatedDividendsBRL: 2000,
        capitalGainPnl: 5000,
        capitalGainPct: 6.67,
        totalReturnPnl: 7000,
        totalReturnPct: 9.33,
        twrMonthPct: 0,
        twrAccumulatedPct: 12.0,
        sharePrice: 112.0,
        status: "closed",
        snapshotOrigin: "sem_snapshot",
      },
    ];

    renderWithClient(
      <PortfolioSnapshotsDialog
        open={true}
        onOpenChange={vi.fn()}
        series={seriesWithGap}
        currentMonthStr="2026-09"
      />,
    );

    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByText("sem snapshot")).toBeInTheDocument();

    // Deve possuir botão de preencher fechamento
    expect(dialog.getByRole("button", { name: "Preencher fechamento de Ago/2026" })).toBeInTheDocument();

    // NÃO deve possuir botão de excluir para linha sem snapshot
    expect(dialog.queryByRole("button", { name: "Excluir snapshot de Ago/2026" })).not.toBeInTheDocument();
  });
});
