import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { triggerSensory } from "@/services/sensory";
import { TransactionFormDialog } from "./transaction-form-dialog";

const createTxMock = vi.fn();
const updateTxMock = vi.fn();
const deleteTxMock = vi.fn();
const createContribMock = vi.fn();
const updateAssetMock = vi.fn();
const createDividendMock = vi.fn();

vi.mock("@/services/sensory", () => ({ triggerSensory: vi.fn() }));

vi.mock("@/state", () => ({
  useCreatePortfolioTransaction: () => ({ mutateAsync: createTxMock, isPending: false }),
  useUpdatePortfolioTransaction: () => ({ mutateAsync: updateTxMock, isPending: false }),
  useDeletePortfolioTransaction: () => ({ mutateAsync: deleteTxMock, isPending: false }),
  useCreatePortfolioContribution: () => ({ mutateAsync: createContribMock, isPending: false }),
  useUpdatePortfolioContribution: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeletePortfolioContribution: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreatePortfolioDividend: () => ({ mutateAsync: createDividendMock, isPending: false }),
  useUpdatePortfolioAsset: () => ({ mutateAsync: updateAssetMock, isPending: false }),
  usePortfolioAssets: () => ({ data: [], isLoading: false }),
  usePortfolioContributions: () => ({ data: [], isLoading: false }),
  usePortfolioPosition: () => ({ rows: [] }),
}));

const asset = {
  id: "a1",
  user_id: "u1",
  ticker: "PETR4",
  asset_class: "Ações",
  currency: "BRL" as const,
  quantity: 100,
  average_price: 30,
};

const existingTx = {
  id: "tx1",
  user_id: "u1",
  asset_id: "a1",
  type: "buy" as const,
  date: "2026-03-10",
  quantity: 10,
  price: 42.5,
  total: 425,
};

