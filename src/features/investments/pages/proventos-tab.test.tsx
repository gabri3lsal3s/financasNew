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
    expect(screen.getByText("PETR4")).toBeInTheDocument();
    expect(screen.getByText("MXRF11")).toBeInTheDocument();
    // Calendário anual presente (12 meses).
    expect(screen.getByText("Calendário de 2026")).toBeInTheDocument();
  });

  it("navega o mês pelo MonthPicker e atualiza o extrato", async () => {
    dividendsMock.mockReturnValue(dividends);
    const user = userEvent.setup();
    render(<ProventosTab />);

    await user.click(screen.getByRole("button", { name: "Mês anterior" }));
    // Julho: apenas o dividendo de 40,00.
    expect(screen.getAllByText("R$ 40,00").length).toBeGreaterThan(0);
  });

  it("estado vazio sem nenhum provento", () => {
    dividendsMock.mockReturnValue([]);
    render(<ProventosTab />);
    expect(screen.getByText("Sem proventos ainda")).toBeInTheDocument();
  });

  it("clica em um mês do calendário e atualiza o extrato", async () => {
    dividendsMock.mockReturnValue(dividends);
    const user = userEvent.setup();
    render(<ProventosTab />);

    // Botão de julho no calendário (aria-pressed marca o mês ativo).
    const julyButton = screen.getByRole("button", { name: /jul/i });
    await user.click(julyButton);
    expect(screen.getAllByText("R$ 40,00").length).toBeGreaterThan(0);
    expect(julyButton).toHaveAttribute("aria-pressed", "true");
  });
});
