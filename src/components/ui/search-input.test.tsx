import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SearchInput } from "./search-input";

describe("SearchInput — Campo de Busca Canônico (§4)", () => {
  it("renderiza o input de busca com placeholder padrão e acessibilidade", () => {
    render(<SearchInput placeholder="Buscar transações…" aria-label="Buscar lançamentos" />);
    const input = screen.getByPlaceholderText("Buscar transações…");
    expect(input).toBeInTheDocument();
    expect(screen.getByLabelText("Buscar lançamentos")).toBeInTheDocument();
  });

  it("exibe botão de limpar quando há valor e executa onClear ao clicar", async () => {
    const user = userEvent.setup();
    const handleClear = vi.fn();
    render(<SearchInput value="Supermercado" onChange={vi.fn()} onClear={handleClear} />);

    const clearBtn = screen.getByRole("button", { name: "Limpar campo de busca" });
    expect(clearBtn).toBeInTheDocument();

    await user.click(clearBtn);
    expect(handleClear).toHaveBeenCalledTimes(1);
  });

  it("limpa valor via teclado ao pressionar Escape", () => {
    const handleChange = vi.fn();
    render(<SearchInput value="Aluguel" onChange={handleChange} />);

    const input = screen.getByDisplayValue("Aluguel");
    fireEvent.keyDown(input, { key: "Escape" });

    expect(handleChange).toHaveBeenCalled();
  });
});
