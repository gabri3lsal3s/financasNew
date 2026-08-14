import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Inbox } from "lucide-react";
import { EmptyState } from "./empty-state";

const base = {
  icon: <Inbox className="size-6" aria-hidden="true" />,
  title: "Sem lançamentos",
  description: "Registre receitas e despesas para ver os KPIs aqui.",
};

describe("EmptyState (F12 — polimento)", () => {
  it("renderiza título, descrição e ação", () => {
    render(<EmptyState {...base} action={<button type="button">Criar</button>} />);
    expect(screen.getByText("Sem lançamentos")).toBeInTheDocument();
    expect(screen.getByText(/Registre receitas/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Criar" })).toBeInTheDocument();
  });

  it("aplica o tom da marca (primary) por padrão no círculo do ícone", () => {
    const { container } = render(<EmptyState {...base} />);
    const circle = container.querySelector("div.rounded-full");
    expect(circle).toHaveClass("bg-primary/10", "text-primary-strong", "ring-primary/20");
  });

  it("aplica o tom semântico informado (negative) e o neutro (default)", () => {
    const { container, rerender } = render(<EmptyState {...base} tone="negative" />);
    let circle = container.querySelector("div.rounded-full");
    expect(circle).toHaveClass("bg-negative/10", "text-negative-strong");

    rerender(<EmptyState {...base} tone="default" />);
    circle = container.querySelector("div.rounded-full");
    expect(circle).toHaveClass("bg-muted", "text-muted-foreground");
  });

  it("não renderiza círculo sem ícone", () => {
    const { container } = render(<EmptyState title="Vazio" />);
    expect(container.querySelector("div.rounded-full")).toBeNull();
  });
});