describe("TransactionFormDialog — feedback de escrita (F15)", () => {
  beforeEach(() => {
    createTxMock.mockReset();
    updateTxMock.mockReset();
    deleteTxMock.mockReset();
    createContribMock.mockReset();
    updateAssetMock.mockReset();
    createDividendMock.mockReset();
    vi.mocked(triggerSensory).mockClear();
  });

  it("dispara haptic success e áudio de confirmação ao registrar uma compra e atualiza custódia", async () => {
    createTxMock.mockResolvedValue({});
    updateAssetMock.mockResolvedValue({});
    createContribMock.mockResolvedValue({});
    const user = userEvent.setup();
    render(<TransactionFormDialog open={true} onOpenChange={vi.fn()} asset={asset} />);

    await user.type(screen.getByRole("textbox", { name: "Quantidade" }), "10");
    await user.type(screen.getByRole("textbox", { name: "Preço unitário" }), "42,50");
    await user.click(screen.getByRole("button", { name: "Registrar" }));

    expect(createTxMock).toHaveBeenCalledTimes(1);
    expect(updateAssetMock).toHaveBeenCalledWith({
      id: "a1",
      patch: expect.objectContaining({ quantity: 110 }),
    });
    expect(triggerSensory).toHaveBeenCalledWith("success");
  });

  it("não dispara feedback quando o formulário está inválido", () => {
    render(<TransactionFormDialog open={true} onOpenChange={vi.fn()} asset={asset} />);

    // Quantidade e preço zerados → botão desabilitado.
    expect(screen.getByRole("button", { name: "Registrar" })).toBeDisabled();
    expect(triggerSensory).not.toHaveBeenCalled();
  });

  it("valida contra venda a descoberto e bloqueia o envio exibindo mensagem de erro", async () => {
    const user = userEvent.setup();
    render(<TransactionFormDialog open={true} onOpenChange={vi.fn()} asset={asset} />);

    // Seleciona Venda
    await user.click(screen.getByRole("combobox", { name: "Tipo de operação" }));
    await user.click(screen.getByRole("option", { name: "Venda" }));

    // asset.quantity é 100 cotas. Digita 150 cotas:
    await user.type(screen.getByRole("textbox", { name: "Quantidade" }), "150");
    await user.type(screen.getByRole("textbox", { name: "Preço unitário" }), "35,00");
    await user.click(screen.getByRole("button", { name: "Registrar" }));

    expect(createTxMock).not.toHaveBeenCalled();
    expect(updateAssetMock).not.toHaveBeenCalled();
    expect(screen.getByText(/excede a custódia atual/i)).toBeInTheDocument();
    expect(triggerSensory).toHaveBeenCalledWith("destructive");
  });

  it("registra venda válida reduzindo quantidade mantendo o preço médio", async () => {
    createTxMock.mockResolvedValue({});
    updateAssetMock.mockResolvedValue({});
    const user = userEvent.setup();
    render(<TransactionFormDialog open={true} onOpenChange={vi.fn()} asset={asset} />);

    // Seleciona Venda
    await user.click(screen.getByRole("combobox", { name: "Tipo de operação" }));
    await user.click(screen.getByRole("option", { name: "Venda" }));

    // Vende 20 cotas a R$ 35
    await user.type(screen.getByRole("textbox", { name: "Quantidade" }), "20");
    await user.type(screen.getByRole("textbox", { name: "Preço unitário" }), "35,00");
    await user.click(screen.getByRole("button", { name: "Registrar" }));

    expect(createTxMock).toHaveBeenCalledTimes(1);
    expect(updateAssetMock).toHaveBeenCalledWith({
      id: "a1",
      patch: {
        quantity: 80,
        average_price: 30, // PM inalterado na venda
      },
    });
    expect(triggerSensory).toHaveBeenCalledWith("success");
  });

  it("modo edição: salva via update com os dados da transação (CRUD completo)", async () => {
    updateTxMock.mockResolvedValue({});
    const user = userEvent.setup();
    render(<TransactionFormDialog open={true} onOpenChange={vi.fn()} asset={asset} transaction={existingTx} />);

    // O formulário inicia preenchido com os dados da transação em edição.
    expect(screen.getByRole("textbox", { name: "Quantidade" })).toHaveValue("10");
    await user.clear(screen.getByRole("textbox", { name: "Quantidade" }));
    await user.type(screen.getByRole("textbox", { name: "Quantidade" }), "15");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(updateTxMock).toHaveBeenCalledTimes(1);
    expect(updateTxMock).toHaveBeenCalledWith({
      id: "tx1",
      patch: expect.objectContaining({ quantity: 15, asset_id: "a1" }),
    });
    expect(createTxMock).not.toHaveBeenCalled();
  });

  it("registra aporte em Renda Fixa atualizando base_value e average_price em portfolio_assets", async () => {
    createTxMock.mockResolvedValue({});
    updateAssetMock.mockResolvedValue({});
    createContribMock.mockResolvedValue({});
    const user = userEvent.setup();

    const fiAsset = {
      id: "fi1",
      user_id: "u1",
      ticker: "CDB-DI",
      asset_class: "Renda Fixa",
      currency: "BRL" as const,
      quantity: 1,
      average_price: 10000,
      fixed_income_metadata: {
        rate_type: "cdi" as const,
        rate_value: 110,
        base_date: "2026-01-01",
        base_value: 10000,
        initial_investment_value: 10000,
        initial_investment_date: "2026-01-01",
        is_tax_exempt: false,
      },
    };

    render(<TransactionFormDialog open={true} onOpenChange={vi.fn()} asset={fiAsset} />);

    // Em Renda Fixa (total_value), campo monetário único
    const input = screen.getByLabelText(/Valor da aplicação/i);
    await user.type(input, "500000"); // R$ 5.000,00
    await user.click(screen.getByRole("button", { name: "Registrar" }));

    expect(createTxMock).toHaveBeenCalledWith(
      expect.objectContaining({
        asset_id: "fi1",
        type: "buy",
        quantity: 1,
        price: 5000,
        total: 5000,
      }),
    );
    expect(updateAssetMock).toHaveBeenCalledWith({
      id: "fi1",
      patch: expect.objectContaining({
        quantity: 1,
        average_price: 15000,
        fixed_income_metadata: expect.objectContaining({
          base_value: 15000,
          initial_investment_value: 15000,
        }),
      }),
    });
  });

  it("registra resgate parcial em Renda Fixa proporcionalmente com atualização de metadados", async () => {
    createTxMock.mockResolvedValue({});
    updateAssetMock.mockResolvedValue({});
    const user = userEvent.setup();

    const fiAsset = {
      id: "fi1",
      user_id: "u1",
      ticker: "CDB-DI",
      asset_class: "Renda Fixa",
      currency: "BRL" as const,
      quantity: 1,
      average_price: 10000,
      fixed_income_metadata: {
        rate_type: "cdi" as const,
        rate_value: 110,
        base_date: "2026-01-01",
        base_value: 10000,
        initial_investment_value: 10000,
        initial_investment_date: "2026-01-01",
        is_tax_exempt: false,
      },
    };

    render(<TransactionFormDialog open={true} onOpenChange={vi.fn()} asset={fiAsset} />);

    // Seleciona Resgate
    await user.click(screen.getByRole("combobox", { name: "Tipo de operação" }));
    await user.click(screen.getByRole("option", { name: "Resgate" }));

    const input = screen.getByLabelText(/Valor a resgatar/i);
    await user.type(input, "400000"); // R$ 4.000,00
    await user.click(screen.getByRole("button", { name: "Registrar" }));

    expect(createTxMock).toHaveBeenCalledWith(
      expect.objectContaining({
        asset_id: "fi1",
        type: "sell",
        quantity: 1,
        price: 4000,
        total: 4000,
      }),
    );
    expect(updateAssetMock).toHaveBeenCalledWith({
      id: "fi1",
      patch: expect.objectContaining({
        quantity: 1,
        average_price: expect.any(Number),
        fixed_income_metadata: expect.objectContaining({
          base_value: expect.any(Number),
        }),
      }),
    });
  });

  it("valida contra resgate acima do saldo disponível em Renda Fixa", async () => {
    const user = userEvent.setup();

    const fiAsset = {
      id: "fi1",
      user_id: "u1",
      ticker: "CDB-DI",
      asset_class: "Renda Fixa",
      currency: "BRL" as const,
      quantity: 1,
      average_price: 5000,
      fixed_income_metadata: {
        rate_type: "cdi" as const,
        rate_value: 100,
        base_date: "2026-03-01",
        base_value: 5000,
        initial_investment_value: 5000,
        initial_investment_date: "2026-03-01",
        is_tax_exempt: false,
      },
    };

    render(<TransactionFormDialog open={true} onOpenChange={vi.fn()} asset={fiAsset} />);

    // Seleciona Resgate
    await user.click(screen.getByRole("combobox", { name: "Tipo de operação" }));
    await user.click(screen.getByRole("option", { name: "Resgate" }));

    const input = screen.getByLabelText(/Valor a resgatar/i);
    await user.type(input, "900000"); // R$ 9.000,00 (excede 5.000)
    await user.click(screen.getByRole("button", { name: "Registrar" }));

    expect(createTxMock).not.toHaveBeenCalled();
    expect(updateAssetMock).not.toHaveBeenCalled();
    expect(screen.getByText(/excede o saldo disponível/i)).toBeInTheDocument();
  });

  it("modo edição: exclui o lançamento com confirmação", async () => {
    deleteTxMock.mockResolvedValue({});
    const user = userEvent.setup();
    render(<TransactionFormDialog open={true} onOpenChange={vi.fn()} asset={asset} transaction={existingTx} />);

    await user.click(screen.getByRole("button", { name: "Excluir lançamento" }));
    await user.click(screen.getByRole("button", { name: "Excluir" }));

    expect(deleteTxMock).toHaveBeenCalledTimes(1);
    expect(deleteTxMock).toHaveBeenCalledWith("tx1");
    expect(triggerSensory).toHaveBeenCalledWith("destructive");
  });
});
