import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BRAND_COLOR_PALETTE, ColorPicker, normalizeHexColor } from "./color-picker";

describe("normalizeHexColor — validação/normalização de hex", () => {
  it("normaliza #RGB para #RRGGBB maiúsculo", () => {
    expect(normalizeHexColor("#2a9")).toBe("#22AA99");
  });

  it("aceita #RRGGBB com minúsculas e sem #", () => {
    expect(normalizeHexColor("e76f51")).toBe("#E76F51");
    expect(normalizeHexColor("#DDA726")).toBe("#DDA726");
  });

  it("rejeita valores inválidos", () => {
    expect(normalizeHexColor("#12345")).toBeNull();
    expect(normalizeHexColor("vermelho")).toBeNull();
    expect(normalizeHexColor("#GGGGGG")).toBeNull();
    expect(normalizeHexColor("")).toBeNull();
  });
});

describe("ColorPicker — seleção de cor (DESIGN_SYSTEM §13)", () => {
  it("mostra placeholder sem valor e a cor selecionada com valor", () => {
    const { rerender } = render(<ColorPicker value="" onValueChange={() => undefined} ariaLabel="Cor da categoria" />);
    expect(screen.getByRole("button", { name: "Cor da categoria" })).toHaveTextContent("Escolha a cor");

    rerender(<ColorPicker value="#2A9D8F" onValueChange={() => undefined} ariaLabel="Cor da categoria" />);
    expect(screen.getByRole("button", { name: "Cor da categoria" })).toHaveTextContent("#2A9D8F");
  });

  it("aplica a cor ao clicar num swatch da paleta", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ColorPicker value="" onValueChange={onChange} ariaLabel="Cor da categoria" />);

    await user.click(screen.getByRole("button", { name: "Cor da categoria" }));
    await user.click(screen.getByRole("radio", { name: `Cor ${BRAND_COLOR_PALETTE[0]}` }));

    expect(onChange).toHaveBeenCalledWith(BRAND_COLOR_PALETTE[0]);
  });

  it("marca o swatch selecionado como checado", async () => {
    const user = userEvent.setup();
    render(<ColorPicker value="#2A9D8F" onValueChange={() => undefined} ariaLabel="Cor" />);

    await user.click(screen.getByRole("button", { name: "Cor" }));
    expect(screen.getByRole("radio", { name: "Cor #2A9D8F" })).toHaveAttribute("aria-checked", "true");
  });

  it("aplica cor personalizada válida ao digitar (hex normalizado)", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ColorPicker value="" onValueChange={onChange} ariaLabel="Cor" />);

    await user.click(screen.getByRole("button", { name: "Cor" }));
    const hex = screen.getByLabelText("Cor personalizada em hexadecimal");
    await user.type(hex, "f43f5e");

    expect(onChange).toHaveBeenLastCalledWith("#F43F5E");
  });

  it("ignora entrada inválida no campo custom (sem aplicar)", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ColorPicker value="#2A9D8F" onValueChange={onChange} ariaLabel="Cor" />);

    await user.click(screen.getByRole("button", { name: "Cor" }));
    const hex = screen.getByLabelText("Cor personalizada em hexadecimal");
    await user.type(hex, "xyz");

    expect(onChange).not.toHaveBeenCalled();
  });

  it("limpa a cor pelo botão de limpar do trigger", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ColorPicker value="#2A9D8F" onValueChange={onChange} ariaLabel="Cor" />);

    await user.click(screen.getByRole("button", { name: "Limpar cor" }));

    expect(onChange).toHaveBeenCalledWith("");
  });
});
