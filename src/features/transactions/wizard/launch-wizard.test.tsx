import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LaunchWizard } from "./launch-wizard";

const createExpenseMock = vi.fn();
const navigateMock = vi.fn();

vi.mock("react-router", () => ({
  useNavigate: () => navigateMock,
}));

vi.mock("@/state", () => ({
  useCategories: () => ({
    data: [
      { id: "c1", name: "Alimentação", type: "expense", icon: "alimentacao", color: null, is_reserved: false, is_active: true },
      { id: "c2", name: "Salário", type: "income", icon: "salario", color: null, is_reserved: false, is_active: true },
    ],
    isLoading: false,
    isError: false,
    error: null,
  }),
  useActiveCreditCards: () => ({ data: [], isLoading: false, isError: false, error: null }),
  useCreateExpense: () => ({ mutateAsync: createExpenseMock, isPending: false }),
  useCreateIncome: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

describe("LaunchWizard — fluxo de lançamento (D10)", () => {
  beforeEach(() => {
    createExpenseMock.mockReset().mockResolvedValue("expense-1");
    navigateMock.mockReset();
  });

  it("exibe os 4 passos do Stepper", () => {
    render(<LaunchWizard />);
    expect(screen.getAllByText("Valor").length).toBeGreaterThan(0);
    expect(screen.getByText("Categoria")).toBeInTheDocument();
    expect(screen.getByText("Detalhes")).toBeInTheDocument();
    expect(screen.getByText("Revisão")).toBeInTheDocument();
  });

  it("avança pelos passos e confirma a despesa com parcelamento", async () => {
    const user = userEvent.setup();
    render(<LaunchWizard />);

    // Passo 1 — digita 150000 centavos e parcela em 2x (MoneyInput é um textbox)
    const input = screen.getByRole("textbox", { name: "Valor do lançamento" });
    await user.type(input, "150000");
    await user.click(screen.getByRole("button", { name: "Aumentar parcelas" }));

    // Continuar habilitado com valor > 0
    const continuar = screen.getByRole("button", { name: "Continuar" });
    expect(continuar).toBeEnabled();
    await user.click(continuar);

    // Passo 2 — seleciona a categoria
    await user.click(screen.getByRole("button", { name: /alimentação/i }));

    // Passo 3 — segue com defaults (pix, data de hoje)
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    // Passo 4 — revisão mostra o total e confirma
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByText("R$ 1.500,00")).toBeInTheDocument();
    const confirmar = screen.getByRole("button", { name: "Confirmar lançamento" });
    expect(confirmar).toBeEnabled();
    await user.click(confirmar);

    expect(createExpenseMock).toHaveBeenCalledTimes(1);
    const params = createExpenseMock.mock.calls[0]?.[0];
    expect(params.value).toBe(1500);
    expect(params.installments).toHaveLength(2);
    const sum = params.installments.reduce((acc: number, item: { value: number }) => acc + item.value, 0);
    expect(sum).toBe(1500);
    expect(navigateMock).toHaveBeenCalledWith("/transacoes", { replace: true });
  });

  it("mantém Continuar desabilitado sem valor", async () => {
    const user = userEvent.setup();
    render(<LaunchWizard />);
    expect(screen.getByRole("button", { name: "Continuar" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Voltar" }));
    expect(screen.getByRole("button", { name: "Voltar" })).toBeDisabled();
  });

  it("permite peso personalizado no relatório e persiste a fração resolvida a partir do valor em reais", async () => {
    const user = userEvent.setup();
    render(<LaunchWizard />);

    // Passo 1 — valor (R$ 1.500,00 = 150000 centavos)
    await user.type(screen.getByRole("textbox", { name: "Valor do lançamento" }), "150000");
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    // Passo 2 — categoria
    await user.click(screen.getByRole("button", { name: /alimentação/i }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    // Passo 3 — escolhe "Personalizado (definir valor em R$)…" e digita 56250 (R$ 562,50 = 37,5% de R$ 1.500,00)
    await user.click(screen.getByRole("combobox", { name: "Peso no relatório" }));
    await user.click(screen.getByRole("option", { name: /personalizado/i }));
    const customInput = screen.getByRole("textbox", { name: "Valor considerado no relatório" });
    await user.clear(customInput);
    await user.type(customInput, "56250");
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    // Passo 4 — revisão confirma o peso resolvido (37,5%) e valor
    expect(screen.getByText(/37,5% no relatório/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirmar lançamento" }));

    expect(createExpenseMock).toHaveBeenCalledTimes(1);
    expect(createExpenseMock.mock.calls[0]?.[0].reportWeight).toBe(0.375);
  });
});
