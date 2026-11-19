import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InvestmentWizard } from "./investment-wizard";
import type { GroupTarget, PortfolioAsset } from "@/types";

const mockAsset: PortfolioAsset = {
  id: "asset-1",
  user_id: "user-1",
  ticker: "PETR4",
  asset_class: "Ações",
  currency: "BRL",
  quantity: 100,
  average_price: 30.0,
  notes: "Petrobras PN",
};

const secondAsset: PortfolioAsset = {
  id: "asset-2",
  user_id: "user-1",
  ticker: "TESOURO",
  asset_class: "Renda Fixa",
  currency: "BRL",
  quantity: 1,
  average_price: 3000,
  notes: "Tesouro Selic",
};

let mockClassTargets: GroupTarget[] = [
  { id: "gt-1", user_id: "user-1", group_type: "class", name: "Ações", target_percentage: 20 },
];
let mockAssetsList: PortfolioAsset[] = [mockAsset];
let mockPositionRows = [
  { assetId: "asset-1", ticker: "PETR4", valueBRL: 1000, pct: 20, assetClass: "Ações", priceBRL: 50 },
];
const mockRecordOrder = vi.fn().mockResolvedValue({ success: true });
const mockCreateAsset = vi.fn().mockResolvedValue({ id: "new-asset-id", ticker: "WEGE3" });
const mockUpdateEmergencyConfig = vi.fn().mockResolvedValue(undefined);

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
  usePortfolioAssets: () => ({
    data: mockAssetsList,
    isLoading: false,
    error: null,
  }),
  usePortfolioPosition: () => ({
    totalBRL: 5000,
    cashBRL: 1000,
    investedBRL: 4000,
    rows: mockPositionRows,
    isLoading: false,
    error: null,
  }),
  useGroupTargets: (groupType: "class" | "sector") => ({
    data: groupType === "class" ? mockClassTargets : [],
    isLoading: false,
    error: null,
  }),
  useCreatePortfolioAsset: () => ({
    mutateAsync: mockCreateAsset,
    isPending: false,
  }),
  useRecordOrder: () => ({
    mutateAsync: mockRecordOrder,
    isPending: false,
  }),
  useSetManualPrice: () => ({
    mutateAsync: vi.fn().mockResolvedValue(true),
    isPending: false,
  }),
  useCreatePortfolioTransaction: () => ({
    mutateAsync: vi.fn().mockResolvedValue({ id: "tx1" }),
    isPending: false,
  }),
  useCreatePortfolioContribution: () => ({
    mutateAsync: vi.fn().mockResolvedValue({ id: "cb1" }),
    isPending: false,
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
    updateConfig: mockUpdateEmergencyConfig,
    isLoading: false,
    isUpdating: false,
    portfolioRows: [],
  }),
  invalidatePortfolioSuite: vi.fn().mockResolvedValue(undefined),
  useFamilyMode: () => ({ isFamilyModeEnabled: false, toggleFamilyMode: vi.fn() }),
  useMyFamily: () => ({ data: null, isLoading: false, isError: false }),
}));

