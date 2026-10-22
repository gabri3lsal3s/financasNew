import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Category } from "@/types";
import { defaultLaunchState } from "./wizard-state";
import { StepQuick } from "./step-quick";

const mockMemory = {
  name_padaria_do_ze: {
    friendlyName: "Padaria do Zé",
    categorySlug: "alimentacao",
    rawAliases: ["padaria ze"],
    usageCount: 3,
    lastUsedAt: "2026-10-21T18:00:00.000Z",
  },
};

vi.mock("@/services/merchant-learning", () => ({
  useMerchantLearning: () => ({
    memory: mockMemory,
    recordLearning: vi.fn(),
    forgetLearning: vi.fn(),
    resolve: vi.fn(),
    isSyncing: false,
  }),
}));

const mockCategories: Category[] = [
  { id: "cat-1", name: "Alimentação", icon: "alimentacao", color: "#EF4444", user_id: "u1", is_reserved: false, is_active: true, type: "expense" },
  { id: "cat-2", name: "Mercado", icon: "mercado", color: "#F59E0B", user_id: "u1", is_reserved: false, is_active: true, type: "expense" },
  { id: "cat-3", name: "Transporte", icon: "transporte", color: "#3B82F6", user_id: "u1", is_reserved: false, is_active: true, type: "expense" },
  { id: "cat-4", name: "Saúde", icon: "saude", color: "#10B981", user_id: "u1", is_reserved: false, is_active: true, type: "expense" },
];

const mockCards = [
  { id: "card-1", name: "Nubank Ultravioleta" },
  { id: "card-2", name: "Itaú Personnalité" },
];

describe("StepQuick (Lançamento Rápido em Tela Única)", () => {
  const defaultProps = {
    state: defaultLaunchState("expense", { valueCents: 5000, categoryId: "cat-1", paymentMethod: "pix" }),
    onTypeChange: vi.fn(),
    onValueChange: vi.fn(),
    onCategoryChange: vi.fn(),
    onPaymentMethodChange: vi.fn(),
    onCardChange: vi.fn(),
    onReceiveTypeChange: vi.fn(),
    onDescriptionChange: vi.fn(),
    onSwitchToGuided: vi.fn(),
    categories: mockCategories,
    cards: mockCards,
    onSubmit: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza todos os blocos fundamentais do modo rápido", () => {
    render(<StepQuick {...defaultProps} />);

    // Abas de tipo
    expect(screen.getByRole("tab", { name: "Despesa" })).toBeDefined();
    expect(screen.getByRole("tab", { name: "Renda" })).toBeDefined();

    // Campo de valor
    expect(screen.getByLabelText("Valor do lançamento")).toBeDefined();

    // Campo de descrição
    expect(screen.getByPlaceholderText(/Ex: Padaria do Zé/i)).toBeDefined();

    // Grade de categorias
    expect(screen.getByRole("button", { name: /Alimentação/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /Mercado/i })).toBeDefined();

    // Formas de pagamento
    expect(screen.getByRole("button", { name: "Pix" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Cartão de Crédito" })).toBeDefined();

    // Botão de alternância para o modo guiado
    expect(screen.getByRole("button", { name: /Mais opções/i })).toBeDefined();
  });

  it("permite selecionar categoria com um único toque", () => {
    render(<StepQuick {...defaultProps} />);

    const mercadoBtn = screen.getByRole("button", { name: /Mercado/i });
    fireEvent.click(mercadoBtn);

    expect(defaultProps.onCategoryChange).toHaveBeenCalledWith("cat-2");
  });

  it("permite alterar a forma de pagamento e exibe seletor de cartão no crédito", () => {
    const { rerender } = render(<StepQuick {...defaultProps} />);

    // Clica em Cartão de Crédito
    const creditBtn = screen.getByRole("button", { name: "Cartão de Crédito" });
    fireEvent.click(creditBtn);

    expect(defaultProps.onPaymentMethodChange).toHaveBeenCalledWith("credit_card");

    // Re-renderiza com credit_card selecionado
    rerender(
      <StepQuick
        {...defaultProps}
        state={{ ...defaultProps.state, paymentMethod: "credit_card" }}
      />,
    );

    expect(screen.getByText("Selecione o cartão")).toBeDefined();
  });

  it("apresenta sugestões inteligentes ao digitar na descrição e auto-seleciona categoria", async () => {
    const user = userEvent.setup();
    render(<StepQuick {...defaultProps} state={{ ...defaultProps.state, description: "ze" }} />);

    const input = screen.getByPlaceholderText(/Ex: Padaria do Zé/i);
    await user.click(input);

    // Sugestão aprendida pelo MerchantLearningEngine
    const suggestion = await screen.findByRole("button", { name: /Padaria do Zé/i });
    expect(suggestion).toBeDefined();

    await user.click(suggestion);

    expect(defaultProps.onDescriptionChange).toHaveBeenCalledWith("Padaria do Zé");
    // "alimentacao" mapeia para cat-1
    expect(defaultProps.onCategoryChange).toHaveBeenCalledWith("cat-1");
  });

  it("sugere marcas do catálogo canônico quando não estão na memória do usuário", async () => {
    const user = userEvent.setup();
    render(<StepQuick {...defaultProps} state={{ ...defaultProps.state, description: "mcdon" }} />);

    const input = screen.getByPlaceholderText(/Ex: Padaria do Zé/i);
    await user.click(input);

    const suggestion = await screen.findByRole("button", { name: /McDonald's/i });
    expect(suggestion).toBeDefined();

    await user.click(suggestion);
    expect(defaultProps.onDescriptionChange).toHaveBeenCalledWith("McDonald's");
    expect(defaultProps.onCategoryChange).toHaveBeenCalledWith("cat-1");
  });

  it("aciona callback para alternar para o modo guiado ao clicar em Mais opções", () => {
    render(<StepQuick {...defaultProps} />);

    const moreBtn = screen.getByRole("button", { name: /Mais opções/i });
    fireEvent.click(moreBtn);

    expect(defaultProps.onSwitchToGuided).toHaveBeenCalledTimes(1);
  });

  it("submete no Enter caso o valor seja maior que zero", () => {
    render(<StepQuick {...defaultProps} state={{ ...defaultProps.state, valueCents: 1500 }} />);

    const valueInput = screen.getByLabelText("Valor do lançamento");
    fireEvent.keyDown(valueInput, { key: "Enter" });

    expect(defaultProps.onSubmit).toHaveBeenCalledTimes(1);
  });
});
