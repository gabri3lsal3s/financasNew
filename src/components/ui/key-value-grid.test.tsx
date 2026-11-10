import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { KeyValueGrid } from "./key-value-grid";

describe("KeyValueGrid", () => {
  const items = [
    { label: "Cliente", value: "Gabriel Sales" },
    { label: "E-mail", value: "gabriel@exemplo.com" },
    { label: "Plano", value: "Pro Anual", hint: "Ativo até dez/2026", fullWidth: true },
  ];

  it("renderiza todos os itens com rótulos e valores", () => {
    render(<KeyValueGrid items={items} />);

    expect(screen.getByText("Cliente")).toBeInTheDocument();
    expect(screen.getByText("Gabriel Sales")).toBeInTheDocument();
    expect(screen.getByText("gabriel@exemplo.com")).toBeInTheDocument();
    expect(screen.getByText("Ativo até dez/2026")).toBeInTheDocument();
  });
});
