import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Tag } from "lucide-react";
import { Chip } from "./chip";
import * as sensoryModule from "@/services/sensory";

vi.mock("@/services/sensory", () => ({
  triggerSensory: vi.fn(),
}));

describe("Chip Primitive Component", () => {
  it("renderiza corretamente com texto e variante padrão", () => {
    render(<Chip>Alimentação</Chip>);
    const chip = screen.getByRole("button", { name: "Alimentação" });
    expect(chip).toBeInTheDocument();
    expect(chip).toHaveAttribute("type", "button");
    expect(chip.className).toContain("border-border/80");
  });

  it("aplica estilo de selecionado quando selected={true}", () => {
    render(<Chip selected={true}>Transporte</Chip>);
    const chip = screen.getByRole("button", { name: "Transporte" });
    expect(chip).toHaveAttribute("aria-pressed", "true");
    expect(chip.className).toContain("border-primary");
    expect(chip.className).toContain("text-primary");
  });

  it("renderiza ícone auxiliar quando fornecido", () => {
    render(<Chip icon={<Tag data-testid="tag-icon" />}>Etiqueta</Chip>);
    expect(screen.getByTestId("tag-icon")).toBeInTheDocument();
  });

  it("dispara callback onClick e triggerSensory ao ser clicado", async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(<Chip onClick={handleClick}>Clicável</Chip>);

    await user.click(screen.getByRole("button", { name: "Clicável" }));
    expect(handleClick).toHaveBeenCalledTimes(1);
    expect(sensoryModule.triggerSensory).toHaveBeenCalledWith("action");
  });

  it("não dispara onClick nem triggerSensory quando desabilitado", async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(<Chip disabled onClick={handleClick}>Desabilitado</Chip>);

    const button = screen.getByRole("button", { name: "Desabilitado" });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });
});
