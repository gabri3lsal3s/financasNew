import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CarouselDismissPopover } from "./carousel-dismiss-popover";

describe("CarouselDismissPopover", () => {
  it("renderiza o botão de acionamento com acessibilidade", () => {
    render(<CarouselDismissPopover onDismiss={vi.fn()} label="Dispensar aviso" />);
    const trigger = screen.getByRole("button", { name: "Dispensar aviso" });
    expect(trigger).toBeInTheDocument();
  });

  it("abre as opções de 7 dias e 1 mês com data prevista e dispara onDismiss legado", () => {
    const handleDismiss = vi.fn();
    const nowMs = new Date(2026, 10, 27, 10, 0).getTime();
    render(<CarouselDismissPopover onDismiss={handleDismiss} nowMs={nowMs} />);

    fireEvent.click(screen.getByRole("button", { name: "Dispensar aviso" }));
    expect(screen.getByText("Ocultar este aviso")).toBeInTheDocument();
    expect(screen.getByText("até 04/12")).toBeInTheDocument();
    expect(screen.getByText("até 27/12")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Dispensar por 7 dias/i }));
    expect(handleDismiss).toHaveBeenCalledWith(7);
  });

  it("suporta onSelectPreset com 7d, 1m e 6m e exibe data de retorno", () => {
    const onSelectPreset = vi.fn();
    const nowMs = new Date(2026, 10, 27, 10, 0).getTime();
    render(
      <CarouselDismissPopover
        allowedPresets={["7d", "1m", "6m"]}
        onSelectPreset={onSelectPreset}
        nowMs={nowMs}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Dispensar aviso" }));
    expect(screen.getByText("até 27/05/27")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Dispensar em 6 meses/i }));
    expect(onSelectPreset).toHaveBeenCalledWith("6m");
  });
});
