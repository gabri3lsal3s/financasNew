import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CarouselDismissPopover } from "./carousel-dismiss-popover";

describe("CarouselDismissPopover", () => {
  it("renderiza o botão de acionamento com acessibilidade", () => {
    render(<CarouselDismissPopover onDismiss={vi.fn()} label="Dispensar aviso" />);
    const trigger = screen.getByRole("button", { name: "Dispensar aviso" });
    expect(trigger).toBeInTheDocument();
  });

  it("abre as opções de 7 dias e 30 dias e dispara onDismiss(7)", () => {
    const handleDismiss = vi.fn();
    render(<CarouselDismissPopover onDismiss={handleDismiss} />);

    fireEvent.click(screen.getByRole("button", { name: "Dispensar aviso" }));
    expect(screen.getByText("Ocultar este aviso")).toBeInTheDocument();

    const btn7 = screen.getByRole("button", { name: "Dispensar por 7 dias" });
    fireEvent.click(btn7);

    expect(handleDismiss).toHaveBeenCalledWith(7);
  });

  it("abre as opções e dispara onDismiss(30) ao clicar em Lembrar no próximo mês", () => {
    const handleDismiss = vi.fn();
    render(<CarouselDismissPopover onDismiss={handleDismiss} />);

    fireEvent.click(screen.getByRole("button", { name: "Dispensar aviso" }));
    const btn30 = screen.getByRole("button", { name: "Lembrar no próximo mês" });
    fireEvent.click(btn30);

    expect(handleDismiss).toHaveBeenCalledWith(30);
  });
});
