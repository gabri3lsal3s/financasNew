import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SegmentedControl } from "./segmented-control";

describe("SegmentedControl", () => {
  const options = [
    { value: "class", label: "Por Classe" },
    { value: "sector", label: "Por Setor" },
    { value: "asset", label: "Por Ativo", disabled: true },
  ] as const;

  it("renderiza todas as opções com acessibilidade e estados corretos", () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        value="class"
        onChange={onChange}
        options={options}
        ariaLabel="Modo de exibição"
      />,
    );

    expect(screen.getByRole("group", { name: "Modo de exibição" })).toBeInTheDocument();

    const classBtn = screen.getByRole("button", { name: "Por Classe" });
    const sectorBtn = screen.getByRole("button", { name: "Por Setor" });
    const assetBtn = screen.getByRole("button", { name: "Por Ativo" });

    expect(classBtn).toHaveAttribute("aria-pressed", "true");
    expect(classBtn).toHaveClass("text-primary-strong");
    expect(classBtn).not.toHaveClass("text-primary-foreground");
    expect(sectorBtn).toHaveAttribute("aria-pressed", "false");
    expect(assetBtn).toBeDisabled();
  });

  it("dispara onChange ao clicar em uma opção diferente", () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        value="class"
        onChange={onChange}
        options={options}
        ariaLabel="Modo de exibição"
      />,
    );

    const sectorBtn = screen.getByRole("button", { name: "Por Setor" });
    fireEvent.click(sectorBtn);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("sector");
  });

  it("não dispara onChange ao clicar na opção já selecionada ou desabilitada", () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        value="class"
        onChange={onChange}
        options={options}
        ariaLabel="Modo de exibição"
      />,
    );

    const classBtn = screen.getByRole("button", { name: "Por Classe" });
    fireEvent.click(classBtn);
    expect(onChange).not.toHaveBeenCalled();

    const assetBtn = screen.getByRole("button", { name: "Por Ativo" });
    fireEvent.click(assetBtn);
    expect(onChange).not.toHaveBeenCalled();
  });
});
