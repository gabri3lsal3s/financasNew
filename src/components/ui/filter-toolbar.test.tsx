import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { FilterToolbar } from "./filter-toolbar";

describe("FilterToolbar", () => {
  it("renderiza slots de busca, filtros e ações corretamente", () => {
    render(
      <FilterToolbar
        searchSlot={<input placeholder="Buscar…" />}
        filtersSlot={<button>Filtro</button>}
        actionsSlot={<button>Limpar</button>}
      />,
    );

    expect(screen.getByPlaceholderText("Buscar…")).toBeInTheDocument();
    expect(screen.getByText("Filtro")).toBeInTheDocument();
    expect(screen.getByText("Limpar")).toBeInTheDocument();
  });
});
