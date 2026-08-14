import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MonthPicker } from "./month-picker";

describe("MonthPicker", () => {
  it("exibe o mês formatado em pt-BR", () => {
    render(<MonthPicker value="2026-08" onValueChange={vi.fn()} />);
    expect(screen.getByText(/agosto de 2026/i)).toBeInTheDocument();
  });

  it("navega para o mês anterior e seguinte", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<MonthPicker value="2026-08" onValueChange={onValueChange} />);

    await user.click(screen.getByRole("button", { name: "Mês anterior" }));
    expect(onValueChange).toHaveBeenCalledWith("2026-07");

    await user.click(screen.getByRole("button", { name: "Próximo mês" }));
    expect(onValueChange).toHaveBeenLastCalledWith("2026-09");
  });

  it("cruza o ano na navegação", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<MonthPicker value="2026-01" onValueChange={onValueChange} />);

    await user.click(screen.getByRole("button", { name: "Mês anterior" }));
    expect(onValueChange).toHaveBeenCalledWith("2025-12");
  });
});
