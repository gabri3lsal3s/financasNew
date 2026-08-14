import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DatePicker } from "./date-picker";

describe("DatePicker", () => {
  it("exibe o placeholder quando não há valor", () => {
    render(<DatePicker value="" onValueChange={vi.fn()} placeholder="Data do lançamento" />);
    expect(screen.getByRole("button", { name: "Data do lançamento" })).toBeInTheDocument();
  });

  it("abre o calendário e notifica a seleção de um dia", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<DatePicker value="" onValueChange={onValueChange} />);

    await user.click(screen.getByRole("button", { name: "Selecione a data" }));

    // MonthGrid renderiza um role="grid"; os dias são gridcells com um botão.
    const calendar = await screen.findByRole("grid");
    const day15 = within(calendar).getAllByRole("gridcell").find((cell) => cell.textContent?.trim() === "15");
    if (!day15) throw new Error("Dia 15 não encontrado no calendário");

    await user.click(within(day15).getByRole("button"));

    expect(onValueChange).toHaveBeenCalledTimes(1);
    const call = onValueChange.mock.calls[0];
    if (!call) throw new Error("onValueChange não foi chamado");
    expect(call[0]).toMatch(/^\d{4}-\d{2}-15$/);
  });

  it("limpa o valor ao clicar no botão de limpar", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<DatePicker value="2026-08-15" onValueChange={onValueChange} />);

    await user.click(screen.getByRole("button", { name: "Limpar data" }));
    expect(onValueChange).toHaveBeenCalledWith("");
  });
});
