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
  useCreateIncomeInstallments: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateRecurrence: () => ({ mutateAsync: vi.fn(), isPending: false }),
  usePredictionHistory: () => ({ entries: predictionHistoryMock(), isLoading: false, error: null, refetch: vi.fn() }),
}));

const predictionHistoryMock = vi.fn(() => [] as unknown[]);

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

  it("expõe o botão da calculadora no header (mesmo padrão dos modais)", () => {
    render(<LaunchWizard />);
    const calculator = screen.getByRole("button", { name: "Abrir calculadora" });
    expect(calculator).toHaveAttribute("title", "Calculadora");
    // O wizard fica fora do PageShell: o atalho próprio garante acesso à calculadora.
    expect(screen.getByRole("button", { name: "Fechar" })).toBeInTheDocument();
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

  it("fecha sem confirmação quando o formulário está vazio", async () => {
    const user = userEvent.setup();
    render(<LaunchWizard />);
    await user.click(screen.getByRole("button", { name: "Fechar" }));
    expect(navigateMock).toHaveBeenCalledWith("/transacoes");
  });

  it("pede confirmação ao fechar com dados preenchidos (anti-perda)", async () => {
    const user = userEvent.setup();
    render(<LaunchWizard />);

    await user.type(screen.getByRole("textbox", { name: "Valor do lançamento" }), "5000");
    await user.click(screen.getByRole("button", { name: "Fechar" }));

    // Confirmação aparece — navegação NÃO acontece até confirmar.
    expect(screen.getByText("Descartar lançamento?")).toBeInTheDocument();
    expect(navigateMock).not.toHaveBeenCalled();

    // Cancelar mantém no fluxo com os dados.
    await user.click(screen.getByRole("button", { name: "Continuar preenchendo" }));
    expect(navigateMock).not.toHaveBeenCalled();
    const valueInput = screen.getByRole("textbox", { name: "Valor do lançamento" }) as HTMLInputElement;
    expect(valueInput.value.replace(/\u00a0/g, " ")).toBe("R$ 50,00");

    // Fechar de novo e descartar navega.
    await user.click(screen.getByRole("button", { name: "Fechar" }));
    await user.click(screen.getByRole("button", { name: "Descartar" }));
    expect(navigateMock).toHaveBeenCalledWith("/transacoes");
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

  it("sugestão de descrição na etapa de detalhes preenche SÓ a descrição (hotfix)", async () => {
    predictionHistoryMock.mockReturnValue([
      {
        id: "h1",
        kind: "expense",
        description: "Supermercado Pão de Açúcar",
        categoryId: "c1",
        categoryName: "Alimentação",
        paymentMethod: "pix",
        cardId: null,
        receiveType: null,
        value: 200,
        date: "2026-08-01",
      },
    ]);
    const user = userEvent.setup();
    render(<LaunchWizard />);

    // Passo 1 — valor R$ 100,00 (10000 centavos) — NÃO pode ser sobrescrito.
    await user.type(screen.getByRole("textbox", { name: "Valor do lançamento" }), "10000");
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    // Passo 2 — seleciona a categoria "Alimentação"
    await user.click(screen.getByRole("button", { name: /alimentação/i }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    // Passo 3 — digita parte da descrição → chip de sugestão aparece
    const descriptionInput = screen.getByPlaceholderText(/Supermercado do mês/);
    await user.type(descriptionInput, "mercado");
    const chip = await screen.findByRole("option", { name: /Supermercado Pão de Açúcar/ });
    await user.click(chip);

    // O clique preenche APENAS a descrição (valor/data/forma preservados).
    expect(descriptionInput).toHaveValue("Supermercado Pão de Açúcar");

    // Passo 4 — confirma: valor original mantido (R$ 100,00) e descrição da sugestão.
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByRole("button", { name: "Confirmar lançamento" }));

    expect(createExpenseMock).toHaveBeenCalledTimes(1);
    const params = createExpenseMock.mock.calls[0]?.[0];
    // A sugestão histórica tinha valor 200 — o valor da Etapa 1 (100) prevalece.
    expect(params.value).toBe(100);
    expect(params.description).toBe("Supermercado Pão de Açúcar");
  });

  it("exibe lançamentos habituais no passo 1 e preenche em 1 toque (F21)", async () => {
    predictionHistoryMock.mockReturnValue([
      {
        id: "h1",
        kind: "expense",
        description: "Aluguel",
        categoryId: "c1",
        categoryName: "Alimentação",
        paymentMethod: "pix",
        cardId: null,
        receiveType: null,
        value: 1500,
        date: "2026-07-01",
      },
      {
        id: "h2",
        kind: "expense",
        description: "Aluguel",
        categoryId: "c1",
        categoryName: "Alimentação",
        paymentMethod: "pix",
        cardId: null,
        receiveType: null,
        value: 1500,
        date: "2026-06-01",
      },
    ]);
    const user = userEvent.setup();
    render(<LaunchWizard />);

    // Passo 1 — bloco de habituais com o lançamento mais frequente.
    const habit = await screen.findByRole("button", { name: /Aluguel/ });
    await user.click(habit);

    // Valor preenchido (1500 > 0) → Continuar habilitado prova a aplicação.
    const continuar = screen.getByRole("button", { name: "Continuar" });
    expect(continuar).toBeEnabled();
    await user.click(continuar);
    // Categoria já selecionada pela aplicação do habitual.
    expect(screen.getByRole("button", { name: "Continuar" })).toBeEnabled();
  });

  it("permite criar cobrança a pagar vinculada e envia debtType payable", async () => {
    const user = userEvent.setup();
    render(<LaunchWizard />);

    // Passo 1 — valor
    await user.type(screen.getByRole("textbox", { name: "Valor do lançamento" }), "20000");
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    // Passo 2 — categoria
    await user.click(screen.getByRole("button", { name: /alimentação/i }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    // Passo 3 — ativa cobrança vinculada (default: payable)
    const debtCheckbox = screen.getByRole("checkbox", { name: "Criar cobrança vinculada" });
    await user.click(debtCheckbox);

    // Digita o valor da cobrança
    const debtAmountInput = screen.getByRole("textbox", { name: "Valor da cobrança vinculada" });
    await user.type(debtAmountInput, "10000");
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    // Passo 4 — revisão exibe cobrança a pagar
    expect(screen.getByText("(A pagar)")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirmar lançamento" }));

    expect(createExpenseMock).toHaveBeenCalledTimes(1);
    const params = createExpenseMock.mock.calls[0]?.[0];
    expect(params.value).toBe(200);
    expect(params.debtAmount).toBe(100);
    expect(params.debtType).toBe("payable");
    expect(navigateMock).toHaveBeenCalledWith("/transacoes", { replace: true });
  });

  it("permite criar cobrança a receber vinculada e envia debtType receivable", async () => {
    const user = userEvent.setup();
    render(<LaunchWizard />);

    // Passo 1 — valor
    await user.type(screen.getByRole("textbox", { name: "Valor do lançamento" }), "30000");
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    // Passo 2 — categoria
    await user.click(screen.getByRole("button", { name: /alimentação/i }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    // Passo 3 — ativa cobrança vinculada e seleciona "A receber"
    const debtCheckbox = screen.getByRole("checkbox", { name: "Criar cobrança vinculada" });
    await user.click(debtCheckbox);

    const receivableRadio = screen.getByRole("radio", { name: /A receber/i });
    await user.click(receivableRadio);

    // Digita o valor da cobrança
    const debtAmountInput = screen.getByRole("textbox", { name: "Valor da cobrança vinculada" });
    await user.type(debtAmountInput, "15000");
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    // Passo 4 — revisão exibe cobrança a receber
    expect(screen.getByText("(A receber)")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirmar lançamento" }));

    expect(createExpenseMock).toHaveBeenCalledTimes(1);
    const params = createExpenseMock.mock.calls[0]?.[0];
    expect(params.value).toBe(300);
    expect(params.debtAmount).toBe(150);
    expect(params.debtType).toBe("receivable");
    expect(navigateMock).toHaveBeenCalledWith("/transacoes", { replace: true });
  });
});
