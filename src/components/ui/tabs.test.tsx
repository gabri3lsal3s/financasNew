import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Tabs } from "./tabs";

const items = [
  { value: "gastos", label: "Gastos", content: <p>Conteúdo de gastos</p> },
  { value: "rendas", label: "Rendas", content: <p>Conteúdo de rendas</p> },
];

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
});
