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

  it("swipeable: limpa o transform inline ao finalizar o gesto", () => {
    const onValueChange = vi.fn();
    const { container } = render(
      <Tabs value="gastos" onValueChange={onValueChange} items={items} swipeable />,
    );
    const content = container.querySelector<HTMLElement>("[data-swipe-tabs-content]")!;

    fireEvent.pointerDown(content, { clientX: 300, clientY: 100, pointerId: 1, pointerType: "touch", isPrimary: true });
    clock.now = 200;
    fireEvent.pointerMove(content, { clientX: 250, clientY: 100, pointerId: 1, pointerType: "touch", isPrimary: true });
    expect(content.style.transform).toContain("translateX(-50px)");

    clock.now = 500;
    fireEvent.pointerUp(content, { clientX: 250, clientY: 100, pointerId: 1, pointerType: "touch", isPrimary: true });
    expect(content.style.transform).toBe("");
  });

  it("swipeable: abas aninhadas não disparam a navegação da aba pai", () => {
    const onParentChange = vi.fn();
    const onChildChange = vi.fn();

    const nestedItems = [
      {
        value: "parent-1",
        label: "Pai 1",
        content: (
          <Tabs
            value="child-1"
            onValueChange={onChildChange}
            swipeable
            items={[
              { value: "child-1", label: "Filho 1", content: <p>Filho 1</p> },
              { value: "child-2", label: "Filho 2", content: <p>Filho 2</p> },
            ]}
          />
        ),
      },
      { value: "parent-2", label: "Pai 2", content: <p>Pai 2</p> },
    ];

    const { container } = render(
      <Tabs value="parent-1" onValueChange={onParentChange} items={nestedItems} swipeable />,
    );

    const allTabsContents = container.querySelectorAll<HTMLElement>("[data-swipe-tabs-content]");
    const childContent = allTabsContents[1]!; // o interno

    fireEvent.pointerDown(childContent, { clientX: 300, clientY: 100, pointerId: 1, pointerType: "touch", isPrimary: true });
    clock.now = 200;
    fireEvent.pointerMove(childContent, { clientX: 220, clientY: 105, pointerId: 1, pointerType: "touch", isPrimary: true });
    clock.now = 500;
    fireEvent.pointerUp(childContent, { clientX: 220, clientY: 105, pointerId: 1, pointerType: "touch", isPrimary: true });

    // O filho deve navegar, mas o pai NÃO deve navegar
    expect(onChildChange).toHaveBeenCalledWith("child-2");
    expect(onParentChange).not.toHaveBeenCalled();
  });

  it("sem swipeable, o container não recebe data-swipe-tabs-content", () => {
    const { container } = render(<Tabs value="gastos" onValueChange={vi.fn()} items={items} />);
    const content = container.querySelector<HTMLElement>("[data-swipe-tabs-content]");
    expect(content).toBeNull();
  });

  it("sub-aba não-swipeable permite que o swipe no pai funcione normalmente", () => {
    const onParentChange = vi.fn();
    const onChildChange = vi.fn();

    const nestedItems = [
      {
        value: "parent-1",
        label: "Pai 1",
        content: (
          <Tabs
            value="child-1"
            onValueChange={onChildChange}
            items={[
              { value: "child-1", label: "Filho 1", content: <p>Filho 1</p> },
              { value: "child-2", label: "Filho 2", content: <p>Filho 2</p> },
            ]}
          />
        ),
      },
      { value: "parent-2", label: "Pai 2", content: <p>Pai 2</p> },
    ];

    const { container } = render(
      <Tabs value="parent-1" onValueChange={onParentChange} items={nestedItems} swipeable />,
    );

    const parentContent = container.querySelector<HTMLElement>("[data-swipe-tabs-content]")!;
    const childText = container.querySelector("p")!;

    fireEvent.pointerDown(childText, { clientX: 300, clientY: 100, pointerId: 1, pointerType: "touch", isPrimary: true });
    clock.now = 200;
    fireEvent.pointerMove(parentContent, { clientX: 220, clientY: 105, pointerId: 1, pointerType: "touch", isPrimary: true });
    clock.now = 500;
    fireEvent.pointerUp(parentContent, { clientX: 220, clientY: 105, pointerId: 1, pointerType: "touch", isPrimary: true });

    expect(onParentChange).toHaveBeenCalledWith("parent-2");
    expect(onChildChange).not.toHaveBeenCalled();
  });
});
