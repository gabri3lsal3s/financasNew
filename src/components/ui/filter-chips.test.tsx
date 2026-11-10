import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { FilterChips } from "./filter-chips";

describe("FilterChips", () => {
  const items = [
    { key: "all", label: "Todas", count: 15 },
    { key: "open", label: "Abertas", count: 4, tone: "warning" as const },
    { key: "done", label: "Concluídas", count: 11, tone: "positive" as const },
  ];

  it("renderiza todos os itens com contadores e acessibilidade", () => {
    render(<FilterChips items={items} activeKey="all" onChange={() => {}} />);

    expect(screen.getByRole("radiogroup", { name: "Filtros rápidos" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Todas/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: /Abertas/ })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText("(15)")).toBeInTheDocument();
    expect(screen.getByText("(4)")).toBeInTheDocument();
  });

  it("dispara onChange ao clicar em um chip", () => {
    const handleChange = vi.fn();
    render(<FilterChips items={items} activeKey="all" onChange={handleChange} />);

    fireEvent.click(screen.getByRole("radio", { name: /Abertas/ }));
    expect(handleChange).toHaveBeenCalledWith("open");
  });
});
