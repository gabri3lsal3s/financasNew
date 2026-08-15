import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProventosTab } from "./proventos-tab";

const transactionsMock = vi.fn();
const assetsMock = vi.fn();

vi.mock("@/state", () => ({
  useAllPortfolioTransactions: () => ({
    data: transactionsMock(),
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
}));

const assets = [
  { id: "a1", user_id: "u1", ticker: "PETR4", asset_class: "Ações", currency: "BRL" },
  { id: "a2", user_id: "u1", ticker: "MXRF11", asset_class: "FIIs", currency: "BRL" },
];

const transactions = [
  { id: "t1", user_id: "u1", asset_id: "a1", type: "dividend", date: "2026-08-10", quantity: 0, price: 0, total: 100 },
  { id: "t2", user_id: "u1", asset_id: "a2", type: "fii_yield", date: "2026-08-20", quantity: 0, price: 0, total: 50.25 },
  { id: "t3", user_id: "u1", asset_id: "a1", type: "dividend", date: "2026-07-05", quantity: 0, price: 0, total: 40 },
  { id: "t4", user_id: "u1", asset_id: "a1", type: "buy", date: "2026-08-12", quantity: 10, price: 100, total: 1000 },
];

describe("ProventosTab — extrato e calendário (F18)", () => {
  beforeEach(() => {
    transactionsMock.mockReset();
    assetsMock.mockReset();
    assetsMock.mockReturnValue(assets);
  });

  it("mostra o total do mês e a lista de proventos com ticker (reconciliação)", () => {
    transactionsMock.mockReturnValue(transactions);
    render(<ProventosTab />);

    // 100 + 50,25 = 150,25 (buy não é provento; 07/05 é outro mês).
    expect(screen.getAllByText("R$ 150,25").length).toBeGreaterThan(0);
    expect(screen.getByText("PETR4")).toBeInTheDocument();
    expect(screen.getByText("MXRF11")).toBeInTheDocument();
    expect(screen.getByText(/Dividendo/)).toBeInTheDocument();
    expect(screen.getByText(/Rendimento de FII/)).toBeInTheDocument();
    // Calendário anual presente (12 meses).
    expect(screen.getByText("Calendário de 2026")).toBeInTheDocument();
  });

  it("navega o mês pelo MonthPicker e atualiza o extrato", async () => {
    transactionsMock.mockReturnValue(transactions);
    const user = userEvent.setup();
    render(<ProventosTab />);

    await user.click(screen.getByRole("button", { name: "Mês anterior" }));
    // Julho: apenas o dividendo de 40,00.
    expect(screen.getAllByText("R$ 40,00").length).toBeGreaterThan(0);
  });

  it("estado vazio sem nenhum provento", () => {
    transactionsMock.mockReturnValue([transactions[3]]); // só buy
    render(<ProventosTab />);
    expect(screen.getByText("Sem proventos ainda")).toBeInTheDocument();
  });

  it("clica em um mês do calendário e atualiza o extrato", async () => {
    transactionsMock.mockReturnValue(transactions);
    const user = userEvent.setup();
    render(<ProventosTab />);

    // Botão de julho no calendário (aria-pressed marca o mês ativo).
    const julyButton = screen.getByRole("button", { name: /jul/i });
    await user.click(julyButton);
    expect(screen.getAllByText("R$ 40,00").length).toBeGreaterThan(0);
    expect(julyButton).toHaveAttribute("aria-pressed", "true");
  });
});
