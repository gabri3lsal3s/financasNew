import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProventosTab } from "./proventos-tab";

const dividendsMock = vi.fn();
const assetsMock = vi.fn();

vi.mock("@/state", () => ({
  usePortfolioDividends: () => ({
    data: dividendsMock(),
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  usePortfolioAssets: () => ({
    data: assetsMock(),
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useDeletePortfolioDividend: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useCreatePortfolioDividend: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useRecordOrder: () => ({
    mutateAsync: vi.fn().mockResolvedValue({ success: true }),
    isPending: false,
  }),
  usePortfolioPosition: () => ({
    rows: [
      { assetId: "a1", ticker: "PETR4", priceBRL: 30, valueBRL: 3000, isCash: false },
      { assetId: "a2", ticker: "MXRF11", priceBRL: 10, valueBRL: 500, isCash: false },
    ],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

const assets = [
  { id: "a1", user_id: "u1", ticker: "PETR4", asset_class: "Ações", currency: "BRL" as const, quantity: 100, average_price: 30 },
  { id: "a2", user_id: "u1", ticker: "MXRF11", asset_class: "FIIs", currency: "BRL" as const, quantity: 50, average_price: 10 },
];

const dividends = [
  { id: "t1", user_id: "u1", asset_id: "a1", date: "2026-08-10", amount: 100, notes: "DIVIDENDO" },
  { id: "t2", user_id: "u1", asset_id: "a2", date: "2026-08-20", amount: 50.25, notes: "RENDIMENTO" },
  { id: "t3", user_id: "u1", asset_id: "a1", date: "2026-07-05", amount: 40, notes: "DIVIDENDO" },
];

describe("ProventosTab — extrato e calendário (F18 e F36)", () => {
  beforeEach(() => {
    dividendsMock.mockReset();
    assetsMock.mockReset();
    assetsMock.mockReturnValue(assets);
  });

  it("mostra o total do mês e a lista de proventos com ticker (reconciliação)", () => {
    dividendsMock.mockReturnValue(dividends);
    render(<ProventosTab />);

    // 100 + 50,25 = 150,25 (07/05 é outro mês).
    expect(screen.getAllByText("R$ 150,25").length).toBeGreaterThan(0);
    expect(screen.getAllByText("PETR4").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("MXRF11").length).toBeGreaterThanOrEqual(1);
    // Sub-aba de calendário presente.
    expect(screen.getByRole("tab", { name: "Calendário" })).toBeInTheDocument();
  });

  it("navega o mês pelo MonthPicker e atualiza o extrato", async () => {
    dividendsMock.mockReturnValue(dividends);
    const user = userEvent.setup();
    render(<ProventosTab />);

    await user.click(screen.getByRole("button", { name: "Mês anterior" }));
    // Julho: apenas o dividendo de 40,00.
    expect(screen.getAllByText("R$ 40,00").length).toBeGreaterThan(0);
  });

  it("estado vazio sem nenhum provento nem estimativa", () => {
    dividendsMock.mockReturnValue([]);
    assetsMock.mockReturnValue([
      { id: "a1", user_id: "u1", ticker: "PETR4", asset_class: "Ações", currency: "BRL" as const, quantity: 100, average_price: 30 },
    ]);
    render(<ProventosTab />);
    expect(screen.getByText("Sem proventos ainda")).toBeInTheDocument();
  });

  it("exibe proventos históricos iniciais mesmo sem lançamentos periódicos", () => {
    dividendsMock.mockReturnValue([]);
    assetsMock.mockReturnValue([
      {
        id: "a1",
        user_id: "u1",
        ticker: "PETR4",
        asset_class: "Ações",
        currency: "BRL" as const,
        quantity: 100,
        average_price: 30,
        accumulated_dividends: 1200,
      },
    ]);
    render(<ProventosTab />);

    expect(screen.queryByText("Sem proventos ainda")).not.toBeInTheDocument();
    expect(screen.getByText("Histórico Anterior")).toBeInTheDocument();
    expect(screen.getAllByText("R$ 1.200,00").length).toBeGreaterThan(0);
    expect(screen.getByText("Proventos por Ativo")).toBeInTheDocument();
    expect(screen.getByText("Nenhum provento recebido neste mês.")).toBeInTheDocument();
  });

  it("exibe a Bola de Neve usando dividendo estimado quando não há lançamentos periódicos", () => {
    dividendsMock.mockReturnValue([]);
    assetsMock.mockReturnValue([
      {
        id: "a2",
        user_id: "u1",
        ticker: "MXRF11",
        asset_class: "FIIs",
        currency: "BRL" as const,
        quantity: 100,
        average_price: 10,
        estimated_monthly_dividend_per_share: 0.1,
      },
    ]);
    render(<ProventosTab />);

    expect(screen.queryByText("Sem proventos ainda")).not.toBeInTheDocument();
    expect(screen.getByText("Efeito Bola de Neve (Renda Passiva)")).toBeInTheDocument();
    expect(screen.getByText("Estimado")).toBeInTheDocument();
  });

  it("clica em um mês do calendário e atualiza o extrato", async () => {
    dividendsMock.mockReturnValue(dividends);
    const user = userEvent.setup();
    render(<ProventosTab />);

    // Alterna para a sub-aba Calendário
    await user.click(screen.getByRole("tab", { name: "Calendário" }));
    expect(screen.getByText("Calendário de 2026")).toBeInTheDocument();

    // Botão de julho no calendário
    const julyButton = screen.getByRole("button", { name: /jul/i });
    await user.click(julyButton);
    // Ao clicar em julho, o calendário navega de volta para o extrato de julho
    expect(screen.getAllByText("R$ 40,00").length).toBeGreaterThan(0);
  });

  it("exibe o indicador do Efeito Bola de Neve para ativos com proventos", () => {
    dividendsMock.mockReturnValue(dividends);
    render(<ProventosTab />);

    expect(screen.getByText("Efeito Bola de Neve (Renda Passiva)")).toBeInTheDocument();
    expect(screen.getByText(/Progresso para que os proventos mensais comprem 1 nova cota inteira sozinhos/i)).toBeInTheDocument();
  });
});
