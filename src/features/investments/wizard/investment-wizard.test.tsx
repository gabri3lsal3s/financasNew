import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InvestmentWizard } from "./investment-wizard";
import { StepNewPosition } from "./step-new-position";
import { defaultWizardState } from "./wizard-state";
import type { PortfolioAsset } from "@/types";

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

vi.mock("@/state", () => ({
  usePortfolioAssets: () => ({
    data: [mockAsset],
    isLoading: false,
    error: null,
  }),
  usePortfolioPosition: () => ({
    totalBRL: 5000,
    cashBRL: 1000,
    investedBRL: 4000,
    rows: [{ assetId: "asset-1", ticker: "PETR4", valueBRL: 4000, pct: 80, assetClass: "Ações" }],
    isLoading: false,
    error: null,
  }),
  useAllocationTargets: () => ({
    data: [{ asset_id: "asset-1", target_percentage: 20 }],
    isLoading: false,
    error: null,
  }),
  useGroupTargets: () => ({
    data: [],
    isLoading: false,
    error: null,
  }),
  useCreatePortfolioAsset: () => ({
    mutateAsync: vi.fn().mockResolvedValue({ id: "new-asset-id", ticker: "WEGE3" }),
    isPending: false,
  }),
  useRecordOrder: () => ({
    mutateAsync: vi.fn().mockResolvedValue({ success: true }),
    isPending: false,
  }),
  useSaveAllocationTargets: () => ({
    mutateAsync: vi.fn().mockResolvedValue(true),
    isPending: false,
  }),
  useSetManualPrice: () => ({
    mutateAsync: vi.fn().mockResolvedValue(true),
    isPending: false,
  }),
}));

describe("InvestmentWizard (Fase 41)", () => {
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

  it("StepNewPosition: exibe campos de Preço Inicial e Saldo para ativo de Renda Fixa (sem cotas)", () => {
    const onChange = vi.fn();
    render(
      <StepNewPosition
        state={{
          ...defaultWizardState,
          mode: "new_asset",
          step: 2,
          ticker: "CDB INTER",
          assetClass: "Renda Fixa",
        }}
        onChange={onChange}
      />,
    );

    expect(screen.getByText(/Posição Inicial \(Renda Fixa\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Preço inicial investido")).toBeInTheDocument();
    expect(screen.getByLabelText("Preço atual ou saldo")).toBeInTheDocument();
    expect(screen.queryByLabelText("Quantidade Inicial de Cotas")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Preço Médio de Aquisição (BRL)")).not.toBeInTheDocument();
  });

  it("StepNewPosition: exibe seletor de modo para Tesouro Direto com padrão Valor Completo", () => {
    const onChange = vi.fn();
    render(
      <StepNewPosition
        state={{
          ...defaultWizardState,
          mode: "new_asset",
          step: 2,
          ticker: "TESOURO SELIC",
          assetClass: "Renda Fixa",
        }}
        onChange={onChange}
      />,
    );

    expect(screen.getByText(/Modo de Precificação do Tesouro/i)).toBeInTheDocument();
    expect(screen.getByText(/Valor Completo \(Padrão RF\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Preço Médio \/ Cotas/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Preço inicial investido")).toBeInTheDocument();
  });
});
