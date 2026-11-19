import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QuickTransactionSheet } from "./quick-transaction-sheet";
import type { PortfolioAsset, PortfolioDividend, PortfolioTransaction } from "@/types";

const mockAsset: PortfolioAsset = {
  id: "asset-1",
  user_id: "user-1",
  ticker: "VALE3",
  asset_class: "Ações",
  currency: "BRL",
  quantity: 100,
  average_price: 60.0,
};

const mockCashAsset: PortfolioAsset = {
  id: "cash-1",
  user_id: "user-1",
  ticker: "CAIXA",
  asset_class: "Caixa",
  currency: "BRL",
  quantity: 1500,
  average_price: 1,
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
const mockUpdateTx = vi.fn().mockResolvedValue({ id: "tx-1" });
const mockUpdateDividend = vi.fn().mockResolvedValue({ id: "div-1" });

vi.mock("@/state", () => ({
  usePortfolioAssets: () => ({
    data: [mockAsset, mockTesouroAsset, mockCashAsset],
    isLoading: false,
    error: null,
  }),
  useRecordOrder: () => ({
    mutateAsync: mockRecordOrder,
    isPending: false,
  }),
  useUpdatePortfolioTransaction: () => ({
    mutateAsync: mockUpdateTx,
    isPending: false,
  }),
  useUpdatePortfolioDividend: () => ({
    mutateAsync: mockUpdateDividend,
    isPending: false,
  }),
  usePortfolioPosition: () => ({
    rows: [],
  }),
}));

describe("QuickTransactionSheet (Fase 41 / Plano 42)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza corretamente para o ativo fornecido com FundingSourceSelector (padrão Bolso)", () => {
    render(<QuickTransactionSheet open={true} asset={mockAsset} onOpenChange={vi.fn()} />);
    expect(screen.getByText("Movimentar VALE3")).toBeInTheDocument();
    expect(screen.getByText("Compra / Aporte")).toBeInTheDocument();
    expect(screen.getByText("Venda / Resgate")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Dinheiro Novo \(Bolso\)/i })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: /Saldo da Corretora \(Caixa\)/i })).toHaveAttribute("aria-checked", "false");
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

    const totalShortcutBtn = screen.getByRole("button", { name: /100% \(Total\)/i });
    await user.click(totalShortcutBtn);

    expect(screen.getByText("Discriminação do Resgate")).toBeInTheDocument();

    const adjustBtn = screen.getByRole("button", { name: /Ajustar alíquota e imposto de renda retido na fonte/i });
    expect(adjustBtn).toBeInTheDocument();
    await user.click(adjustBtn);

    expect(screen.getByText("Ajuste Fiscal Manual (Nota de Corretagem)")).toBeInTheDocument();
    expect(screen.getByLabelText(/Alíquota personalizada de imposto de renda/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Valor de imposto de renda retido na fonte/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Data da Aplicação Original/i)).toBeInTheDocument();
  });

  it("ao desmarcar creditCash em modo venda exibe opção de registrar retirada da carteira para TWR", async () => {
    const user = userEvent.setup();
    render(
      <QuickTransactionSheet
        open={true}
        asset={mockTesouroAsset}
        initialType="sell"
        onOpenChange={vi.fn()}
      />,
    );

    const creditCashCheckbox = screen.getByLabelText(/Creditar o valor líquido da venda diretamente no Caixa da carteira/i);
    expect(creditCashCheckbox).toBeInTheDocument();
    expect(creditCashCheckbox).toBeChecked();

    // Desmarca Creditar no Caixa
    await user.click(creditCashCheckbox);
    expect(creditCashCheckbox).not.toBeChecked();

    // Sub-checkbox de retirada da carteira para TWR deve aparecer
    const recordWithdrawalCheckbox = screen.getByLabelText(/Registrar como retirada da carteira \(expurga a saída no cálculo de TWR\)/i);
    expect(recordWithdrawalCheckbox).toBeInTheDocument();
    expect(recordWithdrawalCheckbox).toBeChecked();
  });

  it("suporta proporção livre X:Y em Grupamento e Desdobro/Bonificação preservando custo total", async () => {
    const user = userEvent.setup();
    render(<QuickTransactionSheet open={true} asset={mockAsset} onOpenChange={vi.fn()} />);
    const reverseSplitTab = screen.getByRole("tab", { name: /Grupamento/i });
    await user.click(reverseSplitTab);
    expect(screen.getByText(/Fator \(N para 1\)/i)).toBeInTheDocument();
    expect(screen.getByText("Posição Resultante:")).toBeInTheDocument();
    expect(screen.getByText(/50 cotas a/i)).toBeInTheDocument();

    // Testa bonificação proporcional 10 para 11 (fator 1.1 -> 110 cotas)
    const splitTab = screen.getByRole("tab", { name: /Desdobro/i });
    await user.click(splitTab);
    fireEvent.change(screen.getByLabelText(/De \(cotas atuais\)/i), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText(/Para \(novas cotas\)/i), { target: { value: "11" } });
    expect(screen.getByText(/110 cotas a/i)).toBeInTheDocument();
  });

  it("permite lançar proventos no modo Valor por Cota calculando o total automaticamente", async () => {
    const user = userEvent.setup();
    render(<QuickTransactionSheet open={true} asset={mockAsset} initialType="dividend" onOpenChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /Valor por Cota/i }));
    const perShareInput = screen.getByLabelText(/Rendimento por Cota/i);
    fireEvent.change(perShareInput, { target: { value: "150" } }); // R$ 1,50 por cota * 100 cotas = R$ 150,00

    await user.click(screen.getByRole("button", { name: /Confirmar Operação/i }));

    await waitFor(() => {
      expect(mockRecordOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "dividend",
          total: 150,
          syncCash: true,
        }),
      );
    });
  });

  it("permite editar transação existente via useUpdatePortfolioTransaction", async () => {
    const user = userEvent.setup();
    const editTx: PortfolioTransaction = {
      id: "tx-1",
      user_id: "user-1",
      asset_id: "asset-1",
      type: "buy",
      date: "2026-05-10",
      quantity: 10,
      price: 55,
      total: 550,
    };

    render(
      <QuickTransactionSheet
        open={true}
        asset={mockAsset}
        editTransaction={editTx}
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Editar Movimentação · VALE3")).toBeInTheDocument();
    const qtyInput = screen.getByLabelText(/Quantidade/i);
    fireEvent.change(qtyInput, { target: { value: "20" } });
    await user.click(screen.getByRole("button", { name: /Salvar Alterações/i }));

    await waitFor(() => {
      expect(mockUpdateTx).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "tx-1",
          patch: expect.objectContaining({
            quantity: 20,
            price: 55,
            total: 1100,
          }),
        }),
      );
    });
  });

  it("permite editar provento existente via useUpdatePortfolioDividend preservando syncCash anterior", async () => {
    const user = userEvent.setup();
    const editDiv: PortfolioDividend = {
      id: "div-1",
      user_id: "user-1",
      asset_id: "asset-1",
      ticker: "VALE3",
      amount: 100,
      date: "2026-05-01",
      notes: "[MENSAL] Provento mensal",
      sync_cash: true,
      cash_amount: 100,
    };

    render(
      <QuickTransactionSheet
        open={true}
        asset={mockAsset}
        editDividend={editDiv}
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Editar Provento · VALE3")).toBeInTheDocument();
    const amountInput = screen.getByLabelText(/Valor Total Recebido/i);
    fireEvent.change(amountInput, { target: { value: "25000" } }); // R$ 250,00

    await user.click(screen.getByRole("button", { name: /Salvar Alterações/i }));

    await waitFor(() => {
      expect(mockUpdateDividend).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "div-1",
          syncCash: true,
          previousSyncCash: true,
          previousCashAmount: 100,
          patch: expect.objectContaining({
            amount: 250,
            cash_amount: 250,
            sync_cash: true,
          }),
        }),
      );
    });
  });
});
