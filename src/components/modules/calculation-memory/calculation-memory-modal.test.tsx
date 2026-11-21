import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import type { CalculationBreakdown } from "@/domain/calculation-memory";
import { CalculationMemoryModal } from "./calculation-memory-modal";

const mockBreakdown: CalculationBreakdown = {
  id: "safe-to-spend-test",
  title: "Saldo em Caixa Real",
  description: "Soma das contas correntes deduzida das faturas em aberto.",
  unit: "currency",
  steps: [
    {
      label: "Contas Líquidas",
      rawValue: 200000,
      formattedValue: "R$ 2.000,00",
      operator: "+",
    },
    {
      label: "Faturas Abertas",
      rawValue: 50000,
      formattedValue: "R$ 500,00",
      operator: "-",
    },
  ],
  result: {
    label: "Saldo Livre Real",
    rawValue: 150000,
    unit: "currency",
    formattedValue: "R$ 1.500,00",
  },
};

// Mock do hook useVisualCustomization
const mockShowCalculationMemory = vi.fn(() => true);
vi.mock("@/hooks/use-visual-customization", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/use-visual-customization")>();
  return {
    ...actual,
    useVisualCustomization: () => ({
      ...actual.getVisualCustomization(),
      showCalculationMemory: mockShowCalculationMemory(),
    }),
  };
});

describe("CalculationMemoryModal", () => {
  it("renderiza o gatilho padrão quando showCalculationMemory é true", () => {
    mockShowCalculationMemory.mockReturnValue(true);

    render(
      <CalculationMemoryModal
        breakdown={mockBreakdown}
        label="Saldo em Caixa Real"
        priority="p0"
      />,
    );

    const button = screen.getByRole("button", {
      name: /memória de cálculo de Saldo em Caixa Real/i,
    });
    expect(button).toBeInTheDocument();
  });

  it("renderiza classe inline-flex para prioridade p0 e hidden md:inline-flex para p1", () => {
    mockShowCalculationMemory.mockReturnValue(true);

    const { rerender, container } = render(
      <CalculationMemoryModal
        breakdown={mockBreakdown}
        label="Saldo em Caixa Real"
        priority="p0"
      />,
    );

    let wrapper = container.querySelector("div.inline-flex");
    expect(wrapper).not.toBeNull();

    rerender(
      <CalculationMemoryModal
        breakdown={mockBreakdown}
        label="Saldo em Caixa Real"
        priority="p1"
      />,
    );

    wrapper = container.querySelector("div.hidden.md\\:inline-flex");
    expect(wrapper).not.toBeNull();
  });

  it("não renderiza nada se showCalculationMemory for false", () => {
    mockShowCalculationMemory.mockReturnValue(false);

    const { container } = render(
      <CalculationMemoryModal
        breakdown={mockBreakdown}
        label="Saldo em Caixa Real"
      />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(
      screen.queryByRole("button", {
        name: /Memória de cálculo: Saldo em Caixa Real/i,
      }),
    ).not.toBeInTheDocument();
  });

  it("não propaga eventos de clique para o elemento pai ao abrir o modal", async () => {
    mockShowCalculationMemory.mockReturnValue(true);
    const user = userEvent.setup();
    const parentClick = vi.fn();

    render(
      <MemoryRouter>
        <div onClick={parentClick} role="presentation">
          <CalculationMemoryModal
            breakdown={mockBreakdown}
            label="Saldo em Caixa Real"
            priority="p0"
          />
        </div>
      </MemoryRouter>,
    );

    const button = screen.getByRole("button", {
      name: /memória de cálculo de Saldo em Caixa Real/i,
    });

    await user.click(button);

    // O modal deve ser aberto e o clique no pai NÃO deve ser disparado
    expect(parentClick).not.toHaveBeenCalled();
    expect(
      screen.getAllByText("Soma das contas correntes deduzida das faturas em aberto.")[0],
    ).toBeInTheDocument();
  });
});
