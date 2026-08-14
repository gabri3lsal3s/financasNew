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

  it("aplica o tom da marca (primary) por padrão no ícone — sem fundo", () => {
    const { container } = render(<EmptyState {...base} />);
    const icon = container.querySelector("div.size-12");
    expect(icon).toHaveClass("text-primary-strong");
    expect(icon).not.toHaveClass("bg-primary/10", "bg-muted");
  });

  it("aplica o tom semântico informado (negative) e o neutro (default)", () => {
    const { container, rerender } = render(<EmptyState {...base} tone="negative" />);
    let icon = container.querySelector("div.size-12");
    expect(icon).toHaveClass("text-negative-strong");

    rerender(<EmptyState {...base} tone="default" />);
    icon = container.querySelector("div.size-12");
    expect(icon).toHaveClass("text-muted-foreground");
    expect(icon).not.toHaveClass("bg-muted");
  });

  it("não renderiza o contêiner do ícone sem ícone", () => {
    const { container } = render(<EmptyState title="Vazio" />);
    expect(container.querySelector("div.size-12")).toBeNull();
  });
});
