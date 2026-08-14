import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Home, Utensils } from "lucide-react";
import { IconPicker } from "./icon-picker";
import type { IconPickerOption } from "./icon-picker";

const OPTIONS: IconPickerOption[] = [
  { value: "moradia", label: "moradia", icon: Home },
  { value: "alimentacao", label: "alimentacao", icon: Utensils },
];

describe("IconPicker — grade de ícones lucide (DESIGN_SYSTEM §13)", () => {
  it("mostra placeholder sem valor e o label do ícone selecionado", () => {
    const { rerender } = render(
      <IconPicker value="" onValueChange={() => undefined} options={OPTIONS} ariaLabel="Ícone da categoria" />,
    );
    expect(screen.getByRole("button", { name: "Ícone da categoria" })).toHaveTextContent("Escolha um ícone");

    rerender(
      <IconPicker value="moradia" onValueChange={() => undefined} options={OPTIONS} ariaLabel="Ícone da categoria" />,
    );
    expect(screen.getByRole("button", { name: "Ícone da categoria" })).toHaveTextContent("moradia");
  });

  it("aplica o ícone ao clicar na grade", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<IconPicker value="" onValueChange={onChange} options={OPTIONS} ariaLabel="Ícone" />);

    await user.click(screen.getByRole("button", { name: "Ícone" }));
    await user.click(screen.getByRole("radio", { name: "alimentacao" }));

    expect(onChange).toHaveBeenCalledWith("alimentacao");
  });

  it("marca o ícone selecionado como checado", async () => {
    const user = userEvent.setup();
    render(<IconPicker value="moradia" onValueChange={() => undefined} options={OPTIONS} ariaLabel="Ícone" />);

    await user.click(screen.getByRole("button", { name: "Ícone" }));
    expect(screen.getByRole("radio", { name: "moradia" })).toHaveAttribute("aria-checked", "true");
  });

  it("filtra a grade pela busca", async () => {
    const user = userEvent.setup();
    render(<IconPicker value="" onValueChange={() => undefined} options={OPTIONS} ariaLabel="Ícone" />);

    await user.click(screen.getByRole("button", { name: "Ícone" }));
    expect(screen.getByRole("radio", { name: "moradia" })).toBeInTheDocument();

    const search = screen.getByLabelText("Buscar ícone");
    await user.type(search, "aliment");

    expect(screen.getByRole("radio", { name: "alimentacao" })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "moradia" })).not.toBeInTheDocument();
  });

  it("mostra estado vazio quando a busca não encontra nada", async () => {
    const user = userEvent.setup();
    render(<IconPicker value="" onValueChange={() => undefined} options={OPTIONS} ariaLabel="Ícone" />);

    await user.click(screen.getByRole("button", { name: "Ícone" }));
    const search = screen.getByLabelText("Buscar ícone");
    await user.type(search, "zzz");

    expect(screen.getByText("Nenhum ícone encontrado.")).toBeInTheDocument();
  });
});
