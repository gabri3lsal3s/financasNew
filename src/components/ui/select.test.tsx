import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Select } from "./select";

const options = [
  { value: "alimentacao", label: "Alimentação" },
  { value: "transporte", label: "Transporte" },
  { value: "moradia", label: "Moradia" },
];

describe("Select", () => {
  it("renderiza o placeholder quando não há valor", () => {
    render(<Select value="" onValueChange={vi.fn()} options={options} placeholder="Escolha…" />);
    expect(screen.getByRole("combobox")).toHaveTextContent("Escolha…");
  });

  it("exibe o valor selecionado", () => {
    render(<Select value="transporte" onValueChange={vi.fn()} options={options} />);
    expect(screen.getByRole("combobox")).toHaveTextContent("Transporte");
  });

  it("abre a lista e notifica a seleção", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Select value="" onValueChange={onValueChange} options={options} />);

    await user.click(screen.getByRole("combobox"));
    const option = await screen.findByRole("option", { name: "Alimentação" });
    await user.click(option);

    expect(onValueChange).toHaveBeenCalledWith("alimentacao");
  });
});
