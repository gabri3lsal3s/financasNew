import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Tabs } from "./tabs";

const items = [
  { value: "gastos", label: "Gastos", content: <p>Conteúdo de gastos</p> },
  { value: "rendas", label: "Rendas", content: <p>Conteúdo de rendas</p> },
];

const clock = { now: 0 };

beforeEach(() => {
  clock.now = 0;
  vi.stubGlobal("performance", { now: () => clock.now });
  Object.defineProperty(window, "innerWidth", { value: 390, configurable: true });
});

describe("Tabs", () => {
  it("mostra a aba ativa e o conteúdo correspondente", () => {
    render(<Tabs value="gastos" onValueChange={vi.fn()} items={items} />);
    expect(screen.getByRole("tab", { name: "Gastos" })).toHaveAttribute("data-state", "active");
    expect(screen.getByText("Conteúdo de gastos")).toBeInTheDocument();
  });

  it("notifica a troca de aba", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Tabs value="gastos" onValueChange={onValueChange} items={items} />);

    await user.click(screen.getByRole("tab", { name: "Rendas" }));
    expect(onValueChange).toHaveBeenCalledWith("rendas");
  });

  it("swipeable: gesto horizontal alterna as abas (F20)", () => {
    const onValueChange = vi.fn();
    const { container } = render(
      <Tabs value="gastos" onValueChange={onValueChange} items={items} swipeable />,
    );
    const content = container.querySelector("[data-swipe-tabs-content]")!;

    // Esquerda → próxima aba (rendas).
    fireEvent.pointerDown(content, { clientX: 300, clientY: 100, pointerId: 1, pointerType: "touch", isPrimary: true });
    clock.now = 200;
    fireEvent.pointerMove(content, { clientX: 220, clientY: 105, pointerId: 1, pointerType: "touch", isPrimary: true });
    clock.now = 500;
    fireEvent.pointerUp(content, { clientX: 220, clientY: 105, pointerId: 1, pointerType: "touch", isPrimary: true });

    expect(onValueChange).toHaveBeenCalledWith("rendas");
  });

  it("swipeable: gesto na última aba em direção à frente NÃO navega (borda)", () => {
    const onValueChange = vi.fn();
    const { container } = render(
      <Tabs value="rendas" onValueChange={onValueChange} items={items} swipeable />,
    );
    const content = container.querySelector("[data-swipe-tabs-content]")!;

    fireEvent.pointerDown(content, { clientX: 300, clientY: 100, pointerId: 1, pointerType: "touch", isPrimary: true });
    clock.now = 200;
    fireEvent.pointerMove(content, { clientX: 220, clientY: 105, pointerId: 1, pointerType: "touch", isPrimary: true });
    clock.now = 500;
    fireEvent.pointerUp(content, { clientX: 220, clientY: 105, pointerId: 1, pointerType: "touch", isPrimary: true });

    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("sem swipeable, o conteúdo não recebe handlers de gesto", () => {
    const { container } = render(<Tabs value="gastos" onValueChange={vi.fn()} items={items} />);
    const content = container.querySelector<HTMLElement>("[data-swipe-tabs-content]")!;
    expect(content.style.touchAction).toBe("");
  });
});
