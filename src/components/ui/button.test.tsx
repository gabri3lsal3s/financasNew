import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./button";

describe("Button", () => {
  it("renderiza o botão com variante padrão e responde a cliques", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Clique aqui</Button>);

    const btn = screen.getByRole("button", { name: "Clique aqui" });
    expect(btn).toBeInTheDocument();
    await user.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renderiza corretamente com tamanho xs", () => {
    render(<Button size="xs">Ação Compacta</Button>);
    const btn = screen.getByRole("button", { name: "Ação Compacta" });
    expect(btn.className).toContain("h-7");
    expect(btn.className).toContain("px-2.5");
    expect(btn.className).toContain("text-xs");
  });

  it("exibe estado de loading e desabilita interações", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button loading onClick={onClick}>Enviar</Button>);

    const btn = screen.getByRole("button", { name: /carregando/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-busy", "true");
    await user.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("dispara feedback sensorial calibrado via triggerSensory e respeita sensoryIntent", async () => {
    const user = userEvent.setup();
    const sensoryService = await import("@/services/sensory");
    const spy = vi.spyOn(sensoryService, "triggerSensory");

    // 1. Padrão: dispara "action"
    const { rerender } = render(<Button>Botão Padrão</Button>);
    await user.click(screen.getByRole("button", { name: "Botão Padrão" }));
    expect(spy).toHaveBeenCalledWith("action");
    spy.mockClear();

    // 2. Destructive: dispara "destructive"
    rerender(<Button variant="destructive">Excluir</Button>);
    await user.click(screen.getByRole("button", { name: "Excluir" }));
    expect(spy).toHaveBeenCalledWith("destructive");
    spy.mockClear();

    // 3. Custom sensoryIntent="success"
    rerender(<Button sensoryIntent="success">Confirmar</Button>);
    await user.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(spy).toHaveBeenCalledWith("success");
    spy.mockClear();

    // 4. sensoryIntent={false} desativa disparo sensorial no botão
    rerender(<Button sensoryIntent={false}>Silencioso</Button>);
    await user.click(screen.getByRole("button", { name: "Silencioso" }));
    expect(spy).not.toHaveBeenCalled();

    spy.mockRestore();
  });
});
