import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PercentInput } from "./percent-input";

describe("PercentInput", () => {
  it("renderiza o valor inicial formatado com duas casas decimais", () => {
    render(<PercentInput value={8.52} suffix="% a.a." aria-label="Taxa" />);
    const input = screen.getByLabelText("Taxa");
    expect(input).toHaveValue("8,52");
    expect(screen.getByText("% a.a.")).toBeInTheDocument();
  });

  it("permite digitação progressiva alimentando os centésimos da direita para a esquerda", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<PercentInput value={0} onValueChange={onValueChange} aria-label="Taxa" />);
    const input = screen.getByLabelText("Taxa");

    // Digita 8 -> 0,08 (val 0.08)
    await user.type(input, "8");
    expect(onValueChange).toHaveBeenLastCalledWith(0.08);

    // Digita 5 -> 0,85 (val 0.85)
    await user.type(input, "5");
    expect(onValueChange).toHaveBeenLastCalledWith(0.85);

    // Digita 2 -> 8,52 (val 8.52)
    await user.type(input, "2");
    expect(onValueChange).toHaveBeenLastCalledWith(8.52);
  });

  it("suporta recuo de dígitos com backspace", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<PercentInput value={8.52} onValueChange={onValueChange} aria-label="Taxa" />);
    const input = screen.getByLabelText("Taxa");

    await user.type(input, "{backspace}");
    // 852 -> 85 -> 0,85
    expect(onValueChange).toHaveBeenLastCalledWith(0.85);

    await user.type(input, "{backspace}");
    // 85 -> 8 -> 0,08
    expect(onValueChange).toHaveBeenLastCalledWith(0.08);
  });

  it("atualiza display quando prop value muda externamente", () => {
    const { rerender } = render(<PercentInput value={100} aria-label="Taxa" />);
    expect(screen.getByLabelText("Taxa")).toHaveValue("100,00");

    rerender(<PercentInput value={110.5} aria-label="Taxa" />);
    expect(screen.getByLabelText("Taxa")).toHaveValue("110,50");
  });
});
