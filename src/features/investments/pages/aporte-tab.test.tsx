import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AporteTab } from "./aporte-tab";

const mockExecuteBatch = vi.fn().mockResolvedValue({ success: true, count: 1 });

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: vi.fn(),
    }),
  };
});

vi.mock("@/state", () => ({
  useUserSubscription: () => ({
    canWrite: true,
    isReadOnly: false,
    tier: "pro_annual",
  }),
  usePermission: () => ({
    canWrite: true,
    canRead: true,
    isHidden: false,
    isReadOnlyMode: false,
    accessLevel: "write",
  }),
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
    refetch: vi.fn(),
  }),
  usePortfolioAssets: () => ({
    data: [
      {
        id: "a1",
        ticker: "PETR4",
        asset_class: "Ações",
        quantity: 125,
        average_price: 35,
        currency: "BRL",
        score: 8,
        allocation_status: "active",
      },
    ],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
  useGroupTargets: (groupType: "class" | "sector") => ({
    data:
      groupType === "class"
        ? [{ id: "g1", user_id: "u1", name: "Ações", group_type: "class", target_percentage: 100 }]
        : [],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
  useExecutePortfolioBatchAporte: () => ({
    mutateAsync: mockExecuteBatch,
    isPending: false,
  }),
  useCreatePortfolioTransaction: () => ({
    mutateAsync: vi.fn().mockResolvedValue({ id: "tx1" }),
    isPending: false,
  }),
  useCreatePortfolioContribution: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useSetManualPrice: () => ({
    mutateAsync: vi.fn().mockResolvedValue(true),
    isPending: false,
  }),
  useFamilyMode: () => ({ isFamilyModeEnabled: false }),
  useMyFamily: () => ({ data: null, isLoading: false }),
  useCreatePortfolioAsset: () => ({
    mutateAsync: vi.fn().mockResolvedValue({ id: "a2" }),
    isPending: false,
  }),
  useSaveGroupTarget: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useRecordOrder: () => ({
    mutateAsync: vi.fn().mockResolvedValue({ success: true }),
    isPending: false,
  }),
  useAssetPrices: () => ({
    data: [],
    isLoading: false,
    error: null,
  }),
  useAllPortfolioTransactions: () => ({
    data: [],
    isLoading: false,
  }),
  usePortfolioContributions: () => ({
    data: [],
    isLoading: false,
  }),
  usePortfolioSnapshots: () => ({
    data: [],
    isLoading: false,
  }),
  usePortfolioDividends: () => ({
    data: [],
    isLoading: false,
  }),
  useAccounts: () => ({
    data: [],
    isLoading: false,
  }),
  useEmergencyFundComposition: () => ({
    composition: {
      totalReserveCents: 0,
      cashInAccountsCents: 0,
      portfolioReserveCents: 0,
      breakdown: [],
      warnings: [],
      targetMonths: 6,
      targetMonthsProgressPercent: 0,
      targetMonthsCents: 0,
    },
    config: {
      includeCheckingAccounts: true,
      selectionMode: "auto_cash",
      selectedAssetIds: [],
      selectedClasses: [],
      useNetValue: true,
      targetMonths: 6,
    },
    updateConfig: vi.fn(),
    isLoading: false,
    isUpdating: false,
    portfolioRows: [],
  }),
  invalidatePortfolioSuite: vi.fn().mockResolvedValue(undefined),
}));

describe("AporteTab — Calculadora e Aportes", () => {
  beforeEach(() => {
    mockExecuteBatch.mockClear();
  });

  it("renderiza a calculadora e os campos de simulação corretamente", () => {
    render(
      <MemoryRouter>
        <AporteTab />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Valor do aporte/i)).toBeInTheDocument();
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

  it("exibe o alerta permanente de isenção regulatória CVM (Resoluções 19/2021 e 20/2021)", () => {
    render(
      <MemoryRouter>
        <AporteTab />
      </MemoryRouter>,
    );

    expect(
      screen.getByText(/Isenção Regulatória CVM \(Resoluções CVM nº 19\/2021 e nº 20\/2021\)/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/não configurando análise de valores mobiliários, consultoria financeira ou recomendação/i),
    ).toBeInTheDocument();
  });

  it("permite abrir o InvestmentWizard a partir da sugestão de aporte com o ativo pré-carregado", async () => {
    vi.useFakeTimers();
    const user = userEvent.setup({ delay: null });
    render(
      <MemoryRouter initialEntries={["/investimentos?tab=aporte&valor=100000"]}>
        <AporteTab />
      </MemoryRouter>,
    );

    await vi.runAllTimersAsync();
    vi.useRealTimers();

    const buyButtons = screen.getAllByRole("button", { name: /Comprar PETR4 no Wizard/i });
    expect(buyButtons.length).toBeGreaterThanOrEqual(1);
    const buyBtn = buyButtons[0];
    if (!buyBtn) throw new Error("Botão não encontrado");
    await user.click(buyBtn);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("permite Aporte Composto (Bolso + Caixa) e repassa cashUsed ao executeBatch (§Plano 42)", async () => {
    vi.useFakeTimers();
    const user = userEvent.setup({ delay: null });
    render(
      <MemoryRouter initialEntries={["/investments?tab=rebalancear&valor=100000"]}>
        <AporteTab />
      </MemoryRouter>,
    );

    await vi.runAllTimersAsync();
    vi.useRealTimers();

    // Ativa o uso do saldo em Caixa disponível (R$ 1.000,00) somado aos R$ 1.000,00 do bolso
    const cashSwitch = screen.getByRole("switch", {
      name: /Somar saldo em Caixa da corretora/i,
    });
    await user.click(cashSwitch);

    expect(screen.getByText(/Poder de compra composto:/i)).toBeInTheDocument();

    const submitBtn = screen.getByRole("button", { name: /Lançar compras no extrato/i });
    await user.click(submitBtn);

    expect(screen.getByText(/debitando até/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Aplicar aporte" }));

    expect(mockExecuteBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        totalAmount: 2000,
        cashUsed: 1000,
        items: expect.arrayContaining([
          expect.objectContaining({
            asset_id: "a1",
            quantity: 50,
            total: 2000,
          }),
        ]),
      }),
    );
  });

  it("ativa automaticamente o switch de Caixa com animação quando recebe usarCaixa=1 sem preencher o campo de aporte novo", async () => {
    vi.useFakeTimers();
    render(
      <MemoryRouter initialEntries={["/investments?tab=rebalancear&view=simulador&usarCaixa=1"]}>
        <AporteTab />
      </MemoryRouter>,
    );

    await vi.runAllTimersAsync();
    vi.useRealTimers();

    const cashSwitch = screen.getByRole("switch", {
      name: /Somar saldo em Caixa da corretora/i,
    });
    expect(cashSwitch).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText(/Poder de compra composto:/i)).toBeInTheDocument();

    const aporteInput = screen.getByLabelText("Valor do aporte") as HTMLInputElement;
    expect(aporteInput.value).toMatch(/0,00/);

    const cashInput = screen.getByLabelText(/Saldo em caixa utilizado/i) as HTMLInputElement;
    expect(cashInput.value).toMatch(/1\.000,00/);
  });
});
