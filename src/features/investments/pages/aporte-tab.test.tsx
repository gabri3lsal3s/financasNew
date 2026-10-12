import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { AporteTab } from "./aporte-tab";

const mockExecuteBatch = vi.fn().mockResolvedValue({ success: true, count: 1 });

vi.mock("@/state", () => ({
  usePortfolioPosition: () => ({
    rows: [
      {
        assetId: "a1",
        ticker: "PETR4",
        assetClass: "Ações",
        currency: "BRL",
        valueBRL: 5000,
        priceBRL: 40,
        isCash: false,
      },
    ],
    cashBRL: 1000,
    totalBRL: 6000,
    isLoading: false,
    error: null,
  }),
  useAllocationTargets: () => ({
    data: [{ id: "t1", asset_id: "a1", target_percentage: 100 }],
    isLoading: false,
    error: null,
  }),
  useGroupTargets: () => ({
    data: [],
    isLoading: false,
    error: null,
  }),
  useExecutePortfolioBatchAporte: () => ({
    mutateAsync: mockExecuteBatch,
    isPending: false,
  }),
}));

describe("AporteTab — Calculadora e Aportes", () => {
  it("renderiza a calculadora e os campos de simulação corretamente", () => {
    render(
      <MemoryRouter>
        <AporteTab />
      </MemoryRouter>,
    );

    expect(screen.getByText("Valor do aporte")).toBeInTheDocument();
    expect(screen.getByText(/Motor Hierárquico:/i)).toBeInTheDocument();
  });

  it("inicia por padrão com valor zerado (R$ 0,00) e sem sugestões antes de digitar", () => {
    render(
      <MemoryRouter initialEntries={["/investimentos?tab=aporte"]}>
        <AporteTab />
      </MemoryRouter>,
    );

    const input = screen.getByRole("textbox", { name: /Valor do aporte/i });
    expect(input).toHaveValue("R$ 0,00");
    expect(screen.queryByText(/Aporte sugerido/i)).not.toBeInTheDocument();
  });

  it("preenche automaticamente o valor e carrega sugestões quando a URL contém o parâmetro de valor", async () => {
    vi.useFakeTimers();
    render(
      <MemoryRouter initialEntries={["/investimentos?tab=aporte&valor=100000"]}>
        <AporteTab />
      </MemoryRouter>,
    );

    await vi.runAllTimersAsync();
    vi.useRealTimers();

    const input = screen.getByRole("textbox", { name: /Valor do aporte/i });
    await waitFor(() => expect((input as HTMLInputElement).value).toMatch(/1[.,]000,00/));
    expect(screen.getAllByText("PETR4").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Aporte sugerido/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("button", { name: /Lançar compras no extrato/i })).toBeInTheDocument();
  });

  it("permite executar aporte em lote com os itens sugeridos ou customizados", async () => {
    vi.useFakeTimers();
    const user = userEvent.setup({ delay: null });
    render(
      <MemoryRouter initialEntries={["/investimentos?tab=aporte&valor=100000"]}>
        <AporteTab />
      </MemoryRouter>,
    );

    await vi.runAllTimersAsync();
    vi.useRealTimers();

    const submitBtn = screen.getByRole("button", { name: /Lançar compras no extrato/i });
    expect(submitBtn).toBeInTheDocument();

    await user.click(submitBtn);

    // Confirma no diálogo
    const confirmBtn = screen.getByRole("button", { name: "Aplicar aporte" });
    expect(confirmBtn).toBeInTheDocument();
    await user.click(confirmBtn);

    expect(mockExecuteBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        items: expect.arrayContaining([
          expect.objectContaining({
            asset_id: "a1",
            quantity: 25,
          }),
        ]),
      }),
    );
  });
});
