import { render, screen, fireEvent } from "@testing-library/react";
import { axe } from "vitest-axe";
import { describe, expect, it, vi } from "vitest";
import { CategoryDonut } from "./category-donut";

describe("CategoryDonut (F8)", () => {
  it("renderiza o anel com fatias arredondadas e a legenda com percentual e valor", () => {
    const { container } = render(
      <CategoryDonut
        slices={[
          { label: "Moradia", valueCents: 50000 },
          { label: "Alimentação", valueCents: 30000 },
        ]}
      />,
    );

    const arcs = container.querySelectorAll("circle[stroke-dasharray]");
    expect(arcs).toHaveLength(2);
    expect(arcs[0]).toHaveAttribute("stroke-linecap", "round");
    expect(screen.getByText("Moradia")).toBeInTheDocument();
    expect(screen.getByText("Alimentação")).toBeInTheDocument();
    // 50.000 / 80.000 = 63% · 30.000 / 80.000 = 38%
    expect(screen.getByText("63%")).toBeInTheDocument();
    expect(screen.getByText("38%")).toBeInTheDocument();
    expect(screen.getByText("R$ 500,00")).toBeInTheDocument();
    // Centro com o total.
    expect(screen.getByText("R$ 800,00")).toBeInTheDocument();
  });

  it("empty state sem fatias ou total zero", () => {
    render(<CategoryDonut slices={[]} />);
    expect(screen.getByText("Sem despesas")).toBeInTheDocument();

    render(<CategoryDonut slices={[{ label: "X", valueCents: 0 }]} />);
    expect(screen.getAllByText("Sem despesas").length).toBeGreaterThan(0);
  });

  it("alterna o valor central ao selecionar uma fatia e reseta ao clicar novamente", () => {
    const handleSelectKey = vi.fn();
    render(
      <CategoryDonut
        slices={[
          { key: "cat-1", label: "Moradia", valueCents: 50000 },
          { key: "cat-2", label: "Alimentação", valueCents: 30000 },
        ]}
        onSelectKey={handleSelectKey}
      />,
    );

    // Inicialmente exibe o Total
    expect(screen.getByText("Total")).toBeInTheDocument();
    expect(screen.getByText("R$ 800,00")).toBeInTheDocument();

    // Clica na fatia ou legenda de Moradia
    const moradiaItem = screen.getByRole("button", { name: /Selecionar Moradia/i });
    fireEvent.click(moradiaItem);

    // Agora o centro exibe o valor da categoria selecionada
    expect(screen.getAllByText("63%").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("do total")).toBeInTheDocument();
    expect(handleSelectKey).toHaveBeenCalledWith("cat-1");

    // Clica no centro interativo para resetar
    const centerBtn = screen.getByRole("button", { name: /Moradia: 62.5%/i });
    fireEvent.click(centerBtn);

    // Volta ao total
    expect(screen.getByText("Total")).toBeInTheDocument();
    expect(screen.getByText("R$ 800,00")).toBeInTheDocument();
  });

  it("renderiza cores customizadas e ícones quando fornecidos", () => {
    const { container } = render(
      <CategoryDonut
        slices={[
          { label: "Moradia", valueCents: 50000, color: "#e11d48", icon: "moradia" },
          { label: "Alimentação", valueCents: 30000, color: "#10b981", icon: "mercado" },
        ]}
      />,
    );

    const arcs = container.querySelectorAll<SVGCircleElement>("circle[stroke-dasharray]");
    expect(arcs[0]?.style.stroke).toMatch(/(#e11d48|rgb\(225,\s*29,\s*72\))/);
    expect(arcs[1]?.style.stroke).toMatch(/(#10b981|rgb\(16,\s*185,\s*129\))/);
    expect(screen.getByText("Moradia")).toBeInTheDocument();
    expect(screen.getByText("Alimentação")).toBeInTheDocument();
  });

  it("não renderiza arcos para fatias com valor zero e trata fatias pequenas sem sobreposição", () => {
    const { container } = render(
      <CategoryDonut
        slices={[
          { label: "Ações", valueCents: 100000 },
          { label: "FIIs", valueCents: 50000 },
          { label: "Cripto", valueCents: 500 }, // ~0.3%
          { label: "Outros", valueCents: 0 }, // 0
        ]}
      />,
    );

    const arcs = container.querySelectorAll<SVGCircleElement>("circle[stroke-dasharray]");
    // Apenas 3 arcos (o de valor 0 não deve gerar elemento circle visível)
    expect(arcs).toHaveLength(3);

    // Todas as fatias ativas possuem tamanho mínimo garantido e usam round sem colisão
    expect(arcs[0]).toHaveAttribute("stroke-linecap", "round");
    expect(arcs[1]).toHaveAttribute("stroke-linecap", "round");
    expect(arcs[2]).toHaveAttribute("stroke-linecap", "round");
  });

  it("agrupa cauda longa em 'Outros' no anel SVG quando há muitos itens (ex: 27 ativos), mantendo lista completa", () => {
    const manySlices = Array.from({ length: 27 }, (_, i) => ({
      key: `asset-${i + 1}`,
      label: `Ativo ${i + 1}`,
      valueCents: (27 - i) * 1000,
    }));

    const { container } = render(<CategoryDonut slices={manySlices} maxVisualSlices={7} />);

    // No anel SVG, apenas 7 arcos (Top 6 + 1 Outros)
    const arcs = container.querySelectorAll<SVGCircleElement>("circle[stroke-dasharray]");
    expect(arcs).toHaveLength(7);

    // Na lista abaixo, todos os 27 itens são renderizados para o usuário poder consultar qualquer um
    expect(screen.getByText("Ativo 1")).toBeInTheDocument();
    expect(screen.getByText("Ativo 27")).toBeInTheDocument();

    // Ao clicar em um item da cauda longa (ex: Ativo 20), o centro exibe o valor do Ativo 20
    const itemBtn = screen.getByRole("button", { name: /Selecionar Ativo 20/i });
    fireEvent.click(itemBtn);

    expect(screen.getAllByText("Ativo 20")).toHaveLength(2);
    expect(screen.getByRole("button", { name: /Ativo 20: 2\.1%/i })).toBeInTheDocument();
  });

  it("sem violações de acessibilidade (axe)", async () => {
    const { container } = render(
      <CategoryDonut
        slices={[
          { label: "Moradia", valueCents: 50000 },
          { label: "Alimentação", valueCents: 30000 },
        ]}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});



