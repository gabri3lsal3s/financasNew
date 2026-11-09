import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Category } from "@/types";
import type { PredictionEntry } from "@/domain/predictions";
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

  it("exibe seletor de parcelas e aciona onInstallmentsChange ao alterar", () => {
    const onInstallmentsChange = vi.fn();
    render(
      <StepQuick
        {...defaultProps}
        state={{ ...defaultProps.state, paymentMethod: "credit_card", installments: 1, valueCents: 30000 }}
        onInstallmentsChange={onInstallmentsChange}
      />,
    );

    expect(screen.getByText("Parcelas")).toBeDefined();
    expect(screen.getByRole("combobox", { name: "Número de parcelas" })).toBeDefined();
  });

  it("destaca a seção de categoria quando isCategoryUnconfirmed for verdadeiro", () => {
    render(
      <StepQuick
        {...defaultProps}
        isCategoryUnconfirmed={true}
      />,
    );

    expect(screen.getByText("Confirmar categoria")).toBeDefined();
  });

  it("renderiza o seletor de despesa familiar e dispara onFamilyChange ao clicar", async () => {
    const onFamilyChange = vi.fn();
    const user = userEvent.setup();

    render(
      <StepQuick
        {...defaultProps}
        isFamilyModeEnabled={true}
        onFamilyChange={onFamilyChange}
      />,
    );

    const familyRadio = screen.getByRole("radio", { name: "Despesa da Casa / Familiar" });
    expect(familyRadio).toBeDefined();
    expect(familyRadio).toHaveAttribute("aria-checked", "false");

    await user.click(familyRadio);
    expect(onFamilyChange).toHaveBeenCalledWith(true);
  });

  it("submete no Enter caso o valor seja maior que zero", () => {
    render(<StepQuick {...defaultProps} state={{ ...defaultProps.state, valueCents: 1500 }} />);

    const valueInput = screen.getByLabelText("Valor do lançamento");
    fireEvent.keyDown(valueInput, { key: "Enter" });

    expect(defaultProps.onSubmit).toHaveBeenCalledTimes(1);
  });

  it("pagina categorias quando há mais de 8 itens e permite navegar", async () => {
    const user = userEvent.setup();
    const letters = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];
    const manyCategories: Category[] = letters.map((letter, i) => ({
      id: `cat-${i + 1}`,
      name: `Categoria ${letter}`,
      icon: "tag",
      color: "#3B82F6",
      user_id: "u1",
      is_reserved: false,
      is_active: true,
      type: "expense",
    }));

    render(<StepQuick {...defaultProps} categories={manyCategories} />);

    // Na página 1, deve exibir Categoria A a H
    expect(screen.getByRole("button", { name: /Categoria A$/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /Categoria H$/i })).toBeDefined();
    expect(screen.queryByRole("button", { name: /Categoria I$/i })).toBeNull();

    // Contador de páginas
    expect(screen.getByText("1 de 2")).toBeDefined();

    // Navega para página 2
    const nextBtn = screen.getByRole("button", { name: "Próxima página de categorias" });
    await user.click(nextBtn);

    // Na página 2, deve exibir Categoria I a L
    expect(screen.getByRole("button", { name: /Categoria I$/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /Categoria L$/i })).toBeDefined();
    expect(screen.queryByRole("button", { name: /Categoria A$/i })).toBeNull();
    expect(screen.getByText("2 de 2")).toBeDefined();

    // Volta para página 1
    const prevBtn = screen.getByRole("button", { name: "Página anterior de categorias" });
    await user.click(prevBtn);
    expect(screen.getByRole("button", { name: /Categoria A$/i })).toBeDefined();
    expect(screen.getByText("1 de 2")).toBeDefined();
  });

  it("ordena categorias por frequência histórica de predição", () => {
    const categories: Category[] = [
      { id: "cat-unused", name: "Sem Uso", icon: "tag", color: "#3B82F6", user_id: "u1", is_reserved: false, is_active: true, type: "expense" },
      { id: "cat-rare", name: "Uso Raro", icon: "tag", color: "#3B82F6", user_id: "u1", is_reserved: false, is_active: true, type: "expense" },
      { id: "cat-frequent", name: "Muito Frequente", icon: "tag", color: "#3B82F6", user_id: "u1", is_reserved: false, is_active: true, type: "expense" },
    ];

    const predictions: PredictionEntry[] = [
      {
        id: "p1",
        kind: "expense",
        description: "Almoço",
        categoryId: "cat-frequent",
        categoryName: "Muito Frequente",
        paymentMethod: "pix",
        cardId: null,
        receiveType: null,
        value: 50,
        date: "2026-10-01",
      },
      {
        id: "p2",
        kind: "expense",
        description: "Jantar",
        categoryId: "cat-frequent",
        categoryName: "Muito Frequente",
        paymentMethod: "pix",
        cardId: null,
        receiveType: null,
        value: 50,
        date: "2026-10-02",
      },
      {
        id: "p3",
        kind: "expense",
        description: "Cinema",
        categoryId: "cat-rare",
        categoryName: "Uso Raro",
        paymentMethod: "pix",
        cardId: null,
        receiveType: null,
        value: 30,
        date: "2026-10-03",
      },
    ];

    render(<StepQuick {...defaultProps} categories={categories} predictionEntries={predictions} />);

    const buttons = screen.getAllByRole("button").filter((b) => b.getAttribute("aria-pressed") !== null);
    expect(buttons[0]?.textContent).toContain("Muito Frequente");
    expect(buttons[1]?.textContent).toContain("Uso Raro");
    expect(buttons[2]?.textContent).toContain("Sem Uso");
  });

  it("auto-posiciona na página correta quando state.categoryId está em página posterior", () => {
    const letters = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];
    const manyCategories: Category[] = letters.map((letter, i) => ({
      id: `cat-${i + 1}`,
      name: `Categoria ${letter}`,
      icon: "tag",
      color: "#3B82F6",
      user_id: "u1",
      is_reserved: false,
      is_active: true,
      type: "expense",
    }));

    // Categoria J (cat-10) está na página 2
    render(
      <StepQuick
        {...defaultProps}
        categories={manyCategories}
        state={{ ...defaultProps.state, categoryId: "cat-10" }}
      />,
    );

    expect(screen.getByText("2 de 2")).toBeDefined();
    expect(screen.getByRole("button", { name: /Categoria J$/i })).toBeDefined();
  });
});
