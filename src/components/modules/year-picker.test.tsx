import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { YearPicker } from "./year-picker";

describe("YearPicker", () => {
  it("exibe o ano formatado", () => {
    render(<YearPicker value={2026} onValueChange={vi.fn()} />);
    expect(screen.getByText("2026")).toBeInTheDocument();
  });

  it("navega para o ano anterior e seguinte", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<YearPicker value={2026} onValueChange={onValueChange} />);

    await user.click(screen.getByRole("button", { name: "Ano anterior" }));
    expect(onValueChange).toHaveBeenCalledWith(2025);

    await user.click(screen.getByRole("button", { name: "Próximo ano" }));
    expect(onValueChange).toHaveBeenLastCalledWith(2027);
  });

  it("respeita desabilitação por minYear e maxYear", () => {
    const { rerender } = render(
      <YearPicker value={2000} onValueChange={vi.fn()} minYear={2000} maxYear={2050} />,
    );
    expect(screen.getByRole("button", { name: "Ano anterior" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Próximo ano" })).toBeEnabled();

    rerender(<YearPicker value={2050} onValueChange={vi.fn()} minYear={2000} maxYear={2050} />);
    expect(screen.getByRole("button", { name: "Ano anterior" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Próximo ano" })).toBeDisabled();
  });

  it("dispara erro ao receber ano inválido", () => {
    expect(() => render(<YearPicker value={1800} onValueChange={vi.fn()} />)).toThrow(
      /ano inválido/i,
    );
  });
});