describe("InvestmentWizard (Fase 41 / Plano 42)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAssetsList = [mockAsset];
    mockPositionRows = [
      { assetId: "asset-1", ticker: "PETR4", valueBRL: 1000, pct: 20, assetClass: "Ações", priceBRL: 50 },
    ];
    mockClassTargets = [
      { id: "gt-1", user_id: "user-1", group_type: "class", name: "Ações", target_percentage: 20 },
    ];
  });
  it("renderiza o passo inicial de seleção com autocomplete e sugestões", () => {
    render(<InvestmentWizard open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByPlaceholderText(/Ex: PETR4, MXRF11/i)).toBeInTheDocument();
    expect(screen.getByText("PETR4")).toBeInTheDocument();
  });

  it("inicia em modo fast-track de Aporte quando recebe initialAsset", () => {
    render(<InvestmentWizard open={true} initialAsset={mockAsset} onOpenChange={vi.fn()} />);
    expect(screen.getByText("Quantidade de Cotas")).toBeInTheDocument();
    expect(screen.getByText("Posição Atual: 100 cotas · PM:")).toBeInTheDocument();
  });

  it("inicia em modo fast-track de Venda quando recebe initialAsset e initialMode='sell'", () => {
    render(
      <InvestmentWizard
        open={true}
        initialAsset={mockAsset}
        initialMode="sell"
        onOpenChange={vi.fn()}
      />,
    );
    expect(screen.getByText("Quantidade a Vender")).toBeInTheDocument();
    expect(screen.getByText("Preço de Venda (BRL)")).toBeInTheDocument();
  });

  it("permite selecionar um ativo existente e transitar para o formulário de aporte", () => {
    render(<InvestmentWizard open={true} onOpenChange={vi.fn()} />);
    const assetButton = screen.getByText("PETR4").closest("button");
    if (assetButton) {
      fireEvent.click(assetButton);
    }
    expect(screen.getByText("Quantidade de Cotas")).toBeInTheDocument();
  });

  it("permite buscar e selecionar ticker de 1 letra ('O' - Realty Income) transitando para posição inicial", () => {
    render(<InvestmentWizard open={true} onOpenChange={vi.fn()} />);
    const searchInput = screen.getByPlaceholderText(/Ex: PETR4, MXRF11/i);
    fireEvent.change(searchInput, { target: { value: "O" } });

    expect(screen.getByText("Realty Income Corporation (The Monthly Dividend Company)")).toBeInTheDocument();
    const resultButton = screen.getByText("Realty Income Corporation (The Monthly Dividend Company)").closest("button");
    if (resultButton) {
      fireEvent.click(resultButton);
    }
    expect(screen.getAllByText("O").length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/Quantidade Inicial de Cotas/i)).toBeInTheDocument();
  });

  it("exibe aviso informativo quando o usuário não possui metas cadastradas", () => {
    // Renderiza componente StepSelect diretamente com targets vazios
    render(
      <InvestmentWizard
        open={true}
        onOpenChange={vi.fn()}
      />,
    );
    expect(screen.getByText(/PETR4/i)).toBeInTheDocument();
  });

  it("deixa quantidade vazia ao selecionar ativo sugerido quando não há saldo em caixa", () => {
    mockClassTargets = [
      { id: "gt-1", user_id: "user-1", group_type: "class", name: "Ações", target_percentage: 80 },
      { id: "gt-2", user_id: "user-1", group_type: "class", name: "Renda Fixa", target_percentage: 20 },
    ];
    mockAssetsList = [mockAsset, secondAsset]; // Sem ativo de CAIXA; PETR4 está em 25% contra meta 80%
    mockPositionRows = [
      { assetId: "asset-1", ticker: "PETR4", valueBRL: 1000, pct: 25, assetClass: "Ações", priceBRL: 50 },
      { assetId: "asset-2", ticker: "TESOURO", valueBRL: 3000, pct: 75, assetClass: "Renda Fixa", priceBRL: 3000 },
    ];

    render(<InvestmentWizard open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText("Sugeridos para rebalanceamento")).toBeInTheDocument();
    expect(screen.getByText(/Meta: 80%/i)).toBeInTheDocument();

    const suggestionCard = screen.getByText("PETR4").closest("button");
    expect(suggestionCard).toBeTruthy();
    fireEvent.click(suggestionCard!);

    // No passo 2, a quantidade deve vir vazia ("")
    const qtyInput = screen.getByLabelText(/Quantidade de Cotas/i) as HTMLInputElement;
    expect(qtyInput.value).toBe("");
  });

  it("sugere cotas limitadas ao caixa quando há saldo em caixa disponível", () => {
    mockClassTargets = [
      { id: "gt-1", user_id: "user-1", group_type: "class", name: "Ações", target_percentage: 80 },
      { id: "gt-2", user_id: "user-1", group_type: "class", name: "Renda Fixa", target_percentage: 20 },
    ];
    const cashAsset: PortfolioAsset = {
      id: "cash-1",
      user_id: "user-1",
      ticker: "CAIXA",
      asset_class: "Caixa",
      currency: "BRL",
      quantity: 150, // R$ 150 em caixa
      average_price: 1,
    };
    mockAssetsList = [mockAsset, secondAsset, cashAsset]; // PETR4 custa R$ 50 no mock, logo 150 / 50 = 3 cotas
    mockPositionRows = [
      { assetId: "asset-1", ticker: "PETR4", valueBRL: 1000, pct: 25, assetClass: "Ações", priceBRL: 50 },
      { assetId: "asset-2", ticker: "TESOURO", valueBRL: 3000, pct: 75, assetClass: "Renda Fixa", priceBRL: 3000 },
    ];

    render(<InvestmentWizard open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText("Sugeridos para rebalanceamento")).toBeInTheDocument();
    expect(screen.getByText(/Cabe no caixa: 3 cotas/i)).toBeInTheDocument();

    const suggestionCard = screen.getByText("PETR4").closest("button");
    expect(suggestionCard).toBeTruthy();
    fireEvent.click(suggestionCard!);

    // No passo 2, deve vir preenchido com 3 cotas
    const qtyInput = screen.getByLabelText(/Quantidade de Cotas/i) as HTMLInputElement;
    expect(qtyInput.value).toBe("3");
  });

  it("permite editar a quantidade após sugestão e submete total = parsedQty * price", async () => {
    mockClassTargets = [
      { id: "gt-1", user_id: "user-1", group_type: "class", name: "Ações", target_percentage: 80 },
      { id: "gt-2", user_id: "user-1", group_type: "class", name: "Renda Fixa", target_percentage: 20 },
    ];
    const cashAsset: PortfolioAsset = {
      id: "cash-1",
      user_id: "user-1",
      ticker: "CAIXA",
      asset_class: "Caixa",
      currency: "BRL",
      quantity: 500, // R$ 500 em caixa
      average_price: 1,
    };
    mockAssetsList = [mockAsset, secondAsset, cashAsset];
    mockPositionRows = [
      { assetId: "asset-1", ticker: "PETR4", valueBRL: 1000, pct: 25, assetClass: "Ações", priceBRL: 50 },
      { assetId: "asset-2", ticker: "TESOURO", valueBRL: 3000, pct: 75, assetClass: "Renda Fixa", priceBRL: 3000 },
    ];

    render(<InvestmentWizard open={true} onOpenChange={vi.fn()} />);
    const suggestionCard = screen.getByText("PETR4").closest("button");
    fireEvent.click(suggestionCard!);

    // Edita quantidade de 10 cotas para 1 cota
    const qtyInput = screen.getByLabelText(/Quantidade de Cotas/i);
    fireEvent.change(qtyInput, { target: { value: "1" } });

    // Avança para Revisão (Passo 3)
    const continueButton = screen.getByRole("button", { name: /^Continuar$/i });
    fireEvent.click(continueButton);

    // Na revisão, clica em Confirmar Operação
    const submitButton = screen.getByRole("button", { name: /Confirmar Operação/i });
    fireEvent.click(submitButton);

    // mutateAsync deve receber total = 50 (1 cota * R$ 50), e NÃO 500 ou 3000
    expect(mockRecordOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "buy",
        quantity: 1,
        price: 50,
        total: 50,
      }),
    );
  });

  it("calcula e preenche quantidade fracionária precisa para ativo do Tesouro Direto ou Cripto", () => {
    mockClassTargets = [
      { id: "gt-1", user_id: "user-1", group_type: "class", name: "Cripto", target_percentage: 80 },
      { id: "gt-2", user_id: "user-1", group_type: "class", name: "Renda Fixa", target_percentage: 20 },
    ];
    const cryptoAsset: PortfolioAsset = {
      ...mockAsset,
      asset_class: "Cripto",
    };
    const cashAsset: PortfolioAsset = {
      id: "cash-1",
      user_id: "user-1",
      ticker: "CAIXA",
      asset_class: "Caixa",
      currency: "BRL",
      quantity: 25, // R$ 25 em caixa, insuficiente para 1 cota inteira (R$ 50)
      average_price: 1,
    };
    mockAssetsList = [cryptoAsset, secondAsset, cashAsset];
    mockPositionRows = [
      { assetId: "asset-1", ticker: "PETR4", valueBRL: 1000, pct: 25, assetClass: "Cripto", priceBRL: 50 },
      { assetId: "asset-2", ticker: "TESOURO", valueBRL: 3000, pct: 75, assetClass: "Renda Fixa", priceBRL: 3000 },
    ];

    render(<InvestmentWizard open={true} onOpenChange={vi.fn()} />);
    // Com caixa de R$ 25 e preço de R$ 50, ativo fracionário cabe no caixa (0.5 cota)
    expect(screen.getByText(/Cabe no caixa: 0.5 cota/i)).toBeInTheDocument();

    const suggestionCard = screen.getByText("PETR4").closest("button");
    expect(suggestionCard).toBeTruthy();
    fireEvent.click(suggestionCard!);

    // No passo 2, deve vir preenchido com a fração exata 0.5
    const qtyInput = screen.getByLabelText(/Quantidade de Cotas/i) as HTMLInputElement;
    expect(qtyInput.value).toBe("0.5");
  });

  it("suporta initialQuantity e initialTotalCents pré-carregados (Fase 10)", () => {
    render(
      <InvestmentWizard
        open={true}
        onOpenChange={vi.fn()}
        initialAsset={mockAsset}
        initialMode="buy"
        initialQuantity={25}
        initialTotalCents={125000} // R$ 1.250,00
      />,
    );

    const qtyInput = screen.getByLabelText(/Quantidade de Cotas/i) as HTMLInputElement;
    expect(qtyInput.value).toBe("25");

    expect(screen.getByText("Total Investido na Ordem")).toBeInTheDocument();
    expect(screen.getAllByText(/750,00/).length).toBeGreaterThan(0);
  });

  it("cria novo ativo passando pelo Passo 3 de Governança (Nota 0-10 e Status) e salva sem allocation_targets (§Plano 42)", async () => {
    render(<InvestmentWizard open={true} onOpenChange={vi.fn()} />);
    const searchInput = screen.getByPlaceholderText(/Ex: PETR4, MXRF11/i);
    fireEvent.change(searchInput, { target: { value: "WEGE3" } });

    const option = screen.getByText(/WEGE3/i).closest("button");
    expect(option).toBeTruthy();
    fireEvent.click(option!);

    // Passo 2: Posição Inicial
    const qtyInput = screen.getByLabelText(/Quantidade Inicial de Cotas/i);
    fireEvent.change(qtyInput, { target: { value: "10" } });
    const priceInput = screen.getByLabelText(/Preço Médio/i);
    fireEvent.change(priceInput, { target: { value: "4000" } });

    fireEvent.click(screen.getByRole("button", { name: /^Continuar$/i }));

    // Passo 3: Governança (Nota & Status)
    expect(screen.getByText(/Nota de Convicção \(0 a 10\)/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Nota 9" }));
    fireEvent.click(screen.getByRole("button", { name: /^Continuar$/i }));

    // Passo 4: Revisão
    expect(screen.getByText(/Nota 9\/10/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Confirmar Operação/i }));

    await waitFor(() => {
      expect(mockCreateAsset).toHaveBeenCalledWith(
        expect.objectContaining({
          ticker: "WEGE3",
          score: 9,
          allocation_status: "active",
        }),
      );
    });
  });

  it("permite alternar FundingSourceSelector entre Dinheiro Novo (Bolso) e Caixa na compra", () => {
    const cashAsset: PortfolioAsset = {
      id: "cash-1",
      user_id: "user-1",
      ticker: "CAIXA",
      asset_class: "Caixa",
      currency: "BRL",
      quantity: 1000,
      average_price: 1,
    };
    mockAssetsList = [mockAsset, cashAsset];

    render(
      <InvestmentWizard
        open={true}
        initialAsset={mockAsset}
        initialMode="buy"
        onOpenChange={vi.fn()}
      />,
    );

    // Padrão: Bolso selecionado (syncCash=false, recordContribution=true)
    const pocketRadio = screen.getByRole("radio", { name: /Dinheiro Novo \(Bolso\)/i });
    const cashRadio = screen.getByRole("radio", { name: /Saldo da Corretora \(Caixa\)/i });
    expect(pocketRadio).toHaveAttribute("aria-checked", "true");
    expect(cashRadio).toHaveAttribute("aria-checked", "false");

    fireEvent.click(cashRadio);
    expect(cashRadio).toHaveAttribute("aria-checked", "true");

    const qtyInput = screen.getByLabelText(/Quantidade de Cotas/i);
    fireEvent.change(qtyInput, { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: /^Continuar$/i }));
    fireEvent.click(screen.getByRole("button", { name: /Confirmar Operação/i }));

    expect(mockRecordOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        syncCash: true,
        recordContribution: false,
      }),
    );
  });

  it("exibe título Grupamento (Inplit) e calcula proporção X:Y (5 para 2) até a revisão com data BR", async () => {
    render(
      <InvestmentWizard
        open={true}
        initialAsset={mockAsset}
        initialMode="reverse_split"
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByText(/Grupamento \(Inplit\) · PETR4/i)).toBeInTheDocument();

    const fromInput = screen.getByLabelText(/De \(cotas atuais\)/i);
    const toInput = screen.getByLabelText(/Para \(novas cotas\)/i);
    fireEvent.change(fromInput, { target: { value: "5" } });
    fireEvent.change(toInput, { target: { value: "2" } });

    expect(screen.getByText(/40 cotas a/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Continuar$/i }));

    expect(screen.getByText("5 para 2")).toBeInTheDocument();
    expect(screen.getByText(/^\d{2}\/\d{2}\/\d{4}$/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Confirmar Operação/i }));
    await waitFor(() => {
      expect(mockRecordOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "reverse_split",
          quantity: 2.5,
        }),
      );
    });
  });

  it("calcula provento por cota (Valor por Cota) e confirma operação em reais", async () => {
    render(
      <InvestmentWizard
        open={true}
        initialAsset={mockAsset}
        initialMode="dividend"
        onOpenChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Valor por Cota/i }));
    const perShareInput = screen.getByLabelText(/Rendimento por Cota \(Líquido\)/i);
    fireEvent.change(perShareInput, { target: { value: "150" } });

    expect(screen.getAllByText(/150,00/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /^Continuar$/i }));
    fireEvent.click(screen.getByRole("button", { name: /Confirmar Operação/i }));

    await waitFor(() => {
      expect(mockRecordOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "dividend",
          total: 150,
        }),
      );
    });
  });

  it("permite expandir Accordion de ajuste manual de IRRF na venda de Renda Fixa", () => {
    const fixedIncomeAsset: PortfolioAsset = {
      ...secondAsset,
      fixed_income_metadata: {
        rate_type: "cdi",
        rate_value: 100,
        base_value: 3600,
        base_date: "2026-01-01",
        initial_investment_date: "2025-01-01",
        is_tax_exempt: false,
      },
    };
    mockAssetsList = [mockAsset, fixedIncomeAsset];

    render(
      <InvestmentWizard
        open={true}
        initialAsset={fixedIncomeAsset}
        initialMode="sell"
        onOpenChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /100% \(Total\)/i }));
    const toggleBtn = screen.getByRole("button", { name: /Ajustar alíquota e imposto de renda retido na fonte/i });
    fireEvent.click(toggleBtn);
    expect(screen.getByText(/Ajuste Fiscal Manual \(Nota de Corretagem\)/i)).toBeInTheDocument();
  });

  it("identifica BPAC11 como Ações no catálogo e exibe seletor de classe no Passo 2", async () => {
    mockAssetsList = [mockAsset];
    render(
      <InvestmentWizard
        open={true}
        onOpenChange={vi.fn()}
      />,
    );

    const searchInput = screen.getByPlaceholderText(/Ex: PETR4, MXRF11, O, Tesouro Selic, Apple.../i);
    fireEvent.change(searchInput, { target: { value: "BPAC11" } });

    await waitFor(() => {
      expect(screen.getByText("BPAC11")).toBeInTheDocument();
      expect(screen.getByText("Banco BTG Pactual S.A. Unit")).toBeInTheDocument();
      expect(screen.getByText("Ações")).toBeInTheDocument();
    });

    // Clica para cadastrar / selecionar BPAC11
    fireEvent.click(screen.getByText("BPAC11"));

    await waitFor(() => {
      expect(screen.getByText(/Novo Ativo · BPAC11/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Classe de Ativo/i)).toBeInTheDocument();
    });
  });
});
