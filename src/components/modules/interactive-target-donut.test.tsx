import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InteractiveTargetDonut, type TargetDonutItem } from "./interactive-target-donut";

describe("InteractiveTargetDonut", () => {
  const sampleItems: TargetDonutItem[] = [
    { key: "Ações", label: "Ações", targetPercent: 50 },
    { key: "FIIs", label: "FIIs", targetPercent: 30 },
    { key: "Renda Fixa", label: "Renda Fixa", targetPercent: 10 },
  ];

  it("renderiza os itens com seus respectivos percentuais e status de alocação", () => {
    render(<InteractiveTargetDonut items={sampleItems} title="Metas por Classe" />);

    expect(screen.getByText("Metas por Classe")).toBeInTheDocument();
    expect(screen.getByText("Ações")).toBeInTheDocument();
    expect(screen.getByText("FIIs")).toBeInTheDocument();
    expect(screen.getByText("Renda Fixa")).toBeInTheDocument();

    // Total alocado: 90.0% e 10.0% livre
    expect(screen.getByText("90.0")).toBeInTheDocument();
    expect(screen.getByText("10.0% livre")).toBeInTheDocument();
  });

  it("permite selecionar uma fatia e exibe controles contextuais de ajuste", () => {
    const handleSelectKey = vi.fn();
    const handleChangeTarget = vi.fn();

    render(
      <InteractiveTargetDonut
        items={sampleItems}
        selectedKey="Ações"
        onSelectKey={handleSelectKey}
        onChangeTarget={handleChangeTarget}
      />,
    );

    // Deve exibir o painel de ajuste rápido para a classe selecionada
    expect(screen.getByText(/Ajuste rápido:/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Aumentar 5% de Ações/i })).toBeInTheDocument();

    // Clicar no botão de incremento +5%
    fireEvent.click(screen.getByRole("button", { name: /Aumentar 5% de Ações/i }));
    expect(handleChangeTarget).toHaveBeenCalledWith("Ações", 55);

    // Clicar no botão de decremento -1%
    fireEvent.click(screen.getByRole("button", { name: /Diminuir 1% de Ações/i }));
    expect(handleChangeTarget).toHaveBeenCalledWith("Ações", 49);
  });

  it("aciona onSelectKey ao clicar em uma fatia ou tag de item", () => {
    const handleSelectKey = vi.fn();

    render(
      <InteractiveTargetDonut
        items={sampleItems}
        selectedKey={null}
        onSelectKey={handleSelectKey}
      />,
    );

    const fiiSlice = screen.getByRole("button", { name: /FIIs: 30.0%/i });
    fireEvent.click(fiiSlice);
    expect(handleSelectKey).toHaveBeenCalledWith("FIIs");
  });

  it("exibe aviso de excesso quando a soma ultrapassa 100%", () => {
    const overflowItems: TargetDonutItem[] = [
      { key: "Ações", label: "Ações", targetPercent: 70 },
      { key: "FIIs", label: "FIIs", targetPercent: 40 },
    ];

    render(<InteractiveTargetDonut items={overflowItems} />);

    expect(screen.getByText("110.0")).toBeInTheDocument();
    expect(screen.getByText("+10.0%")).toBeInTheDocument();
  });
});
