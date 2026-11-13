import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { QuickTransactionSheet } from "./quick-transaction-sheet";
import type { PortfolioAsset } from "@/types";

const mockAsset: PortfolioAsset = {
  id: "asset-1",
  user_id: "user-1",
  ticker: "VALE3",
  asset_class: "Ações",
  currency: "BRL",
  quantity: 100,
  average_price: 60.0,
};

const mockTesouroAsset: PortfolioAsset = {
  id: "asset-tesouro-1",
  user_id: "user-1",
  ticker: "Tesouro Selic 2029",
  asset_class: "Tesouro Direto",
  currency: "BRL",
  quantity: 1,
  average_price: 1426.79,
  fixed_income_metadata: {
    base_value: 1426.79,
    base_date: "2024-01-01",
    initial_investment_value: 1426.79,
    initial_investment_date: "2024-01-01",
    rate_type: "selic",
    rate_value: 100,
    is_tax_exempt: false,
  },
};

const mockRecordOrder = vi.fn().mockResolvedValue({ success: true });

vi.mock("@/state", () => ({
  usePortfolioAssets: () => ({
    data: [mockAsset, mockTesouroAsset],
    isLoading: false,
    error: null,
  }),
  useRecordOrder: () => ({
    mutateAsync: mockRecordOrder,
    isPending: false,
  }),
  usePortfolioPosition: () => ({
    rows: [],
  }),
}));

describe("QuickTransactionSheet (Fase 41)", () => {
  it("renderiza corretamente para o ativo fornecido", () => {
    render(<QuickTransactionSheet open={true} asset={mockAsset} onOpenChange={vi.fn()} />);
    expect(screen.getByText("Movimentar VALE3")).toBeInTheDocument();
    expect(screen.getByText("Compra / Aporte")).toBeInTheDocument();
    expect(screen.getByText("Venda / Resgate")).toBeInTheDocument();
  });

  it("permite alternar para modo de Venda e exibe campo de quantidade a vender", async () => {
    const user = userEvent.setup();
    render(<QuickTransactionSheet open={true} asset={mockAsset} onOpenChange={vi.fn()} />);
    const sellTab = screen.getByRole("tab", { name: /Venda/i });
    await user.click(sellTab);
    expect(screen.getByText("Quantidade a Vender")).toBeInTheDocument();
  });

  it("exibe Discriminação do Resgate para Tesouro Direto e permite ajustar IRRF retido", async () => {
    const user = userEvent.setup();
    render(
      <QuickTransactionSheet
        open={true}
        asset={mockTesouroAsset}
        initialType="sell"
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Custo Original da Aplicação (R$)")).toBeInTheDocument();

    // Preenche valor de resgate clicando no atalho 100%
    const totalShortcutBtn = screen.getByRole("button", { name: /100% \(Total\)/i });
    await user.click(totalShortcutBtn);

    expect(screen.getByText("Discriminação do Resgate")).toBeInTheDocument();

    // Clica no botão de ajuste de alíquota/IRRF
    const adjustBtn = screen.getByRole("button", { name: /Ajustar alíquota e imposto de renda retido na fonte/i });
    expect(adjustBtn).toBeInTheDocument();
    await user.click(adjustBtn);

    expect(screen.getByText("Ajuste Fiscal Manual (Nota de Corretagem)")).toBeInTheDocument();
    expect(screen.getByLabelText(/Alíquota personalizada de imposto de renda/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Valor de imposto de renda retido na fonte/i)).toBeInTheDocument();
  });

  it("permite selecionar Grupamento (reverse_split) e exibe prévia com cotas ajustadas", async () => {
    const user = userEvent.setup();
    render(<QuickTransactionSheet open={true} asset={mockAsset} onOpenChange={vi.fn()} />);
    const reverseSplitTab = screen.getByRole("tab", { name: /Grupamento/i });
    expect(reverseSplitTab).toBeInTheDocument();
    await user.click(reverseSplitTab);
    expect(screen.getByText(/Fator \(N para 1\)/i)).toBeInTheDocument();
    expect(screen.getByText("Posição Resultante:")).toBeInTheDocument();
    // mockAsset tem 100 cotas com fator default 2 => 50 cotas
    expect(screen.getByText(/50 cotas a/i)).toBeInTheDocument();
  });
});
